import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { discoverStateBallotElectionCycles, getStateBallotCycleFamily, parseStateBallotCycleCatalog, stateBallotCycleSources } from "../src/state-ballot-cycles.js";
import { everettAjaxUrl, everettHash, fetchEverettCandidateCapture, fetchEverettCycleDiscovery, parseEverettCandidateCapture, readEverettDiscovery, validateEverettElection } from "../src/state-ballot-everett-collection.js";
import { everettAutomaticSource, everettIndexUrl, everettSource, validateEverettDocumentUrl } from "../src/state-ballot-everett.js";
import { createStateCandidateRecord } from "../src/state-ballot-records.js";
import { configuredStateBallotSources, legacyReviewedStateBallotSource } from "../src/state-ballot-registry.js";
import { buildStateBallotPreview, createStateBallotRepository } from "../src/state-ballot-repository.js";
import { parseBundledStateSnapshot } from "../src/state-ballot-snapshot.js";
import { createStateBallotStorage, serializeStoredStateSnapshot } from "../src/state-ballot-storage.js";
import { stateRecordDocumentLinks } from "../src/state-records.js";
import { everettCollectionFixture } from "./helpers/everett-collection-fixture.js";

test("Everett automatic configuration retains its reviewed manual predecessor and other Massachusetts holds", () => {
	const source = configuredStateBallotSources.find(source => source.id === "ma-everett-2026")!;
	assert.deepEqual(source, everettAutomaticSource("2026-11-03"));
	assert.deepEqual(legacyReviewedStateBallotSource(source), everettSource("2026-11-03"));
	assert.equal(getStateBallotCycleFamily(source.id).format, "everett-pdf");
	assert(configuredStateBallotSources.filter(source => source.stateCode === "MA" && source.id !== "ma-everett-2026").every(source => source.retrievalPolicy === "manual-snapshot"));
	for (const date of ["2027-11-02", "2026-11-04", "2026-02-30"]) assert.throws(() => everettAutomaticSource(date));
	for (const url of ["https://example.invalid/2026.pdf", "https://cityofeverett.com/wp-content/uploads/2028/09/STATE.pdf", "https://cityofeverett.com/wp-content/uploads/2026/09/STATE.pdf?download=1", "https://cityofeverett.com/wp-content/uploads/2026/09/STATE.pdf#page=1", "https://cityofeverett.com/wp-content/uploads/2026/09/../STATE.pdf"]) assert.throws(() => validateEverettDocumentUrl(url, "2026"));
});

test("Everett captures retain native facts, all styles, tickets, printed parties and future cycle identities", () => {
	for (const date of ["2026-11-03", "2028-11-07", "2030-11-05", "2032-11-02"]) {
		const input = everettCollectionFixture(date);
		const capture = readEverettDiscovery(input.body(), input.epoch, input.catalog);
		assert.equal(capture.elections.length, 1);
		const election = capture.elections[0]!;
		validateEverettElection(election);
		assert.equal(election.electionDate, date);
		const parsed = parseEverettCandidateCapture(input.source, input.body(), createStateCandidateRecord, input.epoch, undefined, input.catalog);
		assert.equal(parsed.records.length, 14);
		assert.equal(parsed.records.filter(record => record.incumbent).length, 1);
		assert.equal(parsed.records.find(record => record.ballotDesignation === "Joint ticket")!.name, "ALPHA AND BETA");
		assert(parsed.records.every(record => record.party === "Independent" && record.status === "listed" && record.voteLimit === 1));
		assert.deepEqual(parsed.documents.map(document => document.includedRecordCount), [12, 1, 1]);
		const family = getStateBallotCycleFamily("ma-everett-2026");
		const catalog = parseStateBallotCycleCatalog({ schemaVersion: 1, type: "state-ballot-cycle-catalog", familyId: family.source.id, sourceConfigurationSha256: everettHash(JSON.stringify(family.source)), discovery: { url: everettIndexUrl, sha256: everettHash(input.body()), retrievedAt: input.capturedAt }, elections: capture.elections }, input.epoch);
		assert.deepEqual(stateBallotCycleSources(catalog, input.epoch), date === "2026-11-03" ? [] : [input.source]);
		assert.equal(parseBundledStateSnapshot(input.source, serializeStoredStateSnapshot({ source: input.source, ...parsed }), "automatic").records.length, 14);
	}
});

