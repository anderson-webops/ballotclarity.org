import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import test from "node:test";
import express from "express";
import { fetchStateBallotCycleDiscovery, syncStateBallotCycles } from "../src/state-ballot-cycle-sync.js";
import { discoverWashingtonElectionCycles, parseStateBallotCycleCatalog, readStateBallotCycleCatalog, stateBallotCycleSources, writeStateBallotCycleCatalog } from "../src/state-ballot-cycles.js";
import { parseStateCandidateRecords } from "../src/state-ballot-records.js";
import { configuredStateBallotSources } from "../src/state-ballot-registry.js";
import { createStateBallotRepository, resolveStateBallotConfiguration } from "../src/state-ballot-repository.js";
import { createStateBallotStorage } from "../src/state-ballot-storage.js";
import { fetchWashingtonCandidatePages } from "../src/state-ballot-washington.js";
import { registerStateRecordRoutes } from "../src/state-records.js";

const now = Date.parse("2026-10-24T12:00:00.000Z");
const prefix = "ctl00$ContentPlaceHolder1$";
const grid = `${prefix}grdCandidates`;
const original = configuredStateBallotSources.find(source => source.id === "wa-general-2026")!;

test("discovery permits one bounded official-host redirect without weakening candidate election bindings", async () => {
	let attempts = 0;
	assert.equal(await fetchStateBallotCycleDiscovery(async (url, options) => {
		attempts++;
		assert.equal(url, "https://voter.votewa.gov/CandidateList.aspx");
		assert.deepEqual(options, { allowedHosts: ["voter.votewa.gov"], maxBytes: 2 * 1024 * 1024, maxRedirects: 1, timeoutMs: 12000 });
		return "official page";
	}), "official page");
	assert.equal(attempts, 1);
});
const option = (id: string, date: string) => `<option value="${id}">GENERAL ${date.slice(0, 4)} (${date.slice(5, 7)}/${date.slice(8, 10)}/${date.slice(0, 4)}) (General)</option>`;
const discovery = (extra = option("906", "2027-11-02")) => `<form method="post" action="./CandidateList.aspx?e=899"><select name="${prefix}ddlElection">${option("899", "2026-11-03")}${extra}<option value="898">PRIMARY 2026 (08/04/2026) (Primary)</option><option value="897">April Special (04/28/2026) (Special)</option></select></form>`;

function candidatePage(electionId: string, date: string, name = "Synthetic Candidate") {
	const year = date.slice(0, 4);
	const headers = ["District Type", "District", "Race", "Term Type", "Term Length", "Name", "Mailing Address", "Email", "Phone", "Filing Date", "Party Preference", "Status", "Election Status", "Ballot Order"];
	const values = ["Congressional", "Congressional District 1", "U.S. Representative", "Regular", "2", name, "", "", "", `05/01/${year}`, "STATES NO PARTY PREFERENCE", "Active", "In General", "1"];
	return `<form method="post" action="./CandidateList.aspx?e=${electionId}"><select name="${prefix}ddlElection">${option(electionId, date)}</select><select name="${prefix}ddlCounty"><option value=""></option></select><select name="ctl00$ddlLanguages"><option value="en-us">English</option></select><input type="hidden" name="${prefix}hidElectionDate" value="GENERAL ${year}"><input type="hidden" name="${prefix}hidElectionType" value="General">${["DistrictType", "Jurisdiction", "Race", "BallotName", "PetitionFilingDate", "PoliticalPartyID"].map(filter => `<input class="rgFilterBox" name="${grid}$ctl00$ctl02$ctl03$FilterTextBox_${filter}" value="">`).join("")}<table id="ctl00_ContentPlaceHolder1_grdCandidates_ctl00"><tr>${headers.map(header => `<th class="rgHeader">${header}</th>`).join("")}</tr><tr class="rgRow">${values.map((value, index) => `<td>${index === 5 ? `<a href="/genericvoterguide.aspx?e=${electionId}&amp;c=#/candidates/1001/2001">${value}</a>` : value}</td>`).join("")}</tr><tr><td><a class="rgCurrentPage">1</a><div class="rgInfoPart">1 items in 1 pages</div><input name="${grid}$ctl00$ctl03$ctl01$PageSizeComboBox" value="100"></td></tr></table></form>`;
}

