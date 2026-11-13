import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import test from "node:test";
import { readFultonMunicipalEvidence } from "../src/fulton-municipal-evidence.js";
import { discoverStateBallotElectionCycles, getStateBallotCycleFamily, parseStateBallotCycleCatalog, stateBallotCycleSources } from "../src/state-ballot-cycles.js";
import { fetchFultonMunicipalCycleDiscovery, fultonMunicipalDocumentDigest, fultonMunicipalDocumentUrl, fultonMunicipalSource, readFultonMunicipalDiscovery, readFultonMunicipalIndex, validateFultonMunicipalElection, validateFultonMunicipalSource } from "../src/state-ballot-fulton-municipal.js";
import { prioritizeStateBallotWork } from "../src/state-ballot-priority.js";
import { createStateCandidateRecord } from "../src/state-ballot-records.js";
import { configuredStateBallotSources } from "../src/state-ballot-registry.js";
import { parseBundledStateSnapshot } from "../src/state-ballot-snapshot.js";
import { serializeStoredStateSnapshot } from "../src/state-ballot-storage.js";
import { municipalRenderedFixture } from "./helpers/fulton-municipal.js";

const index = (link = "") => `<main><h1>Voting and Elections Sample Ballots</h1>${link}</main><footer><a href="/Privacy-Statement">Privacy Statement</a></footer>`;

test("municipal rendered corroboration accounts for every printed identity, office, date and incumbency", () => {
	for (const date of ["December 02, 2025", "November 30, 2032"]) {
		const evidence = municipalRenderedFixture(date);
		const result = readFultonMunicipalEvidence(evidence);
		assert.equal(result.contests.length, 2);
		assert.equal(result.contests[0]!.district, "District 8 At Large");
		assert.equal(result.contests[0]!.candidates[1]!.incumbent, true);
		assert.equal(result.voterApplicabilityVerified, false);
		assert.equal(result.publicationApproved, false);
		assert.equal(result.retrievedAt, evidence.source.retrievedAt);
	}
});

for (const change of ["native name", "rendered name", "low confidence", "missing crop", "extra crop", "crop bounds", "full page text", "crop page", "inspected page", "rotation", "font", "tool", "extra field", "raster size", "missing OCR page"] as const) {
	test(`municipal automatic evidence refuses changed ${change}`, () => {
		const evidence = municipalRenderedFixture();
		if (change === "native name") evidence.xml = evidence.xml.replace("First Candidate", "Third Candidate");
		if (change === "rendered name") evidence.ocr = evidence.ocr.replace("First Candidate", "Third Candidate");
		if (change === "low confidence") evidence.ocr = evidence.ocr.replace("\t95\t", "\t69.99\t");
		if (change === "missing crop") evidence.fields.pop();
		if (change === "extra crop") evidence.fields.push(evidence.fields[0]!);
		if (change === "crop bounds") evidence.fields[0]!.top++;
		if (change === "full page text") evidence.page.ocr += "5\t1\t1\t1\t1\t1\t2400\t3900\t100\t20\t95\tUnexpected candidate\n";
		if (change === "crop page") evidence.ocr = evidence.ocr.replace("1\t1\t1\t1\t1\t1\t0", "1\t999\t1\t1\t1\t1\t0");
		if (change === "inspected page") evidence.objects = evidence.objects.replace("612", "613");
		if (change === "rotation") evidence.objects = evidence.objects.replace("\"/Type\":\"/Page\"", "\"/Type\":\"/Page\",\"/Rotate\":90");
		if (change === "font") evidence.xml = evidence.xml.replace("#231f20", "#ffffff");
		if (change === "tool") evidence.tools.readerVersion = "tesseract 4.0.0";
		if (change === "extra field") Object.assign(evidence, { approved: true });
		if (change === "raster size") Object.assign(evidence.page, { width: 2549 });
		if (change === "missing OCR page") evidence.ocr = evidence.ocr.replace(/^1\t1\t.*\n/mu, "");
		assert.throws(() => readFultonMunicipalEvidence(evidence));
	});
}

test("only a small voting mark beside a verified candidate row can remain outside printed fields", () => {
	const evidence = municipalRenderedFixture();
	const candidate = evidence.fields.at(-1)!;
	const mark = `5\t1\t1\t1\t1\t1\t${candidate.left - 60}\t${candidate.top + 2}\t45\t34\t50\t©\n`;
	evidence.page.ocr += mark;
	assert.equal(readFultonMunicipalEvidence(evidence).contests.length, 2);
	evidence.page.ocr = evidence.page.ocr.replace(mark, mark.replace("\t©", "\tHidden"));
	assert.throws(() => readFultonMunicipalEvidence(evidence));
});

