import type { StateCandidateRecord } from "./state-ballot-records.js";
import type { StateBallotSnapshot } from "./state-ballot-repository.js";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { mkdir, realpath, writeFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";
import { parse } from "csv-parse/sync";
import { readReviewedSantaFeCandidates } from "./reviewed-santa-fe-candidates.js";
import { serializeStateBallotSnapshots } from "./state-ballot-export.js";
import { extractStateBallotPdfText, resolveStateBallotPdfExtractor } from "./state-ballot-pdf.js";
import { configuredStateBallotSources, legacyReviewedStateBallotSource } from "./state-ballot-registry.js";
import { parseBundledStateSnapshot } from "./state-ballot-snapshot.js";
import { assertExternalStateDataDirectory, readBoundedStateDataBytes, serializeStoredStateSnapshot } from "./state-ballot-storage.js";

interface ReviewedDocument {
	url: string;
	path: string;
	sha256: string;
	capturedAt: string;
	pageCount: number;
	reviewedPages: number[];
}

interface PreparationPlan {
	schemaVersion: 1;
	type: "reviewed-candidate-preparation";
	sourceId: string;
	sourceConfigurationSha256: string;
	input: { path: string; sha256: string; format?: "santa-fe-master-pdf" };
	documents: ReviewedDocument[];
	outputDirectory: string;
	outputName: string;
}

const columns = ["name", "office", "party", "district", "scope", "status", "jurisdiction", "ballotDesignation", "sourceStatus", "sourceDistrictLabel", "sourceAreaLabel", "documentUrl", "page"];
const scopes = new Set(["statewide", "congressional", "state-senate", "state-house", "local"]);
const statuses = new Set(["listed", "filed", "qualified", "write-in", "withdrawn", "disqualified", "defeated", "elected", "unopposed", "inactive", "unrecognized"]);
const digest = (value: Uint8Array | string) => createHash("sha256").update(value).digest("hex");
const objectValue = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value);
const exactKeys = (value: Record<string, unknown>, keys: string[]) => Object.keys(value).sort().join(",") === [...keys].sort().join(",");
const sha256Value = (value: unknown): value is string => typeof value === "string" && /^[a-f\d]{64}$/u.test(value);
const absolutePath = (value: unknown): value is string => typeof value === "string" && isAbsolute(value) && resolve(value) === value;
const clean = (value: string) => value.replace(/\s+/gu, " ").trim();
const quote = (value: string) => `"${(/^\s*[=+@-]/u.test(value) ? `'${value}` : value).replaceAll("\"", "\"\"")}"`;

function parsePlan(value: unknown, now: number): PreparationPlan {
	if (!objectValue(value) || !exactKeys(value, ["schemaVersion", "type", "sourceId", "sourceConfigurationSha256", "input", "documents", "outputDirectory", "outputName"])
		|| value.schemaVersion !== 1 || value.type !== "reviewed-candidate-preparation" || typeof value.sourceId !== "string" || !sha256Value(value.sourceConfigurationSha256)
		|| !objectValue(value.input) || !exactKeys(value.input, value.input.format === "santa-fe-master-pdf" ? ["path", "sha256", "format"] : ["path", "sha256"]) || !absolutePath(value.input.path) || !sha256Value(value.input.sha256)
		|| !absolutePath(value.outputDirectory) || typeof value.outputName !== "string" || !/^[a-z0-9][a-z0-9-]{0,99}$/u.test(value.outputName)
		|| !Array.isArray(value.documents) || !value.documents.length || value.documents.length > 100 || !Number.isFinite(now)) {
		throw new Error("Candidate preparation requires an exact, pinned local review plan.");
	}
	for (const document of value.documents) {
		if (!objectValue(document) || !exactKeys(document, ["url", "path", "sha256", "capturedAt", "pageCount", "reviewedPages"])
			|| typeof document.url !== "string" || !absolutePath(document.path) || !sha256Value(document.sha256)
			|| typeof document.capturedAt !== "string" || !Number.isFinite(Date.parse(document.capturedAt)) || Date.parse(document.capturedAt) > now
			|| !Number.isSafeInteger(document.pageCount) || Number(document.pageCount) < 1 || Number(document.pageCount) > 2000
			|| !Array.isArray(document.reviewedPages) || !document.reviewedPages.length || new Set(document.reviewedPages).size !== document.reviewedPages.length
			|| document.reviewedPages.some(page => !Number.isSafeInteger(page) || page < 1 || page > Number(document.pageCount))) {
			throw new Error("Candidate document provenance or reviewed pages are invalid.");
		}
	}
	return value as unknown as PreparationPlan;
}

