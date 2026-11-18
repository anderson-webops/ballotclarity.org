import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { buildLafayetteMeasureDrafts, prepareLafayetteMeasureGuideFiles } from "../src/lafayette-measure-guides.js";
import { readLafayetteBallotResearch, readLafayetteBallotResearchFiles } from "../src/prepare-lafayette-ballot-research.js";
import { parseStateMeasureDraft } from "../src/state-measure-guides.js";

const hash = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");
const pdf = Buffer.from("%PDF-1.4\nSynthetic resolution fixture\n%%EOF\n");
function fixture(year = 2030, bond = false) {
	const electionDate = `${year}-12-14`;
	const clock = `${year}-11-01T12:00:00.000Z`;
	const now = Date.parse(`${year}-11-15T12:00:00.000Z`);
	const formattedDate = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "long", day: "numeric", year: "numeric" }).format(new Date(electionDate));
	const questions = ["Parish", "Parish", "City"].map((area, index) => `Shall the ${area} of Lafayette, State of Louisiana (the "${area}"), continue to levy a ${index + 1}.25 mills tax on all property subject to taxation (an estimated $1,000,000 reasonably expected at this time to be collected from the levy of the tax for an entire year), for a period of 10 years, beginning with the year ${year + 1} and ending with the year ${year + 10}, for the purpose of maintaining public facilities?`);
	if (bond) questions[0] = "Shall the Parish of Lafayette, State of Louisiana (the \"Parish\"), incur debt and issue not exceeding $77,000,000 of general obligation bonds, to run not exceeding 30 years from the date thereof, to bear interest at rates not exceeding 7% per annum, with no estimated increase in the millage rate in the first year above the 1.85 mills currently being levied?";
	const guide = `${formattedDate} Ballot Guide\n${questions.map((question, index) => `${index < 2 ? "Parishwide" : "City of Lafayette"} Proposition No. ${index < 2 ? index + 1 : 1}\nExample ${index + 1}\n\n${index === 0 && bond ? "Up to $77 million | Repayment over up to 30 years" : `${index + 1}.25 mills | 10 years | ${year + 1}–${year + 10}`}\nOfficial ballot question: “${question}”\n`).join("\n")}`;
	const government = `<title>Lafayette Consolidated Government</title><h1>${formattedDate}</h1>${questions.map((question, index) => `<details class="prop-detail"><summary>Prop. ${index < 2 ? 2 - index : 1} of ${index < 2 ? 2 : 1} - ${index === 0 && bond ? "1.85 mills" : `${index + 1}.25 mills · ${year + 1}–${year + 10}`}</summary><p class="ballot-question">${question}</p></details>`).join("")}`;
	const research = { ...readLafayetteBallotResearch(guide, government, electionDate), sources: { guide: { url: `https://www.oneacadiana.org/wp-content/uploads/GeauxVote_Dec${year}_BallotGuide-FINAL-v2.pdf`, sha256: hash(pdf), capturedAt: clock }, governmentPage: { url: "https://www.lafayettela.info/", sha256: hash(government), capturedAt: clock } } };
	const documents = ["Lafayette Parish", "City of Lafayette"].map((area, index) => ({ area, resolution: `${index ? "CR" : "PR"}-001-${year}`, path: `/external/lafayette-${index}.pdf`, sha256: hash(pdf), url: `https://apps.lafayettela.gov/obcouncil/api/Document/${index + 1}/`, capturedAt: clock }));
	const pending = buildLafayetteMeasureDrafts(research, documents, null, now);
	const review = { ...pending.template, reviewedAt: clock, questions: pending.template.questions.map((row, index) => ({ ...row, callPropositionNumber: index < 2 ? index + 1 : 1, questionPages: [1], noticePage: 2, certificationPage: 3, summary: `Changes funding ${index + 1}.`, yesMeaning: `Authorize proposal ${index + 1}.`, noMeaning: `Decline proposal ${index + 1}.` })) };
	return { electionDate, clock, now, guide, government, research, documents, review };
}

