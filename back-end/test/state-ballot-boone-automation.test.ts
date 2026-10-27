import type { StateBallotWorkbookSheet } from "../src/state-ballot-workbook.js";
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fetchBooneCandidateCapture, fetchBooneCycleDiscovery, parseBooneCandidateCapture, readBooneDiscovery } from "../src/state-ballot-boone-collection.js";
import { booneDiscoveryUrl, booneHash, booneOrigin, boonePolicyFingerprint, boonePolicySha256, booneRobotsSha256, booneSource, readBooneBallotDate, readBooneCandidateIndex, validateBooneElection } from "../src/state-ballot-boone-discovery.js";
import { syncStateBallotCycles } from "../src/state-ballot-cycle-sync.js";
import { discoverStateBallotElectionCycles, getStateBallotCycleFamily, stateBallotCycleSources } from "../src/state-ballot-cycles.js";
import { createStateCandidateRecord, parseStateCandidateRecords } from "../src/state-ballot-records.js";
import { configuredStateBallotSources } from "../src/state-ballot-registry.js";
import { buildStateBallotPreview, createStateBallotRepository } from "../src/state-ballot-repository.js";
import { parseBundledStateSnapshot } from "../src/state-ballot-snapshot.js";
import { StateBallotAwaitingRecordsError } from "../src/state-ballot-source-state.js";
import { createStateBallotStorage } from "../src/state-ballot-storage.js";

const now = Date.parse("2026-10-25T14:00:00.000Z");
const robots = "User-agent: *\nDisallow: /wp-content/uploads/wpo/wpo-plugins-tables-list.json\n\n# START YOAST BLOCK\n# ---------------------------\nUser-agent: *\nDisallow:\n\nSitemap: https://boonecounty.in.gov/sitemap_index.xml\n# ---------------------------\n# END YOAST BLOCK";
const source = booneSource("2026-11-03");
const workbookUrl = (year: string) => `${booneOrigin}/wp-content/uploads/${year}/09/${year}-General-Election-Candidates.xlsx`;
const ballotUrl = (year: string) => `${booneOrigin}/wp-content/uploads/${year}/09/INBOOG${year.slice(-2)}_AllPcts.pdf`;
function index(years = ["2026"], ballotYears = years) {
	return `<html><head><title>Clerk Election Info - Boone County, Indiana</title></head><body>${years.map(year => `<h2>${year} General Election Candidates That Have Filed</h2><a href="${workbookUrl(year)}">${year} General Candidates</a>`).join("")}${ballotYears.map(year => `<a href="${ballotUrl(year)}">${year} General Election Sample Ballots</a>`).join("")}<a href="${booneOrigin}/offices/clerk/marriage-licenses/">File for a Marriage License</a><a href="${booneOrigin}/offices/clerk/marriage-licenses/">Marriage Licenses</a><p>Boone County Government. All Rights Reserved.</p></body></html>`;
}
function sheets(): StateBallotWorkbookSheet[] {
	return [{ sheet: "Sheet1", data: [
		["Candidate Name", null, "Office", "Party", "Address", "Contact"],
		[null, null, "Assessor"],
		["Alex Example", null, null, "R", "Private residence", "private@example.invalid"],
		[null, null, "Clerk"],
		["Blair Example", null, null, "D"],
		[null, null, "Trustee (Center Twp.)"],
		["Casey Example", null, "Do not put on ballot", "I"],
		[null, null, "Western Boone"],
		[null, null, "Clinton"],
		["Drew Example"],
		[null, null, "Jackson"],
		["Drew Example"],
	] }];
}
function ballotText(year: string) {
	const days: Record<string, string> = { 2026: "3", 2027: "2", 2028: "7" };
	return `OFFICIAL BALLOT\nGENERAL ELECTION\nBOONE COUNTY, INDIANA\nNOVEMBER ${days[year]}, ${year}\n=========== ===========\nCenter 01\fOther ballot content\f`;
}
function fixture(options: { year?: string; clock?: number; revision?: string; unavailable?: "workbook" | "ballots"; empty?: boolean; rows?: StateBallotWorkbookSheet[]; home?: string; robots?: string } = {}) {
	const year = options.year ?? "2026";
	const requests: string[] = [];
	const delays: number[] = [];
	const settings = {
		now: () => options.clock ?? now,
		sleep: async (milliseconds: number) => {
			delays.push(milliseconds);
		},
		request: async (url: string) => {
			requests.push(url);
			if (url === `${booneOrigin}/robots.txt`) return { status: 200, body: Buffer.from(options.robots ?? robots), contentType: "text/plain", etag: undefined };
			if (url === `${booneOrigin}/` || url === booneDiscoveryUrl) return { status: 200, body: Buffer.from(url === `${booneOrigin}/` ? options.home ?? index([year]) : index([year])), contentType: "text/html", etag: undefined };
			const role = url === workbookUrl(year) ? "workbook" : url === ballotUrl(year) ? "ballots" : null;
			assert(role, url);
			if (options.unavailable === role) return { status: 404, body: Buffer.from("<html><body>Publication not found</body></html>"), contentType: "text/html", etag: undefined };
			return { status: 200, body: role === "workbook" ? Buffer.concat([Buffer.from([0x50, 0x4B, 0x03, 0x04]), Buffer.from(year + (options.revision ?? "initial"))]) : Buffer.from(`%PDF-${year}`), contentType: role === "workbook" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "application/pdf", etag: undefined };
		},
		readWorkbook: async (_bytes: Buffer, profile?: "standard" | "boone-candidates") => {
			assert.equal(profile, "boone-candidates");
			return options.empty ? [{ sheet: "Sheet1", data: [sheets()[0]!.data[0]!] }] : options.rows ?? sheets();
		},
		extractBallots: async () => ballotText(year)
	};
	return { settings, requests, delays };
}
async function capture(options: Parameters<typeof fixture>[0] = {}) {
	const input = fixture(options);
	const discovery = await fetchBooneCycleDiscovery(input.settings);
	const identity = options?.year === "2028" ? booneSource("2028-11-07") : source;
	const body = await fetchBooneCandidateCapture(identity, { discovery, now: input.settings.now });
	return { ...input, source: identity, discovery, body };
}
function flat(result: ReturnType<typeof parseBooneCandidateCapture>, identity = source) {
	return { schemaVersion: 1, stateCode: identity.stateCode, sourceId: identity.id, electionDate: identity.electionDate, sourceUrl: identity.pageUrl, retrievalPolicy: "automatic", retrievedAt: result.retrievedAt, sourceSha256: result.sha256, recordCount: result.records.length, records: result.records, documents: result.documents, collectionIndexSha256: result.collectionIndexSha256 };
}

