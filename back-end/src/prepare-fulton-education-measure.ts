import type { Source } from "./types/civic.js";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { mkdir, realpath, writeFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, join } from "node:path";
import process from "node:process";
import { isDeepStrictEqual } from "node:util";
import { readFultonEducationNotice } from "./fulton-education-notice.js";
import { readFultonEducationNoticeCapture } from "./prepare-fulton-education-notice.js";
import { extractStateBallotPdfText, resolveStateBallotPdfExtractor } from "./state-ballot-pdf.js";
import { assertExternalStateDataDirectory, readBoundedStateDataBytes } from "./state-ballot-storage.js";
import { parseStateMeasureDraft } from "./state-measure-guides.js";

type Notice = Awaited<ReturnType<typeof readFultonEducationNoticeCapture>>["report"];
interface Pinned { path: string; sha256: string }
interface Plan { schemaVersion: 1; type: "fulton-education-measure-supplement"; draft: Pinned; capture: Pinned; measureSlug: string; outputDirectory: string }
const hash = (body: string | Uint8Array) => createHash("sha256").update(body).digest("hex");
const record = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value));
const exact = (value: unknown, keys: string[]): value is Record<string, unknown> => record(value) && Object.keys(value).sort().join(",") === [...keys].sort().join(",");
const pinned = (value: unknown): value is Pinned => exact(value, ["path", "sha256"]) && typeof value!.path === "string" && isAbsolute(value!.path) && typeof value!.sha256 === "string" && /^[a-f\d]{64}$/u.test(value!.sha256);
const clean = (value: string) => value.replace(/\s+/gu, " ").trim();
const money = "(\\d[\\d,]*\\.\\d{2})";

