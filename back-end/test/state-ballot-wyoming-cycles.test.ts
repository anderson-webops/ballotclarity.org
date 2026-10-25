import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import test from "node:test";
import express from "express";
import { refreshApprovedCandidateData } from "../src/state-ballot-automation.js";
import { fetchStateBallotCycleDiscovery, syncStateBallotCycles } from "../src/state-ballot-cycle-sync.js";
import { discoverStateBallotElectionCycles, parseStateBallotCycleCatalog, readWyomingGeneralElectionDate, stateBallotCycleSources, wyomingCandidateRosterUrl } from "../src/state-ballot-cycles.js";
import { fetchStateBallotSourceText } from "../src/state-ballot-fetch.js";
import { parseStateCandidateRecords, stateRecordMatchesDistricts } from "../src/state-ballot-records.js";
import { configuredStateBallotSources } from "../src/state-ballot-registry.js";
import { createStateBallotRepository, resolveStateBallotConfiguration } from "../src/state-ballot-repository.js";
import { createStateBallotStorage } from "../src/state-ballot-storage.js";
import { registerStateRecordRoutes } from "../src/state-records.js";

const now = Date.parse("2026-10-24T12:00:00.000Z");
const original = configuredStateBallotSources.find(source => source.id === "wy-sos-2026")!;
function discovery(year = "2026", day = "3") {
	const label = `<h4>Primary Election: August 18, ${year} | General Election: <b>November ${day}, ${year}</b></h4>`;
	return `<h1>Welcome to the Election Center</h1>${label}${label}<div><h3>${year} Election Information</h3><ul><li><a href="/Elections/Docs/${year}/${year}_WY_General_Election_Candidates.pdf">General Election Candidates Roster (PDF file)</a></li><li><a href="/Elections/Docs/${year}/${year}_WY_General_Election_Candidates.csv">General Election Candidates (Excel data file)</a></li></ul></div>`;
}
function candidates(year = "2026") {
	return `Election,Office Sought,Party Affiliation,Ballot Name,Date Withdrawn,Email Address,Mailing Address,Web Address
${year} GENERAL ELECTION,UNITED STATES REPRESENTATIVE,Democratic,Synthetic Federal Candidate,,unused@example.org,Unused private field,https://candidate.example.org
${year} GENERAL ELECTION,STATE SENATOR 01,Republican,Synthetic Senate Candidate,,,,
${year} GENERAL ELECTION,STATE REPRESENTATIVE 62,Independent,Synthetic House Candidate,,,,
${year} GENERAL ELECTION,DISTRICT COURT JUDGE 01,,Synthetic Local Candidate,,,,
${year} GENERAL ELECTION,GOVERNOR,Republican,Synthetic Withdrawn Candidate,10/01/${year},,,
`;
}

test("Wyoming discovery binds the explicit official date and both roster links without invented election identifiers", () => {
	const catalog = discoverStateBallotElectionCycles(discovery(), original.id, now);
	assert.deepEqual(catalog.elections, [{ electionId: null, electionDate: original.electionDate }]);
	assert.deepEqual(stateBallotCycleSources(catalog), []);
	const future = discoverStateBallotElectionCycles(discovery("2028", "7"), original.id, now);
	const [source] = stateBallotCycleSources(future);
	assert.equal(source!.id, "wy-general-2028-11-07");
	assert.equal(source!.url, "https://sos.wyo.gov/Elections/Docs/2028/2028_WY_General_Election_Candidates.csv");
	assert.equal(source!.pageUrl, "https://sos.wyo.gov/elections/default.aspx");
	assert.equal(source!.retrievalPolicy, undefined);
	assert.equal(source!.format, original.format);
	assert.equal(source!.scopeNotice, original.scopeNotice);
	assert.equal(original.url, wyomingCandidateRosterUrl(original.electionDate));
	assert.throws(() => parseStateBallotCycleCatalog({ ...future, elections: [{ electionId: "2028", electionDate: "2028-11-07" }] }, now));
});

