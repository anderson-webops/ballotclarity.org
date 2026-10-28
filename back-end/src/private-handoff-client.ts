import type { KeyObject } from "node:crypto";
import type {
	HandoffAuthentication,
	HandoffEnvelope,
	HandoffReceipt,
	HandoffRelease
} from "./private-handoff-protocol.js";
import { Buffer } from "node:buffer";
import { createPrivateKey, generateKeyPairSync, randomUUID } from "node:crypto";
import { lstat, readdir, realpath } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve, sep } from "node:path";
import process from "node:process";
import { setTimeout } from "node:timers/promises";
import {
	HandoffError,
	handoffHash,
	handoffKeyId,
	handoffNames,
	handoffPath,
	maximumHandoffFileBytes,
	record,
	signHandoff,
	validateHandoff,
	validateHandoffReceipt,
	validateRelease,
	validAudience
} from "./private-handoff-protocol.js";
import {
	privateHandoffDirectory,
	readHandoffFile,
	syncDirectory,
	writePrivateHandoffFile
} from "./private-handoff-storage.js";

async function keyLocation(directory: string) {
	if (!isAbsolute(directory) || directory.split(sep).includes(".ai-work"))
		throw new Error("Keep handoff signing keys outside repositories and AI working folders.");
	let parent = resolve(directory);
	while (true) {
		const git = await lstat(join(parent, ".git")).catch((error: NodeJS.ErrnoException) => {
			if (error.code === "ENOENT") return null;
			throw error;
		});
		if (git) throw new Error("Keep handoff signing keys outside repositories.");
		if (dirname(parent) === parent) break;
		parent = dirname(parent);
	}
}

export async function initializeHandoffClient(directory: string, audience: string) {
	if (!validAudience(audience)) throw new Error("Invalid handoff audience.");
	await keyLocation(directory);
	const canonical = await privateHandoffDirectory(directory, true);
	if ((await readdir(canonical)).length)
		throw new Error("Use a new empty directory; existing keys and profiles are preserved.");
	const keys = generateKeyPairSync("ed25519");
	const privateKeyPath = join(canonical, "signing-key.pem");
	await writePrivateHandoffFile(privateKeyPath, keys.privateKey.export({ type: "pkcs8", format: "pem" }).toString());
	await writePrivateHandoffFile(
		join(canonical, "public-key.pem"),
		keys.publicKey.export({ type: "spki", format: "pem" }).toString()
	);
	await writePrivateHandoffFile(
		join(canonical, "profile.json"),
		`${JSON.stringify({ schemaVersion: 1, audience, endpoint: null, privateKeyPath }, null, 2)}\n`
	);
	return {
		profile: join(canonical, "profile.json"),
		keyId: handoffKeyId(keys.publicKey),
		publicKeyPem: keys.publicKey.export({ type: "spki", format: "pem" }).toString(),
		endpointConfigured: false
	};
}

export function handoffEndpoint(value: unknown): string {
	if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === "0")
		throw new Error("Private handoff delivery requires certificate verification.");
	if (typeof value !== "string")
		throw new Error("The handoff endpoint is not configured; finish server enrollment first.");
	const url = new URL(value);
	if (
		url.protocol !== "https:"
		|| url.pathname !== handoffPath
		|| url.username
		|| url.password
		|| url.search
		|| url.hash
	) {
		throw new Error("Handoff delivery requires the exact HTTPS endpoint without credentials or query parameters.");
	}
	return url.href;
}

export async function loadHandoffProfile(filename: string) {
	await keyLocation(dirname(filename));
	const value: unknown = JSON.parse((await readHandoffFile(filename, 16 * 1024, true)).toString("utf8"));
	if (
		!record(value)
		|| Object.keys(value).sort().join(",") !== "audience,endpoint,privateKeyPath,schemaVersion"
		|| value.schemaVersion !== 1
		|| !validAudience(value.audience)
		|| typeof value.privateKeyPath !== "string"
		|| !isAbsolute(value.privateKeyPath)
	) {
		throw new Error("Invalid protected handoff profile.");
	}
	await keyLocation(dirname(value.privateKeyPath));
	if ((await realpath(value.privateKeyPath)) !== value.privateKeyPath)
		throw new Error("Handoff signing keys must not use redirected paths.");
	const endpoint = handoffEndpoint(value.endpoint);
	const key = createPrivateKey(await readHandoffFile(value.privateKeyPath, 4096, true));
	handoffKeyId(key);
	return { endpoint, audience: value.audience, key };
}

export async function buildHandoff(directory: string, audience: string, release: HandoffRelease) {
	validateRelease(release);
	const canonical = await realpath(directory);
	if (!isAbsolute(directory) || canonical !== resolve(directory) || !(await lstat(directory)).isDirectory())
		throw new Error("Use the canonical active handoff directory.");
	const names = (await readdir(directory)).filter(name => name !== ".DS_Store").sort();
	if (names.some(name => !(handoffNames as readonly string[]).includes(name)))
		throw new Error("Unexpected files in the active handoff; review them before delivery.");
	const files = [];
	for (const name of names) {
		const body = await readHandoffFile(join(directory, name), maximumHandoffFileBytes);
		files.push({ name, bytes: body.length, sha256: handoffHash(body), contentBase64: body.toString("base64") });
	}
	const body = Buffer.from(
		JSON.stringify({ schemaVersion: 1, type: "ballot-private-release-handoff", audience, release, files })
	);
	const envelope = validateHandoff(body, audience);
	for (const file of files) {
		if (handoffHash(await readHandoffFile(join(directory, file.name), maximumHandoffFileBytes)) !== file.sha256)
			throw new Error("Handoff contents changed during preparation.");
	}
	return { body, envelope };
}

