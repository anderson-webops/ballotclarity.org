import type { Measure, Source } from "./types/civic.js";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { mkdir, realpath, writeFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, join } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { readMauiCharterCapture } from "./maui-charter-measures.js";
import { assertExternalStateDataDirectory, readBoundedStateDataBytes } from "./state-ballot-storage.js";
import { prepareStateMeasureGuideFiles } from "./state-measure-guides.js";
import { containsControlCharacters } from "./text-validation.js";

interface Pinned { path: string; sha256: string }
export interface MauiMeasureEvidence extends Pinned { resolution: string; url: string; capturedAt: string }
interface ReviewRow { resolution: string; questionSha256: string; resolutionSha256: string; summary: string; yesMeaning: string; noMeaning: string; reviewedPages: number[] }
interface Review { schemaVersion: 1; type: "maui-measure-editorial-review"; electionDate: string; reviewedAt: string | null; questions: ReviewRow[]; publicationApproved: false; automaticImportApproved: false }
interface Plan { schemaVersion: 1; type: "maui-measure-guide-preparation"; capture: Pinned; review: Pinned | null; documents: MauiMeasureEvidence[]; baseSnapshot: Pinned | null; outputDirectory: string; outputName: string }
const hash = (body: string | Uint8Array) => createHash("sha256").update(body).digest("hex");
const object = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const digest = (value: unknown): value is string => typeof value === "string" && /^[a-f\d]{64}$/u.test(value);
const pinned = (value: unknown): value is Pinned => object(value) && typeof value.path === "string" && isAbsolute(value.path) && digest(value.sha256);
const instant = (value: unknown, now: number): value is string => typeof value === "string" && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value && Date.parse(value) <= now;
const keys = (value: object, expected: string[]) => Object.keys(value).sort().join(",") === [...expected].sort().join(",");
const identifier = (value: string) => value.toLowerCase().replace(/, /gu, "-");
const text = (value: unknown) => typeof value === "string" && value === value.trim() && value.length <= 1200 && !containsControlCharacters(value);

