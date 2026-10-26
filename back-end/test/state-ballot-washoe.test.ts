import type { StateBallotRepository } from "../src/state-ballot-repository.js";
import type { LocationLookupResponse } from "../src/types/civic.js";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { syncStateBallotCycles } from "../src/state-ballot-cycle-sync.js";
import { discoverStateBallotElectionCycles, getStateBallotCycleFamily, stateBallotCycleSources } from "../src/state-ballot-cycles.js";
import { fetchStateBallotSourceText } from "../src/state-ballot-fetch.js";
import { createStateCandidateRecord, isActiveStateCandidateRecord, parseStateCandidateRecords, stateRecordMatchesDistricts } from "../src/state-ballot-records.js";
import { configuredStateBallotSources } from "../src/state-ballot-registry.js";
import { attachStateBallotPreview, buildStateBallotPreview, createStateBallotRepository } from "../src/state-ballot-repository.js";
import { parseBundledStateSnapshot } from "../src/state-ballot-snapshot.js";
import { createStateBallotStorage, serializeStoredStateSnapshot } from "../src/state-ballot-storage.js";
import { fetchWashoeCandidateCapture, fetchWashoeCycleDiscovery, parseWashoeCandidateCapture, readWashoeCandidatePage, readWashoeDiscovery, validateWashoeSource, washoeDiscoveryUrl, washoePolicyReceipts } from "../src/state-ballot-washoe.js";

const source = configuredStateBallotSources.find(source => source.id === "nv-washoe-2026")!;
const fixture = readFileSync(new URL("./fixtures/nevada-washoe-candidates.html", import.meta.url), "utf8");
const now = Date.parse("2026-10-25T02:00:00.000Z");
const capturedAt = "2026-10-25T00:00:00.000Z";
const hash = (body: string) => createHash("sha256").update(body).digest("hex");
const read = (body = fixture) => readWashoeCandidatePage(source, body, createStateCandidateRecord);
function capture(body = fixture, retrievedAt = capturedAt) {
	return JSON.stringify({ schemaVersion: 1, type: "washoe-candidate-capture", policies: washoePolicyReceipts, page: { url: washoeDiscoveryUrl, body, sha256: hash(body), retrievedAt } });
}
const futureBody = () => fixture.replaceAll("2026", "2028").replaceAll("November 3,", "November 7,");

test("Washoe County reads all 57 offices and 103 entries without turning questions or nonperson options into candidates", () => {
	validateWashoeSource(source);
	const result = read();
	assert.equal(result.records.length, 103);
	assert.equal(result.offices, 57);
	assert.equal(result.nonpersonOptions.length, 8);
	assert.equal(result.questions.length, 3);
	assert.equal(result.records.filter(isActiveStateCandidateRecord).length, 102);
	assert.equal(new Set(result.records.map(record => record.id)).size, 103);
	assert.deepEqual(Object.fromEntries(["statewide", "congressional", "state-senate", "state-house", "local"].map(scope => [scope, result.records.filter(record => record.scope === scope).length])), { "statewide": 18, "congressional": 3, "state-senate": 6, "state-house": 14, "local": 62 });
	assert.deepEqual(parseStateCandidateRecords(source, capture()), result.records);
});

test("Washoe County preserves parties, suffixes, multi-seat limits and separate local jurisdictions", () => {
	const { records } = read();
	assert.ok(records.some(record => record.name === "Martin W. Breitmeyer, III"));
	assert.ok(records.some(record => record.name === "Danielle Ford" && record.party === "No Political Party"));
	assert.ok(records.some(record => record.office === "Mayor" && record.jurisdiction === "City of Reno"));
	assert.ok(records.some(record => record.office === "Mayor" && record.jurisdiction === "City of Sparks"));
	assert.equal(records.filter(record => record.voteLimit === 2).length, 7);
	assert.equal(records.filter(record => record.voteLimit === 3).length, 5);
	assert.ok(records.filter(record => record.scope === "local").every(record => record.sourceAreaLabel === "Washoe County"));
	assert.ok(records.filter(record => record.office.startsWith("District Court Judge")).every(record => record.party === undefined));
	assert.ok(records.every(record => record.ballotDesignation === undefined));
	assert.ok(records.filter(record => record.scope === "local").every(record => !stateRecordMatchesDistricts(record, [{ id: "county:031", label: "Washoe County", districtType: "county", districtCode: "031", sourceSystem: "U.S. Census Geocoder" }])));
});

test("Washoe County retains the deceased candidate's printed presence without calling that person active", () => {
	const deceased = read().records.find(record => record.name === "Lance White")!;
	assert.equal(deceased.status, "inactive");
	assert.equal(deceased.sourceStatus, "Deceased; name remains on ballot");
	assert.equal(deceased.termYears, 6);
	assert.equal(isActiveStateCandidateRecord(deceased), false);
	assert.throws(() => read(fixture.replace("Lance White", "Unknown Person")), /unique matching/u);
	assert.throws(() => read(fixture.replace("class=\"candidate-death-notice\"", "class=\"unrecognized-notice\"")), /notice structure/u);
	assert.throws(() => read(fixture.replace(/<h2[^>]*>County Ballot Questions<\/h2>/u, "")), /question scope|incomplete/u);
});