test("official election options bind cycle dates and identifiers without guessing or treating primaries as general elections", () => {
	const catalog = discoverWashingtonElectionCycles(discovery(), now);
	assert.deepEqual(discoverWashingtonElectionCycles(discovery("<option value=\"2\">1900 General (11/06/1900) (General)</option>"), now).elections, [{ electionId: "899", electionDate: "2026-11-03" }]);
	assert.deepEqual(catalog.elections, [{ electionId: "899", electionDate: "2026-11-03" }, { electionId: "906", electionDate: "2027-11-02" }]);
	const [future] = stateBallotCycleSources(catalog);
	assert.equal(future!.id, "wa-general-2027-11-02");
	assert.equal(future!.label, "Washington general-election candidate list (2027)");
	assert.equal(future!.url, "https://voter.votewa.gov/CandidateList.aspx?e=906");
	assert.equal(future!.scopeNotice, original.scopeNotice);
	assert.equal(future!.retrievalPolicy, undefined);
	assert.deepEqual(resolveStateBallotConfiguration({}).sources, configuredStateBallotSources);
});

test("running record routes discover a new cycle without restarting and retain accepted sources on a corrupt update", async () => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-cycle-api-"));
	const environment = { ...process.env };
	const catalogPath = join(directory, "cycles.json");
	const dataDirectory = join(directory, "data");
	let close: (() => Promise<void>) | undefined;
	try {
		process.env.STATE_BALLOT_CYCLE_CATALOG = catalogPath;
		process.env.STATE_BALLOT_DATA_DIR = dataDirectory;
		process.env.STATE_BALLOT_ENABLED_STATES = "WA";
		delete process.env.STATE_BALLOT_ENABLED_SOURCES;
		const repository = createStateBallotRepository({ now: () => now, fetchText: async () => {
			throw new Error("Live publisher requests are disabled");
		} });
		const app = express();
		registerStateRecordRoutes(app, repository);
		const server = app.listen(0, "127.0.0.1");
		await once(server, "listening");
		close = () => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
		const address = server.address();
		assert.ok(address && typeof address === "object");
		const origin = `http://127.0.0.1:${address.port}`;
		const sourceId = "wa-general-2028-11-07";
		assert.equal((await fetch(`${origin}/api/state-records/WA?source=${sourceId}`)).status, 400);
		await syncStateBallotCycles({ catalogPath, dataDirectory, now: () => now, fetchDiscovery: async () => discovery(option("990", "2028-11-07")), fetchCandidates: async source => JSON.stringify({ pages: [candidatePage(new URL(source.url).searchParams.get("e")!, source.electionDate)] }) });
		const response = await fetch(`${origin}/api/state-records/WA?source=${sourceId}`);
		assert.equal(response.status, 200);
		const payload = await response.json();
		assert.equal(payload.available, true);
		assert.equal(payload.source.electionDate, "2028-11-07");
		assert.equal(payload.records[0].name, "Synthetic Candidate");
		const index = await (await fetch(`${origin}/api/state-records`)).json();
		assert.equal(index.states.find((state: { stateCode: string }) => state.stateCode === "WA").sources.length, 2);
		await writeFile(catalogPath, "{}");
		assert.equal((await (await fetch(`${origin}/api/state-records/WA?source=${sourceId}`)).json()).available, true);
	}
	finally {
		await close?.();
		process.env = environment;
		await rm(directory, { recursive: true, force: true });
	}
});

test("discovery refuses changed controls, duplicate identities, false dates and hostile form targets", () => {
	for (const body of [discovery(option("906", "2027-11-03")), discovery(option("899", "2027-11-02")), discovery(option("906", "2026-11-03")), discovery(option("906", "2027-11-02") + option("907", "2027-11-02")), discovery().replace("./CandidateList.aspx?e=899", "https://example.com/CandidateList.aspx"), discovery().replace("ddlElection", "renamed"), discovery().replace("GENERAL 2027", "GENERAL 2028"), discovery().repeat(2)])
		assert.throws(() => discoverWashingtonElectionCycles(body, now));
});

