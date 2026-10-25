import type { DakotaState } from "../src/state-ballot-dakota.js";
import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import test from "node:test";
import express from "express";
import { refreshApprovedCandidateData } from "../src/state-ballot-automation.js";
import { fetchStateBallotCycleDiscovery, syncStateBallotCycleFamilies, syncStateBallotCycles } from "../src/state-ballot-cycle-sync.js";
import { discoverStateBallotElectionCycles, parseStateBallotCycleCatalog, stateBallotCycleSources } from "../src/state-ballot-cycles.js";
import { dakotaCandidateRosterUrl, dakotaDiscoveryUrl } from "../src/state-ballot-dakota.js";
import { buildNorthDakotaSearchForm, buildPublicStateExportForm, fetchStateBallotSourceText } from "../src/state-ballot-fetch.js";
import { parseStateCandidateRecords } from "../src/state-ballot-records.js";
import { configuredStateBallotSources } from "../src/state-ballot-registry.js";
import { createStateBallotRepository, resolveStateBallotConfiguration } from "../src/state-ballot-repository.js";
import { createStateBallotStorage } from "../src/state-ballot-storage.js";
import { registerStateRecordRoutes } from "../src/state-records.js";

const now = Date.parse("2026-10-24T12:00:00.000Z");
const originals = Object.fromEntries((["SD", "ND"] as const).map(state => [state, configuredStateBallotSources.find(source => source.stateCode === state)!]));
interface Election { year: string; day: string; electionId: string }
const election = (state: DakotaState, future = false): Election => ({ year: future ? "2028" : "2026", day: future ? "7" : "3", electionId: future ? (state === "SD" ? "9774" : "9348") : (state === "SD" ? "774" : "348") });
const calendarUrl = (state: DakotaState, year: string) => state === "SD" ? `https://sdsos.gov/elections-voting/upcoming-elections/general-information/${year}%20Election%20Information/${year}-Election-Information.aspx` : "https://www.sos.nd.gov/elections/candidate/candidate-calendar";
function index(state: DakotaState, entries = [election(state)]) {
	if (state === "ND") return `<h1>Candidate</h1><a href="/elections/candidate/candidate-calendar">Candidate Calendar</a>${entries.map(entry => `<a href="${dakotaCandidateRosterUrl(state, entry.electionId)}"><h3>Election Contests &amp; Candidates</h3><p>View candidates and contests on the ballot for the ${entry.year} General Election.</p></a>`).join("")}`;
	const sections = entries.map(entry => `<li><a href="/elections-voting/upcoming-elections/general-information/${entry.year}%20Election%20Information/default.aspx">${entry.year} Election Information</a><ul><li><a href="${dakotaCandidateRosterUrl(state, entry.electionId)}">Candidate List</a></li><li><a href="${calendarUrl(state, entry.year)}">Election Calendar</a></li></ul></li>`).join("");
	return `<nav><ul>${sections}</ul></nav><aside><ul>${sections}</ul></aside>`;
}
function calendar(state: DakotaState, entries = [election(state)]) {
	if (state === "ND") return `<h1>Candidate Calendar</h1>${entries.map(entry => `<h2><strong>November ${entry.day}, ${entry.year} – General Election</strong></h2>`).join("")}`;
	return `<h1>${entries[0]!.year} Election Calendar</h1><p>Primary Election Date: June 2, ${entries[0]!.year}<br><strong>General Election Date:</strong> November ${entries[0]!.day}, ${entries[0]!.year}</p>`;
}
function discovery(state: DakotaState, entries = [election(state)]) {
	return JSON.stringify({ page: index(state, entries), calendars: [...new Set(entries.map(entry => calendarUrl(state, entry.year)))].map(url => ({ url, body: calendar(state, state === "ND" ? entries : entries.filter(entry => calendarUrl(state, entry.year) === url)) })) });
}
function candidatePage(state: DakotaState, selected = election(state), result = false) {
	const tokens = "<input type=\"hidden\" name=\"__VIEWSTATE\" value=\"synthetic-public-token\"><input type=\"hidden\" name=\"privateEmail\" value=\"private@example.test\">";
	const action = `./candidatelist.aspx?eid=${selected.electionId}`;
	if (state === "SD") return `<form id="Form1" method="post" action="${action}">${tokens}<span id="MainContent_lblFormHeader">${selected.year} General Election Candidate List</span><input type="hidden" name="ctl00$MainContent$hidElectionDate" value="${selected.year} General Election Candidate List"><input type="hidden" name="ctl00$MainContent$hidElectionType" value="General"><input type="button" onclick="javascript:__doPostBack('ctl00$MainContent$grdCandidates$ctl00$ctl02$ctl00$ExportToCsvButton','')"><p>3 items in 1 pages</p></form>`;
	const selectors = ["ddlJursdiction", "ddlDistrict", "ddlContest", "ddlCandidate"].map(name => `<select name="ctl00$ContentPlaceHolder1$${name}"><option selected value="${name === "ddlJursdiction" ? "AL" : "0"}">${["ddlJursdiction", "ddlDistrict"].includes(name) ? "All" : ""}</option></select>`).join("");
	const table = `<table><tr>${["Contest", "Term Length", "District", "County", "Name", "Party", "Mailing Address"].map(label => `<th>${label}</th>`).join("")}</tr>${[
		["State Senator", "4", "District 7", "", "Synthetic State Candidate", "Democratic", "Private address"],
		["Sheriff", "4", "", "Alpha County", "Synthetic County Candidate", "Republican", "Private address"],
		["Sheriff", "4", "", "Beta County", "Synthetic County Candidate", "Republican", "Private address"],
		["Representative in Congress", "2", "", "", "Synthetic Federal Candidate", "Independent", "Private address"]
	].map(values => `<tr>${values.map(value => `<td>${value}</td>`).join("")}</tr>`).join("")}</table>`;
	return `<title>${selected.year} General Election Contest/Candidate List</title><form id="aspnetForm" method="post" action="${action}">${tokens}${selectors}<input type="submit" name="ctl00$ContentPlaceHolder1$btnSearch" value="Search">${result ? `<select name="ctl00$ContentPlaceHolder1$ddlExportFormat"><option selected>Excel (xls)</option></select>${table}` : ""}</form>`;
}
function csv(selected = election("SD")) {
	return `Contest,Name,Party,District/County,Ballot Order,Mailing Address,Email
State Senator,Synthetic State Candidate,Democratic,District 7,1,Private address,private@example.test
Sheriff,Synthetic County Candidate,Republican,Alpha County,,Private address,
United States Representative,Synthetic Withdrawn Candidate (Withdrawn 10/1/${selected.year} 12:00:00 AM),Independent,,,Private address,
`;
}
const candidates = (state: DakotaState, selected = election(state)) => state === "SD" ? JSON.stringify({ page: candidatePage(state, selected), records: csv(selected) }) : candidatePage(state, selected, true);

