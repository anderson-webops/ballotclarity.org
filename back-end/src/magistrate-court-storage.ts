import type { MagistrateCourtSnapshot } from "./magistrate-court-directory.js";
import type { AdminOperationDataset } from "./types/civic.js";
import { Buffer } from "node:buffer";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, open, realpath, rename, unlink } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import process from "node:process";
import { readAutomationRun } from "./admin-operations.js";
import { magistrateCourtPublication, validateMagistrateCourtSnapshot } from "./magistrate-court-directory.js";
import { withStateBallotAutomationLock } from "./state-ballot-automation-lock.js";
import { assertExternalStateDataDirectory, readBoundedStateDataBytes } from "./state-ballot-storage.js";

export interface MagistrateCourtRepository {
	getSnapshot: () => Promise<MagistrateCourtSnapshot>;
	inspectSources: () => Promise<AdminOperationDataset[]>;
}

export class MagistrateCourtUnavailableError extends Error {
	constructor() { super("Court records are temporarily unavailable."); }
}

interface MagistrateCourtEnvelope {
	sourceConfigurationSha256: string;
	importedAt: string;
	acquisition: "collected" | "imported";
	snapshot: MagistrateCourtSnapshot;
}

const configurationSha256 = createHash("sha256").update(JSON.stringify(magistrateCourtPublication)).digest("hex");
const filename = "ga-fulton-magistrate-court.json";

async function canonicalDirectory(directory: string, create = false) {
	if (!isAbsolute(directory)) throw new Error("The court data directory must be absolute.");
	assertExternalStateDataDirectory(directory);
	if (create) await mkdir(directory, { recursive: true });
	const canonical = await realpath(directory);
	assertExternalStateDataDirectory(canonical);
	return canonical;
}

export async function readMagistrateCourtEnvelope(directory: string, now = Date.now()) {
	const canonical = await canonicalDirectory(directory);
	const body = await readBoundedStateDataBytes(join(canonical, filename), 128 * 1024);
	const value = JSON.parse(body.toString("utf8")) as MagistrateCourtEnvelope;
	if (!value || Array.isArray(value) || Object.keys(value).sort().join(",") !== "acquisition,importedAt,snapshot,sourceConfigurationSha256" || value.sourceConfigurationSha256 !== configurationSha256 || !["collected", "imported"].includes(value.acquisition) || typeof value.importedAt !== "string" || !Number.isFinite(Date.parse(value.importedAt)) || new Date(value.importedAt).toISOString() !== value.importedAt || Date.parse(value.importedAt) > now) throw new Error("The court storage envelope is invalid.");
	validateMagistrateCourtSnapshot(value.snapshot, now);
	if (Date.parse(value.importedAt) < Math.max(...value.snapshot.documents.map(document => Date.parse(document.capturedAt)))) throw new Error("The court import clock precedes its evidence.");
	return { envelope: value, body };
}

export function createMagistrateCourtRepository(directory = process.env.MAGISTRATE_COURT_DATA_DIR?.trim()): MagistrateCourtRepository | null {
	if (!directory) return null;
	if (!isAbsolute(directory)) throw new Error("The court data directory must be absolute.");
	assertExternalStateDataDirectory(directory);
	return {
		async getSnapshot() {
			try {
				return (await readMagistrateCourtEnvelope(directory)).envelope.snapshot;
			}
			catch { throw new MagistrateCourtUnavailableError(); }
		},
		async inspectSources() {
			let current: MagistrateCourtEnvelope | null = null;
			let failure: string | null = null;
			let run = null;
			try {
				current = (await readMagistrateCourtEnvelope(directory)).envelope;
			}
			catch { failure = "Court records are unavailable or invalid."; }
			try {
				run = await readAutomationRun(join(directory, "magistrate-court-automation"));
			}
			catch { failure = "Court collection evidence is invalid."; }
			if (run?.status === "failed" && (run.finishedAt ?? "") >= (current?.importedAt ?? "")) failure = run.results[0]?.reason ?? "source-unavailable";
			return [{ id: magistrateCourtPublication.sourceId, label: magistrateCourtPublication.title, stateCode: "GA", electionDate: "", kind: "officeholders", mode: "automatic", status: failure ? "error" : Date.parse(current!.snapshot.retrievedAt) + magistrateCourtPublication.minimumRefreshIntervalMs < Date.now() ? "stale" : "current", records: current?.snapshot.judges.length ?? null, retrievedAt: current?.snapshot.retrievedAt ?? null, lastAttemptAt: run?.startedAt ?? null, lastImportAt: current?.importedAt ?? null, failure }];
		}
	};
}

export async function withMagistrateCourtLock<Result>(directory: string, work: (canonical: string) => Promise<Result>) {
	const canonical = await canonicalDirectory(directory, true);
	return withStateBallotAutomationLock(canonical, ".magistrate-court.lock", work);
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

export async function writeMagistrateCourt(directory: string, snapshot: MagistrateCourtSnapshot, acquisition: "collected" | "imported", now = Date.now()) {
	validateMagistrateCourtSnapshot(snapshot, now);
	if (!Number.isFinite(now) || now < Math.max(...snapshot.documents.map(document => Date.parse(document.capturedAt))) || !["collected", "imported"].includes(acquisition)) throw new Error("The court import clock or acquisition is invalid.");
	const envelope: MagistrateCourtEnvelope = { sourceConfigurationSha256: configurationSha256, importedAt: new Date(now).toISOString(), acquisition, snapshot };
	const body = `${JSON.stringify(envelope)}\n`;
	if (Buffer.byteLength(body) > 128 * 1024) throw new Error("The court snapshot exceeds its bounds.");
	try {
		const current = await readMagistrateCourtEnvelope(directory, now);
		if (current.envelope.snapshot.documents.some(document => snapshot.documents.some(next => next.url === document.url && Date.parse(document.capturedAt) > Date.parse(next.capturedAt))) || Date.parse(current.envelope.snapshot.retrievedAt) > Date.parse(snapshot.retrievedAt) || Date.parse(current.envelope.importedAt) > now) throw new Error("Older court evidence cannot replace accepted records.");
		await atomicFile(join(directory, "ga-fulton-magistrate-court.previous.json"), current.body);
	}
	catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
	await atomicFile(join(directory, filename), body);
	return envelope;
}

export async function importMagistrateCourt(directory: string, value: unknown, now = Date.now()) {
	validateMagistrateCourtSnapshot(value, now);
	return withMagistrateCourtLock(directory, canonical => writeMagistrateCourt(canonical, value, "imported", now));
}