test("Washoe County keeps statewide questions separate from its nonbinding county question", () => {
	const { questions, nonpersonOptions } = read();
	assert.deepEqual(questions.map(question => question.scope), ["statewide", "statewide", "local"]);
	assert.match(questions[2]!.question, /^THIS QUESTION IS ADVISORY AND NON-BINDING:/u);
	assert.equal(nonpersonOptions.filter(option => option.title.startsWith("SUPREME COURT JUSTICE")).length, 2);
});

test("Washoe County holds unknown offices, parties, vote instructions and unpaired name suffixes", () => {
	for (const [before, after] of [["REPRESENTATIVE IN CONGRESS, DISTRICT 2", "UNREVIEWED OFFICE"], [">DEM<", ">UNKNOWN<"], ["Vote for Two", "Vote for Four"], ["Breitmeyer, III, Martin W.", "Breitmeyer, Unknown, Martin W."], [">Candidate<", ">Person<"], ["Statewide Partisan Offices", "Unknown Partisan Offices"]]) {
		assert.notEqual(fixture.replace(before!, after!), fixture);
		assert.throws(() => read(fixture.replace(before!, after!)), /Washoe County/u);
	}
	assert.throws(() => read(fixture.replace("November 3, 2026", "November 7, 2028")), /date/u);
	assert.throws(() => read(fixture.replace("<table", "<table hidden")), /Washoe County/u);
});

test("Washoe County binds source, raw document hash, capture time and the complete stored snapshot", () => {
	const snapshot = { source, ...parseWashoeCandidateCapture(source, capture(), createStateCandidateRecord, now) };
	const stored = serializeStoredStateSnapshot(snapshot);
	assert.deepEqual(parseBundledStateSnapshot(source, stored, "automatic").records, JSON.parse(JSON.stringify(snapshot.records)));
	assert.equal(snapshot.sha256, hash(fixture));
	assert.equal(snapshot.collectionIndexSha256, hash(fixture));
	for (const mutate of [
		(value: Record<string, any>) => { value.page.sha256 = "a".repeat(64); },
		(value: Record<string, any>) => { value.page.url = "https://www.washoecounty.gov/repository/private"; },
		(value: Record<string, any>) => { value.page.retrievedAt = "2099-01-01T00:00:00.000Z"; },
		(value: Record<string, any>) => { value.policies.pop(); },
		(value: Record<string, any>) => { value.extra = true; },
	]) {
		const value = JSON.parse(capture());
		mutate(value);
		assert.throws(() => readWashoeDiscovery(JSON.stringify(value), now), /Washoe County/u);
	}
	const changed = JSON.parse(stored);
	changed.collectionIndexSha256 = "a".repeat(64);
	assert.throws(() => parseBundledStateSnapshot(source, JSON.stringify(changed), "automatic"), /publication index/u);
});

test("Washoe County discovers a synthetic future election without guessing a future URL", async () => {
	const body = capture(futureBody());
	const catalog = discoverStateBallotElectionCycles(body, source.id, now);
	const future = stateBallotCycleSources(catalog, now)[0]!;
	validateWashoeSource(future);
	assert.equal(future.id, "nv-washoe-general-2028-11-07");
	assert.equal(future.pageUrl, washoeDiscoveryUrl);
	assert.equal((await fetchWashoeCandidateCapture(future, { discovery: body, now: () => now })), body);
	assert.equal(parseWashoeCandidateCapture(future, body, createStateCandidateRecord, now).records.length, 103);
	assert.throws(() => parseWashoeCandidateCapture(source, body, createStateCandidateRecord, now), /another election/u);
	const otherClock = discoverStateBallotElectionCycles(capture(fixture, "2026-10-25T01:00:00.000Z"), source.id, now);
	assert.equal(otherClock.discovery.sha256, discoverStateBallotElectionCycles(capture(), source.id, now).discovery.sha256);
	assert.equal(getStateBallotCycleFamily(source.id).source, source);
});

test("Washoe County stops changed policies before requesting candidate data and retains strict public transport", async () => {
	const requests: string[] = [];
	await assert.rejects(fetchWashoeCycleDiscovery({ requestText: async (url, options) => {
		requests.push(url);
		assert.deepEqual(options.allowedHosts, ["www.washoecounty.gov"]);
		assert.equal(options.maxRedirects, 0);
		return "User-agent: *\nDisallow: /\n";
	}, wait: async () => {} }), /policy requires review/u);
	assert.deepEqual(requests, ["https://www.washoecounty.gov/robots.txt"]);
	await assert.rejects(fetchStateBallotSourceText({ ...source, countyName: "Another County" }, async () => {
		throw new Error("Must not request.");
	}), /identity/u);
});

