import type { ElectionReferenceSnapshot } from "../src/election-references.js";
import type { StateBallotSnapshot } from "../src/state-ballot-repository.js";
import type { ReviewedWashingtonFact } from "../src/washington-statements.js";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { electionReferenceSources } from "../src/election-reference-sources.js";
import { parseElectionReferenceSnapshot } from "../src/election-references.js";
import { prepareWashingtonStatementFiles } from "../src/prepare-washington-statements.js";
import { configuredStateBallotSources } from "../src/state-ballot-registry.js";
import { serializeStoredStateSnapshot } from "../src/state-ballot-storage.js";
import { parseWashingtonStatementSections, prepareWashingtonStatements } from "../src/washington-statements.js";

const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const capturedAt = "2026-10-22T12:00:00.000Z";
const source = electionReferenceSources.find(item => item.id === "wa-ld1-statements-2026")!;
const candidateSource = configuredStateBallotSources.find(item => item.id === "wa-general-2026")!;
const statementHtml = "<b>Elected Experience</b><br>Example city council, 2012–2018.<strong>Education</strong><p>Studied history at Example College.</p><b>Statement</b><p>Vote for this campaign.</p><b>Education</b>Invented later degree.";

test("the additive Washington collection pins observed races without changing preceding sources", () => {
	const configured = electionReferenceSources.find(item => item.id === "wa-state-statements-2026")!;
	assert.equal(configured.documents.length, 125);
	assert.equal(configured.stateCode, "WA");
	assert.equal(configured.electionDate, "2026-11-03");
	assert.equal(configured.allowIdentityOnly, undefined);
	const races = configured.documents.map((document) => {
		const url = new URL(document.url);
		assert.equal(url.origin, "https://voter.votewa.gov");
		assert.equal(url.pathname, "/elections/candidate.ashx");
		assert.deepEqual([...url.searchParams].filter(([key]) => key !== "r"), [["e", "899"], ["b", "0"], ["la", "en"], ["c", ""]]);
		assert.equal(document.kind, "candidate-statement");
		assert.equal(document.publishedDate, undefined);
		return url.searchParams.get("r");
	});
	assert.equal(new Set(races).size, 125);
	assert.ok(!races.includes("186957") && !races.includes("186958"));
	assert.ok(configured.documents.every(document => !document.title.includes("Supreme Court · Supreme Court")));
	assert.equal(hash(JSON.stringify(source)), "cec63e9c2563e14e24d5d1b5c0222b78af4333bdd2253c251cb520405b697aa7");
	assert.equal(hash(JSON.stringify(electionReferenceSources.find(item => item.id === "wa-congressional-statements-2026"))), "4c7b34ac8de621765e061ead1fa8563235c3b4f890f0c3cb37521cb95a85e729");
});

function fixture() {
	const candidates: StateBallotSnapshot = { source: candidateSource, retrievedAt: capturedAt, sha256: hash("candidate roster"), records: source.documents.map((document, index) => ({ id: hash(`candidate-${index}`).slice(0, 24), sourceCandidateId: `${new URL(document.url).searchParams.get("r")}/${100 + index}`, name: `Example Candidate ${index}`, office: `State Representative Pos. ${index + 1}`, scope: "state-house", district: "1", sourceDistrictLabel: "Legislative District 1", status: "filed" })) };
	const documents = source.documents.map((document, index) => {
		const url = new URL(document.url);
		const body = JSON.stringify([{ statement: { BallotID: 100 + index, ElectionID: url.searchParams.get("e"), RaceID: url.searchParams.get("r"), BallotName: candidates.records[index]!.name, RaceName: candidates.records[index]!.office, RaceJurisdictionName: "LEGISLATIVE DISTRICT 1", CountyCode: "", Statement: statementHtml, Photo: "excluded-image-bytes", Email: "excluded-contact@example.invalid", IsApprovedForPost: false } }]);
		return { url: document.url, body, sha256: hash(body), capturedAt };
	});
	const facts: ReviewedWashingtonFact[] = candidates.records.map(candidate => ({ sourceCandidateId: candidate.sourceCandidateId!, statementSha256: hash(statementHtml), field: "Education", evidence: "Studied history at Example College.", text: "Studied history at Example College; no degree is specified." }));
	return { source, candidates, previous: [] as ElectionReferenceSnapshot[], documents, facts };
}

