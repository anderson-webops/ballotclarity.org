import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { getStateBallotCycleFamily, parseStateBallotCycleCatalog, stateBallotCycleSources } from "../src/state-ballot-cycles.js";
import { extractStateBallotPdfXml, inspectStateBallotPdfObjects, resolveStateBallotPdfObjectInspector, resolveStateBallotPdfXmlExtractor, StateBallotPdfCapabilityError } from "../src/state-ballot-pdf.js";
import { createStateCandidateRecord, stateRecordMatchesDistricts } from "../src/state-ballot-records.js";
import { configuredStateBallotSources } from "../src/state-ballot-registry.js";
import { createStateBallotRepository } from "../src/state-ballot-repository.js";
import { createStateBallotStorage } from "../src/state-ballot-storage.js";
import { fetchWinnebagoCycleDiscovery, readWinnebagoDiscovery, validateWinnebagoDocumentUrl, winnebagoDiscoveryUrl, winnebagoDocumentDigest } from "../src/state-ballot-winnebago-collection.js";
import { inspectWinnebagoPdfFonts } from "../src/state-ballot-winnebago-fonts.js";
import { winnebagoNativePages } from "../src/state-ballot-winnebago-native.js";
import { inspectWinnebagoVisual, winnebagoGlyphBounds } from "../src/state-ballot-winnebago-visual.js";
import { readWinnebagoWriteIns } from "../src/state-ballot-winnebago-write-ins.js";
import { readWinnebagoCandidateDocument } from "../src/state-ballot-winnebago.js";
import { winnebagoFontFixture, winnebagoSvgFixture, winnebagoWriteInFixture } from "./helpers/winnebago-collection-fixture.js";
import { winnebagoField, winnebagoFixture } from "./helpers/winnebago-fixture.js";

const source = configuredStateBallotSources.find(source => source.id === "il-winnebago-2026")!;
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const futureDate = "2028-11-07";
const now = Date.parse("2028-10-20T12:00:00Z");
function futureSource() {
	const family = getStateBallotCycleFamily(source.id);
	const catalog = parseStateBallotCycleCatalog({ schemaVersion: 1, type: "state-ballot-cycle-catalog", familyId: source.id, sourceConfigurationSha256: hash(JSON.stringify(family.source)), discovery: { url: winnebagoDiscoveryUrl, sha256: hash("Synthetic discovery"), retrievedAt: new Date(now).toISOString() }, elections: [{ electionId: null, electionDate: futureDate, pageUrl: winnebagoDiscoveryUrl, winnebagoDocuments: [] }] }, now);
	return stateBallotCycleSources(catalog, now)[0]!;
}

test("Winnebago retains explicit write-in pairs and holds unpaired executive entries without inventing parties", () => {
	const parsed = readWinnebagoWriteIns(futureSource(), winnebagoWriteInFixture(), createStateCandidateRecord);
	assert.equal(parsed.records.length, 4);
	assert.equal(parsed.held.length, 3);
	assert.equal(parsed.printedPeople, 8);
	assert.equal(parsed.records[0]!.name, "SAMPLE HEAD / SAMPLE PARTNER");
	assert(parsed.records.every(record => record.status === "write-in" && !record.party));
	assert.equal(parsed.records[2]!.scope, "congressional");
	assert.equal(parsed.records[2]!.district, "17");
	assert.equal(parsed.records[3]!.scope, "local");
	assert.equal(stateRecordMatchesDistricts(parsed.records[3]!, []), false);
	assert(parsed.held.every(entry => entry.reason === "unpaired-executive-entry"));
	assert.equal(readWinnebagoWriteIns(futureSource(), winnebagoWriteInFixture().replaceAll("LEIUTENANT", "LIEUTENANT"), createStateCandidateRecord).records.length, 4);
});

test("Winnebago rejects incomplete pairs, unknown write-in roles, extra pages and wrong dates", () => {
	for (const body of [
		winnebagoWriteInFixture().replace("SAMPLE PARTNER", ""),
		winnebagoWriteInFixture().replace("LEIUTENANT GOVERNOR -", "SENATOR -"),
		winnebagoWriteInFixture().replace("STATE TREASURER -", "NEW OFFICE -"),
		winnebagoWriteInFixture().replace("NOVEMBER 7", "NOVEMBER 8"),
		winnebagoWriteInFixture().replace("number=\"1\"", "number=\"2\""),
		winnebagoWriteInFixture().replace("VALID WRITE-IN CANDIDATE", "FILED CANDIDATE"),
		winnebagoWriteInFixture().replace(winnebagoField("LEIUTENANT GOVERNOR -", 162, 451), winnebagoField("LEIUTENANT GOVERNOR -", 162, 480)),
		winnebagoWriteInFixture().replace("</page>", `${winnebagoField("NEW TEXT", 450, 900)}</page>`)
	]) assert.throws(() => readWinnebagoWriteIns(futureSource(), body, createStateCandidateRecord), /Winnebago/u);
});

