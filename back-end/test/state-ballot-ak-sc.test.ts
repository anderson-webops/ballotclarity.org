import type { StateCandidateRecord } from "../src/state-ballot-records.js";
import type { StateBallotSnapshot } from "../src/state-ballot-repository.js";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { serializeStateBallotSnapshots } from "../src/state-ballot-export.js";
import { fetchStateBallotSourceText } from "../src/state-ballot-fetch.js";
import { buildSouthCarolinaSearchForm } from "../src/state-ballot-portal-records.js";
import { parseStateCandidateRecords } from "../src/state-ballot-records.js";
import { buildStateBallotPreview } from "../src/state-ballot-repository.js";
import { parseBundledStateSnapshot } from "../src/state-ballot-snapshot.js";
import { stateBallotSources } from "../src/state-ballot-sources.js";
import { createReviewedFixtureRepository, readReviewedStateFixture, readReviewedTransferFixture } from "./helpers/reviewed-state-fixtures.js";

function source(state: string) {
	const configured = stateBallotSources.find(source => source.stateCode === state);
	assert.ok(configured);
	return configured;
}

function fixture(state: string) {
	return readFileSync(new URL(`./fixtures/state-portals-${state === "AK" ? "alaska" : "south-carolina"}.json`, import.meta.url), "utf8");
}

function alaska() {
	return JSON.parse(fixture("AK")) as { documents: Array<{ url: string; body: string }> };
}

function carolina() {
	return JSON.parse(fixture("SC")) as { page: string; records: string };
}

test("Alaska reconciles all three general-election pages rather than silently serving the first page", () => {
	const records = parseStateCandidateRecords(source("AK"), fixture("AK"));
	assert.equal(records.length, 155);
	assert.equal(new Set(records.map(record => record.id)).size, 155);
	assert.equal(records.filter(record => record.status === "write-in").length, 6);
	assert.equal(records.filter(record => record.status === "qualified").length, 149);
	assert.equal(records.filter(record => record.candidateUrl).length, 87);
	assert.equal(records.filter(record => record.scope === "state-house").length, 93);
	assert.equal(records.filter(record => record.scope === "state-senate").length, 24);
	assert.equal(records.filter(record => record.scope === "local").length, 20);
	assert.deepEqual([...new Set(records.filter(record => record.scope === "state-house").map(record => Number(record.district)))].sort((left, right) => left - right), Array.from({ length: 40 }, (_, index) => index + 1));
	assert.ok(records.some(record => record.name.includes("Kreiss-Tomkins") && record.name.includes("Johnson") && record.party === "Registered Democrat / Nonpartisan"));
	assert.ok(records.some(record => record.name.includes("DeWitt") && record.name.includes("Steere") && record.status === "write-in"));
	assert.equal(records.filter(record => record.office === "SUPREME COURT, Judicial retention").length, 1);
});

test("Alaska requires the exact election, complete ordered pages, active pager and certification vocabulary", () => {
	for (const mutate of [
		(data: ReturnType<typeof alaska>) => { data.documents.pop(); },
		(data: ReturnType<typeof alaska>) => { data.documents.reverse(); },
		(data: ReturnType<typeof alaska>) => { data.documents[1]!.body = data.documents[0]!.body; },
		(data: ReturnType<typeof alaska>) => { data.documents[0]!.body = data.documents[0]!.body.replace("2026 General Election", "2026 Primary Election"); },
		(data: ReturnType<typeof alaska>) => { data.documents[0]!.body = data.documents[0]!.body.replace("November 3, 2026", "November 5, 2024"); },
		(data: ReturnType<typeof alaska>) => { data.documents[0]!.body = data.documents[0]!.body.replace("(Certified)", "(Pending)"); },
		(data: ReturnType<typeof alaska>) => { data.documents[0]!.body = data.documents[0]!.body.replaceAll("SENATE DISTRICT A", "SENATE DISTRICT 01"); },
		(data: ReturnType<typeof alaska>) => { data.documents[0]!.body = data.documents[0]!.body.replaceAll("HOUSE DISTRICT 01", "HOUSE DISTRICT A"); },
		(data: ReturnType<typeof alaska>) => { data.documents[0]!.body = data.documents[0]!.body.replaceAll("frm-page-407=3", "frm-page-407=4"); },
	]) {
		const changed = alaska();
		mutate(changed);
		assert.throws(() => parseStateCandidateRecords(source("AK"), JSON.stringify(changed)), /Alaska|election|candidate/u);
	}
});

