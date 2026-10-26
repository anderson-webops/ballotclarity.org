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
import { discoverStateBallotElectionCycles, getStateBallotCycleFamily, parseStateBallotCycleCatalog, stateBallotCycleSources } from "../src/state-ballot-cycles.js";
import { fetchStateBallotSourceText } from "../src/state-ballot-fetch.js";
import { fetchIowaJohnsonCandidateCapture, fetchIowaJohnsonCycleDiscovery, iowaJohnsonDiscoveryUrl, iowaJohnsonPolicyFingerprint, iowaJohnsonPolicyReceipts, parseIowaJohnsonCandidateCapture, readIowaJohnsonCandidatePage, readIowaJohnsonDiscovery, validateIowaJohnsonSource } from "../src/state-ballot-iowa-johnson.js";
import { createStateCandidateRecord, isActiveStateCandidateRecord, parseStateCandidateRecords } from "../src/state-ballot-records.js";
import { configuredStateBallotSources } from "../src/state-ballot-registry.js";
import { attachStateBallotPreview, buildStateBallotPreview, createStateBallotRepository } from "../src/state-ballot-repository.js";
import { parseBundledStateSnapshot } from "../src/state-ballot-snapshot.js";
import { createStateBallotStorage, serializeStoredStateSnapshot } from "../src/state-ballot-storage.js";

const source = configuredStateBallotSources.find(source => source.id === "ia-johnson-2026")!;
const fixture = readFileSync(new URL("./fixtures/iowa-johnson-candidates.html", import.meta.url), "utf8");
const indexFixture = readFileSync(new URL("./fixtures/iowa-johnson-index.html", import.meta.url), "utf8");
const retrievedAt = "2026-10-26T03:00:00.000Z";
const now = Date.parse("2026-10-26T05:00:00.000Z");
const hash = (body: string) => createHash("sha256").update(body).digest("hex");
const page = (body: string, url: string, clock = retrievedAt) => ({ url, body, sha256: hash(body), retrievedAt: clock });
function capture(body = fixture, index = indexFixture, clock = retrievedAt, url = source.pageUrl) {
	return JSON.stringify({ schemaVersion: 1, type: "iowa-johnson-candidate-capture", policies: iowaJohnsonPolicyReceipts, index: page(index, iowaJohnsonDiscoveryUrl, clock), pages: [page(body, url, clock)] });
}
const read = (body = fixture) => readIowaJohnsonCandidatePage(source, body, createStateCandidateRecord);
const future = (body: string) => body.replaceAll("2026", "2028").replaceAll("November 3", "November 7").replaceAll("november-3-", "november-7-");

test("Johnson County supplies 102 candidates while keeping six measures, nine empty offices and a not-on-ballot seat separate", () => {
	validateIowaJohnsonSource(source);
	const result = read();
	assert.equal(result.records.length, 102);
	assert.equal(result.records.filter(isActiveStateCandidateRecord).length, 102);
	assert.deepEqual(Object.fromEntries(["statewide", "congressional", "state-senate", "state-house", "local"].map(scope => [scope, result.records.filter(record => record.scope === scope).length])), { "statewide": 18, "congressional": 3, "state-senate": 2, "state-house": 9, "local": 70 });
	assert.equal(result.emptyOffices.length, 9);
	assert.equal(result.questions.length, 6);
	assert.equal(result.excludedOffices.length, 1);
	assert.ok(!result.records.some(record => record.scope === "state-senate" && record.district === "46"));
	assert.ok(result.records.every(record => record.status === "listed" && !/^(?:Yes|No|Public Measure)/u.test(record.name)));
	assert.match(result.questions.find(question => question.title.startsWith("Public Measure MA:"))!.text, /\$6,900,000/u);
	assert.deepEqual(parseStateCandidateRecords(source, capture()), result.records);
});

test("County facts retain running-mate tickets, literal parties, named jurisdictions and printed term/seat limits", () => {
	const { records } = read();
	assert.equal(records.find(record => record.name === "Rob Sand / Dave Muhlbauer")?.office, "Governor and Lieutenant Governor");
	assert.equal(records.find(record => record.name === "Michael Bridgford")?.party, "No Party");
	assert.equal(records.find(record => record.name === "Lisa Green-Douglass")?.termYears, 4);
	assert.equal(records.find(record => record.name === "Jon Green")?.termYears, 2);
	const vacancy = records.find(record => record.name === "Adam Brandt")!;
	assert.equal(vacancy.jurisdiction, "Clear Creek Township, Johnson County");
	assert.equal(vacancy.termYears, 2);
	assert.equal(vacancy.seats, 2);
	assert.equal(vacancy.voteLimit, 2);
	assert.ok(records.some(record => record.name === "Casey Williams"));
	assert.ok(records.some(record => record.name === "Wayne Barnes"));
	assert.equal(records.find(record => record.name === "Katherine Ciecior")?.voteLimit, 5);
	assert.equal(records.find(record => record.name === "Corey Johnson")?.voteLimit, 2);
	assert.ok(!records.some(record => record.status === "unopposed" || record.status === "elected"));
});

