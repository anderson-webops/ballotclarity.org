import type { StateBallotSnapshot } from "../src/state-ballot-repository.js";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { buildSeedCoverageSnapshot } from "../src/coverage-repository.js";
import { buildFultonOfficialLogisticsOnlySnapshot } from "../src/fulton-reviewed-coverage.js";
import { configuredStateBallotSources } from "../src/state-ballot-registry.js";
import { reconcileStateMeasureQuestions } from "../src/state-measure-question-reconciliation.js";

function fixture(electionDate = "2026-11-03") {
	const source = { ...configuredStateBallotSources.find(source => source.id === "ga-fulton-2026")!, electionDate };
	const coverage = buildFultonOfficialLogisticsOnlySnapshot();
	coverage.election!.date = electionDate;
	const measure = structuredClone(buildSeedCoverageSnapshot().measures[0]!);
	measure.slug = "synthetic-measure";
	measure.contestSlug = "synthetic-contest";
	measure.ballotSummary = "Shall the tax be renewed for five years?";
	measure.ballotOptions = { yes: "Yes", no: "No" };
	coverage.election!.contests = [{ slug: measure.contestSlug, title: measure.title, type: "measure", office: "Ballot measure", jurisdiction: "Ballot measure", description: "", roleGuide: { summary: "", whyItMatters: "", decisionAreas: [] }, measures: [measure] }];
	coverage.measures = [structuredClone(measure)];
	const native: StateBallotSnapshot = { source, records: [], retrievedAt: "2026-10-27T12:00:00.000Z", sha256: "a".repeat(64), documents: [{ url: source.url, sha256: "b".repeat(64), retrievedAt: "2026-10-27T12:00:00.000Z", includedRecordCount: 0 }], ballotQuestions: [{ id: "1".repeat(24), title: "Tax renewal", audience: "Published sample", officialText: measure.ballotSummary, choices: ["Yes", "No"], pages: [3], explicitlyAdvisory: false, voterApplicabilityVerified: false }] };
	const slugs = [coverage.election!.slug];
	return { source, coverage, measure, native, slugs };
}

test("question reconciliation retains source wording, scope and original clocks without approving publication", () => {
	const input = fixture();
	const before = createHash("sha256").update(JSON.stringify(input)).digest("hex");
	const result = reconcileStateMeasureQuestions(input.native, input.coverage, input.slugs);
	assert.equal(result.wordingReconciled, true);
	assert.equal(result.matchedQuestionCount, 1);
	assert.equal(result.matches[0]!.originalCapturedAt, input.native.documents![0]!.retrievedAt);
	assert.equal(result.matches[0]!.documentSha256, "b".repeat(64));
	assert.equal(result.matches[0]!.jurisdictionName, "Fulton County");
	assert.equal(result.scopeVerificationComplete, false);
	assert.equal(result.voterApplicabilityVerified, false);
	assert.equal(result.automaticImportApproved, false);
	assert.equal(result.publicationApproved, false);
	assert.equal(createHash("sha256").update(JSON.stringify(input)).digest("hex"), before);
});

test("question reconciliation keeps printed city evidence distinct from a county guide and personal eligibility", () => {
	for (const date of ["2026-11-03", "2034-11-07"]) {
		const input = fixture(date);
		const text = "Shall the Act be approved which authorizes the City of Example Town, Georgia, to exercise redevelopment powers?";
		Object.assign(input.native.ballotQuestions![0]!, { audience: "Fulton County consolidated sample ballot", title: "City of Example Town Redevelopment Powers", officialText: text });
		input.measure.ballotSummary = text;
		input.coverage.measures[0]!.ballotSummary = text;
		const result = reconcileStateMeasureQuestions(input.native, input.coverage, input.slugs);
		assert.equal(result.wordingReconciled, true);
		assert.equal(result.matches[0]!.publishedArea!.name, "Example Town");
		assert.equal(result.matches[0]!.jurisdictionName, "Fulton County");
		assert.equal(result.matches[0]!.originalCapturedAt, input.native.documents![0]!.retrievedAt);
		assert.equal(result.scopeVerificationComplete, false);
		assert.equal(result.voterApplicabilityVerified, false);
	}
});

test("question reconciliation tolerates whitespace while holding changed numbers and missing words", () => {
	const input = fixture();
	input.native.ballotQuestions![0]!.officialText = "Shall the tax\n\nbe renewed for five years?";
	assert.equal(reconcileStateMeasureQuestions(input.native, input.coverage, input.slugs).wordingReconciled, true);
	for (const wording of ["Shall the tax be renewed?", "Shall the tax be renewed for six years?"]) {
		input.native.ballotQuestions![0]!.officialText = wording;
		const result = reconcileStateMeasureQuestions(input.native, input.coverage, input.slugs);
		assert.equal(result.wordingReconciled, false);
		assert.deepEqual(result.findings.map(finding => finding.code), ["unmatched-measure-wording", "unmatched-native-question"]);
	}
});

