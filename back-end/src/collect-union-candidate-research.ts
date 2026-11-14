import type { Buffer } from "node:buffer";
import type { UnionCandidateCapture } from "./union-county-candidates.js";
import { randomUUID } from "node:crypto";
import { mkdir, open, realpath } from "node:fs/promises";
import { dirname, join } from "node:path";
import process from "node:process";
import { acquireStateBallotAutomationLock } from "./state-ballot-automation-lock.js";
import { extractStateBallotPdfText, resolveStateBallotPdfExtractor } from "./state-ballot-pdf.js";
import { readBoundedStateDataBytes } from "./state-ballot-storage.js";
import { collectUnionCandidateDocuments, readUnionCandidateEdition, readUnionCandidateReferences, unionCandidateHash, unionCandidateIndexUrl, unionCandidatePolicyHash, unionCandidatePolicyUrls } from "./union-county-candidates.js";

type Intake = Awaited<ReturnType<typeof collectUnionCandidateDocuments>>;
type Extract = (body: Buffer, format: "layout" | "bbox-layout") => Promise<string>;
type CapturedInput = Omit<UnionCandidateCapture, "body"> & { path: string; bytes: number };
const nativeExtract: Extract = async (body, format) => extractStateBallotPdfText(body, await resolveStateBallotPdfExtractor(), undefined, format);
const validHash = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
const exact = (value: unknown, keys: string[]): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).sort().join(",") === [...keys].sort().join(","));
const quote = (value: unknown) => `"${String(value).replace(/^(\s*[=+@-])/u, "'$1").replaceAll("\"", "\"\"")}"`;

async function persist(directory: string, name: string, body: string | Buffer) {
	const handle = await open(join(directory, name), "wx", 0o600);
	try {
		await handle.writeFile(body);
		await handle.sync();
	}
	finally { await handle.close(); }
}
async function preparedFacts(intake: Intake, extract: Extract) {
	const documents = [];
	const references = [];
	let electionDate = "";
	for (const descriptor of intake.edition.documents) {
		const capture = intake.captures.find(input => input.url === descriptor.url);
		if (!capture || capture.sha256 !== unionCandidateHash(capture.body) || descriptor.sourceAsOfDate > capture.capturedAt.slice(0, 10)) throw new Error("Union candidate source bytes or clocks are incomplete.");
		const parsed = readUnionCandidateReferences(await extract(capture.body, "bbox-layout"), await extract(capture.body, "layout"), descriptor.kind, intake.edition);
		if (electionDate && parsed.electionDate !== electionDate) throw new Error("Union candidate documents identify different elections.");
		electionDate = parsed.electionDate;
		documents.push({ kind: descriptor.kind, sourceUrl: descriptor.url, sourceSha256: capture.sha256, capturedAt: capture.capturedAt, sourceAsOfDate: parsed.sourceAsOfDate, inventory: parsed.inventory, positionConfirmationVerified: false });
		references.push(...parsed.references.map(reference => ({ stateCode: "NJ", publicationCounty: "Union County", kind: descriptor.kind, electionDate, ...reference, sourceAsOfDate: parsed.sourceAsOfDate, sourceUrl: capture.url, sourceSha256: capture.sha256, capturedAt: capture.capturedAt })));
	}
	const columns = ["stateCode", "publicationCounty", "kind", "electionDate", "jurisdictionLabel", "office", "position", "name", "partyCode", "termLabel", "page", "sourceAsOfDate", "sourceUrl", "sourceSha256", "capturedAt"] as const;
	const csv = `${columns.map(quote).join(",")}\n${references.map(reference => columns.map(column => quote(reference[column])).join(",")).join("\n")}\n`;
	return { electionDate, documents, references, csv, csvSha256: unionCandidateHash(csv), qualificationVerified: false, personalApplicabilityVerified: false, imported: false, publicationApproved: false, automaticImportApproved: false };
}

