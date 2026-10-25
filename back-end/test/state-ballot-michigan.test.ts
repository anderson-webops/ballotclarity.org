import assert from "node:assert/strict";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import test from "node:test";
import { refreshApprovedCandidateData } from "../src/state-ballot-automation.js";
import { fetchStateBallotCycleDiscovery, syncStateBallotCycles } from "../src/state-ballot-cycle-sync.js";
import { discoverStateBallotElectionCycles, parseStateBallotCycleCatalog, stateBallotCycleSources } from "../src/state-ballot-cycles.js";
import { fetchStateBallotSourceText } from "../src/state-ballot-fetch.js";
import { michiganCandidateCapture, michiganCandidateRosterUrl, michiganDiscoveryUrl, readMichiganCandidateIndex, readMichiganElectionDiscovery, readMichiganReportElection } from "../src/state-ballot-michigan.js";
import { parseStateCandidateRecords } from "../src/state-ballot-records.js";
import { configuredStateBallotSources } from "../src/state-ballot-registry.js";
import { buildStateBallotPreview, createStateBallotRepository } from "../src/state-ballot-repository.js";
import { parseBundledStateSnapshot } from "../src/state-ballot-snapshot.js";
import { StateBallotAwaitingRecordsError } from "../src/state-ballot-source-state.js";
import { createStateBallotStorage, serializeStoredStateSnapshot } from "../src/state-ballot-storage.js";

const original = configuredStateBallotSources.find(source => source.id === "mi-dos-2026")!;
const now = Date.parse("2026-10-25T12:00:00Z");
const day = (year: string) => year === "2028" ? "7" : year === "2030" ? "5" : "3";
const url = (year: string) => `https://mi-boe.entellitrak.com/etk-mi-boe-prod/page.request.do?page=page.miboePublicReport&electionType=GEN&electionYear=${year}`;
const index = (years = ["2026", "2028"]) => `<h1>Elections</h1><div><h3>Filing for Office and Petition Filing</h3>${years.map(year => `<a href="${url(year)}">${year} November General Candidate Listing</a>`).join("")}<a href="https://mi-boe.entellitrak.com/etk-mi-boe-prod/page.request.do?page=page.miboePublicReport&amp;electionType=PRI&amp;electionYear=2028">2028 August Primary Candidate Listing</a></div>`;
const header = "<tr><td></td><td colspan=\"2\">Status</td><td></td><td colspan=\"2\">Party / Incumbent</td><td colspan=\"3\">Candidate Name</td><td colspan=\"3\">Filed On</td><td>Filing Method</td><td></td></tr>";
const office = (label: string) => `<tr><td></td><td colspan="12"><a id="${label}"></a>${label}</td><td></td></tr>`;
const row = (name: string, status = "") => `<tr><td></td><td colspan="2">${status}</td><td></td><td colspan="2">Example Party</td><td colspan="3">${name}</td><td colspan="3">04/20/2026</td><td>Petitions</td><td></td></tr>`;
const report = (year = "2028", populated = true) => `<table>${["Michigan Department of State", "Official Candidate Listing", "All State and Judicial Offices", "General Election", `Tuesday, November ${day(year)}, ${year}`].map(label => `<tr><td>${label}</td></tr>`).join("")}</table><table>${header}${populated ? office("Governor / Lt. Governor 4 Year Term (1) Position") + row("Ticket Candidate / Running Mate") + office("7th District Representative in Congress 2 Year Term (1) Position") + row("Synthetic Federal") + row("Withdrawn Candidate", "WITHD") + office("Judge of Circuit Court 4th Circuit 6 Year Term (1) Position") + row("Synthetic Regional") + row("Disqualified Candidate", "DISQ") : ""}</table><table><tr><td>${populated ? 6 : 0} Candidates as of October 20</td></tr></table>`;
const discovery = (years = ["2026", "2028"], populated = true) => JSON.stringify({ schemaVersion: 1, type: "michigan-election-discovery", index: index(years), reports: years.map(year => ({ year, url: url(year), records: report(year, populated) })) });
const future = () => stateBallotCycleSources(discoverStateBallotElectionCycles(discovery(), original.id, now), now)[0]!;

