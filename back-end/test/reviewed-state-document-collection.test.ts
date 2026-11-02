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
import { electionDocumentConfigurationSha256, electionDocumentPolicyFingerprint, seedElectionDocuments } from "../src/election-document-collection.js";
import { electionDocumentSources } from "../src/election-document-sources.js";
import { collectReviewedStateDocuments } from "../src/reviewed-state-document-collection.js";
import { createStateCandidateRecord } from "../src/state-ballot-records.js";
import { configuredStateBallotSources } from "../src/state-ballot-registry.js";
import { parseBundledStateSnapshot } from "../src/state-ballot-snapshot.js";
import { serializeStoredStateSnapshot } from "../src/state-ballot-storage.js";

const epoch = Date.parse("2026-11-01T12:00:00Z");
const day = 86400000;
const hash = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");
const source = configuredStateBallotSources.find(source => source.id === "ok-woodward-2026")!;
const publisher = electionDocumentSources.find(source => source.id === "ok-woodward-documents-2026")!;

async function fixture(context: TestContext) {
	const directory = await realpath(await mkdtemp(join(tmpdir(), "reviewed-state-documents-")));
	context.after(() => rm(directory, { recursive: true, force: true }));
	const bodies = new Map<string, Buffer>();
	for (const policy of publisher.policies) bodies.set(policy.url, Buffer.from(policy.format === "robots" ? "User-agent: *\nDisallow: /private/\nCrawl-delay: 10\n" : `<main><div class="card__small_plain">Reviewed public accessibility and publisher terms remain part of this fixture.</div></main><footer>Publisher legal information</footer>`));
	bodies.set(publisher.indexUrl, Buffer.from(`<main>${publisher.dateMarkers.join(" ")}${source.documentUrls!.map(url => `<a href="${url}">Reviewed sample</a>`).join("")}</main><footer>Publisher legal information</footer>`));
	for (const [index, url] of source.documentUrls!.entries()) bodies.set(url, Buffer.from(`%PDF-reviewed-image-${index}`));
	const records = ["Example Candidate", "Other Candidate"].map(name => createStateCandidateRecord(source, { name, office: "FOR GOVERNOR", party: "REPUBLICAN", status: "listed", scope: "statewide", sourceAreaLabel: "Woodward County" })!);
	const documents = source.documentUrls!.map((url, index) => ({ url, sha256: hash(bodies.get(url)!), retrievedAt: new Date(epoch - day).toISOString(), includedRecordCount: index ? 0 : records.length }));
	const snapshot: StateBallotSnapshot = { source, records, documents, retrievedAt: new Date(epoch - day).toISOString(), sha256: hash(JSON.stringify(documents.map(({ url, sha256 }) => ({ url, sha256 })))) };
	const snapshotPath = join(directory, "snapshot.json");
	const original = `${serializeStoredStateSnapshot(snapshot)}\n`;
	await writeFile(snapshotPath, original);
	const review = { schemaVersion: 1, type: "reviewed-state-document-collection", sourceId: source.id, reviewedAt: new Date(epoch).toISOString(), snapshotPath, snapshotSha256: hash(original) };
	const policyFingerprints = Object.fromEntries(publisher.policies.map(policy => [policy.id, electionDocumentPolicyFingerprint(bodies.get(policy.url)!, policy.format, policy.url, policy.regionId, policy.regionClass)]));
	policyFingerprints.indexLinks = electionDocumentPolicyFingerprint(bodies.get(publisher.indexUrl)!, "links", publisher.indexUrl);
	const plan: ElectionDocumentPlan = { schemaVersion: 1, type: "election-document-collection", sourceIds: [publisher.id], cacheDirectory: join(directory, "cache"), outputRoot: join(directory, "output"), accessReviews: [{ sourceId: publisher.id, reviewedAt: new Date(epoch).toISOString(), configurationSha256: electionDocumentConfigurationSha256(publisher), policyFingerprints }] };
	const seed: ElectionDocumentSeed = { schemaVersion: 1, type: "election-document-seed", captures: [] };
	for (const [url, body] of bodies) {
		const path = join(directory, hash(url));
		await writeFile(path, body);
		seed.captures.push({ sourceId: publisher.id, url, path, sha256: hash(body), capturedAt: new Date(epoch).toISOString(), etag: "\"reviewed\"" });
	}
	const reviewPath = join(directory, "review.json");
	const planPath = join(directory, "collection.json");
	const save = async () => {
		await writeFile(reviewPath, JSON.stringify(review));
		await writeFile(planPath, JSON.stringify(plan));
	};
	await save();
	return { directory, bodies, records, snapshot, original, review, reviewPath, plan, planPath, seed, save };
}

