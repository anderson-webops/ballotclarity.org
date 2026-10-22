import type { LocationDistrictMatch } from "../src/types/civic.js";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { serializeStateBallotSnapshots } from "../src/state-ballot-export.js";
import { fetchStateBallotSourceText } from "../src/state-ballot-fetch.js";
import { extractOregonBallots, reconcileOregonBallots } from "../src/state-ballot-oregon.js";
import { parseStateCandidateRecords } from "../src/state-ballot-records.js";
import { buildStateBallotPreview } from "../src/state-ballot-repository.js";
import { parseBundledStateSnapshot } from "../src/state-ballot-snapshot.js";
import { stateBallotSources } from "../src/state-ballot-sources.js";
import { createReviewedFixtureRepository, loadReviewedStateFixture, readReviewedStateFixture, readReviewedTransferFixture } from "./helpers/reviewed-state-fixtures.js";

const source = stateBallotSources.find(source => source.stateCode === "OR")!;
const body = readFileSync(new URL("./fixtures/state-ballots-oregon.json", import.meta.url), "utf8");
const bundled = readReviewedStateFixture("oregon-2026.json");

function fixture() {
	return JSON.parse(body) as { documents: Array<{ url: string; pageCount: number; electionHeader?: string; pages: Array<{ number: number; text: string }> }> };
}

test("Oregon reconciles the full official state statement and both county candidate reports without double-counting", () => {
	const extracted = extractOregonBallots(body);
	assert.equal(extracted.candidatePageCount, 24);
	assert.equal(extracted.claims.length, 338);
	assert.equal(extracted.contests.length, 153);
	assert.deepEqual([0, 1, 2].map(index => extracted.claims.filter(claim => claim.documentIndex === index).length), [183, 109, 46]);
	const records = parseStateCandidateRecords(source, body);
	assert.equal(records.length, 279);
	assert.deepEqual(Object.fromEntries(["statewide", "congressional", "state-senate", "state-house", "local"].map(scope => [scope, records.filter(record => record.scope === scope).length])), { "statewide": 7, "congressional": 14, "state-senate": 32, "state-house": 114, "local": 112 });
	assert.equal(new Set(records.filter(record => record.scope === "congressional").map(record => record.district)).size, 6);
	assert.equal(new Set(records.filter(record => record.scope === "state-house").map(record => record.district)).size, 60);
	assert.deepEqual([...new Set(records.filter(record => record.scope === "state-senate").map(record => Number(record.district)))], [3, 4, 6, 7, 8, 10, 11, 13, 15, 16, 17, 19, 20, 24, 26]);
	assert.ok(records.every(record => record.status === "listed" && !record.candidateUrl));
});

test("Oregon preserves fusion endorsements, source order and single-candidate general-election contests", () => {
	const result = reconcileOregonBallots(body);
	const records = parseStateCandidateRecords(source, body);
	assert.equal(records.filter(record => record.party?.includes(" / ")).length, 63);
	assert.equal(records.filter(record => record.name === "Jeff Merkley").length, 1);
	assert.equal(records.find(record => record.name === "Jeff Merkley")?.party, "Democrat / Working Families");
	assert.equal(records.find(record => record.name === "Chris Henry")?.party, "Progressive / Pacific Green");
	assert.equal(records.find(record => record.name === "James I Manning Jr")?.party, "Democrat / Independent / Working Families");
	assert.equal(records.find(record => record.name === "Floyd Prozanski")?.party, "Democrat / Republican");
	assert.equal(records.filter(record => record.office === "State Senator" && record.district === "4").length, 1);
	assert.ok(result.claims.some(claim => claim.documentIndex === 1 && claim.name === "Jeff Merkley" && claim.party === "Democrat, Working Families"));
	assert.equal(result.records.flatMap(record => record.claimIndexes).length, 338);
});

test("Oregon retains wrapped local positions, judicial incumbent designations and every printed RCV candidate", () => {
	const records = parseStateCandidateRecords(source, body);
	assert.equal(records.filter(record => record.ballotDesignation === "Incumbent").length, 4);
	const sonia = records.filter(record => record.name === "Sonia A Montalbano");
	assert.equal(sonia.length, 1);
	assert.equal(sonia[0]!.ballotDesignation, "Incumbent");
	assert.equal(sonia[0]!.jurisdiction, "Oregon Circuit Court District 4");
	assert.ok(records.every(record => !record.name.includes(" - Incumbent")));
	assert.equal(records.filter(record => record.office === "City of Portland, Councilor, District 3").length, 21);
	assert.equal(records.filter(record => record.office === "City of Portland, Councilor, District 4").length, 12);
	assert.equal(records.filter(record => record.office === "City of Lake Oswego, Councilor").length, 6);
	assert.equal(records.filter(record => record.office === "City of Fairview, Councilor, Position 6").length, 2);
	assert.ok(records.some(record => record.name === "Nicole Morrisey O'Donnell" && record.jurisdiction === "Multnomah County"));
	assert.ok(records.some(record => record.office.includes("At-Large, Position 2") && record.jurisdiction === "East Multnomah Soil and Water Conservation District"));
});

