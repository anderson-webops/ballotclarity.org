import type { Buffer } from "node:buffer";
import type { StateCandidateRecord } from "./state-ballot-records.js";
import type { UnionChoiceContext } from "./union-ballot-choice-context.js";
import type { UnionSampleCatalog, UnionSampleDocument } from "./union-county-ballots.js";
import { randomUUID } from "node:crypto";
import { mkdir, open } from "node:fs/promises";
import { join } from "node:path";
import process from "node:process";
import { loadUnionBallotCaptures } from "./prepare-union-ballot-corroboration.js";
import { acquireStateBallotAutomationLock } from "./state-ballot-automation-lock.js";
import { extractStateBallotPdfText, resolveStateBallotPdfExtractor } from "./state-ballot-pdf.js";
import { createStateCandidateRecord } from "./state-ballot-records.js";
import { parseBundledStateSnapshot } from "./state-ballot-snapshot.js";
import { readBoundedStateDataBytes } from "./state-ballot-storage.js";
import { unionSampleSource } from "./state-ballot-union-source.js";
import { readUnionChoiceContext } from "./union-ballot-choice-context.js";
import { unionCandidateHash as hash } from "./union-county-candidates.js";

interface Sample { document: UnionSampleDocument; sha256: string; capturedAt: string; cells: UnionChoiceContext[] }
type Extract = (body: Buffer, format: "layout" | "bbox-layout") => Promise<string>;
const canonical = (value: string) => value.normalize("NFKC").toLocaleUpperCase("en-US").replace(/[^\p{L}\p{N}]/gu, "");
const quote = (value: unknown) => `"${String(value).replace(/^(\s*[=+@-])/u, "'$1").replaceAll("\"", "\"\"")}"`;
async function persist(directory: string, name: string, body: string) {
	const handle = await open(join(directory, name), "wx", 0o600);
	try {
		await handle.writeFile(body);
		await handle.sync();
	}
	finally { await handle.close(); }
}

export function buildUnionCandidateSnapshot(catalog: UnionSampleCatalog, samples: Sample[]) {
	const source = unionSampleSource(catalog);
	if (samples.length !== catalog.documents.length || new Set(samples.map(sample => sample.document.form)).size !== samples.length) throw new Error("Union candidate preparation requires every published sample exactly once.");
	const records = new Map<string, StateCandidateRecord>();
	const evidence: { recordId: string; form: number; page: number; position: string; panel: string; printedName: string; printedOffice: string; printedPartyOrColumn: string; printedSelections: string[]; publishedLabels: UnionSampleDocument["claims"]; sourceUrl: string; sourceSha256: string; capturedAt: string }[] = [];
	const documents = catalog.documents.map((document) => {
		const sample = samples.find(item => item.document.form === document.form)!;
		if (!sample || JSON.stringify(sample.document) !== JSON.stringify(document) || !/^[a-f0-9]{64}$/u.test(sample.sha256) || !Number.isFinite(Date.parse(sample.capturedAt)) || !sample.cells.length || sample.cells.length > 2000) throw new Error("Union candidate sample provenance requires review.");
		const municipalities = [...new Set(document.claims.map(claim => claim.municipality))];
		if (municipalities.length !== 1) throw new Error("Union sample municipal scope requires review.");
		let includedRecordCount = 0;
		const positions = new Set<string>();
		for (const cell of sample.cells) {
			const positionKey = `${cell.panel}:${cell.position}`;
			if (positions.has(positionKey)) throw new Error("Union sample positions repeat within an office panel.");
			positions.add(positionKey);
			if (!cell.observedName || ["NONOMINATIONMADE", "NOPETITIONFILED", "WRITEIN"].includes(canonical(cell.observedName))) continue;
			const officeKey = canonical(cell.printedOffice);
			const senate = officeKey === "UNITEDSTATESSENATOR";
			const house = officeKey === "MEMBEROFHOUSEOFREPRESENTATIVES";
			const county = ["SHERIFF", "COUNTYCLERK", "MEMBERSOFBOARDOFCOUNTYCOMMISSIONERS"].includes(officeKey);
			if (house && (!Number.isSafeInteger(cell.congressionalDistrict) || !cell.congressionalDistrict)) throw new Error("Union congressional sample is missing its printed district.");
			const party = ["Democrat", "Republican", "Non-Partisan"].includes(cell.printedPartyOrColumn) ? cell.printedPartyOrColumn : undefined;
			if (!party && !["", "Nomination by Petition"].includes(cell.printedPartyOrColumn)) throw new Error("Union candidate party column requires review.");
			const office = house ? `${cell.printedOffice} - District ${cell.congressionalDistrict}` : cell.printedOffice;
			const record = createStateCandidateRecord(source, { name: cell.observedName, office, party: party ?? "", status: "listed", scope: senate ? "statewide" : house ? "congressional" : "local", district: house ? String(cell.congressionalDistrict) : "", jurisdiction: county ? "Union County" : municipalities[0], sourceCandidateId: positionKey, sourceAreaLabel: senate || house || county ? "Union County" : municipalities[0], sourceDistrictLabel: cell.printedOffice });
			if (!record) throw new Error("Union candidate record requires review.");
			record.ballotDesignation = [...cell.printedSelections, ...(cell.printedPartyOrColumn === "Nomination by Petition" ? [cell.printedPartyOrColumn] : [])].join("; ");
			const previous = records.get(record.id);
			if (previous && JSON.stringify(previous) !== JSON.stringify(record)) throw new Error("Union samples disagree about a retained candidate record.");
			if (!previous) {
				records.set(record.id, record);
				includedRecordCount += 1;
			}
			evidence.push({ recordId: record.id, form: document.form, page: cell.page, position: cell.position, panel: cell.panel, printedName: cell.observedName, printedOffice: cell.printedOffice, printedPartyOrColumn: cell.printedPartyOrColumn, printedSelections: cell.printedSelections, publishedLabels: document.claims, sourceUrl: document.url, sourceSha256: sample.sha256, capturedAt: sample.capturedAt });
		}
		return { url: document.url, sha256: sample.sha256, retrievedAt: sample.capturedAt, includedRecordCount };
	});
	const snapshot = { schemaVersion: 1, stateCode: "NJ", sourceId: source.id, electionDate: source.electionDate, sourceUrl: source.pageUrl, retrievalPolicy: "manual-snapshot", retrievedAt: new Date(Math.min(...documents.map(document => Date.parse(document.retrievedAt)))).toISOString(), sourceSha256: hash(JSON.stringify(documents.map(({ url, sha256 }) => ({ url, sha256 })))), recordCount: records.size, records: [...records.values()], documents };
	parseBundledStateSnapshot(source, JSON.stringify(snapshot));
	return { source, snapshot, evidence };
}

