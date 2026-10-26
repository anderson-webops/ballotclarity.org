import type { StateBallotTablePage } from "../src/state-ballot-pdf-grid.js";
import type { StateCandidateRecord } from "../src/state-ballot-records.js";
import type { StateBallotSource } from "../src/state-ballot-sources.js";
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { readFileSync } from "node:fs";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fetchClarkCandidateCapture, parseClarkCandidateCapture } from "../src/state-ballot-clark-collection.js";
import { clarkDiscoveryUrl, clarkPolicyReceipts, fetchClarkCycleDiscovery, readClarkDiscovery, validateClarkSource } from "../src/state-ballot-clark-discovery.js";
import { syncStateBallotCycles } from "../src/state-ballot-cycle-sync.js";
import { discoverStateBallotElectionCycles, stateBallotCycleSources } from "../src/state-ballot-cycles.js";
import { createStateCandidateRecord } from "../src/state-ballot-records.js";
import { configuredStateBallotSources, legacyReviewedStateBallotSource } from "../src/state-ballot-registry.js";
import { createStateBallotRepository } from "../src/state-ballot-repository.js";
import { createStateBallotStorage } from "../src/state-ballot-storage.js";

const source = configuredStateBallotSources.find(item => item.id === "nv-clark-2026")!;
const fixture = JSON.parse(readFileSync(new URL("./fixtures/nevada-clark-candidate-tables.json", import.meta.url), "utf8")) as Array<{ pages: StateBallotTablePage[]; sha256: string }>;
const previous = (JSON.parse(readFileSync(new URL("./fixtures/nevada-clark-reviewed-records.json", import.meta.url), "utf8")) as { records: StateCandidateRecord[] }).records;
const now = Date.parse("2026-10-26T01:00:00.000Z");
const urls = ["https://www.clarkcountynv.gov/adobe/assets/urn:aaid:aem:1db09a57-4c1b-47e1-94d9-e7782c442571/original/as/officesup-26g.pdf", "https://www.clarkcountynv.gov/adobe/assets/urn:aaid:aem:228bc80b-da3b-42da-bc72-25cce75470d1/original/as/cced-newsletter-fall2026.pdf"];
const main = (body: string) => `<main>${body}</main><footer></footer>`;
function discovery(date = source.electionDate, available = true) {
	const year = date.slice(0, 4);
	const pageUrl = `${clarkDiscoveryUrl}${date.slice(2, 4)}g-info`;
	return JSON.stringify({ schemaVersion: 1, type: "clark-candidate-discovery", policies: clarkPolicyReceipts, index: main(`<h2>Current Interest</h2><p>Election Day is November ${Number(date.slice(-2))}, ${year}</p><a href="${pageUrl}">One-Stop Page for Information about the ${year} General Election</a>${available ? `<a href="${urls[1]}">All Contests and Candidates in the ${year} General Election</a>` : ""}`), page: { url: pageUrl, body: main(`<h2 id="general-election-information-index">${year} General Election Information Index</h2>${available ? `<a href="${urls[0]}">Contests/Candidates in the ${year} General Election</a>` : ""}`) } });
}
function capture(entry = source, body = discovery(entry.electionDate)) {
	return JSON.stringify({ schemaVersion: 1, type: "clark-candidate-capture", discovery: body, documents: urls.map((url, index) => ({ url, sha256: fixture[index]!.sha256, retrievedAt: `${entry.electionDate.slice(0, 4)}-10-25T23:00:00.000Z`, text: JSON.stringify(fixture[index]!.pages).replaceAll("2026", entry.electionDate.slice(0, 4)).replaceAll("November 3", `November ${Number(entry.electionDate.slice(-2))}`) })) });
}

test("Clark County supports a synthetic future presidential layout while requiring both offered rosters", () => {
	const historical = JSON.parse(readFileSync(new URL("./fixtures/nevada-clark-historical-tables.json", import.meta.url), "utf8")) as { documents: Array<{ pages: StateBallotTablePage[] }> };
	const future = stateBallotCycleSources(discoverStateBallotElectionCycles(discovery("2028-11-07"), source.id, now), now)[0]!;
	const value = JSON.parse(capture(future)) as { documents: Array<{ text: string }> };
	for (const document of value.documents) document.text = JSON.stringify(historical.documents[0]!.pages).replaceAll("2024", "2028");
	const records = parseClarkCandidateCapture(future, JSON.stringify(value), createStateCandidateRecord, Date.parse("2028-11-08T00:00:00Z")).records;
	assert.equal(records.length, 195);
	assert.equal(records.filter(record => record.name.includes(" / ")).length, 4);
	assert.ok(records.every(record => /^[a-f\d]{24}$/u.test(record.id) && !previous.some(accepted => accepted.id === record.id)));
	value.documents[1]!.text = JSON.stringify(historical.documents[1]!.pages).replaceAll("2024", "2028");
	assert.throws(() => parseClarkCandidateCapture(future, JSON.stringify(value), createStateCandidateRecord, Date.parse("2028-11-08T00:00:00Z")), /empty/u);
});

