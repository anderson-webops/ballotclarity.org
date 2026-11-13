import type { MauiCharterAccessReview, MauiCharterCapture } from "./maui-charter-measures.js";
import { Buffer } from "node:buffer";
import { createHash, randomUUID } from "node:crypto";
import { link, lstat, open, readdir, realpath, rename, unlink } from "node:fs/promises";
import { basename, join } from "node:path";
import { fetchMauiCharterCapture, readMauiCharterCapture, writeMauiCharterCapture } from "./maui-charter-measures.js";
import { fetchRemoteSourceDocument } from "./remote-json-source.js";
import { withStateBallotAutomationLock } from "./state-ballot-automation-lock.js";
import { assertExternalStateDataDirectory, readBoundedStateDataBytes } from "./state-ballot-storage.js";

export const mauiCharterRefreshIntervalMs = 24 * 60 * 60 * 1000;
const maximumArchiveBytes = 128 * 1024 * 1024;
const maximumArchiveFiles = 256;
const hash = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");
const digest = (value: unknown): value is string => typeof value === "string" && /^[a-f\d]{64}$/u.test(value);
const exact = (value: unknown, keys: string[]): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).sort().join(",") === [...keys].sort().join(","));
const instant = (value: unknown, now: number): value is string => typeof value === "string" && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value && Date.parse(value) <= now;

interface StoredCapture { name: string; sha256: string; inventorySha256: string }
export interface MauiCharterCollectionRun {
	schemaVersion: 1;
	type: "maui-charter-collection-run";
	status: "running" | "succeeded" | "failed";
	startedAt: string;
	finishedAt: string | null;
	lastSuccessAt: string | null;
	publisherRequests: number;
	reason: "collection-failed" | "persistence-failed" | null;
	latest: StoredCapture | null;
}

function captureReference(value: unknown): value is StoredCapture {
	return exact(value, ["name", "sha256", "inventorySha256"]) && digest(value.sha256) && digest(value.inventorySha256) && typeof value.name === "string" && new RegExp(`^maui-charter-20\\d{2}-\\d{2}-\\d{2}-${value.sha256}\\.json$`, "u").test(value.name);
}

export async function readMauiCharterCollectionRun(directory: string, now = Date.now()): Promise<MauiCharterCollectionRun | null> {
	assertExternalStateDataDirectory(directory);
	let value: unknown;
	try {
		value = JSON.parse((await readBoundedStateDataBytes(join(directory, "maui-collection-run.json"), 4096)).toString("utf8"));
	}
	catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
		throw error;
	}
	if (!exact(value, ["schemaVersion", "type", "status", "startedAt", "finishedAt", "lastSuccessAt", "publisherRequests", "reason", "latest"]) || value.schemaVersion !== 1 || value.type !== "maui-charter-collection-run" || !["running", "succeeded", "failed"].includes(String(value.status)) || !instant(value.startedAt, now) || (value.finishedAt !== null && (!instant(value.finishedAt, now) || value.finishedAt < value.startedAt)) || (value.lastSuccessAt !== null && (!instant(value.lastSuccessAt, now) || value.lastSuccessAt > (value.finishedAt ?? value.startedAt))) || (value.status === "running") !== (value.finishedAt === null) || !Number.isSafeInteger(value.publisherRequests) || Number(value.publisherRequests) < 0 || Number(value.publisherRequests) > 12 || ![null, "collection-failed", "persistence-failed"].includes(value.reason as null) || (value.status === "failed") !== (value.reason !== null) || (value.latest !== null && !captureReference(value.latest)) || (value.status === "succeeded" && (value.latest === null || value.lastSuccessAt !== value.finishedAt))) throw new Error("Maui collection evidence requires review.");
	return value as unknown as MauiCharterCollectionRun;
}

async function writeState(directory: string, name: string, body: string, immutable = false) {
	const path = join(directory, name);
	const temporary = join(directory, `.maui-run-${randomUUID()}.tmp`);
	try {
		const handle = await open(temporary, "wx", 0o600);
		try {
			await handle.writeFile(body);
			await handle.sync();
		}
		finally { await handle.close(); }
		if (immutable) {
			try {
				await link(temporary, path);
			}
			catch (error) {
				if ((error as NodeJS.ErrnoException).code !== "EEXIST" || !(await readBoundedStateDataBytes(path)).equals(Buffer.from(body))) throw error;
			}
		}
		else {
			try {
				const metadata = await lstat(path);
				if (!metadata.isFile() || metadata.isSymbolicLink()) throw new Error("Maui collection evidence must use a regular private file.");
			}
			catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
			await rename(temporary, path);
		}
		const parent = await open(directory, "r");
		try {
			await parent.sync();
		}
		finally { await parent.close(); }
	}
	finally {
		await unlink(temporary).catch((error: NodeJS.ErrnoException) => {
			if (error.code !== "ENOENT") throw error;
		});
	}
}

