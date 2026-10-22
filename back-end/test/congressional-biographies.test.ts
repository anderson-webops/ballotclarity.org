import type { ElectionReferenceSnapshot } from "../src/election-references.js";
import type { StateCandidateRecord } from "../src/state-ballot-records.js";
import type { StateBallotSnapshot } from "../src/state-ballot-repository.js";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { congressionalBiographySources, congressionalDirectory, parseCongressionalBiographies, prepareCongressionalBiographies } from "../src/congressional-biographies.js";
import { electionReferenceSources } from "../src/election-reference-sources.js";
import { parseElectionReferenceSnapshot } from "../src/election-references.js";
import { configuredStateBallotSources } from "../src/state-ballot-registry.js";

const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const capturedAt = "2026-10-20T12:00:00.000Z";
const header = "2025-2026\nOfficial Congressional Directory\n119th Congress\nClosing date for compilation of the Congressional Directory was October 1, 2025.\n\n";
const biography = (name = "JANE EXAMPLE", state = "CA", education = "B.A., history, Example University, 2001", professional = "teacher; member, Example City Council, 2010-14") => `${name}, Democrat, of Example City, ${state}; born in Example City, ${state}, January 1, 1980; education: ${education}; professional history: ${professional}; military service: example service; religion: example; married: Private Name; children: two; election history: elected in 2024.\n\nCongressional Office\nhttps://example.invalid\n(000) 000-0000\n\n`;
const candidate = (overrides: Partial<StateCandidateRecord> = {}): StateCandidateRecord => ({ id: hash("candidate").slice(0, 24), name: "Jane Example", office: "U.S. Representative", district: "1", scope: "congressional", status: "listed", ...overrides });
function candidateSnapshot(state = "CA", records = [candidate()]): StateBallotSnapshot {
	const source = configuredStateBallotSources.find(item => item.stateCode === state)!;
	return { source, retrievedAt: capturedAt, sha256: hash("official fixture"), records };
}
function prepare(body: string, candidates = [candidateSnapshot()], previous: ElectionReferenceSnapshot[] = []) {
	return prepareCongressionalBiographies({ body, sha256: hash(body), capturedAt, candidates, previous });
}

test("directory collections are additive, dated and pinned to the observed public edition", () => {
	assert.equal(congressionalBiographySources.length, 40);
	assert.equal(new Set(congressionalBiographySources.map(source => source.id)).size, 40);
	assert.equal(electionReferenceSources.length, 51);
	for (const source of congressionalBiographySources) {
		assert.equal(source.electionDate, "2026-11-03");
		assert.equal(source.documents.length, 1);
		assert.equal(source.documents[0]!.url, congressionalDirectory.url);
		assert.equal(source.documents[0]!.pageUrl, congressionalDirectory.pageUrl);
		assert.equal(source.documents[0]!.publishedDate, "2026-02-20");
		assert.equal(source.documents[0]!.kind, "official-biography");
		assert.match(source.id, /^us-cdir-[a-z]{2}-2026$/u);
	}
});

test("multiline paragraphs retain only bounded education and professional fields", () => {
	const body = header + biography().replace("history, Example", "history,\nExample");
	const biographies = parseCongressionalBiographies(body);
	assert.equal(biographies.length, 1);
	assert.equal(biographies[0]!.education, "B.A., history, Example University, 2001");
	assert.equal(biographies[0]!.professionalHistory, "teacher; member, Example City Council, 2010-14");
	const output = prepare(body)[0]!;
	const snapshot = parseElectionReferenceSnapshot(output.source, JSON.stringify(output.snapshot));
	assert.deepEqual(snapshot.records[0]!.facts, ["Education: B.A., history, Example University, 2001.", "Professional background: teacher; member, Example City Council, 2010-14."]);
	assert.doesNotMatch(JSON.stringify(snapshot.records), /Private Name|born|1980|religion|children|example.invalid|000-000/u);
	assert.equal(snapshot.records[0]!.jurisdiction, "Congressional District 1");
	assert.equal("party" in snapshot.records[0]!, false);
	assert.equal("status" in snapshot.records[0]!, false);
	const titled = prepare(body, [candidateSnapshot("CA", [candidate({ office: "United States Representative District 1" })])])[0]!.snapshot.records[0]!;
	assert.equal(titled.office, "U.S. Representative");
	assert.equal(titled.jurisdiction, "Congressional District 1");
});

