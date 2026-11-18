import type { ElectionReferenceSnapshot } from "./election-references.js";
import type { ParishReferenceCatalog, ParishReferencePublication } from "./louisiana-parish-reference-catalog.js";
import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";
import { mkdir, open } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import process from "node:process";
import { prepareLouisianaParishSamples } from "./collect-louisiana-parish-samples.js";
import { electionReferenceDocumentDigest, parseElectionReferenceSnapshot } from "./election-references.js";
import { parishReferenceSource, parseParishReferenceCatalog } from "./louisiana-parish-reference-catalog.js";
import { parishSampleHash as hash, parishSampleIndexUrl } from "./louisiana-parish-samples.js";
import { acquireStateBallotAutomationLock } from "./state-ballot-automation-lock.js";
import { readBoundedStateDataBytes } from "./state-ballot-storage.js";

export interface ParishCandidateReference {
	parish: string;
	electionDate: string;
	id: string;
	name: string;
	office: string;
	statedParty: string;
	sourcePage: number;
	voteFor?: number;
	sourceStatus: string;
	sourceUrl: string;
	sourceSha256: string;
	capturedAt: string;
}

export function buildParishReferenceCollection(electionDate: string, publication: ParishReferencePublication, references: ParishCandidateReference[]) {
	const source = parishReferenceSource(electionDate, publication);
	if (!references.length || references.length > 1000 || new Set(references.map(reference => reference.id)).size !== references.length) throw new Error("Parish reference identities require review.");
	const first = references[0]!;
	const records: ElectionReferenceSnapshot["records"] = references.map((reference) => {
		if (reference.parish !== publication.parish || reference.electionDate !== electionDate || reference.sourceUrl !== publication.url || reference.sourceSha256 !== first.sourceSha256 || reference.capturedAt !== first.capturedAt || reference.sourceStatus !== "unofficial-reference" || !publication.pages.includes(reference.sourcePage) || ![
			"Democrat",
			"Republican",
			"No Party",
			"Libertarian",
			"Green",
			"Other"
		].includes(reference.statedParty) || (reference.voteFor !== undefined && (!Number.isSafeInteger(reference.voteFor) || reference.voteFor < 1 || reference.voteFor > 99)) || reference.id !== hash(`${reference.parish}\n${electionDate}\n${reference.office}\n${reference.name}\n${reference.statedParty}`).slice(0, 24)) {
			throw new Error("Parish reference fields or source provenance changed.");
		}
		return {
			id: reference.id,
			name: reference.name,
			office: reference.office,
			scope: /^U\.\s*S\.\s*Representative,/u.test(reference.office)
				? "congressional"
				: reference.office.startsWith("State Senator,")
					? "state-senate"
					: "local",
			facts: [
				`Party: ${reference.statedParty}`,
				...(reference.voteFor === undefined
					? []
					: [`Seats to fill: ${reference.voteFor}`])
			],
			sourceDocumentIndex: publication.pages.indexOf(reference.sourcePage)
		};
	});
	const documents = source.documents.map((document, index) => ({
		url: document.url,
		sha256: first.sourceSha256,
		capturedAt: first.capturedAt,
		includedRecordCount: records.filter(record => record.sourceDocumentIndex === index).length
	}));
	if (documents.some(document => !document.includedRecordCount)) throw new Error("Parish reference pages must contribute retained records.");
	const snapshot: ElectionReferenceSnapshot = {
		schemaVersion: 1,
		type: "election-references",
		stateCode: "LA",
		sourceId: source.id,
		electionDate,
		retrievedAt: first.capturedAt,
		sourceSha256: electionReferenceDocumentDigest(documents),
		recordCount: records.length,
		documents,
		records
	};
	parseElectionReferenceSnapshot(source, JSON.stringify(snapshot));
	return { source, snapshot };
}

async function persist(directory: string, name: string, value: unknown) {
	const body = `${JSON.stringify(value, null, 2)}\n`;
	const handle = await open(join(directory, name), "wx", 0o600);
	try {
		await handle.writeFile(body);
		await handle.sync();
	}
	finally { await handle.close(); }
	return {
		path: name,
		bytes: Buffer.byteLength(body),
		sha256: hash(body)
	};
}

