import type { ElectionReferenceSnapshot } from "./election-references.js";
import { Buffer } from "node:buffer";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, realpath, writeFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, join } from "node:path";
import { collectElectionDocuments, electionDocumentPolicyFingerprint } from "./election-document-collection.js";
import { electionDocumentSources } from "./election-document-sources.js";
import { electionReferenceSources } from "./election-reference-sources.js";
import { electionReferenceDocumentDigest, parseElectionReferenceSnapshot } from "./election-references.js";
import { extractStateBallotPdfText, resolveStateBallotPdfExtractor } from "./state-ballot-pdf.js";
import { configuredStateBallotSources } from "./state-ballot-registry.js";
import { parseBundledStateSnapshot } from "./state-ballot-snapshot.js";
import { assertExternalStateDataDirectory, readBoundedStateData, readBoundedStateDataBytes } from "./state-ballot-storage.js";
import { containsControlCharacters } from "./text-validation.js";

const hash = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");
const validHash = (value: unknown): value is string => typeof value === "string" && /^[a-f\d]{64}$/u.test(value);
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const exact = (value: Record<string, unknown>, keys: string[]) => Object.keys(value).sort().join(",") === keys.sort().join(",");

export function candidateStatementContentSha256(body: string, address: string, regionClass?: string, regionId?: string) {
	if (Buffer.byteLength(body) > 2 * 1024 * 1024) throw new Error("Candidate statement HTML exceeds its size limit.");
	if (regionClass !== undefined && (!/^[\w-]{1,100}$/iu.test(regionClass))) throw new Error("Candidate statement content regions require an exact reviewed class.");
	if ((regionId !== undefined && !/^[a-z][\w.-]{0,100}$/iu.test(regionId)) || (regionClass !== undefined && regionId !== undefined)) throw new Error("Candidate statement content requires one exact reviewed region.");
	return electionDocumentPolicyFingerprint(Buffer.from(body), regionClass || regionId ? "region" : "main", address, regionId, regionClass);
}

export function candidatePdfContentSha256(text: string, maximumPages: number) {
	const pages = text.split("\f").filter(page => page.trim());
	if (!Number.isSafeInteger(maximumPages) || maximumPages < 1 || maximumPages > 25 || !pages.length || pages.length > maximumPages || Buffer.byteLength(text) > 2 * 1024 * 1024 || text.includes("\uFFFD") || containsControlCharacters(text.replace(/[\n\r\t\f]/gu, ""))) throw new Error("Candidate PDF text exceeds its reviewed bounds.");
	return hash(JSON.stringify(pages.map(page => page.replace(/\s+/gu, " ").trim())));
}

