import type { StateBallotSource } from "../src/state-ballot-sources.js";
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import test from "node:test";
import { refreshApprovedCandidateData } from "../src/state-ballot-automation.js";
import { syncStateBallotCycles } from "../src/state-ballot-cycle-sync.js";
import { discoverStateBallotElectionCycles, stateBallotCycleSources, writeStateBallotCycleCatalog } from "../src/state-ballot-cycles.js";
import { extractFultonPdfText, fetchFultonCandidateCapture, fetchFultonCycleDiscovery, FultonCollectorCapabilityError, fultonDiscoveryUrl, fultonPolicyReceipts, parseFultonCandidateCapture, readFultonElectionDiscovery, resolveFultonExtractor } from "../src/state-ballot-fulton.js";
import { parseStateCandidateRecords } from "../src/state-ballot-records.js";
import { configuredStateBallotSources, legacyFultonReviewedSource } from "../src/state-ballot-registry.js";
import { buildStateBallotPreview, createStateBallotRepository } from "../src/state-ballot-repository.js";
import { stateBallotSources } from "../src/state-ballot-sources.js";
import { createStateBallotStorage } from "../src/state-ballot-storage.js";

const source = configuredStateBallotSources.find(item => item.id === "ga-fulton-2026")!;
const legacy = stateBallotSources.find(item => item.id === source.id)!;
const now = Date.parse("2026-10-25T12:00:00.000Z");
const timestamp = new Date(now).toISOString();
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const scope = `<main>five members of the commission are determined by statewide election</main><footer><a href="/privacysecurity">Privacy/Security</a></footer>`;
const dateLabel = (date: string) => `November ${Number(date.slice(-2))}, ${date.slice(0, 4)}`;
const linksFor = (date: string) => date === legacy.electionDate ? legacy.documentUrls!.slice(0, 2) : [`https://fultoncountyga.gov/-/media/elections/${date}/published-ballot.pdf`, `https://fultoncountyga.gov/-/media/elections/${date}/published-writeins.pdf`];
const discovery = (date = legacy.electionDate) => JSON.stringify({ schemaVersion: 1, type: "fulton-discovery", index: `<main><h1>Sample Ballots</h1><a href="${linksFor(date)[0]}">Click here for the ${dateLabel(date)} General / Special Election Consolidated Sample Ballot.</a><a href="${linksFor(date)[1]}">Click here to view the ${dateLabel(date)} Notice of Qualified Write-In Candidates for Fulton County Commission District 5.</a></main><footer><a href="/Privacy-Statement">Privacy Statement</a></footer>`, policies: fultonPolicyReceipts, scope });
const row = (office: string, candidate: string) => (`For ${office}`).padEnd(68, " ") + candidate;
const ballot = (date = source.electionDate) => `FULTON COUNTY ELECTIONS\n${dateLabel(date)} General Special Election\nCONSOLIDATED SAMPLE BALLOT\n${row("Governor", "Synthetic Governor – Republican (Incumbent)")}\n${" ".repeat(68)}Synthetic Challenger – Democrat\n${row("Public Service Commissioner District 3", "Synthetic Commissioner – Democrat")}\n${row("County Commissioner – District 4", "Synthetic First")}\n${"(Unexpired Term Earlier Official, Resigned)".padEnd(68, " ")}Synthetic Second – Democrat\n\nTransportation Special Purpose Local Option Sales and Use Tax\nYes or No\n${" ".repeat(68)}Shall a question be decided?\f`;
const writeins = (date = source.electionDate) => `NOTICE OF QUALIFIED\nWRITE-IN CANDIDATES\nPursuant to Election Code 21-2-133 and 21-2-401(d), the following Write-In\nCandidates have qualified for the ${dateLabel(date)}, General Election:\nFor Fulton County Commission District 5\nSynthetic Qualified Person\nSynthetic Other Person\nWrite-in votes will be counted only for the candidates on this list pursuant to\nO.C.G.A 21-2-494\f`;
function capture(selected = source) {
	const documents = selected.documentUrls!.map((url, position) => ({ url, text: position === 0 ? ballot(selected.electionDate) : position === selected.documentUrls!.length - 1 ? scope : writeins(selected.electionDate), sha256: position === selected.documentUrls!.length - 1 ? hash(scope) : hash(url), retrievedAt: timestamp }));
	return JSON.stringify({ schemaVersion: 1, type: "fulton-candidate-export", discovery: discovery(selected.electionDate), documents });
}
function legacySnapshot(retrievedAt = "2026-10-24T12:00:00.000Z") {
	const documents = legacy.documentUrls!.map((url, position) => ({ url, sha256: hash(url), retrievedAt, includedRecordCount: position === 0 ? 1 : 0 }));
	return { source: legacy, retrievedAt, documents, sha256: hash(JSON.stringify(documents.map(({ url, sha256 }) => ({ url, sha256 })))), records: [{ id: "a".repeat(24), name: "Previously Reviewed Person", office: "Governor", district: "", scope: "statewide" as const, status: "listed" as const }] };
}

