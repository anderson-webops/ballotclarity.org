import type { Measure, MeasureFiscalItem, Source } from "./types/civic.js";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { mkdir, realpath, writeFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, join } from "node:path";
import { readLafayetteBallotResearchFiles } from "./prepare-lafayette-ballot-research.js";
import { extractStateBallotPdfText, resolveStateBallotPdfExtractor } from "./state-ballot-pdf.js";
import { assertExternalStateDataDirectory, readBoundedStateDataBytes } from "./state-ballot-storage.js";
import { prepareStateMeasureGuideFiles } from "./state-measure-guides.js";
import { containsControlCharacters } from "./text-validation.js";

type Research = Awaited<ReturnType<typeof readLafayetteBallotResearchFiles>>["report"];
interface Pinned { path: string; sha256: string }
export interface LafayetteResolutionEvidence extends Pinned { area: string; resolution: string; url: string; capturedAt: string }
interface ReviewRow { id: string; questionSha256: string; resolutionSha256: string; callPropositionNumber: number | null; questionPages: number[]; noticePage: number | null; certificationPage: number | null; summary: string; yesMeaning: string; noMeaning: string }
interface Review { schemaVersion: 1; type: "lafayette-measure-editorial-review"; electionDate: string; reviewedAt: string | null; questions: ReviewRow[]; publicationApproved: false; automaticImportApproved: false }
interface Plan { schemaVersion: 1; type: "lafayette-measure-guide-preparation"; researchPlan: Pinned; review: Pinned | null; documents: LafayetteResolutionEvidence[]; baseSnapshot: Pinned | null; outputDirectory: string; outputName: string }
const hash = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");
const record = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value));
const exact = (value: object, keys: string[]) => Object.keys(value).sort().join(",") === [...keys].sort().join(",");
const digest = (value: unknown): value is string => typeof value === "string" && /^[a-f\d]{64}$/u.test(value);
const pinned = (value: unknown): value is Pinned => record(value) && typeof value.path === "string" && isAbsolute(value.path) && digest(value.sha256);
const instant = (value: unknown, now: number): value is string => typeof value === "string" && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value && Date.parse(value) <= now;
const page = (value: unknown): value is number => Number.isInteger(value) && Number(value) >= 1 && Number(value) <= 50;
const text = (value: unknown): value is string => typeof value === "string" && value === value.trim() && value.length <= 1200 && !containsControlCharacters(value) && !/^[=+@-]/u.test(value);

