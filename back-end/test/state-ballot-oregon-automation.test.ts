import type { StateBallotSource } from "../src/state-ballot-sources.js";
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import test from "node:test";
import { syncStateBallotCycles } from "../src/state-ballot-cycle-sync.js";
import { discoverStateBallotElectionCycles, parseStateBallotCycleCatalog, stateBallotCycleSources } from "../src/state-ballot-cycles.js";
import { fetchOregonCandidateCapture, fetchOregonCycleDiscovery, oregonPolicyReceipts, parseOregonCandidateCapture, readOregonElectionDiscovery, validateOregonSource } from "../src/state-ballot-oregon-collection.js";
import { createStateCandidateRecord, parseStateCandidateRecords } from "../src/state-ballot-records.js";
import { configuredStateBallotSources, legacyReviewedStateBallotSource } from "../src/state-ballot-registry.js";
import { createStateBallotRepository } from "../src/state-ballot-repository.js";
import { stateBallotSources } from "../src/state-ballot-sources.js";
import { createStateBallotStorage } from "../src/state-ballot-storage.js";

const source = configuredStateBallotSources.find(item => item.id === "or-sos-multnomah-2026")!;
const footer = readFileSync(new URL("./fixtures/oregon-county-footer.html", import.meta.url), "utf8");
const now = Date.parse("2026-10-25T12:00:00.000Z");
const digest = (body: string) => createHash("sha256").update(body).digest("hex");
const dateLabel = (date: string) => `November ${Number(date.slice(-2))}, ${date.slice(0, 4)}`;
const electionUrl = (date: string) => `https://multco.us/info/november-${Number(date.slice(-2))}-${date.slice(0, 4)}-general-election`;
function urls(date: string) {
	return [
		`https://multco.us/file/ballot_directive_-_november_${Number(date.slice(-2))}%2C_${date.slice(0, 4)}_general/download`,
		`https://multco.us/file/ballot_content_-_nov._${date.slice(0, 4)}/download`,
		`https://multco.us/file/ballot_content_rcv_-_nov._${date.slice(0, 4)}/download`
	];
}
function electionPage(date: string, offered = true) {
	return `<main><h1>${dateLabel(date)} General Election</h1>${offered ? urls(date).map((url, position) => `<a href="${url}">${position === 0 ? `Ballot Directive - ${dateLabel(date)} General` : `Ballot Content ${position === 2 ? "RCV " : ""}- Nov. ${date.slice(0, 4)}`}</a>`).join("") : ""}</main>${footer}`;
}
function discovery(dates = [source.electionDate], unpublished: string[] = []) {
	return JSON.stringify({
		schemaVersion: 1,
		type: "oregon-county-discovery",
		index: `<main><h1>Current and Upcoming Elections - Multnomah County Elections</h1>${dates.map(date => `<a href="${electionUrl(date)}">${dateLabel(date)} General Election</a>`).join("")}<a href="https://outside.example.invalid/primary">May 19, 2026 Primary Election</a></main>${footer}`,
		pages: [...dates].sort().map(date => ({ url: electionUrl(date), body: electionPage(date, !unpublished.includes(date)) })),
		policies: oregonPolicyReceipts
	});
}
function layouts(date: string) {
	const year = date.slice(0, 4);
	const numericDate = `11/${date.slice(-2)}/${year}`;
	const countyHeader = (rcv = false) => `County: MULTNOMAH\n Ballot Content${rcv ? " RCV" : ""} Date : 9/22/${year} 12:56:05 PM\n Report No. : E-019\n Election : ${numericDate} - November ${rcv ? "RCV" : "General"} Election ${year}\n`;
	const countyFooter = (number: number) => `Oregon Centralized Voter Registration Page : ${number}\n\f`;
	return [
		`SUBJECT: Official Ballot Statement for the General Election on ${dateLabel(date)}\n\fSecretary of State Elections Division\nCandidate Ballot Statement\n${year} General Election\nSeptember 3, ${year}\nUS Senator                 Vote for one\nPat Example                Republican\nLee Example                Democrat\nState Senator, 3rd District                 Vote for one\nTaylor Example             Democrat\nPage 2 of 2\n\f`,
		`${countyHeader()} Federal Offices\n   Federal\n     US Senator                  Vote for 1    6 Year Term\n         Pat Example             Republican\n         Lee Example             Democrat\n Number Candidates Filed: 2\n Contest Total: 1\n City Offices\n   City of Gresham\n     City of Gresham, Mayor       Vote for 1    4 Year Term\n         Alex Sample\n Number Candidates Filed: 1\n Contest Total: 1\n   City of Gresham\n        Measure No: 26-001\n Caption: Synthetic fixture question, not election content\n Contest Total: 1\n${countyFooter(1)}${countyHeader()}Number of Contest : 3\nNumber of Filed Candidates: 4\n${countyFooter(2)}`,
		`${countyHeader(true)} County Offices\n   Multnomah County\n     Multnomah County, Chair      Vote for 1    4 Year Term\n         Casey Sample\n Number Candidates Filed: 1\n Contest Total: 1\n${countyFooter(1)}`
	];
}
function capture(entry = source, body = discovery([entry.electionDate])) {
	return JSON.stringify({ schemaVersion: 1, type: "oregon-county-candidates", discovery: body, documents: layouts(entry.electionDate).map((text, position) => ({ url: entry.documentUrls![position], text, sha256: digest(text), retrievedAt: `${entry.electionDate.slice(0, 4)}-10-25T12:00:00.000Z` })) });
}

