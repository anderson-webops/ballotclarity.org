import type { LocationDistrictMatch } from "../src/types/civic.js";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { extractConnecticutBallots, reconcileConnecticutBallots } from "../src/state-ballot-connecticut.js";
import { serializeStateBallotSnapshots } from "../src/state-ballot-export.js";
import { fetchStateBallotSourceText } from "../src/state-ballot-fetch.js";
import { parseStateCandidateRecords } from "../src/state-ballot-records.js";
import { buildStateBallotPreview } from "../src/state-ballot-repository.js";
import { parseBundledStateSnapshot } from "../src/state-ballot-snapshot.js";
import { stateBallotSources } from "../src/state-ballot-sources.js";
import { createReviewedFixtureRepository, loadReviewedStateFixture, readReviewedStateFixture, readReviewedTransferFixture } from "./helpers/reviewed-state-fixtures.js";

const source = stateBallotSources.find(source => source.stateCode === "CT")!;
const body = readFileSync(new URL("./fixtures/state-ballots-connecticut.json", import.meta.url), "utf8");
const bundled = readReviewedStateFixture("connecticut-2026.json");

function fixture() {
	return JSON.parse(body) as { documents: Array<{ url: string; town: string; pageCount: number; pages: Array<{ number: number; width: number; height: number; headerText: string; cells: Array<{ bounds: number[]; text: string; logicalText: string; tags: Array<{ text: string; top: number; bottom: number }> }> }> }> };
}

test("Connecticut reconciles every published document and page without counting blank write-in slots or page frames", () => {
	assert.equal(source.documentUrls?.length, 134);
	const result = extractConnecticutBallots(body);
	assert.equal(result.pageCount, 509);
	assert.equal(result.claims.length, 15517);
	assert.equal(result.blankPositions, 5033);
	assert.equal(result.questions.length, 103);
	assert.ok(result.questions.every(question => !question.text.includes("Sample Ballot") && !question.text.includes("Marshall-Nealy")));
	assert.equal(result.claims.filter(claim => !claim.votingDistrict).length, 1435);
	const records = parseStateCandidateRecords(source, body);
	assert.equal(records.length, 709);
	assert.deepEqual(Object.fromEntries(["statewide", "congressional", "state-senate", "state-house", "local"].map(scope => [scope, records.filter(record => record.scope === scope).length])), { "statewide": 10, "congressional": 13, "state-senate": 70, "state-house": 246, "local": 370 });
	assert.equal(new Set(records.filter(record => record.scope === "state-house").map(record => record.district)).size, 139);
	assert.equal(new Set(records.filter(record => record.scope === "state-senate").map(record => record.district)).size, 36);
	assert.equal(new Set(records.filter(record => record.scope === "congressional").map(record => record.district)).size, 5);
	assert.ok(records.every(record => record.status === "listed" && record.sourceStatus === "Printed sample ballot" && !record.candidateUrl));
});

test("Connecticut accepts an explicitly configured document set without weakening the reviewed default set", () => {
	const document = fixture().documents[0]!;
	const data = JSON.stringify({ documents: [document] });
	const configuration = { electionDate: "2026-11-03", documents: [{ town: document.town, url: document.url, pageCount: document.pages.length }] };
	assert.throws(() => reconcileConnecticutBallots(data), /document set/u);
	const result = reconcileConnecticutBallots(data, configuration);
	assert.equal(result.pageCount, 1);
	assert.ok(result.records.length > 10);
	assert.ok(result.claims.every(claim => claim.town === "Andover"));
	for (const invalid of [
		{ ...configuration, electionDate: "2026-11-04" },
		{ ...configuration, documents: [] },
		{ ...configuration, documents: [...configuration.documents, ...configuration.documents] },
		{ ...configuration, documents: [{ ...configuration.documents[0]!, url: "https://example.com/ballot.pdf" }] },
		{ ...configuration, documents: [{ ...configuration.documents[0]!, pageCount: 51 }] },
	]) assert.throws(() => reconcileConnecticutBallots(data, invalid), /Connecticut/u);
});

