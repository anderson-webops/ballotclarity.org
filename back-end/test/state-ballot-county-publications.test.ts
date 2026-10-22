import type { StateCandidateRecord } from "../src/state-ballot-records.js";
import type { LocationDistrictMatch } from "../src/types/civic.js";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { serializeStateBallotSnapshots } from "../src/state-ballot-export.js";
import { fetchStateBallotSourceText } from "../src/state-ballot-fetch.js";
import { parseStateCandidateRecords } from "../src/state-ballot-records.js";
import { buildStateBallotPreview } from "../src/state-ballot-repository.js";
import { parseBundledStateSnapshot } from "../src/state-ballot-snapshot.js";
import { stateBallotSources } from "../src/state-ballot-sources.js";
import { createReviewedFixtureRepository, readReviewedStateFixture, readReviewedTransferFixture } from "./helpers/reviewed-state-fixtures.js";

interface PublicationFixture {
	state: string;
	sourceUrl: string;
	documentUrl: string;
	documentSha256: string;
	retrievedAt: string;
	pages: number;
	rows: { name: string; party: string; office: string; page: number; writeIn?: boolean; termDate?: string; districtLabel?: string }[];
	records: StateCandidateRecord[];
	additionalDocuments?: { url: string; sha256: string; retrievedAt: string; includedRecordCount: number; evidence: { page: number; name: string; party: string; office: string; writeIn?: boolean }[] }[];
}

const fixtures = JSON.parse(readFileSync(new URL("./fixtures/state-ballots-county-publications.json", import.meta.url), "utf8")) as PublicationFixture[];
const expected = [{ state: "OH", file: "ohio", count: 78, statewide: 26 }, { state: "MA", file: "massachusetts", count: 32, statewide: 15 }];

function source(state: string) {
	const item = stateBallotSources.find(source => source.stateCode === state);
	assert.ok(item);
	return item;
}

function body(file: string) {
	return readReviewedStateFixture(file);
}

function district(districtType: string, districtCode: string): LocationDistrictMatch {
	return { id: `${districtType}:${districtCode}`, districtType, districtCode, label: districtCode, sourceSystem: "Controlled geography fixture" };
}

test("county publications load offline with original dated provenance and never silently refresh", async (context) => {
	let requests = 0;
	let now = Date.parse("2026-10-22T00:00:00Z");
	const repository = (await createReviewedFixtureRepository(context, {
		now: () => now,
		fetchText: async () => {
			requests += 1;
			throw new Error("No external request allowed.");
		},
	}));
	for (const item of expected) {
		const snapshot = (await repository.getSnapshot(item.state))!;
		const fixture = fixtures.find(fixture => fixture.state === item.state)!;
		assert.equal(snapshot.records.length, item.count);
		assert.equal(snapshot.retrievedAt, fixture.retrievedAt);
		const additional = fixture.additionalDocuments ?? [];
		assert.deepEqual(snapshot.documents, [{ url: fixture.documentUrl, sha256: fixture.documentSha256, retrievedAt: fixture.retrievedAt, includedRecordCount: item.count - additional.reduce((total, document) => total + document.includedRecordCount, 0) }, ...additional.map(({ url, sha256, retrievedAt, includedRecordCount }) => ({ url, sha256, retrievedAt, includedRecordCount }))]);
		const preview = buildStateBallotPreview(snapshot, { districtMatches: [] })!;
		assert.equal(preview.candidateCount, item.statewide);
		assert.equal(preview.generatedAt, fixture.retrievedAt);
		assert.match(preview.disclaimer, /Dated snapshot/u);
		assert.ok(preview.disclaimer.includes(source(item.state).scopeNotice!));
		now += 86_400_000;
		assert.equal((await repository.getSnapshot(item.state))?.retrievedAt, fixture.retrievedAt);
		await assert.rejects(fetchStateBallotSourceText(source(item.state)), /manual|snapshot/iu);
		assert.throws(() => parseStateCandidateRecords(source(item.state), "%PDF-"), /validated snapshot/u);
	}
	assert.equal(requests, 0);
});

