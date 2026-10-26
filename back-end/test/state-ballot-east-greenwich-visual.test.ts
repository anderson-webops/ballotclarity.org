import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import test from "node:test";
import { crc32, deflateSync } from "node:zlib";
import { eastGreenwichPngPixels, inspectEastGreenwichVisualPage, validateEastGreenwichVisualProof } from "../src/state-ballot-east-greenwich-visual.js";
import { stateHtmlAttribute as attribute, stateHtmlDescendants as descendants, parseStateHtml } from "../src/state-ballot-html.js";
import { eastGreenwichFixtureHash, eastGreenwichVisualFixture } from "./helpers/east-greenwich-collection-fixture.js";
import { eastGreenwichFixture } from "./helpers/east-greenwich-fixture.js";

function png(filter: number, rows: number[][], level: number) {
	const chunk = (type: string, body: Buffer) => {
		const result = Buffer.alloc(body.length + 12);
		result.writeUInt32BE(body.length);
		result.write(type, 4, "ascii");
		body.copy(result, 8);
		result.writeUInt32BE(crc32(result.subarray(4, result.length - 4)), result.length - 4);
		return result;
	};
	const header = Buffer.from([0, 0, 0, 2, 0, 0, 0, 2, 8, 2, 0, 0, 0]);
	return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", header), chunk("IDAT", deflateSync(Buffer.from(rows.flatMap(row => [filter, ...row])), { level })), chunk("IEND", Buffer.alloc(0))]);
}
test("raster fingerprints are RGB pixels, independent of all five PNG filters and compression", () => {
	const pixels = Buffer.from([10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120]);
	const expected = createHash("sha256").update(pixels).digest("hex");
	const rows = [[[10, 20, 30, 40, 50, 60], [70, 80, 90, 100, 110, 120]], [[10, 20, 30, 30, 30, 30], [70, 80, 90, 30, 30, 30]], [[10, 20, 30, 40, 50, 60], [60, 60, 60, 60, 60, 60]], [[10, 20, 30, 35, 40, 45], [65, 70, 75, 45, 45, 45]], [[10, 20, 30, 30, 30, 30], [60, 60, 60, 30, 30, 30]]];
	for (const [filter, values] of rows.entries()) {
		for (const level of [0, 9]) assert.deepEqual(eastGreenwichPngPixels(png(filter, values, level)), { width: 2, height: 2, sha256: expected });
	}
});
test("bad raster checksums, incomplete streams and excessive output are refused", () => {
	const valid = png(0, [[1, 2, 3, 4, 5, 6], [7, 8, 9, 10, 11, 12]], 9);
	const badChecksum = Buffer.from(valid);
	badChecksum[30] = badChecksum[30]! ^ 1;
	for (const body of [Buffer.alloc(0), valid.subarray(0, -1), Buffer.concat([valid, Buffer.from([0])]), badChecksum, png(5, [[1, 2, 3, 4, 5, 6], [7, 8, 9, 10, 11, 12]], 9), png(0, [[1, 2, 3]], 9)]) assert.throws(() => eastGreenwichPngPixels(body));
	assert.throws(() => eastGreenwichPngPixels(png(0, Array.from({ length: 100 }, () => [1, 2, 3, 4, 5, 6]), 9)));
});
function syntheticSvg(text: string) {
	const page = descendants(parseStateHtml(text), node => node.nodeName === "page")[1]!;
	const words = descendants(page, node => node.nodeName === "word");
	const definitions = words.map((word, index) => `<g id="glyph-${Number(attribute(word, "ymax")) - Number(attribute(word, "ymin")) >= 20 ? 0 : 1}-${index}"><path d="M 0 0 L 1 0 L 1 1 Z"/></g>`).join("");
	const uses = words.map((word, index) => {
		const large = Number(attribute(word, "ymax")) - Number(attribute(word, "ymin")) >= 20;
		return `<g fill-opacity="${large ? "0.300003" : "1"}"><use href="#glyph-${large ? 0 : 1}-${index}" x="${Number(attribute(word, "xmin")) + 1}" y="${Number(attribute(word, "ymin")) + 8}"/></g>`;
	}).join("");
	return `<svg width="648pt" height="1260pt" viewBox="0 0 648 1260"><defs>${definitions}</defs>${uses}</svg>`;
}
test("visible glyphs and extracted words reconcile without accepting unmatched text or new nontext paths", () => {
	const text = eastGreenwichFixture();
	const body = syntheticSvg(text);
	const read = inspectEastGreenwichVisualPage(text, body, 2);
	assert.equal(read.glyphCount, read.wordCount);
	assert.throws(() => inspectEastGreenwichVisualPage(text, body.replace("</svg>", "<path fill=\"rgb(100%, 100%, 100%)\" d=\"M 80 60 L 180 60 L 180 80 L 80 80 Z M 80 60\"/></svg>"), 2), /opaque text overlay/u);
	for (const changed of [body.replace("x=\"86\"", "x=\"640\""), body.replace("</svg>", "<use href=\"#glyph-1-0\" x=\"620\" y=\"600\"/></svg>"), body.replace("</svg>", "<path fill=\"rgb(0%, 0%, 0%)\" d=\"M 200 400 C 200 420 230 430 240 440 Z\"/></svg>"), body.replace("</svg>", "<image id=\"new\" x=\"0\" y=\"0\" width=\"2\" height=\"2\" href=\"https://example.invalid/candidate.png\"/></svg>"), body.slice(0, -6)]) assert.throws(() => inspectEastGreenwichVisualPage(text, changed, 2), /requires review|incomplete|matching extracted word/u);
});
test("capture proofs bind both pages, exact image pixels, placement, raw PDF, text and selection counts", () => {
	const text = eastGreenwichFixture();
	const digest = eastGreenwichFixtureHash("synthetic-pdf");
	const proof = eastGreenwichVisualFixture(text, digest);
	validateEastGreenwichVisualProof(text, proof, digest, 9);
	for (const change of [(value: typeof proof) => {
		value.pages.pop();
	}, (value: typeof proof) => {
		value.textSha256 = "a".repeat(64);
	}, (value: typeof proof) => {
		value.pages[0]!.images[0]!.sha256 = "b".repeat(64);
	}, (value: typeof proof) => {
		value.pages[0]!.images[0]!.bounds[1] = 300;
	}, (value: typeof proof) => {
		value.pages[0]!.choiceMarks++;
	}, (value: typeof proof) => {
		value.pages[1]!.images.push(value.pages[0]!.images[0]!);
	}]) {
		const changed = structuredClone(proof);
		change(changed);
		assert.throws(() => validateEastGreenwichVisualProof(text, changed, digest, 9), /requires review|changed/u);
	}
	assert.throws(() => validateEastGreenwichVisualProof(text, proof, "c".repeat(64), 9), /requires review/u);
});
