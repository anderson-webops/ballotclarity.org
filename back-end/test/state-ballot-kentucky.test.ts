import type { StateBallotSource } from "../src/state-ballot-sources.js";
import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import express from "express";
import { refreshApprovedCandidateData } from "../src/state-ballot-automation.js";
import { fetchStateBallotCycleDiscovery, syncStateBallotCycles } from "../src/state-ballot-cycle-sync.js";
import { discoverStateBallotElectionCycles, parseStateBallotCycleCatalog, stateBallotCycleSources, writeStateBallotCycleCatalog } from "../src/state-ballot-cycles.js";
import { fetchStateBallotSourceText } from "../src/state-ballot-fetch.js";
import { buildKentuckyElectionForm, kentuckyCalendarUrl, kentuckyCandidatePostBody, kentuckyDiscoveryUrl, readKentuckyElectionDiscovery, readKentuckyGeneralDates } from "../src/state-ballot-kentucky.js";
import { parseStateCandidateRecords } from "../src/state-ballot-records.js";
import { configuredStateBallotSources } from "../src/state-ballot-registry.js";
import { buildStateBallotPreview, createStateBallotRepository, resolveStateBallotConfiguration } from "../src/state-ballot-repository.js";
import { createStateBallotStorage } from "../src/state-ballot-storage.js";
import { registerStateRecordRoutes } from "../src/state-records.js";
import { kentuckyFixtureCalendar, kentuckyFixtureCapture, kentuckyFixtureDate, kentuckyFixtureDiscovery, kentuckyFixtureGroups, kentuckyFixtureId, kentuckyFixturePortal, kentuckySelection } from "./helpers/kentucky-state-fixtures.js";

const now = Date.parse("2026-10-25T12:00:00Z");
const root = kentuckyDiscoveryUrl;
const original = (kind: "core" | "courts") => configuredStateBallotSources.find(source => source.id === (kind === "core" ? "ky-sos-2026" : "ky-courts-2026"))!;
const discovery = (years = ["2026", "2027"], emptyFuture = false) => kentuckyFixtureDiscovery(root, years, emptyFuture);
const capture = (kind: "core" | "courts", year = "2026", empty = false) => kentuckyFixtureCapture(root, kind, year, empty);
const future = (kind: "core" | "courts", year = "2027") => stateBallotCycleSources(discoverStateBallotElectionCycles(discovery(["2026", year]), original(kind).id, now), now)[0]!;

test("Kentucky discovers overlapping explicitly dated general elections, including odd years, without guessing primary IDs", () => {
	for (const kind of ["core", "courts"] as const) {
		const catalog = discoverStateBallotElectionCycles(discovery(["2026", "2027", "2028"]), original(kind).id, now);
		assert.deepEqual(catalog.elections, ["2026", "2027", "2028"].map(year => ({ electionId: kentuckyFixtureId(year), electionDate: kentuckyFixtureDate(year) })));
		assert.equal(future(kind).id, `ky-general-${kind}-2027-11-02`);
		assert.equal(future(kind).postBody, kentuckyCandidatePostBody("90"));
		assert.equal(future(kind).url, root);
		assert.equal(future(kind).documentUrls, undefined);
		assert.throws(() => parseStateBallotCycleCatalog({ ...catalog, elections: [{ electionId: "89", electionDate: "2027-03-02" }] }, now));
	}
	assert.equal(original("core").documentUrls!.length, 5);
	assert.equal(original("courts").snapshotStorage, "external");
	const primaryOnly = discovery().replaceAll("value=\"90\"", "value=\"999\"").replaceAll("2027 General Election", "2027 Primary Election");
	assert.throws(() => readKentuckyElectionDiscovery(primaryOnly));
	assert.deepEqual(readKentuckyGeneralDates(kentuckyFixtureCalendar(["2026", "2027", "2028"])), ["2026-11-03", "2027-11-02", "2028-11-07"]);
});

test("Kentucky requires matching published dates, selectors, complete selection captures and same-year context", () => {
	const value = JSON.parse(discovery());
	for (const changed of [
		{ ...value, calendar: value.calendar.replace("November 2, 2027", "November 3, 2027") },
		{ ...value, calendar: value.calendar.replace("2027 General Election Dates", "Other dates") },
		{ ...value, selections: value.selections.slice(0, 1) },
		{ ...value, selections: value.selections.toReversed() },
		{ ...value, selections: [...value.selections, value.selections[0]] },
		{ ...value, selections: [{ ...value.selections[0], extra: true }, value.selections[1]] },
		{ ...value, index: value.index.replace("2026 General Election", "2026 Primary Election") },
		{ ...value, extra: "unapproved" },
	]) assert.throws(() => readKentuckyElectionDiscovery(JSON.stringify(changed)));
	assert.throws(() => readKentuckyGeneralDates(kentuckyFixtureCalendar().replace("November 2, 2027", "November 9, 2027")));
	assert.throws(() => readKentuckyGeneralDates(kentuckyFixtureCalendar() + kentuckyFixtureCalendar(["2027"]).replace("November 2", "November 3")));
});

