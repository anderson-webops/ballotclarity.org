import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import process from "node:process";
import { test } from "node:test";
import { inspectOrangePdfFonts, orangeUnicodeMappings, readOrangePdfFontPrograms } from "../src/state-ballot-orange-fonts.js";
import { readOrangeCandidateProof } from "../src/state-ballot-orange-proof.js";
import { orangePathCommands, orangeRuleShapes, orangeStrokeMatches } from "../src/state-ballot-orange-shapes.js";
import { inspectOrangeProofVisual } from "../src/state-ballot-orange-visual.js";
import { verifyOrangeCandidateProof } from "../src/state-ballot-orange-worker.js";
import { chicagoNativePdfCollectorContract, extractStateBallotPdfSvg, extractStateBallotPdfXml, inspectStateBallotPdfObjects, nycNativePdfCollectorContract, orangeNativePdfCollectorContract, stateBallotNativePdfCollectorContract, StateBallotPdfCapabilityError, stateBallotPdfCollectorContract } from "../src/state-ballot-pdf.js";
import { nycUnicodeFixture } from "./helpers/nyc-native-fixture.js";
import { orangeFontFixture, orangeVisualFixture } from "./helpers/orange-native-fixture.js";
import { orangeProofFixture } from "./helpers/orange-proof-fixture.js";

test("Orange preserves malformed declared code-space evidence only with independently matching Windows characters", () => {
	const source = orangeUnicodeMappings(nycUnicodeFixture(), "AAAAAA+Arial");
	assert.deepEqual(source.declaredCodeSpace, [66, 192]);
	assert.equal(source.mappingsOutsideDeclaredCodeSpace, 2);
	assert.deepEqual([...source.mappings], [[32, "0020"], [65, "0041"], [66, "0042"], [192, "00c0"]]);
	for (const body of [nycUnicodeFixture().replace("<0041>", "<0042>"), nycUnicodeFixture().replace("4 beginbfrange", "3 beginbfrange"), nycUnicodeFixture().replace("<42> <c0>", "<43> <c0>"), nycUnicodeFixture().replace("<41> <41>", "<41> <42>"), `${nycUnicodeFixture()} unknown`, " ".repeat(128 * 1024 + 1)]) assert.throws(() => orangeUnicodeMappings(body, "AAAAAA+Arial"), /review/u);
	assert.throws(() => orangeUnicodeMappings(nycUnicodeFixture(), "AAAAAA+Unknown"), /review/u);
});

test("Orange font objects require five explicit TrueType programs and source-role consistency", () => {
	const source = orangeFontFixture();
	const programs = readOrangePdfFontPrograms(JSON.stringify(source));
	assert.equal(programs.length, 5);
	assert.equal(programs.reduce((sum, item) => sum + item.mappingsOutsideDeclaredCodeSpace, 0), 10);
	assert.throws(() => inspectOrangePdfFonts(JSON.stringify(source)), /review/u);
	const objects = source.qpdf[1] as Record<string, { value: Record<string, unknown> }>;
	objects["obj:2 0 R"]!.value["/BaseFont"] = "/AAAAAA+Arial-Italic";
	assert.throws(() => readOrangePdfFontPrograms(JSON.stringify(source)), /review/u);
});

test("Orange rejects active PDF objects, encryption, forms, absent fonts and malformed envelopes", () => {
	for (const key of ["/JS", "/JavaScript", "/OpenAction", "/AA", "/AcroForm", "/XFA", "/Encrypt", "/Annots"]) {
		const source = orangeFontFixture();
		const objects = source.qpdf[1] as Record<string, unknown>;
		objects["obj:900 0 R"] = { value: { [key]: "unexpected" } };
		assert.throws(() => readOrangePdfFontPrograms(JSON.stringify(source)), /review/u);
	}
	const source = orangeFontFixture();
	source.encrypt.encrypted = true;
	assert.throws(() => readOrangePdfFontPrograms(JSON.stringify(source)), /review/u);
	for (const body of ["{}", "{\"qpdf\":[]}", " ".repeat(8 * 1024 * 1024 + 1)]) assert.throws(() => readOrangePdfFontPrograms(body), /review/u);
});

