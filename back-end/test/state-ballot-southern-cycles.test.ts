import type { StateBallotSource } from "../src/state-ballot-sources.js";
import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import test from "node:test";
import express from "express";
import { refreshApprovedCandidateData } from "../src/state-ballot-automation.js";
import { fetchStateBallotCycleDiscovery, syncStateBallotCycleFamilies, syncStateBallotCycles } from "../src/state-ballot-cycle-sync.js";
import { discoverStateBallotElectionCycles, parseStateBallotCycleCatalog, stateBallotCycleSources } from "../src/state-ballot-cycles.js";
import { fetchStateBallotSourceText } from "../src/state-ballot-fetch.js";
import { buildSouthCarolinaSearchForm } from "../src/state-ballot-portal-records.js";
import { parseStateCandidateRecords } from "../src/state-ballot-records.js";
import { createStateBallotRepository, resolveStateBallotConfiguration } from "../src/state-ballot-repository.js";
import { stateBallotSources } from "../src/state-ballot-sources.js";
import { buildFloridaCandidateForm, floridaCandidatePostBody, southCarolinaDiscoveryUrl, southCarolinaElectionsUrl, southCarolinaScriptUrl, southCarolinaYearsUrl } from "../src/state-ballot-southern.js";
import { createStateBallotStorage } from "../src/state-ballot-storage.js";
import { registerStateRecordRoutes } from "../src/state-records.js";

type State = "FL" | "SC";
const now = Date.parse("2026-10-24T12:00:00.000Z");
const original = (state: State) => stateBallotSources.find(source => source.stateCode === state)!;
const selected = (state: State, future = false) => ({ electionId: state === "FL" ? future ? "20281107-GEN" : "20261103-GEN" : future ? "44596" : "22596", electionDate: future ? "2028-11-07" : "2026-11-03" });
const floridaPage = (future = false) => `<form name="CanDownload" action="extractCanList.asp" method="post"><select name="elecID"><option value="20261103-GEN">2026 Election</option>${future ? "<option value=\"20281107-GEN\">2028 Election</option>" : ""}<option value="20261103-S01">2026 Special: Senate 21</option></select><select name="office"><option value="All">ALL</option></select><select name="status"><option value="All">ALL</option></select><select name="cantype"><option value="STA">State Candidates</option><option value="LOC">Local Candidates</option></select><input type="submit" name="FormSubmit" value="Download Candidate List"></form>`;
const carolinaIndex = "<form id=\"SelectElectionForm\" method=\"post\"><select name=\"ElectionKindSid\"><option value=\"General\">Statewide Primaries and General Elections</option></select></form><script src=\"/js/Candidate/SelectElection.js\"></script>";
const carolinaScript = "url: '/Candidate/GetYearsByElectionType?electionType=' + electionType; url: '/Candidate/GetElections?electionType=' + electionType + '&year=' + electionYear";
function discovery(state: State, future = false) {
	if (state === "FL") return floridaPage(future);
	const elections = [selected(state), ...(future ? [selected(state, true)] : [])];
	return JSON.stringify({ page: carolinaIndex, script: carolinaScript, years: JSON.stringify(elections.map(entry => ({ electionYear: Number(entry.electionDate.slice(0, 4)) }))), elections: elections.map(entry => ({ url: southCarolinaElectionsUrl(entry.electionDate.slice(0, 4)), body: JSON.stringify([{ electionId: entry.electionId, electionName: "Statewide General Election", displayName: `11/${Number(entry.electionDate.slice(8))}/${entry.electionDate.slice(0, 4)} Statewide General Election`, electionDate: `${entry.electionDate}T00:00:00`, filingPeriodBeginDate: `${entry.electionDate.slice(0, 4)}-03-16T12:00:00` }]) })) });
}
function carolinaPage(future = false) {
	const entry = selected("SC", future);
	return `<form id="searchForm"><h2>11/${Number(entry.electionDate.slice(8))}/${entry.electionDate.slice(0, 4)} Statewide General Election</h2><input name="ElectionId" value="${entry.electionId}"><input name="ExportFileName" value="Candidate Data File for ${entry.electionId}_11_${entry.electionDate.slice(8)}_${entry.electionDate.slice(0, 4)} Statewide General Election">${["SelectedOffice", "SelectedCandidateStatus", "SelectedPoliticalParty", "SelectedFilingLocation"].map(name => `<select name="${name}"><option value="${name === "SelectedOffice" ? "-1" : ""}">All</option></select>`).join("")}</form>`;
}
function candidates(state: State, future = false) {
	const entry = selected(state, future);
	if (state === "FL") return `ElectionID\tOfficeDesc\tStatusCode\tStatusDesc\tNameFirst\tNameLast\tJuris1num\tPartyCode\tPartyDesc\n${entry.electionId}\tState Senator\tQUA\tQualified\tSynthetic\tSenator\t07\tDEM\tDemocratic\n${entry.electionId}\tGovernor\tWIT\tWithdrawn\tSynthetic\tWithdrawn\t\tREP\tRepublican\n${entry.electionId}\tGovernor\tQUA\tQualified\tSynthetic\tGovernor\t\tNPA\tNo Party Affiliation\n`;
	const rows = [
		["State Senate, District 7", "Alpha", "Synthetic Senator", "", "Democratic", "Active"],
		["County Council, District 7", "Alpha", "Synthetic Local", "", "Republican", "Active"],
		["County Council, District 7", "Beta", "Synthetic Local", "", "Republican", "Withdrew"],
		["President and Vice President", "Statewide", "Synthetic President", "Synthetic Vice President (Active)", "Example", "Active"],
	];
	return JSON.stringify({ page: carolinaPage(future), records: `<input id="ElectionId" value="${entry.electionId}"><table id="gridCandidateSearch"><thead><tr>${["Office", "Associated Counties", "Name on Ballot", "Running Mate", "Party", "Location of Filing", "Candidate Status"].map(label => `<th>${label}</th>`).join("")}</tr></thead><tbody>${rows.map((row, index) => `<tr data-key="${index + 1}" data-index="${index}"><td>${row[0]}</td><td>${row[1]}</td><td><a href="/Candidate/CandidateDetail/?candidateId=${index + 1}&amp;electionId=${entry.electionId}">${row[2]}</a></td><td>${row[3]}</td><td>${row[4]}</td><td>State</td><td>${row[5]}</td></tr>`).join("")}</tbody></table>` });
}
function futureSource(state: State) {
	return stateBallotCycleSources(discoverStateBallotElectionCycles(discovery(state, true), original(state).id, now), now)[0]!;
}

