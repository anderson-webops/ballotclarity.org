import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { syncStateBallotCycles } from "../src/state-ballot-cycle-sync.js";
import { discoverStateBallotElectionCycles, getStateBallotCycleFamily, parseStateBallotCycleCatalog, readStateBallotCycleCatalog, stateBallotCycleSources } from "../src/state-ballot-cycles.js";
import { fetchJuneauCandidateCapture, fetchJuneauCycleDiscovery, juneauDiscoveryUrl, juneauPolicyReceipts, juneauSource, parseJuneauCandidateCapture, readJuneauCandidatePage, readJuneauDiscovery, validateJuneauElection, validateJuneauSource } from "../src/state-ballot-juneau.js";
import { createStateCandidateRecord, parseStateCandidateRecords } from "../src/state-ballot-records.js";
import { configuredStateBallotSources } from "../src/state-ballot-registry.js";
import { buildStateBallotPreview, createStateBallotRepository } from "../src/state-ballot-repository.js";
import { parseBundledStateSnapshot } from "../src/state-ballot-snapshot.js";
import { serializeStoredStateSnapshot } from "../src/state-ballot-storage.js";

const source = juneauSource();
const fixture = readFileSync(new URL("./fixtures/juneau-candidates.html", import.meta.url), "utf8");
const index = readFileSync(new URL("./fixtures/juneau-index.html", import.meta.url), "utf8");
const retrievedAt = "2026-09-25T12:00:00.000Z";
const now = Date.parse("2026-09-25T12:30:00.000Z");
const hash = (body: string) => createHash("sha256").update(body).digest("hex");
const futurePage = (body: string) => body.replaceAll("2026", "2027").replace("October 6, 2027", "October 5, 2027");
function capture(body: string | null = fixture, offered = index, clock = retrievedAt) {
	const year = body?.match(/October [1-7], (20\d{2})/u)?.[1] ?? "2026";
	const page = (body: string, url: string) => ({ url, body, sha256: hash(body), retrievedAt: clock });
	return JSON.stringify({ schemaVersion: 1, type: "juneau-candidate-capture", policies: juneauPolicyReceipts, index: page(offered, juneauDiscoveryUrl), page: body === null ? null : page(body, `https://juneau.org/clerk/certified-municipal-candidates-${year}`) });
}
const read = (body = fixture) => readJuneauCandidatePage(source, body, createStateCandidateRecord);

test("Juneau certifies municipal choices without inventing party, incumbency, results or voter districts", () => {
	const records = read();
	assert.equal(records.length, 5);
	assert.ok(records.every(record => record.scope === "local" && record.status === "qualified" && record.district === "" && record.termYears === 3 && !record.party && !record.incumbent && !record.candidateUrl));
	assert.equal(records[3]!.seats, 2);
	assert.equal(source.ballotPreview, false);
	assert.equal(buildStateBallotPreview({ source, records, retrievedAt, sha256: hash(fixture) }, { districtMatches: [] }), null);
	assert.deepEqual(parseStateCandidateRecords(source, capture()), records);
	assert.deepEqual(configuredStateBallotSources.find(item => item.id === source.id), source);
	assert.equal(configuredStateBallotSources.find(item => item.id === "ak-doe-2026")?.retrievalPolicy, "manual-snapshot");
});

test("Juneau dates and sources bind the actual October municipal slate independently of state-election dates", () => {
	validateJuneauSource(Object.fromEntries(Object.entries(source).reverse()) as typeof source);
	for (const altered of [{ ...source, stateCode: "GA" }, { ...source, ballotPreview: undefined }, { ...source, electionDate: "2026-11-03" }, { ...source, countyName: "Anchorage" }]) assert.throws(() => validateJuneauSource(altered), /review/u);
	for (const body of [fixture.replace("October 6", "October 7"), fixture.replace("CERTIFIED MUNICIPAL CANDIDATES", "Candidate Filings"), fixture.replace("at-large", "by district"), fixture.replace("2026/08/rivera", "2025/08/rivera")]) assert.throws(() => read(body), /review/u);
	assert.throws(() => validateJuneauElection({ electionId: null, electionDate: "2027-10-06", pageUrl: source.pageUrl }), /review/u);
});

