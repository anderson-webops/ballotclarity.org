import type { LocationDistrictMatch } from "../src/types/civic.js";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { serializeStateBallotSnapshots } from "../src/state-ballot-export.js";
import { fetchStateBallotSourceText } from "../src/state-ballot-fetch.js";
import { parseStateCandidateRecords } from "../src/state-ballot-records.js";
import { buildStateBallotPreview } from "../src/state-ballot-repository.js";
import { parseBundledStateSnapshot } from "../src/state-ballot-snapshot.js";
import { stateBallotSources } from "../src/state-ballot-sources.js";
import { createReviewedFixtureRepository, readReviewedStateFixture, readReviewedTransferFixture } from "./helpers/reviewed-state-fixtures.js";

const expected = [
	{ state: "MO", file: "missouri", count: 425, statewide: 4, documents: 1 },
	{ state: "NE", file: "nebraska", count: 141, statewide: 21, documents: 2 },
	{ state: "DC", file: "district-of-columbia", count: 90, statewide: 33, documents: 3 },
	{ state: "NJ", file: "new-jersey", count: 39, statewide: 4, documents: 3 },
	{ state: "AL", file: "alabama", count: 300, statewide: 27, documents: 4 },
];

function source(state: string) {
	const item = stateBallotSources.find(item => item.stateCode === state);
	assert.ok(item);
	return item;
}

function body(file: string) {
	return readReviewedStateFixture(file);
}

function district(districtType: string, districtCode: string): LocationDistrictMatch {
	return { id: `${districtType}:${districtCode}`, districtType, districtCode, label: districtCode, sourceSystem: "Controlled geography fixture" };
}

test("reviewed PDF datasets load offline, retain each capture, and survive cache expiry without relabeling", async (context) => {
	let requests = 0;
	let now = Date.parse("2026-10-22T00:00:00Z");
	const repository = (await createReviewedFixtureRepository(context, {
		now: () => now,
		fetchText: async () => {
			requests += 1;
			throw new Error("No retrieval permitted.");
		},
	}));
	for (const item of expected) {
		const snapshot = await repository.getSnapshot(item.state);
		assert.ok(snapshot);
		assert.equal(snapshot.records.length, item.count);
		assert.equal(snapshot.documents?.length, item.documents);
		assert.equal(snapshot.documents?.reduce((total, document) => total + document.includedRecordCount, 0), item.count);
		assert.equal(snapshot.retrievedAt, JSON.parse(body(item.file)).retrievedAt);
		const preview = buildStateBallotPreview(snapshot, { districtMatches: [] });
		assert.equal(preview?.candidateCount, item.statewide);
		assert.equal(preview?.generatedAt, snapshot.retrievedAt);
		assert.match(preview!.disclaimer, /Dated snapshot/u);
		now += 60 * 60 * 1000;
		assert.equal((await repository.getSnapshot(item.state))?.retrievedAt, snapshot.retrievedAt);
		await assert.rejects(fetchStateBallotSourceText(source(item.state)), /manual|snapshot/iu);
		assert.throws(() => parseStateCandidateRecords(source(item.state), "%PDF-"), /validated snapshot/u);
	}
	assert.equal(requests, 0);
});

test("reviewed PDF provenance rejects changed document URLs, fingerprints, counts, dates and extra contact fields", () => {
	const configured = source("NE");
	const original = JSON.parse(body("nebraska"));
	for (const change of [
		(data: typeof original) => { data.documents[0].url = "https://other.example.org/list.pdf"; },
		(data: typeof original) => { data.documents[0].sha256 = "a".repeat(64); },
		(data: typeof original) => { data.documents[0].includedRecordCount += 1; },
		(data: typeof original) => { data.documents[0].retrievedAt = "invalid"; },
		(data: typeof original) => { data.retrievedAt = "2026-10-23T00:00:00.000Z"; },
		(data: typeof original) => { data.documents[0].email = "private@example.test"; },
		(data: typeof original) => { data.documents.pop(); },
	]) {
		const changed = structuredClone(original);
		change(changed);
		assert.throws(() => parseBundledStateSnapshot(configured, JSON.stringify(changed)), /document|provenance/u);
	}
	assert.throws(() => parseBundledStateSnapshot(source("MO"), body("nebraska")), /configured source/u);
});

test("Missouri and Nebraska retention questions remain individual, with regional judicial eligibility withheld", async (context) => {
	const repository = (await createReviewedFixtureRepository(context));
	const missouri = (await repository.getSnapshot("MO"))!;
	const retention = missouri.records.filter(record => record.sourceStatus === "Certified judicial retention candidate");
	assert.equal(retention.length, 50);
	assert.equal(new Set(retention.map(record => record.office)).size, 50);
	assert.equal(retention.filter(record => record.scope === "statewide").length, 1);
	assert.ok(retention.filter(record => /Court of Appeals/u.test(record.office)).every(record => record.scope === "local"));
	const nebraska = (await repository.getSnapshot("NE"))!;
	const judges = nebraska.records.filter(record => record.status === "filed");
	assert.equal(judges.length, 48);
	assert.equal(new Set(judges.map(record => record.office)).size, 48);
	assert.ok(judges.every(record => /^Shall Judge .+ be retained in office\?$/u.test(record.office)));
	assert.equal(judges.filter(record => record.scope === "statewide").length, 2);
	assert.equal(buildStateBallotPreview(nebraska, { districtMatches: [district("state-senate", "2")] })?.candidateCount, 23);
	assert.equal(buildStateBallotPreview(nebraska, { districtMatches: [district("state-house", "2")] })?.candidateCount, 21);
});

