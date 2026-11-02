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
import { matchingCandidateReferences } from "../src/candidate-reference-matching.js";
import { collectElectionDocuments, discoverElectionDocuments, electionDocumentConfigurationSha256, electionDocumentPolicyFingerprint, electionDocumentPublisherHosts, seedElectionDocuments } from "../src/election-document-collection.js";
import { fultonBakerServiceDocument as publisher, fultonBakerServiceReference as reference } from "../src/fulton-city-biography-sources.js";
import { candidatePdfContentSha256, collectOfficialCandidateBiographyFiles, prepareOfficialCandidateBiographyFiles } from "../src/prepare-candidate-statements.js";
import { configuredStateBallotSources } from "../src/state-ballot-registry.js";
import { serializeStoredStateSnapshot } from "../src/state-ballot-storage.js";

const epoch = Date.parse("2026-11-01T12:00:00Z");
const day = 86400000;
const hash = (body: string | Uint8Array) => createHash("sha256").update(body).digest("hex");
const text = "City of South Fulton. May 10, 2022. The seat was vacated by former Councilmember Mark Baker.\f";
const pdf = Buffer.from("%PDF-reviewed fixture");

async function fixture(context: TestContext) {
	const directory = await realpath(await mkdtemp(join(tmpdir(), "candidate-pdf-")));
	context.after(() => rm(directory, { recursive: true, force: true }));
	const source = configuredStateBallotSources.find(source => source.id === "ga-fulton-2026")!;
	const candidate = { id: "a".repeat(24), name: "Mark Baker", office: "County Commissioner – District 5", district: "5", scope: "local" as const, status: "write-in" as const };
	const candidates: StateBallotSnapshot = { source, records: [candidate], retrievedAt: new Date(epoch).toISOString(), sha256: "", documents: source.documentUrls!.map((url, index) => ({ url, sha256: hash(url), retrievedAt: new Date(epoch).toISOString(), includedRecordCount: index ? 0 : 1 })) };
	candidates.sha256 = hash(JSON.stringify(candidates.documents!.map(({ url, sha256 }) => ({ url, sha256 }))));
	const candidateFile = join(directory, "candidates.json");
	await writeFile(candidateFile, serializeStoredStateSnapshot(candidates));
	const collection: ElectionDocumentPlan = { schemaVersion: 1, type: "election-document-collection", sourceIds: [publisher.id], cacheDirectory: join(directory, "cache"), outputRoot: join(directory, "outputs"), accessReviews: [] };
	const bodies = new Map<string, Buffer>();
	const robots = publisher.robotsLayout!.restrictiveGroups!.map(group => `${group.agents.map(agent => `User-agent: ${agent}`).join("\n")}\nDisallow: ${group.unrelated ? "/" : "/private/"}\nCrawl-delay: 20\n`).join("\n");
	for (const policy of publisher.policies) bodies.set(policy.url, Buffer.from(policy.format === "robots" ? robots : "<main>Government site</main><footer>Publisher legal information</footer>"));
	bodies.set(publisher.indexUrl, pdf);
	const fingerprints = Object.fromEntries(publisher.policies.map(policy => [policy.id, electionDocumentPolicyFingerprint(bodies.get(policy.url)!, policy.format, policy.url)]));
	fingerprints.indexPdf = hash(pdf);
	collection.accessReviews.push({ sourceId: publisher.id, reviewedAt: new Date(epoch).toISOString(), configurationSha256: electionDocumentConfigurationSha256(publisher), policyFingerprints: fingerprints });
	const seed: ElectionDocumentSeed = { schemaVersion: 1, type: "election-document-seed", captures: [] };
	for (const [url, body] of bodies) {
		const path = join(directory, hash(url));
		await writeFile(path, body);
		seed.captures.push({ sourceId: publisher.id, url, path, sha256: hash(body), capturedAt: new Date(epoch).toISOString(), etag: "\"original\"" });
	}
	const review = { schemaVersion: 1, type: "official-biography-preparation", sourceId: reference.id, reviewedAt: new Date(epoch).toISOString(), candidateFiles: [candidateFile], documents: [{ url: publisher.indexUrl, path: join(directory, hash(publisher.indexUrl)), sha256: hash(pdf), capturedAt: new Date(epoch).toISOString(), contentSha256: candidatePdfContentSha256(text, 1) }], claims: [{ officialSourceId: source.id, recordId: candidate.id, documentIndex: 0, facts: ["Former South Fulton District 7 councilmember, according to the city's May 10, 2022 notice."] }], outputDirectory: join(directory, "prepared") };
	const reviewPath = join(directory, "review.json");
	const collectionPath = join(directory, "collection.json");
	const save = async () => {
		await writeFile(reviewPath, JSON.stringify(review));
		await writeFile(collectionPath, JSON.stringify(collection));
	};
	await save();
	const extractor = async (body: Buffer, pages: number) => {
		assert(body.equals(pdf));
		assert.equal(pages, 1);
		return text;
	};
	return { directory, candidates, candidateFile, collection, bodies, seed, review, reviewPath, collectionPath, save, extractor };
}

