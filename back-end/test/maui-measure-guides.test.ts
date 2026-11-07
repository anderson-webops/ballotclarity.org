import type { MauiCharterCapture } from "../src/maui-charter-measures.js";
import type { MauiMeasureEvidence } from "../src/maui-measure-guides.js";
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { mkdtemp, readdir, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { buildMauiMeasureDraft, prepareMauiMeasureGuideFiles } from "../src/maui-measure-guides.js";

const hash = (body: string | Uint8Array) => createHash("sha256").update(body).digest("hex");
const now = Date.parse("2028-09-20T12:00:00.000Z");
const clock = new Date(now).toISOString();
const origin = "https://mauicountyvotes.gov";
const articleUrl = `${origin}/blog/f/two-proposed-maui-county-charter-amendments-on-general-ballot`;
const xml = (urls: string[], root = "urlset") => `<?xml version="1.0"?><${root}>${urls.map(url => `<loc>${url}</loc>`).join("")}</${root}>`;
function fixture() {
	const pdf = Buffer.from("%PDF-1.7\nControlled synthetic resolution fixture\n");
	const documents: MauiMeasureEvidence[] = [1, 2].map(identifier => ({ resolution: `28-${identifier}`, path: `/external/resolution-${identifier}.pdf`, sha256: hash(pdf), url: `https://img1.wsimg.com/blobby/go/d625d658-8582-4d35-b9fe-7702a7c85585/downloads/00000000-0000-0000-0000-00000000000${identifier}/Reso%2028-${identifier}.pdf?ver=1789162285624`, capturedAt: clock }));
	const robots = `User-agent: *\nDisallow: /404\nSitemap: ${origin}/sitemap.xml\n`;
	const index = `<h1>2028 Charter Amendments</h1>${documents.map((document, index) => `<h4>Maui: Procedure ${index + 1}</h4><a href="${document.url}">Reso ${document.resolution}</a>`).join("")}`;
	const post = { publishedDate: "2028-09-18T18:43:35.465Z", fullContent: JSON.stringify({ blocks: [{ text: "WAILUKU, Hawaii (Sept. 17, 2028), Councilmember reports that the Nov. 7 general election ballot will include two proposed amendments to the Maui County Charter." }, ...documents.map((document, index) => ({ text: `Resolution ${document.resolution}:\n“Shall the Charter be amended to establish procedure ${index + 1}?”` }))] }) };
	const article = `<script>window._BLOG_DATA=${JSON.stringify({ head: { canonicalUrl: articleUrl }, post })}</script>`;
	const capture: MauiCharterCapture = { schemaVersion: 1, type: "maui-charter-measure-capture", accessReview: { reviewedAt: clock, robotsSha256: hash(robots) }, documents: [[`${origin}/robots.txt`, robots], [`${origin}/charter-amendments`, index], [`${origin}/sitemap.xml`, xml([`${origin}/sitemap.blog.xml`], "sitemapindex")], [`${origin}/sitemap.blog.xml`, xml([articleUrl])], [articleUrl, article]].map(([url, body]) => ({ url: url!, body: body!, sha256: hash(body!), capturedAt: clock })) };
	const pending = buildMauiMeasureDraft(capture, documents, null, now);
	const review = { ...pending.template, reviewedAt: clock, questions: pending.template.questions.map((question, index) => ({ ...question, summary: `Changes procedure ${index + 1}.`, yesMeaning: `Would adopt procedure ${index + 1}.`, noMeaning: `Would retain the current procedure ${index + 1}.`, reviewedPages: [2, 3] })) };
	return { capture, documents, review, pdf };
}

test("Maui prepares native measures with exact questions, county scope, source clocks and review gates", () => {
	const { capture, documents, review } = fixture();
	const result = buildMauiMeasureDraft(capture, documents, review, now);
	assert.deepEqual(result.issues, []);
	assert.ok(result.draft);
	assert.equal(result.draft.electionDate, "2028-11-07");
	assert.equal(result.draft.jurisdiction.name, "Maui County");
	assert.equal(result.draft.measures.length, 2);
	assert.equal(result.draft.measures[0]!.location, "Maui County, Hawaii");
	assert.equal(result.draft.measures[0]!.ballotSummary, "Shall the Charter be amended to establish procedure 1?");
	assert.equal(result.draft.measures[0]!.sources[0]!.date, "2028-09-18");
	assert.ok(result.draft.measures[0]!.sources[1]!.url.endsWith("#page=2"));
	assert.equal(result.draft.measures[0]!.sources[1]!.date, "");
	assert.deepEqual(result.draft.documents["resolution-28-1"]!.reviewedPages, [2, 3]);
	assert.equal(result.draft.publicationApproved, false);
	assert.equal(result.draft.automaticImportApproved, false);
	assert.deepEqual(result.draft.measures[0]!.fiscalSummary, []);
	assert.deepEqual(result.draft.measures[0]!.supportArguments, []);
	assert.deepEqual(result.draft.measures[0]!.whatWeDoNotKnow, []);
});

test("Maui reuses unchanged reviewed wording without freshening editorial timestamps", () => {
	const { capture, documents, review } = fixture();
	for (const document of capture.documents) document.capturedAt = new Date(now + 86_400_000).toISOString();
	review.questions.reverse();
	const result = buildMauiMeasureDraft(capture, documents, review, now + 86_400_000);
	assert.ok(result.draft);
	assert.equal(result.draft.reviewedAt, clock);
	assert.equal(result.draft.measures[0]!.summary, "Changes procedure 1.");
	assert.equal(result.draft.measures[0]!.freshness.contentLastVerifiedAt, clock);
	assert.equal(result.draft.measures[0]!.freshness.dataLastUpdatedAt, clock);
});

test("Maui routes new, changed, incomplete and disappeared questions to review", () => {
	const { capture, documents, review } = fixture();
	assert.equal(buildMauiMeasureDraft(capture, documents, null, now).draft, null);
	for (const reason of ["question-changed", "resolution-document-changed", "review-incomplete", "missing-review", "question-no-longer-offered"]) {
		const changed = structuredClone(review);
		if (reason === "question-changed") changed.questions[0]!.questionSha256 = "0".repeat(64);
		if (reason === "resolution-document-changed") changed.questions[0]!.resolutionSha256 = "0".repeat(64);
		if (reason === "review-incomplete") changed.questions[0]!.yesMeaning = "";
		if (reason === "missing-review") changed.questions.pop();
		if (reason === "question-no-longer-offered") changed.questions.push({ ...changed.questions[0]!, resolution: "28-9" });
		const result = buildMauiMeasureDraft(capture, documents, changed, now);
		assert.equal(result.draft, null);
		assert.ok(result.issues.some(issue => issue.reason === reason));
	}
});

test("Maui rejects authority escalation, wrong elections, duplicate reviews and invalid pages", () => {
	const { capture, documents, review } = fixture();
	for (const changed of [{ ...review, publicationApproved: true }, { ...review, automaticImportApproved: true }, { ...review, electionDate: "2026-11-03" }, { ...review, reviewedAt: "2030-01-01T00:00:00.000Z" }, { ...review, questions: [...review.questions, review.questions[0]] }, { ...review, questions: [{ ...review.questions[0], reviewedPages: [0] }] }]) assert.throws(() => buildMauiMeasureDraft(capture, documents, changed, now));
	assert.throws(() => buildMauiMeasureDraft(capture, [{ ...documents[0]!, url: "https://elections.hawaii.gov/held.pdf" }, documents[1]!], review, now));
});

async function workspace(withReview = true) {
	const data = fixture();
	const directory = await realpath(await mkdtemp(join(tmpdir(), "maui-native-measures-")));
	const persist = async (name: string, body: string | Buffer) => {
		const path = join(directory, name);
		await writeFile(path, body);
		return { path, sha256: hash(body) };
	};
	const inventory = buildMauiMeasureDraft(data.capture, data.documents, null, now).inventory;
	const capture = await persist("capture.json", JSON.stringify({ inventory, capture: data.capture }));
	const review = withReview ? await persist("review.json", JSON.stringify(data.review)) : null;
	const documents = await Promise.all(data.documents.map(async (document, index) => ({ ...document, ...await persist(`resolution-${index}.pdf`, data.pdf) })));
	const plan = { schemaVersion: 1, type: "maui-measure-guide-preparation", capture, review, documents, baseSnapshot: null, outputDirectory: join(directory, "output"), outputName: "maui-2028" };
	const planPath = join(directory, "plan.json");
	await writeFile(planPath, JSON.stringify(plan));
	return { directory, plan, planPath };
}

test("Maui writes a review template rather than fabricated interpretations for a new cycle", async () => {
	const working = await workspace(false);
	try {
		const result = await prepareMauiMeasureGuideFiles(working.planPath, now);
		assert.equal(result.status, "editorial-review-required");
		assert.deepEqual((await readdir(working.plan.outputDirectory)).sort(), ["maui-2028-result.json", "maui-2028-review-template.json"]);
		await assert.rejects(prepareMauiMeasureGuideFiles(working.planPath, now));
	}
	finally { await rm(working.directory, { recursive: true, force: true }); }
});

test("Maui assembles native guides and publication workflows from pinned reviewed local evidence", async () => {
	const working = await workspace();
	try {
		const result = await prepareMauiMeasureGuideFiles(working.planPath, now);
		assert.equal(result.status, "prepared-for-review");
		assert.equal(result.publisherRequests, 0);
		const guides = JSON.parse(await readFile(join(working.plan.outputDirectory, "assembly/maui-2028-guides.json"), "utf8"));
		assert.equal(guides.guides.length, 1);
		assert.equal(guides.guides[0].election.contests.length, 2);
		assert.equal(guides.publicationApproved, false);
		assert.equal(guides.automaticImportApproved, false);
		const workflows = JSON.parse(await readFile(join(working.plan.outputDirectory, "assembly/maui-2028-workflows.json"), "utf8"));
		assert.ok(workflows.every((workflow: { status: string }) => workflow.status === "draft"));
		const original = await readFile(join(working.plan.outputDirectory, "maui-2028-native-draft.json"));
		await assert.rejects(prepareMauiMeasureGuideFiles(working.planPath, now));
		assert.deepEqual(await readFile(join(working.plan.outputDirectory, "maui-2028-native-draft.json")), original);
	}
	finally { await rm(working.directory, { recursive: true, force: true }); }
});

test("Maui rejects changed source bytes before creating output", async () => {
	const working = await workspace();
	try {
		await writeFile(working.plan.documents[0]!.path, "%PDF-1.7\nchanged");
		await assert.rejects(prepareMauiMeasureGuideFiles(working.planPath, now));
		assert.ok(!(await readdir(working.directory)).includes("output"));
	}
	finally { await rm(working.directory, { recursive: true, force: true }); }
});