export async function collectUnionCandidateResearch(path: string, options: { collect?: typeof collectUnionCandidateDocuments; extract?: Extract } = {}) {
	const plan: unknown = JSON.parse((await readBoundedStateDataBytes(path, 32768)).toString("utf8"));
	if (!exact(plan, ["schemaVersion", "type", "outputRoot", "accessReview"]) || plan.schemaVersion !== 1 || plan.type !== "union-candidate-research-collection" || typeof plan.outputRoot !== "string" || !exact(plan.accessReview, ["robots", "privacy"]) || !validHash(plan.accessReview.robots) || !validHash(plan.accessReview.privacy)) throw new Error("Provide an exact reviewed Union candidate collection plan.");
	const accessReview = { robots: plan.accessReview.robots, privacy: plan.accessReview.privacy };
	const lock = await acquireStateBallotAutomationLock(plan.outputRoot);
	try {
		const directory = join(lock.directory, `intake-${Date.now()}-${randomUUID()}`);
		await mkdir(directory, { mode: 0o700 });
		const inputs: CapturedInput[] = [];
		const written = new Set<string>();
		async function onCapture(input: UnionCandidateCapture) {
			if (unionCandidateHash(input.body) !== input.sha256 || inputs.some(existing => existing.url === input.url)) throw new Error("Union candidate intake identity changed.");
			const filename = `${input.sha256}.${input.body.subarray(0, 5).toString() === "%PDF-" ? "pdf" : "txt"}`;
			if (!written.has(filename)) {
				await persist(directory, filename, input.body);
				written.add(filename);
			}
			const { body, ...metadata } = input;
			const record = { ...metadata, path: filename, bytes: body.length };
			await persist(directory, `${filename}-${unionCandidateHash(input.url).slice(0, 12)}.metadata.json`, `${JSON.stringify(record, null, 2)}\n`);
			inputs.push(record);
		}
		const intake = await (options.collect ?? collectUnionCandidateDocuments)(accessReview, { onCapture });
		if (intake.captures.length !== 5 || inputs.length !== 5) throw new Error("Union candidate intake is incomplete.");
		const { csv, ...facts } = await preparedFacts(intake, options.extract ?? nativeExtract);
		const report = { schemaVersion: 1, type: "union-candidate-research-capture", accessReview, edition: intake.edition, inputs, ...facts };
		const body = `${JSON.stringify(report, null, 2)}\n`;
		await persist(directory, "candidate-references.csv", csv);
		await persist(directory, "capture.json", body);
		const directoryHandle = await open(directory, "r");
		try {
			await directoryHandle.sync();
		}
		finally { await directoryHandle.close(); }
		return { outputDirectory: directory, records: facts.references.length, electionDate: facts.electionDate, captureSha256: unionCandidateHash(body), imported: false, publicationApproved: false };
	}
	finally { await lock.release(); }
}

