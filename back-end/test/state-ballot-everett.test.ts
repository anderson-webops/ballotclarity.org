import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { everettProofFields, inspectEverettVisual } from "../src/state-ballot-everett-visual.js";
import { everettSource, readEverettCandidateDocument, readEverettCandidateDocuments } from "../src/state-ballot-everett.js";
import { createStateCandidateRecord } from "../src/state-ballot-records.js";
import { buildStateBallotPreview } from "../src/state-ballot-repository.js";
import { parseBundledStateSnapshot } from "../src/state-ballot-snapshot.js";
import { serializeStoredStateSnapshot } from "../src/state-ballot-storage.js";
import { everettFixture } from "./helpers/everett-fixture.js";

const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const source = everettSource("2026-11-03");
const first = everettFixture();

test("Everett reads only source-stated candidate fields and keeps future dates configurable", () => {
	for (const date of ["2026-11-03", "2028-11-07", "2030-11-05", "2032-11-02"]) {
		const fixture = everettFixture(date);
		const result = readEverettCandidateDocument(fixture.xml, date);
		assert.equal(result.records.length, 12);
		assert.equal(result.pageCount, 6);
		assert.equal(result.records.filter(record => record.incumbent).length, 1);
		assert.equal(result.records.filter(record => record.jointTicket).length, 1);
		assert(result.records.every(record => record.partyDesignation === "Independent"));
		assert.equal(inspectEverettVisual(fixture.xml, fixture.svg, fixture.catalog).substantiveFields, fixture.fields.length);
	}
});

test("Everett merges repeated identities while preserving every document and style claim", () => {
	const fixtures = [first, everettFixture("2026-11-03", "WD. 1 PCT. 3", "SECOND SUFFOLK DISTRICT"), everettFixture("2026-11-03", "WDS. 3-6", "TWENTY-EIGHTH MIDDLESEX DISTRICT")];
	const documents = fixtures.map((fixture, index) => ({ url: source.documentUrls![index]!, xml: fixture.xml, svg: fixture.svg }));
	const catalog = Object.assign({}, ...fixtures.map(fixture => fixture.catalog));
	const result = readEverettCandidateDocuments(source, documents, createStateCandidateRecord, catalog);
	assert.equal(result.records.length, 14);
	assert.equal(result.claims.length, 36);
	assert.equal(result.records.filter(record => record.scope === "state-house").length, 3);
	assert.equal(result.records.find(record => record.scope === "congressional")!.district, "7");
	assert.equal(result.records.filter(record => record.incumbent).length, 1);
	assert.equal(result.records.find(record => record.ballotDesignation === "Joint ticket")!.name, "ALPHA AND BETA");
	assert(result.records.every(record => record.status === "listed" && record.voteLimit === 1));
	assert(result.records.find(record => record.office === "Senator in Congress")!.sourceAreaLabel!.includes("WD. 1 PCT. 3"));
	const documentsWithCounts = documents.map((document, index) => ({ url: document.url, sha256: hash(document.xml), retrievedAt: "2026-10-21T00:00:00.000Z", includedRecordCount: result.claims.filter(claim => claim.documentIndex === index && result.claims.find(candidate => candidate.record.id === claim.record.id) === claim).length }));
	const snapshot = { source, records: result.records, documents: documentsWithCounts, retrievedAt: "2026-10-21T00:00:00.000Z", sha256: hash(JSON.stringify(documentsWithCounts.map(({ url, sha256 }) => ({ url, sha256 })))) };
	assert.equal(parseBundledStateSnapshot(source, serializeStoredStateSnapshot(snapshot)).records.length, 14);
	const preview = (districtCode: string) => buildStateBallotPreview(snapshot, { districtMatches: [{ id: `congress:${districtCode}`, label: `Congress ${districtCode}`, districtType: "congressional", districtCode, sourceSystem: "Controlled fixture" }, { id: "house:1", label: "House 1", districtType: "state-house", districtCode: "ELEVENTH SUFFOLK", sourceSystem: "Controlled fixture" }] });
	assert.equal(preview("7")!.candidateCount, 7);
	assert.equal(preview("1")!.candidateCount, 6);
	for (const record of [{ ...snapshot.records[0]!, incumbent: false }, { ...snapshot.records[0]!, voteLimit: 2 }]) {
		const changed = { ...snapshot, records: [record, ...snapshot.records.slice(1)] };
		assert.throws(() => parseBundledStateSnapshot(source, JSON.stringify({ ...JSON.parse(serializeStoredStateSnapshot(snapshot)), records: changed.records })));
	}
});

test("Everett rejects mismatched dates, missing offices and possible candidate overflow", () => {
	assert.throws(() => readEverettCandidateDocument(first.xml, "2028-11-07"));
	assert.throws(() => readEverettCandidateDocument(first.xml.replace("REGISTER OF PROBATE", "Unknown office"), source.electionDate));
	const extra = "<text left=\"68\" top=\"450\" width=\"60\" height=\"10\" font=\"1\">BOB TWO</text>";
	assert.throws(() => readEverettCandidateDocument(first.xml.replace("<page number=\"2\" width=\"918\" height=\"1944\">", `<page number="2" width="918" height="1944">${extra}`), source.electionDate), /Additional candidate/u);
});

