import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { prepareLafayetteBallotResearch, readLafayetteBallotResearch } from "../src/prepare-lafayette-ballot-research.js";

const electionDate = "2030-12-14";
const question = (area: string, mills: string, firstYear = 2031, lastYear = 2040) => `Shall the ${area} of Lafayette, State of Louisiana (the "${area}"), continue to levy a ${mills} mills tax on all property subject to taxation (an estimated $1,000,000 reasonably expected at this time to be collected from the levy of the tax for an entire year), for a period of 10 years, beginning with the year ${firstYear} and ending with the year ${lastYear}, for the purpose of maintaining public facilities?`;
const questions = [question("Parish", "2.11"), question("Parish", "3.22"), question("City", "1.25")];
function fixture() {
	const rates = [2.11, 3.22, 1.25];
	const guide = `December 14, 2030 Ballot Guide\n${questions.map((body, index) => `${index < 2 ? "Parishwide" : "City of Lafayette"} Proposition No. ${index < 2 ? index + 1 : 1}\nExample ${index + 1}\n\n${rates[index]} mills | 10 years | 2031–2040\nOfficial ballot question: “${body}”\n`).join("\n")}`;
	const government = `<title>Lafayette Consolidated Government</title><h1>December 14, 2030</h1><p>Resolution No. PR-XXX-2030</p>${questions.map((body, index) => `<details class="prop-detail"><summary>Prop. ${index < 2 ? 2 - index : 1} of ${index < 2 ? 2 : 1} - Example ${rates[index]} mills · 2031–2040</summary><p class="ballot-question">${body}</p></details>`).join("")}`;
	return { guide, government };
}

test("Lafayette research reconciles exact questions independently of conflicting source numbering", () => {
	const { guide, government } = fixture();
	const result = readLafayetteBallotResearch(guide, government, electionDate);
	assert.equal(result.rows.length, 3);
	assert.equal(result.conflicts.length, 2);
	assert.deepEqual(result.unresolvedResolutions, ["PR-XXX-2030"]);
	assert.equal(result.exactQuestionSetsAgree, true);
	assert.equal(result.publicationApproved, false);
	assert.equal(result.automaticImportApproved, false);
	assert.equal(result.officialCertificationVerified, false);
	assert.equal(result.personalApplicabilityVerified, false);
	assert(result.rows.every(row => row.canonicalPropositionNumber === null));
	assert.deepEqual(result.rows[0]!.fiscal, { kind: "property-tax-continuation", mills: 2.11, years: 10, firstYear: 2031, lastYear: 2040, estimatedAnnualRevenueDollars: 1_000_000 });
	assert.equal(result.rows[2]!.area, "City of Lafayette");
	assert.deepEqual(readLafayetteBallotResearch(guide, government, electionDate), result);
});

test("source drift, missing questions, ambiguous numbering and unsafe CSV titles require review", () => {
	const { guide, government } = fixture();
	for (const [changedGuide, changedGovernment, selectedDate] of [
		[guide, government, "2030-12-15"],
		[guide, government.replace("December 14, 2030", "December 15, 2030"), electionDate],
		[guide.replace("2.11 mills", "2.12 mills"), government, electionDate],
		[guide, government.replace("1,000,000", "1,,000,000"), electionDate],
		[guide.replace("Example 1", "=HYPERLINK(example)"), government, electionDate],
		[guide.replace("Parishwide Proposition No. 2", "Parishwide Proposition No. 1"), government, electionDate],
		[guide, government.replace("Prop. 2 of 2", "Prop. 1 of 2"), electionDate],
		[guide, government.replace(questions[1]!, questions[0]!), electionDate],
		[guide, government.replace("prop-detail", "unknown-template"), electionDate],
		[guide.repeat(2), government, electionDate],
	]) assert.throws(() => readLafayetteBallotResearch(changedGuide!, changedGovernment!, selectedDate!));
	assert.throws(() => readLafayetteBallotResearch("x".repeat(4 * 1024 * 1024 + 1), government, electionDate));
	const invalidTerm = questions[0]!.replace("2040", "2041");
	assert.throws(() => readLafayetteBallotResearch(guide.replace(questions[0]!, invalidTerm), government.replace(questions[0]!, invalidTerm), electionDate), /tax term/u);
	const malformedMoney = questions[0]!.replace("1,000,000", "1,,000,000");
	assert.throws(() => readLafayetteBallotResearch(guide.replace(questions[0]!, malformedMoney), government.replace(questions[0]!, malformedMoney), electionDate), /fiscal value/u);
});

