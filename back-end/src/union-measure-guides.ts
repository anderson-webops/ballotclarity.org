import type { Buffer } from "node:buffer";
import type { Measure } from "./types/civic.js";
import { mkdir, open, realpath } from "node:fs/promises";
import { basename, dirname, isAbsolute, join } from "node:path";
import { readUnionQuestionPreparation } from "./prepare-union-ballot-questions.js";
import { assertExternalStateDataDirectory, readBoundedStateDataBytes } from "./state-ballot-storage.js";
import { prepareStateMeasureGuideFiles } from "./state-measure-guides.js";
import { containsControlCharacters } from "./text-validation.js";
import { unionCandidateHash as hash } from "./union-county-candidates.js";

type Report = Awaited<ReturnType<typeof readUnionQuestionPreparation>>["result"];
type Kind = "city" | "town" | "township" | "village";
interface Pinned { path: string; sha256: string }
interface Row { questionId: string; questionSha256: string; witnessesSha256: string; jurisdictionType: Kind | ""; title: string; summary: string; yesMeaning: string; noMeaning: string }
interface Review { schemaVersion: 1; type: "union-measure-editorial-review"; electionDate: string; reviewedAt: string | null; questions: Row[]; publicationApproved: false; automaticImportApproved: false }
const object = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value));
const keys = (value: unknown, expected: string[]): value is Record<string, unknown> => object(value) && Object.keys(value).sort().join(",") === [...expected].sort().join(",");
const digest = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
const pin = (value: unknown): value is Pinned => keys(value, ["path", "sha256"]) && typeof value.path === "string" && isAbsolute(value.path) && digest(value.sha256);
const clean = (value: unknown, maximum: number) => typeof value === "string" && value === value.trim() && value.length > 0 && value.length <= maximum && !containsControlCharacters(value);
const identifier = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/gu, "-").replace(/^-|-$/gu, "");
const witnesses = (question: Report["questions"][number]) => hash(JSON.stringify(question.sources.map(({ form, sourceUrl, sourceSha256, page, publishedLabels }) => ({ form, sourceUrl, sourceSha256, page, publishedLabels }))));
function printedKind(question: Report["questions"][number]): Kind | "" {
	const text = question.question.officialText.en.toLowerCase();
	return (["city", "township", "town", "village"] as const).find(kind => text.includes(`${kind} of ${question.question.municipality.toLowerCase()} `)) ?? "";
}

