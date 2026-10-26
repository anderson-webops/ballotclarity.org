import type { StateBallotSource } from "../src/state-ballot-sources.js";
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { syncStateBallotCycles } from "../src/state-ballot-cycle-sync.js";
import { discoverStateBallotElectionCycles, getStateBallotCycleFamily, stateBallotCycleSources } from "../src/state-ballot-cycles.js";
import { dcDiscoveryUrl, dcPolicyReceipts, fetchDcCandidateCapture, fetchDcCycleDiscovery, parseDcCandidateCapture, readDcDiscovery, validateDcDocumentUrl } from "../src/state-ballot-dc-collection.js";
import { createStateCandidateRecord } from "../src/state-ballot-records.js";
import { configuredStateBallotSources, legacyReviewedStateBallotSource } from "../src/state-ballot-registry.js";
import { StateBallotAwaitingRecordsError } from "../src/state-ballot-source-state.js";
import { createStateBallotStorage } from "../src/state-ballot-storage.js";
import { dcFixture } from "./helpers/dc-fixture.js";

const source = configuredStateBallotSources.find(item => item.id === "dc-boe-2026")!;
const policy = readFileSync(new URL("./fixtures/dc-policy.html", import.meta.url), "utf8");
const footer = policy.slice(policy.indexOf("<footer>"));
const labels = ["General Election Candidates in Ballot Order", "Advisory Neighborhood Commission (ANC) Candidates in Ballot Order", "List of General Election Write-in Candidates"];
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
function fixture(year = 2026, pending = false) {
	const at = `${year}-10-26T10:00:00.000Z`;
	const pageUrl = `https://dcboe.org/elections/${year}-elections`;
	const urls = year === 2026 ? legacyReviewedStateBallotSource(source)!.documentUrls! : [1, 2, 3].map((number, index) => `https://dcboe.org/getContentAsset/${String(number).repeat(8)}-${String(number).repeat(4)}-${String(number).repeat(4)}-${String(number).repeat(4)}-${String(number).repeat(12)}/55555555-5555-5555-5555-555555555555/${year}-General-${index === 2 ? "Election-WRITE-IN-CANDIDATES" : "CANDIDATES"}-07222028.pdf?language=en`);
	const page = (url: string, body: string) => ({ url, body, sha256: hash(body), retrievedAt: at });
	const text = dcFixture(year);
	const documents = urls.map((url, index) => ({ url, text: text[index]!, sha256: hash(url), retrievedAt: at })).slice(0, pending ? 2 : 3);
	const controls = documents.map((document, index) => `<a href="${document.url}">${labels[index]}</a>`).join("");
	return { schemaVersion: 1, type: "dc-discovery", policies: dcPolicyReceipts, accessibility: page("https://dcboe.org/Accessibility", policy), index: page(dcDiscoveryUrl, `<a href="${pageUrl}">${year} Elections</a>${footer}`), pages: [page(pageUrl, `<div id="main-content"><h2>${year} Elections</h2><p>GENERAL ELECTION - November ${year === 2026 ? "3" : "7"}, ${year}</p>${controls}<p>PRIMARY ELECTION - June 16, ${year}</p><a href="/private">Primary Candidates</a></div>${footer}`)], documents: [documents] };
}
const nowFor = (value: ReturnType<typeof fixture>) => Date.parse(value.index.retrievedAt) + 3600000;
function target(value: ReturnType<typeof fixture>) {
	return value.pages[0]!.url.includes("2026") ? source : stateBallotCycleSources(discoverStateBallotElectionCycles(JSON.stringify(value), source.id, nowFor(value)), nowFor(value))[0]!;
}
async function capture(value: ReturnType<typeof fixture>) {
	return fetchDcCandidateCapture(target(value), { discovery: JSON.stringify(value), now: () => nowFor(value) });
}

test("D.C. reusable discovery preserves its original manual descriptor and citizenship notice", async () => {
	assert.equal(source.format, "dc-pdf");
	assert.equal(source.snapshotStorage, "external");
	assert.equal(source.scopeNotice, "Federal and shadow-delegation contests require U.S. citizenship.");
	assert.equal(legacyReviewedStateBallotSource(source)!.retrievalPolicy, "manual-snapshot");
	assert.equal(getStateBallotCycleFamily(source.id).discoveryUrl, dcDiscoveryUrl);
	const value = fixture();
	assert.equal(parseDcCandidateCapture(source, await capture(value), createStateCandidateRecord, nowFor(value)).records.length, 6);
});