test("municipal discovery follows only actually offered runoff ballots and keeps an empty current index empty", () => {
	assert.deepEqual(readFultonMunicipalIndex(index(`<a href="/-/media/elections/general.pdf">General election sample ballot</a>`)), []);
	assert.deepEqual(readFultonMunicipalIndex(index(`<a href="/-/media/elections/2032-runoff.pdf">Municipal runoff sample ballot</a>`)), ["https://fultoncountyga.gov/-/media/elections/2032-runoff.pdf"]);
	for (const body of [index().replace("Sample Ballots", "Candidate filings"), index().replace("</footer>", `<a href="/terms">Terms of Use</a></footer>`), index(`<a href="https://example.org/runoff.pdf">Runoff ballot</a>`), index(`<a href="/-/media/elections/runoff.pdf?download=1">Runoff ballot</a>`)]) assert.throws(() => readFultonMunicipalIndex(body));
	for (const url of ["http://fultoncountyga.gov/-/media/runoff.pdf", "https://www.fultoncountyga.gov.evil.example/-/media/runoff.pdf", "https://fultoncountyga.gov/-/media/runoff.pdf#page=1"]) assert.throws(() => fultonMunicipalDocumentUrl(url));
});

test("municipal source and cycle registration preserve historical access and independent general-election configuration", () => {
	const source = fultonMunicipalSource();
	assert.deepEqual(configuredStateBallotSources.find(item => item.id === source.id), source);
	assert.equal(configuredStateBallotSources.find(item => item.id === "ga-fulton-2026")!.format, "fulton-pdf");
	const family = getStateBallotCycleFamily(source.id);
	assert.equal(family.format, "fulton-municipal-pdf");
	assert.equal(source.ballotPreview, false);
	assert.deepEqual(prioritizeStateBallotWork(["mt-general-2026", "ga-fulton-municipal-runoff-2032-11-30", "ga-fulton-general-2032-11-02"], value => value), ["ga-fulton-general-2032-11-02", "ga-fulton-municipal-runoff-2032-11-30", "mt-general-2026"]);
	validateFultonMunicipalSource(fultonMunicipalSource("2032-11-30"));
	assert.throws(() => validateFultonMunicipalSource({ ...source, ballotPreview: undefined }));
	assert.throws(() => fultonMunicipalSource("2032-12-01"));
	const election = { electionId: null, electionDate: "2032-11-30", pageUrl: source.pageUrl, municipalDocument: { url: "https://www.fultoncountyga.gov/-/media/elections/runoff.pdf", sha256: "a".repeat(64) } };
	validateFultonMunicipalElection(election);
	const catalog = parseStateBallotCycleCatalog({ schemaVersion: 1, type: "state-ballot-cycle-catalog", familyId: source.id, sourceConfigurationSha256: createHash("sha256").update(JSON.stringify(source)).digest("hex"), discovery: { url: source.pageUrl, sha256: "b".repeat(64), retrievedAt: "2026-11-13T21:00:00.000Z" }, elections: [election] }, Date.parse("2026-11-13T21:00:00Z"));
	assert.deepEqual(stateBallotCycleSources(catalog), [fultonMunicipalSource("2032-11-30")]);
	assert.deepEqual(parseStateBallotCycleCatalog({ ...catalog, elections: [] }).elections, []);
	assert.throws(() => discoverStateBallotElectionCycles(JSON.stringify({ type: "unreviewed", index: index() }), source.id));
});

test("publisher policy failure stops municipal discovery before index, PDF or native tool work", async () => {
	let requests = 0;
	await assert.rejects(fetchFultonMunicipalCycleDiscovery({ requestDocument: async () => {
		requests++;
		return { status: 200, body: Buffer.from("User-agent: *\nDisallow: /"), contentType: "text/plain", etag: undefined };
	}, prepare: async () => { throw new Error("Native tools must stay idle"); } }));
	assert.equal(requests, 1);
	assert.throws(() => readFultonMunicipalDiscovery("{}"));
});

test("municipal stored facts preserve normalized districts, at-large wording and explicit incumbency", () => {
	const source = fultonMunicipalSource();
	const record = createStateCandidateRecord(source, { name: "First Candidate", office: "Board of Education Member - District 8 At Large", district: "District 8 At Large", jurisdiction: "City of Atlanta", scope: "local", status: "listed", party: "" })!;
	record.voteLimit = 1;
	record.sourceStatus = "Sample ballot candidate";
	record.incumbent = true;
	const document = { url: "https://www.fultoncountyga.gov/-/media/elections/runoff.pdf", sha256: "a".repeat(64), includedRecordCount: 1, retrievedAt: "2026-11-13T20:38:39.838Z" };
	const digest = fultonMunicipalDocumentDigest(document);
	const serialized = serializeStoredStateSnapshot({ source, records: [record], documents: [document], sha256: digest, collectionIndexSha256: digest, retrievedAt: document.retrievedAt });
	const restored = parseBundledStateSnapshot(source, serialized, "automatic");
	assert.equal(restored.records[0]!.district, "DISTRICT 8 AT LARGE");
	assert.equal(restored.records[0]!.office, "Board of Education Member - District 8 At Large");
	assert.equal(restored.records[0]!.incumbent, true);
	for (const change of [{ party: "Invented party" }, { scope: "statewide" }, { district: "District 8" }, { termYears: 4 }, { jurisdiction: "Fulton County" }, { voteLimit: 2 }]) {
		const changed = JSON.parse(serialized);
		Object.assign(changed.records[0], change);
		assert.throws(() => parseBundledStateSnapshot(source, JSON.stringify(changed), "automatic"));
	}
});