test("Boone registration is county-limited and retains its exact reviewed publisher", () => {
	assert.deepEqual(configuredStateBallotSources.find(item => item.id === source.id), source);
	assert.equal(getStateBallotCycleFamily(source.id).format, "boone-xlsx");
	assert.equal(booneHash(robots), booneRobotsSha256);
	assert.equal(boonePolicyFingerprint(index()), boonePolicySha256);
	assert.equal(source.ballotPreview, false);
	assert.equal(booneSource("2027-11-02").id, "in-boone-general-2027-11-02");
	assert.throws(() => booneSource("2028-11-03"));
	assert.throws(() => getStateBallotCycleFamily("in-boone-general-2099"));
});

test("Boone discovery uses actually offered controls rather than guessing document URLs", () => {
	assert.deepEqual(readBooneCandidateIndex(index()), [{ year: "2026", workbookUrl: workbookUrl("2026"), ballotUrl: ballotUrl("2026") }]);
	assert.deepEqual(readBooneCandidateIndex(index(["2028"], [])), [{ year: "2028", workbookUrl: workbookUrl("2028") }]);
	for (const changed of [index().replace(workbookUrl("2026"), "https://untrusted.example/2026.xlsx"), index().replace("2026 General Candidates</a>", "2028 General Candidates</a>"), index().replace("</body>", `<a href="${workbookUrl("2026")}">2026 General Candidates</a></body>`), index().replace("<h2>", "<h2 hidden>"), index().replace("<body>", "<body><div hidden>").replace("</body>", "</div></body>")]) {
		assert.throws(() => readBooneCandidateIndex(changed));
	}
});