test("exact state/name matches refuse ambiguity, nicknames, stale elections and inactive candidates", () => {
	const body = header + biography();
	assert.equal(prepare(body, [candidateSnapshot("MI")]).length, 0);
	assert.equal(prepare(body, [candidateSnapshot("CA", [candidate({ name: "Janet Example" })])]).length, 0);
	assert.equal(prepare(body + biography()).length, 0);
	for (const status of ["withdrawn", "disqualified", "defeated", "elected", "inactive"] as const) assert.equal(prepare(body, [candidateSnapshot("CA", [candidate({ status })])]).length, 0);
	assert.equal(prepare(body, [candidateSnapshot("CA", [candidate({ scope: "local", office: "School Board" })])]).length, 0);
	assert.equal(prepare(body, [candidateSnapshot("MI", [candidate({ scope: "statewide", office: "Governor of Wayne State University" })])]).length, 0);
	const future = candidateSnapshot();
	future.source = { ...future.source, electionDate: "2028-11-07" };
	assert.throws(() => prepare(body, [future]), /not permitted/u);
	const excluded = candidateSnapshot();
	excluded.source = { ...excluded.source, id: "nc-sbe-2026" };
	assert.throws(() => prepare(body, [excluded]), /not permitted/u);
	const futureCapture = candidateSnapshot();
	futureCapture.retrievedAt = "2100-01-01T00:00:00.000Z";
	assert.throws(() => prepare(body, [futureCapture]), /not permitted/u);
});

test("ticket slot and election office come from the official candidate record, not current membership", () => {
	const body = header + biography("JANE EXAMPLE", "MI") + biography("ROBERT EXAMPLE", "MI");
	const output = prepare(body, [candidateSnapshot("MI", [candidate({ name: "Example, Jane / Example, Robert", scope: "statewide", district: "", office: "Governor / Lt. Governor 4 Year Term (1) Position" })])])[0]!;
	assert.deepEqual(output.snapshot.records.map(record => [record.name, record.office, record.scope]), [["Jane Example", "Governor", "statewide"], ["Robert Example", "Lieutenant Governor", "statewide"]]);
	assert.deepEqual(output.identities.map(identity => identity.slot), [0, 1]);
	assert.equal(output.snapshot.records[0]!.jurisdiction, undefined);
	assert.equal(new Set(output.snapshot.records.map(record => record.id)).size, 2);
});

test("previous non-directory profiles prevent duplication without blocking directory re-preparation", () => {
	const body = header + biography();
	const initial = prepare(body)[0]!.snapshot;
	const previous = { ...initial, sourceId: "preceding-reviewed-collection", records: [{ ...initial.records[0]!, name: "Jane Q. Example" }] };
	assert.equal(prepare(body, [candidateSnapshot()], [previous]).length, 0);
	assert.equal(prepare(body, [candidateSnapshot()], [initial]).length, 1);
	const anotherState = { ...previous, stateCode: "MI" };
	assert.equal(prepare(body, [candidateSnapshot()], [anotherState]).length, 1);
});

test("field splitting preserves clauses, rejects broken encoding and verifies capture provenance", () => {
	const experience = Array.from({ length: 16 }, (_, index) => `position ${index}, Example Organization, 2000-2001`).join("; ");
	const body = header + biography("JANE EXAMPLE", "CA", "B.A., Example University", experience);
	const facts = prepare(body)[0]!.snapshot.records[0]!.facts;
	assert.ok(facts.length > 2);
	assert.ok(facts.every(fact => fact.length <= 600));
	for (let index = 0; index < 16; index++) assert.ok(facts.some(fact => fact.includes(`position ${index},`)));
	const damaged = header + biography("JANE EXAMPLE", "CA", "B.A., Broken\uFFFDUniversity");
	assert.deepEqual(prepare(damaged)[0]!.snapshot.records[0]!.facts, ["Professional background: teacher; member, Example City Council, 2010-14."]);
	assert.throws(() => prepareCongressionalBiographies({ body, sha256: hash("different"), capturedAt, candidates: [], previous: [] }), /provenance/u);
	assert.throws(() => prepareCongressionalBiographies({ body, sha256: hash(body), capturedAt: "2100-01-01", candidates: [], previous: [] }), /provenance/u);
	assert.throws(() => parseCongressionalBiographies(body.replace("119th Congress", "120th Congress")), /reviewed edition/u);
	const dated = header + biography("JANE EXAMPLE", "CA", "B.A., Example University", "teacher, 2000-2005; director, 2006-present; current board member; manager, 2010-");
	assert.deepEqual(prepare(dated)[0]!.snapshot.records[0]!.facts, ["Education: B.A., Example University.", "Professional background: teacher, 2000-2005."]);
});

