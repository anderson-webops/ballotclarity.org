import type { ElectionReferenceSource } from "../src/election-reference-sources.js";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { once } from "node:events";
import { mkdtemp, readFile, rm, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import express from "express";
import { registerElectionReferenceRoutes } from "../src/election-reference-routes.js";
import { electionReferenceSources } from "../src/election-reference-sources.js";
import { buildElectionReferencePage, buildElectionReferencePages, createElectionReferenceRepository, createElectionReferenceStorage, parseElectionReferenceSnapshot } from "../src/election-references.js";

const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const retrievedAt = "2026-10-20T12:00:00.000Z";
const congressional = electionReferenceSources.find(source => source.id === "wa-congressional-statements-2026")!;
const legislative = electionReferenceSources.find(source => source.id === "wa-ld1-statements-2026")!;

function fixture(source: ElectionReferenceSource, prefix = "Profile") {
	const documents = source.documents.map(document => ({ url: document.url, sha256: hash(document.url), capturedAt: retrievedAt, includedRecordCount: 1 }));
	const records = source.documents.map((document, index) => ({ id: hash(`${source.id}/${index}`).slice(0, 24), name: `${prefix} ${index}`, office: source.id === congressional.id ? "U.S. Representative" : "State Representative", scope: source.id === congressional.id ? "congressional" : "state-house", jurisdiction: source.id === congressional.id ? "Congressional District 1" : "Legislative District 1", facts: [`Reported experience ${index}.`], sourceDocumentIndex: index }));
	return parseElectionReferenceSnapshot(source, JSON.stringify({ schemaVersion: 1, type: "election-references", stateCode: source.stateCode, sourceId: source.id, electionDate: source.electionDate, retrievedAt, sourceSha256: hash(JSON.stringify(documents.map(({ url, sha256 }) => ({ url, sha256 })))), recordCount: records.length, documents, records }));
}

test("legislative collection is additive and pins two observed anonymous public races", () => {
	assert.equal(electionReferenceSources.filter(source => source.stateCode === "WA").length, 2);
	assert.equal(congressional.documents.length, 10);
	assert.equal(legislative.electionDate, "2026-11-03");
	assert.equal(legislative.documents.length, 2);
	for (const [index, document] of legislative.documents.entries()) {
		const url = new URL(document.url);
		assert.equal(url.origin, "https://voter.votewa.gov");
		assert.equal(url.pathname, "/elections/candidate.ashx");
		assert.deepEqual([...url.searchParams], [["e", "899"], ["r", String(186957 + index)], ["b", "0"], ["la", "en"], ["c", ""]]);
		assert.equal(document.pageUrl, `https://voter.votewa.gov/genericvoterguide.aspx?e=899&c=#/candidates/${186957 + index}`);
		assert.equal(document.kind, "candidate-statement");
		assert.equal(document.publishedDate, undefined);
	}
});

test("combined pagination filters before slicing and preserves every source identity", () => {
	const first = fixture(congressional, "Congressional");
	const second = fixture(legislative, "Legislative");
	second.records[0]!.id = first.records[0]!.id;
	const collections = [{ source: congressional, snapshot: first }, { source: legislative, snapshot: second }];
	const page = buildElectionReferencePages(collections, { search: "", scope: "all", offset: 9, limit: 3 });
	assert.equal(page.total, 12);
	assert.equal(page.matched, 12);
	assert.deepEqual(page.records.map(record => record.name), ["Congressional 9", "Legislative 0", "Legislative 1"]);
	assert.deepEqual(page.records.map(record => record.source.collectionId), [congressional.id, legislative.id, legislative.id]);
	assert.equal(page.records[1]!.id, first.records[0]!.id);
	assert.equal(page.records[1]!.source.url, legislative.documents[0]!.url);
	const filtered = buildElectionReferencePages(collections, { search: "legislative", scope: "state-house", offset: 0, limit: 1 });
	assert.equal(filtered.total, 12);
	assert.equal(filtered.matched, 2);
	const named = buildElectionReferencePages(collections, { search: "legislative 1", scope: "state-house", offset: 99, limit: 1 });
	assert.equal(named.matched, 1);
	assert.equal(named.offset, 0);
	assert.equal(named.records[0]!.name, "Legislative 1");
	assert.deepEqual(buildElectionReferencePage(congressional, first, { search: "", scope: "all", offset: 0, limit: 50 }), buildElectionReferencePages([collections[0]!], { search: "", scope: "all", offset: 0, limit: 50 }));
});

test("aggregation refuses mixed states, elections and duplicate collections", () => {
	const first = { source: congressional, snapshot: fixture(congressional) };
	const otherState = { ...legislative, stateCode: "OR" };
	const future = { ...legislative, electionDate: "2028-11-07" };
	for (const second of [{ source: otherState, snapshot: fixture(otherState) }, { source: future, snapshot: fixture(future) }, first]) assert.throws(() => buildElectionReferencePages([first, second], { search: "", scope: "all", offset: 0, limit: 50 }), /same state and election/u);
});

test("readers retain healthy collections across missing, corrupt and restored imports", async (context) => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-reference-collections-"));
	context.after(() => rm(directory, { recursive: true, force: true }));
	const storage = createElectionReferenceStorage(directory);
	const first = fixture(congressional);
	const second = fixture(legislative);
	const repository = createElectionReferenceRepository({ dataDirectory: directory, sources: [congressional, legislative], now: () => Date.parse("2026-10-21T00:00:00Z") });
	await storage.write(congressional, first);
	assert.deepEqual(await repository.getSnapshots!("wa"), [first]);
	await storage.write(legislative, second);
	assert.deepEqual(await repository.getSnapshots!("WA"), [first, second]);
	await writeFile(join(directory, `references-${legislative.id}.json`), "{}");
	assert.deepEqual(await repository.getSnapshots!("WA"), [first]);
	assert.deepEqual(await repository.getSnapshot("WA"), first);
	await storage.write(legislative, second);
	assert.deepEqual(await repository.getSnapshots!("WA"), [first, second]);
	await writeFile(join(directory, `references-${congressional.id}.json`), "{}");
	assert.deepEqual(await repository.getSnapshot("WA"), second);
	await writeFile(join(directory, `references-${legislative.id}.json`), "{}");
	await assert.rejects(repository.getSnapshots!("WA"), /unavailable/u);
	await unlink(join(directory, `references-${congressional.id}.json`));
	await unlink(join(directory, `references-${legislative.id}.json`));
	assert.deepEqual(await repository.getSnapshots!("WA"), []);
	assert.equal(await repository.getSnapshot("ME"), null);
});

