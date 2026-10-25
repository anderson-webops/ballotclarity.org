import type { MarylandQuestionReview } from "../src/maryland-question-review.js";
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { parseMarylandQuestionPage, prepareMarylandQuestionReview } from "../src/maryland-question-review.js";

const now = Date.parse("2026-10-23T16:00:00Z");
const hash = (body: string) => createHash("sha256").update(body).digest("hex");
const review: MarylandQuestionReview = { electionDate: "2026-11-03", areas: [{ label: "SBE", questionIds: ["1"] }, { label: "Anne Arundel", questionIds: ["A"] }] };
const stateQuestion = "<h2>Question 1</h2><p>Constitutional Amendment</p><p>Require the proposed budget to include the specified employee compensation agreements.</p><ul><li>For the Constitutional Amendment - A vote FOR requires the stated proposed expenditures.</li><li>Against the Constitutional Amendment - A vote AGAINST retains the current requirements.</li></ul><div lang=\"es\"><h2>Pregunta 1</h2><p>Texto oficial de la pregunta.</p></div>";
const localQuestion = "<h2>QUESTION A</h2><p>Charter Amendment</p><p>Permit the specified employee representatives to enter binding arbitration.</p><p>A vote FOR the amendment permits the stated arbitration.</p><p>A vote AGAINST the amendment retains the current rules.</p><ul><li>FOR Charter Amendment</li><li>AGAINST Charter Amendment</li></ul>";
const page = `<main><section id="bodyMain"><h1>Ballot Questions for the November 3, 2026 Election</h1><p>All comment periods have now closed.</p><details><summary>SBE</summary><p>Updated translation is forthcoming for Question 1.</p>${stateQuestion}</details><details><summary>Anne Arundel</summary>${localQuestion}</details></section></main>`;

function fixture() {
	const directory = mkdtempSync(join(tmpdir(), "maryland-review-test-"));
	const capturePath = join(directory, "capture.html");
	writeFileSync(capturePath, page);
	const plan = { schemaVersion: 1, type: "maryland-question-review-preparation", electionDate: review.electionDate, expectedAreas: structuredClone(review.areas), capture: { path: capturePath, sha256: hash(page), url: "https://elections.maryland.gov/elections/2026/ballot_questions.html", capturedAt: "2026-10-23T12:00:00Z" }, outputDirectory: join(directory, "out"), outputName: "maryland-review" };
	const planPath = join(directory, "plan.json");
	const save = () => writeFileSync(planPath, JSON.stringify(plan));
	save();
	return { directory, capturePath, plan, planPath, save, dispose: () => rmSync(directory, { recursive: true, force: true }) };
}

test("Maryland extraction keeps local scope, printed labels and translated companions separate", () => {
	const result = parseMarylandQuestionPage(Buffer.from(page), review);
	assert.equal(result.questions.length, 2);
	assert.equal(result.questions[0]!.jurisdictionType, "state");
	assert.equal(result.questions[1]!.jurisdictionName, "Anne Arundel County");
	assert.deepEqual(result.questions[1]!.ballotOptions, { yes: "FOR Charter Amendment", no: "AGAINST Charter Amendment" });
	assert.equal(result.questions[0]!.forExplanation, "A vote FOR requires the stated proposed expenditures.");
	assert.ok(result.questions[1]!.forExplanation.startsWith("A vote FOR"));
	assert.ok(result.questions.every(question => !question.personalBallotAssignment && !question.meaningInferred));
	assert.equal(JSON.stringify(result.questions).includes("Texto oficial"), false);
	assert.equal(result.translations.length, 1);
	assert.equal(result.translations[0]!.updatedTranslationPending, true);
	assert.equal(result.translations[0]!.semanticReviewApproved, false);
});

test("Baltimore City and Baltimore County never collapse into a common area", () => {
	const body = page.replace("SBE", "Baltimore City").replace("Anne Arundel", "Baltimore County");
	const areas = [{ label: "Baltimore City", questionIds: ["1"] }, { label: "Baltimore County", questionIds: ["A"] }];
	const result = parseMarylandQuestionPage(Buffer.from(body), { ...review, areas });
	assert.deepEqual(result.questions.map(question => [question.jurisdictionType, question.jurisdictionName]), [["city", "Baltimore City"], ["county", "Baltimore County"]]);
});