test("Alaska judicial regions do not attach to unrelated legislative district numbers", () => {
	const records = parseStateCandidateRecords(source("AK"), fixture("AK"));
	const snapshot = { source: source("AK"), records, sha256: "a".repeat(64), retrievedAt: "2026-10-21T08:55:38.035Z" };
	assert.equal(buildStateBallotPreview(snapshot, { districtMatches: [] })?.candidateCount, 18);
	const preview = buildStateBallotPreview(snapshot, { districtMatches: [{ id: "house:3", districtCode: "3", districtType: "state-house", label: "House 3", sourceSystem: "Controlled fixture" }] })!;
	assert.ok(preview.candidateCount > 18);
	assert.ok(preview.contests.every(contest => !/STATE (?:SUPERIOR|DISTRICT) COURT/u.test(contest.title)));
	assert.match(preview.disclaimer, /Dated snapshot/u);
	assert.doesNotMatch(preview.disclaimer, /Filing does not establish/u);
});

test("Alaska rejects inconsistent repeated court claims across candidate pages", () => {
	const changed = alaska();
	const body = changed.documents[1]!.body;
	const start = body.indexOf("<h4>SUPREME COURT</h4>");
	assert.ok(start > 0);
	changed.documents[1]!.body = body.slice(0, start) + body.slice(start).replace("<td></td><td></td>", "<td></td><td><a href=\"https://example.org/changed\">Changed</a></td>");
	assert.notEqual(changed.documents[1]!.body, body);
	assert.throws(() => parseStateCandidateRecords(source("AK"), JSON.stringify(changed)), /inconsistent/u);
});

test("Alaska snapshot keeps original capture provenance across cache expiry without live transport", async (context) => {
	let requests = 0;
	let now = Date.parse("2026-10-21T09:00:00Z");
	const repository = await createReviewedFixtureRepository(context, {
		now: () => now,
		fetchText: async () => {
			requests += 1;
			throw new Error("No live retrieval");
		},
	});
	const first = await repository.getSnapshot("AK");
	assert.ok(first);
	assert.equal(first.records.length, 155);
	assert.deepEqual(first.documents?.map(document => document.includedRecordCount), [76, 43, 36]);
	now += 5 * 60 * 60 * 1000;
	assert.equal((await repository.getSnapshot("AK"))?.retrievedAt, first.retrievedAt);
	assert.equal(requests, 0);
	await assert.rejects(fetchStateBallotSourceText(source("AK"), async () => {
		requests += 1;
		return "";
	}), /automatic retrieval is disabled/u);
	assert.equal(requests, 0);
});

test("South Carolina preserves public general-election source identities while withholding inactive filings", () => {
	const records = parseStateCandidateRecords(source("SC"), fixture("SC"));
	assert.equal(records.length, 1443);
	assert.equal(new Set(records.map(record => record.sourceCandidateId)).size, 1443);
	assert.equal(records.filter(record => record.status === "listed").length, 1175);
	assert.equal(records.filter(record => record.status === "defeated").length, 216);
	assert.equal(records.filter(record => record.status === "withdrawn").length, 37);
	assert.equal(records.filter(record => record.status === "disqualified").length, 13);
	assert.equal(records.filter(record => record.status === "inactive").length, 2);
	assert.equal(records.filter(record => record.scope === "local").length, 1030);
	assert.equal(records.filter(record => record.candidateUrl).length, 1443);
	assert.ok(records.every(record => new URL(record.candidateUrl!).hostname === "vrems.scvotes.sc.gov"));
	const preview = buildStateBallotPreview({ source: source("SC"), records, sha256: "b".repeat(64), retrievedAt: "2026-10-21T08:55:33.813Z" }, { districtMatches: [] })!;
	assert.equal(preview.candidateCount, 23);
	assert.equal(preview.contestCount, 8);
	assert.equal(preview.contests.find(contest => contest.title === "Governor and Lieutenant Governor")?.candidates.length, 4);
	assert.ok(preview.contests.find(contest => contest.title === "Governor and Lieutenant Governor")?.candidates.every(candidate => candidate.name.includes(" / ")));
	assert.ok(preview.contests.some(contest => contest.title === "State Superintendent of Education"));
	assert.ok(preview.contests.flatMap(contest => contest.candidates).every(candidate => candidate.sourceStatus === "Active"));
});

