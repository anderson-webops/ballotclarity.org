import type { StateBallotSource } from "../src/state-ballot-sources.js";
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { syncStateBallotCycles } from "../src/state-ballot-cycle-sync.js";
import { discoverStateBallotElectionCycles, getStateBallotCycleFamily, stateBallotCycleSources } from "../src/state-ballot-cycles.js";
import { douglasSource, fetchDouglasCandidateCapture, fetchDouglasCandidateDiscovery, parseDouglasCandidateCapture, readDouglasCandidateDiscovery, validateDouglasElection, validateDouglasSource } from "../src/state-ballot-douglas-collection.js";
import { buildDouglasElectionForm, douglasCalendarUrl, douglasDiscoveryUrl, douglasLinksSha256, douglasOrigin, douglasPolicyFingerprint, douglasPrivacySha256, douglasPrivacyUrl, readDouglasCalendar, readDouglasForm, readDouglasProfile, readDouglasRoster, validateDouglasProfileUrl } from "../src/state-ballot-douglas.js";
import { configuredStateBallotSources } from "../src/state-ballot-registry.js";
import { buildStateBallotPreview, createStateBallotRepository } from "../src/state-ballot-repository.js";
import { parseBundledStateSnapshot } from "../src/state-ballot-snapshot.js";
import { createStateBallotStorage, serializeStoredStateSnapshot } from "../src/state-ballot-storage.js";
import { douglasCalendarFixture, douglasFixtureClock, douglasFixturePeople, douglasFormFixture, douglasPolicyFixture, douglasProfileFixture } from "./helpers/douglas-fixture.js";

const source = douglasSource("2026-11-03");
const hash = (body: string) => createHash("sha256").update(body).digest("hex");
async function discoveryFixture(date = source.electionDate, publications = true, calendar = true) {
	const calls: { url: string; postBody?: string }[] = [];
	const sleeps: number[] = [];
	const year = date.slice(0, 4);
	const now = () => date === source.electionDate ? douglasFixtureClock : Date.parse(`${year}-10-01T12:00:00.000Z`);
	const body = await fetchDouglasCandidateDiscovery({ now, sleep: async (value) => {
		sleeps.push(value);
	}, requestText: async (url, options) => {
		assert(options);
		assert.deepEqual(options.allowedHosts, ["www.votedouglascounty-ne.gov"]);
		assert.equal(options.maxRedirects, 0);
		calls.push({ url: String(url), ...(options.postBody ? { postBody: options.postBody } : {}) });
		if (String(url).endsWith("/robots.txt")) return douglasPolicyFixture.robots!;
		if (url === `${douglasOrigin}/`) return douglasPolicyFixture.footer!;
		if (url === douglasPrivacyUrl) return douglasPolicyFixture.privacy! + douglasPolicyFixture.footer!;
		if (url === douglasCalendarUrl) return douglasCalendarFixture(date, calendar);
		if (url === douglasDiscoveryUrl) {
			if (options.postBody) {
				const submitted = new URLSearchParams(options.postBody);
				assert.equal(submitted.get("__VIEWSTATE"), "synthetic-state");
				assert.equal(submitted.get("__EVENTVALIDATION"), "synthetic-validation");
				assert.equal(submitted.get("ctl00$ContentPlaceHolder1$ddlElections"), `${year}G`);
				assert.equal(submitted.size, 6);
				assert(!submitted.has("__EVENTTARGET"));
			}
			return douglasFormFixture(year, Boolean(options.postBody), publications);
		}
		assert.equal(new URL(url).pathname, "/candidates.aspx");
		return douglasProfileFixture(new URL(url).searchParams.get("cid")!, year);
	} });
	assert(sleeps.every(value => value === 1000));
	assert.equal(sleeps.length, calls.length - 1);
	return { body, calls, now };
}
async function parsedFixture(date = source.electionDate) {
	const fixture = await discoveryFixture(date);
	const configured = douglasSource(date);
	const capture = await fetchDouglasCandidateCapture(configured, { discovery: fixture.body, now: fixture.now });
	const parsed = parseDouglasCandidateCapture(configured, capture, fixture.now());
	return { ...fixture, capture, parsed, snapshot: { source: configured, ...parsed } };
}

