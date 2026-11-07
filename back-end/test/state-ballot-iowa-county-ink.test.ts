import assert from "node:assert/strict";
import test from "node:test";
import { iowaInkOverlaps, iowaInkShape } from "../src/state-ballot-iowa-county-ink.js";

function rectangle(left: number, top: number, right: number, bottom: number) {
	return iowaInkShape(`M ${left} ${top} L ${right} ${top} L ${right} ${bottom} L ${left} ${bottom} Z`);
}
test("Iowa ink distinguishes empty curved corners from actual fill and boundary intersections", () => {
	const circle = iowaInkShape(
		"M 15 10 C 15 12.761424 12.761424 15 10 15 C 7.238576 15 5 12.761424 5 10 C 5 7.238576 7.238576 5 10 5 C 12.761424 5 15 7.238576 15 10 Z"
	);
	assert.equal(iowaInkOverlaps(rectangle(5, 5, 5.4, 5.4), circle), false);
	assert.equal(iowaInkOverlaps(rectangle(9, 9, 11, 11), circle), true);
	assert.equal(iowaInkOverlaps(circle, rectangle(9, 9, 11, 11)), true);
	assert.equal(iowaInkOverlaps(rectangle(4.9, 9, 5.1, 11), circle), true);
	assert.equal(iowaInkOverlaps(rectangle(4, 4, 16, 16), circle), true);
});
test("opposite winding preserves glyph counters and separate subpaths", () => {
	const ring = iowaInkShape("M 0 0 L 10 0 L 10 10 L 0 10 Z M 3 3 L 3 7 L 7 7 L 7 3 Z");
	assert.equal(iowaInkOverlaps(ring, rectangle(4, 4, 6, 6)), false);
	assert.equal(iowaInkOverlaps(ring, rectangle(1, 1, 2, 2)), true);
	assert.equal(iowaInkOverlaps(ring, rectangle(2, 4, 4, 6)), true);
});
test("stroke radius, transforms and conservative flattening error bound intersections", () => {
	const line = iowaInkShape("M 0 0 L 10 0", [1, 0, 0, 1, 0, 10], false);
	assert.equal(iowaInkOverlaps(rectangle(2, 10.25, 3, 11), line, 0.3), true);
	assert.equal(iowaInkOverlaps(rectangle(2, 10.31, 3, 11), line, 0.3), false);
	assert.equal(iowaInkOverlaps(rectangle(2, 10.2999, 3, 11), line, 0.3), true);
	const translated = iowaInkShape("M 0 0 L 4 0 L 4 4 L 0 4 Z", [1, 0, 0, -1, 10, 20]);
	assert.deepEqual(translated.box, [10, 16, 14, 20]);
	assert.equal(iowaInkOverlaps(translated, rectangle(11, 17, 12, 18)), true);
	assert.equal(iowaInkOverlaps(translated, rectangle(1, 1, 2, 2)), false);
});
test("loops and reversed cubic controls retain their full ink extent", () => {
	const loop = iowaInkShape("M 0 0 C 10 0 -10 0 0 0 L 0 1 Z");
	assert(loop.box[0] < -2 && loop.box[2] > 2);
	assert.equal(iowaInkOverlaps(loop, rectangle(2, -0.01, 2.1, 0.01)), true);
});
test("malformed and excessive ink work fails closed", () => {
	for (const path of ["", "L 1 1", "M 0 0", "M 0 0 Q 1 1 2 2", `M 0 0 ${"L 1 1 ".repeat(10001)}`])
		assert.throws(() => iowaInkShape(path));
	assert.throws(() => iowaInkShape("M 0 0 L 1 1", [NaN, 0, 0, 1, 0, 0]));
	assert.throws(() => iowaInkOverlaps(rectangle(0, 0, 1, 1), rectangle(2, 2, 3, 3), -1));
});