test("Oregon rejects incomplete or reordered documents, candidate pages, election dates and document identities", () => {
	for (const mutate of [
		(data: ReturnType<typeof fixture>) => { data.documents.pop(); },
		(data: ReturnType<typeof fixture>) => { data.documents.reverse(); },
		(data: ReturnType<typeof fixture>) => { data.documents[0]!.pages.pop(); },
		(data: ReturnType<typeof fixture>) => { data.documents[1]!.pageCount = 9; },
		(data: ReturnType<typeof fixture>) => { data.documents[2]!.pages[0]!.number = 2; },
		(data: ReturnType<typeof fixture>) => { data.documents[0]!.electionHeader = "SUBJECT: Official Ballot Statement for the Primary Election on May 19, 2026"; },
		(data: ReturnType<typeof fixture>) => { data.documents[0]!.pages[0]!.text = data.documents[0]!.pages[0]!.text.replace("September 3, 2026", "September 4, 2026"); },
		(data: ReturnType<typeof fixture>) => { data.documents[1]!.pages[0]!.text = data.documents[1]!.pages[0]!.text.replace("11/03/2026", "05/19/2026"); },
		(data: ReturnType<typeof fixture>) => { data.documents[1]!.pages[0]!.text = data.documents[1]!.pages[0]!.text.replace("9/22/2026", "9/23/2026"); },
	]) {
		const data = fixture();
		mutate(data);
		assert.throws(() => parseStateCandidateRecords(source, JSON.stringify(data)), /Oregon/u);
	}
});

test("Oregon fails closed on wrong printed counts, omitted candidates, unknown parties, placeholders and changed district types", () => {
	for (const mutate of [
		(data: ReturnType<typeof fixture>) => { data.documents[1]!.pages[0]!.text = data.documents[1]!.pages[0]!.text.replace(/Number Candidates Filed:\s*4/u, "Number Candidates Filed: 5"); },
		(data: ReturnType<typeof fixture>) => { data.documents[1]!.pages[0]!.text = data.documents[1]!.pages[0]!.text.replace(/Contest Total:\s*1/u, "Contest Total: 2"); },
		(data: ReturnType<typeof fixture>) => { data.documents[0]!.pages[0]!.text = data.documents[0]!.pages[0]!.text.split("\n").filter(line => !line.includes("David Brock Smith")).join("\n"); },
		(data: ReturnType<typeof fixture>) => { data.documents[0]!.pages[0]!.text = data.documents[0]!.pages[0]!.text.replace("Republican", "Unknown party"); },
		(data: ReturnType<typeof fixture>) => { data.documents[0]!.pages[0]!.text = data.documents[0]!.pages[0]!.text.replace("David Brock Smith", "No Candidate Filed"); },
		(data: ReturnType<typeof fixture>) => { data.documents[0]!.pages[0]!.text = data.documents[0]!.pages[0]!.text.replace("US Senator", "County Senator"); },
		(data: ReturnType<typeof fixture>) => { data.documents[0]!.pages[0]!.text = data.documents[0]!.pages[0]!.text.replace("1st District", "999th District"); },
		(data: ReturnType<typeof fixture>) => { data.documents[1]!.pages[0]!.text = data.documents[1]!.pages[0]!.text.replace("Senate District 16", "Senate District 17"); },
	]) {
		const data = fixture();
		mutate(data);
		assert.throws(() => parseStateCandidateRecords(source, JSON.stringify(data)), /Oregon/u);
	}
});

test("Oregon does not silently overwrite inconsistent state and county candidate claims", () => {
	for (const replacement of ["Different Nominee", "Jeff X Merkley"]) {
		const data = fixture();
		data.documents[1]!.pages[0]!.text = data.documents[1]!.pages[0]!.text.replace("Jeff Merkley", replacement);
		assert.throws(() => parseStateCandidateRecords(source, JSON.stringify(data)), /conflicting nominees/u);
	}
	const changed = fixture();
	changed.documents[0]!.pages[11]!.text = changed.documents[0]!.pages[11]!.text.replace(/Sonia A Montalbano[^\n]+Incumbent/u, "Sonia A Montalbano");
	assert.throws(() => parseStateCandidateRecords(source, JSON.stringify(changed)), /conflicting party or incumbent/u);
});

