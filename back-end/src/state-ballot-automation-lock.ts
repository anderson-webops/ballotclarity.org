import { randomUUID } from "node:crypto";
import { link, lstat, mkdir, open, realpath, unlink } from "node:fs/promises";
import { join } from "node:path";
import process from "node:process";
import { DatabaseSync } from "node:sqlite";
import { assertExternalStateDataDirectory, readBoundedStateDataBytes } from "./state-ballot-storage.js";

const applicationId = 1111706673;
const format = "ballot-automation-lock-v1";
const lockNames = ["automation.lock", ".fulton-board.lock", ".fulton-county-offices.lock", ".court-directory.lock", ".magistrate-court.lock"];
const activeFilenames = new Set<string>();

async function initializeLock(directory: string, filename: string) {
	const temporary = join(directory, `.automation-lock-${randomUUID()}.sqlite`);
	const handle = await open(temporary, "wx", 0o600);
	await handle.close();
	let database: DatabaseSync | undefined;
	try {
		database = new DatabaseSync(temporary);
		database.exec(`PRAGMA application_id = ${applicationId}; PRAGMA user_version = 1; CREATE TABLE automation_lock (format TEXT NOT NULL); INSERT INTO automation_lock VALUES ('${format}');`);
		database.close();
		database = undefined;
		const stored = await open(temporary, "r");
		try {
			await stored.sync();
		}
		finally { await stored.close(); }
		try {
			await link(temporary, filename);
		}
		catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error; }
	}
	finally {
		database?.close();
		await unlink(temporary);
	}
}

export async function acquireStateBallotAutomationLock(directory: string, lockName = "automation.lock") {
	if (!lockNames.includes(lockName)) throw new Error("The automation coordination filename requires review.");
	assertExternalStateDataDirectory(directory);
	await mkdir(directory, { recursive: true });
	const canonical = await realpath(directory);
	assertExternalStateDataDirectory(canonical);
	const filename = join(canonical, lockName);
	if (activeFilenames.has(filename)) throw new Error("Approved-data automation is already running for this resource.");
	activeFilenames.add(filename);
	let database: DatabaseSync | undefined;
	try {
		try {
			await lstat(filename);
		}
		catch (error) {
			if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
			await initializeLock(canonical, filename);
		}
		const metadata = await lstat(filename);
		if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.size > 65536 || (metadata.mode & 0o077) !== 0 || metadata.uid !== process.getuid?.())
			throw new Error("The existing automation lock requires operator review.");
		const body = await readBoundedStateDataBytes(filename, 65536);
		if (body.length < 100 || body.subarray(0, 16).toString("utf8") !== "SQLite format 3\0"
			|| body.readUInt32BE(68) !== applicationId || body.readUInt32BE(60) !== 1 || body[18] !== 1 || body[19] !== 1) {
			throw new Error("The existing automation lock requires operator review.");
		}
		database = new DatabaseSync(filename);
		database.exec("PRAGMA trusted_schema = OFF; PRAGMA busy_timeout = 0; BEGIN EXCLUSIVE;");
		const current = await lstat(filename);
		if (current.ino !== metadata.ino || current.dev !== metadata.dev || current.isSymbolicLink()
			|| database.prepare("PRAGMA application_id").get()?.application_id !== applicationId
			|| database.prepare("PRAGMA user_version").get()?.user_version !== 1
			|| database.prepare("PRAGMA journal_mode").get()?.journal_mode !== "delete"
			|| database.prepare("SELECT format FROM automation_lock").all().length !== 1
			|| database.prepare("SELECT format FROM automation_lock").get()?.format !== format) {
			throw new Error("The existing automation lock requires operator review.");
		}
		const held = database;
		let released = false;
		return {
			directory: canonical,
			async release() {
				if (released) return;
				released = true;
				try {
					held.exec("ROLLBACK");
				}
				finally {
					held.close();
					activeFilenames.delete(filename);
				}
			}
		};
	}
	catch (error) {
		database?.close();
		activeFilenames.delete(filename);
		throw error;
	}
}

export async function withStateBallotAutomationLock<Result>(directory: string, lockName: string, work: (canonical: string) => Promise<Result>) {
	const lock = await acquireStateBallotAutomationLock(directory, lockName);
	try {
		return await work(lock.directory);
	}
	finally { await lock.release(); }
}