test("Oregon automatic discovery selects offered complete general-election documents and preserves the reviewed source identity", () => {
	assert.equal(source.format, "oregon-pdf");
	assert.equal(source.retrievalPolicy, undefined);
	validateOregonSource(source);
	assert.deepEqual(legacyReviewedStateBallotSource(source), stateBallotSources.find(item => item.id === source.id));
	const body = discovery(["2026-11-03", "2028-11-07"]);
	assert.equal(readOregonElectionDiscovery(body).length, 2);
	const catalog = discoverStateBallotElectionCycles(body, source.id, now);
	assert.equal(catalog.elections.length, 2);
	const future = stateBallotCycleSources(catalog, now)[0]!;
	assert.equal(future.id, "or-multnomah-general-2028-11-07");
	assert.equal(future.url, electionUrl("2028-11-07"));
	assert.deepEqual(future.documentUrls, urls("2028-11-07"));
	assert.doesNotMatch(future.scopeNotice!, /September|2026/u);
	validateOregonSource(future);
	assert.equal(readOregonElectionDiscovery(discovery(["2026-11-03", "2028-11-07"], ["2028-11-07"])).length, 1);
	assert.equal(readOregonElectionDiscovery(discovery().replaceAll("© 2026 |", "© 2028 |")).length, 1);
});

test("Oregon parses complete source pages, preserves fusion/overlap rules and separates ballot measures from candidates", () => {
	const records = parseStateCandidateRecords(source, capture());
	assert.equal(records.length, 5);
	assert.deepEqual(records.map(item => item.name), ["Pat Example", "Lee Example", "Taylor Example", "Alex Sample", "Casey Sample"]);
	assert.equal(records.filter(item => item.scope === "local").length, 2);
	assert.equal(records.find(item => item.name === "Taylor Example")!.district, "3");
	assert.equal(records.find(item => item.name === "Alex Sample")!.jurisdiction, "City of Gresham");
	assert.ok(records.every(item => item.status === "listed"));
	assert.ok(records.every(item => /^[a-f0-9]{24}$/u.test(item.id)));
	const leadingNewlines = JSON.parse(capture());
	for (const document of leadingNewlines.documents) document.text = document.text.replaceAll("\f", "\f\n");
	assert.deepEqual(parseStateCandidateRecords(source, JSON.stringify(leadingNewlines)), records);
	const revisedMeasureTail = JSON.parse(capture());
	const lastTime = revisedMeasureTail.documents[1].text.lastIndexOf("12:56:05 PM");
	revisedMeasureTail.documents[1].text = revisedMeasureTail.documents[1].text.slice(0, lastTime) + revisedMeasureTail.documents[1].text.slice(lastTime).replace("12:56:05 PM", "1:30:51 PM");
	assert.deepEqual(parseStateCandidateRecords(source, JSON.stringify(revisedMeasureTail)), records);
	const fused = capture().replaceAll("Pat Example                Republican", "Pat Example                Republican, Independent").replaceAll("Pat Example             Republican", "Pat Example             Republican, Independent");
	assert.equal(parseStateCandidateRecords(source, fused)[0]!.party, "Republican / Independent");
	const body = discovery(["2028-11-07"]);
	const future = stateBallotCycleSources(discoverStateBallotElectionCycles(body, source.id, now), now)[0]!;
	assert.equal(parseOregonCandidateCapture(future, capture(future, body), createStateCandidateRecord, Date.parse("2028-10-25T12:00:00.000Z")).records.length, 5);
});

