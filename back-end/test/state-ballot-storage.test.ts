import type { StateBallotSnapshot } from "../src/state-ballot-repository.js";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { buildStateBallotPreview, createStateBallotRepository, resolveStateBallotConfiguration } from "../src/state-ballot-repository.js";
import { loadBundledStateSnapshot } from "../src/state-ballot-snapshot.js";
import { stateBallotSources } from "../src/state-ballot-sources.js";
import { assertExternalStateDataDirectory, createStateBallotStorage, readBoundedStateData } from "../src/state-ballot-storage.js";
import { loadReviewedStateFixture, readReviewedStateFixture } from "./helpers/reviewed-state-fixtures.js";

const now = Date.parse("2026-10-22T00:00:00Z");
const automatic = stateBallotSources.find(source => source.stateCode === "NC")!;
const body = "election_dt,contest_name,name_on_ballot,party_candidate,street_address\n11/03/2026,US SENATE,Example Candidate,Independent,excluded private address\n";
const snapshot: StateBallotSnapshot = {
	source: automatic,
	retrievedAt: new Date(now).toISOString(),
	sha256: createHash("sha256").update(body).digest("hex"),
	records: [{ id: "a".repeat(24), name: "Example Candidate", office: "US Senate", district: "", scope: "statewide", status: "listed" }],
};

test("state ingestion configuration accepts explicit controls and rejects invalid settings", () => {
	assert.equal(resolveStateBallotConfiguration({}).ttlMs, 14_400_000);
	assert.deepEqual(resolveStateBallotConfiguration({ STATE_BALLOT_ENABLED_STATES: " ut,HI " }).sources.map(source => source.stateCode).sort(), ["HI", "UT"]);
	for (const value of ["", "0", "-1", "abc", "86400001"])
		assert.throws(() => resolveStateBallotConfiguration({ STATE_BALLOT_CACHE_TTL_MS: value }), /lifetime/u);
	assert.throws(() => resolveStateBallotConfiguration({ STATE_BALLOT_ENABLED_STATES: "XX" }), /configured/u);
	assert.throws(() => assertExternalStateDataDirectory("relative/data"), /outside/u);
	assert.throws(() => assertExternalStateDataDirectory(fileURLToPath(new URL("../src/data", import.meta.url))), /outside/u);
});

test("atomic storage binds public records to source configuration without raw fields", async (context) => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-state-storage-"));
	context.after(() => rm(directory, { recursive: true, force: true }));
	const storage = createStateBallotStorage(directory);
	await storage.write(snapshot);
	assert.deepEqual(await storage.read(automatic), snapshot);
	assert.deepEqual(await readdir(directory), [`${automatic.id}.json`]);
	await assert.rejects(storage.read({ ...automatic, url: "https://different.example.test/candidates.csv" }), /configured source/u);
	await assert.rejects(storage.write({ ...snapshot, records: [{ ...snapshot.records[0]!, email: "excluded@example.test" } as never] }), /layout/u);
	assert.deepEqual(await storage.read(automatic), snapshot);
	const path = join(directory, `${automatic.id}.json`);
	await rm(path);
	await symlink(fileURLToPath(new URL("./fixtures/reviewed-state-catalog.json", import.meta.url)), path);
	await assert.rejects(storage.read(automatic));
	await assert.rejects(readBoundedStateData(directory), /regular file/u);
});

test("a fresh persisted automatic snapshot survives restart without a provider request", async (context) => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-state-restart-"));
	context.after(() => rm(directory, { recursive: true, force: true }));
	await createStateBallotStorage(directory).write(snapshot);
	let requests = 0;
	const repository = createStateBallotRepository({ dataDirectory: directory, now: () => now + 1000, fetchText: async () => {
		requests += 1;
		throw new Error("Network must not be used.");
	} });
	assert.deepEqual(await repository.getSnapshot("NC"), snapshot);
	assert.equal(requests, 0);
	assert.equal(buildStateBallotPreview((await repository.getSnapshot("NC"))!, { districtMatches: [] })?.candidateCount, 1);
});

test("expired persisted data is not silently served when its provider is unavailable", async (context) => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-state-expired-"));
	context.after(() => rm(directory, { recursive: true, force: true }));
	const storage = createStateBallotStorage(directory);
	await storage.write(snapshot);
	let requests = 0;
	const repository = createStateBallotRepository({ dataDirectory: directory, now: () => now + 2000, ttlMs: 1000, fetchText: async () => {
		requests += 1;
		throw new Error("Unavailable");
	} });
	assert.equal(await repository.getSnapshot("NC"), null);
	assert.equal(await repository.getSnapshot("NC"), null);
	assert.equal(requests, 1);
	assert.deepEqual(await storage.read(automatic), snapshot);
});

test("successful automatic refresh persists sanitized facts and supports concurrent lookups", async (context) => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-state-fetch-"));
	context.after(() => rm(directory, { recursive: true, force: true }));
	let requests = 0;
	const repository = createStateBallotRepository({ dataDirectory: directory, now: () => now, fetchText: async () => {
		requests += 1;
		return body;
	} });
	const [first, second] = await Promise.all([repository.getSnapshot("NC"), repository.getSnapshot("NC")]);
	assert.ok(first);
	assert.equal(first, second);
	assert.equal(requests, 1);
	assert.deepEqual(await createStateBallotStorage(directory).read(automatic), JSON.parse(JSON.stringify(first)));
	assert.equal((await readFile(join(directory, `${automatic.id}.json`), "utf8")).includes("excluded private address"), false);
});

