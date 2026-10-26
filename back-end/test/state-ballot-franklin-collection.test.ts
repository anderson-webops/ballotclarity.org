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
import { fetchFranklinCandidateCapture, fetchFranklinCycleDiscovery, franklinDiscoveryUrl, franklinPolicyFingerprint, franklinPolicyReceipts, parseFranklinCandidateCapture, readFranklinDiscovery, validateFranklinDocumentUrl } from "../src/state-ballot-franklin-collection.js";
import { createStateCandidateRecord } from "../src/state-ballot-records.js";
import { configuredStateBallotSources, legacyReviewedStateBallotSource } from "../src/state-ballot-registry.js";
import { createStateBallotRepository } from "../src/state-ballot-repository.js";
import { StateBallotAwaitingRecordsError } from "../src/state-ballot-source-state.js";
import { createStateBallotStorage, serializeStoredStateSnapshot } from "../src/state-ballot-storage.js";
import { franklinFixture } from "./helpers/franklin-fixture.js";

const source = configuredStateBallotSources.find(source => source.id === "oh-franklin-2026")!;
const footer = readFileSync(new URL("./fixtures/franklin-policy-footer.html", import.meta.url), "utf8");
const origin = "https://www.vote.franklincountyohio.gov";
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
function fixture(year = 2028, pending = false) {
	const instant = `${year}-10-20T12:00:00.000Z`;
	const page = (url: string, body: string) => ({ url, body, sha256: hash(body), retrievedAt: instant });
	const candidates = year === 2026 ? legacyReviewedStateBallotSource(source)!.documentUrls![0]! : `${origin}/getmedia/11111111-1111-1111-1111-111111111111/${year}-General-Candidate-List-1`;
	const notice = year === 2026 ? legacyReviewedStateBallotSource(source)!.documentUrls![1]! : `${origin}/getmedia/22222222-2222-2222-2222-222222222222/${year}-General-Form-No-120-FWAB-Notice-46-Day`;
	const schedule = `${origin}/getmedia/33333333-3333-3333-3333-333333333333/${year}-GENERAL-SCHEDULE`;
	const pdf = franklinFixture({ year });
	const body = pending ? `<a href="${schedule}">${year} General Election Schedule with Candidate Requirements (PDF)</a>` : `<a href="${candidates}">${year} General Election Candidates (PDF)</a><a href="${notice}">46 Day Notice for Federal Write-in Absentee Ballot (PDF)</a>`;
	const publications = pending ? [{ url: schedule, text: `${year} GENERAL\nELECTION SCHEDULE\nPage 1 of 1\nGeneral Election Day ........November ${year === 2028 ? 7 : 3}, ${year}\nOffice: Mayor (Synthetic Incumbent)`, sha256: "c".repeat(64), retrievedAt: instant }] : [{ url: candidates, text: pdf.candidates, sha256: "a".repeat(64), retrievedAt: instant }, { url: notice, text: pdf.notice, sha256: "b".repeat(64), retrievedAt: instant }];
	return { schemaVersion: 1, type: "franklin-discovery", policies: franklinPolicyReceipts, index: page(franklinDiscoveryUrl, `<main><a href="/election-info/${year}">${year}</a></main>${footer}`), pages: [page(`${origin}/election-info/${year}`, `<main><h1>${year} Election Info</h1><h2>Primary Election</h2><a href="/unrelated">Primary Candidates</a><h2>General Election</h2>${body}<h2>Archives</h2></main>${footer}`)], documents: [publications] };
}
const nowFor = (value: ReturnType<typeof fixture>) => Date.parse(value.index.retrievedAt) + 3600000;
function selected(value: ReturnType<typeof fixture>): StateBallotSource {
	const catalog = discoverStateBallotElectionCycles(JSON.stringify(value), source.id, nowFor(value));
	return value.index.retrievedAt.startsWith("2026-") ? source : stateBallotCycleSources(catalog, nowFor(value))[0]!;
}
async function capture(value: ReturnType<typeof fixture>) {
	return fetchFranklinCandidateCapture(selected(value), { discovery: JSON.stringify(value), now: () => nowFor(value) });
}