for (const state of ["FL", "SC"] as const) {
	test(`${state} discovers published general elections and retains its original descriptor`, () => {
		const catalog = discoverStateBallotElectionCycles(discovery(state, true), original(state).id, now);
		assert.deepEqual(catalog.elections, [selected(state), selected(state, true)]);
		const future = stateBallotCycleSources(catalog, now)[0]!;
		assert.equal(future.id, `${state.toLowerCase()}-general-2028-11-07`);
		assert.equal(future.electionDate, "2028-11-07");
		assert.equal(original(state).electionDate, "2026-11-03");
		if (state === "FL") assert.equal(future.postBody, floridaCandidatePostBody("20281107-GEN"));
		else assert.ok(future.url.endsWith("electionId=44596"));
		assert.throws(() => parseStateBallotCycleCatalog({ ...catalog, elections: [catalog.elections[0], catalog.elections[0]] }, now));
		assert.throws(() => parseStateBallotCycleCatalog({ ...catalog, elections: [{ electionId: selected(state).electionId, electionDate: "2028-11-07" }] }, now));
		assert.throws(() => discoverStateBallotElectionCycles(discovery(state, true).replaceAll("2028", "2027"), original(state).id, now));
	});

	test(`${state} collects only exact reviewed public forms and rejects unbound identities before requests`, async () => {
		const future = futureSource(state);
		const requests: string[] = [];
		const body = await fetchStateBallotSourceText(future, async (url, options) => {
			assert.deepEqual(options.allowedHosts, [new URL(future.url).hostname]);
			assert.equal(options.maxRedirects, 0);
			requests.push(String(url));
			if (!options.postBody) return state === "FL" ? floridaPage(true) : carolinaPage(true);
			if (state === "FL") assert.equal(options.postBody, future.postBody);
			else assert.equal(new URLSearchParams(options.postBody).get("ElectionId"), "44596");
			return state === "FL" ? candidates(state, true) : JSON.parse(candidates(state, true)).records;
		});
		assert.equal(requests.length, 2);
		assert.equal(parseStateCandidateRecords(future, body).length, state === "FL" ? 3 : 4);
		for (const source of [{ ...future, id: original(state).id }, { ...future, url: `${future.url}&county=1` }, { ...future, electionDate: "2027-11-02" }, { ...future, postBody: "unapproved=1" }]) {
			await assert.rejects(fetchStateBallotSourceText(source, async () => {
				assert.fail("Invalid identities must not contact the publisher");
			}));
		}
	});

	test(`${state} retains withdrawal, party and district evidence without deriving local eligibility`, () => {
		const source = futureSource(state);
		const records = parseStateCandidateRecords(source, candidates(state, true));
		assert.equal(records[0]!.scope, "state-senate");
		assert.equal(records[0]!.district, "7");
		assert.equal(records[0]!.party, "Democratic");
		assert.ok(records.some(record => record.status === "withdrawn"));
		assert.throws(() => parseStateCandidateRecords(source, candidates(state)));
		if (state === "SC") {
			assert.equal(records[1]!.scope, "local");
			assert.equal(records[1]!.jurisdiction, "Alpha");
			assert.notEqual(records[1]!.id, records[2]!.id);
			assert.equal(records[3]!.name, "Synthetic President / Synthetic Vice President");
			assert.equal(records[3]!.scope, "statewide");
			const undesignated = parseStateCandidateRecords(source, candidates(state, true).replace("Synthetic Vice President (Active)", "Not Designated"));
			assert.equal(undesignated[3]!.name, "Synthetic President");
			assert.throws(() => parseStateCandidateRecords(source, candidates(state, true).replace("State Senate, District 7", "State Senate, District 47")));
		}
	});
}