test("direct PDFs need exact singleton configuration and an explicit binary review", () => {
	assert.deepEqual(discoverElectionDocuments(publisher, pdf), [publisher.indexUrl]);
	assert.deepEqual(electionDocumentPublisherHosts(publisher), [publisher.host]);
	for (const change of [{ dateMarkers: ["2026"] }, { minimumDocuments: undefined }, { maximumDocuments: 2 }, { documentPatterns: ["^/other$"] }, { indexUrl: `${publisher.indexUrl}?download=1` }]) assert.throws(() => electionDocumentPublisherHosts({ ...publisher, ...change }));
	for (const body of [Buffer.from("<main>not a PDF</main>"), Buffer.alloc(0), Buffer.alloc(12 * 1024 * 1024 + 1)]) assert.throws(() => discoverElectionDocuments(publisher, body), /document-format/u);
});

test("cached direct PDFs retain the original capture date without synthetic links or requests", async (context) => {
	const input = await fixture(context);
	assert.equal((await seedElectionDocuments(input.collection, input.seed, epoch)).seeded, 3);
	const result = await collectOfficialCandidateBiographyFiles(input.reviewPath, input.collectionPath, { now: () => epoch, fetchDocument: async () => assert.fail("Cached PDF evidence must stay local.") }, input.extractor);
	assert.equal(result.publisherRequests, 0);
	const snapshot = JSON.parse(await readFile(join(result.outputDirectory, result.file), "utf8"));
	assert.equal(snapshot.retrievedAt, new Date(epoch).toISOString());
	assert.equal(snapshot.records[0].officialCandidate.recordId, input.candidates.records[0]!.id);
	assert.equal(matchingCandidateReferences(input.candidates, input.candidates.records[0]!, [snapshot]).length, 1);
	assert.equal(snapshot.records[0].status, undefined);
	assert.equal(snapshot.records[0].incumbent, undefined);
	assert.equal(result.imported, false);
});

test("PDF reviews cannot silently reuse an HTML index review", async (context) => {
	const input = await fixture(context);
	const fingerprints = input.collection.accessReviews[0]!.policyFingerprints;
	fingerprints.indexLinks = fingerprints.indexPdf!;
	delete fingerprints.indexPdf;
	await assert.rejects(seedElectionDocuments(input.collection, input.seed, epoch), /access review/u);
});

test("changed PDF bytes hold before writing a new accepted capture", async (context) => {
	const input = await fixture(context);
	await seedElectionDocuments(input.collection, input.seed, epoch);
	let clock = epoch + day;
	const visited: string[] = [];
	const result = await collectElectionDocuments(input.collection, {
		now: () => clock,
		sleep: async (delay) => { clock += delay; },
		fetchDocument: async (url) => {
			visited.push(url);
			return { status: 200, body: url === publisher.indexUrl ? Buffer.from("%PDF-changed") : input.bodies.get(url)!, contentType: url === publisher.indexUrl ? "application/pdf" : "text/html", etag: undefined };
		},
	});
	assert.equal(result.complete, false);
	assert.equal(result.observations[0]!.reason, "reviewed-document-changed");
	assert.equal(visited.filter(url => url === publisher.indexUrl).length, 1);
	assert((await readFile(join(input.collection.cacheDirectory, "bodies", hash(pdf)))).equals(pdf));
	const retry = await collectElectionDocuments(input.collection, { now: () => clock, fetchDocument: async () => assert.fail("A publisher hold requires review.") });
	assert.equal(retry.publisherRequests, 0);
});

