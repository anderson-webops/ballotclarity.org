import type { ChicagoGlyphApproval } from "../src/state-ballot-chicago-fonts.js";
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import process from "node:process";
import test from "node:test";
import { chicagoFontProgram, validateChicagoFontProgram } from "../src/state-ballot-chicago-fonts.js";
import { inspectNycPdfFonts, nycSymbolFontMappings, nycUnicodeMappings, readNycPdfFontPrograms } from "../src/state-ballot-nyc-fonts.js";
import { inspectNycVisual } from "../src/state-ballot-nyc-visual.js";
import { verifyNycCandidatePdf } from "../src/state-ballot-nyc-worker.js";
import { extractStateBallotPdfSvg, nycNativePdfCollectorContract, stateBallotNativePdfCollectorContract } from "../src/state-ballot-pdf.js";
import { nycDraftSource } from "./helpers/nyc-fixture.js";
import { nycFontFixture, nycUnicodeFixture, nycVisualFixture } from "./helpers/nyc-native-fixture.js";

test("NYC maps explicit single-byte source characters through the actual symbolic TrueType cmap", () => {
	const source = nycUnicodeMappings(nycUnicodeFixture(), "AAAAAA+Arial");
	assert.deepEqual([...source.keys()], [32, 65, 66, 192]);
	assert.deepEqual([...nycSymbolFontMappings(nycFontFixture(), source)], [[1, "0020"], [2, "0041"], [3, "0042"], [4, "00c0"]]);
	assert.throws(() => nycUnicodeMappings(nycUnicodeFixture().replace("<0041>", "<0042>"), "AAAAAA+Arial"), /review/u);
	assert.throws(() => nycUnicodeMappings(nycUnicodeFixture().replace("4 beginbfrange", "3 beginbfrange"), "AAAAAA+Arial"), /review/u);
	assert.throws(() => nycUnicodeMappings(nycUnicodeFixture().replace("<20> <20> <0020>", "<20> <20> <0000>"), "AAAAAA+Arial"), /review/u);
	assert.throws(() => nycSymbolFontMappings(Buffer.alloc(64), source), /review/u);
});

test("NYC glyph approval tolerates subset inventory changes but not remapped outlines or components", () => {
	const mappings = new Map([[1, "0020"], [2, "0041"], [3, "0042"], [4, "00c0"]]);
	const original = chicagoFontProgram(nycFontFixture(), mappings, "nyc");
	const catalog: Record<string, ChicagoGlyphApproval> = { [original.signature]: { glyphs: {}, components: original.components } };
	for (const glyph of original.characters) catalog[original.signature]!.glyphs[glyph.unicode] = [glyph.sha256];
	validateChicagoFontProgram(chicagoFontProgram(nycFontFixture(true), mappings, "nyc"), catalog);
	assert.throws(() => validateChicagoFontProgram(chicagoFontProgram(nycFontFixture(false, true), mappings, "nyc"), catalog), /review/u);
	assert.throws(() => validateChicagoFontProgram(original), /review/u);
	assert.throws(() => chicagoFontProgram(nycFontFixture(), mappings), /review/u);
	const changed = structuredClone(original);
	Object.values(changed.components).find(components => components.length)![0]!.sha256 = "f".repeat(64);
	assert.throws(() => validateChicagoFontProgram(changed, catalog), /review/u);
});

test("NYC font inspection rejects unsupported object envelopes and absent reviewed programs", () => {
	for (const body of ["{}", "{\"qpdf\":[]}", " ".repeat(4 * 1024 * 1024 + 1)]) assert.throws(() => readNycPdfFontPrograms(body), /review/u);
	assert.throws(() => inspectNycPdfFonts("{}"), /review/u);
});

