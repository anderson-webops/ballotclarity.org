import type { KeyObject } from "node:crypto";
import type { IncomingHttpHeaders } from "node:http";
import { Buffer } from "node:buffer";
import { createHash, createPublicKey, randomUUID, sign, verify } from "node:crypto";

export const handoffPath = "/api/private-release-handoffs";
export const maximumHandoffBytes = 16 * 1024 * 1024;
export const maximumHandoffFileBytes = 8 * 1024 * 1024;
export const handoffNames = [
	"CURRENT-SERVER-HANDOFF.md",
	"DATA-DELTA.json",
	"PENDING-DELIVERY.json",
	"SERVER-DATA-BASELINE.json",
	"SERVER-RECEIVED-DATA-BASELINE.json",
	"PENDING-CONTENT.zip",
	"PENDING-CONTENT.zip.sha256",
	"OPERATOR-REPORTED-RECEIPT.json"
] as const;
const components = "(\"@method\" \"@path\" \"content-digest\" \"x-handoff-id\" \"x-handoff-audience\")";
const hexadecimal = /^[a-f\d]{64}$/u;
const uuid = /^[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/u;

export const privateHandoffContract = {
	schemaVersion: 1,
	capability: "ballot-private-release-handoff",
	optionalIndependentWorker: true,
	entrypoint: "back-end/dist/private-handoff-receiver.js",
	configuration: "PRIVATE_HANDOFF_RECEIVER_CONFIG",
	configurationFields: [
		"schemaVersion",
		"audience",
		"publicKeys",
		"inboxDirectory",
		"port",
		"maximumBytes",
		"maximumEntries"
	],
	listener: "loopback-only",
	transport: "host-terminated-https",
	method: "POST",
	path: handoffPath,
	signatureProfile: "RFC9421-restricted-Ed25519-v1",
	maximumRequestBytes: maximumHandoffBytes,
	maximumFileBytes: maximumHandoffFileBytes,
	maximumFiles: handoffNames.length,
	maximumConcurrentRequests: 2,
	defaultInboxBytes: 64 * 1024 * 1024,
	defaultInboxEntries: 256,
	externalWritableState:
		"inboxDirectory: owner-only, outside artifacts and webroot, preserved across promotion and rollback",
	retention: "owner-managed; capacity exhaustion holds new intake rather than deleting accepted packets",
	receiptScope: "custody-only",
	dataImport: false,
	instructionExecution: false,
	deploymentActivation: false
} as const;

export interface HandoffRelease {
	tag: string;
	commit: string;
	archiveSha256: string;
}
export interface HandoffFile {
	name: string;
	bytes: number;
	sha256: string;
	contentBase64: string;
}
export interface HandoffEnvelope {
	schemaVersion: 1;
	type: "ballot-private-release-handoff";
	audience: string;
	release: HandoffRelease;
	files: HandoffFile[];
}
export interface HandoffAuthentication {
	id: string;
	keyId: string;
	payloadSha256: string;
}
export interface HandoffReceipt extends HandoffAuthentication {
	schemaVersion: 1;
	type: "ballot-private-handoff-receipt";
	audience: string;
	release: HandoffRelease;
	receivedAt: string;
	custodyOnly: true;
	files: Omit<HandoffFile, "contentBase64">[];
}

export class HandoffError extends Error {
	constructor(
		public status: number,
		public code: string
	) {
		super(code);
	}
}

export function handoffHash(body: Uint8Array | string) {
	return createHash("sha256").update(body).digest("hex");
}
export function record(value: unknown): value is Record<string, unknown> {
	return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
function exact(value: Record<string, unknown>, names: string[]) {
	return Object.keys(value).sort().join(",") === [...names].sort().join(",");
}
export function validAudience(value: unknown): value is string {
	return typeof value === "string" && /^[a-z\d][a-z\d:._-]{0,99}$/u.test(value);
}
export function validateRelease(value: unknown): asserts value is HandoffRelease {
	if (
		!record(value)
		|| !exact(value, ["tag", "commit", "archiveSha256"])
		|| typeof value.tag !== "string"
		|| !/^v1\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/u.test(value.tag)
		|| typeof value.commit !== "string"
		|| !/^[a-f\d]{40}$/u.test(value.commit)
		|| typeof value.archiveSha256 !== "string"
		|| !hexadecimal.test(value.archiveSha256)
	) {
		throw new HandoffError(400, "invalid-release");
	}
}

export function handoffKeyId(key: KeyObject) {
	const publicKey = key.type === "public" ? key : createPublicKey(key);
	if (publicKey.asymmetricKeyType !== "ed25519") throw new Error("Handoff keys must use Ed25519.");
	return handoffHash(publicKey.export({ type: "spki", format: "der" }));
}

function signatureBase(digest: string, id: string, audience: string, parameters: string) {
	return Buffer.from(
		`"@method": POST\n"@path": ${handoffPath}\n"content-digest": ${digest}\n"x-handoff-id": ${id}\n"x-handoff-audience": ${audience}\n"@signature-params": ${parameters}`
	);
}

export function signHandoff(
	body: Buffer,
	audience: string,
	key: KeyObject,
	id: string = randomUUID(),
	now = Date.now()
) {
	if (!validAudience(audience) || !uuid.test(id) || !Number.isFinite(now) || key.type !== "private")
		throw new Error("Invalid handoff signing configuration.");
	const created = Math.floor(now / 1000);
	const parameters = `${components};created=${created};expires=${created + 300};keyid="${handoffKeyId(key)}";alg="ed25519"`;
	const digest = `sha-256=:${createHash("sha256").update(body).digest("base64")}:`;
	return {
		"content-type": "application/json",
		"content-digest": digest,
		"signature-input": `handoff=${parameters}`,
		"signature": `handoff=:${sign(null, signatureBase(digest, id, audience, parameters), key).toString("base64")}:`,
		"x-handoff-id": id,
		"x-handoff-audience": audience
	};
}

export function authenticateHandoff(
	headers: IncomingHttpHeaders,
	audience: string,
	keys: ReadonlyMap<string, KeyObject>,
	now = Date.now()
): HandoffAuthentication {
	const input = headers["signature-input"];
	const signature = headers.signature;
	const digest = headers["content-digest"];
	const id = headers["x-handoff-id"];
	if (
		headers["content-type"] !== "application/json"
		|| headers["content-encoding"]
		|| headers["x-handoff-audience"] !== audience
		|| typeof input !== "string"
		|| typeof signature !== "string"
		|| typeof digest !== "string"
		|| typeof id !== "string"
		|| !uuid.test(id)
	) {
		throw new HandoffError(401, "unauthorized");
	}
	const prefix = `handoff=${components};created=`;
	if (!input.startsWith(prefix)) throw new HandoffError(401, "unauthorized");
	const parameters = /^([1-9]\d{0,11});expires=([1-9]\d{0,11});keyid="([a-f\d]{64})";alg="ed25519"$/u.exec(
		input.slice(prefix.length)
	);
	const encodedDigest = /^sha-256=:([A-Za-z\d+/]{43}=):$/u.exec(digest);
	const encodedSignature = /^handoff=:([A-Za-z\d+/]{86}==):$/u.exec(signature);
	if (!parameters || !encodedDigest || !encodedSignature || !Number.isFinite(now))
		throw new HandoffError(401, "unauthorized");
	const created = Number(parameters[1]);
	const expires = Number(parameters[2]);
	const seconds = Math.floor(now / 1000);
	const keyId = parameters[3]!;
	const key = keys.get(keyId);
	if (
		!key
		|| created > seconds + 30
		|| expires < seconds
		|| expires <= created
		|| expires - created > 300
		|| handoffKeyId(key) !== keyId
		|| !verify(
			null,
			signatureBase(digest, id, audience, input.slice("handoff=".length)),
			key,
			Buffer.from(encodedSignature[1]!, "base64")
		)
	) {
		throw new HandoffError(401, "unauthorized");
	}
	return { id, keyId, payloadSha256: Buffer.from(encodedDigest[1]!, "base64").toString("hex") };
}

export function validateHandoff(body: Buffer, audience: string): HandoffEnvelope {
	if (body.length > maximumHandoffBytes) throw new HandoffError(413, "handoff-too-large");
	let value: unknown;
	try {
		value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body));
	}
	catch {
		throw new HandoffError(400, "invalid-handoff");
	}
	if (
		!record(value)
		|| !exact(value, ["schemaVersion", "type", "audience", "release", "files"])
		|| value.schemaVersion !== 1
		|| value.type !== "ballot-private-release-handoff"
		|| !validAudience(audience)
		|| value.audience !== audience
		|| !Array.isArray(value.files)
		|| value.files.length < 5
		|| value.files.length > handoffNames.length
	) {
		throw new HandoffError(400, "invalid-handoff");
	}
	validateRelease(value.release);
	const files = new Map<string, { metadata: HandoffFile; body: Buffer }>();
	let total = 0;
	for (const file of value.files) {
		if (
			!record(file)
			|| !exact(file, ["name", "bytes", "sha256", "contentBase64"])
			|| typeof file.name !== "string"
			|| !(handoffNames as readonly string[]).includes(file.name)
			|| files.has(file.name)
			|| !Number.isSafeInteger(file.bytes)
			|| Number(file.bytes) < 1
			|| Number(file.bytes) > maximumHandoffFileBytes
			|| typeof file.sha256 !== "string"
			|| !hexadecimal.test(file.sha256)
			|| typeof file.contentBase64 !== "string"
			|| file.contentBase64.length > Math.ceil(maximumHandoffFileBytes / 3) * 4
		) {
			throw new HandoffError(400, "invalid-file");
		}
		const decoded = Buffer.from(file.contentBase64, "base64");
		if (
			decoded.toString("base64") !== file.contentBase64
			|| decoded.length !== file.bytes
			|| handoffHash(decoded) !== file.sha256
		) {
			throw new HandoffError(400, "invalid-file");
		}
		total += decoded.length;
		if (total > maximumHandoffBytes * 0.7) throw new HandoffError(413, "handoff-too-large");
		files.set(file.name, { metadata: file as unknown as HandoffFile, body: decoded });
	}
	for (const name of handoffNames.slice(0, 5)) {
		if (!files.has(name)) throw new HandoffError(400, "missing-file");
	}
	const metadata = new Map<string, Record<string, unknown>>();
	for (const [name, file] of files) {
		if (name.endsWith(".zip")) continue;
		let text: string;
		try {
			text = new TextDecoder("utf-8", { fatal: true }).decode(file.body);
		}
		catch {
			throw new HandoffError(400, "invalid-text");
		}
		if (/-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----/u.test(text))
			throw new HandoffError(400, "private-key-material-rejected");
		if (name.endsWith(".json")) {
			let parsed: unknown;
			try {
				parsed = JSON.parse(text);
			}
			catch {
				throw new HandoffError(400, "invalid-json");
			}
			if (!record(parsed)) throw new HandoffError(400, "invalid-json");
			metadata.set(name, parsed);
		}
	}
	const pending = metadata.get("PENDING-DELIVERY.json")!;
	const delta = metadata.get("DATA-DELTA.json")!;
	const source = pending.currentSourceRelease;
	if (
		!record(source)
		|| source.sourceTag !== value.release.tag
		|| source.sourceCommit !== value.release.commit
		|| source.archiveSha256 !== value.release.archiveSha256
		|| source.publicationVerified !== true
		|| !Number.isSafeInteger(delta.pendingFileCount)
		|| Number(delta.pendingFileCount) < 0
		|| Number(delta.pendingFileCount) > 20000
		|| pending.pendingContentFiles !== delta.pendingFileCount
	) {
		throw new HandoffError(400, "release-or-delta-mismatch");
	}
	const zip = files.get("PENDING-CONTENT.zip");
	const checksum = files.get("PENDING-CONTENT.zip.sha256");
	if (delta.pendingFileCount === 0) {
		if (zip || checksum || (delta.archive && (!record(delta.archive) || delta.archive.created !== false)))
			throw new HandoffError(400, "unexpected-content-archive");
	}
	else if (
		!zip
		|| !checksum
		|| !record(delta.archive)
		|| delta.archive.created !== true
		|| delta.archive.fileCount !== delta.pendingFileCount
		|| delta.archive.sha256 !== zip.metadata.sha256
		|| delta.archive.bytes !== zip.metadata.bytes
		|| checksum.body.toString("utf8").trim() !== `${zip.metadata.sha256}  PENDING-CONTENT.zip`
		|| zip.body.subarray(0, 4).toString("hex") !== "504b0304"
	) {
		throw new HandoffError(400, "content-archive-mismatch");
	}
	return value as unknown as HandoffEnvelope;
}

export function validateHandoffReceipt(
	value: unknown,
	envelope: HandoffEnvelope,
	authentication: HandoffAuthentication
): asserts value is HandoffReceipt {
	if (
		!record(value)
		|| !exact(value, [
			"schemaVersion",
			"type",
			"id",
			"keyId",
			"payloadSha256",
			"audience",
			"release",
			"receivedAt",
			"custodyOnly",
			"files"
		])
		|| value.schemaVersion !== 1
		|| value.type !== "ballot-private-handoff-receipt"
		|| value.id !== authentication.id
		|| value.keyId !== authentication.keyId
		|| value.payloadSha256 !== authentication.payloadSha256
		|| value.audience !== envelope.audience
		|| value.custodyOnly !== true
		|| typeof value.receivedAt !== "string"
		|| !Number.isFinite(Date.parse(value.receivedAt))
		|| new Date(value.receivedAt).toISOString() !== value.receivedAt
		|| JSON.stringify(value.release) !== JSON.stringify(envelope.release)
		|| JSON.stringify(value.files)
		!== JSON.stringify(envelope.files.map(({ name, bytes, sha256 }) => ({ name, bytes, sha256 })))
	) {
		throw new HandoffError(502, "receipt-mismatch");
	}
}