test("Wyoming discovery rejects changed pages, ambiguous dates, wrong-year links and primary or external replacements", () => {
	const page = discovery();
	for (const changed of [
		page.replace("Welcome to the Election Center", "Access denied"),
		page.replaceAll("General Election:", "Special Election:"),
		page.replace("November 3, 2026", "November 7, 2028"),
		discovery("2027", "2"),
		discovery("2028", "8"),
		page.replace("2026 Election Information", "2024 Election Information"),
		page.replace("2026_WY_General_Election_Candidates.csv", "2024_WY_General_Election_Candidates.csv"),
		page.replace("2026_WY_General_Election_Candidates.csv", "2026_WY_Primary_Election_Candidates.csv"),
		page.replace("2026_WY_General_Election_Candidates.pdf", "2024_WY_General_Election_Candidates.pdf"),
		page.replace("href=\"/Elections/Docs/2026/2026_WY_General_Election_Candidates.csv\"", "href=\"https://example.org/candidates.csv\""),
		page.replace("2026_WY_General_Election_Candidates.csv\"", "2026_WY_General_Election_Candidates.csv?election=primary\""),
		page + page,
		"<h1>Welcome to the Election Center</h1>",
		"x".repeat(2 * 1024 * 1024 + 1)
	]) assert.throws(() => readWyomingGeneralElectionDate(changed));
});

test("Wyoming transport preserves the exact dated HTTPS roster and refuses redirects or alternate endpoints", async () => {
	assert.equal(await fetchStateBallotCycleDiscovery(async (url, options) => {
		assert.equal(url, "https://sos.wyo.gov/elections/default.aspx");
		assert.ok(options);
		assert.equal(options.maxRedirects, 0);
		assert.deepEqual(options.allowedHosts, ["sos.wyo.gov"]);
		return discovery();
	}, original.id), discovery());
	const future = stateBallotCycleSources(discoverStateBallotElectionCycles(discovery("2028", "7"), original.id, now))[0]!;
	assert.equal(await fetchStateBallotSourceText(future, async (url, options) => {
		assert.equal(url, future.url);
		assert.equal(options.maxRedirects, 0);
		assert.equal(options.maxBytes, 12 * 1024 * 1024);
		return candidates("2028");
	}), candidates("2028"));
	for (const url of [future.url.replace("2028_WY", "2026_WY"), `${future.url}?download=1`, future.url.replace("https:", "http:"), future.url.replace("sos.wyo.gov", "example.org")]) {
		await assert.rejects(fetchStateBallotSourceText({ ...future, url }, async () => {
			assert.fail("Unbound transport must not be requested");
		}));
	}
});

test("future Wyoming CSVs retain explicit parties and districts, exclude contact fields and reject mismatched elections", () => {
	const future = stateBallotCycleSources(discoverStateBallotElectionCycles(discovery("2028", "7"), original.id, now))[0]!;
	const records = parseStateCandidateRecords(future, candidates("2028"));
	assert.equal(records.length, 5);
	assert.equal(records[0]!.scope, "statewide");
	assert.equal(records[0]!.party, "Democratic");
	assert.equal(records[0]!.candidateUrl, "https://candidate.example.org/");
	assert.equal(records[1]!.district, "1");
	assert.equal(records[2]!.district, "62");
	assert.equal(records[3]!.scope, "local");
	assert.equal(records[4]!.status, "withdrawn");
	assert.equal(stateRecordMatchesDistricts(records[1]!, [{ id: "sldu-01", label: "Senate District 1", districtType: "state-senate", districtCode: "01", sourceSystem: "census-geocoder" }]), true);
	assert.equal(stateRecordMatchesDistricts(records[1]!, [{ id: "sldu-02", label: "Senate District 2", districtType: "state-senate", districtCode: "02", sourceSystem: "census-geocoder" }]), false);
	assert.equal(stateRecordMatchesDistricts(records[3]!, []), false);
	assert.doesNotMatch(JSON.stringify(records), /unused@example|Unused private field/iu);
	assert.throws(() => parseStateCandidateRecords(future, candidates("2026")));
	assert.throws(() => parseStateCandidateRecords(future, candidates("2028").replace("2028 GENERAL ELECTION", "2028 PRIMARY ELECTION")));
	for (const office of ["STATE SENATOR 00", "STATE SENATOR unknown", "STATE REPRESENTATIVE 62 AND 63"]) assert.throws(() => parseStateCandidateRecords(future, candidates("2028").replace("STATE SENATOR 01", office)));
});

