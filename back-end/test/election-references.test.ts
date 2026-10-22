import type { ElectionReferenceSource } from "../src/election-reference-sources.js";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { once } from "node:events";
import { mkdtemp, readFile, rm, symlink, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import express from "express";
import { registerElectionReferenceRoutes } from "../src/election-reference-routes.js";
import { electionReferenceSources } from "../src/election-reference-sources.js";
import { buildElectionReferencePage, createElectionReferenceRepository, createElectionReferenceStorage, parseElectionReferenceSnapshot } from "../src/election-references.js";
import { createPublicRequestThrottle } from "../src/public-request-throttle.js";

const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const retrievedAt = "2026-10-20T12:00:00.000Z";
const source = electionReferenceSources.find(item => item.stateCode === "ME")!;
const newsSource = electionReferenceSources.find(item => item.stateCode === "LA")!;

function fixture(collection: ElectionReferenceSource = source) {
	const records = collection.documents.map((document, index) => ({ id: hash(`${collection.id}/${index}`).slice(0, 24), name: `Example ${index}`, office: "School Board", scope: "local" as const, jurisdiction: "Example town", facts: [`Reported academic advising experience ${index}.`], sourceDocumentIndex: index }));
	const documents = collection.documents.map(document => ({ url: document.url, sha256: hash(document.url), capturedAt: retrievedAt, includedRecordCount: 1 }));
	return { schemaVersion: 1, type: "election-references", stateCode: collection.stateCode, sourceId: collection.id, electionDate: collection.electionDate, retrievedAt, sourceSha256: hash(JSON.stringify(documents.map(({ url, sha256 }) => ({ url, sha256 })))), recordCount: records.length, documents, records };
}

test("references preserve candidate, reporting and official biography authorship without ballot statuses", () => {
	for (const collection of electionReferenceSources) {
		const snapshot = parseElectionReferenceSnapshot(collection, JSON.stringify(fixture(collection)));
		const page = buildElectionReferencePage(collection, snapshot, { search: "", scope: "all", offset: 0, limit: 50 });
		assert.equal(page.records[0]!.source.kind, collection.documents[0]!.kind);
		assert.equal(page.records[0]!.source.publisher, collection.documents[0]!.publisher);
		assert.equal(page.records[0]!.source.url, collection.documents[0]!.url);
		assert.equal(page.records[0]!.source.publishedDate, collection.documents[0]!.publishedDate);
		assert.equal(page.records[0]!.source.capturedAt, retrievedAt);
		assert.equal("status" in page.records[0]!, false);
		assert.equal("sourceSha256" in page.records[0]!, false);
		assert.equal("sourceDocumentIndex" in page.records[0]!, false);
	}
});

test("judicial references pin independent public publications without using excluded distribution hosts", () => {
	const candidateSource = electionReferenceSources.find(item => item.id === "nc-judicial-statements-2026")!;
	const biographySource = electionReferenceSources.find(item => item.id === "nm-supreme-biographies-2026")!;
	for (const collection of [candidateSource, biographySource]) {
		assert.equal(collection.electionDate, "2026-11-03");
		assert.equal(collection.documents.length, 1);
		assert.equal(collection.documents[0]!.publishedDate, undefined);
		assert.equal(collection.documents[0]!.pageUrl, undefined);
		const snapshot = parseElectionReferenceSnapshot(collection, JSON.stringify(fixture(collection)));
		const otherCollection = collection === candidateSource ? biographySource : candidateSource;
		assert.throws(() => parseElectionReferenceSnapshot(otherCollection, JSON.stringify(snapshot)), /configured collection/u);
	}
	assert.equal(candidateSource.stateCode, "NC");
	assert.equal(candidateSource.documents[0]!.url, "https://www.ncsbe.gov/voting/upcoming-election/judicial-voter-guide-2026-general-election");
	assert.equal(candidateSource.documents[0]!.kind, "candidate-statement");
	assert.equal(biographySource.stateCode, "NM");
	assert.equal(biographySource.documents[0]!.url, "https://supremecourt.nmcourts.gov/about-this-court/supreme-court-justices/");
	assert.equal(biographySource.documents[0]!.kind, "official-biography");
	assert.equal(new Set(electionReferenceSources.map(collection => collection.stateCode)).size, electionReferenceSources.length);
});

test("Alaska and Oregon references pin candidate-authored PDFs without inferring qualification or publication dates", () => {
	const alaska = electionReferenceSources.find(item => item.id === "ak-statewide-statements-2026")!;
	const oregon = electionReferenceSources.find(item => item.id === "or-eastern-statements-2026")!;
	assert.equal(alaska.stateCode, "AK");
	assert.equal(alaska.documents.length, 15);
	assert.equal(new Set(alaska.documents.map(document => document.url)).size, 15);
	for (const document of alaska.documents) {
		assert.equal(new URL(document.url).origin, "https://elections.alaska.gov");
		assert.ok(new URL(document.url).pathname.startsWith("/doc/oep/2026/"));
		assert.ok(document.url.endsWith(".pdf"));
		assert.equal(document.pageUrl, undefined);
	}
	assert.equal(oregon.stateCode, "OR");
	assert.equal(oregon.documents.length, 1);
	assert.equal(oregon.documents[0]!.url, "https://sos.oregon.gov/elections/Voters-Pamphlet/Documents/VP_G26-Book19_web.pdf");
	assert.equal(oregon.documents[0]!.pageUrl, `${oregon.documents[0]!.url}#page=29`);
	for (const collection of [alaska, oregon]) {
		assert.equal(collection.electionDate, "2026-11-03");
		assert.ok(collection.documents.every(document => document.kind === "candidate-statement" && document.publishedDate === undefined));
		const snapshot = parseElectionReferenceSnapshot(collection, JSON.stringify(fixture(collection)));
		assert.equal(buildElectionReferencePage(collection, snapshot, { search: "", scope: "all", offset: 0, limit: 50 }).total, collection.documents.length);
	}
});

test("Utah references pin the public general-election pamphlet without address-based voter tools", () => {
	const collection = electionReferenceSources.find(item => item.id === "ut-congressional-statements-2026")!;
	assert.equal(collection.stateCode, "UT");
	assert.equal(collection.electionDate, "2026-11-03");
	assert.equal(collection.documents.length, 1);
	assert.equal(collection.documents[0]!.url, "https://vote.utah.gov/wp-content/uploads/2026/09/2026-Voter-Information-Pamphlet.pdf");
	assert.equal(collection.documents[0]!.pageUrl, `${collection.documents[0]!.url}#page=6`);
	assert.equal(collection.documents[0]!.kind, "candidate-statement");
	assert.equal(collection.documents[0]!.publishedDate, undefined);
	const data = fixture(collection);
	const snapshot = parseElectionReferenceSnapshot(collection, JSON.stringify(data));
	const page = buildElectionReferencePage(collection, snapshot, { search: "", scope: "all", offset: 0, limit: 50 });
	assert.equal(page.total, 1);
	assert.equal(page.records[0]!.source.publisher, "Utah Office of the Lieutenant Governor");
	assert.equal("status" in page.records[0]!, false);
});

test("Arizona and Nevada profiles preserve mixed authorship and actual public biography hosts", () => {
	const arizona = electionReferenceSources.find(item => item.id === "az-statewide-profiles-2026")!;
	const nevada = electionReferenceSources.find(item => item.id === "nv-executive-biographies-2026")!;
	assert.equal(arizona.stateCode, "AZ");
	assert.equal(nevada.stateCode, "NV");
	assert.deepEqual(arizona.documents.map(document => document.kind), ["official-biography", "official-biography", "candidate-statement", "candidate-statement", "candidate-statement"]);
	assert.ok(nevada.documents.every(document => document.kind === "official-biography"));
	assert.equal(nevada.documents[1]!.url, "https://www.gov.nv.gov/about/governor-joe-lombardo/");
	for (const collection of [arizona, nevada]) {
		assert.equal(collection.electionDate, "2026-11-03");
		assert.ok(collection.documents.every(document => document.publishedDate === undefined && !/int\.|prod\.|daniellefornevada|storageccec/u.test(document.url)));
		const snapshot = parseElectionReferenceSnapshot(collection, JSON.stringify(fixture(collection)));
		const page = buildElectionReferencePage(collection, snapshot, { search: "", scope: "all", offset: 0, limit: 50 });
		assert.deepEqual(page.records.map(record => record.source.kind), collection.documents.map(document => document.kind));
		assert.ok(page.records.every(record => !("status" in record) && !("party" in record)));
	}
});

test("references reject different elections, states, collections and unreviewed fields", () => {
	const data = fixture();
	for (const invalid of [{ ...data, electionDate: "2028-11-07" }, { ...data, stateCode: "LA" }, { ...data, sourceId: newsSource.id }, { ...data, type: "official-candidates" }, { ...data, address: "Excluded" }]) assert.throws(() => parseElectionReferenceSnapshot(source, JSON.stringify(invalid)), /configured collection/u);
	for (const field of ["status", "party", "candidateUrl", "email", "photos", "candidateId"]) assert.throws(() => parseElectionReferenceSnapshot(source, JSON.stringify({ ...data, records: data.records.map(record => ({ ...record, [field]: "Excluded" })) })), /fields/u);
});

test("public reference pages are independently pinned, safe and separate from captured data URLs", () => {
	const collection = { ...source, documents: source.documents.map(document => ({ ...document, pageUrl: "https://example.test/public-guide" })) };
	const snapshot = parseElectionReferenceSnapshot(collection, JSON.stringify(fixture(collection)));
	const page = buildElectionReferencePage(collection, snapshot, { search: "", scope: "all", offset: 0, limit: 50 });
	assert.equal(page.records[0]!.source.pageUrl, "https://example.test/public-guide");
	assert.equal(page.records[0]!.source.url, source.documents[0]!.url);
	for (const pageUrl of ["javascript:alert(1)", "//example.test/guide", "http://example.test/guide", "https://user:password@example.test/guide", "https://127.0.0.1/guide", "https://example.test/guide\n"]) {
		const invalid = { ...collection, documents: collection.documents.map(document => ({ ...document, pageUrl })) };
		assert.throws(() => parseElectionReferenceSnapshot(invalid, JSON.stringify(fixture(invalid))), /public page links/u);
	}
	assert.throws(() => parseElectionReferenceSnapshot(collection, JSON.stringify({ ...snapshot, documents: snapshot.documents.map(document => ({ ...document, pageUrl: "https://unreviewed.example.test/" })) })), /provenance/u);
});

test("Washington references pin the ten observed public congressional race requests without voter or preview parameters", () => {
	const collection = electionReferenceSources.find(item => item.stateCode === "WA")!;
	assert.equal(collection.electionDate, "2026-11-03");
	assert.equal(collection.documents.length, 10);
	for (const [index, document] of collection.documents.entries()) {
		const url = new URL(document.url);
		assert.equal(url.origin, "https://voter.votewa.gov");
		assert.equal(url.pathname, "/elections/candidate.ashx");
		assert.equal(url.searchParams.get("e"), "899");
		assert.equal(url.searchParams.get("b"), "0");
		assert.equal(url.searchParams.get("c"), "");
		assert.deepEqual([...url.searchParams.keys()], ["e", "r", "b", "la", "c"]);
		assert.equal(new URL(document.pageUrl!).hash, `#/candidates/${url.searchParams.get("r")}`);
		assert.equal(document.title, `Congressional District ${index + 1} candidate statements`);
		assert.equal(document.kind, "candidate-statement");
		assert.equal(document.publishedDate, undefined);
	}
});

test("references require all document fingerprints, original dates and exact per-document contributions", () => {
	const data = fixture();
	assert.throws(() => parseElectionReferenceSnapshot(source, JSON.stringify({ ...data, documents: data.documents.slice(1) })), /document set/u);
	assert.throws(() => parseElectionReferenceSnapshot(source, JSON.stringify({ ...data, sourceSha256: "f".repeat(64) })), /capture provenance/u);
	assert.throws(() => parseElectionReferenceSnapshot(source, JSON.stringify({ ...data, retrievedAt: "2026-10-21T00:00:00Z" })), /capture provenance/u);
	for (const update of [{ capturedAt: "2099-01-01T00:00:00Z" }, { url: "https://unreviewed.example.test/file.pdf" }, { sha256: "not-a-hash" }, { includedRecordCount: -1 }]) assert.throws(() => parseElectionReferenceSnapshot(source, JSON.stringify({ ...data, documents: [{ ...data.documents[0], ...update }, ...data.documents.slice(1)] })), /provenance/u);
	assert.throws(() => parseElectionReferenceSnapshot(source, JSON.stringify({ ...data, documents: data.documents.map(document => ({ ...document, includedRecordCount: 0 })) })), /contributions/u);
});

test("reference records remain positive, unique, bounded plain text with valid document identities", () => {
	const data = fixture();
	assert.throws(() => parseElectionReferenceSnapshot(source, JSON.stringify({ ...data, records: [], recordCount: 0 })), /record count/u);
	assert.throws(() => parseElectionReferenceSnapshot(source, JSON.stringify({ ...data, recordCount: 100 })), /record count/u);
	assert.throws(() => parseElectionReferenceSnapshot(source, JSON.stringify({ ...data, records: data.records.map(record => ({ ...record, id: data.records[0]!.id })) })), /identities/u);
	for (const update of [{ name: "" }, { name: "Name\nline" }, { facts: [] }, { facts: ["x".repeat(601)] }, { sourceDocumentIndex: -1 }, { sourceDocumentIndex: 999 }, { scope: "ward" }]) assert.throws(() => parseElectionReferenceSnapshot(source, JSON.stringify({ ...data, records: data.records.map(record => ({ ...record, ...update })) })), /fields/u);
	assert.throws(() => parseElectionReferenceSnapshot(source, " ".repeat(12 * 1024 * 1024 + 1)), /size limit/u);
});

test("reference search and pagination are independent of official record counts and expose no private fields", () => {
	const snapshot = parseElectionReferenceSnapshot(source, JSON.stringify(fixture()));
	const first = buildElectionReferencePage(source, snapshot, { search: "", scope: "all", offset: 0, limit: 2 });
	assert.equal(first.total, 3);
	assert.equal(first.records.length, 2);
	const last = buildElectionReferencePage(source, snapshot, { search: "", scope: "all", offset: 200, limit: 2 });
	assert.equal(last.offset, 2);
	assert.equal(last.records[0]!.name, "Example 2");
	assert.equal(buildElectionReferencePage(source, snapshot, { search: "academic", scope: "local", offset: 0, limit: 50 }).matched, 3);
	assert.equal(buildElectionReferencePage(source, snapshot, { search: "", scope: "statewide", offset: 0, limit: 50 }).matched, 0);
	assert.equal(buildElectionReferencePage(source, snapshot, { search: "no-match", scope: "all", offset: 200, limit: 50 }).offset, 0);
});

test("external reference storage survives restart and rejects invalid updates without changing the cache", async (context) => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-reference-storage-"));
	context.after(() => rm(directory, { recursive: true, force: true }));
	const storage = createElectionReferenceStorage(directory);
	assert.equal(await storage.read(source), null);
	const snapshot = parseElectionReferenceSnapshot(source, JSON.stringify(fixture()));
	await storage.write(source, snapshot);
	assert.deepEqual(await createElectionReferenceStorage(directory).read(source), snapshot);
	const file = join(directory, `references-${source.id}.json`);
	const before = await readFile(file, "utf8");
	await assert.rejects(storage.write(source, { ...snapshot, sourceSha256: "f".repeat(64) }), /provenance/u);
	assert.equal(await readFile(file, "utf8"), before);
	await assert.rejects(storage.read({ ...source, documents: source.documents.map(document => ({ ...document, title: "Changed review" })) }), /configured collection/u);
});

