import type { StateCandidateRecord } from "../src/state-ballot-records.js";
import type { StateBallotRepository, StateBallotSnapshot } from "../src/state-ballot-repository.js";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import express from "express";
import { createPublicRequestThrottle } from "../src/public-request-throttle.js";
import { fetchStateBallotSourceText } from "../src/state-ballot-fetch.js";
import { isActiveStateCandidateRecord, parseStateCandidateRecords } from "../src/state-ballot-records.js";
import { buildStateBallotPreview, createStateBallotRepository } from "../src/state-ballot-repository.js";
import { loadBundledStateSnapshot, parseBundledStateSnapshot } from "../src/state-ballot-snapshot.js";
import { stateBallotSources } from "../src/state-ballot-sources.js";
import { createStateBallotStorage } from "../src/state-ballot-storage.js";
import { buildStateRecordPage, parseStateRecordFilters, registerStateRecordRoutes, stateRecordDocumentLinks } from "../src/state-records.js";

const source = stateBallotSources.find(source => source.stateCode === "ME")!;
const hash = (value: string) => createHash("sha256").update(value).digest("hex");

function snapshot(): StateBallotSnapshot {
	const definitions = [
		["City Example", "CITY COUNCIL", "local", "", "listed"],
		["House Example", "STATE REPRESENTATIVE", "state-house", "8", "qualified"],
		["Senate Example", "STATE SENATOR", "state-senate", "5", "filed"],
		["Write-in Example", "SCHOOL COMMITTEE", "local", "", "write-in"],
		["Withdrawn Example", "CITY COUNCIL", "local", "", "withdrawn"],
		["Unopposed Example", "CITY COUNCIL", "local", "", "unopposed"],
		["Defeated Example", "CITY COUNCIL", "local", "", "defeated"],
	];
	return {
		source,
		retrievedAt: "2026-10-21T15:00:00.000Z",
		sha256: "a".repeat(64),
		records: definitions.map(([name, office, scope, district, status]) => ({ id: hash(name!).slice(0, 24), name, office, scope, district, status, jurisdiction: scope === "local" ? "Bangor" : undefined, party: scope === "local" ? undefined : "Example" } as StateCandidateRecord)),
	};
}

async function serve(repository: StateBallotRepository | null, throttle?: ReturnType<typeof createPublicRequestThrottle>) {
	const app = express();
	registerStateRecordRoutes(app, repository, throttle);
	const server = app.listen(0, "127.0.0.1");
	await once(server, "listening");
	const address = server.address();
	assert.ok(address && typeof address === "object");
	return { origin: `http://127.0.0.1:${address.port}`, close: () => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())) };
}

test("candidate-record filters reject malformed or unbounded query inputs", () => {
	assert.deepEqual(parseStateRecordFilters({}), { search: "", scope: "all", status: "active", limit: 50, offset: 0 });
	assert.equal(parseStateRecordFilters({ q: " ＣＩＴＹ ", scope: "local", status: "all", limit: "100", offset: "25000" }).search, "city");
	for (const query of [{ q: ["city"] }, { q: "line\nbreak" }, { q: "a".repeat(121) }, { scope: "ward" }, { status: "qualified" }, { limit: "101" }, { limit: "0" }, { limit: "1.5" }, { offset: "-1" }, { offset: "25001" }, { offset: ["0"] }])
		assert.throws(() => parseStateRecordFilters(query));
});

test("source browsing exposes local records without assigning a personalized ballot", () => {
	const data = snapshot();
	const page = buildStateRecordPage(data, parseStateRecordFilters({}));
	assert.equal(page.total, 7);
	assert.equal(page.matched, 4);
	assert.equal(page.inactive, 3);
	assert.equal(page.records.filter(record => record.scope === "local").length, 2);
	const local = buildStateRecordPage(data, parseStateRecordFilters({ scope: "local" }));
	assert.equal(local.matched, 2);
	assert.equal(buildStateRecordPage(data, parseStateRecordFilters({ status: "all" })).matched, 7);
	assert.equal(buildStateRecordPage(data, parseStateRecordFilters({ q: "BANGOR" })).matched, 2);
	assert.equal(buildStateRecordPage(data, parseStateRecordFilters({ q: "nomatch" })).matched, 0);
	assert.ok(data.records.every(record => isActiveStateCandidateRecord(record) === ["listed", "filed", "qualified", "write-in"].includes(record.status)));
	assert.equal(buildStateBallotPreview({ ...data, records: data.records.filter(record => record.scope === "local") }, { districtMatches: [] }), null);
});