test("Connecticut extraction binds future same-layout ballots to their explicit year, town and documents", () => {
	const document = fixture().documents[0]!;
	document.url = document.url.replace("/2026/", "/2030/");
	document.pages[0]!.headerText = document.pages[0]!.headerText.replace("November 3, 2026", "November 5, 2030");
	const configuration = { electionDate: "2030-11-05", documents: [{ town: document.town, url: document.url, pageCount: document.pages.length }] };
	const data = JSON.stringify({ documents: [document] });
	assert.ok(reconcileConnecticutBallots(data, configuration).records.length > 10);
	assert.throws(() => reconcileConnecticutBallots(data, { ...configuration, electionDate: "2026-11-03" }), /Connecticut/u);
	assert.throws(() => reconcileConnecticutBallots(data, { ...configuration, documents: [{ ...configuration.documents[0]!, town: "Manchester" }] }), /Connecticut/u);
});

test("Connecticut leaves an unlabelled minor-party row unspecified instead of guessing affiliation", () => {
	const data = fixture();
	const page = data.documents[0]!.pages[0]!;
	const row = page.cells.find(cell => cell.text.includes("Independent"))!;
	row.text = "";
	row.logicalText = "";
	const claims = extractConnecticutBallots(JSON.stringify(data)).claims;
	assert.ok(claims.some(claim => claim.documentIndex === 0 && claim.name === "Ryan Fazio and Matt Corey" && claim.party === ""));
	assert.equal(claims.some(claim => claim.documentIndex === 0 && claim.party === "Nonpartisan"), false);
	row.logicalText = "Unrecognized party";
	assert.throws(() => extractConnecticutBallots(JSON.stringify(data)), /party label/u);
	row.text = "United Community Party";
	row.logicalText = "United Community Party";
	assert.ok(extractConnecticutBallots(JSON.stringify(data)).claims.some(claim => claim.documentIndex === 0 && claim.party === "United Community"));
});

test("Connecticut reconciles reviewed town-scoped spelling and district-scoped suffix variants without changing raw claims", () => {
	const document = fixture().documents[0]!;
	document.town = "Morris";
	document.url = document.url.replace("andover_sample_ada", "morris_sample");
	document.pages[0]!.headerText = document.pages[0]!.headerText.replace("Andover", "Morris");
	const attorneyGeneral = document.pages[0]!.cells.find(cell => cell.text.startsWith("8A") && cell.text.includes("Tong"))!;
	attorneyGeneral.text = attorneyGeneral.text.replace("William", "Willian");
	const configuration = { electionDate: "2026-11-03", documents: [{ town: document.town, url: document.url, pageCount: 1 }] };
	const result = reconcileConnecticutBallots(JSON.stringify({ documents: [document] }), configuration);
	assert.ok(result.claims.some(claim => claim.name === "Willian Tong"));
	assert.equal(result.records.some(record => record.value.name === "Willian Tong"), false);
	assert.ok(result.records.some(record => record.value.name === "William Tong"));
	const data = fixture();
	for (const source of data.documents) {
		for (const page of source.pages) {
			for (const cell of page.cells) cell.text = cell.text.replace("Ferrucci,", "Ferrucci");
		}
	}
	const suffix = reconcileConnecticutBallots(JSON.stringify(data));
	assert.ok(suffix.claims.some(claim => claim.name === "Stephen R. Ferrucci III"));
	assert.ok(suffix.records.some(record => record.value.name === "Stephen R. Ferrucci, III"));
	assert.equal(suffix.records.length, 709);
});

