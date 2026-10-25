import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fetchStateBallotCycleDiscovery, syncStateBallotCycleFamilies, syncStateBallotCycles } from "../src/state-ballot-cycle-sync.js";
import { discoverStateBallotElectionCycles, parseStateBallotCycleCatalog, readStateBallotCycleCatalog, stateBallotCycleSources, writeStateBallotCycleCatalog } from "../src/state-ballot-cycles.js";
import { buildPublicStateExportForm, fetchStateBallotSourceText } from "../src/state-ballot-fetch.js";
import { parseStateCandidateRecords } from "../src/state-ballot-records.js";
import { configuredStateBallotSources } from "../src/state-ballot-registry.js";
import { createStateBallotRepository } from "../src/state-ballot-repository.js";
import { createStateBallotStorage } from "../src/state-ballot-storage.js";

const now = Date.parse("2026-10-24T12:00:00.000Z");
const original = configuredStateBallotSources.find(source => source.id === "mt-general-2026")!;
const prefix = "ctl00$ContentPlaceHolder1$";
const control = `${prefix}grdCandidates$ctl00$ctl02$ctl00$ExportToCsvButton`;
const option = (identifier: string, date: string, selected = false) => `<option value="${identifier}"${selected ? " selected" : ""}>FEDERAL GENERAL ${date.slice(0, 4)} (${date.slice(5, 7)}/${date.slice(8, 10)}/${date.slice(0, 4)}) (General)</option>`;
const discovery = (extra = option("990000001", "2028-11-07")) => `<form id="frmMain" method="post" action="./CandidateList.aspx?e=450002928"><select name="${prefix}ddlElection"><option value="450002928">FEDERAL PRIMARY 2026 (06/02/2026) (Primary)</option>${option("450002987", "2026-11-03")}${extra}</select></form>`;

function page(identifier = "990000001", date = "2028-11-07") {
	return `<form id="frmMain" method="post" action="./CandidateList.aspx?e=${identifier}"><input type="hidden" name="__VIEWSTATE" value="synthetic-form-state"><input type="hidden" name="${prefix}hidElectionDate" value="FEDERAL GENERAL ${date.slice(0, 4)}"><input type="hidden" name="${prefix}hidElectionType" value="General"><select name="${prefix}ddlElection">${option(identifier, date, true)}</select><select name="${prefix}ddlCounty"><option value="99" selected>STATE</option></select><input type="button" name="${control}" onclick="javascript:__doPostBack('${control}','')"><p>* = Incumbent</p><p>1 items in 1 pages</p></form>`;
}

function exportBody(identifier = "990000001", date = "2028-11-07") {
	const columns = ["Status", "District Type", "District", "Race", "Term Type", "Term Length", "Name", "Mailing Address", "Email/Web Address", "Phone", "Filing Date", "Party Preference", "Ballot Order"];
	const values = ["FILED", "Congressional", "1ST CONGRESSIONAL", "UNITED STATES REPRESENTATIVE", "REGULAR", "2", "Synthetic Future Candidate", "", "", "", `03/01/${date.slice(0, 4)}`, "DEM", ""];
	return JSON.stringify({ page: page(identifier, date), records: [columns, values].map(row => row.map(value => JSON.stringify(value)).join(",")).join("\r\n") });
}

