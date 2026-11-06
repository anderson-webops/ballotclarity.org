import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { syncStateBallotCycles } from "../src/state-ballot-cycle-sync.js";
import { discoverStateBallotElectionCycles, getStateBallotCycleFamily, stateBallotCycleSources } from "../src/state-ballot-cycles.js";
import { fetchOklahomaCycleDiscovery, parseOklahomaCandidateCapture, readOklahomaDiscovery, validateOklahomaElection } from "../src/state-ballot-oklahoma-collection.js";
import { oklahomaCandidateUrl, oklahomaDiscoveryUrl, oklahomaHash, oklahomaHostingOrigin, oklahomaOrigin, oklahomaSource, readOklahomaCandidates, readOklahomaPublication, validateOklahomaCalendarUrl, validateOklahomaSource } from "../src/state-ballot-oklahoma.js";
import { createStateCandidateRecord, parseStateCandidateRecords, stateRecordMatchesDistricts } from "../src/state-ballot-records.js";
import { configuredStateBallotSources } from "../src/state-ballot-registry.js";
import { createStateBallotRepository } from "../src/state-ballot-repository.js";
import { parseBundledStateSnapshot } from "../src/state-ballot-snapshot.js";
import { createStateBallotStorage, serializeStoredStateSnapshot } from "../src/state-ballot-storage.js";
import { stateRecordDocumentLinks } from "../src/state-records.js";
import { oklahomaFixture, oklahomaFixtureTable, oklahomaStatePage } from "./helpers/oklahoma-fixture.js";

test("Oklahoma registry preserves Woodward and selects a distinct statewide collector", () => {
	const source = configuredStateBallotSources.find(source => source.id === "ok-seb-2026")!;
	assert.deepEqual(source, oklahomaSource("2026-11-03"));
	assert.equal(configuredStateBallotSources.find(source => source.id === "ok-woodward-2026")!.retrievalPolicy, "manual-snapshot");
	assert.equal(getStateBallotCycleFamily(source.id).discoveryUrl, oklahomaDiscoveryUrl);
	for (const date of ["2026-11-04", "2026-02-30", "2027-11-02", "2024-11-05"]) assert.throws(() => oklahomaSource(date));
	for (const input of [{ ...source, url: "https://other.invalid/list" }, { ...source, defaultPriority: 0 }, { ...source, retrievalPolicy: "manual-snapshot" as const }]) assert.throws(() => validateOklahomaSource(input));
	for (const value of ["https://other.invalid/2028-voter-information-calendar.html", `${oklahomaOrigin}/elections/elections-results/next-election/2028-voter-information-calendar.html?download=1`, `${oklahomaOrigin}/elections/elections-results/next-election/2026-voter-information-calendar.html`]) assert.throws(() => validateOklahomaCalendarUrl(value, "2028"));
});

test("Oklahoma native tables preserve every county context, party omission and unexpired caption", () => {
	const input = oklahomaFixture();
	const parsed = parseOklahomaCandidateCapture(input.source, input.body(), createStateCandidateRecord, input.epoch);
	assert.equal(parsed.records.length, 169);
	assert.equal(parsed.claims.length, 699);
	assert.equal(new Set(parsed.claims.map(claim => claim.publisherCountyCode)).size, 77);
	assert.equal(parsed.records.filter(record => record.scope === "local").length, 158);
	assert.equal(parsed.records.filter(record => !record.party).length, 4);
	assert.equal(parsed.records.filter(record => record.ballotDesignation === "Unexpired Term").length, 4);
	assert(parsed.records.every(record => record.status === "listed" && !record.incumbent && record.termYears === undefined && record.termEnd === undefined && record.voteLimit === undefined));
	assert.equal(parsed.sourceAsOf, "10/1/2026 8:00:00 AM");
	assert.equal(parsed.sourceAsOfDate, "2026-10-01");
	assert.deepEqual(parseStateCandidateRecords(input.source, input.body()), parsed.records);
	assert.deepEqual(stateRecordDocumentLinks(input.source), [{ label: "Candidate list", url: oklahomaCandidateUrl }]);
	const local = parsed.records.find(record => record.scope === "local")!;
	assert.equal(stateRecordMatchesDistricts(local, [{ id: "county-40001", districtType: "county", districtCode: "001", label: "Adair County", sourceSystem: "Synthetic context" }]), false);
	const senator = parsed.records.find(record => record.scope === "state-senate")!;
	assert.equal(senator.district, "17");
	assert.equal(stateRecordMatchesDistricts(senator, [{ id: "upper-17", districtType: "state-senate", districtCode: "17", label: "Senate 17", sourceSystem: "Synthetic context" }]), true);
	assert(!parsed.records.some(record => /SUPREME COURT|QUESTION/u.test(record.office)));
});

