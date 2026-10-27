import type { StateBallotSnapshot } from "../src/state-ballot-repository.js";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import express from "express";
import { readMaineHouseCandidates } from "../src/maine-house-candidates.js";
import { getStateBallotCycleFamily, parseStateBallotCycleCatalog, stateBallotCycleSources } from "../src/state-ballot-cycles.js";
import { fetchMaineHouseDiscovery, maineHouseConstitutionSha256, maineHouseLegislatureForDate, maineHousePolicyFingerprint, maineHouseRecord, maineHouseScheduledDate, maineHouseSource, maineHouseUrls, readMaineHouseDiscovery, validateMaineHouseElection, validateMaineHouseSource } from "../src/state-ballot-maine-house.js";
import { configuredStateBallotSources } from "../src/state-ballot-registry.js";
import { buildStateBallotPreview, createStateBallotRepository } from "../src/state-ballot-repository.js";
import { parseBundledStateSnapshot } from "../src/state-ballot-snapshot.js";
import { createStateBallotStorage, serializeStoredStateSnapshot } from "../src/state-ballot-storage.js";
import { registerStateRecordRoutes } from "../src/state-records.js";
import { maineHouseFixture } from "./helpers/maine-house-fixture.js";

const now = Date.parse("2028-10-20T12:00:00.000Z");
const hash = (body: string) => createHash("sha256").update(body).digest("hex");
function fixture(): StateBallotSnapshot {
	const source = maineHouseSource("2028-11-07");
	const parsed = readMaineHouseCandidates(maineHouseFixture(134));
	const records = parsed.records.map(input => maineHouseRecord(source, input));
	const documents = [maineHouseUrls.index, maineHouseUrls.constitution, maineHouseUrls.disclaimer].map((url, index) => ({ url, sha256: index === 1 ? maineHouseConstitutionSha256 : hash(`Synthetic document ${index}`), retrievedAt: new Date(now).toISOString(), includedRecordCount: index ? 0 : records.length }));
	return { source, records, documents, retrievedAt: documents[0]!.retrievedAt, sha256: hash(JSON.stringify(documents.map(({ url, sha256 }) => ({ url, sha256 })))), collectionIndexSha256: hash("Synthetic content identity") };
}

test("Maine House registration preserves the independent reviewed local source and blocks ballot qualification assumptions", () => {
	assert.deepEqual(configuredStateBallotSources.find(source => source.id === "me-house-clerk-2026"), maineHouseSource("2026-11-03"));
	assert.equal(configuredStateBallotSources.find(source => source.id === "me-local-samples-2026")!.retrievalPolicy, "manual-snapshot");
	assert.equal(getStateBallotCycleFamily("me-house-clerk-2026").prefix, "me-house-clerk-general");
	assert.equal(maineHouseSource("2026-11-03").ballotPreview, false);
	for (const change of [{ stateCode: "NH" }, { ballotPreview: undefined }, { snapshotStorage: undefined }, { countyName: "Example County" }, { retrievalPolicy: "manual-snapshot" }]) assert.throws(() => validateMaineHouseSource({ ...maineHouseSource("2026-11-03"), ...change } as Parameters<typeof validateMaineHouseSource>[0]), /review/u);
});

test("Maine House maps reviewed legislative contexts using the constitutional schedule, not retrieval or primary results", () => {
	assert.equal(maineHouseScheduledDate(133), "2026-11-03");
	assert.equal(maineHouseScheduledDate(134), "2028-11-07");
	assert.equal(maineHouseScheduledDate(135), "2030-11-05");
	assert.equal(maineHouseLegislatureForDate("2028-11-07"), 134);
	for (const value of [132, 133.5, 170, NaN]) assert.throws(() => maineHouseScheduledDate(value), /review/u);
	for (const date of ["2027-11-02", "2028-11-06", "2028-02-30", "2024-11-05"]) assert.throws(() => maineHouseLegislatureForDate(date), /review/u);
});

test("Maine House future catalogs retain the explicit legislature context and unchanged canonical endpoint", () => {
	const family = getStateBallotCycleFamily("me-house-clerk-2026");
	const election = { electionId: null, electionDate: "2028-11-07", pageUrl: maineHouseUrls.index, maineHouseLegislature: 134, maineHouseContentSha256: hash("Synthetic clerk content") };
	validateMaineHouseElection(election);
	const catalog = parseStateBallotCycleCatalog({ schemaVersion: 1, type: "state-ballot-cycle-catalog", familyId: family.source.id, sourceConfigurationSha256: hash(JSON.stringify(family.source)), discovery: { url: maineHouseUrls.index, sha256: hash("Synthetic discovery"), retrievedAt: new Date(now).toISOString() }, elections: [election] }, now);
	assert.deepEqual(stateBallotCycleSources(catalog, now), [maineHouseSource("2028-11-07")]);
	assert.throws(() => validateMaineHouseElection({ ...election, maineHouseLegislature: 133 }), /review/u);
	assert.throws(() => validateMaineHouseElection({ ...election, pageUrl: "https://other.example/candidates" }), /review/u);
	assert.throws(() => validateMaineHouseElection({ ...election, maineHouseContentSha256: "invalid" }), /review/u);
	assert.throws(() => parseStateBallotCycleCatalog({ ...catalog, elections: [election, election] }, now), /ambiguous/u);
});

