import type { TestContext } from "node:test";
import type { ElectionDocumentPlan, ElectionDocumentSeed } from "../src/election-document-collection.js";
import type { StateBallotSnapshot } from "../src/state-ballot-repository.js";
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { electionDocumentConfigurationSha256, electionDocumentPolicyFingerprint, electionDocumentRobotsPolicy, seedElectionDocuments } from "../src/election-document-collection.js";
import { electionDocumentSources } from "../src/election-document-sources.js";
import { electionReferenceSources } from "../src/election-reference-sources.js";
import { parseElectionReferenceSnapshot } from "../src/election-references.js";
import { candidateStatementContentSha256, collectCandidateStatementFiles, prepareCandidateStatementFiles } from "../src/prepare-candidate-statements.js";
import { configuredStateBallotSources } from "../src/state-ballot-registry.js";
import { serializeStoredStateSnapshot } from "../src/state-ballot-storage.js";

const epoch = Date.parse("2026-11-01T12:00:00Z");
const hash = (body: string | Uint8Array) => createHash("sha256").update(body).digest("hex");

async function fixture(context: TestContext) {
	const directory = await realpath(await mkdtemp(join(tmpdir(), "candidate-statements-")));
	context.after(() => rm(directory, { recursive: true, force: true }));
	const reference = electionReferenceSources.find(source => source.id === "ga-governor-statements-2026")!;
	const source = configuredStateBallotSources.find(source => source.id === "ga-fulton-2026")!;
	const records = ["Rick Jackson", "Keisha Lance Bottoms"].map(name => ({ id: hash(name).slice(0, 24), name, office: "Governor", district: "", scope: "statewide" as const, status: "listed" as const }));
	const documents = source.documentUrls!.map((url, index) => ({ url, sha256: hash(url), retrievedAt: new Date(epoch).toISOString(), includedRecordCount: index ? 0 : records.length }));
	const snapshot: StateBallotSnapshot = { source, records, documents, retrievedAt: new Date(epoch).toISOString(), sha256: hash(JSON.stringify(documents.map(({ url, sha256 }) => ({ url, sha256 })))) };
	const candidateFile = join(directory, "official.json");
	await writeFile(candidateFile, serializeStoredStateSnapshot(snapshot));
	const collection: ElectionDocumentPlan = { schemaVersion: 1, type: "election-document-collection", sourceIds: ["ga-jackson-campaign-documents-2026", "ga-bottoms-campaign-documents-2026"], cacheDirectory: join(directory, "cache"), outputRoot: join(directory, "collected"), accessReviews: [] };
	const seed: ElectionDocumentSeed = { schemaVersion: 1, type: "election-document-seed", captures: [] };
	const bodies = new Map<string, Buffer>();
	const reviewed = [];
	for (const [index, sourceId] of collection.sourceIds.entries()) {
		const publisher = electionDocumentSources.find(source => source.id === sourceId)!;
		const document = reference.documents[index]!;
		for (const policy of publisher.policies) bodies.set(policy.url, Buffer.from(policy.format === "robots" ? `User-agent: *\nDisallow: /private/\n${publisher.repeatWildcardGroup ? "\nUser-agent: *\nDisallow: /other/\n" : ""}` : `<main class="entry-content">Reviewed privacy and messaging policy with explicit publisher access and usage terms.</main>`));
		bodies.set(publisher.indexUrl, Buffer.from(`<main>${publisher.dateMarkers.join(" ")}<a href="${document.url}">Biography</a></main>`));
		const body = Buffer.from(`<main class="entry-content">${publisher.documentDateMarkers!.join(" ")} Professional background. Further substantive candidate biography.</main>`);
		bodies.set(document.url, body);
		for (const url of [publisher.indexUrl, ...publisher.policies.map(policy => policy.url), document.url]) {
			const path = join(directory, hash(url));
			await writeFile(path, bodies.get(url)!);
			seed.captures.push({ sourceId, url, path, sha256: hash(bodies.get(url)!), capturedAt: new Date(epoch).toISOString(), etag: "\"original\"" });
		}
		const fingerprints = Object.fromEntries(publisher.policies.map(policy => [policy.id, electionDocumentPolicyFingerprint(bodies.get(policy.url)!, policy.format, policy.url, policy.regionId, policy.regionClass)]));
		fingerprints.indexLinks = electionDocumentPolicyFingerprint(bodies.get(publisher.indexUrl)!, "links", publisher.indexUrl);
		fingerprints.documentLinks = electionDocumentPolicyFingerprint(body, "links", document.url);
		collection.accessReviews.push({ sourceId, reviewedAt: new Date(epoch).toISOString(), configurationSha256: electionDocumentConfigurationSha256(publisher), policyFingerprints: fingerprints });
		reviewed.push({ url: document.url, path: join(directory, hash(document.url)), sha256: hash(body), capturedAt: new Date(epoch).toISOString(), contentSha256: candidateStatementContentSha256(body.toString(), document.url, index ? undefined : "entry-content"), ...(index ? {} : { regionClass: "entry-content" }) });
	}
	const review = { schemaVersion: 1, type: "candidate-statement-preparation", sourceId: reference.id, reviewedAt: new Date(epoch).toISOString(), candidateFiles: [candidateFile], documents: reviewed, claims: records.map((record, documentIndex) => ({ officialSourceId: source.id, recordId: record.id, documentIndex, facts: ["Reviewed professional background."] })), outputDirectory: join(directory, "prepared") };
	const reviewPath = join(directory, "review.json");
	const collectionPath = join(directory, "collection.json");
	const save = async () => {
		await writeFile(reviewPath, JSON.stringify(review));
		await writeFile(collectionPath, JSON.stringify(collection));
	};
	await save();
	return { directory, reference, review, collection, seed, bodies, reviewPath, collectionPath, save };
}

