import type { StateBallotSnapshot } from "../src/state-ballot-repository.js";
import assert from "node:assert/strict";
import { mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createStateBallotRepository } from "../src/state-ballot-repository.js";
import { stateBallotSources } from "../src/state-ballot-sources.js";
import { createStateBallotStorage } from "../src/state-ballot-storage.js";

test("explicit archived sources retain records across restart without refreshing current ballots", async (context) => {
	const directory = await realpath(await mkdtemp(join(tmpdir(), "state-ballot-archive-")));
	context.after(() => rm(directory, { recursive: true, force: true }));
	const source = stateBallotSources.find(source => source.stateCode === "NC")!;
	const capturedAt = "2026-11-01T00:00:00.000Z";
	const snapshot: StateBallotSnapshot = { source, retrievedAt: capturedAt, sha256: "a".repeat(64), records: [{ id: "b".repeat(24), name: "Archived Candidate", office: "US SENATE", scope: "statewide", district: "", status: "listed" }] };
	const storage = createStateBallotStorage(directory);
	await storage.write(snapshot);
	let publisherRequests = 0;
	let failures = 0;
	const makeRepository = () => createStateBallotRepository({
		sources: [source],
		dataDirectory: directory,
		now: () => Date.parse("2026-11-06T00:00:00Z"),
		fetchText: async () => {
			publisherRequests++;
			throw new Error("Excluded publisher request");
		},
		onUnavailable: () => { failures++; },
	});
	for (const repository of [makeRepository(), makeRepository()]) {
		assert.equal(await repository.getSnapshot("NC"), null);
		assert.equal((await repository.getSnapshot("NC", source.id))!.records[0]!.name, "Archived Candidate");
		assert.equal(await repository.getSnapshot("NC", "unknown-source"), null);
	}
	const collector = createStateBallotRepository({
		sources: [source],
		dataDirectory: directory,
		now: () => Date.parse("2026-11-06T00:00:00Z"),
		refreshReviewedLegacy: true,
		fetchText: async () => {
			throw new Error("Expired sources must not refresh");
		},
	});
	assert.equal(await collector.getSnapshot("NC", source.id), null);
	assert.deepEqual(await makeRepository().getStoredSnapshots!("NC"), []);
	assert.equal((await makeRepository().getStoredSnapshots!("NC", [source.id])).length, 1);
	const path = join(directory, `${source.id}.json`);
	const original = await readFile(path, "utf8");
	const invalid = JSON.parse(original);
	invalid.sourceConfigurationSha256 = "c".repeat(64);
	await writeFile(path, JSON.stringify(invalid));
	assert.equal(await makeRepository().getSnapshot("NC", source.id), null);
	assert.equal(failures, 1);
	await writeFile(path, original);
	assert.equal((await makeRepository().getSnapshot("NC", source.id))!.records.length, 1);
	await storage.write({ ...snapshot, retrievedAt: "2030-01-01T00:00:00.000Z" });
	assert.equal(await makeRepository().getSnapshot("NC", source.id), null);
	assert.equal(publisherRequests, 0);
});