test("Kentucky current core retains the legacy record contract while strict captures exclude contacts and measure choices", () => {
	const body = capture("core");
	const raw = JSON.parse(body);
	const records = parseStateCandidateRecords(original("core"), body);
	assert.deepEqual(records, parseStateCandidateRecords(original("core"), JSON.stringify({ documents: raw.documents })));
	assert.equal(records.length, 5);
	assert.doesNotMatch(JSON.stringify(records), /PRIVATE-|Address|Email|Date Filed|Constitutional Amendment/u);
	assert.ok(records.every(record => record.status === "listed" || record.status === "inactive"));
	assert.throws(() => parseStateCandidateRecords(future("core"), JSON.stringify({ documents: raw.documents })));
});

test("Kentucky court and prosecutor IDs retain complete divisions and the Family Court office, never voter eligibility", () => {
	const source = original("courts");
	const records = parseStateCandidateRecords(source, capture("courts"));
	assert.equal(records.length, 7);
	assert.equal(new Set(records.map(record => record.id)).size, 7);
	assert.equal(records.filter(record => record.office === "Circuit Judge").length, 2);
	assert.ok(records.some(record => record.office === "Circuit Judge Family Court" && record.status === "write-in"));
	assert.ok(records.every(record => record.scope === "local" && record.sourceDistrictLabel && !record.jurisdiction));
	assert.equal(records.filter(record => record.name === "Alex Inactive").length, 1);
	assert.equal(records.find(record => record.name === "Alex Inactive")!.status, "inactive");
	assert.equal(parseStateCandidateRecords(source, capture("courts").replaceAll("District Judge", "DISTRICT JUDGE")).length, 7);
	assert.equal(buildStateBallotPreview({ source, records, sha256: "a".repeat(64), retrievedAt: new Date(now).toISOString() }, { districtMatches: [{ id: "congressional:2", label: "District 2", districtCode: "2", districtType: "congressional", sourceSystem: "Synthetic" }] }), null);
});

test("Kentucky supports newly published governor ticket controls without a hardcoded office-ID list", () => {
	const groups = kentuckyFixtureGroups(true);
	groups.push({ id: "50", label: "Governor and Lieutenant Governor", rows: [{ name: "Example Governor / Example Running Mate", office: "Governor", party: "Example Party", seat: "" }], inactive: [] });
	const body = kentuckyFixtureCapture(root, "core", "2027", false, ["2026", "2027"], groups).replaceAll("Constitutional Amendment 1", "CONSTITUTIONAL AMENDMENT 1");
	const records = parseStateCandidateRecords(future("core"), body);
	assert.equal(records.length, 1);
	assert.equal(records[0]!.office, "Governor");
	assert.equal(records[0]!.scope, "statewide");
	assert.equal(records[0]!.name, "Example Governor / Example Running Mate");
});

test("Kentucky reconciles inactive lifecycle evidence and refuses ambiguous Circuit versus Family Court mappings", () => {
	const groups = kentuckyFixtureGroups();
	groups.find(group => group.id === "20")!.rows[0]!.party = "Republican Party";
	const body = JSON.parse(kentuckyFixtureCapture(root, "courts", "2026", false, ["2026", "2027"], groups));
	body.documents.at(-1).body = body.documents.at(-1).body.replaceAll("Alex Inactive", "Sam Example").replaceAll("District Judge", "Circuit Judge").replaceAll("4 Division 1", "2 Division 1");
	assert.throws(() => parseStateCandidateRecords(original("courts"), JSON.stringify(body)), /uniquely reconciled/u);
});