test("Michigan discovers only offered even-year general reports and their explicit dates", () => {
	const catalog = discoverStateBallotElectionCycles(discovery(), original.id, now);
	assert.deepEqual(catalog.elections, [{ electionId: null, electionDate: "2026-11-03" }, { electionId: null, electionDate: "2028-11-07" }]);
	assert.equal(future().id, "mi-general-2028-11-07");
	assert.equal(future().url, url("2028"));
	assert.equal(future().pageUrl, future().url);
	assert.equal(original.url, url("2026"));
	assert.throws(() => parseStateBallotCycleCatalog({ ...catalog, elections: [{ electionId: "2028", electionDate: "2028-11-07" }] }, now));
	assert.throws(() => parseStateBallotCycleCatalog({ ...catalog, elections: [{ electionId: null, electionDate: "2027-11-02" }] }, now));
	assert.throws(() => michiganCandidateRosterUrl("2028-03-07"));
	assert.deepEqual(parseStateCandidateRecords(original, report("2026")), parseStateCandidateRecords(original, michiganCandidateCapture(original, discovery(["2026"]))));
});

test("Michigan refuses substituted, repeated, primary, special, mismatched and unsupported index controls", () => {
	for (const body of [index().replace("<h1>Elections", "<h1>Other"), index().replace("Filing for Office and Petition Filing", "Other"), index().replace("electionYear=2028\"", "electionYear=2028&amp;extra=1\""), index().replace("electionYear=2028\"", "electionYear=2030\""), index().replace("electionType=GEN", "electionType=PRI"), index().replace("mi-boe.entellitrak.com", "evil.example"), index(["2028", "2028"]), index(["2027"]), index([])]) assert.throws(() => readMichiganCandidateIndex(body));
	const reordered = index(["2028"]).replace("page=page.miboePublicReport&electionType=GEN&electionYear=2028", "electionYear=2028&amp;electionType=GEN&amp;page=page.miboePublicReport");
	assert.deepEqual(readMichiganCandidateIndex(reordered), [{ year: "2028", url: url("2028") }]);
	const missing = JSON.parse(discovery());
	missing.reports.pop();
	assert.throws(() => readMichiganElectionDiscovery(JSON.stringify(missing)));
	assert.throws(() => readMichiganElectionDiscovery(JSON.stringify({ ...JSON.parse(discovery()), extra: true })));
});

test("Michigan binds report headers and dates without treating primary or stale-year reports as general data", () => {
	assert.equal(readMichiganReportElection(report(), "2028"), "2028-11-07");
	for (const body of [report().replace("Official Candidate Listing", "Other"), report().replace("General Election", "Primary Election"), report().replace("General Election", "Special General Election"), report().replace("Tuesday, November 7, 2028", "Tuesday, November 8, 2028"), report().replace("Tuesday, November 7, 2028", "Tuesday, November 3, 2026"), report().replace("</table>", "<tr><td>Tuesday, November 7, 2028</td></tr></table>")]) assert.throws(() => readMichiganReportElection(body, "2028"));
	assert.throws(() => readMichiganReportElection(" ".repeat(12 * 1024 * 1024 + 1), "2028"));
	assert.throws(() => parseStateCandidateRecords(future(), report()));
	const wrong = JSON.parse(michiganCandidateCapture(future(), discovery()));
	wrong.url = original.url;
	assert.throws(() => parseStateCandidateRecords(future(), JSON.stringify(wrong)));
});

