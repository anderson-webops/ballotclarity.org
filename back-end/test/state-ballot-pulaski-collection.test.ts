import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { mkdtemp, readdir, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { syncStateBallotCycles } from "../src/state-ballot-cycle-sync.js";
import { discoverStateBallotElectionCycles, stateBallotCycleSources } from "../src/state-ballot-cycles.js";
import { fetchPulaskiCandidateCapture, fetchPulaskiCycleDiscovery, parsePulaskiCandidateCapture, readPulaskiDiscovery, validatePulaskiDocumentUrl } from "../src/state-ballot-pulaski-collection.js";
import { readPulaskiCandidateNotice } from "../src/state-ballot-pulaski.js";
import { configuredStateBallotSources, legacyReviewedStateBallotSource } from "../src/state-ballot-registry.js";
import { StateBallotAwaitingRecordsError } from "../src/state-ballot-source-state.js";
import { createStateBallotStorage, serializeStoredStateSnapshot } from "../src/state-ballot-storage.js";
import { pulaskiDiscoveryFixture } from "./helpers/pulaski-fixture.js";
import { pulaskiRobotsFixture } from "./helpers/pulaski-policy-fixture.js";

const source = configuredStateBallotSources.find(source => source.id === "ar-pulaski-candidates-2026")!;
const now = Date.parse("2026-10-20T13:00:00.000Z");
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
test("Pulaski future discovery uses actual calendar dates and offered notices, including pending publication", async () => {
	const clock = Date.parse("2028-10-20T13:00:00.000Z");
	const value = pulaskiDiscoveryFixture(2028);
	const catalog = discoverStateBallotElectionCycles(JSON.stringify(value), source.id, clock);
	const [future] = stateBallotCycleSources(catalog, clock);
	assert.equal(future!.id, "ar-pulaski-general-2028-11-07");
	assert.equal(future!.countyName, "Pulaski County");
	const capture = await fetchPulaskiCandidateCapture(future!, { discovery: JSON.stringify(value), now: () => clock });
	assert.equal(parsePulaskiCandidateCapture(future!, capture, clock).records.length, 8);
	const pending = pulaskiDiscoveryFixture(2028, true);
	assert.equal(readPulaskiDiscovery(JSON.stringify(pending), clock).elections[0]!.pulaskiDocuments.length, 1);
	await assert.rejects(async () => parsePulaskiCandidateCapture(future!, await fetchPulaskiCandidateCapture(future!, { discovery: JSON.stringify(pending), now: () => clock }), clock), StateBallotAwaitingRecordsError);
});
test("Pulaski checks all current policies before paced calendar and notice requests", async () => {
	const value = pulaskiDiscoveryFixture();
	const requests: string[] = [];
	const delays: number[] = [];
	const discovery = await fetchPulaskiCycleDiscovery({ now: () => now, sleep: async (delay) => {
		delays.push(delay);
	}, extractor: async (_bytes, kind) => kind === "calendar" ? value.calendar.text : value.notices[0]!.text, requestDocument: async (url) => {
		requests.push(url);
		return { status: 200, contentType: url.endsWith("robots.txt") ? "text/plain" : url.endsWith(".pdf") ? "application/pdf" : "text/html", body: url.endsWith("robots.txt") ? pulaskiRobotsFixture : Buffer.from(url.endsWith(".pdf") ? "%PDF-1.7\nSynthetic publication" : value.index.body), etag: undefined };
	} });
	assert.deepEqual(requests, [`${source.url}robots.txt`, source.url, value.calendar.url, value.notices[0]!.url]);
	assert.deepEqual(delays, [11000, 11000, 11000]);
	assert.equal(readPulaskiDiscovery(discovery, now).elections.length, 1);
});
test("Pulaski policy changes and denied transports stop before election document acquisition", async () => {
	for (const status of [200, 301, 403, 429]) {
		const requests: string[] = [];
		await assert.rejects(fetchPulaskiCycleDiscovery({ sleep: async () => {}, requestDocument: async (url) => {
			requests.push(url);
			return { status, contentType: "text/plain", body: Buffer.from("User-agent: *\nDisallow: /\n"), etag: undefined };
		} }), /Pulaski/u);
		assert.equal(requests.length, 1);
	}
	const changed = pulaskiDiscoveryFixture();
	changed.index.body += "<a href='/terms'>New terms</a>";
	changed.index.sha256 = hash(changed.index.body);
	assert.throws(() => readPulaskiDiscovery(JSON.stringify(changed), now), /legal inventory/u);
});
test("Pulaski rejects mismatched dates, unknown controls, stale provenance and disappearing accepted candidates", async () => {
	for (const mutate of [
		(value: ReturnType<typeof pulaskiDiscoveryFixture>) => value.calendar.text = value.calendar.text.replace("November 3", "November 4"),
		(value: ReturnType<typeof pulaskiDiscoveryFixture>) => value.index.body = value.index.body.replace("Notice of Election 2026 General", "Notice of Election 2028 General"),
		(value: ReturnType<typeof pulaskiDiscoveryFixture>) => value.notices[0]!.url += "?download=1",
		(value: ReturnType<typeof pulaskiDiscoveryFixture>) => value.calendar.retrievedAt = "2030-01-01T00:00:00.000Z"
	]) {
		const value = pulaskiDiscoveryFixture();
		mutate(value);
		value.index.sha256 = hash(value.index.body);
		assert.throws(() => readPulaskiDiscovery(JSON.stringify(value), now), /Pulaski/u);
	}
	for (const url of ["http://votepulaskiar.gov/a.pdf", "https://example.org/a.pdf", `${pulaskiDiscoveryFixture().notices[0]!.url}#page=1`]) assert.throws(() => validatePulaskiDocumentUrl(url, "notice", source.electionDate));
	const value = pulaskiDiscoveryFixture();
	const prior = readPulaskiCandidateNotice(source, value.notices[0]!.text).records;
	value.notices[0]!.text = value.notices[0]!.text.replace(/<word[^>]*>Last Candidate-IND<\/word>/u, "");
	await assert.rejects(async () => parsePulaskiCandidateCapture(source, await fetchPulaskiCandidateCapture(source, { discovery: JSON.stringify(value), now: () => now }), now, prior), /disappeared/u);
});
test("Pulaski durable imports preserve exact legacy recovery, cache clocks and publication holds", async (context) => {
	const directory = await realpath(await mkdtemp(join(tmpdir(), "pulaski-cycle-")));
	context.after(() => rm(directory, { recursive: true, force: true }));
	const value = pulaskiDiscoveryFixture();
	const records = readPulaskiCandidateNotice(source, value.notices[0]!.text).records;
	const legacy = { source: legacyReviewedStateBallotSource(source)!, retrievedAt: value.notices[0]!.retrievedAt, sha256: hash(JSON.stringify([{ url: value.notices[0]!.url, sha256: value.notices[0]!.sha256 }])), records: records.filter(record => record.name !== "Last Candidate"), documents: [{ url: value.notices[0]!.url, sha256: value.notices[0]!.sha256, retrievedAt: value.notices[0]!.retrievedAt, includedRecordCount: records.length - 1 }] };
	const storage = createStateBallotStorage(directory);
	await storage.write(legacy);
	const originalFile = (await readdir(directory)).find(file => file.startsWith(source.id))!;
	const original = await readFile(join(directory, originalFile));
	const options = { familyId: source.id, dataDirectory: directory, catalogPath: join(directory, "cycles.json"), now: () => now, fetchDiscovery: async () => JSON.stringify(value) };
	const first = await syncStateBallotCycles(options);
	assert.equal(first.results[0]!.records, 8);
	assert.equal(first.results[0]!.imported, true);
	const second = await syncStateBallotCycles({ ...options, fetchCandidates: async () => {
		throw new Error("Unchanged imports stay cached");
	} });
	assert.equal(second.results[0]!.imported, false);
	assert.equal(second.results[0]!.retrievedAt, first.results[0]!.retrievedAt);
	const backup = (await readdir(directory)).find(file => file.startsWith(`${originalFile}.legacy-`));
	assert(backup);
	assert.deepEqual(await readFile(join(directory, backup)), original);
	assert.deepEqual((await storage.read(source))!.records, records);
	await assert.rejects(syncStateBallotCycles({ ...options, fetchDiscovery: async () => JSON.stringify(pulaskiDiscoveryFixture(2026, true)) }), /publication disappeared/u);
	assert.equal(JSON.parse(serializeStoredStateSnapshot((await storage.read(source))!)).retrievalPolicy, "automatic");
});

test("Pulaski future elections transition from pending to durable available data without a code/year edit", async (context) => {
	const directory = await realpath(await mkdtemp(join(tmpdir(), "pulaski-future-cycle-")));
	context.after(() => rm(directory, { recursive: true, force: true }));
	let value = pulaskiDiscoveryFixture(2028, true);
	const clock = Date.parse("2028-10-20T13:00:00.000Z");
	const options = { familyId: source.id, dataDirectory: directory, catalogPath: join(directory, "cycles.json"), now: () => clock, fetchDiscovery: async () => JSON.stringify(value) };
	const pending = await syncStateBallotCycles(options);
	assert.equal(pending.results[0]!.status, "awaiting-records");
	value = pulaskiDiscoveryFixture(2028);
	const available = await syncStateBallotCycles(options);
	assert.equal(available.results[0]!.status, "available");
	assert.equal(available.results[0]!.records, 8);
	assert.equal(available.results[0]!.imported, true);
	const cached = await syncStateBallotCycles({ ...options, fetchCandidates: async () => {
		throw new Error("Unchanged future data stays cached");
	} });
	assert.equal(cached.results[0]!.imported, false);
});

test("Pulaski failed legacy backups leave the original accepted envelope untouched", async (context) => {
	const directory = await realpath(await mkdtemp(join(tmpdir(), "pulaski-backup-failure-")));
	context.after(() => rm(directory, { recursive: true, force: true }));
	const value = pulaskiDiscoveryFixture();
	const records = readPulaskiCandidateNotice(source, value.notices[0]!.text).records;
	const legacy = { source: legacyReviewedStateBallotSource(source)!, retrievedAt: value.notices[0]!.retrievedAt, sha256: hash(JSON.stringify([{ url: value.notices[0]!.url, sha256: value.notices[0]!.sha256 }])), records, documents: [{ url: value.notices[0]!.url, sha256: value.notices[0]!.sha256, retrievedAt: value.notices[0]!.retrievedAt, includedRecordCount: records.length }] };
	const storage = createStateBallotStorage(directory);
	await storage.write(legacy);
	const filename = (await readdir(directory)).find(file => file.startsWith(source.id))!;
	const before = await readFile(join(directory, filename), "utf8");
	await writeFile(join(directory, `${filename}.legacy-${hash(before)}`), "Conflicting existing backup");
	const result = await syncStateBallotCycles({ familyId: source.id, dataDirectory: directory, catalogPath: join(directory, "cycles.json"), now: () => now, fetchDiscovery: async () => JSON.stringify(value) });
	assert.equal(result.results[0]!.status, "persistence-failed");
	assert.equal(await readFile(join(directory, filename), "utf8"), before);
	assert.deepEqual((await storage.read(source))!.records, records);
});
