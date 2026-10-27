import type { ChicagoGlyphApproval } from "../src/state-ballot-chicago-fonts.js";
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import test from "node:test";
import { chicagoFontProgram, chicagoUnicodeMappings, inspectChicagoPdfFonts, validateChicagoFontProgram } from "../src/state-ballot-chicago-fonts.js";
import { chicagoNativePages } from "../src/state-ballot-chicago-native.js";
import { inspectChicagoVisual } from "../src/state-ballot-chicago-visual.js";
import { readChicagoBallotDocument } from "../src/state-ballot-chicago.js";
import { createStateCandidateRecord } from "../src/state-ballot-records.js";
import { chicagoDraftSource, chicagoFixture, chicagoFontFixture, chicagoSvgFixture } from "./helpers/chicago-fixture.js";

const parse = (body = chicagoFixture(), source = chicagoDraftSource) => readChicagoBallotDocument(source, body, createStateCandidateRecord);

test("Chicago preserves printed ticket, party, school and independent retention identities", () => {
	const result = parse();
	assert.equal(result.records.length, 5);
	assert.equal(result.records.filter(record => record.scope === "statewide").length, 3);
	assert.equal(result.records.find(record => record.name === "Another Senator")!.party, "Independent");
	assert.equal(result.records.find(record => record.name.includes("Governor"))!.name, "Example Governor & Example Lieutenant");
	const judge = result.records.find(record => record.name === "Example Judge")!;
	assert.equal(judge.office, "Judge, Circuit Court (Retention): Example Judge");
	assert.equal(judge.party, undefined);
	assert.equal(judge.ballotDesignation, "Judicial retention; Yes 201; No 202");
	assert.equal(result.asOfDate, "2026-09-11");
	assert.deepEqual(result.candidatePages, [4]);
	assert.deepEqual(result.retentionPages, [1]);
});

test("Chicago retains new printed party labels and mononyms without a party roster or name inference", () => {
	const result = parse(chicagoFixture().replace("Example Senator", "Li").replace("Democratic", "New Civic Party"));
	assert.equal(result.records[0]!.name, "Li");
	assert.equal(result.records[0]!.party, "New Civic Party");
});

test("Chicago retains multi-seat limits and term lengths without inferring voter eligibility", () => {
	const result = parse(chicagoFixture(2026, false, true));
	const local = result.records.find(record => record.name === "Example Local")!;
	assert.equal(local.voteLimit, 3);
	assert.equal(local.termYears, 6);
	assert.equal(local.scope, "local");
	assert.equal(local.district, "");
});

test("Chicago keeps repeated question text separate for each printed audience", () => {
	const result = parse(chicagoFixture(2026, true));
	assert.equal(result.questions.length, 2);
	assert.notEqual(result.questions[0]!.id, result.questions[1]!.id);
	assert.equal(result.questions[0]!.officialText, result.questions[1]!.officialText);
	assert.deepEqual(result.questions.map(question => question.pages), [[1], [2]]);
	assert(result.questions.every(question => question.explicitlyAdvisory && !question.voterApplicabilityVerified));
	assert.throws(() => parse(chicagoFixture(2026, true).replace("the 2nd Ward", "the 1st Ward")), /inventory/u);
});

test("Chicago reuses matching future dates without guessing publication or certification", () => {
	const source = { ...chicagoDraftSource, id: "il-chicago-general-2028-11-07", electionDate: "2028-11-07" };
	assert.equal(parse(chicagoFixture(2028), source).records.length, 5);
	assert.throws(() => parse(chicagoFixture(), source), /review/u);
	assert.throws(() => parse(chicagoFixture().replace("9/11/2026", "11/4/2026")), /date/u);
});

test("Chicago holds changed status, incomplete choices, duplicate ballot positions and unknown offices", () => {
	for (const body of [chicagoFixture().replace(">Candidate</text>", ">Pending</text>"), chicagoFixture().replace("(202)", "(203)"), chicagoFixture().replace("(2)", "(1)"), chicagoFixture().replace("United States Senator", "Unknown office"), chicagoFixture().replace("Page 1 of 1", "Page 1 of 2"), chicagoFixture().replace("Candidate Filings in Ballot Order, November 3, 2026", "Other election")]) assert.throws(() => parse(body), /review/u);
});

