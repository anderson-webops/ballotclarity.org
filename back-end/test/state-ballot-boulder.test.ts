import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { boulderPolicyReceipts, fetchBoulderCandidateCapture, fetchBoulderCycleDiscovery, parseBoulderCandidateCapture, readBoulderDiscovery, validateBoulderElection } from "../src/state-ballot-boulder-collection.js";
import { boulderBallotIndexUrl, boulderDiscoveryUrl, boulderHash, boulderSource, readBoulderCandidates, validateBoulderSource } from "../src/state-ballot-boulder.js";
import { syncStateBallotCycles } from "../src/state-ballot-cycle-sync.js";
import { discoverStateBallotElectionCycles, getStateBallotCycleFamily, parseStateBallotCycleCatalog, stateBallotCycleSources } from "../src/state-ballot-cycles.js";
import { createStateCandidateRecord, parseStateCandidateRecords } from "../src/state-ballot-records.js";
import { configuredStateBallotSources } from "../src/state-ballot-registry.js";
import { buildStateBallotPreview, createStateBallotRepository } from "../src/state-ballot-repository.js";
import { parseBundledStateSnapshot } from "../src/state-ballot-snapshot.js";
import { StateBallotAwaitingRecordsError } from "../src/state-ballot-source-state.js";
import { createStateBallotStorage, serializeStoredStateSnapshot } from "../src/state-ballot-storage.js";
import { stateRecordDocumentLinks } from "../src/state-records.js";

const legal = JSON.parse(readFileSync(new URL("./fixtures/boulder-policy-links.json", import.meta.url), "utf8")) as { links: string[]; footer: string[] };
const source = boulderSource("2026-11-03");
const now = () => Date.parse("2026-11-02T23:00:00.000Z");
const capturedAt = "2026-11-02T22:00:00.000Z";
const escape = (value: string) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
const frame = (body: string) => `<html><body><div id="content">${body}</div><nav>${legal.links.map(url => `<a href="${url}">Policy</a>`).join("")}</nav>${legal.footer.map(value => `<footer>${escape(value)}</footer>`).join("")}</body></html>`;
const candidateUrl = (year: string) => `https://bouldercounty.gov/elections/information/${year}-general-election-candidates-and-ballot-measures/`;
const table = (office: string, names: string[]) => `<h3>${office}</h3><table><tr><th>Candidate Name/Link to Website</th><th>Public Email</th></tr>${names.map(name => `<tr><td><a href="https://candidate.example/${encodeURIComponent(name)}">${name}</a></td><td>private@example.test</td></tr>`).join("")}</table>`;
const publication = (year = "2026") => frame(`<h1>${year} General Election Candidates and Ballot Measures</h1><h2>Federal Offices</h2>${table("United States Senator", ["Alex Example", "Robin Example (Certified Write-in Candidate)"])}${table("Representative to the 120th United States Congress – District 2", ["House Example"])}<h2>State Offices</h2>${table("Governor/Lieutenant Governor", ["Governor Example/Deputy Example"])}${table("State Senator – District 17", ["Senate Example"])}${table("State Representative – District 10", ["Delegate Example"])}${table("Regent of the University of Colorado – Congressional District 2", ["Regent Example"])}${table("Regional Transportation District Director – District O", ["Transit Example"])}<h2>County Offices</h2>${table("Boulder County Commissioner – District 3", ["County Example"])}<h3>Boulder County Surveyor</h3><p>Candidate Name/Link to Website <a href="https://surveyor.example/">Surveyor Example</a></p><p>Contact Form Surveyor Example Contact Form</p><h2>City of Boulder</h2>${table("City of Boulder Mayoral Candidates", ["Alex Example"])}<h2>Town of Superior</h2><h3>Town of Superior Mayor</h3><p>Candidate Name Alex Example</p><p>Public Email None found</p><h2>Judicial Retention Questions</h2><p>Retention names stay outside the competitive candidate roster.</p><h2>State Ballot Measures</h2><p>Measure text is not a candidate.</p>`);
function capture({ year = "2026", day = "3", candidates = publication(year), offered = true, retrievedAt = capturedAt } = {}) {
	const page = (url: string, body: string) => ({ url, body, sha256: boulderHash(body), retrievedAt });
	return JSON.stringify({ schemaVersion: 1, type: "boulder-candidate-capture", policies: boulderPolicyReceipts, index: page(boulderDiscoveryUrl, frame(`<h1>Nov. ${day}, ${year} General Election Information</h1><a href="${boulderBallotIndexUrl}">Ballot information</a><h1>Events</h1>`)), ballotIndex: page(boulderBallotIndexUrl, frame(offered ? `<a href="${candidateUrl(year)}">${year} General Election Candidates and Ballot Measures</a>` : "<h1>Ballot information</h1>")), candidates: offered ? page(candidateUrl(year), candidates) : null });
}
const parse = (body = capture()) => parseBoulderCandidateCapture(source, body, createStateCandidateRecord, now());

