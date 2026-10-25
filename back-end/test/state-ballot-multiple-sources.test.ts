import type { StateBallotRepository, StateBallotSnapshot } from "../src/state-ballot-repository.js";
import type { StateBallotSource } from "../src/state-ballot-sources.js";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { once } from "node:events";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import express from "express";
import { serializeStateBallotSnapshots } from "../src/state-ballot-export.js";
import { additionalStateBallotSources, configuredStateBallotSources } from "../src/state-ballot-registry.js";
import { buildStateBallotPreview, createStateBallotRepository, resolveStateBallotConfiguration } from "../src/state-ballot-repository.js";
import { parseBundledStateSnapshot } from "../src/state-ballot-snapshot.js";
import { stateBallotSources } from "../src/state-ballot-sources.js";
import { createStateBallotStorage } from "../src/state-ballot-storage.js";
import { registerStateRecordRoutes } from "../src/state-records.js";

const now = Date.parse("2026-10-22T03:00:00Z");
const county = additionalStateBallotSources[0]!;
const otherCounty = additionalStateBallotSources[1]!;
const parish = additionalStateBallotSources[2]!;
const primary = stateBallotSources.find(source => source.stateCode === county.stateCode)!;
const hash = (value: string) => createHash("sha256").update(value).digest("hex");

function snapshot(source = county): StateBallotSnapshot {
	const records = (["statewide", "congressional", "state-senate", "state-house", "local"] as const).map(scope => ({ id: hash(source.id + scope).slice(0, 24), name: `Example ${scope}`, office: `Example ${scope} office`, district: scope === "statewide" ? "" : "1", scope, status: "listed" as const, sourceStatus: "Example printed entry" }));
	if (source.withheldStatewideOffices?.[0]) records.push({ id: hash(`${source.id}regional-state-office`).slice(0, 24), name: "Example regional commissioner", office: source.withheldStatewideOffices[0], district: "", scope: "statewide", status: "listed", sourceStatus: "Example regional state office" });
	const retrievedAt = new Date(now - 60_000).toISOString();
	const documents = source.documentUrls?.map((url, index) => ({ url, sha256: hash(String(index)), retrievedAt, includedRecordCount: index ? 0 : records.length }));
	const sha256 = documents ? hash(JSON.stringify(documents.map(({ url, sha256 }) => ({ url, sha256 })))) : hash("example automatic publication");
	return { source, retrievedAt, sha256, records, ...(documents ? { documents } : {}) };
}

async function serve(repository: StateBallotRepository) {
	const app = express();
	registerStateRecordRoutes(app, repository);
	const server = app.listen(0, "127.0.0.1");
	await once(server, "listening");
	const address = server.address();
	assert.ok(address && typeof address === "object");
	return { origin: `http://127.0.0.1:${address.port}`, close: () => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())) };
}

test("county sources are additive and their reviewed configuration retains each original document", () => {
	assert.equal(stateBallotSources.length, 50);
	assert.equal(configuredStateBallotSources.length, 60);
	assert.deepEqual(configuredStateBallotSources.slice(0, 50).filter(source => source.stateCode !== "GA"), stateBallotSources.filter(source => source.stateCode !== "GA"));
	assert.equal(configuredStateBallotSources.find(source => source.id === "ga-fulton-2026")!.format, "fulton-pdf");
	assert.equal(new Set(configuredStateBallotSources.map(source => source.id)).size, 60);
	assert.equal(new Set(configuredStateBallotSources.map(source => source.stateCode)).size, 51);
	const reviewed = additionalStateBallotSources.filter(source => source.retrievalPolicy === "manual-snapshot");
	assert.equal(reviewed.length, 6);
	assert.equal(additionalStateBallotSources.filter(source => !source.retrievalPolicy).length, 4);
	for (const source of reviewed) {
		assert.equal(source.retrievalPolicy, "manual-snapshot");
		assert.equal(source.snapshotStorage, "external");
		assert.equal(source.documentUrls?.length, [parish.id, "ky-warren-candidates-2026", "ar-pulaski-candidates-2026"].includes(source.id) ? 1 : 2);
		assert.deepEqual(source.documentLinks?.map(link => link.url), source.documentUrls);
		assert.deepEqual(source.withheldDistrictScopes, ["congressional", "state-senate", "state-house"]);
		if (source.id === "ar-pulaski-candidates-2026") assert.equal(source.scopeNotice, "Local coverage: Pulaski County.");
		else assert.match(source.scopeNotice!, /County|Parish/u);
	}
});