test("reviewed statement preparation preserves official identity and exact original evidence", async (context) => {
	const input = await fixture(context);
	const result = await prepareCandidateStatementFiles(input.reviewPath, epoch);
	const snapshot = parseElectionReferenceSnapshot(input.reference, await readFile(join(result.outputDirectory, result.file), "utf8"), epoch);
	assert.equal(result.records, 2);
	assert.equal(result.imported, false);
	assert.equal(result.publisherRequests, 0);
	assert.deepEqual(snapshot.records.map(record => record.name), ["Rick Jackson", "Keisha Lance Bottoms"]);
	assert.equal("party" in snapshot.records[0]!, false);
	assert.equal("incumbent" in snapshot.records[0]!, false);
	assert.equal(snapshot.documents[0]!.sha256, input.review.documents[0]!.sha256);
	await assert.rejects(prepareCandidateStatementFiles(input.reviewPath, epoch), /EEXIST/u);
});

test("changed evidence, unreviewed facts, stale reviews and unknown candidates fail closed", async (context) => {
	const input = await fixture(context);
	const original = structuredClone(input.review);
	for (const mutate of [
		() => { input.review.documents[0]!.sha256 = hash("changed"); },
		() => { input.review.documents[0]!.contentSha256 = hash("changed"); },
		() => { input.review.claims[0]!.recordId = hash("unknown").slice(0, 24); },
		() => { input.review.claims[0]!.facts = ["Unbounded\u0000text"]; },
		() => { input.review.reviewedAt = "2026-09-01T00:00:00Z"; },
	]) {
		Object.assign(input.review, structuredClone(original));
		mutate();
		await input.save();
		await assert.rejects(prepareCandidateStatementFiles(input.reviewPath, epoch));
	}
});

test("seeded repeat and fresh recurrence reuse approved facts without importing", async (context) => {
	const input = await fixture(context);
	await seedElectionDocuments(input.collection, input.seed, epoch);
	const cached = await collectCandidateStatementFiles(input.reviewPath, input.collectionPath, { now: () => epoch + 1000, fetchDocument: async () => assert.fail("Cached repeats must not request publishers.") });
	assert.equal(cached.records, 2);
	assert.equal(cached.publisherRequests, 0);
	let clock = epoch + 86400001;
	const fresh = await collectCandidateStatementFiles(input.reviewPath, input.collectionPath, { now: () => clock, sleep: async (delay) => {
		clock += delay;
	}, fetchDocument: async url => ({ status: 200, body: Buffer.concat([input.bodies.get(url)!, Buffer.from(url.endsWith("robots.txt") ? "" : "<script>changed tracking code</script>")]), contentType: url.endsWith("robots.txt") ? "text/plain" : "text/html", etag: "\"next\"" }) });
	assert.equal(fresh.records, 2);
	assert.equal(fresh.imported, false);
	assert.equal(fresh.publisherRequests, input.seed.captures.length);
	assert.notEqual(fresh.outputDirectory, cached.outputDirectory);
});

