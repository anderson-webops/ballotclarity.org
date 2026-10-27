import type { StateBallotSnapshot } from "../src/state-ballot-repository.js";
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { once } from "node:events";
import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import express from "express";
import { chicagoDiscoveryUrl, chicagoDocumentDigest, chicagoOfferedElections, chicagoPolicyFingerprint, fetchChicagoCycleDiscovery, validateChicagoDocumentUrl } from "../src/state-ballot-chicago-collection.js";
import { readChicagoBallotDocument } from "../src/state-ballot-chicago.js";
import { getStateBallotCycleFamily, parseStateBallotCycleCatalog, stateBallotCycleSources } from "../src/state-ballot-cycles.js";
import { chicagoNativePdfCollectorContract, extractStateBallotPdfXml, inspectStateBallotPdfObjects, stateBallotNativePdfCollectorContract } from "../src/state-ballot-pdf.js";
import { createStateCandidateRecord } from "../src/state-ballot-records.js";
import { attachStateBallotPreview, createStateBallotRepository } from "../src/state-ballot-repository.js";
import { parseBundledStateSnapshot } from "../src/state-ballot-snapshot.js";
import { createStateBallotStorage, serializeStoredStateSnapshot } from "../src/state-ballot-storage.js";
import { registerStateRecordRoutes } from "../src/state-records.js";
import { chicagoFixture } from "./helpers/chicago-fixture.js";

const hash = (body: string) => createHash("sha256").update(body).digest("hex");
const now = Date.parse("2028-10-20T12:00:00Z");
const url = "https://cboeprod.blob.core.usgovcloudapi.net/prod/2028-09/Synthetic%20Candidate%20List.pdf";
function fixture(): StateBallotSnapshot {
	const family = getStateBallotCycleFamily("il-chicago-2026");
	const catalog = parseStateBallotCycleCatalog({ schemaVersion: 1, type: "state-ballot-cycle-catalog", familyId: family.source.id, sourceConfigurationSha256: hash(JSON.stringify(family.source)), discovery: { url: chicagoDiscoveryUrl, sha256: hash("Synthetic discovery"), retrievedAt: new Date(now).toISOString() }, elections: [{ electionId: null, electionDate: "2028-11-07", pageUrl: chicagoDiscoveryUrl, chicagoDocuments: [{ kind: "general", url, sha256: hash("Synthetic PDF") }] }] }, now);
	const source = stateBallotCycleSources(catalog, now)[0]!;
	const parsed = readChicagoBallotDocument(source, chicagoFixture(2028), createStateCandidateRecord);
	const documents = [{ url, sha256: hash("Synthetic PDF"), retrievedAt: new Date(now).toISOString(), includedRecordCount: parsed.records.length }];
	return { source, records: parsed.records, ballotQuestions: parsed.questions, sourceAsOfDate: parsed.asOfDate, sourceAsOf: parsed.asOf, documents, retrievedAt: documents[0]!.retrievedAt, sha256: hash(JSON.stringify(documents.map(({ url, sha256 }) => ({ url, sha256 })))), collectionIndexSha256: chicagoDocumentDigest([{ kind: "general", url, sha256: documents[0]!.sha256 }]) };
}
const offered = (year: number, day: number, target = url) => `<a href="${target}">Click here for the full Candidate List for the November ${day}, ${year} General Election!</a>`;

test("Chicago discovers only explicitly offered full-list dates, not filing reports, calendar years or guessed URLs", () => {
	assert.deepEqual(chicagoOfferedElections(`<main>${offered(2028, 7)}<a href="https://example.org/new.pdf">Candidate Filing Report</a><p>2029 Chicago Election Calendar</p></main>`), [{ electionDate: "2028-11-07", url }]);
	assert.deepEqual(chicagoOfferedElections("<a href=\"https://example.org/report.pdf\">Candidate Filing Report</a>"), []);
	assert.throws(() => chicagoOfferedElections(offered(2028, 6)), /date/u);
	assert.throws(() => chicagoOfferedElections(offered(2028, 7) + offered(2028, 7, url.replace("Synthetic", "Other"))), /ambiguous/u);
	for (const target of ["https://example.org/list.pdf", `${url}?token=1`, `${url}#page=1`, url.replace("https:", "http:"), url.replace("Synthetic%20Candidate%20List.pdf", "..%2Flist.pdf")]) assert.throws(() => validateChicagoDocumentUrl(target));
});

test("Chicago policy fingerprints normalize only a valid copyright year and retain new legal links", () => {
	const footer = "<footer>Board of Election Commissioners for the City of Chicago © 2026 All Rights Reserved</footer>";
	assert.equal(chicagoPolicyFingerprint(footer, now), chicagoPolicyFingerprint(footer.replace("2026", "2028"), now));
	assert.notEqual(chicagoPolicyFingerprint(footer, now), chicagoPolicyFingerprint(`${footer}<a href="/terms">Terms</a>`, now));
	assert.throws(() => chicagoPolicyFingerprint(footer.replace("2026", "2030"), now));
});

