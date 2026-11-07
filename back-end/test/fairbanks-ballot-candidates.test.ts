import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fairbanksCandidateRenderPages, readFairbanksBallotCandidates } from "../src/fairbanks-ballot-candidates.js";
import { prepareFairbanksCandidateFiles } from "../src/fairbanks-candidate-preparation.js";
import { fairbanksFixtureClock as clock, fairbanksOval as oval, fairbanksNativeSample as sample } from "./fixtures/fairbanks-candidate-synthetic.js";

test("Fairbanks native preparation separates municipalities, named candidates, terms and selection limits", () => {
	const data = sample();
	const result = readFairbanksBallotCandidates(data.capture, data.documents, data.now);
	assert.equal(result.records.length, 5);
	assert.equal(result.proof.length, 4);
	assert.equal(result.records.filter(record => record.jurisdiction === "City of North Pole").length, 2);
	assert.equal(result.records.find(record => record.name === "Morgan Lane")!.voteLimit, 2);
	assert.ok(result.records.every(record => record.party === null && record.status === "listed" && record.termYears === 3 && record.termEndYear === 2029));
	assert.ok(result.records.every(record => record.name !== "Write-In" && record.capturedAt === clock));
	assert.equal(result.importApproved, false);
	assert.equal(result.publicationApproved, false);
	assert.equal(result.resultsInferred, false);
});
test("Fairbanks native fields work for a separately printed future cycle", () => {
	const data = sample(2027);
	const result = readFairbanksBallotCandidates(data.capture, data.documents, data.now);
	assert.equal(result.electionDate, "2027-10-05");
	assert.ok(result.records.every(record => record.termEndYear === 2030));
	assert.deepEqual(fairbanksCandidateRenderPages(data.documents[1]!.bbox, "notice").map(page => page.page), [2, 3, 4]);
});
test("Native or printed candidate disagreement and low-confidence primary facts hold preparation", () => {
	for (const change of ["native", "rendered", "confidence"]) {
		const data = sample();
		if (change === "native") data.documents[0]!.bbox = data.documents[0]!.bbox.replace("Jordan Avery", "Jordan Other");
		if (change === "rendered") data.documents[0]!.pages[0]!.ocr = data.documents[0]!.pages[0]!.ocr.replace("Jordan Avery", "Jordan Other");
		if (change === "confidence") data.documents[0]!.pages[0]!.ocr = data.documents[0]!.pages[0]!.ocr.replace("96\tJordan Avery", "50\tJordan Avery");
		assert.throws(() => readFairbanksBallotCandidates(data.capture, data.documents, data.now), /printed field disagreement/u);
	}
});
test("The duplicate borough sample cannot introduce a different candidate or silently omit one", () => {
	const data = sample();
	data.documents[1]!.bbox = data.documents[1]!.bbox.replace("Jordan Avery", "Jordan Other");
	data.documents[1]!.pages[0]!.ocr = data.documents[1]!.pages[0]!.ocr.replace("Jordan Avery", "Jordan Other");
	assert.throws(() => readFairbanksBallotCandidates(data.capture, data.documents, data.now), /borough publication disagreement/u);
});

test("Printed candidates missing from native text cannot disappear from the prepared inventory", () => {
	const data = sample();
	const extra = "<line xmin=\"96\" ymin=\"270\" xmax=\"186\" ymax=\"278\">Riley Quinn</line>";
	const native = "<line xmin=\"96\" ymin=\"260\" xmax=\"186\" ymax=\"268\">Jordan Avery</line>";
	const rendered = `5\t1\t1\t1\t99\t1\t400\t1125\t375\t${8 * 300 / 72}\t96\tRiley Quinn\n`;
	for (const document of data.documents) {
		document.bbox = document.bbox.replace(native, native + extra);
		document.pages[0]!.ocr += rendered;
		document.pages[0]!.svg = document.pages[0]!.svg.replace("</svg>", `${oval(96, 270)}</svg>`);
	}
	assert.equal(readFairbanksBallotCandidates(data.capture, data.documents, data.now).records.length, 6);
	data.documents[0]!.bbox = data.documents[0]!.bbox.replace(extra, "");
	assert.throws(() => readFairbanksBallotCandidates(data.capture, data.documents, data.now), /unaccounted printed candidate/u);
});

