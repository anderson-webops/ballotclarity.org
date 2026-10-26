import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import test from "node:test";
import { readStateBallotPdfGrid, stateBallotPdfGridContract } from "../src/state-ballot-pdf-grid.js";
import { extractStateBallotPdfSvg, extractStateBallotPdfText, resolveStateBallotPdfSvgExtractor, StateBallotPdfCapabilityError } from "../src/state-ballot-pdf.js";

function fixture() {
	const width = 800;
	const height = 600;
	const columns = [60, 140, 200, 260, 320, 380, 440, 500, 560, 620, 680];
	const rows = [150, 210, 250, 290, 330, 370, 410];
	const words: Array<{ text: string; left: number; top: number }> = [{ text: "Office", left: 80, top: 160 }, { text: "Party", left: 80, top: 180 }];
	for (let column = 1; column < columns.length - 1; column++) {
		words.push({ text: `Office${column}`, left: columns[column]! + 5, top: 175 });
		for (let row = 1; row < rows.length - 1; row++) {
			words.push({ text: `${column}${String.fromCharCode(64 + row)}`, left: columns[column]! + 5, top: rows[row]! + 5 });
			words.push({ text: `Name${column}`, left: columns[column]! + 5, top: rows[row]! + 20 });
		}
	}
	for (const [index, label] of ["Democratic", "Republican", "WorkingFamilies", "Nonpartisan", "Write-in"].entries()) {
		if (label === "Nonpartisan") {
			for (const character of label) words.push({ text: character, left: 99 + (character.charCodeAt(0) % 3) / 10, top: rows[index + 1]! + 15 });
		}
		else {
			words.push({ text: label, left: 70, top: rows[index + 1]! + 15 });
		}
	}
	const path = (firstX: number, firstY: number, lastX: number, lastY: number) => `<path fill="none" stroke="black" d="M ${firstX} ${height - firstY} L ${lastX} ${height - lastY}" transform="matrix(1, 0, 0, -1, 0, ${height})"/>`;
	const drawings = [...columns.map(horizontal => path(horizontal, rows[0]!, horizontal, rows.at(-1)!)), ...rows.map(vertical => path(columns[0]!, vertical, columns.at(-1)!, vertical)), path(20, 20, 780, 20), path(20, 580, 780, 580), path(20, 20, 20, 580), path(780, 20, 780, 580)];
	const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">${drawings.join("")}<path fill="black" d="M 0 0 C 0 1 1 1 1 0 Z"/></svg>`;
	const page = `<page width="${width}" height="${height}">${words.map(word => `<word xMin="${word.left}" yMin="${word.top}" xMax="${word.left + 10}" yMax="${word.top + 8}">${word.text}</word>`).join("")}</page>`;
	return { svg, page, corpus: `<html><body>${page}</body></html>`, path };
}

test("PDF grids reconcile physical cells and raw logical order without retaining outer frames", () => {
	const { svg, corpus } = fixture();
	const pages = readStateBallotPdfGrid(corpus, [svg]);
	assert.equal(pages.length, 1);
	assert.equal(pages[0]!.cells.length, 60);
	assert.equal(pages[0]!.cells.reduce((total, cell) => total + cell.tags.length, 0), 45);
	assert.ok(pages[0]!.cells.some(cell => cell.logicalText.replace(/\s+/gu, "") === "Nonpartisan"));
	assert.ok(pages[0]!.cells.every(cell => cell.bounds[0] >= 60 && cell.bounds[1] >= 150));
	assert.equal(readStateBallotPdfGrid(corpus.replace("</page>", "<word xMin=\"700\" yMin=\"100\" xMax=\"710\" yMax=\"110\">1A</word></page>"), [svg])[0]!.cells.length, 60);
});

test("PDF grids preserve merged office headers and bilingual Office/Party anchors", () => {
	const { svg, corpus, path } = fixture();
	const merged = svg.replace(path(200, 150, 200, 410), path(200, 210, 200, 410));
	const bilingual = corpus.replace(">Office<", ">Office Cargo<").replace(">Party<", ">Party Partido<");
	const result = readStateBallotPdfGrid(bilingual, [merged]);
	assert.equal(result[0]!.cells.length, 59);
	assert.ok(result[0]!.cells.some(cell => cell.text.includes("Office1") && cell.text.includes("Office2")));
});

