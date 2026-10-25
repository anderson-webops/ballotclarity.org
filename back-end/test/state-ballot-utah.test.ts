import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { refreshApprovedCandidateData } from "../src/state-ballot-automation.js";
import { fetchStateBallotCycleDiscovery, syncStateBallotCycles } from "../src/state-ballot-cycle-sync.js";
import { discoverStateBallotElectionCycles, parseStateBallotCycleCatalog, stateBallotCycleSources } from "../src/state-ballot-cycles.js";
import { fetchStateBallotSourceText } from "../src/state-ballot-fetch.js";
import { parseStateCandidateRecords } from "../src/state-ballot-records.js";
import { configuredStateBallotSources } from "../src/state-ballot-registry.js";
import { buildStateBallotPreview } from "../src/state-ballot-repository.js";
import { StateBallotAwaitingRecordsError } from "../src/state-ballot-source-state.js";
import { createStateBallotStorage } from "../src/state-ballot-storage.js";
import { createUtahRequest, readUtahElectionDiscovery, utahCandidateRosterUrl, utahDiscoveryUrl, utahElectionUrl } from "../src/state-ballot-utah.js";

const original = configuredStateBallotSources.find(source => source.id === "ut-lg-2026")!;
const now = Date.parse("2026-10-25T12:00:00Z");
const resources = (year = "2028") => `<h2>Resources for Candidates, Political Groups &amp; Parties</h2><div><h3>Candidate Essentials</h3><a href="https://vote.utah.gov/${year}-candidate-filings/">${year} Candidate Filings</a></div>`;
const election = (year = "2028", day = "7") => `<h2>Current Election Information</h2><div><div><h2>${year} Election Cycle</h2></div><div><h3>Regular General Election</h3><div>Election Day November ${day}, ${year}</div></div></div>`;
const discovery = (year = "2028", day = "7") => JSON.stringify({ schemaVersion: 1, type: "utah-election-discovery", resources: resources(year), election: election(year, day) });
const future = () => stateBallotCycleSources(discoverStateBallotElectionCycles(discovery(), original.id, now), now)[0]!;
const table = (rows: string[][]) => `<table>${rows.map(row => `<tr>${row.map(value => `<td>${value}</td>`).join("")}</tr>`).join("")}</table>`;
const columns = ["Candidate", "Office", "Party", "Status"];
function page(year = "2028", populated = true, executive = false) {
	return `<main><h2>${year} Candidate Filings</h2>${[
		["Federal Offices", table([columns, ...(populated ? [["Synthetic Federal", "U.S. House District 1", "Example", "Election Candidate"], ["Primary Only", "U.S. House District 1", "Example", "Out in Primary"]] : [])])],
		...(executive ? [["State Offices", table([columns, ["Synthetic Executive", "Governor", "Example", "Election Candidate"]])]] : []),
		["State Senate", table([columns, ...(populated ? [["Synthetic Senator", "State Senate District 1", "Example", "Election Candidate"]] : [])])],
		["State House", table([columns, ...(populated ? [["Synthetic Write In", "State House District 1", "", "Write-In"]] : [])])],
		["State School Board", table([columns, ...(populated ? [["Synthetic School", "State School Board District 1", "Example", "Election Candidate"]] : [])])],
		["State Judicial", table([["Judicial Retention", "Status"], ...(populated ? [["Shall Synthetic Justice be retained in the office of Justice of the Supreme Court of Utah?", "Election Candidate"], ["Shall Synthetic Local Judge be retained in the office of Judge of the District Court of the Third Judicial District?", "Election Candidate"]] : [])])],
	].map(([label, body]) => `<h3>${label}</h3>${body}`).join("")}</main>`;
}