test("Fulton promotion preserves the exact legacy descriptor and rejects altered legacy source mappings", () => {
	assert.equal(source.format, "fulton-pdf");
	assert.equal(source.retrievalPolicy, undefined);
	assert.equal(hash(JSON.stringify(legacy)), "b8ab370ced416595d18d11a25da128cd4839fedab0dc036195b146bf6e3b7c8d");
	assert.deepEqual(legacyFultonReviewedSource(source), legacy);
	assert.equal(legacyFultonReviewedSource({ ...source, pageUrl: "https://example.org/" }), null);
});

test("Fulton discovery binds actual offered PDFs and explicit odd/even November general dates", () => {
	assert.equal(readFultonElectionDiscovery(discovery())[0]!.documents[0]!.url, legacy.documentUrls![0]);
	for (const date of ["2027-11-02", "2028-11-07"]) {
		const catalog = discoverStateBallotElectionCycles(discovery(date), source.id, now);
		const instance = stateBallotCycleSources(catalog, now)[0]!;
		assert.equal(instance.electionDate, date);
		assert.equal(instance.documentUrls![0], linksFor(date)[0]);
		assert.equal(instance.url, fultonDiscoveryUrl);
		assert.equal(parseFultonCandidateCapture(instance, capture(instance)).records.length, 7);
	}
	for (const changed of [discovery().replaceAll("https://fultoncountyga.gov/-/media/", "https://example.org/"), discovery().replaceAll("November 3, 2026", "November 4, 2026"), discovery().replace("Privacy Statement</a>", "Privacy Statement</a><a href='/new-terms'>Terms of Use</a>"), discovery().replace(fultonPolicyReceipts[0].sha256, "f".repeat(64))]) assert.throws(() => readFultonElectionDiscovery(changed));
});

test("Fulton facts preserve names, literal parties, unexpired terms, statewide PSC scope and qualified county write-ins", () => {
	const parsed = parseFultonCandidateCapture(source, capture());
	assert.equal(parsed.records.length, 7);
	assert.equal(parsed.records.find(item => item.office.startsWith("Public Service Commissioner"))!.scope, "statewide");
	assert.equal(parsed.records.filter(item => item.office.includes("Unexpired Term")).length, 2);
	assert.ok(parsed.records.filter(item => item.office.includes("Unexpired Term")).every(item => item.ballotDesignation === "(Unexpired Term Earlier Official, Resigned)"));
	assert.ok(parsed.records.every(item => item.name !== "Earlier Official"));
	assert.equal(parsed.records.filter(item => item.status === "write-in").length, 2);
	assert.ok(parsed.records.filter(item => item.status === "write-in").every(item => item.party === undefined && item.scope === "local"));
	assert.deepEqual(parsed.documents.map(item => item.includedRecordCount), [5, 2, 0]);
	assert.deepEqual(parseStateCandidateRecords(source, capture()), parsed.records);
	assert.doesNotMatch(buildStateBallotPreview({ source, ...parsed }, { districtMatches: [] })!.disclaimer, /Filing does not establish/iu);
	assert.doesNotMatch(JSON.stringify(parsed.records), /Shall a question|phone|email|address/iu);
});

