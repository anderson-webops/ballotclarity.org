import type { FairbanksCandidateDocument } from "../src/fairbanks-ballot-candidates.js";
import type { FairbanksPublicationCapture } from "../src/fairbanks-election-publications.js";
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fairbanksCandidateRenderPages, readFairbanksBallotCandidates } from "../src/fairbanks-ballot-candidates.js";
import { prepareFairbanksCandidateFiles } from "../src/fairbanks-candidate-preparation.js";
import { fairbanksElectionIndexUrl, fairbanksPublicationAccessReview } from "../src/fairbanks-election-publications.js";

const clock = "2026-11-07T08:00:00.000Z";
const hash = (body: string) => createHash("sha256").update(body).digest("hex");
const fixture = (name: string) => readFileSync(new URL(`./fixtures/fairbanks-publication-${name}`, import.meta.url), "utf8");
const columns = "level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext";
interface Line { text: string; left: number; top: number; right: number; bottom: number }
function oval(left: number, top: number) {
	return `<path fill="none" stroke="rgb(0%,0%,0%)" stroke-width="0.6" d="M 5 0 C 5 2.25 2.75 4 0 4 C -2.75 4 -5 2.25 -5 0 C -5 -2.25 -2.75 -4 0 -4 C 2.75 -4 5 -2.25 5 0" transform="matrix(1,0,0,-1,${left - 10},${top + 4})"/>`;
}
function sample(year = 2026) {
	const electionDate = year === 2026 ? "2026-10-06" : "2027-10-05";
	const printed = year === 2026 ? "October 6, 2026" : "October 5, 2027";
	const current = year === 2026 ? clock : "2027-10-01T08:00:00.000Z";
	const urls = ["https://www.fnsb.gov/DocumentCenter/View/28941/FNSB-Sample-Ballot-PDF", "https://www.fnsb.gov/DocumentCenter/View/29012/Notice-of-Election-PDF"];
	const page = (url: string, body: string) => ({ url, body, sha256: hash(body), capturedAt: current, checkedAt: current });
	const index = `<html><div id="page"><h1>Election Information</h1><p>Municipal elections are conducted each year on the first Tuesday in October.</p><table><tr><td>Regular Municipal Election Day</td><td>Tuesday, ${printed} Polls Open from 7:00 a.m. to 8:00 p.m.</td></tr></table><a href="${urls[0]}">FNSB Sample Ballot (PDF)</a><a href="${urls[1]}">Notice of Election (PDF)</a></div>${fixture("legal.html")}</html>`;
	const capture: FairbanksPublicationCapture = {
		schemaVersion: 1,
		type: "fairbanks-election-publication-capture",
		accessReview: { ...fairbanksPublicationAccessReview, reviewedAt: new Date(Date.parse(current) - 1000).toISOString() },
		policies: [page("https://www.fnsb.gov/robots.txt", fixture("robots.txt").replace(/\n/gu, "\r\n")), page("https://www.fnsb.gov/accessibility", fixture("accessibility.html"))],
		index: page(fairbanksElectionIndexUrl, index),
		documents: urls.map((url, position) => {
			const body = `%PDF-1.7\nSynthetic native ${position}`;
			return { ...page(url, body), body: Buffer.from(body).toString("base64"), kind: position === 0 ? "sample" : "notice", text: `${position ? `Notice of Elections\nTuesday, ${printed}` : `REGULAR ELECTION - ${printed.toUpperCase()}`}\nFairbanks North Star Borough\f${position ? "Other page\fOther page\fOther page\f" : "Questions\f"}` };
		})
	};
	const line = (text: string, left: number, top: number, width = 170): Line => ({ text, left, top, right: left + width, bottom: top + 8 });
	const borough = [line("OFFICIAL BALLOT", 260, 100), line(`REGULAR ELECTION - ${printed.toUpperCase()}`, 200, 120, 220), line("FAIRBANKS NORTH STAR BOROUGH", 210, 140, 200), line("BOROUGH ASSEMBLY SEAT D", 105, 205), line(`${3}-Year Term (${year}-${year + 3})`, 130, 220, 120), line("Vote For Not More Than One (1)", 115, 235, 150), line("Jordan Avery", 96, 260, 90), line("Write-In", 96, 280, 60), line("INTERIOR ALASKA NATURAL GAS", 328, 205, 190), line("UTILITY (IGU) BOARD", 350, 218), line("AT-LARGE SEAT C", 350, 231), line(`3-Year Term (${year}-${year + 3})`, 360, 245, 120), line("Vote For Not More Than One (1)", 350, 260, 160), line("Alex Morgan", 330, 280, 90), line("Write-In", 330, 300, 60), line("END OF BALLOT", 260, 700)];
	const city = (north: boolean) => [line("OFFICIAL BALLOT", 360, 100), line(`REGULAR ELECTION - ${printed.toUpperCase()}`, 310, 120, 220), line(north ? "CITY OF NORTH POLE" : "CITY OF FAIRBANKS", 355, 140), line(north ? "NORTH POLE CITY COUNCIL" : "FAIRBANKS CITY COUNCIL SEAT E", 218, 205, 180), line(`3-Year Term (${year}-${year + 3})`, 250, 220), line(`Vote For Not More Than ${north ? "Two (2)" : "One (1)"}`, 237, 235), line(north ? "Morgan Lane" : "Casey Reed", 222, 260, 80), ...(north ? [line("Taylor Park", 222, 280, 80)] : []), line("Write-In", 222, 300, 60), ...(north ? [line("Write-In", 222, 320, 60)] : []), line("END OF BALLOT", 350, 700)];
	borough.push(line("may ask for a new ballot.", 80, 165, 160));
	const withInstructions = (north: boolean) => [...city(north), line("may ask for a new ballot.", 210, 165, 160)];
	const asXml = (lines: Line[]) => `<page width="792" height="792">${lines.map(value => `<line xmin="${value.left}" ymin="${value.top}" xmax="${value.right}" ymax="${value.bottom}">${value.text}</line>`).join("")}</page>`;
	const proof = (lines: Line[], number: number) => ({ page: number, width: 792, height: 792, dpi: 300 as const, pngSha256: hash("Synthetic rendered fixture"), ocr: `${columns}\n${lines.map((value, index) => `5\t1\t1\t1\t${index + 1}\t1\t${value.left * 300 / 72}\t${value.top * 300 / 72}\t${(value.right - value.left) * 300 / 72}\t${(value.bottom - value.top) * 300 / 72}\t96\t${value.text}`).join("\n")}\n`, svg: `<svg width="792pt" height="792pt" viewBox="0 0 792 792">${lines.filter(value => /^(?:Jordan Avery|Alex Morgan|Casey Reed|Morgan Lane|Taylor Park|Write-In)$/u.test(value.text)).map(value => oval(value.left, value.top)).join("")}</svg>` });
	const documents: FairbanksCandidateDocument[] = [
		{ kind: "sample", sourceSha256: capture.documents[0]!.sha256, bbox: `<doc>${asXml(borough)}${asXml([line("Questions", 50, 50)])}</doc>`, pages: [proof(borough, 1)] },
		{ kind: "notice", sourceSha256: capture.documents[1]!.sha256, bbox: `<doc>${asXml([line("Notice", 50, 50)])}${asXml(borough)}${asXml(withInstructions(false))}${asXml(withInstructions(true))}</doc>`, pages: [proof(borough, 2), proof(withInstructions(false), 3), proof(withInstructions(true), 4)] }
	];
	return { capture, documents, now: Date.parse(current), electionDate };
}

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
		if (change === "geometry") data.documents[0]!.bbox = data.documents[0]!.bbox.replace("width=\"792\"", "width=\"900\"");
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
