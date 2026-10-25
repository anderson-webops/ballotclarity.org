import type { StateBallotSource } from "../src/state-ballot-sources.js";
import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import express from "express";
import { readAutomationRun } from "../src/admin-operations.js";
import { refreshApprovedCandidateData } from "../src/state-ballot-automation.js";
import { discoverStateBallotElectionCycles, parseStateBallotCycleCatalog, stateBallotCycleSources } from "../src/state-ballot-cycles.js";
import { fetchStateBallotSourceText } from "../src/state-ballot-fetch.js";
import { marylandCandidateRosterUrl, marylandDiscoveryUrl, readMarylandElectionDiscovery } from "../src/state-ballot-maryland.js";
import { parseStateCandidateRecords } from "../src/state-ballot-records.js";
import { configuredStateBallotSources } from "../src/state-ballot-registry.js";
import { buildStateBallotPreview, createStateBallotRepository } from "../src/state-ballot-repository.js";
import { StateBallotAwaitingRecordsError } from "../src/state-ballot-source-state.js";
import { createStateBallotStorage } from "../src/state-ballot-storage.js";
import { buildStateRecordPage, parseStateRecordFilters, registerStateRecordRoutes } from "../src/state-records.js";

type Kind = "state" | "local";
const now = Date.parse("2026-10-25T12:00:00.000Z");
const original = (kind: Kind) => configuredStateBallotSources.find(source => source.id === (kind === "state" ? "md-sbe-2026" : "md-sbe-local-2026"))!;
const code = (year: string) => `${year}_${year === "2028" ? "PG" : "GG"}`;
const cycle = (year: string) => year === "2028" ? "Presidential" : "Gubernatorial";
const day = (year: string) => year === "2026" ? "03" : year === "2028" ? "07" : "05";
const escape = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
const countyLabels = ["Allegany County", "Baltimore City", ...Array.from({ length: 22 }, (_, index) => `Synthetic Area ${index} County`)];
const headers = "Office Name|Contest Run By District Name and Number|Candidate Ballot Last Name and Suffix|Candidate First Name and Middle Name|Additional Information|Office Political Party|Candidate Residential Jurisdiction|Candidate Gender|Candidate Status|Filing Type and Date|Campaign Mailing Address|Campaign Mailing City State and Zip|Public Phone|Email|Website|Facebook|X|Other|Committee Name|Has Related Candidate|Related Candidate Last Name and Suffix|Related Candidate First Name and Middle Name|Related Office Political Party|Related Candidate County of Residence|Related Candidate Gender|Related Candidate Status|Related Candidate Filing Type and Date|Related Candidate Campaign Mailing Address|Related Candidate Campaign Mailing City State and Zip|Related Candidate Email|Related Candidate Website|Related Candidate Facebook|Related Candidate X|Related Candidate Other Social".split("|");
const row = (overrides: Record<string, string> = {}) => ({ "Office Name": "Treasurer", "Contest Run By District Name and Number": "Allegany", "Candidate Ballot Last Name and Suffix": "Example", "Candidate First Name and Middle Name": "Synthetic", "Office Political Party": "Democratic", "Candidate Residential Jurisdiction": "Different Home County", "Candidate Status": "Active", "Website": "www.example.org", "Campaign Mailing Address": "PRIVATE-ADDRESS", "Email": "PRIVATE-EMAIL", "Public Phone": "PRIVATE-PHONE", "Candidate Gender": "PRIVATE-GENDER", "_county": countyLabels[0]!, ...overrides });
const indexPage = (years: string[]) => `<section><h1>Elections</h1></section>${years.map(year => `<a href="/elections/${year}/index.html">${year} Election</a>`).join("")}`;
const yearPage = (year: string) => `<section><h1>${year} ${cycle(year)} Election</h1><dl><dt>General Election Day</dt><dd>November ${day(year)}, ${year}</dd></dl><a href="general_candidates/index.html">General Election Candidates</a></section>`;
const candidateIndex = (year: string) => `<section><h1>${year} ${cycle(year)} General Candidate Listings</h1><h2>Statewide Offices</h2><a href="${code(year)}_statewide_candidatelist.html">All Candidates</a><h2>Local Offices</h2><a href="${code(year)}_all_counties_candidatelist.html">All Candidates</a></section>`;
function discovery(years = ["2026", "2028"]) {
	return JSON.stringify({ schemaVersion: 1, type: "maryland-election-discovery", index: indexPage(years), years: years.map(year => ({ url: `${marylandDiscoveryUrl}${year}/index.html`, page: yearPage(year), candidatesUrl: `${marylandDiscoveryUrl}${year}/general_candidates/index.html`, candidates: candidateIndex(year) })) });
}
function csv(rows: Record<string, string>[]) {
	const cell = (value: string) => /[",\r\n]/u.test(value) ? `"${value.replaceAll("\"", "\"\"")}"` : value;
	return `${headers.join(",")},\n${rows.map(row => `${headers.map(header => cell(row[header] ?? "")).join(",")},\n`).join("")}`;
}
function roster(kind: Kind, rows: Record<string, string>[], year = "2026") {
	const intro = `<section><h1>${year} ${cycle(year)} General Election ${kind === "state" ? "State" : "Local"} Candidates List</h1><a href="${marylandCandidateRosterUrl(code(year), kind)}">Download (CSV)</a>`;
	if (kind === "state") return `${intro}${rows.map(row => `<h4>${escape(row["Candidate First Name and Middle Name"]!)}</h4><div class="candidate"></div>`).join("")}</section>`;
	return `${intro}${countyLabels.map(county => `<h2>${county}</h2>${rows.filter(row => row._county === county).map((row) => {
		const district = /District [A-Z\d]+$/u.test(row["Contest Run By District Name and Number"]!) ? row["Contest Run By District Name and Number"] : "";
		const name = row._htmlName ?? `${row["Candidate First Name and Middle Name"]} ${row["Candidate Ballot Last Name and Suffix"]}`;
		const heading = district ? `<h4>${district}</h4><h5>${escape(name)}</h5>` : `<h4>${escape(name)}</h4>`;
		return `<h3>${row["Office Name"]}</h3>${heading}<span>${row["Office Political Party"]}</span><div class="candidate"><dl><dt>Jurisdiction</dt><dd>${row["Candidate Residential Jurisdiction"]}</dd><dt>Status</dt><dd>${row["Candidate Status"]}</dd><dt>Address</dt><dd>PRIVATE-ADDRESS</dd></dl></div>`;
	}).join("")}`).join("")}</section>`;
}
function capture(kind: Kind, rows = [row()], year = "2026", years = ["2026", "2028"]) {
	return JSON.stringify({ schemaVersion: 1, type: "maryland-candidate-export", discovery: discovery(years), roster: roster(kind, rows, year), records: csv(rows) });
}
function futureSource(kind: Kind, year = "2028") {
	return stateBallotCycleSources(discoverStateBallotElectionCycles(discovery(["2026", "2028", "2030"]), original(kind).id, now), now).find(source => source.electionDate.startsWith(year))!;
}

for (const kind of ["state", "local"] as const) {
	test(`Maryland ${kind} future discovery follows published dates, labels and file codes without changing its original descriptor`, () => {
		const catalog = discoverStateBallotElectionCycles(discovery(), original(kind).id, now);
		assert.deepEqual(catalog.elections, [{ electionId: "2026_GG", electionDate: "2026-11-03" }, { electionId: "2028_PG", electionDate: "2028-11-07" }]);
		const source = stateBallotCycleSources(catalog, now)[0]!;
		assert.equal(source.url, marylandCandidateRosterUrl("2028_PG", kind));
		assert.equal(source.pageUrl, marylandCandidateRosterUrl("2028_PG", kind, "html"));
		assert.equal(source.id, `${kind === "state" ? "md-general" : "md-local-general"}-2028-11-07`);
		assert.equal(source.format, original(kind).format);
		assert.equal(parseStateCandidateRecords(source, capture(kind, [row()], "2028")).length, 1);
		const changed = structuredClone(catalog);
		changed.elections[1]!.electionId = "2026_PG";
		assert.throws(() => parseStateBallotCycleCatalog(changed, now));
	});
}

test("Maryland county context comes from the office sections, preserving names, alpha districts and separate same-name identities", () => {
	const rows = [row(), row({ "_county": "Baltimore City", "Candidate Residential Jurisdiction": "Another Home County" }), row({ "Candidate First Name and Middle Name": "Quote", "_htmlName": "\"Quote\" Example", "Office Name": "County Council", "Contest Run By District Name and Number": "Councilmanic District A" })];
	const records = parseStateCandidateRecords(original("local"), capture("local", rows));
	assert.equal(records.length, 3);
	assert.equal(new Set(records.map(record => record.id)).size, 3);
	assert.ok(records.every(record => record.scope === "local" && !record.jurisdiction));
	assert.equal(records[0]!.sourceAreaLabel, "Allegany County");
	assert.equal(records[1]!.sourceAreaLabel, "Baltimore City");
	assert.equal(records[2]!.name, "\"Quote\" Example");
	assert.equal(records[2]!.district, "A");
	assert.equal(records[2]!.sourceDistrictLabel, "Councilmanic District A");
	assert.equal(records[0]!.candidateUrl, "https://www.example.org/");
	assert.doesNotMatch(JSON.stringify(records), /PRIVATE-|Home County/u);
	assert.equal(buildStateBallotPreview({ source: original("local"), records, sha256: "a".repeat(64), retrievedAt: new Date(now).toISOString() }, { districtMatches: [] }), null);
	const result = buildStateRecordPage({ source: original("local"), records, sha256: "a".repeat(64), retrievedAt: new Date(now).toISOString() }, parseStateRecordFilters({ q: "Baltimore City" }));
	assert.equal(result.matched, 1);
});

test("Maryland explicitly empty office sections do not become candidate records", () => {
	const body = JSON.parse(capture("local"));
	body.roster = body.roster.replace("<h2>Baltimore City</h2>", "<h3>County Commissioner</h3><h4>Commissioner District 3</h4><p>No candidates have filed for this office.</p><hr><h2>Baltimore City</h2>");
	assert.equal(parseStateCandidateRecords(original("local"), JSON.stringify(body)).length, 1);
	assert.throws(() => parseStateCandidateRecords(original("local"), JSON.stringify({ ...body, roster: body.roster.replace("No candidates have filed for this office.", "Unexpected missing data") })), /no recognized detail block/u);
});

test("Maryland local inactive evidence wins duplicate lifecycle entries and unsafe links never become candidate websites", () => {
	const rows = [row(), row({ "Candidate Status": "Failed to Submit Required Number of Signatures - 08/04/2026" })];
	for (const order of [rows, [...rows].reverse()]) {
		const records = parseStateCandidateRecords(original("local"), capture("local", order));
		assert.equal(records.length, 1);
		assert.equal(records[0]!.status, "disqualified");
	}
	assert.equal(parseStateCandidateRecords(original("local"), capture("local", [row({ "Candidate Status": "Deceased - 08/13/2026" })]))[0]!.status, "inactive");
	assert.equal(parseStateCandidateRecords(original("local"), capture("local", [row({ Website: "javascript:alert(1)" })]))[0]!.candidateUrl, undefined);
});

test("Maryland keeps the approved legacy statewide CSV and joint ticket identities but requires complete evidence for future/local sources", () => {
	const rows = [row({ "Office Name": "Governor / Lt. Governor", "Related Candidate First Name and Middle Name": "Synthetic Mate", "Related Candidate Last Name and Suffix": "Example" })];
	const legacy = parseStateCandidateRecords(original("state"), csv(rows));
	assert.deepEqual(parseStateCandidateRecords(original("state"), capture("state", rows)), legacy);
	assert.equal(legacy[0]!.name, "Synthetic Example / Synthetic Mate Example");
	assert.throws(() => parseStateCandidateRecords(futureSource("state"), csv(rows)));
	assert.throws(() => parseStateCandidateRecords(original("local"), csv([row()])));
});

test("Maryland rejects conflicting dates, primary/control substitution, ambiguous county identity, missing sections and empty-data contradictions", () => {
	for (const mutate of [
		(body: string) => body.replace("November 03, 2026", "November 07, 2026"),
		(body: string) => body.replace("2026_GG_all_counties_candidatelist.html", "2026_GP_all_counties_candidatelist.html"),
		(body: string) => body.replace("Local Offices", "Unknown Offices"),
		(body: string) => body.replace("Office Name,", "Changed Column,"),
		(body: string) => body.replace("Allegany County</h2>", "Different Region</h2>"),
		(body: string) => body.replace("Download (CSV)", "Unsupported export"),
	]) assert.throws(() => parseStateCandidateRecords(original("local"), mutate(capture("local"))), error => error instanceof Error && !(error instanceof StateBallotAwaitingRecordsError));
	const duplicate = [row(), row({ _county: "Baltimore City" })];
	assert.throws(() => parseStateCandidateRecords(original("local"), capture("local", duplicate)), /uniquely reconciled/u);
	for (const kind of ["state", "local"] as const) {
		const body = JSON.parse(capture(kind));
		body.records = csv([]);
		assert.throws(() => parseStateCandidateRecords(original(kind), JSON.stringify(body)), error => error instanceof Error && !(error instanceof StateBallotAwaitingRecordsError));
		assert.throws(() => parseStateCandidateRecords(futureSource(kind), capture(kind, [], "2028")), StateBallotAwaitingRecordsError);
	}
});

test("Maryland collection follows only observed index/category/CSV controls and refuses changed identities before networking", async () => {
	const source = original("local");
	const bodies = new Map([[marylandDiscoveryUrl, indexPage(["2026"])], [`${marylandDiscoveryUrl}2026/index.html`, yearPage("2026")], [`${marylandDiscoveryUrl}2026/general_candidates/index.html`, candidateIndex("2026")], [source.pageUrl, roster("local", [row()])], [source.url, csv([row()])]]);
	const calls: string[] = [];
	const result = await fetchStateBallotSourceText(source, async (url, options) => {
		calls.push(url);
		assert.equal(options.maxRedirects, 0);
		assert.deepEqual(options.allowedHosts, ["elections.maryland.gov"]);
		assert.equal(options.postBody, undefined);
		const body = bodies.get(url);
		assert.ok(body);
		return body;
	});
	assert.equal(parseStateCandidateRecords(source, result).length, 1);
	assert.equal(calls.length, 5);
	let requests = 0;
	for (const changed of [{ ...source, id: "md-other" }, { ...source, pageUrl: `${source.pageUrl}?bypass=1` }, { ...source, url: source.url.replace("all_counties", "statewide") }]) {
		await assert.rejects(fetchStateBallotSourceText(changed, async () => {
			requests++;
			return "";
		}));
	}
	assert.equal(requests, 0);
	assert.throws(() => readMarylandElectionDiscovery(discovery().replace("https://elections.maryland.gov/elections/2028/index.html", "https://example.org/elections/2028/index.html"), "local"));
});

test("both Maryland families import independently, retain waiting receipts across runs, and preserve version-one import clocks", async () => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-md-automation-"));
	try {
		const sources = [original("state"), original("local")];
		const environment = { STATE_BALLOT_DATA_DIR: directory, STATE_BALLOT_ENABLED_STATES: "MD", STATE_BALLOT_ENABLED_SOURCES: sources.map(source => source.id).join(","), STATE_BALLOT_ENABLED_FAMILIES: sources.map(source => source.id).join(","), STATE_BALLOT_CYCLE_CATALOGS: JSON.stringify(Object.fromEntries(sources.map(source => [source.id, join(directory, `${source.id}-cycles.json`)]))) };
		let requests = 0;
		const options = { environment, now: () => now, fetchDiscovery: async () => discovery(), fetchText: async (source: StateBallotSource) => {
			requests++;
			return capture(source.format === "csv" ? "state" : "local", source.electionDate === "2026-11-03" ? [row()] : [], source.electionDate.slice(0, 4));
		} };
		const first = await refreshApprovedCandidateData(options);
		assert.equal(first.status, "succeeded");
		assert.deepEqual(first.results.map(result => result.status), ["imported", "cached", "imported", "cached"]);
		assert.deepEqual(first.results.map(result => result.records), [1, 0, 1, 0]);
		const waiting = futureSource("local");
		const before = await readFile(join(directory, `${waiting.id}.json.pending`), "utf8");
		const second = await refreshApprovedCandidateData({ ...options, now: () => now + 1 });
		assert.equal(second.status, "succeeded");
		assert.ok(second.results.every(result => result.status === "cached"));
		assert.equal(second.lastImportAt, first.lastImportAt);
		assert.equal(second.lastSuccessAt, first.lastSuccessAt);
		assert.equal(requests, 4);
		assert.equal(await readFile(join(directory, `${waiting.id}.json.pending`), "utf8"), before);
		assert.deepEqual(await readAutomationRun(directory, now + 1), second);
		const storage = createStateBallotStorage(directory);
		assert.equal(await storage.read(waiting), null);
		assert.ok(await storage.readPending(waiting, now + 1));
		const acquiredAt = now + 4 * 3600000 + 1;
		const acquired = await refreshApprovedCandidateData({ ...options, now: () => acquiredAt, fetchText: async source => capture(source.format === "csv" ? "state" : "local", [row()], source.electionDate.slice(0, 4)) });
		assert.equal(acquired.status, "succeeded");
		assert.ok(acquired.results.every(result => result.status === "imported" && result.records === 1));
		assert.equal(acquired.lastImportAt, new Date(acquiredAt).toISOString());
		const accepted = await readFile(join(directory, `${waiting.id}.json`), "utf8");
		const failed = createStateBallotRepository({ sources: [waiting], dataDirectory: directory, now: () => acquiredAt + 4 * 3600000 + 1, fetchText: async () => capture("local", [], "2028") });
		assert.equal(await failed.getSnapshot("MD", waiting.id), null);
		assert.equal(failed.isAwaitingRecords!(waiting.id), false);
		assert.equal(await readFile(join(directory, `${waiting.id}.json`), "utf8"), accepted);
	}
	finally { await rm(directory, { recursive: true, force: true }); }
});