test("cached verified scans produce the exact reviewed snapshot without changing capture or import clocks", async (context) => {
	const input = await fixture(context);
	await seedElectionDocuments(input.plan, input.seed, epoch);
	const result = await collectReviewedStateDocuments(input.reviewPath, input.planPath, { now: () => epoch, fetchDocument: async () => assert.fail("Cached evidence must stay local.") });
	assert.equal(result.status, "verified-unchanged");
	assert.equal(result.complete, true);
	assert.equal(result.publisherRequests, 0);
	assert.equal(result.verifiedRecordCount, 2);
	assert.equal(result.originalRetrievedAt, input.snapshot.retrievedAt);
	assert.equal(result.lastPublisherCheckAt, new Date(epoch).toISOString());
	assert.equal(await readFile(result.verifiedSnapshot!.path, "utf8"), input.original);
	assert.equal(await readFile(input.review.snapshotPath, "utf8"), input.original);
	const parsed = parseBundledStateSnapshot(source, await readFile(result.verifiedSnapshot!.path, "utf8"), "manual-snapshot");
	assert.deepEqual(parsed.records, JSON.parse(JSON.stringify(input.records)));
	assert.equal(result.snapshotChanged, false);
	assert.equal(result.imported, false);
	assert.equal(result.published, false);
	assert.equal(result.coverageCompletenessClaimed, false);
	assert.throws(() => parseBundledStateSnapshot(source, JSON.stringify(result)), /configured source/u);
});

test("daily refresh honors conditional requests and distinguishes publisher checks from the old fact capture", async (context) => {
	const input = await fixture(context);
	await seedElectionDocuments(input.plan, input.seed, epoch);
	let clock = epoch + day;
	let requests = 0;
	const result = await collectReviewedStateDocuments(input.reviewPath, input.planPath, {
		now: () => clock,
		sleep: async (delay) => { clock += delay; },
		fetchDocument: async (_url, options) => {
			requests++;
			assert.equal(options.etag, "\"reviewed\"");
			return { status: 304, body: Buffer.alloc(0), contentType: "", etag: "\"reviewed\"" };
		},
	});
	assert.equal(result.status, "verified-unchanged");
	assert.equal(requests, 7);
	assert(Date.parse(result.lastPublisherCheckAt!) > epoch);
	assert.equal(result.originalRetrievedAt, new Date(epoch - day).toISOString());
	assert.equal(await readFile(result.verifiedSnapshot!.path, "utf8"), input.original);
});

