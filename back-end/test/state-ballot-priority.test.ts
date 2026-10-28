import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { refreshApprovedCandidateData } from "../src/state-ballot-automation.js";
import { syncStateBallotCycleFamilies } from "../src/state-ballot-cycle-sync.js";
import { prioritizeStateBallotWork, stateBallotPriorityFamilies } from "../src/state-ballot-priority.js";

const now = Date.parse("2026-10-27T00:00:00.000Z");
const fulton = "ga-fulton-2026";
const washington = "wa-general-2026";
const montana = "mt-general-2026";

test("collection priority defaults to Fulton and validates only approved distinct family IDs", () => {
	assert.deepEqual(stateBallotPriorityFamilies({}), [fulton]);
	assert.deepEqual(stateBallotPriorityFamilies({ STATE_BALLOT_PRIORITY_FAMILIES: ` ${montana}, ${fulton} ` }), [montana, fulton]);
	assert.deepEqual(stateBallotPriorityFamilies({ STATE_BALLOT_PRIORITY_FAMILIES: "" }), []);
	for (const value of [`${fulton},${fulton}`, `${fulton},`, "unknown-family", "ga-fulton-general-2030-11-05", "*", "x".repeat(8193)]) assert.throws(() => stateBallotPriorityFamilies({ STATE_BALLOT_PRIORITY_FAMILIES: value }));
});

test("priority is stable, year-independent and never adds or mutates work", () => {
	const work = [washington, "ga-fulton-general-2030-11-05", montana, fulton, "ga-fultonish-2030", "ga-fulton-general-2028-11-07"];
	const before = [...work];
	assert.deepEqual(prioritizeStateBallotWork(work, value => value), [work[1], fulton, work[5], washington, montana, work[4]]);
	assert.deepEqual(work, before);
	assert.deepEqual(prioritizeStateBallotWork(work, value => value, []), work);
	assert.deepEqual(prioritizeStateBallotWork([washington, montana], value => value), [washington, montana]);
	assert.deepEqual(prioritizeStateBallotWork([washington, fulton, montana], value => value, [montana, fulton]), [montana, fulton, washington]);
});

test("multi-family synchronization attempts Fulton first and isolates its access failure", async () => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-priority-sync-"));
	try {
		const attempts: string[] = [];
		const configurations = [washington, fulton, montana].map(familyId => ({ familyId, catalogPath: join(directory, `${familyId}.json`), dataDirectory: join(directory, "data"), now: () => now, fetchDiscovery: async () => {
			attempts.push(familyId);
			throw new Error("Publisher access requires review.");
		} }));
		const results = await syncStateBallotCycleFamilies(configurations);
		assert.deepEqual(attempts, [fulton, washington, montana]);
		assert.deepEqual(results.map(result => result.familyId), attempts);
		assert.ok(results.every(result => result.status === "failed"));
		assert.deepEqual(configurations.map(item => item.familyId), [washington, fulton, montana]);
		attempts.length = 0;
		await syncStateBallotCycleFamilies(configurations, []);
		assert.deepEqual(attempts, [washington, fulton, montana]);
	}
	finally { await rm(directory, { recursive: true, force: true }); }
});

for (const catalogIncludesFulton of [false, true]) {
	test(`routine worker prioritizes Fulton ${catalogIncludesFulton ? "discovery" : "without a catalog"} before independent families`, async () => {
		const directory = await mkdtemp(join(tmpdir(), "ballot-priority-worker-"));
		try {
			const attempts: string[] = [];
			const catalogFamilies = catalogIncludesFulton ? [washington, montana, fulton] : [washington, montana];
			const environment = { STATE_BALLOT_DATA_DIR: directory, STATE_BALLOT_ENABLED_STATES: "WA,MT,GA", STATE_BALLOT_ENABLED_SOURCES: [washington, montana, fulton].join(","), STATE_BALLOT_CYCLE_CATALOGS: JSON.stringify(Object.fromEntries(catalogFamilies.map(familyId => [familyId, join(directory, `${familyId}.json`)]))) };
			const result = await refreshApprovedCandidateData({ environment, now: () => now, fetchDiscovery: async (familyId) => {
				attempts.push(familyId);
				throw new Error("Publisher unavailable.");
			}, fetchText: async (source) => {
				attempts.push(source.id);
				throw new Error("Publisher unavailable.");
			} });
			assert.deepEqual(attempts, [fulton, washington, montana]);
			assert.deepEqual(result.results.map(item => item.sourceId), attempts);
			assert.equal(result.status, "failed");
			assert.equal(result.lastSuccessAt, null);
			assert.equal(result.lastImportAt, null);
			assert.deepEqual(JSON.parse(await readFile(join(directory, "automation-run.json"), "utf8")), result);
		}
		finally { await rm(directory, { recursive: true, force: true }); }
	});
}

test("priority never enables Fulton, and malformed priority makes no publisher requests", async () => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-priority-gates-"));
	try {
		const attempts: string[] = [];
		const environment = { STATE_BALLOT_DATA_DIR: directory, STATE_BALLOT_ENABLED_STATES: "MT", STATE_BALLOT_ENABLED_SOURCES: montana };
		const options = { environment, now: () => now, fetchText: async (source: { id: string }) => {
			attempts.push(source.id);
			throw new Error("Publisher unavailable.");
		} };
		await refreshApprovedCandidateData(options);
		assert.deepEqual(attempts, [montana]);
		attempts.length = 0;
		const failed = await refreshApprovedCandidateData({ ...options, environment: { ...environment, STATE_BALLOT_PRIORITY_FAMILIES: "not-approved" } });
		assert.deepEqual(attempts, []);
		assert.equal(failed.status, "failed");
		assert.deepEqual(failed.results, [{ sourceId: "configuration", status: "failed", records: 0, reason: "configuration-invalid" }]);
	}
	finally { await rm(directory, { recursive: true, force: true }); }
});