test("Tuscola remains a separate external source with no automatic legislative assignment", () => {
	const tuscola = additionalStateBallotSources.find(source => source.id === "mi-tuscola-candidates-2026")!;
	const michigan = stateBallotSources.find(source => source.id === "mi-dos-2026")!;
	assert.deepEqual(resolveStateBallotConfiguration({ STATE_BALLOT_ENABLED_STATES: "MI" }).sources, [michigan, tuscola]);
	assert.deepEqual(resolveStateBallotConfiguration({ STATE_BALLOT_ENABLED_SOURCES: tuscola.id }).sources, [tuscola]);
	assert.equal(tuscola.retrievalPolicy, "manual-snapshot");
	assert.equal(tuscola.snapshotStorage, "external");
	assert.deepEqual(tuscola.withheldDistrictScopes, ["congressional", "state-senate", "state-house"]);
	assert.match(tuscola.scopeNotice!, /Township, village, school, library and judicial districts vary by voter/u);
});

test("Warren County remains separate from the Kentucky filing feed and never assigns local rows by district", () => {
	const warren = additionalStateBallotSources.find(source => source.id === "ky-warren-candidates-2026")!;
	const kentucky = stateBallotSources.find(source => source.id === "ky-sos-2026")!;
	assert.ok(warren && kentucky);
	assert.equal(warren.format, "reviewed-pdf");
	assert.equal(warren.retrievalPolicy, "manual-snapshot");
	assert.equal(warren.snapshotStorage, "external");
	assert.deepEqual(warren.documentUrls, ["https://warrencountyclerk.ky.gov/wp-content/uploads/2026/09/Warren-2026G.pdf"]);
	assert.deepEqual(resolveStateBallotConfiguration({ STATE_BALLOT_ENABLED_SOURCES: `${kentucky.id},${warren.id}` }).sources.map(source => source.id).sort(), [kentucky.id, warren.id].sort());
	const local = snapshot(warren);
	local.records = local.records.filter(record => record.scope === "local");
	assert.equal(buildStateBallotPreview(local, { districtMatches: [{ id: "example-house", label: "House 1", districtType: "state-house", districtCode: "1", sourceSystem: "census-geocoder" }] }), null);
});

test("Pulaski retains Washington County and withholds unverified local and district assignments", () => {
	const pulaski = additionalStateBallotSources.find(source => source.id === "ar-pulaski-candidates-2026")!;
	const washington = stateBallotSources.find(source => source.id === "ar-washington-2026")!;
	assert.equal(pulaski.format, "reviewed-pdf");
	assert.equal(pulaski.retrievalPolicy, "manual-snapshot");
	assert.equal(pulaski.snapshotStorage, "external");
	assert.deepEqual(resolveStateBallotConfiguration({ STATE_BALLOT_ENABLED_STATES: "AR" }).sources, [washington, pulaski]);
	const local = snapshot(pulaski);
	local.records = local.records.filter(record => record.scope !== "statewide");
	assert.equal(buildStateBallotPreview(local, { districtMatches: [{ id: "example-house", label: "House 1", districtType: "state-house", districtCode: "1", sourceSystem: "census-geocoder" }] }), null);
});

test("state and source allowlists validate independently and intersect without replacing primary entries", () => {
	assert.equal(resolveStateBallotConfiguration({}).sources.length, 60);
	assert.equal(resolveStateBallotConfiguration({ STATE_BALLOT_ENABLED_STATES: "NC,NM" }).sources.length, 4);
	assert.deepEqual(resolveStateBallotConfiguration({ STATE_BALLOT_ENABLED_SOURCES: ` ${county.id},${otherCounty.id} ` }).sources, [county, otherCounty]);
	assert.deepEqual(resolveStateBallotConfiguration({ STATE_BALLOT_ENABLED_STATES: "LA", STATE_BALLOT_ENABLED_SOURCES: parish.id }).sources, [parish]);
	assert.deepEqual(resolveStateBallotConfiguration({ STATE_BALLOT_ENABLED_STATES: "nc", STATE_BALLOT_ENABLED_SOURCES: county.id }).sources, [county]);
	for (const environment of [{ STATE_BALLOT_ENABLED_SOURCES: "unknown" }, { STATE_BALLOT_ENABLED_SOURCES: "" }, { STATE_BALLOT_ENABLED_SOURCES: otherCounty.id, STATE_BALLOT_ENABLED_STATES: "NC" }])
		assert.throws(() => resolveStateBallotConfiguration(environment), /enabled source/u);
});