test("Utah binds observed candidate links to the explicit same-cycle regular general date", () => {
	assert.deepEqual(readUtahElectionDiscovery(discovery()), [{ electionId: null, electionDate: "2028-11-07" }]);
	assert.equal(future().id, "ut-general-2028-11-07");
	assert.equal(future().url, "https://vote.utah.gov/2028-candidate-filings/");
	assert.equal(future().pageUrl, future().url);
	assert.equal(future().format, original.format);
	assert.deepEqual(stateBallotCycleSources(discoverStateBallotElectionCycles(discovery("2026", "3"), original.id, now), now), []);
	assert.equal(original.url, "https://vote.utah.gov/2026-candidate-filings/");
	const catalog = discoverStateBallotElectionCycles(discovery(), original.id, now);
	assert.throws(() => parseStateBallotCycleCatalog({ ...catalog, elections: [{ electionId: null, electionDate: "2027-11-02" }] }, now));
	assert.throws(() => parseStateBallotCycleCatalog({ ...catalog, elections: [{ electionId: "2028", electionDate: "2028-11-07" }] }, now));
});

test("Utah rejects guessed, duplicated, substituted, municipal and conflicting election controls", () => {
	for (const body of [discovery("2027", "2"), discovery("2028", "8"), discovery().replace("Candidate Essentials", "Other"), discovery().replace("https://vote.utah.gov/2028", "https://other.example/2028"), discovery().replace("2028 Candidate Filings", "2028 Primary Filings"), discovery().replace("Election Day November 7, 2028", "Election Day November 7, 2026"), discovery().replace("Regular General Election", "Special Election")]) assert.throws(() => readUtahElectionDiscovery(body));
	const duplicated = JSON.parse(discovery());
	duplicated.resources = resources().replace("</div>", "<a href=\"https://vote.utah.gov/2028-candidate-filings/\">2028 Candidate Filings</a></div>");
	assert.throws(() => readUtahElectionDiscovery(JSON.stringify(duplicated)));
	const detached = JSON.parse(discovery());
	detached.election = "<h2>Current Election Information</h2><div><div><h2>2028 Election Cycle</h2></div></div><div><h3>Regular General Election</h3>Election Day November 7, 2028</div>";
	assert.throws(() => readUtahElectionDiscovery(JSON.stringify(detached)));
	assert.throws(() => readUtahElectionDiscovery(JSON.stringify({ ...JSON.parse(discovery()), extra: true })));
	assert.throws(() => readUtahElectionDiscovery(discovery() + " ".repeat(8 * 1024 * 1024)));
	assert.throws(() => utahCandidateRosterUrl("2028-03-07"));
});

test("Utah preserves qualification, retention scope and privacy across five- and six-section future pages", () => {
	const source = future();
	const records = parseStateCandidateRecords(source, page());
	assert.equal(records.length, 6);
	assert.equal(records[2]!.status, "write-in");
	assert.equal(records[3]!.scope, "local");
	assert.equal(records[4]!.scope, "statewide");
	assert.equal(records[5]!.scope, "local");
	assert.doesNotMatch(JSON.stringify(records), /Primary Only/u);
	const preview = buildStateBallotPreview({ source, records, sha256: "a".repeat(64), retrievedAt: new Date(now).toISOString() }, { districtMatches: [] });
	assert.equal(preview?.candidateCount, 1);
	assert.equal(parseStateCandidateRecords(source, page("2028", true, true)).length, 7);
	assert.throws(() => parseStateCandidateRecords(source, page("2026")), /configured election year/u);
	assert.throws(() => parseStateCandidateRecords({ ...source, url: `${source.url}?other=1` }, page()));
	for (const body of [page().replace("State School Board</h3>", "Other</h3>"), page().replace("<h3>State Senate</h3>", ""), page().replace("Out in Primary", "New Status"), page().replace("Judicial Retention", "Retention"), page().replace("</table>", "</table><table></table>")]) assert.throws(() => parseStateCandidateRecords(source, body));
	assert.throws(() => parseStateCandidateRecords(source, page("2028", false)), StateBallotAwaitingRecordsError);
});