test("Judicial retention is explicit without guessing a regional district or copying a scheduling incumbent", () => {
	const judges = read().records.filter(record => record.sourceStatus === "Judicial retention election");
	assert.equal(judges.length, 9);
	assert.equal(judges.filter(record => record.scope === "statewide").length, 3);
	assert.equal(judges.filter(record => record.scope === "local").length, 6);
	assert.ok(judges.every(record => !record.district && !record.jurisdiction && record.office.includes(record.name)));
	assert.ok(judges.every(record => record.incumbent === undefined && record.party === undefined));
});

test("Addresses, contact numbers and protected email links remain outside candidate exports", () => {
	const body = fixture.replace("Josh Turek, Democratic Party", "Josh Turek, Democratic Party<br>123 Example Street<br>Example City, IA 50001<br>515-555-0123<br><a href='/cdn-cgi/l/email-protection#synthetic'>[email protected]</a>");
	assert.deepEqual(read(body), read());
	assert.ok(read(body).records.every(record => !record.candidateUrl));
	assert.ok(!JSON.stringify(read(body).records).includes("Example Street"));
	assert.throws(() => read(fixture.replace("Josh Turek, Democratic Party", "Josh Turek, Unknown Party")), /requires review/u);
	assert.throws(() => read(fixture.replace("Agricultural Extension Council (five to be elected)", "Water Board")), /requires review/u);
});

test("Offered-date discovery ignores the historical results link and binds every current publication", () => {
	const discovery = readIowaJohnsonDiscovery(capture(), now);
	assert.deepEqual(discovery.elections, [{ electionId: null, electionDate: "2026-11-03", pageUrl: source.pageUrl }]);
	const catalog = discoverStateBallotElectionCycles(capture(), source.id, now);
	assert.deepEqual(stateBallotCycleSources(catalog, now), []);
	assert.equal(getStateBallotCycleFamily(source.id).discoveryUrl, iowaJohnsonDiscoveryUrl);
	assert.throws(() => readIowaJohnsonDiscovery(capture(fixture, indexFixture.replace("november-3-2026", "november-4-2026")), now), /identity/u);
	const value = JSON.parse(capture());
	value.pages = [];
	assert.throws(() => readIowaJohnsonDiscovery(JSON.stringify(value), now), /contract/u);
	value.pages = [page(fixture, source.pageUrl), page(fixture, source.pageUrl)];
	assert.throws(() => readIowaJohnsonDiscovery(JSON.stringify(value), now), /incomplete/u);
	assert.throws(() => parseStateBallotCycleCatalog({ ...catalog, elections: [...catalog.elections, ...catalog.elections] }, now), /duplicated/u);
});

test("Future published pages reuse the family and explicit presidential tickets without treating synthetic names as evidence", () => {
	const futureNow = Date.parse("2028-10-26T05:00:00.000Z");
	const body = future(fixture).replace("U.S. Senator (six year term)", "President and Vice President").replace("Josh Turek, Democratic Party", "Example President and Example Vice President, Democratic Party").replace("Ashley Hinson, Republican Party", "Other President and Other Vice President, Republican Party").replace("Thomas Laehn, Libertarian Party", "Third President and Third Vice President, Libertarian Party");
	const futureUrl = source.pageUrl.replace("november-3-2026", "november-7-2028");
	const bodyCapture = capture(body, future(indexFixture), "2028-10-26T03:00:00.000Z", futureUrl);
	const catalog = discoverStateBallotElectionCycles(bodyCapture, source.id, futureNow);
	const futureSource = stateBallotCycleSources(catalog, futureNow)[0]!;
	validateIowaJohnsonSource(futureSource);
	assert.equal(futureSource.pageUrl, futureUrl);
	assert.deepEqual(futureSource.documentUrls, [futureUrl]);
	assert.equal(futureSource.id, "ia-johnson-general-2028-11-07");
	const parsed = parseIowaJohnsonCandidateCapture(futureSource, bodyCapture, createStateCandidateRecord, futureNow);
	assert.equal(parsed.records.find(record => record.office === "President and Vice President")?.name, "Example President / Example Vice President");
	assert.throws(() => parseIowaJohnsonCandidateCapture(source, bodyCapture, createStateCandidateRecord, futureNow), /selected election/u);
	assert.throws(() => parseIowaJohnsonCandidateCapture(futureSource, bodyCapture.replace("Example President and Example Vice President", "Example President"), createStateCandidateRecord, futureNow), /provenance/u);
});