test("Winnebago requires reviewed nonembedded WinAnsi fonts and rejects custom character maps and active PDF features", () => {
	assert.deepEqual(inspectWinnebagoPdfFonts(JSON.stringify(winnebagoFontFixture())), { standardFonts: 1, reviewedDashFonts: 0 });
	for (const change of [
		(body: string) => body.replace("WinAnsiEncoding", "Identity-H"),
		(body: string) => body.replace("TimesNewRomanPS-BoldMT", "UnknownFont"),
		(body: string) => body.replace("\"/Flags\":32", "\"/Flags\":4"),
		(body: string) => body.replace("\"/Encoding\":\"/WinAnsiEncoding\"", "\"/Encoding\":\"/WinAnsiEncoding\",\"/ToUnicode\":\"99 0 R\""),
		(body: string) => body.replace("\"/Flags\":32", "\"/Flags\":32,\"/FontFile2\":\"99 0 R\""),
		(body: string) => body.replace("\"/Resources\":", "\"/OpenAction\":{},\"/Resources\":")
	]) assert.throws(() => inspectWinnebagoPdfFonts(change(JSON.stringify(winnebagoFontFixture()))), /Winnebago/u);
});

test("Winnebago's XML and object worker capabilities are explicit and bounded", async () => {
	await assert.rejects(resolveStateBallotPdfXmlExtractor(""), StateBallotPdfCapabilityError);
	await assert.rejects(resolveStateBallotPdfObjectInspector(""), StateBallotPdfCapabilityError);
	await assert.rejects(extractStateBallotPdfXml(Buffer.from("not a PDF"), process.execPath), /bounds/u);
	await assert.rejects(inspectStateBallotPdfObjects(Buffer.from("not a PDF"), process.execPath), /bounds/u);
	assert.throws(() => winnebagoNativePages("unbounded input"), /Winnebago/u);
});

test("Winnebago refuses robots changes before requesting any publication or running an extractor", async () => {
	const requests: string[] = [];
	await assert.rejects(fetchWinnebagoCycleDiscovery({ request: async (url) => {
		requests.push(url);
		return { status: 403, body: Buffer.alloc(0), contentType: "text/plain", etag: undefined, location: undefined };
	}, sleep: async () => {} }), /robots policy/u);
	assert.deepEqual(requests, ["https://wincoil.gov/robots.txt"]);
	assert.throws(() => readWinnebagoDiscovery(JSON.stringify({ schemaVersion: 1, type: "winnebago-discovery" })), /Winnebago/u);
	for (const url of ["https://example.com/roster.pdf", "http://wincoil.gov/media/attachments/2028/09/25/test.pdf", "https://wincoil.gov/media/attachments/2028/09/25/../test.pdf", "https://wincoil.gov/media/attachments/2028/09/25/test.pdf?token=1"])
		assert.throws(() => validateWinnebagoDocumentUrl(url), /Winnebago/u);
});

test("Winnebago generates future source identities from accepted catalog metadata without changing the original definition", () => {
	const future = futureSource();
	assert.equal(future.id, "il-winnebago-general-2028-11-07");
	assert.equal(future.electionDate, futureDate);
	assert.equal(future.countyName, "Winnebago County");
	assert.equal(source.electionDate, "2026-11-03");
	assert.equal(source.snapshotStorage, "external");
	assert.equal(source.retrievalPolicy, undefined);
});