test("changed scans queue review instead of publishing OCR guesses or an empty candidate field", async (context) => {
	const input = await fixture(context);
	await seedElectionDocuments(input.plan, input.seed, epoch);
	let clock = epoch + day;
	const result = await collectReviewedStateDocuments(input.reviewPath, input.planPath, {
		now: () => clock,
		sleep: async (delay) => { clock += delay; },
		fetchDocument: async url => ({ status: 200, body: url === source.documentUrls![0] ? Buffer.from("%PDF-new-scanned-candidates") : input.bodies.get(url)!, contentType: url.endsWith(".pdf") ? "application/pdf" : "text/html", etag: undefined }),
	});
	assert.equal(result.status, "review-required");
	assert.equal(result.complete, false);
	assert.equal(result.reviewedRecordCount, 2);
	assert.equal(result.verifiedRecordCount, 0);
	assert.equal(result.verifiedSnapshot, undefined);
	assert.equal(result.lastPublisherCheckAt, undefined);
	assert.equal(result.changedDocuments.length, 1);
	assert.equal(result.changedDocuments[0]!.url, source.documentUrls![0]);
	assert.equal(await readFile(input.review.snapshotPath, "utf8"), input.original);
	const repeated = await collectReviewedStateDocuments(input.reviewPath, input.planPath, { now: () => clock, fetchDocument: async () => assert.fail("A changed-scan review should reuse its cached evidence.") });
	assert.equal(repeated.status, "review-required");
	assert.equal(repeated.publisherRequests, 0);
});

test("publisher denials retain reviewed facts and cannot become an empty successful import", async (context) => {
	const input = await fixture(context);
	await seedElectionDocuments(input.plan, input.seed, epoch);
	let clock = epoch + day;
	const result = await collectReviewedStateDocuments(input.reviewPath, input.planPath, {
		now: () => clock,
		sleep: async (delay) => { clock += delay; },
		fetchDocument: async url => ({ status: url.endsWith(".pdf") ? 403 : 200, body: input.bodies.get(url)!, contentType: "text/html", etag: undefined }),
	});
	assert.equal(result.status, "unavailable");
	assert.equal(result.verifiedSnapshot, undefined);
	assert.equal(result.verifiedRecordCount, 0);
	assert.equal(await readFile(input.review.snapshotPath, "utf8"), input.original);
	const retry = await collectReviewedStateDocuments(input.reviewPath, input.planPath, { now: () => clock, fetchDocument: async () => assert.fail("A publisher hold requires independent review.") });
	assert.equal(retry.status, "unavailable");
	assert.equal(retry.publisherRequests, 0);
});

test("review identity, hashes, clocks and cross-state collectors fail before publisher requests", async (context) => {
	for (const mutate of [
		(input: Awaited<ReturnType<typeof fixture>>) => { input.review.snapshotSha256 = "0".repeat(64); },
		(input: Awaited<ReturnType<typeof fixture>>) => { input.review.sourceId = "ga-fulton-2026"; },
		(input: Awaited<ReturnType<typeof fixture>>) => { input.review.reviewedAt = new Date(epoch + day).toISOString(); },
		(input: Awaited<ReturnType<typeof fixture>>) => { input.review.reviewedAt = new Date(epoch - 31 * day).toISOString(); },
		(input: Awaited<ReturnType<typeof fixture>>) => { input.review.snapshotPath = "relative.json"; },
		(input: Awaited<ReturnType<typeof fixture>>) => { input.plan.sourceIds = ["nd-measure-documents-2026"]; },
		(input: Awaited<ReturnType<typeof fixture>>) => { input.plan.sourceIds.push(publisher.id); },
	]) {
		const input = await fixture(context);
		mutate(input);
		await input.save();
		await assert.rejects(collectReviewedStateDocuments(input.reviewPath, input.planPath, { now: () => epoch, fetchDocument: async () => assert.fail("Invalid reviews must not contact publishers.") }));
	}
});

test("a snapshot changed during collection never produces a verified copy", async (context) => {
	const input = await fixture(context);
	await seedElectionDocuments(input.plan, input.seed, epoch);
	let clock = epoch + day;
	await assert.rejects(collectReviewedStateDocuments(input.reviewPath, input.planPath, {
		now: () => clock,
		sleep: async (delay) => { clock += delay; },
		fetchDocument: async (url) => {
			if (url === source.documentUrls![0]) await writeFile(input.review.snapshotPath, `${input.original}\n`);
			return { status: 304, body: Buffer.alloc(0), contentType: "", etag: "\"reviewed\"" };
		},
	}), /changed during/u);
});