async function prepareReviewedCandidateContextFiles(path: string, kind: "candidate-statement" | "official-biography", now = Date.now(), validateOnly = false, extractor?: (body: Buffer, maximumPages: number) => Promise<string>) {
	const plan = JSON.parse(await readBoundedStateData(path));
	if (!object(plan) || !exact(plan, ["schemaVersion", "type", "sourceId", "reviewedAt", "candidateFiles", "documents", "claims", "outputDirectory"]) || plan.schemaVersion !== 1 || plan.type !== `${kind}-preparation` || typeof plan.sourceId !== "string" || typeof plan.reviewedAt !== "string" || !Number.isFinite(Date.parse(plan.reviewedAt)) || Date.parse(plan.reviewedAt) > now || now - Date.parse(plan.reviewedAt) > 30 * 86400000 || !Array.isArray(plan.candidateFiles) || !plan.candidateFiles.length || plan.candidateFiles.length > 25 || !plan.candidateFiles.every(file => typeof file === "string" && isAbsolute(file)) || !Array.isArray(plan.documents) || !Array.isArray(plan.claims) || !plan.claims.length || plan.claims.length > 250 || typeof plan.outputDirectory !== "string" || !isAbsolute(plan.outputDirectory)) throw new Error("Provide an explicit current candidate-statement preparation review and external output.");
	const source = electionReferenceSources.find(source => source.id === plan.sourceId);
	if (!source || source.documents.length > 25 || source.documents.some(document => document.kind !== kind) || (kind === "official-biography" && source.allowOfficialCandidateBindings !== true) || plan.documents.length !== source.documents.length) throw new Error("Candidate context must match its explicitly reviewed publication kind.");
	const candidates = await Promise.all(plan.candidateFiles.map(async (file: string) => {
		const body = await readBoundedStateData(file);
		const metadata = JSON.parse(body);
		const candidateSource = configuredStateBallotSources.find(item => item.id === metadata?.sourceId && item.stateCode === source.stateCode && item.electionDate === source.electionDate);
		if (!candidateSource || !["manual-snapshot", "automatic"].includes(metadata.retrievalPolicy)) throw new Error("Candidate statements require matching official state/election snapshots.");
		return { snapshot: parseBundledStateSnapshot(candidateSource, body, metadata.retrievalPolicy), path: file, sha256: hash(body) };
	}));
	if (new Set(candidates.map(input => input.snapshot.source.id)).size !== candidates.length) throw new Error("Official statement inputs must be distinct.");
	const documents: ElectionReferenceSnapshot["documents"] = [];
	for (const [index, value] of plan.documents.entries()) {
		if (!object(value) || !exact(value, ["url", "path", "sha256", "capturedAt", "contentSha256", ...(value.regionClass === undefined ? [] : ["regionClass"]), ...(value.regionId === undefined ? [] : ["regionId"])]) || value.url !== source.documents[index]!.url || typeof value.path !== "string" || !isAbsolute(value.path) || !validHash(value.sha256) || !validHash(value.contentSha256) || (value.regionClass !== undefined && typeof value.regionClass !== "string") || (value.regionId !== undefined && typeof value.regionId !== "string") || typeof value.capturedAt !== "string" || !Number.isFinite(Date.parse(value.capturedAt)) || Date.parse(value.capturedAt) > now) throw new Error("Candidate statement document identity and capture evidence are required.");
		const document = source.documents[index]!;
		if (document.pdfMaximumPages !== undefined) {
			if (kind !== "official-biography" || !Number.isSafeInteger(document.pdfMaximumPages) || document.pdfMaximumPages < 1 || document.pdfMaximumPages > 25 || value.regionClass !== undefined || value.regionId !== undefined) throw new Error("Candidate PDFs require an explicit bounded official source.");
			const body = await readBoundedStateDataBytes(value.path, 8 * 1024 * 1024);
			if (hash(body) !== value.sha256 || !body.subarray(0, 5).equals(Buffer.from("%PDF-"))) throw new Error("Candidate PDF capture bytes changed.");
			const text = extractor ? await extractor(body, document.pdfMaximumPages) : await extractStateBallotPdfText(body, await resolveStateBallotPdfExtractor(), undefined, "layout", document.pdfMaximumPages);
			if (candidatePdfContentSha256(text, document.pdfMaximumPages) !== value.contentSha256) throw new Error("Candidate PDF content changed or its capture fingerprint is invalid.");
		}
		else {
			const body = await readBoundedStateData(value.path);
			if (hash(body) !== value.sha256 || candidateStatementContentSha256(body, value.url as string, value.regionClass as string | undefined, value.regionId as string | undefined) !== value.contentSha256) throw new Error("Candidate statement content changed or its capture fingerprint is invalid.");
		}
		documents.push({ url: value.url as string, sha256: value.sha256, capturedAt: value.capturedAt, includedRecordCount: 0 });
	}
	const records: ElectionReferenceSnapshot["records"] = [];
	const identities = new Set<string>();
	for (const claim of plan.claims) {
		if (!object(claim) || !exact(claim, ["officialSourceId", "recordId", "documentIndex", "facts"]) || typeof claim.officialSourceId !== "string" || typeof claim.recordId !== "string" || !/^[a-f\d]{24}$/u.test(claim.recordId) || !Number.isSafeInteger(claim.documentIndex) || Number(claim.documentIndex) < 0 || Number(claim.documentIndex) >= documents.length || !Array.isArray(claim.facts) || !claim.facts.length || claim.facts.length > 6 || claim.facts.some(fact => typeof fact !== "string" || !fact.trim() || fact !== fact.trim() || fact.length > 600 || containsControlCharacters(fact))) throw new Error("Every candidate statement requires bounded reviewed facts and an exact official identity.");
		const candidate = candidates.find(input => input.snapshot.source.id === claim.officialSourceId)?.snapshot.records.find(record => record.id === claim.recordId);
		const identity = `${claim.officialSourceId}:${claim.recordId}`;
		if (!candidate || !["listed", "filed", "qualified", "write-in", "unopposed"].includes(candidate.status) || identities.has(identity)) throw new Error("Candidate statement identity is missing, inactive or duplicated.");
		identities.add(identity);
		const documentIndex = Number(claim.documentIndex);
		if (kind === "official-biography" && source.documents[documentIndex]!.candidateName !== candidate.name) throw new Error("Official biography candidate identity requires its exact configured name.");
		documents[documentIndex]!.includedRecordCount++;
		records.push({ id: hash(`${source.id}:${identity}:${documentIndex}`).slice(0, 24), name: candidate.name, office: candidate.office, scope: candidate.scope, ...(candidate.jurisdiction ? { jurisdiction: candidate.jurisdiction } : {}), ...(candidate.scope === "local" ? { officialCandidate: { sourceId: claim.officialSourceId, recordId: candidate.id } } : {}), facts: claim.facts as string[], sourceDocumentIndex: documentIndex });
	}
	const snapshot: ElectionReferenceSnapshot = { schemaVersion: 1, type: "election-references", stateCode: source.stateCode, sourceId: source.id, electionDate: source.electionDate, retrievedAt: new Date(Math.min(...documents.map(document => Date.parse(document.capturedAt)))).toISOString(), sourceSha256: electionReferenceDocumentDigest(documents), recordCount: records.length, documents, records };
	parseElectionReferenceSnapshot(source, JSON.stringify(snapshot), now);
	assertExternalStateDataDirectory(plan.outputDirectory);
	const parent = await realpath(dirname(plan.outputDirectory));
	assertExternalStateDataDirectory(parent);
	if (join(parent, basename(plan.outputDirectory)) !== plan.outputDirectory) throw new Error("Candidate statement output must use a physical directory.");
	const filename = `election-references-${source.id}.json`;
	const body = `${JSON.stringify(snapshot, null, 2)}\n`;
	const result = { schemaVersion: 1, type: `${kind}-preparation-result`, sourceId: source.id, reviewedAt: plan.reviewedAt, records: records.length, facts: records.reduce((count, record) => count + record.facts.length, 0), file: filename, sha256: hash(body), sourceConfigurationSha256: hash(JSON.stringify(source)), originalCandidates: candidates.map(input => ({ path: input.path, sha256: input.sha256 })), imported: false, publisherRequests: 0 };
	if (validateOnly) return { ...result, outputDirectory: plan.outputDirectory, validateOnly: true };
	await mkdir(plan.outputDirectory);
	await writeFile(join(plan.outputDirectory, filename), body, { flag: "wx" });
	await writeFile(join(plan.outputDirectory, `${kind}-preparation.json`), `${JSON.stringify(result, null, 2)}\n`, { flag: "wx" });
	return { ...result, outputDirectory: plan.outputDirectory };
}