export function buildMauiMeasureDraft(capture: unknown, documents: MauiMeasureEvidence[], reviewInput: unknown, now = Date.now()) {
	const inventory = readMauiCharterCapture(capture, now);
	if (!Array.isArray(documents) || documents.length !== inventory.questions.length || new Set(documents.map(document => document.resolution)).size !== documents.length
		|| documents.some(document => !pinned(document) || !instant(document.capturedAt, now) || !inventory.questions.some(question => question.resolution === document.resolution && question.resolutionUrl === document.url))) {
		throw new Error("Each Maui question requires one matching original resolution capture.");
	}
	const template: Review = { schemaVersion: 1, type: "maui-measure-editorial-review", electionDate: inventory.electionDate, reviewedAt: null, questions: inventory.questions.map(question => ({ resolution: question.resolution, questionSha256: hash(question.ballotQuestion), resolutionSha256: documents.find(document => document.resolution === question.resolution)!.sha256, summary: "", yesMeaning: "", noMeaning: "", reviewedPages: [] })), publicationApproved: false, automaticImportApproved: false };
	let review: Review | null = null;
	if (reviewInput !== null) {
		if (!object(reviewInput) || !keys(reviewInput, ["schemaVersion", "type", "electionDate", "reviewedAt", "questions", "publicationApproved", "automaticImportApproved"]) || reviewInput.schemaVersion !== 1 || reviewInput.type !== template.type || reviewInput.electionDate !== inventory.electionDate || (reviewInput.reviewedAt !== null && !instant(reviewInput.reviewedAt, now)) || reviewInput.publicationApproved !== false || reviewInput.automaticImportApproved !== false || !Array.isArray(reviewInput.questions) || reviewInput.questions.length > 20) throw new Error("Use an unpublished editorial review for this exact Maui election.");
		const identities = new Set<string>();
		for (const row of reviewInput.questions) {
			if (!object(row) || !keys(row, ["resolution", "questionSha256", "resolutionSha256", "summary", "yesMeaning", "noMeaning", "reviewedPages"]) || typeof row.resolution !== "string" || identities.has(row.resolution) || !digest(row.questionSha256) || !digest(row.resolutionSha256) || !text(row.summary) || !text(row.yesMeaning) || !text(row.noMeaning) || !Array.isArray(row.reviewedPages) || row.reviewedPages.length > 50 || new Set(row.reviewedPages).size !== row.reviewedPages.length || row.reviewedPages.some(page => !Number.isInteger(page) || page < 1 || page > 50)) throw new Error("Maui review rows require unique identities, exact source hashes, text and reviewed PDF pages.");
			identities.add(row.resolution);
		}
		review = reviewInput as unknown as Review;
	}
	const issues: { resolution: string | null; reason: string }[] = [];
	if (!review?.reviewedAt) issues.push({ resolution: null, reason: "editorial-review-required" });
	for (const expected of template.questions) {
		const row = review?.questions.find(row => row.resolution === expected.resolution);
		if (!row) issues.push({ resolution: expected.resolution, reason: "missing-review" });
		else if (row.questionSha256 !== expected.questionSha256) issues.push({ resolution: expected.resolution, reason: "question-changed" });
		else if (row.resolutionSha256 !== expected.resolutionSha256) issues.push({ resolution: expected.resolution, reason: "resolution-document-changed" });
		else if (!row.summary || !row.yesMeaning || !row.noMeaning || !row.reviewedPages.length) issues.push({ resolution: expected.resolution, reason: "review-incomplete" });
	}
	for (const row of review?.questions ?? []) {
		if (!template.questions.some(expected => expected.resolution === row.resolution)) issues.push({ resolution: row.resolution, reason: "question-no-longer-offered" });
	}
	if (issues.length) return { inventory, template, issues, draft: null };
	const reviewedAt = review!.reviewedAt!;
	const raw = capture as { documents: { url: string; capturedAt: string; sha256: string; body: string }[] };
	const article = raw.documents.find(document => document.url === inventory.questions[0]!.articleUrl)!;
	const articleSource: Source = { id: `hi-maui-${inventory.electionDate}-county-questions`, title: "Maui County charter amendments", publisher: "Maui County Council", type: "official record", authority: "official-government", sourceSystem: "Maui County Elections", date: inventory.questions[0]!.publicationDate, url: article.url };
	const draftDocuments: Record<string, { url: string; sha256: string; capturedAt: string; publicationDate: string | null; reviewedPages?: number[] }> = {
		"county-publication": { url: article.url, sha256: article.sha256, capturedAt: article.capturedAt, publicationDate: inventory.questions[0]!.publicationDate }
	};
	const measures: Measure[] = inventory.questions.map((question): Measure => {
		const row = review!.questions.find(row => row.resolution === question.resolution)!;
		const document = documents.find(document => document.resolution === question.resolution)!;
		const slug = `hi-maui-${inventory.electionDate}-resolution-${identifier(question.resolution)}`;
		const documentKey = `resolution-${identifier(question.resolution)}`;
		draftDocuments[documentKey] = { url: document.url, sha256: document.sha256, capturedAt: document.capturedAt, publicationDate: null, reviewedPages: row.reviewedPages };
		const sources: Source[] = [articleSource, { id: `${slug}-source`, title: `Resolution ${question.resolution}`, publisher: "Council of the County of Maui", type: "official record", authority: "official-government", sourceSystem: "Maui County Council", date: "", url: `${document.url}#page=${row.reviewedPages[0]}` }];
		return { slug, contestSlug: `${slug}-contest`, title: question.title, location: "Maui County, Hawaii", summary: row.summary, ballotSummary: question.ballotQuestion, plainLanguageExplanation: row.summary, currentLawOverview: "", currentPractice: [], proposedChanges: [], yesMeaning: row.yesMeaning, noMeaning: row.noMeaning, yesHighlights: [], noHighlights: [], fiscalContextNote: "", implementationOverview: "", implementationTimeline: [], fiscalSummary: [], potentialImpacts: [], supportArguments: [], opposeArguments: [], argumentsDisclaimer: "", argumentsAndConsiderations: [], freshness: { contentLastVerifiedAt: reviewedAt, dataLastUpdatedAt: [article.capturedAt, document.capturedAt].sort()[0]!, nextReviewAt: new Date(Date.parse(reviewedAt) + 30 * 86_400_000).toISOString(), status: "incomplete", statusLabel: "", statusNote: "" }, whatWeKnow: [], whatWeDoNotKnow: [], sources, updatedAt: reviewedAt };
	});
	const draft = { schemaVersion: 1, type: "state-measure-draft", stateCode: "HI", electionDate: inventory.electionDate, jurisdiction: inventory.jurisdiction, reviewedAt, publicationApproved: false, automaticImportApproved: false, measures, documents: draftDocuments, unresolvedFields: [], unmappedQuestions: [] };
	return { inventory, template, issues, draft };
}

