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
import { delawareCandidateRosterUrl, discoverStateBallotElectionCycles, parseStateBallotCycleCatalog, stateBallotCycleSources } from "../src/state-ballot-cycles.js";
import { fetchStateBallotSourceText } from "../src/state-ballot-fetch.js";
import { parseStateCandidateRecords, stateRecordMatchesDistricts } from "../src/state-ballot-records.js";
import { configuredStateBallotSources } from "../src/state-ballot-registry.js";
import { createStateBallotRepository, resolveStateBallotConfiguration } from "../src/state-ballot-repository.js";
import { createStateBallotStorage } from "../src/state-ballot-storage.js";
import { registerStateRecordRoutes } from "../src/state-records.js";

const now = Date.parse("2026-10-24T12:00:00.000Z");
const original = configuredStateBallotSources.find(source => source.id === "de-doe-2026")!;
function discovery(future = false) {
	return `<h1>Candidate List</h1><h2>2026 Candidates</h2><a href="/candidates/candidatelist/genl_fcddt_2026.html">11/03/2026 Statewide General</a><a href="/candidates/candidatelist/prim_fcddt_2026.html">9/15/2026 Statewide Primary</a><a href="/candidates/candidatelist/genl_fcddt_2008.html">2008 Statewide General</a>${future ? "<h2>2028 Candidates</h2><a href=\"/candidates/candidatelist/genl_fcddt_2028.html\">11/7/2028 Statewide General</a>" : ""}`;
}
function candidates(year = "2026", day = "3") {
	const header = ["Office", "County", "Party", "Candidate", "Status", "Filed"].map(label => `<th>${label}</th>`).join("");
	const rows = [
		["U.S. Senator", "Statewide", "Democratic", "Synthetic Senator", "Qualified"],
		["Representative in Congress", "Statewide", "Republican", "Synthetic Federal Candidate", "Qualified"],
		["State Senator District 1", "New Castle", "Independent", "Synthetic State Candidate", "Filed"],
		["Recorder of Deeds", "Kent", "Democratic", "Synthetic County Candidate", "Qualified"],
		["Recorder of Deeds", "Sussex", "Democratic", "Synthetic County Candidate", "Withdrawn"]
	].map(values => `<tr>${[...values, `6/12/${year}`].map((value, index) => `<td data-label="${["Office", "County", "Party", "Candidate", "Status", "Date Filed"][index]}">${index === 3 ? `<span class="main-span">${value}</span><span class="sub-span">Private address private@example.org</span>` : value}</td>`).join("")}</tr>`).join("");
	return `<h1>General Election 11/${day}/${year}</h1><table><thead><tr>${header}</tr></thead><tbody>${rows}</tbody></table>`;
}

test("Delaware discovers only explicitly dated general-election roster links and retains original source bindings", () => {
	const current = discoverStateBallotElectionCycles(discovery(), original.id, now);
	assert.deepEqual(current.elections, [{ electionId: null, electionDate: original.electionDate }]);
	assert.deepEqual(stateBallotCycleSources(current, now), []);
	const catalog = discoverStateBallotElectionCycles(discovery(true), original.id, now);
	const [future] = stateBallotCycleSources(catalog, now);
	assert.equal(future!.id, "de-general-2028-11-07");
	assert.equal(future!.url, "https://elections.delaware.gov/candidates/candidatelist/genl_fcddt_2028.html");
	assert.equal(future!.pageUrl, future!.url);
	assert.equal(future!.format, original.format);
	assert.equal(future!.scopeNotice, original.scopeNotice);
	assert.equal(future!.retrievalPolicy, undefined);
	assert.equal(original.url, delawareCandidateRosterUrl(original.electionDate));
	assert.throws(() => parseStateBallotCycleCatalog({ ...catalog, elections: [{ electionId: "2028", electionDate: "2028-11-07" }] }, now));
});

