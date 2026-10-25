import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { refreshApprovedCandidateData } from "../src/state-ballot-automation.js";
import { fetchStateBallotCycleDiscovery, syncStateBallotCycles } from "../src/state-ballot-cycle-sync.js";
import { discoverStateBallotElectionCycles, readStateBallotCycleCatalog, stateBallotCycleSources, writeStateBallotCycleCatalog } from "../src/state-ballot-cycles.js";
import { fetchStateBallotSourceText } from "../src/state-ballot-fetch.js";
import { fetchKansasCandidateCapture, kansasCandidateIndexUrl, kansasCandidateRosterUrl, kansasDiscoveryUrl, kansasElectionLabel, kansasElectionPageUrl, readKansasElectionControls, readKansasElectionDiscovery } from "../src/state-ballot-kansas.js";
import { parseStateCandidateRecords } from "../src/state-ballot-records.js";
import { buildStateBallotPreview, createStateBallotRepository } from "../src/state-ballot-repository.js";
import { StateBallotAwaitingRecordsError } from "../src/state-ballot-source-state.js";
import { stateBallotSources } from "../src/state-ballot-sources.js";
import { createStateBallotStorage } from "../src/state-ballot-storage.js";

const original = stateBallotSources.find(source => source.id === "ks-johnson-2026")!;
const now = Date.parse("2026-10-25T10:00:00Z");
const entries = [{ electionId: "6023", electionDate: "2026-11-03" }, { electionId: "7001", electionDate: "2027-11-02" }, { electionId: "8002", electionDate: "2028-11-07" }];
const index = (offered = entries) => `<main><h1>Upcoming Elections</h1>${offered.map(entry => `<a href="${kansasElectionPageUrl(entry.electionDate)}">${kansasElectionLabel(entry.electionDate)}</a>`).join("")}</main>`;
const controls = (offered = entries) => `<main><h1>Candidates</h1><form method="get" id="views-exposed-form-candidates-candidate-listing" action="${kansasCandidateIndexUrl}"><select name="field_election_reference_target_id"><option value="All">- Any -</option><option value="6024">August 4, 2026 Primary Election</option>${offered.map(entry => `<option value="${entry.electionId}">${kansasElectionLabel(entry.electionDate)}</option>`).join("")}</select></form></main>`;
const event = (date: string) => `<main><h1>${kansasElectionLabel(date)}</h1><p>The following will be on a ${kansasElectionLabel(date).replace("General Election", "general election")} ballot in Johnson County, Kansas:</p></main>`;
const discovery = (offered = entries) => JSON.stringify({ schemaVersion: 1, type: "kansas-election-discovery", index: index(offered), controls: controls(offered), elections: offered.map(entry => ({ ...entry, url: kansasElectionPageUrl(entry.electionDate), body: event(entry.electionDate) })) });
const future = (position = 1) => stateBallotCycleSources(discoverStateBallotElectionCycles(discovery(), original.id, now), now)[position - 1]!;

function report(date = "2027-11-02", electionId = "7001", empty = false) {
	const filters = `<select name="field_election_reference_target_id"><option value="${electionId}" selected>${kansasElectionLabel(date)}</option></select><select name="field_office_jurisdiction_target_id_1"><option value="All" selected>All</option></select><select name="field_office_level_target_id_1"><option value="All" selected>All</option></select>`;
	if (empty) return `<main>${filters}<div class="view-empty">There are no results found for the criteria specified. Please try again with different filter criteria.</div></main>`;
	const definitions = [["U.S. Senate", "U.S. Senate", "Senator Example", "Democratic"], ["Governor / Lieutenant Governor", "Governor/Lieutenant Governor", "Governor Example / Deputy Example", "Republican"], ["KS Representative", "Kansas Representative 5", "House Example", "Democratic"], ["Kansas Supreme Court Justices", "Kansas Supreme Court Justice Position 4", "Justice Example", "Nonpartisan office"], ["Prairie Village", "Mayor", "Mayor Example", "Nonpartisan office"], ["Spring Hill Township", "Clerk", "Tara A. Combs", "Democratic"]];
	return `<main>${filters}<p class="view-filters-info">Showing All Candidates</p><div class="view-content">${definitions.map(([heading, office, name, party]) => `<div class="view-grouping"><div class="view-grouping-header">${heading}</div><h3>${office}</h3><div class="candidate--teaser"><h4 class="title">${name}</h4><p class="party">${party}</p><ul><li><label>Incumbent:</label> Yes</li><li><label>Website:</label>campaign.example.test</li><li><label>City:</label>Private residence</li><li><label>Phone:</label>555-0100</li></ul></div></div>`).join("")}</div></main>`;
}

