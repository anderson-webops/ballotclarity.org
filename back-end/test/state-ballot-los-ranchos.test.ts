import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { syncStateBallotCycles } from "../src/state-ballot-cycle-sync.js";
import { discoverStateBallotElectionCycles, getStateBallotCycleFamily, parseStateBallotCycleCatalog, readStateBallotCycleCatalog, stateBallotCycleSources } from "../src/state-ballot-cycles.js";
import { fetchLosRanchosCandidateCapture, fetchLosRanchosCycleDiscovery, losRanchosDiscoveryUrl, losRanchosPolicyReceipts, losRanchosSource, parseLosRanchosCandidateCapture, readLosRanchosCandidatePage, readLosRanchosDiscovery, validateLosRanchosElection, validateLosRanchosSource } from "../src/state-ballot-los-ranchos.js";
import { createStateCandidateRecord, parseStateCandidateRecords } from "../src/state-ballot-records.js";
import { configuredStateBallotSources } from "../src/state-ballot-registry.js";
import { buildStateBallotPreview, createStateBallotRepository } from "../src/state-ballot-repository.js";
import { parseBundledStateSnapshot } from "../src/state-ballot-snapshot.js";
import { serializeStoredStateSnapshot } from "../src/state-ballot-storage.js";

const source = losRanchosSource();
const fixture = readFileSync(new URL("./fixtures/los-ranchos.html", import.meta.url), "utf8");
const retrievedAt = "2025-10-25T12:00:00.000Z";
const now = Date.parse("2025-10-25T12:30:00.000Z");
const hash = (body: string) => createHash("sha256").update(body).digest("hex");
const future = (body: string) => body.replaceAll("2025-2026 Election", "2027-2028 Election").replaceAll("2025 Candidate", "2027 Candidate").replaceAll("2025 Regular Local Election; Tuesday, November 4, 2025", "2027 Regular Local Election; Tuesday, November 2, 2027");
function capture(body = fixture, clock = retrievedAt) {
	return JSON.stringify({ schemaVersion: 1, type: "los-ranchos-candidate-capture", policies: losRanchosPolicyReceipts, index: { url: losRanchosDiscoveryUrl, body, sha256: hash(body), retrievedAt: clock } });
}
const read = (body = fixture) => readLosRanchosCandidatePage(source, body, createStateCandidateRecord);

test("Los Ranchos keeps local candidate roles, source qualification, and historical years separate", () => {
	const records = read();
	assert.deepEqual(records.map(record => [record.name, record.office, record.status]), [["Example Rivera", "Trustee At-Large", "qualified"], ["Example Ford", "Trustee At-Large", "qualified"], ["Example Chen", "Municipal Judge", "listed"]]);
	assert.equal(records[2]!.sourceStatus, "Unopposed");
	assert.ok(records.every(record => record.scope === "local" && record.jurisdiction === "Los Ranchos de Albuquerque, New Mexico" && !record.party && !record.incumbent && !record.candidateUrl));
	assert.equal(source.electionDate, "2025-11-04");
	assert.equal(source.ballotPreview, false);
	assert.equal(buildStateBallotPreview({ source, records, retrievedAt, sha256: hash(fixture) }, { districtMatches: [] }), null);
	assert.deepEqual(parseStateCandidateRecords(source, capture()), records);
	assert.deepEqual(configuredStateBallotSources.find(item => item.id === source.id), source);
	assert.equal(configuredStateBallotSources.find(item => item.id === "nm-santa-fe-samples-2026")?.retrievalPolicy, "manual-snapshot");
});

