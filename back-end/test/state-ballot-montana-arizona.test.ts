import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { serializeStateBallotSnapshots } from "../src/state-ballot-export.js";
import { buildPublicStateExportForm, fetchStateBallotSourceText } from "../src/state-ballot-fetch.js";
import { parseStateCandidateRecords } from "../src/state-ballot-records.js";
import { buildStateBallotPreview, createStateBallotRepository } from "../src/state-ballot-repository.js";
import { loadBundledStateSnapshot } from "../src/state-ballot-snapshot.js";
import { stateBallotSources } from "../src/state-ballot-sources.js";
import { createStateBallotStorage } from "../src/state-ballot-storage.js";
import { buildStateRecordPage, parseStateRecordFilters } from "../src/state-records.js";

const montana = stateBallotSources.find(source => source.stateCode === "MT")!;
const now = Date.parse("2026-10-21T23:00:00Z");
const columns = ["Status", "District Type", "District", "Race", "Term Type", "Term Length", "Name", "Mailing Address", "Email/Web Address", "Phone", "Filing Date", "Party Preference", "Ballot Order"];

function candidateRows() {
	const definitions = [
		["Statewide", "STATE", "UNITED STATES SENATOR", "6", "Senator Example", "REP"],
		["Supreme Court Justice", "SUPREME COURT JUSTICE", "SUPREME COURT JUSTICE #4", "8", "Justice Example", "NON"],
		["Supreme Court Justice", "SUPREME COURT JUSTICE", "SUPREME COURT JUSTICE #4", "8", "Other Justice", "NON"],
		["Congressional", "1ST CONGRESSIONAL", "UNITED STATES REPRESENTATIVE", "2", "First Congress", "REP"],
		["Congressional", "2ND CONGRESSIONAL", "UNITED STATES REPRESENTATIVE", "2", "Second Congress", "DEM"],
		["House", "HOUSE DISTRICT 1", "STATE REPRESENTATIVE DISTRICT 1", "2", "House Example", "REP"],
		["House", "HOUSE DISTRICT 1", "STATE REPRESENTATIVE DISTRICT 1", "2", "Withdrawn Example", "LIB"],
		["Senate", "SENATE DISTRICT 1", "STATE SENATOR DISTRICT 1", "4", "Senate Example", "DEM"],
		["Public Service Commission", "PUBLIC SERVICE COMMISSIONER DISTRICT 1", "PUBLIC SERVICE COMMISSIONER, DISTRICT 1", "4", "Commission Example", "DEM"],
		["Judicial", "JUDICIAL DISTRICT 1", "DISTRICT COURT JUDGE DISTRICT 1, DEPT 1", "6", "*Court Example", "NON"],
		["Judicial", "JUDICIAL DISTRICT 20", "DISTRICT COURT JUDGE DISTRICT 20, DEPT 2 UNEXPIRED", "6", "*Unexpired Example", "NON"],
		["House", "HOUSE DISTRICT 22", "STATE REPRESENTATIVE DISTRICT 22", "2", "Nonpartisan Example", "NON"],
	];
	return definitions.map(([type, district, race, term, name, party]) => [name === "Withdrawn Example" ? "WITHDRAWN" : "FILED", type!, district!, race!, name === "*Unexpired Example" ? "UNEXPIRED" : "REGULAR", term!, name!, "Private residence excluded", "private@example.invalid", "555-0100", "03/01/2026", party!, ""]);
}

function sourcePage(total = 12) {
	const control = "ctl00$ContentPlaceHolder1$grdCandidates$ctl00$ctl02$ctl00$ExportToCsvButton";
	return `<form id="frmMain" method="post" action="./CandidateList.aspx?e=450002987"><input type="hidden" name="__VIEWSTATE" value="synthetic-public-form-state"><input type="hidden" name="ctl00$ContentPlaceHolder1$hidElectionDate" value="FEDERAL GENERAL 2026"><input type="hidden" name="ctl00$ContentPlaceHolder1$hidElectionType" value="General"><select name="ctl00$ContentPlaceHolder1$ddlElection"><option value="450002987" selected>FEDERAL GENERAL 2026 (11/03/2026) (General)</option></select><select name="ctl00$ContentPlaceHolder1$ddlCounty"><option value="99" selected>STATE</option></select><input type="button" name="${control}" onclick="javascript:__doPostBack('${control}','')"><p>* = Incumbent</p><p>${total} items in 1 pages</p></form>`;
}