test("an explicitly selected county never requests or silently switches to its primary source", async (context) => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-county-selected-"));
	context.after(() => rm(directory, { recursive: true, force: true }));
	const expected = snapshot();
	let requests = 0;
	const repository = createStateBallotRepository({ sources: [primary, county], dataDirectory: directory, now: () => now, fetchText: async () => {
		requests += 1;
		throw new Error("No publisher requests.");
	} });
	assert.equal(await repository.getSnapshot("NC", county.id), null);
	await createStateBallotStorage(directory).write(expected);
	assert.deepEqual(await repository.getSnapshot("nc", county.id), expected);
	assert.equal(await repository.getSnapshot("NM", county.id), null);
	assert.equal(await repository.getSnapshot("NC", "unknown"), null);
	assert.equal(await repository.getSnapshot("NC", ""), null);
	assert.equal(requests, 0);
	assert.deepEqual(await createStateBallotRepository({ sources: [county], dataDirectory: directory, now: () => now }).getSnapshot("NC"), expected);
});

test("default selection falls back with its own provenance, while an unavailable explicit primary stays unavailable", async (context) => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-county-fallback-"));
	context.after(() => rm(directory, { recursive: true, force: true }));
	await createStateBallotStorage(directory).write(snapshot());
	let requests = 0;
	const repository = createStateBallotRepository({ sources: [primary, county], dataDirectory: directory, now: () => now, fetchText: async (source) => {
		requests += 1;
		assert.equal(source.id, primary.id);
		throw new Error("Controlled transport failure.");
	} });
	assert.deepEqual(await repository.getSnapshot("NC"), snapshot());
	assert.equal(await repository.getSnapshot("NC", primary.id), null);
	assert.equal(requests, 1);
	const original = snapshot(primary);
	await createStateBallotStorage(directory).write(original);
	const restarted = createStateBallotRepository({ sources: [primary, county], dataDirectory: directory, now: () => now, fetchText: async () => {
		throw new Error("No publisher requests.");
	} });
	assert.deepEqual(await restarted.getSnapshot("NC"), original);
	assert.deepEqual(await restarted.getSnapshot("NC", county.id), snapshot());
});

test("manual source failure and recovery cannot leak or erase a neighboring county or its primary", async (context) => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-county-recovery-"));
	context.after(() => rm(directory, { recursive: true, force: true }));
	const alternative: StateBallotSource = { ...county, id: "nc-example-other-county" };
	const storage = createStateBallotStorage(directory);
	const repository = createStateBallotRepository({ sources: [county, alternative, otherCounty], dataDirectory: directory, now: () => now });
	await storage.write(snapshot(alternative));
	await storage.write(snapshot(otherCounty));
	assert.equal(await repository.getSnapshot("NC", county.id), null);
	assert.equal((await repository.getSnapshot("NC"))?.source.id, alternative.id);
	assert.equal((await repository.getSnapshot("NM"))?.source.id, otherCounty.id);
	await storage.write(snapshot());
	assert.equal((await repository.getSnapshot("NC"))?.source.id, county.id);
	assert.equal((await repository.getSnapshot("NC", alternative.id))?.source.id, alternative.id);
});

test("reviewed county previews never assign local or unverified legislative records by numeric coincidence", () => {
	for (const source of additionalStateBallotSources.filter(source => source.retrievalPolicy === "manual-snapshot")) {
		const preview = buildStateBallotPreview(snapshot(source), { districtMatches: ["congressional", "state-senate", "state-house"].map(districtType => ({ id: `example-${districtType}`, label: "Example", districtType, districtCode: "1", sourceSystem: "census-geocoder" })) });
		assert.equal(preview?.candidateCount, 1);
		assert.equal(preview?.id, source.id);
		assert.equal(preview?.sourceUrl, source.pageUrl);
		assert.match(preview!.disclaimer, /County|Parish/u);
	}
});

test("the parish source preserves its unofficial mixed-stage publication without enabling a state portal", async (context) => {
	assert.equal(parish.stateCode, "LA");
	assert.match(parish.scopeNotice!, /Senate general and U\.S\. House primary/u);
	assert.deepEqual(parish.withheldStatewideOffices, ["Member, Louisiana Public Service Commission District 1"]);
	assert.ok(parish.documentUrls?.every(url => new URL(url).host === "www.stcharlesparish.gov"));
	const directory = await mkdtemp(join(tmpdir(), "ballot-parish-reviewed-"));
	context.after(() => rm(directory, { recursive: true, force: true }));
	let requests = 0;
	const repository = createStateBallotRepository({ sources: [parish], dataDirectory: directory, now: () => now, fetchText: async () => {
		requests += 1;
		throw new Error("No live parish or state requests.");
	} });
	assert.equal(await repository.getSnapshot("LA"), null);
	await createStateBallotStorage(directory).write(snapshot(parish));
	const loaded = await repository.getSnapshot("LA");
	assert.deepEqual(loaded, snapshot(parish));
	assert.equal(buildStateBallotPreview(loaded!, { districtMatches: [] })?.candidateCount, 1);
	assert.equal(requests, 0);
});

