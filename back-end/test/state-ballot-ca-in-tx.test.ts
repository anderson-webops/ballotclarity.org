import type { LocationDistrictMatch } from "../src/types/civic.js";
import assert from "node:assert/strict";
import test from "node:test";
import { serializeStateBallotSnapshots } from "../src/state-ballot-export.js";
import { fetchStateBallotSourceText } from "../src/state-ballot-fetch.js";
import { parseStateCandidateRecords } from "../src/state-ballot-records.js";
import { buildStateBallotPreview } from "../src/state-ballot-repository.js";
import { parseBundledStateSnapshot } from "../src/state-ballot-snapshot.js";
import { stateBallotSources } from "../src/state-ballot-sources.js";
import { createReviewedFixtureRepository, readReviewedStateFixture, readReviewedTransferFixture } from "./helpers/reviewed-state-fixtures.js";

const expected = [
	{ state: "CA", file: "california", count: 388, statewide: 18, documents: 1 },
	{ state: "IN", file: "indiana", count: 320, statewide: 10, documents: 1 },
	{ state: "TX", file: "texas", count: 483, statewide: 57, documents: 2 },
];

function source(state: string) {
	const configured = stateBallotSources.find(item => item.stateCode === state);
	assert.ok(configured);
	return configured;
}

function body(file: string) {
	return readReviewedStateFixture(file);
}

function district(districtType: string, districtCode: string): LocationDistrictMatch {
	return { id: `${districtType}:${districtCode}`, districtType, districtCode, label: districtCode, sourceSystem: "Controlled geography fixture" };
}

test("California, Indiana and Texas snapshots retain source dates offline, including workbook provenance", async (context) => {
	let requests = 0;
	let now = Date.parse("2026-10-22T00:00:00Z");
	const repository = (await createReviewedFixtureRepository(context, {
		now: () => now,
		fetchText: async () => {
			requests += 1;
			throw new Error("No network permitted.");
		},
	}));
	for (const item of expected) {
		const snapshot = (await repository.getSnapshot(item.state))!;
		assert.ok(snapshot);
		assert.equal(snapshot.records.length, item.count);
		assert.equal(snapshot.documents?.length, item.documents);
		assert.equal(snapshot.documents?.reduce((total, document) => total + document.includedRecordCount, 0), item.count);
		assert.equal(snapshot.retrievedAt, JSON.parse(body(item.file)).retrievedAt);
		const preview = buildStateBallotPreview(snapshot, { districtMatches: [] });
		assert.equal(preview?.candidateCount, item.statewide);
		assert.match(preview!.disclaimer, /Dated snapshot/u);
		now += 5 * 60 * 60 * 1000;
		assert.equal((await repository.getSnapshot(item.state))?.retrievedAt, snapshot.retrievedAt);
		await assert.rejects(fetchStateBallotSourceText(source(item.state)), /manual|snapshot/iu);
		assert.throws(() => parseStateCandidateRecords(source(item.state), "unreviewed bytes"), /validated snapshot/u);
	}
	assert.equal(requests, 0);
	assert.equal(source("IN").format, "reviewed-xlsx");
});

test("California includes certified designations and individual retention questions without regional eligibility leakage", async (context) => {
	const snapshot = (await (await createReviewedFixtureRepository(context)).getSnapshot("CA"))!;
	const ordinary = snapshot.records.filter(record => record.ballotDesignation);
	assert.equal(ordinary.length, 324);
	assert.equal(ordinary.find(record => record.name === "Shirley N. Weber")?.ballotDesignation, "California Secretary of State");
	assert.ok(ordinary.every(record => !record.name.endsWith("*")));
	const retention = snapshot.records.filter(record => record.sourceStatus === "Certified judicial retention candidate");
	assert.equal(retention.length, 64);
	assert.equal(new Set(retention.map(record => record.office)).size, 64);
	assert.equal(retention.filter(record => record.scope === "statewide").length, 2);
	assert.ok(retention.filter(record => /Court of Appeal/u.test(record.office)).every(record => record.scope === "local"));
	assert.ok(snapshot.records.filter(record => /Equalization/u.test(record.office)).every(record => record.scope === "local"));
	assert.ok(snapshot.records.every(record => !/United States Senator/u.test(record.office)));
	const preview = buildStateBallotPreview(snapshot, { districtMatches: [district("congressional", "01"), district("state-senate", "02"), district("state-house", "04")] })!;
	assert.equal(preview.candidateCount, 23);
	assert.equal(preview.contests.flatMap(contest => contest.candidates).filter(candidate => candidate.ballotDesignation).length, 21);
	assert.equal(buildStateBallotPreview(snapshot, { districtMatches: [district("state-senate", "01")] })?.candidateCount, 18);
});

