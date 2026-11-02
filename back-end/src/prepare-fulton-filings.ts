import type { ElectionDocumentPlan } from "./election-document-collection.js";
import type { FultonFilingBinding } from "./fulton-filing-context.js";
import { Buffer } from "node:buffer";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, realpath, writeFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import { collectElectionDocuments } from "./election-document-collection.js";
import { parseElectionReferenceSnapshot } from "./election-references.js";
import { fultonFilingDocuments, fultonFilingDocumentSource, fultonFilingReferenceSource, prepareFultonFilingContext } from "./fulton-filing-context.js";
import { extractStateBallotPdfText, resolveStateBallotPdfExtractor } from "./state-ballot-pdf.js";
import { configuredStateBallotSources } from "./state-ballot-registry.js";
import { parseBundledStateSnapshot } from "./state-ballot-snapshot.js";
import { assertExternalStateDataDirectory, readBoundedStateData, readBoundedStateDataBytes } from "./state-ballot-storage.js";

const hash = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const exact = (value: Record<string, unknown>, keys: string[]) => Object.keys(value).sort().join(",") === keys.sort().join(",");

export async function prepareFultonFilingFiles(path: string, now = Date.now(), validateOnly = false, extractor?: (body: Buffer) => Promise<string>) {
	const planBody = await readBoundedStateData(path);
	const plan = JSON.parse(planBody);
	if (!object(plan) || !exact(plan, ["schemaVersion", "type", "reviewedAt", "candidateFile", "documents", "bindings", "outputDirectory"]) || plan.schemaVersion !== 1 || plan.type !== "fulton-filing-context-preparation" || typeof plan.reviewedAt !== "string" || !Number.isFinite(Date.parse(plan.reviewedAt)) || Date.parse(plan.reviewedAt) > now || now - Date.parse(plan.reviewedAt) > 30 * 86400000 || typeof plan.candidateFile !== "string" || !isAbsolute(plan.candidateFile) || typeof plan.outputDirectory !== "string" || !isAbsolute(plan.outputDirectory) || !Array.isArray(plan.documents) || plan.documents.length !== fultonFilingDocuments.length || !Array.isArray(plan.bindings)) throw new Error("Provide a current explicit Fulton filing review with external output.");
	assertExternalStateDataDirectory(plan.outputDirectory);
	const candidateBody = await readBoundedStateData(plan.candidateFile);
	const metadata = JSON.parse(candidateBody);
	const source = configuredStateBallotSources.find(source => source.id === "ga-fulton-2026");
	if (!source || !["automatic", "manual-snapshot"].includes(metadata?.retrievalPolicy)) throw new Error("Fulton filing context requires a matching official snapshot.");
	const candidates = parseBundledStateSnapshot(source, candidateBody, metadata.retrievalPolicy);
	const executable = extractor ? undefined : await resolveStateBallotPdfExtractor();
	const extract = extractor ?? ((body: Buffer) => extractStateBallotPdfText(body, executable!, undefined, "layout", 1));
	const documents = [];
	for (const [index, document] of plan.documents.entries()) {
		if (!object(document) || !exact(document, ["url", "path", "sha256", "capturedAt"]) || document.url !== fultonFilingDocuments[index]!.url || typeof document.path !== "string" || !isAbsolute(document.path) || typeof document.sha256 !== "string" || typeof document.capturedAt !== "string") throw new Error("Fulton filing captures require exact configured identities.");
		const bytes = await readBoundedStateDataBytes(document.path, 8 * 1024 * 1024);
		if (hash(bytes) !== document.sha256 || !bytes.subarray(0, 5).equals(Buffer.from("%PDF-"))) throw new Error("Fulton filing capture bytes changed.");
		documents.push({ text: await extract(bytes), sha256: document.sha256, capturedAt: document.capturedAt });
	}
	if (plan.bindings.some(binding => !object(binding) || !exact(binding, ["documentIndex", "name", "recordId"]) || typeof binding.name !== "string" || typeof binding.recordId !== "string")) throw new Error("Fulton filing bindings require exact reviewed names and IDs.");
	const snapshot = prepareFultonFilingContext({ candidates, documents, bindings: plan.bindings as unknown as FultonFilingBinding[], now });
	parseElectionReferenceSnapshot(fultonFilingReferenceSource, JSON.stringify(snapshot), now);
	const filename = `election-references-${snapshot.sourceId}.json`;
	const body = `${JSON.stringify(snapshot, null, 2)}\n`;
	const result = { schemaVersion: 1, type: "fulton-filing-context-preparation-result", sourceId: snapshot.sourceId, file: filename, sha256: hash(body), recordCount: snapshot.recordCount, factCount: snapshot.recordCount, candidateSha256: hash(candidateBody), reviewSha256: hash(planBody), imported: false, published: false, publisherRequests: 0 };
	if (validateOnly) return { ...result, outputDirectory: plan.outputDirectory };
	await mkdir(plan.outputDirectory, { recursive: true });
	assertExternalStateDataDirectory(await realpath(plan.outputDirectory));
	await writeFile(join(plan.outputDirectory, filename), body, { flag: "wx" });
	await writeFile(join(plan.outputDirectory, "fulton-filing-context-preparation.json"), `${JSON.stringify(result, null, 2)}\n`, { flag: "wx" });
	return { ...result, outputDirectory: plan.outputDirectory };
}

