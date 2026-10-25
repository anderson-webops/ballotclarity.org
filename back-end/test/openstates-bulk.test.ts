import type { ElectionReferenceSnapshot } from "../src/election-references.js";
import type { StateCandidateRecord } from "../src/state-ballot-records.js";
import type { StateBallotSnapshot } from "../src/state-ballot-repository.js";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import express from "express";
import { registerElectionReferenceRoutes } from "../src/election-reference-routes.js";
import { electionReferenceSources } from "../src/election-reference-sources.js";
import { buildElectionReferencePage, parseElectionReferenceSnapshot } from "../src/election-references.js";
import { openStatesBulkPublication, openStatesBulkSources, parseOpenStatesBulk, prepareOpenStatesReferences } from "../src/openstates-bulk.js";
import { configuredStateBallotSources } from "../src/state-ballot-registry.js";
import { serializeStoredStateSnapshot } from "../src/state-ballot-storage.js";

const source = openStatesBulkSources.find(item => item.stateCode === "GA")!;
const candidateSource = configuredStateBallotSources.find(item => item.id === "ga-fulton-2026")!;
const capturedAt = "2026-10-22T12:00:00.000Z";
const now = Date.parse(capturedAt);
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const personId = "ocd-person/00000000-0000-0000-0000-000000000001";
const body = `id,name,current_chamber,current_district,email,biography\n${personId},Alex Rivera,upper,12,private@example.test,Unreviewed prose\n`;
const candidate: StateCandidateRecord = { id: "a".repeat(24), name: "Alex Rivera", office: "State Senator", scope: "state-senate", district: "12", status: "listed" };

function snapshot(records: StateCandidateRecord[] = [candidate]): StateBallotSnapshot {
	const documents = candidateSource.documentUrls!.map((url, index) => ({ url, retrievedAt: capturedAt, sha256: hash(url), includedRecordCount: index === 0 ? records.length : 0 }));
	return { source: candidateSource, retrievedAt: capturedAt, sha256: hash(JSON.stringify(documents.map(({ url, sha256 }) => ({ url, sha256 })))), records, documents };
}

function prepare(overrides: Partial<Parameters<typeof prepareOpenStatesReferences>[0]> = {}) {
	return prepareOpenStatesReferences({ source, body, capturedAt, sha256: hash(body), candidates: [snapshot()], allowedCandidateSourceIds: [candidateSource.id], now, ...overrides });
}

test("bulk sources cover all states and DC without misclassifying a dataset as an official biography", () => {
	assert.equal(openStatesBulkSources.length, 51);
	assert.equal(new Set(openStatesBulkSources.map(item => item.stateCode)).size, 51);
	for (const collection of openStatesBulkSources) {
		assert.ok(electionReferenceSources.includes(collection));
		assert.equal(collection.documents.length, 1);
		assert.equal(collection.documents[0]!.url, `https://data.openstates.org/people/current/${collection.stateCode.toLowerCase()}.csv`);
		assert.equal(collection.documents[0]!.kind, "public-dataset");
		assert.equal(collection.documents[0]!.publisher, "Open States");
		assert.equal(collection.documents[0]!.publishedDate, undefined);
	}
	assert.equal(openStatesBulkPublication.minimumRefreshIntervalMs, 86_400_000);
});

test("bulk parsing keeps only identity, chamber, district and logical CSV record number", () => {
	assert.deepEqual(parseOpenStatesBulk(`\uFEFF${body}`), [{ id: personId, name: "Alex Rivera", chamber: "upper", district: "12", sourceRow: 2 }]);
	assert.doesNotMatch(JSON.stringify(parseOpenStatesBulk(body)), /private@|Unreviewed prose|email|biography/u);
});

test("exact candidate joins produce attributed reference facts without candidate qualification or party claims", () => {
	const result = prepare();
	assert.equal(result.matches.length, 1);
	assert.equal(result.holds.length, 0);
	assert.equal(result.matches[0]!.personId, personId);
	assert.equal(result.matches[0]!.candidateSourceSha256, snapshot().sha256);
	assert.equal(result.matches[0]!.sourceRow, 2);
	const accepted = parseElectionReferenceSnapshot(source, JSON.stringify(result.snapshot), now);
	const page = buildElectionReferencePage(source, accepted, { search: "alex", scope: "state-senate", offset: 0, limit: 50 });
	assert.equal(page.records.length, 1);
	assert.equal(page.records[0]!.source.kind, "public-dataset");
	assert.equal(page.records[0]!.source.capturedAt, capturedAt);
	assert.deepEqual(page.records[0]!.facts, ["Listed by Open States as a serving state legislator for District 12."]);
	assert.ok(!("status" in page.records[0]!) && !("party" in page.records[0]!));
});

