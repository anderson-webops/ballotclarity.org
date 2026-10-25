import type { StateBallotSource } from "../src/state-ballot-sources.js";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { once } from "node:events";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import express from "express";
import { readAutomationRun } from "../src/admin-operations.js";
import { refreshApprovedCandidateData } from "../src/state-ballot-automation.js";
import { syncStateBallotCycles } from "../src/state-ballot-cycle-sync.js";
import { discoverStateBallotElectionCycles, stateBallotCycleSources } from "../src/state-ballot-cycles.js";
import { fetchStateBallotSourceText } from "../src/state-ballot-fetch.js";
import { StateBallotAwaitingRecordsError } from "../src/state-ballot-florida-local.js";
import { isActiveStateCandidateRecord, parseStateCandidateRecords, stateRecordMatchesDistricts } from "../src/state-ballot-records.js";
import { configuredStateBallotSources } from "../src/state-ballot-registry.js";
import { buildStateBallotPreview, createStateBallotRepository } from "../src/state-ballot-repository.js";
import { buildFloridaCandidateForm, floridaCountyCodesUrl } from "../src/state-ballot-southern.js";
import { createStateBallotStorage } from "../src/state-ballot-storage.js";
import { buildStateRecordPage, parseStateRecordFilters, registerStateRecordRoutes } from "../src/state-records.js";

const now = Date.parse("2026-10-24T12:00:00.000Z");
const original = configuredStateBallotSources.find(source => source.id === "fl-doe-local-2026")!;
const headers = "AcctNum,VoterID,ElectionID,OfficeCode,OfficeDesc,Juris1num,Juris2num,StatusCode,StatusDesc,PartyCode,PartyDesc,NameLast,NameFirst,NameMiddle,SuppressAddress,Addr1,Addr2,City,State,Zip,County,Phone,TrsNameLast,TrsNameFirst,TrsNameMiddle,Email".split(",");
const page = `<table><form name="CanDownload" action="extractCanList.asp" method="post"><tr><td><select name="elecID">${["20261103", "20281107", "20301105"].map(id => `<option value="${id}-GEN">${id.slice(0, 4)} Election</option>`).join("")}</select><select name="office"><option value="All">ALL</option></select><select name="status"><option value="All">ALL</option></select><select name="cantype"><option value="STA">State Candidates</option><option value="LOC">Local Candidates</option></select><input type="submit" name="FormSubmit" value="Download Candidate List"></td></tr></form><form name="CountyDownload" action="extractCountyCodes.asp" method="post"><tr><td><input type="submit" name="FormSubmitCounty" value="Download County Codes"></td></tr></form></table>`;
const countyCodes = `CountyCode\tCountyName\nALA\tAlachua\nHIL\tHillsborough\n${Array.from({ length: 65 }, (_, index) => `Z${String.fromCharCode(65 + Math.floor(index / 26))}${String.fromCharCode(65 + index % 26)}\tSynthetic County ${index}\n`).join("")}`;
const future = stateBallotCycleSources(discoverStateBallotElectionCycles(page, original.id, now), now)[0]!;
const row = (overrides: Record<string, string> = {}) => ({ AcctNum: "101", ElectionID: "20261103-GEN", OfficeCode: "SCB", OfficeDesc: "School Board", Juris1num: "NWT", Juris2num: "001", StatusCode: "QUA", StatusDesc: "Qualified", PartyCode: "DEM", PartyDesc: "Democratic", NameFirst: "Synthetic", NameMiddle: "", NameLast: "Félix", County: "ALA", VoterID: "PRIVATE-VOTER-ID", Addr1: "PRIVATE-ADDRESS", Phone: "PRIVATE-PHONE", Email: "PRIVATE-EMAIL", ...overrides });
function capture(rows: Record<string, string>[] = [row()], changes = {}) {
	return JSON.stringify({ schemaVersion: 1, type: "florida-local-export", page, countyCodes, records: `${headers.join("\t")}\n${rows.map(row => `${headers.map(header => row[header] ?? "").join("\t")}\n`).join("")}`, ...changes });
}
const futureCapture = (rows = false) => capture(rows ? [row({ ElectionID: "20281107-GEN" })] : []);
const hash = (value: string) => createHash("sha256").update(value).digest("hex");