test("Publication and source drift fail closed without silently dropping candidate sections", () => {
	for (const body of [
		fixture.replace("November 3, 2026 General Election", "November 3, 2026 Primary Election"),
		fixture.replace("Federal Offices", "Federal Offices and More"),
		fixture.replace("<dd>", "<dd hidden>"),
		fixture.replace("<dd>", "<dd><form><input></form>"),
		fixture.replace("District 43 map", "District forty-three map"),
		fixture.replace("Penn and Jefferson townships will elect three trustees", "Penn and Jefferson townships will elect two trustees"),
		fixture.replace("Public Measure MA:", "Public Measure LY:"),
	]) assert.throws(() => read(body));
	assert.throws(() => validateIowaJohnsonSource({ ...source, countyName: "Story County" }), /source/u);
	assert.throws(() => validateIowaJohnsonSource({ ...source, url: "https://example.com/" }), /source/u);
	assert.throws(() => validateIowaJohnsonSource({ ...source, retrievalPolicy: "manual-snapshot" }), /source/u);
});

test("Only reviewed government-service licensing links are excluded from the website-policy inventory", () => {
	const original = iowaJohnsonPolicyFingerprint(fixture, source.pageUrl);
	const service = fixture.replace("</main>", "<a href='/auditor/alcohol-tobacco-licensing'>Alcohol-Tobacco Licenses</a></main>");
	assert.equal(iowaJohnsonPolicyFingerprint(service, source.pageUrl), original);
	assert.notEqual(iowaJohnsonPolicyFingerprint(fixture.replace("</main>", "<a href='/data-license'>Data license</a></main>"), source.pageUrl), original);
	assert.notEqual(iowaJohnsonPolicyFingerprint(fixture.replace("Copyright 2019", "Copyright 2028"), source.pageUrl), original);
	assert.throws(() => read(fixture.replace("</main>", "<a href='/terms'>Terms of use</a></main>")), /legal-link/u);
});

test("A changed access policy stops the ordinary pinned transport before candidate acquisition", async () => {
	const requests: string[] = [];
	await assert.rejects(fetchStateBallotSourceText(source, async (url, options) => {
		requests.push(url);
		assert.equal(options.maxRedirects, 0);
		assert.equal(options.timeoutMs, 25000);
		assert.deepEqual(options.allowedHosts, ["johnsoncountyiowa.gov"]);
		return "User-agent: *\nDisallow: /\n";
	}), /policy requires review/u);
	assert.deepEqual(requests, ["https://johnsoncountyiowa.gov/robots.txt"]);
	await assert.rejects(fetchIowaJohnsonCycleDiscovery({ requestText: async () => {
		throw new Error("publisher unavailable");
	}, wait: async () => {} }), /publisher unavailable/u);
	assert.equal(await fetchIowaJohnsonCandidateCapture(source, { discovery: capture(), now: () => now }), capture());
});

test("The scheduled family persists current data, preserves cached clocks and validates every metadata field on cold reads", async () => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-ia-johnson-"));
	try {
		const options = { familyId: source.id, catalogPath: join(directory, "cycles.json"), dataDirectory: directory, fetchDiscovery: async () => capture(), fetchCandidates: async () => capture(), now: () => now };
		const first = await syncStateBallotCycles(options);
		assert.equal(first.results[0]!.status, "available");
		assert.equal(first.results[0]!.records, 102);
		assert.equal(first.results[0]!.imported, true);
		const second = await syncStateBallotCycles({ ...options, fetchCandidates: async () => {
			throw new Error("unchanged data must remain cached");
		} });
		assert.equal(second.results[0]!.status, "available");
		assert.equal(second.results[0]!.imported, false);
		assert.equal(second.results[0]!.retrievedAt, first.results[0]!.retrievedAt);
		const snapshot = (await createStateBallotStorage(directory).read(source))!;
		assert.deepEqual(snapshot.records, JSON.parse(JSON.stringify(read().records)));
		const serialized = serializeStoredStateSnapshot(snapshot);
		assert.deepEqual(parseBundledStateSnapshot(source, serialized, "automatic").records, snapshot.records);
		const corrupt = JSON.parse(serialized);
		corrupt.records[0].voteLimit = 0;
		assert.throws(() => parseBundledStateSnapshot(source, JSON.stringify(corrupt), "automatic"), /vote limit/u);
		const repository = createStateBallotRepository({ sources: [source], dataDirectory: directory, now: () => now, fetchText: async () => {
			throw new Error("cold read must not request publisher");
		} });
		assert.equal((await repository.getSnapshot("IA", source.id))!.records.length, 102);
		const preview = buildStateBallotPreview(snapshot, { districtMatches: [{ id: "cd-1", districtType: "congressional", districtCode: "1", label: "Congressional District 1", sourceSystem: "U.S. Census Geocoder" }] });
		assert.equal(preview!.candidateCount, 21);
		assert.ok(!preview!.contests.some(contest => contest.candidates.some(candidate => candidate.name === "Adam Brandt")));
	}
	finally {
		await rm(directory, { recursive: true, force: true });
	}
});

