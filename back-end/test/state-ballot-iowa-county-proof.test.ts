import type { IowaSampleContext } from "../src/state-ballot-iowa-county-native.js";
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { chmod, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { readIowaCountySample } from "../src/state-ballot-iowa-county-native.js";
import { inspectIowaSampleGeometry, validateIowaSampleGeometry, verifyIowaSampleNative } from "../src/state-ballot-iowa-county-proof.js";
import { extractStateBallotPdfXml, inspectStateBallotPdfObjects } from "../src/state-ballot-pdf.js";
import { iowaCountyNativeFixture } from "./helpers/iowa-county-native-fixture.js";

const hash = (body: string) => createHash("sha256").update(body).digest("hex");

function fixture(county: IowaSampleContext["county"] = "Monona", electionDate = "2026-11-03") {
	const native = iowaCountyNativeFixture(county, electionDate);
	const crop = county === "Monona" ? [18.573, 66.596, 593.28, 974.929] : [0, 0, 612, 1008];
	const objects = {
		pages: [{ object: "2 0 R" }, { object: "3 0 R" }],
		qpdf: [{ jsonversion: 2 }, {
			"obj:1 0 R": { value: { "/Type": "/Pages", "/MediaBox": [0, 0, 612, 1008], "/CropBox": crop, "/Rotate": 0 } },
			"obj:2 0 R": { value: { "/Type": "/Page", "/Parent": "1 0 R" } },
			"obj:3 0 R": { value: { "/Type": "/Page", "/Parent": "1 0 R" } }
		}]
	};
	const body = JSON.stringify(objects);
	const geometry = inspectIowaSampleGeometry(body, county);
	const visible = native.bbox.replace("<doc>", "<pdf2xml><fontspec id=\"0\" size=\"10\" color=\"#000000\"/>").replace("</doc>", "</pdf2xml>").replace(/<word xMin="([\d.]+)" xMax="([\d.]+)" yMin="([\d.]+)" yMax="([\d.]+)">([\s\S]*?)<\/word>/gu, (_match, left: string, right: string, top: string, bottom: string, text: string) => `<text left="${left}" width="${Number(right) - Number(left)}" top="${top}" height="${Number(bottom) - Number(top)}" font="0">${text}</text>`);
	const parsed = readIowaCountySample(native.bbox, native.layout, native.context);
	const verify = (value = visible) => verifyIowaSampleNative(parsed, value, geometry, hash(body), native.context);
	return { ...native, objects, body, geometry, visible, parsed, verify };
}

for (const county of ["Monona", "Woodbury"] as const) {
	test(`${county} native proof reconciles all fields, questions, tickets and inherited original-PDF geometry`, () => {
		const source = fixture(county);
		assert.deepEqual(source.verify(), { geometry: source.geometry, objectsSha256: hash(source.body), visibleSha256: hash(source.visible), choices: source.parsed.records.length, names: source.parsed.claims.length });
		assert(source.parsed.records.some(record => record.recordKind === "joint-ticket"));
		assert(source.parsed.records.some(record => record.recordKind === "judicial-retention-question"));
	});

	test(`${county} native proof verifies a supplied future edition without asserting its publication`, () => {
		assert(fixture(county, "2028-11-07").verify().choices > 0);
	});

	test(`${county} native proof rejects changed original page boxes, rotation and scale`, () => {
		const source = fixture(county);
		for (const change of [
			{ cropBox: [0, 0, 611, 1008] },
			{ mediaBox: [0, 0, 611, 1008] },
			{ rotation: 90 },
			{ userUnit: 2 },
			{ cropBox: [0, 0, Number.NaN, 1008] }
		]) assert.throws(() => validateIowaSampleGeometry(source.geometry.map(page => ({ ...page, ...change })), county), /requires? review/u);
	});

	for (const [before, after] of [
		["Avery Example", "Avery Changed"],
		["Republican Party", "Democratic Party"],
		["REP", "DEM"],
		["One Team", "Two Teams"],
		["no more than Two", "no more than Three"],
		["Casey Sample", "Casey Different"],
		["For County Treasurer", "For County Auditor"],
		["District 3B Associate Judge", "District 4 Associate Judge"],
		["Shall the following amendment", "Shall a different amendment"],
		["November 3, 2026", "November 2, 2026"],
		[`County of ${county}`, "County of Example"]
	]) {
		if ((before === "REP" && county === "Woodbury") || (before === "Republican Party" && county === "Monona")) continue;
		test(`${county} native proof rejects an altered ${before} field`, () => {
			const source = fixture(county);
			assert(source.visible.includes(before));
			assert.throws(() => source.verify(source.visible.replace(before, after)));
		});
	}

	test(`${county} native proof rejects missing choices, pages, changed color and ambiguous font identity`, () => {
		const source = fixture(county);
		for (const changed of [
			source.visible.replace(/<text[^>]*>Avery Example[^<]*<\/text>/u, ""),
			source.visible.replace(/<page[\s\S]*?<\/page>/u, ""),
			source.visible.replace("#000000", "#ffffff"),
			source.visible.replace("</pdf2xml>", "<fontspec id=\"0\" size=\"11\" color=\"#000000\"/></pdf2xml>"),
			source.visible.replace("width=\"612\"", "width=\"611\""),
			source.visible.replace("height=\"10\"", "height=\"-1\"")
		]) assert.throws(() => source.verify(changed));
	});
}

test("Iowa original-page inspection rejects cyclic, missing, duplicate and oversized object inventories", () => {
	const source = fixture();
	const cyclic = JSON.parse(source.body);
	cyclic.qpdf[1]["obj:1 0 R"].value = { "/Type": "/Pages", "/Parent": "2 0 R" };
	assert.throws(() => inspectIowaSampleGeometry(JSON.stringify(cyclic), "Monona"), /cyclic/u);
	const missing = JSON.parse(source.body);
	delete missing.qpdf[1]["obj:1 0 R"];
	assert.throws(() => inspectIowaSampleGeometry(JSON.stringify(missing), "Monona"), /unavailable/u);
	const duplicate = JSON.parse(source.body);
	duplicate.pages[1] = duplicate.pages[0];
	assert.throws(() => inspectIowaSampleGeometry(JSON.stringify(duplicate), "Monona"));
	assert.throws(() => inspectIowaSampleGeometry(" ".repeat(4 * 1024 * 1024 + 1), "Monona"), /bounds/u);
});

test("Iowa native proof enforces body, depth and provenance bounds", () => {
	const source = fixture();
	assert.throws(() => source.verify(" ".repeat(4 * 1024 * 1024 + 1)), /bounds/u);
	assert.throws(() => source.verify(`<div>${"<div>".repeat(65)}${source.visible}${"</div>".repeat(65)}</div>`), /bounds/u);
	assert.throws(() => verifyIowaSampleNative(source.parsed, source.visible, source.geometry, "invalid", source.context), /provenance/u);
});

test("Iowa XML profile pins point-scale output and two pages while preserving existing profile arguments", async () => {
	const directory = await mkdtemp(join(tmpdir(), "iowa-native-worker-"));
	try {
		const executable = join(directory, "extract");
		const pdf = Buffer.from("%PDF-Synthetic worker input");
		await writeFile(executable, `#!${process.execPath}\nprocess.stdin.resume();process.stdout.write(process.argv.includes("-zoom")?'<pdf2xml><page/><page/></pdf2xml>':'<pdf2xml>'+"<page/>".repeat(3)+'</pdf2xml>');\n`, { mode: 0o700 });
		await chmod(executable, 0o700);
		assert.equal((await extractStateBallotPdfXml(pdf, executable, "iowa-county")).match(/<page/gu)?.length, 2);
		assert.equal((await extractStateBallotPdfXml(pdf, executable)).match(/<page/gu)?.length, 3);
		await writeFile(executable, `#!${process.execPath}\nprocess.stdin.resume();process.stdout.write('<pdf2xml>'+"<page/>".repeat(3)+'</pdf2xml>');\n`);
		await assert.rejects(extractStateBallotPdfXml(pdf, executable, "iowa-county"), /bounds/u);
	}
	finally { await rm(directory, { recursive: true, force: true }); }
});

test("Iowa original-page inspection requests metadata within the existing bound and preserves standard stream inspection", async () => {
	const directory = await mkdtemp(join(tmpdir(), "iowa-geometry-worker-"));
	try {
		const executable = join(directory, "extract");
		const pdf = Buffer.from("%PDF-Synthetic worker input");
		await writeFile(executable, `#!${process.execPath}\nprocess.stdin.resume();process.stdout.write(JSON.stringify({metadata:process.argv.includes("--json-stream-data=none"),inline:process.argv.includes("--json-stream-data=inline"),decode:process.argv.includes("--decode-level=generalized")}));\n`, { mode: 0o700 });
		assert.deepEqual(JSON.parse(await inspectStateBallotPdfObjects(pdf, executable, "iowa-county")), { metadata: true, inline: false, decode: false });
		assert.deepEqual(JSON.parse(await inspectStateBallotPdfObjects(pdf, executable)), { metadata: false, inline: true, decode: true });
		await writeFile(executable, `#!${process.execPath}\nprocess.stdin.resume();process.stdout.write("x".repeat(5*1024*1024));\n`);
		await assert.rejects(inspectStateBallotPdfObjects(pdf, executable, "iowa-county"), /bounds/u);
	}
	finally { await rm(directory, { recursive: true, force: true }); }
});