test("Oregon preview only adds verified legislative types, never similarly numbered court or local contests", async () => {
	const snapshot = loadReviewedStateFixture(source);
	const zip = buildStateBallotPreview(snapshot, { districtMatches: [] })!;
	assert.equal(zip.candidateCount, 7);
	assert.equal(zip.contestCount, 2);
	assert.equal(zip.measureCount, 0);
	assert.match(zip.disclaimer, /Dated snapshot/u);
	assert.match(zip.disclaimer, /State statement dated September 3, 2026; county reports dated September 22, 2026/u);
	assert.match(zip.disclaimer, /County-filed contests outside Multnomah County/u);
	assert.doesNotMatch(zip.disclaimer, /Filing does not establish/u);
	const districtMatches: LocationDistrictMatch[] = [
		{ id: "cd:3", districtCode: "3", districtType: "congressional", label: "Congressional 3", sourceSystem: "Controlled fixture" },
		{ id: "senate:24", districtCode: "24", districtType: "state-senate", label: "Senate 24", sourceSystem: "Controlled fixture" },
		{ id: "house:44", districtCode: "44", districtType: "state-house", label: "House 44", sourceSystem: "Controlled fixture" },
	];
	const address = buildStateBallotPreview(snapshot, { districtMatches })!;
	assert.equal(address.candidateCount, 12);
	assert.equal(address.contestCount, 5);
	assert.ok(address.contests.every(contest => !/Circuit|Attorney|City of|County|Water|PUD/u.test(contest.title)));
	const collision = buildStateBallotPreview(snapshot, { districtMatches: [{ ...districtMatches[2]!, districtCode: "4" }] })!;
	assert.ok(collision.contests.every(contest => !/Circuit|District Attorney|Councilor/u.test(contest.title)));
});

test("Oregon manual snapshot preserves all original document hashes and dates without public portal requests", async (context) => {
	const snapshot = parseBundledStateSnapshot(source, bundled);
	assert.equal(snapshot.documents?.length, 3);
	assert.deepEqual(snapshot.documents?.map(document => document.includedRecordCount), [183, 50, 46]);
	assert.equal(snapshot.retrievedAt, "2026-10-21T10:46:52.076Z");
	assert.equal(snapshot.sha256, "6cede035a37be83f6387c288000bf1b2adab56d817e40e21e99d1aa3a7dd914f");
	assert.deepEqual(snapshot.records, JSON.parse(JSON.stringify(parseStateCandidateRecords(source, body))));
	const changed = JSON.parse(bundled) as Record<string, unknown>;
	changed.retrievedAt = "2026-10-22T00:00:00Z";
	assert.throws(() => parseBundledStateSnapshot(source, JSON.stringify(changed)), /provenance/u);
	let now = Date.parse("2026-10-21T12:00:00Z");
	let requests = 0;
	const repository = (await createReviewedFixtureRepository(context, { now: () => now, fetchText: async () => {
		requests += 1;
		throw new Error("No external transport");
	} }));
	assert.equal((await repository.getSnapshot("OR"))?.retrievedAt, snapshot.retrievedAt);
	now += 5 * 60 * 60 * 1000;
	assert.equal((await repository.getSnapshot("OR"))?.retrievedAt, snapshot.retrievedAt);
	assert.equal(requests, 0);
	await assert.rejects(fetchStateBallotSourceText(source, async () => {
		requests += 1;
		return "";
	}), /automatic retrieval is disabled/u);
	assert.equal(requests, 0);
});

test("Oregon canonical candidate and source-claim transfers preserve exact accepted records and provenance", async () => {
	const snapshot = loadReviewedStateFixture(source);
	assert.equal(serializeStateBallotSnapshots([snapshot]), readReviewedTransferFixture("2026-11-03-oregon-candidates.jsonl"));
	const evidence = readReviewedTransferFixture("2026-11-03-oregon-ballot-claims.jsonl").trim().split("\n").map(line => JSON.parse(line) as Record<string, unknown>);
	const manifest = evidence.shift()!;
	assert.equal(manifest.claimCount, 338);
	assert.equal(manifest.candidateCount, 279);
	assert.equal(manifest.sourcePdfPageCount, 35);
	assert.equal(manifest.extractedCandidatePageCount, 24);
	assert.equal(manifest.sourceSha256, snapshot.sha256);
	const result = reconcileOregonBallots(body);
	const expected = new Map(result.records.flatMap((record, index) => record.claimIndexes.map(claim => [claim, snapshot.records[index]!.id] as const)));
	assert.equal(evidence.length, result.claims.length);
	for (const [index, claim] of result.claims.entries()) assert.deepEqual(evidence[index], { type: "ballot-candidate-claim", candidateId: expected.get(index), ...JSON.parse(JSON.stringify(claim)) });
});
