import type { StateBallotSnapshot } from "../src/state-ballot-repository.js";
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { once } from "node:events";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import express from "express";
import { syncStateBallotCycles } from "../src/state-ballot-cycle-sync.js";
import { discoverStateBallotElectionCycles, getStateBallotCycleFamily, parseStateBallotCycleCatalog, stateBallotCycleSources, writeStateBallotCycleCatalog } from "../src/state-ballot-cycles.js";
import { fetchOrangeCandidateCapture, fetchOrangeCycleDiscovery, orangeDocumentDigest, parseOrangeCandidateCapture, readOrangeDiscovery } from "../src/state-ballot-orange-collection.js";
import { orangeHash as hash, orangeDiscoveryUrl, orangeGeneralDate, orangeOrigin, orangePolicyFingerprint, orangePolicySha256, orangeSource, readOrangeCandidateIndex, validateOrangeDocumentUrl, validateOrangeSource } from "../src/state-ballot-orange-discovery.js";
import { readOrangeCandidateProof } from "../src/state-ballot-orange-proof.js";
import { orangeCandidateRecords, orangeOfficeGeography, orangePublicationKey } from "../src/state-ballot-orange-records.js";
import { createStateCandidateRecord } from "../src/state-ballot-records.js";
import { configuredStateBallotSources } from "../src/state-ballot-registry.js";
import { attachStateBallotPreview, buildStateBallotPreview, createStateBallotRepository } from "../src/state-ballot-repository.js";
import { parseBundledStateSnapshot } from "../src/state-ballot-snapshot.js";
import { createStateBallotStorage, serializeStoredStateSnapshot } from "../src/state-ballot-storage.js";
import { registerStateRecordRoutes, stateRecordDocumentLinks } from "../src/state-records.js";
import { orangeProofFixture } from "./helpers/orange-proof-fixture.js";

const now = Date.parse("2028-10-20T12:00:00Z");
interface StoredTestData { records: [Record<string, unknown>, ...Record<string, unknown>[]]; sourceAsOf: unknown }
const policy = JSON.parse(await readFile(new URL("./fixtures/orange-policy.json", import.meta.url), "utf8")) as { footer: string; robots: string; script: string };
const page = (url: string, body: string) => ({ url, body, sha256: hash(body), retrievedAt: new Date(now).toISOString() });
function index(years: number[] = []) {
	const mapping = years.map((year, position) => `'${position + 1}': 'GEN${year}'`).join(",");
	const script = policy.script.replace(/\burls\s*=\s*\{[\s\S]*?\};/u, `urls = {${mapping}};`);
	return `<select id="select-vbm-app"><option value="0">Please select an election</option>${years.map((year, position) => `<option value="${position + 1}">${year} General Election</option>`).join("")}</select><script>${script}</script>${policy.footer}`;
}
function discovery(years: number[] = []) {
	return JSON.stringify({ schemaVersion: 1, type: "orange-candidate-discovery", robots: page(`${orangeOrigin}/robots.txt`, policy.robots), home: page(`${orangeOrigin}/`, policy.footer), candidates: page(`${orangeOrigin}/candidates`, `<a href="${orangeDiscoveryUrl}">Filing log</a>${policy.footer}`), index: page(orangeDiscoveryUrl, index(years)), documents: years.map(year => ({ url: `${orangeOrigin}/fileadmin/user_upload/data/candlog/GEN${year}/candlog.pdf`, status: 404, sha256: hash("Synthetic not-yet-published document"), retrievedAt: new Date(now).toISOString() })) });
}
function snapshot(): StateBallotSnapshot {
	const source = orangeSource("2028-11-07");
	const result = readOrangeCandidateProof(orangeProofFixture("2028"), source.electionDate);
	const records = orangeCandidateRecords(source, result, createStateCandidateRecord);
	const documents = [{ url: `${orangeOrigin}/fileadmin/user_upload/data/candlog/GEN2028/candlog.pdf`, sha256: hash("Synthetic qualified report"), retrievedAt: new Date(now).toISOString(), includedRecordCount: records.length }];
	return { source, records, sourceAsOf: "2028-08-28T15:48:21", sourceAsOfDate: "2028-08-28", documents, retrievedAt: new Date(now).toISOString(), sha256: hash(JSON.stringify(documents.map(({ url, sha256 }) => ({ url, sha256 })))), collectionIndexSha256: orangeDocumentDigest(documents) };
}

