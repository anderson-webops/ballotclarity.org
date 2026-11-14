import type { buildUnionMeasureDrafts } from "../src/union-measure-guides.js";
import assert from "node:assert/strict";
import test from "node:test";
import { buildUnionMeasureDrafts as build } from "../src/union-measure-guides.js";

const now = Date.parse("2030-10-20T12:00:00.000Z");
const capturedAt = "2030-10-01T12:00:00.000Z";
function fixture() {
	const report: Parameters<typeof buildUnionMeasureDrafts>[0] = { schemaVersion: 1, type: "union-public-question-research-preparation", electionDate: "2030-11-05", ballotCaptureHashes: ["a".repeat(64)], catalogSha256: "b".repeat(64), questions: [{ id: "a".repeat(24), electionDate: "2030-11-05", question: { printedHeading: "PUBLIC QUESTION TO BE VOTED UPON", municipality: "Elizabeth", officialText: { en: "Shall the City of Elizabeth adopt the described municipal procedure?", es: "¿Debe la Ciudad de Elizabeth adoptar el procedimiento municipal descrito?" }, interpretiveStatement: { en: "Approval adopts the procedure; rejection retains the existing procedure.", es: "La aprobación adopta el procedimiento; el rechazo conserva el procedimiento existente." }, printedChoices: ["YES/SÍ", "NO"], page: 1 }, sources: [7, 8, 9, 10, 11, 12].map(form => ({ form, sourceUrl: `https://ucnj.org/wp-content/uploads/2030/09/2030-UNION-GEN-samples-FORM-${form}.pdf`, sourceSha256: String(form).padStart(64, "a"), capturedAt, page: 1, publishedLabels: [{ municipality: "Elizabeth", labels: [`Ward ${form - 6}`] }] })) }], inventory: [], questionCount: 1, sampleFormsReviewed: 42, questionForms: [7, 8, 9, 10, 11, 12], csvSha256: "c".repeat(64), publisherRequests: 0, translationEquivalenceVerified: false, currentLawIndependentlyVerified: false, voterApplicabilityVerified: false, substantiveReviewComplete: false, imported: false, publicationApproved: false, automaticImportApproved: false };
	const pending = build(report, null, now);
	const review = { ...pending.template, reviewedAt: "2030-10-10T12:00:00.000Z", questions: pending.template.questions.map(row => ({ ...row, title: "Municipal procedure", summary: "Would adopt the described municipal procedure.", yesMeaning: "Approve the proposed procedure.", noMeaning: "Retain the existing procedure." })) };
	return { report, review };
}

test("Union measure drafts preserve exact ballot text, city scope, one citation and independent review gates", () => {
	const { report, review } = fixture();
	const prepared = build(report, review, now);
	assert.deepEqual(prepared.issues, []);
	const draft = prepared.drafts[0]!;
	assert.equal(draft.jurisdiction.name, "Elizabeth");
	assert.equal(draft.jurisdiction.jurisdictionType, "city");
	const measure = draft.measures[0]!;
	assert.equal(measure.ballotSummary, report.questions[0]!.question.officialText.en);
	assert.equal(measure.sources.length, 1);
	assert.equal(measure.sources[0]!.url, `${report.questions[0]!.sources[0]!.sourceUrl}#page=1`);
	assert.equal(measure.freshness.dataLastUpdatedAt, capturedAt);
	assert.equal(measure.freshness.contentLastVerifiedAt, review.reviewedAt);
	assert.equal(measure.plainLanguageExplanation, measure.summary);
	assert.equal(measure.currentLawOverview, "");
	assert.deepEqual(measure.fiscalSummary, []);
	assert.deepEqual(measure.supportArguments, []);
	assert.deepEqual(measure.whatWeDoNotKnow, []);
	assert.equal(draft.publicationApproved, false);
	assert.equal(draft.automaticImportApproved, false);
});