test("Oklahoma rejects altered geography, party labels, markup, omissions and source clocks", () => {
	const input = oklahomaFixture();
	const original = input.capture.candidates.body;
	for (const [before, after] of [
		["name=\"77\">WOODWARD", "name=\"76\">WOODWARD"],
		["Avery Example, REPUBLICAN", "Avery Example, UNAFFILIATED"],
		["<body>", "<body style=\"display:none\">"],
		["<body>", "<body><script>document.body.remove()</script>"],
		["width=\"970\"", "width=\"960\""],
		[oklahomaFixtureTable(4, "Avery Example, REPUBLICAN"), ""],
		["10/1/2026 8:00:00 AM", "13/1/2026 8:00:00 AM"],
		["10/1/2026 8:00:00 AM", "10/1/2026 18:00:00 AM"],
		["NOVEMBER / 2026 LIST OF ELECTIONS", "JUNE / 2026 LIST OF ELECTIONS"],
	]) assert.throws(() => readOklahomaCandidates(input.source, original.replace(before, after), createStateCandidateRecord), before);
	assert.throws(() => readOklahomaPublication("x".repeat(2 * 1024 * 1024 + 1)));
});

test("Oklahoma discovers actual offered future calendars and validates stored metadata", () => {
	for (const date of ["2026-11-03", "2028-11-07", "2030-11-05"]) {
		const input = oklahomaFixture(date);
		const discovery = readOklahomaDiscovery(input.body(), input.epoch);
		assert.equal(discovery.elections[0]!.electionDate, date);
		const catalog = discoverStateBallotElectionCycles(input.body(), "ok-seb-2026", input.epoch);
		assert.equal(catalog.elections[0]!.oklahomaContentSha256, input.capture.candidates.sha256);
		assert.deepEqual(stateBallotCycleSources(catalog, input.epoch), date === "2026-11-03" ? [] : [input.source]);
		const parsed = parseOklahomaCandidateCapture(input.source, input.body(), createStateCandidateRecord, input.epoch);
		const stored = serializeStoredStateSnapshot({ source: input.source, ...parsed });
		assert.deepEqual(parseBundledStateSnapshot(input.source, stored, "automatic").records, JSON.parse(JSON.stringify(parsed.records)));
		for (const field of ["sourceAsOf", "sourceAsOfDate", "collectionIndexSha256"]) {
			const value = JSON.parse(stored);
			value[field] = "altered";
			assert.throws(() => parseBundledStateSnapshot(input.source, JSON.stringify(value), "automatic"));
		}
	}
	assert.throws(() => validateOklahomaElection({ electionId: null, electionDate: "2028-11-07", pageUrl: `${oklahomaCandidateUrl}?next=1`, oklahomaContentSha256: "a".repeat(64) }));
});