for (const state of ["SD", "ND"] as const) {
	test(`${state} discovers published election IDs and explicit calendar dates without inventing either`, () => {
		const original = originals[state]!;
		const current = discoverStateBallotElectionCycles(discovery(state), original.id, now);
		assert.deepEqual(current.elections, [{ electionId: election(state).electionId, electionDate: original.electionDate }]);
		assert.deepEqual(stateBallotCycleSources(current, now), []);
		const future = discoverStateBallotElectionCycles(discovery(state, [election(state), election(state, true)]), original.id, now);
		const [source] = stateBallotCycleSources(future, now);
		assert.equal(source!.id, `${state.toLowerCase()}-general-2028-11-07`);
		assert.equal(source!.url, dakotaCandidateRosterUrl(state, election(state, true).electionId));
		assert.equal(source!.pageUrl, source!.url);
		assert.equal(source!.format, original.format);
		assert.equal(source!.retrievalPolicy, undefined);
		assert.throws(() => parseStateBallotCycleCatalog({ ...future, elections: [{ electionId: null, electionDate: "2028-11-07" }] }, now));
		assert.throws(() => parseStateBallotCycleCatalog({ ...future, elections: [{ electionId: election(state).electionId, electionDate: "2028-11-07" }] }, now));
	});

	test(`${state} rejects conflicting, missing, primary, undated and off-host discovery inputs`, () => {
		const original = originals[state]!;
		const valid = JSON.parse(discovery(state));
		for (const changed of [
			{ ...valid, page: valid.page.replaceAll("2026", "2027") },
			{ ...valid, page: valid.page.replaceAll(`eid=${election(state).electionId}`, "eid=999999") },
			{ ...valid, page: valid.page.replaceAll(state === "SD" ? "vip.sdsos.gov" : "vip.sos.nd.gov", "example.org") },
			{ ...valid, page: valid.page.replaceAll("Candidate Calendar", "Primary Calendar").replaceAll("Election Calendar", "Primary Calendar") },
			{ ...valid, calendars: [] },
			{ ...valid, calendars: [...valid.calendars, valid.calendars[0]] },
			{ ...valid, calendars: [{ ...valid.calendars[0], url: "https://example.org/calendar" }] },
			{ ...valid, calendars: [{ ...valid.calendars[0], body: valid.calendars[0].body.replaceAll("2026", "2028") }] },
			{ ...valid, calendars: [{ ...valid.calendars[0], body: valid.calendars[0].body.replace("November 3", "November 4") }] },
			{ ...valid, calendars: [{ ...valid.calendars[0], body: valid.calendars[0].body.replaceAll("General Election", "Primary Election") }] },
			{ ...valid, unknown: "unapproved" },
			{ ...valid, calendars: [{ ...valid.calendars[0], unknown: "unapproved" }] }
		]) assert.throws(() => discoverStateBallotElectionCycles(JSON.stringify(changed), original.id, now));
		assert.throws(() => discoverStateBallotElectionCycles("x".repeat(2 * 1024 * 1024 + 1), original.id, now));
	});

	test(`${state} discovery and public candidate requests stay on exact reviewed hosts, identities and controls`, async () => {
		const original = originals[state]!;
		const captured = JSON.parse(discovery(state));
		const requests: string[] = [];
		const body = await fetchStateBallotCycleDiscovery(async (url, options) => {
			assert.ok(options);
			assert.equal(options.maxRedirects, 0);
			assert.deepEqual(options.allowedHosts, [new URL(dakotaDiscoveryUrl(state)).hostname]);
			requests.push(String(url));
			return String(url) === dakotaDiscoveryUrl(state) ? captured.page : captured.calendars.find((calendar: { url: string }) => calendar.url === String(url))!.body;
		}, original.id);
		assert.equal(requests.length, 2);
		assert.deepEqual(discoverStateBallotElectionCycles(body, original.id, now).elections, [{ electionId: election(state).electionId, electionDate: original.electionDate }]);
		const future = stateBallotCycleSources(discoverStateBallotElectionCycles(discovery(state, [election(state, true)]), original.id, now), now)[0]!;
		let downloads = 0;
		const records = await fetchStateBallotSourceText(future, async (url, options) => {
			assert.equal(url, future.url);
			assert.equal(options.maxRedirects, 0);
			downloads++;
			if (!options.postBody) return candidatePage(state, election(state, true));
			const fields = new URLSearchParams(options.postBody);
			assert.equal(fields.get("__VIEWSTATE"), "synthetic-public-token");
			assert.equal(fields.has("privateEmail"), false);
			assert.equal(fields.has("ctl00$ContentPlaceHolder1$ddlExportFormat"), false);
			return state === "SD" ? csv(election(state, true)) : candidatePage(state, election(state, true), true);
		});
		assert.equal(downloads, 2);
		const parsed = parseStateCandidateRecords(future, records);
		assert.equal(parsed.length, state === "SD" ? 3 : 4);
		assert.equal(parsed[0]!.district, "7");
		assert.equal(parsed[0]!.party, "Democratic");
		assert.equal(parsed[1]!.jurisdiction, "Alpha County");
		assert.equal(parsed.at(-1)!.scope, "statewide");
		assert.doesNotMatch(JSON.stringify(parsed), /Private address|private@example/iu);
		for (const source of [{ ...future, id: original.id }, { ...future, url: `${future.url}&county=1` }, { ...future, pageUrl: original.url }, { ...future, stateCode: "WA" }, { ...future, postBody: "unapproved=1" }, { ...future, electionDate: "2027-11-02" }]) {
			await assert.rejects(fetchStateBallotSourceText(source, async () => {
				assert.fail("Unbound source identities must not make publisher requests");
			}));
		}
	});

	test(`${state} rejects filtered or changed candidate pages and preserves explicit status and local scope`, () => {
		const original = originals[state]!;
		const selected = election(state, true);
		const source = stateBallotCycleSources(discoverStateBallotElectionCycles(discovery(state, [selected]), original.id, now), now)[0]!;
		const page = candidatePage(state, selected);
		const form = (body: string) => state === "SD" ? buildPublicStateExportForm(source, body) : buildNorthDakotaSearchForm(source, body);
		for (const changed of [page.replace("method=\"post\"", "method=\"get\""), page.replace(`eid=${selected.electionId}`, "eid=1234"), page.replaceAll("2028", "2026"), page.replace("General", "Primary"), page.replace("</form>", "<select name=\"unapproved-filter\"></select></form>")]) assert.throws(() => form(changed));
		if (state === "SD") {
			const records = parseStateCandidateRecords(source, candidates(state, selected));
			assert.equal(records[2]!.status, "withdrawn");
			assert.equal(records[2]!.name, "Synthetic Withdrawn Candidate");
			assert.equal(records[1]!.sourceStatus, "No ballot order published");
			const priorYear = JSON.stringify({ page, records: csv(selected).replace("10/1/2028", "10/1/2027") });
			assert.equal(parseStateCandidateRecords(source, priorYear)[2]!.status, "withdrawn");
			for (const date of ["13/1/2028", "2/29/2027", "10/1/2030"]) assert.throws(() => parseStateCandidateRecords(source, JSON.stringify({ page, records: csv(selected).replace("10/1/2028", date) })));
		}
		else {
			const records = parseStateCandidateRecords(source, candidates(state, selected));
			assert.notEqual(records[1]!.id, records[2]!.id);
			assert.equal(records[2]!.jurisdiction, "Beta County");
			assert.throws(() => form(page.replace("value=\"AL\"", "value=\"county\"")));
			assert.throws(() => parseStateCandidateRecords(source, candidates(state, selected).replace("</table>", "<tr class=\"rgPager\"><td>Next</td></tr></table>")));
			const table = /<table>.*<\/table>/u.exec(candidates(state, selected))![0];
			assert.throws(() => parseStateCandidateRecords(source, candidates(state, selected).replace("</form>", `${table}</form>`)));
		}
	});
}

