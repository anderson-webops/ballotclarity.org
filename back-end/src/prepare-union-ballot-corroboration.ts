import type { UnionBallotCell } from "./union-ballot-witnesses.js";
import type { UnionCandidateReference } from "./union-county-candidates.js";
import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";
import { mkdir, open } from "node:fs/promises";
import { dirname, join } from "node:path";
import process from "node:process";
import { acquireStateBallotAutomationLock } from "./state-ballot-automation-lock.js";
import { extractStateBallotPdfText, resolveStateBallotPdfExtractor } from "./state-ballot-pdf.js";
import { readBoundedStateDataBytes } from "./state-ballot-storage.js";
import { readUnionBallotCells, reconcileUnionBallotReferences } from "./union-ballot-witnesses.js";
import { readUnionSampleCatalog, readUnionSampleEdition, unionCountyPolicyHash, unionCountyPolicyUrls, unionSampleLandingUrl } from "./union-county-ballots.js";
import { unionCandidateHash as hash, unionCandidatePolicyHash, unionCandidatePolicyUrls } from "./union-county-candidates.js";

interface Pin { path: string; sha256: string }
interface Input { role: string; url: string; sha256: string; path: string; requestedAt: string; capturedAt: string; bytes: number }
type Extract = (body: Buffer, format: "layout" | "bbox-layout") => Promise<string>;
const native: Extract = async (bytes, format) => extractStateBallotPdfText(bytes, await resolveStateBallotPdfExtractor(), undefined, format);
const exact = (value: unknown, keys: string[]): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).sort().join(",") === [...keys].sort().join(","));
const validHash = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
const quote = (value: unknown) => `"${String(value).replace(/^(\s*[=+@-])/u, "'$1").replaceAll("\"", "\"\"")}"`;
async function pinned(value: unknown) {
	if (!exact(value, ["path", "sha256"]) || typeof value.path !== "string" || !validHash(value.sha256)) throw new Error("Provide an exact Union evidence pin.");
	const body = await readBoundedStateDataBytes(value.path);
	if (hash(body) !== value.sha256) throw new Error("Union pinned evidence changed.");
	return { path: value.path, sha256: value.sha256, body };
}
async function capture(pin: Pin, now: number) {
	const original = await pinned(pin);
	const report = JSON.parse(original.body.toString("utf8"));
	if (report.schemaVersion !== 1 || report.type !== "union-sample-ballot-capture" || !Array.isArray(report.inputs) || report.inputs.length < 8 || report.inputs.length > 32 || !Array.isArray(report.selected) || report.selected.length < 1 || report.selected.length > 25 || !exact(report.accessReview, ["unionRobots", "unionPrivacy", "countyRobots", "countyPrivacy"]) || Object.values(report.accessReview).some(value => !validHash(value))) throw new Error("Union sample capture manifest requires review.");
	const inputs: { metadata: Input; body: Buffer }[] = [];
	let bytes = 0;
	for (const value of report.inputs) {
		if (!exact(value, ["role", "url", "sha256", "path", "bytes", "requestedAt", "capturedAt"]) || typeof value.role !== "string" || !/^(?:union-robots|county-robots|county-home|county-privacy|union-privacy|sample-landing|sample-edition|form-[1-9]\d?)$/u.test(value.role) || typeof value.url !== "string" || !validHash(value.sha256) || ![`${value.sha256}.pdf`, `${value.sha256}.txt`].includes(String(value.path)) || !Number.isSafeInteger(value.bytes) || Number(value.bytes) < 1 || Number(value.bytes) > 12 * 1024 * 1024 || typeof value.requestedAt !== "string" || typeof value.capturedAt !== "string" || ![value.requestedAt, value.capturedAt].every(clock => Number.isFinite(Date.parse(clock)) && new Date(clock).toISOString() === clock && Date.parse(clock) <= now) || Date.parse(value.requestedAt) > Date.parse(value.capturedAt) || inputs.some(input => input.metadata.role === value.role || input.metadata.url === value.url)) throw new Error("Union captured source identity or clock requires review.");
		const body = await readBoundedStateDataBytes(join(dirname(original.path), String(value.path)));
		if (body.length !== value.bytes || hash(body) !== value.sha256) throw new Error("Union original sample bytes changed.");
		bytes += body.length;
		if (bytes > 64 * 1024 * 1024) throw new Error("Union sample capture exceeds its size limit.");
		inputs.push({ metadata: value as unknown as Input, body });
	}
	const sourceText = (role: string) => inputs.find(input => input.metadata.role === role)?.body.toString("utf8") ?? "";
	const edition = readUnionSampleEdition(sourceText("sample-landing"));
	const catalog = readUnionSampleCatalog(sourceText("sample-edition"), edition);
	if (JSON.stringify(catalog) !== JSON.stringify(report.catalog) || new Set(report.selected.map((document: { form: number }) => document.form)).size !== report.selected.length || report.selected.some((document: { form: number }) => JSON.stringify(catalog.documents.find(item => item.form === document.form)) !== JSON.stringify(document))) throw new Error("Union sample catalog or selected forms changed.");
	const expected = [
		["union-robots", unionCandidatePolicyUrls[0]],
		["county-robots", unionCountyPolicyUrls[0]],
		["county-home", unionCountyPolicyUrls[1]],
		["county-privacy", unionCountyPolicyUrls[2]],
		["union-privacy", unionCandidatePolicyUrls[1]],
		["sample-landing", unionSampleLandingUrl],
		["sample-edition", catalog.edition.url],
		...report.selected.map((document: { form: number; url: string }) => [`form-${document.form}`, document.url]),
	];
	if (inputs.map(input => `${input.metadata.role}\t${input.metadata.url}`).join("\n") !== expected.map(([role, url]) => `${role}\t${url}`).join("\n")) throw new Error("Union source inventory changed.");
	for (const [kind, role, field] of [["robots", "union-robots", "unionRobots"], ["privacy", "union-privacy", "unionPrivacy"]] as const) {
		if (unionCandidatePolicyHash(sourceText(role), kind) !== report.accessReview[field]) throw new Error("Union election source policy changed.");
	}
	for (const [kind, role, field] of [["robots", "county-robots", "countyRobots"], ["privacy", "county-privacy", "countyPrivacy"]] as const) {
		if (unionCountyPolicyHash(sourceText(role), kind) !== report.accessReview[field]) throw new Error("Union document-host policy changed.");
	}
	unionCountyPolicyHash(sourceText("county-home"), "home");
	const samples = catalog.documents.filter(document => report.selected.some((selected: { form: number }) => selected.form === document.form)).map((document) => {
		const input = inputs.find(input => input.metadata.role === `form-${document.form}`)!;
		if (!input.body.subarray(0, 5).equals(Buffer.from("%PDF-"))) throw new Error("Union sample is not a PDF.");
		return { document, ...input };
	});
	return { pin: { path: original.path, sha256: original.sha256 }, catalog, samples, timings: inputs.map(input => input.metadata) };
}
export async function loadUnionBallotCaptures(pins: unknown, now: number) {
	if (!Array.isArray(pins) || !pins.length || pins.length > 5 || !Number.isFinite(now)) throw new Error("Provide bounded Union ballot capture pins and a valid clock.");
	const batches = [];
	for (const pin of pins) batches.push(await capture(pin as Pin, now));
	const completed = new Map<string, number>();
	for (const input of batches.flatMap(batch => batch.timings)) {
		const host = new URL(input.url).hostname;
		if (Date.parse(input.requestedAt) - (completed.get(host) ?? -Infinity) < (host === "unioncountyvotes.com" ? 30000 : 1000)) throw new Error("Union captured request spacing requires review.");
		completed.set(host, Date.parse(input.capturedAt));
	}
	const catalog = batches[0]!.catalog;
	if (batches.some(batch => batch.catalog.sha256 !== catalog.sha256)) throw new Error("Union source catalogs differ between batches.");
	const originals = batches.flatMap(batch => batch.samples);
	if (new Set(originals.map(input => input.document.form)).size !== originals.length || originals.length !== catalog.documents.length || originals.some(input => !catalog.documents.some(document => document.form === input.document.form))) throw new Error("Union ballot preparation requires the complete exact sample set.");
	return { batches, catalog, originals };
}
async function persist(directory: string, name: string, body: string) {
	const handle = await open(join(directory, name), "wx", 0o600);
	try {
		await handle.writeFile(body);
		await handle.sync();
	}
	finally { await handle.close(); }
}
export async function prepareUnionBallotCorroboration(path: string, options: { extract?: Extract; now?: () => number } = {}) {
	const plan = JSON.parse((await readBoundedStateDataBytes(path, 32768)).toString("utf8"));
	if (!exact(plan, ["schemaVersion", "type", "candidatePreparation", "ballotCaptures", "outputRoot"]) || plan.schemaVersion !== 1 || plan.type !== "union-ballot-corroboration" || typeof plan.outputRoot !== "string" || !Array.isArray(plan.ballotCaptures) || !plan.ballotCaptures.length || plan.ballotCaptures.length > 5) throw new Error("Provide an exact Union ballot corroboration plan.");
	const now = (options.now ?? Date.now)();
	if (!Number.isFinite(now)) throw new Error("Union evidence preparation clock is invalid.");
	const parent = await pinned(plan.candidatePreparation);
	const candidates = JSON.parse(parent.body.toString("utf8"));
	const keys = ["stateCode", "publicationCounty", "kind", "electionDate", "page", "position", "name", "office", "jurisdictionLabel", "partyCode", "termLabel", "sourceAsOfDate", "sourceUrl", "sourceSha256", "capturedAt"];
	if (candidates.schemaVersion !== 1 || candidates.type !== "union-candidate-research-preparation" || candidates.publicationApproved !== false || candidates.qualificationVerified !== false || !Array.isArray(candidates.references) || !candidates.references.length || candidates.references.length > 2000 || candidates.references.some((reference: unknown) => !exact(reference, keys) || reference.stateCode !== "NJ" || reference.publicationCounty !== "Union County" || keys.filter(key => key !== "page").some(key => typeof reference[key] !== "string" || String(reference[key]).length > 1000) || !Number.isSafeInteger(reference.page) || Number(reference.page) < 1 || !validHash(reference.sourceSha256) || !Number.isFinite(Date.parse(String(reference.capturedAt))) || Date.parse(String(reference.capturedAt)) > now)) throw new Error("Union candidate-reference evidence requires review.");
	const { batches, catalog, originals } = await loadUnionBallotCaptures(plan.ballotCaptures, now);
	const samples: { form: number; cells: UnionBallotCell[]; sourceUrl: string; sourceSha256: string; capturedAt: string }[] = [];
	for (const input of originals) {
		const extract = options.extract ?? native;
		const cells = readUnionBallotCells(await extract(input.body, "bbox-layout"), await extract(input.body, "layout"), input.document, catalog.edition.electionDate);
		samples.push({ form: input.document.form, cells, sourceUrl: input.metadata.url, sourceSha256: input.metadata.sha256, capturedAt: input.metadata.capturedAt });
	}
	const records = reconcileUnionBallotReferences(candidates.references as (UnionCandidateReference & { kind: "general" | "school"; electionDate: string })[], catalog, samples);
	const columns = ["kind", "name", "office", "jurisdictionLabel", "partyCode", "position", "status", "sampleForms", "reviewReason", "samplePositionNames", "originalListUrl", "originalListSha256", "originalListCapturedAt"];
	const csv = `${columns.map(quote).join(",")}\n${records.map(record => [record.reference.kind, record.reference.name, record.reference.office, record.reference.jurisdictionLabel, record.reference.partyCode, record.reference.position, record.status, record.witnesses.map(witness => witness.form).join(";"), record.reviewReason ?? "", [...new Set(record.positionEvidence.map(witness => witness.observedName))].join(";"), (record.reference as unknown as Record<string, string>).sourceUrl, (record.reference as unknown as Record<string, string>).sourceSha256, (record.reference as unknown as Record<string, string>).capturedAt].map(quote).join(",")).join("\n")}\n`;
	const result = { schemaVersion: 1, type: "union-ballot-corroboration-review", candidatePreparationSha256: parent.sha256, ballotCaptureHashes: batches.map(batch => batch.pin.sha256), catalog, sampleDocuments: samples.map(({ cells, ...source }) => source), references: records, referenceCount: records.length, corroborated: records.filter(record => record.status === "name-and-position-corroborated").length, reviewRequired: records.filter(record => record.status === "review-required").length, csvSha256: hash(csv), publisherRequests: 0, officeAndPartyVerified: false, qualificationVerified: false, personalApplicabilityVerified: false, imported: false, publicationApproved: false, automaticImportApproved: false };
	const lock = await acquireStateBallotAutomationLock(plan.outputRoot);
	try {
		const outputDirectory = join(lock.directory, `prepared-${randomUUID()}`);
		await mkdir(outputDirectory, { mode: 0o700 });
		const body = `${JSON.stringify(result, null, 2)}\n`;
		await persist(outputDirectory, "corroboration.csv", csv);
		await persist(outputDirectory, "corroboration.json", body);
		return { outputDirectory, references: records.length, corroborated: result.corroborated, reviewRequired: result.reviewRequired, sha256: hash(body), publisherRequests: 0, imported: false, publicationApproved: false };
	}
	finally { await lock.release(); }
}

if (process.argv[1]?.endsWith("prepare-union-ballot-corroboration.ts") || process.argv[1]?.endsWith("prepare-union-ballot-corroboration.js")) {
	const [path, ...extra] = process.argv.slice(2);
	if (!path || extra.length) {
		console.error("Use prepare-union-ballot-corroboration PLAN.json.");
		process.exitCode = 1;
	}
	else {
		prepareUnionBallotCorroboration(path).then(result => console.log(JSON.stringify(result))).catch((error: unknown) => {
			console.error(error instanceof Error ? error.message : "Union ballot corroboration failed.");
			process.exitCode = 1;
		});
	}
}