test("Oklahoma refuses foreign calendars, changed policies, tampered bytes and unsupported election types", () => {
	for (const mutation of [
		(input: ReturnType<typeof oklahomaFixture>) => {
			input.capture.index.body = input.capture.index.body.replace(input.calendarUrl, "https://other.invalid/calendar");
			input.capture.index.sha256 = oklahomaHash(input.capture.index.body);
		},
		(input: ReturnType<typeof oklahomaFixture>) => {
			input.capture.calendar!.body = input.capture.calendar!.body.replace("November 3", "November 4");
			input.capture.calendar!.sha256 = oklahomaHash(input.capture.calendar!.body);
		},
		(input: ReturnType<typeof oklahomaFixture>) => {
			input.capture.calendar!.body = input.capture.calendar!.body.replace("General Elections", "Primary Elections");
			input.capture.calendar!.sha256 = oklahomaHash(input.capture.calendar!.body);
		},
		(input: ReturnType<typeof oklahomaFixture>) => {
			input.capture.index.body = oklahomaStatePage("<h1>Next Election</h1>");
			input.capture.index.sha256 = oklahomaHash(input.capture.index.body);
		},
		(input: ReturnType<typeof oklahomaFixture>) => { input.capture.policies = []; },
		(input: ReturnType<typeof oklahomaFixture>) => { input.capture.candidates.body += "altered"; },
		(input: ReturnType<typeof oklahomaFixture>) => { input.capture.candidates.retrievedAt = new Date(input.epoch + 1000).toISOString(); },
	]) {
		const input = oklahomaFixture();
		mutation(input);
		assert.throws(() => readOklahomaDiscovery(input.body(), input.epoch));
	}
});

test("Oklahoma collection observes policy order, reviewed 404 absence, per-host bounds and pacing", async () => {
	const input = oklahomaFixture("2028-11-07");
	const requested: string[] = [];
	const waits: number[] = [];
	const body = await fetchOklahomaCycleDiscovery({ now: () => input.epoch, wait: async (milliseconds) => {
		waits.push(milliseconds);
	}, request: async (url, options) => {
		assert.deepEqual(options.allowedHosts, [new URL(url).hostname]);
		assert.equal(options.maxBytes, 2 * 1024 * 1024);
		assert.equal(options.timeoutMs, 25000);
		requested.push(url);
		assert(input.responses.has(url));
		return input.responses.get(url)!;
	} });
	assert.equal(parseOklahomaCandidateCapture(input.source, body, createStateCandidateRecord, input.epoch).records.length, 169);
	assert.equal(requested.length, 9);
	assert.deepEqual(requested.slice(0, 2), [`${oklahomaOrigin}/robots.txt`, `${oklahomaHostingOrigin}/robots.txt`]);
	assert.equal(requested.at(-1), input.calendarUrl);
	assert(waits.length === 8 && waits.every(milliseconds => milliseconds >= 20000));
});

test("Oklahoma transport stops before candidate access on policy denial, redirect and changed enrollment", async () => {
	for (const status of [200, 301, 401, 403, 429, 503]) {
		const input = oklahomaFixture();
		const requests: string[] = [];
		await assert.rejects(fetchOklahomaCycleDiscovery({ now: () => input.epoch, wait: async () => {}, request: async (url) => {
			requests.push(url);
			return url === `${oklahomaHostingOrigin}/robots.txt` ? { status, body: Buffer.from("User-agent: *\nAllow: /\n"), contentType: "text/plain", etag: undefined } : input.responses.get(url)!;
		} }));
		assert(!requests.includes(oklahomaCandidateUrl));
	}
});

test("Oklahoma cycles persist, repeat and restart without new publisher requests", async () => {
	const input = oklahomaFixture("2028-11-07");
	const directory = await mkdtemp(join(tmpdir(), "oklahoma-cycles-"));
	try {
		const options = { familyId: "ok-seb-2026", catalogPath: join(directory, "cycles.json"), dataDirectory: join(directory, "snapshots"), now: () => input.epoch, fetchDiscovery: async () => input.body() };
		const first = await syncStateBallotCycles(options);
		assert.equal(first.results[0]!.status, "available");
		assert.equal(first.results[0]!.records, 169);
		assert.equal(first.results[0]!.imported, true);
		let candidateRequests = 0;
		const second = await syncStateBallotCycles({ ...options, fetchCandidates: async () => {
			candidateRequests++;
			throw new Error("Repeated candidate requests are unnecessary.");
		} });
		assert.equal(second.results[0]!.records, 169);
		assert.equal(candidateRequests, 0);
		assert.equal(second.catalogChanged, false);
		const repository = createStateBallotRepository({ sources: [input.source], dataDirectory: options.dataDirectory, now: () => input.epoch });
		assert.equal((await repository.getSnapshot("OK", input.source.id))!.records.length, 169);
		const stored = await createStateBallotStorage(options.dataDirectory).read(input.source);
		assert.equal(stored!.sourceAsOf, "10/1/2028 8:00:00 AM");
	}
	finally { await rm(directory, { recursive: true, force: true }); }
});

