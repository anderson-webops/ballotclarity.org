import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import express from "express";
import { refreshApprovedCandidateData } from "../src/state-ballot-automation.js";
import { fetchStateBallotCycleDiscovery, syncStateBallotCycles } from "../src/state-ballot-cycle-sync.js";
import { discoverStateBallotElectionCycles, parseStateBallotCycleCatalog, stateBallotCycleSources } from "../src/state-ballot-cycles.js";
import { fetchStateBallotSourceText } from "../src/state-ballot-fetch.js";
import { northCarolinaCandidateCapture, northCarolinaCandidateCsvUrl, northCarolinaDiscoveryUrl, readNorthCarolinaCandidateIndex, readNorthCarolinaElectionDiscovery } from "../src/state-ballot-north-carolina.js";
import { parseStateCandidateRecords } from "../src/state-ballot-records.js";
import { configuredStateBallotSources } from "../src/state-ballot-registry.js";
import { buildStateBallotPreview, createStateBallotRepository } from "../src/state-ballot-repository.js";
import { createStateBallotStorage } from "../src/state-ballot-storage.js";
import { registerStateRecordRoutes } from "../src/state-records.js";

const original = configuredStateBallotSources.find(source => source.id === "nc-sbe-2026")!;
const now = Date.parse("2026-10-25T12:00:00Z");
const date = (year: string) => `${year}-11-${year === "2028" ? "07" : "03"}`;
const headers = "election_dt|county_name|contest_name|name_on_ballot|first_name|middle_name|last_name|name_suffix_lbl|nick_name|street_address|city|state|zip_code|phone|office_phone|business_phone|email|candidacy_dt|party_contest|party_candidate|is_unexpired|has_primary|is_partisan|vote_for|term".split("|");
const row = (year: string, overrides: Record<string, string> = {}) => ({ election_dt: `${year === "2028" ? "11/07" : "11/03"}/${year}`, county_name: "Example County", contest_name: "US SENATE", name_on_ballot: "Synthetic Candidate", party_candidate: "UNA", has_primary: "FALSE", street_address: "PRIVATE-ADDRESS", phone: "PRIVATE-PHONE", email: "PRIVATE-EMAIL", ...overrides });
const csv = (year: string, rows = [row(year)]) => `${headers.join(",")}\n${rows.map(row => headers.map(header => row[header as keyof typeof row] ?? "").map(value => `"${value.replaceAll("\"", "\"\"")}"`).join(",")).join("\n")}\n`;
const index = (years = ["2026", "2028"]) => `<h1>Candidate Lists</h1><table><caption>Table 1: North Carolina Candidate Detail List Files for ${years.at(-1)} Elections</caption><tr>${["Election Year", "Candidate List Spreadsheets", "Candidate Lists by Contest", "Candidate Detail Lists"].map(label => `<th>${label}</th>`).join("")}</tr>${years.map(year => `<tr><td>${year}</td><td><a href="${northCarolinaCandidateCsvUrl(date(year))}">${year} Candidate List Spreadsheet (CSV)</a></td><td><a href="https://s3.amazonaws.com/dl.ncsbe.gov/Elections/${year}/Candidate%20Filing/${year}_general_candidate_list_by_contest.pdf">${year} General Candidate List by Contest (PDF)</a></td><td></td></tr>`).join("")}</table>`;
const discovery = (years = ["2026", "2028"]) => JSON.stringify({ schemaVersion: 1, type: "north-carolina-election-discovery", index: index(years), exports: years.map(year => ({ year, url: northCarolinaCandidateCsvUrl(date(year)), records: csv(year) })) });
const future = () => stateBallotCycleSources(discoverStateBallotElectionCycles(discovery(), original.id, now), now)[0]!;

test("North Carolina discovers actual row dates behind published general-year controls without changing its current descriptor", () => {
	const catalog = discoverStateBallotElectionCycles(discovery(), original.id, now);
	assert.deepEqual(catalog.elections, [{ electionId: null, electionDate: "2026-11-03" }, { electionId: null, electionDate: "2028-11-07" }]);
	assert.equal(future().id, "nc-general-2028-11-07");
	assert.equal(future().pageUrl, original.pageUrl);
	assert.equal(future().url, northCarolinaCandidateCsvUrl("2028-11-07"));
	assert.equal(future().format, original.format);
	assert.equal(parseStateCandidateRecords(future(), northCarolinaCandidateCapture(future(), discovery()))[0]!.name, "Synthetic Candidate");
	assert.throws(() => parseStateBallotCycleCatalog({ ...catalog, elections: [{ electionId: null, electionDate: "2028-03-07" }] }, now));
});

