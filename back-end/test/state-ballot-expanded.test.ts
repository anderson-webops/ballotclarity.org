import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { parse as parseCsv } from "csv-parse/sync";
import { serializeStateBallotSnapshots } from "../src/state-ballot-export.js";
import { buildNorthDakotaSearchForm, fetchStateBallotSourceText } from "../src/state-ballot-fetch.js";
import { parseStateCandidateRecords } from "../src/state-ballot-records.js";
import { buildStateBallotPreview } from "../src/state-ballot-repository.js";
import { stateBallotSources } from "../src/state-ballot-sources.js";
import { usStates } from "../src/us-states.js";

const source = (state: string) => stateBallotSources.find(source => source.stateCode === state)!;
const colorado = "<title>2026 General Election Official Candidate List</title><table><tr><th>Candidate name</th><th>Office</th><th>District</th><th>Party</th><th>Write in?</th></tr><tr><td>Alex Sample</td><td>US Senate</td><td>State</td><td>Example</td><td>N</td></tr><tr><td><span style=\"text-decoration: line-through\">Withdrawn Sample</span></td><td>US Senate</td><td>State</td><td>Other</td><td>N</td></tr><tr><td>Write-in Sample</td><td>US Senate</td><td>State</td><td>Other</td><td>Y</td></tr><tr><td>Board Sample</td><td>State Board of Education</td><td>1</td><td>Example</td><td>N</td></tr></table>";
const northDakotaTable = "<table><tr><th>Contest</th><th>Term Length</th><th>Contest</th><th>District</th><th>County</th><th>Name</th><th>First Name</th><th>Last Name</th><th>Party</th><th>Mailing Address</th></tr><tr><td>County Auditor</td><td>4</td><td>County Auditor</td><td></td><td>Alpha County</td><td>Same Name</td><td>Same</td><td>Name</td><td>Example</td><td>Private address</td></tr><tr><td>County Auditor</td><td>4</td><td>County Auditor</td><td></td><td>Beta County</td><td>Same Name</td><td>Same</td><td>Name</td><td>Example</td><td>Private address</td></tr><tr><td>County Auditor</td><td>4</td><td>County Auditor</td><td></td><td>Gamma County</td><td></td><td></td><td></td><td></td><td></td></tr><tr><td>Representative in Congress</td><td>2</td><td>Representative in Congress</td><td></td><td></td><td>At Large</td><td>At</td><td>Large</td><td>Example</td><td></td></tr></table>";
const searchForm = `<title>2026 General Election Contest/Candidate List</title><form id="aspnetForm" method="post" action="./candidatelist.aspx?eid=348"><input type="hidden" name="__VIEWSTATE" value="public-state-token"><input type="hidden" name="unexpected" value="do-not-send">${
	["ddlJursdiction", "ddlDistrict", "ddlContest", "ddlCandidate"].map(name => `<select name="ctl00$ContentPlaceHolder1$${name}"><option selected value="${name === "ddlJursdiction" ? "AL" : "0"}">${["ddlJursdiction", "ddlDistrict"].includes(name) ? "All" : ""}</option></select>`).join("")
}<input type="submit" name="ctl00$ContentPlaceHolder1$btnSearch" value="Search"></form>`;
const northDakota = searchForm.replace("</form>", `${northDakotaTable}</form>`);

test("Colorado retains withdrawal and certified write-in evidence without assigning education districts", () => {
	const records = parseStateCandidateRecords(source("CO"), colorado);
	assert.deepEqual(records.map(record => record.status), ["qualified", "withdrawn", "write-in", "qualified"]);
	assert.equal(records.at(-1)?.scope, "local");
	const preview = buildStateBallotPreview({ source: source("CO"), records, sha256: "test", retrievedAt: "2026-10-21T00:00:00Z" }, { districtMatches: [] });
	assert.equal(preview?.candidateCount, 2);
	assert.throws(() => parseStateCandidateRecords(source("CO"), colorado.replace("2026 General", "2024 General")), /configured general election/u);
	assert.throws(() => parseStateCandidateRecords(source("CO"), colorado.replace("<th>Office</th><th>District</th>", "<th>District</th><th>Office</th>")), /changed order/u);
});

test("North Dakota ignores unnamed vacancies but retains separate county contests and at-large candidates", () => {
	const records = parseStateCandidateRecords(source("ND"), northDakota);
	assert.equal(records.length, 3);
	assert.notEqual(records[0]?.id, records[1]?.id);
	assert.equal(records[0]?.jurisdiction, "Alpha County");
	assert.equal(records[1]?.jurisdiction, "Beta County");
	assert.equal(records[2]?.scope, "statewide");
	assert.equal(records[2]?.district, "");
	assert.equal(JSON.stringify(records).includes("Private address"), false);
	assert.throws(() => parseStateCandidateRecords(source("ND"), northDakota.replace("</table>", "<tr class=\"rgPager\"><td>Next</td></tr></table>")), /paginated/u);
});

