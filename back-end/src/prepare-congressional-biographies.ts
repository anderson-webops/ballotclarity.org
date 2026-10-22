import { createHash } from "node:crypto";
import { mkdir, realpath, writeFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import { congressionalBiographySources, congressionalDirectory, prepareCongressionalBiographies } from "./congressional-biographies.js";
import { electionReferenceSources } from "./election-reference-sources.js";
import { parseElectionReferenceSnapshot } from "./election-references.js";
import { configuredStateBallotSources } from "./state-ballot-registry.js";
import { parseBundledStateSnapshot } from "./state-ballot-snapshot.js";
import { assertExternalStateDataDirectory, readBoundedStateData } from "./state-ballot-storage.js";

export async function prepareCongressionalBiographyFiles(path: string) {
	const plan = JSON.parse(await readBoundedStateData(path));
	if (!plan || typeof plan !== "object" || Array.isArray(plan) || Object.keys(plan).sort().join(",") !== "candidateFiles,outputDirectory,referenceFiles,schemaVersion,sourceText,type" || plan.schemaVersion !== 1 || plan.type !== "congressional-biography-preparation" || !plan.sourceText || typeof plan.sourceText !== "object" || Array.isArray(plan.sourceText) || Object.keys(plan.sourceText).sort().join(",") !== "capturedAt,path,sha256,url" || plan.sourceText.url !== congressionalDirectory.url || typeof plan.sourceText.capturedAt !== "string" || typeof plan.sourceText.sha256 !== "string" || !/^[a-f0-9]{64}$/u.test(plan.sourceText.sha256) || typeof plan.sourceText.path !== "string" || !isAbsolute(plan.sourceText.path) || !Array.isArray(plan.candidateFiles) || !plan.candidateFiles.length || plan.candidateFiles.length > 100 || !Array.isArray(plan.referenceFiles) || plan.referenceFiles.length > 100 || ![...plan.candidateFiles, ...plan.referenceFiles].every(item => typeof item === "string" && isAbsolute(item)) || typeof plan.outputDirectory !== "string" || !isAbsolute(plan.outputDirectory))
		throw new Error("Provide a valid local congressional biography preparation plan.");
	assertExternalStateDataDirectory(plan.outputDirectory);
	const body = await readBoundedStateData(plan.sourceText.path);
	const candidates = await Promise.all((plan.candidateFiles as string[]).map(async (file) => {
		const content = await readBoundedStateData(file);
		const metadata = JSON.parse(content);
		const source = configuredStateBallotSources.find(item => item.id === metadata?.sourceId);
		if (!source || !["manual-snapshot", "automatic"].includes(metadata.retrievalPolicy)) throw new Error("Each candidate input must match a configured source and retrieval policy.");
		return parseBundledStateSnapshot(source, content, metadata.retrievalPolicy);
	}));
	const previous = await Promise.all((plan.referenceFiles as string[]).map(async (file) => {
		const content = await readBoundedStateData(file);
		const metadata = JSON.parse(content);
		const source = electionReferenceSources.find(item => item.id === metadata?.sourceId);
		if (!source) throw new Error("Each reference input must match a configured collection.");
		return parseElectionReferenceSnapshot(source, content);
	}));
	const states = new Set(candidates.map(snapshot => snapshot.source.stateCode).filter(state => congressionalBiographySources.some(source => source.stateCode === state)));
	const required = electionReferenceSources.filter(source => states.has(source.stateCode) && !source.id.startsWith("us-cdir-") && source.electionDate === congressionalDirectory.electionDate);
	if (required.some(source => !previous.some(snapshot => snapshot.sourceId === source.id))) throw new Error("Provide the preceding reviewed collections to avoid duplicate profiles.");
	const prepared = prepareCongressionalBiographies({ body, capturedAt: plan.sourceText.capturedAt, sha256: plan.sourceText.sha256, candidates, previous });
	if (!prepared.length) throw new Error("No unambiguous new candidate biographies matched.");
	for (const output of prepared) parseElectionReferenceSnapshot(output.source, JSON.stringify(output.snapshot));
	await mkdir(plan.outputDirectory, { recursive: true });
	assertExternalStateDataDirectory(await realpath(plan.outputDirectory));
	const files = [];
	for (const output of prepared) {
		const filename = `election-references-cdir-${output.source.stateCode.toLowerCase()}-${output.source.electionDate.slice(0, 4)}.json`;
		const content = `${JSON.stringify(output.snapshot, null, 2)}\n`;
		await writeFile(join(plan.outputDirectory, filename), content, { flag: "wx" });
		files.push({ path: filename, sourceId: output.source.id, stateCode: output.source.stateCode, recordCount: output.snapshot.recordCount, factCount: output.snapshot.records.reduce((total, record) => total + record.facts.length, 0), sha256: createHash("sha256").update(content).digest("hex"), identities: output.identities });
	}
	await writeFile(join(plan.outputDirectory, "congressional-biography-preparation.json"), `${JSON.stringify({ schemaVersion: 1, type: "congressional-biography-preparation-result", source: { url: congressionalDirectory.url, publishedDate: congressionalDirectory.publishedDate, printedCompilationCutoff: congressionalDirectory.compilationCutoff, capturedAt: plan.sourceText.capturedAt, sha256: plan.sourceText.sha256 }, files, imported: false, publisherRequests: 0 }, null, 2)}\n`, { flag: "wx" });
	return { prepared: files.length, profiles: files.reduce((total, file) => total + file.recordCount, 0), facts: files.reduce((total, file) => total + file.factCount, 0), outputDirectory: plan.outputDirectory, imported: false, publisherRequests: 0 };
}