test("PDF MIME changes and publisher denial preserve accepted evidence", async (context) => {
	for (const status of [200, 301, 403, 429]) {
		const input = await fixture(context);
		await seedElectionDocuments(input.collection, input.seed, epoch);
		let clock = epoch + day;
		const result = await collectElectionDocuments(input.collection, {
			now: () => clock,
			sleep: async (delay) => { clock += delay; },
			fetchDocument: async url => ({ status: url === publisher.indexUrl ? status : 200, body: input.bodies.get(url)!, contentType: "text/html", etag: undefined }),
		});
		assert.equal(result.complete, false);
		assert.equal(result.observations[0]!.reason, status === 200 ? "document-format-changed" : "publisher-denial-or-redirect");
		assert((await readFile(join(input.collection.cacheDirectory, "bodies", hash(pdf)))).equals(pdf));
	}
});

test("PDF preparation rejects changed text, bytes, identity, regions, dates and excess pages", async (context) => {
	const input = await fixture(context);
	const original = await readFile(input.candidateFile, "utf8");
	await assert.rejects(prepareOfficialCandidateBiographyFiles(input.reviewPath, epoch, true, async () => text.replace("Mark Baker", "Other Person")), /content changed/u);
	await assert.rejects(prepareOfficialCandidateBiographyFiles(input.reviewPath, epoch, true, async () => `${text}Second page\f`), /bounds/u);
	await assert.rejects(prepareOfficialCandidateBiographyFiles(input.reviewPath, epoch + 31 * day, true, input.extractor), /review/u);
	const document = input.review.documents[0]!;
	Object.assign(document, { regionId: "main" });
	await input.save();
	await assert.rejects(prepareOfficialCandidateBiographyFiles(input.reviewPath, epoch, true, input.extractor), /bounded official/u);
	delete (document as unknown as { regionId?: string }).regionId;
	input.review.claims[0]!.recordId = "b".repeat(24);
	await input.save();
	await assert.rejects(prepareOfficialCandidateBiographyFiles(input.reviewPath, epoch, true, input.extractor), /identity/u);
	assert.equal(await readFile(input.candidateFile, "utf8"), original);
	await writeFile(document.path, "%PDF-tampered");
	await assert.rejects(prepareOfficialCandidateBiographyFiles(input.reviewPath, epoch, true, input.extractor), /bytes changed/u);
});

test("PDF text fingerprints preserve page boundaries and bound extracted content", () => {
	assert.equal(candidatePdfContentSha256("Some   text\n here\f", 1), candidatePdfContentSha256("Some text here", 1));
	assert.notEqual(candidatePdfContentSha256("One\fTwo", 2), candidatePdfContentSha256("One Two", 2));
	for (const body of ["", "bad\0text", "bad\uFFFDtext", "x".repeat(2 * 1024 * 1024 + 1), "first\fsecond"]) assert.throws(() => candidatePdfContentSha256(body, 1));
	for (const maximum of [0, 26, 1.5, Number.NaN]) assert.throws(() => candidatePdfContentSha256(text, maximum));
});

test("daily direct PDF refresh requests each URL once and preserves original capture dates", async (context) => {
	const input = await fixture(context);
	await seedElectionDocuments(input.collection, input.seed, epoch);
	let clock = epoch + day;
	const visited: string[] = [];
	const result = await collectElectionDocuments(input.collection, {
		now: () => clock,
		sleep: async (delay) => { clock += delay; },
		fetchDocument: async (url, options) => {
			assert.equal(options.etag, "\"original\"");
			visited.push(url);
			return { status: 304, body: Buffer.alloc(0), contentType: "", etag: "\"original\"" };
		},
	});
	assert.equal(result.complete, true);
	assert.equal(result.publisherRequests, 3);
	assert.equal(new Set(visited).size, 3);
	assert.equal(result.observations[0]!.documents![0]!.capturedAt, new Date(epoch).toISOString());
});
