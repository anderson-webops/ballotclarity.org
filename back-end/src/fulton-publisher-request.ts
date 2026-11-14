import { randomUUID } from "node:crypto";
import { lstat, mkdir, open, readdir, rename, unlink } from "node:fs/promises";
import { join } from "node:path";
import process from "node:process";
import { setTimeout } from "node:timers/promises";
import { acquireStateBallotAutomationLock } from "./state-ballot-automation-lock.js";
import { assertExternalStateDataDirectory, readBoundedStateDataBytes } from "./state-ballot-storage.js";

export const fultonPublisherRequestPolicy = { minimumIntervalMs: 11000, maximumWaitMs: 30000, maximumInitializationWaitMs: 2000, maximumEntries: 16 } as const;
interface Options { directory?: string; now?: () => number; pause?: (milliseconds: number) => Promise<unknown>; maximumWaitMs?: number }
interface Attempt { schemaVersion: 1; publisher: "fultoncountyga.gov"; lastStartedAt: string; finishedAt: string | null; attempts: number }

async function persist(directory: string, attempt: Attempt) {
	const temporary = join(directory, `.request-${randomUUID()}.tmp`);
	try {
		const handle = await open(temporary, "wx", 0o600);
		try {
			await handle.writeFile(`${JSON.stringify(attempt)}\n`);
			await handle.sync();
		}
		finally { await handle.close(); }
		await rename(temporary, join(directory, "last-request.json"));
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

async function complete(directory: string, attempt: Attempt, now: () => number) {
	const finishedAt = now();
	if (!Number.isSafeInteger(finishedAt) || finishedAt < Date.parse(attempt.lastStartedAt) || finishedAt > 8640000000000000) throw new Error("The Fulton request completion clock requires review.");
	await persist(directory, { ...attempt, finishedAt: new Date(finishedAt).toISOString() });
}

async function inventory(directory: string) {
	const deadline = performance.now() + fultonPublisherRequestPolicy.maximumInitializationWaitMs;
	for (;;) {
		const entries = await readdir(directory);
		if (entries.length > fultonPublisherRequestPolicy.maximumEntries) throw new Error("The Fulton request storage inventory requires review.");
		const initializing = entries.filter(name => /^\.automation-lock-[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}\.sqlite(?:-journal)?$/u.test(name));
		if (!initializing.length) return entries;
		for (const name of initializing) {
			try {
				const metadata = await lstat(join(directory, name));
				if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.nlink > 2 || metadata.size > 65536 || (metadata.mode & 0o077) !== 0 || metadata.uid !== process.getuid?.()) throw new Error("The Fulton request initialization metadata requires review.");
			}
			catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
		}
		if (performance.now() >= deadline) throw new Error("The Fulton request initialization is incomplete and requires review.");
		await setTimeout(10);
	}
}

export async function coordinateFultonPublisherRequest<Result>(work: () => Promise<Result>, options: Options = {}) {
	const directory = options.directory ?? process.env.FULTON_PUBLISHER_REQUEST_DIRECTORY;
	if (!directory) throw new Error("Configure the shared Fulton publisher request directory before collection.");
	const maximumWaitMs = options.maximumWaitMs ?? fultonPublisherRequestPolicy.maximumWaitMs;
	if (!Number.isSafeInteger(maximumWaitMs) || maximumWaitMs < 1 || maximumWaitMs > fultonPublisherRequestPolicy.maximumWaitMs) throw new Error("The Fulton request wait exceeds its bounds.");
	assertExternalStateDataDirectory(directory);
	await mkdir(directory, { recursive: true, mode: 0o700 });
	const metadata = await lstat(directory);
	if (!metadata.isDirectory() || metadata.isSymbolicLink() || (metadata.mode & 0o077) !== 0 || metadata.uid !== process.getuid?.()) throw new Error("The Fulton request directory requires private owner-controlled storage.");
	const deadline = performance.now() + maximumWaitMs;
	let lock;
	for (;;) {
		try {
			lock = await acquireStateBallotAutomationLock(directory);
			break;
		}
		catch (error) {
			const busy = error instanceof Error && (error.message === "Approved-data automation is already running for this resource." || (error as Error & { errcode?: number }).errcode === 5);
			if (!busy || performance.now() >= deadline) throw error;
			await setTimeout(Math.min(100, Math.max(1, deadline - performance.now())));
		}
	}
	try {
		const canonical = lock.directory;
		const entries = await inventory(canonical);
		if (entries.length > fultonPublisherRequestPolicy.maximumEntries || entries.some(name => !["automation.lock", "last-request.json", "initialized"].includes(name) && !/^\.request-[a-f\d-]{36}\.tmp$/u.test(name))) throw new Error("The Fulton request storage inventory requires review.");
		for (const name of entries) {
			const entry = await lstat(join(canonical, name));
			if (!entry.isFile() || entry.isSymbolicLink() || entry.nlink !== 1 || entry.size > 65536 || (entry.mode & 0o077) !== 0 || entry.uid !== process.getuid?.()) throw new Error("The Fulton request storage metadata requires review.");
		}
		const initialized = entries.includes("initialized");
		if (initialized && (await readBoundedStateDataBytes(join(canonical, "initialized"), 64)).toString("utf8") !== "fulton-publisher-request-v1\n") throw new Error("The Fulton request initialization evidence requires review.");
		const now = options.now ?? Date.now;
		let previous: Attempt | null = null;
		try {
			const filename = join(canonical, "last-request.json");
			const stored = await lstat(filename);
			if (!stored.isFile() || stored.isSymbolicLink() || stored.nlink !== 1 || (stored.mode & 0o077) !== 0 || stored.uid !== process.getuid?.()) throw new Error("The Fulton request journal requires review.");
			const value = JSON.parse((await readBoundedStateDataBytes(filename, 1024)).toString("utf8"));
			if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).sort().join(",") !== "attempts,finishedAt,lastStartedAt,publisher,schemaVersion" || value.schemaVersion !== 1 || value.publisher !== "fultoncountyga.gov" || typeof value.lastStartedAt !== "string" || !Number.isFinite(Date.parse(value.lastStartedAt)) || new Date(value.lastStartedAt).toISOString() !== value.lastStartedAt || Date.parse(value.lastStartedAt) > now() || (value.finishedAt !== null && (typeof value.finishedAt !== "string" || !Number.isFinite(Date.parse(value.finishedAt)) || new Date(value.finishedAt).toISOString() !== value.finishedAt || Date.parse(value.finishedAt) > now() || value.finishedAt < value.lastStartedAt)) || !Number.isSafeInteger(value.attempts) || value.attempts < 1 || value.attempts >= Number.MAX_SAFE_INTEGER) throw new Error("The Fulton request journal requires review.");
			previous = value;
		}
		catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
		if (initialized && !previous) throw new Error("The Fulton request journal is missing and requires review.");
		if (previous) {
			const after = previous.finishedAt === null ? now() : Date.parse(previous.finishedAt);
			const remaining = after + fultonPublisherRequestPolicy.minimumIntervalMs - now();
			if (remaining > 0) await (options.pause ?? setTimeout)(remaining);
			if (now() < after + fultonPublisherRequestPolicy.minimumIntervalMs) throw new Error("The Fulton publisher interval has not elapsed.");
		}
		const startedAt = now();
		if (!Number.isSafeInteger(startedAt) || startedAt < 0 || startedAt > 8640000000000000) throw new Error("The Fulton request clock requires review.");
		const attempt: Attempt = { schemaVersion: 1, publisher: "fultoncountyga.gov", lastStartedAt: new Date(startedAt).toISOString(), finishedAt: null, attempts: (previous?.attempts ?? 0) + 1 };
		await persist(canonical, attempt);
		if (!initialized) {
			const marker = await open(join(canonical, "initialized"), "wx", 0o600);
			try {
				await marker.writeFile("fulton-publisher-request-v1\n");
				await marker.sync();
			}
			finally { await marker.close(); }
			const parent = await open(canonical, "r");
			try {
				await parent.sync();
			}
			finally { await parent.close(); }
		}
		try {
			return await work();
		}
		finally {
			await complete(canonical, attempt, now);
		}
	}
	finally { await lock.release(); }
}