test("Orange binds every visible candidate fact to a reviewed original outline", () => {
	const { fields, svg, approvals, fieldUses } = orangeVisualFixture();
	const proof = inspectOrangeProofVisual(fields, svg, 2, approvals);
	assert.equal(proof.fields, 3);
	assert.equal(proof.nonspaceGlyphs, fields.reduce((sum, field) => sum + field.text.replace(/\s/gu, "").length, 0));
	assert.deepEqual(proof.clippedSourceDistrictLabels, []);
	assert.equal(proof.sourceDistrictLabelsApprovedForBallotMatching, false);
	assert.throws(() => inspectOrangeProofVisual(fields, svg, 2), /shape/u);
	assert.throws(() => inspectOrangeProofVisual(fields, svg.replace(fieldUses[0]![0]!, ""), 2, approvals), /inventory|shape/u);
	assert.throws(() => inspectOrangeProofVisual(fields, svg.replace("#glyph-0-0", "#glyph-0-1"), 2, approvals), /shape/u);
	assert.throws(() => inspectOrangeProofVisual(fields, svg.replace("x=\"60\"", "x=\"0\""), 2, approvals), /assignment|position/u);
	assert.throws(() => inspectOrangeProofVisual(fields, svg.replace("x=\"62\"", "x=\"60.1\""), 2, approvals), /spacing/u);
	assert.throws(() => inspectOrangeProofVisual(fields, svg, 1, approvals), /inventory/u);
});

test("Orange rejects hidden text, inherited transformations, unsupported paint and duplicate identifiers", () => {
	const { fields, svg, approvals } = orangeVisualFixture();
	const inspect = (body: string) => inspectOrangeProofVisual(fields, body, 2, approvals);
	for (const attribute of ["transform=\"translate(1)\"", "opacity=\"0\"", "style=\"display:none\"", "mask=\"url(#mask)\""]) assert.throws(() => inspect(svg.replace("<g fill=\"", `<g ${attribute} fill="`)), /attributes/u);
	assert.throws(() => inspect(svg.replace("</svg>", "<script>unexpected()</script></svg>")), /structure/u);
	assert.throws(() => inspect(svg.replace("</defs>", "<g id=\"glyph-0-0\"/></defs>")), /identifiers/u);
	assert.throws(() => inspect(svg.replace("rgb(0%, 0%, 100%)", "rgb(100%, 100%, 100%)")), /color/u);
	assert.throws(() => inspect(svg.replace("rgb(0%, 0%, 0%)", "none")), /hidden/u);
	assert.throws(() => inspect(svg.replace("<defs>", "<defs><g fill=\"none\">").replace("</defs>", "</g></defs>")), /structure/u);
	assert.throws(() => inspect(svg.replace("</svg>", "<image id=\"image-1\" x=\"0\" y=\"0\" width=\"93\" height=\"93\" href=\"data:image/png;base64,AA==\"/></svg>")), /seal/u);
});

test("Orange checks original painting order and contrast rather than accepting invisible matching text", () => {
	const { fields, svg, approvals } = orangeVisualFixture();
	const rectangle = (color: string) => `<path fill="${color}" fill-opacity="1" d="M 0 0 L 792 0 L 792 612 L 0 612 Z"/>`;
	assert.throws(() => inspectOrangeProofVisual(fields, svg.replace("</svg>", `${rectangle("rgb(100%, 100%, 100%)")}</svg>`), 2, approvals), /occlusion/u);
	assert.throws(() => inspectOrangeProofVisual(fields, svg.replace("</defs>", `</defs>${rectangle("rgb(0%, 0%, 0%)")}`), 2, approvals), /contrast/u);
	assert.equal(inspectOrangeProofVisual(fields, svg.replace("</defs>", `</defs>${rectangle("rgb(100%, 100%, 100%)")}`), 2, approvals).fields, 3);
});

test("Orange permits only right-cropped district metadata and never approves it for ballot matching", () => {
	const field = { text: "SYNTHETIC DISTRICT METADATA REPEATED FOR CLIP REVIEW ".repeat(3).trim(), left: 502, top: 60, width: 500, height: 15, font: 7 };
	const { fields, svg, approvals, fieldUses } = orangeVisualFixture([field]);
	const clip = "<clipPath id=\"clip-1\"><path d=\"M 334.5 30 L 551.65 30 L 551.65 60 L 334.5 60 Z\"/></clipPath>";
	let cropped = svg.replace("</defs>", `${clip}</defs>`).replace("<g fill=\"", "<g clip-path=\"url(#clip-1)\" fill=\"");
	for (const use of fieldUses[0]!.filter(use => Number(/x="([\d.]+)"/u.exec(use)![1]) >= 554)) cropped = cropped.replace(use, "");
	const proof = inspectOrangeProofVisual(fields, cropped, 2, approvals);
	assert.equal(proof.clippedSourceDistrictLabels.length, 1);
	assert.equal(proof.sourceDistrictLabelsApprovedForBallotMatching, false);
	assert.throws(() => inspectOrangeProofVisual([{ ...field, font: 19 }], cropped, 2, approvals), /inventory/u);
	assert.throws(() => inspectOrangeProofVisual(fields, cropped.replace("L 551.65 60", "L 551.65 40").replace("L 334.5 60", "L 334.5 40"), 2, approvals), /clipping/u);
	assert.throws(() => inspectOrangeProofVisual(fields, cropped.replace(fieldUses[0]![5]!, ""), 2, approvals), /shape/u);
});