test("Union guide preparation holds untranslated edits, source drift, blank explanations and missing reviews", () => {
	const { report, review } = fixture();
	assert.equal(build(report, null, now).drafts.length, 0);
	for (const reason of ["question-changed", "source-witnesses-changed", "editorial-review-incomplete", "editorial-review-required", "municipal-scope-review-required"]) {
		const changed = structuredClone(review);
		if (reason === "question-changed") changed.questions[0]!.questionSha256 = "0".repeat(64);
		if (reason === "source-witnesses-changed") changed.questions[0]!.witnessesSha256 = "0".repeat(64);
		if (reason === "editorial-review-incomplete") changed.questions[0]!.yesMeaning = "";
		if (reason === "editorial-review-required") changed.questions = [];
		if (reason === "municipal-scope-review-required") changed.questions[0]!.jurisdictionType = "township";
		const result = build(report, changed, now);
		assert.equal(result.drafts.length, 0);
		assert.ok(result.issues.some(issue => issue.reason === reason));
	}
	for (const field of ["officialText", "interpretiveStatement"] as const) {
		const changed = structuredClone(report);
		changed.questions[0]!.question[field].es += " Cambio.";
		assert.equal(build(changed, review, now).drafts.length, 0);
	}
});

test("Union editorial approval cannot widen jurisdiction, dates, fields or publication authority", () => {
	const { report, review } = fixture();
	for (const changed of [{ ...review, electionDate: "2034-11-07" }, { ...review, reviewedAt: "2035-01-01T00:00:00.000Z" }, { ...review, publicationApproved: true }, { ...review, automaticImportApproved: true }, { ...review, questions: [...review.questions, review.questions[0]] }, { ...review, questions: [{ ...review.questions[0], jurisdictionType: "county" }] }, { ...review, questions: [{ ...review.questions[0], jurisdictionType: ["city"] }] }, { ...review, questions: [{ ...review.questions[0], currentLawOverview: "Unsupported law claim" }] }]) assert.throws(() => build(report, changed, now));
});

test("Union unchanged witness bytes reuse editorial wording without refreshing its verification date", () => {
	const { report, review } = fixture();
	for (const source of report.questions[0]!.sources) source.capturedAt = "2030-10-15T12:00:00.000Z";
	const draft = build(report, review, now).drafts[0]!;
	assert.equal(draft.reviewedAt, review.reviewedAt);
	assert.equal(draft.measures[0]!.freshness.contentLastVerifiedAt, review.reviewedAt);
	assert.equal(draft.measures[0]!.freshness.dataLastUpdatedAt, "2030-10-15T12:00:00.000Z");
});

test("Union later offered dates use the same guide builder while prior-cycle reviews remain scoped", () => {
	const { report, review } = fixture();
	const later = JSON.parse(JSON.stringify(report).replaceAll("2030", "2034").replaceAll("11-05", "11-07")) as typeof report;
	assert.throws(() => build(later, review, Date.parse("2034-10-20T12:00:00.000Z")));
	const template = build(later, null, Date.parse("2034-10-20T12:00:00.000Z")).template;
	const next = build(later, { ...review, electionDate: later.electionDate, reviewedAt: "2034-10-10T12:00:00.000Z", questions: template.questions.map(row => ({ ...row, title: "Later procedure", summary: "Would adopt the later proposed procedure.", yesMeaning: "Approve the later proposal.", noMeaning: "Retain the existing procedure." })) }, Date.parse("2034-10-20T12:00:00.000Z"));
	assert.equal(next.drafts[0]!.electionDate, "2034-11-07");
	assert.equal(next.drafts[0]!.measures[0]!.slug, "nj-elizabeth-2034-11-07-question");
});

test("Union question identity remains stable when an earlier corroborating form is explicitly reviewed", () => {
	const { report, review } = fixture();
	const before = build(report, review, now).drafts[0]!;
	report.questions[0]!.sources.unshift({ ...report.questions[0]!.sources[0]!, form: 6, sourceUrl: "https://ucnj.org/wp-content/uploads/2030/09/2030-UNION-GEN-samples-FORM-6.pdf" });
	assert.equal(build(report, review, now).drafts.length, 0);
	const current = build(report, null, now).template;
	const after = build(report, { ...review, questions: [{ ...review.questions[0]!, witnessesSha256: current.questions[0]!.witnessesSha256 }] }, now).drafts[0]!;
	assert.equal(after.measures[0]!.slug, before.measures[0]!.slug);
});

test("Union disappeared questions require review and empty publications create no guide placeholders", () => {
	const { report, review } = fixture();
	report.questions = [];
	const missing = build(report, review, now);
	assert.equal(missing.drafts.length, 0);
	assert.ok(missing.issues.some(issue => issue.reason === "question-no-longer-offered"));
	const empty = build(report, null, now);
	assert.deepEqual(empty.issues, []);
	assert.deepEqual(empty.drafts, []);
});