test("election, groups, identities, languages and unknown labels are held rather than coerced", () => {
	for (const body of [page.replaceAll("2026", "2028"), page.replace("All comment periods have now closed.", "Comments remain open."), page.replace("Anne Arundel", "Unknown County"), page.replace("QUESTION A", "QUESTION B"), page.replace("Pregunta 1", "Pregunta 2"), page.replace("lang=\"es\"", "lang=\"fr\""), page.replace("For the Constitutional Amendment", "Against the Constitutional Amendment"), page.replace("AGAINST Charter Amendment", "REJECT Charter Amendment"), page.replace("<h2>QUESTION A</h2>", "<h2>QUESTION A</h2><h2>QUESTION A</h2>"), page.replace("</section>", "<section id=\"bodyMain\"></section></section>"), page.replace("<p>Charter Amendment</p>", "<p>Charter Amendment<script>private data</script></p>")])
		assert.throws(() => parseMarylandQuestionPage(Buffer.from(body), review));
	for (const label of ["Unknown", "__proto__", "constructor"])
		assert.throws(() => parseMarylandQuestionPage(Buffer.from(page), { ...review, areas: [{ label, questionIds: ["1"] }] }), /reviewed jurisdiction/u);
});

test("pending translation notices bind the whole question identifier", () => {
	const body = page.replace("forthcoming for Question 1.", "forthcoming for Question 13.");
	assert.equal(parseMarylandQuestionPage(Buffer.from(body), review).translations[0]!.updatedTranslationPending, false);
});

test("HTML byte, structure and UTF-8 limits remain bounded", () => {
	assert.throws(() => parseMarylandQuestionPage(Buffer.alloc(2 * 1024 * 1024 + 1), review), /size limit/u);
	assert.throws(() => parseMarylandQuestionPage(Buffer.from([255, 254]), review));
	assert.throws(() => parseMarylandQuestionPage(Buffer.from("<div>".repeat(70) + page + "</div>".repeat(70)), review), /structure limit/u);
});

test("offline preparation emits review-only source-pinned files and refuses overwrite", async () => {
	const workspace = fixture();
	try {
		const result = await prepareMarylandQuestionReview(workspace.planPath, now);
		assert.equal(result.questions, 2);
		assert.equal(result.publisherRequests, 0);
		assert.equal(result.imported, false);
		const manifest = JSON.parse(readFileSync(join(workspace.plan.outputDirectory, "maryland-review-manifest.json"), "utf8"));
		assert.equal(manifest.publicationApproved, false);
		assert.equal(manifest.automaticImportApproved, false);
		assert.equal(manifest.pendingTranslations, 1);
		assert.equal(manifest.publicationDate, null);
		assert.equal(manifest.capturedAt, workspace.plan.capture.capturedAt);
		assert.equal(readFileSync(join(workspace.plan.outputDirectory, "maryland-review.csv"), "utf8").split("\n").length, 4);
		await assert.rejects(() => prepareMarylandQuestionReview(workspace.planPath, now), /EEXIST/u);
	}
	finally { workspace.dispose(); }
});

test("capture drift, future dates, arbitrary sources, linked inputs and application output fail closed", async () => {
	for (const mutation of ["digest", "future", "host", "scope", "link", "output"]) {
		const workspace = fixture();
		try {
			if (mutation === "digest") workspace.plan.capture.sha256 = "a".repeat(64);
			if (mutation === "future") workspace.plan.capture.capturedAt = "2027-01-01T00:00:00Z";
			if (mutation === "host") workspace.plan.capture.url = "https://example.org/ballot_questions.html";
			if (mutation === "scope") workspace.plan.expectedAreas[1]!.label = "SBE";
			if (mutation === "link") {
				const target = `${workspace.capturePath}.linked`;
				symlinkSync(workspace.capturePath, target);
				workspace.plan.capture.path = target;
			}
			if (mutation === "output") workspace.plan.outputDirectory = fileURLToPath(new URL("../data/forbidden-review-output", import.meta.url));
			workspace.save();
			await assert.rejects(() => prepareMarylandQuestionReview(workspace.planPath, now));
			assert.equal(existsSync(workspace.plan.outputDirectory), false);
		}
		finally { workspace.dispose(); }
	}
});

test("source CLI is offline and rejects additional arguments", () => {
	const workspace = fixture();
	try {
		const entry = fileURLToPath(new URL("../src/prepare-maryland-questions.ts", import.meta.url));
		const root = fileURLToPath(new URL("../../", import.meta.url));
		const result = spawnSync(process.execPath, ["--import", "tsx", entry, workspace.planPath], { cwd: root, encoding: "utf8" });
		assert.equal(result.status, 0, result.stderr);
		assert.equal(JSON.parse(result.stdout).questions, 2);
		assert.notEqual(spawnSync(process.execPath, ["--import", "tsx", entry, workspace.planPath, "extra"], { cwd: resolve(root), encoding: "utf8" }).status, 0);
	}
	finally { workspace.dispose(); }
});