test("Clark County binds its offered election and independent documents without guessing future URLs", () => {
	validateClarkSource(source);
	assert.equal(source.retrievalPolicy, undefined);
	assert.equal(source.documentUrls, undefined);
	assert.equal(legacyReviewedStateBallotSource(source)?.retrievalPolicy, "manual-snapshot");
	assert.deepEqual(readClarkDiscovery(discovery()).documents.map(document => document.url), urls);
	const catalog = discoverStateBallotElectionCycles(discovery("2028-11-07"), source.id, now);
	const future = stateBallotCycleSources(catalog, now)[0]!;
	validateClarkSource(future);
	assert.equal(future.id, "nv-clark-general-2028-11-07");
	assert.equal(future.pageUrl, `${clarkDiscoveryUrl}28g-info`);
	assert.equal(readClarkDiscovery(discovery("2028-11-07", false)).documents.length, 0);
});

test("Clark County preserves every acknowledged candidate ID and field while retaining fourteen printed vote limits", () => {
	const parsed = parseClarkCandidateCapture(source, capture(), createStateCandidateRecord, now, previous);
	assert.equal(parsed.records.length, 254);
	for (const record of previous) {
		const actual = parsed.records.find(item => item.id === record.id)!;
		assert.ok(actual, record.name);
		for (const [key, value] of Object.entries(record)) assert.deepEqual(actual[key as keyof StateCandidateRecord], value, `${record.name}/${key}`);
	}
	assert.equal(parsed.records.filter(record => record.voteLimit).length, 14);
	assert.ok(parsed.records.some(record => record.voteLimit === 5));
	assert.deepEqual(parsed.documents.map(document => document.includedRecordCount), [254, 0]);
	const future = stateBallotCycleSources(discoverStateBallotElectionCycles(discovery("2028-11-07"), source.id, now), now)[0]!;
	const first = parseClarkCandidateCapture(future, capture(future), createStateCandidateRecord, Date.parse("2028-10-26T00:00:00.000Z"));
	assert.equal(first.records.length, 254);
	assert.deepEqual(first, parseClarkCandidateCapture(future, capture(future), createStateCandidateRecord, Date.parse("2028-10-26T00:00:00.000Z")));
	assert.ok(first.records.every(record => !previous.some(prior => prior.id === record.id)));
});

test("Clark County rejects incorrect dates, publication identities, policy changes and incomplete evidence", () => {
	for (const changed of [discovery().replaceAll("November 3", "November 4"), discovery().replace("26g-info", "28g-info"), discovery().replace("https://www.clarkcountynv.gov/adobe", "https://example.org/adobe"), discovery().replace("Contests/Candidates", "Candidate data"), discovery().replace("<footer></footer>", "<footer>New terms</footer>")]) {
		assert.throws(() => parseClarkCandidateCapture(source, capture(source, changed), createStateCandidateRecord, now), /Clark County/u);
	}
	for (const mutate of [
		(value: { documents: Array<{ url: string; text: string; retrievedAt: string }> }) => {
			value.documents.pop();
		},
		(value: { documents: Array<{ url: string; text: string; retrievedAt: string }> }) => {
			value.documents[0]!.url = urls[1]!;
		},
		(value: { documents: Array<{ url: string; text: string; retrievedAt: string }> }) => {
			const pages = JSON.parse(value.documents[0]!.text) as StateBallotTablePage[];
			pages[0]!.cells.find(cell => cell.text === "Buck")!.text = "Different";
			value.documents[0]!.text = JSON.stringify(pages);
		},
		(value: { documents: Array<{ url: string; text: string; retrievedAt: string }> }) => {
			value.documents[0]!.retrievedAt = "2029-10-25T00:00:00.000Z";
		},
	]) {
		const value = JSON.parse(capture());
		mutate(value);
		assert.throws(() => parseClarkCandidateCapture(source, JSON.stringify(value), createStateCandidateRecord, now), /Clark County/u);
	}
});