test("South Carolina uses only the published anonymous unfiltered search contract", async () => {
	const original = carolina();
	const fields = new URLSearchParams(buildSouthCarolinaSearchForm(original.page));
	assert.equal(fields.get("ElectionId"), "22596");
	assert.equal(fields.get("SelectedOffice"), "-1");
	for (const name of ["CandidateFirstName", "CandidateLastName", "SelectedCandidateStatus", "SelectedPoliticalParty", "SelectedFilingLocation"]) assert.equal(fields.get(name), "");
	assert.equal(fields.has("SelectedAssociatedCounties"), false);
	const requests: Array<{ url: string; postBody?: string }> = [];
	const body = await fetchStateBallotSourceText(source("SC"), async (url, options) => {
		assert.deepEqual(options.allowedHosts, ["vrems.scvotes.sc.gov"]);
		assert.equal(options.maxRedirects, 2);
		requests.push({ url, postBody: options.postBody });
		return options.postBody ? original.records : original.page;
	});
	assert.equal(requests.length, 2);
	assert.equal(requests[0]!.url, source("SC").url);
	assert.equal(requests[1]!.url, "https://vrems.scvotes.sc.gov/Candidate/CandidateSearch/");
	assert.equal(requests[1]!.postBody, fields.toString());
	assert.equal(parseStateCandidateRecords(source("SC"), body).length, 1443);
});

test("South Carolina rejects changed elections, status vocabularies, missing rows, links and running mates", () => {
	for (const mutate of [
		(data: ReturnType<typeof carolina>) => { data.page = data.page.replace("11/3/2026 Statewide General Election", "6/9/2026 Statewide Primary"); },
		(data: ReturnType<typeof carolina>) => { data.records = data.records.replace("value=\"22596\"", "value=\"11111\""); },
		(data: ReturnType<typeof carolina>) => { data.records = data.records.replace("data-index=\"1\"", "data-index=\"7\""); },
		(data: ReturnType<typeof carolina>) => { data.records = data.records.replace("data-key=\"24685\"", "data-key=\"23866\""); },
		(data: ReturnType<typeof carolina>) => { data.records = data.records.replace("Candace Brewer (Active)", "Not Designated"); },
		(data: ReturnType<typeof carolina>) => { data.records = data.records.replace("candidateId=23866", "candidateId=99999"); },
		(data: ReturnType<typeof carolina>) => { data.records = data.records.replace("<td>Active</td>", "<td>Unexpected status</td>"); },
		(data: ReturnType<typeof carolina>) => { data.records = data.records.replace("</tbody></table>", ""); },
	]) {
		const changed = carolina();
		mutate(changed);
		assert.throws(() => parseStateCandidateRecords(source("SC"), JSON.stringify(changed)), /public|candidate|governor/u);
	}
});

test("minimized Alaska fixtures ignore private address/contact cells and exclude unsafe websites", () => {
	const changed = alaska();
	changed.documents[0]!.body = changed.documents[0]!.body.replace("<td></td><td>", "<td>123 Private Fixture Street</td><td>private@example.test ");
	const records = parseStateCandidateRecords(source("AK"), JSON.stringify(changed));
	assert.doesNotMatch(JSON.stringify(records), /Private Fixture|private@example/u);
	const unsafe = fixture("AK").replace("http://www.medaforalaska.com", "http://127.0.0.1/private");
	assert.doesNotMatch(JSON.stringify(parseStateCandidateRecords(source("AK"), unsafe)), /127\.0\.0\.1\/private/u);
});

test("both new factual fixtures reproduce every transfer record without claiming original source-byte hashes", () => {
	const canonical = readReviewedTransferFixture("2026-11-03-ak-sc-candidates.jsonl");
	const manifest = JSON.parse(canonical.split("\n", 1)[0]!);
	const snapshots: StateBallotSnapshot[] = manifest.states.map((metadata: { stateCode: string; retrievedAt: string; sourceSha256: string }) => {
		if (metadata.stateCode === "AK") return parseBundledStateSnapshot(source("AK"), readReviewedStateFixture("alaska-2026.json"));
		return { source: source(metadata.stateCode), records: parseStateCandidateRecords(source(metadata.stateCode), fixture(metadata.stateCode)), retrievedAt: metadata.retrievedAt, sha256: metadata.sourceSha256 };
	});
	assert.equal(serializeStateBallotSnapshots(snapshots), canonical);
	assert.equal(canonical.trim().split("\n").length, 1599);
	assert.ok(snapshots.flatMap((snapshot: { records: StateCandidateRecord[] }) => snapshot.records).every(record => !Object.keys(record).some(key => /email|address|phone/iu.test(key))));
});