test("Everett defaults to the enrolled shape catalog rather than a supplied document assertion", () => {
	assert.throws(() => inspectEverettVisual(first.xml, first.svg), /shape/u);
	assert.throws(() => readEverettCandidateDocuments(source, [{ url: source.url, xml: first.xml, svg: first.svg }], createStateCandidateRecord));
});

test("Everett rejects missing, repeated, reordered or foreign sources", () => {
	assert.throws(() => everettSource("2026-02-30"));
	assert.throws(() => everettSource("2028-11-07"));
	assert.throws(() => everettSource(source.electionDate, ["https://example.invalid/2026.pdf"]));
	for (const altered of [{ ...source, stateCode: "CA" }, { ...source, retrievalPolicy: undefined }, { ...source, placeName: undefined }, { ...source, withheldDistrictScopes: [] }]) assert.throws(() => readEverettCandidateDocuments(altered, [], createStateCandidateRecord));
	const documents = source.documentUrls!.map(url => ({ url, xml: first.xml, svg: first.svg }));
	assert.throws(() => readEverettCandidateDocuments(source, documents, createStateCandidateRecord, first.catalog), /Repeated/u);
	assert.throws(() => readEverettCandidateDocuments(source, [...documents].reverse(), createStateCandidateRecord, first.catalog));
});

test("Everett fact proof rejects altered native names, invisible glyphs and covering paint", () => {
	assert(everettProofFields(first.xml.replace("Candidate for Re-election / I", "Candidate for Re-election")).find(field => field.text === "Candidate for Re-election")!.substantive);
	assert.throws(() => inspectEverettVisual(first.xml.replace("ALICE ONE", "BOBBY ONE"), first.svg, first.catalog), /shape/u);
	assert.throws(() => inspectEverettVisual(first.xml, first.svg.replace("fill-opacity=\"1\"", "fill-opacity=\"0\""), first.catalog), /opacity/u);
	assert.throws(() => inspectEverettVisual(first.xml, first.svg.replace("</svg>", "<path fill=\"rgb(100%, 100%, 100%)\" fill-opacity=\"1\" fill-rule=\"nonzero\" d=\"M 0 0 L 612 0 L 612 1296 L 0 1296 Z\"/></svg>"), first.catalog), /occlusion/u);
	assert.throws(() => inspectEverettVisual(first.xml, first.svg.replace("</svg>", "<style>g{display:none}</style></svg>"), first.catalog), /structure/u);
});

for (const [label, mutate] of [
	["group opacity", (svg: string) => svg.replace("<g fill=", "<g opacity=\"0\" fill=")],
	["text color", (svg: string) => svg.replace("rgb(0%, 0%, 0%)", "rgb(100%, 100%, 100%)")],
	["hidden fill", (svg: string) => svg.replace("rgb(0%, 0%, 0%)", "none")],
	["glyph transformation", (svg: string) => svg.replace("<use ", "<use transform=\"scale(0)\" ")],
	["unknown glyph", (svg: string) => svg.replace("#glyph-0-0", "#glyph-999-999")],
	["duplicate identity", (svg: string) => svg.replace("</defs>", "<g id=\"glyph-0-0\"/></defs>")],
	["external image", (svg: string) => svg.replace("</svg>", "<image href=\"https://example.invalid/image.png\"/></svg>")],
	["visible unassigned text", (svg: string) => svg.replace("</svg>", "Changed</svg>")],
	["foreign element", (svg: string) => svg.replace("</svg>", "<foreignObject>Changed</foreignObject></svg>")],
	["output bounds", (svg: string) => svg.replace("</svg>", `${" ".repeat(4 * 1024 * 1024)}</svg>`)],
	["tree bounds", (svg: string) => svg.replace("</defs>", `</defs>${"<g>".repeat(50)}`).replace("</svg>", `${"</g>".repeat(50)}</svg>`)],
	["incomplete output", (svg: string) => svg.slice(0, -10)],
	["changed dimensions", (svg: string) => svg.replace("width=\"612pt\"", "width=\"792pt\"")],
	["clipped facts", (svg: string) => svg.replace("</defs>", "<clipPath id=\"clip-9000\"><path clip-rule=\"nonzero\" d=\"M 0 0 L 1 0 L 1 1 L 0 1 Z\"/></clipPath></defs><g clip-path=\"url(#clip-9000)\">").replace("</svg>", "</g></svg>")],
	["low contrast", (svg: string) => svg.replace("</defs>", "</defs><path fill=\"rgb(0%, 0%, 0%)\" fill-rule=\"nonzero\" fill-opacity=\"1\" d=\"M 0 0 L 612 0 L 612 1296 L 0 1296 Z\"/>")],
] as const) test(`Everett rejects ${label}`, () => assert.throws(() => inspectEverettVisual(first.xml, mutate(first.svg), first.catalog)));
