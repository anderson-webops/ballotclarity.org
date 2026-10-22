import type { LocationDistrictMatch } from "../src/types/civic.js";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { serializeStateBallotSnapshots } from "../src/state-ballot-export.js";
import { fetchStateBallotSourceText } from "../src/state-ballot-fetch.js";
import { parseStateHtml, stateHtmlAttribute, stateHtmlDescendants } from "../src/state-ballot-html.js";
import { parseStateCandidateRecords } from "../src/state-ballot-records.js";
import { buildStateBallotPreview, createStateBallotRepository } from "../src/state-ballot-repository.js";
import { parseBundledStateSnapshot } from "../src/state-ballot-snapshot.js";
import { stateBallotSources } from "../src/state-ballot-sources.js";
import { createReviewedFixtureRepository, readReviewedStateFixture, readReviewedTransferFixture } from "./helpers/reviewed-state-fixtures.js";

function source(state: string) {
	const configured = stateBallotSources.find(item => item.stateCode === state);
	assert.ok(configured);
	return configured;
}

function fixture(state: string) {
	return readFileSync(new URL(`./fixtures/state-portals-${state === "PA" ? "pennsylvania.html" : "west-virginia.json"}`, import.meta.url), "utf8");
}

function district(districtType: string, districtCode: string): LocationDistrictMatch {
	return { id: `${districtType}:${districtCode}`, districtType, districtCode, label: districtCode, sourceSystem: "Controlled geography fixture" };
}

function paRows() {
	const page = parseStateHtml(fixture("PA"));
	const input = stateHtmlDescendants(page, node => node.nodeName === "input" && stateHtmlAttribute(node, "id") === "dataJson" && Boolean(stateHtmlAttribute(node, "value")))[0]!;
	return JSON.parse(stateHtmlAttribute(input, "value"));
}