test("Juneau rejects concealed, incomplete, duplicate and unsupported candidate rows", () => {
	for (const body of [fixture.replace("class=\"fusion-text\"", "class=\"fusion-text\" hidden"), fixture.replace("<b>Example Ford", "<b style=\"display:none\">Example Ford"), fixture.replace("Example Brown", "Example Smith"), fixture.replace("Example Ford", "Example Ford withdrawn"), fixture.replace("Assembly District 2", "Assembly District 3"), fixture.replace(/<p><b>Example Brown[\s\S]*?<\/p>/u, "<p>Candidate pending</p>"), fixture.replace("<b>Example Ford", "<b><span hidden>Example</span> Ford")]) assert.throws(() => read(body), /review|duplicated|incomplete/u);
	assert.throws(() => parseJuneauCandidateCapture(source, capture(), createStateCandidateRecord, now, [...read(), { ...read()[0]!, id: "f".repeat(24) }]), /disappeared/u);
	assert.throws(() => read(fixture.replace("Phone: 555-0100", "Withdrawn September 20, 2026")), /review/u);
	assert.throws(() => read(fixture.replace("</main>", "<p><b>Extra Person [<a href=\"https://juneau.org/wp-content/uploads/2026/08/extra.pdf\">Official Candidate Statement</a>]</b></p></main>")), /beyond/u);
});

test("Juneau discovery follows offered annual publications and normalizes only the copyright year", async () => {
	const futureNow = Date.parse("2027-09-25T12:00:00.000Z");
	const body = capture(futurePage(fixture), futurePage(index), new Date(futureNow).toISOString());
	const catalog = discoverStateBallotElectionCycles(body, source.id, futureNow);
	const futureSource = stateBallotCycleSources(catalog, futureNow)[0]!;
	assert.equal(futureSource.id, "ak-juneau-municipal-2027-10-05");
	assert.equal(getStateBallotCycleFamily(source.id).discoveryUrl, juneauDiscoveryUrl);
	assert.equal(parseJuneauCandidateCapture(futureSource, body, createStateCandidateRecord, futureNow).records.length, 5);
	assert.equal(await fetchJuneauCandidateCapture(futureSource, { discovery: body, now: () => futureNow }), body);
	await assert.rejects(fetchJuneauCandidateCapture(source, { discovery: body, now: () => futureNow }), /does not offer/u);
	assert.throws(() => parseStateBallotCycleCatalog({ ...catalog, elections: [...catalog.elections, ...catalog.elections] }, futureNow), /duplicated/u);
});

test("Juneau capture provenance rejects unoffered pages, tampering, clock inversion and policy changes", () => {
	const value = JSON.parse(capture());
	for (const altered of [{ ...value, extra: true }, { ...value, policies: [] }, { ...value, page: { ...value.page, url: "https://example.com/" } }, { ...value, page: { ...value.page, sha256: "0".repeat(64) } }, { ...value, page: { ...value.page, retrievedAt: "2026-09-24T00:00:00.000Z" } }, { ...value, index: { ...value.index, retrievedAt: "2027-01-01T00:00:00.000Z" } }]) assert.throws(() => readJuneauDiscovery(JSON.stringify(altered), now), /review|offered/u);
	assert.throws(() => read(fixture.replace("</footer>", "<a href=\"/privacy\">New policy</a></footer>")), /legal/u);
	assert.throws(() => readJuneauDiscovery(capture(fixture, index.replace(source.pageUrl, "https://example.com/certified-municipal-candidates-2026")), now), /review/u);
});

test("Juneau absence is pending and never constructs a future roster URL", async () => {
	const offered = index.replace(/<a href="https:\/\/juneau.org\/clerk\/certified-municipal-candidates-2026">[\s\S]*?<\/a>/u, "");
	assert.deepEqual(readJuneauDiscovery(capture(null, offered), now).elections, []);
	assert.equal(discoverStateBallotElectionCycles(capture(null, offered), source.id, now).elections.length, 0);
	await assert.rejects(fetchJuneauCandidateCapture(source, { discovery: capture(null, offered), now: () => now }), /does not offer/u);
});

