import type { TestContext } from "node:test";
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { parseVirginiaElectionTable, prepareVirginiaElectionReview } from "../src/virginia-election-review.js";

const epoch = Date.parse("2026-10-23T12:00:00Z");
const candidateHeaders = ["Locality", "Office Ballot Order", "Party Ballot Order", "Office Title", "District", "Number of Seats", "Office Term", "Special Office Unexpired Term End Date", "Candidate Party", "Candidate Name", "Incumbent", "Campaign Email", "Campaign Website", "Campaign Phone", "Campaign Address Line 1", "Campaign Address Line 2", "Campaign City", "Campaign State", "Campaign Zip"];
const referendumHeaders = ["Locality", "Active", "Referendum Ballot Order", "Referendum Area", "Referendum Title", "Referendum Text"];
const candidate = ["FLOYD COUNTY", "1", "1", "Member Town Council - Special", "At Large", "2", "Unexpired", "12/31/2027", "", "Alex Example", "No", "CONTACT-OMITTED", "=FORMULA-FIXTURE", "CONTACT-OMITTED", "ADDRESS-OMITTED", "", "", "", ""];
const question = ["FLOYD COUNTY", "Yes", "31", "Locality", "School capital sales tax", "Should the county be authorized to levy the proposed tax for school capital projects?"];
function page(kind: "candidates" | "referendums", rows: string[][]) {
	const title = kind === "candidates" ? "November 3, 2026 - All Offices" : "November 2026 Proposed Constitutional Amendments and Local Referenda";
	return Buffer.from(`<main><h1>${title}</h1><table><tr>${(kind === "candidates" ? candidateHeaders : referendumHeaders).map(value => `<th>${value}</th>`).join("")}</tr>${rows.map(row => `<tr>${row.map(value => `<td>${value}</td>`).join("")}</tr>`).join("")}</table></main>`);
}
const hash = (body: string | Uint8Array) => createHash("sha256").update(body).digest("hex");

async function fixture(context: TestContext) {
	const directory = await mkdtemp(join(tmpdir(), "virginia-election-test-"));
	context.after(() => rm(directory, { recursive: true, force: true }));
	const documents = [];
	for (const kind of ["candidates", "referendums"] as const) {
		const body = page(kind, [kind === "candidates" ? candidate : question]);
		const path = join(directory, `${kind}.html`);
		await writeFile(path, body);
		documents.push({ kind, path, url: `https://www.elections.virginia.gov/casting-a-ballot/candidate-list/${kind === "candidates" ? "november-3-2026-gen-elect-all-offices" : "november-2026-proposed-constitutional-amendments"}/`, sha256: hash(body), capturedAt: new Date(epoch - 1000).toISOString(), expectedRows: 1, expectedTrailingZipOmissions: 0 });
	}
	const plan = { schemaVersion: 1, type: "virginia-election-review-preparation", electionDate: "2026-11-03", documents, outputDirectory: join(directory, "output"), outputName: "virginia-2026" };
	const path = join(directory, "plan.json");
	await writeFile(path, JSON.stringify(plan));
	return { directory, plan, path };
}

test("candidate publication occurrences keep locality, labels and term details without exposing contact/address fields", () => {
	const rows = parseVirginiaElectionTable(page("candidates", [candidate, ["ROANOKE CITY", ...candidate.slice(1)]]), { electionDate: "2026-11-03", kind: "candidates", expectedRows: 2 });
	assert.equal(rows.length, 2);
	assert.deepEqual(rows.map(row => row.locality), ["FLOYD COUNTY", "ROANOKE CITY"]);
	assert.ok(rows.every(row => row.identityReconciliationApproved === false && row.personalBallotAssignment === false));
	assert.match(JSON.stringify(rows), /At Large/u);
	assert.match(JSON.stringify(rows), /12\/31\/2027/u);
	assert.doesNotMatch(JSON.stringify(rows), /CONTACT-OMITTED|ADDRESS-OMITTED/u);
});

test("referendum active status is not a vote option and district scope is never promoted to statewide", () => {
	const rows = parseVirginiaElectionTable(page("referendums", [question, ["FLOYD COUNTY", "No", "32", "District", "District question", question[5]!]]), { electionDate: "2026-11-03", kind: "referendums", expectedRows: 2 });
	assert.equal(rows[1]!.personalBallotAssignment, false);
	assert.match(JSON.stringify(rows[1]), /"activeAsPublished":"No"/u);
	assert.match(JSON.stringify(rows[1]), /"areaAsPublished":"District"/u);
	assert.ok(rows.every(row => "ballotOptionsInferred" in row && row.ballotOptionsInferred === false));
	assert.doesNotMatch(JSON.stringify(rows), /"ballotOptions":/u);
});

test("wrong elections, headers, duplicate main regions, truncated and paginated tables fail", () => {
	const body = page("referendums", [question]).toString();
	for (const changed of [body.replace("2026", "2024"), body.replace("Referendum Text", "Question Body"), body.replace("</main>", "</main><main>Other</main>"), body.replace("<td>", "<td><input>"), body.replace("<table>", "<table class=\"pagination\">"), body.replace("<h1>", "<h1>Other</h1><h1>")]) assert.throws(() => parseVirginiaElectionTable(Buffer.from(changed), { electionDate: "2026-11-03", kind: "referendums", expectedRows: 1 }));
	assert.throws(() => parseVirginiaElectionTable(Buffer.from(body), { electionDate: "2026-11-03", kind: "referendums", expectedRows: 2 }));
});