test("Connecticut retains explicitly unassigned district evidence without attaching it to a guessed district or candidacy", () => {
	const document = fixture().documents[0]!;
	document.pages[0]!.headerText = document.pages[0]!.headerText.split("\n").filter(line => !/Congressional District|Senatorial District|Assembly District/u.test(line)).join("\n");
	const body = JSON.stringify({ documents: [document] });
	const configuration = { electionDate: "2026-11-03", documents: [{ town: document.town, url: document.url, pageCount: 1 }] };
	assert.throws(() => reconcileConnecticutBallots(body, configuration), /legislative districts/u);
	const result = reconcileConnecticutBallots(body, { ...configuration, retainUnassignedDistrictClaims: true });
	assert.ok(result.unassignedClaimIndexes.length > 0);
	assert.ok(result.records.every(record => ["statewide", "local"].includes(record.value.scope!)));
	assert.ok(result.unassignedClaimIndexes.every(index => result.claims[index]!.district === ""));
	assert.equal(result.records.flatMap(record => record.claimIndexes).length + result.unassignedClaimIndexes.length, result.claims.length);
	document.pages[0]!.headerText += "\nAssembly District 55";
	assert.throws(() => reconcileConnecticutBallots(JSON.stringify({ documents: [document] }), { ...configuration, retainUnassignedDistrictClaims: true }), /legislative districts/u);
});

test("Connecticut derives parties from physical rows even when the printed slot letter is wrong", () => {
	const result = extractConnecticutBallots(body);
	const labriola = result.claims.filter(claim => claim.town === "Bethlehem" && claim.name === "David Labriola");
	assert.equal(labriola.length, 2);
	assert.ok(labriola.every(claim => claim.position === "9A" && claim.party === "Republican" && claim.office === "Judge of Probate"));
	assert.ok(result.claims.some(claim => claim.town === "Bridgeport" && claim.party === "New Movement"));
	assert.ok(result.claims.some(claim => claim.town === "Darien" && claim.party === "Nonpartisan" && claim.office === "Representative Town Meeting"));
	assert.ok(result.claims.some(claim => claim.name === "Jennifer A. Marshall-Nealy"));
	assert.ok(result.claims.filter(claim => claim.town === "Avon" && claim.office === "Secretary of the State" && claim.party !== "Republican").every(claim => claim.name === "Stephanie Thomas"));
	assert.ok(result.claims.some(claim => claim.town === "Middlefield" && claim.name === "Anne Malcolm"));
});

test("Connecticut coalesces fusion endorsements and scoped printed-name variants without splitting joint tickets", () => {
	const result = reconcileConnecticutBallots(body);
	const records = result.records.map(record => record.value);
	assert.equal(records.filter(record => record.party.includes(" / ")).length, 168);
	assert.equal(records.filter(record => record.office === "Governor and Lieutenant Governor").length, 2);
	assert.ok(records.some(record => record.name === "Ned Lamont and Susan Bysiewicz" && record.party === "Democratic / Working Families"));
	assert.ok(records.some(record => record.name === "Ryan Fazio and Matt Corey" && record.party === "Republican / Independent"));
	assert.equal(records.filter(record => record.office === "Representative in Congress" && record.district === "3" && /DeLauro/u.test(record.name)).length, 1);
	assert.ok(records.some(record => record.name === "James Jimmy Sánchez" && record.district === "6"));
	assert.ok(result.claims.some(claim => claim.name === "James Jimmy Sanchez"));
	assert.ok(result.claims.some(claim => claim.name === "Rosa DeLauro"));
	assert.equal(result.records.flatMap(record => record.claimIndexes).length, 15517);
});

test("Connecticut keeps translated, wrapped, named and missing voting areas as printed context rather than legal geography", () => {
	const claims = extractConnecticutBallots(body).claims;
	assert.ok(claims.some(claim => claim.town === "New Haven" && claim.votingDistrict === "2-2, 3-2, 21-1, 22-1, 28, 29, 30"));
	assert.ok(claims.some(claim => claim.town === "Norwalk" && claim.votingDistrict === "137A"));
	assert.ok(claims.some(claim => claim.town === "Windham" && claim.votingDistrict === "4 Wind Elks"));
	assert.ok(claims.some(claim => claim.town === "Windsor Locks" && claim.votingDistrict === "One"));
	assert.ok(claims.some(claim => claim.town === "New Canaan" && claim.votingDistrict === "1" && claim.district === "125"));
	assert.ok(claims.some(claim => claim.town === "Westbrook"));
	assert.ok(claims.filter(claim => claim.office === "Representative Town Meeting").every(claim => claim.jurisdiction?.startsWith(`${claim.town}; ballot voting district `)));
});