export async function prepareUnionCandidateSnapshot(path: string, options: { extract?: Extract; now?: () => number } = {}) {
	const plan = JSON.parse((await readBoundedStateDataBytes(path, 32768)).toString("utf8"));
	if (!plan || typeof plan !== "object" || Array.isArray(plan) || Object.keys(plan).sort().join(",") !== "ballotCaptures,outputRoot,schemaVersion,type" || plan.schemaVersion !== 1 || plan.type !== "union-candidate-snapshot-preparation" || typeof plan.outputRoot !== "string") throw new Error("Provide an exact Union candidate snapshot preparation plan.");
	const { catalog, originals, batches } = await loadUnionBallotCaptures(plan.ballotCaptures, (options.now ?? Date.now)());
	const extract: Extract = options.extract ?? (async (body, format) => extractStateBallotPdfText(body, await resolveStateBallotPdfExtractor(), undefined, format));
	const samples: Sample[] = [];
	for (const original of originals) samples.push({ document: original.document, sha256: original.metadata.sha256, capturedAt: original.metadata.capturedAt, cells: readUnionChoiceContext(await extract(original.body, "bbox-layout"), await extract(original.body, "layout"), original.document, catalog.edition.electionDate) });
	const prepared = buildUnionCandidateSnapshot(catalog, samples);
	const columns = ["recordId", "form", "page", "position", "panel", "printedName", "printedOffice", "printedPartyOrColumn", "printedSelections", "publishedLabels", "sourceUrl", "sourceSha256", "capturedAt"] as const;
	const csv = `${columns.map(quote).join(",")}\n${prepared.evidence.map(row => columns.map(column => quote(typeof row[column] === "object" ? JSON.stringify(row[column]) : row[column])).join(",")).join("\n")}\n`;
	const body = `${JSON.stringify(prepared.snapshot, null, 2)}\n`;
	const review = { schemaVersion: 1, type: "union-candidate-snapshot-review", source: prepared.source, catalogSha256: catalog.sha256, ballotCaptureHashes: batches.map(batch => batch.pin.sha256), candidateSnapshotSha256: hash(body), evidenceCsvSha256: hash(csv), records: prepared.snapshot.recordCount, sourceOccurrences: prepared.evidence.length, evidence: prepared.evidence, publisherRequests: 0, originalClocksRetained: true, identitiesMergedWithEarlierLists: false, qualificationVerified: false, voterApplicabilityVerified: false, imported: false, publicationApproved: false, automaticImportApproved: false };
	const lock = await acquireStateBallotAutomationLock(plan.outputRoot);
	try {
		const outputDirectory = join(lock.directory, `prepared-${randomUUID()}`);
		await mkdir(outputDirectory, { mode: 0o700 });
		await persist(outputDirectory, `${prepared.source.id}.json`, body);
		await persist(outputDirectory, "source.json", `${JSON.stringify(prepared.source, null, 2)}\n`);
		await persist(outputDirectory, "candidate-evidence.csv", csv);
		await persist(outputDirectory, "review.json", `${JSON.stringify(review, null, 2)}\n`);
		return { outputDirectory, sourceId: prepared.source.id, records: prepared.snapshot.recordCount, sourceOccurrences: prepared.evidence.length, sha256: hash(body), publisherRequests: 0, imported: false, publicationApproved: false };
	}
	finally { await lock.release(); }
}

if (process.argv[1]?.endsWith("prepare-union-candidate-snapshot.ts") || process.argv[1]?.endsWith("prepare-union-candidate-snapshot.js")) {
	const [path, ...extra] = process.argv.slice(2);
	if (!path || extra.length) {
		console.error("Use prepare-union-candidate-snapshot PLAN.json.");
		process.exitCode = 1;
	}
	else {
		prepareUnionCandidateSnapshot(path).then(result => console.log(JSON.stringify(result))).catch((error: unknown) => {
			console.error(error instanceof Error ? error.message : "Union candidate snapshot preparation failed.");
			process.exitCode = 1;
		});
	}
}
