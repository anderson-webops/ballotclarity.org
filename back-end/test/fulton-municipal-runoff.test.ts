import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { parse as parseCsv } from "csv-parse/sync";
import { fultonMunicipalRunoffCsv, prepareFultonMunicipalRunoff } from "../src/fulton-municipal-runoff.js";

const source = { url: "https://www.fultoncountyga.gov/-/media/elections/runoff.pdf", sha256: "a".repeat(64), bytes: 100, retrievedAt: "2026-11-13T20:38:39.838Z" };
function fixture(date = "December 02, 2025") {
	const field = (top: number, left: number, text: string, font: number, bold = false) => `<text top="${top}" left="${left}" width="150" height="20" font="${font}">${bold ? `<b>${text}</b>` : text}</text>`;
	return `<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE pdf2xml SYSTEM "pdf2xml.dtd"><pdf2xml><page number="1" width="918" height="1512">
	<fontspec id="1" size="18" family="ABCDEF+Arial" color="#231f20"/><fontspec id="2" size="17" family="ABCDEF+ArialNarrow" color="#231f20"/>
	<fontspec id="3" size="14" family="ABCDEF+ArialMT" color="#231f20"/><fontspec id="4" size="15" family="ABCDEF+ArialNarrow" color="#231f20"/>
	<fontspec id="5" size="12" family="ABCDEF+ArialMT" color="#231f20"/>
	${field(50, 90, "COMPOSITE SAMPLE BALLOT", 1, true)}${field(80, 90, "Fulton County, Georgia", 1)}${field(110, 90, `Municipal General Runoff Election - ${date}`, 1)}
	${Array.from({ length: 15 }, (_, index) => field(150 + index * 20, 90, "Instruction text", 3)).join("")}
	${field(490, 93, "General Election Runoff", 1, true)}${field(510, 93, "City of Atlanta", 1, true)}
	${field(550, 93, "For Board of Education Member", 2, true)}${field(575, 93, "District 8 At Large", 2, true)}${field(600, 93, "(Vote for One)", 3)}
	${field(630, 107, "First Candidate", 4, true)}${field(680, 107, "Second Candidate", 4, true)}${field(699, 107, "(Incumbent)", 5)}
	${field(490, 356, "General Election Runoff", 1, true)}${field(510, 356, "City of East Point", 1, true)}
	${field(550, 370, "For Mayor", 2, true)}${field(580, 370, "(Vote for One)", 3)}${field(620, 370, "Joshua Example, IV", 4, true)}${field(670, 370, "Another Candidate", 4, true)}
	</page></pdf2xml>`;
}

test("municipal preparation preserves scoped offices, at-large wording, explicit incumbency and unknown parties", () => {
	const inventory = prepareFultonMunicipalRunoff(fixture(), source);
	assert.equal(inventory.electionDate, "2025-12-02");
	assert.equal(inventory.contests.length, 2);
	assert.equal(inventory.contests[0]!.district, "District 8 At Large");
	assert.equal(inventory.contests[0]!.municipality, "City of Atlanta");
	assert.equal(inventory.contests[1]!.municipality, "City of East Point");
	assert.equal(inventory.contests[1]!.office, "Mayor");
	assert.equal(inventory.contests[0]!.candidates[1]!.incumbent, true);
	assert.equal("incumbent" in inventory.contests[0]!.candidates[0]!, false);
	assert.equal("party" in inventory.contests[0]!.candidates[0]!, false);
	assert.equal(inventory.publicationApproved, false);
	assert.equal(inventory.voterApplicabilityVerified, false);
	assert.equal(inventory.automaticCollectionConfigured, false);
	assert.equal(inventory.sourcePublishedAt, null);
	assert.deepEqual(prepareFultonMunicipalRunoff(fixture(), source), inventory);
	const rows = parseCsv(fultonMunicipalRunoffCsv(inventory), { columns: true }) as Record<string, string>[];
	assert.equal(rows.length, 4);
	assert.equal(rows[2]!.name, "Joshua Example, IV");
	assert.equal(rows[0]!.retrievedAt, source.retrievedAt);
});

test("municipal preparation follows explicit future dates without annual edits or invented prior elections", () => {
	const current = prepareFultonMunicipalRunoff(fixture(), source);
	const future = prepareFultonMunicipalRunoff(fixture("November 30, 2032"), source);
	assert.equal(future.electionDate, "2032-11-30");
	assert.equal(future.sourceId, "ga-fulton-municipal-runoff-2032-11-30");
	assert.equal(future.retrievedAt, source.retrievedAt);
	assert.notEqual(current.contests[0]!.id, future.contests[0]!.id);
	assert.notEqual(current.contests[0]!.candidates[0]!.id, future.contests[0]!.candidates[0]!.id);
	assert.equal("generalElectionDate" in future, false);
});

test("municipal incomplete, ambiguous, altered and unsupported layouts require review", () => {
	for (const changed of [
		fixture("December 03, 2025"),
		fixture().replace("Fulton County, Georgia", "Another County, Georgia"),
		fixture().replace("Second Candidate", "First Candidate"),
		fixture().replace("City of Atlanta", "Unavailable"),
		fixture().replace("District 8 At Large", "District 8").replace("(Vote for One)", "(Vote for Two)"),
		fixture().replace("For Mayor", "For Unknown Office"),
		fixture().replace("<text top=\"670\"", "<text top=\"620\""),
		fixture().replace("left=\"107\"", "left=\"327\""),
		fixture().replace("#231f20", "#ffffff"),
		fixture().replace("First Candidate", "<a>First Candidate</a>"),
		fixture().replace(/<text top="670"[^>]*>.*?<\/text>/u, ""),
	]) assert.throws(() => prepareFultonMunicipalRunoff(changed, source));
	assert.throws(() => prepareFultonMunicipalRunoff(fixture(), { ...source, url: "https://example.org/ballot.pdf" }));
	assert.throws(() => prepareFultonMunicipalRunoff(fixture(), { ...source, retrievedAt: "2025-12-02" }));
	assert.throws(() => prepareFultonMunicipalRunoff(fixture(), { ...source, sha256: "bad" }));
});

test("municipal preparation refuses a mismatched original PDF before invoking native tools", async (context) => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-municipal-source-"));
	context.after(() => rm(directory, { recursive: true, force: true }));
	const pdf = Buffer.from("%PDF-1.4\ncontrolled fixture\n");
	await writeFile(join(directory, "ballot.pdf"), pdf);
	await writeFile(join(directory, "source.json"), JSON.stringify({ ...source, bytes: pdf.length }));
	const result = spawnSync(process.execPath, ["--import", "tsx", fileURLToPath(new URL("../src/prepare-fulton-municipal-runoff.ts", import.meta.url)), join(directory, "ballot.pdf"), join(directory, "source.json")], { encoding: "utf8", timeout: 5000, env: { ...process.env, STATE_BALLOT_PDFTOHTML: join(directory, "unavailable-extractor") } });
	assert.equal(result.status, 1);
	assert.equal(result.stdout, "");
	assert.match(result.stderr, /does not match its original source capture/u);
});