test("Florida local exports retain source facts, distinct seats, literal parties and accented names without personal data", () => {
	const records = parseStateCandidateRecords(original, capture([row(), row({ AcctNum: "102", Juris2num: "002", County: "HIL", PartyCode: "REP", PartyDesc: "Republican" }), row({ AcctNum: "103", County: "" })]));
	assert.equal(records.length, 3);
	assert.equal(new Set(records.map(record => record.id)).size, 3);
	assert.equal(records[0]!.name, "Synthetic Félix");
	assert.equal(records[0]!.office, "School Board · District NWT · Group/seat 1");
	assert.equal(records[0]!.party, "Democratic");
	assert.equal(records[1]!.party, "Republican");
	assert.equal(records[0]!.sourceAreaLabel, "Alachua County");
	assert.equal(records[2]!.sourceAreaLabel, undefined);
	assert.ok(records.every(record => record.scope === "local" && !record.jurisdiction && !record.candidateUrl && !stateRecordMatchesDistricts(record, [])));
	assert.doesNotMatch(JSON.stringify(records), /PRIVATE-|VoterID|Addr1|Email|Phone/u);
	assert.equal(buildStateBallotPreview({ source: original, records, retrievedAt: new Date(now).toISOString(), sha256: hash(capture()) }, { districtMatches: [] }), null);
	const result = buildStateRecordPage({ source: original, records, retrievedAt: new Date(now).toISOString(), sha256: hash(capture()) }, parseStateRecordFilters({ q: "Hillsborough" }));
	assert.equal(result.matched, 1);
	assert.equal(result.records[0]!.name, "Synthetic Félix");
	assert.doesNotMatch(JSON.stringify(result), /sourceCandidateId|PRIVATE-/u);
});

test("Florida statuses preserve inactive outcomes and withhold unknown codes instead of inventing qualification", () => {
	const statuses = { UNO: "Unopposed", DNQ: "Did Not Qualify", QUA: "Qualified", DEF: "Defeated", WIT: "Withdrew", DEC: "Deceased", NEW: "Active candidate" };
	const records = parseStateCandidateRecords(original, capture(Object.entries(statuses).map(([StatusCode, StatusDesc], index) => row({ AcctNum: String(index + 1), StatusCode, StatusDesc }))));
	assert.deepEqual(records.map(record => record.status), ["unopposed", "disqualified", "qualified", "defeated", "withdrawn", "inactive", "unrecognized"]);
	assert.deepEqual(records.map(isActiveStateCandidateRecord), [false, false, true, false, false, false, false]);
	assert.equal(records.at(-1)!.sourceStatus, "NEW: Active candidate");
	assert.equal(parseStateCandidateRecords(original, capture([row({ PartyCode: "WRI", PartyDesc: "Write-In" })]))[0]!.status, "write-in");
	assert.throws(() => parseStateCandidateRecords(original, capture([row({ StatusDesc: "Filed" })])));
});

test("Florida local captures reject altered elections, codebooks, controls, row counts, duplicate identities and source types", () => {
	for (const body of [capture([row({ ElectionID: "20281107-GEN" })]), capture([row(), row()]), capture([row({ County: "BAD" })]), capture([row({ AcctNum: "" })]), capture([row({ OfficeDesc: "" })]), capture([row({ Juris1num: "../7" })]), capture([], { countyCodes: countyCodes.replace("ALA\tAlachua\n", "") }), capture([], { countyCodes: countyCodes.replace("HIL\tHillsborough", "ALA\tHillsborough") }), capture([], { page: page.replace("value=\"LOC\"", "value=\"OTHER\"") }), capture([], { page: page.replace("extractCountyCodes.asp", "https://example.com/export") }), capture([], { records: `${headers.slice(1).join("\t")}\n` }), capture([], { records: "<html>Access denied</html>" })]) assert.throws(() => parseStateCandidateRecords(original, body), error => error instanceof Error && !(error instanceof StateBallotAwaitingRecordsError));
	assert.throws(() => parseStateCandidateRecords({ ...original, postBody: original.postBody!.replace("LOC", "STA") }, capture()));
	assert.throws(() => parseStateCandidateRecords(future, futureCapture()), StateBallotAwaitingRecordsError);
});