test("Fulton changed layouts, truncated/filtered documents, unknown offices/parties, altered dates and conflicting provenance fail closed", () => {
	for (const change of [(value: string) => value.replaceAll("General Special Election", "Primary Election"), (value: string) => value.replaceAll("For Governor", "For Unknown Office"), (value: string) => value.replaceAll("Republican (Incumbent)", "Unknown Party"), (value: string) => value.replaceAll("November 3, 2026", "November 7, 2028"), (value: string) => value.replaceAll("CONSOLIDATED SAMPLE BALLOT", "Filtered sample")]) assert.throws(() => parseFultonCandidateCapture(source, change(capture())));
	const value = JSON.parse(capture());
	assert.throws(() => parseFultonCandidateCapture(source, JSON.stringify({ ...value, documents: value.documents.slice(0, 2) })));
	value.documents[2].sha256 = "a".repeat(64);
	assert.throws(() => parseFultonCandidateCapture(source, JSON.stringify(value)));
	assert.throws(() => parseFultonCandidateCapture({ ...source, url: "https://example.org/" }, capture()));
});

test("a missing extractor or changed robots policy stops before candidate document requests", async () => {
	const previous = process.env.STATE_BALLOT_PDFTOTEXT;
	try {
		delete process.env.STATE_BALLOT_PDFTOTEXT;
		let requests = 0;
		await assert.rejects(fetchFultonCandidateCapture(source, { requestText: async () => {
			requests++;
			return "";
		} }), FultonCollectorCapabilityError);
		assert.equal(requests, 0);
		await assert.rejects(fetchFultonCycleDiscovery(async () => {
			requests++;
			return "User-agent: *\nDisallow: /";
		}));
		assert.equal(requests, 1);
		for (const invalid of ["pdftotext", "/missing/extractor", "/bad\u0000path"]) await assert.rejects(resolveFultonExtractor(invalid), FultonCollectorCapabilityError);
	}
	finally {
		if (previous === undefined) delete process.env.STATE_BALLOT_PDFTOTEXT;
		else process.env.STATE_BALLOT_PDFTOTEXT = previous;
	}
});

test("PDF processing uses bounded stdin/stdout, rejects failures and kills a timed-out process", async () => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-pdf-tool-"));
	try {
		const path = join(directory, "extractor");
		const bytes = Buffer.from("%PDF-1.7\nsynthetic test input\n%%EOF");
		await writeFile(path, `#!${process.execPath}\nprocess.stdin.resume();process.stdin.on('end',()=>process.stdout.write('Synthetic output\\f'));`, { mode: 0o700 });
		assert.equal(await resolveFultonExtractor(path), await realpath(path));
		assert.equal(await extractFultonPdfText(bytes, path), "Synthetic output\f");
		await writeFile(path, `#!${process.execPath}\nsetInterval(()=>{},1000);`);
		await assert.rejects(extractFultonPdfText(bytes, path, 50));
		await writeFile(path, `#!${process.execPath}\nprocess.stdin.resume();process.stdin.on('end',()=>process.stdout.write('x'.repeat(5*1024*1024)));`);
		await assert.rejects(extractFultonPdfText(bytes, path));
		await assert.rejects(extractFultonPdfText(Buffer.from("not a PDF"), path));
	}
	finally { await rm(directory, { recursive: true }); }
});