test("Oregon rejects changed policies, wrong dates/hosts, duplicate elections and incomplete offered document sets", () => {
	for (const changed of [
		discovery().replaceAll("multnomah-county-website-terms", "changed-terms"),
		discovery().replaceAll("https://multco.us/file/", "https://outside.example.invalid/file/"),
		discovery().replaceAll("2026 General Election", "2026 Primary Election"),
		discovery().replaceAll("November 3, 2026", "November 4, 2026"),
		discovery().replace("803007435e82032fc59493356370597089f6e13a890990d6f3de11775be4dafe", "a".repeat(64)),
		discovery(["2026-11-03", "2026-11-03"])
	]) assert.throws(() => readOregonElectionDiscovery(changed));
	const partial = JSON.parse(discovery());
	partial.pages[0].body = partial.pages[0].body.replace(/<a href="[^"]+">Ballot Content RCV[^<]+<\/a>/u, "");
	assert.throws(() => readOregonElectionDiscovery(JSON.stringify(partial)), /definition|incomplete/u);
	const omitted = JSON.parse(discovery());
	omitted.pages = [];
	assert.throws(() => readOregonElectionDiscovery(JSON.stringify(omitted)), /omitted/u);
	const catalog = discoverStateBallotElectionCycles(discovery(), source.id, now);
	catalog.elections[0]!.oregonDocuments![0]!.url += "?copy=1";
	assert.throws(() => parseStateBallotCycleCatalog(catalog, now));
});

test("Oregon candidate layout drift, count mismatches, conflicting overlap and missing pages fail closed", () => {
	for (const transform of [
		(value: ReturnType<typeof JSON.parse>) => { value.documents.pop(); },
		(value: ReturnType<typeof JSON.parse>) => { value.documents[0].text = value.documents[0].text.replace("Page 2 of 2", "Page 1 of 2"); },
		(value: ReturnType<typeof JSON.parse>) => { value.documents[0].text = value.documents[0].text.replace("November 3, 2026", "November 7, 2028"); },
		(value: ReturnType<typeof JSON.parse>) => { value.documents[1].text = value.documents[1].text.replace("Number Candidates Filed: 2", "Number Candidates Filed: 3"); },
		(value: ReturnType<typeof JSON.parse>) => { value.documents[1].text = value.documents[1].text.replace("Number of Contest : 3", "Number of Contest : 0"); },
		(value: ReturnType<typeof JSON.parse>) => { value.documents[1].text = value.documents[1].text.replace("Number of Filed Candidates: 4", "Number of Filed Candidates: 4\nNumber of Filed Candidates: 4"); },
		(value: ReturnType<typeof JSON.parse>) => { value.documents[1].text = value.documents[1].text.replaceAll("9/22/2026", "9/31/2026"); },
		(value: ReturnType<typeof JSON.parse>) => { value.documents[0].text = value.documents[0].text.replace("September 3, 2026", "September 31, 2026"); },
		(value: ReturnType<typeof JSON.parse>) => { value.documents[0].retrievedAt = "2026-01-01T00:00:00.000Z"; },
		(value: ReturnType<typeof JSON.parse>) => { value.documents[1].text = value.documents[1].text.replace("Pat Example             Republican", "Pat Example             Democrat"); },
		(value: ReturnType<typeof JSON.parse>) => { value.documents[1].text = value.documents[1].text.replace("Caption: Synthetic", "Number Candidates Filed: 1\nCaption: Synthetic"); },
		(value: ReturnType<typeof JSON.parse>) => { value.documents[2].text = value.documents[2].text.replace("Page : 1", "Page : 2"); },
		(value: ReturnType<typeof JSON.parse>) => { value.documents[1].retrievedAt = "invalid"; },
		(value: ReturnType<typeof JSON.parse>) => { value.documents[1].url += "#different"; },
		(value: ReturnType<typeof JSON.parse>) => { value.documents[1].text += "Unexpected extra page\f"; }
	]) {
		const value = JSON.parse(capture());
		transform(value);
		assert.throws(() => parseStateCandidateRecords(source, JSON.stringify(value)));
	}
});

test("Oregon aggregate report fields are not mistaken for a verified count of named candidates", () => {
	const value = JSON.parse(capture());
	value.documents[1].text = value.documents[1].text.replace("Number of Contest : 3", "Number of Contest : 63").replace("Number of Filed Candidates: 4", "Number of Filed Candidates: 116");
	assert.deepEqual(parseStateCandidateRecords(source, JSON.stringify(value)), parseStateCandidateRecords(source, capture()));
});