test("Connecticut rejects incomplete documents, wrong town or election, and changed legislative headers", () => {
	for (const mutate of [
		(data: ReturnType<typeof fixture>) => { data.documents.pop(); },
		(data: ReturnType<typeof fixture>) => { data.documents.reverse(); },
		(data: ReturnType<typeof fixture>) => { data.documents[0]!.pages.pop(); },
		(data: ReturnType<typeof fixture>) => { data.documents[0]!.pages[0]!.number = 2; },
		(data: ReturnType<typeof fixture>) => { data.documents[0]!.pages[0]!.headerText = data.documents[0]!.pages[0]!.headerText.replace("November 3, 2026", "November 5, 2024"); },
		(data: ReturnType<typeof fixture>) => { data.documents[0]!.pages[0]!.headerText = data.documents[0]!.pages[0]!.headerText.replaceAll("Andover", "Manchester"); },
		(data: ReturnType<typeof fixture>) => { data.documents[0]!.pages[0]!.headerText += "\nAssembly District 151"; },
		(data: ReturnType<typeof fixture>) => { data.documents[0]!.pages[0]!.headerText = data.documents[0]!.pages[0]!.headerText.replace(/Assembly District \d+/u, "Assembly District 999"); },
	]) {
		const data = fixture();
		mutate(data);
		assert.throws(() => parseStateCandidateRecords(source, JSON.stringify(data)), /Connecticut/u);
	}
});

test("Connecticut fails closed on unknown office, party, unsafe geometry, missing markers and contradictory nominees", () => {
	for (const mutate of [
		(data: ReturnType<typeof fixture>) => { data.documents[0]!.pages[0]!.cells[0]!.bounds[0] = -1; },
		(data: ReturnType<typeof fixture>) => {
			data.documents[0]!.pages[0]!.cells.find(cell => cell.text.includes("Democratic"))!.text = "Unknown party";
			data.documents[0]!.pages[0]!.cells.find(cell => cell.logicalText.includes("Democratic"))!.logicalText = "Unknown party";
		},
		(data: ReturnType<typeof fixture>) => { data.documents[0]!.pages[0]!.cells.find(cell => cell.text.includes("Democratic"))!.logicalText = "Republican Party"; },
		(data: ReturnType<typeof fixture>) => { data.documents[0]!.pages[0]!.cells.find(cell => cell.text.includes("Governor") && cell.text.includes("Vote"))!.text = "Unknown office"; },
		(data: ReturnType<typeof fixture>) => { data.documents[0]!.pages[0]!.cells.find(cell => cell.text.includes("Ned Lamont"))!.tags = []; },
		(data: ReturnType<typeof fixture>) => {
			const cell = data.documents[0]!.pages[0]!.cells.find(cell => cell.text.includes("Ned Lamont"))!;
			cell.tags[0]!.bottom = 10000;
		},
		(data: ReturnType<typeof fixture>) => {
			const cell = data.documents[0]!.pages[0]!.cells.find(cell => cell.text.includes("Ned Lamont"))!;
			cell.text = cell.text.replace("Ned Lamont", "Different Nominee");
		},
	]) {
		const data = fixture();
		mutate(data);
		assert.throws(() => parseStateCandidateRecords(source, JSON.stringify(data)), /Connecticut/u);
	}
});

test("Connecticut preview uses only statewide and explicitly matched legislative contests, never local numeric collisions", async () => {
	const snapshot = loadReviewedStateFixture(source);
	const zip = buildStateBallotPreview(snapshot, { districtMatches: [] })!;
	assert.equal(zip.candidateCount, 10);
	assert.equal(zip.contestCount, 5);
	assert.equal(zip.measureCount, 0);
	assert.match(zip.disclaimer, /Dated snapshot/u);
	assert.match(zip.disclaimer, /towns, legislative districts and declared write-ins/u);
	assert.doesNotMatch(zip.disclaimer, /Filing does not establish/u);
	const districtMatches: LocationDistrictMatch[] = [
		{ id: "cd:3", districtCode: "3", districtType: "congressional", label: "Congressional 3", sourceSystem: "Controlled fixture" },
		{ id: "senate:10", districtCode: "10", districtType: "state-senate", label: "Senate 10", sourceSystem: "Controlled fixture" },
		{ id: "house:93", districtCode: "93", districtType: "state-house", label: "House 93", sourceSystem: "Controlled fixture" },
	];
	const address = buildStateBallotPreview(snapshot, { districtMatches })!;
	assert.equal(address.contestCount, 8);
	assert.ok(address.candidateCount > 10);
	assert.ok(address.contests.every(contest => !/Probate|Registrar|Education|Town Meeting/u.test(contest.title)));
	const missing = buildStateBallotPreview(snapshot, { districtMatches: [{ ...districtMatches[2]!, districtCode: "14" }] })!;
	assert.equal(missing.candidateCount, 10);
	assert.equal(missing.contestCount, 5);
});