test("PDF grids reject incomplete, mismatched, malformed and oversized captures", () => {
	const { svg, corpus } = fixture();
	for (const [words, drawings] of [
		[corpus, []],
		[corpus, [svg.replace("0 0 800 600", "0 0 801 600")]],
		[corpus.replace("width=\"800\"", "width=\"1\""), [svg]],
		[corpus.replace("xMin=\"80\"", "xMin=\"NaN\""), [svg]],
		[corpus.replace(">Office<", ">Unrecognized<"), [svg]],
		[corpus, [" ".repeat(stateBallotPdfGridContract.maximumSvgBytes + 1)]],
		[corpus, [svg.replace("matrix(1, 0, 0, -1, 0, 600)", "translate(2)")]],
		[corpus, [svg.replace("matrix(1, 0, 0, -1, 0, 600)", "matrix(1e309, 0, 0, -1, 0, 600)")]],
	] as Array<[string, string[]]>) assert.throws(() => readStateBallotPdfGrid(words, drawings), /ballot grid/u);
	assert.throws(() => readStateBallotPdfGrid(`<html>${fixture().page.repeat(51)}</html>`, Array.from<string>({ length: 51 }).fill(svg)), /page count/u);
});

test("PDF grids reject positions omitted by a broken or disconnected border", () => {
	const { svg, corpus, path } = fixture();
	assert.throws(() => readStateBallotPdfGrid(corpus, [svg.replace(path(680, 150, 680, 410), "")]), /position/u);
	assert.throws(() => readStateBallotPdfGrid(corpus.replace("</page>", "<word xMin=\"720\" yMin=\"500\" xMax=\"730\" yMax=\"510\">99Z</word></page>"), [svg]), /position/u);
});

test("PDF grids reject unsupported inherited transforms and bounded but excessive geometry", () => {
	const { svg, corpus } = fixture();
	assert.throws(() => readStateBallotPdfGrid(corpus, [svg.replace("><path", "><g transform=\"scale(2)\"><path").replace("</svg>", "</g></svg>")]), /ancestor transform/u);
	assert.throws(() => readStateBallotPdfGrid(corpus, [svg.replace("</svg>", "<path stroke=\"black\" d=\"M 0 0 L 1\"/></svg>")]), /incomplete/u);
	assert.throws(() => readStateBallotPdfGrid(corpus, [svg.replace("</svg>", "<path stroke=\"black\" d=\"M 0 0 L 9999 9999\"/></svg>")]), /outside/u);
});

test("SVG capability requires its own configured absolute executable without falling back to text extraction", async () => {
	const previous = process.env.STATE_BALLOT_PDFTOCAIRO;
	try {
		delete process.env.STATE_BALLOT_PDFTOCAIRO;
		await assert.rejects(resolveStateBallotPdfSvgExtractor(), StateBallotPdfCapabilityError);
		await assert.rejects(resolveStateBallotPdfSvgExtractor("relative-tool"), StateBallotPdfCapabilityError);
		await assert.rejects(resolveStateBallotPdfSvgExtractor("/missing-grid-extractor"), StateBallotPdfCapabilityError);
		assert.equal(await resolveStateBallotPdfSvgExtractor(process.execPath), process.execPath);
	}
	finally {
		if (previous === undefined) delete process.env.STATE_BALLOT_PDFTOCAIRO;
		else process.env.STATE_BALLOT_PDFTOCAIRO = previous;
	}
});

test("raw bounding-box and SVG workers retain bounded pipes, exact arguments and failure behavior", async () => {
	const directory = await mkdtemp(join(tmpdir(), "ballot-grid-worker-"));
	const executable = join(directory, "worker");
	const bytes = Buffer.from("%PDF-synthetic");
	try {
		await writeFile(executable, `#!${process.execPath}\nprocess.stdin.resume();process.stdin.on('end',()=>process.stdout.write(process.argv.slice(2).join(' ')+'<page></page>'));\n`, { mode: 0o700 });
		assert.match(await extractStateBallotPdfText(bytes, executable, 12000, "raw-bbox"), /^-raw -bbox -enc UTF-8 -eol unix - -/u);
		assert.match(await extractStateBallotPdfText(bytes, executable, 12000, "raw", 200), /^-raw -enc UTF-8 -eol unix - -/u);
		assert.match(await extractStateBallotPdfSvg(bytes, executable, 3), /^-svg -f 3 -l 3 - -/u);
		for (const page of [0, 51, 1.5, NaN]) await assert.rejects(extractStateBallotPdfSvg(bytes, executable, page), /bounds/u);
		await assert.rejects(extractStateBallotPdfSvg(Buffer.from("not-pdf"), executable, 1), /bounds/u);
		await writeFile(executable, `#!${process.execPath}\nprocess.stdin.resume();process.stdin.on('end',()=>process.stdout.write('x'.repeat(4*1024*1024+1)));\n`);
		await assert.rejects(extractStateBallotPdfSvg(bytes, executable, 1), /bounds/u);
		await writeFile(executable, `#!${process.execPath}\nsetInterval(()=>{},100);\n`);
		await assert.rejects(extractStateBallotPdfSvg(bytes, executable, 1, 30), /bounds/u);
	}
	finally { await rm(directory, { recursive: true, force: true }); }
});
