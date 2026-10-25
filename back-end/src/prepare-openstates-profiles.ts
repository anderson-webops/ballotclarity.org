import type { OpenStatesProfileCapture } from "./openstates-profile-enrichment.js";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { mkdir, open, realpath, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join } from "node:path";
import { parseElectionReferenceSnapshot } from "./election-references.js";
import { openStatesBulkSources } from "./openstates-bulk.js";
import { enrichOpenStatesProfiles, openStatesProfileArchiveLimits } from "./openstates-profile-enrichment.js";
import { assertExternalStateDataDirectory, readBoundedStateData } from "./state-ballot-storage.js";

const digest = (value: string) => createHash("sha256").update(value).digest("hex");

export async function readOpenStatesProfileArchive(path: string) {
	const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
	try {
		const metadata = await handle.stat();
		if (!metadata.isFile() || metadata.size > openStatesProfileArchiveLimits.compressedBytes) throw new Error("The Open States archive must be a bounded regular file.");
		const buffer = Buffer.alloc(openStatesProfileArchiveLimits.compressedBytes + 1);
		let length = 0;
		while (length < buffer.length) {
			const { bytesRead } = await handle.read(buffer, length, buffer.length - length, length);
			if (!bytesRead) break;
			length += bytesRead;
		}
		if (length > openStatesProfileArchiveLimits.compressedBytes) throw new Error("The Open States archive exceeds its size limit.");
		return buffer.subarray(0, length);
	}
	finally { await handle.close(); }
}

export async function prepareOpenStatesProfileFiles(path: string, now = Date.now()) {
	const plan = JSON.parse(await readBoundedStateData(path));
	if (!plan || typeof plan !== "object" || Array.isArray(plan) || Object.keys(plan).sort().join(",") !== "archive,outputDirectory,referenceFiles,schemaVersion,type" || plan.schemaVersion !== 1 || plan.type !== "openstates-profile-enrichment" || !Array.isArray(plan.referenceFiles) || !plan.referenceFiles.length || plan.referenceFiles.length > 51 || !plan.referenceFiles.every((file: unknown) => typeof file === "string" && isAbsolute(file)) || !plan.archive || typeof plan.archive !== "object" || Array.isArray(plan.archive) || Object.keys(plan.archive).sort().join(",") !== "capturedAt,commit,path,sha256" || typeof plan.archive.path !== "string" || !isAbsolute(plan.archive.path) || typeof plan.outputDirectory !== "string" || !isAbsolute(plan.outputDirectory))
		throw new Error("Provide an Open States profile enrichment plan with a pinned local archive and reviewed CSV-only reference inputs.");
	assertExternalStateDataDirectory(plan.outputDirectory);
	assertExternalStateDataDirectory(await realpath(dirname(plan.outputDirectory)));
	const collections = await Promise.all((plan.referenceFiles as string[]).map(async (file) => {
		const body = await readBoundedStateData(file);
		const envelope = JSON.parse(body);
		const stored = typeof envelope?.snapshot === "string";
		const snapshotBody = stored ? envelope.snapshot as string : body;
		const metadata = JSON.parse(snapshotBody);
		const source = openStatesBulkSources.find(item => item.id === metadata?.sourceId);
		if (!source || (stored && (Object.keys(envelope).sort().join(",") !== "snapshot,sourceConfigurationSha256" || envelope.sourceConfigurationSha256 !== digest(JSON.stringify(source)))))
			throw new Error("Each profile input must match its configured Open States CSV collection.");
		return { source, snapshot: parseElectionReferenceSnapshot(source, snapshotBody, now) };
	}));
	const capture: OpenStatesProfileCapture = { commit: plan.archive.commit, sha256: plan.archive.sha256, capturedAt: plan.archive.capturedAt };
	const prepared = await enrichOpenStatesProfiles(await readOpenStatesProfileArchive(plan.archive.path), capture, collections, now);
	const files = prepared.snapshots.map(({ source, snapshot }) => ({ name: `election-references-openstates-${source.stateCode.toLowerCase()}-profiles-${source.electionDate.slice(0, 4)}.json`, content: `${JSON.stringify(snapshot, null, 2)}\n`, sourceId: source.id, sourceConfigurationSha256: digest(JSON.stringify(source)), stateCode: source.stateCode, records: snapshot.recordCount, facts: snapshot.records.reduce((total, record) => total + record.facts.length, 0) }));
	const manifest = {
		schemaVersion: 1,
		type: "openstates-profile-enrichment-result",
		archive: { ...capture, url: `https://api.github.com/repos/openstates/people/tarball/${capture.commit}`, readmeSha256: prepared.readmeSha256, members: prepared.archiveMembers, expandedBytes: prepared.archiveExpandedBytes },
		files: files.map(({ content, ...file }) => ({ ...file, sha256: digest(content) })),
		inputs: collections.map(({ source, snapshot }) => ({ sourceId: source.id, sourceConfigurationSha256: digest(JSON.stringify(source)), sourceSha256: snapshot.sourceSha256, retrievedAt: snapshot.retrievedAt, records: snapshot.recordCount })),
		profiles: files.reduce((total, file) => total + file.records, 0),
		facts: files.reduce((total, file) => total + file.facts, 0),
		roleStartDates: prepared.roleStartDates,
		professionalFacts: prepared.professionalFacts,
		professionalProfiles: prepared.professionalProfiles,
		excludedProfiles: prepared.excludedProfiles,
		complete: prepared.excludedProfiles === 0,
		holdCount: prepared.holds.length,
		publisherRequests: 0,
		imported: false,
	};
	const exports = [...files.map(({ name, content }) => ({ name, content })), { name: "openstates-profile-enrichment-result.json", content: `${JSON.stringify(manifest, null, 2)}\n` }, { name: "openstates-profile-enrichment-holds.jsonl", content: `${prepared.holds.map(hold => JSON.stringify(hold)).join("\n")}\n` }];
	exports.push({ name: "openstates-profile-enrichment-SHA256SUMS", content: `${exports.map(file => `${digest(file.content)}  ${file.name}`).join("\n")}\n` });
	await mkdir(plan.outputDirectory);
	assertExternalStateDataDirectory(await realpath(plan.outputDirectory));
	for (const file of exports) await writeFile(join(plan.outputDirectory, file.name), file.content, { flag: "wx" });
	return { outputDirectory: plan.outputDirectory as string, ...manifest };
}