test("earliest active election is isolated from future and expired collections", async (context) => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-reference-elections-"));
	context.after(() => rm(directory, { recursive: true, force: true }));
	const future = { ...legislative, id: "wa-next-election-test", electionDate: "2028-11-07" };
	const storage = createElectionReferenceStorage(directory);
	const first = fixture(congressional);
	const next = fixture(future);
	await storage.write(congressional, first);
	await storage.write(future, next);
	const options = { dataDirectory: directory, sources: [future, congressional] };
	assert.deepEqual(await createElectionReferenceRepository({ ...options, now: () => Date.parse("2026-10-22T00:00:00Z") }).getSnapshots!("WA"), [first]);
	assert.deepEqual(await createElectionReferenceRepository({ ...options, now: () => Date.parse("2026-11-05T00:00:00Z") }).getSnapshots!("WA"), [next]);
	assert.deepEqual(await createElectionReferenceRepository({ ...options, now: () => Date.parse("2028-11-09T00:00:00Z") }).getSnapshots!("WA"), []);
	assert.deepEqual(await createElectionReferenceRepository({ dataDirectory: null }).getSnapshots!("WA"), []);
});

test("public aggregation exposes partial availability without hiding healthy profiles", async (context) => {
	const first = fixture(congressional);
	const second = fixture(legislative);
	let snapshots = [first, second];
	let fail = false;
	const app = express();
	registerElectionReferenceRoutes(app, {
		async getSnapshot() { throw new Error("Legacy path must not be selected."); },
		async getSnapshots() {
			if (fail) throw new Error("Private path");
			return snapshots;
		},
	});
	const server = app.listen(0, "127.0.0.1");
	context.after(() => new Promise<void>(resolve => server.close(() => resolve())));
	await once(server, "listening");
	const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}/api/election-references/WA`;
	const complete = await (await fetch(origin)).json();
	assert.equal(complete.total, 12);
	assert.equal(complete.incomplete, undefined);
	assert.deepEqual(complete.collections, [congressional.id, legislative.id]);
	assert.equal(new Set(complete.records.map((record: { source: { collectionId: string } }) => record.source.collectionId)).size, 2);
	const page = await (await fetch(`${origin}?offset=9&limit=3`)).json();
	assert.equal(page.records.length, 3);
	assert.equal(page.records[1].source.collectionId, legislative.id);
	snapshots = [first];
	const partial = await (await fetch(origin)).json();
	assert.equal(partial.available, true);
	assert.equal(partial.incomplete, true);
	assert.equal(partial.total, 10);
	assert.deepEqual(partial.collections, complete.collections);
	snapshots = [];
	const missing = await (await fetch(origin)).json();
	assert.equal(missing.available, false);
	assert.deepEqual(missing.collections, complete.collections);
	fail = true;
	const unavailable = await fetch(origin);
	assert.equal(unavailable.status, 503);
	assert.deepEqual(await unavailable.json(), { message: "Candidate information is temporarily unavailable." });
	fail = false;
	snapshots = [first, fixture({ ...legislative, stateCode: "ME", id: "not-configured-for-wa" })];
	assert.equal((await fetch(origin)).status, 503);
});

test("ambiguous state export requires a pinned collection without changing legacy caches", async (context) => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-reference-collection-export-"));
	context.after(() => rm(directory, { recursive: true, force: true }));
	const storage = createElectionReferenceStorage(directory);
	const snapshot = fixture(congressional);
	await storage.write(congressional, snapshot);
	const cache = join(directory, `references-${congressional.id}.json`);
	const before = await readFile(cache, "utf8");
	const script = fileURLToPath(new URL("../src/manage-election-references.ts", import.meta.url));
	const command = (...args: string[]) => spawnSync(process.execPath, ["--import", import.meta.resolve("tsx"), script, ...args], { env: { PATH: process.env.PATH, HOME: process.env.HOME, STATE_BALLOT_DATA_DIR: directory }, encoding: "utf8" });
	const ambiguous = command("export", "WA");
	assert.notEqual(ambiguous.status, 0);
	assert.match(ambiguous.stderr, /provide --source/u);
	const explicit = command("export", "WA", "--source", congressional.id);
	assert.equal(explicit.status, 0, explicit.stderr);
	assert.deepEqual(JSON.parse(explicit.stdout), snapshot);
	assert.notEqual(command("export", "WA", "--source", "me-orono-statements-2026").status, 0);
	assert.notEqual(command("export", "WA", "--source", legislative.id).status, 0);
	assert.equal(await readFile(cache, "utf8"), before);
});