export async function collectFultonFilingFiles(reviewPath: string, collectionPath: string, options: Parameters<typeof collectElectionDocuments>[1] = {}, extractor?: (body: Buffer) => Promise<string>) {
	const now = options.now ?? Date.now;
	await prepareFultonFilingFiles(reviewPath, now(), true, extractor);
	const reviewBody = await readBoundedStateData(reviewPath);
	const review = JSON.parse(reviewBody);
	const collection = JSON.parse(await readBoundedStateData(collectionPath));
	if (!object(collection) || !Array.isArray(collection.sourceIds) || collection.sourceIds.length !== 1 || collection.sourceIds[0] !== fultonFilingDocumentSource.id || typeof collection.cacheDirectory !== "string" || typeof collection.outputRoot !== "string") throw new Error("Fulton filing collection must use its exact reviewed source.");
	assertExternalStateDataDirectory(collection.cacheDirectory);
	const hold = join(collection.cacheDirectory, `fulton-filing-hold-${hash(reviewBody)}.json`);
	try {
		await readBoundedStateData(hold);
		throw new Error("Fulton filing context requires a new review.");
	}
	catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
	const result = await collectElectionDocuments(collection as unknown as ElectionDocumentPlan, options);
	if (!result.complete) throw new Error("Fulton filing collection is incomplete; accepted context remains unchanged.");
	const captures = result.observations.flatMap(observation => observation.documents ?? []);
	const outputRoot = await realpath(collection.outputRoot);
	assertExternalStateDataDirectory(outputRoot);
	const path = join(outputRoot, `fulton-filing-plan-${randomUUID()}.json`);
	const documents = fultonFilingDocuments.map((document) => {
		const matches = captures.filter(capture => capture.url === document.url);
		if (matches.length !== 1) throw new Error("Fulton filing collection has an ambiguous document set.");
		return { url: document.url, path: join(collection.cacheDirectory as string, "bodies", matches[0]!.sha256), sha256: matches[0]!.sha256, capturedAt: matches[0]!.capturedAt };
	});
	await writeFile(path, `${JSON.stringify({ ...review, documents, outputDirectory: join(outputRoot, `fulton-filing-${randomUUID()}`) }, null, 2)}\n`, { flag: "wx" });
	try {
		return { ...await prepareFultonFilingFiles(path, now(), false, extractor), publisherRequests: result.publisherRequests, preparationPlan: path, collectionFile: result.file };
	}
	catch (error) {
		await writeFile(hold, `${JSON.stringify({ schemaVersion: 1, type: "fulton-filing-review-hold", reviewSha256: hash(reviewBody), collectionFile: result.file, capturedAt: result.collectedAt })}\n`, { flag: "wx" });
		throw error;
	}
}