test("Juneau external snapshots survive repeat, restart, archive access and tamper checks", async () => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-juneau-"));
	try {
		const options = { sources: [source], dataDirectory: directory, collectionIndexSha256: { [source.id]: hash(fixture) }, now: () => now, fetchText: async () => capture() };
		const snapshot = await createStateBallotRepository(options).getSnapshot("AK", source.id);
		assert.ok(snapshot);
		assert.equal(snapshot.collectionIndexSha256, hash(fixture));
		const serialized = serializeStoredStateSnapshot(snapshot);
		const records = JSON.parse(JSON.stringify(snapshot.records));
		assert.deepEqual(parseBundledStateSnapshot(source, serialized, "automatic").records, records);
		const altered = JSON.parse(serialized);
		altered.collectionIndexSha256 = "0".repeat(64);
		assert.throws(() => parseBundledStateSnapshot(source, JSON.stringify(altered), "automatic"), /index/u);
		const restarted = createStateBallotRepository({ ...options, fetchText: async () => {
			throw new Error("Network not expected");
		} });
		assert.deepEqual((await restarted.getSnapshot("AK", source.id))?.records, records);
		const archived = createStateBallotRepository({ ...options, now: () => Date.parse("2026-11-07T00:00:00.000Z"), fetchText: async () => {
			throw new Error("Publisher unavailable");
		} });
		assert.equal(await archived.getSnapshot("AK"), null);
		assert.deepEqual((await archived.getSnapshot("AK", source.id))?.records, records);
	}
	finally { await rm(directory, { recursive: true, force: true }); }
});

test("Juneau cycle synchronization retains active and expired editions through failure and later publication", async () => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-juneau-cycles-"));
	try {
		const options = { familyId: source.id, catalogPath: join(directory, "catalog.json"), dataDirectory: join(directory, "data"), now: () => now, fetchDiscovery: async () => capture() };
		assert.equal((await syncStateBallotCycles(options)).results[0]?.records, 5);
		const first = await readFile(options.catalogPath, "utf8");
		await assert.rejects(syncStateBallotCycles({ ...options, fetchDiscovery: async () => capture(futurePage(fixture), futurePage(index)) }), /active.*disappeared/u);
		assert.equal(await readFile(options.catalogPath, "utf8"), first);
		const futureNow = Date.parse("2027-09-25T12:00:00.000Z");
		const result = await syncStateBallotCycles({ ...options, now: () => futureNow, fetchDiscovery: async () => capture(futurePage(fixture), futurePage(index), new Date(futureNow).toISOString()) });
		assert.deepEqual(result.results.map(item => item.status), ["expired", "available"]);
		await assert.rejects(syncStateBallotCycles({ ...options, now: () => futureNow, fetchDiscovery: async () => {
			throw new Error("Publisher unavailable");
		} }), /Publisher unavailable/u);
		assert.equal(readStateBallotCycleCatalog(options.catalogPath, futureNow)?.elections.length, 2);
	}
	finally { await rm(directory, { recursive: true, force: true }); }
});

test("Juneau collection checks current policy before accessing content and pins ordinary HTTPS transport", async () => {
	const urls: string[] = [];
	await assert.rejects(fetchJuneauCycleDiscovery({ requestText: async (url) => {
		urls.push(url);
		return "User-agent: *\nDisallow: /\n";
	}, wait: async () => {}, now: () => now }), /policy requires review/u);
	assert.deepEqual(urls, ["https://juneau.org/robots.txt"]);
	const robots = "Sitemap: https://beta.juneau.org/sitemap.xml\nSitemap: https://beta.juneau.org/news-sitemap.xml\nUser-agent: *\nDisallow: /secupress-6f4ce522/\nDisallow: /wp-admin/\nDisallow: /wp-includes/\nDisallow: /wp-content/mu-plugins/\nDisallow: /wp-content/plugins/\nDisallow: /wp-content/themes/\nAllow: /wp-admin/admin-ajax.php";
	urls.length = 0;
	const body = await fetchJuneauCycleDiscovery({ requestText: async (url, options) => {
		urls.push(url);
		assert.equal(options.maxRedirects, 0);
		assert.deepEqual(options.allowedHosts, ["juneau.org"]);
		return url.endsWith("robots.txt") ? robots : url === juneauDiscoveryUrl ? index : fixture;
	}, wait: async () => {}, now: () => now });
	assert.deepEqual(urls, ["https://juneau.org/robots.txt", juneauDiscoveryUrl, source.pageUrl]);
	assert.equal(readJuneauDiscovery(body, now).elections[0]?.electionDate, source.electionDate);
});