test("Chicago can retain a verified empty future discovery without relaxing other catalog families", () => {
	const family = getStateBallotCycleFamily("il-chicago-2026");
	const catalog = { schemaVersion: 1, type: "state-ballot-cycle-catalog", familyId: family.source.id, sourceConfigurationSha256: hash(JSON.stringify(family.source)), discovery: { url: chicagoDiscoveryUrl, sha256: hash("Synthetic index without a full list"), retrievedAt: new Date(now).toISOString() }, elections: [] };
	assert.equal(parseStateBallotCycleCatalog(catalog, now).elections.length, 0);
	const other = getStateBallotCycleFamily("il-winnebago-2026");
	assert.throws(() => parseStateBallotCycleCatalog({ ...catalog, familyId: other.source.id, sourceConfigurationSha256: hash(JSON.stringify(other.source)), discovery: { ...catalog.discovery, url: other.discoveryUrl } }, now), /bounds/u);
});

test("Chicago stops on an unavailable or changed robots policy before any index or PDF request", async () => {
	const requests: string[] = [];
	await assert.rejects(fetchChicagoCycleDiscovery({ request: async (target) => {
		requests.push(target);
		return { status: 403, contentType: "text/html", body: Buffer.alloc(0), etag: undefined };
	}, sleep: async () => {} }), /robots policy/u);
	assert.deepEqual(requests, ["https://chicagoelections.gov/robots.txt"]);
});

test("Chicago future catalogs and durable snapshots preserve source dates, individual retention and question audiences", () => {
	const snapshot = fixture();
	const restored = parseBundledStateSnapshot(snapshot.source, serializeStoredStateSnapshot(snapshot), "automatic");
	assert.deepEqual(JSON.parse(JSON.stringify(restored)), JSON.parse(JSON.stringify(snapshot)));
	assert.equal(restored.source.electionDate, "2028-11-07");
	assert.equal(restored.source.placeName, "Chicago city");
	assert.equal(restored.source.countyName, undefined);
	assert.equal(restored.sourceAsOfDate, "2028-09-11");
	assert.equal(restored.ballotQuestions![0]!.voterApplicabilityVerified, false);
	assert.equal(restored.records.find(record => record.name === "Example Judge")!.party, undefined);
});

test("Chicago stored metadata rejects altered audiences, future dates, repeated questions and changed page evidence", () => {
	const snapshot = fixture();
	const serialized = serializeStoredStateSnapshot(snapshot);
	for (const mutate of [
		(value: Record<string, unknown>) => { value.sourceAsOfDate = "2028-11-08"; },
		(value: Record<string, unknown>) => { value.sourceAsOf = "9/12/2028 3:47:15 PM"; },
		(value: Record<string, unknown>) => {
			const questions = value.ballotQuestions as { audience: string }[];
			questions[0]!.audience = "Everyone";
		},
		(value: Record<string, unknown>) => {
			const questions = value.ballotQuestions as { pages: number[] }[];
			questions[0]!.pages = [51];
		},
		(value: Record<string, unknown>) => {
			const questions = value.ballotQuestions as unknown[];
			questions.push(questions[0]);
		},
		(value: Record<string, unknown>) => { value.collectionIndexSha256 = "f".repeat(64); }
	]) {
		const value = JSON.parse(serialized) as Record<string, unknown>;
		mutate(value);
		assert.throws(() => parseBundledStateSnapshot(snapshot.source, JSON.stringify(value), "automatic"));
	}
	const generic = { ...snapshot, source: { ...snapshot.source, format: "reviewed-pdf" as const, retrievalPolicy: "manual-snapshot" as const, documentUrls: [url] }, ballotQuestions: undefined, sourceAsOfDate: undefined, sourceAsOf: undefined, collectionIndexSha256: undefined };
	assert.throws(() => parseBundledStateSnapshot(generic.source, serializeStoredStateSnapshot(generic)), /vote limit/u);
});