test("source selection and fallback remain closed after the election window", async (context) => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-county-expired-"));
	context.after(() => rm(directory, { recursive: true, force: true }));
	await createStateBallotStorage(directory).write(snapshot());
	const repository = createStateBallotRepository({ sources: [county], dataDirectory: directory, now: () => Date.parse("2026-11-05T00:00:00Z") });
	assert.equal(await repository.getSnapshot("NC"), null);
	assert.equal(await repository.getSnapshot("NC", county.id), null);
	assert.throws(() => createStateBallotRepository({ sources: [county, county] }), /unique/u);
});

test("public source controls validate before reads and preserve the chosen source on fallback", async (context) => {
	let reads = 0;
	const api = await serve({ sources: [primary, county, otherCounty], async getSnapshot(stateCode, sourceId) {
		reads += 1;
		assert.equal(stateCode, "NC");
		if (sourceId === primary.id) return null;
		assert.ok(sourceId === undefined || sourceId === county.id);
		return snapshot();
	} });
	context.after(api.close);
	const states = await (await fetch(`${api.origin}/api/state-records`)).json();
	assert.deepEqual(states.states.find((state: { stateCode: string }) => state.stateCode === "NC").sources.map((source: { id: string }) => source.id), [primary.id, county.id]);
	assert.equal(reads, 0);
	for (const query of ["source=unknown", `source=${otherCounty.id}`, "source=", `source=${county.id}&source=${county.id}`, "source[id]=x"])
		assert.equal((await fetch(`${api.origin}/api/state-records/NC?${query}`)).status, 400);
	assert.equal(reads, 0);
	for (const query of ["", `?source=${county.id}`]) {
		const result = await (await fetch(`${api.origin}/api/state-records/NC${query}`)).json();
		assert.equal(result.source.id, county.id);
		assert.equal(result.source.url, county.pageUrl);
		assert.equal(result.source.label, county.label);
		assert.deepEqual(result.source.documentLinks, county.documentLinks);
		assert.equal(result.total, 5);
	}
	const absent = await (await fetch(`${api.origin}/api/state-records/NC?source=${primary.id}`)).json();
	assert.equal(absent.available, false);
	assert.equal(absent.source.id, primary.id);
	assert.equal(absent.total, 0);
});

test("a mismatched or silently substituted selected source fails closed", async (context) => {
	const api = await serve({ sources: [primary, county, otherCounty], async getSnapshot() {
		return snapshot();
	} });
	context.after(api.close);
	assert.equal((await fetch(`${api.origin}/api/state-records/NC?source=${primary.id}`)).status, 503);
	assert.equal((await fetch(`${api.origin}/api/state-records/NM`)).status, 503);
});

test("multi-source exports carry source identity per row without changing legacy distinct-state exports", () => {
	const first = snapshot();
	const second = snapshot(otherCounty);
	const legacy = serializeStateBallotSnapshots([first, second]).trim().split("\n").map(line => JSON.parse(line));
	assert.equal(legacy[0].schemaVersion, 1);
	assert.equal(legacy[0].states.length, 2);
	assert.equal(legacy[1].sourceId, undefined);
	const alternative = snapshot({ ...county, id: "nc-example-other-county" });
	const multiple = serializeStateBallotSnapshots([first, alternative]).trim().split("\n").map(line => JSON.parse(line));
	assert.equal(multiple[0].schemaVersion, 2);
	assert.equal(multiple[0].sources.length, 2);
	assert.equal(multiple[0].states, undefined);
	assert.equal(multiple[1].sourceId, county.id);
	assert.equal(multiple[6].sourceId, alternative.source.id);
	assert.throws(() => serializeStateBallotSnapshots([first, first]), /distinct/u);
	assert.throws(() => serializeStateBallotSnapshots([]), /distinct/u);
	assert.equal(parseBundledStateSnapshot(county, JSON.stringify({ schemaVersion: 1, stateCode: "NC", sourceId: county.id, electionDate: county.electionDate, sourceUrl: county.pageUrl, retrievalPolicy: "manual-snapshot", retrievedAt: first.retrievedAt, sourceSha256: first.sha256, recordCount: first.records.length, records: first.records, documents: first.documents })).source.id, county.id);
});
