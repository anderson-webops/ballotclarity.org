import type { StateBallotSnapshot } from "../src/state-ballot-repository.js";
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { once } from "node:events";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import express from "express";
import { syncStateBallotCycles } from "../src/state-ballot-cycle-sync.js";
import { discoverStateBallotElectionCycles, getStateBallotCycleFamily, parseStateBallotCycleCatalog, stateBallotCycleSources } from "../src/state-ballot-cycles.js";
import { fetchNycCandidateCapture, fetchNycCycleDiscovery, nycCivilPublicationKey, nycDiscoveryUrl, nycDocumentDigest, nycPolicyFingerprint, nycPolicySha256, nycSource, parseNycCandidateCapture, readNycDiscovery, validateNycDocumentUrl, validateNycSource } from "../src/state-ballot-nyc-collection.js";
import { readNycCandidateDocument } from "../src/state-ballot-nyc.js";
import { createStateCandidateRecord } from "../src/state-ballot-records.js";
import { configuredStateBallotSources } from "../src/state-ballot-registry.js";
import { attachStateBallotPreview, createStateBallotRepository } from "../src/state-ballot-repository.js";
import { parseBundledStateSnapshot } from "../src/state-ballot-snapshot.js";
import { createStateBallotStorage, serializeStoredStateSnapshot } from "../src/state-ballot-storage.js";
import { registerStateRecordRoutes } from "../src/state-records.js";
import { nycDocumentFixture } from "./helpers/nyc-fixture.js";

const now = Date.parse("2028-10-20T12:00:00Z");
const hash = (body: string) => createHash("sha256").update(body).digest("hex");
const policy = JSON.parse(await readFile(new URL("./fixtures/nyc-policy.json", import.meta.url), "utf8")) as { footer: string; robots: string };
const emptyIndex = `<div id="block-basic-content"><div class="group-right"><h2>No current publication</h2></div></div>${policy.footer}`;
const publication = (year: number) => `https://www.vote.nyc/sites/default/files/pdf/candidates/${year}/actually-offered.pdf`;
const page = (url: string, body: string) => ({ url, body, sha256: hash(body), retrievedAt: new Date(now).toISOString() });
const emptyDiscovery = () => JSON.stringify({ schemaVersion: 1, type: "nyc-candidate-discovery", robots: page("https://www.vote.nyc/robots.txt", policy.robots), home: page("https://www.vote.nyc/", policy.footer), index: page(nycDiscoveryUrl, emptyIndex), documents: [] });
function fixture(): StateBallotSnapshot {
	const source = nycSource("2028-11-07");
	const result = readNycCandidateDocument(source, nycDocumentFixture("2028", "07"), createStateCandidateRecord);
	const documents = [{ url: publication(2028), sha256: hash("Synthetic publication"), retrievedAt: new Date(now).toISOString(), includedRecordCount: result.records.length }];
	return { source, records: result.records, ballotQuestions: result.questions, sourceAsOf: result.printedAt, sourceAsOfDate: result.asOfDate, documents, retrievedAt: documents[0]!.retrievedAt, sha256: hash(JSON.stringify(documents.map(({ url, sha256 }) => ({ url, sha256 })))), collectionIndexSha256: nycDocumentDigest(documents.map(({ url, sha256 }) => ({ url, sha256 }))) };
}

test("NYC source registration preserves the independent Monroe source and exact city scope", () => {
	assert.deepEqual(configuredStateBallotSources.find(source => source.id === "ny-nyc-2026"), nycSource("2026-11-03"));
	assert(configuredStateBallotSources.some(source => source.id === "ny-monroe-2026"));
	assert.equal(getStateBallotCycleFamily("ny-nyc-2026").prefix, "ny-nyc-general");
	for (const change of [{ placeName: undefined }, { stateCode: "NJ" }, { countyName: "New York" }, { retrievalPolicy: "manual-snapshot" }, { snapshotStorage: undefined }]) assert.throws(() => validateNycSource({ ...nycSource("2026-11-03"), ...change } as Parameters<typeof validateNycSource>[0]), /review/u);
});