test("Delaware discovery rejects ambiguous dates, changed labels, guessed years and alternate or primary roster paths", () => {
	for (const body of [
		discovery().replace("Candidate List", "Access denied"),
		discovery().replace("11/03/2026 Statewide General", "2026 Statewide General"),
		discovery().replace("genl_fcddt_2026.html", "prim_fcddt_2026.html"),
		discovery().replace("genl_fcddt_2026.html", "genl_fcddt_2028.html"),
		discovery().replace("11/03/2026", "11/04/2026"),
		discovery().replace("href=\"/candidates/candidatelist/genl_fcddt_2026.html\"", "href=\"https://example.org/candidates/candidatelist/genl_fcddt_2026.html\""),
		discovery().replace("genl_fcddt_2026.html", "genl_fcddt_2026.html?primary=1"),
		discovery().replace("genl_fcddt_2026.html", "genl_fcddt_2026.html#different"),
		discovery().replaceAll("2026", "2027").replace("11/03/2027", "11/02/2027"),
		`${discovery().replace("<h1>Candidate List</h1>", "")}${discovery()}`,
		`${discovery()}<a href="/candidates/candidatelist/genl_fcddt_2026.html">11/03/2026 Statewide General</a>`,
		"x".repeat(2 * 1024 * 1024 + 1)
	]) assert.throws(() => discoverStateBallotElectionCycles(body, original.id, now));
});

test("Delaware transport pins the exact reviewed election path and does not follow candidate or discovery redirects", async () => {
	await fetchStateBallotCycleDiscovery(async (url, options) => {
		assert.equal(url, "https://elections.delaware.gov/candidates/candidatelist/");
		assert.ok(options);
		assert.equal(options.maxRedirects, 0);
		assert.deepEqual(options.allowedHosts, ["elections.delaware.gov"]);
		return discovery();
	}, original.id);
	const future = stateBallotCycleSources(discoverStateBallotElectionCycles(discovery(true), original.id, now), now)[0]!;
	assert.equal(await fetchStateBallotSourceText(future, async (url, options) => {
		assert.equal(url, future.url);
		assert.equal(options.maxRedirects, 0);
		assert.equal(options.maxBytes, 12 * 1024 * 1024);
		return candidates("2028", "7");
	}), candidates("2028", "7"));
	for (const changed of [{ ...future, url: `${future.url}?download=1` }, { ...future, id: original.id }, { ...future, electionDate: "2027-11-02" }, { ...future, pageUrl: original.url }, { ...future, stateCode: "WA" }]) {
		await assert.rejects(fetchStateBallotSourceText(changed, async () => {
			assert.fail("Unbound source identities must not make a publisher request");
		}));
	}
});

test("future Delaware records bind the exact report date, retain county identity and omit private contact fields", () => {
	const future = stateBallotCycleSources(discoverStateBallotElectionCycles(discovery(true), original.id, now), now)[0]!;
	const records = parseStateCandidateRecords(future, candidates("2028", "7"));
	assert.equal(records.length, 5);
	assert.equal(records[0]!.scope, "statewide");
	assert.equal(records[0]!.party, "Democratic");
	assert.equal(records[1]!.scope, "statewide");
	assert.equal(records[2]!.district, "1");
	assert.equal(records[2]!.status, "filed");
	assert.equal(records[3]!.jurisdiction, "Kent");
	assert.equal(records[4]!.jurisdiction, "Sussex");
	assert.notEqual(records[3]!.id, records[4]!.id);
	assert.equal(records[4]!.status, "withdrawn");
	assert.equal(stateRecordMatchesDistricts(records[2]!, [{ id: "sldu-01", label: "Senate District 1", districtType: "state-senate", districtCode: "01", sourceSystem: "census-geocoder" }]), true);
	assert.equal(stateRecordMatchesDistricts(records[3]!, []), false);
	assert.doesNotMatch(JSON.stringify(records), /Private address|private@example/iu);
	for (const body of [candidates(), candidates("2028", "8"), candidates("2028", "7").replace("<th>County</th>", "<th>Location</th>"), candidates("2028", "7").replace("data-label=\"County\"", "data-label=\"Location\""), candidates("2028", "7").replace("Synthetic Senator</span>", "</span>"), candidates("2028", "7").replace("<span class=\"main-span\">Synthetic Senator</span>", "<span class=\"main-span\">Synthetic Senator</span><span class=\"main-span\">Another name</span>"), candidates("2028", "7").replace("data-label=\"County\">Kent", "data-label=\"County\">")]) assert.throws(() => parseStateCandidateRecords(future, body));
});

