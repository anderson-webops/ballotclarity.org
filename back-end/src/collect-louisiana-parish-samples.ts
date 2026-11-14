import type { Buffer } from "node:buffer";
import type { ParishSampleCapture } from "./louisiana-parish-samples.js";
import { randomUUID } from "node:crypto";
import { mkdir, open, realpath, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import process from "node:process";
import { collectParishSampleBatch, parishSampleHash, parishSampleIndexUrl, parishSamplePolicyUrls, readParishCandidateReferences, readParishSampleIndex, resolveParishSampleDocument } from "./louisiana-parish-samples.js";
import { acquireStateBallotAutomationLock } from "./state-ballot-automation-lock.js";
import { extractStateBallotPdfText, resolveStateBallotPdfExtractor } from "./state-ballot-pdf.js";
import { assertExternalStateDataDirectory, readBoundedStateDataBytes } from "./state-ballot-storage.js";

type ParishCapture = Awaited<ReturnType<typeof collectParishSampleBatch>>;
type Extract = (body: Buffer) => Promise<string>;
const nativeExtract: Extract = async body => extractStateBallotPdfText(body, await resolveStateBallotPdfExtractor(), undefined, "raw");

async function prepare(capture: ParishCapture, extract: Extract) {
	const references = [];
	const preparation = [];
	for (const result of capture.results) {
		if (result.status !== "collected") {
			preparation.push({ parish: result.parish, status: "collection-held", reason: result.reason });
			continue;
		}
		const input = capture.captures.find(document => document.url === result.documentUrl);
		if (!input || input.sha256 !== result.sha256 || input.capturedAt !== result.capturedAt) throw new Error("Parish document provenance is inconsistent.");
		try {
			const text = await extract(input.body);
			const records = readParishCandidateReferences(text, result.parish, capture.catalog.electionDate);
			references.push(...records.map(record => ({ parish: result.parish, electionDate: capture.catalog.electionDate, ...record, sourceStatus: "unofficial-reference", sourceUrl: input.url, sourceSha256: input.sha256, capturedAt: input.capturedAt })));
			preparation.push({ parish: result.parish, status: "prepared", records: records.length });
		}
		catch (error) { preparation.push({ parish: result.parish, status: "held", reason: error instanceof Error ? error.message : "Parish native preparation requires review." }); }
	}
	const columns = ["parish", "electionDate", "id", "name", "office", "statedParty", "voteFor", "sourcePage", "sourceStatus", "sourceUrl", "sourceSha256", "capturedAt"] as const;
	const quote = (value: string | number | undefined) => `"${String(value ?? "").replaceAll("\"", "\"\"")}"`;
	const csv = `${[columns.join(","), ...references.map(record => columns.map(column => quote(record[column])).join(","))].join("\n")}\n`;
	return { references, preparation, csv, csvSha256: parishSampleHash(csv) };
}

async function persistOutput(directory: string, filename: string, body: string) {
	const handle = await open(join(directory, filename), "wx", 0o600);
	try {
		await handle.writeFile(body);
		await handle.sync();
	}
	finally { await handle.close(); }
}

export async function prepareLouisianaParishSamples(path: string, options: { extract?: Extract } = {}) {
	const plan = JSON.parse((await readBoundedStateDataBytes(path, 32768)).toString("utf8"));
	if (!plan || Object.keys(plan).sort().join(",") !== "capturePath,captureSha256,outputRoot,schemaVersion,type" || plan.schemaVersion !== 1 || plan.type !== "louisiana-parish-sample-research-preparation" || typeof plan.capturePath !== "string" || typeof plan.outputRoot !== "string" || typeof plan.captureSha256 !== "string" || !/^[a-f\d]{64}$/u.test(plan.captureSha256)) throw new Error("Provide a pinned parish research preparation plan.");
	const directory = await realpath(dirname(plan.capturePath));
	assertExternalStateDataDirectory(directory);
	const original = await readBoundedStateDataBytes(plan.capturePath, 4 * 1024 * 1024);
	if (parishSampleHash(original) !== plan.captureSha256) throw new Error("Parish capture manifest hash changed.");
	const report = JSON.parse(original.toString("utf8"));
	if (report?.schemaVersion !== 1 || report.type !== "louisiana-parish-sample-research-capture" || report.publisher !== "Power Coalition for Equity and Justice" || report.official !== false || report.automaticImportApproved !== false || report.publicationApproved !== false || !Array.isArray(report.inputs) || report.inputs.length < 4 || report.inputs.length > 29 || !Array.isArray(report.results) || !report.results.length || report.results.length > 25 || new Set(report.results.map((result: { parish: string }) => result.parish)).size !== report.results.length) throw new Error("Parish capture manifest requires review.");
	const captures: ParishSampleCapture[] = [];
	let bytes = 0;
	for (const input of report.inputs) {
		if (!input || typeof input.sha256 !== "string" || !/^[a-f\d]{64}$/u.test(input.sha256) || ![`${input.sha256}.pdf`, `${input.sha256}.txt`].includes(input.path) || typeof input.url !== "string" || !Number.isSafeInteger(input.bytes) || input.bytes < 0 || input.bytes > 12 * 1024 * 1024 || typeof input.capturedAt !== "string" || !Number.isFinite(Date.parse(input.capturedAt)) || new Date(input.capturedAt).toISOString() !== input.capturedAt || Date.parse(input.capturedAt) > Date.now()) throw new Error("Parish captured input requires review.");
		if (![...parishSamplePolicyUrls, parishSampleIndexUrl].includes(input.url) && resolveParishSampleDocument(input.url, report.catalog.electionDate, undefined, undefined) !== input.url) throw new Error("Parish captured URL changed.");
		bytes += input.bytes;
		if (bytes > 64 * 1024 * 1024 || captures.some(capture => capture.url === input.url)) throw new Error("Parish captured input inventory exceeds its bounds.");
		const body = await readBoundedStateDataBytes(join(directory, input.path));
		if (body.length !== input.bytes || parishSampleHash(body) !== input.sha256 || (input.path.endsWith(".pdf") && body.subarray(0, 5).toString() !== "%PDF-")) throw new Error("Parish captured document bytes changed.");
		captures.push({ url: input.url, body, sha256: input.sha256, capturedAt: input.capturedAt, contentSecurityPolicy: input.contentSecurityPolicy });
	}
	if (parishSamplePolicyUrls.some(url => !captures.some(capture => capture.url === url))) throw new Error("Parish captured policies are incomplete.");
	const index = captures.find(capture => capture.url === parishSampleIndexUrl);
	if (!index || JSON.stringify(readParishSampleIndex(index.body.toString("utf8"))) !== JSON.stringify(report.catalog)) throw new Error("Parish captured catalog changed.");
	for (const result of report.results) {
		const offered = report.catalog.links.find((link: { parish: string }) => link.parish === result.parish);
		if (!["collected", "held"].includes(result.status) || !offered || offered.downloadUrl !== result.downloadUrl) throw new Error("Parish captured selection changed.");
		if (result.status === "collected" && (!result.navigation || resolveParishSampleDocument(result.navigation.location, report.catalog.electionDate, index.contentSecurityPolicy, result.navigation.contentSecurityPolicy) !== result.documentUrl)) throw new Error("Parish captured navigation changed.");
	}
	if (parishSampleHash(await readBoundedStateDataBytes(join(directory, "candidate-references.csv"), 4 * 1024 * 1024)) !== report.csvSha256) throw new Error("Parish original CSV hash changed.");
	const prepared = await prepare({ ...report, captures }, options.extract ?? nativeExtract);
	const lock = await acquireStateBallotAutomationLock(plan.outputRoot);
	try {
		const outputDirectory = join(lock.directory, `prepared-${plan.captureSha256.slice(0, 16)}-${randomUUID()}`);
		await mkdir(outputDirectory, { mode: 0o700 });
		const { csv, ...facts } = prepared;
		const body = `${JSON.stringify({ schemaVersion: 1, type: "louisiana-parish-sample-research-preparation", sourceCaptureSha256: plan.captureSha256, publisher: report.publisher, catalog: report.catalog, inputs: report.inputs, results: report.results, ...facts, official: false, personalApplicabilityVerified: false, officialQualificationVerified: false, automaticImportApproved: false, publicationApproved: false, publisherRequestsDuringPreparation: 0 }, null, 2)}\n`;
		await persistOutput(outputDirectory, "candidate-references.csv", csv);
		await persistOutput(outputDirectory, "preparation.json", body);
		return { status: "research-prepared", outputDirectory, referenceRecords: prepared.references.length, preparedParishes: prepared.preparation.filter(result => result.status === "prepared").length, heldParishes: prepared.preparation.filter(result => result.status !== "prepared").length, preparationSha256: parishSampleHash(body), publisherRequests: 0, imported: false, publicationApproved: false };
	}
	finally { await lock.release(); }
}

export async function collectLouisianaParishSamples(path: string, options: { collect?: typeof collectParishSampleBatch; extract?: (body: Buffer) => Promise<string> } = {}) {
	const plan = JSON.parse((await readBoundedStateDataBytes(path, 32768)).toString("utf8"));
	if (!plan || Object.keys(plan).sort().join(",") !== "accessReview,outputRoot,parishes,schemaVersion,type" || plan.schemaVersion !== 1 || plan.type !== "louisiana-parish-sample-research-collection" || typeof plan.outputRoot !== "string" || !Array.isArray(plan.parishes) || !plan.accessReview || Object.keys(plan.accessReview).sort().join(",") !== "privacy,robots,secureNavigation,terms") throw new Error("Provide a reviewed parish research collection plan.");
	const extract = options.extract ?? nativeExtract;
	const lock = await acquireStateBallotAutomationLock(plan.outputRoot);
	try {
		const outputDirectory = join(lock.directory, `intake-${Date.now()}-${randomUUID()}`);
		await mkdir(outputDirectory, { mode: 0o700 });
		const inputs: (Omit<ParishSampleCapture, "body"> & { path: string; bytes: number })[] = [];
		const written = new Set<string>();
		async function persist(document: ParishSampleCapture) {
			if (parishSampleHash(document.body) !== document.sha256) throw new Error("Parish capture hash changed before persistence.");
			const filename = `${document.sha256}.${document.body.subarray(0, 5).toString() === "%PDF-" ? "pdf" : "txt"}`;
			if (!written.has(filename)) {
				const handle = await open(join(outputDirectory, filename), "wx", 0o600);
				try {
					await handle.writeFile(document.body);
					await handle.sync();
				}
				finally { await handle.close(); }
				written.add(filename);
			}
			const { body, ...metadata } = document;
			const record = { ...metadata, path: filename, bytes: body.length };
			const identity = `${filename}-${parishSampleHash(document.url).slice(0, 12)}`;
			if (!written.has(identity)) {
				await writeFile(join(outputDirectory, `${identity}.metadata.json`), `${JSON.stringify(record, null, 2)}\n`, { flag: "wx", mode: 0o600 });
				inputs.push(record);
				written.add(identity);
			}
		}
		const capture = await (options.collect ?? collectParishSampleBatch)(plan.parishes, plan.accessReview, { onCapture: persist });
		for (const document of capture.captures) await persist(document);
		const { references, preparation, csv, csvSha256 } = await prepare(capture, extract);
		const { captures, ...metadata } = capture;
		await persistOutput(outputDirectory, "candidate-references.csv", csv);
		const report = { ...metadata, inputs, preparation, references, csvSha256, rightsReview: "factual research only", personalApplicabilityVerified: false, officialQualificationVerified: false };
		const reportBody = `${JSON.stringify(report, null, 2)}\n`;
		await persistOutput(outputDirectory, "capture.json", reportBody);
		return { status: "research-collected", outputDirectory, capturedParishes: capture.results.filter(result => result.status === "collected").length, heldParishes: capture.results.filter(result => result.status === "held").length, preparedParishes: preparation.filter(result => result.status === "prepared").length, referenceRecords: references.length, captureSha256: parishSampleHash(reportBody), imported: false, publicationApproved: false };
	}
	finally { await lock.release(); }
}

if (process.argv[1]?.endsWith("collect-louisiana-parish-samples.ts") || process.argv[1]?.endsWith("collect-louisiana-parish-samples.js")) {
	const arguments_ = process.argv.slice(2);
	const preparationMode = arguments_[0] === "prepare";
	const [path, ...extra] = preparationMode ? arguments_.slice(1) : arguments_;
	if (!path || extra.length) {
		console.error("Use collect-louisiana-parish-samples [prepare] PLAN.json.");
		process.exitCode = 1;
	}
	else {
		(preparationMode ? prepareLouisianaParishSamples(path) : collectLouisianaParishSamples(path)).then(result => console.log(JSON.stringify(result))).catch((error: unknown) => {
			console.error(error instanceof Error ? error.message : "Parish research collection failed.");
			process.exitCode = 1;
		});
	}
}
