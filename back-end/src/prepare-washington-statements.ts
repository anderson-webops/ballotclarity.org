import type { WashingtonStatementCapture } from "./washington-statements.js";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { mkdir, realpath, writeFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import { electionReferenceSources } from "./election-reference-sources.js";
import { parseElectionReferenceSnapshot } from "./election-references.js";
import { configuredStateBallotSources } from "./state-ballot-registry.js";
import { parseBundledStateSnapshot } from "./state-ballot-snapshot.js";
import { assertExternalStateDataDirectory, readBoundedStateData } from "./state-ballot-storage.js";
import { prepareWashingtonStatements } from "./washington-statements.js";

export async function prepareWashingtonStatementFiles(path: string) {
	const plan = JSON.parse(await readBoundedStateData(path));
	if (!plan || typeof plan !== "object" || Array.isArray(plan) || Object.keys(plan).sort().join(",") !== "candidateFile,documents,outputDirectory,referenceFiles,reviewedFactsFile,schemaVersion,sourceId,type" || plan.schemaVersion !== 1 || plan.type !== "washington-statement-preparation" || typeof plan.sourceId !== "string" || ![plan.candidateFile, plan.reviewedFactsFile, plan.outputDirectory].every(value => typeof value === "string" && isAbsolute(value)) || !Array.isArray(plan.documents) || !plan.documents.length || plan.documents.length > 500 || !Array.isArray(plan.referenceFiles) || plan.referenceFiles.length > 100 || !plan.referenceFiles.every((value: unknown) => typeof value === "string" && isAbsolute(value)))
		throw new Error("Provide a valid local Washington statement preparation plan.");
	const source = electionReferenceSources.find(item => item.id === plan.sourceId && item.stateCode === "WA");
	if (!source || plan.documents.length !== source.documents.length) throw new Error("The Washington reference collection is not configured.");
	assertExternalStateDataDirectory(plan.outputDirectory);
	const candidateBody = await readBoundedStateData(plan.candidateFile);
	const candidateMetadata = JSON.parse(candidateBody);
	const candidateSource = configuredStateBallotSources.find(item => item.id === candidateMetadata?.sourceId && item.stateCode === "WA");
	if (!candidateSource || !["manual-snapshot", "automatic"].includes(candidateMetadata.retrievalPolicy)) throw new Error("Provide a configured Washington official candidate snapshot.");
	const candidates = parseBundledStateSnapshot(candidateSource, candidateBody, candidateMetadata.retrievalPolicy);
	const previous = await Promise.all((plan.referenceFiles as string[]).map(async (file) => {
		const content = await readBoundedStateData(file);
		const metadata = JSON.parse(content);
		const configured = electionReferenceSources.find(item => item.id === metadata?.sourceId);
		if (!configured) throw new Error("Each preceding reference must match a configured collection.");
		return parseElectionReferenceSnapshot(configured, content);
	}));
	const required = electionReferenceSources.slice(0, electionReferenceSources.indexOf(source)).filter(item => item.stateCode === "WA" && item.electionDate === source.electionDate);
	if (required.some(item => !previous.some(snapshot => snapshot.sourceId === item.id))) throw new Error("Provide the preceding Washington collections to avoid duplicate profiles.");
	const documents: WashingtonStatementCapture[] = [];
	let capturedBytes = 0;
	for (const [index, document] of (plan.documents as Record<string, unknown>[]).entries()) {
		if (!document || typeof document !== "object" || Array.isArray(document) || Object.keys(document).sort().join(",") !== "capturedAt,path,sha256,url" || typeof document.path !== "string" || !isAbsolute(document.path) || document.url !== source.documents[index]!.url || typeof document.capturedAt !== "string" || typeof document.sha256 !== "string") throw new Error("Provide the ordered local Washington document captures.");
		const body = await readBoundedStateData(document.path);
		capturedBytes += Buffer.byteLength(body);
		if (capturedBytes > 128 * 1024 * 1024) throw new Error("Washington statement captures exceed their combined size limit.");
		documents.push({ url: document.url, capturedAt: document.capturedAt, sha256: document.sha256, body });
	}
	const review = JSON.parse(await readBoundedStateData(plan.reviewedFactsFile));
	if (!review || typeof review !== "object" || Array.isArray(review) || Object.keys(review).sort().join(",") !== "facts,reviewed,schemaVersion,sourceId,type" || review.schemaVersion !== 1 || review.type !== "washington-statement-review" || review.sourceId !== source.id || review.reviewed !== true || !Array.isArray(review.facts)) throw new Error("Provide explicitly reviewed Washington factual paraphrases, not raw statements.");
	const prepared = prepareWashingtonStatements({ source, candidates, previous, documents, facts: review.facts });
	parseElectionReferenceSnapshot(source, JSON.stringify(prepared.snapshot));
	await mkdir(plan.outputDirectory, { recursive: true });
	assertExternalStateDataDirectory(await realpath(plan.outputDirectory));
	const filename = `election-references-${source.id}.json`;
	const content = `${JSON.stringify(prepared.snapshot, null, 2)}\n`;
	await writeFile(join(plan.outputDirectory, filename), content, { flag: "wx" });
	const result = { schemaVersion: 1, type: "washington-statement-preparation-result", sourceId: source.id, file: filename, sha256: createHash("sha256").update(content).digest("hex"), profiles: prepared.snapshot.recordCount, facts: prepared.snapshot.records.reduce((total, record) => total + record.facts.length, 0), identities: prepared.identities, holds: prepared.holds, imported: false, publisherRequests: 0 };
	await writeFile(join(plan.outputDirectory, "washington-statement-preparation.json"), `${JSON.stringify(result, null, 2)}\n`, { flag: "wx" });
	return { prepared: 1, profiles: result.profiles, facts: result.facts, outputDirectory: plan.outputDirectory, imported: false, publisherRequests: 0 };
}