test("Lafayette review templates require source-bound wording, pages and vote meanings", () => {
	const { research, documents, now } = fixture();
	const original = structuredClone(research);
	const pending = buildLafayetteMeasureDrafts(research, documents, null, now);
	assert.equal(pending.drafts.length, 0);
	assert.equal(pending.template.questions.length, 3);
	assert.equal(pending.template.reviewedAt, null);
	assert.equal(pending.template.questions[0]!.callPropositionNumber, null);
	assert.ok(pending.issues.some(issue => issue.reason === "editorial-review-required"));
	assert.deepEqual(research, original);
});

test("reviewed Lafayette measures keep parish/city scope, original questions, fiscal estimates and publication holds", () => {
	const { research, documents, review, now, clock } = fixture();
	const result = buildLafayetteMeasureDrafts(research, documents, review, now);
	assert.deepEqual(result.issues, []);
	assert.equal(result.drafts.length, 2);
	assert.deepEqual(result.drafts.map(draft => draft.measures.length), [2, 1]);
	for (const draft of result.drafts) {
		parseStateMeasureDraft(draft, { stateCode: "LA", electionDate: research.electionDate, jurisdiction: draft.jurisdiction as { jurisdictionType: "county"; name: string; slug: string } }, now);
		assert.equal(draft.publicationApproved, false);
		assert.equal(draft.automaticImportApproved, false);
		assert.equal(draft.reviewedAt, clock);
		assert.ok(draft.unresolvedFields.some(row => row.reason === "final-official-ballot-and-amendment-review-required"));
		assert.deepEqual(draft.documents.councilCall.reviewedPages, [1, 2, 3]);
		for (const measure of draft.measures) {
			assert.ok(research.rows.some(row => row.question === measure.ballotSummary));
			assert.equal(measure.sources[0]!.date, "");
			assert.ok(measure.sources[0]!.url.endsWith("#page=1"));
			assert.equal(measure.freshness.dataLastUpdatedAt, clock);
			assert.equal(measure.plainLanguageExplanation, measure.summary);
			assert.deepEqual(measure.whatWeDoNotKnow, []);
			assert.deepEqual(measure.supportArguments, []);
			assert.equal(measure.fiscalSummary[1]!.label, "Estimated annual revenue");
			assert.equal(measure.fiscalSummary[1]!.value, "$1,000,000");
		}
	}
	assert.equal(result.drafts[0]!.measures[0]!.location, "Lafayette Parish, Louisiana");
	assert.equal(result.drafts[1]!.measures[0]!.location, "Lafayette, Louisiana");
	assert.equal(result.drafts[0]!.unresolvedFields.filter(row => row.reason === "original-publisher-number-conflict").length, 2);
});

test("question/source drift, missing review, unseen questions and ambiguous call numbers produce no drafts", () => {
	const { research, documents, review, now } = fixture();
	for (const change of [
		(value: typeof review) => { value.questions[0]!.questionSha256 = "a".repeat(64); },
		(value: typeof review) => { value.questions[0]!.resolutionSha256 = "b".repeat(64); },
		(value: typeof review) => { value.questions[0]!.summary = ""; },
		(value: typeof review) => { value.questions[0]!.noticePage = 0; },
		(value: typeof review) => { value.questions[0]!.questionPages = []; },
		(value: typeof review) => { value.questions.pop(); },
		(value: typeof review) => { value.questions.push({ ...value.questions[0]!, id: "c".repeat(24) }); },
		(value: typeof review) => { value.questions[0]!.callPropositionNumber = 2; },
	]) {
		const changed = structuredClone(review);
		change(changed);
		if (changed.questions[0]!.noticePage === 0) assert.throws(() => buildLafayetteMeasureDrafts(research, documents, changed, now));
		else assert.equal(buildLafayetteMeasureDrafts(research, documents, changed, now).drafts.length, 0);
	}
	assert.throws(() => buildLafayetteMeasureDrafts(research, documents, { ...review, publicationApproved: true }, now));
	assert.throws(() => buildLafayetteMeasureDrafts(research, documents, { ...review, questions: [...review.questions, review.questions[0]] }, now));
	assert.throws(() => buildLafayetteMeasureDrafts(research, documents, { ...review, reviewedAt: new Date(now + 1).toISOString() }, now));
});

