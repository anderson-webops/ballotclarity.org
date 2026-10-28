import type { CourtDirectorySnapshot } from "./court-directories.js";
import type { AdminOperationDataset } from "./types/civic.js";
import { Buffer } from "node:buffer";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, open, readFile, realpath, rename, unlink } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import process from "node:process";
import { readAutomationRun } from "./admin-operations.js";
import { courtDirectoryPublication, validateCourtDirectorySnapshot } from "./court-directories.js";
import { assertExternalStateDataDirectory, readBoundedStateDataBytes } from "./state-ballot-storage.js";

export interface CourtDirectoryRepository {
	getSnapshot: () => Promise<CourtDirectorySnapshot>;
	inspectSources: () => Promise<AdminOperationDataset[]>;
}

export class CourtDirectoryUnavailableError extends Error {
	constructor() { super("Court records are temporarily unavailable."); }
}

interface CourtDirectoryEnvelope {
	sourceConfigurationSha256: string;
	importedAt: string;
	acquisition: "collected" | "imported";
	snapshot: CourtDirectorySnapshot;
}

const configurationSha256 = createHash("sha256").update(JSON.stringify(courtDirectoryPublication)).digest("hex");
const filename = "ga-fulton-state-court.json";

async function canonicalDirectory(directory: string, create = false) {
	if (!isAbsolute(directory)) throw new Error("The court data directory must be absolute.");
	assertExternalStateDataDirectory(directory);
	if (create) await mkdir(directory, { recursive: true });
	const canonical = await realpath(directory);
	assertExternalStateDataDirectory(canonical);
	return canonical;
}

export async function readCourtDirectoryEnvelope(directory: string, now = Date.now()) {
	const canonical = await canonicalDirectory(directory);
	const body = await readBoundedStateDataBytes(join(canonical, filename), 128 * 1024);
	const value = JSON.parse(body.toString("utf8")) as CourtDirectoryEnvelope;
	if (!value || Array.isArray(value) || Object.keys(value).sort().join(",") !== "acquisition,importedAt,snapshot,sourceConfigurationSha256" || value.sourceConfigurationSha256 !== configurationSha256 || !["collected", "imported"].includes(value.acquisition) || typeof value.importedAt !== "string" || !Number.isFinite(Date.parse(value.importedAt)) || new Date(value.importedAt).toISOString() !== value.importedAt || Date.parse(value.importedAt) > now) throw new Error("The court storage envelope is invalid.");
	validateCourtDirectorySnapshot(value.snapshot, now);
	if (Date.parse(value.importedAt) < Math.max(...value.snapshot.documents.map(document => Date.parse(document.capturedAt)))) throw new Error("The court import clock precedes its evidence.");
	return { envelope: value, body };
}

export function createCourtDirectoryRepository(directory = process.env.COURT_DIRECTORY_DATA_DIR?.trim()): CourtDirectoryRepository | null {
	if (!directory) return null;
	if (!isAbsolute(directory)) throw new Error("The court data directory must be absolute.");
	assertExternalStateDataDirectory(directory);
	return {
		async getSnapshot() {
			try {
				return (await readCourtDirectoryEnvelope(directory)).envelope.snapshot;
			}
			catch { throw new CourtDirectoryUnavailableError(); }
		},
		async inspectSources() {
			let current: CourtDirectoryEnvelope | null = null;
			let failure: string | null = null;
			let run = null;
			try {
				current = (await readCourtDirectoryEnvelope(directory)).envelope;
			}
			catch { failure = "Court records are unavailable or invalid."; }
			try {
				run = await readAutomationRun(join(directory, "court-automation"));
			}
			catch { failure = "Court collection evidence is invalid."; }
			if (run?.status === "failed" && (run.finishedAt ?? "") >= (current?.importedAt ?? "")) failure = run.results[0]?.reason ?? "source-unavailable";
			return [{ id: courtDirectoryPublication.sourceId, label: courtDirectoryPublication.title, stateCode: "GA", electionDate: "", kind: "officeholders", mode: "automatic", status: failure ? "error" : Date.parse(current!.snapshot.retrievedAt) + courtDirectoryPublication.minimumRefreshIntervalMs < Date.now() ? "stale" : "current", records: current?.snapshot.judges.length ?? null, retrievedAt: current?.snapshot.retrievedAt ?? null, lastAttemptAt: run?.startedAt ?? null, lastImportAt: current?.importedAt ?? null, failure }];
		}
	};
}

export async function withCourtDirectoryLock<Result>(directory: string, work: (canonical: string) => Promise<Result>) {
	const canonical = await canonicalDirectory(directory, true);
	const path = join(canonical, ".court-directory.lock");
	const token = randomUUID();
	const lock = await open(path, "wx", 0o600);
	try {
		await lock.writeFile(token);
		return await work(canonical);
	}
	finally {
		await lock.close();
		if (await readFile(path, "utf8") === token) await unlink(path);
	}
}

async function atomicFile(path: string, body: string | Buffer) {
	const temporary = `${path}.${randomUUID()}.tmp`;
	try {
		const handle = await open(temporary, "wx", 0o600);
		try {
			await handle.writeFile(body);
			await handle.sync();
		}
		finally { await handle.close(); }
		await rename(temporary, path);
	}
	finally {
		await unlink(temporary).catch((error: NodeJS.ErrnoException) => {
			if (error.code !== "ENOENT") throw error;
		});
	}
}

export async function writeCourtDirectory(directory: string, snapshot: CourtDirectorySnapshot, acquisition: "collected" | "imported", now = Date.now()) {
	validateCourtDirectorySnapshot(snapshot, now);
	if (!Number.isFinite(now) || now < Math.max(...snapshot.documents.map(document => Date.parse(document.capturedAt))) || !["collected", "imported"].includes(acquisition)) throw new Error("The court import clock or acquisition is invalid.");
	const envelope: CourtDirectoryEnvelope = { sourceConfigurationSha256: configurationSha256, importedAt: new Date(now).toISOString(), acquisition, snapshot };
	const body = `${JSON.stringify(envelope)}\n`;
	if (Buffer.byteLength(body) > 128 * 1024) throw new Error("The court snapshot exceeds its bounds.");
	try {
		const current = await readCourtDirectoryEnvelope(directory, now);
		if (current.envelope.snapshot.documents.some(document => snapshot.documents.some(next => next.url === document.url && Date.parse(document.capturedAt) > Date.parse(next.capturedAt))) || Date.parse(current.envelope.snapshot.retrievedAt) > Date.parse(snapshot.retrievedAt) || Date.parse(current.envelope.importedAt) > now) throw new Error("Older court evidence cannot replace accepted records.");
		await atomicFile(join(directory, "ga-fulton-state-court.previous.json"), current.body);
	}
	catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
	await atomicFile(join(directory, filename), body);
	return envelope;
}

export async function importCourtDirectory(directory: string, value: unknown, now = Date.now()) {
	validateCourtDirectorySnapshot(value, now);
	return withCourtDirectoryLock(directory, canonical => writeCourtDirectory(canonical, value, "imported", now));
}
