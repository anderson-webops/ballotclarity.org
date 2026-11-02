import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { syncStateBallotCycles } from "../src/state-ballot-cycle-sync.js";
import { discoverStateBallotElectionCycles, getStateBallotCycleFamily, stateBallotCycleSources } from "../src/state-ballot-cycles.js";
import { fetchKanawhaCycleDiscovery, parseKanawhaCandidateCapture, readKanawhaDiscovery } from "../src/state-ballot-kanawha-collection.js";
import { kanawhaDiscoveryUrl, kanawhaHash, kanawhaOrigin, kanawhaPolicies, kanawhaRobotsSha256, kanawhaSource, readKanawhaCandidateIndex, validateKanawhaDocumentUrl } from "../src/state-ballot-kanawha-discovery.js";
import { readKanawhaPreparedDocument } from "../src/state-ballot-kanawha-native.js";
import { createStateCandidateRecord } from "../src/state-ballot-records.js";
import { configuredStateBallotSources } from "../src/state-ballot-registry.js";
import { createStateBallotRepository } from "../src/state-ballot-repository.js";
import { parseBundledStateSnapshot } from "../src/state-ballot-snapshot.js";
import { StateBallotAwaitingRecordsError } from "../src/state-ballot-source-state.js";
import { createStateBallotStorage, serializeStoredStateSnapshot } from "../src/state-ballot-storage.js";
import { stateRecordDocumentLinks } from "../src/state-records.js";
import { kanawhaDocumentUrl, kanawhaFixture, kanawhaFooter, kanawhaIndex, kanawhaRobots } from "./fixtures/kanawha.js";

