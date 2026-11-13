import type { FultonCalendarCapture, FultonCalendarInventory } from "./fulton-election-calendar.js";
import { Buffer } from "node:buffer";
import { createHash, randomUUID } from "node:crypto";
import { link, lstat, mkdir, open, readdir, realpath, rename, unlink } from "node:fs/promises";
import { join } from "node:path";
import { fultonCalendarPublication, readFultonCalendarCapture } from "./fulton-election-calendar.js";
import { withStateBallotAutomationLock } from "./state-ballot-automation-lock.js";
import { assertExternalStateDataDirectory, readBoundedStateDataBytes } from "./state-ballot-storage.js";

export const maximumFultonCalendarCaptureBytes = 16 * 1024 * 1024;
export const fultonCalendarConfigurationSha256 = createHash("sha256").update(JSON.stringify(fultonCalendarPublication)).digest("hex");
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
const exact = (value: unknown, keys: string[]): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).sort().join(",") === [...keys].sort().join(","));
const clock = (value: unknown, now: number): value is string => typeof value === "string" && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value && Date.parse(value) <= now;

export interface FultonCalendarEnvelope {
	schemaVersion: 1;
	sourceConfigurationSha256: string;
	storedAt: string;
	acquisition: "prepared" | "collected";
	capture: FultonCalendarCapture;
}

export interface FultonCalendarRun {
	schemaVersion: 1;
	type: "fulton-calendar-collection-run";
	status: "running" | "succeeded" | "failed";
	startedAt: string;
	finishedAt: string | null;
	lastSuccessAt: string | null;
	publisherRequests: number;
	reason: null | "collection-failed" | "persistence-failed";
}

export async function readFultonCalendarEnvelope(directory: string, now = Date.now()) {
	assertExternalStateDataDirectory(directory);
	const canonical = await realpath(directory);
	assertExternalStateDataDirectory(canonical);
	const body = await readBoundedStateDataBytes(join(canonical, "fulton-calendar.json"), maximumFultonCalendarCaptureBytes);
	const value: unknown = JSON.parse(body.toString("utf8"));
	if (!exact(value, ["schemaVersion", "sourceConfigurationSha256", "storedAt", "acquisition", "capture"]) || value.schemaVersion !== 1 || value.sourceConfigurationSha256 !== fultonCalendarConfigurationSha256 || !clock(value.storedAt, now) || !["prepared", "collected"].includes(String(value.acquisition))) throw new Error("The Fulton calendar storage envelope requires review.");
	const envelope = value as unknown as FultonCalendarEnvelope;
	const inventory = readFultonCalendarCapture(envelope.capture, now);
	if (envelope.storedAt < inventory.retrievedAt) throw new Error("The Fulton calendar storage clock precedes its source.");
	return { envelope, inventory, body: body.toString("utf8") };
}

export function compareFultonCalendarInventories(previous: FultonCalendarInventory, next: FultonCalendarInventory, now: number) {
	if (next.retrievedAt < previous.retrievedAt) throw new Error("An older Fulton calendar cannot replace retained evidence.");
	const today = new Date(now).toISOString().slice(0, 10);
	for (const section of previous.sections) {
		const lastEvent = section.entries.reduce((latest, entry) => [latest, entry.date ?? "", entry.endDate ?? ""].sort().at(-1)!, section.electionDate);
		if (lastEvent < today) continue;
		const replacement = next.sections.find(candidate => candidate.title === section.title && candidate.electionDate === section.electionDate);
		if (!replacement || section.entries.some(entry => !replacement.entries.some(candidate => candidate.id === entry.id))) throw new Error("The Fulton calendar removed retained election events before their cycle ended.");
		if (section.entries.some(entry => entry.issues.length === 0 && replacement.entries.find(candidate => candidate.id === entry.id)!.issues.length > 0)) throw new Error("A previously parsed Fulton calendar event now requires review.");
	}
}

async function syncDirectory(directory: string) {
	const handle = await open(directory, "r");
	try {
		await handle.sync();
	}
	finally { await handle.close(); }
}

export async function writeFultonCalendarFile(directory: string, name: string, body: string, immutable = false) {
	const target = join(directory, name);
	const temporary = join(directory, `.calendar-${randomUUID()}.tmp`);
	try {
		const handle = await open(temporary, "wx", 0o600);
		try {
			await handle.writeFile(body);
			await handle.sync();
		}
		finally { await handle.close(); }
		if (immutable) {
			try {
				await link(temporary, target);
			}
			catch (error) {
				if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
				if ((await readBoundedStateDataBytes(target, maximumFultonCalendarCaptureBytes)).toString("utf8") !== body) throw new Error("The retained Fulton calendar capture conflicts with its identity.");
			}
		}
		else {
			try {
				const metadata = await lstat(target);
				if (!metadata.isFile() || metadata.isSymbolicLink()) throw new Error("The Fulton calendar storage destination requires review.");
			}
			catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
			await rename(temporary, target);
		}
		await syncDirectory(directory);
	}
	finally {
		await unlink(temporary).catch((error: NodeJS.ErrnoException) => {
			if (error.code !== "ENOENT") throw error;
		});
	}
}