test("North Dakota drops expired-year cards only when its current calendar no longer supplies their dates", () => {
	const value = JSON.parse(discovery("ND", [election("ND"), election("ND", true)]));
	value.calendars[0].body = calendar("ND", [election("ND", true)]);
	assert.throws(() => discoverStateBallotElectionCycles(JSON.stringify(value), originals.ND!.id, now));
	const future = discoverStateBallotElectionCycles(JSON.stringify(value), originals.ND!.id, Date.parse("2028-10-24T12:00:00.000Z"));
	assert.deepEqual(future.elections, [{ electionId: "9348", electionDate: "2028-11-07" }]);
});

test("both Dakota families roll forward unattended, preserve failures independently and serve cold API snapshots", async () => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-dakota-cycles-"));
	const environment = { ...process.env };
	let server: ReturnType<ReturnType<typeof express>["listen"]> | undefined;
	try {
		let clock = now;
		let downloads = 0;
		const dataDirectory = join(directory, "data");
		const configurations = (["SD", "ND"] as const).map(state => ({ familyId: originals[state]!.id, catalogPath: join(directory, `${state}.json`), dataDirectory, now: () => clock, fetchDiscovery: async () => discovery(state), fetchCandidates: async () => {
			downloads++;
			return candidates(state);
		} }));
		assert.ok((await syncStateBallotCycleFamilies(configurations)).every(result => result.status === "completed"));
		assert.equal(downloads, 2);
		const previousBytes = await Promise.all(configurations.map(configuration => readFile(configuration.catalogPath)));
		for (const [position, state] of (["SD", "ND"] as const).entries()) {
			await assert.rejects(syncStateBallotCycles({ ...configurations[position]!, fetchDiscovery: async () => discovery(state, [election(state, true)]) }), /unexpired/u);
			assert.deepEqual(await readFile(configurations[position]!.catalogPath), previousBytes[position]);
		}
		clock = Date.parse("2028-10-24T12:00:00.000Z");
		const futureConfigurations = configurations.map((configuration, position) => {
			const state = position === 0 ? "SD" : "ND";
			return { ...configuration, fetchDiscovery: async () => discovery(state, [election(state, true)]), fetchCandidates: async () => {
				downloads++;
				return candidates(state, election(state, true));
			} };
		});
		assert.ok((await syncStateBallotCycleFamilies(futureConfigurations)).every(result => result.status === "completed"));
		assert.equal(downloads, 4);
		process.env.STATE_BALLOT_CYCLE_CATALOGS = JSON.stringify(Object.fromEntries(configurations.map(configuration => [configuration.familyId, configuration.catalogPath])));
		process.env.STATE_BALLOT_DATA_DIR = dataDirectory;
		process.env.STATE_BALLOT_ENABLED_FAMILIES = "sd-sos-2026,nd-sos-2026";
		process.env.STATE_BALLOT_ENABLED_STATES = "SD,ND";
		process.env.STATE_BALLOT_ENABLED_SOURCES = "sd-sos-2026,nd-sos-2026";
		delete process.env.STATE_BALLOT_CYCLE_CATALOG;
		const resolved = resolveStateBallotConfiguration(process.env, clock);
		const futures = (["SD", "ND"] as const).map(state => resolved.sources.find(source => source.id === `${state.toLowerCase()}-general-2028-11-07`)!);
		assert.ok(futures.every(Boolean));
		assert.ok(!resolveStateBallotConfiguration({ ...process.env, STATE_BALLOT_ENABLED_FAMILIES: undefined }, clock).sources.some(source => futures.some(future => future.id === source.id)));
		assert.throws(() => resolveStateBallotConfiguration({ ...process.env, STATE_BALLOT_ENABLED_STATES: "SD" }, clock));
		const storage = createStateBallotStorage(dataDirectory);
		const accepted = await Promise.all(futures.map(source => storage.read(source)));
		const repository = createStateBallotRepository({ now: () => clock, fetchText: async () => {
			assert.fail("Cold requests must use the accepted durable snapshots");
		} });
		const app = express();
		registerStateRecordRoutes(app, repository);
		server = app.listen(0, "127.0.0.1");
		await once(server, "listening");
		const address = server.address();
		assert.ok(address && typeof address === "object");
		for (const [position, source] of futures.entries()) {
			const response: Response = await fetch(`http://127.0.0.1:${address.port}/api/state-records/${source.stateCode}?source=${source.id}&status=all`);
			assert.equal(response.status, 200);
			const body = await response.json();
			assert.equal(body.source.electionDate, source.electionDate);
			assert.equal(body.total, position === 0 ? 3 : 4);
		}
		const run = await refreshApprovedCandidateData({ environment: process.env, now: () => clock, fetchDiscovery: async familyId => discovery(familyId === originals.SD!.id ? "SD" : "ND", [election(familyId === originals.SD!.id ? "SD" : "ND", true)]), fetchText: async () => {
			assert.fail("Fresh family snapshots must not be downloaded again");
		} });
		assert.equal(run.status, "succeeded");
		assert.ok(run.results.every(result => result.status === "cached"));
		const independent = await syncStateBallotCycleFamilies(futureConfigurations.map((configuration, position) => position
			? configuration
			: { ...configuration, fetchDiscovery: async () => {
					throw new Error("403: source access denied");
				} }));
		assert.equal(independent[0]!.status, "failed");
		assert.equal(independent[1]!.status, "completed");
		clock += 5 * 3600000;
		for (const [position, configuration] of futureConfigurations.entries()) {
			const failed = await syncStateBallotCycles({ ...configuration, fetchCandidates: async () => candidates(position === 0 ? "SD" : "ND") });
			assert.equal(failed.results[0]!.status, "unavailable");
			assert.deepEqual(await storage.read(futures[position]!), accepted[position]);
		}
		await writeFile(configurations[1]!.catalogPath, "{}");
		assert.ok(repository.sources?.some(source => source.id === futures[1]!.id));
		assert.equal((await repository.inspectSources!()).find(source => source.id === futures[1]!.id)?.status, "error");
	}
	finally {
		if (server?.listening) await new Promise<void>((resolve, reject) => server!.close(error => error ? reject(error) : resolve()));
		process.env = environment;
		await rm(directory, { recursive: true, force: true });
	}
});