test("D.C. offered future dates remain pending until all three published lists are available", async () => {
	const value = fixture(2028, true);
	const parsed = readDcDiscovery(JSON.stringify(value), nowFor(value));
	assert.equal(parsed.elections[0]!.electionDate, "2028-11-07");
	assert.deepEqual(parsed.elections[0]!.dcDocuments, []);
	assert.throws(() => parseDcCandidateCapture(target(value), JSON.stringify({ schemaVersion: 1, type: "dc-candidate-capture", discovery: value, electionDate: "2028-11-07" }), createStateCandidateRecord, nowFor(value)), StateBallotAwaitingRecordsError);
});

test("D.C. page, linked-policy and source-binding changes fail before import", () => {
	for (const mutate of [
		(value: ReturnType<typeof fixture>) => value.index.body += "<a href='/terms'>New terms</a>",
		(value: ReturnType<typeof fixture>) => value.accessibility.body = value.accessibility.body.replace("Section 508", "Changed policy"),
		(value: ReturnType<typeof fixture>) => value.pages[0]!.body = value.pages[0]!.body.replace("GENERAL ELECTION - November 3, 2026", "GENERAL ELECTION - November 4, 2026"),
		(value: ReturnType<typeof fixture>) => value.documents[0]!.pop(),
		(value: ReturnType<typeof fixture>) => value.documents[0]![0]!.retrievedAt = "2026-10-26T12:00:00.000Z",
		(value: ReturnType<typeof fixture>) => value.pages[0]!.url += "?unreviewed=1"
	]) {
		const value = fixture();
		mutate(value);
		value.index.sha256 = hash(value.index.body);
		value.accessibility.sha256 = hash(value.accessibility.body);
		value.pages[0]!.sha256 = hash(value.pages[0]!.body);
		assert.throws(() => readDcDiscovery(JSON.stringify(value), nowFor(value)));
	}
	for (const url of ["http://dcboe.org/file.pdf", source.pageUrl, "https://example.org/list.pdf", `${source.documentUrls?.[0] ?? "https://dcboe.org/file.pdf"}#page=1`]) assert.throws(() => validateDcDocumentUrl(url));
});

test("D.C. collection is serial, zero-redirect and uses only offered public controls", async () => {
	const value = fixture(2028);
	const requests: string[] = [];
	const sleeps: number[] = [];
	const body = await fetchDcCycleDiscovery({ now: () => nowFor(value), sleep: async (duration) => {
		sleeps.push(duration);
	}, requestText: async (url, options) => {
		assert.equal(options.maxRedirects, 0);
		requests.push(url);
		if (url === dcDiscoveryUrl) return value.index.body;
		if (url === value.accessibility.url) return value.accessibility.body;
		assert.equal(url, value.pages[0]!.url);
		return value.pages[0]!.body;
	}, requestDocument: async (url) => {
		requests.push(url);
		return { status: url.endsWith("/robots.txt") ? 404 : 200, contentType: url.endsWith("/robots.txt") ? "text/html" : "application/pdf", body: url.endsWith("/robots.txt") ? Buffer.alloc(0) : Buffer.from(`%PDF-1.7\n${url}`), etag: undefined };
	}, extractor: async bytes => value.documents[0]!.find(document => bytes.toString().endsWith(document.url))!.text });
	assert.equal(requests.length, 7);
	assert.equal(sleeps.length, 6);
	assert.ok(sleeps.every(duration => duration >= 11000));
	assert.equal(readDcDiscovery(body, nowFor(value)).elections[0]!.dcDocuments.length, 3);
});

test("D.C. denials and changed robots stop before any page or PDF request", async () => {
	for (const status of [200, 301, 403, 429, 500]) {
		let requests = 0;
		await assert.rejects(fetchDcCycleDiscovery({ requestDocument: async () => {
			requests++;
			return { status, contentType: "text/html", body: Buffer.alloc(0), etag: undefined };
		} }), /robots/u);
		assert.equal(requests, 1);
	}
});

