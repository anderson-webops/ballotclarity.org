import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readdir, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { buildSeedCoverageSnapshot } from "../src/coverage-repository.js";
import { readFultonEducationNotice } from "../src/fulton-education-notice.js";
import { buildFultonEducationMeasureSupplement, prepareFultonEducationMeasureFiles } from "../src/prepare-fulton-education-measure.js";
import { address, text } from "./helpers/fulton-education-notice.js";

const stamp = "2030-10-01T00:00:00.000Z";
const now = Date.parse("2030-10-03T00:00:00Z");
function fixture(body = text, electionDate = "2030-11-05") {
	const measure = structuredClone(buildSeedCoverageSnapshot().measures[0]!);
	for (const field of ["currentPractice", "proposedChanges", "yesHighlights", "noHighlights", "implementationTimeline", "fiscalSummary", "potentialImpacts", "supportArguments", "opposeArguments", "argumentsAndConsiderations", "whatWeKnow", "whatWeDoNotKnow"] as const) measure[field] = [];
	const source = { id: "synthetic-sample", title: "Synthetic sample ballot", publisher: "Fulton County", authority: "official-government" as const, type: "official record", sourceSystem: "Synthetic test source", date: "", url: "https://fultoncountyga.gov/-/media/example/sample.pdf#page=1" };
	Object.assign(measure, { slug: "example-education-tax", contestSlug: "example-education-contest", title: "Education tax", location: "Fulton County, Georgia", summary: "Education-tax question.", plainLanguageExplanation: "Existing explanation.", currentLawOverview: "Existing legal context.", yesMeaning: "Approve the stated tax and debt.", noMeaning: "Reject the stated tax and debt.", fiscalContextNote: "The ballot supplies no actual borrowing rate or total interest estimate.", whatWeDoNotKnow: [{ text: "Actual collections and completion dates remain unknown." }], updatedAt: stamp, freshness: { contentLastVerifiedAt: stamp, dataLastUpdatedAt: stamp, nextReviewAt: "2030-11-01T00:00:00.000Z" }, sources: [source], ballotSummary: "Shall the special one percent sales and use tax for educational purposes currently imposed in Fulton County be reimposed on July 1 2031 upon the expiration of the current tax, for not longer than 20 consecutive calendar quarters, to raise not more than $5,000,000.00 to be used for education? For the Fulton County School District: projects in an amount not to exceed $3,000,000.00 for the Fulton County School District. For the Atlanta Independent School System: projects at a total maximum cost of $2,000,000.00. The question also approves debt in the principal amount of up to $100,000.00." });
	const draft = { schemaVersion: 1, type: "state-measure-draft", stateCode: "GA", electionDate, jurisdiction: { jurisdictionType: "county", name: "Fulton County", slug: "ga-example-fulton" }, reviewedAt: stamp, publicationApproved: false, automaticImportApproved: false, measures: [measure], documents: { ballot: { url: source.url.split("#")[0]!, sha256: "b".repeat(64), capturedAt: stamp } }, unresolvedFields: ["Independent substantive review"], unmappedQuestions: [] };
	const report = { ...readFultonEducationNotice(body, electionDate), source: { url: address, sha256: "a".repeat(64), capturedAt: "2030-10-02T00:00:00.000Z", sourceCaptureSha256: "c".repeat(64), indexSha256: "d".repeat(64) }, officialSource: true, csvSha256: "e".repeat(64), publisherRequestsDuringPreparation: 0 };
	return { draft, report, text: body };
}

test("notice supplementation preserves original wording, meanings, context, uncertainty and all source clocks", () => {
	const input = fixture();
	const before = structuredClone(input.draft);
	const result = buildFultonEducationMeasureSupplement(input.draft, input.report, input.text, "example-education-tax", now);
	assert.deepEqual(input.draft, before);
	assert.equal(result.fiscalRows, 3);
	assert.deepEqual(result.sourcePages, [1]);
	assert.equal(result.draft.measures[0]!.fiscalSummary[0]!.value, "6%");
	const resultMeasure = result.draft.measures[0]!;
	for (const [field, value] of Object.entries(before.measures[0]!)) {
		if (!["fiscalSummary", "sources"].includes(field)) assert.deepEqual(resultMeasure[field as keyof typeof resultMeasure], value, field);
	}
	assert.equal(result.draft.reviewedAt, before.reviewedAt);
	assert.equal(result.draft.documents.educationNotice!.capturedAt, input.report.source.capturedAt);
	assert.equal(result.actualInterestRateKnown, false);
	assert.equal(result.publicationApproved, false);
	assert.equal(result.automaticImportApproved, false);
	assert.equal(result.voterApplicabilityVerified, false);
});

test("repeated supplementation is idempotent and derives source pages rather than hardcoding page nine", () => {
	const input = fixture(text.replace("Section 2. General", "\fSection 2. General"));
	const first = buildFultonEducationMeasureSupplement(input.draft, input.report, input.text, "example-education-tax", now);
	const second = buildFultonEducationMeasureSupplement(first.draft, input.report, input.text, "example-education-tax", now);
	assert.deepEqual(first.draft, second.draft);
	assert.deepEqual(first.sourcePages, [2]);
	assert.deepEqual(first.draft.documents.educationNotice!.reviewedPages, [2]);
	assert.ok(first.draft.measures[0]!.fiscalSummary.every(row => row.sources[0]!.url.endsWith("#page=2")));
});

