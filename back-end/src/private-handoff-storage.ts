import type { KeyObject } from "node:crypto";
import type { HandoffAuthentication, HandoffReceipt, HandoffSignedEvidence } from "./private-handoff-protocol.js";
import { Buffer } from "node:buffer";
import { constants } from "node:fs";
import { lstat, mkdir, mkdtemp, open, readdir, realpath, rename, rm, unlink } from "node:fs/promises";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import process from "node:process";
import {
	HandoffError,
	handoffHash,
	maximumHandoffBytes,
	maximumHandoffFileBytes,
	validateHandoff,
	validateHandoffReceipt,
	verifyHandoffEvidence
} from "./private-handoff-protocol.js";

const applicationRoot = resolve(import.meta.dirname, "../..");

export async function readHandoffFile(filename: string, maximumBytes: number, secret = false) {
	const handle = await open(filename, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
	try {
		const before = await handle.stat();
		if (
			!before.isFile()
			|| before.size > maximumBytes
			|| (secret && ((before.mode & 0o077) !== 0 || before.uid !== process.getuid?.() || before.nlink !== 1))
		) {
			throw new Error("Handoff input must be a bounded regular file with appropriate access.");
		}
		const body = Buffer.alloc(before.size + 1);
		let offset = 0;
		while (offset < body.length) {
			const result = await handle.read(body, offset, body.length - offset, offset);
			if (!result.bytesRead) break;
			offset += result.bytesRead;
		}
		const after = await handle.stat();
		if (
			offset !== before.size
			|| before.size !== after.size
			|| before.mtimeMs !== after.mtimeMs
			|| before.ctimeMs !== after.ctimeMs
		) {
			throw new Error("Handoff input changed during reading.");
		}
		return body.subarray(0, offset);
	}
	finally {
		await handle.close();
	}
}

export async function privateHandoffDirectory(directory: string, create = false) {
	const relation = relative(applicationRoot, resolve(directory));
	if (!isAbsolute(directory) || (!relation.startsWith(`..${sep}`) && relation !== ".." && !isAbsolute(relation)))
		throw new Error("Private handoff storage must be outside the application checkout or artifact.");
	if (create) await mkdir(directory, { recursive: true, mode: 0o700 });
	const canonical = await realpath(directory);
	const metadata = await lstat(directory);
	if (
		canonical !== resolve(directory)
		|| !metadata.isDirectory()
		|| metadata.isSymbolicLink()
		|| (metadata.mode & 0o077) !== 0
		|| metadata.uid !== process.getuid?.()
	) {
		throw new Error("Private handoff storage must be canonical, owner-only and owned by the service account.");
	}
	return canonical;
}

export async function syncDirectory(directory: string) {
	const handle = await open(directory, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW);
	try {
		await handle.sync();
	}
	finally {
		await handle.close();
	}
}

export async function writePrivateHandoffFile(filename: string, body: Buffer | string) {
	const handle = await open(filename, "wx", 0o600);
	try {
		await handle.writeFile(body);
		await handle.sync();
	}
	finally {
		await handle.close();
	}
}

export async function createHandoffInbox(
	directory: string,
	audience: string,
	maximumBytes = 64 * 1024 * 1024,
	maximumEntries = 256,
	keys?: ReadonlyMap<string, KeyObject>
) {
	if (!keys?.size) throw new Error("Trusted verification keys are required for private custody.");
	if (
		!Number.isSafeInteger(maximumBytes)
		|| maximumBytes < maximumHandoffBytes * 2
		|| maximumBytes > 256 * 1024 * 1024
		|| !Number.isSafeInteger(maximumEntries)
		|| maximumEntries < 1
		|| maximumEntries > 1024
	) {
		throw new Error("Invalid handoff inbox limits.");
	}
	const canonical = await privateHandoffDirectory(directory, true);
	async function occupied(folder: string, depth = 0): Promise<number> {
		if (depth > 1) throw new HandoffError(503, "inbox-unavailable");
		let total = 0;
		const entries = await readdir(folder, { withFileTypes: true });
		if (entries.length > maximumEntries + 16) throw new HandoffError(507, "inbox-capacity");
		for (const entry of entries) {
			const filename = join(folder, entry.name);
			const metadata = await lstat(filename);
			if (metadata.isSymbolicLink() || (metadata.mode & 0o077) !== 0 || metadata.uid !== process.getuid?.())
				throw new HandoffError(503, "inbox-unavailable");
			if (entry.isDirectory()) total += await occupied(filename, depth + 1);
			else if (metadata.isFile()) total += metadata.size;
			else throw new HandoffError(503, "inbox-unavailable");
			if (total > maximumBytes) throw new HandoffError(507, "inbox-capacity");
		}
		return total;
	}
	return {
		async accept(
			body: Buffer,
			authentication: HandoffAuthentication,
			now = Date.now(),
			evidence?: HandoffSignedEvidence
		) {
			const signed = verifyHandoffEvidence(body, evidence, audience, keys);
			if (
				signed.id !== authentication.id
				|| signed.keyId !== authentication.keyId
				|| signed.payloadSha256 !== authentication.payloadSha256
				|| Date.parse(evidence!.authenticatedAt) > now
			) {
				throw new HandoffError(400, "signature-authentication-mismatch");
			}
			if (
				!/^[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/u.test(authentication.id)
				|| !/^[a-f\d]{64}$/u.test(authentication.keyId)
				|| !/^[a-f\d]{64}$/u.test(authentication.payloadSha256)
			) {
				throw new HandoffError(400, "invalid-authentication");
			}
			if (handoffHash(body) !== authentication.payloadSha256) throw new HandoffError(400, "digest-mismatch");
			const envelope = validateHandoff(body, audience);
			let lock;
			try {
				lock = await open(join(canonical, ".intake.lock"), "wx", 0o600);
			}
			catch (error) {
				if ((error as NodeJS.ErrnoException).code === "EEXIST") throw new HandoffError(503, "inbox-busy");
				throw error;
			}
			let temporary: string | null = null;
			try {
				if ((await privateHandoffDirectory(directory)) !== canonical)
					throw new HandoffError(503, "inbox-unavailable");
				const destination = join(canonical, authentication.id);
				const existing = await lstat(destination).catch((error: NodeJS.ErrnoException) => {
					if (error.code === "ENOENT") return null;
					throw error;
				});
				if (existing) {
					if (
						!existing.isDirectory()
						|| existing.isSymbolicLink()
						|| (existing.mode & 0o077) !== 0
						|| (await realpath(destination)) !== destination
					) {
						throw new HandoffError(503, "stored-handoff-invalid");
					}
					const stored = await readHandoffFile(join(destination, "receipt.json"), 16 * 1024);
					const receipt: unknown = JSON.parse(stored.toString("utf8"));
					if (
						!receipt
						|| typeof receipt !== "object"
						|| (receipt as HandoffReceipt).payloadSha256 !== authentication.payloadSha256
						|| (receipt as HandoffReceipt).keyId !== authentication.keyId
					) {
						throw new HandoffError(409, "handoff-id-conflict");
					}
					validateHandoffReceipt(receipt, envelope, authentication);
					const originalEvidence = await readHandoffFile(
						join(destination, "authentication.json"),
						16 * 1024
					).catch((error: NodeJS.ErrnoException) => {
						if (error.code === "ENOENT") return null;
						throw error;
					});
					if (originalEvidence) {
						const original = verifyHandoffEvidence(
							body,
							JSON.parse(originalEvidence.toString("utf8")),
							audience,
							keys
						);
						if (original.id !== authentication.id || original.keyId !== authentication.keyId)
							throw new HandoffError(503, "stored-handoff-invalid");
					}
					if (
						handoffHash(await readHandoffFile(join(destination, "envelope.json"), maximumHandoffBytes))
						!== authentication.payloadSha256
					) {
						throw new HandoffError(503, "stored-handoff-invalid");
					}
					for (const file of envelope.files) {
						if (
							handoffHash(
								await readHandoffFile(join(destination, file.name), maximumHandoffFileBytes)
							) !== file.sha256
						) {
							throw new HandoffError(503, "stored-handoff-invalid");
						}
					}
					await syncDirectory(canonical);
					return { receipt, duplicate: true };
				}
				const entries = await readdir(canonical);
				if (entries.filter(name => name !== ".intake.lock").length >= maximumEntries)
					throw new HandoffError(507, "inbox-capacity");
				const receipt: HandoffReceipt = {
					schemaVersion: 1,
					type: "ballot-private-handoff-receipt",
					...authentication,
					audience,
					release: envelope.release,
					receivedAt: new Date(now).toISOString(),
					custodyOnly: true,
					files: envelope.files.map(({ name, bytes, sha256 }) => ({ name, bytes, sha256 }))
				};
				const receiptBody = `${JSON.stringify(receipt)}\n`;
				const evidenceBody = `${JSON.stringify(evidence)}\n`;
				if (
					(await occupied(canonical))
					+ body.length
					+ envelope.files.reduce((sum, file) => sum + file.bytes, 0)
					+ Buffer.byteLength(receiptBody)
					+ Buffer.byteLength(evidenceBody)
					> maximumBytes
				) {
					throw new HandoffError(507, "inbox-capacity");
				}
				temporary = await mkdtemp(join(canonical, ".incoming-"));
				await writePrivateHandoffFile(join(temporary, "envelope.json"), body);
				for (const file of envelope.files) {
					await writePrivateHandoffFile(
						join(temporary, file.name),
						Buffer.from(file.contentBase64, "base64")
					);
				}
				await writePrivateHandoffFile(join(temporary, "receipt.json"), receiptBody);
				await writePrivateHandoffFile(join(temporary, "authentication.json"), evidenceBody);
				await syncDirectory(temporary);
				await rename(temporary, destination);
				temporary = null;
				await syncDirectory(canonical);
				return { receipt, duplicate: false };
			}
			finally {
				if (temporary) await rm(temporary, { recursive: true });
				await lock.close();
				await unlink(join(canonical, ".intake.lock"));
			}
		}
	};
}