function envelope(rows = candidateRows(), page = sourcePage(rows.length), headers = columns) {
	return JSON.stringify({ page, records: [headers, ...rows].map(row => row.map(value => JSON.stringify(value)).join(",")).join("\r\n") });
}

test("Montana uses only the published selected general CSV control in two bounded requests", async () => {
	let requests = 0;
	const body = await fetchStateBallotSourceText(montana, async (url, options) => {
		assert.equal(url, montana.url);
		assert.deepEqual(options.allowedHosts, ["candidatefiling.mt.gov"]);
		assert.equal(options.maxBytes, 12 * 1024 * 1024);
		assert.equal(options.maxRedirects, 2);
		requests += 1;
		if (!options.postBody) return sourcePage();
		const fields = new URLSearchParams(options.postBody);
		assert.equal(fields.get("ctl00$ContentPlaceHolder1$ddlElection"), "450002987");
		assert.equal(fields.get("ctl00$ContentPlaceHolder1$ddlCounty"), "99");
		assert.equal(fields.get("ctl00$ContentPlaceHolder1$hidElectionDate"), "FEDERAL GENERAL 2026");
		assert.equal(fields.get("ctl00$ContentPlaceHolder1$hidElectionType"), "General");
		assert.equal(fields.get("__EVENTTARGET"), "ctl00$ContentPlaceHolder1$grdCandidates$ctl00$ctl02$ctl00$ExportToCsvButton");
		return JSON.parse(envelope()).records as string;
	});
	assert.equal(requests, 2);
	assert.equal(parseStateCandidateRecords(montana, body).length, 12);
});

test("Montana refuses primary, restricted county, changed date, target, marker or export controls", () => {
	for (const page of [sourcePage().replaceAll("450002987", "450002928"), sourcePage().replaceAll("FEDERAL GENERAL 2026", "FEDERAL PRIMARY 2026"), sourcePage().replace("11/03/2026", "06/02/2026"), sourcePage().replace("value=\"99\"", "value=\"01\""), sourcePage().replace("* = Incumbent", "* = Unopposed"), sourcePage().replaceAll("ExportToCsvButton", "UnreviewedControl"), sourcePage().replace("action=\"./CandidateList.aspx?e=450002987\"", "action=\"https://other.example/export\""), sourcePage().replace("method=\"post\"", "method=\"get\""), sourcePage().replace("</form>", "<select name=\"extra-filter\"></select></form>")]) assert.throws(() => buildPublicStateExportForm(montana, page), /Montana/u);
	assert.throws(() => buildPublicStateExportForm({ ...montana, electionDate: "2028-11-07" }, sourcePage()), /Montana/u);
});

test("Montana retains source status and term facts but excludes personal contact columns", () => {
	const records = parseStateCandidateRecords(montana, envelope());
	assert.equal(records.filter(record => record.status === "filed").length, 11);
	assert.equal(records.filter(record => record.status === "withdrawn").length, 1);
	const judge = records.find(record => record.name === "Court Example")!;
	assert.equal(judge.status, "filed");
	assert.equal(judge.sourceStatus, "FILED");
	assert.equal(judge.ballotDesignation, "Incumbent; 6-year term");
	assert.equal(judge.jurisdiction, "Judicial District 1");
	assert.equal(records.find(record => record.name === "Unexpired Example")!.ballotDesignation, "Incumbent; Unexpired; listed term length: 6 years");
	assert.ok(records.filter(record => record.party === "Nonpartisan").every(record => !record.office.includes("retention")));
	assert.ok(records.every(record => record.candidateUrl === undefined && !record.name.startsWith("*")));
	assert.ok(!/Private residence|private@example|555-0100/iu.test(JSON.stringify(records)));
	assert.equal(records.find(record => record.name === "Commission Example")!.scope, "local");
});

