import assert from "node:assert/strict";
import test from "node:test";
import { buildPublicStateExportForm, fetchStateBallotSourceText } from "../src/state-ballot-fetch.js";
import { parseStateCandidateRecords } from "../src/state-ballot-records.js";
import { buildStateBallotPreview } from "../src/state-ballot-repository.js";
import { parseBundledStateSnapshot } from "../src/state-ballot-snapshot.js";
import { stateBallotSources } from "../src/state-ballot-sources.js";
import { createReviewedFixtureRepository, readReviewedStateFixture, readReviewedTransferFixture } from "./helpers/reviewed-state-fixtures.js";

function source(code: string) {
	const item = stateBallotSources.find(source => source.stateCode === code);
	assert.ok(item);
	return item;
}

function csv(rows: string[][]) {
	return rows.map(row => row.map(value => `"${value.replaceAll("\"", "\"\"")}"`).join(",")).join("\n");
}

const publicTokens = "<input type=\"hidden\" name=\"__VIEWSTATE\" value=\"public-form-state\"><input type=\"hidden\" name=\"privateEmail\" value=\"do-not-send@example.test\">";
const mississippiPage = `<form id="form1" method="post" action="./default.aspx"><h1>Candidate Qualifying List</h1><p>General Election: November 3, 2026</p>${publicTokens}<input type="submit" name="btnDownloadExcel" value="Download CSV"></form>`;
const hawaiiControl = "ctl00$cphFooter$rdgSearch$ctl00$ctl02$ctl00$ExportToCsvButton";
const hawaiiPage = `${publicTokens}<select name="ctl00$cphFooter$ddlElection"><option selected value="94">2026 Candidate Report</option></select><input type="submit" name="${hawaiiControl}"><p>6 items in 1 pages</p>`;
const southDakotaControl = "ctl00$MainContent$grdCandidates$ctl00$ctl02$ctl00$ExportToCsvButton";
const southDakotaPage = `<form id="Form1" method="post" action="./candidatelist.aspx?eid=774">${publicTokens}<span id="MainContent_lblFormHeader">2026 General Election Candidate List</span><input type="hidden" name="ctl00$MainContent$hidElectionDate" value="2026 General Election Candidate List"><input type="hidden" name="ctl00$MainContent$hidElectionType" value="General"><input type="button" onclick="javascript:__doPostBack('${southDakotaControl}','')"><p>3 items in 1 pages</p></form>`;
const illinoisPage = `${publicTokens}<h1>GENERAL ELECTION - 11/3/2026</h1><a href="javascript:__doPostBack('ctl00$ContentPlaceHolder1$btnText','')">Tab-Delimited Text File</a>`;
const envelope = (page: string, records: string) => JSON.stringify({ page, records });

test("public export forms retain only observed election fields and the supported download command", async () => {
	for (const [code, page] of [["MS", mississippiPage], ["HI", hawaiiPage], ["SD", southDakotaPage], ["IL", illinoisPage]]) {
		const fields = new URLSearchParams(buildPublicStateExportForm(source(code!), page!));
		assert.equal(fields.get("__VIEWSTATE"), "public-form-state");
		assert.equal(fields.has("privateEmail"), false);
		assert.throws(() => buildPublicStateExportForm(source(code!), page!.replaceAll("2026", "2027")), /configured/u);
		const requests: string[] = [];
		const retrieve = () => fetchStateBallotSourceText(source(code!), async (url, options) => {
			assert.deepEqual(options.allowedHosts, [new URL(url).hostname]);
			requests.push(url);
			return options.postBody ? "public-csv-content" : page!;
		});
		if (source(code!).retrievalPolicy === "manual-snapshot") {
			await assert.rejects(retrieve(), /manually supplied candidate snapshot/u);
			assert.equal(requests.length, 0);
		}
		else {
			const body = await retrieve();
			assert.equal(requests.length, 2);
			assert.deepEqual(JSON.parse(body), { page, records: "public-csv-content" });
		}
	}
	assert.equal(new URLSearchParams(buildPublicStateExportForm(source("HI"), hawaiiPage)).get("ctl00$cphFooter$ddlElection"), "94");
	assert.throws(() => buildPublicStateExportForm(source("HI"), hawaiiPage.replace(" selected", "")), /select/u);
});