async function boundedResponse(response: Response) {
	if (!response.body) throw new HandoffError(502, "missing-receipt");
	const reader = response.body.getReader();
	const chunks: Buffer[] = [];
	let bytes = 0;
	try {
		while (true) {
			const item = await reader.read();
			if (item.done) break;
			bytes += item.value.length;
			if (bytes > 16 * 1024) throw new HandoffError(502, "oversized-receipt");
			chunks.push(Buffer.from(item.value));
		}
		return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
	}
	finally {
		await reader.cancel();
	}
}

export async function deliverHandoff(options: {
	endpoint: string;
	audience: string;
	key: KeyObject;
	body: Buffer;
	request?: typeof fetch;
	pause?: (milliseconds: number) => Promise<unknown>;
	now?: () => number;
	id?: string;
}) {
	const endpoint = handoffEndpoint(options.endpoint);
	const envelope: HandoffEnvelope = validateHandoff(options.body, options.audience);
	const id = options.id ?? randomUUID();
	const now = options.now ?? Date.now;
	const authentication: HandoffAuthentication = {
		id,
		keyId: handoffKeyId(options.key),
		payloadSha256: handoffHash(options.body)
	};
	for (let attempt = 0; attempt < 3; attempt++) {
		try {
			const response = await (options.request ?? fetch)(endpoint, {
				method: "POST",
				headers: signHandoff(options.body, options.audience, options.key, id, now()),
				body: options.body.toString("utf8"),
				redirect: "error",
				credentials: "omit",
				signal: AbortSignal.timeout(30000)
			});
			if (![200, 201].includes(response.status)) {
				await response.body?.cancel();
				throw new HandoffError(response.status, "handoff-not-accepted");
			}
			const value = await boundedResponse(response);
			if (
				!record(value)
				|| Object.keys(value).sort().join(",") !== "duplicate,receipt"
				|| typeof value.duplicate !== "boolean"
			) {
				throw new HandoffError(502, "receipt-mismatch");
			}
			validateHandoffReceipt(value.receipt, envelope, authentication);
			return { receipt: value.receipt as HandoffReceipt, duplicate: value.duplicate };
		}
		catch (error) {
			if (
				attempt === 2
				|| (error instanceof HandoffError && ![408, 429, 500, 502, 503, 504].includes(error.status))
			) {
				throw error;
			}
			await (options.pause ?? setTimeout)((attempt + 1) * 1000);
		}
	}
	throw new Error("Handoff delivery did not complete.");
}

export async function deliverHandoffWithReceipt(
	options: Parameters<typeof deliverHandoff>[0] & { receiptsDirectory: string }
) {
	const directory = await privateHandoffDirectory(options.receiptsDirectory, true);
	const endpoint = handoffEndpoint(options.endpoint);
	const envelope = validateHandoff(options.body, options.audience);
	const keyId = handoffKeyId(options.key);
	const payloadSha256 = handoffHash(options.body);
	const identity = handoffHash(`${endpoint}\n${options.audience}\n${keyId}\n${payloadSha256}`);
	const requestFile = join(directory, `${identity}.request.json`);
	let request: unknown;
	try {
		request = JSON.parse((await readHandoffFile(requestFile, 4096, true)).toString("utf8"));
	}
	catch (error) {
		if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
		request = { schemaVersion: 1, id: randomUUID(), endpoint, audience: options.audience, keyId, payloadSha256 };
		try {
			await writePrivateHandoffFile(requestFile, `${JSON.stringify(request)}\n`);
			await syncDirectory(directory);
		}
		catch (conflict) {
			if ((conflict as NodeJS.ErrnoException).code !== "EEXIST") throw conflict;
			request = JSON.parse((await readHandoffFile(requestFile, 4096, true)).toString("utf8"));
		}
	}
	if (
		!record(request)
		|| Object.keys(request).sort().join(",") !== "audience,endpoint,id,keyId,payloadSha256,schemaVersion"
		|| request.schemaVersion !== 1
		|| request.endpoint !== endpoint
		|| request.audience !== options.audience
		|| request.keyId !== keyId
		|| request.payloadSha256 !== payloadSha256
		|| typeof request.id !== "string"
		|| !/^[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/u.test(request.id)
	) {
		throw new Error("Invalid retained handoff delivery identity.");
	}
	const authentication = { id: request.id, keyId, payloadSha256 };
	const receiptFile = join(directory, `${request.id}.receipt.json`);
	try {
		const receipt: unknown = JSON.parse((await readHandoffFile(receiptFile, 16 * 1024, true)).toString("utf8"));
		validateHandoffReceipt(receipt, envelope, authentication);
		return { receipt, duplicate: true, cached: true };
	}
	catch (error) {
		if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
	}
	const result = await deliverHandoff({ ...options, id: request.id });
	try {
		await writePrivateHandoffFile(receiptFile, `${JSON.stringify(result.receipt)}\n`);
	}
	catch (error) {
		if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
		validateHandoffReceipt(
			JSON.parse((await readHandoffFile(receiptFile, 16 * 1024, true)).toString("utf8")),
			envelope,
			authentication
		);
	}
	await syncDirectory(directory);
	return { ...result, cached: false };
}