test("Florida rejects changed or ambiguous download controls and distinguishes special elections", () => {
	const source = futureSource("FL");
	assert.equal(buildFloridaCandidateForm(source, `<table>${floridaPage(true)}</table>`), source.postBody);
	for (const changed of [floridaPage(true).replace("extractCanList.asp", "https://example.com/candidates"), floridaPage(true).replace("State Candidates", "Unknown Candidates"), floridaPage(true).replace("Download Candidate List", "Export"), floridaPage(true).replace("2028 Election", "2026 Election"), floridaPage(true).replace("</form>", "<select name=\"unreviewed\"></select></form>")]) assert.throws(() => buildFloridaCandidateForm(source, changed));
	const catalog = discoverStateBallotElectionCycles(floridaPage(), original("FL").id, now);
	assert.deepEqual(catalog.elections, [selected("FL")]);
	assert.throws(() => buildFloridaCandidateForm(source, floridaPage()));
	assert.throws(() => buildFloridaCandidateForm({ ...source, postBody: source.postBody!.replace("cantype=STA", "cantype=LOC") }, floridaPage(true)));
});

test("South Carolina discovers only observed public years and fixed selector endpoints", async () => {
	const captured = JSON.parse(discovery("SC", true));
	const requests: string[] = [];
	const body = await fetchStateBallotCycleDiscovery(async (url, options) => {
		assert.ok(options);
		assert.equal(options.maxRedirects, 0);
		requests.push(String(url));
		if (url === southCarolinaDiscoveryUrl) return captured.page;
		if (url === southCarolinaScriptUrl) return captured.script;
		if (url === southCarolinaYearsUrl) return captured.years;
		return captured.elections.find((entry: { url: string }) => entry.url === url)!.body;
	}, original("SC").id);
	assert.equal(requests.length, 5);
	assert.deepEqual(discoverStateBallotElectionCycles(body, original("SC").id, now).elections, [selected("SC"), selected("SC", true)]);
	for (const changed of [body.replace("GetElections?", "UnknownEndpoint?"), body.replace("SelectElectionForm", "OtherForm"), body.replace("year=2028", "year=2030"), body.replace("2028-11-07T00:00:00", "2028-11-08T00:00:00")]) assert.throws(() => discoverStateBallotElectionCycles(changed, original("SC").id, now));
	assert.throws(() => buildSouthCarolinaSearchForm(futureSource("SC"), carolinaPage()));
});