test("Wyoming cycle rollover is automatic, idempotent, source-allowlisted and last-good recoverable", async () => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-wyoming-cycles-"));
	const catalogPath = join(directory, "cycles.json");
	const dataDirectory = join(directory, "data");
	const environment = { ...process.env };
	let server: ReturnType<ReturnType<typeof express>["listen"]> | undefined;
	try {
		let clock = now;
		let requests = 0;
		const options = { familyId: original.id, catalogPath, dataDirectory, now: () => clock, fetchDiscovery: async () => discovery(), fetchCandidates: async () => {
			requests++;
			return candidates();
		} };
		await syncStateBallotCycles(options);
		assert.equal(requests, 1);
		await syncStateBallotCycles(options);
		assert.equal(requests, 1);
		const currentBytes = await readFile(catalogPath, "utf8");
		await assert.rejects(syncStateBallotCycles({ ...options, fetchDiscovery: async () => discovery("2028", "7") }));
		assert.equal(await readFile(catalogPath, "utf8"), currentBytes);
		clock = Date.parse("2028-10-24T12:00:00.000Z");
		await syncStateBallotCycles({ ...options, fetchDiscovery: async () => discovery("2028", "7"), fetchCandidates: async () => {
			requests++;
			return candidates("2028");
		} });
		const catalogBytes = await readFile(catalogPath, "utf8");
		process.env.STATE_BALLOT_CYCLE_CATALOGS = JSON.stringify({ [original.id]: catalogPath });
		process.env.STATE_BALLOT_DATA_DIR = dataDirectory;
		process.env.STATE_BALLOT_ENABLED_FAMILIES = original.id;
		process.env.STATE_BALLOT_ENABLED_STATES = "WY";
		delete process.env.STATE_BALLOT_CYCLE_CATALOG;
		delete process.env.STATE_BALLOT_ENABLED_SOURCES;
		const configuration = resolveStateBallotConfiguration(process.env, clock);
		const future = configuration.sources.find(source => source.id === "wy-general-2028-11-07")!;
		assert.ok(future);
		assert.throws(() => resolveStateBallotConfiguration({ ...process.env, STATE_BALLOT_ENABLED_STATES: "MT" }, clock));
		assert.ok(!resolveStateBallotConfiguration({ ...process.env, STATE_BALLOT_ENABLED_FAMILIES: undefined, STATE_BALLOT_ENABLED_SOURCES: original.id }, clock).sources.some(source => source.id === future.id));
		const storage = createStateBallotStorage(dataDirectory);
		const accepted = await storage.read(future);
		assert.equal(accepted!.records.length, 5);
		const repository = createStateBallotRepository({ now: () => clock, fetchText: async () => {
			assert.fail("Cold reads must use the accepted durable snapshot");
		} });
		const app = express();
		registerStateRecordRoutes(app, repository);
		server = app.listen(0, "127.0.0.1");
		await once(server, "listening");
		const address = server.address();
		assert.ok(address && typeof address === "object");
		const response = await fetch(`http://127.0.0.1:${address.port}/api/state-records/WY?source=${future.id}&status=all`);
		assert.equal(response.status, 200);
		const body = await response.json();
		assert.equal(body.source.electionDate, future.electionDate);
		assert.equal(body.total, 5);
		assert.equal(body.records[1].district, "1");
		const run = await refreshApprovedCandidateData({ environment: process.env, now: () => clock, fetchDiscovery: async () => discovery("2028", "7"), fetchText: async () => {
			assert.fail("The automatic worker must reuse a fresh durable snapshot");
		} });
		assert.equal(run.status, "succeeded");
		assert.equal(run.results.find(result => result.sourceId === future.id)?.status, "cached");
		clock += 5 * 3600000;
		const failed = await syncStateBallotCycles({ ...options, fetchDiscovery: async () => discovery("2028", "7"), fetchCandidates: async () => candidates("2026") });
		assert.equal(failed.results[0]!.status, "unavailable");
		assert.deepEqual(await storage.read(future), accepted);
		assert.equal(await readFile(catalogPath, "utf8"), catalogBytes);
		await writeFile(catalogPath, "{}");
		assert.ok(repository.sources?.some(source => source.id === future.id));
		assert.equal((await repository.inspectSources!()).find(source => source.id === future.id)?.status, "error");
	}
	finally {
		if (server?.listening) await new Promise<void>((resolve, reject) => server!.close(error => error ? reject(error) : resolve()));
		process.env = environment;
		await rm(directory, { recursive: true, force: true });
	}
});

test("a direct approved-source cache hit never becomes an import merely because its timestamp equals the run start", async () => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-wyoming-worker-"));
	try {
		let requests = 0;
		const options = {
			environment: { STATE_BALLOT_DATA_DIR: directory, STATE_BALLOT_ENABLED_STATES: "WY", STATE_BALLOT_ENABLED_SOURCES: original.id },
			now: () => now,
			fetchText: async () => {
				requests++;
				return candidates();
			}
		};
		const fresh = await refreshApprovedCandidateData(options);
		assert.equal(fresh.results[0]!.status, "imported");
		const cached = await refreshApprovedCandidateData(options);
		assert.equal(cached.results[0]!.status, "cached");
		assert.equal(cached.lastImportAt, fresh.lastImportAt);
		assert.equal(requests, 1);
	}
	finally {
		await rm(directory, { recursive: true, force: true });
	}
});
