import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fetchBucksCandidateCapture, fetchBucksCycleDiscovery, parseBucksCandidateCapture, readBucksDiscovery, validateBucksElection } from "../src/state-ballot-bucks-collection.js";
import { bucksHash, bucksOrigin, readBucksCandidateTables, validateBucksDocumentUrl } from "../src/state-ballot-bucks.js";
import { syncStateBallotCycles } from "../src/state-ballot-cycle-sync.js";
import { discoverStateBallotElectionCycles, stateBallotCycleSources } from "../src/state-ballot-cycles.js";
import { createStateCandidateRecord } from "../src/state-ballot-records.js";
import { configuredStateBallotSources } from "../src/state-ballot-registry.js";
import { createStateBallotRepository } from "../src/state-ballot-repository.js";
import { parseBundledStateSnapshot } from "../src/state-ballot-snapshot.js";
import { createStateBallotStorage, serializeStoredStateSnapshot } from "../src/state-ballot-storage.js";
import { stateRecordDocumentLinks } from "../src/state-records.js";
import { bucksFixture } from "./helpers/bucks-fixture.js";

function pendingBucks(input: ReturnType<typeof bucksFixture>) {
	const capture: Record<string, unknown> = structuredClone(input.capture);
	const index = capture.index as typeof input.capture.index;
	index.body = index.body.replace(/<a href="https:\/\/www\.buckscounty\.gov\/DocumentCenter[^<]+<\/a>/u, "");
	index.sha256 = bucksHash(index.body);
	capture.document = null;
	return JSON.stringify(capture);
}

test("Bucks tables preserve joint tickets, printed parties and exact office boundaries", () => {
	const input = bucksFixture();
	const parsed = readBucksCandidateTables(input.tables);
	assert.equal(parsed.claims.length, 9);
	assert.equal(parsed.namedPeople, 11);
	assert.equal(parsed.jointTickets, 2);
	assert.equal(parsed.offices, 4);
	assert.deepEqual(parsed.claims[0], { name: "Alex Sample / Blair Example", party: "Democratic", office: "Governor / Lieutenant Governor", scope: "statewide", status: "listed" });
	assert.deepEqual(parsed.claims.slice(-3).map(record => record.party), ["Forward Independent", "Independent Party", "Republican"]);
	const snapshot = parseBucksCandidateCapture(input.source, input.body(), createStateCandidateRecord, input.epoch);
	assert.equal(snapshot.records[0]!.ballotDesignation, "Joint ticket");
	assert.equal(snapshot.records.find(record => record.name === "Gray Sample")!.district, "6");
	assert.equal(snapshot.records.every(record => record.status === "listed"), true);
	assert.equal(configuredStateBallotSources.find(source => source.id === "pa-dos-2026")!.retrievalPolicy, "manual-snapshot");
});

test("ambiguous cells, incomplete pages, extra text, unsupported offices and mismatched tickets stop preparation", () => {
	for (const change of [
		(input: ReturnType<typeof bucksFixture>) => {
			input.tables[0]!.cells[6]!.bounds[1] -= 20;
		},
		(input: ReturnType<typeof bucksFixture>) => {
			input.tables[0]!.cells.pop();
		},
		(input: ReturnType<typeof bucksFixture>) => {
			input.tables[0]!.text += " Unassigned";
		},
		(input: ReturnType<typeof bucksFixture>) => {
			input.tables[0]!.number = 2;
		},
		(input: ReturnType<typeof bucksFixture>) => {
			input.tables[0]!.cells[4]!.text = "Unreviewed office";
			input.tables[0]!.cells[4]!.logicalText = "Unreviewed office";
			input.tables[0]!.text = input.tables[0]!.cells.map(cell => cell.text).join(" ");
		},
		(input: ReturnType<typeof bucksFixture>) => {
			input.tables[0]!.cells[9]!.text = "Republican";
			input.tables[0]!.cells[9]!.logicalText = "Republican";
			input.tables[0]!.text = input.tables[0]!.cells.map(cell => cell.text).join(" ");
		}
	]) {
		const input = bucksFixture();
		change(input);
		assert.throws(() => readBucksCandidateTables(input.tables), /requires review/u);
	}
});

test("discovery uses the explicit county notice and offered publication for later elections", () => {
	for (const date of ["2026-11-03", "2028-11-07", "2030-11-05"]) {
		const input = bucksFixture(date);
		const catalog = discoverStateBallotElectionCycles(input.body(), "pa-bucks-2026", input.epoch);
		assert.equal(catalog.elections[0]!.electionDate, date);
		const discovered = stateBallotCycleSources(catalog, input.epoch);
		assert.equal(discovered.length, date === "2026-11-03" ? 0 : 1);
		const sources = date === "2026-11-03" ? [input.source] : discovered;
		assert.equal(sources.length, 1);
		assert.equal(sources[0]!.id, input.source.id);
		assert.equal(sources[0]!.electionDate, date);
		assert.equal(parseBucksCandidateCapture(sources[0]!, input.body(), createStateCandidateRecord, input.epoch).records.length, 9);
	}
});

test("date, policy, canonical identity and document bindings reject substitutions", async () => {
	const input = bucksFixture();
	for (const url of [input.canonicalUrl.replace("www.buckscounty.gov", "example.org"), input.canonicalUrl.replace("27847", "27848"), input.canonicalUrl.replace("bidId=", "bidId=private"), input.canonicalUrl.replace("2026-General", "2028-General"), `${input.canonicalUrl}#private`]) assert.throws(() => validateBucksDocumentUrl(url, "2026-11-03", input.offeredUrl), /requires review/u);
	for (const change of [
		(value: typeof input.capture) => {
			value.document.redirect.status = 302;
		},
		(value: typeof input.capture) => {
			value.document.url = value.document.url.replace("27847", "27848");
		},
		(value: typeof input.capture) => {
			value.notice.body = value.notice.body.replace("November 3 , 2026", "November 7 , 2028");
			value.notice.sha256 = bucksHash(value.notice.body);
		},
		(value: typeof input.capture) => {
			value.index.body += "<a href='/new-terms'>New terms</a>";
			value.index.sha256 = bucksHash(value.index.body);
		},
		(value: typeof input.capture) => {
			value.document.retrievedAt = new Date(input.epoch + 1).toISOString();
		}
	]) {
		const value = structuredClone(input.capture);
		change(value);
		assert.throws(() => readBucksDiscovery(JSON.stringify(value), input.epoch), /requires review/u);
	}
	assert.throws(() => validateBucksElection({ electionId: null, electionDate: "2026-11-03", pageUrl: input.canonicalUrl, bucksContentSha256: "bad" }), /requires review/u);
	await assert.rejects(fetchBucksCandidateCapture({ ...input.source, electionDate: "2028-11-07" }, { discovery: input.body(), now: () => input.epoch }), /requires review/u);
});

test("native acquisition intersects all robot groups and follows only the same-document canonical response", async () => {
	const input = bucksFixture();
	let clock = input.epoch;
	const requests: string[] = [];
	const body = await fetchBucksCycleDiscovery({ now: () => clock, wait: async (delay) => {
		assert(delay >= 20000);
		clock += delay;
	}, requestDocument: async (url, options) => {
		assert.deepEqual(options.allowedHosts, ["www.buckscounty.gov"]);
		requests.push(url);
		const response = input.responses.get(url);
		assert(response);
		return response;
	}, extractTables: async (bytes) => {
		assert.deepEqual(bytes, input.pdf);
		return input.tables;
	} });
	assert.equal(readBucksDiscovery(body, clock).document!.url, input.canonicalUrl);
	assert.equal(requests.length, 7);
	assert.equal(requests.filter(url => url.includes("DocumentCenter")).length, 2);
	assert.equal(parseBucksCandidateCapture(input.source, body, createStateCandidateRecord, clock).records.length, 9);
	for (const denied of [
		{ url: `${bucksOrigin}/robots.txt`, response: { status: 200, body: Buffer.from("User-agent: *\nDisallow: /\n"), contentType: "text/plain", etag: undefined } },
		{ url: input.offeredUrl, response: { status: 301, body: Buffer.alloc(0), location: "https://example.org/verify", contentType: "text/html", etag: undefined } },
		{ url: input.canonicalUrl, response: { status: 403, body: Buffer.from("Denied"), contentType: "text/html", etag: undefined } }
	]) {
		const seen: string[] = [];
		await assert.rejects(fetchBucksCycleDiscovery({ now: () => clock, wait: async (delay) => {
			clock += delay;
		}, requestDocument: async (url) => {
			seen.push(url);
			return url === denied.url ? denied.response : input.responses.get(url)!;
		}, extractTables: async () => input.tables }), /requires review/u);
		assert.equal(seen.at(-1), denied.url);
	}
});

test("stored reads remain offline and refresh failures preserve every accepted record", async (context) => {
	const input = bucksFixture();
	const directory = await mkdtemp(join(tmpdir(), "bucks-records-"));
	context.after(() => rm(directory, { recursive: true, force: true }));
	let body = input.body();
	let calls = 0;
	const repository = createStateBallotRepository({ sources: [input.source], dataDirectory: directory, now: () => input.epoch, collectionIndexSha256: { [input.source.id]: input.capture.document.sha256 }, refreshReviewedLegacy: true, fetchText: async () => {
		calls++;
		return body;
	} });
	const first = await repository.getSnapshot("PA", input.source.id);
	assert.equal(first!.records.length, 9);
	assert.equal(calls, 1);
	const serialized = serializeStoredStateSnapshot(first!);
	const expectedRecords = JSON.parse(JSON.stringify(first!.records));
	assert.equal(parseBundledStateSnapshot(input.source, serialized, "automatic").records.length, 9);
	assert.deepEqual(stateRecordDocumentLinks(input.source, first!), [{ label: "Candidate list", url: input.canonicalUrl }]);
	const restarted = createStateBallotRepository({ sources: [input.source], dataDirectory: directory, now: () => input.epoch, fetchText: async () => assert.fail("Public readers stay offline.") });
	assert.deepEqual((await restarted.getSnapshot("PA", input.source.id))!.records, expectedRecords);
	const beforeFailure = await readFile(join(directory, `${input.source.id}.json`));
	body = "Publisher unavailable";
	const changed = createStateBallotRepository({ sources: [input.source], dataDirectory: directory, now: () => input.epoch + 1000, refreshReviewedLegacy: true, collectionIndexSha256: { [input.source.id]: "b".repeat(64) }, fetchText: async () => body });
	assert.equal(await changed.getSnapshot("PA", input.source.id), null);
	assert.deepEqual(await readFile(join(directory, `${input.source.id}.json`)), beforeFailure);
	assert.deepEqual((await restarted.getSnapshot("PA", input.source.id))!.records, expectedRecords);
});

test("Bucks discovery accepts only equivalent opaque contact rotation and direct offered document identities", () => {
	const input = bucksFixture();
	for (const page of [input.capture.index, input.capture.notice]) {
		page.body = page.body.replace(/email-protection#[a-f\d]+/gu, "email-protection#0123456789abcdef");
		page.sha256 = bucksHash(page.body);
	}
	assert.equal(readBucksDiscovery(input.body(), input.epoch).election.pageUrl, input.canonicalUrl);
	validateBucksDocumentUrl(input.canonicalUrl, input.source.electionDate, input.canonicalUrl);
	assert.throws(() => validateBucksDocumentUrl(` ${input.canonicalUrl}`, input.source.electionDate), /requires review/u);
	input.capture.index.body = input.capture.index.body.replace(input.offeredUrl, input.canonicalUrl);
	input.capture.index.sha256 = bucksHash(input.capture.index.body);
	const direct = { ...input.capture, document: { ...input.capture.document, redirect: null } };
	assert.equal(readBucksDiscovery(JSON.stringify(direct), input.epoch).document!.url, input.canonicalUrl);
	input.capture.index.body += "<a href='/new-policy'>Additional policy</a>";
	input.capture.index.sha256 = bucksHash(input.capture.index.body);
	assert.throws(() => readBucksDiscovery(input.body(), input.epoch), /requires review/u);
});

test("Bucks future pending publication becomes available durably without requiring a governor race", async (context) => {
	const input = bucksFixture("2028-11-07");
	const directory = await mkdtemp(join(tmpdir(), "bucks-future-"));
	context.after(() => rm(directory, { recursive: true, force: true }));
	input.tables[0]!.cells = input.tables[0]!.cells.filter(cell => cell.bounds[1] < 69 || cell.bounds[1] >= 141);
	input.tables[0]!.text = input.tables[0]!.cells.map(cell => cell.text).join(" ");
	assert.equal(readBucksCandidateTables(input.tables).jointTickets, 0);
	const options = { familyId: "pa-bucks-2026", catalogPath: join(directory, "cycles.json"), dataDirectory: join(directory, "snapshots"), now: () => input.epoch };
	assert.equal((await syncStateBallotCycles({ ...options, fetchDiscovery: async () => pendingBucks(input) })).results[0]!.status, "awaiting-records");
	const storage = createStateBallotStorage(options.dataDirectory);
	assert(await storage.readPending(input.source, input.epoch));
	assert.equal(await storage.read(input.source), null);
	const available = await syncStateBallotCycles({ ...options, fetchDiscovery: async () => input.body() });
	assert.equal(available.results[0]!.status, "available");
	assert.equal(available.results[0]!.records, 7);
	assert.equal((await storage.read(input.source))!.retrievedAt, input.capturedAt);
	const restarted = createStateBallotRepository({ sources: [input.source], dataDirectory: options.dataDirectory, now: options.now, fetchText: async () => assert.fail("Restart reads stay offline.") });
	assert.equal((await restarted.getSnapshot("PA", input.source.id))!.records.length, 7);
	const bytes = await readFile(options.catalogPath);
	await assert.rejects(syncStateBallotCycles({ ...options, fetchDiscovery: async () => pendingBucks(input) }), /disappeared/u);
	assert.deepEqual(await readFile(options.catalogPath), bytes);
});

test("Bucks recurring import rejects missing accepted candidates and recovers after publisher failure", async (context) => {
	const input = bucksFixture();
	const directory = await mkdtemp(join(tmpdir(), "bucks-recovery-"));
	context.after(() => rm(directory, { recursive: true, force: true }));
	const options = { familyId: input.source.id, catalogPath: join(directory, "cycles.json"), dataDirectory: join(directory, "snapshots"), now: () => input.epoch, fetchDiscovery: async () => input.body() };
	assert.equal((await syncStateBallotCycles(options)).results[0]!.records, 9);
	const storage = createStateBallotStorage(options.dataDirectory);
	const accepted = await storage.read(input.source);
	assert.equal((await syncStateBallotCycles(options)).catalogChanged, false);
	const bytes = await readFile(join(options.dataDirectory, `${input.source.id}.json`));
	const candidate = input.tables[0]!.cells.find(cell => cell.text === "Kai Sample")!;
	input.tables[0]!.cells = input.tables[0]!.cells.filter(cell => cell.bounds[0] < 619 || cell.bounds[1] !== candidate.bounds[1]);
	input.tables[0]!.text = input.tables[0]!.cells.map(cell => cell.text).join(" ");
	input.capture.document.sha256 = "b".repeat(64);
	assert.equal(readBucksCandidateTables(input.tables).claims.length, 8);
	assert.throws(() => parseBucksCandidateCapture(input.source, input.body(), createStateCandidateRecord, input.epoch, accepted!), /requires review/u);
	assert.equal((await syncStateBallotCycles(options)).results[0]!.status, "unavailable");
	assert.deepEqual(await readFile(join(options.dataDirectory, `${input.source.id}.json`)), bytes);
	await assert.rejects(syncStateBallotCycles({ ...options, fetchDiscovery: async () => {
		throw new Error("HTTP 503 controlled outage");
	} }), /503/u);
	assert.equal((await syncStateBallotCycles({ ...options, fetchDiscovery: async () => bucksFixture().body() })).results[0]!.records, 9);
	assert.deepEqual((await storage.read(input.source))!.records, accepted!.records);
});