test("DC preserves ANC withdrawals and write-ins without confusing wards or shadow representation", async (context) => {
	const snapshot = (await (await createReviewedFixtureRepository(context)).getSnapshot("DC"))!;
	const withdrawn = snapshot.records.filter(record => record.status === "withdrawn");
	assert.deepEqual(withdrawn.map(record => [record.name, record.district, record.sourceStatus]), [
		["Aleria Elyse Butler", "2E01", "Withdrew 10/5/26"],
		["Julian Hunt", "6D06", "Withdrew 10/13/26"],
	]);
	assert.equal(snapshot.records.filter(record => record.status === "write-in").length, 44);
	assert.ok(snapshot.records.filter(record => /shadow delegation/u.test(record.office)).every(record => record.scope === "statewide"));
	assert.ok(snapshot.records.filter(record => /Ward |Neighborhood/u.test(record.office)).every(record => record.scope === "local"));
	const preview = buildStateBallotPreview(snapshot, { districtMatches: [district("state-house", "1")] });
	assert.equal(preview?.candidateCount, 33);
	assert.match(preview!.disclaimer, /U\.S\. citizenship/u);
});

test("New Jersey reconciles amended congressional nominees without importing other election dates", async (context) => {
	const snapshot = (await (await createReviewedFixtureRepository(context)).getSnapshot("NJ"))!;
	assert.equal(snapshot.records.filter(record => record.scope === "statewide").length, 4);
	assert.equal(snapshot.records.filter(record => record.scope === "congressional").length, 35);
	assert.deepEqual(snapshot.records.filter(record => record.district === "7").map(record => record.name), ["THOMAS H. KEAN JR.", "REBECCA BENNETT", "SEAMUS PATRICK O'TOOLE"]);
	const preview = buildStateBallotPreview(snapshot, { districtMatches: [district("congressional", "07")] });
	assert.equal(preview?.candidateCount, 7);
	assert.match(preview!.disclaimer, /Federal candidates only/u);
});

test("Alabama includes current certifications, keeps places separate and excludes party committee elections", async (context) => {
	const snapshot = (await (await createReviewedFixtureRepository(context)).getSnapshot("AL"))!;
	assert.equal(snapshot.records.filter(record => record.party === "Democratic").length, 114);
	assert.equal(snapshot.records.filter(record => record.party === "Republican").length, 180);
	assert.equal(snapshot.records.filter(record => record.party === "Independent").length, 6);
	assert.ok(snapshot.records.some(record => record.name === "Allen Treadaway" && record.scope === "state-house" && record.district === "51"));
	assert.ok(snapshot.records.some(record => record.name === "Will Barfoot" && record.scope === "state-senate" && record.district === "25"));
	assert.ok(snapshot.records.some(record => record.name === "Rhett Marques" && record.scope === "congressional" && record.district === "2"));
	assert.ok(snapshot.records.some(record => record.name === "Donald J. Mottern" && record.district === "11"));
	assert.ok(snapshot.records.some(record => record.name === "Linda Braye Bulls" && record.office === "District Court Judge, Macon County, Place 1"));
	assert.ok(snapshot.records.every(record => !/Executive Committee/u.test(record.office)));
	assert.equal(buildStateBallotPreview(snapshot, { districtMatches: [district("state-house", "7")] })?.candidateCount, 30);
	assert.equal(buildStateBallotPreview(snapshot, { districtMatches: [district("state-senate", "25")] })?.candidateCount, 29);
	assert.match(buildStateBallotPreview(snapshot, { districtMatches: [] })!.disclaimer, /printed ballots/u);
});

test("the bounded reviewed PDF regression transfer preserves fixture records and per-document provenance", async (context) => {
	const repository = (await createReviewedFixtureRepository(context));
	const snapshots = await Promise.all(expected.map(async item => (await repository.getSnapshot(item.state))!));
	const exported = serializeStateBallotSnapshots(snapshots);
	const saved = readReviewedTransferFixture("2026-11-03-reviewed-pdf-candidates.jsonl");
	assert.equal(exported, saved);
	const rows = exported.trim().split("\n").map(line => JSON.parse(line));
	assert.equal(rows.length, 996);
	assert.equal(rows[0].states.flatMap((state: { documents: unknown[] }) => state.documents).length, 13);
	assert.ok(rows.slice(1).every(row => row.electionDate === "2026-11-03" && !Object.keys(row).some(key => /address|email|phone|contact/iu.test(key))));
	const contract = JSON.parse(readFileSync(new URL("../../deploy/runtime-artifact-contract.json", import.meta.url), "utf8"));
	for (const item of expected) {
		assert.equal(contract.services.find((service: { name: string }) => service.name === "backend").requiredPaths.includes(`back-end/dist/data/state-ballots/${item.file}-2026.json`), false);
	}
});
