import type { FultonCountyOfficeholderSnapshot } from "./fulton-county-officeholders.js";
import type { AdminOperationDataset } from "./types/civic.js";
import { Buffer } from "node:buffer";
import { createHash, randomUUID } from "node:crypto";
import { closeSync, constants, fstatSync, openSync, readSync, realpathSync } from "node:fs";
import { mkdir, open, readFile, rename, unlink } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import process from "node:process";
import { readAutomationRun } from "./admin-operations.js";
import { fultonCountyOfficeholderPublication, validateFultonCountyOfficeholderSnapshot } from "./fulton-county-officeholders.js";
import { assertExternalStateDataDirectory } from "./state-ballot-storage.js";

export interface FultonCountyOfficeholderRepository {
	getSnapshot: () => FultonCountyOfficeholderSnapshot;
	inspectSources?: () => Promise<AdminOperationDataset[]>;
}

export class FultonCountyOfficeholderUnavailableError extends Error {
	status = 503;
	constructor() { super("Fulton County office records are temporarily unavailable."); }
}

interface FultonCountyOfficeholderEnvelope {
	sourceConfigurationSha256: string;
	importedAt: string;
	acquisition: "collected" | "imported";
	snapshot: FultonCountyOfficeholderSnapshot;
}

const digest = (value: string) => createHash("sha256").update(value).digest("hex");
export const fultonCountyOfficeholderConfigurationSha256 = digest(JSON.stringify(fultonCountyOfficeholderPublication));

export function readFultonCountyOfficeholderEnvelope(directory: string, now = Date.now()): FultonCountyOfficeholderEnvelope {
	assertExternalStateDataDirectory(directory);
	const canonical = realpathSync(directory);
	assertExternalStateDataDirectory(canonical);
	const descriptor = openSync(join(canonical, "fulton-county-offices.json"), constants.O_RDONLY | constants.O_NOFOLLOW);
	let body: string;
	try {
		const metadata = fstatSync(descriptor);
		if (!metadata.isFile() || metadata.size > 128 * 1024) throw new Error("The Fulton county-office snapshot exceeds its bounds.");
		const buffer = Buffer.alloc(128 * 1024 + 1);
		const received = readSync(descriptor, buffer, 0, buffer.length, 0);
		if (received > 128 * 1024) throw new Error("The Fulton county-office snapshot exceeds its bounds.");
		body = buffer.subarray(0, received).toString("utf8");
	}
	finally { closeSync(descriptor); }
	const value = JSON.parse(body) as FultonCountyOfficeholderEnvelope;
	if (!value || Array.isArray(value) || Object.keys(value).sort().join(",") !== "acquisition,importedAt,snapshot,sourceConfigurationSha256" || value.sourceConfigurationSha256 !== fultonCountyOfficeholderConfigurationSha256 || !["collected", "imported"].includes(value.acquisition) || typeof value.importedAt !== "string" || !Number.isFinite(Date.parse(value.importedAt)) || Date.parse(value.importedAt) > now)
		throw new Error("The Fulton county-office storage envelope is invalid.");
	validateFultonCountyOfficeholderSnapshot(value.snapshot, now);
	if (Date.parse(value.importedAt) < Date.parse(value.snapshot.retrievedAt)) throw new Error("The Fulton county-office import clock precedes its source.");
	return value;
}

export function createFultonCountyOfficeholderRepository(directory = process.env.FULTON_COUNTY_OFFICEHOLDER_DIRECTORY?.trim()): FultonCountyOfficeholderRepository | null {
	if (!directory) return null;
	if (!isAbsolute(directory)) throw new Error("The Fulton county-office directory must be absolute.");
	assertExternalStateDataDirectory(directory);
	return { getSnapshot: () => {
		try {
			return readFultonCountyOfficeholderEnvelope(directory).snapshot;
		}
		catch { throw new FultonCountyOfficeholderUnavailableError(); }
	}, async inspectSources() {
		let current: FultonCountyOfficeholderEnvelope | null = null;
		let failure: string | null = null;
		let run = null;
		try {
			current = readFultonCountyOfficeholderEnvelope(directory);
		}
		catch { failure = "Officeholder data is unavailable or invalid."; }
		try {
			run = await readAutomationRun(join(directory, "county-office-automation"));
		}
		catch { failure = "Officeholder collection evidence is invalid."; }
		if (run?.status === "failed" && (run.finishedAt ?? "") >= (current?.importedAt ?? "")) failure = run.results[0]?.reason ?? "source-unavailable";
		return [{ id: "ga-fulton-county-offices", label: "Fulton County sheriff and district attorney", stateCode: "GA", electionDate: "", kind: "officeholders", mode: "automatic", status: failure ? "error" : Date.parse(current!.snapshot.retrievedAt) + fultonCountyOfficeholderPublication.minimumRefreshIntervalMs < Date.now() ? "stale" : "current", records: current?.snapshot.offices.filter(office => office.person).length ?? null, retrievedAt: current?.snapshot.retrievedAt ?? null, lastAttemptAt: run?.startedAt ?? null, lastImportAt: current?.importedAt ?? null, failure }];
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

export async function withFultonCountyOfficeholderLock<Result>(directory: string, work: (canonical: string) => Promise<Result>) {
	if (!isAbsolute(directory)) throw new Error("The Fulton county-office directory must be absolute.");
	assertExternalStateDataDirectory(directory);
	await mkdir(directory, { recursive: true });
	const canonical = realpathSync(directory);
	assertExternalStateDataDirectory(canonical);
	const path = join(canonical, ".fulton-county-offices.lock");
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

export async function writeFultonCountyOfficeholders(directory: string, snapshot: FultonCountyOfficeholderSnapshot, acquisition: "collected" | "imported", now = Date.now()) {
	validateFultonCountyOfficeholderSnapshot(snapshot, now);
	if (!["collected", "imported"].includes(acquisition) || !Number.isFinite(now) || now < Date.parse(snapshot.retrievedAt)) throw new Error("The Fulton county-office import clock is invalid.");
	const envelope: FultonCountyOfficeholderEnvelope = { sourceConfigurationSha256: fultonCountyOfficeholderConfigurationSha256, importedAt: new Date(now).toISOString(), acquisition, snapshot };
	const body = `${JSON.stringify(envelope)}\n`;
	if (Buffer.byteLength(body) > 128 * 1024) throw new Error("The Fulton county-office snapshot exceeds its bounds.");
	let previous: string | null = null;
	try {
		readFultonCountyOfficeholderEnvelope(directory, now);
		previous = await readFile(join(directory, "fulton-county-offices.json"), "utf8");
	}
	catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
	if (previous !== null) {
		await atomicFile(join(directory, "fulton-county-offices.previous.json"), previous);
	}
	await atomicFile(join(directory, "fulton-county-offices.json"), body);
	return envelope;
}

export async function importFultonCountyOfficeholders(directory: string, snapshot: unknown, now = Date.now()) {
	validateFultonCountyOfficeholderSnapshot(snapshot, now);
	return withFultonCountyOfficeholderLock(directory, async canonical => writeFultonCountyOfficeholders(canonical, snapshot, "imported", now));
}