test("Michigan preserves tickets, inactive evidence, reported totals and regional geography while excluding filing metadata", () => {
	const source = future();
	const records = parseStateCandidateRecords(source, michiganCandidateCapture(source, discovery()));
	assert.equal(records.length, 5);
	assert.equal(records.reduce((total, record) => total + record.name.split(/\s\/\s/u).length, 0), 6);
	assert.equal(records[0]!.name, "Ticket Candidate / Running Mate");
	assert.equal(records[2]!.status, "withdrawn");
	assert.equal(records[4]!.status, "disqualified");
	assert.equal(records[3]!.scope, "local");
	assert.doesNotMatch(JSON.stringify(records), /04\/20\/2026|Filed On|Petitions/u);
	const preview = buildStateBallotPreview({ source, records, sha256: "a".repeat(64), retrievedAt: new Date(now).toISOString() }, { districtMatches: [] });
	assert.equal(preview?.candidateCount, 1);
	for (const body of [report().replace("6 Candidates", "7 Candidates"), report().replace("WITHD", "UNKNOWN"), report().replace("Filing Method", "Changed"), report().replace("Candidates as of", "Candidates total")]) {
		const capture = JSON.parse(michiganCandidateCapture(source, discovery()));
		capture.records = body;
		assert.throws(() => parseStateCandidateRecords(source, JSON.stringify(capture)));
	}
	assert.throws(() => parseStateCandidateRecords(source, michiganCandidateCapture(source, discovery(["2028"], false))), StateBallotAwaitingRecordsError);
});

test("Michigan uses bounded published GET controls and validates source identity before network access", async () => {
	const requests: string[] = [];
	const capture = await fetchStateBallotCycleDiscovery(async (requestUrl, options) => {
		requests.push(String(requestUrl));
		assert.equal(options?.maxRedirects, 0);
		assert.equal(options?.postBody, undefined);
		assert.deepEqual(options?.allowedHosts, [new URL(requestUrl).hostname]);
		return requestUrl === michiganDiscoveryUrl ? index() : report(new URL(requestUrl).searchParams.get("electionYear")!);
	}, original.id);
	assert.deepEqual(requests, [michiganDiscoveryUrl, url("2026"), url("2028")]);
	assert.equal(readMichiganElectionDiscovery(capture).length, 2);
	const downloads: string[] = [];
	const body = await fetchStateBallotSourceText(future(), async (requestUrl, options) => {
		downloads.push(requestUrl);
		assert.equal(options.maxRedirects, 0);
		return requestUrl === michiganDiscoveryUrl ? index() : report();
	});
	assert.deepEqual(downloads, [michiganDiscoveryUrl, url("2028")]);
	assert.equal(parseStateCandidateRecords(future(), body).length, 5);
	await assert.rejects(() => fetchStateBallotSourceText({ ...future(), pageUrl: original.url }, async () => {
		throw new Error("Invalid source must not be downloaded");
	}));
});

test("Michigan reuses discovery, persists future waiting/recovery and retains accepted data on unexpired-election drift", async () => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-mi-cycle-"));
	try {
		let clock = now;
		const catalogPath = join(directory, "cycles.json");
		const options = { familyId: original.id, catalogPath, dataDirectory: directory, now: () => clock, fetchDiscovery: async () => discovery(["2028"], false) };
		assert.equal((await syncStateBallotCycles(options)).results[0]!.status, "awaiting-records");
		clock += 5 * 60 * 60 * 1000;
		const accepted = await syncStateBallotCycles({ ...options, fetchDiscovery: async () => discovery(["2028"]) });
		assert.equal(accepted.results[0]!.status, "available");
		assert.equal(accepted.results[0]!.records, 5);
		const before = await readFile(catalogPath, "utf8");
		await assert.rejects(() => syncStateBallotCycles({ ...options, fetchDiscovery: async () => discovery(["2026"]) }), /unexpired/u);
		assert.equal(await readFile(catalogPath, "utf8"), before);
		const storage = createStateBallotStorage(directory);
		assert.equal((await storage.read(future()))!.records.length, 5);
		const environment = { STATE_BALLOT_DATA_DIR: directory, STATE_BALLOT_ENABLED_STATES: "MI", STATE_BALLOT_ENABLED_SOURCES: original.id, STATE_BALLOT_ENABLED_FAMILIES: original.id, STATE_BALLOT_CYCLE_CATALOGS: JSON.stringify({ [original.id]: catalogPath }) };
		const cached = await refreshApprovedCandidateData({ environment, now: () => clock, fetchDiscovery: async () => discovery(["2028"]), fetchText: async () => {
			throw new Error("Accepted future snapshots must not be downloaded");
		} });
		assert.equal(cached.results[0]!.status, "cached");
		assert.equal(cached.results[0]!.sourceId, future().id);
	}
	finally {
		await rm(directory, { recursive: true });
	}
});