export async function prepareReviewedCandidateFiles(planPath: string, now = Date.now(), options: { extractSantaFePdf?: (bytes: Buffer) => Promise<string> } = {}) {
	if (!absolutePath(planPath)) throw new Error("Use an absolute candidate preparation plan path.");
	const plan = parsePlan(JSON.parse((await readBoundedStateDataBytes(planPath)).toString("utf8")), now);
	const configured = configuredStateBallotSources.find(source => source.id === plan.sourceId);
	const source = configured ? legacyReviewedStateBallotSource(configured) ?? configured : undefined;
	if (!source || source.format !== "reviewed-pdf" || source.retrievalPolicy !== "manual-snapshot" || source.snapshotStorage !== "external"
		|| !source.documentUrls?.length || digest(JSON.stringify(source)) !== plan.sourceConfigurationSha256
		|| plan.documents.map(document => document.url).join("\n") !== source.documentUrls.join("\n")) {
		throw new Error("Candidate preparation requires the exact configured manual PDF source and document set.");
	}
	for (const document of plan.documents) {
		const bytes = await readBoundedStateDataBytes(document.path);
		if (digest(bytes) !== document.sha256 || bytes.subarray(0, 5).toString("ascii") !== "%PDF-") throw new Error("Candidate source PDF bytes do not match their review.");
	}
	const input = await readBoundedStateDataBytes(plan.input.path);
	if (digest(input) !== plan.input.sha256) throw new Error("Candidate input bytes do not match their review.");
	let native: ReturnType<typeof readReviewedSantaFeCandidates> | undefined;
	if (plan.input.format === "santa-fe-master-pdf") {
		const master = plan.documents[0]!;
		if (source.stateCode !== "NM" || source.id !== `nm-santa-fe-samples-${source.electionDate.slice(0, 4)}` || master.url !== source.url || master.path !== plan.input.path || master.sha256 !== plan.input.sha256 || master.url !== `https://www.santafecountynm.gov/uploads/documents/GENERAL_${source.electionDate.slice(0, 4)}-Master_Ballot_List.pdf`) throw new Error("Native Santa Fe preparation requires its exact reviewed master PDF.");
		const extract = options.extractSantaFePdf ?? (async (bytes: Buffer) => extractStateBallotPdfText(bytes, await resolveStateBallotPdfExtractor(), undefined, "raw-bbox", 100));
		native = readReviewedSantaFeCandidates(await extract(input), source.electionDate);
		if (native.pageCount !== master.pageCount || native.evidence.some(item => !master.reviewedPages.includes(item.page))) throw new Error("The Santa Fe master requires the exact page count and reviewed candidate pages.");
	}
	const rows = native
		? []
		: parse(input, {
			bom: true,
			skip_empty_lines: true,
			columns(header: string[]) {
				if (header.length !== columns.length || new Set(header).size !== header.length || [...header].sort().join(",") !== [...columns].sort().join(",")) throw new Error("Candidate review CSV permits only the exact public-data and provenance columns.");
				return header;
			},
		}) as Record<string, string>[];
	if (!native && (!rows.length || rows.length > 25_000)) throw new Error("Candidate review CSV has an invalid record count.");
	const evidence = native
		? native.evidence.map(item => ({ ...item, document: plan.documents[0]!, row: null }))
		: rows.map((row, index) => {
				const document = plan.documents.find(document => document.url === row.documentUrl);
				if (!document || !/^[1-9]\d{0,3}$/u.test(row.page!) || !document.reviewedPages.includes(Number(row.page))) throw new Error("Each candidate requires an exact reviewed source page.");
				const values = Object.fromEntries(columns.map(column => [column, clean(row[column]!)]));
				if (!values.name || values.name.length > 250 || !values.office || values.office.length > 300 || values.district!.length > 40
					|| !scopes.has(values.scope!) || !statuses.has(values.status!) || (values.scope === "statewide" && values.district)
					|| columns.filter(column => !["name", "office", "district", "documentUrl", "page"].includes(column)).some(column => values[column]!.length > 300)) {
					throw new Error("Candidate review rows require explicit bounded identity, scope and status fields.");
				}
				const identity = [source.id, source.stateCode, source.electionDate, ...[values.name, values.office, values.party, values.district, values.scope, values.jurisdiction, values.ballotDesignation].map(value => value!.toLocaleLowerCase("en-US"))];
				const record: StateCandidateRecord = { id: digest(JSON.stringify(identity)).slice(0, 24), name: values.name, office: values.office, district: values.district!, scope: values.scope as StateCandidateRecord["scope"], status: values.status as StateCandidateRecord["status"] };
				for (const column of ["party", "jurisdiction", "ballotDesignation", "sourceStatus", "sourceDistrictLabel", "sourceAreaLabel"] as const) {
					if (values[column]) record[column] = values[column];
				}
				return { record, document, page: Number(row.page), row: index + 1 };
			});
	const records = evidence.map(item => item.record);
	if (new Set(records.map(record => record.id)).size !== records.length) throw new Error("Candidate review CSV has duplicate contest identities; review rather than silently merging them.");
	const documents = plan.documents.map(document => ({ url: document.url, sha256: document.sha256, retrievedAt: document.capturedAt, includedRecordCount: evidence.filter(item => item.document === document).length }));
	const retrievedAt = new Date(Math.min(...documents.map(document => Date.parse(document.retrievedAt)))).toISOString();
	const snapshot: StateBallotSnapshot = { source, retrievedAt, sha256: digest(JSON.stringify(documents.map(({ url, sha256 }) => ({ url, sha256 })))), records, documents };
	const snapshotBody = serializeStoredStateSnapshot(snapshot);
	parseBundledStateSnapshot(source, snapshotBody);
	assertExternalStateDataDirectory(plan.outputDirectory);
	const parent = await realpath(dirname(plan.outputDirectory));
	if (join(parent, basename(plan.outputDirectory)) !== plan.outputDirectory) throw new Error("Candidate output must use a canonical external directory without linked parents.");
	assertExternalStateDataDirectory(parent);
	const provenanceColumns = ["sourceId", "recordId", "name", "office", "district", "scope", "party", "jurisdiction", "ballotDesignation", "status", "sourceStatus", "sourceUrl", "pageUrl", "page", "documentSha256", "capturedAt", "personalAssignmentVerified"];
	const provenance = evidence.map(item => [source.id, item.record.id, item.record.name, item.record.office, item.record.district, item.record.scope, item.record.party ?? "", item.record.jurisdiction ?? "", item.record.ballotDesignation ?? "", item.record.status, item.record.sourceStatus ?? "", item.document.url, `${item.document.url}#page=${item.page}`, String(item.page), item.document.sha256, item.document.capturedAt, "false"]);
	const review = { schemaVersion: 1, type: "reviewed-candidate-preparation-review", sourceId: source.id, sourceConfigurationSha256: plan.sourceConfigurationSha256, electionDate: source.electionDate, createdAt: new Date(now).toISOString(), originalCaptureTimesRetained: true, recordCount: records.length, documents: plan.documents.map(document => ({ url: document.url, sha256: document.sha256, capturedAt: document.capturedAt, pageCount: document.pageCount, reviewedPages: document.reviewedPages })), claims: evidence.map(item => ({ recordId: item.record.id, sourceUrl: item.document.url, page: item.page, csvRow: item.row })), publicationApproved: false, automaticImportApproved: false, personalAssignmentVerified: false };
	const contents = new Map([
		[`${plan.outputName}.snapshot.json`, `${snapshotBody}\n`],
		[`${plan.outputName}.records.ndjson`, serializeStateBallotSnapshots([snapshot])],
		[`${plan.outputName}.provenance.csv`, `${[provenanceColumns, ...provenance].map(row => row.map(quote).join(",")).join("\r\n")}\r\n`],
		[`${plan.outputName}.review.json`, `${JSON.stringify(review, null, 2)}\n`],
	]);
	const manifest = { schemaVersion: 1, type: "reviewed-candidate-preparation-manifest", sourceId: source.id, sourceConfigurationSha256: plan.sourceConfigurationSha256, electionDate: source.electionDate, createdAt: new Date(now).toISOString(), retrievedAt, inputSha256: plan.input.sha256, recordCount: records.length, sourceSha256: snapshot.sha256, files: [...contents].map(([name, body]) => ({ name, sha256: digest(body), bytes: Buffer.byteLength(body) })), publicationApproved: false, automaticImportApproved: false, imported: false, published: false, publisherRequests: 0 };
	contents.set(`${plan.outputName}.manifest.json`, `${JSON.stringify(manifest, null, 2)}\n`);
	contents.set(`${plan.outputName}-SHA256SUMS`, `${[...contents].map(([name, body]) => `${digest(body)}  ${name}`).join("\n")}\n`);
	await mkdir(plan.outputDirectory);
	for (const [name, body] of contents) await writeFile(join(plan.outputDirectory, name), body, { flag: "wx" });
	return { sourceId: source.id, recordCount: records.length, outputDirectory: plan.outputDirectory, files: [...contents.keys()], publicationApproved: false, automaticImportApproved: false, imported: false, published: false, publisherRequests: 0 };
}
