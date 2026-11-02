import type { ElectionReferenceSnapshot } from "./election-references.js";
import { Buffer } from "node:buffer";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, realpath, writeFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, join } from "node:path";
import { collectElectionDocuments, electionDocumentPolicyFingerprint } from "./election-document-collection.js";
import { electionDocumentSources } from "./election-document-sources.js";
import { electionReferenceSources } from "./election-reference-sources.js";
import { electionReferenceDocumentDigest, parseElectionReferenceSnapshot } from "./election-references.js";
import { configuredStateBallotSources } from "./state-ballot-registry.js";
import { parseBundledStateSnapshot } from "./state-ballot-snapshot.js";
import { assertExternalStateDataDirectory, readBoundedStateData } from "./state-ballot-storage.js";
import { containsControlCharacters } from "./text-validation.js";

const hash = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");
const validHash = (value: unknown): value is string => typeof value === "string" && /^[a-f\d]{64}$/u.test(value);
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const exact = (value: Record<string, unknown>, keys: string[]) => Object.keys(value).sort().join(",") === keys.sort().join(",");

export function candidateStatementContentSha256(body: string, address: string, regionClass?: string) {
	if (Buffer.byteLength(body) > 2 * 1024 * 1024) throw new Error("Candidate statement HTML exceeds its size limit.");
	if (regionClass !== undefined && (!/^[\w-]{1,100}$/iu.test(regionClass))) throw new Error("Candidate statement content regions require an exact reviewed class.");
	return electionDocumentPolicyFingerprint(Buffer.from(body), regionClass ? "region" : "main", address, undefined, regionClass);
}

export async function prepareCandidateStatementFiles(path: string, now = Date.now(), validateOnly = false) {
	const plan = JSON.parse(await readBoundedStateData(path));
	if (!object(plan) || !exact(plan, ["schemaVersion", "type", "sourceId", "reviewedAt", "candidateFiles", "documents", "claims", "outputDirectory"]) || plan.schemaVersion !== 1 || plan.type !== "candidate-statement-preparation" || typeof plan.sourceId !== "string" || typeof plan.reviewedAt !== "string" || !Number.isFinite(Date.parse(plan.reviewedAt)) || Date.parse(plan.reviewedAt) > now || now - Date.parse(plan.reviewedAt) > 30 * 86400000 || !Array.isArray(plan.candidateFiles) || !plan.candidateFiles.length || plan.candidateFiles.length > 25 || !plan.candidateFiles.every(file => typeof file === "string" && isAbsolute(file)) || !Array.isArray(plan.documents) || !Array.isArray(plan.claims) || !plan.claims.length || plan.claims.length > 250 || typeof plan.outputDirectory !== "string" || !isAbsolute(plan.outputDirectory)) throw new Error("Provide an explicit current candidate-statement preparation review and external output.");
	const source = electionReferenceSources.find(source => source.id === plan.sourceId);
	if (!source || source.documents.length > 25 || source.documents.some(document => document.kind !== "candidate-statement") || plan.documents.length !== source.documents.length) throw new Error("Candidate statements must match an existing candidate-provided collection.");
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
		if (!object(value) || !exact(value, ["url", "path", "sha256", "capturedAt", "contentSha256", ...(value.regionClass === undefined ? [] : ["regionClass"])]) || value.url !== source.documents[index]!.url || typeof value.path !== "string" || !isAbsolute(value.path) || !validHash(value.sha256) || !validHash(value.contentSha256) || (value.regionClass !== undefined && typeof value.regionClass !== "string") || typeof value.capturedAt !== "string" || !Number.isFinite(Date.parse(value.capturedAt)) || Date.parse(value.capturedAt) > now) throw new Error("Candidate statement document identity and capture evidence are required.");
		const body = await readBoundedStateData(value.path);
		if (hash(body) !== value.sha256 || candidateStatementContentSha256(body, value.url as string, value.regionClass as string | undefined) !== value.contentSha256) throw new Error("Candidate statement content changed or its capture fingerprint is invalid.");
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
		documents[documentIndex]!.includedRecordCount++;
		records.push({ id: hash(`${source.id}:${identity}:${documentIndex}`).slice(0, 24), name: candidate.name, office: candidate.office, scope: candidate.scope, ...(candidate.jurisdiction ? { jurisdiction: candidate.jurisdiction } : {}), facts: claim.facts as string[], sourceDocumentIndex: documentIndex });
	}
	const snapshot: ElectionReferenceSnapshot = { schemaVersion: 1, type: "election-references", stateCode: source.stateCode, sourceId: source.id, electionDate: source.electionDate, retrievedAt: new Date(Math.min(...documents.map(document => Date.parse(document.capturedAt)))).toISOString(), sourceSha256: electionReferenceDocumentDigest(documents), recordCount: records.length, documents, records };
	parseElectionReferenceSnapshot(source, JSON.stringify(snapshot), now);
	assertExternalStateDataDirectory(plan.outputDirectory);
	const parent = await realpath(dirname(plan.outputDirectory));
	assertExternalStateDataDirectory(parent);
	if (join(parent, basename(plan.outputDirectory)) !== plan.outputDirectory) throw new Error("Candidate statement output must use a physical directory.");
	const filename = `election-references-${source.id}.json`;
	const body = `${JSON.stringify(snapshot, null, 2)}\n`;
	const result = { schemaVersion: 1, type: "candidate-statement-preparation-result", sourceId: source.id, reviewedAt: plan.reviewedAt, records: records.length, facts: records.reduce((count, record) => count + record.facts.length, 0), file: filename, sha256: hash(body), sourceConfigurationSha256: hash(JSON.stringify(source)), originalCandidates: candidates.map(input => ({ path: input.path, sha256: input.sha256 })), imported: false, publisherRequests: 0 };
	if (validateOnly) return { ...result, outputDirectory: plan.outputDirectory, validateOnly: true };
	await mkdir(plan.outputDirectory);
	await writeFile(join(plan.outputDirectory, filename), body, { flag: "wx" });
	await writeFile(join(plan.outputDirectory, "candidate-statement-preparation.json"), `${JSON.stringify(result, null, 2)}\n`, { flag: "wx" });
	return { ...result, outputDirectory: plan.outputDirectory };
}