test("Boulder reads table and paragraph candidates without storing contact details or inferring parties", () => {
	const result = parse();
	assert.equal(result.records.length, 12);
	assert.equal(result.records.filter(record => record.candidateUrl).length, 11);
	assert(result.records.every(record => record.party === undefined && record.incumbent === undefined));
	assert.equal(result.records.filter(record => record.status === "write-in").length, 1);
	assert.equal(result.records.find(record => record.status === "write-in")?.sourceStatus, "Certified Write-in Candidate");
	assert(!JSON.stringify(result).includes("private@example.test"));
	assert.deepEqual(parseStateCandidateRecords(source, capture()), result.records);
	assert(result.records.some(record => record.name === "Governor Example/Deputy Example"));
});

test("Boulder keeps local identities, transit and regents separate from congressional races", () => {
	const records = parse().records;
	const mayors = records.filter(record => record.office === "Mayor");
	assert.equal(mayors.length, 2);
	assert.notEqual(mayors[0]!.id, mayors[1]!.id);
	assert.deepEqual(mayors.map(record => record.jurisdiction), ["City of Boulder, Colorado", "Town of Superior, Colorado"]);
	assert.equal(records.find(record => record.name === "Regent Example")?.scope, "local");
	assert.equal(records.find(record => record.name === "Transit Example")?.district, "O");
	assert.equal(records.filter(record => record.scope === "congressional").length, 1);
	assert.equal(buildStateBallotPreview({ source, ...parse() }, { districtMatches: [] }), null);
});

test("Boulder holds changed, hidden, incomplete or duplicate candidate tables", () => {
	for (const [before, after] of [["Public Email</th>", "Unknown field</th>"], ["United States Senator", "Unreviewed Office"], ["<table>", "<table hidden>"], ["<table>", "<table><tr><td colspan=\"2\">Unexpected</td></tr>"], ["<td>private@example.test</td>", ""], ["2026 General Election Candidates", "2028 General Election Candidates"], ["https://candidate.example/Alex%20Example", "javascript:alert(1)"], ["<h2>County Offices</h2>", "<h2>Unsupported jurisdiction</h2>"], ["<h2>Judicial Retention Questions</h2>", ""]]) {
		assert.throws(() => parse(capture({ candidates: publication().replace(before, after) })), /requires review/u, before);
	}
	assert.throws(() => readBoulderCandidates(source, publication().replace("<h2>State Offices</h2>", `${table("United States Senator", ["Other Example"])}<h2>State Offices</h2>`), createStateCandidateRecord), /requires review/u);
});

test("Boulder requires exact offered URLs, date agreement, semantic policy links and original hashes", () => {
	for (const update of [(value: any) => {
		value.candidates.sha256 = "0".repeat(64);
	}, (value: any) => {
		value.candidates.url = candidateUrl("2028");
	}, (value: any) => {
		value.index.body = value.index.body.replace("Nov. 3, 2026", "Nov. 4, 2026");
		value.index.sha256 = boulderHash(value.index.body);
	}, (value: any) => {
		value.candidates.body += "<a href=\"https://bouldercounty.gov/new-terms/\">Terms</a>";
		value.candidates.sha256 = boulderHash(value.candidates.body);
	}, (value: any) => {
		value.policies = [];
	}, (value: any) => {
		value.candidates.retrievedAt = "2030-01-01T00:00:00.000Z";
	}]) {
		const value = JSON.parse(capture());
		update(value);
		assert.throws(() => readBoulderDiscovery(JSON.stringify(value), now()), /requires review/u);
	}
	assert.throws(() => validateBoulderSource({ ...source, stateCode: "NM" }), /requires review/u);
	assert.throws(() => validateBoulderSource({ ...source, url: "https://example.test/" }), /requires review/u);
});