async function collectReviewedCandidateContextFiles(reviewPath: string, collectionPath: string, kind: "candidate-statement" | "official-biography", options: Parameters<typeof collectElectionDocuments>[1] = {}, extractor?: (body: Buffer, maximumPages: number) => Promise<string>) {
	const now = options?.now ?? Date.now;
	await prepareReviewedCandidateContextFiles(reviewPath, kind, now(), true, extractor);
	const reviewBody = await readBoundedStateData(reviewPath);
	const plan = JSON.parse(reviewBody);
	const collection = JSON.parse(await readBoundedStateData(collectionPath));
	const source = electionReferenceSources.find(source => source.id === plan.sourceId)!;
	if (!Array.isArray(collection.sourceIds) || collection.sourceIds.length > source.documents.length || collection.sourceIds.some((id: unknown) => !electionDocumentSources.some(item => item.id === id && item.stateCode === source.stateCode && item.electionDate === source.electionDate && source.documents.some(document => new URL(document.url).hostname === item.host && item.documentPatterns.some(pattern => new RegExp(pattern, "u").test(new URL(document.url).pathname)))))) throw new Error("Statement collection must be limited to the reviewed candidate publications.");
	if (source.documents.some(document => !electionDocumentSources.some(item => collection.sourceIds.includes(item.id) && item.host === new URL(document.url).hostname && item.documentPatterns.some(pattern => new RegExp(pattern, "u").test(new URL(document.url).pathname))))) throw new Error("Every reviewed statement needs a configured collector.");
	if (typeof collection.cacheDirectory !== "string") throw new Error("A statement collection requires its reviewed external cache.");
	assertExternalStateDataDirectory(collection.cacheDirectory);
	const hold = join(collection.cacheDirectory, `${kind}-hold-${hash(reviewBody)}.json`);
	try {
		await readBoundedStateData(hold);
		throw new Error("Candidate statement content is held for a new review.");
	}
	catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
	const result = await collectElectionDocuments(collection, options);
	if (!result.complete) throw new Error("Candidate statement collection is incomplete; accepted references are unchanged.");
	const captures = result.observations.flatMap(observation => observation.documents ?? []);
	const documents = plan.documents.map((reviewed: { url: string }) => {
		const matches = captures.filter(capture => capture.url === reviewed.url);
		if (matches.length !== 1) throw new Error("The reviewed candidate statement does not have one complete collected capture.");
		const capture = matches[0]!;
		return { ...reviewed, path: join(collection.cacheDirectory, "bodies", capture.sha256), sha256: capture.sha256, capturedAt: capture.capturedAt };
	});
	const outputRoot = await realpath(collection.outputRoot);
	const preparedPlan = { ...plan, documents, outputDirectory: join(outputRoot, `candidate-statements-${randomUUID()}`) };
	const path = join(outputRoot, `${kind}-plan-${randomUUID()}.json`);
	await writeFile(path, `${JSON.stringify(preparedPlan, null, 2)}\n`, { flag: "wx" });
	try {
		return { ...await prepareReviewedCandidateContextFiles(path, kind, now(), false, extractor), collectionFile: result.file, preparationPlan: path, publisherRequests: result.publisherRequests };
	}
	catch (error) {
		await writeFile(hold, `${JSON.stringify({ schemaVersion: 1, type: `${kind}-review-hold`, sourceId: source.id, reviewSha256: hash(reviewBody), capturedAt: result.collectedAt, collectionFile: result.file, reason: "Reviewed candidate content or identity changed; accepted references are unchanged." })}\n`, { flag: "wx" });
		throw error;
	}
}