export async function writeFultonCalendarCapture(directory: string, capture: FultonCalendarCapture, acquisition: FultonCalendarEnvelope["acquisition"], now = Date.now()) {
	const inventory = readFultonCalendarCapture(capture, now);
	if (!["prepared", "collected"].includes(acquisition) || !Number.isFinite(now)) throw new Error("The Fulton calendar acquisition is invalid.");
	let previous: Awaited<ReturnType<typeof readFultonCalendarEnvelope>> | null = null;
	try {
		previous = await readFultonCalendarEnvelope(directory, now);
	}
	catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
	if (previous) {
		compareFultonCalendarInventories(previous.inventory, inventory, now);
		if (JSON.stringify(previous.envelope.capture) === JSON.stringify(capture)) return { inventory: previous.inventory, storedAt: previous.envelope.storedAt, changed: false };
	}
	const captureBody = `${JSON.stringify(capture)}\n`;
	const envelope: FultonCalendarEnvelope = { schemaVersion: 1, sourceConfigurationSha256: fultonCalendarConfigurationSha256, storedAt: new Date(now).toISOString(), acquisition, capture };
	const body = `${JSON.stringify(envelope)}\n`;
	if (Buffer.byteLength(body) > maximumFultonCalendarCaptureBytes) throw new Error("The Fulton calendar capture exceeds its storage bounds.");
	const captures = join(directory, "calendar-captures");
	await mkdir(captures, { recursive: true });
	if (await realpath(captures) !== captures) throw new Error("The Fulton calendar archive must not be redirected.");
	const entries = await readdir(captures);
	if (entries.length >= 256) throw new Error("The Fulton calendar archive needs a retention review.");
	let bytes = 0;
	for (const name of entries) {
		const metadata = await lstat(join(captures, name));
		if (!metadata.isFile() || metadata.isSymbolicLink()) throw new Error("The Fulton calendar archive contains an unreviewed entry.");
		bytes += metadata.size;
	}
	if (bytes + Buffer.byteLength(captureBody) > 128 * 1024 * 1024) throw new Error("The Fulton calendar archive needs a capacity review.");
	await writeFultonCalendarFile(captures, `${digest(captureBody)}.json`, captureBody, true);
	if (previous) await writeFultonCalendarFile(directory, "fulton-calendar.previous.json", previous.body);
	await writeFultonCalendarFile(directory, "fulton-calendar.json", body);
	return { inventory, storedAt: envelope.storedAt, changed: true };
}

export async function prepareFultonCalendarCapture(directory: string, capture: FultonCalendarCapture, now = Date.now()) {
	return withStateBallotAutomationLock(directory, "automation.lock", canonical => writeFultonCalendarCapture(canonical, capture, "prepared", now));
}

export async function readFultonCalendarRun(directory: string, now = Date.now()): Promise<FultonCalendarRun | null> {
	assertExternalStateDataDirectory(directory);
	let value: unknown;
	try {
		value = JSON.parse((await readBoundedStateDataBytes(join(directory, "calendar-run.json"), 4096)).toString("utf8"));
	}
	catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
		throw error;
	}
	if (!exact(value, ["schemaVersion", "type", "status", "startedAt", "finishedAt", "lastSuccessAt", "publisherRequests", "reason"]) || value.schemaVersion !== 1 || value.type !== "fulton-calendar-collection-run" || !["running", "succeeded", "failed"].includes(String(value.status)) || !clock(value.startedAt, now) || (value.finishedAt !== null && (!clock(value.finishedAt, now) || value.finishedAt < value.startedAt)) || (value.lastSuccessAt !== null && !clock(value.lastSuccessAt, now)) || !Number.isSafeInteger(value.publisherRequests) || Number(value.publisherRequests) < 0 || Number(value.publisherRequests) > 4 || (value.status === "running") !== (value.finishedAt === null) || ![null, "collection-failed", "persistence-failed"].includes(value.reason as null) || (value.status === "failed") !== (value.reason !== null)) throw new Error("The Fulton calendar collection journal requires review.");
	return value as unknown as FultonCalendarRun;
}