export async function prepareLouisianaParishReferences(path: string, options: Parameters<typeof prepareLouisianaParishSamples>[1] = {}) {
	const plan = JSON.parse((await readBoundedStateDataBytes(path, 32768)).toString("utf8"));
	if (!plan || typeof plan !== "object" || Array.isArray(plan) || Object.keys(plan).sort().join(",") !== "captures,outputRoot,schemaVersion,type" || plan.schemaVersion !== 1 || plan.type !== "louisiana-parish-reference-preparation" || typeof plan.outputRoot !== "string" || !Array.isArray(plan.captures) || !plan.captures.length || plan.captures.length > 25 || plan.captures.some((pin: { path: string; sha256: string }) => !pin || Object.keys(pin).sort().join(",") !== "path,sha256" || typeof pin.path !== "string" || !isAbsolute(pin.path) || typeof pin.sha256 !== "string" || !/^[a-f0-9]{64}$/u.test(pin.sha256)) || new Set(plan.captures.map((pin: { path: string }) => pin.path)).size !== plan.captures.length) throw new Error("Provide distinct pinned parish captures and an external output root.");
	const lock = await acquireStateBallotAutomationLock(plan.outputRoot);
	try {
		const outputDirectory = join(lock.directory, `references-${randomUUID()}`);
		await mkdir(outputDirectory, { mode: 0o700 });
		const selected = new Map<string, { electionDate: string; parish: string; clock: string; references: ParishCandidateReference[]; captureSha256: string; status: string; reason?: string }>();
		const preparations = [];
		for (const [index, pin] of plan.captures.entries()) {
			const preparationPlan = await persist(outputDirectory, `prepare-${index + 1}.json`, {
				schemaVersion: 1,
				type: "louisiana-parish-sample-research-preparation",
				capturePath: pin.path,
				captureSha256: pin.sha256,
				outputRoot: join(outputDirectory, "native")
			});
			const prepared = await prepareLouisianaParishSamples(join(outputDirectory, preparationPlan.path), options);
			const report = JSON.parse((await readBoundedStateDataBytes(join(prepared.outputDirectory, "preparation.json"), 4 * 1024 * 1024)).toString("utf8"));
			preparations.push({ captureSha256: pin.sha256, preparationSha256: prepared.preparationSha256 });
			const clock = report.inputs.find((input: { url: string }) => input.url === parishSampleIndexUrl)?.capturedAt;
			if (typeof clock !== "string" || !Number.isFinite(Date.parse(clock))) throw new TypeError("Parish reference catalog has no original capture clock.");
			for (const result of report.preparation) {
				const key = `${report.catalog.electionDate}:${result.parish}`;
				const previous = selected.get(key);
				if (previous && previous.clock === clock && previous.captureSha256 !== pin.sha256) throw new Error("Parish captures conflict at the same source clock.");
				if (previous && previous.clock >= clock) continue;
				selected.set(key, {
					electionDate: report.catalog.electionDate,
					parish: result.parish,
					clock,
					references: report.references.filter((reference: ParishCandidateReference) => reference.parish === result.parish),
					captureSha256: pin.sha256,
					status: result.status,
					...(result.reason
						? { reason: result.reason }
						: {})
				});
			}
		}
		const catalog: ParishReferenceCatalog = { schemaVersion: 1, type: "louisiana-parish-reference-catalog", editions: [] };
		const collections = [];
		const holds = [];
		for (const entry of [
			...selected.values()
		].sort((first, second) => `${first.electionDate}:${first.parish}`.localeCompare(`${second.electionDate}:${second.parish}`))) {
			if (entry.status !== "prepared" || !entry.references.length) {
				holds.push({
					electionDate: entry.electionDate,
					parish: entry.parish,
					status: entry.status,
					reason: entry.reason ?? "no-candidate-references",
					sourceCaptureSha256: entry.captureSha256
				});
				continue;
			}
			const publication = {
				parish: entry.parish,
				url: entry.references[0]!.sourceUrl,
				pages: [
					...new Set(entry.references.map(reference => reference.sourcePage))
				].sort((first, second) => first - second)
			};
			const { source, snapshot } = buildParishReferenceCollection(entry.electionDate, publication, entry.references);
			let edition = catalog.editions.find(edition => edition.electionDate === entry.electionDate);
			if (!edition) catalog.editions.push(edition = { electionDate: entry.electionDate, publications: [] });
			edition.publications.push(publication);
			collections.push({
				source,
				file: await persist(outputDirectory, `${source.id}.json`, snapshot),
				records: snapshot.recordCount,
				sourceCaptureSha256: entry.captureSha256,
				evidence: entry.references
			});
		}
		if (!collections.length) throw new Error("No prepared parish candidate references are available.");
		parseParishReferenceCatalog(catalog);
		const catalogFile = await persist(outputDirectory, "catalog.json", catalog);
		const review = {
			schemaVersion: 1,
			type: "louisiana-parish-reference-review",
			preparations,
			catalogFile,
			collections,
			holds,
			records: collections.reduce((total, collection) => total + collection.records, 0),
			publisherRequests: 0,
			official: false,
			officialQualificationVerified: false,
			personalApplicabilityVerified: false,
			automaticImportApproved: false,
			imported: false,
			publicationApproved: false
		};
		const reviewFile = await persist(outputDirectory, "review.json", review);
		return {
			outputDirectory,
			collections: collections.length,
			records: review.records,
			heldParishes: holds.length,
			catalogSha256: catalogFile.sha256,
			reviewSha256: reviewFile.sha256,
			publisherRequests: 0,
			imported: false,
			publicationApproved: false
		};
	}
	finally { await lock.release(); }
}

if (process.argv[1]?.endsWith("prepare-louisiana-parish-references.ts") || process.argv[1]?.endsWith("prepare-louisiana-parish-references.js")) {
	const [path, ...extra] = process.argv.slice(2);
	if (!path || extra.length) {
		console.error("Use prepare-louisiana-parish-references PLAN.json.");
		process.exitCode = 1;
	}
	else {
		prepareLouisianaParishReferences(path).then(result => console.log(JSON.stringify(result))).catch((error: unknown) => {
			console.error(error instanceof Error
				? error.message
				: "Parish reference preparation failed.");
			process.exitCode = 1;
		});
	}
}