test("bounded pagination remains usable after an old offset no longer has records", () => {
	const data = snapshot();
	const first = buildStateRecordPage(data, parseStateRecordFilters({ limit: "2" }));
	const second = buildStateRecordPage(data, parseStateRecordFilters({ limit: "2", offset: "2" }));
	assert.equal(first.records.length, 2);
	assert.equal(second.records.length, 2);
	assert.notEqual(first.records[0]!.id, second.records[0]!.id);
	assert.equal(buildStateRecordPage(data, parseStateRecordFilters({ limit: "2", offset: "200" })).offset, 2);
	assert.equal(buildStateRecordPage(data, parseStateRecordFilters({ q: "none", offset: "200" })).offset, 0);
});

test("public record serialization excludes private fields and unsafe candidate URLs", () => {
	const data = snapshot();
	Object.assign(data.records[0]!, { residentialAddress: "excluded", email: "excluded@example.test", phone: "excluded", candidateUrl: "javascript:alert(1)" });
	const row = buildStateRecordPage(data, parseStateRecordFilters({})).records[0]!;
	assert.equal(row.candidateUrl, undefined);
	assert.equal("residentialAddress" in row, false);
	assert.equal("email" in row, false);
	assert.equal("phone" in row, false);
});

test("record routes list states, retain provenance, and validate before requesting data", async (context) => {
	let reads = 0;
	const api = await serve({ async getSnapshot(code) {
		assert.equal(code, "ME");
		reads += 1;
		return snapshot();
	} });
	context.after(api.close);
	const states = await (await fetch(`${api.origin}/api/state-records`)).json();
	assert.equal(states.states.length, 51);
	assert.equal(states.states.find((state: { stateCode: string }) => state.stateCode === "ME").configured, true);
	assert.equal(reads, 0);
	const response = await fetch(`${api.origin}/api/state-records/me?scope=local&limit=1`);
	assert.equal(response.status, 200);
	assert.equal(response.headers.get("cache-control"), "no-store");
	const data = await response.json();
	assert.equal(data.available, true);
	assert.equal(data.records.length, 1);
	assert.equal(data.source.id, source.id);
	assert.equal(data.source.retrievedAt, snapshot().retrievedAt);
	assert.equal(data.source.scopeNotice, source.scopeNotice);
	assert.equal("guideAvailability" in data, false);
	assert.equal((await fetch(`${api.origin}/api/state-records/ME?limit=101`)).status, 400);
	assert.equal((await fetch(`${api.origin}/api/state-records/XX`)).status, 400);
	assert.equal(reads, 1);
});

test("missing or mismatched source data fails closed without exposing internal errors", async (context) => {
	const absent = await serve(null);
	context.after(absent.close);
	const unavailable = await (await fetch(`${absent.origin}/api/state-records/ME`)).json();
	assert.equal(unavailable.available, false);
	assert.deepEqual(unavailable.records, []);
	const mismatch = await serve({ async getSnapshot() {
		return { ...snapshot(), source: { ...source, stateCode: "VT" } };
	} });
	context.after(mismatch.close);
	const response = await fetch(`${mismatch.origin}/api/state-records/ME`);
	assert.equal(response.status, 503);
	assert.deepEqual(await response.json(), { message: "Candidate records are temporarily unavailable." });
});

