import type { ElectionDocumentPlan } from "./election-document-collection.js";
import { createHash, randomUUID } from "node:crypto";
import { realpath, writeFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import { collectElectionDocuments } from "./election-document-collection.js";
import { electionDocumentSources } from "./election-document-sources.js";
import { configuredStateBallotSources } from "./state-ballot-registry.js";
import { parseBundledStateSnapshot } from "./state-ballot-snapshot.js";
import { assertExternalStateDataDirectory, readBoundedStateData } from "./state-ballot-storage.js";

const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const exact = (value: Record<string, unknown>, keys: string[]) => Object.keys(value).sort().join(",") === keys.sort().join(",");

export async function collectReviewedStateDocuments(reviewPath: string, collectionPath: string, options: Parameters<typeof collectElectionDocuments>[1] = {}) {
	const now = options.now ?? Date.now;
	const reviewBody = await readBoundedStateData(reviewPath);
	const review = JSON.parse(reviewBody);
	if (!object(review) || !exact(review, ["schemaVersion", "type", "sourceId", "reviewedAt", "snapshotPath", "snapshotSha256"]) || review.schemaVersion !== 1 || review.type !== "reviewed-state-document-collection" || typeof review.sourceId !== "string" || typeof review.reviewedAt !== "string" || !Number.isFinite(Date.parse(review.reviewedAt)) || new Date(review.reviewedAt).toISOString() !== review.reviewedAt || Date.parse(review.reviewedAt) > now() || now() - Date.parse(review.reviewedAt) > 30 * 86400000 || typeof review.snapshotPath !== "string" || !isAbsolute(review.snapshotPath) || typeof review.snapshotSha256 !== "string" || !/^[a-f\d]{64}$/u.test(review.snapshotSha256)) throw new Error("Provide a current exact review of an external candidate snapshot.");
	const source = configuredStateBallotSources.find(source => source.id === review.sourceId);
	if (!source || source.retrievalPolicy !== "manual-snapshot" || source.snapshotStorage !== "external" || !["reviewed-pdf", "reviewed-image"].includes(source.format) || !source.documentUrls?.length) throw new Error("Reviewed document collection requires an explicitly manual PDF or image source.");
	const snapshotBody = await readBoundedStateData(review.snapshotPath);
	if (hash(snapshotBody) !== review.snapshotSha256) throw new Error("The reviewed candidate snapshot bytes changed.");
	const snapshot = parseBundledStateSnapshot(source, snapshotBody, "manual-snapshot");
	if (!snapshot.records.length || !snapshot.documents?.length || snapshot.documents.length > 100 || new Set(snapshot.documents.map(document => document.url)).size !== snapshot.documents.length || Date.parse(snapshot.retrievedAt) > Date.parse(review.reviewedAt)) throw new Error("A complete dated reviewed candidate snapshot is required.");
	const plan = JSON.parse(await readBoundedStateData(collectionPath));
	if (!object(plan) || !Array.isArray(plan.sourceIds) || !plan.sourceIds.length || plan.sourceIds.length > 25 || new Set(plan.sourceIds).size !== plan.sourceIds.length || typeof plan.outputRoot !== "string" || !isAbsolute(plan.outputRoot)) throw new Error("Use a bounded collection plan for the exact reviewed candidate documents.");
	const publishers = plan.sourceIds.map(id => electionDocumentSources.find(publisher => publisher.id === id));
	const matches = (publisher: NonNullable<typeof publishers[number]>, url: string) => new URL(url).hostname === publisher.host && publisher.documentPatterns.some(pattern => new RegExp(pattern, "u").test(new URL(url).pathname)) && (!publisher.reviewedDocumentUrls || publisher.reviewedDocumentUrls.includes(url));
	if (publishers.some(publisher => !publisher || publisher.stateCode !== source.stateCode || publisher.electionDate !== source.electionDate || publisher.documentFormat !== undefined || !snapshot.documents!.some(document => matches(publisher, document.url))) || snapshot.documents.some(document => publishers.filter(publisher => publisher && matches(publisher, document.url)).length !== 1)) throw new Error("Every reviewed candidate document needs exactly one matching state/election collector.");
	assertExternalStateDataDirectory(plan.outputRoot);
	const collection = await collectElectionDocuments(plan as unknown as ElectionDocumentPlan, options);
	if (hash(await readBoundedStateData(review.snapshotPath)) !== review.snapshotSha256) throw new Error("The reviewed candidate snapshot changed during collection.");
	const outputRoot = await realpath(plan.outputRoot);
	assertExternalStateDataDirectory(outputRoot);
	const documents = collection.observations.flatMap(observation => observation.documents ?? []);
	const expected = new Map(snapshot.documents.map(document => [document.url, document.sha256]));
	const observed = new Map(documents.map(document => [document.url, document]));
	const changedDocuments = snapshot.documents.filter(document => observed.has(document.url) && observed.get(document.url)!.sha256 !== document.sha256).map(document => ({ url: document.url, reviewedSha256: document.sha256, observedSha256: observed.get(document.url)!.sha256 }));
	const missingDocuments = snapshot.documents.filter(document => !observed.has(document.url)).map(document => document.url);
	const unexpectedDocuments = documents.filter(document => !expected.has(document.url)).map(document => document.url);
	const exactDocuments = documents.length === observed.size && !changedDocuments.length && !missingDocuments.length && !unexpectedDocuments.length;
	const status = !collection.complete ? "unavailable" : exactDocuments ? "verified-unchanged" : "review-required";
	const identifier = randomUUID();
	let verifiedSnapshot: { path: string; sha256: string } | undefined;
	if (status === "verified-unchanged") {
		const path = join(outputRoot, `verified-${source.id}-${identifier}.json`);
		await writeFile(path, snapshotBody, { flag: "wx" });
		verifiedSnapshot = { path, sha256: review.snapshotSha256 };
	}
	const result = {
		schemaVersion: 1,
		type: "reviewed-state-document-collection-result",
		sourceId: source.id,
		stateCode: source.stateCode,
		electionDate: source.electionDate,
		status,
		complete: status === "verified-unchanged",
		reviewSha256: hash(reviewBody),
		snapshotSha256: review.snapshotSha256,
		originalRetrievedAt: snapshot.retrievedAt,
		reviewedRecordCount: snapshot.records.length,
		verifiedRecordCount: status === "verified-unchanged" ? snapshot.records.length : 0,
		collectedAt: collection.collectedAt,
		...(status === "verified-unchanged" ? { lastPublisherCheckAt: new Date(Math.min(...documents.map(document => Date.parse(document.checkedAt)))).toISOString() } : {}),
		publisherRequests: collection.publisherRequests,
		collectionFile: collection.file,
		changedDocuments,
		missingDocuments,
		unexpectedDocuments,
		coverageCompletenessClaimed: false,
		...(verifiedSnapshot ? { verifiedSnapshot } : {}),
		snapshotChanged: false,
		imported: false,
		published: false,
		schedulingActivated: false,
	};
	const file = join(outputRoot, `reviewed-state-documents-${source.id}-${identifier}.json`);
	await writeFile(file, `${JSON.stringify(result, null, 2)}\n`, { flag: "wx" });
	return { ...result, file };
}