test("reference storage reuses external-directory, symlink and regular-file safety gates", async (context) => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-reference-safety-"));
	context.after(() => rm(directory, { recursive: true, force: true }));
	assert.throws(() => createElectionReferenceStorage("relative"), /absolute directory/u);
	const root = fileURLToPath(new URL("../../", import.meta.url));
	assert.throws(() => createElectionReferenceStorage(root), /outside/u);
	const alias = join(directory, "checkout");
	await symlink(root, alias);
	await assert.rejects(createElectionReferenceStorage(alias).read(source), /outside/u);
	const storage = createElectionReferenceStorage(directory);
	const target = join(directory, "unrelated.json");
	await writeFile(target, "test-owned unrelated bytes");
	await symlink(target, join(directory, `references-${source.id}.json`));
	await assert.rejects(storage.read(source));
	assert.equal(await readFile(target, "utf8"), "test-owned unrelated bytes");
	await unlink(join(directory, `references-${source.id}.json`));
	await assert.rejects(storage.read({ ...source, id: "../escape" }), /identifier/u);
});

test("reference repositories never fetch, carry records into another state or show an expired election", async (context) => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-reference-repository-"));
	context.after(() => rm(directory, { recursive: true, force: true }));
	const snapshot = parseElectionReferenceSnapshot(source, JSON.stringify(fixture()));
	await createElectionReferenceStorage(directory).write(source, snapshot);
	const repository = createElectionReferenceRepository({ dataDirectory: directory, now: () => Date.parse("2026-10-21T00:00:00Z") });
	assert.deepEqual(await repository.getSnapshot("ME"), snapshot);
	assert.equal(await repository.getSnapshot("LA"), null);
	assert.equal(await repository.getSnapshot("NY"), null);
	assert.equal(await createElectionReferenceRepository({ dataDirectory: null }).getSnapshot("ME"), null);
	assert.equal(await createElectionReferenceRepository({ dataDirectory: directory, now: () => Date.parse("2026-11-05T00:00:00Z") }).getSnapshot("ME"), null);
});

