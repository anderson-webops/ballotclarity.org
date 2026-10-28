import type { FultonOfficeholderSnapshot } from "./fulton-officeholders.js";
import type { AdminOperationDataset } from "./types/civic.js";
import { Buffer } from "node:buffer";
import { createHash, randomUUID } from "node:crypto";
import { closeSync, constants, fstatSync, openSync, readSync, realpathSync } from "node:fs";
import { mkdir, open, readFile, rename, unlink } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import process from "node:process";
import { readAutomationRun } from "./admin-operations.js";
import { fultonOfficeholderPublication, validateFultonOfficeholderSnapshot } from "./fulton-officeholders.js";
import { assertExternalStateDataDirectory } from "./state-ballot-storage.js";

export interface FultonOfficeholderRepository {
	getSnapshot: () => FultonOfficeholderSnapshot;
	inspectSources?: () => Promise<AdminOperationDataset[]>;
}

export class FultonOfficeholderUnavailableError extends Error {
	status = 503;
	constructor() { super("Fulton County officeholder records are temporarily unavailable."); }
}

interface FultonOfficeholderEnvelope {
	sourceConfigurationSha256: string;
	importedAt: string;
	acquisition: "collected" | "imported";
	snapshot: FultonOfficeholderSnapshot;
}

const digest = (value: string) => createHash("sha256").update(value).digest("hex");
export const fultonOfficeholderConfigurationSha256 = digest(JSON.stringify(fultonOfficeholderPublication));

export function readFultonOfficeholderEnvelope(directory: string, now = Date.now()): FultonOfficeholderEnvelope {
	assertExternalStateDataDirectory(directory);
	const canonical = realpathSync(directory);
	assertExternalStateDataDirectory(canonical);
	const descriptor = openSync(join(canonical, "fulton-board.json"), constants.O_RDONLY | constants.O_NOFOLLOW);
	let body: string;
	try {
		const metadata = fstatSync(descriptor);
		if (!metadata.isFile() || metadata.size > 128 * 1024) throw new Error("The Fulton officeholder snapshot exceeds its bounds.");
		const buffer = Buffer.alloc(128 * 1024 + 1);
		const received = readSync(descriptor, buffer, 0, buffer.length, 0);
		if (received > 128 * 1024) throw new Error("The Fulton officeholder snapshot exceeds its bounds.");
		body = buffer.subarray(0, received).toString("utf8");
	}
	finally { closeSync(descriptor); }
	const value = JSON.parse(body) as FultonOfficeholderEnvelope;
	if (!value || Array.isArray(value) || Object.keys(value).sort().join(",") !== "acquisition,importedAt,snapshot,sourceConfigurationSha256" || value.sourceConfigurationSha256 !== fultonOfficeholderConfigurationSha256 || !["collected", "imported"].includes(value.acquisition) || typeof value.importedAt !== "string" || !Number.isFinite(Date.parse(value.importedAt)) || Date.parse(value.importedAt) > now)
		throw new Error("The Fulton officeholder storage envelope is invalid.");
	validateFultonOfficeholderSnapshot(value.snapshot, now);
	if (Date.parse(value.importedAt) < Date.parse(value.snapshot.retrievedAt)) throw new Error("The Fulton officeholder import clock precedes its source.");
	return value;
}

export function createFultonOfficeholderRepository(directory = process.env.FULTON_OFFICEHOLDER_DIRECTORY?.trim()): FultonOfficeholderRepository | null {
	if (!directory) return null;
	if (!isAbsolute(directory)) throw new Error("The Fulton officeholder directory must be absolute.");
	assertExternalStateDataDirectory(directory);
	return { getSnapshot: () => {
		try {
			return readFultonOfficeholderEnvelope(directory).snapshot;
		}
		catch { throw new FultonOfficeholderUnavailableError(); }
	}, async inspectSources() {
		let current: FultonOfficeholderEnvelope | null = null;
		let failure: string | null = null;
		let run = null;
		try {
			current = readFultonOfficeholderEnvelope(directory);
		}
		catch { failure = "Officeholder data is unavailable or invalid."; }
		try {
			run = await readAutomationRun(join(directory, "automation"));
		}
		catch { failure = "Officeholder collection evidence is invalid."; }
		if (run?.status === "failed" && (run.finishedAt ?? "") >= (current?.importedAt ?? "")) failure = run.results[0]?.reason ?? "source-unavailable";
		return [{ id: "ga-fulton-board", label: "Fulton County commissioners", stateCode: "GA", electionDate: "", kind: "officeholders", mode: "automatic", status: failure ? "error" : Date.parse(current!.snapshot.retrievedAt) + fultonOfficeholderPublication.minimumRefreshIntervalMs < Date.now() ? "stale" : "current", records: current?.snapshot.seats.filter(seat => seat.person).length ?? null, retrievedAt: current?.snapshot.retrievedAt ?? null, lastAttemptAt: run?.startedAt ?? null, lastImportAt: current?.importedAt ?? null, failure }];
	} };
}

async function atomicFile(path: string, body: string) {
	const temporary = `${path}.${randomUUID()}.tmp`;
	const descriptor = await open(temporary, "wx", 0o600);
	try {
		await descriptor.writeFile(body);
		await descriptor.sync();
	}
	catch (error) {
		await unlink(temporary).catch(() => {});
		throw error;
	}
	finally { await descriptor.close(); }
	try {
		await rename(temporary, path);
	}
	catch (error) {
		await unlink(temporary).catch(() => {});
		throw error;
	}
}

export async function withFultonOfficeholderLock<Result>(directory: string, work: (canonical: string) => Promise<Result>) {
	if (!isAbsolute(directory)) throw new Error("The Fulton officeholder directory must be absolute.");
	assertExternalStateDataDirectory(directory);
	await mkdir(directory, { recursive: true });
	const canonical = realpathSync(directory);
	assertExternalStateDataDirectory(canonical);
	const path = join(canonical, ".fulton-board.lock");
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

export async function writeFultonOfficeholders(directory: string, snapshot: FultonOfficeholderSnapshot, acquisition: "collected" | "imported", now = Date.now()) {
	validateFultonOfficeholderSnapshot(snapshot, now);
	if (!["collected", "imported"].includes(acquisition) || !Number.isFinite(now) || now < Date.parse(snapshot.retrievedAt)) throw new Error("The Fulton officeholder import clock is invalid.");
	const envelope: FultonOfficeholderEnvelope = { sourceConfigurationSha256: fultonOfficeholderConfigurationSha256, importedAt: new Date(now).toISOString(), acquisition, snapshot };
	const body = `${JSON.stringify(envelope)}\n`;
	if (Buffer.byteLength(body) > 128 * 1024) throw new Error("The Fulton officeholder snapshot exceeds its bounds.");
	let previous: string | null = null;
	try {
		readFultonOfficeholderEnvelope(directory, now);
		previous = await readFile(join(directory, "fulton-board.json"), "utf8");
	}
	catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
	if (previous !== null) {
		await atomicFile(join(directory, "fulton-board.previous.json"), previous);
	}
	await atomicFile(join(directory, "fulton-board.json"), body);
	return envelope;
}

export async function importFultonOfficeholders(directory: string, snapshot: unknown, now = Date.now()) {
	validateFultonOfficeholderSnapshot(snapshot, now);
	return withFultonOfficeholderLock(directory, async canonical => writeFultonOfficeholders(canonical, snapshot, "imported", now));
}