test("both southern families import future elections unattended, cache durable snapshots and isolate failures", async () => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-southern-cycles-"));
	const environment = { ...process.env };
	let server: ReturnType<ReturnType<typeof express>["listen"]> | undefined;
	try {
		let clock = now;
		let downloads = 0;
		const dataDirectory = join(directory, "data");
		const configurations = (["FL", "SC"] as const).map(state => ({ familyId: original(state).id, catalogPath: join(directory, `${state}.json`), dataDirectory, now: () => clock, fetchDiscovery: async () => discovery(state), fetchCandidates: async () => {
			downloads++;
			return candidates(state);
		} }));
		assert.ok((await syncStateBallotCycleFamilies(configurations)).every(result => result.status === "completed"));
		const originalCatalogs = await Promise.all(configurations.map(configuration => readFile(configuration.catalogPath)));
		for (const configuration of configurations) await assert.rejects(syncStateBallotCycles({ ...configuration, fetchDiscovery: async () => "{}" }));
		assert.deepEqual(await Promise.all(configurations.map(configuration => readFile(configuration.catalogPath))), originalCatalogs);
		clock = Date.parse("2028-10-24T12:00:00.000Z");
		const futureConfigurations = configurations.map((configuration, index) => ({ ...configuration, fetchDiscovery: async () => discovery(index ? "SC" : "FL", true), fetchCandidates: async (source: StateBallotSource) => {
			downloads++;
			assert.equal(source.electionDate, "2028-11-07");
			return candidates(index ? "SC" : "FL", true);
		} }));
		assert.ok((await syncStateBallotCycleFamilies(futureConfigurations)).every(result => result.status === "completed"));
		assert.equal(downloads, 4);
		process.env.STATE_BALLOT_CYCLE_CATALOGS = JSON.stringify(Object.fromEntries(configurations.map(configuration => [configuration.familyId, configuration.catalogPath])));
		process.env.STATE_BALLOT_DATA_DIR = dataDirectory;
		process.env.STATE_BALLOT_ENABLED_FAMILIES = "fl-doe-2026,sc-sec-2026";
		process.env.STATE_BALLOT_ENABLED_STATES = "FL,SC";
		process.env.STATE_BALLOT_ENABLED_SOURCES = "fl-doe-2026,sc-sec-2026";
		delete process.env.STATE_BALLOT_CYCLE_CATALOG;
		const resolved = resolveStateBallotConfiguration(process.env, clock);
		const futures = (["FL", "SC"] as const).map(state => resolved.sources.find(source => source.id === `${state.toLowerCase()}-general-2028-11-07`)!);
		assert.ok(futures.every(Boolean));
		assert.ok(!resolveStateBallotConfiguration({ ...process.env, STATE_BALLOT_ENABLED_FAMILIES: undefined }, clock).sources.some(source => futures.some(future => future.id === source.id)));
		assert.throws(() => resolveStateBallotConfiguration({ ...process.env, STATE_BALLOT_ENABLED_STATES: "FL" }, clock));
		const storage = createStateBallotStorage(dataDirectory);
		const accepted = await Promise.all(futures.map(source => storage.read(source)));
		const repository = createStateBallotRepository({ now: () => clock, fetchText: async () => {
			assert.fail("Cold reads must use durable accepted data");
		} });
		const app = express();
		registerStateRecordRoutes(app, repository);
		server = app.listen(0, "127.0.0.1");
		await once(server, "listening");
		const address = server.address();
		assert.ok(address && typeof address === "object");
		for (const [index, source] of futures.entries()) {
			const response: Response = await fetch(`http://127.0.0.1:${address.port}/api/state-records/${source.stateCode}?source=${source.id}&status=all`);
			assert.equal(response.status, 200);
			const body = await response.json();
			assert.equal(body.source.electionDate, "2028-11-07");
			assert.equal(body.total, index ? 4 : 3);
		}
		const refreshed = await refreshApprovedCandidateData({ environment: process.env, now: () => clock, fetchDiscovery: async familyId => discovery(familyId === original("FL").id ? "FL" : "SC", true), fetchText: async () => {
			assert.fail("Fresh snapshots must not be collected twice");
		} });
		assert.equal(refreshed.status, "succeeded");
		assert.ok(refreshed.results.every(result => ["cached", "expired"].includes(result.status)));
		const independent = await syncStateBallotCycleFamilies(futureConfigurations.map((configuration, index) => index
			? configuration
			: { ...configuration, fetchDiscovery: async () => {
					throw new Error("403: publisher access denied");
				} }));
		assert.equal(independent[0]!.status, "failed");
		assert.equal(independent[1]!.status, "completed");
		clock += 5 * 3600000;
		for (const [index, configuration] of futureConfigurations.entries()) {
			const failed = await syncStateBallotCycles({ ...configuration, fetchCandidates: async () => candidates(index ? "SC" : "FL") });
			assert.equal(failed.results.find(result => result.electionDate === "2028-11-07")!.status, "unavailable");
			assert.deepEqual(await storage.read(futures[index]!), accepted[index]);
		}
	}
	finally {
		if (server?.listening) await new Promise<void>((resolve, reject) => server!.close(error => error ? reject(error) : resolve()));
		for (const key of Object.keys(process.env)) {
			if (!(key in environment)) delete process.env[key];
		}
		Object.assign(process.env, environment);
		await rm(directory, { recursive: true, force: true });
	}
});