test("Montana refuses partial, duplicate, malformed and unreviewed status or jurisdiction exports", () => {
	assert.throws(() => parseStateCandidateRecords(montana, envelope(candidateRows().slice(1), sourcePage(12))), /complete public record count/u);
	assert.throws(() => parseStateCandidateRecords(montana, envelope([...candidateRows(), candidateRows()[0]!])), /duplicate candidate/u);
	for (const [index, column, value] of [[0, 0, "ELECTED"], [0, 1, "County"], [0, 5, "4"], [0, 11, "OTHER"], [5, 2, "HOUSE DISTRICT 2"], [5, 3, "STATE REPRESENTATIVE DISTRICT 101"], [9, 11, "REP"], [10, 4, "REGULAR"], [9, 6, "**Court Example"], [0, 6, ""]] as const) {
		const rows = candidateRows();
		rows[index]![column] = value;
		assert.throws(() => parseStateCandidateRecords(montana, envelope(rows)), /Montana|incomplete candidate/u);
	}
	assert.throws(() => parseStateCandidateRecords(montana, envelope(candidateRows().map(row => [...row, "unexpected"]), sourcePage(), [...columns, "New Column"])), /columns/u);
});

test("Montana incumbency marker changes preserve stable person identities", () => {
	const rows = candidateRows();
	const original = parseStateCandidateRecords(montana, envelope(rows));
	rows[9]![6] = "Court Example";
	const updated = parseStateCandidateRecords(montana, envelope(rows));
	assert.equal(original[9]!.id, updated[9]!.id);
	assert.equal(updated[9]!.ballotDesignation, "6-year term");
});

test("Montana matches only typed congressional and legislative geography and excludes withdrawals", () => {
	const snapshot = { source: montana, records: parseStateCandidateRecords(montana, envelope()), retrievedAt: new Date(now).toISOString(), sha256: "a".repeat(64) };
	const preview = (districtType: string, districtCode: string) => buildStateBallotPreview(snapshot, { districtMatches: [{ id: `${districtType}:${districtCode}`, districtType, districtCode, label: districtCode, sourceSystem: "Synthetic typed geography fixture" }] })!;
	for (const type of ["congressional", "state-house", "state-senate"]) assert.equal(preview(type, "1").candidateCount, 4);
	for (const [type, code] of [["county", "1"], ["ward", "1"], ["congressional", "20"], ["state-house", "20"], ["state-senate", "20"]]) assert.equal(preview(type, code).candidateCount, 3);
	assert.equal(buildStateRecordPage(snapshot, parseStateRecordFilters({})).matched, 11);
	assert.equal(buildStateRecordPage(snapshot, parseStateRecordFilters({ status: "all" })).matched, 12);
});

test("Montana persists validated public facts across restart and refuses a bad refresh without replacing disk", async (context) => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-montana-automatic-"));
	context.after(() => rm(directory, { recursive: true, force: true }));
	let requests = 0;
	const repository = createStateBallotRepository({ dataDirectory: directory, now: () => now, fetchText: async () => {
		requests += 1;
		return envelope();
	} });
	const snapshot = await repository.getSnapshot("MT");
	assert.equal(snapshot!.records.length, 12);
	const expected = serializeStateBallotSnapshots([snapshot!]);
	const restored = await createStateBallotRepository({ dataDirectory: directory, now: () => now + 1, fetchText: async () => {
		throw new Error("Restart must not download.");
	} }).getSnapshot("MT");
	assert.equal(serializeStateBallotSnapshots([restored!]), expected);
	assert.equal(requests, 1);
	const rows = candidateRows();
	rows[0]![0] = "UNREVIEWED";
	const refused = await createStateBallotRepository({ dataDirectory: directory, ttlMs: 1, now: () => now + 2, fetchText: async () => envelope(rows) }).getSnapshot("MT");
	assert.equal(refused, null);
	assert.equal(serializeStateBallotSnapshots([(await createStateBallotStorage(directory).read(montana))!]), expected);
	await assert.rejects(loadBundledStateSnapshot(montana), /No bundled/u);
});
