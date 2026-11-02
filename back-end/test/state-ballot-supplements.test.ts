import type { StateCandidateRecord } from "../src/state-ballot-records.js";
import type { StateBallotRepository, StateBallotSnapshot } from "../src/state-ballot-repository.js";
import type { LocationLookupResponse, StateRecordsResponse } from "../src/types/civic.js";
import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";
import express from "express";
import { electionRecordSource } from "../src/election-record-source.js";
import { configuredStateBallotSources } from "../src/state-ballot-registry.js";
import { attachStateBallotPreview } from "../src/state-ballot-repository.js";
import { stateBallotSources } from "../src/state-ballot-sources.js";
import { applicableStateRecordSupplements, readStateRecordSupplements } from "../src/state-ballot-supplements.js";
import { registerStateRecordRoutes } from "../src/state-records.js";

const primarySource = stateBallotSources.find(source => source.id === "ga-fulton-2026")!;
const supplementSource = configuredStateBallotSources.find(source => source.recordRole === "certified-writeins")!;
const row = (id: string, scope: StateCandidateRecord["scope"], office: string, district = "", name = id): StateCandidateRecord => ({ id, name, office, scope, district, status: "write-in" });
const primary: StateBallotSnapshot = { source: primarySource, retrievedAt: "2026-10-21T12:00:00.000Z", sha256: "a".repeat(64), records: [row("first", "statewide", "United States Senate"), row("second", "statewide", "Governor"), row("third", "congressional", "United States House of Representatives - District 5", "5")] };
const supplement: StateBallotSnapshot = { source: supplementSource, retrievedAt: "2026-11-01T12:00:00.000Z", sha256: "b".repeat(64), records: [row("fourth", "statewide", "United States Senate"), row("fifth", "statewide", "Governor"), row("sixth", "congressional", "United States House of Representatives - District 10", "10"), row("seventh", "local", "County Commission", "4")] };
function repository(): StateBallotRepository {
	return { sources: [primarySource, supplementSource], getSnapshot: async () => primary, getStoredSnapshots: async (_state, sourceIds) => {
		assert.deepEqual(sourceIds, [supplementSource.id]);
		return [supplement];
	} };
}

test("certified supplements add only existing nonlocal office slots without mutating retained data", async () => {
	const original = JSON.stringify([primary, supplement]);
	const retained = await readStateRecordSupplements(primary, repository());
	assert.equal(retained.unavailable, false);
	assert.deepEqual(applicableStateRecordSupplements(primary, retained.snapshots)[0]!.records.map(record => record.id), ["fourth", "fifth"]);
	assert.equal(JSON.stringify([primary, supplement]), original);
	assert.equal(applicableStateRecordSupplements(primary, [{ ...supplement, source: { ...supplementSource, electionDate: "2028-11-07" } }]).length, 0);
	assert.equal(applicableStateRecordSupplements(primary, [{ ...supplement, records: [{ ...primary.records[0]!, id: "duplicate" }] }]).length, 0);
	assert.deepEqual(electionRecordSource(primarySource.electionDate, { name: "Fulton County", state: "GA", jurisdictionType: "county" }, repository().sources!), { stateCode: "GA", sourceId: primarySource.id, includeSupplements: true });
});

test("missing, failed or mismatched stored supplements preserve the primary records", async () => {
	for (const modified of [{ ...repository(), getStoredSnapshots: undefined }, { ...repository(), getStoredSnapshots: async () => [] }, { ...repository(), getStoredSnapshots: async () => {
		throw new Error("storage unavailable");
	} }, { ...repository(), getStoredSnapshots: async () => [{ ...supplement, source: { ...supplementSource, stateCode: "FL" } }] }]) {
		const retained = await readStateRecordSupplements(primary, modified);
		assert.equal(retained.unavailable, true);
		assert.deepEqual(retained.snapshots, []);
	}
});

test("opt-in record pagination preserves each certificate's source, capture clock and document", async (context) => {
	const app = express();
	registerStateRecordRoutes(app, repository());
	const server = app.listen(0, "127.0.0.1");
	await once(server, "listening");
	context.after(() => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())));
	const address = server.address();
	assert.ok(address && typeof address === "object");
	const url = `http://127.0.0.1:${address.port}/api/state-records/GA?source=${primarySource.id}`;
	const plain = await (await fetch(url)).json() as StateRecordsResponse;
	assert.equal(plain.matched, 3);
	assert.equal(plain.supplementalSources, undefined);
	const combined = await (await fetch(`${url}&includeSupplements=true&offset=3&limit=2`)).json() as StateRecordsResponse;
	assert.equal(combined.matched, 5);
	assert.deepEqual(combined.records.map(record => record.sourceId), [supplementSource.id, supplementSource.id]);
	assert.equal(combined.source.retrievedAt, primary.retrievedAt);
	assert.deepEqual(combined.supplementalSources, [{ id: supplementSource.id, sha256: supplement.sha256, retrievedAt: supplement.retrievedAt }]);
	assert.equal(combined.source.documentLinks?.length, 4);
	for (const query of ["includeSupplements=yes", "includeSupplements=true&includeSupplements=false", "includeSupplements[]=true"]) assert.equal((await fetch(`${url}&${query}`)).status, 400);
});

test("ZIP previews attach statewide write-ins with correct record links, never other districts or local candidates", async () => {
	const lookup = { result: "resolved", inputKind: "zip", location: { state: "GA" }, districtMatches: [] } as unknown as LocationLookupResponse;
	await attachStateBallotPreview(lookup, repository());
	const preview = lookup.ballotContentPreviews![0]!;
	assert.equal(preview.candidateCount, 4);
	assert.deepEqual(preview.contests.flatMap(contest => contest.candidates.filter(candidate => candidate.sourceId).map(candidate => [candidate.id, candidate.sourceId])), [["fourth", supplementSource.id], ["fifth", supplementSource.id]]);
	assert.equal(preview.contests.some(contest => contest.scope !== "statewide"), false);
});