test("Franklin's policy fingerprint retains complete legal/footer evidence while normalizing only reviewed opaque contacts", () => {
	assert.equal(franklinPolicyFingerprint(footer), franklinPolicyReceipts[1].sha256);
	assert.equal(franklinPolicyFingerprint(footer.replaceAll("aa".repeat(40), "bb".repeat(40))), franklinPolicyReceipts[1].sha256);
	assert.notEqual(franklinPolicyFingerprint(`${footer}<a href="/terms">New terms</a>`), franklinPolicyReceipts[1].sha256);
	assert.notEqual(franklinPolicyFingerprint(footer.replace("Office Hours", "Changed Office Hours")), franklinPolicyReceipts[1].sha256);
	assert.throws(() => franklinPolicyFingerprint(footer.replaceAll("/cdn-cgi/l/email-protection#", "https://example.org/contact#")), /opaque contact/u);
});

test("Franklin's configured family reads both current and actually published future controls", async () => {
	assert.equal(getStateBallotCycleFamily(source.id).discoveryUrl, franklinDiscoveryUrl);
	assert.equal(source.format, "franklin-pdf");
	assert.equal(source.snapshotStorage, "external");
	assert.equal(legacyReviewedStateBallotSource(source)!.retrievalPolicy, "manual-snapshot");
	const value = fixture();
	const parsed = parseFranklinCandidateCapture(selected(value), await capture(value), createStateCandidateRecord, nowFor(value));
	assert.equal(parsed.records.length, 5);
	assert.equal(parsed.records.filter(row => row.status === "write-in").length, 2);
	assert.deepEqual(parsed.documents.map(document => document.includedRecordCount), [3, 2]);
});

test("Franklin's published future schedule supplies a date but never a candidate roster", async () => {
	const value = fixture(2028, true);
	assert.equal(readFranklinDiscovery(JSON.stringify(value), nowFor(value)).elections[0]!.electionDate, "2028-11-07");
	assert.throws(() => parseFranklinCandidateCapture(selected(value), JSON.stringify({ schemaVersion: 1, type: "franklin-candidate-capture", discovery: value, electionDate: "2028-11-07" }), createStateCandidateRecord, nowFor(value)), StateBallotAwaitingRecordsError);
	const changed = structuredClone(value);
	changed.documents[0]![0]!.text = changed.documents[0]![0]!.text.replace("November 7", "November 6");
	assert.throws(() => readFranklinDiscovery(JSON.stringify(changed), nowFor(changed)), /schedule date|date is invalid/u);
});

test("Franklin's discovery rejects incomplete sets, altered clocks, duplicate dates and wrong election identities", () => {
	const value = fixture();
	for (const changed of [
		{ ...value, pages: [] },
		{ ...value, documents: [[]] },
		{ ...value, documents: [[...value.documents[0]!, value.documents[0]![0]!]] },
		{ ...value, policies: [] },
		{ ...value, index: { ...value.index, retrievedAt: "2030-01-01T00:00:00.000Z" } },
		{ ...value, pages: [{ ...value.pages[0]!, url: `${origin}/election-info/2030` }] }
	]) assert.throws(() => readFranklinDiscovery(JSON.stringify(changed), nowFor(value)));
	const wrong = structuredClone(value);
	wrong.documents[0]![1]!.text = wrong.documents[0]![1]!.text.replace("November", "October");
	assert.throws(() => readFranklinDiscovery(JSON.stringify(wrong), nowFor(value)), /notice date/u);
});