test("all source rows reconcile with canonical records and retain independent stable identities", async (context) => {
	const repository = (await createReviewedFixtureRepository(context));
	assert.equal(fixtures.length, 2);
	for (const fixture of fixtures) {
		const snapshot = (await repository.getSnapshot(fixture.state))!;
		assert.deepEqual(snapshot.records, fixture.records);
		assert.equal(fixture.rows.length, fixture.records.length);
		assert.deepEqual(fixture.rows.map(row => row.name), fixture.records.map(record => record.name));
		const explicitEvidence = fixture.additionalDocuments?.flatMap(document => document.evidence) ?? [];
		assert.deepEqual(fixture.rows.map(row => (explicitEvidence.find(evidence => evidence.name === row.name)?.party ?? row.party) || undefined), fixture.records.map(record => record.party));
		for (const record of fixture.records) {
			const identity = [fixture.state, "2026-11-03", record.office.toLowerCase(), record.district, record.name.toLowerCase(), (record.party ?? "").toLowerCase()];
			if (record.jurisdiction) identity.push(record.jurisdiction.toLowerCase());
			assert.equal(record.id, createHash("sha256").update(JSON.stringify(identity)).digest("hex").slice(0, 24));
		}
		assert.equal(new Set(fixture.records.map(record => record.id)).size, fixture.records.length);
	}
	assert.deepEqual(fixtures.map(fixture => [fixture.state, fixture.pages, fixture.rows.filter(row => row.page === 1).length, fixture.rows.filter(row => row.page === 2).length]), [["OH", 2, 48, 30], ["MA", 3, 19, 13]]);
});

test("Ohio preserves eleven explicit write-ins, six governor tickets and uncertain source party labels", async (context) => {
	const snapshot = (await (await createReviewedFixtureRepository(context)).getSnapshot("OH"))!;
	assert.equal(snapshot.records.filter(record => record.status === "write-in").length, 11);
	const tickets = snapshot.records.filter(record => record.office === "GOVERNOR AND LIEUTENANT GOVERNOR");
	assert.equal(tickets.length, 6);
	assert.ok(tickets.every(record => record.name.includes(" and ")));
	assert.equal(tickets.filter(record => record.status === "write-in").length, 3);
	assert.ok(tickets.some(record => record.name === "Vivek Ramaswamy and Robert A. McColley"));
	assert.equal(snapshot.records.find(record => record.name === "Gary Josephson")?.status, "write-in");
	assert.equal(snapshot.records.find(record => record.name === "Gary Josephson")?.party, "N/A");
	assert.equal(snapshot.records.find(record => record.name === "Greg Levy")?.party, "Other-party");
	assert.equal(snapshot.records.find(record => record.name === "Cameron Koffel")?.party, "\"nonparty\"");
	assert.ok(snapshot.records.filter(record => record.office.startsWith("JUDGE OF THE COURT OF COMMON PLEAS")).every(record => record.party === undefined));
	assert.equal(snapshot.records.filter(record => record.candidateUrl).length, 26);
});

test("Ohio reconciles only explicit FWAB evidence while preserving the original blank and truncated cells", async (context) => {
	const fixture = fixtures.find(fixture => fixture.state === "OH")!;
	assert.equal(fixture.rows.filter(row => row.writeIn).length, 10);
	assert.equal(fixture.rows.find(row => row.name === "Gary Josephson")?.writeIn, false);
	assert.equal(fixture.rows.find(row => row.name === "Greg Levy")?.party, "Other-party c");
	assert.deepEqual(fixture.additionalDocuments?.[0].evidence.map(evidence => [evidence.name, evidence.page]), [["Greg Levy", 2], ["Gary Josephson", 3]]);
	const snapshot = (await (await createReviewedFixtureRepository(context)).getSnapshot("OH"))!;
	assert.deepEqual(snapshot.documents?.map(document => document.includedRecordCount), [76, 2]);
	assert.equal(snapshot.records.find(record => record.name === "Gary Josephson")?.sourceStatus, "Registered write-in in county FWAB notice");
	assert.ok(snapshot.records.some(record => record.name === "Eboney C. Eldridge" && record.status === "write-in"));
	assert.equal(snapshot.records.some(record => record.name === "Ebony C. Eldridge"), false);
});

test("Ohio judicial terms and the Senate special term remain separate contests rather than generic district matches", async (context) => {
	const snapshot = (await (await createReviewedFixtureRepository(context)).getSnapshot("OH"))!;
	const supreme = snapshot.records.filter(record => record.office.startsWith("JUSTICE OF THE SUPREME COURT"));
	assert.equal(supreme.length, 4);
	assert.equal(new Set(supreme.map(record => record.office)).size, 2);
	assert.ok(supreme.every(record => record.scope === "statewide" && /1-[12]-2027/u.test(record.office)));
	assert.ok(snapshot.records.filter(record => record.office.startsWith("U.S. SENATOR")).every(record => record.office.endsWith("(unexpired term ending 1-3-2029)")));
	const local = snapshot.records.filter(record => record.scope === "local");
	assert.equal(local.length, 13);
	assert.equal(local.filter(record => record.office.includes("COURT OF APPEALS")).length, 2);
	assert.equal(new Set(local.filter(record => record.office.includes("COMMON PLEAS")).map(record => record.office)).size, 7);
	assert.equal(buildStateBallotPreview(snapshot, { districtMatches: [district("congressional", "10"), district("state-senate", "10")] })?.candidateCount, 26);
});