test("Indiana retains undated filings, declared write-ins and unknown affiliations while deduplicating identical export rows", async (context) => {
	const snapshot = (await (await createReviewedFixtureRepository(context)).getSnapshot("IN"))!;
	assert.equal(snapshot.records.filter(record => record.scope === "local").length, 49);
	assert.equal(snapshot.records.filter(record => record.status === "write-in").length, 19);
	assert.equal(snapshot.records.filter(record => !record.party).length, 21);
	const writeIn = snapshot.records.find(record => record.name === "Andrew Delano")!;
	assert.equal(writeIn.party, "National Socialist American Workers'");
	assert.equal(writeIn.sourceStatus, "Write-In (National Socialist American Workers')");
	assert.ok(snapshot.records.every(record => !record.party?.startsWith("Write-In")));
	assert.ok(snapshot.records.some(record => record.name === "Mark J Klosterkemper"));
	assert.equal(snapshot.records.filter(record => record.name === "Gegory (Max) Whaley" && record.office === "Dillsboro Town Council Member, District 1").length, 1);
	assert.equal(snapshot.records.filter(record => record.name === "Andrea S. Brown" && record.office === "Southwest Dubois County School Board, District 3").length, 1);
	const affiliationClaims = snapshot.records.filter(record => record.name === "Jenilee Haynes Peterson" && record.office === "Michigan City Area School Board, Civil City (LaPorte, Porter)");
	assert.deepEqual(affiliationClaims.map(record => record.party), [undefined, "Non Partisan"]);
	assert.ok(snapshot.records.every(record => ["filed", "write-in"].includes(record.status)));
	assert.equal(new Set(snapshot.records.filter(record => record.scope === "congressional").map(record => record.district)).size, 9);
	assert.equal(new Set(snapshot.records.filter(record => record.scope === "state-senate").map(record => record.district)).size, 25);
	assert.equal(new Set(snapshot.records.filter(record => record.scope === "state-house").map(record => record.district)).size, 100);
	const preview = buildStateBallotPreview(snapshot, { districtMatches: [district("congressional", "08")] })!;
	assert.equal(preview.candidateCount, 12);
	assert.match(preview.disclaimer, /Filing does not establish ballot qualification/u);
});

test("Texas deduplicates repeated county certifications without treating county judges or regional courts as statewide", async (context) => {
	const snapshot = (await (await createReviewedFixtureRepository(context)).getSnapshot("TX"))!;
	assert.equal(snapshot.records.filter(record => record.scope === "statewide").length, 57);
	assert.equal(snapshot.records.filter(record => record.scope === "state-senate").length, 31);
	assert.equal(snapshot.records.filter(record => record.scope === "state-house").length, 289);
	assert.equal(snapshot.records.filter(record => record.scope === "local").length, 20);
	assert.ok(snapshot.records.filter(record => record.office === "COUNTY JUDGE").every(record => record.scope === "local" && record.jurisdiction?.endsWith("County, Texas")));
	assert.ok(snapshot.records.filter(record => /15TH COURT OF APPEALS/u.test(record.office)).every(record => record.scope === "statewide"));
	assert.ok(snapshot.records.filter(record => /COURT OF APPEALS/u.test(record.office) && !/15TH COURT/u.test(record.office)).every(record => record.scope === "local"));
	assert.equal(snapshot.records.filter(record => record.office === "STATE SENATOR, DISTRICT 31").length, 2);
	assert.equal(snapshot.records.filter(record => record.status === "write-in").length, 17);
	assert.ok(snapshot.records.some(record => record.name === "Leslie Timmons" && record.district === "31" && record.office.includes("UNEXPIRED TERM") && record.scope === "local"));
	assert.ok(snapshot.records.some(record => record.name === "L.D. Howard" && record.status === "write-in" && record.scope === "state-house" && record.district === "124"));
	const preview = buildStateBallotPreview(snapshot, { districtMatches: [district("state-senate", "31")] })!;
	assert.equal(preview.candidateCount, 59);
	assert.match(preview.disclaimer, /Senate District 22 and House District 93 special-election candidates are not included/u);
});

test("workbook snapshots and optional ballot designations remain strictly validated", () => {
	const original = JSON.parse(body("indiana"));
	for (const mutate of [
		(data: typeof original) => { data.documents[0].url = "https://www.in.gov/wrong.xlsx"; },
		(data: typeof original) => { data.documents[0].sha256 = "f".repeat(64); },
		(data: typeof original) => { data.documents[0].includedRecordCount += 1; },
		(data: typeof original) => { data.documents = []; },
		(data: typeof original) => { data.records[0].ballotDesignation = { text: "Not a string" }; },
		(data: typeof original) => { data.records[0].ballotDesignation = "x".repeat(301); },
		(data: typeof original) => { data.records[0].email = "contact@example.test"; },
	]) {
		const data = structuredClone(original);
		mutate(data);
		assert.throws(() => parseBundledStateSnapshot(source("IN"), JSON.stringify(data)), /document|provenance|field|layout/u);
	}
});

test("the bounded California, Indiana and Texas regression transfer retains all fixture records and four source fingerprints", async (context) => {
	const repository = (await createReviewedFixtureRepository(context));
	const snapshots = await Promise.all(expected.map(async item => (await repository.getSnapshot(item.state))!));
	const exported = serializeStateBallotSnapshots(snapshots);
	assert.equal(exported, readReviewedTransferFixture("2026-11-03-ca-in-tx-candidates.jsonl"));
	const rows = exported.trim().split("\n").map(line => JSON.parse(line));
	assert.equal(rows.length, 1192);
	assert.equal(rows[0].states.flatMap((state: { documents: unknown[] }) => state.documents).length, 4);
	assert.equal(rows.filter(row => row.ballotDesignation).length, 324);
	assert.ok(rows.slice(1).every(row => row.electionDate === "2026-11-03" && !Object.keys(row).some(key => /address|email|phone|contact/iu.test(key))));
});