test("Illinois uses its captured snapshot without crawling or relabeling the original retrieval date", async (context) => {
	const body = readReviewedStateFixture("illinois-2026.json");
	const metadata = JSON.parse(body);
	let requests = 0;
	let now = Date.parse("2026-10-22T00:00:00Z");
	const repository = (await createReviewedFixtureRepository(context, {
		now: () => now,
		fetchText: async () => {
			requests += 1;
			throw new Error("No network request is permitted.");
		},
	}));
	const snapshot = await repository.getSnapshot("IL");
	assert.ok(snapshot);
	assert.equal(snapshot.records.length, 523);
	assert.equal(snapshot.retrievedAt, metadata.retrievedAt);
	assert.equal(snapshot.sha256, metadata.sourceSha256);
	const transferred = readReviewedTransferFixture("2026-11-03-public-export-candidates.jsonl").trim().split("\n").map(line => JSON.parse(line) as Record<string, unknown>).filter(row => row.type === "candidate" && row.stateCode === "IL").map(row => Object.fromEntries(Object.entries(row).filter(([key]) => !["type", "stateCode", "electionDate"].includes(key))));
	assert.deepEqual(snapshot.records, transferred);
	now += 24 * 60 * 60 * 1000;
	assert.equal((await repository.getSnapshot("IL"))?.retrievedAt, metadata.retrievedAt);
	assert.equal(requests, 0);
	const preview = buildStateBallotPreview(snapshot, { districtMatches: [] });
	assert.match(preview!.disclaimer, /Dated snapshot/u);
	assert.equal(preview?.generatedAt, metadata.retrievedAt);
	assert.throws(() => parseBundledStateSnapshot(source("IL"), body.replace(metadata.sourceSha256, "invalid")), /invalid provenance/u);
	assert.throws(() => parseBundledStateSnapshot(source("IL"), JSON.stringify({ ...metadata, rawContactData: "Private address" })), /unexpected fields/u);
	metadata.records[0].email = "do-not-import@example.test";
	assert.throws(() => parseBundledStateSnapshot(source("IL"), JSON.stringify(metadata)), /invalid layout/u);
});

test("Mississippi requires explicit November dates and distinguishes judicial places and special House districts", () => {
	const records = csv([
		["Office", "Candidate Name", "Party", "District", "Place", "General Election", "Election", "MailingAddress"],
		["Candidates for United States Senate", "Alex Sample", "Example", "", "", "November 3, 2026", "", "Private address"],
		["Candidates for Mississippi Court of Appeals", "Judge One", "", "1", "2", "", "November 3, 2026", ""],
		["Candidates for Mississippi Court of Appeals", "Judge Two", "", "1", "1", "", "November 3, 2026", ""],
		["Candidates for State House of Representatives District 70 & 77 - Special Election", "House Sample", "Independent", "77", "", "", "November 3, 2026", ""],
		["Candidates for State Senate 34", "Undated Sample", "", "34", "", "", "", ""],
	]);
	const report = mississippiPage.replace("</form>", `<table><tr><th>Name</th><th>Party</th></tr>${["Alex Sample", "Judge One", "Judge Two", "House Sample", "Undated Sample"].map(name => `<tr><td>${name}</td><td></td></tr>`).join("")}</table></form>`);
	const parsed = parseStateCandidateRecords(source("MS"), envelope(report, records));
	assert.equal(parsed.length, 4);
	assert.equal(parsed[0]?.scope, "statewide");
	assert.equal(parsed[1]?.scope, "local");
	assert.notEqual(parsed[1]?.office, parsed[2]?.office);
	assert.equal(parsed[3]?.scope, "state-house");
	assert.equal(parsed[3]?.district, "77");
	assert.equal(parsed[3]?.office.includes("70 & 77"), false);
	assert.equal(JSON.stringify(parsed).includes("Private address"), false);
	assert.throws(() => parseStateCandidateRecords(source("MS"), envelope(report, records.replaceAll("November 3, 2026", "November 3, 2027"))), /no records/u);
});