export function buildUnionMeasureDrafts(report: Report, value: unknown, now = Date.now()) {
	const template: Review = { schemaVersion: 1, type: "union-measure-editorial-review", electionDate: report.electionDate, reviewedAt: null, questions: report.questions.map(question => ({ questionId: question.id, questionSha256: hash(JSON.stringify(question.question)), witnessesSha256: witnesses(question), jurisdictionType: printedKind(question), title: "", summary: "", yesMeaning: "", noMeaning: "" })), publicationApproved: false, automaticImportApproved: false };
	const issues: { questionId: string; reason: string }[] = [];
	let review: Review | null = null;
	if (value !== null) {
		if (!keys(value, ["schemaVersion", "type", "electionDate", "reviewedAt", "questions", "publicationApproved", "automaticImportApproved"]) || value.schemaVersion !== 1 || value.type !== template.type || value.electionDate !== report.electionDate || value.publicationApproved !== false || value.automaticImportApproved !== false || typeof value.reviewedAt !== "string" || !Number.isFinite(Date.parse(value.reviewedAt)) || new Date(value.reviewedAt).toISOString() !== value.reviewedAt || Date.parse(value.reviewedAt) > now || !Array.isArray(value.questions) || value.questions.length > 99) throw new Error("Provide an exact dated Union editorial review without publication authority.");
		const ids = new Set<string>();
		for (const row of value.questions) {
			if (!keys(row, ["questionId", "questionSha256", "witnessesSha256", "jurisdictionType", "title", "summary", "yesMeaning", "noMeaning"]) || typeof row.questionId !== "string" || !/^[a-f0-9]{24}$/u.test(row.questionId) || ids.has(row.questionId) || !digest(row.questionSha256) || !digest(row.witnessesSha256) || typeof row.jurisdictionType !== "string" || !["", "city", "town", "township", "village"].includes(row.jurisdictionType) || [row.title, row.summary, row.yesMeaning, row.noMeaning].some(text => typeof text !== "string" || text.length > 1200 || containsControlCharacters(text))) throw new Error("Union question review fields or identities require review.");
			ids.add(row.questionId);
		}
		review = value as unknown as Review;
		for (const row of review.questions) {
			if (!report.questions.some(question => question.id === row.questionId)) issues.push({ questionId: row.questionId, reason: "question-no-longer-offered" });
		}
	}
	for (const question of report.questions) {
		const row = review?.questions.find(row => row.questionId === question.id);
		if (!row) issues.push({ questionId: question.id, reason: "editorial-review-required" });
		else if (row.questionSha256 !== hash(JSON.stringify(question.question))) issues.push({ questionId: question.id, reason: "question-changed" });
		else if (row.witnessesSha256 !== witnesses(question)) issues.push({ questionId: question.id, reason: "source-witnesses-changed" });
		else if (!row.jurisdictionType || (printedKind(question) && printedKind(question) !== row.jurisdictionType)) issues.push({ questionId: question.id, reason: "municipal-scope-review-required" });
		else if (!clean(row.title, 100) || !clean(row.summary, 600) || !clean(row.yesMeaning, 1200) || !clean(row.noMeaning, 1200)) issues.push({ questionId: question.id, reason: "editorial-review-incomplete" });
	}
	const drafts = [];
	if (!issues.length && review) {
		for (const question of report.questions) {
			const row = review.questions.find(row => row.questionId === question.id)!;
			const area = identifier(question.question.municipality);
			const slug = `nj-${area}-${report.electionDate}-question`;
			const source = question.sources[0]!;
			const clock = new Date(Math.min(...question.sources.map(source => Date.parse(source.capturedAt)))).toISOString();
			const measure: Measure = { slug, contestSlug: `${slug}-contest`, title: row.title, location: `${question.question.municipality}, New Jersey`, summary: row.summary, ballotSummary: question.question.officialText.en, plainLanguageExplanation: row.summary, currentLawOverview: "", currentPractice: [], proposedChanges: [], yesMeaning: row.yesMeaning, noMeaning: row.noMeaning, yesHighlights: [], noHighlights: [], fiscalContextNote: "", implementationOverview: "", implementationTimeline: [], fiscalSummary: [], potentialImpacts: [], supportArguments: [], opposeArguments: [], argumentsDisclaimer: "", argumentsAndConsiderations: [], freshness: { contentLastVerifiedAt: review.reviewedAt!, dataLastUpdatedAt: clock, nextReviewAt: new Date(Date.parse(review.reviewedAt!) + 30 * 86400000).toISOString(), status: "incomplete", statusLabel: "", statusNote: "" }, whatWeKnow: [], whatWeDoNotKnow: [], sources: [{ id: `${slug}-source`, title: `${question.question.municipality} sample ballot`, publisher: "Union County, New Jersey", type: "official record", authority: "official-government", sourceSystem: "Union County Elections", date: "", url: `${source.sourceUrl}#page=${source.page}` }], updatedAt: review.reviewedAt! };
			drafts.push({ schemaVersion: 1, type: "state-measure-draft", stateCode: "NJ", electionDate: report.electionDate, jurisdiction: { jurisdictionType: row.jurisdictionType as Kind, name: question.question.municipality, slug: `nj-${area}` }, reviewedAt: review.reviewedAt!, publicationApproved: false, automaticImportApproved: false, measures: [measure], documents: { ballot: { url: source.sourceUrl, sha256: source.sourceSha256, capturedAt: source.capturedAt, publicationDate: null, reviewedPages: [source.page] } }, unresolvedFields: [], unmappedQuestions: [] });
		}
	}
	return { template, issues, drafts };
}

