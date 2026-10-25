import type { StateBallotGridPage } from "../src/state-ballot-pdf-grid.js";
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { mkdtemp, readdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fetchConnecticutCandidateCapture, parseConnecticutCandidateCapture } from "../src/state-ballot-connecticut-collection.js";
import { connecticutDiscoveryUrl, connecticutIndexDigest, connecticutPolicyReceipts, fetchConnecticutCycleDiscovery, readConnecticutDiscovery, readConnecticutElectionDiscovery, readConnecticutElectionIndex, validateConnecticutSource } from "../src/state-ballot-connecticut-discovery.js";
import { syncStateBallotCycles } from "../src/state-ballot-cycle-sync.js";
import { discoverStateBallotElectionCycles, parseStateBallotCycleCatalog, stateBallotCycleSources } from "../src/state-ballot-cycles.js";
import { createStateCandidateRecord, parseStateCandidateRecords } from "../src/state-ballot-records.js";
import { configuredStateBallotSources, legacyReviewedStateBallotSource } from "../src/state-ballot-registry.js";
import { createStateBallotRepository } from "../src/state-ballot-repository.js";
import { parseBundledStateSnapshot } from "../src/state-ballot-snapshot.js";
import { stateBallotSources } from "../src/state-ballot-sources.js";
import { createStateBallotStorage, serializeStoredStateSnapshot } from "../src/state-ballot-storage.js";
import { readReviewedStateFixture } from "./helpers/reviewed-state-fixtures.js";

const source = configuredStateBallotSources.find(item => item.id === "ct-sots-2026")!;
const footer = readFileSync(new URL("./fixtures/connecticut-policy-footer.html", import.meta.url), "utf8");
const fixture = JSON.parse(readFileSync(new URL("./fixtures/state-ballots-connecticut.json", import.meta.url), "utf8")) as { documents: Array<{ town: string; url: string; pages: StateBallotGridPage[] }> };
const original = fixture.documents[0]!;
const now = Date.parse("2026-10-25T12:00:00.000Z");
const digest = (body: string) => createHash("sha256").update(body).digest("hex");
const main = (body: string) => `<main id="mainContent">${body}</main>${footer}`;
function discovery(dates = [source.electionDate], documents = [original]) {
	const elections = dates.map(date => ({ electionId: null, electionDate: date, pageUrl: source.pageUrl.replace("2026", date.slice(0, 4)) }));
	return JSON.stringify({ schemaVersion: 1, type: "connecticut-town-discovery", policies: connecticutPolicyReceipts, index: main(`<h1>Ballots</h1>${elections.map(election => `<a href="${election.pageUrl}">November ${Number(election.electionDate.slice(-2))}, ${election.electionDate.slice(0, 4)}, State Election, Sample Town Ballots</a>`).join("")}`), pages: elections.map(election => ({ url: election.pageUrl, body: main(`<h1>November ${Number(election.electionDate.slice(-2))}, ${election.electionDate.slice(0, 4)}</h1><h1>State Election Sample Town Ballots</h1>${documents.map(document => `<a href="${document.url.replace("/2026/", `/${election.electionDate.slice(0, 4)}/`)}">${document.town}</a>`).join("")}`) })) });
}
function capture(entry = source, body = discovery([entry.electionDate])) {
	const documents = readConnecticutDiscovery(body).find(item => item.election.electionDate === entry.electionDate)!.documents;
	return JSON.stringify({ schemaVersion: 1, type: "connecticut-town-candidates", discovery: body, documents: documents.map((document) => {
		const original = fixture.documents.find(item => item.town === document.town)!;
		const text = JSON.stringify(original.pages).replaceAll("November 3, 2026", `November ${Number(entry.electionDate.slice(-2))}, ${entry.electionDate.slice(0, 4)}`);
		return { ...document, text, sha256: digest(text), retrievedAt: `${entry.electionDate.slice(0, 4)}-10-25T12:00:00.000Z` };
	}) });
}