test("Boulder discovers future cycles from printed dates and offered links without editing acquisition URLs", async () => {
	for (const [year, day, date] of [["2028", "7", "2028-11-07"], ["2030", "5", "2030-11-05"]]) {
		const body = capture({ year, day });
		const catalog = discoverStateBallotElectionCycles(body, source.id, now());
		assert.deepEqual(parseStateBallotCycleCatalog(catalog, now()), catalog);
		const sources = stateBallotCycleSources(catalog, now());
		assert.equal(sources.length, 1);
		assert.deepEqual(sources[0], boulderSource(date!));
		assert.equal(await fetchBoulderCandidateCapture(sources[0]!, { discovery: body, now }), body);
		assert.equal(parseBoulderCandidateCapture(sources[0]!, body, createStateCandidateRecord, now()).records.length, 12);
	}
	assert.equal(getStateBallotCycleFamily(source.id).format, "boulder-html");
	assert.equal(configuredStateBallotSources.find(item => item.id === "co-sos-2026")?.retrievalPolicy, "manual-snapshot");
});

test("Boulder pending publication is distinct from access failures and missing accepted records", () => {
	const pending = capture({ year: "2028", day: "7", offered: false });
	const future = boulderSource("2028-11-07");
	assert.throws(() => parseBoulderCandidateCapture(future, pending, createStateCandidateRecord, now()), StateBallotAwaitingRecordsError);
	assert.throws(() => parseBoulderCandidateCapture(future, pending, createStateCandidateRecord, now(), { records: parse().records }), /requires review/u);
	assert.throws(() => readBoulderDiscovery(capture({ offered: false }), Date.parse("2026-11-04T00:00:00Z")), /requires review/u);
	assert.throws(() => parseBoulderCandidateCapture(source, capture({ candidates: publication().replace("<h3>Town of Superior Mayor</h3><p>Candidate Name Alex Example</p><p>Public Email None found</p>", "") }), createStateCandidateRecord, now(), { records: parse().records }), /requires review/u);
	assert.throws(() => validateBoulderElection({ electionId: null, electionDate: "2028-11-07", pageUrl: candidateUrl("2028"), boulderContentSha256: null }), /requires review/u);
});

test("Boulder access-policy failures stop before candidate acquisition with ordinary bounded transport", async () => {
	const robots = "# START YOAST BLOCK\n# ---------------------------\nUser-agent: *\nDisallow:\n\nSitemap: https://bouldercounty.gov/sitemap_index.xml\n# ---------------------------\n# END YOAST BLOCK\n";
	const requests: string[] = [];
	const waits: number[] = [];
	await assert.rejects(fetchBoulderCycleDiscovery({ now, wait: async (milliseconds) => {
		waits.push(milliseconds);
	}, requestText: async (url, options) => {
		requests.push(url);
		assert.deepEqual(options, { allowedHosts: ["bouldercounty.gov"], maxBytes: 1024 * 1024, maxRedirects: 0, timeoutMs: 25000 });
		return url.endsWith("robots.txt") ? robots : "<div id=\"content\">Changed policy requires independent review before collecting any candidates.</div>";
	} }), /requires review/u);
	assert.equal(requests.length, 2);
	assert.deepEqual(waits, [20_000]);
	await assert.rejects(fetchBoulderCycleDiscovery({ requestText: async () => {
		throw new Error("HTTP 403");
	} }), /HTTP 403/u);
});

test("Boulder stored snapshots retain original clocks through import, stale offline reads and restart", async () => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-boulder-"));
	try {
		const snapshot = { source, ...parse() };
		const storedSnapshot = JSON.parse(JSON.stringify(snapshot));
		const serialized = serializeStoredStateSnapshot(snapshot);
		assert.deepEqual(parseBundledStateSnapshot(source, serialized, "automatic"), storedSnapshot);
		const storage = createStateBallotStorage(directory);
		await storage.write(snapshot);
		let requests = 0;
		for (let repeat = 0; repeat < 2; repeat++) {
			const reader = createStateBallotRepository({ sources: [source], dataDirectory: directory, now: () => now() + 86400000, fetchText: async () => {
				requests++;
				throw new Error("No visitor collection");
			} });
			assert.deepEqual(await reader.getSnapshot("CO", source.id), storedSnapshot);
		}
		assert.equal(requests, 0);
		assert.deepEqual(stateRecordDocumentLinks(source, snapshot), [{ label: "Candidate websites", url: candidateUrl("2026") }]);
		for (const modify of [(value: any) => {
			value.documents[0].url = candidateUrl("2028");
		}, (value: any) => {
			value.collectionIndexSha256 = "0".repeat(64);
		}]) {
			const value = JSON.parse(serialized);
			modify(value);
			assert.throws(() => parseBundledStateSnapshot(source, JSON.stringify(value), "automatic"), /invalid|requires review/u);
		}
	}
	finally { await rm(directory, { recursive: true, force: true }); }
});

