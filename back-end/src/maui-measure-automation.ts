import type { MauiCharterAccessReview } from "./maui-charter-measures.js";
import type { MauiPreparationIssue, MauiPreparationReference, MauiPreparationRun } from "./maui-measure-automation-storage.js";
import type { MauiMeasureEvidence } from "./maui-measure-guides.js";
import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";
import { lstat, open, readdir, realpath, rm, unlink, writeFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import { collectMauiCharterMeasures, readLatestMauiCharterCapture } from "./maui-charter-collection.js";
import { mauiPreparationDate, mauiPreparationDigest, mauiPreparationFiles, mauiPreparationHash, mauiPreparationObject, readMauiPreparationOutput, readMauiPreparationRun, writeMauiPreparationRun } from "./maui-measure-automation-storage.js";
import { buildMauiMeasureDraft, prepareMauiMeasureGuideFiles } from "./maui-measure-guides.js";
import { withStateBallotAutomationLock } from "./state-ballot-automation-lock.js";
import { assertExternalStateDataDirectory, readBoundedStateDataBytes } from "./state-ballot-storage.js";

interface Pin { path: string; sha256: string }
export interface MauiMeasureCohort { electionDate: string; review: Pin | null; documents: MauiMeasureEvidence[]; baseSnapshot: Pin | null }
export interface MauiMeasureAutomationPlan { schemaVersion: 1; type: "maui-measure-automation"; collectionDirectory: string; preparationDirectory: string; accessReview: MauiCharterAccessReview; cohorts: MauiMeasureCohort[] }
const pinned = (value: unknown): value is Pin => mauiPreparationObject(value, ["path", "sha256"]) && typeof value.path === "string" && isAbsolute(value.path) && mauiPreparationDigest(value.sha256);

export const mauiMeasurePreparationIdentity = (inventorySha256: string, cohort: MauiMeasureCohort | undefined) => mauiPreparationHash(JSON.stringify({ inventory: inventorySha256, cohort: cohort ? { ...cohort, documents: [...cohort.documents].sort((first, second) => first.resolution.localeCompare(second.resolution, "en")) } : null }));

export async function readMauiMeasureAutomationPlan(path: string): Promise<MauiMeasureAutomationPlan> {
	const value: unknown = JSON.parse((await readBoundedStateDataBytes(path, 128 * 1024)).toString("utf8"));
	if (!mauiPreparationObject(value, ["schemaVersion", "type", "collectionDirectory", "preparationDirectory", "accessReview", "cohorts"]) || value.schemaVersion !== 1 || value.type !== "maui-measure-automation" || typeof value.collectionDirectory !== "string" || typeof value.preparationDirectory !== "string" || value.collectionDirectory === value.preparationDirectory || !mauiPreparationObject(value.accessReview, ["reviewedAt", "robotsSha256"]) || typeof value.accessReview.reviewedAt !== "string" || !mauiPreparationDigest(value.accessReview.robotsSha256) || !Array.isArray(value.cohorts) || value.cohorts.length > 32) throw new Error("Provide an external Maui automation plan with distinct collection and preparation stores.");
	assertExternalStateDataDirectory(value.collectionDirectory);
	assertExternalStateDataDirectory(value.preparationDirectory);
	const dates = new Set<string>();
	for (const cohort of value.cohorts) {
		if (!mauiPreparationObject(cohort, ["electionDate", "review", "documents", "baseSnapshot"]) || !mauiPreparationDate(cohort.electionDate) || dates.has(cohort.electionDate) || (cohort.review !== null && !pinned(cohort.review)) || (cohort.baseSnapshot !== null && !pinned(cohort.baseSnapshot)) || !Array.isArray(cohort.documents) || cohort.documents.length > 20) throw new Error("Maui preparation cohorts require unique elections and pinned inputs.");
		dates.add(cohort.electionDate);
		const resolutions = new Set<string>();
		for (const document of cohort.documents) {
			if (!mauiPreparationObject(document, ["resolution", "path", "sha256", "url", "capturedAt"]) || typeof document.path !== "string" || !isAbsolute(document.path) || !mauiPreparationDigest(document.sha256) || typeof document.resolution !== "string" || !/^\d{2}-\d{1,4}(?:, (?:CD|FD)\d){0,3}$/u.test(document.resolution) || resolutions.has(document.resolution) || typeof document.url !== "string" || typeof document.capturedAt !== "string" || !Number.isFinite(Date.parse(document.capturedAt)) || new Date(document.capturedAt).toISOString() !== document.capturedAt) throw new Error("Maui resolution inputs require exact identities and original capture clocks.");
			resolutions.add(document.resolution);
		}
	}
	return value as unknown as MauiMeasureAutomationPlan;
}

async function outputCapacity(directory: string) {
	const entries = (await readdir(directory)).filter(name => name.startsWith("maui-prepared-"));
	if (entries.length >= 64) throw new Error("Maui preparation storage needs a retention review.");
	let bytes = 0;
	for (const name of entries) {
		if (!/^maui-prepared-[a-f\d]{64}-[a-f\d-]{36}$/u.test(name) || !(await lstat(join(directory, name))).isDirectory() || await realpath(join(directory, name)) !== join(directory, name)) throw new Error("Maui preparation storage contains an unreviewed entry.");
		for (const file of await mauiPreparationFiles(join(directory, name))) bytes += file.bytes;
	}
	if (bytes + 32 * 1024 * 1024 > 128 * 1024 * 1024) throw new Error("Maui preparation storage needs a capacity review.");
}

async function pinnedCohort(cohort: MauiMeasureCohort | undefined, captureBytes: number) {
	let bytes = captureBytes;
	async function read(pin: Pin) {
		const body = await readBoundedStateDataBytes(pin.path);
		bytes += body.length;
		if (bytes > 32 * 1024 * 1024 || mauiPreparationHash(body) !== pin.sha256) throw new Error("Maui preparation input bytes changed or exceed their limit.");
		return body;
	}
	if (!cohort) return null;
	for (const document of cohort.documents) {
		if (!(await read(document)).subarray(0, 5).equals(Buffer.from("%PDF-"))) throw new Error("Maui resolution evidence must retain original PDF bytes.");
	}
	if (cohort.baseSnapshot) await read(cohort.baseSnapshot);
	return cohort.review ? JSON.parse((await read(cohort.review)).toString("utf8")) as unknown : null;
}

async function recoverOutput(directory: string, identitySha256: string, now: number) {
	const entries = (await readdir(directory)).filter(name => name.startsWith(`maui-prepared-${identitySha256}-`));
	if (entries.length > 64) throw new Error("Maui preparation storage needs a retention review.");
	const references: MauiPreparationReference[] = [];
	for (const name of entries) {
		let body: Buffer;
		try {
			body = await readBoundedStateDataBytes(join(directory, name, "maui-output-receipt.json"), 128 * 1024);
		}
		catch (error) {
			if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
			throw error;
		}
		const receipt = JSON.parse(body.toString("utf8"));
		const stored: MauiPreparationReference = { directory: name, sha256: mauiPreparationHash(body), identitySha256, electionDate: receipt.electionDate, preparedAt: receipt.preparedAt, questions: receipt.questions };
		await readMauiPreparationOutput(directory, stored, now);
		for (const file of [...await mauiPreparationFiles(join(directory, name)), { name: "maui-output-receipt.json" }]) {
			const handle = await open(join(directory, name, file.name), "r");
			try {
				await handle.sync();
			}
			finally { await handle.close(); }
		}
		for (const path of [join(directory, name, "assembly"), join(directory, name), directory]) {
			const parent = await open(path, "r");
			try {
				await parent.sync();
			}
			finally { await parent.close(); }
		}
		references.push(stored);
	}
	return references.sort((first, second) => first.preparedAt.localeCompare(second.preparedAt, "en"))[0] ?? null;
}

export async function runMauiMeasureAutomation(planPath: string, options: { collect?: boolean; now?: () => number; collector?: typeof collectMauiCharterMeasures; prepare?: typeof prepareMauiMeasureGuideFiles } = {}) {
	const plan = await readMauiMeasureAutomationPlan(planPath);
	const now = options.now ?? Date.now;
	return withStateBallotAutomationLock(plan.preparationDirectory, "automation.lock", async (directory) => {
		if (directory !== plan.preparationDirectory) throw new Error("Maui preparation requires its physical storage path.");
		const previous = await readMauiPreparationRun(directory, now());
		const run: MauiPreparationRun = { schemaVersion: 1, type: "maui-measure-preparation-run", status: "running", startedAt: new Date(now()).toISOString(), finishedAt: null, input: null, lastPrepared: previous?.lastPrepared ?? null, issues: [], failure: null };
		await writeMauiPreparationRun(directory, run, now());
		let stage: NonNullable<MauiPreparationRun["failure"]> = options.collect ? "collection-failed" : "preparation-failed";
		let output: string | null = null;
		let planFile: string | null = null;
		try {
			if (options.collect) await (options.collector ?? collectMauiCharterMeasures)({ directory: plan.collectionDirectory, accessReview: plan.accessReview, now });
			stage = "preparation-failed";
			const source = await readLatestMauiCharterCapture(plan.collectionDirectory, now());
			if (!source.inventory || !source.capture || !source.run?.latest) throw new Error("Maui preparation requires a complete retained county capture.");
			const cohort = plan.cohorts.find(cohort => cohort.electionDate === source.inventory!.electionDate);
			const review = await pinnedCohort(cohort, Buffer.byteLength(JSON.stringify(source.capture)));
			const identitySha256 = mauiMeasurePreparationIdentity(source.run.latest.inventorySha256, cohort);
			run.input = { electionDate: source.inventory.electionDate, captureSha256: source.run.latest.sha256, inventorySha256: source.run.latest.inventorySha256, identitySha256 };
			const documents = cohort?.documents.filter(document => source.inventory!.questions.some(question => question.resolution === document.resolution && question.resolutionUrl === document.url)) ?? [];
			const missing = source.inventory.questions.filter(question => !documents.some(document => document.resolution === question.resolution));
			let issues: MauiPreparationIssue[] = !cohort ? [{ resolution: null, reason: "election-review-required" }] : missing.map(question => ({ resolution: question.resolution, reason: "resolution-evidence-required" }));
			if (!issues.length) issues = buildMauiMeasureDraft(source.capture, documents, review, now()).issues as MauiPreparationIssue[];
			if (issues.length) {
				run.status = "review";
				run.issues = issues;
				run.finishedAt = new Date(now()).toISOString();
				await writeMauiPreparationRun(directory, run, now());
				return { ...run, prepared: false, reused: false, imported: false, publicationApproved: false, automaticImportApproved: false };
			}
			const reusable = previous?.lastPrepared?.identitySha256 === identitySha256 ? previous.lastPrepared : await recoverOutput(directory, identitySha256, now());
			if (reusable) {
				run.status = "prepared";
				run.lastPrepared = reusable;
				run.finishedAt = new Date(now()).toISOString();
				await writeMauiPreparationRun(directory, run, now());
				return { ...run, prepared: true, reused: true, imported: false, publicationApproved: false, automaticImportApproved: false };
			}
			stage = "persistence-failed";
			await outputCapacity(directory);
			const name = `maui-prepared-${identitySha256}-${randomUUID()}`;
			output = join(directory, name);
			planFile = join(directory, `.maui-plan-${randomUUID()}.json`);
			const nativePlan = { schemaVersion: 1, type: "maui-measure-guide-preparation", capture: { path: join(plan.collectionDirectory, source.run.latest.name), sha256: source.run.latest.sha256 }, review: cohort!.review, documents, baseSnapshot: cohort!.baseSnapshot, outputDirectory: output, outputName: "maui-measures" };
			await writeFile(planFile, `${JSON.stringify(nativePlan)}\n`, { flag: "wx", mode: 0o600 });
			const prepared = await (options.prepare ?? prepareMauiMeasureGuideFiles)(planFile, now());
			if (prepared.status !== "prepared-for-review" || prepared.issues.length) throw new Error("Maui reviewed preparation did not produce its expected draft.");
			const preparedAt = new Date(now()).toISOString();
			const files = await mauiPreparationFiles(output);
			for (const file of files) {
				const handle = await open(join(output, file.name), "r");
				try {
					await handle.sync();
				}
				finally { await handle.close(); }
			}
			const body = `${JSON.stringify({ schemaVersion: 1, type: "maui-measure-preparation-output", identitySha256, electionDate: source.inventory.electionDate, preparedAt, questions: source.inventory.questions.length, files, publicationApproved: false, automaticImportApproved: false }, null, 2)}\n`;
			const handle = await open(join(output, "maui-output-receipt.json"), "wx", 0o600);
			try {
				await handle.writeFile(body);
				await handle.sync();
			}
			finally { await handle.close(); }
			const reference: MauiPreparationReference = { directory: name, sha256: mauiPreparationHash(body), identitySha256, electionDate: source.inventory.electionDate, preparedAt, questions: source.inventory.questions.length };
			await readMauiPreparationOutput(directory, reference, now());
			for (const path of [join(output, "assembly"), output, directory]) {
				const parent = await open(path, "r");
				try {
					await parent.sync();
				}
				finally { await parent.close(); }
			}
			output = null;
			run.status = "prepared";
			run.lastPrepared = reference;
			run.finishedAt = new Date(now()).toISOString();
			await writeMauiPreparationRun(directory, run, now());
			return { ...run, prepared: true, reused: false, imported: false, publicationApproved: false, automaticImportApproved: false };
		}
		catch (error) {
			run.status = "failed";
			run.finishedAt = new Date(now()).toISOString();
			run.lastPrepared = previous?.lastPrepared ?? null;
			run.issues = [];
			run.failure = stage;
			await writeMauiPreparationRun(directory, run, now());
			throw error;
		}
		finally {
			if (planFile) {
				await unlink(planFile).catch((error: NodeJS.ErrnoException) => {
					if (error.code !== "ENOENT") throw error;
				});
			}
			if (output) await rm(output, { recursive: true, force: true });
		}
	});
}
