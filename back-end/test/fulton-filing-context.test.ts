import type { StateBallotSnapshot } from "../src/state-ballot-repository.js";
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { matchingCandidateReferences } from "../src/candidate-reference-matching.js";
import { electionReferenceSources } from "../src/election-reference-sources.js";
import { parseElectionReferenceSnapshot } from "../src/election-references.js";
import { fultonFilingDocuments, fultonFilingReferenceSource, parseFultonFilingOccupations, prepareFultonFilingContext } from "../src/fulton-filing-context.js";
import { prepareFultonFilingFiles } from "../src/prepare-fulton-filings.js";
import { configuredStateBallotSources } from "../src/state-ballot-registry.js";
import { serializeStoredStateSnapshot } from "../src/state-ballot-storage.js";

const hash = (body: string | Uint8Array) => createHash("sha256").update(body).digest("hex");
const capturedAt = "2026-11-02T12:00:00.000Z";
const now = Date.parse(capturedAt);
const names = ["Example Soil Candidate", "Karen Rene", "Aaron A. Sampson Jr"];
const row = (name: string, occupation = "Analyst", qualified = "3/2/2026") => `${name}    Nonpartisan    ${occupation}    No    Fulton County    ${qualified}`;
function text(index: number, rows: string[], election = "NOVEMBER 3, 2026") {
	return `LIST OF QUALIFIED CANDIDATES ${index ? "5/2/2026" : "3/7/2026"}\n${index ? "FULTON COUNTY BOARD OF COMMISSIONER DISTRICT 4 SPECIAL ELECTION" : "Georgia Soil & Water Conservation District Supervisor GENERAL/SPECIAL ELECTION"}\n${election}\nCANDIDATE    PARTY    OCCUPATION    INCUMBENT    QUALIFIED BY\nDATE QUALIFIED\n${rows.join("\n\n")}\nPage 1 of 1\n\f`;
}
function fixture() {
	const source = configuredStateBallotSources.find(source => source.id === "ga-fulton-2026")!;
	const records: StateBallotSnapshot["records"] = names.map((name, index) => ({ id: hash(name).slice(0, 24), name, office: fultonFilingDocuments[index ? 1 : 0]!.office, district: index ? "4" : "", scope: "local", status: "listed", party: "Original party" }));
	const documents = source.documentUrls!.map((url, index) => ({ url, sha256: hash(url), retrievedAt: capturedAt, includedRecordCount: index ? 0 : records.length }));
	const candidates: StateBallotSnapshot = { source, sha256: hash(JSON.stringify(documents.map(({ url, sha256 }) => ({ url, sha256 })))), retrievedAt: capturedAt, records, documents };
	return { candidates, now, documents: [text(0, [row(names[0]!)]), text(1, [row("Karen Rene'", "Manager", "4/29/2026"), row("Aaron A. Sampson, Jr.", "Director", "5/1/2026")])].map((text, index) => ({ text, sha256: hash(String(index)), capturedAt })), bindings: names.map((name, index) => ({ documentIndex: index ? 1 : 0, name: index === 1 ? "Karen Rene'" : index === 2 ? "Aaron A. Sampson, Jr." : name, recordId: hash(name).slice(0, 24) })) };
}

test("filing context exposes only dated occupation facts with exact candidate bindings", () => {
	const input = fixture();
	const original = JSON.stringify(input.candidates);
	const snapshot = prepareFultonFilingContext(input);
	parseElectionReferenceSnapshot(fultonFilingReferenceSource, JSON.stringify(snapshot), now);
	assert.equal(snapshot.recordCount, 3);
	assert.equal(snapshot.records[0]!.facts[0], "Reported occupation: Analyst (2026-03-07 filing list).");
	for (const record of snapshot.records) {
		const candidate = input.candidates.records.find(candidate => candidate.id === record.officialCandidate!.recordId)!;
		const linked = matchingCandidateReferences(input.candidates, candidate, [snapshot]);
		assert.equal(linked.length, 1);
		assert.equal(linked[0]!.source.kind, "public-dataset");
		assert.equal("officialCandidate" in linked[0]!, false);
		assert.equal("party" in record, false);
		assert.equal("incumbent" in record, false);
	}
	assert.equal(JSON.stringify(input.candidates), original);
});

test("the parser is election-parameterized without guessing future candidates or URLs", () => {
	const body = text(0, [row("Example Candidate")], "NOVEMBER 7, 2028");
	assert.equal(parseFultonFilingOccupations(body, fultonFilingDocuments[0], "2028-11-07")[0]!.occupation, "Analyst");
	assert.throws(() => parseFultonFilingOccupations(body, fultonFilingDocuments[0], "2026-11-03"), /election/u);
});

