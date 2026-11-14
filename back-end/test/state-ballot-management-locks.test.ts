import type { StateBallotSnapshot } from "../src/state-ballot-repository.js";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { once } from "node:events";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { acquireStateBallotAutomationLock } from "../src/state-ballot-automation-lock.js";
import { configuredStateBallotSources, legacyReviewedStateBallotSource } from "../src/state-ballot-registry.js";
import { createStateBallotStorage, serializeStoredStateSnapshot } from "../src/state-ballot-storage.js";

const source = configuredStateBallotSources.find(source => source.id === "ga-fulton-2026")!;
const reviewedSource = legacyReviewedStateBallotSource(source)!;

async function fixture() {
	const directory = await mkdtemp(join(tmpdir(), "ballot-management-owner-"));
	const retrievedAt = "2026-10-27T22:00:00.000Z";
	const documents = source.documentUrls!.map((url, index) => ({ url, sha256: "b".repeat(64), retrievedAt, includedRecordCount: index === 0 ? 1 : 0 }));
	const snapshot: StateBallotSnapshot = {
		source: reviewedSource,
		retrievedAt,
		sha256: createHash("sha256").update(JSON.stringify(documents.map(({ url, sha256 }) => ({ url, sha256 })))).digest("hex"),
		documents,
		records: [{ id: "a".repeat(24), name: "Synthetic Candidate", office: "US Senate", district: "", scope: "statewide", status: "listed" }]
	};
	await createStateBallotStorage(directory).write({ ...snapshot, source });
	const input = join(directory, "reviewed.json");
	await writeFile(input, serializeStoredStateSnapshot(snapshot));
	const native = join(directory, "native.json");
	await writeFile(native, serializeStoredStateSnapshot({ ...snapshot, source }));
	const transport = join(directory, "transport.mjs");
	const requests = join(directory, "requests.txt");
	await writeFile(transport, `import dns from 'node:dns/promises';
import https from 'node:https';
import { appendFileSync } from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
Date.now = () => Date.parse('2026-10-27T22:00:01.000Z');
const reject = () => {
  appendFileSync(${JSON.stringify(requests)}, 'request\\n');
  if (process.env.FIXTURE_HOLD_TRANSPORT === '1') return new Promise(() => setInterval(() => {}, 1000));
  throw Error('Fixture publisher transport is unavailable');
};
dns.lookup = reject;
https.request = reject;
syncBuiltinESMExports();
`);
	const environment = {
		PATH: process.env.PATH,
		HOME: process.env.HOME,
		TMPDIR: process.env.TMPDIR,
		STATE_BALLOT_DATA_DIR: directory,
		FULTON_PUBLISHER_REQUEST_DIRECTORY: join(directory, "publisher-requests"),
		STATE_BALLOT_ENABLED_STATES: "GA",
		STATE_BALLOT_ENABLED_SOURCES: source.id,
		STATE_BALLOT_CYCLE_CATALOGS: JSON.stringify({ [source.id]: join(directory, "cycles.json") })
	};
	const run = (entry: string, args: string[] = []) => spawnSync(process.execPath, ["--import", "tsx", "--import", transport, fileURLToPath(new URL(`../src/${entry}.ts`, import.meta.url)), ...args], { env: environment, encoding: "utf8", timeout: 10000 });
	const launch = () => spawn(process.execPath, ["--import", "tsx", "--import", transport, fileURLToPath(new URL("../src/manage-state-ballot-cycles.ts", import.meta.url))], { env: { ...environment, FIXTURE_HOLD_TRANSPORT: "1" }, stdio: "ignore" });
	return { directory, snapshot, input, native, requests, run, launch };
}