test("the local collector uses only the published county and local download controls with a scoped encoding choice", async () => {
	const calls: { url: string; postBody?: string; textEncoding?: string }[] = [];
	const body = await fetchStateBallotSourceText(original, async (url, options) => {
		calls.push({ url, postBody: options.postBody, textEncoding: options.textEncoding });
		assert.equal(options.maxRedirects, 0);
		assert.deepEqual(options.allowedHosts, [new URL(original.url).hostname]);
		return url === original.pageUrl ? page : url === floridaCountyCodesUrl ? countyCodes : JSON.parse(capture()).records;
	});
	assert.equal(parseStateCandidateRecords(original, body).length, 1);
	assert.equal(calls.length, 3);
	assert.equal(calls[1]!.postBody, "FormSubmitCounty=Download+County+Codes");
	assert.equal(calls[2]!.postBody, buildFloridaCandidateForm(original, page));
	assert.equal(calls[2]!.textEncoding, "utf-8-or-windows-1252");
	assert.equal(calls[0]!.textEncoding, undefined);
	assert.equal(calls[1]!.textEncoding, undefined);
	let requests = 0;
	for (const source of [{ ...original, id: "fl-doe-2026" }, { ...original, url: `${original.url}?arbitrary=1` }, { ...original, postBody: original.postBody!.replace("LOC", "STA") }]) {
		await assert.rejects(fetchStateBallotSourceText(source, async () => {
			requests++;
			return page;
		}));
	}
	assert.equal(requests, 0);
});

test("published future local elections retain their source type, namespace and exact election binding", () => {
	assert.equal(future.id, "fl-local-general-2028-11-07");
	assert.equal(future.format, "florida-local-tsv");
	assert.match(future.postBody!, /elecID=20281107-GEN.*cantype=LOC/u);
	assert.equal(buildFloridaCandidateForm(future, page), future.postBody);
	assert.equal(parseStateCandidateRecords(future, futureCapture(true)).length, 1);
	assert.throws(() => buildFloridaCandidateForm({ ...future, postBody: future.postBody!.replace("20281107", "20281103") }, page));
});

test("validated empty reports survive process restarts without imports or duplicate collection, then automatically acquire new records", async () => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-fl-local-pending-"));
	let clock = now;
	let requests = 0;
	const options = { sources: [future], dataDirectory: directory, now: () => clock, ttlMs: 1000, fetchText: async () => {
		requests++;
		return futureCapture(clock > now + 1000);
	} };
	try {
		const first = createStateBallotRepository(options);
		assert.equal(await first.getSnapshot("FL", future.id), null);
		assert.equal(first.isAwaitingRecords!(future.id), true);
		const receipt = await readFile(join(directory, `${future.id}.json.pending`), "utf8");
		await assert.rejects(readFile(join(directory, `${future.id}.json`)), /ENOENT/u);
		clock++;
		const restarted = createStateBallotRepository(options);
		assert.equal(await restarted.getSnapshot("FL", future.id), null);
		assert.equal(requests, 1);
		assert.equal(await readFile(join(directory, `${future.id}.json.pending`), "utf8"), receipt);
		const status = (await restarted.inspectSources!())[0]!;
		assert.equal(status.status, "pending");
		assert.equal(status.records, null);
		assert.equal(status.retrievedAt, null);
		assert.equal(status.lastAttemptAt, new Date(now).toISOString());
		assert.equal(status.lastImportAt, null);
		assert.equal(status.failure, null);
		clock = now + 1001;
		const acquired = await restarted.getSnapshot("FL", future.id);
		assert.equal(acquired!.records.length, 1);
		assert.equal(requests, 2);
		assert.equal(restarted.isAwaitingRecords!(future.id), false);
		assert.equal((await restarted.inspectSources!())[0]!.status, "current");
		const accepted = createStateBallotRepository({ ...options, fetchText: async () => {
			throw new Error("Must not collect accepted cached data");
		} });
		assert.equal((await accepted.getSnapshot("FL", future.id))!.records.length, 1);
	}
	finally { await rm(directory, { recursive: true, force: true }); }
});