export function buildFultonEducationMeasureSupplement(value: unknown, notice: Notice, text: string, measureSlug: string, now = Date.now()) {
	if (!record(value) || !record(value.jurisdiction) || value.jurisdiction.jurisdictionType !== "county" || value.jurisdiction.name !== "Fulton County" || typeof value.jurisdiction.slug !== "string") throw new Error("The notice supplement requires an explicit Fulton County draft.");
	const facts = readFultonEducationNotice(text, notice.electionDate);
	for (const [key, expected] of Object.entries(facts)) {
		if (!isDeepStrictEqual(notice[key as keyof typeof facts], expected)) throw new Error("The notice report disagrees with its original text.");
	}
	const draft = structuredClone(parseStateMeasureDraft(value, { stateCode: "GA", electionDate: facts.electionDate, jurisdiction: { jurisdictionType: "county", name: "Fulton County", slug: value.jurisdiction.slug } }, now));
	const selected = draft.measures.filter(measure => measure.slug === measureSlug);
	if (selected.length !== 1) throw new Error("Select exactly one existing education measure.");
	const measure = selected[0]!;
	const body = clean(measure.ballotSummary);
	const required = (pattern: RegExp) => {
		const matches = [...body.matchAll(pattern)];
		if (matches.length !== 1) throw new Error("The education ballot and notice require fiscal reconciliation.");
		return matches[0]![1]!;
	};
	if (!body.includes("special one percent sales and use tax for educational purposes")) throw new Error("The target is not a recognized education-tax question.");
	const amounts = [
		[new RegExp(`raise not more than \\$${money} to be used`, "gu"), facts.maximumCollectionsCents],
		[new RegExp(`in an amount not to exceed \\$${money} for the Fulton County School District`, "gu"), facts.fcsMaximumProjectCostCents],
		[new RegExp(`at a total maximum cost of \\$${money}`, "gu"), facts.apsMaximumProjectCostCents],
		[new RegExp(`principal amount of up to \\$${money}`, "gu"), facts.maximumBondPrincipalCents],
	] as const;
	for (const [pattern, expected] of amounts) {
		const amount = required(pattern);
		if (!/^(?:0|[1-9]\d{0,2}(?:,\d{3})*)\.\d{2}$/u.test(amount) || Number(amount.replace(/[,.]/gu, "")) !== expected) throw new Error("The education ballot and notice amounts disagree.");
	}
	if (Number(required(/for not longer than ([1-9]\d?) consecutive calendar quarters/gu)) !== facts.maximumCalendarQuarters) throw new Error("The education ballot and notice tax periods disagree.");
	const start = new Date(`${facts.taxStartDate}T00:00:00Z`);
	const startText = `${new Intl.DateTimeFormat("en-US", { month: "long", timeZone: "UTC" }).format(start)} ${start.getUTCDate()} ${start.getUTCFullYear()}`;
	if (!body.includes(`be reimposed on ${startText} upon the expiration`)) throw new Error("The education ballot and notice start dates disagree.");
	const pages = text.split("\f").map(clean);
	const interestPages = pages.flatMap((page, index) => {
		const matches = [...page.matchAll(/maximum rate or rates of interest on such debt shall not exceed [a-z]+ percent (\d{1,2})% per annum/gu)];
		return matches.map(match => ({ page: index + 1, rate: Number(match[1]) }));
	});
	if (interestPages.length !== 1 || interestPages[0]!.rate !== facts.maximumAnnualInterestPercent) throw new Error("The interest ceiling needs an exact source page.");
	const sourceUrl = notice.source.url;
	const sourceSha256 = String(notice.source.sha256);
	const capturedAt = String(notice.source.capturedAt);
	if (!/^https:\/\/fultoncountyga\.gov\/-\/media\/[\w/-]+\.pdf$/u.test(sourceUrl) || !/^[a-f\d]{64}$/u.test(sourceSha256) || !Number.isFinite(Date.parse(capturedAt)) || new Date(capturedAt).toISOString() !== capturedAt || Date.parse(capturedAt) > now) throw new Error("The notice supplement requires its original source provenance.");
	const citation = (page: number): Source => ({ id: `ga-fulton-education-${facts.electionDate}-${sourceSha256.slice(0, 12)}-p${page}`, title: `School-tax election notice, page ${page}`, publisher: "Fulton County Board of Registration and Elections", authority: "official-government", type: "official record", sourceSystem: "Fulton County election notice", date: "", url: `${sourceUrl}#page=${page}` });
	const rows = [
		{ id: `${measure.slug}-maximum-interest`, label: "Maximum annual interest", value: `${facts.maximumAnnualInterestPercent}%`, scope: "Atlanta Independent School System bonds", horizon: "Bond term", note: "", sources: [citation(interestPages[0]!.page)] },
		...facts.schedule.map(row => ({ id: `${measure.slug}-principal-${row.year}`, label: "Maximum principal", value: row.printedAmount, scope: "Atlanta Independent School System bonds", horizon: String(row.year), note: "", sources: [citation(row.page)] })),
	];
	if (measure.fiscalSummary.length && !isDeepStrictEqual(measure.fiscalSummary, rows)) throw new Error("Existing fiscal rows require a separately reviewed replacement.");
	const sourcePages = [...new Set(rows.flatMap(row => row.sources.map(source => Number(new URL(source.url).hash.slice(6)))))].sort((first, second) => first - second);
	const document = { url: sourceUrl, sha256: sourceSha256, capturedAt, publicationDate: null, reviewedPages: sourcePages };
	if (draft.documents.educationNotice && !isDeepStrictEqual(draft.documents.educationNotice, document)) throw new Error("The existing notice document requires replacement review.");
	if (Object.entries(draft.documents).some(([key, existing]) => key !== "educationNotice" && existing.url === sourceUrl)) throw new Error("An existing notice binding requires review.");
	measure.fiscalSummary = rows;
	for (const source of rows.flatMap(row => row.sources)) {
		const previous = measure.sources.find(item => item.id === source.id);
		if (previous && !isDeepStrictEqual(previous, source)) throw new Error("A notice source ID cannot identify conflicting evidence.");
		if (!previous) measure.sources.push(source);
	}
	draft.documents.educationNotice = document;
	return { draft, fiscalRows: rows.length, sourcePages, sourceUrl, sourceSha256, capturedAt, actualInterestRateKnown: false, publicationApproved: false, automaticImportApproved: false, voterApplicabilityVerified: false };
}