test("after the old election expires, default browsing selects the nearest published election and never silently substitutes later filings", async () => {
	const early = futureSource("state");
	const later = futureSource("state", "2030");
	const clock = Date.parse("2027-01-01T00:00:00Z");
	const requested: string[] = [];
	const repository = createStateBallotRepository({ sources: [original("state"), later, early], dataDirectory: null, now: () => clock, fetchText: async (source) => {
		requested.push(source.id);
		return capture("state", source.id === early.id ? [] : [row()], source.electionDate.slice(0, 4), ["2026", "2028", "2030"]);
	} });
	assert.equal(await repository.getSnapshot("MD"), null);
	assert.deepEqual(requested, [early.id]);
	assert.equal(repository.isAwaitingRecords!(early.id), true);
	const app = express();
	registerStateRecordRoutes(app, repository, undefined, () => clock);
	const server = app.listen(0, "127.0.0.1");
	await once(server, "listening");
	try {
		const address = server.address();
		assert.ok(address && typeof address === "object");
		const origin = `http://127.0.0.1:${address.port}`;
		const directory = await (await fetch(`${origin}/api/state-records`)).json();
		assert.equal(directory.states.find((state: { stateCode: string }) => state.stateCode === "MD").sources[0].id, early.id);
		const current = await (await fetch(`${origin}/api/state-records/MD`)).json();
		assert.equal(current.awaitingRecords, true);
		assert.equal(current.source.id, early.id);
		assert.equal(current.source.electionDate, "2028-11-07");
		const future = await (await fetch(`${origin}/api/state-records/MD?source=${later.id}`)).json();
		assert.equal(future.available, true);
		assert.equal(future.source.electionDate, "2030-11-05");
	}
	finally { await new Promise<void>((accept, reject) => server.close(error => error ? reject(error) : accept())); }
});