test("Los Ranchos date, alphabet-cycle, guide-year and office bindings reject stale and mixed elections", () => {
	for (const body of [fixture.replace("November 4, 2025", "November 5, 2025"), fixture.replace("2025-2026 Election", "2027-2028 Election"), fixture.replace("2025 Candidate Guide", "2027 Candidate Guide"), fixture.replace("Village of Los Ranchos Election", "Village of Another Place Election"), fixture.replace("Qualified Trustee At-Large Candidates", "Qualified Mayoral Candidates"), fixture.replace("Previous Election information", "Other information"), fixture.replace("2025 Regular Local Election; Tuesday, November 4, 2025", "2026 Regular Local Election; Tuesday, November 3, 2026")]) assert.throws(() => read(body), /review|election/u);
	validateLosRanchosSource(Object.fromEntries(Object.entries(source).reverse()) as typeof source);
	for (const altered of [{ ...source, stateCode: "MN" }, { ...source, ballotPreview: undefined }, { ...source, electionDate: "2026-11-03" }]) assert.throws(() => validateLosRanchosSource(altered), /review/u);
	assert.throws(() => validateLosRanchosElection({ electionId: null, electionDate: "2027-11-03", pageUrl: losRanchosDiscoveryUrl }), /review/u);
});

test("Los Ranchos complete rows reject concealed, empty, unsupported and duplicate choices", () => {
	for (const body of [fixture.replace("class=\"fr-view\"", "class=\"fr-view\" hidden"), fixture.replace("class=\"fr-view\"", "class=\"fr-view\" style=\"display:none\""), fixture.replace("<li>Example Ford", "<li style=\"display:none\">Example Ford"), fixture.replace("Example Ford", "Example Rivera"), fixture.replace("Example Ford", "Example Ford - withdrawn"), fixture.replace("Example Ford", "<span>Example Ford</span>"), fixture.replace("Municipal Judge Example Chen (unopposed)", "Municipal Judge Example Chen"), fixture.replace(/<ul>[\s\S]*?<\/ul>/u, "<ul></ul>")]) assert.throws(() => read(body), /review|duplicated|empty/u);
	assert.throws(() => parseLosRanchosCandidateCapture(source, capture(), createStateCandidateRecord, now, [...read(), { ...read()[0]!, id: "f".repeat(24) }]), /disappeared/u);
});

test("Los Ranchos captures bind original HTML, exact policy receipts, source and capture clock", () => {
	const value = JSON.parse(capture());
	assert.equal(readLosRanchosDiscovery(capture(), now).index.retrievedAt, retrievedAt);
	for (const altered of [{ ...value, extra: true }, { ...value, policies: [] }, { ...value, index: { ...value.index, url: "https://example.com/" } }, { ...value, index: { ...value.index, sha256: "0".repeat(64) } }, { ...value, index: { ...value.index, retrievedAt: "2027-01-01T00:00:00.000Z" } }]) assert.throws(() => readLosRanchosDiscovery(JSON.stringify(altered), now), /review/u);
	assert.throws(() => read(fixture.replaceAll("/site/privacy", "/site/changed-policy")), /legal/u);
	assert.throws(() => read(fixture.replace("<h2 class=\"subhead1\">Members</h2>", "<h2>Qualified Mayoral Candidates</h2><h2 class=\"subhead1\">Members</h2>")), /office set requires review/u);
});

test("Los Ranchos future discovery reads an actually supplied odd-year slate without copying newer general-election dates", async () => {
	const futureNow = Date.parse("2027-10-25T12:00:00.000Z");
	const body = capture(future(fixture).replace("Example Rivera", "Future Person"), new Date(futureNow).toISOString());
	const catalog = discoverStateBallotElectionCycles(body, source.id, futureNow);
	const futureSource = stateBallotCycleSources(catalog, futureNow)[0]!;
	assert.equal(futureSource.id, "nm-los-ranchos-local-2027-11-02");
	assert.equal(futureSource.url, source.url);
	assert.equal(getStateBallotCycleFamily(source.id).discoveryUrl, source.url);
	assert.equal(parseLosRanchosCandidateCapture(futureSource, body, createStateCandidateRecord, futureNow).records[0]!.name, "Future Person");
	assert.equal(await fetchLosRanchosCandidateCapture(futureSource, { discovery: body, now: () => futureNow, requestText: async () => {
		throw new Error("Network not expected");
	} }), body);
	await assert.rejects(fetchLosRanchosCandidateCapture(source, { discovery: body, now: () => futureNow }), /does not offer/u);
	assert.throws(() => parseStateBallotCycleCatalog({ ...catalog, elections: [...catalog.elections, ...catalog.elections] }, futureNow), /duplicated/u);
});