export async function prepareFultonEducationMeasureFiles(path: string, options: { now?: () => number; extract?: (body: Buffer) => Promise<string> } = {}) {
	const value: unknown = JSON.parse((await readBoundedStateDataBytes(path, 32768)).toString("utf8"));
	if (!exact(value, ["schemaVersion", "type", "draft", "capture", "measureSlug", "outputDirectory"]) || value!.schemaVersion !== 1 || value!.type !== "fulton-education-measure-supplement" || !pinned(value!.draft) || !pinned(value!.capture) || typeof value!.measureSlug !== "string" || !/^[a-z0-9][a-z0-9-]{0,100}$/u.test(value!.measureSlug) || typeof value!.outputDirectory !== "string") throw new Error("Provide a pinned Fulton education-measure supplement plan.");
	const plan = value as unknown as Plan;
	assertExternalStateDataDirectory(plan.outputDirectory);
	assertExternalStateDataDirectory(join(await realpath(dirname(plan.outputDirectory)), basename(plan.outputDirectory)));
	const original = await readBoundedStateDataBytes(plan.draft.path);
	if (hash(original) !== plan.draft.sha256) throw new Error("The original measure draft hash changed.");
	const draft: unknown = JSON.parse(original.toString("utf8"));
	if (!record(draft) || typeof draft.electionDate !== "string") throw new Error("The measure draft requires its own election date.");
	let text = "";
	const notice = await readFultonEducationNoticeCapture(plan.capture.path, plan.capture.sha256, draft.electionDate, { now: options.now, extract: async (body) => {
		text = await (options.extract ?? (async bytes => extractStateBallotPdfText(bytes, await resolveStateBallotPdfExtractor(), undefined, "layout", 20)))(body);
		return text;
	} });
	const result = buildFultonEducationMeasureSupplement(draft, notice.report, text, plan.measureSlug, (options.now ?? Date.now)());
	const quote = (input: string) => `"${input.replaceAll("\"", "\"\"")}"`;
	const rows = result.draft.measures.find(measure => measure.slug === plan.measureSlug)!.fiscalSummary;
	const csv = `${[["measureSlug", "label", "value", "scope", "horizon", "page", "sourceUrl", "sourceSha256", "capturedAt"], ...rows.map(row => [plan.measureSlug, row.label, row.value, row.scope, row.horizon, new URL(row.sources[0]!.url).hash.slice(6), row.sources[0]!.url, result.sourceSha256, result.capturedAt])].map(row => row.map(quote).join(",")).join("\n")}\n`;
	const review = { schemaVersion: 1, type: "fulton-education-measure-supplement-review", electionDate: result.draft.electionDate, measureSlug: plan.measureSlug, originalDraftSha256: plan.draft.sha256, noticeCaptureSha256: plan.capture.sha256, sourceSha256: result.sourceSha256, sourceUrl: result.sourceUrl, capturedAt: result.capturedAt, sourcePages: result.sourcePages, fiscalRows: result.fiscalRows, originalBallotSummaryAndVoteMeaningsPreserved: true, originalIdentityFreshnessAndReviewClockPreserved: true, originalContextAndUncertaintyPreserved: true, fiscalAnchorsReconciled: true, fullNoticeBallotWordingCompared: false, actualInterestRateKnown: false, publicationApproved: false, automaticImportApproved: false, voterApplicabilityVerified: false, publisherRequests: 0 };
	const files = [{ name: "measure-draft.json", body: `${JSON.stringify(result.draft, null, 2)}\n` }, { name: "fiscal-research.csv", body: csv }, { name: "supplement-review.json", body: `${JSON.stringify(review, null, 2)}\n` }];
	if (files.some(file => Buffer.byteLength(file.body) > 12 * 1024 * 1024)) throw new Error("The supplemented draft exceeds its output bounds.");
	const manifest = { schemaVersion: 1, type: "fulton-education-measure-supplement-manifest", originalDraftSha256: plan.draft.sha256, noticeCaptureSha256: plan.capture.sha256, members: files.map(file => ({ path: file.name, bytes: Buffer.byteLength(file.body), sha256: hash(file.body) })) };
	await mkdir(plan.outputDirectory, { mode: 0o700 });
	for (const file of [...files, { name: "MANIFEST.json", body: `${JSON.stringify(manifest, null, 2)}\n` }]) await writeFile(join(plan.outputDirectory, file.name), file.body, { flag: "wx", mode: 0o600 });
	return { outputDirectory: plan.outputDirectory, fiscalRows: result.fiscalRows, files: 4, publisherRequests: 0, imported: false, publicationApproved: false, automaticImportApproved: false };
}

if (process.argv[1]?.endsWith("prepare-fulton-education-measure.ts") || process.argv[1]?.endsWith("prepare-fulton-education-measure.js")) {
	const [path, ...extra] = process.argv.slice(2);
	Promise.resolve().then(() => {
		if (!path || extra.length) throw new Error("Use prepare-fulton-education-measure PLAN.json.");
		return prepareFultonEducationMeasureFiles(path);
	}).then(result => console.log(JSON.stringify(result))).catch((error: unknown) => {
		console.error(error instanceof Error ? error.message : "Education-measure supplementation failed.");
		process.exitCode = 1;
	});
}
