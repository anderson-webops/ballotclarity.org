import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { syncStateBallotCycles } from "../src/state-ballot-cycle-sync.js";
import { discoverStateBallotElectionCycles, parseStateBallotCycleCatalog, readMississippiGeneralElectionDate, readStateBallotCycleCatalog, stateBallotCycleSources } from "../src/state-ballot-cycles.js";
import { buildPublicStateExportForm, fetchStateBallotSourceText } from "../src/state-ballot-fetch.js";
import { parseStateCandidateRecords } from "../src/state-ballot-records.js";
import { configuredStateBallotSources } from "../src/state-ballot-registry.js";
import { createStateBallotRepository, resolveStateBallotConfiguration } from "../src/state-ballot-repository.js";
import { createStateBallotStorage } from "../src/state-ballot-storage.js";

const now = Date.parse("2026-10-24T12:00:00.000Z");
const original = configuredStateBallotSources.find(source => source.id === "ms-sos-2026")!;
const page = (date = "November 2, 2027") => `<form id="form1" method="post" action="./default.aspx"><h1>Candidate Qualifying List</h1><input type="hidden" name="__VIEWSTATE" value="synthetic-form-state"><input type="hidden" name="privateEmail" value="private@example.invalid"><div>General Election: ${date}</div><p>Primary Election: August 3, 2027</p><div>General Election: ${date}</div><input type="submit" name="btnDownloadExcel" value="Download CSV"><table><tr><th>Name</th><th>Party</th></tr>${["Synthetic Governor", "Synthetic House", "Synthetic Special", "Synthetic Judge", "Synthetic Undated", "Synthetic Prior Cycle"].map(name => `<tr><td>${name}</td><td></td></tr>`).join("")}</table></form>`;
function csv(date = "November 2, 2027") {
	return [
		["Office", "Candidate Name", "Party", "District", "Place", "General Election", "Election"],
		["Candidates for Governor", "Synthetic Governor", "Democratic", "", "", date, ""],
		["Candidates for State House of Representatives District 7", "Synthetic House", "Republican", "7", "", date, ""],
		["Candidates for State House of Representatives District 70 - Special Election", "Synthetic Special", "Independent", "70", "", "", date],
		["Candidates for Mississippi Court of Appeals", "Synthetic Judge", "", "1", "2", "", date],
		["Candidates for State Senate 34", "Synthetic Undated", "", "34", "", "", ""],
		["Candidates for United States Senate", "Synthetic Prior Cycle", "Democratic", "", "", "November 3, 2026", ""],
	].map(row => row.map(value => JSON.stringify(value)).join(",")).join("\r\n");
}
const envelope = (date = "November 2, 2027") => JSON.stringify({ page: page(date), records: csv(date) });

test("Mississippi discovers an explicit general date without inventing an election ID or a year-specific URL", () => {
	const catalog = discoverStateBallotElectionCycles(page(), original.id, now);
	assert.deepEqual(catalog.elections, [{ electionId: null, electionDate: "2027-11-02" }]);
	const [future] = stateBallotCycleSources(catalog);
	assert.deepEqual(future, { ...original, id: "ms-general-2027-11-02", label: `${original.label} (2027)`, electionDate: "2027-11-02" });
	assert.equal(readMississippiGeneralElectionDate(page("November 3, 2026")), "2026-11-03");
	assert.deepEqual(stateBallotCycleSources(discoverStateBallotElectionCycles(page("November 3, 2026"), original.id, now)), []);
	assert.throws(() => parseStateBallotCycleCatalog({ ...catalog, elections: [{ electionId: "20271102", electionDate: "2027-11-02" }] }, now));
	assert.throws(() => parseStateBallotCycleCatalog({ ...catalog, familyId: "wa-general-2026" }, now));
});