export async function collectCandidateStatementFiles(reviewPath: string, collectionPath: string, options: Parameters<typeof collectElectionDocuments>[1] = {}) {
	const now = options?.now ?? Date.now;
	await prepareCandidateStatementFiles(reviewPath, now(), true);
	const reviewBody = await readBoundedStateData(reviewPath);
	const plan = JSON.parse(reviewBody);
	const collection = JSON.parse(await readBoundedStateData(collectionPath));
	const source = electionReferenceSources.find(source => source.id === plan.sourceId)!;
	if (!Array.isArray(collection.sourceIds) || collection.sourceIds.length > source.documents.length || collection.sourceIds.some((id: unknown) => !electionDocumentSources.some(item => item.id === id && item.stateCode === source.stateCode && item.electionDate === source.electionDate && source.documents.some(document => new URL(document.url).hostname === item.host && item.documentPatterns.some(pattern => new RegExp(pattern, "u").test(new URL(document.url).pathname)))))) throw new Error("Statement collection must be limited to the reviewed candidate publications.");
	if (source.documents.some(document => !electionDocumentSources.some(item => collection.sourceIds.includes(item.id) && item.host === new URL(document.url).hostname && item.documentPatterns.some(pattern => new RegExp(pattern, "u").test(new URL(document.url).pathname))))) throw new Error("Every reviewed statement needs a configured collector.");
	if (typeof collection.cacheDirectory !== "string") throw new Error("A statement collection requires its reviewed external cache.");
	assertExternalStateDataDirectory(collection.cacheDirectory);
	const hold = join(collection.cacheDirectory, `candidate-statement-hold-${hash(reviewBody)}.json`);
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
	const path = join(outputRoot, `candidate-statement-plan-${randomUUID()}.json`);
	await writeFile(path, `${JSON.stringify(preparedPlan, null, 2)}\n`, { flag: "wx" });
	try {
		return { ...await prepareCandidateStatementFiles(path, now()), collectionFile: result.file, preparationPlan: path, publisherRequests: result.publisherRequests };
	}
	catch (error) {
		await writeFile(hold, `${JSON.stringify({ schemaVersion: 1, type: "candidate-statement-review-hold", sourceId: source.id, reviewSha256: hash(reviewBody), capturedAt: result.collectedAt, collectionFile: result.file, reason: "Reviewed candidate content or identity changed; accepted references are unchanged." })}\n`, { flag: "wx" });
		throw error;
	}
}
