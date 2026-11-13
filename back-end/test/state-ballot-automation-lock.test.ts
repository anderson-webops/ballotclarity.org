import assert from "node:assert/strict";
import { chmod, lstat, mkdtemp, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { acquireStateBallotAutomationLock } from "../src/state-ballot-automation-lock.js";

test("a reusable process-held lock retains private mode and stable bytes across clean releases", async (context) => {
	const directory = await realpath(await mkdtemp(join(tmpdir(), "ballot-lock-test-")));
	context.after(() => rm(directory, { recursive: true, force: true }));
	const first = await acquireStateBallotAutomationLock(directory);
	try {
		assert.equal(first.directory, directory);
		assert.equal((await lstat(join(directory, "automation.lock"))).mode & 0o777, 0o600);
		await assert.rejects(acquireStateBallotAutomationLock(directory), /already running/u);
	}
	finally { await first.release(); }
	await first.release();
	const original = await readFile(join(directory, "automation.lock"));
	const second = await acquireStateBallotAutomationLock(directory);
	await second.release();
	assert.ok((await readFile(join(directory, "automation.lock"))).equals(original));
});

test("canonical aliases share the same process owner and a refused alias leaves that owner held", async (context) => {
	const parent = await realpath(await mkdtemp(join(tmpdir(), "ballot-lock-alias-")));
	context.after(() => rm(parent, { recursive: true, force: true }));
	const first = await acquireStateBallotAutomationLock(join(parent, "data"));
	try {
		await symlink(first.directory, join(parent, "alias"));
		await assert.rejects(acquireStateBallotAutomationLock(join(parent, "alias")), /already running/u);
		await assert.rejects(acquireStateBallotAutomationLock(first.directory), /already running/u);
	}
	finally { await first.release(); }
	const repeated = await acquireStateBallotAutomationLock(join(parent, "alias"));
	await repeated.release();
});

test("legacy PID, empty, malformed and oversized lock files remain unchanged pending operator review", async (context) => {
	const parent = await realpath(await mkdtemp(join(tmpdir(), "ballot-legacy-lock-")));
	context.after(() => rm(parent, { recursive: true, force: true }));
	for (const body of [String(process.pid), "", "unrecognized lock", "x".repeat(65537)]) {
		const directory = await realpath(await mkdtemp(join(parent, "case-")));
		await writeFile(join(directory, "automation.lock"), body, { mode: 0o600 });
		await assert.rejects(acquireStateBallotAutomationLock(directory), /requires operator review/u);
		assert.equal(await readFile(join(directory, "automation.lock"), "utf8"), body);
	}
});

test("symlinked and unprivate lock files are preserved and refused", async (context) => {
	const parent = await realpath(await mkdtemp(join(tmpdir(), "ballot-unsafe-lock-")));
	context.after(() => rm(parent, { recursive: true, force: true }));
	const linked = await realpath(await mkdtemp(join(parent, "linked-")));
	const outside = join(parent, "owner-file");
	await writeFile(outside, "Retained owner content", { mode: 0o600 });
	await symlink(outside, join(linked, "automation.lock"));
	await assert.rejects(acquireStateBallotAutomationLock(linked), /requires operator review/u);
	assert.equal(await readFile(outside, "utf8"), "Retained owner content");
	assert.equal((await lstat(join(linked, "automation.lock"))).isSymbolicLink(), true);
	const unprivate = await realpath(await mkdtemp(join(parent, "unprivate-")));
	const lock = await acquireStateBallotAutomationLock(unprivate);
	await lock.release();
	const original = await readFile(join(unprivate, "automation.lock"));
	await chmod(join(unprivate, "automation.lock"), 0o644);
	await assert.rejects(acquireStateBallotAutomationLock(unprivate), /requires operator review/u);
	assert.ok((await readFile(join(unprivate, "automation.lock"))).equals(original));
	assert.equal((await lstat(join(unprivate, "automation.lock"))).mode & 0o777, 0o644);
});

test("simultaneous initialization admits exactly one owner and independent directories remain usable", async (context) => {
	const parent = await realpath(await mkdtemp(join(tmpdir(), "ballot-lock-contention-")));
	context.after(() => rm(parent, { recursive: true, force: true }));
	const directory = join(parent, "shared");
	const results = await Promise.allSettled([acquireStateBallotAutomationLock(directory), acquireStateBallotAutomationLock(directory)]);
	assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
	assert.equal(results.filter(result => result.status === "rejected").length, 1);
	const independent = await acquireStateBallotAutomationLock(join(parent, "independent"));
	await independent.release();
	for (const result of results) {
		if (result.status === "fulfilled") await result.value.release();
	}
	const repeated = await acquireStateBallotAutomationLock(directory);
	await repeated.release();
});

test("unknown database versions and identities are refused before opening the persisted lock", async (context) => {
	const parent = await realpath(await mkdtemp(join(tmpdir(), "ballot-lock-version-")));
	context.after(() => rm(parent, { recursive: true, force: true }));
	for (const offset of [18, 19, 60, 68]) {
		const directory = await realpath(await mkdtemp(join(parent, "case-")));
		const lock = await acquireStateBallotAutomationLock(directory);
		await lock.release();
		const filename = join(directory, "automation.lock");
		const bytes = await readFile(filename);
		bytes[offset] = 255;
		await writeFile(filename, bytes);
		await assert.rejects(acquireStateBallotAutomationLock(directory), /requires operator review/u);
		assert.ok((await readFile(filename)).equals(bytes));
	}
});