const capture = (date = "2027-11-02", electionId = "7001", empty = false) => JSON.stringify({ schemaVersion: 1, type: "kansas-candidate-report", discovery: discovery(), url: kansasCandidateRosterUrl(electionId), records: report(date, electionId, empty) });

test("Kansas discovers only published November generals with matching controls, preserving odd and even years", () => {
	assert.deepEqual(readKansasElectionDiscovery(discovery()), entries);
	const sources = stateBallotCycleSources(discoverStateBallotElectionCycles(discovery(), original.id, now), now);
	assert.deepEqual(sources.map(source => source.id), ["ks-johnson-general-2027-11-02", "ks-johnson-general-2028-11-07"]);
	assert.equal(sources[0]!.pageUrl, kansasElectionPageUrl("2027-11-02"));
	assert.equal(sources[0]!.url, kansasCandidateRosterUrl("7001"));
	assert.equal(sources[0]!.scopeNotice, original.scopeNotice);
});

test("Kansas rejects changed dates, ambiguous controls, unrelated hosts and incomplete discovery without guessing IDs", () => {
	for (const body of [index().replace("Upcoming Elections", "Archive"), index().replace("www.jocoelection.org", "other.example"), index().replace("November 2, 2027", "November 3, 2027"), index() + index()]) assert.throws(() => readKansasElectionControls(body, controls()));
	for (const body of [controls(entries.slice(1)), controls().replace("value=\"7001\"", "value=\"6023\""), controls().replace("method=\"get\"", "method=\"post\""), controls().replace("name=\"field_election_reference_target_id\"", "name=\"changed\"")]) assert.throws(() => readKansasElectionControls(index(), body));
	const missing = JSON.parse(discovery());
	missing.elections.pop();
	assert.throws(() => readKansasElectionDiscovery(JSON.stringify(missing)));
	const wrong = JSON.parse(discovery());
	wrong.elections[1].body = event("2028-11-07");
	assert.throws(() => readKansasElectionDiscovery(JSON.stringify(wrong)));
	assert.throws(() => readKansasElectionDiscovery(" ".repeat(24 * 1024 * 1024 + 1)));
});

test("Kansas future captures preserve tickets and local geography without private contacts or stale 2026 corrections", () => {
	const source = future();
	const records = parseStateCandidateRecords(source, capture());
	assert.equal(records.length, 6);
	assert.equal(records[1]!.name, "Governor Example / Deputy Example");
	assert.equal(records[4]!.scope, "local");
	assert.equal(records[4]!.jurisdiction, "Prairie Village");
	assert.equal(records[5]!.sourceStatus, "listed");
	assert.doesNotMatch(JSON.stringify(records), /555-0100|Private residence/u);
	assert.equal(buildStateBallotPreview({ source, records, sha256: "a".repeat(64), retrievedAt: new Date(now).toISOString() }, { districtMatches: [] })!.candidateCount, 3);
	assert.throws(() => parseStateCandidateRecords(source, report()));
	assert.throws(() => parseStateCandidateRecords(source, capture("2028-11-07", "8002")));
	assert.throws(() => parseStateCandidateRecords(source, capture().replace("Showing All Candidates", "Showing some Candidates")));
});

test("Kansas only treats an exact bound future empty page as waiting, never a successful empty import", () => {
	assert.throws(() => parseStateCandidateRecords(future(), capture("2027-11-02", "7001", true)), StateBallotAwaitingRecordsError);
	assert.throws(() => parseStateCandidateRecords(original, report("2026-11-03", "6023", true)), /Kansas/u);
	for (const body of [capture("2027-11-02", "7001", true).replace("There are no results found", "No data"), capture("2027-11-02", "7001", true).replace("value=\\\"All\\\"", "value=\\\"123\\\""), capture("2027-11-02", "7001", true).replace("view-empty", "view-content")]) assert.throws(() => parseStateCandidateRecords(future(), body), error => !(error instanceof StateBallotAwaitingRecordsError));
});

test("Kansas follows only bounded published GET controls and validates source identity before any request", async () => {
	const requests: string[] = [];
	const request = async (requestUrl: string | URL, options?: { maxRedirects?: number; postBody?: string; allowedHosts?: readonly string[] }) => {
		const url = String(requestUrl);
		requests.push(url);
		assert.equal(options?.maxRedirects, 0);
		assert.equal(options?.postBody, undefined);
		assert.deepEqual(options?.allowedHosts, ["www.jocoelection.org"]);
		return url === kansasDiscoveryUrl ? index() : url === kansasCandidateIndexUrl ? controls() : entries.some(entry => kansasElectionPageUrl(entry.electionDate) === url) ? event(entries.find(entry => kansasElectionPageUrl(entry.electionDate) === url)!.electionDate) : report();
	};
	const evidence = await fetchStateBallotCycleDiscovery(request, original.id);
	assert.deepEqual(requests, [kansasDiscoveryUrl, kansasCandidateIndexUrl, ...entries.map(entry => kansasElectionPageUrl(entry.electionDate))]);
	requests.length = 0;
	assert.equal(parseStateCandidateRecords(future(), await fetchKansasCandidateCapture(future(), request, evidence)).length, 6);
	assert.deepEqual(requests, [future().url]);
	await assert.rejects(() => fetchStateBallotSourceText({ ...future(), pageUrl: original.pageUrl }, async () => {
		throw new Error("No network expected");
	}), /configured Kansas/u);
});

