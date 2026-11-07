import assert from "node:assert/strict";
import test from "node:test";
import { inspectFairbanksPdfGeometry } from "../src/fairbanks-pdf-geometry.js";

function document(kind: "sample" | "notice" = "sample") {
	const media = kind === "sample" ? [0, 0, 612, 1008] : [0, 0, 792, 792];
	return { pages: [{ object: "1 0 R" }], qpdf: [{}, { "obj:1 0 R": { value: { "/Type": "/Page", "/Parent": "2 0 R" } }, "obj:2 0 R": { value: { "/Type": "/Pages", "/MediaBox": media } } }] };
}

test("Fairbanks metadata resolves inherited reviewed media and unchanged crop geometry", () => {
	for (const kind of ["sample", "notice"] as const) {
		const result = inspectFairbanksPdfGeometry(JSON.stringify(document(kind)), kind);
		assert.equal(result.pages.length, 1);
		assert.deepEqual(result.pages[0]!.cropBox, result.pages[0]!.mediaBox);
		assert.equal(result.pages[0]!.rotation, 0);
		assert.equal(result.pages[0]!.userUnit, 1);
		assert.match(result.objectsSha256, /^[a-f\d]{64}$/u);
	}
});

test("Cropped, rotated, scaled and unfamiliar Fairbanks pages remain held", () => {
	for (const [key, value] of [["/CropBox", [95, 0, 612, 1008]], ["/Rotate", 90], ["/UserUnit", 2], ["/MediaBox", [0, 0, 600, 1008]]] as const) {
		const data = document();
		Object.assign(data.qpdf[1]!["obj:2 0 R"]!.value, { [key]: value });
		assert.throws(() => inspectFairbanksPdfGeometry(JSON.stringify(data), "sample"), /geometry requires review/u);
	}
});

test("Missing, duplicate, cyclic and oversized PDF metadata cannot bypass page review", () => {
	const duplicate = document();
	duplicate.pages.push({ object: "1 0 R" });
	assert.throws(() => inspectFairbanksPdfGeometry(JSON.stringify(duplicate), "sample"), /unique page/u);
	const cyclic = document();
	Object.assign(cyclic.qpdf[1]!["obj:2 0 R"]!.value, { "/MediaBox": undefined, "/Parent": "1 0 R" });
	assert.throws(() => inspectFairbanksPdfGeometry(JSON.stringify(cyclic), "sample"), /cyclic/u);
	assert.throws(() => inspectFairbanksPdfGeometry(JSON.stringify({ pages: [], qpdf: [] }), "sample"), /inventory/u);
	assert.throws(() => inspectFairbanksPdfGeometry(" ".repeat(4 * 1024 * 1024 + 1), "sample"), /input bounds/u);
});