test("NYC future catalogs use offered dates and URLs for both even and odd years", () => {
	const family = getStateBallotCycleFamily("ny-nyc-2026");
	for (const date of ["2027-11-02", "2028-11-07"]) {
		const catalog = parseStateBallotCycleCatalog({ schemaVersion: 1, type: "state-ballot-cycle-catalog", familyId: family.source.id, sourceConfigurationSha256: hash(JSON.stringify(family.source)), discovery: { url: nycDiscoveryUrl, sha256: hash("Synthetic discovery"), retrievedAt: new Date(now).toISOString() }, elections: [{ electionId: null, electionDate: date, pageUrl: nycDiscoveryUrl, nycDocuments: [{ url: publication(Number(date.slice(0, 4))), sha256: hash("Synthetic PDF") }] }] }, now);
		assert.deepEqual(stateBallotCycleSources(catalog, now), [nycSource(date)]);
	}
	assert.throws(() => nycSource("2028-11-06"), /review/u);
	for (const url of [publication(2028).replace("https:", "http:"), `${publication(2028)}?token=1`, `${publication(2028)}#page=1`, publication(2028).replace("www.vote.nyc", "other.example"), publication(2028).replace("actually-offered.pdf", "..%2Fother.pdf")]) assert.throws(() => validateNycDocumentUrl(url, "2028-11-07"));
});

test("NYC validates current policy before accepting an empty future discovery", async () => {
	assert.equal(nycPolicyFingerprint(policy.footer), nycPolicySha256);
	assert.notEqual(nycPolicyFingerprint(`${policy.footer}<a href='/terms'>Terms</a>`), nycPolicySha256);
	assert.equal(readNycDiscovery(emptyDiscovery(), now).elections.length, 0);
	assert.equal(discoverStateBallotElectionCycles(emptyDiscovery(), "ny-nyc-2026", now).elections.length, 0);
	const capture = await fetchNycCandidateCapture(nycSource("2028-11-07"), { discovery: emptyDiscovery(), now: () => now });
	assert.throws(() => parseNycCandidateCapture(nycSource("2028-11-07"), capture, createStateCandidateRecord, now), /no records yet/u);
	assert.throws(() => parseNycCandidateCapture(nycSource("2028-11-07"), capture, createStateCandidateRecord, now, fixture()), /review/u);
});

test("NYC stops before documents on unavailable access or changed policy", async () => {
	const calls: string[] = [];
	await assert.rejects(fetchNycCycleDiscovery({ request: async (url) => {
		calls.push(url);
		return { status: 403, body: Buffer.alloc(0), contentType: "text/html", etag: undefined };
	}, sleep: async () => {} }), /review/u);
	assert.deepEqual(calls, ["https://www.vote.nyc/robots.txt"]);
	let count = 0;
	await assert.rejects(fetchNycCycleDiscovery({ request: async (url) => {
		count++;
		return { status: 200, body: Buffer.from(url.endsWith("robots.txt") ? policy.robots : `${policy.footer}<a href='/terms'>Terms</a>`), contentType: url.endsWith("robots.txt") ? "text/plain" : "text/html", etag: undefined };
	}, sleep: async () => {} }), /review/u);
	assert.equal(count, 2);
});

test("NYC rejects changed capture fields, clocks, policies and unverified document inventories", () => {
	const baseline = JSON.parse(emptyDiscovery());
	for (const mutate of [(value: typeof baseline) => {
		value.robots.body += "Disallow: /";
	}, (value: typeof baseline) => {
		value.index.retrievedAt = "2030-01-01T00:00:00.000Z";
	}, (value: typeof baseline) => {
		value.documents.push({ url: publication(2028) });
	}, (value: typeof baseline) => {
		value.extra = true;
	}, (value: typeof baseline) => { value.home.sha256 = "0".repeat(64); }]) {
		const value = structuredClone(baseline);
		mutate(value);
		assert.throws(() => readNycDiscovery(JSON.stringify(value), now), /review/u);
	}
});