test("reference management imports and exports reviewed data but refuses automatic refresh", async (context) => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-reference-command-"));
	context.after(() => rm(directory, { recursive: true, force: true }));
	const file = join(directory, "input.json");
	const data = fixture();
	await writeFile(file, JSON.stringify(data));
	const script = fileURLToPath(new URL("../src/manage-election-references.ts", import.meta.url));
	const environment = { ...process.env, STATE_BALLOT_DATA_DIR: directory };
	const imported = execFileSync(process.execPath, ["--import", "tsx", script, "import", file], { env: environment, encoding: "utf8" });
	assert.equal(JSON.parse(imported).references, 3);
	const exported = execFileSync(process.execPath, ["--import", "tsx", script, "export", "ME"], { env: environment, encoding: "utf8" });
	assert.deepEqual(JSON.parse(exported), data);
	const cache = join(directory, `references-${source.id}.json`);
	const before = await readFile(cache, "utf8");
	assert.notEqual(spawnSync(process.execPath, ["--import", "tsx", script, "refresh", "ME"], { env: environment }).status, 0);
	await writeFile(file, JSON.stringify({ ...data, electionDate: "2028-11-07" }));
	assert.notEqual(spawnSync(process.execPath, ["--import", "tsx", script, "import", file], { env: environment }).status, 0);
	assert.equal(await readFile(cache, "utf8"), before);
});