test("Delaware future discovery flows through approved automation and cold API reads without annual source changes", async () => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-delaware-cycles-"));
	const environment = { ...process.env };
	let server: ReturnType<ReturnType<typeof express>["listen"]> | undefined;
	try {
		let clock = now;
		let requests = 0;
		const catalogPath = join(directory, "cycles.json");
		const dataDirectory = join(directory, "data");
		const options = { familyId: original.id, catalogPath, dataDirectory, now: () => clock, fetchDiscovery: async () => discovery(), fetchCandidates: async () => {
			requests++;
			return candidates();
		} };
		assert.equal((await syncStateBallotCycles(options)).results[0]!.imported, true);
		assert.equal((await syncStateBallotCycles(options)).results[0]!.imported, false);
		assert.equal(requests, 1);
		const currentBytes = await readFile(catalogPath);
		await assert.rejects(syncStateBallotCycles({ ...options, fetchDiscovery: async () => discovery(true).replace("11/03/2026 Statewide General", "Statewide Primary") }), /unexpired/u);
		assert.deepEqual(await readFile(catalogPath), currentBytes);
		clock = Date.parse("2028-10-24T12:00:00.000Z");
		await syncStateBallotCycles({ ...options, fetchDiscovery: async () => discovery(true), fetchCandidates: async () => {
			requests++;
			return candidates("2028", "7");
		} });
		const catalogBytes = await readFile(catalogPath);
		process.env.STATE_BALLOT_CYCLE_CATALOGS = JSON.stringify({ [original.id]: catalogPath });
		process.env.STATE_BALLOT_DATA_DIR = dataDirectory;
		process.env.STATE_BALLOT_ENABLED_STATES = "DE";
		process.env.STATE_BALLOT_ENABLED_FAMILIES = original.id;
		process.env.STATE_BALLOT_ENABLED_SOURCES = original.id;
		delete process.env.STATE_BALLOT_CYCLE_CATALOG;
		const future = resolveStateBallotConfiguration(process.env, clock).sources.find(source => source.id === "de-general-2028-11-07")!;
		assert.ok(future);
		assert.ok(!resolveStateBallotConfiguration({ ...process.env, STATE_BALLOT_ENABLED_FAMILIES: undefined }, clock).sources.some(source => source.id === future.id));
		assert.throws(() => resolveStateBallotConfiguration({ ...process.env, STATE_BALLOT_ENABLED_STATES: "SD" }, clock));
		const storage = createStateBallotStorage(dataDirectory);
		const accepted = await storage.read(future);
		assert.equal(accepted!.records.length, 5);
		const repository = createStateBallotRepository({ now: () => clock, fetchText: async () => {
			assert.fail("Cold requests must use the accepted durable snapshot");
		} });
		const app = express();
		registerStateRecordRoutes(app, repository);
		server = app.listen(0, "127.0.0.1");
		await once(server, "listening");
		const address = server.address();
		assert.ok(address && typeof address === "object");
		const response = await fetch(`http://127.0.0.1:${address.port}/api/state-records/DE?source=${future.id}&status=all`);
		assert.equal(response.status, 200);
		const body = await response.json();
		assert.equal(body.source.electionDate, future.electionDate);
		assert.equal(body.total, 5);
		const cached = await refreshApprovedCandidateData({ environment: process.env, now: () => clock, fetchDiscovery: async () => discovery(true), fetchText: async () => {
			assert.fail("The worker must reuse the fresh accepted snapshot");
		} });
		assert.equal(cached.status, "succeeded");
		assert.equal(cached.results.find(result => result.sourceId === future.id)?.status, "cached");
		await assert.rejects(syncStateBallotCycles({ ...options, fetchDiscovery: async () => {
			throw new Error("403: source access denied");
		} }));
		clock += 5 * 3600000;
		const failed = await syncStateBallotCycles({ ...options, fetchDiscovery: async () => discovery(true), fetchCandidates: async () => candidates() });
		assert.equal(failed.results.find(result => result.sourceId === future.id)?.status, "unavailable");
		assert.deepEqual(await storage.read(future), accepted);
		assert.deepEqual(await readFile(catalogPath), catalogBytes);
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