test("substantive changes create a persistent no-request review hold and preserve prior output", async (context) => {
	const input = await fixture(context);
	await seedElectionDocuments(input.collection, input.seed, epoch);
	const accepted = await collectCandidateStatementFiles(input.reviewPath, input.collectionPath, { now: () => epoch });
	const original = await readFile(join(accepted.outputDirectory, accepted.file));
	let clock = epoch + 86400001;
	await assert.rejects(collectCandidateStatementFiles(input.reviewPath, input.collectionPath, { now: () => clock, sleep: async (delay) => {
		clock += delay;
	}, fetchDocument: async url => ({ status: 200, body: Buffer.from(input.bodies.get(url)!.toString().replace("Professional background.", "Changed professional background.")), contentType: url.endsWith("robots.txt") ? "text/plain" : "text/html", etag: "\"changed\"" }) }), /content changed/u);
	await assert.rejects(collectCandidateStatementFiles(input.reviewPath, input.collectionPath, { now: () => clock, fetchDocument: async () => assert.fail("Persistent holds must survive a new invocation.") }), /held/u);
	assert.deepEqual(await readFile(join(accepted.outputDirectory, accepted.file)), original);
});

test("missing collectors and expired reviews stop before publisher requests", async (context) => {
	const input = await fixture(context);
	input.collection.sourceIds.pop();
	await input.save();
	await assert.rejects(collectCandidateStatementFiles(input.reviewPath, input.collectionPath, { now: () => epoch, fetchDocument: async () => assert.fail("Invalid source coverage must fail before requesting.") }), /Every reviewed/u);
	await assert.rejects(collectCandidateStatementFiles(input.reviewPath, input.collectionPath, { now: () => epoch + 31 * 86400000, fetchDocument: async () => assert.fail("Expired reviews must not request publishers.") }), /current/u);
});

test("publisher outages retain prepared content and enforce transport cooldown", async (context) => {
	const input = await fixture(context);
	await seedElectionDocuments(input.collection, input.seed, epoch);
	const accepted = await collectCandidateStatementFiles(input.reviewPath, input.collectionPath, { now: () => epoch });
	const original = await readFile(join(accepted.outputDirectory, accepted.file));
	let clock = epoch + 86400001;
	let requests = 0;
	await assert.rejects(collectCandidateStatementFiles(input.reviewPath, input.collectionPath, { now: () => clock, sleep: async (delay) => {
		clock += delay;
	}, fetchDocument: async () => {
		requests++;
		throw new Error("Temporary publisher outage");
	} }), /incomplete/u);
	assert.equal(requests, 2);
	await assert.rejects(collectCandidateStatementFiles(input.reviewPath, input.collectionPath, { now: () => clock, fetchDocument: async () => assert.fail("Transport cooldown must survive a new invocation.") }), /incomplete/u);
	assert.deepEqual(await readFile(join(accepted.outputDirectory, accepted.file)), original);
});

test("reviewed preamble crawl delays preserve all wildcard restrictions", () => {
	const body = Buffer.from("Crawl-delay: 20\nUser-agent: *\nDisallow: /private/\nUser-agent: *\nDisallow: /other/\n");
	assert.throws(() => electionDocumentRobotsPolicy(body, [], [], true), /robots-format-changed/u);
	const policy = electionDocumentRobotsPolicy(body, [], [], true, true);
	assert.equal(policy.delay, 20000);
	assert.equal(policy.allowed("https://rickjackson.com/private/data"), false);
	assert.equal(policy.allowed("https://rickjackson.com/other/data"), false);
	assert.equal(policy.allowed("https://rickjackson.com/about/"), true);
	for (const value of ["bad", "-1", "10000"]) assert.throws(() => electionDocumentRobotsPolicy(Buffer.from(`Crawl-delay: ${value}\nUser-agent: *\nDisallow:\n`), [], [], true, true));
});