test("North Carolina keeps mixed-year primary records out of the general roster and excludes private columns", () => {
	const capture = JSON.parse(discovery());
	capture.exports[0].records = csv("2026", [row("2026"), row("2026", { county_name: "Another County" }), row("2026", { election_dt: "03/03/2026", has_primary: "TRUE", name_on_ballot: "Primary Only" }), row("2026", { contest_name: "COUNTY COMMISSIONER DISTRICT 1", name_on_ballot: "Local Candidate" })]);
	const records = parseStateCandidateRecords(original, northCarolinaCandidateCapture(original, JSON.stringify(capture)));
	assert.equal(records.length, 2);
	assert.equal(records[0]!.status, "listed");
	assert.equal(records[0]!.party, "UNA");
	assert.equal(records[1]!.scope, "local");
	assert.doesNotMatch(JSON.stringify(records), /PRIVATE-|Primary Only|street_address|phone|email/u);
	assert.equal(buildStateBallotPreview({ source: original, records: [records[1]!], sha256: "a".repeat(64), retrievedAt: new Date(now).toISOString() }, { districtMatches: [] }), null);
	const legacy = csv("2026");
	assert.deepEqual(parseStateCandidateRecords(original, legacy), parseStateCandidateRecords(original, northCarolinaCandidateCapture(original, discovery(["2026"]))));
	assert.throws(() => parseStateCandidateRecords(future(), csv("2028")));
});

test("North Carolina rejects substituted controls, duplicated years and unsupported or incomplete publication context", () => {
	for (const page of [index().replace("Candidate Lists", "Changed"), index().replace("Election Year", "Year"), index().replace("Candidate_Listing_2028.csv", "Other_2028.csv"), index().replace("s3.amazonaws.com/dl.ncsbe.gov/Elections/2028", "evil.example/Elections/2028"), index(["2026", "2026"]), index().replace("2028 General Candidate List by Contest (PDF)", "2028 Primary Candidate List by Contest (PDF)")]) {
		if (page.includes("2028 Primary")) assert.deepEqual(readNorthCarolinaCandidateIndex(page).map(entry => entry.year), ["2026"]);
		else assert.throws(() => readNorthCarolinaCandidateIndex(page));
	}
	const missing = JSON.parse(discovery());
	missing.exports.pop();
	assert.throws(() => readNorthCarolinaElectionDiscovery(JSON.stringify(missing)));
});

test("North Carolina refuses schema drift, contradictory primary flags, false dates and empty general exports", () => {
	for (const records of [csv("2028", []), csv("2028").replace("has_primary", "changed"), csv("2028", [row("2028", { has_primary: "TRUE" })]), csv("2028", [row("2028", { has_primary: "UNKNOWN" })]), csv("2028", [row("2028", { election_dt: "11/04/2028" })]), csv("2028", [row("2028", { election_dt: "11/07/2030" })]), csv("2028", [row("2028", { election_dt: "02/30/2028" })]), csv("2028", [row("2028", { name_on_ballot: "" })])]) {
		const value = JSON.parse(discovery());
		value.exports[1].records = records;
		assert.throws(() => readNorthCarolinaElectionDiscovery(JSON.stringify(value)));
	}
	const value = JSON.parse(northCarolinaCandidateCapture(future(), discovery()));
	assert.throws(() => parseStateCandidateRecords(future(), JSON.stringify({ ...value, url: original.url })));
	assert.throws(() => parseStateCandidateRecords(future(), JSON.stringify({ ...value, extra: true })));
});