test("future cache dates and post-election records are rejected without a provider request", async (context) => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-state-dates-"));
	context.after(() => rm(directory, { recursive: true, force: true }));
	await createStateBallotStorage(directory).write(snapshot);
	const forbiddenFetch = async () => {
		throw new Error("Must not request provider.");
	};
	assert.equal(await createStateBallotRepository({ dataDirectory: directory, now: () => now - 1, fetchText: forbiddenFetch }).getSnapshot("NC"), null);
	assert.equal(await createStateBallotRepository({ dataDirectory: directory, now: () => Date.parse("2026-11-05T00:00:00Z"), fetchText: forbiddenFetch }).getSnapshot("NC"), null);
});

test("legacy reviewed regression fixtures are served only after explicit external imports with exact dates and no crawling", async (context) => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-state-reviewed-"));
	context.after(() => rm(directory, { recursive: true, force: true }));
	const storage = createStateBallotStorage(directory);
	const originals = [];
	for (const source of stateBallotSources.filter(source => source.retrievalPolicy === "manual-snapshot" && source.snapshotStorage !== "external")) {
		const original = loadReviewedStateFixture(source);
		await storage.write(original);
		originals.push(original);
	}
	let requests = 0;
	const repository = createStateBallotRepository({ dataDirectory: directory, now: () => now, fetchText: async () => {
		requests += 1;
		throw new Error("No crawling permitted.");
	} });
	for (const original of originals)
		assert.deepEqual(await repository.getSnapshot(original.source.stateCode), original);
	assert.equal(requests, 0);
});

test("invalid external reviewed data fails closed instead of relabeling bundled data", async (context) => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-state-invalid-"));
	context.after(() => rm(directory, { recursive: true, force: true }));
	const source = stateBallotSources.find(source => source.stateCode === "IL")!;
	await writeFile(join(directory, `${source.id}.json`), "{}");
	const repository = createStateBallotRepository({ dataDirectory: directory, now: () => now });
	assert.equal(await repository.getSnapshot("IL"), null);
});

test("every reviewed source requires external data regardless of its retained legacy storage flag", async () => {
	let requests = 0;
	const sources = stateBallotSources.filter(source => source.retrievalPolicy === "manual-snapshot");
	assert.equal(sources.length, 32);
	const repository = createStateBallotRepository({ sources, dataDirectory: null, now: () => now, fetchText: async () => {
		requests += 1;
		throw new Error("Reviewed sources cannot download.");
	} });
	for (const source of sources) {
		assert.equal(await repository.getSnapshot(source.stateCode), null);
		await assert.rejects(loadBundledStateSnapshot(source), /No bundled/u);
	}
	assert.equal(requests, 0);
});

test("reviewed imports and replacements appear immediately without a restart or cache-clock advance", async (context) => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-state-reload-"));
	context.after(() => rm(directory, { recursive: true, force: true }));
	const original = loadReviewedStateFixture("IL");
	const storage = createStateBallotStorage(directory);
	let requests = 0;
	const repository = createStateBallotRepository({ sources: [original.source], dataDirectory: directory, now: () => now, fetchText: async () => {
		requests += 1;
		throw new Error("No publisher request permitted.");
	} });
	assert.equal(await repository.getSnapshot("IL"), null);
	await storage.write(original);
	assert.deepEqual(await repository.getSnapshot("IL"), original);
	const replacement = { ...original, retrievedAt: new Date(now).toISOString(), sha256: createHash("sha256").update("controlled reviewed update").digest("hex"), records: original.records.map((record, index) => index ? record : { ...record, name: "Controlled revised candidate", id: createHash("sha256").update("controlled revised candidate").digest("hex").slice(0, 24) }) };
	await storage.write(replacement);
	assert.deepEqual(await repository.getSnapshot("IL"), replacement);
	assert.equal(requests, 0);
});

test("malformed and future reviewed data fail closed and a restored import recovers immediately", async (context) => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-state-reload-failure-"));
	context.after(() => rm(directory, { recursive: true, force: true }));
	const original = loadReviewedStateFixture("IL");
	const storage = createStateBallotStorage(directory);
	const repository = createStateBallotRepository({
		sources: [original.source],
		dataDirectory: directory,
		now: () => now,
		fetchText: async () => {
			throw new Error("No publisher request permitted.");
		},
	});
	await storage.write(original);
	assert.deepEqual(await repository.getSnapshot("IL"), original);
	await writeFile(join(directory, `${original.source.id}.json`), "{}");
	assert.equal(await repository.getSnapshot("IL"), null);
	await storage.write({ ...original, retrievedAt: new Date(now + 1).toISOString() });
	assert.equal(await repository.getSnapshot("IL"), null);
	await storage.write(original);
	assert.deepEqual(await repository.getSnapshot("IL"), original);
});

test("the management command imports reviewed facts and refuses manual refresh", async (context) => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-state-command-"));
	context.after(() => rm(directory, { recursive: true, force: true }));
	const script = fileURLToPath(new URL("../src/manage-state-ballot-data.ts", import.meta.url));
	const file = join(directory, "reviewed-fixture.json");
	await writeFile(file, readReviewedStateFixture("IL"));
	const environment = { ...process.env, STATE_BALLOT_DATA_DIR: directory, STATE_BALLOT_ENABLED_STATES: "IL" };
	const output = execFileSync(process.execPath, ["--import", "tsx", script, "import", file], { env: environment, encoding: "utf8" });
	assert.equal(JSON.parse(output).action, "imported");
	assert.throws(() => execFileSync(process.execPath, ["--import", "tsx", script, "refresh", "IL"], { env: environment, stdio: "pipe" }));
	const stored = await readFile(join(directory, "il-sbe-2026.json"), "utf8");
	assert.equal(JSON.parse(JSON.parse(stored).snapshot).retrievedAt, "2026-10-21T04:59:46.328Z");
});