test("Clark County uses paced bounded original-PDF acquisition and stops immediately on a changed policy", async () => {
	const waits: number[] = [];
	const requests: string[] = [];
	const body = await fetchClarkCandidateCapture(source, { discovery: discovery(), now: () => now, wait: async (delay) => {
		waits.push(delay);
	}, requestDocument: async (url, options) => {
		assert.deepEqual(options.allowedHosts, ["www.clarkcountynv.gov"]);
		requests.push(url);
		return { status: 200, body: Buffer.from(`%PDF-${requests.length}`), contentType: "application/pdf", etag: undefined };
	}, extractor: async bytes => fixture[Number(bytes.toString().slice(-1)) - 1]!.pages });
	assert.equal(parseClarkCandidateCapture(source, body, createStateCandidateRecord, now).records.length, 254);
	assert.deepEqual(requests, urls);
	assert.deepEqual(waits, [11000, 11000]);
	let policyRequests = 0;
	await assert.rejects(fetchClarkCycleDiscovery({ requestText: async () => {
		policyRequests++;
		return "User-agent: *\nDisallow: /";
	}, wait: async () => {} }), /policy/u);
	assert.equal(policyRequests, 1);
});

test("Clark County migrates reviewed data durably, preserves its original envelope and reuses cached imports", async () => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-clark-auto-"));
	try {
		const legacy = legacyReviewedStateBallotSource(source)!;
		const documents = urls.map((url, index) => ({ url, sha256: fixture[index]!.sha256, retrievedAt: "2026-10-25T23:00:00.000Z", includedRecordCount: index ? 0 : previous.length }));
		const { createHash } = await import("node:crypto");
		const storage = createStateBallotStorage(directory);
		await storage.write({ source: legacy, records: previous, documents, retrievedAt: documents[0]!.retrievedAt, sha256: createHash("sha256").update(JSON.stringify(documents.map(({ url, sha256 }) => ({ url, sha256 })))).digest("hex") });
		const options = { familyId: source.id, catalogPath: join(directory, "cycles.json"), dataDirectory: directory, now: () => now, fetchDiscovery: async () => discovery(), fetchCandidates: async () => capture() };
		const first = await syncStateBallotCycles(options);
		assert.equal(first.results[0]!.status, "available");
		assert.equal(first.results[0]!.imported, true);
		assert.equal(first.results[0]!.records, 254);
		assert.ok((await readdir(directory)).some(name => name.includes(".legacy-")));
		const accepted = await storage.read(source);
		assert.deepEqual(accepted!.records.map(record => record.id), previous.map(record => record.id));
		const second = await syncStateBallotCycles({ ...options, now: () => now + 1000, fetchCandidates: async () => {
			throw new Error("A cached import must not contact the publisher.");
		} });
		assert.equal(second.results[0]!.status, "available");
		assert.equal(second.results[0]!.imported, false);
		assert.equal(second.results[0]!.retrievedAt, first.results[0]!.retrievedAt);
		const offline = createStateBallotRepository({ sources: [source], dataDirectory: directory, now: () => now + 2000, fetchText: async () => {
			throw new Error("Persisted reads must not need converters or publisher access.");
		} });
		assert.equal((await offline.getSnapshot("NV", source.id))!.records.length, 254);
		const before = await readFile(join(directory, "cycles.json"));
		await assert.rejects(syncStateBallotCycles({ ...options, fetchDiscovery: async () => discovery("2028-11-07") }), /unexpired/u);
		assert.deepEqual(await readFile(join(directory, "cycles.json")), before);
	}
	finally {
		await rm(directory, { recursive: true, force: true });
	}
});

test("Clark County future publications wait without fabricating candidates and import once both offered documents exist", async () => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-clark-future-"));
	try {
		const clock = Date.parse("2028-10-26T00:00:00.000Z");
		const body = discovery("2028-11-07", false);
		const future = stateBallotCycleSources(discoverStateBallotElectionCycles(body, source.id, clock), clock)[0] as StateBallotSource;
		const options = { familyId: source.id, catalogPath: join(directory, "cycles.json"), dataDirectory: directory, now: () => clock, fetchDiscovery: async () => body, fetchCandidates: async () => fetchClarkCandidateCapture(future, { discovery: body }) };
		const pending = await syncStateBallotCycles(options);
		assert.equal(pending.results[0]!.status, "awaiting-records");
		assert.equal(pending.results[0]!.records, 0);
		const available = await syncStateBallotCycles({ ...options, fetchDiscovery: async () => discovery("2028-11-07"), fetchCandidates: async () => capture(future) });
		assert.equal(available.results[0]!.status, "available");
		assert.equal(available.results[0]!.records, 254);
	}
	finally {
		await rm(directory, { recursive: true, force: true });
	}
});