test("Orange registration leaves the separate California source intact and binds exact county configuration", () => {
	assert.deepEqual(configuredStateBallotSources.find(source => source.id === "ca-orange-2026"), orangeSource("2026-11-03"));
	assert(configuredStateBallotSources.some(source => source.id === "ca-sos-2026"));
	assert.equal(getStateBallotCycleFamily("ca-orange-2026").prefix, "ca-orange-general");
	for (const change of [{ stateCode: "FL" }, { countyName: undefined }, { snapshotStorage: undefined }, { retrievalPolicy: "manual-snapshot" }]) assert.throws(() => validateOrangeSource({ ...orangeSource("2026-11-03"), ...change } as Parameters<typeof validateOrangeSource>[0]), /review/u);
});

test("Orange discovers only matching published selector labels and reviewed script mappings", () => {
	for (const year of [2027, 2028]) {
		const offers = readOrangeCandidateIndex(index([year]));
		assert.equal(offers[0]!.electionDate, orangeGeneralDate(String(year)));
		validateOrangeDocumentUrl(offers[0]!.pdfUrl, offers[0]!.electionDate);
	}
	assert.deepEqual(readOrangeCandidateIndex(index()), []);
	assert.throws(() => readOrangeCandidateIndex(index([2028]).replace("<option value=\"1\">", "<option disabled value=\"1\">")), /review/u);
	assert.throws(() => readOrangeCandidateIndex(index([2028, 2030]).replace("'GEN2028',", "'GEN2028',,")), /review/u);
	for (const body of [index([2028]).replace("GEN2028", "GEN2030"), index([2028]).replace("2028 General Election", "2028 Primary Election"), index([2028]).replace("urlExists(url, function(exists)", "differentFetch(url, function(exists)"), index([2028]).replace("GEN2028", "../other"), index([2028, 2028])]) assert.throws(() => readOrangeCandidateIndex(body), /review/u);
	for (const url of [`${orangeOrigin}/fileadmin/user_upload/data/candlog/GEN2026/candlog.pdf`, `${orangeOrigin}/fileadmin/user_upload/data/candlog/GEN2028/candlog.pdf?token=1`, "http://ocvote.gov/fileadmin/user_upload/data/candlog/GEN2028/candlog.pdf"]) assert.throws(() => validateOrangeDocumentUrl(url, "2028-11-07"), /review/u);
});

test("Orange future catalogs preserve source dates, offered URLs and awaiting-publication evidence", () => {
	const capture = readOrangeDiscovery(discovery([2028]), now);
	const catalog = discoverStateBallotElectionCycles(discovery([2028]), "ca-orange-2026", now);
	assert.deepEqual(catalog.elections, capture.elections);
	assert.deepEqual(stateBallotCycleSources(catalog, now), [orangeSource("2028-11-07")]);
	assert.equal(catalog.elections[0]!.orangeDocuments![0]!.status, 404);
	const duplicate = { ...catalog, elections: [...catalog.elections, ...catalog.elections] };
	assert.throws(() => parseStateBallotCycleCatalog(duplicate, now), /duplicated/u);
	assert.throws(() => orangeSource("2028-11-06"), /review/u);
});

test("Orange verifies current robots and linked policy surfaces before fetching a candidate report", async () => {
	assert.equal(orangePolicyFingerprint(policy.footer), orangePolicySha256);
	assert.notEqual(orangePolicyFingerprint(`${policy.footer}<a href="/terms">Terms</a>`), orangePolicySha256);
	const calls: string[] = [];
	await assert.rejects(fetchOrangeCycleDiscovery({ request: async (url) => {
		calls.push(url);
		return { status: 403, body: Buffer.alloc(0), contentType: "text/html", etag: undefined };
	}, sleep: async () => {} }), /review/u);
	assert.deepEqual(calls, [`${orangeOrigin}/robots.txt`]);
	calls.length = 0;
	await assert.rejects(fetchOrangeCycleDiscovery({ request: async (url) => {
		calls.push(url);
		return { status: 200, body: Buffer.from(url.endsWith("robots.txt") ? policy.robots : `${policy.footer}<a href="/terms">Terms</a>`), contentType: url.endsWith("robots.txt") ? "text/plain" : "text/html", etag: undefined };
	}, sleep: async () => {} }), /review/u);
	assert.equal(calls.length, 2);
});

test("Orange offers without a PDF remain awaiting records and never replace an accepted snapshot", async () => {
	const source = orangeSource("2028-11-07");
	for (const body of [discovery(), discovery([2028])]) {
		const capture = await fetchOrangeCandidateCapture(source, { discovery: body, now: () => now });
		assert.throws(() => parseOrangeCandidateCapture(source, capture, createStateCandidateRecord, now), /no records yet/u);
		assert.throws(() => parseOrangeCandidateCapture(source, capture, createStateCandidateRecord, now, snapshot()), /review/u);
	}
});