test("date-only discovery refuses missing, conflicting, invalid, guessed or redirected report identities", () => {
	for (const body of [page().replaceAll("General Election:", "Election:"), page("November 3, 2027"), page().replace("November 2, 2027", "November 3, 2026"), page().replace("form1", "changed"), page().replace("method=\"post\"", "method=\"get\""), page().replace("./default.aspx", "https://other.example/default.aspx"), page().replace("./default.aspx", "./default.aspx?year=2027"), page().replaceAll("Download CSV", "Download XLS"), page().replace("</form>", "<select name=\"county\"></select></form>"), page().replace("Candidate Qualifying List", "Candidate Archive"), page().repeat(2)]) assert.throws(() => discoverStateBallotElectionCycles(body, original.id, now));
	assert.throws(() => readMississippiGeneralElectionDate(" ".repeat(2 * 1024 * 1024 + 1)));
});

test("future public CSV exports bind the report date, retain only form tokens and preserve exact source boundaries", async () => {
	const future = stateBallotCycleSources(discoverStateBallotElectionCycles(page(), original.id, now))[0]!;
	let requests = 0;
	const body = await fetchStateBallotSourceText(future, async (url, options) => {
		assert.equal(url, original.url);
		assert.equal(options.maxRedirects, 0);
		requests++;
		if (!options.postBody) return page();
		const fields = new URLSearchParams(options.postBody);
		assert.equal(fields.get("__VIEWSTATE"), "synthetic-form-state");
		assert.equal(fields.get("btnDownloadExcel"), "Download CSV");
		assert.equal(fields.has("privateEmail"), false);
		return csv();
	});
	assert.equal(requests, 2);
	const records = parseStateCandidateRecords(future, body);
	assert.deepEqual(records.map(record => record.name), ["Synthetic Governor", "Synthetic House", "Synthetic Special", "Synthetic Judge"]);
	assert.equal(records[1]!.scope, "state-house");
	assert.ok(!records[1]!.office.includes("Special"));
	assert.equal(records[1]!.jurisdiction, undefined);
	assert.ok(records[2]!.office.includes("Special Election"));
	assert.equal(records[2]!.jurisdiction, undefined);
	assert.equal(records[3]!.jurisdiction, "Judicial District 1");
	assert.ok(!JSON.stringify(records).includes("private@example"));
	for (const source of [original, { ...future, id: original.id }, { ...future, url: `${original.url}?year=2027` }, { ...future, stateCode: "WA" }, { ...future, pageUrl: "https://other.example" }]) assert.throws(() => buildPublicStateExportForm(source, page()), /configured/u);
	assert.throws(() => parseStateCandidateRecords(future, JSON.stringify({ page: page(), records: csv().replace("\"November 2, 2027\",\"\"", "\"November 2, 2027\",\"November 3, 2026\"") })), /conflicting election dates/u);
});

test("date-only cycle rollover imports idempotently and preserves last-good bytes on refusal or changed dates", async () => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-mississippi-cycles-"));
	try {
		const catalogPath = join(directory, "cycles.json");
		const dataDirectory = join(directory, "data");
		const clock = Date.parse("2026-11-06T00:00:00Z");
		let requests = 0;
		const options = { familyId: original.id, catalogPath, dataDirectory, now: () => clock, fetchDiscovery: async () => page(), fetchCandidates: async () => {
			requests++;
			return envelope();
		} };
		assert.equal((await syncStateBallotCycles(options)).results[0]!.records, 4);
		assert.equal((await syncStateBallotCycles({ ...options, now: () => clock + 60000 })).catalogChanged, false);
		assert.equal(requests, 1);
		const bytes = await readFile(catalogPath);
		const future = stateBallotCycleSources(readStateBallotCycleCatalog(catalogPath, clock)!, clock)[0]!;
		const repository = createStateBallotRepository({ sources: [original, future], dataDirectory, now: () => clock + 60000, fetchText: async () => {
			throw new Error("Publisher requests disabled for cold reads");
		} });
		assert.equal((await repository.getSnapshot("MS"))!.source.id, future.id);
		assert.equal(await repository.getSnapshot("MS", original.id), null);
		const storage = createStateBallotStorage(dataDirectory);
		const retained = await storage.read(future);
		await assert.rejects(syncStateBallotCycles({ ...options, fetchDiscovery: async () => {
			throw new Error("403: source access denied");
		} }));
		await assert.rejects(syncStateBallotCycles({ ...options, fetchDiscovery: async () => page("November 7, 2028") }), /unexpired/u);
		assert.deepEqual(await readFile(catalogPath), bytes);
		const invalid = await syncStateBallotCycles({ ...options, now: () => clock + 5 * 3600000, fetchCandidates: async () => envelope("November 3, 2026") });
		assert.equal(invalid.results[0]!.status, "unavailable");
		assert.deepEqual((await storage.read(future))!.records, retained!.records);
		await writeFile(catalogPath, "{}");
		await assert.rejects(syncStateBallotCycles(options));
	}
	finally { await rm(directory, { recursive: true, force: true }); }
});

