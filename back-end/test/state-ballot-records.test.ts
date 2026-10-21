import type { LocationLookupResponse } from "../src/types/civic.js";
import assert from "node:assert/strict";
import test from "node:test";
import { getOfficialToolsForState, getStateAbbreviationForName, getStateNameForAbbreviation } from "../src/official-election-tools.js";
import { classifyStateContest, parseStateCandidateRecords, stateRecordMatchesDistricts } from "../src/state-ballot-records.js";
import { attachStateBallotPreview, buildStateBallotPreview, createStateBallotRepository } from "../src/state-ballot-repository.js";
import { stateBallotSources } from "../src/state-ballot-sources.js";
import { usStates } from "../src/us-states.js";

const source = (state: string) => stateBallotSources.find(item => item.stateCode === state)!;
const ncCsv = "election_dt,contest_name,name_on_ballot,party_candidate,county_name\n11/03/2026,US SENATE,Alex Sample,Unaffiliated,Alpha\n11/03/2026,US SENATE,Alex Sample,Unaffiliated,Beta\n03/03/2026,US SENATE,Primary Only,Example,Alpha\n11/03/2026,NC HOUSE OF REPRESENTATIVES DISTRICT 007,Jordan Sample,Example,Alpha\n11/03/2026,NC HOUSE OF REPRESENTATIVES DISTRICT 008,Other District,Example,Alpha\n";
const testNow = Date.parse("2026-10-20T12:00:00Z");

test("North Carolina rows use the configured election and deduplicate cross-county entries", () => {
	const records = parseStateCandidateRecords(source("NC"), ncCsv);
	assert.equal(records.length, 3);
	assert.equal(records.filter(record => record.name === "Alex Sample").length, 1);
	assert.equal(records.some(record => record.name === "Primary Only"), false);
	assert.equal(records.find(record => record.name === "Jordan Sample")?.district, "7");
});

test("quoted candidate names and multiline CSV fields survive without address or contact data", () => {
	const records = parseStateCandidateRecords(source("NC"), "election_dt,contest_name,name_on_ballot,party_candidate,street_address\r\n11/03/2026,US SENATE,\"Alex \"\"Example\"\" Sample\",Example,\"private\naddress\"\r\n");
	assert.equal(records[0]?.name, "Alex \"Example\" Sample");
	assert.equal(JSON.stringify(records).includes("private"), false);
});

test("CSV schema drift, truncated records, and wrong election years fail closed", () => {
	assert.throws(() => parseStateCandidateRecords(source("NC"), "candidate,party\nExample,Example\n"), /unexpected layout/u);
	assert.throws(() => parseStateCandidateRecords(source("NC"), "election_dt,contest_name,name_on_ballot,party_candidate\n11/03/2026,US SENATE,Missing party\n"));
	assert.throws(() => parseStateCandidateRecords(source("NC"), ncCsv.replaceAll("2026", "2024")), /no records/u);
});

test("Maryland's trailing empty header is normalized without permitting missing named columns", () => {
	const header = "Office Name,Contest Run By District Name and Number,Candidate Ballot Last Name and Suffix,Candidate First Name and Middle Name,Candidate Status,\n";
	const records = parseStateCandidateRecords(source("MD"), `${header}House of Delegates,District 01A,Sample,Alex,Active\n`);
	assert.equal(records[0]?.district, "1A");
	assert.equal(records[0]?.name, "Alex Sample");
	assert.throws(() => parseStateCandidateRecords(source("MD"), `${header}House of Delegates,District 01A,Sample,Alex\n`), /inconsistent row/u);
});

test("Florida TSV retains literal quotes and excludes another election", () => {
	const body = "ElectionID\tOfficeDesc\tStatusCode\tStatusDesc\tNameFirst\tNameMiddle\tNameLast\tJuris1num\tPartyCode\tPartyDesc\n20261103-GEN\tState Senator\tQUA\tQualified\tAlex\t\"Example\"\tSample\t07\tNPA\tNo Party Affiliation\n20240820-PRI\tState Senator\tQUA\tQualified\tOld\t\tSample\t07\tNPA\tNo Party Affiliation\n";
	const records = parseStateCandidateRecords(source("FL"), body);
	assert.equal(records.length, 1);
	assert.equal(records[0]?.name, "Alex \"Example\" Sample");
	assert.equal(records[0]?.status, "qualified");
});

test("Delaware reads only the public name and keeps withdrawal evidence authoritative", () => {
	const row = (status: string) => `<tr><td data-label="Office">Representative in Congress</td><td data-label="Party">Example</td><td data-label="Candidate"><span class="main-span">Alex &amp; Sample</span><span class="sub-span">Private address</span></td><td data-label="Status">${status}</td></tr>`;
	for (const rows of [row("Withdrawn") + row("Qualified"), row("Qualified") + row("Withdrawn")]) {
		const records = parseStateCandidateRecords(source("DE"), `<h1>General Election 11/3/2026</h1><table>${rows}</table>`);
		assert.equal(records[0]?.name, "Alex & Sample");
		assert.equal(records[0]?.status, "withdrawn");
		assert.equal(records[0]?.scope, "statewide");
		assert.equal(records[0]?.district, "");
		assert.equal(JSON.stringify(records).includes("Private address"), false);
	}
});