test("Connecticut discovers only explicitly offered elections and keeps reviewed fallback identity", () => {
	validateConnecticutSource(source);
	assert.equal(source.documentUrls, undefined);
	assert.deepEqual(legacyReviewedStateBallotSource(source), stateBallotSources.find(item => item.id === source.id));
	const body = discovery(["2026-11-03", "2030-11-05"]);
	const catalog = discoverStateBallotElectionCycles(body, source.id, now);
	assert.equal(catalog.elections.length, 2);
	const future = stateBallotCycleSources(catalog, now)[0]!;
	assert.equal(future.id, "ct-general-2030-11-05");
	assert.equal(future.documentUrls, undefined);
	validateConnecticutSource(future);
	const records = parseConnecticutCandidateCapture(future, capture(future, body), createStateCandidateRecord, Date.parse("2030-10-25T12:00:00.000Z"));
	assert.ok(records.records.length > 10);
	assert.equal(readConnecticutElectionDiscovery(discovery()).length, 1);
});

test("Connecticut rejects guessed elections, unsafe documents, changed policies and incomplete discovery", () => {
	const body = discovery();
	for (const altered of [body.replace("November 3, 2026", "November 4, 2026"), body.replace("State Election, Sample Town Ballots", "Sample Ballots"), body.replace("https://portal.ct.gov/sots/election-services/town-ballots/2026", "https://example.org/sots/election-services/town-ballots/2026"), body.replace("?rev=", "?token="), body.replace("/2026/", "/2028/"), body.replace("For State Employees", "Employees"), body.replace("\"policies\":[", "\"policies\":[{} ,")]) assert.throws(() => readConnecticutDiscovery(altered));
	const value = JSON.parse(body);
	value.pages = [];
	assert.throws(() => readConnecticutDiscovery(JSON.stringify(value)), /omitted/u);
	value.pages = JSON.parse(body).pages;
	value.pages[0].body = value.pages[0].body.replace(/<a href="[^"]+">Andover<\/a>/u, "");
	assert.deepEqual(readConnecticutElectionDiscovery(JSON.stringify(value)), []);
	assert.throws(() => parseStateBallotCycleCatalog({ ...discoverStateBallotElectionCycles(body, source.id, now), elections: [{ electionId: null, electionDate: "2028-11-07", pageUrl: source.pageUrl }] }, now));
	assert.throws(() => validateConnecticutSource({ ...source, retrievalPolicy: "manual-snapshot" }));
	const index = JSON.parse(body).index;
	assert.throws(() => readConnecticutElectionIndex(index.replace("</main>", `<a href="${source.pageUrl}">November 3, 2026, State Election, Sample Town Ballots</a></main>`)), /repeats/u);
});

test("Connecticut town ordering and index hashes ignore visual ordering but notice added or revised documents", () => {
	const originalOrder = readConnecticutDiscovery(discovery(undefined, fixture.documents.slice(0, 3)))[0]!.documents;
	const reversed = readConnecticutDiscovery(discovery(undefined, fixture.documents.slice(0, 3).reverse()))[0]!.documents;
	assert.deepEqual(originalOrder, reversed);
	assert.equal(connecticutIndexDigest(originalOrder), connecticutIndexDigest(reversed));
	assert.notEqual(connecticutIndexDigest(originalOrder), connecticutIndexDigest(originalOrder.slice(0, 2)));
	const revised = structuredClone(originalOrder);
	revised[0]!.url = revised[0]!.url.replace(/rev=[a-f\d]{32}/u, `rev=${"a".repeat(32)}`);
	assert.notEqual(connecticutIndexDigest(originalOrder), connecticutIndexDigest(revised));
});

test("Connecticut captures complete offered original bytes with paced public requests and verified page geometry", async () => {
	const body = discovery();
	const waits: number[] = [];
	let requests = 0;
	const captured = await fetchConnecticutCandidateCapture(source, { discovery: body, now: () => now, wait: async (delay) => {
		waits.push(delay);
	}, requestDocument: async (url, options) => {
		requests++;
		assert.equal(url, original.url);
		assert.deepEqual(options.allowedHosts, ["portal.ct.gov"]);
		return { status: 200, body: Buffer.from("%PDF-synthetic-test-only"), contentType: "application/pdf", etag: undefined };
	}, extractor: async () => original.pages });
	assert.equal(requests, 1);
	assert.deepEqual(waits, [11000]);
	const result = parseConnecticutCandidateCapture(source, captured, createStateCandidateRecord, now);
	assert.equal(result.documents[0]!.sha256, digest("%PDF-synthetic-test-only"));
	assert.equal(result.documents[0]!.includedRecordCount, result.records.length);
	assert.equal(result.documents[0]!.town, "Andover");
	assert.equal(result.retrievedAt, new Date(now).toISOString());
	assert.deepEqual(parseStateCandidateRecords(source, captured), result.records);
});

