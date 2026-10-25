import type { StateBallotSnapshot } from "./state-ballot-repository.js";
import type { StateBallotSource } from "./state-ballot-sources.js";
import { Buffer } from "node:buffer";
import { createHash, randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { mkdir, open, realpath, rename, unlink } from "node:fs/promises";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { parseBundledStateSnapshot } from "./state-ballot-snapshot.js";

const maximumBytes = 12 * 1024 * 1024;
const releaseRoot = fileURLToPath(new URL("../../", import.meta.url));
const digest = (value: string) => createHash("sha256").update(value).digest("hex");

export function assertExternalStateDataDirectory(directory: string) {
	const relation = relative(releaseRoot, resolve(directory));
	if (!isAbsolute(directory) || (relation !== ".." && !relation.startsWith(`..${sep}`) && !isAbsolute(relation)))
		throw new Error("State ballot data must use an absolute directory outside the application checkout or release.");
}

export function serializeStoredStateSnapshot(snapshot: StateBallotSnapshot) {
	return JSON.stringify({
		schemaVersion: 1,
		stateCode: snapshot.source.stateCode,
		sourceId: snapshot.source.id,
		electionDate: snapshot.source.electionDate,
		sourceUrl: snapshot.source.pageUrl,
		retrievalPolicy: snapshot.source.retrievalPolicy ?? "automatic",
		retrievedAt: snapshot.retrievedAt,
		sourceSha256: snapshot.sha256,
		recordCount: snapshot.records.length,
		records: snapshot.records,
		...(snapshot.documents ? { documents: snapshot.documents } : {}),
	});
}

export async function readBoundedStateDataBytes(path: string, byteLimit = maximumBytes) {
	if (!Number.isSafeInteger(byteLimit) || byteLimit <= 0 || byteLimit > 32 * 1024 * 1024)
		throw new Error("State data reads require a bounded positive size limit.");
	const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
	try {
		const metadata = await handle.stat();
		if (!metadata.isFile() || metadata.size > byteLimit)
			throw new Error("State ballot data must be a regular file within the size limit.");
		const buffer = Buffer.alloc(byteLimit + 1);
		let length = 0;
		while (length < buffer.length) {
			const { bytesRead } = await handle.read(buffer, length, buffer.length - length, length);
			if (!bytesRead) break;
			length += bytesRead;
		}
		if (length > byteLimit)
			throw new Error("State ballot data exceeds its size limit.");
		return Buffer.from(buffer.subarray(0, length));
	}
	finally {
		await handle.close();
	}
}

export async function readBoundedStateData(path: string) {
	return (await readBoundedStateDataBytes(path)).toString("utf8");
}

export function createStateBallotStorage(directory: string) {
	assertExternalStateDataDirectory(directory);
	async function location(source: StateBallotSource) {
		if (!/^[a-z0-9][a-z0-9-]{0,100}$/u.test(source.id))
			throw new Error("Invalid state ballot source storage identifier.");
		await mkdir(directory, { recursive: true });
		const canonical = await realpath(directory);
		assertExternalStateDataDirectory(canonical);
		return join(canonical, `${source.id}.json`);
	}
	return {
		async read(source: StateBallotSource): Promise<StateBallotSnapshot | null> {
			try {
				const body = await readBoundedStateData(await location(source));
				const envelope = JSON.parse(body);
				if (!envelope || Object.keys(envelope).sort().join(",") !== "snapshot,sourceConfigurationSha256" || envelope.sourceConfigurationSha256 !== digest(JSON.stringify(source)) || typeof envelope.snapshot !== "string")
					throw new Error("Stored state ballot data does not match the configured source.");
				return parseBundledStateSnapshot(source, envelope.snapshot, source.retrievalPolicy ?? "automatic");
			}
			catch (error) {
				if ((error as NodeJS.ErrnoException).code === "ENOENT")
					return null;
				throw error;
			}
		},
		async write(snapshot: StateBallotSnapshot) {
			const snapshotBody = serializeStoredStateSnapshot(snapshot);
			parseBundledStateSnapshot(snapshot.source, snapshotBody, snapshot.source.retrievalPolicy ?? "automatic");
			const body = JSON.stringify({ sourceConfigurationSha256: digest(JSON.stringify(snapshot.source)), snapshot: snapshotBody });
			if (Buffer.byteLength(body) > maximumBytes)
				throw new Error("Stored state ballot data exceeds its size limit.");
			const target = await location(snapshot.source);
			const temporary = `${target}.${randomUUID()}.tmp`;
			try {
				const handle = await open(temporary, "wx");
				try {
					await handle.writeFile(body);
					await handle.sync();
				}
				finally {
					await handle.close();
				}
				await rename(temporary, target);
			}
			finally {
				await unlink(temporary).catch((error: NodeJS.ErrnoException) => {
					if (error.code !== "ENOENT") throw error;
				});
			}
		},
	};
}