test("bond authorization, interest ceiling and first-year reference rate remain distinct fiscal facts", () => {
	const { guide, government } = fixture();
	const bond = "Shall the Parish of Lafayette, State of Louisiana (the \"Parish\"), incur debt and issue not exceeding $77,000,000 of general obligation bonds, to run not exceeding 30 years from the date thereof, to bear interest at rates not exceeding 7% per annum, with no estimated increase in the millage rate in the first year above the 1.85 mills currently being levied?";
	const changedGuide = guide.replace(questions[0]!, bond).replace("2.11 mills | 10 years | 2031–2040", "Up to $77 million | Repayment over up to 30 years");
	const changedGovernment = government.replace(questions[0]!, bond).replace("2.11 mills · 2031–2040", "Up to $77,000,000 · continuing 1.85 mills");
	const result = readLafayetteBallotResearch(changedGuide, changedGovernment, electionDate);
	assert.deepEqual(result.rows[0]!.fiscal, { kind: "bond-authorization", maximumBondDollars: 77_000_000, maximumYears: 30, maximumAnnualInterestPercent: 7, firstYearReferencedMills: 1.85 });
	assert.equal(result.rows[0]!.fiscal.estimatedAnnualRevenueDollars, undefined);
});

test("runoff references retain printed party and electorate claims without certifying candidates", () => {
	const { guide, government } = fixture();
	const runoff = "\n\nRUNOFF ELECTION\nLafayette City Court Judge, Division B\n\nPrinted city court voting area.\n\nExample First    Republican\nExample Second    Democratic\n";
	const result = readLafayetteBallotResearch(`${guide}\fDecember references${runoff}`, government, electionDate);
	assert.equal(result.candidateReferences.length, 0);
	const selected = readLafayetteBallotResearch(guide + runoff, government, electionDate);
	assert.equal(selected.candidateReferences.length, 2);
	assert.deepEqual(selected.candidateReferences.map(row => row.partyAsPrinted), ["Republican", "Democratic"]);
	assert(selected.candidateReferences.every(row => row.sourceClaimOnly && !row.officialQualificationVerified));
	assert.throws(() => readLafayetteBallotResearch(guide + runoff.replace("Republican", "Unknown Party"), government, electionDate));
	assert.throws(() => readLafayetteBallotResearch(guide + runoff.replace("Example Second", "Example First"), government, electionDate));
	assert.throws(() => readLafayetteBallotResearch(guide + runoff.replace("Division B", "Division C"), government, electionDate));
});

test("bounded offline preparation pins originals, preserves clocks and refuses overwrite or foreign URLs", async (context) => {
	const directory = await mkdtemp(join(tmpdir(), "lafayette-research-"));
	context.after(() => rm(directory, { recursive: true, force: true }));
	const { guide, government } = fixture();
	const pdf = Buffer.from("%PDF-test-fixture");
	const pdfPath = join(directory, "guide.pdf");
	const htmlPath = join(directory, "government.html");
	const planPath = join(directory, "plan.json");
	await writeFile(pdfPath, pdf);
	await writeFile(htmlPath, government);
	const pin = (path: string, body: string | Buffer, url: string) => ({ path, sha256: createHash("sha256").update(body).digest("hex"), url, capturedAt: "2026-11-14T00:00:00.000Z" });
	const plan = { schemaVersion: 1, type: "lafayette-ballot-research-preparation", electionDate, guide: pin(pdfPath, pdf, "https://www.oneacadiana.org/wp-content/uploads/GeauxVote_Dec2030_BallotGuide-FINAL-v2.pdf"), governmentPage: pin(htmlPath, government, "https://www.lafayettela.info/"), outputDirectory: join(directory, "output") };
	await writeFile(planPath, JSON.stringify(plan));
	const result = await prepareLafayetteBallotResearch(planPath, async () => guide);
	assert.equal(result.measures, 3);
	assert.equal(result.numberingConflicts, 2);
	assert.equal(result.publisherRequests, 0);
	const original = await readFile(join(plan.outputDirectory, "research.json"));
	const report = JSON.parse(original.toString());
	assert.equal(report.sources.guide.capturedAt, plan.guide.capturedAt);
	assert.equal(report.sources.governmentPage.sha256, plan.governmentPage.sha256);
	assert.equal(report.imported, undefined);
	await assert.rejects(prepareLafayetteBallotResearch(planPath, async () => guide), /EEXIST/u);
	assert.deepEqual(await readFile(join(plan.outputDirectory, "research.json")), original);
	for (const guidePin of [{ ...plan.guide, sha256: "0".repeat(64) }, { ...plan.guide, url: plan.guide.url.replace("Dec2030", "Dec2026") }, { ...plan.guide, url: plan.guide.url.replace("www.oneacadiana.org", "example.org") }, { ...plan.guide, capturedAt: "2099-01-01T00:00:00.000Z" }]) {
		await writeFile(planPath, JSON.stringify({ ...plan, guide: guidePin, outputDirectory: join(directory, "rejected") }));
		await assert.rejects(prepareLafayetteBallotResearch(planPath, async () => guide));
	}
	const alias = join(directory, "alias.pdf");
	await symlink(pdfPath, alias);
	await writeFile(planPath, JSON.stringify({ ...plan, guide: { ...plan.guide, path: alias }, outputDirectory: join(directory, "symlink-rejected") }));
	await assert.rejects(prepareLafayetteBallotResearch(planPath, async () => guide));
});