export function prepareCandidateStatementFiles(path: string, now = Date.now(), validateOnly = false) {
	return prepareReviewedCandidateContextFiles(path, "candidate-statement", now, validateOnly);
}

export function prepareOfficialCandidateBiographyFiles(path: string, now = Date.now(), validateOnly = false, extractor?: (body: Buffer, maximumPages: number) => Promise<string>) {
	return prepareReviewedCandidateContextFiles(path, "official-biography", now, validateOnly, extractor);
}

export function collectCandidateStatementFiles(reviewPath: string, collectionPath: string, options: Parameters<typeof collectElectionDocuments>[1] = {}) {
	return collectReviewedCandidateContextFiles(reviewPath, collectionPath, "candidate-statement", options);
}

export function collectOfficialCandidateBiographyFiles(reviewPath: string, collectionPath: string, options: Parameters<typeof collectElectionDocuments>[1] = {}, extractor?: (body: Buffer, maximumPages: number) => Promise<string>) {
	return collectReviewedCandidateContextFiles(reviewPath, collectionPath, "official-biography", options, extractor);
}

export async function collectCandidateStatementBatchFile(path: string, options: Parameters<typeof collectElectionDocuments>[1] = {}) {
	const batch = JSON.parse(await readBoundedStateData(path));
	if (!object(batch) || !exact(batch, ["schemaVersion", "type", "entries"]) || batch.schemaVersion !== 1 || batch.type !== "candidate-statement-collection-batch" || !Array.isArray(batch.entries) || !batch.entries.length || batch.entries.length > 25) throw new Error("Provide an explicit bounded candidate statement batch.");
	const sources = new Set<string>();
	let cacheDirectory: string | undefined;
	let outputRoot: string | undefined;
	for (const entry of batch.entries) {
		if (!object(entry) || !exact(entry, ["sourceId", "reviewPath", "collectionPath"]) || typeof entry.sourceId !== "string" || !electionReferenceSources.some(source => source.id === entry.sourceId && source.documents.every(document => document.kind === "candidate-statement")) || sources.has(entry.sourceId) || typeof entry.reviewPath !== "string" || !isAbsolute(entry.reviewPath) || typeof entry.collectionPath !== "string" || !isAbsolute(entry.collectionPath)) throw new Error("Statement batch entries need distinct configured identities and absolute review/collection paths.");
		const review = JSON.parse(await readBoundedStateData(entry.reviewPath));
		const collection = JSON.parse(await readBoundedStateData(entry.collectionPath));
		if (!object(review) || review.sourceId !== entry.sourceId || !object(collection) || typeof collection.cacheDirectory !== "string" || !isAbsolute(collection.cacheDirectory) || typeof collection.outputRoot !== "string" || !isAbsolute(collection.outputRoot)) throw new Error("Statement batch reviews and external collection directories must match.");
		cacheDirectory ??= collection.cacheDirectory;
		outputRoot ??= collection.outputRoot;
		if (cacheDirectory !== collection.cacheDirectory || outputRoot !== collection.outputRoot) throw new Error("Statement batches share one bounded cache and output root to preserve publisher spacing and custody.");
		sources.add(entry.sourceId);
	}
	const entries = [];
	for (const entry of batch.entries) {
		try {
			entries.push({ sourceId: entry.sourceId as string, status: "prepared" as const, preparation: await collectCandidateStatementFiles(entry.reviewPath as string, entry.collectionPath as string, options) });
		}
		catch (error) {
			entries.push({ sourceId: entry.sourceId as string, status: "held" as const, reason: error instanceof Error ? error.message.slice(0, 1000) : "Candidate statement review or collection requires attention." });
		}
	}
	return { schemaVersion: 1, type: "candidate-statement-batch-result", complete: entries.every(entry => entry.status === "prepared"), entries, imported: false, published: false };
}