test("Orange skips expired offered reports while awaiting the next published cycle", async () => {
	const value = JSON.parse(discovery([2028]));
	value.index.body = index([2026, 2028]);
	value.index.sha256 = hash(value.index.body);
	const pages = [value.robots, value.home, value.candidates, value.index];
	const requested: string[] = [];
	const body = await fetchOrangeCycleDiscovery({ now: () => now, sleep: async () => {}, request: async (url) => {
		requested.push(url);
		const page = pages.find(page => page.url === url);
		return page ? { status: 200, body: Buffer.from(page.body), contentType: url.endsWith("robots.txt") ? "text/plain" : "text/html", etag: undefined } : { status: 404, body: Buffer.alloc(0), contentType: "text/html", etag: undefined };
	} });
	assert.equal(requested.length, 5);
	assert(!requested.some(url => url.includes("GEN2026")));
	assert.equal(readOrangeDiscovery(body, now).elections[0]!.electionDate, "2028-11-07");
});

test("Orange rejects forged receipts, altered publication evidence and unexpected native data", () => {
	const baseline = JSON.parse(discovery([2028]));
	for (const mutate of [
		(value: typeof baseline) => { value.index.body += "<a href=\"/terms\">Terms</a>"; },
		(value: typeof baseline) => { value.home.sha256 = "0".repeat(64); },
		(value: typeof baseline) => { value.documents[0].status = "404"; },
		(value: typeof baseline) => { value.documents[0].status = 200; },
		(value: typeof baseline) => { value.documents[0].xml = "unverified"; },
		(value: typeof baseline) => { value.index.retrievedAt = "2030-01-01T00:00:00.000Z"; },
		(value: typeof baseline) => {
			value.candidates.body = policy.footer;
			value.candidates.sha256 = hash(policy.footer);
		},
	]) {
		const value = structuredClone(baseline);
		mutate(value);
		assert.throws(() => readOrangeDiscovery(JSON.stringify(value), now), /review/u);
	}
});

test("Orange candidate facts keep scoped IDs, official status, vote limits and literal party labels", () => {
	const value = snapshot();
	assert.equal(value.records.length, 4);
	assert.deepEqual(value.records.map(record => record.party), ["Republican", "Democratic", undefined, undefined]);
	assert(value.records.every(record => record.status === "qualified" && record.sourceStatus === "Qualified" && record.sourceDistrictLabel === undefined));
	assert(value.records.every(record => record.sourceCandidateId?.includes(":")));
	assert.equal(value.records[2]!.voteLimit, 2);
	assert.equal(value.records[2]!.scope, "local");
	assert.equal(buildStateBallotPreview({ ...value, records: value.records.slice(2) }, { districtMatches: [] }), null);
	assert.deepEqual(orangeOfficeGeography("State Assembly, 74th District", "Voter Nominated MEMBER OF THE STATE ASSEMBLY MEMBER OF THE STATE ASSEMBLY 74th District"), { scope: "state-house", district: "74" });
	assert.throws(() => orangeOfficeGeography("US Representative, 38th District", "Voter Nominated UNITED STATES REPRESENTATIVE UNITED STATES REPRESENTATIVE 40th District"), /review/u);
	const invalid = readOrangeCandidateProof(orangeProofFixture("2028"), "2028-11-07");
	invalid.candidates[0]!.qualifiedDate = "2028-09-01";
	assert.throws(() => orangeCandidateRecords(value.source, invalid, createStateCandidateRecord), /review/u);
});

test("Orange stored snapshots reconcile identities and preserve civil clocks without invented timezones", () => {
	const value = snapshot();
	const serialized = serializeStoredStateSnapshot(value);
	assert.deepEqual(parseBundledStateSnapshot(value.source, serialized, "automatic").records, JSON.parse(JSON.stringify(value.records)));
	for (const mutate of [
		(data: StoredTestData) => { data.records[0].id = "0".repeat(24); },
		(data: StoredTestData) => { data.records[0].scope = "local"; },
		(data: StoredTestData) => { data.records[0].sourceDistrictLabel = "Clipped label"; },
		(data: StoredTestData) => { data.records[0].voteLimit = 41; },
		(data: StoredTestData) => { data.records[0].sourceStatus = "Filed"; },
		(data: StoredTestData) => { data.sourceAsOf = "2028-08-28T25:00:00"; },
	]) {
		const data = JSON.parse(serialized);
		mutate(data);
		assert.throws(() => parseBundledStateSnapshot(value.source, JSON.stringify(data), "automatic"), /review/u);
	}
	assert.equal(orangePublicationKey(value.sourceAsOf!), "2028-08-28T15:48:21");
});