test("Montana discovers official general identities from a year-independent selector and preserves the approved source contract", async () => {
	await fetchStateBallotCycleDiscovery(async (url, options) => {
		assert.equal(url, "https://candidatefiling.mt.gov/candidatefiling/CandidateList.aspx");
		assert.deepEqual(options, { allowedHosts: ["candidatefiling.mt.gov"], maxBytes: 2 * 1024 * 1024, maxRedirects: 1, timeoutMs: 12000 });
		return discovery();
	}, original.id);
	const catalog = discoverStateBallotElectionCycles(discovery(), original.id, now);
	assert.deepEqual(catalog.elections, [{ electionId: "450002987", electionDate: "2026-11-03" }, { electionId: "990000001", electionDate: "2028-11-07" }]);
	const [future] = stateBallotCycleSources(catalog);
	assert.deepEqual(future, { ...original, id: "mt-general-2028-11-07", label: `${original.label} (2028)`, electionDate: "2028-11-07", url: "https://candidatefiling.mt.gov/candidatefiling/CandidateList.aspx?e=990000001", pageUrl: "https://candidatefiling.mt.gov/candidatefiling/CandidateList.aspx?e=990000001" });
	assert.deepEqual(discoverStateBallotElectionCycles(discovery(""), original.id, now).elections, [{ electionId: "450002987", electionDate: "2026-11-03" }]);
});

test("Montana discovery refuses changed forms, false dates, duplicate identities, odd federal years and hostile targets", () => {
	for (const body of [discovery().replace("frmMain", "changed"), discovery().replace("method=\"post\"", "method=\"get\""), discovery().replace("./CandidateList.aspx?e=450002928", "https://other.example/CandidateList.aspx"), discovery().replace("?e=450002928", "?e=450002928&county=1"), discovery().replaceAll("ddlElection", "ddlOther"), discovery(option("990000001", "2027-11-02")), discovery(option("990000001", "2028-11-06")), discovery(option("450002987", "2028-11-07")), discovery(option("990000001", "2026-11-03")), discovery(option("990000001", "2028-11-07") + option("990000002", "2028-11-07")), discovery().replace("FEDERAL GENERAL 2028", "FEDERAL GENERAL 2030"), discovery().replace("990000001", "1&county=1"), discovery().repeat(2)])
		assert.throws(() => discoverStateBallotElectionCycles(body, original.id, now));
	const catalog = discoverStateBallotElectionCycles(discovery(), original.id, now);
	for (const value of [{ ...catalog, familyId: "utah-2026" }, { ...catalog, sourceConfigurationSha256: "a".repeat(64) }, { ...catalog, discovery: { ...catalog.discovery, url: original.url } }, { ...catalog, discovery: { ...catalog.discovery, retrievedAt: "2026-10-25T00:00:00.000Z" } }]) assert.throws(() => parseStateBallotCycleCatalog(value, now));
});

test("Montana future exports derive their identity and date while retaining exact statewide controls and complete counts", async () => {
	const future = stateBallotCycleSources(discoverStateBallotElectionCycles(discovery(), original.id, now))[0]!;
	let requests = 0;
	const body = await fetchStateBallotSourceText(future, async (url, options) => {
		assert.equal(url, future.url);
		assert.equal(options.maxRedirects, 0);
		requests++;
		if (!options.postBody) return page();
		const fields = new URLSearchParams(options.postBody);
		assert.equal(fields.get(`${prefix}ddlElection`), "990000001");
		assert.equal(fields.get(`${prefix}hidElectionDate`), "FEDERAL GENERAL 2028");
		assert.equal(fields.get(`${prefix}ddlCounty`), "99");
		assert.equal(fields.get("__EVENTTARGET"), control);
		return JSON.parse(exportBody()).records;
	});
	assert.equal(requests, 2);
	const [record] = parseStateCandidateRecords(future, body);
	assert.equal(record!.name, "Synthetic Future Candidate");
	assert.equal(record!.party, "Democratic");
	assert.equal(record!.status, "filed");
	assert.notEqual(record!.id, parseStateCandidateRecords(original, exportBody("450002987", "2026-11-03"))[0]!.id);
	for (const changed of [page().replace("value=\"99\"", "value=\"01\""), page().replace("11/07/2028", "11/03/2026"), page().replaceAll("990000001", "450002987"), page().replaceAll("ExportToCsvButton", "ChangedControl"), page().replace("* = Incumbent", "* = Elected")]) assert.throws(() => buildPublicStateExportForm(future, changed));
	for (const source of [{ ...future, id: original.id }, { ...future, url: original.url, pageUrl: original.url }, { ...future, electionDate: "2027-11-02" }, { ...future, pageUrl: "https://other.example" }]) assert.throws(() => buildPublicStateExportForm(source, page()));
	assert.throws(() => parseStateCandidateRecords(future, body.replace("1 items", "2 items")), /complete public record count/u);
});