test("call documents cannot change jurisdiction, publisher, identity or question fingerprints", () => {
	const { research, documents, review, now } = fixture();
	for (const change of [
		(value: typeof documents) => { value[0]!.area = "Louisiana"; },
		(value: typeof documents) => { value[0]!.resolution = "CR-001-2030"; },
		(value: typeof documents) => { value[0]!.url = "https://example.org/call.pdf"; },
		(value: typeof documents) => { value[0]!.url += "?native=true"; },
		(value: typeof documents) => { value[0]!.area = value[1]!.area; },
	]) {
		const changed = structuredClone(documents);
		change(changed);
		assert.throws(() => buildLafayetteMeasureDrafts(research, changed, review, now));
	}
	const changedResearch = structuredClone(research);
	changedResearch.rows[0]!.question += " Changed.";
	assert.throws(() => buildLafayetteMeasureDrafts(changedResearch, documents, review, now));
});

test("future editions reuse the same configuration and unchanged reviews retain their original clocks", () => {
	const { research, documents, review, now, clock } = fixture(2034);
	review.questions.reverse();
	const result = buildLafayetteMeasureDrafts(research, documents, review, now + 86_400_000);
	assert.equal(result.drafts.length, 2);
	assert.equal(result.drafts[0]!.electionDate, "2034-12-14");
	assert.equal(result.drafts[0]!.measures[0]!.updatedAt, clock);
	assert.equal(result.drafts[0]!.measures[0]!.fiscalSummary[0]!.horizon, "2035–2044");
});

test("bond amounts, maximum interest and referenced existing millage stay separate from tax revenue", () => {
	const { research, documents, review, now } = fixture(2030, true);
	const result = buildLafayetteMeasureDrafts(research, documents, review, now);
	const fiscal = result.drafts[0]!.measures[0]!.fiscalSummary;
	assert.deepEqual(fiscal.map(row => row.value), ["Up to $77,000,000", "Up to 30 years", "Up to 7% annually", "1.85 mills"]);
	assert.equal(fiscal.some(row => row.label.includes("revenue")), false);
});

async function workingFixture() {
	const input = fixture();
	const directory = await realpath(await mkdtemp(join(tmpdir(), "lafayette-measures-")));
	const save = async (name: string, body: string | Buffer) => {
		const path = join(directory, name);
		await writeFile(path, body);
		return { path, sha256: hash(body) };
	};
	const guide = await save("guide.pdf", pdf);
	const government = await save("government.html", input.government);
	const researchPlan = await save("research-plan.json", JSON.stringify({ schemaVersion: 1, type: "lafayette-ballot-research-preparation", electionDate: input.electionDate, guide: { ...guide, ...input.research.sources.guide }, governmentPage: { ...government, ...input.research.sources.governmentPage }, outputDirectory: join(directory, "unused-research-output") }));
	const documents = await Promise.all(input.documents.map(async (document, index) => ({ ...document, ...await save(`call-${index}.pdf`, pdf) })));
	const review = await save("review.json", JSON.stringify(input.review));
	const plan = { schemaVersion: 1, type: "lafayette-measure-guide-preparation", researchPlan, review, documents, baseSnapshot: null, outputDirectory: join(directory, "prepared"), outputName: "lafayette-2030" };
	const planFile = await save("plan.json", JSON.stringify(plan));
	return { ...input, directory, plan, planPath: planFile.path };
}