test("Washington sections preserve factual boundaries without consuming the campaign statement", () => {
	assert.deepEqual(parseWashingtonStatementSections(statementHtml), { "Elected Experience": "Example city council, 2012–2018.", "Education": "Studied history at Example College." });
	assert.deepEqual(parseWashingtonStatementSections("<strong><span>Education:</span></strong><div>B.A.&nbsp;in <em>history</em>.<br>Example University.</div><b>Unknown section</b>Not education."), { Education: "B.A. in history. Example University." });
	assert.deepEqual(parseWashingtonStatementSections("<p>No labeled factual section.</p><b>Statement</b><p>Campaign assertions.</p>"), {});
	assert.deepEqual(parseWashingtonStatementSections("<b>Education</b><script>bad()</script><style>hidden</style><span hidden>private</span><span aria-hidden='true'>hidden</span>Actual study.<b>Statement</b>End."), { Education: "Actual study." });
	assert.throws(() => parseWashingtonStatementSections("<b>Education</b>First.<strong>Education</strong>Second."), /repeats/u);
	assert.throws(() => parseWashingtonStatementSections("a".repeat(128 * 1024 + 1)), /size limit/u);
	assert.throws(() => parseWashingtonStatementSections(`<b>Education</b>${"a".repeat(8001)}`), /invalid text/u);
	assert.throws(() => parseWashingtonStatementSections(`<b>Education${"<span>".repeat(1000)}Nested${"</span>".repeat(1000)}</b>`), /structural bounds/u);
});

test("reviewed Washington preparation binds exact identities, evidence, hashes and configured documents", () => {
	const input = fixture();
	const result = prepareWashingtonStatements(input);
	assert.equal(result.snapshot.recordCount, 2);
	assert.equal(result.identities.length, 2);
	assert.deepEqual(result.holds, []);
	assert.deepEqual(result.snapshot.records.map(record => record.facts), input.facts.map(fact => [fact.text]));
	assert.deepEqual(parseElectionReferenceSnapshot(source, JSON.stringify(result.snapshot)), result.snapshot);
	assert.doesNotMatch(JSON.stringify(result), /excluded-image|excluded-contact|IsApprovedForPost|Vote for|Invented later/iu);
	assert.ok(result.snapshot.records.every(record => !("status" in record) && !("party" in record)));
});

test("Washington preparation holds unreviewed candidates rather than inventing facts", () => {
	const input = fixture();
	input.facts.pop();
	const result = prepareWashingtonStatements(input);
	assert.equal(result.snapshot.recordCount, 1);
	assert.equal(result.holds.length, 1);
	assert.equal(result.snapshot.documents[1]!.includedRecordCount, 0);
	assert.throws(() => prepareWashingtonStatements({ ...input, facts: [] }), /explicitly reviewed/u);
	const stale = fixture();
	stale.previous.push(prepareWashingtonStatements(stale).snapshot);
	assert.throws(() => prepareWashingtonStatements(stale), /already present/u);
});

test("statewide court profiles retain their office without repeating it as a jurisdiction", () => {
	const input = fixture();
	input.candidates.records[0] = { ...input.candidates.records[0]!, scope: "statewide", office: "Supreme Court - Justice Position #01", sourceDistrictLabel: "Supreme Court" };
	const entries = JSON.parse(input.documents[0]!.body);
	entries[0].statement.RaceName = "Justice Position #01";
	entries[0].statement.RaceJurisdictionName = "Supreme Court";
	input.documents[0]!.body = JSON.stringify(entries);
	input.documents[0]!.sha256 = hash(input.documents[0]!.body);
	const result = prepareWashingtonStatements(input);
	assert.equal(result.snapshot.records[0]!.office, "Supreme Court - Justice Position #01");
	assert.equal(result.snapshot.records[0]!.jurisdiction, undefined);
	assert.equal(result.snapshot.records[1]!.jurisdiction, "Legislative District 1");
	assert.throws(() => prepareWashingtonStatements({ ...input, previous: [result.snapshot] }), /already present/u);
});