test("Kentucky validates active and section counts without pretending its unscoped inactive directory counter is complete", () => {
	const body = capture("courts");
	assert.equal(parseStateCandidateRecords(original("courts"), body.replace("Withdrawn/Deceased/Disqualified (16)", "Withdrawn/Deceased/Disqualified (19)")).length, 7);
	const value = JSON.parse(body);
	const changedDiscovery = JSON.parse(value.discovery);
	changedDiscovery.selections[0].body = changedDiscovery.selections[0].body.replace("Attorney (1)", "Attorney (2)");
	const changedPage = (change: (body: string) => string) => JSON.stringify({ ...value, documents: value.documents.map((item: { url: string; body: string }, index: number) => index ? item : { ...item, body: change(item.body) }) });
	for (const changed of [
		changedPage(page => page.replace("(1)</summary>", "(2)</summary>")),
		changedPage(page => page.replace("District/Division</th>", "Seat</th>")),
		changedPage(page => page.replace("ctl00_MainContent_pOfficeResults", "changed-result")),
		changedPage(page => page.replace("<td>Synthetic Candidate</td>", "<td></td>")),
		changedPage(page => page.replace("<td>Commonwealth&#39;s Attorney</td>", "<td>Other office</td>").replace("<td>Commonwealth's Attorney</td>", "<td>Other office</td>")),
		JSON.stringify({ ...value, discovery: JSON.stringify(changedDiscovery) }),
	]) assert.throws(() => parseStateCandidateRecords(original("courts"), changed));
});

test("Kentucky rejects missing, reordered, substituted and wrong-election candidate documents", () => {
	const value = JSON.parse(capture("courts"));
	for (const documents of [value.documents.slice(1), value.documents.toReversed(), [...value.documents, value.documents[0]], value.documents.map((item: { url: string; body: string }, index: number) => index ? item : { ...item, url: "https://example.org/candidates" }), value.documents.map((item: { url: string; body: string }, index: number) => index ? item : { ...item, body: item.body.replace("value=\"87\" selected", "value=\"87\"").replace("value=\"90\" ", "value=\"90\" selected ").replace("Election: 2026", "Election: 2027") })]) assert.throws(() => parseStateCandidateRecords(original("courts"), JSON.stringify({ ...value, documents })));
	assert.throws(() => parseStateCandidateRecords(original("courts"), JSON.stringify({ ...value, documents: value.documents.map((item: object) => ({ ...item, extra: true })) })));
});

test("Kentucky public postbacks echo only known form state and blank filters, and reject external or filtered controls", () => {
	const page = kentuckyFixturePortal(root, root);
	const fields = new URLSearchParams(buildKentuckyElectionForm(page, root, "90"));
	assert.equal(fields.get(kentuckySelection), "90");
	assert.equal(fields.get("__EVENTTARGET"), kentuckySelection);
	assert.equal(fields.get("__VIEWSTATE"), "SYNTHETIC-STATE");
	assert.equal(fields.get("ctl00$MainContent$ddlParty"), "");
	assert.equal(fields.get("ctl00$MainContent$tDatefiled"), "");
	assert.throws(() => buildKentuckyElectionForm(page, root, "89"));
	for (const changed of [page.replace(`action="${root}`, "action=\"https://example.org/"), page.replace("id=\"aspnetForm\"", "id=\"other\""), page.replace("name=\"ctl00$MainContent$tFName\" value=\"\"", "name=\"ctl00$MainContent$tFName\" value=\"Filtered\""), page.replace("name=\"ctl00$MainContent$hfLastResultsUrl\" value=\"\"", "name=\"ctl00$MainContent$hfLastResultsUrl\" value=\"https://example.org/\""), page.replace("value=\"R\"", "value=\"R\" selected"), page.replace("name=\"__VIEWSTATE\"", "name=\"authentication\""), page.replace("name=\"ctl00$MainContent$tDatefiled\"", "name=\"unrecognized-filter\"")]) assert.throws(() => buildKentuckyElectionForm(changed, root, "90"));
});

test("Kentucky fetches only published same-host office controls and normal election-selector postbacks with zero redirects", async () => {
	const requests: { url: string; post: boolean }[] = [];
	const request = async (target: string | URL, options: { postBody?: string; maxRedirects?: number } = {}) => {
		const url = String(target);
		assert.equal(options.maxRedirects, 0);
		assert.ok(url === kentuckyCalendarUrl || url.startsWith(root));
		requests.push({ url, post: Boolean(options.postBody) });
		if (url === kentuckyCalendarUrl) return kentuckyFixtureCalendar();
		const year = options.postBody && new URLSearchParams(options.postBody).get(kentuckySelection) === "90" ? "2027" : "2026";
		return kentuckyFixturePortal(url, root, year);
	};
	const discovered = await fetchStateBallotCycleDiscovery(request, original("courts").id);
	assert.equal(readKentuckyElectionDiscovery(discovered).length, 2);
	assert.equal(requests.filter(item => item.post).length, 1);
	requests.length = 0;
	const body = await fetchStateBallotSourceText(future("courts"), request);
	assert.equal(parseStateCandidateRecords(future("courts"), body).length, 7);
	assert.equal(requests.filter(item => /Default\.aspx/u.test(item.url) && !item.post).length, 7);
	assert.equal(requests.filter(item => /Default\.aspx/u.test(item.url) && item.post).length, 7);
	assert.equal(requests.filter(item => item.url === root && !item.post).length, 1);
	assert.equal(requests.some(item => /countyfilings|id=23/u.test(item.url)), false);
	for (const source of [{ ...future("courts"), id: "ky-other" }, { ...future("courts"), url: "https://example.org/" }, { ...future("courts"), postBody: `${kentuckyCandidatePostBody("89")}&extra=true` }, { ...future("courts"), documentUrls: [`${root}Default.aspx?id=17`] }]) {
		requests.length = 0;
		await assert.rejects(fetchStateBallotSourceText(source, request));
		assert.equal(requests.length, 0);
	}
});