test("NYC visual verification binds every visible character to approved outlines", () => {
	const { xml, svg, approvals } = nycVisualFixture();
	const proof = inspectNycVisual(xml, svg, 1, approvals);
	assert.equal(proof.fields, 3);
	assert.equal(proof.headerSeals, 0);
	assert.equal(proof.clippedProposalSuffixGlyphs, 0);
	assert.throws(() => inspectNycVisual(xml, svg, 1), /shape/u);
	assert.throws(() => inspectNycVisual(xml, svg.replace(/<use[^>]+\/>/u, ""), 1, approvals), /inventory/u);
	assert.throws(() => inspectNycVisual(xml, svg.replace("#glyph-0-0", "#glyph-0-1"), 1, approvals), /shape/u);
	assert.throws(() => inspectNycVisual(xml, svg.replace("rgb(0%, 0%, 0%)", "rgb(100%, 100%, 100%)"), 1, approvals), /reference/u);
});

test("NYC visual verification rejects hidden ink, unknown images and inherited transformations", () => {
	const { xml, svg, approvals } = nycVisualFixture();
	const clip = "<clipPath id=\"clip-1\"><path d=\"M 0 0 L 1 0 L 1 1 L 0 1 Z\"/></clipPath>";
	assert.throws(() => inspectNycVisual(xml, svg.replace("</defs>", `${clip}</defs>`).replace("<g fill=\"", "<g clip-path=\"url(#clip-1)\" fill=\""), 1, approvals), /ink/u);
	assert.throws(() => inspectNycVisual(xml, svg.replace("</svg>", "<image id=\"unknown\" x=\"0\" y=\"0\" width=\"290\" height=\"306\" href=\"data:image/png;base64,AA==\"/></svg>"), 1, approvals), /seal/u);
	assert.throws(() => inspectNycVisual(xml, svg.replace("<g fill=\"", "<g transform=\"translate(1)\" fill=\""), 1, approvals), /transformation/u);
	assert.throws(() => inspectNycVisual(xml, svg.replace("</svg>", "<script>unexpected()</script></svg>"), 1, approvals), /element/u);
	assert.throws(() => inspectNycVisual(xml, svg.replace("</svg>", "<path fill=\"rgb(0%, 0%, 0%)\" d=\"M 0 0 L 792 0 L 792 612 L 0 612 Z\"/></svg>"), 1, approvals), /opaque/u);
});

test("NYC permits only omitted unused proposal metadata, never an omitted meaningful character", () => {
	const { xml, svg, approvals, firstFieldUses } = nycVisualFixture("Proposal Number 1, a Question: Example city proposal - Citywide, # to be elected: 1");
	let cropped = svg;
	for (const use of firstFieldUses.slice(-4)) cropped = cropped.replace(use, "");
	assert.equal(inspectNycVisual(xml, cropped, 1, approvals).omittedProposalSuffixGlyphs, 4);
	assert.throws(() => inspectNycVisual(xml, svg.replace(firstFieldUses[10]!, ""), 1, approvals), /shape/u);
	assert.throws(() => inspectNycVisual(xml, svg.replace(firstFieldUses.slice(0, 60).join(""), ""), 1, approvals), /inventory/u);
});

test("NYC workers reject an unrelated source or conflicting election before starting converters", async () => {
	await assert.rejects(verifyNycCandidatePdf({ ...nycDraftSource, stateCode: "NJ" }, Buffer.from("%PDF-"), () => null), /identity/u);
	await assert.rejects(verifyNycCandidatePdf({ ...nycDraftSource, electionDate: "2026-11-04" }, Buffer.from("%PDF-"), () => null), /date/u);
});

test("NYC native worker capacity is explicit and leaves other collection bounds intact", async () => {
	assert.equal(stateBallotNativePdfCollectorContract.maximumPages, 20);
	assert.equal(nycNativePdfCollectorContract.maximumPages, 60);
	assert.equal(nycNativePdfCollectorContract.maximumObjectBytes, 4 * 1024 * 1024);
	await assert.rejects(extractStateBallotPdfSvg(Buffer.from("%PDF-"), process.execPath, 51), /bounds/u);
	await assert.rejects(extractStateBallotPdfSvg(Buffer.from("%PDF-"), process.execPath, 61, 12000, "nyc"), /bounds/u);
});