test("primary, foreign office, changed publication, page count and malformed table data hold", () => {
	const body = fixture().documents[0]!.text;
	for (const changed of [body.replace("GENERAL/SPECIAL ELECTION", "PRIMARY"), body.replace("NOVEMBER 3", "NOVEMBER 4"), body.replace("3/7/2026", "3/8/2026"), body.replace("Conservation District Supervisor", "Other Office"), body.replace("OCCUPATION", "ADDRESS"), `${body}second page\f`, body.replace("Analyst", "contact@example.test"), body.replace("3/2/2026", "4/1/2026"), body.replace("No    Fulton", "Unknown    Fulton"), body.replace("Page 1 of 1", "Page 1 of 2"), body.replace("Analyst", "Analyst\nunknown row"), body + "x".repeat(256 * 1024)]) assert.throws(() => parseFultonFilingOccupations(changed, fultonFilingDocuments[0], "2026-11-03"));
});

test("missing, duplicate, mismatched and inactive candidate mappings hold", () => {
	for (const mutate of [
		(input: ReturnType<typeof fixture>) => { input.bindings.pop(); },
		(input: ReturnType<typeof fixture>) => { input.bindings[1]!.recordId = input.bindings[2]!.recordId; },
		(input: ReturnType<typeof fixture>) => { input.candidates.records[0]!.name = "Someone Else"; },
		(input: ReturnType<typeof fixture>) => { input.candidates.records[0]!.office = "County Commission Chairperson"; },
		(input: ReturnType<typeof fixture>) => { input.candidates.records[0]!.status = "withdrawn"; },
		(input: ReturnType<typeof fixture>) => { input.candidates.records.push({ ...input.candidates.records[0]!, id: hash("duplicate").slice(0, 24) }); },
		(input: ReturnType<typeof fixture>) => { input.documents[0]!.capturedAt = "2026-11-04T00:00:00Z"; },
	]) {
		const input = fixture();
		mutate(input);
		assert.throws(() => prepareFultonFilingContext(input));
	}
});

test("unreviewed public datasets cannot introduce exact candidate bindings", () => {
	const snapshot = prepareFultonFilingContext(fixture());
	assert.throws(() => parseElectionReferenceSnapshot({ ...fultonFilingReferenceSource, allowOfficialCandidateBindings: undefined }, JSON.stringify(snapshot), now), /binding/u);
	assert(electionReferenceSources.includes(fultonFilingReferenceSource));
});

test("file preparation verifies original bytes, preserves official inputs and refuses overwrite", async (context) => {
	const directory = await realpath(await mkdtemp(join(tmpdir(), "fulton-filing-test-")));
	context.after(() => rm(directory, { recursive: true, force: true }));
	const input = fixture();
	const candidateFile = join(directory, "candidates.json");
	const original = serializeStoredStateSnapshot(input.candidates);
	await writeFile(candidateFile, original);
	const bodies = [Buffer.from("%PDF-first"), Buffer.from("%PDF-second")];
	const documents = await Promise.all(bodies.map(async (body, index) => {
		const path = join(directory, `document-${index}.pdf`);
		await writeFile(path, body);
		return { path, url: fultonFilingDocuments[index]!.url, sha256: hash(body), capturedAt };
	}));
	const plan = { schemaVersion: 1, type: "fulton-filing-context-preparation", reviewedAt: capturedAt, candidateFile, documents, bindings: input.bindings, outputDirectory: join(directory, "prepared") };
	const path = join(directory, "review.json");
	await writeFile(path, JSON.stringify(plan));
	const extractor = async (body: Buffer) => input.documents[bodies.findIndex(value => value.equals(body))]!.text;
	const result = await prepareFultonFilingFiles(path, now, false, extractor);
	assert.equal(result.recordCount, 3);
	assert.equal(result.imported, false);
	assert.equal(result.publisherRequests, 0);
	assert.equal(await readFile(candidateFile, "utf8"), original);
	await assert.rejects(prepareFultonFilingFiles(path, now, false, extractor), /EEXIST/u);
	await assert.rejects(prepareFultonFilingFiles(path, now + 31 * 86400000, false, extractor), /review/u);
	await writeFile(documents[0]!.path, "%PDF-altered");
	await assert.rejects(prepareFultonFilingFiles(path, now, true, extractor), /bytes/u);
});
