import type { TestContext } from "node:test";
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { access, mkdir, mkdtemp, readFile, realpath, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { kauaiDisclosureHash, kauaiDisclosurePdfProfile, kauaiDisclosurePublication, kauaiEthicsIndexUrl, readKauaiCandidateDisclosures, readKauaiDisclosureIndex } from "../src/kauai-candidate-disclosures.js";
import { prepareKauaiDisclosures } from "../src/prepare-kauai-disclosures.js";
import { configuredStateBallotSources } from "../src/state-ballot-registry.js";
import { parseBundledStateSnapshot } from "../src/state-ballot-snapshot.js";

const year = 2028;
const clock = "2028-11-01T12:00:00.000Z";
const publicationUrl = "https://www.kauai.gov/files/assets/public/v/1/boards-and-commissions/board-of-ethics/2028_1020_boe-agenda-packet.pdf";
const laterUrl = "https://portal.laserfiche.com/Portal/DocView.aspx?id=12345&repo=reviewed-example";
const indexHtml = `<main id="main-content"><a href="${laterUrl}">BOE_2028_1117_Notice Agenda Packet</a><a href="${publicationUrl}">BOE_2028_1020_Notice Agenda Packet (PDF, 11MB)</a></main>`;
const memo = `BOE 2028-24
OFFICE OF BOARDS & COMMISSIONS
ELLEN EXAMPLE, ADMINISTRATOR
MEMORANDUM
DATE: July 9, 2028
TO: Board of Ethics
FROM: Jane Example, Administrative Assistant
RE: 2028 Candidate Disclosure
Following is a list of 2028 Candidates for Mayor and County Council with the dates of disclosure
received:
Mayoral Candidates:
Kaʻimi Example, Jr. – 2/13/28
Bernard Carvahlo, Jr. – 2/17/28
County Council Candidates:
Jordan (Jay) Example – 3/30/28, updated 5/01/28
Fern Example - 5/13/28
4444 Rice Street, Suite 300 • Līhu‘e, Hawai‘i 96766 • (808) 241-4917 (b) • boardsandcommissions@kauai.gov
An Equal Opportunity Employer`;
const packet = `Board of Ethics October 20, 2028\fUnrelated employee financial disclosure. Staff contact: staff@example.test. Asset value $900,000. Form glyph \u001E.\f${memo}\f`;

async function fixture(context: TestContext) {
	const directory = await realpath(await mkdtemp(join(tmpdir(), "kauai-disclosure-")));
	context.after(() => rm(directory, { recursive: true, force: true }));
	const publication = Buffer.from("%PDF-1.7\nSynthetic fixture: extraction is injected.");
	const index = Buffer.from(indexHtml);
	const plan = {
		schemaVersion: 1,
		type: "kauai-disclosure-research-preparation",
		publication: { path: join(directory, "packet.pdf"), sha256: kauaiDisclosureHash(publication), url: publicationUrl, capturedAt: clock },
		index: { path: join(directory, "index.html"), sha256: kauaiDisclosureHash(index), url: kauaiEthicsIndexUrl, capturedAt: clock },
		outputDirectory: join(directory, "prepared"),
	};
	await writeFile(plan.publication.path, publication);
	await writeFile(plan.index.path, index);
	const planPath = join(directory, "plan.json");
	const save = () => writeFile(planPath, JSON.stringify(plan));
	await save();
	const options = { now: Date.parse(clock), extract: async (body: Buffer) => {
		assert.deepEqual(body, publication);
		return packet;
	} };
	return { directory, plan, planPath, save, options };
}

test("Kauai research separates disclosure receipt and update dates from election qualification", () => {
	const report = readKauaiCandidateDisclosures(packet, "2028-10-20");
	assert.equal(report.cycleYear, year);
	assert.equal(report.reportDate, "2028-07-09");
	assert.equal(report.memoId, "BOE 2028-24");
	assert.equal(report.sourcePage, 3);
	assert.equal(report.packetPages, 3);
	assert.equal(report.records.length, 4);
	assert.deepEqual(report.records.map(record => record.office), ["Mayor", "Mayor", "County Council", "County Council"]);
	assert.equal(report.records[0]!.name, "Kaʻimi Example, Jr.");
	assert.equal(report.records[1]!.name, "Bernard Carvahlo, Jr.");
	assert.equal(report.records[2]!.disclosureReceived, "2028-03-30");
	assert.equal(report.records[2]!.disclosureUpdated, "2028-05-01");
	assert.equal(report.records[3]!.disclosureUpdated, null);
	for (const record of report.records) {
		assert.deepEqual(Object.keys(record).sort(), ["disclosureReceived", "disclosureUpdated", "id", "name", "office", "sourcePage"]);
		assert.match(record.id, /^[a-f\d]{24}$/u);
	}
	assert.doesNotMatch(JSON.stringify(report), /staff@example|900,000|ELLEN|Jane Example/u);
});

test("Kauai recurring preparation follows explicit later cycle years without inventing an election day", () => {
	const report = readKauaiCandidateDisclosures(packet.replaceAll("2028", "2032").replaceAll("/28", "/32"), "2032-10-20");
	assert.equal(report.cycleYear, 2032);
	assert.equal(report.records[0]!.disclosureReceived, "2032-02-13");
	assert.equal("electionDate" in report, false);
	assert.notEqual(report.records[0]!.id, readKauaiCandidateDisclosures(packet, "2028-10-20").records[0]!.id);
});

for (const [label, before, after] of [
	["invalid receipt day", "2/13/28", "2/30/28"],
	["future disclosure", "2/13/28", "8/13/28"],
	["wrong disclosure year", "2/13/28", "2/13/26"],
	["update before receipt", "updated 5/01/28", "updated 2/01/28"],
	["repeated person", "Fern Example", "Jordan (Jay) Example"],
	["unknown office", "County Council Candidates:", "County Treasurer Candidates:"],
	["missing footer", "An Equal Opportunity Employer", ""],
	["unreviewed footer", "An Equal Opportunity Employer", "An Equal Opportunity Employer\nExtra records"],
	["unknown row text", "Fern Example - 5/13/28", "Fern Example - filed for the general election"],
	["wrong report year", "DATE: July 9, 2028", "DATE: July 9, 2026"],
	["report after packet", "DATE: July 9, 2028", "DATE: December 9, 2028"],
	["different cover date", "October 20, 2028", "October 21, 2028"],
	["unsupported control", "Fern Example", "Fern\u0000Example"],
] as const) {
	test(`Kauai holds ${label} for review`, () => assert.throws(() => readKauaiCandidateDisclosures(packet.replace(before, after), "2028-10-20"), /requires review/u));
}

test("Kauai holds ambiguous same-date memoranda and bounds native extraction", () => {
	assert.throws(() => readKauaiCandidateDisclosures(`${packet}${memo}\f`, "2028-10-20"), /requires review/u);
	assert.throws(() => readKauaiCandidateDisclosures(`${packet}${"\f".repeat(101)}`, "2028-10-20"), /requires review/u);
	assert.throws(() => readKauaiCandidateDisclosures("a".repeat(kauaiDisclosurePdfProfile.maximumTextBytes + 1), "2028-10-20"), /requires review/u);
	assert.throws(() => readKauaiCandidateDisclosures(packet, "2028-02-30"), /requires review/u);
	const previous = memo.replace("DATE: July 9, 2028", "DATE: July 8, 2028");
	assert.equal(readKauaiCandidateDisclosures(`${packet}${previous}\f`, "2028-10-20").reportDate, "2028-07-09");
});

test("Kauai agenda binding preserves newer external publications without treating an older PDF as latest", () => {
	const result = readKauaiDisclosureIndex(indexHtml, publicationUrl);
	assert.deepEqual(result.publication, { url: publicationUrl, meetingDate: "2028-10-20" });
	assert.deepEqual(result.newerOfferedPublications, [{ label: "BOE_2028_1117_Notice Agenda Packet", url: laterUrl, meetingDate: "2028-11-17" }]);
	assert.deepEqual(readKauaiDisclosureIndex(indexHtml.replace(publicationUrl, new URL(publicationUrl).pathname), publicationUrl), result);
});

test("Kauai holds changed agenda identity, unsafe URLs and unoffered documents", () => {
	for (const url of [publicationUrl.replace("www.kauai.gov", "other.example"), `${publicationUrl}?download=1`, `${publicationUrl}#page=3`, publicationUrl.replace("1020", "0230"), publicationUrl.replace("/v/1/", "/v/100/")]) assert.throws(() => kauaiDisclosurePublication(url));
	for (const body of [indexHtml.replace("BOE_2028_1020", "BOE_2028_1021"), indexHtml.replace(publicationUrl, publicationUrl.replace("1020", "1021")), `${indexHtml}${indexHtml}`, indexHtml.replace(laterUrl, "http://unreviewed.example/agenda"), indexHtml.replace(laterUrl, "https://user:secret@example.test/agenda"), indexHtml.replace("</main>", `<a href="${publicationUrl}">BOE_2028_1020_Notice Agenda Packet</a></main>`), "a".repeat(3 * 1024 * 1024 + 1)]) assert.throws(() => readKauaiDisclosureIndex(body, publicationUrl));
});

test("Kauai preparation exports only research facts and repeatable CSV with original provenance", async (context) => {
	const input = await fixture(context);
	const original = await readFile(input.plan.publication.path);
	const result = await prepareKauaiDisclosures(input.planPath, input.options);
	assert.equal(result.records, 4);
	assert.equal(result.imported, false);
	assert.equal(result.automaticImportApproved, false);
	const json = await readFile(join(result.outputDirectory, "kauai-disclosures.json"), "utf8");
	const csv = await readFile(join(result.outputDirectory, "kauai-disclosures.csv"), "utf8");
	const facts = JSON.parse(json);
	assert.equal(facts.type, "kauai-candidate-disclosure-research");
	assert.equal(facts.publication.capturedAt, clock);
	assert.equal(facts.publication.sha256, input.plan.publication.sha256);
	assert.equal(facts.packetMeetingDate, "2028-10-20");
	assert.equal(facts.latestPublicationVerified, false);
	assert.equal(facts.ballotQualificationVerified, false);
	assert.equal(facts.publicationApproved, false);
	assert.equal(facts.newerOfferedPublications[0].url, laterUrl);
	assert.doesNotMatch(json, /staff@example|900,000|electionDate|"party"|"status"|"path"/u);
	assert.match(csv, /"Kaʻimi Example, Jr\."/u);
	assert.match(csv, /#page=3/u);
	assert.equal(csv.trim().split("\n").length, 5);
	const candidateSource = configuredStateBallotSources.find(source => source.stateCode === "HI")!;
	assert.throws(() => parseBundledStateSnapshot(candidateSource, json, "automatic"));
	await assert.rejects(prepareKauaiDisclosures(input.planPath, input.options), /EEXIST/u);
	input.plan.outputDirectory = join(input.directory, "repeat");
	await input.save();
	await prepareKauaiDisclosures(input.planPath, { ...input.options, now: Date.parse(clock) + 86400000 });
	assert.equal(await readFile(join(input.plan.outputDirectory, "kauai-disclosures.json"), "utf8"), json);
	assert.equal(await readFile(join(input.plan.outputDirectory, "kauai-disclosures.csv"), "utf8"), csv);
	assert.deepEqual(await readFile(input.plan.publication.path), original);
	assert.equal((await stat(input.plan.outputDirectory)).mode & 0o777, 0o700);
	assert.equal((await stat(join(input.plan.outputDirectory, "kauai-disclosures.csv"))).mode & 0o777, 0o600);
});

for (const kind of ["publication", "index"] as const) {
	test(`Kauai preparation rejects changed ${kind} before creating output`, async (context) => {
		const input = await fixture(context);
		await writeFile(input.plan[kind].path, "changed");
		await assert.rejects(prepareKauaiDisclosures(input.planPath, input.options), /input bytes changed/u);
		await assert.rejects(access(input.plan.outputDirectory), /ENOENT/u);
	});
}

test("Kauai preparation validates schema, capture clocks, original paths and output ownership", async (context) => {
	const input = await fixture(context);
	const original = structuredClone(input.plan);
	for (const change of [
		() => { input.plan.publication.capturedAt = "2030-01-01T00:00:00.000Z"; },
		() => { input.plan.publication.capturedAt = "2028-01-01T00:00:00.000Z"; },
		() => { input.plan.index.capturedAt = "2028-01-01T00:00:00.000Z"; },
		() => { input.plan.index.capturedAt = "2028-11-01"; },
		() => { input.plan.publication.path = "relative.pdf"; },
		() => { input.plan.index.url = "https://www.kauai.gov/other"; },
		() => { input.plan.outputDirectory = resolve("src/kauai-prepared"); },
	]) {
		change();
		await input.save();
		await assert.rejects(prepareKauaiDisclosures(input.planPath, input.options));
		Object.assign(input.plan, structuredClone(original));
	}
	await writeFile(input.planPath, JSON.stringify({ ...input.plan, execute: "unreviewed" }));
	await assert.rejects(prepareKauaiDisclosures(input.planPath, input.options), /pinned/u);
	await input.save();
	await assert.rejects(prepareKauaiDisclosures(input.planPath, { ...input.options, extract: async () => {
		throw new Error("Native extraction failed.");
	} }), /Native extraction failed/u);
	await assert.rejects(access(input.plan.outputDirectory), /ENOENT/u);
	await symlink(input.plan.publication.path, join(input.directory, "linked.pdf"));
	input.plan.publication.path = join(input.directory, "linked.pdf");
	await input.save();
	await assert.rejects(prepareKauaiDisclosures(input.planPath, input.options));
	Object.assign(input.plan, structuredClone(original));
	await mkdir(join(input.directory, "physical"));
	await symlink(join(input.directory, "physical"), join(input.directory, "alias"));
	input.plan.outputDirectory = join(input.directory, "alias", "prepared");
	await input.save();
	await assert.rejects(prepareKauaiDisclosures(input.planPath, input.options), /physical output/u);
});