const writeRun = (directory: string, run: MauiCharterCollectionRun) => writeState(directory, "maui-collection-run.json", `${JSON.stringify(run)}\n`);

async function readCapture(directory: string, reference: StoredCapture, now: number) {
	const body = await readBoundedStateDataBytes(join(directory, reference.name));
	const bundle: unknown = JSON.parse(body.toString("utf8"));
	if (hash(body) !== reference.sha256 || !exact(bundle, ["inventory", "capture"])) throw new Error("The retained Maui capture no longer matches its collection receipt.");
	const inventory = readMauiCharterCapture(bundle.capture, now);
	if (JSON.stringify(inventory) !== JSON.stringify(bundle.inventory) || hash(JSON.stringify(inventory)) !== reference.inventorySha256 || !reference.name.startsWith(`maui-charter-${inventory.electionDate}-`)) throw new Error("The retained Maui question inventory changed.");
	return { capture: bundle.capture as MauiCharterCapture, inventory };
}

export async function readLatestMauiCharterCapture(directory: string, now = Date.now()) {
	assertExternalStateDataDirectory(directory);
	const canonical = await realpath(directory);
	assertExternalStateDataDirectory(canonical);
	if (canonical !== directory) throw new Error("Maui collection requires its physical storage path.");
	const run = await readMauiCharterCollectionRun(canonical, now);
	if (!run?.latest) return { run, capture: null, inventory: null };
	const current = await readCapture(canonical, run.latest, now);
	await readQueuedReview(canonical, run.latest, current.inventory, now);
	return { run, ...current };
}

async function checkArchive(directory: string, nextBytes: number, kind: "capture" | "review") {
	const entries = (await readdir(directory)).filter(name => /^maui-(?:charter|review)-/u.test(name));
	if (entries.filter(name => name.startsWith("maui-charter-")).length + (kind === "capture" ? 1 : 0) > maximumArchiveFiles || entries.length + 1 > maximumArchiveFiles * 2) throw new Error("Maui collection storage needs a retention review.");
	let bytes = 0;
	for (const name of entries) {
		const metadata = await lstat(join(directory, name));
		if (!/^maui-(?:charter|review)-20\d{2}-\d{2}-\d{2}-[a-f\d]{64}\.json$/u.test(name) || !metadata.isFile() || metadata.isSymbolicLink()) throw new Error("The Maui capture archive contains an unreviewed entry.");
		bytes += metadata.size;
	}
	if (bytes + nextBytes > maximumArchiveBytes) throw new Error("Maui collection storage needs a capacity review.");
}

function questionChanges(inventory: ReturnType<typeof readMauiCharterCapture>, previous: ReturnType<typeof readMauiCharterCapture> | null) {
	const earlier = previous?.electionDate === inventory.electionDate ? previous.questions : [];
	return {
		added: inventory.questions.filter(question => !earlier.some(row => row.resolution === question.resolution)).map(question => question.resolution),
		changed: inventory.questions.filter(question => earlier.some(row => row.resolution === question.resolution && JSON.stringify(row) !== JSON.stringify(question))).map(question => question.resolution),
		removed: earlier.filter(question => !inventory.questions.some(row => row.resolution === question.resolution)).map(question => question.resolution)
	};
}

async function readQueuedReview(directory: string, latest: StoredCapture, inventory: ReturnType<typeof readMauiCharterCapture>, now: number) {
	const name = `maui-review-${inventory.electionDate}-${latest.inventorySha256}.json`;
	const existing: unknown = JSON.parse((await readBoundedStateDataBytes(join(directory, name))).toString("utf8"));
	if (!exact(existing, ["schemaVersion", "type", "capture", "previousCapture", "inventory", "changes", "publicationApproved", "automaticImportApproved"]) || existing.schemaVersion !== 1 || existing.type !== "maui-charter-review-queue" || !captureReference(existing.capture) || (existing.previousCapture !== null && !captureReference(existing.previousCapture)) || existing.capture.inventorySha256 !== latest.inventorySha256 || JSON.stringify(existing.inventory) !== JSON.stringify(inventory) || existing.publicationApproved !== false || existing.automaticImportApproved !== false) throw new Error("The pending Maui review no longer matches its source inventory.");
	await readCapture(directory, existing.capture, now);
	const previous = existing.previousCapture ? (await readCapture(directory, existing.previousCapture, now)).inventory : null;
	if (JSON.stringify(existing.changes) !== JSON.stringify(questionChanges(inventory, previous))) throw new Error("The pending Maui review changes no longer match their original evidence.");
	return name;
}