test("North Dakota only posts observed public search tokens and unfiltered selectors", async () => {
	const form = new URLSearchParams(buildNorthDakotaSearchForm(source("ND"), searchForm));
	assert.equal(form.get("__VIEWSTATE"), "public-state-token");
	assert.equal(form.has("unexpected"), false);
	assert.equal(form.get("ctl00$ContentPlaceHolder1$ddlContest"), "0");
	assert.throws(() => buildNorthDakotaSearchForm(source("ND"), searchForm.replace("2026", "2027")), /configured general election/u);
	assert.throws(() => buildNorthDakotaSearchForm(source("ND"), searchForm.replace("value=\"AL\"", "value=\"filtered\"")), /unfiltered request/u);
	const requests: Array<{ url: string; body?: string }> = [];
	const body = await fetchStateBallotSourceText(source("ND"), async (url, options) => {
		requests.push({ url, body: options.postBody });
		assert.deepEqual(options.allowedHosts, ["vip.sos.nd.gov"]);
		return options.postBody ? northDakota : searchForm;
	});
	assert.equal(body, northDakota);
	assert.equal(requests.length, 2);
	assert.equal(requests[0]?.body, undefined);
	assert.ok(requests[1]?.body?.includes("btnSearch"));
});

test("Kentucky requires all configured office documents and excludes the closed-status list", async () => {
	const election = "<select name=\"ctl00$MainContent$ddlElection\"><option selected value=\"87\">2026 General Election</option></select>";
	const table = (inactive: boolean) => `<table><tr><td>${inactive ? "Name" : "Name / Running Mate"}</td><td>POBox Address / Email</td><td>Office</td><td>District/Division</td><td>Party</td></tr><tr><td>Alex Sample</td><td>Private address</td><td>US Senator</td><td></td><td>Example</td></tr></table>`;
	const body = await fetchStateBallotSourceText(source("KY"), async url => election + table(url.endsWith("withdrawn=1")));
	const records = parseStateCandidateRecords(source("KY"), body);
	assert.equal(records.length, 1);
	assert.equal(records[0]?.status, "inactive");
	assert.equal(JSON.stringify(records).includes("Private address"), false);
	const incomplete = JSON.parse(body);
	incomplete.documents.pop();
	assert.throws(() => parseStateCandidateRecords(source("KY"), JSON.stringify(incomplete)), /incomplete/u);
	assert.throws(() => parseStateCandidateRecords(source("KY"), body.replaceAll("2026 General Election", "2027 General Election")), /configured general election/u);
	await assert.rejects(fetchStateBallotSourceText({ ...source("KY"), documentUrls: ["https://another.example/list"] }, async () => ""), /source host/u);
});

test("North Carolina county races are not deduplicated across different counties", () => {
	const csv = "election_dt,contest_name,name_on_ballot,party_candidate,county_name\n11/03/2026,COUNTY SHERIFF,Same Name,Example,Alpha\n11/03/2026,COUNTY SHERIFF,Same Name,Example,Beta\n";
	const records = parseStateCandidateRecords(source("NC"), csv);
	assert.equal(records.length, 2);
	assert.notEqual(records[0]?.id, records[1]?.id);
	assert.deepEqual(records.map(record => record.jurisdiction), ["Alpha", "Beta"]);
});

test("server-transfer exports include a count/provenance manifest and exclude contact fields", () => {
	const records = parseStateCandidateRecords(source("ND"), northDakota);
	Object.assign(records[0]!, { email: "do-not-export@example.test", address: "Private address" });
	const snapshot = { source: source("ND"), records, retrievedAt: "2026-10-21T00:00:00Z", sha256: "a".repeat(64) };
	const content = serializeStateBallotSnapshots([snapshot]);
	const rows = content.trim().split("\n").map(line => JSON.parse(line));
	assert.equal(rows[0].schemaVersion, 1);
	assert.equal(rows[0].states[0].recordCount, 3);
	assert.equal(rows[0].states[0].sourceSha256, snapshot.sha256);
	assert.equal(rows[1].jurisdiction, "Alpha County");
	assert.equal(rows.length, 4);
	assert.equal(content.includes("Private address"), false);
	assert.equal(content.includes("do-not-export"), false);
	assert.throws(() => serializeStateBallotSnapshots([snapshot, snapshot]), /distinct/u);
	assert.throws(() => serializeStateBallotSnapshots([]), /distinct/u);
});

test("source-published candidate websites retain only safe absolute public links", () => {
	const header = "Election,Office Sought,Ballot Name,Date Withdrawn,Web Address\n";
	for (const [website, expected] of [["https://campaign.example.org/", "https://campaign.example.org/"], ["javascript:alert(1)", undefined], ["http://127.0.0.1/private", undefined], ["https://user@campaign.example.org/", undefined]]) {
		const records = parseStateCandidateRecords(source("WY"), `${header}2026 General Election,US Senate,Alex Sample,,${website}\n`);
		assert.equal(records[0]?.candidateUrl, expected);
	}
});

test("the national research inventory separates actual adapters from pending coverage", () => {
	const rows = parseCsv(readFileSync(new URL("../../docs/state-coverage-2026.csv", import.meta.url), "utf8"), { columns: true }) as Array<{ state_code: string; integration_status: string; official_source_url: string }>;
	assert.deepEqual(rows.map(row => row.state_code).sort(), usStates.map(state => state[0]).sort());
	assert.deepEqual(rows.filter(row => row.integration_status.startsWith("integrated")).map(row => row.state_code).sort(), stateBallotSources.map(source => source.stateCode).sort());
	assert.ok(rows.some(row => !row.integration_status.startsWith("integrated")));
	for (const source of stateBallotSources)
		assert.equal(rows.find(row => row.state_code === source.stateCode)?.official_source_url, source.pageUrl);
});