test("Douglas uses only actual general controls and unchanged public form fields", async () => {
	const fixture = await discoveryFixture();
	assert.equal(fixture.calls.length, 12);
	assert.equal(fixture.calls.filter(call => call.postBody).length, 1);
	assert.equal(fixture.calls.filter(call => new URL(call.url).pathname === "/candidates.aspx").length, douglasFixturePeople.length);
	assert(!fixture.calls.some(call => /office_detail|\/elections\/|\/pdf\//u.test(call.url)));
	assert.equal(readDouglasForm(douglasFormFixture()).general[0]!.value, "2026G");
	assert.equal(new URLSearchParams(buildDouglasElectionForm(douglasFormFixture(), "2026")).get("ctl00$ContentPlaceHolder1$hfElection"), "");
	assert.throws(() => buildDouglasElectionForm(douglasFormFixture(), "2028"), /review/u);
	assert.throws(() => buildDouglasElectionForm(douglasFormFixture("2026", true), "2026"), /review/u);
});
test("filings preserve source identities, dates, local geography and two unpaired executive offices", async () => {
	const { parsed } = await parsedFixture();
	assert.equal(parsed.records.length, 7);
	assert.equal(parsed.records.filter(record => record.status === "filed").length, 6);
	assert.equal(parsed.records.filter(record => record.status === "write-in").length, 1);
	assert.equal(parsed.records.find(record => record.name === "Casey Example")!.district, "4");
	assert.equal(parsed.records.find(record => record.name === "Casey Example")!.scope, "state-senate");
	assert.equal(parsed.records.find(record => record.name === "Dana Example")!.scope, "local");
	assert.equal(parsed.records.find(record => record.name === "Dana Example")!.district, "");
	assert(parsed.records.some(record => record.office === "Lieutenant Governor"));
	assert(parsed.records.every(record => record.seats === undefined && record.voteLimit === undefined));
	assert(parsed.records.every(record => !record.name.includes(" / ")));
	assert.equal(parsed.records.at(-1)!.candidateUrl, `${douglasDiscoveryUrl}#WriteIns`);
	assert.equal(parsed.records.at(-1)!.sourceStatus, "Write-in filed 2026-09-16");
});
test("personal affiliation is not converted to a party nomination in a nonpartisan office", async () => {
	const { parsed } = await parsedFixture();
	assert.equal(parsed.records.find(record => record.name === "Ada Example")!.party, "Republican");
	assert.equal(parsed.records.find(record => record.name === "Bob Example")!.party, "Democratic");
	assert.equal(parsed.records.find(record => record.name === "Casey Example")!.party, undefined);
	assert.equal(parsed.records.find(record => record.name === "Dana Example")!.party, undefined);
	assert.equal(parsed.records.find(record => record.name === "Emery Example")!.party, "Nonpartisan");
	assert.equal(parsed.claims.find(claim => claim.record.name === "Casey Example")!.personalAffiliation, "Republican");
	assert(parsed.claims.every(claim => claim.personalAffiliationNotANomination));
	const filing = readDouglasRoster(douglasFormFixture("2026", true), source.electionDate).filings[0]!;
	assert.equal(readDouglasProfile(douglasProfileFixture("101").replace(">Republican<", "><"), filing, "2026").party, undefined);
});
test("filing-only sources never become a ballot or an ordinary judicial race", async () => {
	const { snapshot } = await parsedFixture();
	assert.equal(buildStateBallotPreview(snapshot, { districtMatches: [] }), null);
	assert.equal(buildStateBallotPreview({ ...snapshot, source: { ...source, ballotPreview: undefined } }, { districtMatches: [] }), null);
	const future = await parsedFixture("2032-11-02");
	assert.equal(buildStateBallotPreview({ ...future.snapshot, source: { ...future.snapshot.source, ballotPreview: undefined } }, { districtMatches: [] }), null);
	assert(snapshot.records.some(record => record.office === "Douglas County Court - District 4"));
	validateDouglasSource(source);
	assert.throws(() => validateDouglasSource({ ...source, ballotPreview: undefined }), /review/u);
});
test("independently offered future dates and profile IDs need no annual edit", async () => {
	for (const date of ["2028-11-07", "2032-11-02"]) {
		const fixture = await parsedFixture(date);
		assert.equal(fixture.parsed.records.length, 7);
		assert(fixture.parsed.records[0]!.candidateUrl!.includes(`${date.slice(0, 4)}%20General`));
		const current = await parsedFixture();
		assert.notEqual(fixture.parsed.records[0]!.id, current.parsed.records[0]!.id);
		const catalog = discoverStateBallotElectionCycles(fixture.body, source.id, fixture.now());
		assert.equal(stateBallotCycleSources(catalog, fixture.now())[0]!.id, `ne-douglas-general-${date}`);
	}
	assert.throws(() => readDouglasCalendar(douglasCalendarFixture("2026-11-04")), /review/u);
	assert.throws(() => readDouglasCalendar(douglasCalendarFixture("2027-11-02")), /review/u);
});
test("absent calendars and empty future filings stay pending without inventing candidates", async () => {
	const unpublished = await discoveryFixture(source.electionDate, true, false);
	assert.deepEqual(readDouglasCandidateDiscovery(unpublished.body, unpublished.now()).elections, []);
	assert.equal(unpublished.calls.length, 5);
	const empty = await discoveryFixture(source.electionDate, false);
	const capture = await fetchDouglasCandidateCapture(source, { discovery: empty.body, now: empty.now });
	assert.throws(() => parseDouglasCandidateCapture(source, capture, empty.now()), /no records yet/u);
	const prior = await parsedFixture();
	assert.throws(() => parseDouglasCandidateCapture(source, capture, empty.now(), prior.parsed.records), /review/u);
});
test("unknown filters, altered hidden controls and contradictory office lists hold", () => {
	for (const changed of [
		douglasFormFixture().replace("method=\"post\"", "method=\"get\""),
		douglasFormFixture().replace("action=\"./candidate_info.aspx\"", "action=\"https://other.example/\""),
		douglasFormFixture().replace("name=\"__VIEWSTATE\"", "name=\"__EVENTTARGET\""),
		douglasFormFixture().replace("value=\"2026G\"", "value=\"2026P\""),
		douglasFormFixture("2026", true).replace("<option selected value=\"\">Select an Office", "<option selected value=\"139\">Select an Office"),
		douglasFormFixture("2026", true).replace("Filed: 01/30/2026", "Filed: 02/30/2026"),
		douglasFormFixture("2026", true).replace("cid=101&amp;oid=139", "cid=101&amp;oid=140"),
		douglasFormFixture("2026", true).replace("Ada Example</a>", "Unknown 123</a>"),
		douglasFormFixture("2026", true).replace("<tr><td><a href=\"candidates.aspx?cid=101", "<tr hidden><td><a href=\"candidates.aspx?cid=101")
	]) assert.throws(() => readDouglasRoster(changed, source.electionDate), /review/u);
});
test("profile name, office, election, filing date and visible affiliation remain bound together", () => {
	const filing = readDouglasRoster(douglasFormFixture("2026", true), source.electionDate).filings[0]!;
	for (const changed of [
		douglasProfileFixture("101").replace("value=\"101\"", "value=\"102\""),
		douglasProfileFixture("101").replace("value=\"139\"", "value=\"140\""),
		douglasProfileFixture("101").replace("Ada Example, Governor", "Other Example, Governor"),
		douglasProfileFixture("101").replace("2026 General Election", "2026 Primary Election"),
		douglasProfileFixture("101").replace("1/30/2026", "1/31/2026"),
		douglasProfileFixture("101").replace("<div><span id=\"ContentPlaceHolder1_gvCandidateInfo_lblParty_0\"", "<div style=\"display:none\"><span id=\"ContentPlaceHolder1_gvCandidateInfo_lblParty_0\""),
		douglasProfileFixture("101").replace("id=\"ContentPlaceHolder1_gvCandidateInfo_lblParty_0\"", "id=\"unknownParty\"")
	]) assert.throws(() => readDouglasProfile(changed, filing, "2026"), /review/u);
	for (const value of [`${filing.profileUrl!}&preview=1`, filing.profileUrl!.replace("https:", "http:"), filing.profileUrl!.replace("www.votedouglascounty-ne.gov", "other.example"), filing.profileUrl!.replace("cid=101", "cid=%31101"), filing.profileUrl!.replace("%20General", "+General")]) assert.throws(() => validateDouglasProfileUrl(value, "2026"), /review/u);
});
test("policy changes, missing profile pages and future clocks hold rather than clear accepted rows", async () => {
	const fixture = await parsedFixture();
	for (const mutate of [(value: Record<string, any>) => value.privacy.body += "<a href=\"/terms\">New terms</a>", (value: Record<string, any>) => value.home.body += "<a href=\"/terms\">New terms</a>", (value: Record<string, any>) => value.collections[0].profiles.pop(), (value: Record<string, any>) => value.collections[0].selected.retrievedAt = "2032-01-01T00:00:00.000Z"]) {
		const value = JSON.parse(fixture.body);
		mutate(value);
		for (const key of ["privacy", "home"]) value[key].sha256 = hash(value[key].body);
		assert.throws(() => readDouglasCandidateDiscovery(JSON.stringify(value), fixture.now()), /review/u);
	}
	assert.throws(() => parseDouglasCandidateCapture(source, fixture.capture, fixture.now(), [...fixture.parsed.records, { ...fixture.parsed.records[0]!, id: "f".repeat(24) }]), /review/u);
	assert.equal(douglasPolicyFingerprint(douglasPolicyFixture.footer!, "links"), douglasLinksSha256);
	assert.equal(douglasPolicyFingerprint(douglasPolicyFixture.privacy! + douglasPolicyFixture.footer!, "privacy"), douglasPrivacySha256);
});
test("changed robots and unavailable public requests stop collection immediately", async () => {
	for (const status of [403, 429, 503]) {
		let calls = 0;
		await assert.rejects(fetchDouglasCandidateDiscovery({ requestText: async () => {
			calls++;
			throw new Error(`HTTP ${status}`);
		} }), new RegExp(String(status), "u"));
		assert.equal(calls, 1);
	}
	let calls = 0;
	await assert.rejects(fetchDouglasCandidateDiscovery({ requestText: async () => {
		calls++;
		return "User-agent: *\nDisallow: /\n";
	} }), /review/u);
	assert.equal(calls, 1);
	assert.throws(() => readDouglasCandidateDiscovery(" ".repeat(20 * 1024 * 1024 + 1)), /review/u);
	assert.throws(() => readDouglasForm("<div>".repeat(70)), /review/u);
});
test("stored filings survive restarts with exact profile provenance and no publisher traffic", async () => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-douglas-"));
	try {
		const fixture = await parsedFixture();
		const body = serializeStoredStateSnapshot(fixture.snapshot);
		assert.deepEqual(parseBundledStateSnapshot(source, body, "automatic").records, fixture.parsed.records);
		await createStateBallotStorage(directory).write(fixture.snapshot);
		let requests = 0;
		const repository = createStateBallotRepository({ sources: [source], dataDirectory: directory, now: fixture.now, ttlMs: 1, fetchText: async () => {
			requests++;
			throw new Error("offline");
		} });
		assert.deepEqual((await repository.getSnapshot("NE", source.id))!.records, fixture.parsed.records);
		assert.equal(requests, 0);
		for (const mutate of [(value: Record<string, any>) => value.records[0].status = "qualified", (value: Record<string, any>) => value.records[0].scope = "local", (value: Record<string, any>) => value.records[0].sourceCandidateId = "999", (value: Record<string, any>) => value.records[0].candidateUrl = "https://other.example/", (value: Record<string, any>) => value.records[6].party = "Republican", (value: Record<string, any>) => value.documents.pop(), (value: Record<string, any>) => value.collectionIndexSha256 = "b".repeat(64), (value: Record<string, any>) => value.sourceAsOfDate = source.electionDate]) {
			const value = JSON.parse(body);
			mutate(value);
			assert.throws(() => parseBundledStateSnapshot(source, JSON.stringify(value), "automatic"), /review|metadata/u);
		}
	}
	finally {
		await rm(directory, { recursive: true, force: true });
	}
});
test("managed imports are idempotent and disappearing accepted publications retain durable state", async () => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-douglas-sync-"));
	try {
		const fixture = await discoveryFixture();
		const options = { familyId: source.id, catalogPath: join(directory, "cycles.json"), dataDirectory: join(directory, "data"), now: fixture.now, fetchDiscovery: async () => fixture.body };
		const first = await syncStateBallotCycles(options);
		assert.equal(first.results[0]!.imported, true);
		assert.equal(first.results[0]!.records, 7);
		const prior = await readFile(join(directory, "data", `${source.id}.json`), "utf8");
		const catalog = await readFile(options.catalogPath, "utf8");
		const repeated = await syncStateBallotCycles({ ...options, fetchCandidates: async () => {
			throw new Error("Unexpected collection");
		} });
		assert.equal(repeated.results[0]!.imported, false);
		const missing = await discoveryFixture(source.electionDate, true, false);
		await assert.rejects(syncStateBallotCycles({ ...options, fetchDiscovery: async () => missing.body }), /disappeared|review/u);
		assert.equal(await readFile(join(directory, "data", `${source.id}.json`), "utf8"), prior);
		assert.equal(await readFile(options.catalogPath, "utf8"), catalog);
	}
	finally {
		await rm(directory, { recursive: true, force: true });
	}
});
test("the county family is independent of the held statewide publisher and validates exact scope", () => {
	assert.deepEqual(configuredStateBallotSources.find(item => item.id === source.id), source);
	assert.equal(configuredStateBallotSources.length, 74);
	assert.equal(configuredStateBallotSources.find(item => item.id === "ne-sos-2026")!.retrievalPolicy, "manual-snapshot");
	assert.equal(getStateBallotCycleFamily(source.id).prefix, "ne-douglas-general");
	for (const change of [{ countyName: "Other County" }, { stateCode: "IA" }, { snapshotStorage: undefined }, { retrievalPolicy: "manual-snapshot" }]) assert.throws(() => validateDouglasSource({ ...source, ...change } as StateBallotSource), /review/u);
	validateDouglasElection({ electionId: null, electionDate: source.electionDate, pageUrl: source.pageUrl, douglasDocuments: [{ url: douglasDiscoveryUrl, sha256: "a".repeat(64) }] });
	assert.throws(() => validateDouglasElection({ electionId: null, electionDate: source.electionDate, pageUrl: source.pageUrl, douglasDocuments: [{ url: "https://other.example/", sha256: "a".repeat(64) }] }), /review/u);
	assert.equal(Buffer.byteLength(douglasPolicyFixture.robots!), 407);
});