test("Oklahoma catalog roll-forward preserves historical cohorts and holds active disappearance", async () => {
	const first = oklahomaFixture("2028-11-07");
	const next = oklahomaFixture("2030-11-05");
	const directory = await mkdtemp(join(tmpdir(), "oklahoma-rollover-"));
	try {
		const options = { familyId: "ok-seb-2026", catalogPath: join(directory, "cycles.json"), dataDirectory: join(directory, "snapshots") };
		await syncStateBallotCycles({ ...options, now: () => first.epoch, fetchDiscovery: async () => first.body() });
		const before = await readFile(options.catalogPath);
		const missing = oklahomaFixture("2028-11-07");
		missing.capture.candidates.status = 404;
		missing.capture.candidates.body = "";
		missing.capture.candidates.sha256 = oklahomaHash("");
		missing.capture.calendar = null;
		await assert.rejects(syncStateBallotCycles({ ...options, now: () => first.epoch, fetchDiscovery: async () => missing.body() }), /disappeared/u);
		assert.deepEqual(await readFile(options.catalogPath), before);
		const rolled = await syncStateBallotCycles({ ...options, now: () => next.epoch, fetchDiscovery: async () => next.body() });
		assert.deepEqual(rolled.results.map(item => [item.electionDate, item.status]), [["2028-11-07", "expired"], ["2030-11-05", "available"]]);
		const catalog = JSON.parse(await readFile(options.catalogPath, "utf8"));
		assert.deepEqual(catalog.elections.map((item: { electionDate: string }) => item.electionDate), ["2028-11-07", "2030-11-05"]);
		assert.equal((await createStateBallotStorage(options.dataDirectory).read(first.source))!.records.length, 169);
	}
	finally { await rm(directory, { recursive: true, force: true }); }
});

test("Oklahoma candidate loss and publisher failures preserve accepted bytes", async () => {
	const input = oklahomaFixture("2028-11-07");
	const directory = await mkdtemp(join(tmpdir(), "oklahoma-recovery-"));
	try {
		const options = { familyId: "ok-seb-2026", catalogPath: join(directory, "cycles.json"), dataDirectory: join(directory, "snapshots"), now: () => input.epoch, fetchDiscovery: async () => input.body() };
		await syncStateBallotCycles(options);
		const file = join(options.dataDirectory, `${input.source.id}.json`);
		const before = await readFile(file);
		input.capture.candidates.body = input.capture.candidates.body.replaceAll(oklahomaFixtureTable(4, "Avery Example, REPUBLICAN"), "");
		input.capture.candidates.sha256 = oklahomaHash(input.capture.candidates.body);
		const failed = await syncStateBallotCycles(options);
		assert.equal(failed.results[0]!.status, "unavailable");
		assert.deepEqual(await readFile(file), before);
		await assert.rejects(syncStateBallotCycles({ ...options, fetchDiscovery: async () => {
			throw new Error("Publisher unavailable");
		} }), /Publisher unavailable/u);
		assert.deepEqual(await readFile(file), before);
		const recovered = await syncStateBallotCycles({ ...options, fetchDiscovery: async () => oklahomaFixture("2028-11-07").body() });
		assert.equal(recovered.results[0]!.records, 169);
		await writeFile(join(directory, "unrelated.txt"), "preserve unrelated state");
		assert.equal(await readFile(join(directory, "unrelated.txt"), "utf8"), "preserve unrelated state");
	}
	finally { await rm(directory, { recursive: true, force: true }); }
});