test("Winnebago's public reader sees durable updates without a worker, publisher access or refreshed capture clocks", async () => {
	const directory = await mkdtemp(join(tmpdir(), "winnebago-readers-"));
	try {
		const future = futureSource();
		const records = readWinnebagoCandidateDocument(future, winnebagoFixture(2028), createStateCandidateRecord).records;
		const url = "https://wincoil.gov/media/attachments/2028/09/25/test-candidates.pdf";
		const documents = [{ url, sha256: hash("Synthetic PDF"), retrievedAt: new Date(now).toISOString(), includedRecordCount: records.length }];
		const storage = createStateBallotStorage(directory);
		const snapshot = { source: future, records, documents, retrievedAt: documents[0]!.retrievedAt, sha256: hash(JSON.stringify(documents.map(({ url, sha256 }) => ({ url, sha256 })))), collectionIndexSha256: winnebagoDocumentDigest(documents.map(({ url, sha256 }) => ({ kind: "candidates", url, sha256 }))) };
		let requests = 0;
		const repository = createStateBallotRepository({ sources: [future], dataDirectory: directory, ttlMs: 100, now: () => now + 10000, fetchText: async () => {
			requests++;
			throw new Error("The public reader must not collect.");
		} });
		assert.equal(await repository.getSnapshot("IL", future.id), null);
		await storage.write(snapshot);
		assert.deepEqual(JSON.parse(JSON.stringify((await repository.getSnapshot("IL", future.id))!.records)), JSON.parse(JSON.stringify(records)));
		assert.equal((await repository.getSnapshot("IL", future.id))!.retrievedAt, snapshot.retrievedAt);
		const amended = structuredClone(snapshot);
		amended.records[0]!.sourceStatus = "Synthetic reviewed revision";
		await storage.write(amended);
		assert.equal((await repository.getSnapshot("IL", future.id))!.records[0]!.sourceStatus, "Synthetic reviewed revision");
		assert.equal(requests, 0);
	}
	finally { await rm(directory, { recursive: true, force: true }); }
});

test("Winnebago rejects images, white text, hidden native fields and unknown clipping in rendered verification", () => {
	const xml = winnebagoFixture(2028);
	for (const svg of [
		"<svg width=\"612pt\" height=\"792pt\" viewBox=\"0 0 612 792\"><image href=\"data:image/png;base64,AA==\"/></svg>",
		"<svg width=\"612pt\" height=\"792pt\" viewBox=\"0 0 612 792\"><g fill=\"rgb(100%, 100%, 100%)\"/></svg>",
		"<svg width=\"612pt\" height=\"792pt\" viewBox=\"0 0 612 792\"><g clip-path=\"url(#clip-999)\"/></svg>",
		"<svg width=\"612pt\" height=\"792pt\" viewBox=\"0 0 612 792\"/>",
		"<svg width=\"612pt\" height=\"792pt\" viewBox=\"0 0 612 792\"></svg>"
	]) assert.throws(() => inspectWinnebagoVisual(xml, svg, 1), /Winnebago/u);
});

test("Winnebago reconciles every visible native field and rejects opaque overlays or lost glyphs", () => {
	const xml = winnebagoFixture(2028);
	const svg = winnebagoSvgFixture(xml);
	const proof = inspectWinnebagoVisual(xml, svg, 1);
	assert.equal(proof.fields, winnebagoNativePages(xml)[0]!.length);
	assert.equal(proof.visibleGlyphs, winnebagoNativePages(xml)[0]!.reduce((count, field) => count + field.text.replace(/\s/gu, "").length, 0));
	const rectangle = "<path fill=\"rgb(100%, 100%, 100%)\" d=\"M 0 0 L 612 0 L 612 792 L 0 792 Z M 0 0\"/>";
	assert.throws(() => inspectWinnebagoVisual(xml, svg.replace("</svg>", `${rectangle}</svg>`), 1), /Winnebago/u);
	assert.throws(() => inspectWinnebagoVisual(xml, svg.replace(/<use[^>]+\/>/u, ""), 1), /Winnebago/u);
	assert.equal(inspectWinnebagoVisual(xml, svg.replace("<defs>", `${rectangle}<defs>`), 1).backgrounds, 1);
	assert.equal(inspectWinnebagoVisual(winnebagoWriteInFixture(), winnebagoSvgFixture(winnebagoWriteInFixture()), 1).reviewedCandidateClips, 0);
});

test("Winnebago clipping checks use actual cubic ink bounds rather than font- or host-specific glyph hashes", () => {
	assert.deepEqual(winnebagoGlyphBounds("M 0 0 C 0 10 10 10 10 0 Z"), [0, 0, 10, 7.5]);
	assert.deepEqual(winnebagoGlyphBounds("M 0 0 L 10 0 L 10 5 Z"), [0, 0, 10, 5]);
	for (const definition of ["M 0 0 H 2", "M 0 0 C 1 2", "M NaN 0", ""]) assert.throws(() => winnebagoGlyphBounds(definition), /Winnebago/u);
});