test("an empty refresh never replaces accepted records, and transport or schema failures never become pending", async () => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-fl-local-last-good-"));
	try {
		const storage = createStateBallotStorage(directory);
		const body = futureCapture(true);
		await storage.write({ source: future, retrievedAt: new Date(now).toISOString(), sha256: hash(body), records: parseStateCandidateRecords(future, body) });
		const before = await readFile(join(directory, `${future.id}.json`), "utf8");
		const failures: string[] = [];
		const repository = createStateBallotRepository({ sources: [future], dataDirectory: directory, now: () => now + 1001, ttlMs: 1000, fetchText: async () => futureCapture(), onUnavailable: (_state, reason) => failures.push(reason) });
		assert.equal(await repository.getSnapshot("FL", future.id), null);
		assert.equal(repository.isAwaitingRecords!(future.id), false);
		assert.deepEqual(failures, ["format"]);
		assert.equal(await readFile(join(directory, `${future.id}.json`), "utf8"), before);
		await assert.rejects(readFile(join(directory, `${future.id}.json.pending`)), /ENOENT/u);
		for (const fetchText of [async () => {
			throw new Error("HTTP 403");
		}, async () => capture([], { records: "not a candidate export" })]) {
			const emptyDirectory = await mkdtemp(join(tmpdir(), "ballot-fl-local-failure-"));
			try {
				const failed = createStateBallotRepository({ sources: [future], dataDirectory: emptyDirectory, now: () => now, fetchText });
				assert.equal(await failed.getSnapshot("FL", future.id), null);
				assert.equal(failed.isAwaitingRecords!(future.id), false);
				assert.equal((await failed.inspectSources!())[0]!.status, "error");
			}
			finally { await rm(emptyDirectory, { recursive: true, force: true }); }
		}
	}
	finally { await rm(directory, { recursive: true, force: true }); }
});

test("pending receipt write failures are real persistence exceptions and waiting expires at Election Day", async () => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-fl-local-pending-failure-"));
	try {
		const failures: string[] = [];
		const broken = createStateBallotRepository({ sources: [future], dataDirectory: directory, now: () => now, fetchText: async () => {
			await mkdir(join(directory, `${future.id}.json.pending`));
			return futureCapture();
		}, onPersistenceError: (_state, sourceId) => failures.push(sourceId) });
		assert.equal(await broken.getSnapshot("FL", future.id), null);
		assert.equal(broken.isAwaitingRecords!(future.id), false);
		assert.deepEqual(failures, [future.id]);
		assert.equal((await broken.inspectSources!())[0]!.status, "error");
		await rm(join(directory, `${future.id}.json.pending`), { recursive: true });
		let clock = Date.parse(`${future.electionDate}T00:00:00Z`) - 10;
		let requests = 0;
		const repository = createStateBallotRepository({ sources: [future], dataDirectory: directory, now: () => clock, fetchText: async () => {
			requests++;
			return futureCapture();
		} });
		assert.equal(await repository.getSnapshot("FL", future.id), null);
		assert.equal(repository.isAwaitingRecords!(future.id), true);
		clock += 11;
		assert.equal(repository.isAwaitingRecords!(future.id), false);
		assert.equal(await repository.getSnapshot("FL", future.id), null);
		assert.equal(requests, 2);
		assert.equal((await repository.inspectSources!())[0]!.status, "error");
	}
	finally { await rm(directory, { recursive: true, force: true }); }
});