test("source document links match reviewed provenance and reject unsafe or mismatched metadata", () => {
	const configured = stateBallotSources.find(item => item.stateCode === "NH")!;
	assert.deepEqual(stateRecordDocumentLinks(configured), configured.documentLinks);
	assert.deepEqual(stateRecordDocumentLinks(source), source.documentLinks);
	assert.equal(stateRecordDocumentLinks({ ...source, documentLinks: undefined }), undefined);
	assert.equal(stateRecordDocumentLinks(undefined), undefined);
	assert.throws(() => stateRecordDocumentLinks({ ...configured, documentUrls: [] }), /document links/u);
	assert.throws(() => stateRecordDocumentLinks({ ...configured, documentLinks: configured.documentLinks!.map(link => ({ ...link, url: "javascript:alert(1)" })) }), /document links/u);
	assert.throws(() => stateRecordDocumentLinks({ ...configured, documentLinks: configured.documentLinks!.map(link => ({ ...link, label: "\n" })) }), /document links/u);
	assert.throws(() => stateRecordDocumentLinks({ ...configured, documentLinks: [...configured.documentLinks!].reverse() }), /document links/u);
});

test("missing candidate data retains all configured original-source links without fetching publishers", async (context) => {
	const api = await serve(null);
	context.after(api.close);
	const response = await fetch(`${api.origin}/api/state-records/NH`);
	assert.equal(response.status, 200);
	const data = await response.json();
	assert.equal(data.available, false);
	assert.deepEqual(data.records, []);
	assert.deepEqual(data.source.documentLinks, stateBallotSources.find(item => item.stateCode === "NH")!.documentLinks);
});

test("public candidate queries are rate limited before loading the source", async (context) => {
	let reads = 0;
	const api = await serve({ async getSnapshot() {
		reads += 1;
		return snapshot();
	} }, createPublicRequestThrottle({ maxRequests: 1, windowMs: 60_000 }));
	context.after(api.close);
	assert.equal((await fetch(`${api.origin}/api/state-records/ME`)).status, 200);
	const response = await fetch(`${api.origin}/api/state-records/ME`);
	assert.equal(response.status, 429);
	assert.ok(Number(response.headers.get("retry-after")) > 0);
	assert.equal(reads, 1);
});

test("reviewed image imports preserve local-only facts and never download or bundle a fallback", async (context) => {
	const imageSource = { ...source, id: "me-reviewed-image-test", format: "reviewed-image" as const, documentUrls: [source.url], documentLinks: undefined };
	const directory = await mkdtemp(join(tmpdir(), "ballot-reviewed-image-"));
	context.after(() => rm(directory, { recursive: true, force: true }));
	const data = snapshot();
	const records = data.records.filter(record => record.scope === "local" && record.status === "listed");
	const documents = [{ url: source.url, sha256: "a".repeat(64), retrievedAt: data.retrievedAt, includedRecordCount: records.length }];
	const payload = { schemaVersion: 1, stateCode: "ME", sourceId: imageSource.id, electionDate: imageSource.electionDate, sourceUrl: imageSource.pageUrl, retrievalPolicy: "manual-snapshot", retrievedAt: data.retrievedAt, sourceSha256: hash(JSON.stringify(documents.map(({ url, sha256 }) => ({ url, sha256 })))), recordCount: records.length, documents, records };
	const accepted = parseBundledStateSnapshot(imageSource, JSON.stringify(payload));
	await createStateBallotStorage(directory).write(accepted);
	let requests = 0;
	const fetchText = async () => {
		requests += 1;
		throw new Error("No publisher request permitted.");
	};
	const repository = createStateBallotRepository({ sources: [imageSource], dataDirectory: directory, now: () => Date.parse("2026-10-21T20:00:00Z"), fetchText });
	assert.deepEqual(await repository.getSnapshot("ME"), accepted);
	assert.equal(buildStateBallotPreview(accepted, { districtMatches: [] }), null);
	assert.equal(buildStateRecordPage(accepted, parseStateRecordFilters({})).records.length, 1);
	await assert.rejects(loadBundledStateSnapshot(imageSource), /No bundled/u);
	await assert.rejects(fetchStateBallotSourceText(imageSource, fetchText), /manually supplied/u);
	assert.throws(() => parseStateCandidateRecords(imageSource, "not a reviewed snapshot"), /validated snapshot/u);
	assert.throws(() => parseBundledStateSnapshot(imageSource, JSON.stringify({ ...payload, documents: [] })), /document set/u);
	assert.equal(requests, 0);
});