for (const command of ["reviewed import", "native import", "refresh", "cycle sync"] as const) {
	test(`${command} refuses an existing recurring owner before publisher requests or dataset mutation`, async (context) => {
		const current = await fixture();
		context.after(() => rm(current.directory, { recursive: true, force: true }));
		const before = await readFile(join(current.directory, `${source.id}.json`));
		const lock = await acquireStateBallotAutomationLock(current.directory);
		try {
			const result = command === "cycle sync"
				? current.run("manage-state-ballot-cycles")
				: current.run("manage-state-ballot-data", command === "reviewed import" ? ["import", current.input] : command === "native import" ? ["import-native", source.id, current.native] : ["refresh", "GA"]);
			assert.equal(result.error, undefined);
			assert.equal(result.status, 1, result.stderr);
			assert.match(result.stderr, /already running|database is locked/u);
			assert.equal(result.stdout, "");
			assert.ok((await readFile(join(current.directory, `${source.id}.json`))).equals(before));
			await assert.rejects(readFile(current.requests), { code: "ENOENT" });
			await assert.rejects(readFile(join(current.directory, "cycles.json")), { code: "ENOENT" });
			await assert.rejects(acquireStateBallotAutomationLock(current.directory), /already running/u);
		}
		finally { await lock.release(); }
	});
}

test("reviewed import and cached refresh release ownership for subsequent commands without publisher requests", async (context) => {
	const current = await fixture();
	context.after(() => rm(current.directory, { recursive: true, force: true }));
	for (const args of [["refresh", "GA"], ["import-native", source.id, current.native], ["import", current.input]]) {
		const result = current.run("manage-state-ballot-data", args);
		assert.equal(result.status, 0, result.stderr);
		assert.equal(JSON.parse(result.stdout).records, 1);
		const lock = await acquireStateBallotAutomationLock(current.directory);
		await lock.release();
	}
	await assert.rejects(readFile(current.requests), { code: "ENOENT" });
});

test("management failures release ownership and preserve accepted data", async (context) => {
	const current = await fixture();
	context.after(() => rm(current.directory, { recursive: true, force: true }));
	const before = await readFile(join(current.directory, `${source.id}.json`));
	for (const [entry, args] of [["manage-state-ballot-data", ["import", join(current.directory, "missing.json")]], ["manage-state-ballot-cycles", []]] as const) {
		const result = current.run(entry, [...args]);
		assert.equal(result.status, 1, result.stderr);
		const lock = await acquireStateBallotAutomationLock(current.directory);
		await lock.release();
		assert.ok((await readFile(join(current.directory, `${source.id}.json`))).equals(before));
	}
});

test("a forcibly stopped cycle command releases ownership for a cold reviewed import with retained data and lock bytes", { timeout: 15000 }, async (context) => {
	const current = await fixture();
	context.after(() => rm(current.directory, { recursive: true, force: true }));
	const before = await readFile(join(current.directory, `${source.id}.json`));
	const worker = current.launch();
	try {
		let enteredTransport = false;
		for (let attempt = 0; attempt < 300; attempt++) {
			assert.equal(worker.exitCode, null);
			enteredTransport = await readFile(current.requests).then(() => true, () => false);
			if (enteredTransport) break;
			await new Promise(resolve => setTimeout(resolve, 20));
		}
		assert.equal(enteredTransport, true);
		await assert.rejects(acquireStateBallotAutomationLock(current.directory), /database is locked/u);
		const marker = await readFile(join(current.directory, "automation.lock"));
		const publisherJournal = await readFile(join(current.directory, "publisher-requests/last-request.json"));
		assert.equal(JSON.parse(publisherJournal.toString()).finishedAt, null);
		const stopped = once(worker, "exit");
		worker.kill("SIGKILL");
		assert.equal((await stopped)[1], "SIGKILL");
		assert.ok((await readFile(join(current.directory, `${source.id}.json`))).equals(before));
		await assert.rejects(readFile(join(current.directory, "cycles.json")), { code: "ENOENT" });
		const imported = current.run("manage-state-ballot-data", ["import", current.input]);
		assert.equal(imported.status, 0, imported.stderr);
		assert.deepEqual((await createStateBallotStorage(current.directory).read(reviewedSource))!.records, current.snapshot.records);
		assert.ok((await readFile(join(current.directory, "automation.lock"))).equals(marker));
		assert.ok((await readFile(join(current.directory, "publisher-requests/last-request.json"))).equals(publisherJournal));
		assert.equal(await readFile(current.requests, "utf8"), "request\n");
	}
	finally {
		if (worker.exitCode === null && worker.signalCode === null) {
			const stopped = once(worker, "exit");
			worker.kill("SIGKILL");
			await stopped;
		}
	}
});