async function queueReview(directory: string, latest: StoredCapture, previous: Awaited<ReturnType<typeof readLatestMauiCharterCapture>>, now: number) {
	const { inventory } = await readCapture(directory, latest, now);
	const name = `maui-review-${inventory.electionDate}-${latest.inventorySha256}.json`;
	try {
		return await readQueuedReview(directory, latest, inventory, now);
	}
	catch (error) {
		if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
	}
	const changes = questionChanges(inventory, previous.inventory);
	const body = `${JSON.stringify({ schemaVersion: 1, type: "maui-charter-review-queue", capture: latest, previousCapture: previous.run?.latest ?? null, inventory, changes, publicationApproved: false, automaticImportApproved: false }, null, 2)}\n`;
	await checkArchive(directory, Buffer.byteLength(body), "review");
	await writeState(directory, name, body, true);
	return name;
}

export async function collectMauiCharterMeasures({ directory, accessReview, now = Date.now, request = fetchRemoteSourceDocument, pause }: { directory: string; accessReview: MauiCharterAccessReview; now?: () => number; request?: typeof fetchRemoteSourceDocument; pause?: (milliseconds: number) => Promise<unknown> }) {
	assertExternalStateDataDirectory(directory);
	return withStateBallotAutomationLock(directory, "automation.lock", async (canonical) => {
		if (canonical !== directory) throw new Error("Maui collection requires its physical storage path.");
		const previous = await readLatestMauiCharterCapture(canonical, now());
		if (previous.run && Date.parse(previous.run.startedAt) + mauiCharterRefreshIntervalMs > now()) {
			if (previous.run.status !== "succeeded") throw new Error("Maui collection is awaiting its next permitted attempt.");
			return { collected: false, publisherRequests: 0, latest: previous.run.latest, status: previous.run.status, path: join(canonical, previous.run.latest!.name), sha256: previous.run.latest!.sha256, questions: previous.inventory!.questions.length, electionDate: previous.inventory!.electionDate, imported: false, published: false, publicationApproved: false, automaticImportApproved: false };
		}
		const run: MauiCharterCollectionRun = { schemaVersion: 1, type: "maui-charter-collection-run", status: "running", startedAt: new Date(now()).toISOString(), finishedAt: null, lastSuccessAt: previous.run?.lastSuccessAt ?? null, publisherRequests: 0, reason: null, latest: previous.run?.latest ?? null };
		await writeRun(canonical, run);
		let validated = false;
		try {
			const capture = await fetchMauiCharterCapture({ accessReview, now, sleep: pause, fetchDocument: async (...args) => {
				run.publisherRequests++;
				return request(...args);
			} });
			const inventory = readMauiCharterCapture(capture, now());
			validated = true;
			const sameDocuments = previous.capture && JSON.stringify(previous.capture.documents.map(document => [document.url, document.sha256])) === JSON.stringify(capture.documents.map(document => [document.url, document.sha256]));
			const inventorySha256 = hash(JSON.stringify(inventory));
			if (!sameDocuments) {
				const bytes = Buffer.byteLength(`${JSON.stringify({ inventory, capture }, null, 2)}\n`);
				await checkArchive(canonical, bytes, "capture");
				const stored = await writeMauiCharterCapture(canonical, capture, now());
				run.latest = { name: basename(stored.path), sha256: stored.sha256, inventorySha256 };
			}
			const review = await queueReview(canonical, run.latest!, previous, now());
			run.status = "succeeded";
			run.finishedAt = new Date(now()).toISOString();
			run.lastSuccessAt = run.finishedAt;
			await writeRun(canonical, run);
			return { collected: true, publisherRequests: run.publisherRequests, latest: run.latest, status: run.status, path: join(canonical, run.latest!.name), sha256: run.latest!.sha256, questions: inventory.questions.length, electionDate: inventory.electionDate, changed: previous.run?.latest?.inventorySha256 !== inventorySha256, review, publicationApproved: false, automaticImportApproved: false, imported: false, published: false };
		}
		catch (error) {
			run.status = "failed";
			run.finishedAt = new Date(now()).toISOString();
			run.reason = validated ? "persistence-failed" : "collection-failed";
			run.latest = previous.run?.latest ?? null;
			run.lastSuccessAt = previous.run?.lastSuccessAt ?? null;
			await writeRun(canonical, run);
			throw error;
		}
	});
}
