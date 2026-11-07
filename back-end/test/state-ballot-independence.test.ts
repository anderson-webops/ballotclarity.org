import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { syncStateBallotCycles } from "../src/state-ballot-cycle-sync.js";
import { discoverStateBallotElectionCycles, getStateBallotCycleFamily, parseStateBallotCycleCatalog, readStateBallotCycleCatalog, stateBallotCycleSources } from "../src/state-ballot-cycles.js";
import { fetchIndependenceCandidateCapture, fetchIndependenceCycleDiscovery, independenceDiscoveryUrl, independencePolicyReceipts, independenceSource, parseIndependenceCandidateCapture, readIndependenceCandidatePage, readIndependenceDiscovery, validateIndependenceElection, validateIndependenceSource } from "../src/state-ballot-independence.js";
import { createStateCandidateRecord, parseStateCandidateRecords } from "../src/state-ballot-records.js";
import { configuredStateBallotSources } from "../src/state-ballot-registry.js";
import { buildStateBallotPreview, createStateBallotRepository } from "../src/state-ballot-repository.js";
import { parseBundledStateSnapshot } from "../src/state-ballot-snapshot.js";
import { supportsPendingStateBallotRecords } from "../src/state-ballot-source-state.js";
import { serializeStoredStateSnapshot } from "../src/state-ballot-storage.js";

const source = independenceSource();
const fixture = readFileSync(new URL("./fixtures/independence-city.html", import.meta.url), "utf8");
const retrievedAt = "2026-10-25T12:00:00.000Z";
const now = Date.parse("2026-10-25T12:30:00.000Z");
const hash = (body: string) => createHash("sha256").update(body).digest("hex");
const future = (body: string) => body.replaceAll("2026 City Council", "2028 City Council").replaceAll("NOVEMBER 3, 2026", "NOVEMBER 7, 2028");
function capture(body = fixture, clock = retrievedAt) {
	return JSON.stringify({ schemaVersion: 1, type: "independence-city-candidate-capture", policies: independencePolicyReceipts, index: { url: independenceDiscoveryUrl, body, sha256: hash(body), retrievedAt: clock } });
}
const read = (body = fixture) => readIndependenceCandidatePage(source, body, createStateCandidateRecord);

test("Independence lists city references without inventing parties, ballot qualification, video identity, or personal eligibility", () => {
	const records = read();
	assert.deepEqual(records.map(record => record.name), ["Example Person", "Other Person", "Third Person"]);
	assert.deepEqual(records.map(record => record.incumbent), [undefined, true, undefined]);
	assert.ok(records.every(record => record.scope === "local" && record.jurisdiction === "Independence" && record.status === "listed" && !record.party && !record.candidateUrl));
	assert.equal(source.ballotPreview, false);
	assert.equal(buildStateBallotPreview({ source, records, retrievedAt, sha256: hash(fixture) }, { districtMatches: [] }), null);
	assert.deepEqual(parseStateCandidateRecords(source, capture()), records);
	assert.deepEqual(configuredStateBallotSources.find(item => item.id === source.id), source);
	assert.ok(configuredStateBallotSources.some(item => item.id === "mn-independence-2026" && item.retrievalPolicy === "manual-snapshot"));
});

test("Printed city, office, and election-year bindings reject other jurisdictions, invalid dates, and unannounced elections", () => {
	for (const body of [fixture.replace("2026 City Council", "2028 City Council"), fixture.replace("Elections in Independence", "Elections in Other City"), fixture.replace("NOVEMBER 3, 2026", "NOVEMBER 4, 2026"), fixture.replace("City Council Candidates", "School Board Candidates")]) assert.throws(() => read(body), /review/u);
	assert.throws(() => validateIndependenceSource({ ...source, stateCode: "IA" }), /review/u);
	assert.throws(() => validateIndependenceSource({ ...source, ballotPreview: undefined }), /review/u);
	validateIndependenceSource(Object.fromEntries(Object.entries(source).reverse()) as typeof source);
	assert.throws(() => validateIndependenceElection({ electionId: null, electionDate: "2028-11-08", pageUrl: independenceDiscoveryUrl }), /review/u);
});