test("catalog contracts preserve parser, source approvals, manual source boundaries and provenance", () => {
	const catalog = discoverWashingtonElectionCycles(discovery(), now);
	for (const value of [{ ...catalog, familyId: "ar-washington-2026" }, { ...catalog, url: "https://example.com/" }, { ...catalog, sourceConfigurationSha256: "0".repeat(64) }, { ...catalog, discovery: { ...catalog.discovery, retrievedAt: "2027-01-01T00:00:00.000Z" } }, { ...catalog, elections: [{ electionId: "../escape", electionDate: "2027-11-02" }] }, { ...catalog, elections: [{ electionId: "906", electionDate: "2027-11-02", url: "http://localhost/" }] }, { ...catalog, elections: [] }])
		assert.throws(() => parseStateBallotCycleCatalog(value, now));
});

test("external catalogs are bounded, atomic, strict and opt-in; legacy source allowlists are not widened", async () => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-cycle-contract-"));
	try {
		const path = join(directory, "cycles.json");
		const catalog = discoverWashingtonElectionCycles(discovery(), now);
		assert.equal(await writeStateBallotCycleCatalog(path, catalog), true);
		assert.equal(await writeStateBallotCycleCatalog(path, catalog), false);
		assert.deepEqual(readStateBallotCycleCatalog(path, now), catalog);
		const enabled = resolveStateBallotConfiguration({ STATE_BALLOT_CYCLE_CATALOG: path, STATE_BALLOT_ENABLED_STATES: "WA" });
		assert.equal(enabled.sources.length, 2);
		assert.equal(resolveStateBallotConfiguration({ STATE_BALLOT_CYCLE_CATALOG: path, STATE_BALLOT_ENABLED_SOURCES: original.id }).sources.length, 1);
		assert.deepEqual(resolveStateBallotConfiguration({ STATE_BALLOT_CYCLE_CATALOG: path, STATE_BALLOT_ENABLED_SOURCES: "ut-lg-2026", STATE_BALLOT_ENABLED_FAMILIES: original.id }).sources.map(source => source.id).sort(), ["ut-lg-2026", original.id, "wa-general-2027-11-02"].sort());
		assert.throws(() => resolveStateBallotConfiguration({ STATE_BALLOT_CYCLE_CATALOG: path, STATE_BALLOT_ENABLED_FAMILIES: "ar-washington-2026" }));
		assert.throws(() => resolveStateBallotConfiguration({ STATE_BALLOT_CYCLE_CATALOG: path, STATE_BALLOT_ENABLED_STATES: "UT", STATE_BALLOT_ENABLED_FAMILIES: original.id }));
		assert.equal(resolveStateBallotConfiguration({ STATE_BALLOT_CYCLE_CATALOG: path, STATE_BALLOT_ENABLED_STATES: "UT" }).sources.length, 1);
		assert.throws(() => readStateBallotCycleCatalog(join(import.meta.dirname, "cycles.json")));
		await symlink(path, join(directory, "linked.json"));
		assert.throws(() => readStateBallotCycleCatalog(join(directory, "linked.json")));
		await writeFile(path, " ".repeat(128 * 1024 + 1));
		assert.throws(() => readStateBallotCycleCatalog(path));
	}
	finally { await rm(directory, { recursive: true, force: true }); }
});