test("NYC stored facts retain fusion parties, printed seats, five proposal occurrences and civil clocks", () => {
	const snapshot = fixture();
	const restored = parseBundledStateSnapshot(snapshot.source, serializeStoredStateSnapshot(snapshot), "automatic");
	assert.deepEqual(JSON.parse(JSON.stringify(restored)), JSON.parse(JSON.stringify(snapshot)));
	assert.equal(restored.records.find(record => record.scope === "statewide")!.party, "Democratic / Working Families");
	assert(restored.records.every(record => record.voteLimit === undefined && record.sourceStatus === "Tentative"));
	assert.equal(restored.ballotQuestions![0]!.pages.length, 5);
	assert.equal(nycCivilPublicationKey(snapshot.sourceAsOf!, snapshot.source.electionDate), "2028-09-11T10:26:11");
	assert.equal(nycCivilPublicationKey("9/11/2028 12:26:11AM", snapshot.source.electionDate), "2028-09-11T00:26:11");
	assert(!JSON.stringify(restored).includes("Private fixture mailing"));
});

test("NYC stored metadata holds invalid geography, qualification, audience and provenance", () => {
	const snapshot = fixture();
	const body = serializeStoredStateSnapshot(snapshot);
	for (const mutate of [(value: Record<string, any>) => {
		value.records[0].status = "qualified";
	}, (value: Record<string, any>) => {
		value.records[0].scope = "local";
	}, (value: Record<string, any>) => {
		value.records[0].voteLimit = 1;
	}, (value: Record<string, any>) => {
		value.sourceAsOfDate = "2028-11-08";
	}, (value: Record<string, any>) => {
		value.ballotQuestions[0].audience = "All voters";
	}, (value: Record<string, any>) => {
		value.ballotQuestions[0].pages.pop();
	}, (value: Record<string, any>) => {
		value.ballotQuestions.push(value.ballotQuestions[0]);
	}, (value: Record<string, any>) => {
		value.collectionIndexSha256 = "f".repeat(64);
	}, (value: Record<string, any>) => { value.documents[0].url = publication(2026); }]) {
		const value = JSON.parse(body);
		mutate(value);
		assert.throws(() => parseBundledStateSnapshot(snapshot.source, JSON.stringify(value), "automatic"));
	}
	const noQuestions = { ...snapshot, ballotQuestions: [] };
	assert.equal(parseBundledStateSnapshot(snapshot.source, serializeStoredStateSnapshot(noQuestions), "automatic").ballotQuestions!.length, 0);
});

test("NYC durable storage refreshes readers and survives a restart without publisher requests", async () => {
	const directory = await mkdtemp(join(tmpdir(), "nyc-storage-"));
	try {
		const snapshot = fixture();
		let requests = 0;
		let clock = now;
		const options = { sources: [snapshot.source], dataDirectory: directory, now: () => clock, fetchText: async () => {
			requests++;
			throw new Error("Publisher offline");
		} };
		const repository = createStateBallotRepository(options);
		assert.equal(await repository.getSnapshot("NY", snapshot.source.id), null);
		const storage = createStateBallotStorage(directory);
		await storage.write(snapshot);
		assert.deepEqual((await repository.getSnapshot("NY", snapshot.source.id))!.records, JSON.parse(JSON.stringify(snapshot.records)));
		const revised = { ...snapshot, retrievedAt: new Date(now + 1000).toISOString(), documents: snapshot.documents!.map(document => ({ ...document, retrievedAt: new Date(now + 1000).toISOString() })) };
		clock += 1000;
		await storage.write(revised);
		assert.equal((await repository.getSnapshot("NY", snapshot.source.id))!.retrievedAt, revised.retrievedAt);
		assert.deepEqual((await createStateBallotRepository(options).getSnapshot("NY", snapshot.source.id))!.ballotQuestions, snapshot.ballotQuestions);
		assert.equal(requests, 0);
	}
	finally { await rm(directory, { recursive: true, force: true }); }
});