test("Boone dates come from consistent official ballot headers and respect existing bounds", () => {
	assert.equal(readBooneBallotDate(ballotText("2026"), "2026"), "2026-11-03");
	assert.equal(readBooneBallotDate(ballotText("2028"), "2028"), "2028-11-07");
	for (const changed of [ballotText("2026").replace("BOONE", "OTHER"), ballotText("2026").replace("GENERAL ELECTION", "PRIMARY ELECTION"), ballotText("2028"), ballotText("2026").replace("NOVEMBER 3", "NOVEMBER 10"), ballotText("2026").replace("NOVEMBER", "OCTOBER"), ballotText("2026") + ballotText("2028"), " ".repeat(4 * 1024 * 1024 + 1)]) assert.throws(() => readBooneBallotDate(changed, "2026"));
});

test("Boone acquisition honors both reviewed wildcard groups and stops before unsafe collection", async () => {
	const input = await capture();
	assert.deepEqual(input.requests, [`${booneOrigin}/robots.txt`, `${booneOrigin}/`, booneDiscoveryUrl, workbookUrl("2026"), ballotUrl("2026")]);
	assert.equal(input.delays.length, 4);
	assert(input.delays.every(milliseconds => milliseconds >= 1000));
	for (const settings of [{ robots: `${robots}\nDisallow: /` }, { home: index().replace("</body>", "<a href=\"/terms/\">Terms of use</a></body>") }, { home: index().replace("</body>", "<p>Automated access is prohibited.</p></body>") }]) {
		const denied = fixture(settings);
		await assert.rejects(fetchBooneCycleDiscovery(denied.settings));
		assert(denied.requests.length <= 2);
	}
});

test("Boone persisted captures omit private columns and keep literal party and office facts", async () => {
	const input = await capture();
	assert.doesNotMatch(input.body, /Private residence|private@/u);
	const result = parseBooneCandidateCapture(source, input.body, createStateCandidateRecord, now);
	assert.equal(result.records.length, 5);
	assert.deepEqual(result.records.slice(0, 3).map(record => record.party), ["Republican", "Democratic", "Independent"]);
	assert.deepEqual(result.records.slice(3).map(record => record.office), ["Western Boone / Clinton", "Western Boone / Jackson"]);
	assert.notEqual(result.records[3]!.id, result.records[4]!.id);
	assert(result.records.every(record => record.scope === "local" && record.district === "" && record.jurisdiction === "Boone County"));
	assert.equal(result.records.filter(record => record.status === "filed").length, 4);
	assert.equal(result.records[2]!.status, "inactive");
	assert.equal(result.records[2]!.sourceStatus, "Do not put on ballot");
	assert.equal(result.documents[0]!.includedRecordCount, 5);
	assert.equal(result.documents[1]!.includedRecordCount, 0);
	assert.deepEqual(parseStateCandidateRecords(source, input.body), result.records);
	assert.equal(buildStateBallotPreview({ source, ...result }, { districtMatches: [] }), null);
});

test("Boone snapshot freshness uses the oldest real document clock rather than a later context check", async () => {
	const input = fixture();
	let clock = now;
	const request = input.settings.request;
	input.settings.now = () => clock;
	input.settings.request = async (url: string) => {
		clock += 1000;
		return request(url);
	};
	const discovery = await fetchBooneCycleDiscovery(input.settings);
	const body = await fetchBooneCandidateCapture(source, { discovery, now: () => clock });
	const result = parseBooneCandidateCapture(source, body, createStateCandidateRecord, clock);
	assert.notEqual(result.documents[0]!.retrievedAt, result.documents[1]!.retrievedAt);
	assert.equal(result.retrievedAt, result.documents[0]!.retrievedAt);
	assert.equal(parseBundledStateSnapshot(source, JSON.stringify(flat(result)), "automatic").retrievedAt, result.retrievedAt);
});

test("Boone previously accepted data is never replaced by an older captured publication", async () => {
	const earlier = await capture();
	const later = await capture({ clock: now + 10000 });
	const accepted = { source, ...parseBooneCandidateCapture(source, later.body, createStateCandidateRecord, now + 10000) };
	assert.throws(() => parseBooneCandidateCapture(source, earlier.body, createStateCandidateRecord, now + 10000, accepted));
});