test("Oregon captures only the three publisher-offered PDFs with normal bounded transport and serial pacing", async () => {
	const requested: string[] = [];
	const delays: number[] = [];
	const body = await fetchOregonCandidateCapture(source, {
		discovery: discovery(),
		now: () => now,
		wait: async (delay) => { delays.push(delay); },
		requestText: async () => { assert.fail("A captured discovery must not make new discovery requests"); },
		requestDocument: async (url, options) => {
			requested.push(url);
			assert.deepEqual(options?.allowedHosts, ["multco.us"]);
			assert.equal(options?.maxBytes, 12 * 1024 * 1024);
			return { status: 200, body: Buffer.from(`%PDF-synthetic-${requested.length - 1}`), contentType: "application/pdf", etag: undefined };
		},
		extractor: async bytes => layouts(source.electionDate)[Number(bytes.toString().split("-").at(-1))]!
	});
	assert.deepEqual(requested, source.documentUrls);
	assert.deepEqual(delays, [11000, 11000, 11000]);
	assert.equal(parseStateCandidateRecords(source, body).length, 5);
	const previous = process.env.STATE_BALLOT_PDFTOTEXT;
	try {
		process.env.STATE_BALLOT_PDFTOTEXT = "/missing/synthetic-pdftotext";
		await assert.rejects(fetchOregonCandidateCapture(source, { requestText: async () => {
			assert.fail("Missing capability must fail before publisher access");
		} }), /unavailable/u);
	}
	finally {
		if (previous === undefined) delete process.env.STATE_BALLOT_PDFTOTEXT;
		else process.env.STATE_BALLOT_PDFTOTEXT = previous;
	}
	let requests = 0;
	await assert.rejects(fetchOregonCycleDiscovery({ requestText: async () => {
		requests++;
		return "User-agent: *\nDisallow: /\n";
	}, wait: async () => {} }), /policy/u);
	assert.equal(requests, 1);
});

test("Oregon routine imports are cached, preserve failed-refresh data and retain legacy reviewed snapshots", async () => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-oregon-automation-"));
	try {
		let current = now;
		let requests = 0;
		let failed = false;
		const repository = createStateBallotRepository({ sources: [source], dataDirectory: directory, ttlMs: 60000, now: () => current, fetchText: async () => {
			requests++;
			if (failed) throw new Error("Synthetic policy change");
			return capture();
		} });
		const first = await repository.getSnapshot("OR", source.id);
		assert.equal(first!.records.length, 5);
		assert.equal(requests, 1);
		assert.deepEqual(await repository.getSnapshot("OR", source.id), first);
		assert.equal(requests, 1);
		current += 60001;
		failed = true;
		await repository.getSnapshot("OR", source.id);
		assert.equal(requests, 2);
		assert.deepEqual((await createStateBallotStorage(directory).read(source))!.records, JSON.parse(JSON.stringify(first!.records)));
		const observation = (await repository.inspectSources!())[0]!;
		assert.equal(observation.status, "error");
		const legacyDirectory = join(directory, "legacy");
		await createStateBallotStorage(legacyDirectory).write({ ...first!, source: legacyReviewedStateBallotSource(source)! });
		const retained = createStateBallotRepository({ sources: [source], dataDirectory: legacyDirectory, now: () => now, fetchText: async () => {
			assert.fail("A persisted reviewed snapshot must remain readable without a downloader");
		} });
		assert.deepEqual((await retained.getSnapshot("OR", source.id))!.records, JSON.parse(JSON.stringify(first!.records)));
	}
	finally { await rm(directory, { recursive: true, force: true }); }
});

test("Oregon cycle sync persists offered future dates, reuses accepted imports and quarantines disappearing elections", async () => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-oregon-cycles-"));
	try {
		const path = join(directory, "oregon-cycles.json");
		const body = discovery(["2026-11-03", "2028-11-07"]);
		let requests = 0;
		let current = now;
		const options = { familyId: source.id, catalogPath: path, dataDirectory: directory, now: () => current, fetchDiscovery: async () => body, fetchCandidates: async (entry: StateBallotSource) => {
			requests++;
			return capture(entry, body);
		} };
		const first = await syncStateBallotCycles(options);
		assert.equal(first.results.length, 2);
		assert.equal(first.results[0]!.status, "available");
		assert.equal(first.results[1]!.status, "unavailable");
		assert.equal(first.results[1]!.imported, false);
		current = Date.parse("2028-10-25T12:00:00.000Z");
		const second = await syncStateBallotCycles(options);
		assert.equal(requests, 3);
		assert.equal(second.results[0]!.status, "expired");
		assert.equal(second.results[1]!.status, "available");
		assert.equal(second.results[1]!.records, 5);
		assert.equal(second.results[1]!.imported, true);
		const cached = await syncStateBallotCycles(options);
		assert.equal(requests, 3);
		assert.equal(cached.results[1]!.status, "available");
		assert.equal(cached.results[1]!.imported, false);
		const retained = await readFile(path, "utf8");
		await assert.rejects(syncStateBallotCycles({ ...options, fetchDiscovery: async () => discovery() }), /disappeared/u);
		assert.equal(await readFile(path, "utf8"), retained);
	}
	finally { await rm(directory, { recursive: true, force: true }); }
});