test("only the reviewed count of omitted final postal-code cells is accepted", () => {
	const body = page("candidates", [candidate.slice(0, 18)]);
	assert.throws(() => parseVirginiaElectionTable(body, { electionDate: "2026-11-03", kind: "candidates", expectedRows: 1 }));
	const rows = parseVirginiaElectionTable(body, { electionDate: "2026-11-03", kind: "candidates", expectedRows: 1, expectedTrailingZipOmissions: 1 });
	assert.match(JSON.stringify(rows), /"trailingPostalCodeCellOmitted":true/u);
	assert.throws(() => parseVirginiaElectionTable(page("candidates", [candidate.slice(0, 17)]), { electionDate: "2026-11-03", kind: "candidates", expectedRows: 1, expectedTrailingZipOmissions: 1 }));
});

test("ambiguous locality/status, invalid dates and unbounded publication input fail", () => {
	for (const row of [["", ...question.slice(1)], [question[0]!, "Maybe", ...question.slice(2)], [question[0]!, question[1]!, question[2]!, "Statewide", ...question.slice(4)]]) assert.throws(() => parseVirginiaElectionTable(page("referendums", [row]), { electionDate: "2026-11-03", kind: "referendums", expectedRows: 1 }));
	assert.throws(() => parseVirginiaElectionTable(Buffer.from([255]), { electionDate: "2026-11-03", kind: "referendums", expectedRows: 1 }));
	assert.throws(() => parseVirginiaElectionTable(Buffer.alloc(2 * 1024 * 1024 + 1), { electionDate: "2026-11-03", kind: "referendums", expectedRows: 1 }));
	assert.throws(() => parseVirginiaElectionTable(page("referendums", [question]), { electionDate: "2026-02-30", kind: "referendums", expectedRows: 1 }));
	assert.throws(() => parseVirginiaElectionTable(page("referendums", [question]), { electionDate: "2026-11-03", kind: "referendums", expectedRows: 5001 }));
});

test("offline preparation retains source hashes/times, escapes CSV formulas and emits no approvals", async (context) => {
	const input = await fixture(context);
	const result = await prepareVirginiaElectionReview(input.path, epoch);
	assert.equal(result.files, 6);
	assert.equal(result.publisherRequests, 0);
	assert.equal(result.imported, false);
	const jsonl = await readFile(join(input.plan.outputDirectory, "virginia-2026-candidates.jsonl"), "utf8");
	const rows = jsonl.trim().split("\n").map(row => JSON.parse(row));
	assert.equal(rows[1].campaignWebsiteAsPublished, "=FORMULA-FIXTURE");
	assert.equal(rows[1].capturedAt, input.plan.documents[0]!.capturedAt);
	assert.equal(rows[1].sourceSha256, input.plan.documents[0]!.sha256);
	assert.equal(rows[1].publicationApproved, false);
	assert.equal(rows[1].publicationDate, null);
	assert.match(await readFile(join(input.plan.outputDirectory, "virginia-2026-candidates.csv"), "utf8"), /'=FORMULA-FIXTURE/u);
	assert.doesNotMatch(jsonl, /CONTACT-OMITTED|ADDRESS-OMITTED/u);
	await assert.rejects(prepareVirginiaElectionReview(input.path, epoch), /EEXIST/u);
});

test("changed capture bindings, unknown plan fields and duplicate publication kinds fail", async (context) => {
	const input = await fixture(context);
	for (const changed of [
		{ ...input.plan, extra: true },
		{ ...input.plan, documents: [input.plan.documents[0], input.plan.documents[0]] },
		{ ...input.plan, documents: input.plan.documents.map(document => ({ ...document, sha256: "a".repeat(64) })) },
		{ ...input.plan, documents: input.plan.documents.map(document => ({ ...document, capturedAt: new Date(epoch + 1).toISOString() })) },
		{ ...input.plan, documents: input.plan.documents.map(document => ({ ...document, url: document.url.replace("2026", "2024") })) },
	]) {
		await writeFile(input.path, JSON.stringify(changed));
		await assert.rejects(prepareVirginiaElectionReview(input.path, epoch));
	}
});

test("linked captures and in-checkout output paths fail without weakening external-data checks", async (context) => {
	const input = await fixture(context);
	const link = join(input.directory, "linked.html");
	await symlink(input.plan.documents[0]!.path, link);
	await writeFile(input.path, JSON.stringify({ ...input.plan, documents: [{ ...input.plan.documents[0], path: link }, input.plan.documents[1]] }));
	await assert.rejects(prepareVirginiaElectionReview(input.path, epoch));
	await writeFile(input.path, JSON.stringify({ ...input.plan, outputDirectory: fileURLToPath(new URL("../data/unsafe-review", import.meta.url)) }));
	await assert.rejects(prepareVirginiaElectionReview(input.path, epoch), /outside the application/u);
});

test("source CLI rejects missing and extra arguments before processing a capture", () => {
	const entry = fileURLToPath(new URL("../src/prepare-virginia-elections.ts", import.meta.url));
	for (const args of [[], ["missing-plan", "unexpected"]]) {
		const result = spawnSync(process.execPath, ["--import", "tsx", entry, ...args], { encoding: "utf8", timeout: 10_000 });
		assert.equal(result.status, 1);
		assert.match(result.stderr, /Provide one Virginia election review plan/u);
	}
});