test("Ohio previews add only explicitly matched Franklin-area legislative and congressional candidates", async (context) => {
	const snapshot = (await (await createReviewedFixtureRepository(context)).getSnapshot("OH"))!;
	assert.equal(buildStateBallotPreview(snapshot, { districtMatches: [district("congressional", "03")] })?.candidateCount, 28);
	assert.equal(buildStateBallotPreview(snapshot, { districtMatches: [district("congressional", "15")] })?.candidateCount, 31);
	assert.equal(buildStateBallotPreview(snapshot, { districtMatches: [district("congressional", "3"), district("state-senate", "03"), district("state-house", "01")] })?.candidateCount, 32);
	assert.match(buildStateBallotPreview(snapshot, { districtMatches: [] })!.disclaimer, /limited to Franklin County/u);
});

test("Massachusetts preserves named districts, council jurisdictions and printed joint-ticket labels without numeric guessing", async (context) => {
	const snapshot = (await (await createReviewedFixtureRepository(context)).getSnapshot("MA"))!;
	assert.equal(snapshot.records.filter(record => record.scope === "state-senate").length, 4);
	assert.equal(snapshot.records.filter(record => record.scope === "state-house").length, 6);
	assert.equal(snapshot.records.filter(record => record.scope === "local").length, 5);
	assert.ok(snapshot.records.some(record => record.name === "HEALEY AND DRISCOLL" && record.scope === "statewide"));
	assert.ok(snapshot.records.some(record => record.district === "MIDDLESEX & SUFFOLK"));
	assert.ok(snapshot.records.some(record => record.district === "SUFFOLK & MIDDLESEX"));
	assert.equal(buildStateBallotPreview(snapshot, { districtMatches: [district("state-house", "24"), district("state-senate", "2"), district("congressional", "3")] })?.candidateCount, 15);
	assert.equal(buildStateBallotPreview(snapshot, { districtMatches: [district("congressional", "7"), district("state-senate", "Suffolk & Middlesex"), district("state-house", "Twenty-Fifth Middlesex")] })?.candidateCount, 19);
	assert.ok(snapshot.records.filter(record => record.scope === "local").every(record => record.jurisdiction?.startsWith("Massachusetts, ")));
});

test("county snapshot validation rejects altered document provenance, duplicate identities and contact fields", () => {
	const configured = source("OH");
	const original = JSON.parse(body("ohio"));
	for (const change of [
		(data: typeof original) => { data.documents[0].url = "https://example.test/list.pdf"; },
		(data: typeof original) => { data.documents[0].sha256 = "a".repeat(64); },
		(data: typeof original) => { data.documents[0].includedRecordCount += 1; },
		(data: typeof original) => { data.retrievedAt = "2026-10-23T00:00:00.000Z"; },
		(data: typeof original) => { data.records[0].email = "private@example.test"; },
		(data: typeof original) => { data.records[1].id = data.records[0].id; },
	]) {
		const altered = structuredClone(original);
		change(altered);
		assert.throws(() => parseBundledStateSnapshot(configured, JSON.stringify(altered)), /document|provenance|layout|identit/iu);
	}
	assert.throws(() => parseBundledStateSnapshot(source("MA"), body("ohio")), /configured source/u);
});

test("the county publication transfer contains all 110 candidates and exact original source evidence without contact data", async (context) => {
	const repository = (await createReviewedFixtureRepository(context));
	const snapshots = await Promise.all(expected.map(async item => (await repository.getSnapshot(item.state))!));
	const exported = serializeStateBallotSnapshots(snapshots);
	assert.equal(exported, readReviewedTransferFixture("2026-11-03-oh-ma-candidates.jsonl"));
	const rows = exported.trim().split("\n").map(line => JSON.parse(line));
	assert.equal(rows.length, 111);
	assert.equal(rows[0].states.length, 2);
	assert.ok(rows.slice(1).every(row => row.electionDate === "2026-11-03" && !Object.keys(row).some(key => /address|email|phone|contact/iu.test(key))));
	assert.ok(rows.slice(1).every(row => !/Sauk|greenlakecountywi/iu.test(JSON.stringify(row))));
});