test("pending evidence is bounded, source-bound and rejects symlinks, corrupt identities and future clocks", async () => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-fl-local-proof-"));
	try {
		const storage = createStateBallotStorage(directory);
		const receipt = { retrievedAt: new Date(now).toISOString(), sourceSha256: hash(futureCapture()) };
		await storage.writePending(future, receipt, now);
		assert.deepEqual(await storage.readPending(future, now), receipt);
		await assert.rejects(storage.readPending({ ...future, label: "Changed configuration" }, now));
		await assert.rejects(storage.readPending(future, now - 1));
		await assert.rejects(storage.writePending({ ...future, format: "csv" }, receipt, now));
		const path = join(directory, `${future.id}.json.pending`);
		const accepted = await readFile(path, "utf8");
		await writeFile(path, "x".repeat(16 * 1024 + 1));
		await assert.rejects(storage.readPending(future, now), /size limit/u);
		await writeFile(path, JSON.stringify({ ...JSON.parse(accepted), sourceSha256: "invalid" }));
		await assert.rejects(storage.readPending(future, now));
		await rm(path);
		await writeFile(join(directory, "target"), accepted);
		await symlink(join(directory, "target"), path);
		await assert.rejects(storage.readPending(future, now));
	}
	finally { await rm(directory, { recursive: true, force: true }); }
});

test("future pending imports remain compatible with version-one automation receipts and count no imported records", async () => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-fl-local-automation-"));
	try {
		const environment = { STATE_BALLOT_DATA_DIR: directory, STATE_BALLOT_ENABLED_STATES: "FL", STATE_BALLOT_ENABLED_SOURCES: original.id, STATE_BALLOT_ENABLED_FAMILIES: original.id, STATE_BALLOT_CYCLE_CATALOGS: JSON.stringify({ [original.id]: join(directory, "cycles.json") }) };
		let requests = 0;
		const options = { environment, now: () => now, fetchDiscovery: async () => page, fetchText: async (source: StateBallotSource) => {
			requests++;
			return source.id === original.id ? capture() : capture([]);
		} };
		const first = await refreshApprovedCandidateData(options);
		assert.equal(first.status, "succeeded");
		assert.deepEqual(first.results.map(item => item.status), ["imported", "cached", "cached"]);
		assert.deepEqual(first.results.map(item => item.records), [1, 0, 0]);
		const second = await refreshApprovedCandidateData({ ...options, now: () => now + 1 });
		assert.equal(second.status, "succeeded");
		assert.ok(second.results.every(item => item.status === "cached" && item.reason === null));
		assert.equal(second.lastImportAt, first.lastImportAt);
		assert.equal(second.lastSuccessAt, first.lastSuccessAt);
		assert.equal(requests, 3);
		assert.deepEqual(await readAutomationRun(directory, now + 1), second);
		const cycle = await syncStateBallotCycles({ familyId: original.id, catalogPath: join(directory, "cycles.json"), dataDirectory: directory, now: () => now + 2, fetchDiscovery: async () => page, fetchCandidates: async () => {
			throw new Error("Must use durable data and probes");
		} });
		assert.deepEqual(cycle.results.map(item => item.status), ["available", "awaiting-records", "awaiting-records"]);
		assert.ok(cycle.results.every(item => !item.imported));
	}
	finally { await rm(directory, { recursive: true, force: true }); }
});

test("public pending responses are distinct from real failures and retain no fabricated capture or record counts", async () => {
	const app = express();
	const repository = createStateBallotRepository({ sources: [future], dataDirectory: null, now: () => now, fetchText: async () => futureCapture() });
	registerStateRecordRoutes(app, repository);
	const server = app.listen(0, "127.0.0.1");
	await once(server, "listening");
	try {
		const address = server.address();
		assert.ok(address && typeof address === "object");
		const response = await fetch(`http://127.0.0.1:${address.port}/api/state-records/FL?source=${future.id}`);
		assert.equal(response.status, 200);
		const result = await response.json();
		assert.equal(result.available, false);
		assert.equal(result.awaitingRecords, true);
		assert.equal(result.source.retrievedAt, undefined);
		assert.deepEqual(result.records, []);
		assert.equal(result.total, 0);
	}
	finally { await new Promise<void>((accept, reject) => server.close(error => error ? reject(error) : accept())); }
});