test("federal and state senate seats stay distinct, with exact district matching", () => {
	assert.equal(classifyStateContest("US SENATE").scope, "statewide");
	assert.equal(classifyStateContest("State Senator District 05").scope, "state-senate");
	const records = parseStateCandidateRecords(source("NC"), ncCsv);
	const matches = [{ id: "lower:007", label: "State House 7", districtCode: "007", districtType: "state-house", sourceSystem: "Fixture" }];
	assert.equal(stateRecordMatchesDistricts(records.find(record => record.name === "Jordan Sample")!, matches), true);
	assert.equal(stateRecordMatchesDistricts(records.find(record => record.name === "Jordan Sample")!, [{ ...matches[0]!, districtType: "State House District" }]), true);
	assert.equal(stateRecordMatchesDistricts(records.find(record => record.name === "Other District")!, matches), false);
	assert.equal(stateRecordMatchesDistricts(records.find(record => record.name === "Jordan Sample")!, []), false);
});

test("state source caching shares concurrent reads, retries failures, and expires after the election", async () => {
	let requests = 0;
	let currentTime = testNow;
	let shouldFail = true;
	const repository = createStateBallotRepository({
		now: () => currentTime,
		fetchText: async () => {
			requests += 1;
			if (shouldFail) throw new Error("Unavailable");
			return ncCsv;
		},
	});
	assert.equal(await repository.getSnapshot("ZZ"), null);
	assert.equal(await repository.getSnapshot("NC"), null);
	assert.equal(await repository.getSnapshot("NC"), null);
	assert.equal(requests, 1);
	shouldFail = false;
	currentTime += 5 * 60 * 1000;
	const [first, second] = await Promise.all([repository.getSnapshot("NC"), repository.getSnapshot("NC")]);
	assert.ok(first);
	assert.equal(first, second);
	assert.equal(requests, 2);
	currentTime += 4 * 60 * 60 * 1000;
	assert.ok(await repository.getSnapshot("NC"));
	assert.equal(requests, 3);
	currentTime = Date.parse("2026-11-05T00:00:00Z");
	assert.equal(await repository.getSnapshot("NC"), null);
	assert.equal(requests, 3);
});

test("state previews expose matched records without claiming a verified guide or retaining a street address", async () => {
	const repository = createStateBallotRepository({ now: () => testNow, fetchText: async () => ncCsv });
	const snapshot = await repository.getSnapshot("NC");
	assert.ok(snapshot);
	const preview = buildStateBallotPreview(snapshot, { districtMatches: [] });
	assert.equal(preview?.candidateCount, 1);
	assert.equal(preview?.status, "official_source_unverified");
	const lookup = {
		result: "resolved",
		location: { state: "North Carolina", displayName: "Fixture", slug: "fixture", coverageLabel: "Fixture" },
		districtMatches: [],
		representativeMatches: [],
		actions: [],
		inputKind: "address",
		normalizedAddress: "Private street address",
		guideAvailability: "not-published",
		guideContent: null,
	} as unknown as LocationLookupResponse;
	await attachStateBallotPreview(lookup, repository);
	assert.equal(lookup.ballotContentPreviews?.length, 1);
	assert.equal(lookup.guideAvailability, "not-published");
	assert.equal(JSON.stringify(lookup.ballotContentPreviews).includes("Private street address"), false);
});

test("every state and DC have a reversible identity and an official election-office resource", () => {
	assert.equal(usStates.length, 51);
	for (const [code, name] of usStates) {
		assert.equal(getStateAbbreviationForName(` ${name.toLowerCase()} `), code);
		assert.equal(getStateNameForAbbreviation(code.toLowerCase()), name);
		const resources = getOfficialToolsForState(code);
		assert.ok(resources.length);
		assert.equal(resources[0]?.authority, "official-government");
		assert.equal(new URL(resources[0]!.url).protocol, "https:");
	}
	assert.deepEqual(getOfficialToolsForState("ZZ"), []);
	assert.equal(getStateAbbreviationForName("Unknown"), undefined);
	assert.match(getOfficialToolsForState("UT")[0]!.url, /vote\.utah\.gov/u);
});

test("inactive, unknown, and unopposed Florida filings never appear as ballot candidates", () => {
	const statuses = ["Qualified", "Withdrew", "Did Not Qualify", "Defeated", "Elected", "Unopposed", "Deceased", "Removed", "Transferred to Local", "Future Status"];
	const body = `ElectionID\tOfficeDesc\tStatusCode\tStatusDesc\tNameFirst\tNameLast\n${
		statuses.map((status, index) => `20261103-GEN\tGovernor\tX\t${status}\tPerson\t${index}`).join("\n")}`;
	const records = parseStateCandidateRecords(source("FL"), body);
	assert.equal(records.length, statuses.length);
	assert.deepEqual(records.map(record => record.sourceStatus), statuses);
	const preview = buildStateBallotPreview({ source: source("FL"), retrievedAt: new Date(testNow).toISOString(), sha256: "test", records }, { districtMatches: [] });
	assert.equal(preview?.candidateCount, 1);
	assert.equal(preview?.contests[0]?.candidates[0]?.ballotStatus, "qualified");
});

