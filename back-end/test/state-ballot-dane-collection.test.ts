import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { mkdtemp, readdir, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { syncStateBallotCycles } from "../src/state-ballot-cycle-sync.js";
import { discoverStateBallotElectionCycles, stateBallotCycleSources } from "../src/state-ballot-cycles.js";
import { danePolicyFingerprint, fetchDaneCandidateCapture, fetchDaneCycleDiscovery, parseDaneCandidateCapture, readDaneDiscovery, validateDaneDocumentUrl } from "../src/state-ballot-dane-collection.js";
import { configuredStateBallotSources, legacyReviewedStateBallotSource } from "../src/state-ballot-registry.js";
import { StateBallotAwaitingRecordsError } from "../src/state-ballot-source-state.js";
import { createStateBallotStorage, serializeStoredStateSnapshot } from "../src/state-ballot-storage.js";
import { daneFixture } from "./helpers/dane-fixture.js";
import { daneRobotsFixture } from "./helpers/dane-policy-fixture.js";

const source = configuredStateBallotSources.find(item => item.id === "wi-town-dane-2026")!;
const hash = (body: string) => createHash("sha256").update(body).digest("hex");
test("Dane reconciles all four offered documents, repeated candidates and the independent notice", () => {
	const fixture = daneFixture();
	const discovery = readDaneDiscovery(JSON.stringify(fixture.discovery), fixture.now);
	const parsed = parseDaneCandidateCapture(source, fixture.capture, fixture.now);
	assert.equal(discovery.elections.length, 1);
	assert.equal(parsed.records.length, 15);
	assert.deepEqual(parsed.documents.map(item => item.includedRecordCount), [15, 0, 0, 0]);
	assert.equal(parsed.retrievedAt, fixture.discovery.documents[0]!.retrievedAt);
	assert.equal(parsed.documents.length, 4);
});
test("Dane policy fingerprints ignore bounded email-protection nonces but retain legal text and links", () => {
	const body = `<main>Privacy terms remain available for public factual collection.</main><footer>Copyright owner <a href="/cdn-cgi/l/email-protection#${"a".repeat(1078)}">Contact</a><a href="/privacy">Privacy</a></footer>`;
	const first = danePolicyFingerprint(Buffer.from(body), "links", "https://townweb.com/privacy-policy/");
	assert.equal(first, danePolicyFingerprint(Buffer.from(body.replace("a".repeat(1078), "b".repeat(1078))), "links", "https://townweb.com/privacy-policy/"));
	for (const changed of [body.replace("Copyright owner", "Copyright owner. Reuse requires permission."), body.replace("href=\"/privacy\"", "href=\"/new-terms\"")]) assert.notEqual(first, danePolicyFingerprint(Buffer.from(changed), "links", "https://townweb.com/privacy-policy/"));
});
test("Dane rejects altered dates, unknown sample controls, extra hosts and stale provenance", () => {
	for (const mutate of [
		(fixture: ReturnType<typeof daneFixture>) => fixture.discovery.articles[0]!.body += "<a href=\"/terms\">New terms</a>",
		(fixture: ReturnType<typeof daneFixture>) => fixture.discovery.documents[0]!.retrievedAt = "2099-01-01T00:00:00.000Z",
		(fixture: ReturnType<typeof daneFixture>) => fixture.discovery.documents[0]!.url += "?download=1",
		(fixture: ReturnType<typeof daneFixture>) => fixture.discovery.news[0]!.body = fixture.discovery.news[0]!.body.replace("November 3, 2026 General", "November 4, 2026 General"),
		(fixture: ReturnType<typeof daneFixture>) => fixture.discovery.articles[0]!.body = fixture.discovery.articles[0]!.body.replaceAll("Sample-Nov-3-Ballot-Lodi", "Sample-Nov-3-Ballot-Unknown")
	]) {
		const fixture = daneFixture();
		mutate(fixture);
		for (const page of [...fixture.discovery.news, ...fixture.discovery.articles]) page.sha256 = hash(page.body);
		assert.throws(() => readDaneDiscovery(JSON.stringify(fixture.discovery), fixture.now));
	}
	for (const url of ["https://private.invalid/file.pdf", "http://cdn.townweb.com/file.pdf", `${daneFixture().discovery.documents[0]!.url}#page=1`]) assert.throws(() => validateDaneDocumentUrl(url, "Lodi", source.electionDate));
});
test("Dane requires shared sample agreement, complete notice reconciliation and preserved accepted identities", () => {
	for (const edit of [
		(fixture: ReturnType<typeof daneFixture>) => fixture.discovery.documents[1]!.text = fixture.discovery.documents[1]!.text.replace(">Avery<", ">Changed<"),
		(fixture: ReturnType<typeof daneFixture>) => fixture.discovery.documents[3]!.text = fixture.discovery.documents[3]!.text.replace(">Quinn<", ">Changed<")
	]) {
		const fixture = daneFixture();
		edit(fixture);
		const body = JSON.stringify({ schemaVersion: 1, type: "dane-candidate-capture", electionDate: source.electionDate, discovery: fixture.discovery });
		assert.throws(() => parseDaneCandidateCapture(source, body, fixture.now), /disagree|differs/u);
	}
	const fixture = daneFixture();
	const prior = parseDaneCandidateCapture(source, fixture.capture, fixture.now).records;
	assert.throws(() => parseDaneCandidateCapture(source, fixture.capture, fixture.now, [{ ...prior[0]!, id: "f".repeat(24) }]), /disappeared/u);
});
test("Dane incomplete publications remain pending instead of publishing a partial candidate list", async () => {
	const fixture = daneFixture("2026-11-03", ["notice"]);
	assert.equal(readDaneDiscovery(JSON.stringify(fixture.discovery), fixture.now).elections[0]!.daneDocuments.length, 3);
	await assert.rejects(async () => parseDaneCandidateCapture(source, await fetchDaneCandidateCapture(source, { discovery: JSON.stringify(fixture.discovery), now: () => fixture.now }), fixture.now), StateBallotAwaitingRecordsError);
});
test("Dane policy denial and unreviewed canonical redirects stop before candidate acquisition", async () => {
	for (const status of [200, 301, 403, 429]) {
		let requests = 0;
		await assert.rejects(fetchDaneCycleDiscovery({ sleep: async () => {}, requestDocument: async () => {
			requests++;
			return { status, body: Buffer.from("User-agent: *\nDisallow: /\n"), contentType: "text/plain", etag: undefined };
		} }));
		assert.equal(requests, 1);
	}
	const fixture = daneFixture();
	const urls: string[] = [];
	const delays: number[] = [];
	await assert.rejects(fetchDaneCycleDiscovery({ now: () => fixture.now, sleep: async (value) => {
		delays.push(value);
	}, requestDocument: async (url) => {
		urls.push(url);
		if (url.endsWith("townofdane.gov/robots.txt")) return { status: 200, body: Buffer.from(daneRobotsFixture), contentType: "text/plain", etag: undefined };
		if (url === fixture.discovery.news[0]!.url) return { status: 200, body: Buffer.from(fixture.discovery.news[0]!.body), contentType: "text/html", etag: undefined };
		return { status: 301, body: Buffer.alloc(0), contentType: "text/html", etag: undefined, location: "https://private.invalid/robots.txt" };
	} }), /canonical robots redirect/u);
	assert.equal(urls.length, 3);
	assert.deepEqual(delays, [11000, 11000]);
	assert.ok(urls.every(url => !url.includes("private.invalid") && !url.endsWith(".pdf")));
});
test("Dane durable imports retain exact reviewed recovery, truthful cache clocks and publication holds", async (context) => {
	const directory = await realpath(await mkdtemp(join(tmpdir(), "dane-cycle-")));
	context.after(() => rm(directory, { recursive: true, force: true }));
	const fixture = daneFixture();
	const parsed = parseDaneCandidateCapture(source, fixture.capture, fixture.now);
	const storage = createStateBallotStorage(directory);
	await storage.write({ ...parsed, source: legacyReviewedStateBallotSource(source)!, collectionIndexSha256: undefined });
	const file = (await readdir(directory)).find(name => name.startsWith(source.id))!;
	const before = await readFile(join(directory, file));
	const options = { familyId: source.id, dataDirectory: directory, catalogPath: join(directory, "cycles.json"), now: () => fixture.now, fetchDiscovery: async () => JSON.stringify(fixture.discovery) };
	const first = await syncStateBallotCycles(options);
	const cached = await syncStateBallotCycles({ ...options, fetchCandidates: async () => {
		throw new Error("Cached data must not request candidates");
	} });
	assert.equal(first.results[0]!.records, 15);
	assert.equal(first.results[0]!.imported, true);
	assert.equal(cached.results[0]!.status, "available");
	assert.equal(cached.results[0]!.imported, false);
	assert.equal(cached.results[0]!.retrievedAt, first.results[0]!.retrievedAt);
	assert.deepEqual((await storage.read(source))!.records, parsed.records);
	const backup = (await readdir(directory)).find(name => name.startsWith(`${file}.legacy-`));
	assert.ok(backup);
	assert.deepEqual(await readFile(join(directory, backup)), before);
	await assert.rejects(syncStateBallotCycles({ ...options, fetchDiscovery: async () => JSON.stringify(daneFixture("2026-11-03", ["notice"]).discovery) }), /publication disappeared/u);
	assert.equal(JSON.parse(serializeStoredStateSnapshot((await storage.read(source))!)).retrievalPolicy, "automatic");
});
test("Dane future publication moves from pending to available and cached using offered dates and links", async (context) => {
	const directory = await realpath(await mkdtemp(join(tmpdir(), "dane-future-")));
	context.after(() => rm(directory, { recursive: true, force: true }));
	let fixture = daneFixture("2030-11-05", ["Lodi", "Waunakee", "Sauk", "notice"]);
	const catalog = discoverStateBallotElectionCycles(JSON.stringify(fixture.discovery), source.id, fixture.now);
	const future = stateBallotCycleSources(catalog, fixture.now)[0]!;
	assert.equal(future.id, "wi-town-dane-general-2030-11-05");
	assert.equal(future.pageUrl, fixture.pageUrl);
	const options = { familyId: source.id, dataDirectory: directory, catalogPath: join(directory, "cycles.json"), now: () => fixture.now, fetchDiscovery: async () => JSON.stringify(fixture.discovery) };
	assert.equal((await syncStateBallotCycles(options)).results[0]!.status, "awaiting-records");
	fixture = daneFixture("2030-11-05");
	const available = await syncStateBallotCycles(options);
	assert.equal(available.results[0]!.records, 15);
	assert.equal(available.results[0]!.status, "available");
	const cached = await syncStateBallotCycles({ ...options, fetchCandidates: async () => {
		throw new Error("Cached future records must persist");
	} });
	assert.equal(cached.results[0]!.status, "available");
	assert.equal(cached.results[0]!.imported, false);
});

test("Dane failed legacy recovery preserves the exact accepted envelope", async (context) => {
	const directory = await realpath(await mkdtemp(join(tmpdir(), "dane-recovery-")));
	context.after(() => rm(directory, { recursive: true, force: true }));
	const fixture = daneFixture();
	const parsed = parseDaneCandidateCapture(source, fixture.capture, fixture.now);
	const storage = createStateBallotStorage(directory);
	await storage.write({ ...parsed, source: legacyReviewedStateBallotSource(source)!, collectionIndexSha256: undefined });
	const filename = (await readdir(directory)).find(name => name.startsWith(source.id))!;
	const original = await readFile(join(directory, filename));
	await writeFile(join(directory, `${filename}.legacy-${createHash("sha256").update(original).digest("hex")}`), "Synthetic conflicting recovery bytes", { flag: "wx" });
	const result = await syncStateBallotCycles({ familyId: source.id, dataDirectory: directory, catalogPath: join(directory, "cycles.json"), now: () => fixture.now, fetchDiscovery: async () => JSON.stringify(fixture.discovery) });
	assert.equal(result.results[0]!.status, "persistence-failed");
	assert.deepEqual(await readFile(join(directory, filename)), original);
});

test("Dane retains an explicitly offered expired election without guessing the next ballot", async (context) => {
	const directory = await realpath(await mkdtemp(join(tmpdir(), "dane-expired-")));
	context.after(() => rm(directory, { recursive: true, force: true }));
	const fixture = daneFixture();
	const now = Date.parse("2026-11-06T12:00:00Z");
	const result = await syncStateBallotCycles({ familyId: source.id, dataDirectory: directory, catalogPath: join(directory, "cycles.json"), now: () => now, fetchDiscovery: async () => JSON.stringify(fixture.discovery), fetchCandidates: async () => {
		throw new Error("An expired election must not request a candidate import");
	} });
	assert.equal(result.results.length, 1);
	assert.equal(result.results[0]!.status, "expired");
	assert.equal(result.results[0]!.records, 0);
});

test("Dane same-URL document changes refresh accepted data within the cache window", async (context) => {
	const directory = await realpath(await mkdtemp(join(tmpdir(), "dane-changed-pdf-")));
	context.after(() => rm(directory, { recursive: true, force: true }));
	const fixture = daneFixture();
	let now = fixture.now;
	const options = { familyId: source.id, dataDirectory: directory, catalogPath: join(directory, "cycles.json"), now: () => now, fetchDiscovery: async () => JSON.stringify(fixture.discovery) };
	const first = await syncStateBallotCycles(options);
	assert.equal(first.results[0]!.records, 15);
	const originalUrls = fixture.discovery.documents.map(item => item.url);
	const extra = "<line xMin=\"115\" xMax=\"190\" yMin=\"649\" yMax=\"658\"><word xMin=\"115\" xMax=\"155\" yMin=\"649\" yMax=\"658\">Additional</word><word xMin=\"160\" xMax=\"190\" yMin=\"649\" yMax=\"658\">Example</word></line><line xMin=\"115\" xMax=\"175\" yMin=\"659\" yMax=\"668\"><word xMin=\"115\" xMax=\"175\" yMin=\"659\" yMax=\"668\">(Independent)</word></line>";
	now += 60000;
	for (const [index, document] of fixture.discovery.documents.entries()) {
		if (index < 3) document.text = document.text.replace("</page>", `${extra}</page>`);
		document.sha256 = hash(document.text);
		document.retrievedAt = new Date(now).toISOString();
	}
	assert.deepEqual(fixture.discovery.documents.map(item => item.url), originalUrls);
	const changed = await syncStateBallotCycles(options);
	assert.equal(changed.results[0]!.status, "available");
	assert.equal(changed.results[0]!.records, 16);
	assert.equal(changed.results[0]!.imported, true);
	assert.equal(changed.results[0]!.retrievedAt, new Date(now).toISOString());
	const cached = await syncStateBallotCycles({ ...options, fetchCandidates: async () => {
		throw new Error("The changed accepted PDFs should now be cached");
	} });
	assert.equal(cached.results[0]!.records, 16);
	assert.equal(cached.results[0]!.imported, false);
});