test("Boone snapshot loading rejects invented qualification, publisher clocks and provenance drift", async () => {
	const input = await capture();
	const result = parseBooneCandidateCapture(source, input.body, createStateCandidateRecord, now);
	const original = flat(result);
	assert.equal(parseBundledStateSnapshot(source, JSON.stringify(original), "automatic").records.length, 5);
	for (const change of [
		(value: typeof original) => { value.collectionIndexSha256 = "a".repeat(64); },
		(value: typeof original) => { value.sourceSha256 = "a".repeat(64); },
		(value: typeof original) => { value.documents[1]!.url = "https://untrusted.example/ballots.pdf"; },
		(value: typeof original) => { value.records[0]!.status = "qualified"; },
		(value: typeof original) => { value.records[0]!.scope = "statewide"; },
		(value: typeof original) => { value.records[0]!.id = "0".repeat(24); },
		(value: typeof original) => { Object.assign(value.records[2]!, { sourceStatus: "Withdrawn" }); },
		(value: typeof original) => { Object.assign(value, { sourceAsOfDate: "2026-08-13" }); },
		(value: typeof original) => { Object.assign(value.records[0]!, { address: "Never public" }); }
	]) {
		const changed = structuredClone(original);
		change(changed);
		assert.throws(() => parseBundledStateSnapshot(source, JSON.stringify(changed), "automatic"));
	}
});

test("Boone future publications wait without manufacturing dates or empty successful imports", async () => {
	const clock = Date.parse("2028-10-01T12:00:00.000Z");
	for (const options of [{ year: "2028", clock, unavailable: "workbook" as const }, { year: "2028", clock, empty: true }]) {
		const input = await capture(options);
		const catalog = discoverStateBallotElectionCycles(input.discovery, source.id, clock);
		assert.equal(stateBallotCycleSources(catalog, clock)[0]!.id, "in-boone-general-2028-11-07");
		assert.throws(() => parseBooneCandidateCapture(input.source, input.body, createStateCandidateRecord, clock), StateBallotAwaitingRecordsError);
	}
	const missingDate = await capture({ year: "2028", clock, unavailable: "ballots" });
	assert.deepEqual(readBooneDiscovery(missingDate.discovery, clock).elections, []);
	assert.deepEqual(discoverStateBallotElectionCycles(missingDate.discovery, source.id, clock).elections, []);
});

test("Boone managed imports are durable, repeatable and readable without publisher or native tools", async () => {
	const directory = await mkdtemp(join(tmpdir(), "boone-automation-"));
	try {
		const input = await capture();
		const options = { familyId: source.id, catalogPath: join(directory, "cycles.json"), dataDirectory: join(directory, "records"), fetchDiscovery: async () => input.discovery, now: () => now };
		const first = await syncStateBallotCycles(options);
		assert.equal(first.results[0]!.imported, true);
		assert.equal(first.results[0]!.records, 5);
		const repeated = await syncStateBallotCycles(options);
		assert.equal(repeated.catalogChanged, false);
		assert.equal(repeated.results[0]!.imported, false);
		let upstream = 0;
		const repository = createStateBallotRepository({ sources: [source], dataDirectory: options.dataDirectory, now: () => now + 9 * 3600000, fetchText: async () => {
			upstream++;
			throw new Error("Public readers must stay offline");
		} });
		const snapshot = await repository.getSnapshot("IN", source.id);
		assert.equal(snapshot?.records.length, 5);
		assert.equal(snapshot?.retrievedAt, new Date(now).toISOString());
		assert.equal(upstream, 0);
	}
	finally { await rm(directory, { recursive: true, force: true }); }
});