async function persist(directory: string, name: string, body: string | Buffer) {
	const handle = await open(join(directory, name), "wx", 0o600);
	try {
		await handle.writeFile(body);
		await handle.sync();
	}
	finally { await handle.close(); }
}
export async function prepareUnionMeasureGuideFiles(planPath: string, options: Parameters<typeof readUnionQuestionPreparation>[1] = {}) {
	const now = (options.now ?? Date.now)();
	const value: unknown = JSON.parse((await readBoundedStateDataBytes(planPath, 128 * 1024)).toString("utf8"));
	if (!keys(value, ["schemaVersion", "type", "ballotCaptures", "review", "baseSnapshot", "outputDirectory", "outputName"]) || value.schemaVersion !== 1 || value.type !== "union-measure-guide-preparation" || (value.review !== null && !pin(value.review)) || (value.baseSnapshot !== null && !pin(value.baseSnapshot)) || typeof value.outputDirectory !== "string" || typeof value.outputName !== "string" || !/^[a-z0-9][a-z0-9-]{0,60}$/u.test(value.outputName)) throw new Error("Provide complete pinned Union captures, editorial review and external guide output.");
	assertExternalStateDataDirectory(value.outputDirectory);
	const parent = await realpath(dirname(value.outputDirectory));
	if (join(parent, basename(value.outputDirectory)) !== value.outputDirectory) throw new Error("Union measure output requires a physical external directory.");
	const native = await readUnionQuestionPreparation(value.ballotCaptures, options);
	let review: unknown = null;
	if (value.review !== null) {
		const body = await readBoundedStateDataBytes(value.review.path, 128 * 1024);
		if (hash(body) !== value.review.sha256) throw new Error("Union editorial review bytes changed.");
		review = JSON.parse(body.toString("utf8"));
	}
	const prepared = buildUnionMeasureDrafts(native.result, review, now);
	const output = value.outputDirectory;
	await mkdir(output, { mode: 0o700 });
	await persist(output, "review-template.json", `${JSON.stringify(prepared.template, null, 2)}\n`);
	await persist(output, "questions.json", `${JSON.stringify(native.result, null, 2)}\n`);
	await persist(output, "questions.csv", native.csv);
	const inputs = [];
	for (const draft of prepared.drafts) {
		const document = draft.documents.ballot;
		const original = native.originals.find(original => original.metadata.url === document.url && original.metadata.sha256 === document.sha256)!;
		const pdfName = `${document.sha256}.pdf`;
		await persist(output, pdfName, original.body);
		const name = `${draft.jurisdiction.slug}-draft.json`;
		const body = `${JSON.stringify(draft, null, 2)}\n`;
		await persist(output, name, body);
		inputs.push({ path: join(output, name), sha256: hash(body), stateCode: "NJ", electionDate: draft.electionDate, jurisdiction: draft.jurisdiction, summaryAsExplanation: false, documents: [{ key: "ballot", url: document.url, sha256: document.sha256, capturedAt: document.capturedAt, path: join(output, pdfName) }] });
	}
	if (inputs.length) {
		const plan = { schemaVersion: 1, type: "state-measure-guide-preparation", baseSnapshot: value.baseSnapshot, inputs, outputDirectory: join(output, "assembly"), outputName: value.outputName };
		await persist(output, "assembly-plan.json", `${JSON.stringify(plan, null, 2)}\n`);
		await prepareStateMeasureGuideFiles(join(output, "assembly-plan.json"), now);
	}
	const result = { schemaVersion: 1, type: "union-measure-guide-preparation-result", status: prepared.issues.length ? "editorial-review-required" : inputs.length ? "prepared-for-review" : "no-questions-offered", electionDate: native.result.electionDate, questions: native.result.questionCount, preparedGuides: inputs.length, sampleForms: native.result.sampleFormsReviewed, issues: prepared.issues, publisherRequests: 0, currentLawIndependentlyVerified: false, translationEquivalenceVerified: false, voterApplicabilityVerified: false, publicationApproved: false, automaticImportApproved: false, imported: false };
	await persist(output, "result.json", `${JSON.stringify(result, null, 2)}\n`);
	return { ...result, outputDirectory: output };
}