export async function prepareMauiMeasureGuideFiles(planPath: string, now = Date.now()) {
	const plan: unknown = JSON.parse((await readBoundedStateDataBytes(planPath, 128 * 1024)).toString("utf8"));
	if (!object(plan) || !keys(plan, ["schemaVersion", "type", "capture", "review", "documents", "baseSnapshot", "outputDirectory", "outputName"]) || plan.schemaVersion !== 1 || plan.type !== "maui-measure-guide-preparation" || !pinned(plan.capture) || (plan.review !== null && !pinned(plan.review)) || (plan.baseSnapshot !== null && !pinned(plan.baseSnapshot)) || !Array.isArray(plan.documents) || plan.documents.length > 20 || typeof plan.outputDirectory !== "string" || typeof plan.outputName !== "string" || !/^[a-z0-9][a-z0-9-]{0,100}$/u.test(plan.outputName)) throw new Error("Provide a pinned Maui capture, editorial review, resolution documents and external output directory.");
	const typed = plan as unknown as Plan;
	assertExternalStateDataDirectory(typed.outputDirectory);
	const parent = await realpath(dirname(typed.outputDirectory));
	assertExternalStateDataDirectory(parent);
	if (join(parent, basename(typed.outputDirectory)) !== typed.outputDirectory) throw new Error("Maui preparation output must use its physical external path.");
	let combinedBytes = 0;
	async function read(input: Pinned) {
		if (!pinned(input)) throw new Error("Maui preparation inputs require exact file pins.");
		const body = await readBoundedStateDataBytes(input.path);
		combinedBytes += body.length;
		if (combinedBytes > 32 * 1024 * 1024 || hash(body) !== input.sha256) throw new Error("Maui preparation input bytes changed or exceed their limit.");
		return body;
	}
	const bundle: unknown = JSON.parse((await read(typed.capture)).toString("utf8"));
	if (!object(bundle) || !keys(bundle, ["inventory", "capture"]) || !isDeepStrictEqual(readMauiCharterCapture(bundle.capture, now), bundle.inventory)) throw new Error("The Maui capture bundle and extracted county inventory disagree.");
	for (const document of typed.documents) {
		const body = await read(document);
		if (!body.subarray(0, 5).equals(Buffer.from("%PDF-"))) throw new Error("Maui resolution evidence must retain original PDF bytes.");
	}
	const review = typed.review ? JSON.parse((await read(typed.review)).toString("utf8")) : null;
	const result = buildMauiMeasureDraft(bundle.capture, typed.documents, review, now);
	await mkdir(typed.outputDirectory, { mode: 0o700 });
	const output = typed.outputDirectory;
	await writeFile(join(output, `${typed.outputName}-review-template.json`), `${JSON.stringify(result.template, null, 2)}\n`, { flag: "wx", mode: 0o600 });
	const disposition = { schemaVersion: 1, type: "maui-measure-guide-preparation-result", status: result.draft ? "prepared-for-review" : "editorial-review-required", electionDate: result.inventory.electionDate, questions: result.inventory.questions.length, issues: result.issues, publisherRequests: 0, publicationApproved: false, automaticImportApproved: false, imported: false };
	if (result.draft) {
		const article = (bundle.capture as { documents: { url: string; body: string }[] }).documents.find(document => document.url === result.inventory.questions[0]!.articleUrl)!;
		const articlePath = join(output, `${typed.outputName}-county-publication.html`);
		const draftPath = join(output, `${typed.outputName}-native-draft.json`);
		const draftBody = `${JSON.stringify(result.draft, null, 2)}\n`;
		await writeFile(articlePath, article.body, { flag: "wx", mode: 0o600 });
		await writeFile(draftPath, draftBody, { flag: "wx", mode: 0o600 });
		const nativePlan = { schemaVersion: 1, type: "state-measure-guide-preparation", baseSnapshot: typed.baseSnapshot, inputs: [{ path: draftPath, sha256: hash(draftBody), stateCode: "HI", electionDate: result.inventory.electionDate, jurisdiction: result.inventory.jurisdiction, summaryAsExplanation: false, documents: Object.entries(result.draft.documents).map(([key, document]) => ({ key, url: document.url, sha256: document.sha256, capturedAt: document.capturedAt, path: key === "county-publication" ? articlePath : typed.documents.find(item => item.url === document.url)!.path })) }], outputDirectory: join(output, "assembly"), outputName: typed.outputName };
		const nativePlanPath = join(output, `${typed.outputName}-assembly-plan.json`);
		await writeFile(nativePlanPath, `${JSON.stringify(nativePlan, null, 2)}\n`, { flag: "wx", mode: 0o600 });
		await prepareStateMeasureGuideFiles(nativePlanPath, now);
	}
	await writeFile(join(output, `${typed.outputName}-result.json`), `${JSON.stringify(disposition, null, 2)}\n`, { flag: "wx", mode: 0o600 });
	return { ...disposition, outputDirectory: output };
}