test("South Dakota validates complete export counts, withdrawal timestamps, at-large scope and local county identity", () => {
	const records = csv([
		["Contest", "Name", "Party", "District/County", "Ballot Order", "Mailing Address"],
		["United States Representative", "Alex Sample", "Example", "", "1", "Private address"],
		["United States Senator", "Withdrawn Sample (Withdrawn 8/4/2026 12:00:00 AM)", "Example", "", "", ""],
		["Sheriff", "County Sample", "Example", "Alpha County", "", ""],
	]);
	const parsed = parseStateCandidateRecords(source("SD"), envelope(southDakotaPage, records));
	assert.equal(parsed.length, 3);
	assert.equal(parsed[0]?.scope, "statewide");
	assert.equal(parsed[1]?.status, "withdrawn");
	assert.equal(parsed[1]?.name, "Withdrawn Sample");
	assert.equal(parsed[2]?.jurisdiction, "Alpha County");
	assert.equal(parsed[2]?.status, "listed");
	assert.equal(parsed[2]?.sourceStatus, "No ballot order published");
	assert.equal(JSON.stringify(parsed).includes("Private address"), false);
	assert.throws(() => parseStateCandidateRecords(source("SD"), envelope(southDakotaPage.replace("3 items", "4 items"), records)), /complete public record count/u);
	assert.throws(() => parseStateCandidateRecords(source("SD"), envelope(southDakotaPage, records.replace("8/4/2026", "8/4/2027"))), /withdrawal date/u);
});

test("Hawaii includes only explicit general-election candidates and retains safe campaign links", () => {
	const records = csv([
		["Contests", "Party", "BallotName", "Status", "Website", "MailingAddress"],
		["U.S. REPRESENTATIVE, DIST I", "Example", "General One", "In General", "campaign.example.org", "Private address"],
		["U.S. REPRESENTATIVE, DIST II", "Example", "General Two", "In General", "http://127.0.0.1/private", ""],
		["GOVERNOR", "Example", "Primary Only", "In Primary", "", ""],
		["GOVERNOR", "Example", "Issued Only", "Issued", "", ""],
		["GOVERNOR", "Example", "Withdrawn Only", "Withdrawn", "", ""],
		["STATE SENATOR, DIST 18", "Example", "Already Elected", "Elected After Primary", "", ""],
	]);
	const parsed = parseStateCandidateRecords(source("HI"), envelope(hawaiiPage, records));
	assert.equal(parsed.length, 2);
	assert.deepEqual(parsed.map(record => record.district), ["1", "2"]);
	assert.equal(parsed[0]?.candidateUrl, "https://campaign.example.org/");
	assert.equal(parsed[1]?.candidateUrl, undefined);
	assert.equal(parsed[0]?.sourceStatus, "In General");
	assert.equal(JSON.stringify(parsed).includes("Private address"), false);
	assert.throws(() => parseStateCandidateRecords(source("HI"), envelope(hawaiiPage, records.replace("\"Issued\"", "\"New Status\""))), /status vocabulary/u);
});

const illinoisHeaders = ["CandidateID", "BracketID", "FirstName", "LastName", "CandidateStatus", "WebSiteAddress", "ElecDate", "ElectionType", "PartyName", "OfficeName", "Address1"];
const illinoisRows = [
	["2", "1", "Running", "Mate", "Active", "", "11/3/2026", "GE", "EXAMPLE", "GOVERNOR AND LIEUTENANT GOVERNOR", "Private address"],
	["1", "1", "Head", "Candidate", "Active", "https://campaign.example.org", "11/3/2026", "GE", "EXAMPLE", "GOVERNOR AND LIEUTENANT GOVERNOR", ""],
	["3", "0", "Congress", "Sample", "Active", "", "11/3/2026", "GE", "EXAMPLE", "2ND CONGRESS", ""],
	["4", "0", "Senate", "Sample", "Withdrawn", "", "11/3/2026", "GE", "EXAMPLE", "42ND SENATE", ""],
	["5", "0", "House", "Sample", "Active", "", "11/3/2026", "GE", "EXAMPLE", "14TH REPRESENTATIVE", ""],
	["6", "0", "Judicial", "Sample", "Active", "", "11/3/2026", "GE", "EXAMPLE", "SUPREME COURT RETENTION", ""],
];
const illinoisRecords = `${illinoisHeaders.join("\t")}\t\n${illinoisRows.map(row => row.join("\t")).join("\n")}`;