test("Mississippi refuses truncated, replaced-name and changed-layout exports before promoting any dated rows", () => {
	const future = stateBallotCycleSources(discoverStateBallotElectionCycles(page(), original.id, now))[0]!;
	for (const body of [JSON.stringify({ page: page(), records: csv().split("\r\n").slice(0, -1).join("\r\n") }), JSON.stringify({ page: page(), records: csv().replace("Synthetic House", "Unexpected Candidate") }), JSON.stringify({ page: page().replace("<th>Party</th>", "<th>New Field</th>"), records: csv() }), JSON.stringify({ page: page().replace("<td>Synthetic House</td>", "<td></td>"), records: csv() })]) assert.throws(() => parseStateCandidateRecords(future, body), /Mississippi/u);
	const emptyRow = "\r\n\"Candidates for Empty Office\",\"\",\"\",\"\",\"\",\"\",\"\"";
	const emptyPage = page().replace("</form>", "<div class=\"card officeCard\"><div class=\"officeTitle\">Candidates for Empty Office</div><div>No candidates entered for this office yet.</div></div></form>");
	assert.equal(parseStateCandidateRecords(future, JSON.stringify({ page: emptyPage, records: csv() + emptyRow })).length, 4);
	assert.throws(() => parseStateCandidateRecords(future, JSON.stringify({ page: page(), records: csv() + emptyRow })), /empty-office/u);
	assert.throws(() => parseStateCandidateRecords(future, JSON.stringify({ page: emptyPage, records: csv() + emptyRow + emptyRow })), /empty-office/u);
});

test("Mississippi family opt-in preserves exact allowlists and coexists with the established selector families", async () => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-mississippi-config-"));
	try {
		const catalogPath = join(directory, "cycles.json");
		await syncStateBallotCycles({ familyId: original.id, catalogPath, dataDirectory: join(directory, "data"), now: () => now, enabledSourceIds: [], fetchDiscovery: async () => page() });
		const environment = { STATE_BALLOT_CYCLE_CATALOGS: JSON.stringify({ "ms-sos-2026": catalogPath }), STATE_BALLOT_ENABLED_STATES: "MS", STATE_BALLOT_ENABLED_SOURCES: "ms-sos-2026" };
		assert.equal(resolveStateBallotConfiguration(environment).sources.length, 1);
		assert.equal(resolveStateBallotConfiguration({ ...environment, STATE_BALLOT_ENABLED_FAMILIES: original.id }).sources[1]!.id, "ms-general-2027-11-02");
		assert.throws(() => resolveStateBallotConfiguration({ ...environment, STATE_BALLOT_ENABLED_STATES: "WA", STATE_BALLOT_ENABLED_FAMILIES: original.id }));
	}
	finally { await rm(directory, { recursive: true, force: true }); }
});