test("Everett public acquisition reads the complete offered library with serial pacing and bounded native extraction", async () => {
	const input = everettCollectionFixture("2026-11-03", 101);
	let clock = input.epoch;
	const requests: { url: string; startedAt: number; method: string }[] = [];
	const body = await fetchEverettCycleDiscovery({ now: () => clock, glyphs: input.catalog, wait: async (delay) => {
		assert(delay >= 20000);
		clock += delay;
	}, requestDocument: async (url, options) => {
		assert.deepEqual(options.allowedHosts, ["cityofeverett.com"]);
		assert(options.maxBytes! <= 8 * 1024 * 1024 && options.timeoutMs! <= 25000);
		requests.push({ url, startedAt: clock, method: "GET" });
		if (url.endsWith("/robots.txt")) return { status: 200, body: input.robots, contentType: "text/plain", etag: undefined };
		if (url === everettIndexUrl) return { status: 200, body: Buffer.from(input.capture.index.body), contentType: "text/html", etag: undefined };
		const index = input.urls.indexOf(url);
		assert(index >= 0);
		return { status: 200, body: input.pdfs[index]!, contentType: "application/pdf", etag: undefined };
	}, requestText: async (url, options) => {
		assert(options);
		assert.equal(url, everettAjaxUrl);
		assert.deepEqual(options.allowedHosts, ["cityofeverett.com"]);
		assert.equal(options.maxRedirects, 0);
		const form = new URLSearchParams(options.postBody);
		assert.equal(form.get("action"), "dlp_load_posts");
		assert.equal(form.get("length"), "100");
		assert.equal(form.get("table_id"), "dlp_0123456789abcdef_1");
		requests.push({ url, startedAt: clock, method: "POST" });
		return input.capture.tables[Number(form.get("start")) / 100]!.body;
	}, extract: async (bytes) => {
		const index = input.pdfs.findIndex(pdf => pdf.equals(bytes));
		assert(index >= 0);
		return { xml: input.fixtures[index]!.xml, svg: input.fixtures[index]!.svg };
	} });
	assert.equal(requests.length, 7);
	for (const [index, request] of requests.entries()) {
		if (index) assert(request.startedAt - requests[index - 1]!.startedAt >= 20000);
	}
	assert.equal(readEverettDiscovery(body, clock, input.catalog).elections[0]!.electionDate, "2026-11-03");
	assert.equal(await fetchEverettCandidateCapture(input.source, { discovery: body, now: () => clock, glyphs: input.catalog }), body);
});

for (const label of ["policy", "library heading", "action", "foreign endpoint", "nonce", "table hash", "request binding", "incomplete pagination", "draw", "document order", "foreign document", "document year", "date", "capture clock", "extra fields", "candidate glyphs"] as const) {
	test(`Everett rejects changed ${label}`, () => {
		const input = everettCollectionFixture();
		const capture = input.capture;
		if (label === "policy") capture.index.body += "<a href='/new-terms'>Terms</a>";
		if (label === "library heading") capture.index.body = capture.index.body.replace("Current Election Documents", "Unofficial Election Documents");
		if (label === "action") capture.index.body = capture.index.body.replace("dlp_load_posts", "submit_form");
		if (label === "foreign endpoint") capture.index.body = capture.index.body.replace(everettAjaxUrl, "https://example.invalid/admin-ajax.php");
		if (label === "nonce") capture.index.body = capture.index.body.replace("0123456789", "missing");
		if (label === "table hash") capture.tables[0]!.sha256 = "a".repeat(64);
		if (label === "request binding") capture.tables[0]!.requestBodySha256 = "a".repeat(64);
		if (label === "incomplete pagination") capture.tables[0]!.body = capture.tables[0]!.body.replace("\"recordsTotal\":3", "\"recordsTotal\":4");
		if (label === "draw") capture.tables[0]!.body = capture.tables[0]!.body.replace("\"draw\":1", "\"draw\":2");
		if (label === "document order") capture.documents.reverse();
		if (label === "foreign document") capture.documents[0]!.url = "https://example.invalid/STATE.pdf";
		if (label === "document year") capture.documents[0]!.url = capture.documents[0]!.url.replace("2026", "2028");
		if (label === "date") capture.documents[0]!.xml = capture.documents[0]!.xml.replace("November 3, 2026", "November 7, 2028");
		if (label === "capture clock") capture.documents[0]!.retrievedAt = new Date(input.epoch + 1).toISOString();
		if (label === "extra fields") Object.assign(capture, { approved: true });
		if (label === "candidate glyphs") capture.documents[0]!.xml = capture.documents[0]!.xml.replace("ALICE ONE", "BOBBY ONE");
		capture.index.sha256 = everettHash(capture.index.body);
		if (["incomplete pagination", "draw"].includes(label)) capture.tables[0]!.sha256 = everettHash(capture.tables[0]!.body);
		assert.throws(() => readEverettDiscovery(input.body(), input.epoch, input.catalog));
	});
}