function paPage(rows: ReturnType<typeof paRows>) {
	const value = JSON.stringify(rows).replace(/&/gu, "&amp;").replace(/"/gu, "&quot;").replace(/</gu, "&lt;");
	return `<select id="ctl00_ContentPlaceHolder1_ReportElectionDropDown"><option selected value="116">2026 General Election (11/03/2026)</option></select><input id="dataJson" value="${value}">`;
}

function wvEnvelope() {
	return JSON.parse(fixture("WV")) as { documents: Array<{ candidateType: string; body: string }> };
}

function bundled(state: string) {
	return readReviewedStateFixture(state);
}

test("reviewed portal snapshots load without network access and keep their original capture times after cache expiry", async (context) => {
	let requests = 0;
	let now = Date.parse("2026-10-22T00:00:00Z");
	const repository = (await createReviewedFixtureRepository(context, {
		now: () => now,
		fetchText: async () => {
			requests += 1;
			throw new Error("No network permitted.");
		},
	}));
	for (const [state, count, statewide, documents] of [["PA", 442, 6, 1], ["WV", 564, 4, 2]] as const) {
		const snapshot = (await repository.getSnapshot(state))!;
		assert.ok(snapshot);
		assert.equal(snapshot.records.length, count);
		assert.equal(snapshot.documents?.length, documents);
		assert.equal(snapshot.retrievedAt, JSON.parse(bundled(state)).retrievedAt);
		assert.equal(buildStateBallotPreview(snapshot, { districtMatches: [] })?.candidateCount, statewide);
		assert.match(buildStateBallotPreview(snapshot, { districtMatches: [] })!.disclaimer, /Dated snapshot/u);
		now += 5 * 60 * 60 * 1000;
		assert.equal((await repository.getSnapshot(state))?.retrievedAt, snapshot.retrievedAt);
	}
	assert.equal(requests, 0);
});

test("reviewed portal document order, fingerprints, counts and factual-field allowlists remain enforced", () => {
	const original = JSON.parse(bundled("WV"));
	for (const mutate of [
		(data: typeof original) => { data.documents.reverse(); },
		(data: typeof original) => { data.documents[0].sha256 = "f".repeat(64); },
		(data: typeof original) => { data.documents[0].includedRecordCount += 1; },
		(data: typeof original) => { data.documents[0].retrievedAt = "not a date"; },
		(data: typeof original) => { data.records[0].residentialAddress = "Not an allowed field"; },
		(data: typeof original) => { data.records[0].sourceAreaLabel = { unexpected: true }; },
	]) {
		const changed = structuredClone(original);
		mutate(changed);
		assert.throws(() => parseBundledStateSnapshot(source("WV"), JSON.stringify(changed)), /document|provenance|layout|field/u);
	}
});

test("Pennsylvania filters explicit nominees and nomination papers instead of importing the entire filing database", () => {
	assert.equal(paRows().length, 1298);
	const records = parseStateCandidateRecords(source("PA"), fixture("PA"));
	assert.equal(records.length, 442);
	assert.equal(records.filter(record => record.status === "withdrawn").length, 5);
	assert.equal(records.filter(record => record.status === "inactive").length, 1);
	assert.ok(records.every(record => !/STATE COMMITTEE/u.test(record.office)));
	assert.ok(records.every(record => record.name !== "VENTRE, JOHN"));
	assert.equal(records.filter(record => record.name === "RICHEY, JASON L").length, 1);
	assert.ok(records.some(record => record.name === "KRAWCHUK, KENNETH V" && record.status === "listed"));
	assert.ok(records.some(record => record.name === "SCOTT, GAIL R" && record.sourceStatus === "Approved; Substitute; primary winner"));
	assert.ok(records.some(record => record.name === "CECIL, JACOB H" && record.status === "listed" && record.sourceStatus?.includes("Write-in")));
	assert.ok(records.every(record => record.status !== "write-in" && record.status !== "defeated"));
	const preview = buildStateBallotPreview({ source: source("PA"), records, retrievedAt: "2026-10-21T07:29:34.547Z", sha256: "a".repeat(64) }, { districtMatches: [] })!;
	assert.equal(preview.candidateCount, 6);
	assert.equal(preview.contestCount, 2);
	assert.ok(preview.contests.flatMap(contest => contest.candidates).every(candidate => !candidate.name.includes(" / ")));
	assert.ok(preview.contests.flatMap(contest => contest.candidates).every(candidate => !["DASTRA, ANTHONY JAMES", "BOLTON, CRAIG JOSEPH"].includes(candidate.name)));
});

test("Pennsylvania validates the selected election, full dataset container, status flags and district kinds", () => {
	const original = fixture("PA");
	for (const page of [
		original.replace("value=\"116\"", "value=\"111\""),
		original.replace("2026 General Election (11/03/2026)", "2026 Primary Election (05/19/2026)"),
		original.replaceAll("id=\"dataJson\"", "id=\"otherData\""),
		`${original}<input id="dataJson" value="[]">`,
		paPage([]),
	]) assert.throws(() => parseStateCandidateRecords(source("PA"), page), /election|container|record/u);
	for (const mutate of [
		(rows: ReturnType<typeof paRows>) => { rows[0].ElectionName = "2026 Primary Election"; },
		(rows: ReturnType<typeof paRows>) => { rows[0].CandidateStatusValue = "Unknown"; },
		(rows: ReturnType<typeof paRows>) => { rows[0].CandidateTypeValue = "Announcement"; },
		(rows: ReturnType<typeof paRows>) => { rows[0].PrimaryResult = true; },
		(rows: ReturnType<typeof paRows>) => { rows[0].DistrictName = "1st Legislative District"; },
	]) {
		const rows = paRows();
		mutate(rows);
		assert.throws(() => parseStateCandidateRecords(source("PA"), paPage(rows)), /election|vocabulary|text|district/u);
	}
});

test("West Virginia keeps only the exact November general election and both regular and write-in sets", () => {
	const envelope = wvEnvelope();
	assert.equal(JSON.parse(envelope.documents[0]!.body).data.candidates.length, 3278);
	assert.equal(JSON.parse(envelope.documents[1]!.body).data.candidates.length, 15);
	const records = parseStateCandidateRecords(source("WV"), fixture("WV"));
	assert.equal(records.length, 564);
	assert.equal(new Set(records.map(record => record.sourceCandidateId)).size, 564);
	assert.equal(records.filter(record => record.status === "write-in").length, 12);
	assert.equal(records.filter(record => record.sourceStatus === "GENERAL; N").length, 12);
	assert.equal(records.filter(record => record.scope === "local").length, 311);
	assert.equal(records.filter(record => record.candidateUrl).length, 108);
	assert.ok(records.every(record => !/EXECUTIVE COMMITTEE/u.test(record.office)));
	assert.ok(records.every(record => !["TOM WILLIS", "JANET MCNULTY"].includes(record.name)));
	assert.equal(records.filter(record => record.name === "SHELLEY MOORE CAPITO").length, 1);
	assert.ok(records.some(record => record.name === "RIO PHILLIPS" && record.status === "write-in" && record.scope === "statewide"));
});

test("West Virginia state-filed judicial races, source areas and divisions never establish statewide or legislative eligibility", () => {
	const records = parseStateCandidateRecords(source("WV"), fixture("WV"));
	const court = records.find(record => record.office.startsWith("CIRCUIT COURT JUDGE") && record.district === "7")!;
	assert.ok(court);
	assert.equal(court.scope, "local");
	assert.equal(court.sourceDivision, "2");
	assert.equal(court.sourceDistrictLabel, "7TH CIRCUIT COURT DISTRICT - 2ND DIVISION");
	assert.ok(court.office.includes("Division 2"));
	assert.ok(records.filter(record => /COURT|MAGISTRATE|CLERK|COUNTY COMMISSION|BOARD OF EDUCATION/u.test(record.office)).every(record => record.scope === "local"));
	const snapshot = { source: source("WV"), records, retrievedAt: "2026-10-21T00:00:00Z", sha256: "b".repeat(64) };
	assert.equal(buildStateBallotPreview(snapshot, { districtMatches: [] })?.candidateCount, 4);
	const preview = buildStateBallotPreview(snapshot, { districtMatches: [district("state-senate", "07")] })!;
	assert.ok(preview.candidateCount > 4);
	assert.ok(preview.contests.every(contest => !/COURT|MAGISTRATE/u.test(contest.title)));
});

test("West Virginia rejects missing result sets, partial pages, wrong election identities and duplicate candidate IDs", () => {
	const sourceValue = source("WV");
	for (const mutate of [
		(envelope: ReturnType<typeof wvEnvelope>) => { envelope.documents.pop(); },
		(envelope: ReturnType<typeof wvEnvelope>) => { envelope.documents.reverse(); },
	]) {
		const envelope = wvEnvelope();
		mutate(envelope);
		assert.throws(() => parseStateCandidateRecords(sourceValue, JSON.stringify(envelope)), /document/u);
	}
	for (const mutate of [
		(payload: ReturnType<typeof JSON.parse>) => { payload.meta.last = false; },
		(payload: ReturnType<typeof JSON.parse>) => { payload.meta.totalElements += 1; },
		(payload: ReturnType<typeof JSON.parse>) => { payload.meta.number = 1; },
		(payload: ReturnType<typeof JSON.parse>) => { payload.data.candidates[0].electionId = 19081; },
		(payload: ReturnType<typeof JSON.parse>) => { payload.data.candidates[0].candidateType = "Unknown"; },
		(payload: ReturnType<typeof JSON.parse>) => { payload.data.candidates[1].candidateId = payload.data.candidates[0].candidateId; },
	]) {
		const envelope = wvEnvelope();
		const payload = JSON.parse(envelope.documents[0]!.body);
		mutate(payload);
		envelope.documents[0]!.body = JSON.stringify(payload);
		assert.throws(() => parseStateCandidateRecords(sourceValue, JSON.stringify(envelope)), /page|election|identity/u);
	}
});

test("West Virginia imports safe published campaign links and excludes contact/residential fields", () => {
	for (const href of ["javascript:alert(1)", "http://localhost/private", "https://user:password@example.org/", "https://metadata.internal/"]) {
		const envelope = wvEnvelope();
		const payload = JSON.parse(envelope.documents[0]!.body);
		payload.data.candidates[0].website = href;
		payload.data.candidates[0].residentialAddress = { street: "PRIVATE RESIDENCE" };
		payload.data.candidates[0].candidateEmail = "private-contact@example.test";
		envelope.documents[0]!.body = JSON.stringify(payload);
		const records = parseStateCandidateRecords(source("WV"), JSON.stringify(envelope));
		assert.equal(records.find(record => record.name === "SHELLEY MOORE CAPITO")?.candidateUrl, undefined);
		assert.ok(!JSON.stringify(records).includes("PRIVATE RESIDENCE"));
		assert.ok(!JSON.stringify(records).includes("private-contact@example.test"));
		assert.ok(records.every(record => !Object.keys(record).some(key => /residen|mailing|phone|email/iu.test(key))));
	}
});

test("manual portal transport is refused before any network request", async () => {
	let requests = 0;
	for (const state of ["PA", "WV"]) {
		await assert.rejects(fetchStateBallotSourceText(source(state), async () => {
			requests += 1;
			throw new Error("No network permitted.");
		}), /manual|snapshot/u);
	}
	assert.equal(requests, 0);
});

test("public portal repository failures stay unavailable rather than presenting partial or relabeled candidate records", async () => {
	const failures: string[] = [];
	let requests = 0;
	const envelope = wvEnvelope();
	const payload = JSON.parse(envelope.documents[0]!.body);
	payload.meta.last = false;
	envelope.documents[0]!.body = JSON.stringify(payload);
	const repository = createStateBallotRepository({
		dataDirectory: null,
		sources: [{ ...source("WV"), retrievalPolicy: undefined }],
		fetchText: async () => {
			requests += 1;
			return JSON.stringify(envelope);
		},
		now: () => Date.parse("2026-10-21T00:00:00Z"),
		onUnavailable: (state, reason) => failures.push(`${state}:${reason}`),
	});
	assert.equal(await repository.getSnapshot("WV"), null);
	assert.equal(requests, 1);
	assert.deepEqual(failures, ["WV:format"]);
});

test("minimized portal fixtures reproduce every canonical transfer record without contact fields", () => {
	const saved = readReviewedTransferFixture("2026-11-03-pa-wv-candidates.jsonl");
	const lines = saved.trim().split("\n").map(line => JSON.parse(line));
	const snapshots = ["PA", "WV"].map(state => ({
		source: source(state),
		records: parseStateCandidateRecords(source(state), fixture(state)),
		retrievedAt: lines[0].states.find((item: { stateCode: string }) => item.stateCode === state).retrievedAt,
		sha256: lines[0].states.find((item: { stateCode: string }) => item.stateCode === state).sourceSha256,
		documents: lines[0].states.find((item: { stateCode: string }) => item.stateCode === state).documents,
	}));
	assert.equal(lines.length, 1007);
	assert.equal(serializeStateBallotSnapshots(snapshots), saved);
	assert.ok(lines.slice(1).every(row => !Object.keys(row).some(key => /address|phone|email|residen/iu.test(key))));
});