test("Los Ranchos external snapshots preserve attribution through repeated runs, restart and tamper checks", async () => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-los-ranchos-"));
	try {
		const options = { sources: [source], dataDirectory: directory, collectionIndexSha256: { [source.id]: hash(fixture) }, now: () => now, fetchText: async () => capture() };
		const snapshot = await createStateBallotRepository(options).getSnapshot("NM", source.id);
		assert.ok(snapshot);
		assert.equal(snapshot.retrievedAt, retrievedAt);
		assert.equal(snapshot.collectionIndexSha256, hash(fixture));
		const serialized = serializeStoredStateSnapshot(snapshot);
		const records = JSON.parse(JSON.stringify(snapshot.records));
		assert.deepEqual(parseBundledStateSnapshot(source, serialized, "automatic").records, records);
		const stored = JSON.parse(serialized);
		stored.collectionIndexSha256 = "0".repeat(64);
		assert.throws(() => parseBundledStateSnapshot(source, JSON.stringify(stored), "automatic"), /index/u);
		const restarted = createStateBallotRepository({ ...options, now: () => now + 1, fetchText: async () => {
			throw new Error("Network not expected");
		} });
		assert.deepEqual((await restarted.getSnapshot("NM", source.id))?.records, records);
		const archived = createStateBallotRepository({ ...options, now: () => Date.parse("2026-11-07T00:00:00.000Z"), fetchText: async () => {
			throw new Error("Publisher unavailable");
		} });
		assert.equal(await archived.getSnapshot("NM"), null);
		assert.deepEqual((await archived.getSnapshot("NM", source.id))?.records, records);
	}
	finally { await rm(directory, { recursive: true, force: true }); }
});

test("Los Ranchos cycle sync holds active disappearance, retains expired editions and survives publisher failure", async () => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-los-ranchos-cycles-"));
	try {
		const options = { familyId: source.id, catalogPath: join(directory, "catalog.json"), dataDirectory: join(directory, "data"), now: () => now, fetchDiscovery: async () => capture() };
		assert.equal((await syncStateBallotCycles(options)).results[0]?.records, 3);
		const first = await readFile(options.catalogPath, "utf8");
		await assert.rejects(syncStateBallotCycles({ ...options, fetchDiscovery: async () => capture(future(fixture)) }), /active.*disappeared/u);
		assert.equal(await readFile(options.catalogPath, "utf8"), first);
		const futureNow = Date.parse("2027-10-25T12:00:00.000Z");
		const result = await syncStateBallotCycles({ ...options, now: () => futureNow, fetchDiscovery: async () => capture(future(fixture), new Date(futureNow).toISOString()) });
		assert.deepEqual(result.results.map(item => item.status), ["expired", "available"]);
		await assert.rejects(syncStateBallotCycles({ ...options, now: () => futureNow, fetchDiscovery: async () => {
			throw new Error("Publisher unavailable");
		} }), /Publisher unavailable/u);
		assert.equal(readStateBallotCycleCatalog(options.catalogPath, futureNow)?.elections.length, 2);
	}
	finally { await rm(directory, { recursive: true, force: true }); }
});

test("Los Ranchos collection rejects changed policy before requesting election content", async () => {
	const urls: string[] = [];
	await assert.rejects(fetchLosRanchosCycleDiscovery({ requestText: async (url) => {
		urls.push(url);
		return "User-agent: *\nDisallow: /\n";
	}, wait: async () => {}, now: () => now }), /policy requires review/u);
	assert.deepEqual(urls, ["https://www.losranchosnm.gov/robots.txt"]);
});