test("Fulton PDF denial and unexpected content type fail without extraction or redirect follow-up", async () => {
	for (const status of [302, 403, 200]) {
		let extracted = false;
		await assert.rejects(fetchFultonCandidateCapture(source, { discovery: discovery(), requestDocument: async () => ({ status, body: Buffer.from("blocked"), contentType: "text/html", etag: undefined }), extractor: async () => {
			extracted = true;
			return ballot();
		} }));
		assert.equal(extracted, false);
	}
});

test("legacy approved Fulton facts remain readable without network or relabeling their bytes", async () => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-fulton-legacy-"));
	try {
		const storage = createStateBallotStorage(directory);
		await storage.write(legacySnapshot());
		const path = join(directory, `${source.id}.json`);
		const original = await readFile(path, "utf8");
		let requests = 0;
		const repository = createStateBallotRepository({ sources: [source], dataDirectory: directory, now: () => now, fetchText: async () => {
			requests++;
			throw new Error("Public reads do not refresh reviewed fallback data");
		} });
		assert.equal((await repository.getSnapshot("GA"))!.source.retrievalPolicy, "manual-snapshot");
		assert.equal(requests, 0);
		assert.equal(await readFile(path, "utf8"), original);
		assert.equal((await repository.inspectSources!())[0]!.lastImportAt, null);
		const forced = createStateBallotRepository({ sources: [source], dataDirectory: directory, refreshReviewedLegacy: true, now: () => now, fetchText: async () => {
			throw new Error("offline");
		} });
		assert.equal((await forced.getSnapshot("GA"))!.records.length, 1);
		assert.equal((await forced.inspectSources!())[0]!.status, "error");
		assert.equal(await readFile(path, "utf8"), original);
		const refreshed = createStateBallotRepository({ sources: [source], dataDirectory: directory, refreshReviewedLegacy: true, now: () => now, fetchText: async () => capture() });
		assert.equal((await refreshed.getSnapshot("GA"))!.records.length, 7);
		assert.equal((await storage.read(source))!.source.retrievalPolicy, undefined);
		await assert.rejects(storage.read(legacy));
		await writeFile(path, original);
		assert.equal((await storage.read(legacy))!.records.length, 1);
	}
	finally { await rm(directory, { recursive: true }); }
});

test("cold and stale Fulton public readers retain native records without publisher work or clock changes", async () => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-fulton-public-reader-"));
	try {
		const snapshot = { source, ...parseFultonCandidateCapture(source, capture()) };
		await createStateBallotStorage(directory).write(snapshot);
		const path = join(directory, `${source.id}.json`);
		const before = await readFile(path, "utf8");
		let requests = 0;
		const options = { sources: [source], dataDirectory: directory, now: () => now + 12 * 60 * 60 * 1000, fetchText: async () => {
			requests++;
			throw new Error("Public reads must not collect.");
		} };
		for (const repository of [createStateBallotRepository(options), createStateBallotRepository(options)]) {
			assert.deepEqual((await repository.getSnapshot("GA"))!.records, snapshot.records);
			assert.equal((await repository.inspectSources!())[0]!.status, "stale");
			assert.equal((await repository.inspectSources!())[0]!.lastAttemptAt, null);
		}
		assert.equal(await createStateBallotRepository({ ...options, dataDirectory: null }).getSnapshot("GA"), null);
		assert.equal(requests, 0);
		assert.equal(await readFile(path, "utf8"), before);
	}
	finally { await rm(directory, { recursive: true }); }
});