test("compatible future elections derive rates, dates and annual principal rows from their own notice", () => {
	const changed = text.replaceAll("2030", "2034").replaceAll("2031", "2035").replaceAll("2032", "2036").replaceAll("2033", "2037").replace("six percent 6%", "seven percent 7%");
	const input = fixture(changed, "2034-11-05");
	input.draft.measures[0]!.ballotSummary = input.draft.measures[0]!.ballotSummary.replace("2031", "2035");
	const result = buildFultonEducationMeasureSupplement(input.draft, input.report, input.text, "example-education-tax", Date.parse("2034-10-03T00:00:00Z"));
	assert.equal(result.draft.measures[0]!.fiscalSummary[0]!.value, "7%");
	assert.deepEqual(result.draft.measures[0]!.fiscalSummary.slice(1).map(row => row.horizon), ["2036", "2037"]);
});

test("fiscal anchors hold mismatched amounts, allocation identity, start dates, tax periods and dates", () => {
	for (const [old, replacement] of [["$5,000,000.00", "$6,000,000.00"], ["$3,000,000.00", "$2,000,000.00"], ["$100,000.00", "$110,000.00"], ["July 1 2031", "July 2 2031"], ["20 consecutive", "21 consecutive"], ["special one percent", "special two percent"]]) {
		const input = fixture();
		input.draft.measures[0]!.ballotSummary = input.draft.measures[0]!.ballotSummary.replace(old!, replacement!);
		assert.throws(() => buildFultonEducationMeasureSupplement(input.draft, input.report, input.text, "example-education-tax", now));
	}
	const input = fixture();
	input.draft.electionDate = "2030-11-06";
	assert.throws(() => buildFultonEducationMeasureSupplement(input.draft, input.report, input.text, "example-education-tax", now), /exact state and election/u);
});

test("source drift, conflicting existing rows and unapproved jurisdiction or publication state stay held", () => {
	const mutations = [
		(input: ReturnType<typeof fixture>) => { input.draft.publicationApproved = true; },
		(input: ReturnType<typeof fixture>) => { input.draft.jurisdiction.name = "Another County"; },
		(input: ReturnType<typeof fixture>) => { input.report.maximumAnnualInterestPercent = 9; },
		(input: ReturnType<typeof fixture>) => { input.report.source.sha256 = "changed"; },
		(input: ReturnType<typeof fixture>) => { input.draft.measures[0]!.fiscalSummary.push({ id: "prior", label: "Reviewed prior amount", value: "$1", scope: "Prior", horizon: "Prior", note: "", sources: [] }); },
	];
	for (const mutate of mutations) {
		const input = fixture();
		mutate(input);
		assert.throws(() => buildFultonEducationMeasureSupplement(input.draft, input.report, input.text, "example-education-tax", now));
	}
	const input = fixture();
	assert.throws(() => buildFultonEducationMeasureSupplement(input.draft, input.report, input.text, "unknown-measure", now), /exactly one/u);
});

test("changed citation identity and ambiguous page evidence preserve the original input", () => {
	const input = fixture();
	const first = buildFultonEducationMeasureSupplement(input.draft, input.report, input.text, "example-education-tax", now);
	const citations = first.draft.measures[0]!.sources;
	citations[citations.length - 1] = { ...citations.at(-1)!, publisher: "Conflicting publisher" };
	assert.throws(() => buildFultonEducationMeasureSupplement(first.draft, input.report, input.text, "example-education-tax", now), /conflicting evidence/u);
	const duplicate = input.text.replace("Year: Principal", "The maximum rate or rates of interest on such debt shall not exceed six percent 6% per annum.\nYear: Principal");
	assert.throws(() => buildFultonEducationMeasureSupplement(input.draft, fixture(duplicate).report, duplicate, "example-education-tax", now), /exact source page/u);
});

test("pinned input failures create no output directory and preserve the supplied draft", async (context) => {
	const directory = await realpath(await mkdtemp(join(tmpdir(), "fulton-measure-plan-")));
	context.after(() => rm(directory, { recursive: true, force: true }));
	const body = JSON.stringify(fixture().draft);
	const draft = join(directory, "draft.json");
	await writeFile(draft, body);
	const plan = { schemaVersion: 1, type: "fulton-education-measure-supplement", draft: { path: draft, sha256: "0".repeat(64) }, capture: { path: join(directory, "absent.json"), sha256: "1".repeat(64) }, measureSlug: "example-education-tax", outputDirectory: join(directory, "output") };
	const path = join(directory, "plan.json");
	await writeFile(path, JSON.stringify(plan));
	await assert.rejects(prepareFultonEducationMeasureFiles(path), /draft hash changed/u);
	plan.draft.sha256 = createHash("sha256").update(body).digest("hex");
	await writeFile(path, JSON.stringify({ ...plan, unreviewed: true }));
	await assert.rejects(prepareFultonEducationMeasureFiles(path), /pinned Fulton/u);
	assert.equal((await readdir(directory)).includes("output"), false);
});