test("Franklin's source URLs cannot redirect collection to another host, path, query or credential", () => {
	const valid = fixture().documents[0]![0]!.url;
	for (const value of [valid.replace(origin, "https://example.org"), `${valid}?download=1`, `${valid}#fragment`, valid.replace("https://", "https://user:password@"), valid.replace("/getmedia/", "/private/")])
		assert.throws(() => validateFranklinDocumentUrl(value));
});

test("Franklin's collector stops on denied, redirected or newly changed robots responses", async () => {
	for (const status of [200, 301, 403, 429, 500]) {
		let textRequests = 0;
		await assert.rejects(fetchFranklinCycleDiscovery({ now: () => nowFor(fixture()), sleep: async () => {}, requestDocument: async () => ({ status, body: Buffer.alloc(0), contentType: "text/plain", etag: undefined }), requestText: async () => {
			textRequests++;
			return "";
		}, extractor: async () => "" }), /robots response/u);
		assert.equal(textRequests, 0);
	}
});

test("Franklin's collector downloads each offered document once and validates the full acquired set", async () => {
	const value = fixture();
	const urls: string[] = [];
	const body = await fetchFranklinCycleDiscovery({ now: () => nowFor(value), sleep: async () => {}, requestDocument: async (url) => {
		urls.push(url);
		return url.endsWith("/robots.txt") ? { status: 404, body: Buffer.alloc(0), contentType: "text/html", etag: undefined } : { status: 200, body: Buffer.from(`%PDF-${url}`), contentType: "application/pdf", etag: undefined };
	}, requestText: async url => url === franklinDiscoveryUrl ? value.index.body : value.pages[0]!.body, extractor: async bytes => value.documents[0]!.find(document => bytes.toString().endsWith(document.url))!.text });
	assert.equal(urls.length, 3);
	assert.equal(new Set(urls).size, urls.length);
	assert.equal(readFranklinDiscovery(body, nowFor(value)).elections[0]!.franklinDocuments.length, 2);
});

test("Franklin's collector stops before document downloads when a new legal control appears", async () => {
	const value = fixture();
	let documentRequests = 0;
	await assert.rejects(fetchFranklinCycleDiscovery({ now: () => nowFor(value), sleep: async () => {}, requestDocument: async () => {
		documentRequests++;
		return { status: 404, body: Buffer.alloc(0), contentType: "text/plain", etag: undefined };
	}, requestText: async () => `${value.index.body}<a href="/privacy">Privacy</a>`, extractor: async () => "" }), /legal inventory/u);
	assert.equal(documentRequests, 1);
});