export function buildLafayetteMeasureDrafts(research: Research, documents: LafayetteResolutionEvidence[], reviewInput: unknown, now = Date.now()) {
	const areas = [
		...new Set(research.rows.map(row => row.area))
	];
	if (!research.exactQuestionSetsAgree || research.publicationApproved !== false || research.automaticImportApproved !== false || !research.rows.length || research.rows.length > 50
		|| research.rows.some(row => !["Lafayette Parish", "City of Lafayette"].includes(row.area) || hash(row.question) !== row.questionSha256 || row.id !== hash(`${research.electionDate}:${row.area}:${row.question}`).slice(0, 24))
		|| !Array.isArray(documents) || documents.length !== areas.length || new Set(documents.map(document => document.area)).size !== areas.length
		|| documents.some(document => !pinned(document) || !exact(document, [
			"path",
			"sha256",
			"area",
			"resolution",
			"url",
			"capturedAt"
		]) || !areas.includes(document.area) || !instant(document.capturedAt, now)
		|| !new RegExp(`^${document.area === "Lafayette Parish"
			? "PR"
			: "CR"}-\\d{3}-20\\d{2}$`, "u").test(document.resolution) || !/^https:\/\/apps\.lafayettela\.gov\/obcouncil\/api\/Document\/[1-9]\d{0,11}\/$/u.test(document.url))) {
		throw new Error("Lafayette questions require their exact independently pinned parish or city call documents.");
	}
	const template: Review = {
		schemaVersion: 1,
		type: "lafayette-measure-editorial-review",
		electionDate: research.electionDate,
		reviewedAt: null,
		questions: research.rows.map(row => ({
			id: row.id,
			questionSha256: row.questionSha256,
			resolutionSha256: documents.find(document => document.area === row.area)!.sha256,
			callPropositionNumber: null,
			questionPages: [],
			noticePage: null,
			certificationPage: null,
			summary: "",
			yesMeaning: "",
			noMeaning: ""
		})),
		publicationApproved: false,
		automaticImportApproved: false
	};
	let review: Review | null = null;
	if (reviewInput !== null) {
		if (!record(reviewInput) || !exact(reviewInput, [
			"schemaVersion",
			"type",
			"electionDate",
			"reviewedAt",
			"questions",
			"publicationApproved",
			"automaticImportApproved"
		]) || reviewInput.schemaVersion !== 1 || reviewInput.type !== template.type || reviewInput.electionDate !== research.electionDate || (reviewInput.reviewedAt !== null && !instant(reviewInput.reviewedAt, now)) || reviewInput.publicationApproved !== false || reviewInput.automaticImportApproved !== false || !Array.isArray(reviewInput.questions) || reviewInput.questions.length > 50) {
			throw new Error("Provide an unpublished editorial review for this exact Lafayette election.");
		}
		const identities = new Set<string>();
		for (const row of reviewInput.questions) {
			if (!record(row) || !exact(row, [
				"id",
				"questionSha256",
				"resolutionSha256",
				"callPropositionNumber",
				"questionPages",
				"noticePage",
				"certificationPage",
				"summary",
				"yesMeaning",
				"noMeaning"
			]) || typeof row.id !== "string" || !/^[a-f\d]{24}$/u.test(row.id) || identities.has(row.id) || !digest(row.questionSha256) || !digest(row.resolutionSha256)
			|| (row.callPropositionNumber !== null && !page(row.callPropositionNumber)) || (row.noticePage !== null && !page(row.noticePage)) || (row.certificationPage !== null && !page(row.certificationPage)) || !Array.isArray(row.questionPages) || row.questionPages.length > 20 || new Set(row.questionPages).size !== row.questionPages.length || row.questionPages.some(value => !page(value)) || !text(row.summary) || !text(row.yesMeaning) || !text(row.noMeaning)) {
				throw new Error("Lafayette review rows require unique question identities, source hashes, reviewed pages and concise vote meanings.");
			}
			identities.add(row.id);
		}
		review = reviewInput as unknown as Review;
	}
	const issues: { id: string | null; reason: string }[] = [];
	if (!review?.reviewedAt) issues.push({ id: null, reason: "editorial-review-required" });
	for (const expected of template.questions) {
		const row = review?.questions.find(row => row.id === expected.id);
		if (!row) issues.push({ id: expected.id, reason: "missing-review" });
		else if (row.questionSha256 !== expected.questionSha256) issues.push({ id: row.id, reason: "question-changed" });
		else if (row.resolutionSha256 !== expected.resolutionSha256) issues.push({ id: row.id, reason: "call-document-changed" });
		else if (!row.summary || !row.yesMeaning || !row.noMeaning || !row.questionPages.length || row.callPropositionNumber === null || row.noticePage === null || row.certificationPage === null) issues.push({ id: row.id, reason: "review-incomplete" });
	}
	for (const row of review?.questions ?? []) {
		if (!template.questions.some(expected => expected.id === row.id)) issues.push({ id: row.id, reason: "question-no-longer-offered" });
	}
	for (const area of areas) {
		const selected = research.rows.filter(row => row.area === area);
		const numbers = selected.map(question => review?.questions.find(row => row.id === question.id)?.callPropositionNumber).filter(value => value !== undefined && value !== null).sort((first, second) => first - second);
		if (numbers.length === selected.length && numbers.join(",") !== selected.map((_, index) => index + 1).join(",")) issues.push({ id: null, reason: "call-numbering-requires-review" });
	}
	if (issues.length) return { template, issues, drafts: [] };
	const reviewedAt = review!.reviewedAt!;
	const drafts = areas.map((area) => {
		const document = documents.find(document => document.area === area)!;
		const selected = research.rows.filter(row => row.area === area);
		const reviewedPages = [
			...new Set(selected.flatMap((question) => {
				const row = review!.questions.find(row => row.id === question.id)!;
				return [...row.questionPages, row.noticePage!, row.certificationPage!];
			}))
		].sort((first, second) => first - second);
		const jurisdiction = {
			jurisdictionType: area === "Lafayette Parish"
				? "county"
				: "city",
			name: area === "Lafayette Parish"
				? area
				: "Lafayette",
			slug: area === "Lafayette Parish"
				? "la-lafayette-parish"
				: "la-lafayette-city"
		};
		const measures = selected.map((question): Measure => {
			const row = review!.questions.find(row => row.id === question.id)!;
			const slug = `la-lafayette-${research.electionDate}-${question.id}`;
			const source: Source = {
				id: `${slug}-call`,
				title: `${document.resolution}, proposition ${row.callPropositionNumber}`,
				publisher: `Lafayette ${area === "Lafayette Parish"
					? "Parish"
					: "City"} Council`,
				type: "official record",
				authority: "official-government",
				sourceSystem: "Lafayette council document archive",
				date: "",
				url: `${document.url}#page=${row.questionPages[0]}`
			};
			const fiscal = question.fiscal;
			const money = (value: number) => `$${value.toLocaleString("en-US")}`;
			const rows: { label: string; value: string; horizon: string; note?: string }[] = fiscal.kind === "property-tax-continuation"
				? [
						{ label: "Property tax rate", value: `${fiscal.mills} mills`, horizon: `${fiscal.firstYear}–${fiscal.lastYear}` },
						{
							label: "Estimated annual revenue",
							value: money(fiscal.estimatedAnnualRevenueDollars!),
							horizon: `${fiscal.firstYear}–${fiscal.lastYear}`
						}
					]
				: [
						{ label: "Maximum borrowing", value: `Up to ${money(fiscal.maximumBondDollars!)}`, horizon: "Bond authorization" },
						{ label: "Maximum term", value: `Up to ${fiscal.maximumYears} years`, horizon: "Bond repayment" },
						{ label: "Interest-rate ceiling", value: `Up to ${fiscal.maximumAnnualInterestPercent}% annually`, horizon: "Bond repayment" },
						{
							label: "Referenced existing millage",
							value: `${fiscal.firstYearReferencedMills} mills`,
							horizon: "First-year comparison",
							note: "The question compares its first-year estimate with this existing rate."
						}
					];
			const fiscalSummary: MeasureFiscalItem[] = rows.map((value, index) => ({
				id: `${slug}-fiscal-${index + 1}`,
				...value,
				scope: area,
				note: value.note ?? "",
				sources: [source]
			}));
			return {
				slug,
				contestSlug: `${slug}-contest`,
				title: question.title,
				location: `${jurisdiction.name}, Louisiana`,
				summary: row.summary,
				ballotSummary: question.question,
				plainLanguageExplanation: row.summary,
				currentLawOverview: "",
				currentPractice: [],
				proposedChanges: [],
				yesMeaning: row.yesMeaning,
				noMeaning: row.noMeaning,
				yesHighlights: [],
				noHighlights: [],
				fiscalContextNote: "",
				implementationOverview: "",
				implementationTimeline: [],
				fiscalSummary,
				potentialImpacts: [],
				supportArguments: [],
				opposeArguments: [],
				argumentsDisclaimer: "",
				argumentsAndConsiderations: [],
				freshness: {
					contentLastVerifiedAt: reviewedAt,
					dataLastUpdatedAt: [research.sources.governmentPage.capturedAt, document.capturedAt].sort()[0]!,
					nextReviewAt: new Date(Date.parse(reviewedAt) + 30 * 86_400_000).toISOString(),
					status: "incomplete",
					statusLabel: "",
					statusNote: ""
				},
				whatWeKnow: [],
				whatWeDoNotKnow: [],
				sources: [source],
				updatedAt: reviewedAt
			};
		});
		return {
			schemaVersion: 1,
			type: "state-measure-draft",
			stateCode: "LA",
			electionDate: research.electionDate,
			jurisdiction,
			reviewedAt,
			publicationApproved: false,
			automaticImportApproved: false,
			measures,
			documents: {
				councilCall: {
					url: document.url,
					sha256: document.sha256,
					capturedAt: document.capturedAt,
					publicationDate: null,
					reviewedPages
				}
			},
			unresolvedFields: [
				{ reason: "final-official-ballot-and-amendment-review-required", finalBallotNumbersVerified: false },
				{ reason: "personal-applicability-unverified" },
				...research.conflicts.filter(row => row.area === area).map(row => ({ reason: "original-publisher-number-conflict", ...row }))
			],
			unmappedQuestions: []
		};
	});
	return { template, issues, drafts };
}