test("Washoe County persists an actual roster, preserves cached clocks and detects a changed publication", async (context) => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-washoe-"));
	context.after(() => rm(directory, { recursive: true, force: true }));
	let time = now;
	let body = capture();
	let requests = 0;
	const options = { familyId: source.id, catalogPath: join(directory, "cycles.json"), dataDirectory: directory, now: () => time, fetchDiscovery: async () => body, fetchCandidates: async () => {
		requests++;
		return body;
	} };
	const first = await syncStateBallotCycles(options);
	assert.equal(first.results[0]!.records, 103);
	assert.equal(first.results[0]!.imported, true);
	const original = await createStateBallotStorage(directory).read(source);
	assert.ok(original);
	time += 1000;
	assert.equal((await syncStateBallotCycles(options)).results[0]!.imported, false);
	assert.equal(requests, 1);
	const cold = await createStateBallotRepository({ sources: [source], dataDirectory: directory, now: () => time, fetchText: async () => {
		throw new Error("No publisher access.");
	} }).getSnapshot("NV", source.id);
	assert.equal(cold!.retrievedAt, original.retrievedAt);
	body = capture(fixture.replace("Flippo, David", "Flippo, David A."));
	await syncStateBallotCycles(options);
	assert.equal(requests, 2);
	assert.ok((await createStateBallotStorage(directory).read(source))!.records.some(record => record.name === "David A. Flippo"));
});

test("Washoe County's future awaiting-publication state refreshes when actual table content appears", async (context) => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-washoe-pending-"));
	context.after(() => rm(directory, { recursive: true, force: true }));
	const future = futureBody();
	const empty = future.replace(/<section[^>]*class="candidate-death-notice"[\s\S]*?<\/section>/u, "").replace(/<h1(?:\s[^>]*)?>All Election Contests<\/h1>[\s\S]*?<\/main>/u, "</main>");
	assert.notEqual(empty, future);
	let body = capture(empty);
	const options = { familyId: source.id, catalogPath: join(directory, "cycles.json"), dataDirectory: directory, now: () => now, fetchDiscovery: async () => body, fetchCandidates: async () => body };
	assert.equal((await syncStateBallotCycles(options)).results[0]!.status, "awaiting-records");
	body = capture(future);
	assert.equal((await syncStateBallotCycles(options)).results[0]!.records, 103);
});

test("county lookup prefers the available matching publication while keeping unknown or ambiguous areas on the existing fallback", async (context) => {
	context.mock.method(Date, "now", () => now);
	const snapshot = { source, ...parseWashoeCandidateCapture(source, capture(), createStateCandidateRecord, now) };
	const requested: Array<string | undefined> = [];
	const repository: StateBallotRepository = { sources: [source], getSnapshot: async (_state, id) => {
		requested.push(id);
		return id === source.id ? snapshot : null;
	} };
	const lookup = (labels: string[]) => ({ result: "resolved", inputKind: "zip", location: { state: "Nevada" }, districtMatches: labels.map(label => ({ id: label, label, districtType: "county", districtCode: "031", sourceSystem: "U.S. Census Geocoder" })) }) as LocationLookupResponse;
	const resolved = await attachStateBallotPreview(lookup(["Washoe County"]), repository);
	assert.equal(requested[0], source.id);
	assert.equal(resolved.ballotContentPreviews![0]!.id, source.id);
	assert.equal(resolved.ballotContentPreviews![0]!.candidateCount, 18);
	assert.ok(!resolved.ballotContentPreviews![0]!.disclaimer.includes("Filing"));
	for (const labels of [["Clark County"], ["Washoe County", "Another County"], []]) {
		requested.length = 0;
		await attachStateBallotPreview(lookup(labels), repository);
		assert.deepEqual(requested, [undefined]);
	}
	requested.length = 0;
	await attachStateBallotPreview({ ...lookup(["Washoe County"]), detectedFromIp: true }, repository);
	assert.deepEqual(requested, [undefined]);
	requested.length = 0;
	await attachStateBallotPreview(lookup(["Washoe County"]), { ...repository, sources: [{ ...source, electionDate: "2020-11-03" }] });
	assert.deepEqual(requested, [undefined]);
	const failedRequests: Array<string | undefined> = [];
	await attachStateBallotPreview(lookup(["Washoe County"]), { ...repository, getSnapshot: async (_state, id) => {
		failedRequests.push(id);
		return null;
	} });
	assert.deepEqual(failedRequests, [source.id, undefined]);
	assert.equal(buildStateBallotPreview(snapshot, { districtMatches: [{ id: "congressional:2", districtType: "congressional", districtCode: "2", label: "Congressional District 2", sourceSystem: "U.S. Census Geocoder" }] })!.candidateCount, 21);
});