test("Illinois brackets combine only explicit joint tickets and preserve ordinal legislative scopes", () => {
	const parsed = parseStateCandidateRecords(source("IL"), envelope(illinoisPage, illinoisRecords));
	assert.equal(parsed.length, 5);
	assert.equal(parsed[0]?.name, "Head Candidate / Running Mate");
	assert.equal(parsed[0]?.candidateUrl, "https://campaign.example.org/");
	assert.equal(parsed[1]?.scope, "congressional");
	assert.equal(parsed[1]?.district, "2");
	assert.equal(parsed[2]?.scope, "state-senate");
	assert.equal(parsed[2]?.status, "withdrawn");
	assert.equal(parsed[3]?.scope, "state-house");
	assert.equal(parsed[4]?.scope, "local");
	assert.equal(JSON.stringify(parsed).includes("Private address"), false);
	assert.throws(() => parseStateCandidateRecords(source("IL"), envelope(illinoisPage, illinoisRecords.replaceAll("11/3/2026", "11/3/2027"))), /different election/u);
	assert.throws(() => parseStateCandidateRecords(source("IL"), envelope(illinoisPage, illinoisRecords.replace("2\t1\tRunning", "2\t9\tRunning"))), /joint-ticket/u);
	assert.throws(() => parseStateCandidateRecords(source("IL"), envelope(illinoisPage, illinoisRecords.replace("Active", "New Status"))), /status vocabulary/u);
});

function utahTable(rows: string[][]) {
	return `<table>${rows.map(row => `<tr>${row.map(value => `<td>${value}</td>`).join("")}</tr>`).join("")}</table>`;
}

const utahPage = `<h1>2026 Candidate Filings</h1>${[
	[["Candidate", "Office", "Party", "Status"], ["Congress Sample", "U.S. House District 1", "Example", "Election Candidate"], ["Primary Loser", "U.S. House District 1", "Example", "Out in Primary"]],
	[["Candidate", "Office", "Party", "Status"], ["Senate Sample", "State Senate District 11", "Example", "Election Candidate"]],
	[["Candidate", "Office", "Party", "Status"], ["House Sample", "State House District 10", "Example", "Write-In"]],
	[["Candidate", "Office", "Party", "Status"], ["Board Sample", "State School Board District 4", "Example", "Election Candidate"]],
	[["Judicial Retention", "Status"], ["Shall Judicial Sample be retained in the office of Judge of the Court of Appeals of Utah?", "Election Candidate"], ["Shall Local Sample be retained in the office of Judge of the Juvenile Court of the Third Juvenile Court District?", "Election Candidate"], ["Shall Second Judicial be retained in the office of Judge of the Court of Appeals of Utah?", "Election Candidate"], ["Shall Withdrawn Sample be retained in the office of Justice of the Supreme Court of Utah?", "Withdrew"]],
].map(utahTable).join("")}`;

test("Utah separates general/write-in candidates from primary losers and never assigns school/judicial districts to legislative voters", () => {
	const parsed = parseStateCandidateRecords(source("UT"), utahPage);
	assert.equal(parsed.length, 7);
	assert.equal(parsed[2]?.status, "write-in");
	assert.equal(parsed[3]?.scope, "local");
	assert.equal(parsed[4]?.name, "Judicial Sample");
	assert.equal(parsed[4]?.office, "Shall Judicial Sample be retained in the office of Judge of the Court of Appeals of Utah?");
	assert.equal(parsed[4]?.scope, "statewide");
	assert.equal(parsed[5]?.scope, "local");
	const preview = buildStateBallotPreview({ source: source("UT"), records: parsed, retrievedAt: "2026-10-21T00:00:00Z", sha256: "a".repeat(64) }, { districtMatches: [] });
	assert.equal(preview?.candidateCount, 2);
	assert.equal(preview?.contestCount, 2);
	assert.throws(() => parseStateCandidateRecords(source("UT"), utahPage.replace("2026 Candidate Filings", "2027 Candidate Filings")), /configured election year/u);
	assert.throws(() => parseStateCandidateRecords(source("UT"), utahPage.replace("Out in Primary", "New Status")), /status vocabulary/u);
	assert.throws(() => parseStateCandidateRecords(source("UT"), utahPage.replace("<table>", "<section>").replace("</table>", "</section>")), /table set/u);
});
