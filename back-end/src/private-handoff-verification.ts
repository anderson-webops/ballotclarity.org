import type { KeyObject } from "node:crypto";
import type { HandoffRelease } from "./private-handoff-protocol.js";
import { createPublicKey } from "node:crypto";
import { lstat, readdir, realpath } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve } from "node:path";
import {
	HandoffError,
	handoffHash,
	handoffKeyId,
	maximumHandoffBytes,
	maximumHandoffFileBytes,
	privateHandoffContract,
	record,
	validateHandoff,
	validateHandoffEvidence,
	validateHandoffReceipt,
	validateRelease,
	validAudience,
	verifyHandoffEvidence
} from "./private-handoff-protocol.js";
import { privateHandoffDirectory, readHandoffFile } from "./private-handoff-storage.js";

export async function verifyStoredHandoff(
	directory: string,
	options: { audience: string; publicKeys: KeyObject[]; release: HandoffRelease }
) {
	validateRelease(options.release);
	if (!validAudience(options.audience) || !options.publicKeys.length || options.publicKeys.length > 16)
		throw new Error("Trusted enrollment is required.");
	const keys = new Map(
		options.publicKeys.map((key) => {
			if (key.type !== "public") throw new Error("Use public verification keys only.");
			return [handoffKeyId(key), key];
		})
	);
	if (keys.size !== options.publicKeys.length) throw new Error("Duplicate verification keys.");
	if (!isAbsolute(directory) || (await realpath(directory)) !== resolve(directory))
		throw new Error("Use a canonical packet directory.");
	const before = await lstat(directory);
	if (!before.isDirectory() || before.isSymbolicLink() || (before.mode & 0o077) !== 0)
		throw new Error("Use an owner-only packet directory.");
	const names = await readdir(directory);
	if (names.length > 11) throw new Error("Unexpected packet files.");
	for (const name of names) {
		const metadata = await lstat(join(directory, name));
		if (
			!metadata.isFile()
			|| metadata.isSymbolicLink()
			|| metadata.nlink !== 1
			|| metadata.uid !== before.uid
			|| (metadata.mode & 0o077) !== 0
		) {
			throw new Error("Invalid private packet file.");
		}
	}
	const body = await readHandoffFile(join(directory, "envelope.json"), maximumHandoffBytes);
	const envelope = validateHandoff(body, options.audience);
	if (
		envelope.release.tag !== options.release.tag
		|| envelope.release.commit !== options.release.commit
		|| envelope.release.archiveSha256 !== options.release.archiveSha256
	) {
		throw new Error("The signed release does not match the requested release.");
	}
	const receipt: unknown = JSON.parse(
		(await readHandoffFile(join(directory, "receipt.json"), 16 * 1024)).toString("utf8")
	);
	const authenticationBody = names.includes("authentication.json")
		? await readHandoffFile(join(directory, "authentication.json"), 16 * 1024)
		: null;
	const expected = [
		"envelope.json",
		"receipt.json",
		...envelope.files.map(file => file.name),
		...(authenticationBody ? ["authentication.json"] : [])
	].sort();
	if (names.sort().join("\n") !== expected.join("\n"))
		throw new Error("The packet inventory is incomplete or unexpected.");
	for (const file of envelope.files) {
		const stored = await readHandoffFile(join(directory, file.name), maximumHandoffFileBytes);
		if (stored.length !== file.bytes || handoffHash(stored) !== file.sha256)
			throw new Error("Stored packet contents differ from the signed envelope.");
	}
	if (!authenticationBody) throw new HandoffError(76, "legacy-signature-unavailable");
	const evidence = validateHandoffEvidence(JSON.parse(authenticationBody.toString("utf8")));
	const authentication = verifyHandoffEvidence(body, evidence, options.audience, keys);
	validateHandoffReceipt(receipt, envelope, authentication);
	if (Date.parse(evidence.authenticatedAt) > Date.parse((receipt as { receivedAt: string }).receivedAt))
		throw new Error("The custody timestamps are inconsistent.");
	const after = await lstat(directory);
	if (before.ino !== after.ino || before.dev !== after.dev || before.ctimeMs !== after.ctimeMs)
		throw new Error("The packet directory changed during verification.");
	return {
		schemaVersion: 1,
		status: "verified",
		...authentication,
		release: envelope.release,
		audience: options.audience,
		files: envelope.files.length,
		signatureEvidenceVersion: 1,
		authenticatedAt: evidence.authenticatedAt,
		custodyOnly: true
	};
}

export async function verifyStoredHandoffWithConfig(directory: string, filename: string, release: HandoffRelease) {
	if (!isAbsolute(filename)) throw new Error("Use an absolute trusted enrollment file.");
	await privateHandoffDirectory(dirname(filename));
	const config: unknown = JSON.parse((await readHandoffFile(filename, 64 * 1024, true)).toString("utf8"));
	if (
		!record(config)
		|| config.schemaVersion !== 1
		|| !validAudience(config.audience)
		|| !Array.isArray(config.publicKeys)
		|| !config.publicKeys.length
		|| config.publicKeys.length > 16
		|| !config.publicKeys.every(key => typeof key === "string" && key.length <= 4096)
		|| Object.keys(config).some(
			name => !(privateHandoffContract.configurationFields as readonly string[]).includes(name)
		)
	) {
		throw new Error("Invalid trusted enrollment configuration.");
	}
	return verifyStoredHandoff(directory, {
		audience: config.audience,
		publicKeys: config.publicKeys.map(key => createPublicKey(key as string)),
		release
	});
}