test("Boone future empty publications persist waiting state and import automatically when populated", async () => {
	const directory = await mkdtemp(join(tmpdir(), "boone-pending-"));
	try {
		const clock = Date.parse("2028-10-01T12:00:00.000Z");
		const future = booneSource("2028-11-07");
		const pending = await capture({ year: "2028", clock, empty: true });
		const options = { familyId: source.id, catalogPath: join(directory, "cycles.json"), dataDirectory: join(directory, "records"), fetchDiscovery: async () => pending.discovery, now: () => clock };
		const waiting = await syncStateBallotCycles(options);
		assert.equal(waiting.results[0]!.status, "awaiting-records");
		assert.equal(waiting.results[0]!.imported, false);
		const storage = createStateBallotStorage(options.dataDirectory);
		assert(await storage.readPending(future, clock));
		assert.equal(await storage.read(future), null);
		const available = await capture({ year: "2028", clock, revision: "available" });
		const populated = await syncStateBallotCycles({ ...options, fetchDiscovery: async () => available.discovery });
		assert.equal(populated.results[0]!.status, "available");
		assert.equal(populated.results[0]!.imported, true);
		assert.equal((await storage.read(future))?.records.length, 5);
		const restarted = createStateBallotRepository({ sources: [future], dataDirectory: options.dataDirectory, now: () => clock });
		assert.equal((await restarted.getSnapshot("IN", future.id))?.records.length, 5);
		assert.equal(restarted.isAwaitingRecords?.(future.id), false);
	}
	finally { await rm(directory, { recursive: true, force: true }); }
});

test("Boone changed membership and vanished current publications retain accepted data for review", async () => {
	const directory = await mkdtemp(join(tmpdir(), "boone-retained-"));
	try {
		const input = await capture();
		const options = { familyId: source.id, catalogPath: join(directory, "cycles.json"), dataDirectory: join(directory, "records"), fetchDiscovery: async () => input.discovery, now: () => now };
		await syncStateBallotCycles(options);
		const before = await createStateBallotRepository({ sources: [source], dataDirectory: options.dataDirectory, now: () => now }).getSnapshot("IN", source.id);
		assert(before);
		const removed = sheets();
		removed[0]!.data.splice(2, 1);
		const changed = await capture({ rows: removed, revision: "removed" });
		const failed = await syncStateBallotCycles({ ...options, fetchDiscovery: async () => changed.discovery });
		assert.equal(failed.results[0]!.imported, false);
		const retained = await createStateBallotRepository({ sources: [source], dataDirectory: options.dataDirectory, now: () => now }).getSnapshot("IN", source.id);
		assert.deepEqual(retained, before);
		const reversedRows = sheets();
		reversedRows[0]!.data[6]![2] = null;
		const reversed = await capture({ rows: reversedRows, revision: "reactivated" });
		const reversal = await syncStateBallotCycles({ ...options, fetchDiscovery: async () => reversed.discovery });
		assert.equal(reversal.results[0]!.imported, false);
		assert.deepEqual(await createStateBallotRepository({ sources: [source], dataDirectory: options.dataDirectory, now: () => now }).getSnapshot("IN", source.id), before);
		const vanished = JSON.parse(input.discovery);
		vanished.index.body = index([], []);
		vanished.index.sha256 = booneHash(vanished.index.body);
		vanished.documents = [];
		const catalogBefore = await readFile(options.catalogPath);
		await assert.rejects(syncStateBallotCycles({ ...options, fetchDiscovery: async () => JSON.stringify(vanished) }), /disappeared/u);
		assert.deepEqual(await readFile(options.catalogPath), catalogBefore);
	}
	finally { await rm(directory, { recursive: true, force: true }); }
});

test("Boone cycle metadata rejects cross-year, foreign and ambiguous document controls", async () => {
	const input = await capture();
	const election = structuredClone(readBooneDiscovery(input.discovery, now).elections[0]!);
	for (const change of [
		(value: typeof election) => { value.booneDocuments.reverse(); },
		(value: typeof election) => { value.electionDate = "2028-11-07"; },
		(value: typeof election) => { value.booneDocuments[1]!.status = 404; },
		(value: typeof election) => { value.booneDocuments[0]!.url += "?download=1"; },
		(value: typeof election) => { value.booneDocuments[0]!.sha256 = "wrong"; },
		(value: typeof election) => { Object.assign(value.booneDocuments[0]!, { status: "200" }); }
	]) {
		const changed = structuredClone(election);
		change(changed);
		assert.throws(() => validateBooneElection(changed));
	}
});