test("Complete candidate blocks reject hidden headings, unexpected statuses, duplicate identities, and unsupported content", () => {
	for (const body of [fixture.replace("background:#eeeeee", "display:none;background:#eeeeee"), fixture.replace("Other Person - incumbent", "Other Person - withdrawn"), fixture.replaceAll("Third Person", "Example Person"), fixture.replace(/<ul>\s*<li>/u, "<ul><li><script>Example</script>"), fixture.replace("https://youtu.be/ABCDEFGHIJK", "https://example.com/ABCDEFGHIJK"), fixture.replace("Meet your Candidate, Example Person", "Meet your Candidate, Different Person")]) assert.throws(() => read(body), /review|duplicated/u);
	const result = parseIndependenceCandidateCapture(source, capture(), createStateCandidateRecord, now);
	assert.throws(() => parseIndependenceCandidateCapture(source, capture(), createStateCandidateRecord, now, [...result.records, { ...result.records[0]!, id: "f".repeat(24) }]), /disappeared/u);
});

test("Capture provenance binds the full original HTML, policies, timestamp, and exact document", () => {
	const value = JSON.parse(capture());
	assert.equal(readIndependenceDiscovery(capture(), now).index.retrievedAt, retrievedAt);
	for (const altered of [{ ...value, extra: true }, { ...value, policies: [] }, { ...value, index: { ...value.index, url: "https://example.com/" } }, { ...value, index: { ...value.index, sha256: "0".repeat(64) } }, { ...value, index: { ...value.index, retrievedAt: "2028-01-01T00:00:00.000Z" } }]) assert.throws(() => readIndependenceDiscovery(JSON.stringify(altered), now), /review/u);
	assert.throws(() => read(fixture.replaceAll("/hidden-pages/privacy-policy", "/hidden-pages/different-policy")), /legal/u);
});

test("Discovered future elections use the same collector without yearly URL edits or nominations inferred from statements", async () => {
	const clock = "2028-10-25T12:00:00.000Z";
	const futureNow = Date.parse(clock);
	const body = capture(future(fixture), clock);
	const catalog = discoverStateBallotElectionCycles(body, source.id, futureNow);
	const futureSource = stateBallotCycleSources(catalog, futureNow)[0]!;
	assert.equal(futureSource.id, "mn-independence-city-general-2028-11-07");
	assert.equal(futureSource.url, source.url);
	assert.equal(getStateBallotCycleFamily(source.id).discoveryUrl, source.url);
	assert.equal(parseIndependenceCandidateCapture(futureSource, body, createStateCandidateRecord, futureNow).records.length, 3);
	assert.equal(await fetchIndependenceCandidateCapture(futureSource, { discovery: body, now: () => futureNow, requestText: async () => {
		throw new Error("Network not expected");
	} }), body);
	await assert.rejects(fetchIndependenceCandidateCapture(source, { discovery: body, now: () => futureNow }), /does not offer/u);
	assert.throws(() => parseStateBallotCycleCatalog({ ...catalog, elections: [...catalog.elections, ...catalog.elections] }, futureNow), /duplicated/u);
});

test("External snapshots survive repeat runs and restart, with exact capture clocks, attribution, and tamper rejection", async () => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-independence-"));
	try {
		const options = { sources: [source], dataDirectory: directory, collectionIndexSha256: { [source.id]: hash(fixture) }, now: () => now, fetchText: async () => capture() };
		const repository = createStateBallotRepository(options);
		const snapshot = await repository.getSnapshot("MN", source.id);
		assert.ok(snapshot);
		assert.equal(snapshot.retrievedAt, retrievedAt);
		assert.equal(snapshot.collectionIndexSha256, hash(fixture));
		const serialized = serializeStoredStateSnapshot(snapshot);
		const records = JSON.parse(JSON.stringify(snapshot.records));
		assert.deepEqual(parseBundledStateSnapshot(source, serialized, "automatic").records, records);
		const stored = JSON.parse(serialized);
		stored.collectionIndexSha256 = "0".repeat(64);
		assert.throws(() => parseBundledStateSnapshot(source, JSON.stringify(stored), "automatic"), /index/u);
		const restarted = createStateBallotRepository({ ...options, now: () => now + 1, fetchText: async () => {
			throw new Error("Network not expected");
		} });
		assert.deepEqual((await restarted.getSnapshot("MN", source.id))?.records, records);
		assert.ok((await readFile(join(directory, `${source.id}.json`), "utf8")).includes(retrievedAt));
	}
	finally { await rm(directory, { recursive: true, force: true }); }
});