test("format-only name differences are allowed without dropping initials, accents or nicknames", () => {
	assert.equal(prepare({ candidates: [snapshot([{ ...candidate, name: " ALEX  RIVERA " }])] }).matches.length, 1);
	for (const name of ["Alex J. Rivera", "Álex Rivera", "Alexander Rivera", "Rivera, Alex"]) {
		const result = prepare({ candidates: [snapshot([{ ...candidate, name }])] });
		assert.equal(result.snapshot, null);
		assert.equal(result.holds[0]!.reason, "no-exact-match");
	}
});

test("a different district, chamber or unsupported non-legislative office never joins", () => {
	for (const record of [{ ...candidate, district: "13" }, { ...candidate, district: "012" }, { ...candidate, scope: "state-house" as const }]) {
		assert.equal(prepare({ candidates: [snapshot([record])] }).snapshot, null);
	}
	for (const scope of ["statewide", "local", "congressional"] as const) {
		assert.equal(prepare({ candidates: [snapshot([{ ...candidate, scope }])] }).matches.length, 0);
	}
	assert.equal(prepare({ candidates: [snapshot([{ ...candidate, district: "" }])] }).holds[0]!.reason, "missing-district");
});

test("inactive, withdrawn, defeated and disqualified candidate records are not used", () => {
	for (const status of ["inactive", "withdrawn", "defeated", "disqualified", "elected", "unrecognized"] as const) {
		assert.equal(prepare({ candidates: [snapshot([{ ...candidate, status }])] }).matches.length, 0);
	}
});

test("ambiguous dataset identities are held rather than scored or guessed", () => {
	const ambiguous = `${body}${personId.replace(/1$/u, "2")},Alex Rivera,upper,12,,\n`;
	const result = prepare({ body: ambiguous, sha256: hash(ambiguous) });
	assert.equal(result.snapshot, null);
	assert.equal(result.holds[0]!.reason, "ambiguous-match");
	const ambiguousCandidates = prepare({ candidates: [snapshot([candidate, { ...candidate, id: "b".repeat(24) }])] });
	assert.equal(ambiguousCandidates.snapshot, null);
	assert.equal(ambiguousCandidates.holds.length, 2);
});

test("one legislator yields one profile even when retained candidate publications overlap", () => {
	const result = prepare({ candidates: [snapshot(), snapshot([{ ...candidate, id: "b".repeat(24) }])] });
	assert.equal(result.matches.length, 2);
	assert.equal(result.snapshot!.recordCount, 1);
	assert.equal(result.matches[0]!.referenceId, result.matches[1]!.referenceId);
});

test("unicameral and DC roles are retained as data but never forced into a chamber match", () => {
	const unicameral = body.replace("upper", "legislature");
	assert.equal(parseOpenStatesBulk(unicameral)[0]!.chamber, "legislature");
	assert.equal(prepare({ body: unicameral, sha256: hash(unicameral) }).snapshot, null);
});

test("candidate provenance and reviewed source selection fail closed", () => {
	for (const candidates of [[{ ...snapshot(), source: { ...candidateSource, stateCode: "AL" } }], [{ ...snapshot(), source: { ...candidateSource, electionDate: "2028-11-07" } }], [{ ...snapshot(), retrievedAt: "2026-10-23T00:00:00Z" }], [{ ...snapshot(), sha256: "invalid" }]]) {
		assert.throws(() => prepare({ candidates }), /candidate snapshot/u);
	}
	for (const allowedCandidateSourceIds of [[], ["other-source"], [candidateSource.id, candidateSource.id]]) {
		assert.throws(() => prepare({ allowedCandidateSourceIds }));
	}
});

test("capture hashes, dates and configured attribution cannot be changed silently", () => {
	for (const overrides of [{ sha256: "a".repeat(64) }, { capturedAt: "invalid" }, { capturedAt: "2026-10-23T00:00:00Z" }, { capturedAt: "2024-10-22T12:00:00Z" }, { source: { ...source, documents: [{ ...source.documents[0]!, publisher: "Official election authority" }] } }]) {
		assert.throws(() => prepare(overrides), /provenance/u);
	}
});

test("invalid CSV shapes, duplicate IDs and unknown roles are rejected", () => {
	for (const invalid of ["name\nAlex\n", body.replace("name,current_chamber", "name,name"), `${body + body.split("\n")[1]}\n`, body.replace(personId, "https://example.test/person"), body.replace("upper", "unknown"), body.replace(",12,", ",, "), body.replace("Alex Rivera", "Alex\u0000Rivera"), body.replace("Alex Rivera", "a".repeat(251))]) {
		assert.throws(() => parseOpenStatesBulk(invalid));
	}
	assert.throws(() => parseOpenStatesBulk(" ".repeat(openStatesBulkPublication.maximumBytes + 1)), /size limit/u);
	assert.throws(() => parseOpenStatesBulk(`${body.split("\n")[0]!}\n`), /row count/u);
});