test("Kanawha registers a county-only family without replacing statewide records or promising a personal ballot", () => {
	const { source } = kanawhaFixture();
	assert.equal(getStateBallotCycleFamily(source.id).format, "kanawha-pdf");
	assert.deepEqual(configuredStateBallotSources.find(item => item.id === source.id), source);
	assert.equal(configuredStateBallotSources.find(item => item.id === "wv-sos-2026")!.retrievalPolicy, "manual-snapshot");
	assert.equal(source.ballotPreview, false);
	assert.deepEqual(source.withheldDistrictScopes, ["congressional", "state-senate", "state-house"]);
	assert.equal(kanawhaHash(kanawhaRobots), kanawhaRobotsSha256);
});
test("Kanawha discovers only visible offered reports bound to a unique actual election heading", () => {
	assert.deepEqual(readKanawhaCandidateIndex(kanawhaIndex()), [{ year: "2026", url: kanawhaDocumentUrl("2026") }]);
	assert.deepEqual(readKanawhaCandidateIndex(kanawhaIndex("2028", false)), []);
	for (const body of [kanawhaIndex().replace("<section>", "<section hidden>"), kanawhaIndex().replace("2026 General Election", "2026 Primary Election"), kanawhaIndex().replace("View Public Test Results", "Other public test results"), kanawhaIndex().replace("</h2>", "</h2><h2>2028 General Election</h2>"), kanawhaIndex().replace("kanawha.us/wp-content", "other.example/wp-content"), kanawhaIndex().replace("</article>", "<a href=\"/terms\">Terms of Use</a></article>")]) assert.throws(() => readKanawhaCandidateIndex(body));
	for (const url of [`${kanawhaDocumentUrl("2026")}?download=1`, `${kanawhaDocumentUrl("2026")}#page=1`, kanawhaDocumentUrl("2028"), kanawhaDocumentUrl("2026").replace("Zero-Test", "Certificate")]) assert.throws(() => validateKanawhaDocumentUrl(url, "2026"));
});
test("Kanawha accepts a dated unofficial-results link only for its matching general-election heading", () => {
	const current = kanawhaIndex().replace("2026 General Election</h2>", "2026 General Election Results</h2>").replace("View Public Test Results", "2026 General Election (Unofficial Results)");
	assert.deepEqual(readKanawhaCandidateIndex(current), [{ year: "2026", url: kanawhaDocumentUrl("2026") }]);
	assert.throws(() => readKanawhaCandidateIndex(current.replace("2026 General Election (Unofficial Results)", "2028 General Election (Unofficial Results)")));
	assert.throws(() => readKanawhaCandidateIndex(current.replace("<section>", "<section hidden>")));
	const duplicate = kanawhaIndex().replace("View Public Test Results</a>", `View Public Test Results</a><a href="${kanawhaDocumentUrl("2026")}">2026 General Election (Unofficial Results)</a>`);
	assert.deepEqual(readKanawhaCandidateIndex(duplicate), [{ year: "2026", url: kanawhaDocumentUrl("2026") }]);
	assert.throws(() => readKanawhaCandidateIndex(duplicate.replace(`href="${kanawhaDocumentUrl("2026")}">2026`, `href="${kanawhaDocumentUrl("2026").replace("/10/", "/11/")}">2026`)));
});
test("Kanawha native and rendered facts retain complete rosters while excluding counts, placeholders and incomplete measures", () => {
	const { evidence, source, capture, now } = kanawhaFixture();
	const report = readKanawhaPreparedDocument(evidence);
	assert.equal(report.candidates.length, 3);
	assert.equal(report.questions.length, 1);
	const parsed = parseKanawhaCandidateCapture(source, JSON.stringify(capture), createStateCandidateRecord, now);
	assert.equal(parsed.records.length, 3);
	assert.deepEqual(parsed.records.map(record => record.party), ["Republican", "Democratic", undefined]);
	assert.equal(parsed.records[2]!.ballotDesignation, "Unexpired term");
	assert.equal(parsed.records[2]!.sourceDivision, "6");
	assert.equal(parsed.sourceAsOfDate, "2026-10-14");
	assert(!("ballotQuestions" in parsed));
	assert.doesNotMatch(JSON.stringify(parsed.records), /121,007|Votes Cast|Write-In|address|phone|email/iu);
});
test("Kanawha native drawing guards hold hidden text, overlays, changed mappings, duplicate fields and layout substitutions", () => {
	const fixture = kanawhaFixture();
	for (const change of [
		(commands: string) => commands.replace("0 0 0 rg", "1 1 1 rg"),
		(commands: string) => `${commands}1 1 1 rg\n20 765 580 -700 re\nf\n`,
		(commands: string) => `${commands}1 w\n0 0 0 RG\n20 760 m\n590 760 l\nS\n`,
		(commands: string) => commands.replace("1 0 0 1 20 760 Tm", "1 0 0 1 20 760 Tm\n3 Tr"),
		(commands: string) => commands.replace("/F1 8 Tf", "/F2 8 Tf"),
		(commands: string) => commands.replace("(REP ALEX EXAMPLE)Tj", "(REP OTHER EXAMPLE)Tj"),
	]) {
		const value = structuredClone(fixture.objects);
		Object.assign(value.qpdf[1]!, { "obj:3 0 R": { stream: { dict: {}, data: Buffer.from(change(fixture.commands)).toString("base64") } } });
		assert.throws(() => readKanawhaPreparedDocument({ ...fixture.evidence, objects: JSON.stringify(value) }));
	}
	assert.throws(() => readKanawhaPreparedDocument({ ...fixture.evidence, text: fixture.evidence.text.replace("ALEX EXAMPLE", "OTHER EXAMPLE") }));
	assert.throws(() => readKanawhaPreparedDocument({ ...fixture.evidence, bbox: fixture.evidence.bbox.replace("width=\"612.000000\"", "width=\"620.000000\"") }));
});
test("Kanawha source and future examples use explicit document dates, not constructed nominees or calendar guesses", () => {
	const fixture = kanawhaFixture("2028");
	const catalog = discoverStateBallotElectionCycles(JSON.stringify(fixture.discovery), "wv-kanawha-2026", fixture.now);
	assert.equal(catalog.elections[0]!.electionDate, "2028-11-07");
	assert.equal(stateBallotCycleSources(catalog, fixture.now)[0]!.id, "wv-kanawha-general-2028-11-07");
	assert.throws(() => kanawhaSource("2028-11-03"));
	assert.throws(() => readKanawhaDiscovery(JSON.stringify(fixture.discovery), Date.parse("2026-10-27T12:00:00Z")));
	for (const heading of ["FOR GOVERNOR", "FOR SECRETARY OF STATE", "FOR STATE AUDITOR", "FOR STATE TREASURER", "FOR ATTORNEY GENERAL", "FOR COMMISSIONER OF AGRICULTURE", "FOR COUNTY CLERK", "FOR CIRCUIT CLERK", "FOR SHERIFF", "FOR ASSESSOR", "FOR PROSECUTING ATTORNEY"]) {
		const future = kanawhaFixture("2028", false, heading);
		const parsed = parseKanawhaCandidateCapture(future.source, JSON.stringify(future.capture), createStateCandidateRecord, future.now);
		const expectedScope = /COUNTY CLERK|CIRCUIT CLERK|SHERIFF|ASSESSOR|PROSECUTING ATTORNEY/u.test(heading) ? "local" : "statewide";
		assert.equal(parsed.records[0]!.scope, expectedScope);
		assert.equal(parsed.records[0]!.status, "listed");
		assert.equal(parsed.records[0]!.name, "ALEX EXAMPLE");
	}
});
test("Kanawha policy receipts are exact, reviewed, complete and separate from raw policy copies", () => {
	const fixture = kanawhaFixture();
	assert.equal(readKanawhaDiscovery(JSON.stringify(fixture.discovery), fixture.now).policies.length, 3);
	for (const change of [
		(value: typeof fixture.discovery) => { value.policies.pop(); },
		(value: typeof fixture.discovery) => { value.policies[0]!.textSha256 = "c".repeat(64); },
		(value: typeof fixture.discovery) => { value.documents[0]!.sha256 = "c".repeat(64); },
		(value: typeof fixture.discovery) => {
			value.robots.body += "Disallow: /wp-content/\n";
			value.robots.sha256 = kanawhaHash(value.robots.body);
		},
	]) {
		const value = structuredClone(fixture.discovery);
		change(value);
		assert.throws(() => readKanawhaDiscovery(JSON.stringify(value), fixture.now));
	}
});
test("Kanawha collector stops on access or policy changes before requesting a candidate report", async () => {
	for (const blocked of ["robots", "home", "privacy"]) {
		const requests: string[] = [];
		await assert.rejects(fetchKanawhaCycleDiscovery({ sleep: async () => {}, request: async (url, options) => {
			requests.push(url);
			assert.deepEqual(options.allowedHosts, ["kanawha.us"]);
			if (url.endsWith("robots.txt")) return { status: blocked === "robots" ? 403 : 200, body: Buffer.from(kanawhaRobots), contentType: "text/plain", etag: undefined };
			if (url === `${kanawhaOrigin}/`) return { status: 200, body: Buffer.from(kanawhaIndex() + (blocked === "home" ? "<a href=\"/terms\">Terms</a>" : "")), contentType: "text/html", etag: undefined };
			if (url === kanawhaDiscoveryUrl) return { status: 200, body: Buffer.from(kanawhaIndex()), contentType: "text/html", etag: undefined };
			assert.equal(url, kanawhaPolicies[0].requestUrl);
			return { status: 200, body: Buffer.from(`<article>Changed collection policy</article>${kanawhaFooter}`), contentType: "text/html", etag: undefined };
		} }));
		assert(!requests.some(url => url.endsWith(".pdf")));
		assert.equal(requests.length, blocked === "robots" ? 1 : blocked === "home" ? 2 : 4);
	}
});
test("Kanawha automatic imports persist, repeat without changes and restart without publisher access", async () => {
	const fixture = kanawhaFixture();
	const directory = await mkdtemp(join(tmpdir(), "kanawha-automatic-"));
	try {
		const options = { familyId: fixture.source.id, catalogPath: join(directory, "cycles.json"), dataDirectory: directory, now: () => fixture.now, fetchDiscovery: async () => JSON.stringify(fixture.discovery) };
		const first = await syncStateBallotCycles(options);
		assert.equal(first.results[0]!.records, 3);
		assert.equal(first.results[0]!.imported, true);
		assert.equal((await syncStateBallotCycles(options)).results[0]!.imported, false);
		const repository = createStateBallotRepository({ sources: [fixture.source], dataDirectory: directory, now: () => fixture.now, fetchText: async () => {
			throw new Error("Publisher access disabled");
		} });
		const snapshot = await repository.getSnapshot("WV", fixture.source.id);
		assert(snapshot);
		assert.equal(snapshot.records.length, 3);
		assert.equal(snapshot.sourceAsOfDate, "2026-10-14");
		assert.deepEqual(stateRecordDocumentLinks(fixture.source, snapshot), [{ label: "Test report", url: kanawhaDocumentUrl("2026") }]);
		assert.deepEqual(parseBundledStateSnapshot(fixture.source, serializeStoredStateSnapshot(snapshot), "automatic").records, snapshot.records);
		const stored = await createStateBallotStorage(directory).read(fixture.source);
		assert.deepEqual(stored!.records, snapshot.records);
	}
	finally { await rm(directory, { recursive: true, force: true }); }
});
test("Kanawha empty future reports wait durably and import automatically when populated", async () => {
	const fixture = kanawhaFixture("2028", true);
	assert.throws(() => parseKanawhaCandidateCapture(fixture.source, JSON.stringify(fixture.capture), createStateCandidateRecord, fixture.now), StateBallotAwaitingRecordsError);
	const directory = await mkdtemp(join(tmpdir(), "kanawha-waiting-"));
	try {
		const options = { familyId: "wv-kanawha-2026", catalogPath: join(directory, "cycles.json"), dataDirectory: directory, now: () => fixture.now, fetchDiscovery: async () => JSON.stringify(fixture.discovery) };
		const result = await syncStateBallotCycles(options);
		assert.equal(result.results[0]!.status, "awaiting-records");
		assert.equal(result.results[0]!.records, 0);
		assert.equal(result.results[0]!.imported, false);
		assert(await createStateBallotStorage(directory).readPending(fixture.source, fixture.now));
		const available = kanawhaFixture("2028");
		const imported = await syncStateBallotCycles({ ...options, fetchDiscovery: async () => JSON.stringify(available.discovery) });
		assert.equal(imported.results[0]!.imported, true);
		assert.equal(imported.results[0]!.records, 3);
	}
	finally { await rm(directory, { recursive: true, force: true }); }
});
test("Kanawha unavailable offered reports persist waiting without constructing an election date", async () => {
	const fixture = kanawhaFixture();
	const { evidence: _evidence, ...publication } = fixture.discovery.documents[0]!;
	const discovery = { ...fixture.discovery, documents: [{ ...publication, status: 404, sha256: kanawhaHash("") }] };
	const body = JSON.stringify({ ...fixture.capture, discovery });
	assert.deepEqual(readKanawhaDiscovery(JSON.stringify(discovery), fixture.now).elections, []);
	const catalog = discoverStateBallotElectionCycles(JSON.stringify(discovery), fixture.source.id, fixture.now);
	assert.deepEqual(catalog.elections, []);
	assert.throws(() => parseKanawhaCandidateCapture(fixture.source, body, createStateCandidateRecord, fixture.now), StateBallotAwaitingRecordsError);
	const directory = await mkdtemp(join(tmpdir(), "kanawha-unavailable-"));
	try {
		const repository = createStateBallotRepository({ sources: [fixture.source], dataDirectory: directory, collectionIndexSha256: { [fixture.source.id]: "a".repeat(64) }, now: () => fixture.now, fetchText: async () => body });
		assert.equal(await repository.getSnapshot("WV", fixture.source.id), null);
		assert(await createStateBallotStorage(directory).readPending(fixture.source, fixture.now));
		let publisherRequests = 0;
		const restarted = createStateBallotRepository({ sources: [fixture.source], dataDirectory: directory, now: () => fixture.now, fetchText: async () => {
			publisherRequests++;
			throw new Error("Publisher access disabled");
		} });
		assert.equal(await restarted.getSnapshot("WV", fixture.source.id), null);
		assert.equal(restarted.isAwaitingRecords?.(fixture.source.id), true);
		assert.equal(publisherRequests, 0);
	}
	finally { await rm(directory, { recursive: true, force: true }); }
});
test("Kanawha disappearance and roster removals preserve previously accepted data for review", async () => {
	const fixture = kanawhaFixture();
	const directory = await mkdtemp(join(tmpdir(), "kanawha-retained-"));
	try {
		const options = { familyId: fixture.source.id, catalogPath: join(directory, "cycles.json"), dataDirectory: directory, now: () => fixture.now, fetchDiscovery: async () => JSON.stringify(fixture.discovery) };
		await syncStateBallotCycles(options);
		const before = await readFile(options.catalogPath);
		const missing = structuredClone(fixture.discovery);
		missing.index.body = kanawhaIndex("2026", false);
		missing.index.sha256 = kanawhaHash(missing.index.body);
		missing.documents = [];
		await assert.rejects(syncStateBallotCycles({ ...options, fetchDiscovery: async () => JSON.stringify(missing) }));
		assert.deepEqual(await readFile(options.catalogPath), before);
		const previous = await createStateBallotStorage(directory).read(fixture.source);
		const empty = kanawhaFixture("2026", true);
		assert.throws(() => parseKanawhaCandidateCapture(fixture.source, JSON.stringify(empty.capture), createStateCandidateRecord, fixture.now, previous!));
	}
	finally { await rm(directory, { recursive: true, force: true }); }
});