test("Recurring synchronization preserves archived editions, rejects disappearing active dates, and keeps failed publisher data", async () => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-independence-cycles-"));
	try {
		const options = { familyId: source.id, catalogPath: join(directory, "catalog.json"), dataDirectory: join(directory, "data"), now: () => now, fetchDiscovery: async () => capture() };
		assert.equal((await syncStateBallotCycles(options)).results[0]?.records, 3);
		const first = await readFile(options.catalogPath, "utf8");
		await assert.rejects(syncStateBallotCycles({ ...options, fetchDiscovery: async () => capture(future(fixture)) }), /active.*disappeared/u);
		assert.equal(await readFile(options.catalogPath, "utf8"), first);
		const futureNow = Date.parse("2028-10-25T12:00:00.000Z");
		const result = await syncStateBallotCycles({ ...options, now: () => futureNow, fetchDiscovery: async () => capture(future(fixture), new Date(futureNow).toISOString()) });
		assert.deepEqual(result.results.map(item => item.status), ["expired", "available"]);
		assert.deepEqual(readStateBallotCycleCatalog(options.catalogPath, futureNow)?.elections.map(item => item.electionDate), ["2026-11-03", "2028-11-07"]);
		await assert.rejects(syncStateBallotCycles({ ...options, now: () => futureNow, fetchDiscovery: async () => {
			throw new Error("Publisher unavailable");
		} }), /Publisher unavailable/u);
		assert.equal(readStateBallotCycleCatalog(options.catalogPath, futureNow)?.elections.length, 2);
	}
	finally { await rm(directory, { recursive: true, force: true }); }
});

test("Explicit pending notices remain awaiting records and collection refuses changed access policies before the candidate page", async () => {
	assert.equal(supportsPendingStateBallotRecords(source), true);
	const pending = fixture.replace(/(<div class="toggle-content">)[\s\S]*?(?=<\/section>)/u, "$1<p>Candidate statements will be posted.</p></div>");
	assert.throws(() => read(pending), /awaiting|published|records/iu);
	const requests: string[] = [];
	await assert.rejects(fetchIndependenceCycleDiscovery({ requestText: async (url) => {
		requests.push(url);
		return "User-agent: *\nDisallow: /\n";
	}, wait: async () => {} }), /policy requires review/u);
	assert.deepEqual(requests, ["https://www.ci.independence.mn.us/robots.txt"]);
});

test("An announced city election awaiting statements persists a pending receipt without an empty candidate import", async () => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-independence-pending-"));
	try {
		const pending = fixture.replace(/(<div class="toggle-content">)[\s\S]*?(?=<\/section>)/u, "$1<p>Candidate statements will be posted.</p></div>");
		const result = await syncStateBallotCycles({ familyId: source.id, catalogPath: join(directory, "catalog.json"), dataDirectory: join(directory, "data"), now: () => now, fetchDiscovery: async () => capture(pending) });
		assert.equal(result.results[0]?.status, "awaiting-records");
		assert.equal(result.results[0]?.records, 0);
		assert.equal(result.results[0]?.imported, false);
		await assert.rejects(readFile(join(directory, "data", `${source.id}.json`)), { code: "ENOENT" });
	}
	finally { await rm(directory, { recursive: true, force: true }); }
});