test("Washington factual review rejects drift, unmatched evidence, duplicate facts and unknown fields", () => {
	for (const update of [
		(input: ReturnType<typeof fixture>) => { input.facts[0]!.statementSha256 = hash("changed statement"); },
		(input: ReturnType<typeof fixture>) => { input.facts[0]!.evidence = "Vote for this campaign."; },
		(input: ReturnType<typeof fixture>) => { input.facts[0]!.sourceCandidateId = "999999/999999"; },
		(input: ReturnType<typeof fixture>) => { input.facts.push(input.facts[0]!); },
		(input: ReturnType<typeof fixture>) => { Object.assign(input.facts[0]!, { extra: "unexpected" }); },
		(input: ReturnType<typeof fixture>) => { input.facts[0]!.text = "<b>Not plain text</b>"; },
	]) {
		const input = fixture();
		update(input);
		assert.throws(() => prepareWashingtonStatements(input));
	}
});

test("Washington preparation rejects altered public identities, private modes and mismatched captures", () => {
	const oversized = fixture();
	oversized.source = electionReferenceSources.find(item => item.id === "wa-state-statements-2026")!;
	const largeBody = " ".repeat(2 * 1024 * 1024);
	oversized.documents = oversized.source.documents.map(document => ({ url: document.url, body: largeBody, sha256: hash("not used"), capturedAt }));
	assert.throws(() => prepareWashingtonStatements(oversized), /combined size limit/u);
	for (const change of [
		(statement: Record<string, unknown>) => { statement.BallotName = "A different person"; },
		(statement: Record<string, unknown>) => { statement.RaceID = "1"; },
		(statement: Record<string, unknown>) => { statement.ElectionID = "1"; },
		(statement: Record<string, unknown>) => { statement.CountyCode = "17"; },
		(statement: Record<string, unknown>) => { statement.RaceName = "Other office"; },
		(statement: Record<string, unknown>) => { statement.RaceJurisdictionName = "Other district"; },
	]) {
		const input = fixture();
		const entries = JSON.parse(input.documents[0]!.body);
		change(entries[0].statement);
		input.documents[0]!.body = JSON.stringify(entries);
		input.documents[0]!.sha256 = hash(input.documents[0]!.body);
		assert.throws(() => prepareWashingtonStatements(input), /identity|office/u);
	}
	for (const update of [
		(input: ReturnType<typeof fixture>) => { input.documents[0]!.sha256 = hash("different bytes"); },
		(input: ReturnType<typeof fixture>) => { input.documents[0]!.capturedAt = "2100-01-01"; },
		(input: ReturnType<typeof fixture>) => { input.documents.reverse(); },
		(input: ReturnType<typeof fixture>) => { input.source = { ...source, electionDate: "2028-11-07" }; },
		(input: ReturnType<typeof fixture>) => { input.candidates.records.push({ ...input.candidates.records[0]!, id: hash("duplicate").slice(0, 24) }); },
		(input: ReturnType<typeof fixture>) => { input.candidates.source = { ...candidateSource, url: "https://voter.votewa.gov/CandidateList.aspx?e=900" }; },
		(input: ReturnType<typeof fixture>) => {
			input.source = { ...source, documents: source.documents.map(document => ({ ...document, url: `${document.url}&m=p` })) };
			input.documents.forEach((document, index) => {
				document.url = input.source.documents[index]!.url;
			});
		},
		(input: ReturnType<typeof fixture>) => {
			const entries = JSON.parse(input.documents[0]!.body);
			input.documents[0]!.body = JSON.stringify([...entries, ...entries]);
			input.documents[0]!.sha256 = hash(input.documents[0]!.body);
		},
	]) {
		const input = fixture();
		update(input);
		assert.throws(() => prepareWashingtonStatements(input));
	}
});