export async function prepareUnionCandidateResearch(path: string, options: { extract?: Extract; now?: () => number } = {}) {
	const plan: unknown = JSON.parse((await readBoundedStateDataBytes(path, 32768)).toString("utf8"));
	if (!exact(plan, ["schemaVersion", "type", "outputRoot", "capturePath", "captureSha256"]) || plan.schemaVersion !== 1 || plan.type !== "union-candidate-research-preparation" || typeof plan.outputRoot !== "string" || typeof plan.capturePath !== "string" || !validHash(plan.captureSha256)) throw new Error("Provide an exact pinned Union candidate preparation plan.");
	const body = await readBoundedStateDataBytes(plan.capturePath);
	if (unionCandidateHash(body) !== plan.captureSha256) throw new Error("Union candidate capture manifest changed.");
	const report = JSON.parse(body.toString("utf8"));
	if (report.schemaVersion !== 1 || report.type !== "union-candidate-research-capture" || !exact(report.accessReview, ["robots", "privacy"]) || !validHash(report.accessReview.robots) || !validHash(report.accessReview.privacy) || !Array.isArray(report.inputs) || report.inputs.length !== 5 || !validHash(report.csvSha256)) throw new Error("Union candidate capture manifest requires review.");
	const parent = await realpath(dirname(plan.capturePath));
	const captures: UnionCandidateCapture[] = [];
	const now = (options.now ?? Date.now)();
	if (!Number.isFinite(now)) throw new Error("Union candidate preparation clock is invalid.");
	for (const input of report.inputs as CapturedInput[]) {
		if (!exact(input, ["url", "sha256", "capturedAt", "path", "bytes"]) || !validHash(input.sha256) || typeof input.url !== "string" || ![`${input.sha256}.pdf`, `${input.sha256}.txt`].includes(String(input.path)) || !Number.isSafeInteger(input.bytes) || Number(input.bytes) < 1 || Number(input.bytes) > 12 * 1024 * 1024 || typeof input.capturedAt !== "string" || !Number.isFinite(Date.parse(input.capturedAt)) || new Date(input.capturedAt).toISOString() !== input.capturedAt || Date.parse(input.capturedAt) > now || captures.some(existing => existing.url === input.url)) throw new Error("Union candidate captured input requires review.");
		const bytes = await readBoundedStateDataBytes(join(parent, String(input.path)));
		if (bytes.length !== input.bytes || unionCandidateHash(bytes) !== input.sha256) throw new Error("Union candidate original bytes changed.");
		captures.push({ url: input.url, sha256: input.sha256, capturedAt: input.capturedAt, body: bytes });
	}
	const index = captures.find(input => input.url === unionCandidateIndexUrl);
	if (!index) throw new Error("Union candidate original index is missing.");
	const edition = readUnionCandidateEdition(index.body.toString("utf8"));
	if (JSON.stringify(edition) !== JSON.stringify(report.edition) || captures.map(input => input.url).join("\n") !== [unionCandidatePolicyUrls[0], unionCandidateIndexUrl, unionCandidatePolicyUrls[1], ...edition.documents.map(document => document.url)].join("\n")) throw new Error("Union candidate source inventory changed.");
	for (const [position, kind] of [[0, "robots"], [2, "privacy"]] as const) {
		if (unionCandidatePolicyHash(captures[position]!.body.toString("utf8"), kind) !== report.accessReview[kind]) throw new Error("Union candidate retained source policy changed.");
	}
	if (unionCandidateHash(await readBoundedStateDataBytes(join(parent, "candidate-references.csv"))) !== report.csvSha256) throw new Error("Union candidate earlier CSV changed.");
	const { csv, ...facts } = await preparedFacts({ edition, captures, imported: false, publicationApproved: false, automaticImportApproved: false }, options.extract ?? nativeExtract);
	const lock = await acquireStateBallotAutomationLock(plan.outputRoot);
	try {
		const directory = join(lock.directory, `prepared-${randomUUID()}`);
		await mkdir(directory, { mode: 0o700 });
		const output = `${JSON.stringify({ schemaVersion: 1, type: "union-candidate-research-preparation", sourceCaptureSha256: plan.captureSha256, edition, ...facts, publisherRequests: 0 }, null, 2)}\n`;
		await persist(directory, "candidate-references.csv", csv);
		await persist(directory, "preparation.json", output);
		return { outputDirectory: directory, records: facts.references.length, electionDate: facts.electionDate, preparationSha256: unionCandidateHash(output), publisherRequests: 0, imported: false, publicationApproved: false };
	}
	finally { await lock.release(); }
}

if (process.argv[1]?.endsWith("collect-union-candidate-research.ts") || process.argv[1]?.endsWith("collect-union-candidate-research.js")) {
	const arguments_ = process.argv.slice(2);
	const preparation = arguments_[0] === "prepare";
	const [path, ...extra] = preparation ? arguments_.slice(1) : arguments_;
	if (!path || extra.length) {
		console.error("Use collect-union-candidate-research [prepare] PLAN.json.");
		process.exitCode = 1;
	}
	else {
		(preparation ? prepareUnionCandidateResearch(path) : collectUnionCandidateResearch(path)).then(result => console.log(JSON.stringify(result))).catch((error: unknown) => {
			console.error(error instanceof Error ? error.message : "Union candidate research failed.");
			process.exitCode = 1;
		});
	}
}