test("public reference routes remain available independently of official candidate coverage", async (context) => {
	const app = express();
	const snapshot = parseElectionReferenceSnapshot(newsSource, JSON.stringify(fixture(newsSource)));
	registerElectionReferenceRoutes(app, {
		async getSnapshot(code) {
			return code === "LA" ? snapshot : null;
		},
	});
	const server = app.listen(0, "127.0.0.1");
	context.after(() => new Promise<void>(resolve => server.close(() => resolve())));
	await once(server, "listening");
	const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
	const response = await fetch(`${origin}/api/election-references/LA`);
	const body = await response.json();
	assert.equal(response.status, 200);
	assert.equal(response.headers.get("cache-control"), "no-store");
	assert.equal(body.available, true);
	assert.equal(body.records[0].source.kind, "news-report");
	assert.equal("status" in body.records[0], false);
	assert.equal((await (await fetch(`${origin}/api/election-references/RI`)).json()).available, false);
	for (const query of ["?scope=ward", "?limit=101", "?offset=-1", "?status=qualified", "?q=one&q=two", "?q=%0Aprivate"]) assert.equal((await fetch(`${origin}/api/election-references/LA${query}`)).status, 400);
	assert.equal((await fetch(`${origin}/api/election-references/XX`)).status, 400);
});

test("public reference failures remain isolated and rate limiting happens before loading data", async (context) => {
	let reads = 0;
	const app = express();
	registerElectionReferenceRoutes(app, {
		async getSnapshot() {
			reads++;
			throw new Error("Private file path must not leak.");
		},
	}, createPublicRequestThrottle({ windowMs: 60_000, maxRequests: 1, maxBuckets: 10 }));
	const server = app.listen(0, "127.0.0.1");
	context.after(() => new Promise<void>(resolve => server.close(() => resolve())));
	await once(server, "listening");
	const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
	const response = await fetch(`${origin}/api/election-references/LA`);
	assert.equal(response.status, 503);
	assert.deepEqual(await response.json(), { message: "Candidate information is temporarily unavailable." });
	const limited = await fetch(`${origin}/api/election-references/LA`);
	assert.equal(limited.status, 429);
	assert.ok(Number(limited.headers.get("retry-after")) > 0);
	assert.equal(reads, 1);
});