test("Connecticut policy changes stop discovery before ballot requests", async () => {
	let requests = 0;
	await assert.rejects(fetchConnecticutCycleDiscovery({ requestText: async (url, options) => {
		requests++;
		assert.equal(url, "https://portal.ct.gov/robots.txt");
		assert.equal(options.maxRedirects, 0);
		return "User-agent: *\nDisallow: /\n";
	}, wait: async () => {} }), /policy requires review/u);
	assert.equal(requests, 1);
});

test("Connecticut rejects missing provenance, future clocks, mismatched dates and changed geometry", () => {
	for (const mutate of [
		(value: ReturnType<typeof JSON.parse>) => { value.documents = []; },
		(value: ReturnType<typeof JSON.parse>) => { value.documents[0].sha256 = "invalid"; },
		(value: ReturnType<typeof JSON.parse>) => { value.documents[0].retrievedAt = "2030-01-01T00:00:00.000Z"; },
		(value: ReturnType<typeof JSON.parse>) => { value.documents[0].town = "Ansonia"; },
		(value: ReturnType<typeof JSON.parse>) => { value.documents[0].text = value.documents[0].text.replace("November 3, 2026", "November 3, 2028"); },
		(value: ReturnType<typeof JSON.parse>) => {
			const pages = JSON.parse(value.documents[0].text);
			pages[0].cells = [];
			value.documents[0].text = JSON.stringify(pages);
		}
	]) {
		const value = JSON.parse(capture());
		mutate(value);
		assert.throws(() => parseConnecticutCandidateCapture(source, JSON.stringify(value), createStateCandidateRecord, now));
	}
});

test("Connecticut persists dynamic town provenance and invalidates fresh caches on an index change", async (context) => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-ct-automatic-test-"));
	context.after(() => rm(directory, { recursive: true, force: true }));
	const storage = createStateBallotStorage(directory);
	const result = parseConnecticutCandidateCapture(source, capture(), createStateCandidateRecord, now);
	await storage.write({ source, ...result });
	assert.deepEqual((await storage.read(source))?.documents, result.documents);
	let requests = 0;
	const read = (collectionIndexSha256: string) => createStateBallotRepository({ sources: [source], dataDirectory: directory, now: () => now + 1000, collectionIndexSha256: { [source.id]: collectionIndexSha256 }, fetchText: async () => {
		requests++;
		return capture();
	} });
	await read(result.collectionIndexSha256).getSnapshot("CT");
	assert.equal(requests, 0);
	const mismatched = await read("a".repeat(64)).getSnapshot("CT");
	assert.equal(mismatched, null);
	assert.equal(requests, 1);
	const serialized = JSON.parse(serializeStoredStateSnapshot({ source, ...result }));
	serialized.collectionIndexSha256 = "b".repeat(64);
	assert.throws(() => parseBundledStateSnapshot(source, JSON.stringify(serialized), "automatic"), /index/u);
});

