import assert from "node:assert/strict";
import test from "node:test";
import { inspectFairbanksSelectionMarks } from "../src/fairbanks-ballot-marks.js";

const oval = "<path fill=\"none\" stroke=\"rgb(0%,0%,0%)\" stroke-width=\"0.6\" d=\"M 5 0 C 5 2.25 2.75 4 0 4 C -2.75 4 -5 2.25 -5 0 C -5 -2.25 -2.75 -4 0 -4 C 2.75 -4 5 -2.25 5 0\" transform=\"matrix(1,0,0,-1,90,264)\"/>";
const wrap = (body: string) => `<svg width="612pt" height="1008pt" viewBox="0 0 612 1008">${body}</svg>`;

test("Fairbanks rendered selection inventory identifies visible closed ovals", () => {
	assert.deepEqual(inspectFairbanksSelectionMarks(wrap(oval), 612, 1008), [{ left: 85, top: 260, right: 95, bottom: 268 }]);
	const clipped = `<defs><clipPath id="clip"><path d="M 80 255 L 100 255 L 100 275 L 80 275 Z"/></clipPath></defs><g clip-path="url(#clip)">${oval}</g>`;
	assert.equal(inspectFairbanksSelectionMarks(wrap(clipped), 612, 1008).length, 1);
});

test("Clipping, transparency, masks and low-contrast selection marks require review", () => {
	for (const attribute of ["opacity=\"0\"", "mask=\"url(#mask)\"", "filter=\"url(#filter)\"", "style=\"display:none\"", "display=\"none\"", "visibility=\"hidden\""]) {
		for (const body of [oval.replace("<path ", `<path ${attribute} `), `<g ${attribute}>${oval}</g>`]) assert.throws(() => inspectFairbanksSelectionMarks(wrap(body), 612, 1008), /visibility/u);
	}
	for (const color of ["rgb(100%,100%,100%)", "rgb(90%,90%,90%)", "transparent"]) assert.throws(() => inspectFairbanksSelectionMarks(wrap(oval.replace("rgb(0%,0%,0%)", color)), 612, 1008), /stroke/u);
	const clipped = `<defs><clipPath id="clip"><path d="M 89 255 L 100 255 L 100 275 L 89 275 Z"/></clipPath></defs><g clip-path="url(#clip)">${oval}</g>`;
	assert.throws(() => inspectFairbanksSelectionMarks(wrap(clipped), 612, 1008), /clipped selection/u);
});

test("Later paint, duplicate clip identities and changed rendered dimensions remain held", () => {
	assert.throws(() => inspectFairbanksSelectionMarks(wrap(`${oval}<path fill="white" d="M 80 255 L 100 255 L 100 275 L 80 275 Z"/>`), 612, 1008), /later paint/u);
	assert.throws(() => inspectFairbanksSelectionMarks(wrap(`<g id="same"/><g id="same"/>${oval}`), 612, 1008), /unique identifiers/u);
	assert.throws(() => inspectFairbanksSelectionMarks(wrap(oval), 792, 792), /dimensions/u);
	assert.throws(() => inspectFairbanksSelectionMarks(wrap(oval.replace("5 0 C 5", "4 0 C 5")), 612, 1008), /closed oval/u);
});