test("the local Washington plan prepares external snapshots without publisher requests or importing data", async () => {
	const directory = await mkdtemp(join(tmpdir(), "washington-statement-plan-"));
	const input = fixture();
	const originalFetch = globalThis.fetch;
	globalThis.fetch = async () => {
		throw new Error("Publisher requests are forbidden in local preparation.");
	};
	try {
		const candidateFile = join(directory, "candidate.json");
		await writeFile(candidateFile, serializeStoredStateSnapshot(input.candidates));
		const referenceFiles: string[] = [];
		for (const configured of electionReferenceSources.slice(0, electionReferenceSources.indexOf(source)).filter(item => item.stateCode === "WA" && item.electionDate === source.electionDate)) {
			const documents = configured.documents.map((document, index) => ({ url: document.url, capturedAt, sha256: hash(document.url), includedRecordCount: index === 0 ? 1 : 0 }));
			const snapshot: ElectionReferenceSnapshot = { schemaVersion: 1, type: "election-references", stateCode: "WA", sourceId: configured.id, electionDate: configured.electionDate, retrievedAt: capturedAt, sourceSha256: hash(JSON.stringify(documents.map(({ url, sha256 }) => ({ url, sha256 })))), recordCount: 1, documents, records: [{ id: hash(configured.id).slice(0, 24), name: "Preceding Example", office: "Other office", scope: "congressional", facts: ["Preceding factual background."], sourceDocumentIndex: 0 }] };
			const file = join(directory, `${configured.id}.json`);
			await writeFile(file, JSON.stringify(snapshot));
			referenceFiles.push(file);
		}
		const documents = [];
		for (const [index, document] of input.documents.entries()) {
			const path = join(directory, `document-${index}.json`);
			await writeFile(path, document.body);
			documents.push({ path, url: document.url, sha256: document.sha256, capturedAt: document.capturedAt });
		}
		const reviewedFactsFile = join(directory, "review.json");
		const review = { schemaVersion: 1, type: "washington-statement-review", sourceId: source.id, reviewed: true, facts: input.facts };
		await writeFile(reviewedFactsFile, JSON.stringify(review));
		const outputDirectory = join(directory, "output");
		const plan = { schemaVersion: 1, type: "washington-statement-preparation", sourceId: source.id, candidateFile, referenceFiles, documents, reviewedFactsFile, outputDirectory };
		const path = join(directory, "plan.json");
		await writeFile(path, JSON.stringify(plan));
		const result = await prepareWashingtonStatementFiles(path);
		assert.deepEqual({ profiles: result.profiles, facts: result.facts, imported: result.imported, publisherRequests: result.publisherRequests }, { profiles: 2, facts: 2, imported: false, publisherRequests: 0 });
		const output = await readFile(join(outputDirectory, `election-references-${source.id}.json`), "utf8");
		assert.equal(parseElectionReferenceSnapshot(source, output).recordCount, 2);
		assert.doesNotMatch(output, /excluded-image|excluded-contact|Vote for/u);
		assert.equal((await readdir(directory)).some(file => file.startsWith("references-")), false);
		await assert.rejects(prepareWashingtonStatementFiles(path), /EEXIST/u);
		await writeFile(path, JSON.stringify({ ...plan, referenceFiles: [], outputDirectory: join(directory, "missing-prior") }));
		await assert.rejects(prepareWashingtonStatementFiles(path), /preceding Washington/u);
		await writeFile(path, JSON.stringify({ ...plan, outputDirectory: join(directory, "unreviewed") }));
		await writeFile(reviewedFactsFile, JSON.stringify({ ...review, reviewed: false }));
		await assert.rejects(prepareWashingtonStatementFiles(path), /explicitly reviewed/u);
		await writeFile(reviewedFactsFile, JSON.stringify(review));
		const linked = join(directory, "linked.json");
		await symlink(candidateFile, linked);
		await writeFile(path, JSON.stringify({ ...plan, candidateFile: linked, outputDirectory: join(directory, "linked-output") }));
		await assert.rejects(prepareWashingtonStatementFiles(path), /ELOOP/u);
		await writeFile(path, JSON.stringify({ ...plan, outputDirectory: fileURLToPath(new URL("../data/state-ballots/preparation", import.meta.url)) }));
		await assert.rejects(prepareWashingtonStatementFiles(path), /outside/u);
	}
	finally {
		globalThis.fetch = originalFetch;
		await rm(directory, { recursive: true, force: true });
	}
});
