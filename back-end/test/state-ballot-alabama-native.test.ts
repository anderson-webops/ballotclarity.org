import type { AlabamaPdfDictionary } from "../src/state-ballot-alabama-types.js";
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { alabamaCells } from "../src/state-ballot-alabama-cells.js";
import { proveAlabamaFieldDrawings } from "../src/state-ballot-alabama-field-drawings.js";
import { createAlabamaFontVerifier } from "../src/state-ballot-alabama-fonts.js";
import { alabamaGlyphApprovals } from "../src/state-ballot-alabama-glyphs.js";
import { alabamaNativeContract, verifyAlabamaOriginal } from "../src/state-ballot-alabama-native.js";
import { inspectAlabamaObjects } from "../src/state-ballot-alabama-objects.js";
import { alabamaTrueTypeMappings, readAlabamaContent, tokenizePdfContent } from "../src/state-ballot-alabama-reader.js";
import { headingText, officeContext } from "../src/state-ballot-alabama-records.js";
import { proveAlabamaOfficeFrame, proveAlabamaOfficeRows } from "../src/state-ballot-alabama-rows.js";
import { alabamaHash } from "../src/state-ballot-alabama-types.js";
import { resolveAlabamaVisibility } from "../src/state-ballot-alabama-visibility.js";
import {
	alabamaCellsFixture,
	alabamaContentFixture,
	alabamaFontFixture,
	alabamaGlyph,
	alabamaPage,
	alabamaPdfFixture,
	alabamaSpan
} from "./helpers/alabama-native-fixture.js";

