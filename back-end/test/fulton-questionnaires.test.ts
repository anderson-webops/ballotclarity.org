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
import { discoverElectionDocuments, electionDocumentConfigurationSha256, electionDocumentPolicyFingerprint, seedElectionDocuments } from "../src/election-document-collection.js";
import { parseElectionReferenceSnapshot } from "../src/election-references.js";
import { fultonQuestionnaireDocument as publisher, fultonQuestionnaireReference as reference } from "../src/fulton-questionnaire-sources.js";
import { candidatePdfContentSha256, collectCandidateStatementFiles, prepareCandidateStatementFiles, prepareOfficialCandidateBiographyFiles } from "../src/prepare-candidate-statements.js";
import { configuredStateBallotSources } from "../src/state-ballot-registry.js";
import { serializeStoredStateSnapshot } from "../src/state-ballot-storage.js";

const epoch = Date.parse("2026-11-02T12:00:00Z");
const day = 86400000;
const hash = (body: string | Uint8Array) => createHash("sha256").update(body).digest("hex");

async function fixture(context: TestContext) {
	const directory = await realpath(await mkdtemp(join(tmpdir(), "fulton-questionnaires-")));
	context.after(() => rm(directory, { recursive: true, force: true }));
	const source = configuredStateBallotSources.find(source => source.id === "ga-fulton-2026")!;
	const records = reference.documents.map((document, index) => ({ id: (index + 1).toString(16).repeat(24), name: document.candidateName!, office: index < 3 ? "County Commissioner – District 3" : "State Senate District 39", district: index < 3 ? "3" : "39", scope: index < 3 ? "local" as const : "state-senate" as const, status: "listed" as const }));
	const snapshot: StateBallotSnapshot = { source, records, retrievedAt: new Date(epoch).toISOString(), sha256: "", documents: source.documentUrls!.map((url, index) => ({ url, sha256: hash(url), retrievedAt: new Date(epoch).toISOString(), includedRecordCount: index ? 0 : records.length })) };
	snapshot.sha256 = hash(JSON.stringify(snapshot.documents!.map(({ url, sha256 }) => ({ url, sha256 }))));
	const candidateFile = join(directory, "candidates.json");
	await writeFile(candidateFile, serializeStoredStateSnapshot(snapshot));
	const bodies = new Map<string, Buffer>();
	bodies.set(publisher.policies[0]!.url, Buffer.from("User-agent: *\nDisallow:\n"));
	bodies.set(publisher.indexUrl, Buffer.from(`<main>${publisher.dateMarkers.join(" ")}${reference.documents.map(document => `<a href="${document.url}">Questionnaire</a>`).join("")}</main><footer>Copyright Buckhead Council of Neighborhoods</footer>`));
	const seed: ElectionDocumentSeed = { schemaVersion: 1, type: "election-document-seed", captures: [] };
	const documents = [];
	for (const [index, document] of reference.documents.entries()) {
		const body = Buffer.from(`%PDF-${document.candidateName}`);
		bodies.set(document.url, body);
		const path = join(directory, `${index}.pdf`);
		await writeFile(path, body);
		documents.push({ url: document.url, path, sha256: hash(body), capturedAt: new Date(epoch).toISOString(), contentSha256: candidatePdfContentSha256(`${document.candidateName} reviewed policy response.\f`, document.pdfMaximumPages!) });
	}
	for (const [url, body] of bodies) {
		const path = join(directory, hash(url));
		await writeFile(path, body);
		seed.captures.push({ sourceId: publisher.id, url, path, sha256: hash(body), capturedAt: new Date(epoch).toISOString() });
	}
	const policyFingerprints = Object.fromEntries(publisher.policies.map(policy => [policy.id, electionDocumentPolicyFingerprint(bodies.get(policy.url)!, policy.format, policy.url)]));
	policyFingerprints.indexLinks = electionDocumentPolicyFingerprint(bodies.get(publisher.indexUrl)!, "links", publisher.indexUrl);
	const collection: ElectionDocumentPlan = { schemaVersion: 1, type: "election-document-collection", sourceIds: [publisher.id], cacheDirectory: join(directory, "cache"), outputRoot: join(directory, "outputs"), accessReviews: [{ sourceId: publisher.id, reviewedAt: new Date(epoch).toISOString(), configurationSha256: electionDocumentConfigurationSha256(publisher), policyFingerprints }] };
	const review = { schemaVersion: 1, type: "candidate-statement-preparation", sourceId: reference.id, reviewedAt: new Date(epoch).toISOString(), candidateFiles: [candidateFile], documents, claims: records.map((record, documentIndex) => ({ officialSourceId: source.id, recordId: record.id, documentIndex, facts: ["Supports the reviewed policy proposal."] })), outputDirectory: join(directory, "prepared") };
	const reviewPath = join(directory, "review.json");
	const collectionPath = join(directory, "collection.json");
	const save = async () => {
		await writeFile(reviewPath, JSON.stringify(review));
		await writeFile(collectionPath, JSON.stringify(collection));
	};
	await save();
	const extractor = async (body: Buffer, maximumPages: number) => {
		const document = reference.documents.find(document => body.equals(bodies.get(document.url)!));
		assert(document);
		assert.equal(maximumPages, document.pdfMaximumPages);
		return `${document.candidateName} reviewed policy response.\f`;
	};
	return { directory, snapshot, records, bodies, seed, collection, review, reviewPath, collectionPath, candidateFile, save, extractor };
}