test("Montana cycle sync persists once, survives cold reads and preserves last-good bytes on refusal or changed election identity", async () => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-montana-cycles-"));
	try {
		const catalogPath = join(directory, "cycles.json");
		const dataDirectory = join(directory, "data");
		let requests = 0;
		const options = { familyId: original.id, catalogPath, dataDirectory, enabledSourceIds: ["mt-general-2028-11-07"], now: () => now, fetchDiscovery: async () => discovery(), fetchCandidates: async () => {
			requests++;
			return exportBody();
		} };
		const first = await syncStateBallotCycles(options);
		assert.equal(first.results[0]!.status, "available");
		const catalogBytes = await readFile(catalogPath);
		const future = stateBallotCycleSources(readStateBallotCycleCatalog(catalogPath, now)!)[0]!;
		const storage = createStateBallotStorage(dataDirectory);
		const accepted = await storage.read(future);
		assert.equal(accepted!.records.length, 1);
		const second = await syncStateBallotCycles({ ...options, now: () => now + 60000 });
		assert.equal(second.catalogChanged, false);
		assert.equal(requests, 1);
		assert.deepEqual(second.discovery, first.discovery);
		const cold = createStateBallotRepository({ sources: [original, future], dataDirectory, now: () => Date.parse("2028-10-24T00:00:00Z"), fetchText: async () => exportBody() });
		assert.equal((await cold.getSnapshot("MT"))!.source.id, future.id);
		assert.equal(await cold.getSnapshot("MT", original.id), null);
		for (const fetchDiscovery of [async () => {
			throw new Error("403: access denied");
		}, async () => discovery(""), async () => discovery(option("990000002", "2028-11-07"))]) await assert.rejects(syncStateBallotCycles({ ...options, fetchDiscovery }));
		assert.deepEqual(await readFile(catalogPath), catalogBytes);
		assert.deepEqual((await storage.read(future))!.records, accepted!.records);
		const denied = await syncStateBallotCycles({ ...options, now: () => now + 5 * 3600000, fetchCandidates: async () => {
			throw new Error("403");
		} });
		assert.equal(denied.results[0]!.status, "unavailable");
		assert.deepEqual((await storage.read(future))!.records, accepted!.records);
	}
	finally { await rm(directory, { recursive: true, force: true }); }
});

test("one source-family discovery failure does not prevent an independently configured family from completing", async () => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-family-isolation-"));
	try {
		const results = await syncStateBallotCycleFamilies([
			{ familyId: original.id, catalogPath: join(directory, "montana.json"), dataDirectory: join(directory, "data"), now: () => now, fetchDiscovery: async () => { throw new Error("403: access denied"); } },
			{ familyId: "wa-general-2026", catalogPath: join(directory, "washington.json"), dataDirectory: join(directory, "data"), now: () => now, enabledSourceIds: [], fetchDiscovery: async () => `<form method="post" action="./CandidateList.aspx?e=899"><select name="${prefix}ddlElection"><option value="899">GENERAL 2026 (11/03/2026) (General)</option></select></form>` },
		]);
		assert.equal(results[0]!.status, "failed");
		assert.equal(results[1]!.status, "completed");
		const montana = discoverStateBallotElectionCycles(discovery(), original.id, now);
		await assert.rejects(writeStateBallotCycleCatalog(join(directory, "washington.json"), montana, now), /different source family/u);
	}
	finally { await rm(directory, { recursive: true, force: true }); }
});