test("Printed selection rows omitted from both native text and OCR hold preparation", () => {
	const data = sample();
	data.documents[0]!.pages[0]!.svg = data.documents[0]!.pages[0]!.svg.replace("</svg>", `${oval(96, 500)}</svg>`);
	assert.throws(() => readFairbanksBallotCandidates(data.capture, data.documents, data.now), /unaccounted printed candidate selection/u);
});

test("Missing, duplicated and obscured selection marks hold preparation", () => {
	for (const change of ["missing", "duplicate", "covered"]) {
		const data = sample();
		const page = data.documents[0]!.pages[0]!;
		if (change === "missing") page.svg = page.svg.replace(oval(96, 260), "");
		if (change === "duplicate") page.svg = page.svg.replace("</svg>", `${oval(96, 260)}</svg>`);
		if (change === "covered") page.svg = page.svg.replace("</svg>", "<path fill=\"white\" d=\"M 80 255 L 92 255 L 92 270 L 80 270 Z\"/></svg>");
		assert.throws(() => readFairbanksBallotCandidates(data.capture, data.documents, data.now), /selection/u, change);
	}
});

test("Unexpected printed rows before or after known candidates hold even at low OCR confidence", () => {
	for (const top of [190, 270, 500]) {
		const data = sample();
		data.documents[0]!.pages[0]!.ocr += `5\t1\t1\t1\t99\t1\t400\t${top * 300 / 72}\t375\t${8 * 300 / 72}\t10\tRiley Quinn\n`;
		assert.throws(() => readFairbanksBallotCandidates(data.capture, data.documents, data.now), /unaccounted printed candidate-region words/u);
	}
});
test("Missing proof, mixed source bytes, malformed OCR and altered vote limits remain held", () => {
	for (const change of ["missing", "source", "geometry", "columns", "limit", "term", "write-in"]) {
		const data = sample();
		if (change === "missing") data.documents[1]!.pages.pop();
		if (change === "source") data.documents[0]!.sourceSha256 = "0".repeat(64);
		if (change === "geometry") data.documents[0]!.bbox = data.documents[0]!.bbox.replace("width=\"612\"", "width=\"900\"");
		if (change === "columns") data.documents[0]!.pages[0]!.ocr = "unexpected columns";
		if (change === "limit") data.documents[0]!.bbox = data.documents[0]!.bbox.replace("One (1)", "One (2)");
		if (change === "term") data.documents[0]!.bbox = data.documents[0]!.bbox.replace("2026-2029", "2026-2030");
		if (change === "write-in") data.documents[0]!.bbox = data.documents[0]!.bbox.replace("Write-In", "Write in");
		assert.throws(() => readFairbanksBallotCandidates(data.capture, data.documents, data.now), /requires review/u, change);
	}
});

test("Preparation rejects malformed plans and altered pinned inputs without changing retained evidence", async () => {
	const directory = await mkdtemp(join(tmpdir(), "fairbanks-native-plan-"));
	try {
		const planPath = join(directory, "plan.json");
		await writeFile(planPath, JSON.stringify({ schemaVersion: 1, type: "wrong" }));
		await assert.rejects(prepareFairbanksCandidateFiles(planPath), /pinned Fairbanks/u);
		const path = join(directory, "publications.json");
		const original = Buffer.from("Preserved unrelated evidence\n");
		await writeFile(path, original);
		await writeFile(planPath, JSON.stringify({ schemaVersion: 1, type: "fairbanks-native-candidate-preparation", publicationBundle: { path, sha256: "0".repeat(64) }, outputDirectory: directory }));
		await assert.rejects(prepareFairbanksCandidateFiles(planPath), /bundle changed/u);
		assert.deepEqual(await readFile(path), original);
	}
	finally {
		await rm(directory, { recursive: true, force: true });
	}
});