test("Utah uses its canonical bounded public requests without redirects or source substitutions", async () => {
	const requests: string[] = [];
	const body = await fetchStateBallotCycleDiscovery(async (url, options) => {
		requests.push(String(url));
		assert.deepEqual(options?.allowedHosts, ["vote.utah.gov"]);
		assert.equal(options?.maxRedirects, 0);
		assert.equal(options?.maxBytes, 2 * 1024 * 1024);
		return url === utahDiscoveryUrl ? resources() : election();
	}, original.id);
	assert.deepEqual(requests, [utahDiscoveryUrl, utahElectionUrl]);
	assert.deepEqual(readUtahElectionDiscovery(body), [{ electionId: null, electionDate: "2028-11-07" }]);
	let downloads = 0;
	assert.equal(await fetchStateBallotSourceText(future(), async (url, options) => {
		downloads++;
		assert.equal(url, future().url);
		assert.equal(options?.maxRedirects, 0);
		return page();
	}), page());
	await assert.rejects(() => fetchStateBallotSourceText({ ...future(), pageUrl: "https://other.example/" }, async () => {
		downloads++;
		return page();
	}));
	assert.equal(downloads, 1);
});

test("Utah serializes successful and failed requests at its ten-second crawl interval", async () => {
	let clock = 0;
	const starts: number[] = [];
	const sleeps: number[] = [];
	const request = createUtahRequest(async (url) => {
		starts.push(clock);
		if (url === "failed") throw new Error("Synthetic transport failure");
		return url;
	}, () => clock, async (milliseconds) => {
		sleeps.push(milliseconds);
		clock += milliseconds;
	});
	const results = await Promise.allSettled([request("first"), request("failed"), request("third")]);
	assert.deepEqual(starts, [0, 10000, 20000]);
	assert.deepEqual(sleeps, [0, 10000, 10000]);
	assert.deepEqual(results.map(result => result.status), ["fulfilled", "rejected", "fulfilled"]);
});

test("Utah persists accepted future records, waits for empty publication and retains snapshots on discovery drift", async () => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-utah-cycle-"));
	try {
		const catalogPath = join(directory, "cycles.json");
		let clock = now;
		const options = { familyId: original.id, catalogPath, dataDirectory: directory, now: () => clock, fetchDiscovery: async () => discovery(), fetchCandidates: async () => page("2028", false) };
		const pending = await syncStateBallotCycles(options);
		assert.equal(pending.results[0]!.status, "awaiting-records");
		clock += 5 * 60 * 60 * 1000;
		const accepted = await syncStateBallotCycles({ ...options, fetchCandidates: async () => page() });
		assert.equal(accepted.results[0]!.status, "available");
		assert.equal(accepted.results[0]!.records, 6);
		const storage = createStateBallotStorage(directory);
		const snapshot = await storage.read(future());
		assert.ok(snapshot);
		clock += 1000;
		const cached = await syncStateBallotCycles({ ...options, fetchCandidates: async () => {
			throw new Error("Cached data must not be downloaded");
		} });
		assert.equal(cached.results[0]!.retrievedAt, accepted.results[0]!.retrievedAt);
		const before = await readFile(catalogPath, "utf8");
		await assert.rejects(() => syncStateBallotCycles({ ...options, fetchDiscovery: async () => discovery("2026", "3") }), /unexpired/u);
		assert.equal(await readFile(catalogPath, "utf8"), before);
		assert.deepEqual(await storage.read(future()), snapshot);
		const environment = { STATE_BALLOT_DATA_DIR: directory, STATE_BALLOT_ENABLED_STATES: "UT", STATE_BALLOT_ENABLED_SOURCES: original.id, STATE_BALLOT_ENABLED_FAMILIES: original.id, STATE_BALLOT_CYCLE_CATALOGS: JSON.stringify({ [original.id]: catalogPath }) };
		const automated = await refreshApprovedCandidateData({ environment, now: () => clock, fetchDiscovery: async () => discovery(), fetchText: async () => {
			throw new Error("Accepted future data must remain cached");
		} });
		assert.equal(automated.results.find(result => result.sourceId === future().id)?.status, "cached");
		assert.equal(automated.results.some(result => result.sourceId === original.id), false);
	}
	finally {
		await rm(directory, { recursive: true });
	}
});