test("North Carolina fetches only offered controls with zero redirects and validates source identity before requests", async () => {
	const requests: string[] = [];
	const request = async (source: string | URL, options: { maxRedirects?: number } = {}) => {
		const url = String(source);
		requests.push(url);
		assert.equal(options.maxRedirects, 0);
		if (url === northCarolinaDiscoveryUrl) return index();
		return csv(url.includes("2028") ? "2028" : "2026");
	};
	const body = await fetchStateBallotCycleDiscovery(request, original.id);
	assert.equal(readNorthCarolinaElectionDiscovery(body).length, 2);
	assert.deepEqual(requests, [northCarolinaDiscoveryUrl, original.url, future().url]);
	requests.length = 0;
	assert.equal(parseStateCandidateRecords(future(), await fetchStateBallotSourceText(future(), request)).length, 1);
	assert.deepEqual(requests, [northCarolinaDiscoveryUrl, future().url]);
	for (const changed of [{ ...future(), id: "nc-fake" }, { ...future(), url: "https://evil.example/data.csv" }, { ...future(), pageUrl: "https://www.ncsbe.gov/admin/" }]) {
		requests.length = 0;
		await assert.rejects(fetchStateBallotSourceText(changed, request));
		assert.equal(requests.length, 0);
	}
});

test("North Carolina reuses each discovery capture for durable imports and preserves clocks on cached runs", async () => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-nc-automation-"));
	try {
		const catalogPath = join(directory, "cycles.json");
		const environment = { STATE_BALLOT_DATA_DIR: directory, STATE_BALLOT_ENABLED_STATES: "NC", STATE_BALLOT_ENABLED_SOURCES: original.id, STATE_BALLOT_ENABLED_FAMILIES: original.id, STATE_BALLOT_CYCLE_CATALOGS: JSON.stringify({ [original.id]: catalogPath }) };
		let discoveries = 0;
		const options = { environment, now: () => now, fetchDiscovery: async () => {
			discoveries++;
			return discovery();
		} };
		const first = await refreshApprovedCandidateData(options);
		assert.equal(first.status, "succeeded");
		assert.deepEqual(first.results.map(result => result.status), ["imported", "imported"]);
		const second = await refreshApprovedCandidateData({ ...options, now: () => now + 1 });
		assert.ok(second.results.every(result => result.status === "cached"));
		assert.equal(second.lastImportAt, first.lastImportAt);
		assert.equal(second.lastSuccessAt, first.lastSuccessAt);
		assert.equal(discoveries, 2);
		const stored = await readFile(join(directory, `${future().id}.json`));
		const catalog = await readFile(catalogPath);
		await assert.rejects(syncStateBallotCycles({ familyId: original.id, catalogPath, dataDirectory: directory, now: () => now + 4 * 3600000 + 1, fetchDiscovery: async () => discovery(["2026"]) }));
		assert.deepEqual(await readFile(catalogPath), catalog);
		assert.deepEqual(await readFile(join(directory, `${future().id}.json`)), stored);
		await assert.rejects(syncStateBallotCycles({ familyId: original.id, catalogPath, dataDirectory: directory, now: () => now + 1, fetchDiscovery: async () => {
			throw new Error("Denied");
		} }));
		assert.deepEqual(await readFile(catalogPath), catalog);
	}
	finally { await rm(directory, { recursive: true, force: true }); }
});

test("North Carolina catalog rollover cold-loads future data, preserves current source IDs and binds API source filters", async () => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-nc-api-"));
	try {
		const source = future();
		const storage = createStateBallotStorage(directory);
		const clock = Date.parse("2027-01-01T00:00:00Z");
		await storage.write({ source, retrievedAt: new Date(clock - 1000).toISOString(), sha256: "a".repeat(64), records: parseStateCandidateRecords(source, northCarolinaCandidateCapture(source, discovery())) });
		const repository = createStateBallotRepository({ sources: [original, source], dataDirectory: directory, now: () => clock, ttlMs: 86400000, fetchText: async () => {
			throw new Error("Live providers disabled");
		} });
		assert.equal((await repository.getSnapshot("NC"))!.source.id, source.id);
		const app = express();
		registerStateRecordRoutes(app, repository, undefined, () => clock);
		const server = app.listen(0, "127.0.0.1");
		await once(server, "listening");
		try {
			const address = server.address();
			assert.ok(address && typeof address === "object");
			const origin = `http://127.0.0.1:${address.port}`;
			const payload = await (await fetch(`${origin}/api/state-records/NC`)).json();
			assert.equal(payload.source.id, source.id);
			assert.equal(payload.records[0].name, "Synthetic Candidate");
			assert.equal((await fetch(`${origin}/api/state-records/MD?source=${source.id}`)).status, 400);
		}
		finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
	}
	finally { await rm(directory, { recursive: true, force: true }); }
});