test("Kentucky empty future general elections wait durably, acquire later records automatically and preserve import clocks on cache hits", async () => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-ky-pending-"));
	try {
		const sources = [original("core"), original("courts")];
		const environment = { STATE_BALLOT_DATA_DIR: directory, STATE_BALLOT_ENABLED_STATES: "KY", STATE_BALLOT_ENABLED_SOURCES: sources.map(source => source.id).join(","), STATE_BALLOT_ENABLED_FAMILIES: sources.map(source => source.id).join(","), STATE_BALLOT_CYCLE_CATALOGS: JSON.stringify(Object.fromEntries(sources.map(source => [source.id, join(directory, `${source.id}-cycles.json`)]))) };
		let calls = 0;
		let clock = now;
		let empty = true;
		const options = { environment, now: () => clock, fetchDiscovery: async () => discovery(["2026", "2027"], empty), fetchText: async (source: StateBallotSource) => {
			calls++;
			return capture(source.format === "kentucky-html" ? "core" : "courts", source.electionDate.slice(0, 4), empty && source.electionDate !== "2026-11-03");
		} };
		const first = await refreshApprovedCandidateData(options);
		assert.equal(first.status, "succeeded");
		assert.equal(first.results.filter(result => result.status === "imported").length, 2);
		assert.equal(calls, 4);
		const waitingFile = join(directory, `${future("courts").id}.json.pending`);
		const waiting = await readFile(waitingFile, "utf8");
		clock++;
		const second = await refreshApprovedCandidateData(options);
		assert.ok(second.results.every(result => result.status === "cached"));
		assert.equal(second.lastImportAt, first.lastImportAt);
		assert.equal(second.lastSuccessAt, first.lastSuccessAt);
		assert.equal(calls, 4);
		assert.equal(await readFile(waitingFile, "utf8"), waiting);
		empty = false;
		clock += 4 * 3600000;
		const third = await refreshApprovedCandidateData(options);
		assert.equal(third.status, "succeeded");
		assert.equal(third.results.filter(result => result.status === "imported").length, 4);
		const loaded = createStateBallotRepository({ sources: [future("courts")], dataDirectory: directory, now: () => clock, fetchText: async () => {
			throw new Error("Providers disabled");
		} });
		assert.equal((await loaded.inspectSources!())[0]!.status, "current");
		assert.equal((await loaded.getSnapshot("KY", future("courts").id))!.records.length, 7);
		const accepted = await readFile(join(directory, `${future("courts").id}.json`));
		clock += 4 * 3600000 + 1;
		const failed = await refreshApprovedCandidateData({ ...options, fetchText: async () => {
			throw new Error("Publisher denied");
		} });
		assert.equal(failed.status, "failed");
		assert.deepEqual(await readFile(join(directory, `${future("courts").id}.json`)), accepted);
		const catalogPath = join(directory, `${original("core").id}-cycles.json`);
		const before = await readFile(catalogPath);
		await assert.rejects(syncStateBallotCycles({ familyId: original("core").id, catalogPath, dataDirectory: directory, now: () => clock, fetchDiscovery: async () => discovery(["2026"]) }));
		assert.deepEqual(await readFile(catalogPath), before);
	}
	finally { await rm(directory, { recursive: true, force: true }); }
});