test("NYC preference requires an address-matched city rather than ZIP, county or IP context", async () => {
	const snapshot = fixture();
	const fallback = { ...snapshot, source: { ...snapshot.source, id: "synthetic-monroe", placeName: undefined, countyName: "Monroe County", defaultPriority: 10 } };
	const requested: (string | undefined)[] = [];
	const repository = { sources: [snapshot.source, fallback.source], async getSnapshot(_state: string, sourceId?: string) {
		requested.push(sourceId);
		return sourceId === snapshot.source.id ? snapshot : fallback;
	} };
	const place = { id: "place-3651000", districtType: "place", label: "New York city", sourceSystem: "Synthetic city context" };
	for (const [inputKind, detectedFromIp, districtMatches, expected] of [["address", false, [place], snapshot.source.id], ["zip", false, [place], undefined], ["address", true, [place], undefined], ["address", false, [], undefined]] as const) {
		requested.length = 0;
		await attachStateBallotPreview({ result: "resolved", inputKind, detectedFromIp, location: { state: "NY" }, districtMatches: [...districtMatches] } as Parameters<typeof attachStateBallotPreview>[0], repository);
		assert.equal(requested[0], expected);
	}
});

test("NYC public question routes retain official text and distinguish missing records from failures", async () => {
	const snapshot = fixture();
	let fail = false;
	const app = express();
	registerStateRecordRoutes(app, { sources: [snapshot.source], async getSnapshot() {
		if (fail) throw new Error("Storage unavailable");
		return snapshot;
	} });
	const server = app.listen(0, "127.0.0.1");
	await once(server, "listening");
	try {
		const address = server.address();
		assert(address && typeof address === "object");
		const url = `http://127.0.0.1:${address.port}/api/state-records/NY/questions?source=${snapshot.source.id}`;
		const response = await fetch(url);
		assert.equal(response.status, 200);
		assert.equal(response.headers.get("cache-control"), "no-store");
		const data = await response.json();
		assert.deepEqual(data.questions, snapshot.ballotQuestions);
		assert.equal(data.source.documentLinks[0].url, publication(2028));
		fail = true;
		assert.equal((await fetch(url)).status, 503);
	}
	finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});

test("NYC accepted current catalog cannot disappear before the election", async () => {
	const directory = await mkdtemp(join(tmpdir(), "nyc-disappearance-"));
	try {
		const family = getStateBallotCycleFamily("ny-nyc-2026");
		const catalog = { schemaVersion: 1, type: "state-ballot-cycle-catalog", familyId: family.source.id, sourceConfigurationSha256: hash(JSON.stringify(family.source)), discovery: { url: nycDiscoveryUrl, sha256: hash("Synthetic discovery"), retrievedAt: new Date(now).toISOString() }, elections: [{ electionId: null, electionDate: "2028-11-07", pageUrl: nycDiscoveryUrl, nycDocuments: [{ url: publication(2028), sha256: hash("Synthetic PDF") }] }] };
		const { writeStateBallotCycleCatalog } = await import("../src/state-ballot-cycles.js");
		const path = join(directory, "cycles.json");
		await writeStateBallotCycleCatalog(path, parseStateBallotCycleCatalog(catalog, now), now);
		const before = await readFile(path, "utf8");
		await assert.rejects(syncStateBallotCycles({ familyId: family.source.id, catalogPath: path, dataDirectory: join(directory, "data"), now: () => now, fetchDiscovery: async () => emptyDiscovery() }), /disappeared/u);
		assert.equal(await readFile(path, "utf8"), before);
	}
	finally { await rm(directory, { recursive: true, force: true }); }
});