test("Boulder cycle collection reuses discovery and retains accepted catalog and records on disappearance", async () => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-boulder-cycle-"));
	const catalogPath = join(directory, "cycles.json");
	const dataDirectory = join(directory, "snapshots");
	try {
		const options = { familyId: source.id, catalogPath, dataDirectory, enabledSourceIds: [source.id], now, fetchDiscovery: async () => capture() };
		await syncStateBallotCycles(options);
		const bytes = await readFile(catalogPath, "utf8");
		assert.equal((await createStateBallotStorage(dataDirectory).read(source))?.records.length, 12);
		await syncStateBallotCycles(options);
		await assert.rejects(syncStateBallotCycles({ ...options, fetchDiscovery: async () => capture({ offered: false }) }), /disappeared/u);
		assert.equal(await readFile(catalogPath, "utf8"), bytes);
		const reader = createStateBallotRepository({ sources: [source], dataDirectory, now });
		assert.equal((await reader.getSnapshot("CO", source.id))?.records.length, 12);
	}
	finally { await rm(directory, { recursive: true, force: true }); }
});

test("Boulder future recurring collection advances from durable pending publication without a source-code edit", async () => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-boulder-future-"));
	try {
		const futureNow = () => Date.parse("2028-11-01T12:00:00.000Z");
		const future = boulderSource("2028-11-07");
		const options = { familyId: source.id, catalogPath: join(directory, "catalog.json"), dataDirectory: join(directory, "snapshots"), now: futureNow };
		const futureCapture = (offered: boolean) => capture({ year: "2028", day: "7", retrievedAt: "2028-11-01T11:00:00.000Z", offered });
		await syncStateBallotCycles({ ...options, fetchDiscovery: async () => futureCapture(false) });
		const storage = createStateBallotStorage(options.dataDirectory);
		assert(await storage.readPending(future, futureNow()));
		assert.equal(await storage.read(future), null);
		await syncStateBallotCycles({ ...options, fetchDiscovery: async () => futureCapture(true) });
		const retained = await storage.read(future);
		assert.equal(retained?.records.length, 12);
		assert.equal(retained?.retrievedAt, "2028-11-01T11:00:00.000Z");
		const restarted = createStateBallotRepository({ sources: [future], dataDirectory: options.dataDirectory, now: futureNow });
		assert.equal((await restarted.getSnapshot("CO", future.id))?.records.length, 12);
	}
	finally { await rm(directory, { recursive: true, force: true }); }
});

test("Boulder explicit workers retain accepted data during an outage and recover on a valid publication", async () => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-boulder-outage-"));
	try {
		const storage = createStateBallotStorage(directory);
		await storage.write({ source, ...parse() });
		const options = { sources: [source], dataDirectory: directory, now: () => now() + 86400000, refreshReviewedLegacy: true };
		const failed = createStateBallotRepository({ ...options, fetchText: async () => {
			throw new Error("HTTP 503 controlled outage");
		} });
		assert.equal(await failed.getSnapshot("CO", source.id), null);
		assert.equal((await storage.read(source))?.retrievedAt, capturedAt);
		const publicReader = createStateBallotRepository({ sources: [source], dataDirectory: directory, now: options.now });
		assert.equal((await publicReader.getSnapshot("CO", source.id))?.records.length, 12);
		const recovered = createStateBallotRepository({ ...options, fetchText: async () => capture() });
		assert.equal((await recovered.getSnapshot("CO", source.id))?.records.length, 12);
		assert.equal((await storage.read(source))?.retrievedAt, capturedAt);
	}
	finally { await rm(directory, { recursive: true, force: true }); }
});