test("Michigan running and cold repositories consume a newly published future catalog without a restart or expanded exact-source allowlist", async () => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-mi-hot-"));
	const environment = { STATE_BALLOT_DATA_DIR: directory, STATE_BALLOT_ENABLED_STATES: "MI", STATE_BALLOT_ENABLED_SOURCES: original.id, STATE_BALLOT_ENABLED_FAMILIES: original.id, STATE_BALLOT_CYCLE_CATALOGS: JSON.stringify({ [original.id]: join(directory, "cycles.json") }) };
	const previous = Object.fromEntries(Object.keys(environment).map(key => [key, process.env[key]]));
	try {
		Object.assign(process.env, environment);
		const clock = Date.parse("2027-01-01T00:00:00Z");
		let downloads = 0;
		const options = { now: () => clock, fetchText: async () => {
			downloads++;
			throw new Error("Live providers disabled");
		} };
		const running = createStateBallotRepository(options);
		assert.equal(await running.getSnapshot("MI"), null);
		await syncStateBallotCycles({ familyId: original.id, catalogPath: join(directory, "cycles.json"), dataDirectory: directory, now: () => clock, fetchDiscovery: async () => discovery(["2028"]) });
		assert.equal((await running.getSnapshot("MI"))!.source.id, future().id);
		assert.equal((await createStateBallotRepository(options).getSnapshot("MI"))!.source.id, future().id);
		assert.equal(downloads, 0);
	}
	finally {
		for (const [key, value] of Object.entries(previous)) {
			if (value === undefined) delete process.env[key];
			else process.env[key] = value;
		}
		await rm(directory, { recursive: true });
	}
});

test("Michigan separates incumbent labels from parties while retaining IDs, cached bytes, capture clocks and legacy rollback encoding", async () => {
	const body = report("2026").replace("Example Party", "INCUMBENT");
	const record = parseStateCandidateRecords(original, body)[0]!;
	assert.equal(record.party, undefined);
	assert.equal(record.incumbent, true);
	const snapshot = { source: original, records: parseStateCandidateRecords(original, body), retrievedAt: new Date(now).toISOString(), sha256: "a".repeat(64) };
	const normalized = (value: unknown) => JSON.parse(JSON.stringify(value));
	const legacy = JSON.parse(serializeStoredStateSnapshot(snapshot));
	assert.equal(legacy.records[0].id, record.id);
	assert.equal(legacy.records[0].party, "INCUMBENT");
	assert.equal(Object.hasOwn(legacy.records[0], "incumbent"), false);
	const restored = parseBundledStateSnapshot(original, JSON.stringify(legacy), "automatic");
	assert.deepEqual(normalized(restored), normalized(snapshot));
	for (const incumbent of [false, "true", {}, 1]) {
		const invalid = structuredClone(legacy);
		invalid.records[0].incumbent = incumbent;
		assert.throws(() => parseBundledStateSnapshot(original, JSON.stringify(invalid), "automatic"));
	}
	assert.throws(() => serializeStoredStateSnapshot({ ...snapshot, records: [{ ...record, party: "Republican Party" }] }), /legacy party encoding/u);
	const directory = await mkdtemp(join(tmpdir(), "ballot-mi-incumbent-"));
	try {
		const storage = createStateBallotStorage(directory);
		await storage.write(snapshot);
		const filename = (await readdir(directory)).find(filename => !filename.endsWith(".pending"))!;
		const bytes = await readFile(join(directory, filename));
		const loaded = await storage.read(original);
		assert.deepEqual(normalized(loaded), normalized(snapshot));
		assert.deepEqual(await readFile(join(directory, filename)), bytes);
		assert.equal(loaded!.retrievedAt, snapshot.retrievedAt);
		assert.equal(loaded!.sha256, snapshot.sha256);
	}
	finally {
		await rm(directory, { recursive: true });
	}
});