test("Kentucky future catalogs cold-load the correct election and API source without exposing contacts or inferring a personal court ballot", async () => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-ky-api-"));
	try {
		const sources = [future("core"), future("courts")];
		const storage = createStateBallotStorage(directory);
		const clock = Date.parse("2027-10-01T00:00:00Z");
		for (const source of sources) await storage.write({ source, retrievedAt: new Date(clock - 1000).toISOString(), sha256: "a".repeat(64), records: parseStateCandidateRecords(source, capture(source.format === "kentucky-html" ? "core" : "courts", "2027")) });
		const repository = createStateBallotRepository({ sources: [original("core"), original("courts"), ...sources], dataDirectory: directory, now: () => clock, ttlMs: 86400000, fetchText: async () => {
			throw new Error("Providers disabled");
		} });
		assert.equal((await repository.getSnapshot("KY"))!.source.id, sources[0]!.id);
		const configuration = resolveStateBallotConfiguration({ STATE_BALLOT_ENABLED_STATES: "KY" });
		assert.deepEqual(configuration.sources.map(source => source.id), ["ky-sos-2026", "ky-warren-candidates-2026", "ky-courts-2026"]);
		const app = express();
		registerStateRecordRoutes(app, repository, undefined, () => clock);
		const server = app.listen(0, "127.0.0.1");
		await once(server, "listening");
		try {
			const address = server.address();
			assert.ok(address && typeof address === "object");
			const origin = `http://127.0.0.1:${address.port}`;
			const response = await fetch(`${origin}/api/state-records/KY?source=${sources[1]!.id}`);
			const body = await response.json();
			assert.equal(response.status, 200);
			assert.equal(body.source.id, sources[1]!.id);
			assert.equal(body.total, 7);
			assert.equal(body.inactive, 1);
			assert.equal(body.records.length, 6);
			assert.ok(body.records.every((record: { status: string }) => record.status !== "inactive"));
			assert.ok(body.records.every((record: { scope: string }) => record.scope === "local"));
			assert.doesNotMatch(JSON.stringify(body.records), /PRIVATE-|Email|Address/u);
			assert.equal((await fetch(`${origin}/api/state-records/NC?source=${sources[1]!.id}`)).status, 400);
		}
		finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
	}
	finally { await rm(directory, { recursive: true, force: true }); }
});

test("running Kentucky APIs hot-load both future catalogs without restart, retain last-good descriptors and reject corrupt cold starts", async () => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-ky-hotload-"));
	const previous = { ...process.env };
	let close: (() => Promise<void>) | undefined;
	try {
		const paths = Object.fromEntries([original("core"), original("courts")].map(source => [source.id, join(directory, `${source.id}-cycles.json`)]));
		delete process.env.STATE_BALLOT_CYCLE_CATALOG;
		Object.assign(process.env, { STATE_BALLOT_DATA_DIR: directory, STATE_BALLOT_ENABLED_STATES: "KY", STATE_BALLOT_ENABLED_SOURCES: "ky-sos-2026,ky-courts-2026", STATE_BALLOT_ENABLED_FAMILIES: "ky-sos-2026,ky-courts-2026", STATE_BALLOT_CYCLE_CATALOGS: JSON.stringify(paths) });
		const clock = Date.parse("2027-10-01T00:00:00Z");
		const failures: string[] = [];
		const options = { now: () => clock, fetchText: async () => {
			throw new Error("Live providers disabled");
		}, onUnavailable: (state: string) => failures.push(state) };
		const repository = createStateBallotRepository(options);
		assert.equal(repository.sources!.length, 2);
		const storage = createStateBallotStorage(directory);
		for (const kind of ["core", "courts"] as const) {
			const catalog = discoverStateBallotElectionCycles(discovery(), original(kind).id, now);
			await writeStateBallotCycleCatalog(paths[original(kind).id]!, catalog, clock);
			const source = future(kind);
			await storage.write({ source, retrievedAt: new Date(clock - 1000).toISOString(), sha256: "a".repeat(64), records: parseStateCandidateRecords(source, capture(kind, "2027")) });
		}
		assert.equal(repository.sources!.length, 4);
		const app = express();
		registerStateRecordRoutes(app, repository, undefined, () => clock);
		const server = app.listen(0, "127.0.0.1");
		await once(server, "listening");
		close = () => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
		const address = server.address();
		assert.ok(address && typeof address === "object");
		const url = `http://127.0.0.1:${address.port}/api/state-records/KY?source=${future("courts").id}`;
		assert.equal((await (await fetch(url)).json()).source.id, future("courts").id);
		const courtCatalog = await readFile(paths[original("courts").id]!);
		await writeFile(paths[original("courts").id]!, "{}");
		assert.equal((await (await fetch(url)).json()).available, true);
		assert.ok(failures.includes("KY"));
		assert.throws(() => createStateBallotRepository(options));
		await writeFile(paths[original("courts").id]!, courtCatalog);
		const cold = createStateBallotRepository(options);
		assert.equal((await cold.getSnapshot("KY", future("courts").id))!.records.length, 7);
	}
	finally {
		await close?.();
		process.env = previous;
		await rm(directory, { recursive: true, force: true });
	}
});