test("a failed routine refresh with readable reviewed fallback is still a failed run and preserves success/import clocks", async () => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-fulton-run-"));
	try {
		await createStateBallotStorage(directory).write(legacySnapshot());
		const environment = { STATE_BALLOT_DATA_DIR: directory, STATE_BALLOT_ENABLED_STATES: "GA", STATE_BALLOT_ENABLED_SOURCES: source.id };
		const failed = await refreshApprovedCandidateData({ environment, now: () => now, fetchText: async () => {
			throw new Error("offline");
		} });
		assert.equal(failed.status, "failed");
		assert.equal(failed.results[0]!.records, 1);
		assert.equal(failed.lastImportAt, null);
		assert.equal(failed.lastSuccessAt, null);
		const succeeded = await refreshApprovedCandidateData({ environment, now: () => now, fetchText: async () => capture() });
		assert.equal(succeeded.status, "succeeded");
		assert.equal(succeeded.results[0]!.status, "imported");
		const cached = await refreshApprovedCandidateData({ environment, now: () => now + 1000, fetchText: async () => {
			throw new Error("No network");
		} });
		assert.equal(cached.status, "succeeded");
		assert.equal(cached.results[0]!.status, "cached");
		assert.equal(cached.lastSuccessAt, succeeded.lastSuccessAt);
	}
	finally { await rm(directory, { recursive: true }); }
});

test("future-dated legacy files are rejected without fallback or attempted collection", async () => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-fulton-future-file-"));
	try {
		await createStateBallotStorage(directory).write(legacySnapshot("2026-10-26T12:00:00.000Z"));
		let requests = 0;
		const repository = createStateBallotRepository({ sources: [source], dataDirectory: directory, refreshReviewedLegacy: true, now: () => now, fetchText: async () => {
			requests++;
			return capture();
		} });
		assert.equal(await repository.getSnapshot("GA"), null);
		assert.equal(requests, 0);
	}
	finally { await rm(directory, { recursive: true }); }
});

test("unexpired Fulton publication changes retain the accepted catalog and hot/cold repositories discover permitted future files", async () => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-fulton-catalog-"));
	const keys = ["STATE_BALLOT_ENABLED_STATES", "STATE_BALLOT_ENABLED_SOURCES", "STATE_BALLOT_ENABLED_FAMILIES", "STATE_BALLOT_CYCLE_CATALOGS"];
	const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
	try {
		const path = join(directory, "catalog.json");
		const body = discovery("2027-11-02");
		const catalog = discoverStateBallotElectionCycles(body, source.id, now);
		const instance = stateBallotCycleSources(catalog, now)[0]!;
		process.env.STATE_BALLOT_ENABLED_STATES = "GA";
		process.env.STATE_BALLOT_ENABLED_SOURCES = source.id;
		process.env.STATE_BALLOT_ENABLED_FAMILIES = source.id;
		process.env.STATE_BALLOT_CYCLE_CATALOGS = JSON.stringify({ [source.id]: path });
		const hot = createStateBallotRepository({ dataDirectory: directory, refreshReviewedLegacy: true, now: () => now, fetchText: async (entry: StateBallotSource) => capture(entry) });
		assert.equal(await hot.getSnapshot("GA", instance.id), null);
		await writeStateBallotCycleCatalog(path, catalog, now);
		assert.equal((await hot.getSnapshot("GA", instance.id))!.records.length, 7);
		const cold = createStateBallotRepository({ dataDirectory: directory, now: () => now, fetchText: async () => {
			throw new Error("Already cached");
		} });
		assert.equal((await cold.getSnapshot("GA", instance.id))!.records.length, 7);
		const accepted = await readFile(path, "utf8");
		await assert.rejects(syncStateBallotCycles({ familyId: source.id, catalogPath: path, dataDirectory: directory, now: () => now, fetchDiscovery: async () => body.replaceAll("published-ballot", "changed-ballot"), fetchCandidates: async entry => capture(entry) }));
		assert.equal(await readFile(path, "utf8"), accepted);
		delete process.env.STATE_BALLOT_ENABLED_FAMILIES;
		assert.equal(await hot.getSnapshot("GA", instance.id), null);
	}
	finally {
		for (const key of keys) {
			if (previous[key] === undefined) delete process.env[key];
			else process.env[key] = previous[key];
		}
		await rm(directory, { recursive: true });
	}
});