test("Kansas persists future waiting, recovers on data arrival and preserves the accepted catalog after election drift", async () => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-ks-cycle-"));
	try {
		let clock = now;
		const options = { familyId: original.id, catalogPath: join(directory, "cycles.json"), dataDirectory: directory, enabledSourceIds: [future().id], now: () => clock, fetchDiscovery: async () => discovery() };
		const waiting = await syncStateBallotCycles({ ...options, fetchCandidates: async () => capture("2027-11-02", "7001", true) });
		assert.equal(waiting.results[0]!.status, "awaiting-records");
		assert.equal(waiting.results[0]!.imported, false);
		assert.equal((await createStateBallotStorage(directory).readPending(future(), clock))!.retrievedAt, new Date(clock).toISOString());
		clock += 5 * 60 * 60 * 1000;
		const accepted = await syncStateBallotCycles({ ...options, fetchCandidates: async () => capture() });
		assert.equal(accepted.results[0]!.records, 6);
		assert.equal(accepted.results[0]!.status, "available");
		const before = await readFile(options.catalogPath, "utf8");
		await assert.rejects(() => syncStateBallotCycles({ ...options, fetchDiscovery: async () => discovery(entries.slice(0, 1)) }), /unexpired/u);
		assert.equal(await readFile(options.catalogPath, "utf8"), before);
		const environment = { STATE_BALLOT_DATA_DIR: directory, STATE_BALLOT_ENABLED_STATES: "KS", STATE_BALLOT_ENABLED_SOURCES: original.id, STATE_BALLOT_ENABLED_FAMILIES: original.id, STATE_BALLOT_CYCLE_CATALOGS: JSON.stringify({ [original.id]: options.catalogPath }) };
		const stored = await createStateBallotStorage(directory).read(future());
		const cached = await refreshApprovedCandidateData({ environment, now: () => clock, fetchDiscovery: async () => discovery(), fetchText: async source => source.id === original.id ? report("2026-11-03", "6023") : source.id === future(2).id ? capture("2028-11-07", "8002") : Promise.reject(new Error("Accepted future data must remain cached")) });
		assert.equal(cached.results.find(result => result.sourceId === future().id)!.status, "cached");
		assert.deepEqual(await createStateBallotStorage(directory).read(future()), stored);
	}
	finally { await rm(directory, { recursive: true }); }
});

test("Kansas hot and cold repositories discover a new future catalog without changing exact-source or state allowlists", async () => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-ks-hot-"));
	const environment = { STATE_BALLOT_DATA_DIR: directory, STATE_BALLOT_ENABLED_STATES: "KS", STATE_BALLOT_ENABLED_SOURCES: original.id, STATE_BALLOT_ENABLED_FAMILIES: original.id, STATE_BALLOT_CYCLE_CATALOGS: JSON.stringify({ [original.id]: join(directory, "cycles.json") }) };
	const previous = Object.fromEntries(Object.keys(environment).map(key => [key, process.env[key]]));
	try {
		Object.assign(process.env, environment);
		await writeStateBallotCycleCatalog(join(directory, "cycles.json"), discoverStateBallotElectionCycles(discovery(entries.slice(0, 1)), original.id, now), now);
		const repository = createStateBallotRepository({ now: () => now, fetchText: async source => source.id === original.id ? report("2026-11-03", "6023") : capture() });
		assert.equal(await repository.getSnapshot("KS", future().id), null);
		await writeStateBallotCycleCatalog(join(directory, "cycles.json"), discoverStateBallotElectionCycles(discovery(), original.id, now), now);
		assert.equal((await repository.getSnapshot("KS", future().id))!.records.length, 6);
		const cold = createStateBallotRepository({ now: () => now, fetchText: async () => {
			throw new Error("Retained future data must survive restart");
		} });
		assert.equal((await cold.getSnapshot("KS", future().id))!.records.length, 6);
		assert.equal(readStateBallotCycleCatalog(join(directory, "cycles.json"), now)!.familyId, original.id);
	}
	finally {
		for (const [key, value] of Object.entries(previous)) {
			if (value === undefined) delete process.env[key];
			else process.env[key] = value;
		}
		await rm(directory, { recursive: true });
	}
});