test("Maine House policy fingerprints ignore only copyright and site edit labels while retaining terms changes", () => {
	const original = "<footer>© 2026 - The Maine House of Representatives Last Edited: Saturday, October 24, 2026</footer>";
	const future = original.replace("© 2026", "© 2028").replace("Saturday, October 24, 2026", "Friday, October 20, 2028");
	assert.equal(maineHousePolicyFingerprint(original, "index", now), maineHousePolicyFingerprint(future, "index", now));
	assert.notEqual(maineHousePolicyFingerprint(original, "index", now), maineHousePolicyFingerprint(`${original}<a href='/terms'>Terms</a>`, "index", now));
	assert.throws(() => maineHousePolicyFingerprint(original.replace("© 2026", "© 2030"), "index", now), /review/u);
	assert.throws(() => maineHousePolicyFingerprint("<div>No policy footer</div>", "index", now), /review/u);
});

test("Maine House robots and capture failures stop before candidate retrieval", async () => {
	const urls: string[] = [];
	await assert.rejects(fetchMaineHouseDiscovery({ requestText: async (url) => {
		urls.push(String(url));
		throw new Error("Source access denied");
	}, sleep: async () => {} }), /access denied/u);
	assert.deepEqual(urls, [maineHouseUrls.robots]);
	await assert.rejects(fetchMaineHouseDiscovery({ requestText: async () => "User-agent: *\nDisallow: /\n", sleep: async () => {} }), /review/u);
	for (const value of ["{}", JSON.stringify({ schemaVersion: 1, type: "maine-house-discovery" }), " ".repeat(12 * 1024 * 1024 + 1)]) assert.throws(() => readMaineHouseDiscovery(value, now), /review/u);
});

test("Maine House stored records retain unofficial party and explicit incumbent facts without a generated publication date", () => {
	const snapshot = fixture();
	const restored = parseBundledStateSnapshot(snapshot.source, serializeStoredStateSnapshot(snapshot), "automatic");
	assert.deepEqual(JSON.parse(JSON.stringify(restored)), JSON.parse(JSON.stringify(snapshot)));
	assert.equal(restored.records[0]!.sourceStatus, "Unofficial");
	assert.equal(restored.records[0]!.party, "Democrat");
	assert.equal(restored.records[0]!.incumbent, true);
	assert.equal(restored.records[1]!.incumbent, undefined);
	assert.equal(restored.sourceAsOfDate, undefined);
	assert.equal(restored.sourceAsOf, undefined);
	assert.equal(restored.documents!.length, 3);
});

test("Maine House stored metadata rejects qualification, geography, identity and date changes", () => {
	const snapshot = fixture();
	const body = serializeStoredStateSnapshot(snapshot);
	const mutations = [
		(value: Record<string, any>) => { value.records[0].status = "qualified"; },
		(value: Record<string, any>) => { value.records[0].scope = "local"; },
		(value: Record<string, any>) => { value.records[0].district = "152"; },
		(value: Record<string, any>) => { value.records[0].id = "f".repeat(24); },
		(value: Record<string, any>) => { value.records[0].sourceStatus = "Certified"; },
		(value: Record<string, any>) => { value.records[0].incumbent = false; },
		(value: Record<string, any>) => { value.sourceAsOfDate = "2028-10-20"; },
		(value: Record<string, any>) => { value.documents[1].sha256 = "e".repeat(64); },
		(value: Record<string, any>) => { value.documents[2].includedRecordCount = 1; },
	];
	for (const mutate of mutations) {
		const value = JSON.parse(body);
		mutate(value);
		assert.throws(() => parseBundledStateSnapshot(snapshot.source, JSON.stringify(value), "automatic"));
	}
});

test("Maine House unofficial records never become ballot choices even when a caller strips the configuration flag", () => {
	const snapshot = fixture();
	assert.equal(buildStateBallotPreview(snapshot, { districtMatches: [] }), null);
	assert.equal(buildStateBallotPreview({ ...snapshot, source: { ...snapshot.source, ballotPreview: undefined } }, { districtMatches: [] }), null);
	assert.equal(buildStateBallotPreview({ ...snapshot, source: { ...snapshot.source, ballotPreview: undefined, id: "me-house-clerk-general-2030-11-05", electionDate: "2030-11-05" } }, { districtMatches: [] }), null);
});

test("Maine House public readers see durable imports after misses and restarts without contacting the publisher", async () => {
	const directory = await mkdtemp(join(tmpdir(), "maine-house-storage-"));
	try {
		const snapshot = fixture();
		let requests = 0;
		const options = { sources: [snapshot.source], dataDirectory: directory, now: () => now, fetchText: async () => {
			requests++;
			throw new Error("Publisher offline");
		} };
		const repository = createStateBallotRepository(options);
		assert.equal(await repository.getSnapshot("ME", snapshot.source.id), null);
		await createStateBallotStorage(directory).write(snapshot);
		assert.deepEqual((await repository.getSnapshot("ME", snapshot.source.id))!.records, JSON.parse(JSON.stringify(snapshot.records)));
		assert.deepEqual((await createStateBallotRepository(options).getSnapshot("ME", snapshot.source.id))!.records, JSON.parse(JSON.stringify(snapshot.records)));
		assert.equal(requests, 0);
	}
	finally { await rm(directory, { recursive: true, force: true }); }
});

test("Maine House public candidate routes preserve status and separate unavailable storage from failures", async () => {
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
		const url = `http://127.0.0.1:${address.port}/api/state-records/ME?source=${snapshot.source.id}&status=all`;
		const response = await fetch(url);
		assert.equal(response.status, 200);
		assert.equal(response.headers.get("cache-control"), "no-store");
		const data = await response.json();
		assert.equal(data.total, 2);
		assert.equal(data.records[0].sourceStatus, "Unofficial");
		assert.equal(data.source.sourceAsOfDate, undefined);
		fail = true;
		assert.equal((await fetch(url)).status, 503);
	}
	finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});