test("Chicago public readers import no data and see durable candidate and question updates without a restart", async () => {
	const directory = await mkdtemp(join(tmpdir(), "chicago-storage-"));
	try {
		const snapshot = fixture();
		let requests = 0;
		const repository = createStateBallotRepository({ sources: [snapshot.source], dataDirectory: directory, now: () => now + 1000, fetchText: async () => {
			requests++;
			throw new Error("Publisher unavailable");
		} });
		assert.equal(await repository.getSnapshot("IL", snapshot.source.id), null);
		const storage = createStateBallotStorage(directory);
		await storage.write(snapshot);
		const first = await repository.getSnapshot("IL", snapshot.source.id);
		assert.equal(first!.sourceAsOfDate, snapshot.sourceAsOfDate);
		assert.deepEqual(first!.ballotQuestions, snapshot.ballotQuestions);
		const revised = structuredClone(snapshot);
		revised.records[0]!.sourceStatus = "Candidate; synthetic revision";
		await storage.write(revised);
		assert.equal((await repository.getSnapshot("IL", snapshot.source.id))!.records[0]!.sourceStatus, revised.records[0]!.sourceStatus);
		assert.equal(requests, 0);
	}
	finally { await rm(directory, { recursive: true, force: true }); }
});

test("Chicago source preference requires an address-matched city, not Cook County or a ZIP-only match", async () => {
	const snapshot = fixture();
	const fallback = { ...snapshot, source: { ...snapshot.source, id: "synthetic-other-source", placeName: undefined, countyName: "Cook County", defaultPriority: 10 } };
	const requested: (string | undefined)[] = [];
	const repository = { sources: [snapshot.source, fallback.source], async getSnapshot(_state: string, sourceId?: string) {
		requested.push(sourceId);
		return sourceId === snapshot.source.id ? snapshot : fallback;
	} };
	const county = { id: "county-17031", districtType: "county", label: "Cook County", sourceSystem: "Synthetic applicability context" };
	const place = { id: "place-1714000", districtType: "place", label: "Chicago city", sourceSystem: "Synthetic applicability context" };
	for (const [inputKind, districtMatches, expected] of [["address", [county], fallback.source.id], ["zip", [county, place], fallback.source.id], ["address", [county, place], snapshot.source.id]] as const) {
		requested.length = 0;
		const lookup = { result: "resolved", inputKind, location: { state: "IL" }, districtMatches: [...districtMatches] } as Parameters<typeof attachStateBallotPreview>[0];
		await attachStateBallotPreview(lookup, repository);
		assert.equal(requested[0], expected);
	}
});

test("Chicago question routes preserve provenance and distinguish unavailable data from service failure", async () => {
	const snapshot = fixture();
	let fail = false;
	const app = express();
	registerStateRecordRoutes(app, { sources: [snapshot.source], async getSnapshot() {
		if (fail) throw new Error("Synthetic storage failure");
		return snapshot;
	} });
	const server = app.listen(0, "127.0.0.1");
	await once(server, "listening");
	try {
		const address = server.address();
		assert(address && typeof address === "object");
		const origin = `http://127.0.0.1:${address.port}`;
		const path = `/api/state-records/IL/questions?source=${snapshot.source.id}`;
		const response = await fetch(origin + path);
		assert.equal(response.status, 200);
		assert.equal(response.headers.get("cache-control"), "no-store");
		const data = await response.json();
		assert.deepEqual(data.questions, snapshot.ballotQuestions);
		assert.equal(data.source.sourceAsOfDate, "2028-09-11");
		assert.equal(data.source.documentLinks[0].url, url);
		assert.equal((await fetch(`${origin + path}&id=invalid`)).status, 400);
		assert.equal((await fetch(`${origin + path}&source=duplicate`)).status, 400);
		fail = true;
		assert.equal((await fetch(origin + path)).status, 503);
	}
	finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});

test("Chicago native worker expansion is source-specific while standard page and object-output caps remain intact", async () => {
	assert.equal(stateBallotNativePdfCollectorContract.maximumPages, 20);
	assert.equal(stateBallotNativePdfCollectorContract.maximumOutputBytes, 4 * 1024 * 1024);
	assert.equal(chicagoNativePdfCollectorContract.maximumPages, 50);
	const directory = await mkdtemp(join(tmpdir(), "chicago-worker-"));
	try {
		const executable = join(directory, "extract");
		await writeFile(executable, `#!${process.execPath}\nprocess.stdin.resume();process.stdout.write(process.argv.includes("--json=2")?"x".repeat(5*1024*1024):"<pdf2xml>"+"<page/>".repeat(21)+"</pdf2xml>");\n`);
		await chmod(executable, 0o700);
		const pdf = Buffer.from("%PDF-Synthetic worker input");
		await assert.rejects(extractStateBallotPdfXml(pdf, executable), /bounds/u);
		assert.match(await extractStateBallotPdfXml(pdf, executable, "chicago"), /pdf2xml/u);
		await assert.rejects(inspectStateBallotPdfObjects(pdf, executable), /bounds/u);
		assert.equal((await inspectStateBallotPdfObjects(pdf, executable, "chicago")).length, 5 * 1024 * 1024);
	}
	finally { await rm(directory, { recursive: true, force: true }); }
});
