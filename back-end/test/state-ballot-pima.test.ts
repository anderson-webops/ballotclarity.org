import type { PimaNativeField } from "../src/state-ballot-pima-native.js";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { parseStateBallotCycleCatalog, stateBallotCycleSources } from "../src/state-ballot-cycles.js";
import { pimaDocumentDigest, pimaSource, validatePimaElection, validatePimaSource } from "../src/state-ballot-pima-collection.js";
import { pimaNativePages } from "../src/state-ballot-pima-native.js";
import { inspectPimaVisual } from "../src/state-ballot-pima-visual.js";
import { readPimaFields } from "../src/state-ballot-pima.js";
import { configuredStateBallotSources } from "../src/state-ballot-registry.js";
import { createStateBallotRepository } from "../src/state-ballot-repository.js";
import { parseBundledStateSnapshot } from "../src/state-ballot-snapshot.js";
import { createStateBallotStorage, serializeStoredStateSnapshot } from "../src/state-ballot-storage.js";

const source = pimaSource("2026-11-03");
function field(text: string, top: number, left = 354, bold = false): PimaNativeField {
	return { text, top, left, bold, width: 100, height: 18, size: 18, family: "Calibri" };
}
function fixture(date = source.electionDate) {
	const fields = [field(`General Election-November ${Number(date.slice(8))}, ${date.slice(0, 4)}`, 31, 601), field("Candidate List", 53, 744), field(`UPDATED: 9/9/${date.slice(0, 4)} 8:00 AM`, 1133, 77), field("Page 1 of 1", 1133, 766)];
	let top = 100;
	function office(english: string, spanish: string, names: string[], party = "DEM", district?: number, jurisdiction?: string, term?: string) {
		fields.push(field(english, top, 350, true));
		top += 24;
		fields.push(field(spanish, top));
		top += 24;
		if (district) {
			fields.push(field(`Dist. ${district}`, top, 420, true));
			top += 24;
		}
		if (jurisdiction) {
			fields.push(field(jurisdiction, top, 300, true));
			top += 24;
		}
		if (term) {
			fields.push(field(`Term expires ${term}`, top, 350, true));
			top += 24;
		}
		if (!english.startsWith("Justice of the Arizona")) {
			fields.push(field("Vote for not more than 2", top, 354, true));
			top += 24;
			fields.push(field("Vote por no más de 2", top));
			top += 24;
		}
		for (const name of names) {
			fields.push(field(party, top + 2, 79), field(name, top, 186));
			top += 24;
		}
	}
	office("U.S. Representative in Congress", "Representante de EE. UU. en el Congreso", ["EXAMPLE, CASEY", "EXAMPLE, DANA"], "REP", 6);
	office("Governor and Lieutenant Governor", "Gobernador y Vicegobernador", ["EXAMPLE, ALEX", "EXAMPLE, ROBIN"]);
	office("Justice of the Arizona Supreme Court", "Juez de la Corte Suprema de Arizona", ["EXAMPLE, JUDGE"], "NONPARTISAN");
	office("Governing Board", "Junta de Gobierno", ["EXAMPLE, TAYLOR"], "NONPARTISAN", undefined, "Example Unified School District No. 1", `12/31/${Number(date.slice(0, 4)) + 2}`);
	return fields.sort((first, second) => first.top - second.top || first.left - second.left);
}
function snapshot() {
	const parsed = readPimaFields(source, [fixture()], "candidates");
	const documents = [{ url: "https://content.civicplus.com/api/assets/az-pimacounty/11111111-2222-3333-4444-555555555555", sha256: "a".repeat(64), retrievedAt: "2026-10-27T01:00:00.000Z", includedRecordCount: parsed.records.length }];
	const sha256 = pimaDocumentDigest(documents);
	return { source, records: parsed.records, documents, sha256, collectionIndexSha256: sha256, sourceAsOfDate: parsed.sourceAsOfDate!, retrievedAt: documents[0]!.retrievedAt };
}
test("Pima preserves source parties, instructions and term dates without inventing tickets or judge races", () => {
	const parsed = readPimaFields(source, [fixture()], "candidates");
	assert.equal(parsed.records.length, 3);
	assert.equal(parsed.claims.length, 6);
	assert.equal(parsed.claims.filter(claim => claim.exclusion).length, 3);
	assert.deepEqual(parsed.records.filter(record => record.scope === "congressional").map(record => [record.name, record.party, record.district, record.voteLimit]), [["EXAMPLE, CASEY", "REP", "6", 2], ["EXAMPLE, DANA", "REP", "6", 2]]);
	assert.equal(parsed.records.at(-1)!.termEnd, "2028-12-31");
	assert.equal(parsed.records.at(-1)!.jurisdiction, "Example Unified School District No. 1");
	assert(parsed.records.every(record => record.status === "listed" && record.seats === undefined));
	assert.equal(parsed.sourceAsOfDate, "2026-09-09");
});
test("future independently printed dates, names and districts require no hard-coded year or roster", () => {
	const future = pimaSource("2028-11-07");
	const fields = fixture(future.electionDate).map(item => ({ ...item, text: item.text.replace("EXAMPLE, CASEY", "NEWNAME, CASEY").replace("Dist. 6", "Dist. 7") }));
	const parsed = readPimaFields(future, [fields], "candidates");
	assert.equal(parsed.records[0]!.district, "7");
	assert.equal(parsed.records[0]!.name, "NEWNAME, CASEY");
	assert.equal(parsed.records.at(-1)!.termEnd, "2030-12-31");
	assert.equal(parsed.sourceAsOfDate, "2028-09-09");
	assert.notEqual(parsed.records[0]!.id, readPimaFields(source, [fixture()], "candidates").records[0]!.id);
});
test("write-in columns retain their office and party while incomplete executive rows remain evidence only", () => {
	const labels = ["PIMA COUNTY, STATE OF ARIZONA", "GENERAL ELECTION - NOVEMBER 3, 2026 /", "ELECCION GENERAL - 3 DE NOVIEMBRE DE 2026", "WRITE-IN LIST / LISTA CANDIDATOS POR ESCRITO", "NAME / NOMBRE", "OFFICE / PUESTO", "PARTY /", "PARTIDO", "In accordance with A.R.S. 16-312 et seq. only the above names will be counted in the tally of ballots.", "De acuerdo con A.R.S. 16-312 et seq. solamente los nombres sobre escritos serán contados en la escrutación de", "boletas."];
	const fields = labels.map((label, index) => field(label, index < 8 ? 40 + index * 18 : 800 + (index - 8) * 20, 41, true));
	fields.push(field("EXAMPLE, CASEY", 207, 41), field("U.S. REPRESENTATIVE IN CONGRESS - DISTRICT 6 / REPRESENTANTE DE EE.UU. EN EL CONGRESO -", 198, 239), field("DISTRITO 6", 216, 481), field("IND", 207, 818), field("EXAMPLE, ROBIN", 250, 41), field("GOVERNOR / GOBERNADOR", 250, 435), field("REP", 250, 816), field("EXAMPLE, TAYLOR", 300, 41), field("BOARD MEMBER - EXAMPLE FIRE DISTRICT / MIEMBRO DE LA JUNTA - DISTRITO DE BOMBEROS", 292, 264), field("NON", 300, 815));
	fields.sort((first, second) => first.top - second.top || first.left - second.left);
	const parsed = readPimaFields(source, [fields], "write-ins");
	assert.equal(parsed.records.length, 2);
	assert.equal(parsed.claims.length, 3);
	assert.equal(parsed.records[0]!.status, "write-in");
	assert.equal(parsed.records[0]!.district, "6");
	assert.equal(parsed.records[1]!.party, "NONPARTISAN");
	assert.equal(parsed.records[1]!.jurisdiction, "EXAMPLE FIRE DISTRICT");
	for (const text of ["UNREVIEWED", "GOVERNOR AND A NAMED RUNNING MATE", "CONSTABLE, JUSTICE PRECINCT unknown"]) {
		const changed = fields.map(item => ({ ...item, text: item.text === "GOVERNOR / GOBERNADOR" ? text : item.text }));
		assert.throws(() => readPimaFields(source, [changed], "write-ins"), /review/u);
	}
});
test("unrecognized labels, missing columns, conflicting dates and incomplete instructions hold", () => {
	for (const mutate of [(fields: PimaNativeField[]) => {
		fields.find(item => item.text === "Dist. 6")!.text = "Dist. unknown";
	}, (fields: PimaNativeField[]) => {
		fields.find(item => item.text === "REP")!.text = "UNREVIEWED";
	}, (fields: PimaNativeField[]) => {
		fields.find(item => item.text === "Page 1 of 1")!.text = "Page 1 of 2";
	}, (fields: PimaNativeField[]) => {
		fields.find(item => item.text === "Vote por no más de 2")!.text = "Vote por no más de 1";
	}, (fields: PimaNativeField[]) => {
		fields.find(item => item.text === "Candidate List")!.text = "Filing List";
	}, (fields: PimaNativeField[]) => {
		fields.find(item => item.text === "U.S. Representative in Congress")!.bold = false;
	}, (fields: PimaNativeField[]) => {
		fields.find(item => item.text.startsWith("UPDATED:"))!.text = "UPDATED: 2/30/2026 8:00 AM";
	}, (fields: PimaNativeField[]) => {
		fields.push(field("Unexpected endorsement", 1000));
	}, (fields: PimaNativeField[]) => {
		fields.find(item => item.text === "EXAMPLE, CASEY")!.left = 200;
	}]) {
		const fields = fixture();
		mutate(fields);
		fields.sort((first, second) => first.top - second.top || first.left - second.left);
		assert.throws(() => readPimaFields(source, [fields], "candidates"), /review/u);
	}
});
test("native XML bounds, font family, styling and visible geometry fail closed", () => {
	const xml = `<?xml version="1.0"?><!DOCTYPE pdf2xml SYSTEM "pdf2xml.dtd"><pdf2xml><page number="1" width="918" height="1188"><fontspec id="0" size="18" family="ABCDEF+Calibri" color="#000000"/>${Array.from({ length: 10 }, (_, index) => `<text top="${100 + index * 24}" left="186" width="100" height="18" font="0"><b>EXAMPLE</b></text>`).join("")}</page></pdf2xml>`;
	assert.equal(pimaNativePages(xml, "candidates")[0]!.length, 10);
	assert(pimaNativePages(xml, "candidates")[0]!.every(item => item.bold));
	for (const body of [xml.replace("width=\"918\"", "width=\"920\""), xml.replaceAll("Calibri", "Unknown"), xml.replace("<b>EXAMPLE</b>", "<b>EX</b>AMPLE"), xml.replace("left=\"186\"", "left=\"950\""), xml.replace("<pdf2xml>", "<pdf2xml><image/>"), xml.replace("font=\"0\"", "font=\"8\"")])
		assert.throws(() => pimaNativePages(body, "candidates"), /review/u);
	assert.throws(() => inspectPimaVisual(xml, "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"612pt\" height=\"792pt\" viewBox=\"0 0 612 792\"><script/></svg>", 1, "candidates"), /review/u);
});
test("source and cycle contracts are additive, bind exact assets, and preserve the broader Arizona default", () => {
	const configured = configuredStateBallotSources.find(item => item.id === source.id)!;
	assert.deepEqual(configured, source);
	assert.equal(configuredStateBallotSources.length, 73);
	assert.equal(configuredStateBallotSources.find(item => item.stateCode === "AZ" && item.id !== source.id)!.retrievalPolicy, "manual-snapshot");
	validatePimaSource(source);
	for (const change of [{ countyName: "Other County" }, { retrievalPolicy: "manual-snapshot" }, { url: "https://other.example/" }, { electionDate: "2026-11-04" }])
		assert.throws(() => validatePimaSource({ ...source, ...change } as typeof source), /review/u);
	const documents = snapshot().documents.map(({ url, sha256 }) => ({ kind: "candidates", url, sha256 }));
	validatePimaElection({ electionId: null, electionDate: source.electionDate, pageUrl: source.pageUrl, pimaDocuments: documents });
	assert.throws(() => validatePimaElection({ electionId: null, electionDate: source.electionDate, pageUrl: source.pageUrl, pimaDocuments: [...documents, ...documents] }), /review/u);
	const future = pimaSource("2032-11-02");
	const catalog = parseStateBallotCycleCatalog({ schemaVersion: 1, type: "state-ballot-cycle-catalog", familyId: source.id, sourceConfigurationSha256: createHash("sha256").update(JSON.stringify(source)).digest("hex"), discovery: { url: source.pageUrl, sha256: "a".repeat(64), retrievedAt: "2026-10-27T00:00:00.000Z" }, elections: [{ electionId: null, electionDate: future.electionDate, pageUrl: future.pageUrl, pimaDocuments: [] }] }, Date.parse("2026-10-27T02:00:00.000Z"));
	assert.equal(stateBallotCycleSources(catalog, Date.parse("2026-10-27T02:00:00.000Z"))[0]!.id, future.id);
});
test("stored dates, document digests, vote limits and term dates survive a fresh repository", async () => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-pima-"));
	try {
		const stored = snapshot();
		const bytes = serializeStoredStateSnapshot(stored);
		const parsed = parseBundledStateSnapshot(source, bytes, "automatic");
		assert.deepEqual(parsed.records, stored.records);
		assert.equal(parsed.sourceAsOfDate, "2026-09-09");
		const storage = createStateBallotStorage(directory);
		await storage.write(stored);
		const repository = createStateBallotRepository({ sources: [source], dataDirectory: directory, now: () => Date.parse("2026-10-27T02:00:00.000Z"), fetchText: async () => {
			throw new Error("offline");
		} });
		assert.equal((await repository.getSnapshot("AZ", source.id))!.records.length, 3);
		for (const change of [{ sourceAsOfDate: "2026-11-04" }, { collectionIndexSha256: "b".repeat(64) }, { ballotQuestions: [] }])
			assert.throws(() => parseBundledStateSnapshot(source, JSON.stringify({ ...JSON.parse(bytes), ...change }), "automatic"), /review|invalid/u);
		const corrupt = JSON.parse(bytes);
		corrupt.records[0].voteLimit = 11;
		assert.throws(() => parseBundledStateSnapshot(source, JSON.stringify(corrupt), "automatic"), /invalid/u);
		assert((await readFile(join(directory, `${source.id}.json`), "utf8")).length > 100);
	}
	finally {
		await rm(directory, { recursive: true, force: true });
	}
});