test("Orange persisted facts remain readable after import, cache refresh and restart with zero publisher requests", async () => {
	const directory = await mkdtemp(join(tmpdir(), "orange-stored-"));
	try {
		const value = snapshot();
		let requests = 0;
		let clock = now;
		const options = { sources: [value.source], dataDirectory: directory, now: () => clock, ttlMs: 1, fetchText: async () => {
			requests++;
			throw new Error("Publisher access disabled");
		} };
		const repository = createStateBallotRepository(options);
		assert.equal(await repository.getSnapshot("CA", value.source.id), null);
		const storage = createStateBallotStorage(directory);
		await storage.write(value);
		clock += 2;
		assert.deepEqual((await repository.getSnapshot("CA", value.source.id))!.records, JSON.parse(JSON.stringify(value.records)));
		const revised = { ...value, retrievedAt: new Date(now + 10).toISOString(), documents: value.documents!.map(document => ({ ...document, retrievedAt: new Date(now + 10).toISOString() })) };
		await storage.write(revised);
		clock += 20;
		assert.equal((await repository.getSnapshot("CA", value.source.id))!.retrievedAt, revised.retrievedAt);
		assert.deepEqual((await createStateBallotRepository(options).getSnapshot("CA", value.source.id))!.records, JSON.parse(JSON.stringify(value.records)));
		assert.equal(requests, 0);
	}
	finally { await rm(directory, { recursive: true, force: true }); }
});

test("Orange pending discovery imports a durable awaiting-records state and accepted catalogs cannot vanish", async () => {
	const directory = await mkdtemp(join(tmpdir(), "orange-cycles-"));
	try {
		const catalogPath = join(directory, "catalog.json");
		const options = { familyId: "ca-orange-2026", catalogPath, dataDirectory: join(directory, "data"), now: () => now, fetchDiscovery: async () => discovery([2028]) };
		assert.equal((await syncStateBallotCycles(options)).results[0]!.status, "awaiting-records");
		const before = await readFile(catalogPath, "utf8");
		await assert.rejects(syncStateBallotCycles({ ...options, fetchDiscovery: async () => discovery() }), /disappeared/u);
		assert.equal(await readFile(catalogPath, "utf8"), before);
		await writeStateBallotCycleCatalog(catalogPath, parseStateBallotCycleCatalog(JSON.parse(before), now), now);
	}
	finally { await rm(directory, { recursive: true, force: true }); }
});

test("Orange county preference requires matched California geography and never assigns local rows to a voter", async () => {
	const value = snapshot();
	const fallback = { ...value, source: { ...value.source, id: "synthetic-california", countyName: undefined } };
	const requested: (string | undefined)[] = [];
	const repository = { sources: [value.source, fallback.source], async getSnapshot(_state: string, sourceId?: string) {
		requested.push(sourceId);
		return sourceId === value.source.id ? value : fallback;
	} };
	const county = { id: "county-06059", districtType: "county", districtCode: "06059", label: "Orange County", sourceSystem: "Synthetic county context" };
	for (const [detectedFromIp, districtMatches, expected] of [[false, [county], value.source.id], [true, [county], undefined], [false, [], undefined]] as const) {
		requested.length = 0;
		await attachStateBallotPreview({ result: "resolved", inputKind: "address", detectedFromIp, location: { state: "CA" }, districtMatches: [...districtMatches] } as Parameters<typeof attachStateBallotPreview>[0], repository);
		assert.equal(requested[0], expected);
	}
	assert.equal(buildStateBallotPreview({ ...value, records: value.records.filter(record => record.scope === "local") }, { districtMatches: [county] }), null);
});

test("Orange public directory and detail routes expose qualified facts and a short direct source link", async () => {
	const value = snapshot();
	assert.deepEqual(stateRecordDocumentLinks(value.source, value), [{ label: "Candidate list", url: value.documents![0]!.url }]);
	const app = express();
	let fail = false;
	registerStateRecordRoutes(app, { sources: [value.source], async getSnapshot() {
		if (fail) throw new Error("Storage unavailable");
		return value;
	} });
	const server = app.listen(0, "127.0.0.1");
	await once(server, "listening");
	try {
		const address = server.address();
		assert(address && typeof address === "object");
		const url = `http://127.0.0.1:${address.port}/api/state-records/CA?source=${value.source.id}&status=all`;
		const response = await fetch(url);
		assert.equal(response.status, 200);
		const result = await response.json();
		assert.equal(result.total, 4);
		assert.equal(result.records[0].sourceStatus, "Qualified");
		assert(result.records.every((record: { sourceAreaLabel?: string }) => record.sourceAreaLabel === undefined));
		assert.equal(result.source.documentLinks[0].label, "Candidate list");
		const detailUrl = `${url}&q=${encodeURIComponent(value.records[0]!.name)}`;
		const detail = await fetch(detailUrl);
		assert.equal(detail.status, 200);
		assert.equal((await detail.json()).records.find((record: { id: string }) => record.id === value.records[0]!.id).name, value.records[0]!.name);
		fail = true;
		assert.equal((await fetch(url)).status, 503);
	}
	finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});