test("a synthetic 2028 cycle runs discovery, strict page fetch, normalization, atomic storage and cold reads without code edits", async () => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-cycle-sync-"));
	try {
		const catalogPath = join(directory, "cycles.json");
		const fetches: string[] = [];
		const options = { catalogPath, dataDirectory: join(directory, "data"), now: () => now, fetchDiscovery: async () => discovery(option("990", "2028-11-07")), fetchCandidates: async (source: typeof original) => {
			fetches.push(source.id);
			return fetchWashingtonCandidatePages(source, async () => candidatePage(new URL(source.url).searchParams.get("e")!, source.electionDate), { allowedHosts: ["voter.votewa.gov"], maxBytes: 12 * 1024 * 1024, maxRedirects: 0, timeoutMs: 12000 });
		} };
		const first = await syncStateBallotCycles(options);
		assert.deepEqual(first.results.map(result => result.status), ["available", "available"]);
		assert.equal(fetches.length, 2);
		const bytes = await readFile(catalogPath);
		const second = await syncStateBallotCycles({ ...options, now: () => now + 1000 });
		assert.equal(second.catalogChanged, false);
		assert.equal(fetches.length, 2);
		assert.deepEqual(await readFile(catalogPath), bytes);
		const sources = resolveStateBallotConfiguration({ STATE_BALLOT_CYCLE_CATALOG: catalogPath, STATE_BALLOT_ENABLED_STATES: "WA" }).sources;
		const cold = createStateBallotRepository({ sources, dataDirectory: options.dataDirectory, now: options.now, fetchText: async () => {
			throw new Error("Cold read must use persisted data");
		} });
		const current = await cold.getSnapshot("WA", original.id);
		const future = await cold.getSnapshot("WA", "wa-general-2028-11-07");
		assert.equal(future!.records[0]!.name, "Synthetic Candidate");
		assert.notEqual(current!.records[0]!.id, future!.records[0]!.id);
		assert.equal(future!.source.electionDate, "2028-11-07");
		assert.throws(() => parseStateCandidateRecords(future!.source, JSON.stringify({ pages: [candidatePage("899", "2026-11-03")] })));
		const stored = await readFile(join(options.dataDirectory, `${future!.source.id}.json`));
		const failed = await syncStateBallotCycles({ ...options, now: () => now + 5 * 3600000, fetchCandidates: async () => {
			throw new Error("403, stop this source");
		} });
		assert.ok(failed.results.every(result => result.status === "unavailable"));
		assert.deepEqual(await readFile(join(options.dataDirectory, `${future!.source.id}.json`)), stored);
		assert.equal((await createStateBallotStorage(options.dataDirectory).read(future!.source))!.records.length, 1);
		const isolated = await syncStateBallotCycles({ ...options, now: () => now + 5 * 3600000, fetchCandidates: async source => source.id === original.id ? JSON.stringify({ pages: [candidatePage("899", source.electionDate, "Updated Synthetic Candidate")] }) : "changed schema" });
		assert.deepEqual(isolated.results.map(result => result.status), ["available", "unavailable"]);
		assert.deepEqual(await readFile(join(options.dataDirectory, `${future!.source.id}.json`)), stored);
		assert.equal((await createStateBallotStorage(options.dataDirectory).read(original))!.records[0]!.name, "Updated Synthetic Candidate");
		await assert.rejects(syncStateBallotCycles({ ...options, fetchDiscovery: async () => discovery() }), /disappeared/u);
		assert.deepEqual(await readFile(catalogPath), bytes);
	}
	finally { await rm(directory, { recursive: true, force: true }); }
});

test("synchronization reports durable-write failures and preserves catalog bytes when discovery is denied", async () => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-cycle-refusal-"));
	try {
		const catalogPath = join(directory, "cycles.json");
		const dataDirectory = join(directory, "not-a-directory");
		await mkdir(dataDirectory);
		const options = { catalogPath, dataDirectory, now: () => now, enabledSourceIds: [original.id], fetchDiscovery: async () => discovery(), fetchCandidates: async () => {
			await rm(dataDirectory, { recursive: true });
			await writeFile(dataDirectory, "synthetic storage failure");
			return JSON.stringify({ pages: [candidatePage("899", original.electionDate)] });
		} };
		const result = await syncStateBallotCycles(options);
		assert.equal(result.results.length, 1);
		assert.equal(result.results[0]!.status, "persistence-failed");
		assert.equal(await readFile(dataDirectory, "utf8"), "synthetic storage failure");
		const accepted = await readFile(catalogPath);
		let calls = 0;
		await assert.rejects(syncStateBallotCycles({ ...options, fetchDiscovery: async () => {
			calls++;
			throw new Error("403: access denied");
		} }), /403/u);
		assert.equal(calls, 1);
		assert.deepEqual(await readFile(catalogPath), accepted);
	}
	finally { await rm(directory, { recursive: true, force: true }); }
});