test("Orange validates rule rectangles and reconstructs caption stroke coordinates", () => {
	assert.deepEqual(orangeRuleShapes("M 1 2 L 8 2 L 8 9 L 1 9 Z M 1 2"), [{ box: [1, 2, 8, 9], closed: true }]);
	assert.deepEqual(orangeRuleShapes("M 1 2 L 8 2"), [{ box: [1, 2, 8, 2], closed: false }]);
	for (const path of ["M 1 2 L 8 9", "M 1 2 L 8 2 L 8 9 L 8 2 Z", "M 0 0 C 1 1 2 2 3 3 Z", "M 0 0 L 1 1 Q 2 2"]) assert.throws(() => orangeRuleShapes(path), /review/u);
	const commands = orangePathCommands("M 0 -5 L 1 -5 L 1 0 L 0 0 Z", 20, 30);
	assert.equal(orangeStrokeMatches(commands, orangePathCommands("M 20 25 L 21 25 L 21 30 L 20 30 Z")), true);
	assert.equal(orangeStrokeMatches(commands, orangePathCommands("M 20 25 L 22 25 L 21 30 L 20 30 Z")), false);
});

test("Orange XML can suppress the seal without suppressing any text while original SVG still requires it", () => {
	const original = orangeProofFixture();
	assert.deepEqual(readOrangeCandidateProof(original.replace(/<img[^>]*\/>/u, ""), "2026-11-03"), readOrangeCandidateProof(original, "2026-11-03"));
	const { fields, svg, approvals } = orangeVisualFixture();
	assert.throws(() => inspectOrangeProofVisual(fields, svg, 1, approvals), /inventory/u);
});

test("Orange caption bolding is an exact reconstructed glyph stroke, not an arbitrary permitted vector", () => {
	const { fields, svg, approvals } = orangeVisualFixture([{ text: "SYNTHETIC HEADING", left: 90, top: 30, width: 180, height: 15, font: 5 }]);
	assert.equal(inspectOrangeProofVisual(fields, svg, 2, approvals).captionStrokes, 1);
	assert.throws(() => inspectOrangeProofVisual(fields, svg.replace(/<path fill="none"[^>]*\/>/u, ""), 2, approvals), /stroke inventory/u);
	assert.throws(() => inspectOrangeProofVisual(fields, svg.replace("stroke-width=\"0.3\"", "stroke-width=\"0.2\""), 2, approvals), /stroke/u);
	assert.throws(() => inspectOrangeProofVisual(fields, svg.replace("stroke-miterlimit=\"10\" d=\"M 60", "stroke-miterlimit=\"10\" d=\"M 61"), 2, approvals), /outline/u);
});

test("Orange native capacity is source-specific and preserves all existing worker limits", async () => {
	assert.equal(stateBallotPdfCollectorContract.maximumPages, 50);
	assert.equal(stateBallotNativePdfCollectorContract.maximumPages, 20);
	assert.equal(chicagoNativePdfCollectorContract.maximumPages, 50);
	assert.equal(nycNativePdfCollectorContract.maximumPages, 60);
	assert.equal(orangeNativePdfCollectorContract.maximumPages, 256);
	assert.equal(orangeNativePdfCollectorContract.maximumRenderedBytes, 128 * 1024 * 1024);
	await assert.rejects(extractStateBallotPdfSvg(Buffer.from("%PDF-"), process.execPath, 51), /bounds/u);
	await assert.rejects(extractStateBallotPdfSvg(Buffer.from("%PDF-"), process.execPath, 257, 12000, "orange"), /bounds/u);
	await assert.rejects(extractStateBallotPdfXml(Buffer.from("%PDF-"), process.execPath, "unknown" as "orange"), /unsupported/u);
	await assert.rejects(inspectStateBallotPdfObjects(Buffer.from("%PDF-"), process.execPath, "unknown" as "orange"), /unsupported/u);
	await assert.rejects(verifyOrangeCandidateProof(Buffer.from("%PDF-"), "2026-11-03", { xmlExecutable: "relative-path", svgExecutable: "relative-path", objectExecutable: "relative-path" }), StateBallotPdfCapabilityError);
});