test("reviewed source discrepancies are withheld without inventing replacement facts", () => {
	const body = header + biography("KELLY MORRISON", "MN", "B.A., Example University, 2003; M.D., Another University, 1997") + biography("JOHN JAMES", "MI", "M.P.A., supply-chain management, 2014") + biography("VICTORIA SPARTZ", "IN", "B.A., Example University", "business owner; adjunct professor, Indiana State University Kelley School of Business, 2013-20; farmer");
	const outputs = prepare(body, [candidateSnapshot("MN", [candidate({ name: "Kelly Morrison" })]), candidateSnapshot("MI", [candidate({ name: "John James" })]), candidateSnapshot("IN", [candidate({ name: "Victoria Spartz" })])]);
	assert.equal(outputs.length, 3);
	for (const state of ["MN", "MI"]) assert.ok(outputs.find(output => output.source.stateCode === state)!.snapshot.records[0]!.facts.every(fact => !fact.startsWith("Education:")));
	const spartz = outputs.find(output => output.source.stateCode === "IN")!.snapshot.records[0]!;
	assert.deepEqual(spartz.facts, ["Education: B.A., Example University.", "Professional background: business owner; farmer."]);
	assert.doesNotMatch(JSON.stringify(outputs.map(output => output.snapshot.records)), /Indiana State University|M\.P\.A\./u);
	const terms = header + biography("MIKE ROUNDS", "SD", "B.A., Example University", "member, South Dakota State Senate, 1990-2000 (Minority Whip, 1993; Majority Leader, 1995); governor, South Dakota, 2002-10") + biography("JOSEPH D. MORELLE", "NY", "B.A., Example University", "member, New York State Assembly, 1990-2018 (Majority Leader, 2013-18)");
	const termOutputs = prepare(terms, [candidateSnapshot("SD", [candidate({ name: "Mike Rounds" })]), candidateSnapshot("NY", [candidate({ name: "Joseph D. Morelle" })])]);
	assert.deepEqual(termOutputs.map(output => output.snapshot.records[0]!.facts[1]).sort(), ["Professional background: governor, South Dakota.", "Professional background: member, New York State Assembly."].sort());
});

test("compiled-compatible preparation stages validated files without import, network or overwriting", async (context) => {
	const directory = await mkdtemp(join(tmpdir(), "congressional-preparation-"));
	context.after(() => rm(directory, { recursive: true, force: true }));
	const source = configuredStateBallotSources.find(item => item.stateCode === "CA")!;
	const records = [candidate()];
	const documents = source.documentUrls!.map((url, index) => ({ url, retrievedAt: capturedAt, sha256: hash(url), includedRecordCount: index === 0 ? 1 : 0 }));
	const candidates = { schemaVersion: 1, stateCode: "CA", sourceId: source.id, electionDate: source.electionDate, sourceUrl: source.pageUrl, retrievalPolicy: "manual-snapshot", retrievedAt: capturedAt, sourceSha256: hash(JSON.stringify(documents.map(({ url, sha256 }) => ({ url, sha256 })))), recordCount: 1, records, documents };
	const body = header + biography();
	const input = join(directory, "directory.txt");
	const candidateFile = join(directory, "candidates.json");
	const planFile = join(directory, "plan.json");
	const outputDirectory = join(directory, "prepared");
	const plan = { schemaVersion: 1, type: "congressional-biography-preparation", sourceText: { path: input, url: congressionalDirectory.url, capturedAt, sha256: hash(body) }, candidateFiles: [candidateFile], referenceFiles: [], outputDirectory };
	await writeFile(input, body);
	await writeFile(candidateFile, JSON.stringify(candidates));
	await writeFile(planFile, JSON.stringify(plan));
	const script = fileURLToPath(new URL("../src/manage-election-references.ts", import.meta.url));
	const command = () => spawnSync(process.execPath, ["--import", import.meta.resolve("tsx"), script, "prepare-congressional", planFile], { env: { PATH: process.env.PATH, HOME: process.env.HOME }, encoding: "utf8" });
	const result = command();
	assert.equal(result.status, 0, result.stderr);
	assert.equal(JSON.parse(result.stdout).profiles, 1);
	assert.equal(JSON.parse(result.stdout).publisherRequests, 0);
	assert.equal(JSON.parse(result.stdout).imported, false);
	const outputFile = join(outputDirectory, "election-references-cdir-ca-2026.json");
	const original = await readFile(outputFile, "utf8");
	assert.notEqual(command().status, 0);
	assert.equal(await readFile(outputFile, "utf8"), original);
	await writeFile(planFile, JSON.stringify({ ...plan, sourceText: { ...plan.sourceText, url: "https://example.invalid/private" } }));
	assert.notEqual(command().status, 0);
	await writeFile(candidateFile, JSON.stringify({ ...candidates, retrievalPolicy: "unreviewed" }));
	await writeFile(planFile, JSON.stringify({ ...plan, outputDirectory: join(directory, "invalid-policy") }));
	const invalidPolicy = command();
	assert.notEqual(invalidPolicy.status, 0);
	assert.match(invalidPolicy.stderr, /retrieval policy/u);
});