test("D.C. reviewed migration retains the exact envelope, clocks, cached reads and changed PDF digests", async (context) => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-dc-migration-"));
	context.after(() => rm(directory, { recursive: true }));
	const value = fixture();
	let clock = nowFor(value);
	const parsed = parseDcCandidateCapture(source, await capture(value), createStateCandidateRecord, clock);
	const storage = createStateBallotStorage(directory);
	await storage.write({ source: legacyReviewedStateBallotSource(source)!, records: parsed.records, retrievedAt: parsed.retrievedAt, sha256: parsed.sha256, documents: parsed.documents });
	const filename = (await readdir(directory))[0]!;
	const original = await readFile(join(directory, filename));
	let requests = 0;
	const options = { familyId: source.id, dataDirectory: directory, catalogPath: join(directory, "cycles.json"), now: () => clock, fetchDiscovery: async () => JSON.stringify(value), fetchCandidates: async (selected: StateBallotSource) => {
		requests++;
		return fetchDcCandidateCapture(selected, { discovery: JSON.stringify(value), now: () => clock });
	} };
	const first = await syncStateBallotCycles(options);
	assert.equal(first.results[0]!.imported, true);
	const backup = (await readdir(directory)).find(name => name.startsWith(`${filename}.legacy-`));
	assert.ok(backup);
	assert.ok((await readFile(join(directory, backup))).equals(original));
	clock++;
	const second = await syncStateBallotCycles(options);
	assert.equal(second.results[0]!.imported, false);
	assert.equal(second.results[0]!.retrievedAt, first.results[0]!.retrievedAt);
	assert.equal(requests, 1);
	value.documents[0]![0]!.sha256 = "c".repeat(64);
	assert.equal((await syncStateBallotCycles(options)).results[0]!.imported, true);
	assert.equal(requests, 2);
	const catalog = await readFile(options.catalogPath);
	value.pages[0]!.body = value.pages[0]!.body.replace(/<a href="[^\u0022]+">List of General Election Write-in Candidates<\/a>/u, "");
	value.pages[0]!.sha256 = hash(value.pages[0]!.body);
	value.documents[0]!.pop();
	await assert.rejects(syncStateBallotCycles(options), /publications disappeared/u);
	assert.ok((await readFile(options.catalogPath)).equals(catalog));
});

test("D.C. future waiting receipt invalidates when the complete publications arrive", async (context) => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-dc-pending-"));
	context.after(() => rm(directory, { recursive: true }));
	let value = fixture(2028, true);
	const selected = target(value);
	const options = { familyId: source.id, dataDirectory: directory, catalogPath: join(directory, "cycles.json"), now: () => nowFor(value), fetchDiscovery: async () => JSON.stringify(value) };
	assert.equal((await syncStateBallotCycles(options)).results.find(result => result.sourceId === selected.id)!.status, "awaiting-records");
	value = fixture(2028);
	assert.equal((await syncStateBallotCycles(options)).results.find(result => result.sourceId === selected.id)!.records, 6);
});

test("D.C. failed backup preserves accepted data and never reports a successful import", async (context) => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-dc-recovery-"));
	context.after(() => rm(directory, { recursive: true }));
	const value = fixture();
	const parsed = parseDcCandidateCapture(source, await capture(value), createStateCandidateRecord, nowFor(value));
	const storage = createStateBallotStorage(directory);
	await storage.write({ source: legacyReviewedStateBallotSource(source)!, records: parsed.records, retrievedAt: parsed.retrievedAt, sha256: parsed.sha256, documents: parsed.documents });
	const filename = (await readdir(directory))[0]!;
	const bytes = await readFile(join(directory, filename));
	await writeFile(join(directory, `${filename}.legacy-${hash(bytes.toString())}`), "Owned conflicting backup fixture.");
	const result = await syncStateBallotCycles({ familyId: source.id, dataDirectory: directory, catalogPath: join(directory, "cycles.json"), now: () => nowFor(value), fetchDiscovery: async () => JSON.stringify(value) });
	assert.equal(result.results[0]!.status, "persistence-failed");
	assert.equal(result.results[0]!.imported, false);
	assert.ok((await readFile(join(directory, filename))).equals(bytes));
});

test("D.C. accepted candidate disappearance requires review, not a smaller replacement", async () => {
	const value = fixture();
	const body = await capture(value);
	const parsed = parseDcCandidateCapture(source, body, createStateCandidateRecord, nowFor(value));
	const prior = { ...parsed.records[0]!, name: "Previously Accepted Candidate" };
	assert.throws(() => parseDcCandidateCapture(source, body, createStateCandidateRecord, nowFor(value), [prior]), /disappeared/u);
});