test("question reconciliation holds reversed labels, nonbinary choices, notices and conflicting advisory effects", () => {
	for (const kind of ["reversed", "nonbinary", "notice", "advisory"]) {
		const input = fixture();
		const question = input.native.ballotQuestions![0]!;
		if (kind === "reversed") question.choices = ["No", "Yes"];
		if (kind === "nonbinary") question.choices = ["A", "B", "C"];
		if (kind === "notice") question.textKind = "notice";
		if (kind === "advisory") question.explicitlyAdvisory = true;
		assert.equal(reconcileStateMeasureQuestions(input.native, input.coverage, input.slugs).wordingReconciled, false, kind);
	}
});

test("question reconciliation distinguishes matched advisory choices without inferring a binding effect", () => {
	const input = fixture();
	input.native.ballotQuestions![0]!.explicitlyAdvisory = true;
	input.measure.decisionEffect = "advisory";
	input.coverage.measures[0]!.decisionEffect = "advisory";
	assert.equal(reconcileStateMeasureQuestions(input.native, input.coverage, input.slugs).wordingReconciled, true);
});

test("question reconciliation holds ambiguous duplicate wording and duplicate measure bindings", () => {
	const input = fixture();
	input.native.ballotQuestions!.push({ ...input.native.ballotQuestions![0]!, id: "2".repeat(24) });
	assert.ok(reconcileStateMeasureQuestions(input.native, input.coverage, input.slugs).findings.some(finding => finding.code === "ambiguous-question-wording"));
	input.native.ballotQuestions!.pop();
	input.coverage.election!.contests[0]!.measures!.push({ ...input.measure, slug: "another-measure" });
	assert.ok(reconcileStateMeasureQuestions(input.native, input.coverage, input.slugs).findings.some(finding => finding.code === "question-bound-to-multiple-measures"));
});

test("question reconciliation checks every selected question and root measure copy", () => {
	const input = fixture();
	input.coverage.measures[0]!.ballotSummary = "A different root summary?";
	assert.ok(reconcileStateMeasureQuestions(input.native, input.coverage, input.slugs).findings.some(finding => finding.code === "root-measure-copy-mismatch"));
	input.coverage.measures = [];
	input.native.ballotQuestions!.push({ ...input.native.ballotQuestions![0]!, id: "3".repeat(24), officialText: "Shall another proposed tax be renewed?" });
	assert.ok(reconcileStateMeasureQuestions(input.native, input.coverage, input.slugs).findings.some(finding => finding.code === "unmatched-native-question"));
});

test("question reconciliation rejects wrong dates, states, selections and duplicate identities", () => {
	for (const kind of ["date", "state", "selection", "duplicate-selection", "duplicate-question", "duplicate-measure", "empty"]) {
		const input = fixture();
		if (kind === "date") input.coverage.election!.date = "2028-11-07";
		if (kind === "state") input.coverage.jurisdiction!.state = "North Dakota";
		if (kind === "selection") input.slugs[0] = "missing-election";
		if (kind === "duplicate-selection") input.slugs.push(input.slugs[0]!);
		if (kind === "duplicate-question") input.native.ballotQuestions!.push(input.native.ballotQuestions![0]!);
		if (kind === "duplicate-measure") input.coverage.election!.contests[0]!.measures!.push(input.measure);
		if (kind === "empty") input.native.ballotQuestions = [];
		assert.throws(() => reconcileStateMeasureQuestions(input.native, input.coverage, input.slugs), /reconciliation/u, kind);
	}
});

test("question reconciliation retains partial-county exclusions across future election dates", () => {
	for (const electionDate of ["2028-11-07", "2030-11-05"]) {
		const input = fixture(electionDate);
		Object.assign(input.coverage.jurisdiction!, { jurisdictionType: "county-area", name: "Fulton County outside Atlanta", countyAreaScope: { kind: "county-excluding-municipalities", stateCode: "GA", countyName: "Fulton County", excludedMunicipalities: ["Atlanta"], matching: "reference-only" } });
		const result = reconcileStateMeasureQuestions(input.native, input.coverage, input.slugs);
		assert.equal(result.wordingReconciled, true);
		assert.deepEqual(result.matches[0]!.countyAreaScope?.excludedMunicipalities, ["Atlanta"]);
		assert.equal(result.matches[0]!.voterApplicabilityVerified, false);
		assert.equal(result.electionDate, electionDate);
	}
});

test("question reconciliation holds missing question-document provenance", () => {
	const input = fixture();
	input.native.documents = [];
	assert.ok(reconcileStateMeasureQuestions(input.native, input.coverage, input.slugs).findings.some(finding => finding.code === "question-document-provenance-unresolved"));
});