test("questionnaire discovery is limited to eight reviewed PDFs and omits the conflicting district", async (context) => {
	const input = await fixture(context);
	assert.deepEqual(discoverElectionDocuments(publisher, input.bodies.get(publisher.indexUrl)!), reference.documents.map(document => document.url).sort());
	assert.equal(reference.documents.length, 8);
	assert(reference.documents.every(document => document.kind === "candidate-statement" && !document.isCampaignWebsite && document.candidateName && document.pdfMaximumPages! <= 3));
	assert(!reference.documents.some(document => document.url.includes("Greg-Miller")));
	assert.throws(() => discoverElectionDocuments(publisher, Buffer.from(`<main>${publisher.dateMarkers.join(" ")}<a href="${reference.documents[0]!.url}">Questionnaire</a></main>`)), /count/u);
});

test("PDF statements retain exact official identities and candidate-provided attribution", async (context) => {
	const input = await fixture(context);
	const original = await readFile(input.candidateFile);
	const result = await prepareCandidateStatementFiles(input.reviewPath, epoch, false, input.extractor);
	const snapshot = parseElectionReferenceSnapshot(reference, await readFile(join(result.outputDirectory, result.file), "utf8"), epoch);
	assert.equal(snapshot.records.length, 8);
	assert.deepEqual(snapshot.records[0]!.officialCandidate, { sourceId: "ga-fulton-2026", recordId: input.records[0]!.id });
	assert.equal(matchingCandidateReferences(input.snapshot, input.records[0]!, [snapshot])[0]?.source.kind, "candidate-statement");
	assert.deepEqual(await readFile(input.candidateFile), original);
	const wrongDocument = structuredClone(snapshot);
	wrongDocument.records[0]!.sourceDocumentIndex = 1;
	assert.throws(() => parseElectionReferenceSnapshot(reference, JSON.stringify(wrongDocument), epoch), /configured name/u);
	input.review.type = "official-biography-preparation";
	await input.save();
	await assert.rejects(prepareOfficialCandidateBiographyFiles(input.reviewPath, epoch, true, input.extractor), /publication kind/u);
});

test("PDF statements reject changed evidence, wrong identities, text regions and expired review", async (context) => {
	const input = await fixture(context);
	await assert.rejects(prepareCandidateStatementFiles(input.reviewPath, epoch, true, async () => "Changed policy response.\f"), /content changed/u);
	await assert.rejects(prepareCandidateStatementFiles(input.reviewPath, epoch + 31 * day, true, input.extractor), /review/u);
	input.review.claims[0]!.recordId = input.records[1]!.id;
	await input.save();
	await assert.rejects(prepareCandidateStatementFiles(input.reviewPath, epoch, true, input.extractor), /configured name/u);
	input.review.claims[0]!.recordId = input.records[0]!.id;
	Object.assign(input.review.documents[0]!, { regionId: "main" });
	await input.save();
	await assert.rejects(prepareCandidateStatementFiles(input.reviewPath, epoch, true, input.extractor), /bounded named/u);
});

test("cached questionnaires refresh without publisher requests and retain durable substantive-change holds", async (context) => {
	const input = await fixture(context);
	await seedElectionDocuments(input.collection, input.seed, epoch);
	const result = await collectCandidateStatementFiles(input.reviewPath, input.collectionPath, { now: () => epoch, fetchDocument: async () => assert.fail("Cached questionnaires stay offline.") }, input.extractor);
	assert.equal(result.records, 8);
	assert.equal(result.publisherRequests, 0);
	const original = await readFile(join(result.outputDirectory, result.file));
	let clock = epoch + day;
	await assert.rejects(collectCandidateStatementFiles(input.reviewPath, input.collectionPath, {
		now: () => clock,
		sleep: async (delay) => {
			clock += delay;
		},
		fetchDocument: async url => ({ status: 200, body: url.endsWith(".pdf") ? Buffer.concat([input.bodies.get(url)!, Buffer.from(" changed")]) : input.bodies.get(url)!, contentType: url.endsWith(".pdf") ? "application/pdf" : url.endsWith("robots.txt") ? "text/plain" : "text/html", etag: undefined })
	}, async (body, pages) => body.toString().endsWith(" changed") ? "A substantively different response.\f" : input.extractor(body, pages)), /content changed/u);
	await assert.rejects(collectCandidateStatementFiles(input.reviewPath, input.collectionPath, { now: () => clock, fetchDocument: async () => assert.fail("A durable hold requires review.") }, input.extractor), /held/u);
	assert.deepEqual(await readFile(join(result.outputDirectory, result.file)), original);
});