test("Franklin's reusable synchronization migrates reviewed data with exact recovery and truthful cached clocks", async (context) => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-franklin-migration-"));
	context.after(() => rm(directory, { recursive: true }));
	const value = fixture(2026);
	let clock = nowFor(value);
	let requests = 0;
	const data = parseFranklinCandidateCapture(source, await capture(value), createStateCandidateRecord, clock);
	const legacy = { source: legacyReviewedStateBallotSource(source)!, records: data.records, retrievedAt: data.retrievedAt, sha256: data.sha256, documents: data.documents };
	const storage = createStateBallotStorage(directory);
	await storage.write(legacy);
	const filename = (await readdir(directory))[0]!;
	const original = await readFile(join(directory, filename));
	const options = { familyId: source.id, dataDirectory: directory, catalogPath: join(directory, "cycles.json"), now: () => clock, fetchDiscovery: async () => JSON.stringify(value), fetchCandidates: async (selected: StateBallotSource) => {
		requests++;
		return fetchFranklinCandidateCapture(selected, { discovery: JSON.stringify(value), now: () => clock });
	} };
	const first = await syncStateBallotCycles(options);
	assert.ok(first.results.find(result => result.sourceId === source.id)!.imported);
	const snapshot = await storage.read(source);
	assert.deepEqual(snapshot!.records, JSON.parse(JSON.stringify(data.records)));
	assert.equal(snapshot!.retrievedAt, data.retrievedAt);
	const backup = (await readdir(directory)).find(name => name.startsWith(`${filename}.legacy-`));
	assert.ok(backup);
	assert.ok((await readFile(join(directory, backup))).equals(original));
	clock++;
	const second = await syncStateBallotCycles(options);
	assert.equal(second.results.find(result => result.sourceId === source.id)!.imported, false);
	assert.equal(requests, 1);
	const restarted = createStateBallotRepository({ sources: [source], dataDirectory: directory, now: () => clock, fetchText: async () => {
		throw new Error("Cached reads must not fetch.");
	} });
	assert.equal((await restarted.getSnapshot("OH"))!.retrievedAt, data.retrievedAt);
	assert.equal(serializeStoredStateSnapshot((await storage.read(source))!), serializeStoredStateSnapshot(snapshot!));
	value.documents[0]![0]!.sha256 = "d".repeat(64);
	const refreshed = await syncStateBallotCycles(options);
	assert.equal(refreshed.results.find(result => result.sourceId === source.id)!.imported, true);
	assert.equal(requests, 2);
	assert.equal((await storage.read(source))!.documents![0]!.sha256, "d".repeat(64));
	const acceptedCatalog = await readFile(options.catalogPath);
	value.pages[0]!.body = value.pages[0]!.body.replace(/<a href="[^\u0022]+">2026 General Election Candidates \(PDF\)<\/a>/u, "");
	value.pages[0]!.sha256 = hash(value.pages[0]!.body);
	value.documents[0] = [value.documents[0]![1]!];
	await assert.rejects(syncStateBallotCycles(options), /publications disappeared/u);
	assert.ok((await readFile(options.catalogPath)).equals(acceptedCatalog));
});

test("Franklin's future pending election becomes available when both candidate publications appear", async (context) => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-franklin-pending-"));
	context.after(() => rm(directory, { recursive: true }));
	let value = fixture(2028, true);
	const target = selected(value);
	const options = { familyId: source.id, dataDirectory: directory, catalogPath: join(directory, "cycles.json"), now: () => nowFor(value), fetchDiscovery: async () => JSON.stringify(value) };
	const first = await syncStateBallotCycles(options);
	assert.equal(first.results.find(result => result.sourceId === target.id)!.status, "awaiting-records");
	assert.equal(await createStateBallotStorage(directory).read(target), null);
	value = fixture();
	const second = await syncStateBallotCycles(options);
	assert.equal(second.results.find(result => result.sourceId === target.id)!.status, "available");
	assert.equal(second.results.find(result => result.sourceId === target.id)!.records, 5);
});

test("Franklin's failed legacy backup leaves the accepted envelope and its capture clock intact", async (context) => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-franklin-recovery-"));
	context.after(() => rm(directory, { recursive: true }));
	const value = fixture(2026);
	const body = await capture(value);
	const parsed = parseFranklinCandidateCapture(source, body, createStateCandidateRecord, nowFor(value));
	const storage = createStateBallotStorage(directory);
	await storage.write({ source: legacyReviewedStateBallotSource(source)!, records: parsed.records, retrievedAt: parsed.retrievedAt, sha256: parsed.sha256, documents: parsed.documents });
	const filename = (await readdir(directory))[0]!;
	const original = await readFile(join(directory, filename));
	await writeFile(join(directory, `${filename}.legacy-${hash(original.toString("utf8"))}`), "Owned conflicting backup fixture.");
	let failures = 0;
	const repository = createStateBallotRepository({ sources: [source], dataDirectory: directory, now: () => nowFor(value), refreshReviewedLegacy: true, fetchText: async () => body, onPersistenceError: () => {
		failures++;
	} });
	const retained = await repository.getSnapshot("OH");
	assert.equal(failures, 1);
	assert.equal(retained!.source.retrievalPolicy, "manual-snapshot");
	assert.equal(retained!.retrievedAt, parsed.retrievedAt);
	assert.ok((await readFile(join(directory, filename))).equals(original));
});