test("offline preparation assembles both reviewed guides while preserving the original source files", async () => {
	const working = await workingFixture();
	try {
		const result = await prepareLafayetteMeasureGuideFiles(working.planPath, { now: working.now, extract: async () => working.guide, inspect: async () => 3 });
		assert.equal(result.guides, 2);
		assert.equal(result.measures, 3);
		assert.equal(result.publisherRequests, 0);
		assert.equal(result.finalBallotNumbersVerified, false);
		assert.equal(result.publicationApproved, false);
		const original = await readFile(join(working.plan.outputDirectory, "lafayette-2030-county-native-draft.json"));
		await assert.rejects(prepareLafayetteMeasureGuideFiles(working.planPath, { now: working.now, extract: async () => working.guide, inspect: async () => 3 }));
		assert.deepEqual(await readFile(join(working.plan.outputDirectory, "lafayette-2030-county-native-draft.json")), original);
		assert.deepEqual(await readFile(working.plan.documents[0]!.path), pdf);
	}
	finally { await rm(working.directory, { recursive: true, force: true }); }
});

test("missing editorial review emits a review template without prepared guide records", async () => {
	const working = await workingFixture();
	try {
		await writeFile(working.planPath, JSON.stringify({ ...working.plan, review: null }));
		const result = await prepareLafayetteMeasureGuideFiles(working.planPath, { now: working.now, extract: async () => working.guide, inspect: async () => 3 });
		assert.equal(result.reviewRequired, true);
		assert.equal(result.guides, 0);
		assert.equal(result.prepared, null);
		await assert.rejects(readFile(join(working.plan.outputDirectory, "guides", "lafayette-2030-guides.json")));
	}
	finally { await rm(working.directory, { recursive: true, force: true }); }
});

test("changed evidence and symlinked inputs fail before creating outputs", async () => {
	for (const mode of ["changed", "symlink"] as const) {
		const working = await workingFixture();
		try {
			if (mode === "changed") {
				await writeFile(working.plan.documents[0]!.path, "%PDF-1.4 changed");
			}
			else {
				const target = working.plan.documents[0]!.path;
				const alias = join(working.directory, "alias.pdf");
				await symlink(target, alias);
				working.plan.documents[0]!.path = alias;
				await writeFile(working.planPath, JSON.stringify(working.plan));
			}
			await assert.rejects(prepareLafayetteMeasureGuideFiles(working.planPath, { now: working.now, extract: async () => working.guide, inspect: async () => 3 }));
			await assert.rejects(readFile(join(working.plan.outputDirectory, "MANIFEST.json")));
		}
		finally { await rm(working.directory, { recursive: true, force: true }); }
	}
});

test("review citations outside the retained PDF fail before output creation", async () => {
	const working = await workingFixture();
	try {
		await assert.rejects(prepareLafayetteMeasureGuideFiles(working.planPath, { now: working.now, extract: async () => working.guide, inspect: async () => 2 }), /outside its original PDF/u);
		await assert.rejects(readFile(join(working.plan.outputDirectory, "MANIFEST.json")));
	}
	finally { await rm(working.directory, { recursive: true, force: true }); }
});

test("the shared research reader checks its exact plan hash before native extraction", async () => {
	const working = await workingFixture();
	let extractions = 0;
	try {
		await assert.rejects(readLafayetteBallotResearchFiles(working.plan.researchPlan.path, async () => {
			extractions += 1;
			return working.guide;
		}, working.now, "f".repeat(64)), /plan bytes changed/u);
		assert.equal(extractions, 0);
		const loaded = await readLafayetteBallotResearchFiles(working.plan.researchPlan.path, async () => working.guide, working.now, working.plan.researchPlan.sha256);
		assert.equal(loaded.report.rows.length, 3);
	}
	finally { await rm(working.directory, { recursive: true, force: true }); }
});