test("compiled-compatible preparation stages minimal files without network, imports or overwriting", async (context) => {
	const directory = await mkdtemp(join(tmpdir(), "openstates-reference-plan-"));
	context.after(() => rm(directory, { recursive: true, force: true }));
	const csvPath = join(directory, "ga.csv");
	const candidatePath = join(directory, "candidates.json");
	const planPath = join(directory, "plan.json");
	const outputDirectory = join(directory, "prepared");
	const plan = { schemaVersion: 1, type: "openstates-reference-preparation", downloads: [{ stateCode: "GA", path: csvPath, url: source.documents[0]!.url, capturedAt, sha256: hash(body) }], candidateFiles: [candidatePath], allowedCandidateSourceIds: [candidateSource.id], outputDirectory };
	await writeFile(csvPath, body);
	await writeFile(candidatePath, serializeStoredStateSnapshot(snapshot()));
	await writeFile(planPath, JSON.stringify(plan));
	const script = fileURLToPath(new URL("../src/manage-election-references.ts", import.meta.url));
	const command = () => spawnSync(process.execPath, ["--import", import.meta.resolve("tsx"), script, "prepare-openstates", planPath], { env: { PATH: process.env.PATH, HOME: process.env.HOME }, encoding: "utf8" });
	const result = command();
	assert.equal(result.status, 0, result.stderr);
	assert.deepEqual(JSON.parse(result.stdout), { collections: 1, profiles: 1, matchedCandidateRecords: 1, heldCandidateRecords: 0, files: 4, publisherRequests: 0, imported: false });
	const files = await readdir(outputDirectory);
	const original = await Promise.all(files.map(async file => [file, await readFile(join(outputDirectory, file), "utf8")]));
	assert.doesNotMatch(JSON.stringify(original), /private@|Unreviewed prose|"biography"/u);
	const repeated = command();
	assert.notEqual(repeated.status, 0);
	assert.match(repeated.stderr, /never overwritten/u);
	assert.deepEqual(await Promise.all(files.map(async file => [file, await readFile(join(outputDirectory, file), "utf8")])), original);
	await writeFile(planPath, JSON.stringify({ ...plan, outputDirectory: join(directory, "duplicate"), candidateFiles: [candidatePath, candidatePath] }));
	assert.match(command().stderr, /one reviewed candidate capture/u);
	await writeFile(planPath, JSON.stringify({ ...plan, outputDirectory: join(directory, "invalid"), downloads: [{ ...plan.downloads[0], sha256: "a".repeat(64) }] }));
	assert.match(command().stderr, /provenance/u);
	assert.ok(!(await readdir(directory)).includes("invalid"));
	await writeFile(planPath, JSON.stringify({ ...plan, outputDirectory: process.cwd() }));
	assert.match(command().stderr, /outside the application/u);
	const formulaBody = body.replace("Alex Rivera", "=1+1");
	await writeFile(csvPath, formulaBody);
	await writeFile(candidatePath, serializeStoredStateSnapshot(snapshot([{ ...candidate, name: "=1+1" }])));
	const formulaDirectory = join(directory, "formula-safe");
	await writeFile(planPath, JSON.stringify({ ...plan, outputDirectory: formulaDirectory, downloads: [{ ...plan.downloads[0], sha256: hash(formulaBody) }] }));
	const formulaResult = command();
	assert.equal(formulaResult.status, 0, formulaResult.stderr);
	assert.match(await readFile(join(formulaDirectory, "openstates-service-crosswalk.csv"), "utf8"), /"'=1\+1"/u);
});

test("absent optional service data does not create a retry warning, while missing required collections still do", async (context) => {
	const required = electionReferenceSources.filter(item => item.stateCode === "ID" && !item.optional);
	assert.equal(required.length, 2);
	let available: ElectionReferenceSnapshot[] = required.map((collection) => {
		const documents = collection.documents.map((document, index) => ({ url: document.url, sha256: hash(document.url), capturedAt, includedRecordCount: index === 0 ? 1 : 0 }));
		return parseElectionReferenceSnapshot(collection, JSON.stringify({ schemaVersion: 1, type: "election-references", stateCode: "ID", sourceId: collection.id, electionDate: collection.electionDate, retrievedAt: capturedAt, sourceSha256: hash(JSON.stringify(documents.map(({ url, sha256 }) => ({ url, sha256 })))), recordCount: 1, documents, records: [{ id: hash(collection.id).slice(0, 24), name: "Example person", office: "Governor", scope: "statewide", facts: ["Government service."], sourceDocumentIndex: 0 }] }), now);
	});
	const app = express();
	registerElectionReferenceRoutes(app, {
		async getSnapshot() { return available[0] ?? null; },
		async getSnapshots() { return available; },
	});
	const server = app.listen(0, "127.0.0.1");
	context.after(() => new Promise<void>(resolve => server.close(() => resolve())));
	await new Promise<void>(resolve => server.once("listening", resolve));
	const address = server.address() as { port: number };
	const url = `http://127.0.0.1:${address.port}/api/election-references/ID`;
	const full = await (await fetch(url)).json();
	assert.equal(full.total, 2);
	assert.equal(full.incomplete, undefined);
	available = available.slice(1);
	const missing = await (await fetch(url)).json();
	assert.equal(missing.incomplete, true);
});
