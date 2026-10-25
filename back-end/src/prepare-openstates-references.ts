import { createHash } from "node:crypto";
import { lstat, mkdir, realpath, writeFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import { parseElectionReferenceSnapshot } from "./election-references.js";
import { openStatesBulkPublication, openStatesBulkSources, prepareOpenStatesReferences } from "./openstates-bulk.js";
import { configuredStateBallotSources } from "./state-ballot-registry.js";
import { parseBundledStateSnapshot } from "./state-ballot-snapshot.js";
import { assertExternalStateDataDirectory, readBoundedStateData } from "./state-ballot-storage.js";

const hash = (value: string) => createHash("sha256").update(value).digest("hex");
function csvCell(value: string | number) {
	const text = String(value);
	return `"${(/^[=+\-@\t\r]/u.test(text) ? `'${text}` : text).replace(/"/gu, "\"\"")}"`;
}

export async function readOpenStatesCandidateInputs(files: readonly string[], allowedSourceIds: readonly string[]) {
	if (!Array.isArray(files) || !files.length || files.length > 100 || !files.every(file => typeof file === "string" && isAbsolute(file)) || !Array.isArray(allowedSourceIds) || !allowedSourceIds.length || allowedSourceIds.length > 100 || !allowedSourceIds.every(id => typeof id === "string" && configuredStateBallotSources.some(source => source.id === id)) || new Set(allowedSourceIds).size !== allowedSourceIds.length)
		throw new Error("Candidate files and reviewed source selection are invalid.");
	const candidates = await Promise.all(files.map(async (file) => {
		const content = await readBoundedStateData(file);
		const envelope = JSON.parse(content);
		const stored = typeof envelope?.snapshot === "string";
		const snapshotBody = stored ? envelope.snapshot as string : content;
		const metadata = JSON.parse(snapshotBody);
		const source = configuredStateBallotSources.find(item => item.id === metadata?.sourceId && allowedSourceIds.includes(item.id));
		if (!source || !["manual-snapshot", "automatic"].includes(metadata.retrievalPolicy))
			throw new Error("Each candidate input must match an explicitly reviewed source and retrieval policy.");
		if (stored && (Object.keys(envelope).sort().join(",") !== "snapshot,sourceConfigurationSha256" || envelope.sourceConfigurationSha256 !== hash(JSON.stringify(source))))
			throw new Error("Stored candidate inputs must match their configured source fingerprint.");
		return parseBundledStateSnapshot(source, snapshotBody, metadata.retrievalPolicy);
	}));
	if (new Set(candidates.map(snapshot => snapshot.source.id)).size !== candidates.length)
		throw new Error("Select one reviewed candidate capture per source.");
	return candidates;
}

export async function prepareOpenStatesReferenceFiles(path: string, now = Date.now()) {
	const plan = JSON.parse(await readBoundedStateData(path));
	if (!plan || typeof plan !== "object" || Array.isArray(plan) || Object.keys(plan).sort().join(",") !== "allowedCandidateSourceIds,candidateFiles,downloads,outputDirectory,schemaVersion,type" || plan.schemaVersion !== 1 || plan.type !== "openstates-reference-preparation" || !Array.isArray(plan.downloads) || !plan.downloads.length || plan.downloads.length > 51 || typeof plan.outputDirectory !== "string" || !isAbsolute(plan.outputDirectory))
		throw new Error("Provide a valid local Open States preparation plan with reviewed candidate sources.");
	assertExternalStateDataDirectory(plan.outputDirectory);
	const candidates = await readOpenStatesCandidateInputs(plan.candidateFiles, plan.allowedCandidateSourceIds);
	const seen = new Set<string>();
	const outputs = [];
	for (const download of plan.downloads) {
		if (!download || typeof download !== "object" || Array.isArray(download) || Object.keys(download).sort().join(",") !== "capturedAt,path,sha256,stateCode,url" || typeof download.path !== "string" || !isAbsolute(download.path) || typeof download.capturedAt !== "string" || typeof download.sha256 !== "string" || typeof download.stateCode !== "string")
			throw new Error("Each Open States download requires its exact local capture provenance.");
		const source = openStatesBulkSources.find(item => item.stateCode === download.stateCode);
		if (!source || download.url !== source.documents[0]!.url || seen.has(source.id))
			throw new Error("Open States downloads must match unique configured state URLs.");
		seen.add(source.id);
		const body = await readBoundedStateData(download.path);
		const prepared = prepareOpenStatesReferences({ source, body, capturedAt: download.capturedAt, sha256: download.sha256, candidates: candidates.filter(snapshot => snapshot.source.stateCode === source.stateCode), allowedCandidateSourceIds: plan.allowedCandidateSourceIds, now });
		if (prepared.snapshot) parseElectionReferenceSnapshot(source, JSON.stringify(prepared.snapshot), now);
		outputs.push({ source, prepared, capture: { url: download.url, capturedAt: download.capturedAt, sha256: download.sha256 } });
	}
	const files = outputs.flatMap(({ source, prepared }) => prepared.snapshot ? [{ path: `election-references-openstates-${source.stateCode.toLowerCase()}-${source.electionDate.slice(0, 4)}.json`, content: `${JSON.stringify(prepared.snapshot, null, 2)}\n`, sourceId: source.id, sourceConfigurationSha256: hash(JSON.stringify(source)), stateCode: source.stateCode, recordCount: prepared.snapshot.recordCount }] : []);
	if (!files.length) throw new Error("No exact state, chamber, district and candidate-name matches were found.");
	const columns = ["stateCode", "candidateSourceId", "candidateId", "candidateName", "candidateCapturedAt", "candidateSourceSha256", "personId", "datasetName", "chamber", "district", "sourceRow", "referenceId", "datasetUrl", "datasetCapturedAt", "datasetSha256"] as const;
	const matches = outputs.flatMap(({ source, prepared, capture }) => prepared.matches.map(match => ({ stateCode: source.stateCode, ...match, datasetUrl: capture.url, datasetCapturedAt: capture.capturedAt, datasetSha256: capture.sha256 })));
	const crosswalk = `${[columns.map(csvCell).join(","), ...matches.map(match => columns.map(column => csvCell(match[column])).join(","))].join("\n")}\n`;
	const holds = outputs.flatMap(({ source, prepared }) => prepared.holds.map(hold => ({ stateCode: source.stateCode, ...hold })));
	const manifest = {
		schemaVersion: 1,
		type: "openstates-reference-preparation-result",
		publication: openStatesBulkPublication,
		files: files.map(({ content, ...file }) => ({ ...file, sha256: hash(content) })),
		downloads: outputs.map(({ source, prepared, capture }) => ({ stateCode: source.stateCode, ...capture, datasetRecordCount: prepared.datasetRecordCount, profiles: prepared.snapshot?.recordCount ?? 0, matches: prepared.matches.length, heldCandidates: prepared.holds.length })),
		allowedCandidateSourceIds: plan.allowedCandidateSourceIds,
		candidateCaptures: candidates.map(snapshot => ({ sourceId: snapshot.source.id, capturedAt: snapshot.retrievedAt, sourceSha256: snapshot.sha256, recordCount: snapshot.records.length })),
		crosswalkSha256: hash(crosswalk),
		profiles: files.reduce((total, file) => total + file.recordCount, 0),
		matchedCandidateRecords: matches.length,
		heldCandidateRecords: holds.length,
		imported: false,
		publisherRequests: 0,
	};
	const exports = [...files, { path: "openstates-service-crosswalk.csv", content: crosswalk }, { path: "openstates-service-review.jsonl", content: `${holds.map(hold => JSON.stringify(hold)).join("\n")}\n` }, { path: "openstates-reference-preparation.json", content: `${JSON.stringify(manifest, null, 2)}\n` }];
	await mkdir(plan.outputDirectory, { recursive: true });
	assertExternalStateDataDirectory(await realpath(plan.outputDirectory));
	for (const file of exports) {
		try {
			await lstat(join(plan.outputDirectory, file.path));
			throw new Error("Prepared Open States files already exist; outputs are never overwritten.");
		}
		catch (error) {
			if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
		}
	}
	for (const file of exports) await writeFile(join(plan.outputDirectory, file.path), file.content, { flag: "wx" });
	return { collections: files.length, profiles: manifest.profiles, matchedCandidateRecords: matches.length, heldCandidateRecords: holds.length, files: exports.length, publisherRequests: 0, imported: false };
}