test("Connecticut refresh preserves exact legacy rollback bytes and keeps ordinary reads converter-free", async (context) => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-ct-legacy-test-"));
	context.after(() => rm(directory, { recursive: true, force: true }));
	const legacy = legacyReviewedStateBallotSource(source)!;
	const old = parseBundledStateSnapshot(legacy, readReviewedStateFixture("connecticut-2026.json"));
	const storage = createStateBallotStorage(directory);
	await storage.write(old);
	const target = join(directory, `${source.id}.json`);
	const originalBytes = await readFile(target, "utf8");
	let requests = 0;
	const reader = createStateBallotRepository({ sources: [source], dataDirectory: directory, now: () => now, fetchText: async () => {
		requests++;
		throw new Error("unexpected publisher request");
	} });
	assert.equal((await reader.getSnapshot("CT"))?.records.length, 709);
	assert.equal(requests, 0);
	const migrated = { source, ...parseConnecticutCandidateCapture(source, capture(), createStateCandidateRecord, now, old.records) };
	await storage.write(migrated);
	const backup = `${target}.legacy-${digest(originalBytes)}`;
	assert.equal(await readFile(backup, "utf8"), originalBytes);
	await storage.write(migrated);
	assert.equal((await readdir(directory)).filter(path => path.includes("legacy-")).length, 1);
	await writeFile(target, originalBytes);
	await rm(backup);
	await symlink(target, backup);
	await assert.rejects(storage.write(migrated));
	assert.equal(await readFile(target, "utf8"), originalBytes);
});

test("Connecticut routine cycle sync records durable imports, idempotent cache reuse and rollback-safe failures", async (context) => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-ct-sync-test-"));
	context.after(() => rm(directory, { recursive: true, force: true }));
	let requests = 0;
	const options = { familyId: source.id, catalogPath: join(directory, "catalog.json"), dataDirectory: join(directory, "snapshots"), now: () => now, fetchDiscovery: async () => discovery(), fetchCandidates: async () => {
		requests++;
		return capture();
	} };
	const imported = await syncStateBallotCycles(options);
	assert.equal(imported.results[0]!.imported, true);
	assert.equal(imported.results[0]!.status, "available");
	const repeated = await syncStateBallotCycles(options);
	assert.equal(requests, 1);
	assert.equal(repeated.results[0]!.imported, false);
	assert.equal(repeated.results[0]!.retrievedAt, imported.results[0]!.retrievedAt);
	const changed = await syncStateBallotCycles({ ...options, fetchDiscovery: async () => discovery(undefined, fixture.documents.slice(0, 2)), fetchCandidates: async () => {
		throw new Error("test failure");
	} });
	assert.equal(changed.results[0]!.status, "unavailable");
	assert.equal(changed.results[0]!.imported, false);
	assert.ok(await createStateBallotStorage(options.dataDirectory).read(source));
	assert.equal(imported.discovery.url, connecticutDiscoveryUrl);
});

test("Connecticut retains identity presentation only for equivalent current names and endorsements", () => {
	const body = capture();
	const first = parseConnecticutCandidateCapture(source, body, createStateCandidateRecord, now);
	const person = first.records.find(record => record.name.includes("."))!;
	assert.ok(person);
	const value = JSON.parse(body);
	value.documents[0].text = value.documents[0].text.replaceAll(person.name, person.name.replaceAll(".", ""));
	const next = parseConnecticutCandidateCapture(source, JSON.stringify(value), createStateCandidateRecord, now, first.records);
	assert.deepEqual(next.records.find(record => record.id === person.id), person);
	const differentParty = first.records.map(record => ({ ...record, party: "Unverified fixture preference" }));
	assert.deepEqual(parseConnecticutCandidateCapture(source, body, createStateCandidateRecord, now, differentParty).records, first.records);
});

test("Connecticut holds disappearing accepted towns instead of silently replacing their records", async (context) => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-ct-missing-town-test-"));
	context.after(() => rm(directory, { recursive: true, force: true }));
	const initialBody = discovery(undefined, fixture.documents.slice(0, 2));
	const initial = { source, ...parseConnecticutCandidateCapture(source, capture(source, initialBody), createStateCandidateRecord, now) };
	const storage = createStateBallotStorage(directory);
	await storage.write(initial);
	const before = await readFile(join(directory, `${source.id}.json`), "utf8");
	const nextBody = discovery();
	const repository = createStateBallotRepository({ sources: [source], dataDirectory: directory, now: () => now + 1000, collectionIndexSha256: { [source.id]: connecticutIndexDigest(readConnecticutDiscovery(nextBody)[0]!.documents) }, fetchText: async () => capture(source, nextBody) });
	assert.equal(await repository.getSnapshot("CT"), null);
	assert.equal(await readFile(join(directory, `${source.id}.json`), "utf8"), before);
	assert.equal((await repository.inspectSources!())[0]!.lastImportAt, null);
});