test("Connecticut manual snapshot retains all original document provenance and rejects altered or incomplete capture sets", async (context) => {
	const snapshot = parseBundledStateSnapshot(source, bundled);
	assert.equal(snapshot.documents?.length, 134);
	assert.equal(snapshot.records.length, 709);
	assert.equal(snapshot.retrievedAt, "2026-10-21T08:53:53.950Z");
	assert.equal(snapshot.sha256, "b44cbe36eb53a434092303151287487593b438e75722e6459740ccc7824f365a");
	assert.equal(snapshot.documents?.reduce((total, document) => total + document.includedRecordCount, 0), 709);
	assert.deepEqual(snapshot.records, JSON.parse(JSON.stringify(parseStateCandidateRecords(source, body))));
	for (const mutate of [
		(data: Record<string, unknown>) => { (data.documents as unknown[]).pop(); },
		(data: Record<string, unknown>) => { (data.documents as unknown[]).reverse(); },
		(data: Record<string, unknown>) => { data.sourceSha256 = "a".repeat(64); },
		(data: Record<string, unknown>) => { data.retrievedAt = "2026-10-22T00:00:00Z"; },
	]) {
		const data = JSON.parse(bundled) as Record<string, unknown>;
		mutate(data);
		assert.throws(() => parseBundledStateSnapshot(source, JSON.stringify(data)), /snapshot|provenance/u);
	}
	let now = Date.parse("2026-10-21T12:00:00Z");
	let requests = 0;
	const repository = (await createReviewedFixtureRepository(context, { now: () => now, fetchText: async () => {
		requests += 1;
		throw new Error("No transport");
	} }));
	assert.equal((await repository.getSnapshot("CT"))?.retrievedAt, snapshot.retrievedAt);
	now += 5 * 60 * 60 * 1000;
	assert.equal((await repository.getSnapshot("CT"))?.retrievedAt, snapshot.retrievedAt);
	assert.equal(requests, 0);
	await assert.rejects(fetchStateBallotSourceText(source, async () => {
		requests += 1;
		return "";
	}), /automatic retrieval is disabled/u);
	assert.equal(requests, 0);
});

test("Connecticut candidate export and every printed ballot-line claim retain canonical transfer parity", async () => {
	const snapshot = loadReviewedStateFixture(source);
	assert.equal(serializeStateBallotSnapshots([snapshot]), readReviewedTransferFixture("2026-11-03-connecticut-candidates.jsonl"));
	const evidence = readReviewedTransferFixture("2026-11-03-connecticut-ballot-lines.jsonl").trim().split("\n").map(line => JSON.parse(line) as Record<string, unknown>);
	const manifest = evidence.shift()!;
	assert.equal(manifest.claimCount, 15517);
	assert.equal(manifest.candidateCount, 709);
	assert.equal(manifest.sourceSha256, snapshot.sha256);
	const grouped = reconcileConnecticutBallots(body);
	assert.equal(evidence.length, grouped.claims.length);
	const expected = new Map(grouped.records.flatMap((record, index) => record.claimIndexes.map(claim => [claim, snapshot.records[index]!.id] as const)));
	for (const [index, claim] of grouped.claims.entries()) assert.deepEqual(evidence[index], { type: "ballot-line", candidateId: expected.get(index), ...JSON.parse(JSON.stringify(claim)) });
});