test("Chicago native boundaries reject images, nonfooter Arial text and invalid geometry", () => {
	assert.throws(() => chicagoNativePages(chicagoFixture().replace("</page>", "<image src=\"hidden.png\"/></page>")), /non-text/u);
	assert.throws(() => chicagoNativePages(chicagoFixture().replace("font=\"6\">Example Senator", "font=\"7\">Example Senator")), /geometry/u);
	assert.throws(() => chicagoNativePages(chicagoFixture().replace("left=\"92\"", "left=\"-1\"")), /geometry/u);
});

test("Chicago visual verification conserves every visible field and rejects hidden or altered glyphs", () => {
	const xml = chicagoFixture();
	const svg = chicagoSvgFixture(xml);
	const proof = inspectChicagoVisual(xml, svg, 1);
	assert.equal(proof.fields, chicagoNativePages(xml)[0]!.length);
	const spacing = svg.replace("</defs>", "<g id=\"glyph-0-1\"><path d=\"M 0 0 Z M 0 0\"/></g></defs>").replace("</svg>", "<use xlink:href=\"#glyph-0-1\" x=\"1\" y=\"1\"/></svg>");
	assert.equal(inspectChicagoVisual(xml, spacing, 1).visibleGlyphs, proof.visibleGlyphs);
	assert.throws(() => inspectChicagoVisual(xml, svg.replace(/<use[^>]+\/>/u, ""), 1), /review/u);
	assert.throws(() => inspectChicagoVisual(xml, svg.replace("fill=\"rgb(0%, 0%, 0%)\"", "fill=\"rgb(100%, 100%, 100%)\""), 1), /review/u);
	assert.throws(() => inspectChicagoVisual(xml, svg.replace("</svg>", "<image href=\"hidden.png\"/></svg>"), 1), /review/u);
	assert.throws(() => inspectChicagoVisual(xml, svg.replace("</svg>", "<path fill=\"rgb(75.5%, 75.5%, 75.5%)\" d=\"M 100 193 L 150 193 L 150 196 L 100 196 Z\"/></svg>"), 1), /review/u);
});

test("Chicago font approval survives subset changes and binds letters to actual glyph programs", () => {
	const mappings = new Map([[1, "0020"], [2, "0041"], [3, "0042"], [4, "00c0"]]);
	const original = chicagoFontProgram(chicagoFontFixture(), mappings);
	const approved: Record<string, ChicagoGlyphApproval> = { [original.signature]: { glyphs: {}, components: original.components } };
	for (const character of original.characters) approved[original.signature]!.glyphs[character.unicode] = [character.sha256];
	validateChicagoFontProgram(original, approved);
	const subset = chicagoFontProgram(chicagoFontFixture(true), new Map([[1, "0020"], [2, "0041"]]));
	validateChicagoFontProgram(subset, approved);
	const reordered = chicagoFontProgram(chicagoFontFixture(false, true), new Map([[2, "0042"], [3, "0041"]]));
	validateChicagoFontProgram(reordered, approved);
	assert.throws(() => validateChicagoFontProgram(chicagoFontProgram(chicagoFontFixture(false, true), mappings), approved), /review/u);
	const composite = structuredClone(original);
	const parent = Object.entries(composite.components).find(([, components]) => components.length)!;
	parent[1][0]!.sha256 = "f".repeat(64);
	assert.throws(() => validateChicagoFontProgram(composite, approved), /review/u);
	assert.throws(() => validateChicagoFontProgram(original), /review/u);
	assert.throws(() => chicagoFontProgram(Buffer.alloc(64), mappings), /review/u);
});

test("Chicago Unicode maps reject conflicting, multi-codepoint and control-character claims", () => {
	const prefix = "/CIDInit /ProcSet findresource begin 12 dict begin begincmap /CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def /CMapName /Adobe-Identity-UCS def /CMapType 2 def 1 begincodespacerange <0000> <FFFF> endcodespacerange ";
	const suffix = " endcmap CMapName currentdict /CMap defineresource pop end end";
	assert.equal(chicagoUnicodeMappings(`${prefix}1 beginbfchar <0002> <0041> endbfchar${suffix}`).get(2), "0041");
	for (const middle of ["2 beginbfchar <0002> <0041> <0002> <0042> endbfchar", "1 beginbfchar <0002> <0000> endbfchar", "1 beginbfchar <0002> <00410042> endbfchar", "1 beginbfrange <0001> <0002> <0041> endbfrange"]) assert.throws(() => chicagoUnicodeMappings(prefix + middle + suffix), /review/u);
	assert.throws(() => inspectChicagoPdfFonts("{\"qpdf\":[]}"), /review/u);
});