export async function prepareLafayetteMeasureGuideFiles(planPath: string, options: { now?: number; extract?: (bytes: Buffer) => Promise<string>; inspect?: (bytes: Buffer) => Promise<number> } = {}) {
	const now = options.now ?? Date.now();
	const value: unknown = JSON.parse((await readBoundedStateDataBytes(planPath, 128 * 1024)).toString("utf8"));
	if (!record(value) || !exact(value, [
		"schemaVersion",
		"type",
		"researchPlan",
		"review",
		"documents",
		"baseSnapshot",
		"outputDirectory",
		"outputName"
	]) || value.schemaVersion !== 1 || value.type !== "lafayette-measure-guide-preparation" || !pinned(value.researchPlan) || (value.review !== null && !pinned(value.review)) || (value.baseSnapshot !== null && !pinned(value.baseSnapshot)) || !Array.isArray(value.documents) || value.documents.length > 2 || typeof value.outputDirectory !== "string" || typeof value.outputName !== "string" || !/^[a-z0-9][a-z0-9-]{0,100}$/u.test(value.outputName)) {
		throw new Error("Provide pinned Lafayette research, call documents, review and external output directory.");
	}
	const plan = value as unknown as Plan;
	assertExternalStateDataDirectory(plan.outputDirectory);
	if (join(await realpath(dirname(plan.outputDirectory)), basename(plan.outputDirectory)) !== plan.outputDirectory) throw new Error("Lafayette preparation output must use its physical external path.");
	let bytesRead = 0;
	async function read(input: Pinned) {
		if (!pinned(input)) throw new Error("Lafayette evidence requires absolute paths and original hashes.");
		const body = await readBoundedStateDataBytes(input.path);
		bytesRead += body.length;
		if (bytesRead > 32 * 1024 * 1024 || hash(body) !== input.sha256) throw new Error("Lafayette evidence bytes changed or exceed preparation bounds.");
		return body;
	}
	await read(plan.researchPlan);
	const { report, inputBytes } = await readLafayetteBallotResearchFiles(plan.researchPlan.path, options.extract, now, plan.researchPlan.sha256);
	bytesRead += inputBytes;
	const pageCounts = new Map<string, number>();
	for (const document of plan.documents) {
		const body = await read(document);
		if (!body.subarray(0, 5).equals(Buffer.from("%PDF-"))) throw new Error("Lafayette call evidence must retain original PDF bytes.");
		const pages = await (options.inspect ?? (async bytes => [
			...(await extractStateBallotPdfText(bytes, await resolveStateBallotPdfExtractor(), undefined, "bbox-layout", 50)).matchAll(/<page\b/gu)
		].length))(body);
		if (!page(pages)) throw new Error("The Lafayette call PDF exceeds its reviewed page bounds.");
		pageCounts.set(document.url, pages);
	}
	const review = plan.review
		? JSON.parse((await read(plan.review)).toString("utf8"))
		: null;
	const result = buildLafayetteMeasureDrafts(report, plan.documents, review, now);
	if (result.drafts.some(draft => draft.documents.councilCall.reviewedPages.some(selected => selected > pageCounts.get(draft.documents.councilCall.url)!))) throw new Error("A reviewed Lafayette page is outside its original PDF.");
	await mkdir(plan.outputDirectory, { mode: 0o700 });
	const write = async (name: string, data: unknown) => {
		const body = `${JSON.stringify(data, null, 2)}\n`;
		if (Buffer.byteLength(body) > 12 * 1024 * 1024) throw new Error("Lafayette preparation output exceeds its bound.");
		await writeFile(join(plan.outputDirectory, name), body, { flag: "wx", mode: 0o600 });
		return {
			name,
			bytes: Buffer.byteLength(body),
			sha256: hash(body)
		};
	};
	const files = [await write("editorial-review-template.json", result.template), await write("preparation-review.json", {
		schemaVersion: 1,
		type: "lafayette-measure-guide-review",
		researchPlanSha256: plan.researchPlan.sha256,
		reviewSha256: plan.review?.sha256 ?? null,
		issues: result.issues,
		publisherConflicts: report.conflicts,
		resolutionPlaceholdersAsPublished: report.unresolvedResolutions,
		originalCandidateReferencesExcluded: true,
		finalBallotNumbersVerified: false,
		personalApplicabilityVerified: false,
		publicationApproved: false,
		automaticImportApproved: false
	})];
	const inputs = [];
	for (const draft of result.drafts) {
		const file = await write(`${plan.outputName}-${draft.jurisdiction.jurisdictionType}-native-draft.json`, draft);
		files.push(file);
		const document = plan.documents.find(document => document.area === (draft.jurisdiction.jurisdictionType === "county"
			? "Lafayette Parish"
			: "City of Lafayette"))!;
		inputs.push({
			path: join(plan.outputDirectory, file.name),
			sha256: file.sha256,
			stateCode: "LA",
			electionDate: report.electionDate,
			jurisdiction: draft.jurisdiction,
			summaryAsExplanation: false,
			documents: [
				{
					key: "councilCall",
					path: document.path,
					sha256: document.sha256,
					url: document.url,
					capturedAt: document.capturedAt
				}
			]
		});
	}
	let prepared: Awaited<ReturnType<typeof prepareStateMeasureGuideFiles>> | null = null;
	if (inputs.length) {
		const assembly = await write("guide-preparation-plan.json", {
			schemaVersion: 1,
			type: "state-measure-guide-preparation",
			baseSnapshot: plan.baseSnapshot,
			inputs,
			outputDirectory: join(plan.outputDirectory, "guides"),
			outputName: plan.outputName
		});
		files.push(assembly);
		prepared = await prepareStateMeasureGuideFiles(join(plan.outputDirectory, assembly.name), now);
	}
	const manifest = {
		schemaVersion: 1,
		type: "lafayette-measure-guide-preparation-result",
		files,
		guides: result.drafts.length,
		measures: result.drafts.reduce((total, draft) => total + draft.measures.length, 0),
		reviewRequired: result.issues.length > 0,
		prepared,
		publisherRequests: 0,
		imported: false,
		publicationApproved: false,
		automaticImportApproved: false,
		finalBallotNumbersVerified: false,
		personalApplicabilityVerified: false
	};
	await write("MANIFEST.json", manifest);
	return manifest;
}