test("Everett recognizes an empty current library without inventing an election date", () => {
	const input = everettCollectionFixture();
	input.capture.tables[0]!.body = JSON.stringify({ draw: 1, recordsTotal: 0, recordsFiltered: 0, data: [] });
	input.capture.tables[0]!.sha256 = everettHash(input.capture.tables[0]!.body);
	input.capture.documents = [];
	assert.deepEqual(readEverettDiscovery(input.body(), input.epoch).elections, []);
	assert.deepEqual(discoverStateBallotElectionCycles(input.body(), input.source.id, input.epoch).elections, []);
});

test("Everett policy checks tolerate copyright-year rotation while retaining changes to terms", () => {
	const input = everettCollectionFixture();
	input.capture.index.body = input.capture.index.body.replace("©2026 City Of Everett", "©2028 City Of Everett");
	input.capture.index.sha256 = everettHash(input.capture.index.body);
	assert.equal(readEverettDiscovery(input.body(), input.epoch, input.catalog).elections.length, 1);
	input.capture.index.body = input.capture.index.body.replace("©2028 City Of Everett", "©2028 City Of Everett. No automated reuse.");
	input.capture.index.sha256 = everettHash(input.capture.index.body);
	assert.throws(() => readEverettDiscovery(input.body(), input.epoch, input.catalog), /policy surface/u);
});

test("Everett stops before reading publisher data on changed robots and respects ordinary TLS or access errors", async () => {
	const input = everettCollectionFixture();
	for (const kind of ["robots", "tls", "forbidden"]) {
		let requests = 0;
		await assert.rejects(fetchEverettCycleDiscovery({ requestDocument: async () => {
			requests++;
			if (kind === "tls") throw new Error("UNABLE_TO_VERIFY_LEAF_SIGNATURE");
			return { status: kind === "forbidden" ? 403 : 200, body: Buffer.from("User-agent: *\nDisallow: /\n"), contentType: "text/plain", etag: undefined };
		}, requestText: async () => assert.fail("Changed policy must stop before public-library retrieval."), extract: async () => input.fixtures[0]! }));
		assert.equal(requests, 1);
	}
});

test("Everett preserves previously accepted candidates and every ballot style", () => {
	const input = everettCollectionFixture();
	const parsed = parseEverettCandidateCapture(input.source, input.body(), createStateCandidateRecord, input.epoch, undefined, input.catalog);
	assert.throws(() => parseEverettCandidateCapture(input.source, input.body(), createStateCandidateRecord, input.epoch, { ...parsed, records: [...parsed.records, { ...parsed.records[0]!, id: "f".repeat(24) }] }, input.catalog), /candidate disappeared/u);
	assert.throws(() => parseEverettCandidateCapture(input.source, input.body(), createStateCandidateRecord, input.epoch, { ...parsed, documents: [...parsed.documents, { url: "https://cityofeverett.com/wp-content/uploads/2026/09/MISSING.pdf" }] }, input.catalog), /style disappeared/u);
	const stored = JSON.parse(serializeStoredStateSnapshot({ source: input.source, ...parsed }));
	stored.collectionIndexSha256 = "a".repeat(64);
	assert.throws(() => parseBundledStateSnapshot(input.source, JSON.stringify(stored), "automatic"), /fingerprint/u);
});

test("Everett persisted snapshots remain available after restart without publisher access or native extraction", async (context) => {
	const input = everettCollectionFixture();
	const directory = await mkdtemp(join(tmpdir(), "everett-offline-"));
	context.after(() => rm(directory, { recursive: true, force: true }));
	const parsed = parseEverettCandidateCapture(input.source, input.body(), createStateCandidateRecord, input.epoch, undefined, input.catalog);
	const storage = createStateBallotStorage(directory);
	await storage.write({ source: input.source, ...parsed });
	const repository = createStateBallotRepository({ sources: [input.source], dataDirectory: directory, now: () => input.epoch, fetchText: async () => assert.fail("Public readers use retained data.") });
	const snapshot = await repository.getSnapshot("MA", input.source.id);
	assert.equal(snapshot!.records.length, 14);
	assert.deepEqual(stateRecordDocumentLinks(input.source, snapshot!), [{ label: "Sample ballots", url: everettIndexUrl }]);
	const preview = buildStateBallotPreview(snapshot!, { districtMatches: [{ id: "congress:7", label: "Congress 7", districtType: "congressional", districtCode: "7", sourceSystem: "Controlled fixture" }] });
	assert.equal(preview!.candidateCount, 7);
	assert(preview!.contests.every(contest => !/General Court/u.test(contest.office ?? "")));
});