test("Maryland preserves running-mate tickets and literal quotes", () => {
	const body = "Office Name,Candidate Ballot Last Name and Suffix,Candidate First Name and Middle Name,Candidate Status,Related Candidate Last Name and Suffix,Related Candidate First Name and Middle Name,\nGovernor,Sample,Alex \"Example\",Active,Partner,Jordan\n";
	const record = parseStateCandidateRecords(source("MD"), body)[0];
	assert.equal(record?.name, "Alex \"Example\" Sample / Jordan Partner");
});

test("Michigan report headers, row spans, district prefixes, and record totals are validated", () => {
	const header = "<tr><td></td><td colspan=\"2\">Status</td><td></td><td colspan=\"2\">Party / Incumbent</td><td colspan=\"3\">Candidate Name</td><td colspan=\"3\">Filed On</td><td>Filing Method</td><td></td></tr>";
	const heading = "<tr><td></td><td colspan=\"12\"><a id=\"seat\"></a>7th District Representative in Congress 2 Year Term (1) Position</td><td></td></tr>";
	const row = "<tr><td></td><td colspan=\"2\">DISQ</td><td></td><td colspan=\"2\">Example Party</td><td colspan=\"3\">Sample, Alex</td><td colspan=\"3\">04/20/2026</td><td>Petitions</td><td></td></tr>";
	const body = `<h1>General Election Tuesday, November 3, 2026</h1><table>${header}${heading}${row}</table>1 Candidates as of October 20`;
	const record = parseStateCandidateRecords(source("MI"), body)[0];
	assert.equal(record?.district, "7");
	assert.equal(record?.scope, "congressional");
	assert.equal(record?.status, "disqualified");
	assert.throws(() => parseStateCandidateRecords(source("MI"), body.replace("1 Candidates", "2 Candidates")), /incomplete/u);
	assert.throws(() => parseStateCandidateRecords(source("MI"), body.replace("2026</h1>", "2024</h1>")), /configured general election/u);
});

test("ZIP and IP lookups do not turn centroid districts into a personal ballot", async () => {
	const repository = createStateBallotRepository({ now: () => testNow, fetchText: async () => ncCsv });
	const districtMatches = [{ id: "lower:7", label: "State House 7", districtCode: "7", districtType: "state-house", sourceSystem: "Fixture" }];
	for (const [inputKind, detectedFromIp, expectedCount] of [["zip", false, 1], ["address", true, 1], ["address", false, 2]] as const) {
		const lookup = { result: "resolved", inputKind, detectedFromIp, location: { state: "North Carolina" }, districtMatches } as LocationLookupResponse;
		await attachStateBallotPreview(lookup, repository);
		assert.equal(lookup.ballotContentPreviews?.[0]?.candidateCount, expectedCount);
	}
	const ambiguous = { result: "resolved", inputKind: "zip", location: { state: "North Carolina" }, selectionOptions: [{}] } as LocationLookupResponse;
	await attachStateBallotPreview(ambiguous, repository);
	assert.equal(ambiguous.ballotContentPreviews, undefined);
});

test("New Mexico tables validate status, district, pagination, and private-field exclusion", () => {
	const body = "<title>2026 General Election Contest/Candidate List</title><table id=\"ctl00_MainContent_rgCandidate_ctl00\"><tr><th>Contest</th><th>District</th><th>Name</th><th>Party</th><th>Status</th><th>Physical Address</th></tr><tr><td>United States Representative DISTRICT 2</td><td>DISTRICT 2</td><td>Alex Sample</td><td>Example</td><td>Qualified</td><td>Private address</td></tr></table>";
	const records = parseStateCandidateRecords(source("NM"), body);
	assert.equal(records[0]?.scope, "congressional");
	assert.equal(records[0]?.district, "2");
	assert.equal(records[0]?.status, "qualified");
	assert.equal(JSON.stringify(records).includes("Private address"), false);
	assert.throws(() => parseStateCandidateRecords(source("NM"), body.replace("</table>", "<tr class=\"rgPager\"><td>Next</td></tr></table>")), /paginated/u);
	assert.throws(() => parseStateCandidateRecords(source("NM"), body.replace("<th>Status</th>", "<th>Changed</th>")), /unexpected layout/u);
});

test("Virginia federal office names do not become state legislative seats", () => {
	const body = "<h1>November 3, 2026 - Federal Offices</h1><table><tr><td>Office Title</td><td>District</td><td>Candidate Party</td><td>Candidate Name</td></tr><tr><td>Member, House of Representatives</td><td>2nd District</td><td>Example</td><td>Alex Sample</td></tr></table>";
	const record = parseStateCandidateRecords(source("VA"), body)[0];
	assert.equal(record?.scope, "congressional");
	assert.equal(record?.district, "2");
	assert.equal(record?.status, "listed");
	assert.throws(() => parseStateCandidateRecords(source("VA"), body.replace("Member, House of Representatives", "House of Delegates")), /unexpected office/u);
});