test("County preference uses a verified Johnson County match and preserves unrelated, approximate and unavailable fallbacks", async (context) => {
	context.mock.method(Date, "now", () => now);
	const snapshot = { source, ...parseIowaJohnsonCandidateCapture(source, capture(), createStateCandidateRecord, now) };
	const requested: Array<string | undefined> = [];
	const repository: StateBallotRepository = { sources: [source], getSnapshot: async (_state, id) => {
		requested.push(id);
		return id === source.id ? snapshot : null;
	} };
	const lookup = (labels: string[]) => ({ result: "resolved", inputKind: "zip", location: { state: "Iowa" }, districtMatches: labels.map(label => ({ id: label, label, districtType: "county", districtCode: "103", sourceSystem: "U.S. Census Geocoder" })) }) as LocationLookupResponse;
	const resolved = await attachStateBallotPreview(lookup(["Johnson County"]), repository);
	assert.equal(requested[0], source.id);
	assert.equal(resolved.ballotContentPreviews![0]!.id, source.id);
	assert.equal(resolved.ballotContentPreviews![0]!.candidateCount, 18);
	for (const labels of [["Story County"], ["Johnson County", "Story County"], []]) {
		requested.length = 0;
		await attachStateBallotPreview(lookup(labels), repository);
		assert.deepEqual(requested, [undefined]);
	}
	requested.length = 0;
	await attachStateBallotPreview({ ...lookup(["Johnson County"]), detectedFromIp: true }, repository);
	assert.deepEqual(requested, [undefined]);
	const failed: Array<string | undefined> = [];
	await attachStateBallotPreview(lookup(["Johnson County"]), { ...repository, getSnapshot: async (_state, id) => {
		failed.push(id);
		return null;
	} });
	assert.deepEqual(failed, [source.id, undefined]);
});

test("Explicit future waiting pages persist as pending and automatically import when the same published page gains records", async () => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-ia-johnson-pending-"));
	try {
		const futureNow = Date.parse("2028-10-26T05:00:00.000Z");
		const futureUrl = source.pageUrl.replace("november-3-2026", "november-7-2028");
		const pendingBody = future(fixture).replace(/<dl[\s\S]+<\/dl>/u, "<p>Candidate information will be posted</p>");
		const pending = capture(pendingBody, future(indexFixture), "2028-10-26T03:00:00.000Z", futureUrl);
		const options = { familyId: source.id, catalogPath: join(directory, "cycles.json"), dataDirectory: directory, fetchDiscovery: async () => pending, now: () => futureNow };
		const first = await syncStateBallotCycles(options);
		assert.equal(first.results[0]!.status, "awaiting-records");
		assert.equal(first.results[0]!.imported, false);
		const futureSource = stateBallotCycleSources(discoverStateBallotElectionCycles(pending, source.id, futureNow), futureNow)[0]!;
		assert.equal(await createStateBallotStorage(directory).read(futureSource), null);
		assert.ok(await createStateBallotStorage(directory).readPending(futureSource, futureNow));
		const filled = capture(future(fixture), future(indexFixture), "2028-10-26T03:00:00.000Z", futureUrl);
		const second = await syncStateBallotCycles({ ...options, fetchDiscovery: async () => filled });
		assert.equal(second.results[0]!.status, "available");
		assert.equal(second.results[0]!.records, 102);
		assert.equal(second.results[0]!.imported, true);
		const reader = createStateBallotRepository({ sources: [futureSource], dataDirectory: directory, now: () => futureNow, fetchText: async () => {
			throw new Error("Accepted future records must survive a cold read.");
		} });
		assert.equal((await reader.getSnapshot("IA", futureSource.id))!.records.length, 102);
		assert.equal(reader.isAwaitingRecords!(futureSource.id), false);
	}
	finally {
		await rm(directory, { recursive: true, force: true });
	}
});