test("Alabama literal, octal, hexadecimal and array tokens preserve source bytes", () => {
	const tokens = [...tokenizePdfContent("% comment\n[(A\\(B\\)\\040C) -20 <4445>] TJ")];
	assert.equal(tokens.length, 2);
	const first = tokens[0];
	assert.equal(first.kind, "array");
	if (first.kind !== "array") return;
	assert.deepEqual(
		first.values.map(value =>
			value.kind === "bytes" ? value.bytes.toString() : value.kind === "number" ? value.value : null
		),
		["A(B) C", -20, "DE"]
	);
	assert.deepEqual(tokens[1], { kind: "operator", value: "TJ" });
});
test("Alabama malformed, duplicate and oversized lexical content rejects", () => {
	for (const body of [
		"(unfinished",
		"[1",
		"<GG>",
		"1".repeat(129),
		"x".repeat(12 * 1024 * 1024 + 1),
		"<< /MCID 1 /MCID 2 >>"
	])
		assert.throws(() => [...tokenizePdfContent(body)]);
});
test("Alabama native admission validates one explicit page, ordered streams and bounded resources", () => {
	const result = inspectAlabamaObjects(alabamaPdfFixture());
	assert.equal(result.pageCount, 1);
	assert.equal(result.fontResources, 1);
	assert.equal(result.actionsAndAnnotationsAbsent, true);
	assert.equal(result.emptyFormVerified, false);
	const form = alabamaPdfFixture();
	(form.qpdf[1]["obj:1 0 R"].value as AlabamaPdfDictionary)["/AcroForm"] = {
		"/Fields": [],
		"/NeedAppearances": false
	};
	assert.equal(inspectAlabamaObjects(form).emptyFormVerified, true);
});
for (const property of [
	"/Annots",
	"/OpenAction",
	"/JavaScript",
	"/OCProperties",
	"/EmbeddedFiles",
	"/XFA",
	"/AP",
	"/RichMediaContent"
]) {
	test(`Alabama rejects native ${property}`, () => {
		const document = alabamaPdfFixture();
		alabamaPage(document)[property] = [];
		assert.throws(() => inspectAlabamaObjects(document));
	});
}
test("Alabama transformed, encrypted and ambiguous native page inventories fail closed", () => {
	for (const [key, value] of [
		["/Rotate", 90],
		["/UserUnit", 2],
		["/Group", {}],
		["/CropBox", [0, 0, 20, 20]],
		["/Contents", []]
	] as const) {
		const document = alabamaPdfFixture();
		alabamaPage(document)[key] = value;
		assert.throws(() => inspectAlabamaObjects(document));
	}
	const encrypted = alabamaPdfFixture();
	encrypted.encrypt.encrypted = true;
	assert.throws(() => inspectAlabamaObjects(encrypted));
	const field = alabamaPdfFixture();
	field.acroform.fields.push({});
	assert.throws(() => inspectAlabamaObjects(field));
	const stream = alabamaPdfFixture();
	stream.qpdf[1]["obj:4 0 R"].stream!.data = "YQ==\n";
	assert.throws(() => inspectAlabamaObjects(stream));
});
test("Alabama visible graphics keep original stroke geometry and reject unsupported appearance state", () => {
	const result = readAlabamaContent(alabamaPdfFixture("0 G 1 w 100 100 50 20 re S"));
	assert.equal(result.strokes.length, 4);
	assert.equal(alabamaCells(result).length, 1);
	assert.equal(result.sourceFactsAccepted, false);
	for (const body of [
		"Q",
		"q",
		"sh",
		"BT 7 Tr ET",
		"100 100 20 20 re W S",
		"/OC /MC0 BDC EMC",
		"/P BMC",
		"EMC",
		"/P << /ActualText (other) >> BDC EMC",
		"/P /Missing BDC EMC",
		"101 i",
		"/Unknown ri"
	])
		assert.throws(() => readAlabamaContent(alabamaPdfFixture(body)));
});
test("Alabama unknown border overpaint cannot leave a phantom closed frame", () => {
	const result = resolveAlabamaVisibility(
		readAlabamaContent(alabamaPdfFixture("0 G 2 w 100 100 50 20 re S 1 0 0 rg 120 98 5 5 re f"))
	);
	assert(
		!result.strokes.some(
			stroke => stroke.axis === "h" && stroke.ink[0] < 122 && stroke.ink[2] > 122 && stroke.ink[1] < 101
		)
	);
});
test("Alabama background contrast and later opaque paint remain part of glyph visibility", () => {
	const make = () => {
		const content = alabamaContentFixture();
		content.glyphs = [alabamaGlyph()];
		content.textSpans = [alabamaSpan("A")];
		return content;
	};
	const black = make();
	black.painted.push({
		kind: "rectangle",
		bounds: [0, 0, 100, 100],
		operation: 0,
		fill: "black",
		alpha: 1,
		blend: "/Normal"
	});
	assert.equal(resolveAlabamaVisibility(black).glyphs[0].backgroundProven, false);
	const white = make();
	white.painted.push({
		kind: "rectangle",
		bounds: [0, 0, 100, 100],
		operation: 2,
		fill: "white",
		alpha: 1,
		blend: "/Normal"
	});
	assert.equal(resolveAlabamaVisibility(white).glyphs.length, 0);
});
test("Alabama synthetic Unicode mappings cannot become approved real glyph programs", () => {
	const program = alabamaFontFixture();
	const mappings = alabamaTrueTypeMappings(program, [65, 66, 192]);
	assert.deepEqual(
		mappings.map(item => [item.character, item.glyph]),
		[
			["A", 2],
			["B", 3],
			["À", 4]
		]
	);
	assert.throws(() => alabamaTrueTypeMappings(program, [65, 65]));
	assert.throws(() => createAlabamaFontVerifier(program), /requires review/u);
	assert.equal(Object.keys(alabamaGlyphApprovals).length, 8);
	assert(Object.keys(alabamaGlyphApprovals).every(value => /^[a-f\d]{64}$/u.test(value)));
});
test("Alabama closed rows retain clipped write-in boundaries without promoting them to candidate facts", () => {
	const data = alabamaCellsFixture();
	data.end.spans[0].fullyVisible = false;
	const proof = proveAlabamaOfficeRows(data.header, data.cells);
	assert(proof);
	assert.equal(proof.candidateSpans?.length, 2);
	assert.equal(proof.markerTextVisibilityUsedAsFact, false);
	data.candidate.borders.left = [10.2, 10.4];
	assert.equal(proveAlabamaOfficeRows(data.header, data.cells), null);
});
test("Alabama candidate ambiguity, outside glyphs and second voting rules keep the office held", () => {
	const data = alabamaCellsFixture();
	const other = structuredClone(data.candidate);
	other.spans[0].operation = 99;
	assert.equal(proveAlabamaOfficeRows(data.header, [...data.cells, other]), null);
	data.candidate.spans[0].glyphs[0].ink[0] = 9;
	assert.equal(proveAlabamaOfficeRows(data.header, data.cells), null);
	const frame = {
		...data.header,
		bounds: [10, 20, 50, 40],
		spans: [data.vote, ...data.candidate.spans, ...data.end.spans, { ...data.vote, operation: 10, baseline: 26 }]
	};
	assert.equal(proveAlabamaOfficeFrame(data.header, data.vote, [frame]), null);
});
test("Alabama unparsed images, vectors and unproved text inside an office require review", () => {
	const data = alabamaCellsFixture();
	const field = {
		cell: data.header,
		bounds: data.header.bounds,
		vote: data.vote,
		heading: "FOR GOVERNOR",
		spans: data.candidate.spans,
		holdReason: null
	};
	for (const kind of ["image", "path"]) {
		const content = resolveAlabamaVisibility(alabamaContentFixture());
		content.painted.push({
			kind,
			bounds: [20, 30, 30, 33],
			alpha: 1,
			fill: "black",
			blend: "/Normal",
			operation: 1
		});
		assert.throws(() => proveAlabamaFieldDrawings(content, field, data.candidate.spans), /unparsed drawing/u);
	}
	const content = resolveAlabamaVisibility(alabamaContentFixture());
	content.glyphs.push({ ...alabamaGlyph(), fontProven: false });
	assert.throws(() => proveAlabamaFieldDrawings(content, field, data.candidate.spans), /Unproved text/u);
});
test("Alabama office identities keep education and local subdistricts distinct from statewide races", () => {
	assert.equal(officeContext("FOR GOVERNOR", "Macon").scope, "statewide");
	assert.equal(
		officeContext("FOR MEMBER, STATE BOARD OF EDUCATION, DISTRICT NO. 2", "Macon").scope,
		"state-board-of-education"
	);
	assert.equal(
		officeContext("FOR MEMBER, MACON COUNTY COMMISSION, DISTRICT NO. 1", "Macon").jurisdiction,
		"Macon County Commission District 1"
	);
	assert.equal(headingText([alabamaSpan("FOR GOVERNOR"), alabamaSpan("FOR GOVERNOR")]), "FOR GOVERNOR");
	assert.throws(() => officeContext("FOR UNREVIEWED OFFICE", "Macon"), /requires review/u);
});
test("Alabama original PDF identity fails before inspector work and capabilities remain explicit", async () => {
	const bytes = Buffer.from("%PDF-Synthetic input");
	const input = {
		county: "Macon",
		electionDate: "2026-11-03",
		sourceUrl: "https://www.sos.alabama.gov/sites/default/files/sample-ballots/2026/gen/Macon_Sample.pdf",
		sourceSha256: alabamaHash(bytes)
	};
	await assert.rejects(
		verifyAlabamaOriginal(bytes, { ...input, sourceSha256: "0".repeat(64) }, { scratchDirectory: tmpdir() }),
		/capture/u
	);
	await assert.rejects(verifyAlabamaOriginal(bytes, input, { scratchDirectory: "relative" }), /absolute private/u);
	await assert.rejects(
		verifyAlabamaOriginal(bytes, input, { scratchDirectory: tmpdir(), objectExecutable: "/nonexistent/qpdf" }),
		/unavailable/u
	);
	assert.equal(alabamaNativeContract.workerOldGenerationMiB, 128);
});
test("Alabama warning and failed original inspections retain no temporary files", async () => {
	const directory = await mkdtemp(join(tmpdir(), "alabama-native-test-"));
	const scratch = join(directory, "scratch");
	try {
		const { mkdir } = await import("node:fs/promises");
		await mkdir(scratch);
		for (const [label, body] of [
			["warning", "#!/bin/sh\nprintf warning >&2\nprintf '{}'\n"],
			["failed", "#!/bin/sh\nexit 3\n"]
		]) {
			const executable = join(directory, label);
			await writeFile(executable, body, { mode: 0o700 });
			const bytes = Buffer.from("%PDF-Synthetic input");
			await assert.rejects(
				verifyAlabamaOriginal(
					bytes,
					{
						county: "Macon",
						electionDate: "2026-11-03",
						sourceUrl:
							"https://www.sos.alabama.gov/sites/default/files/sample-ballots/2026/gen/Macon_Sample.pdf",
						sourceSha256: alabamaHash(bytes)
					},
					{ scratchDirectory: scratch, objectExecutable: executable }
				),
				/remains held/u
			);
			assert.deepEqual(await readdir(scratch), []);
		}
	}
	finally {
		await rm(directory, { recursive: true, force: true });
	}
});
