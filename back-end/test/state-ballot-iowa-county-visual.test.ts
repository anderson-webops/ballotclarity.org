import type { IowaSampleCounty } from "../src/state-ballot-iowa-county-native.js";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { iowaSvgGlyphApprovals } from "../src/state-ballot-iowa-county-glyphs.js";
import { inspectIowaSampleSvg } from "../src/state-ballot-iowa-county-visual.js";

const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const outline = "M 0 0 L 4 0 L 4 -6 L 0 -6 Z";
const alternative = "M 0 0 L 4 0 L 4 -5 L 0 -5 Z";
const approvals = { [hash(outline)]: "A", [hash(alternative)]: "B" };
function fixture(county: IowaSampleCounty = "Woodbury") {
	const cropBox = county === "Monona" ? [18.573, 66.596, 593.28, 974.929] : [0, 0, 612, 1008];
	const geometry = { mediaBox: [0, 0, 612, 1008], cropBox, rotation: 0, userUnit: 1 };
	const offsetY = 1008 - cropBox[3]!;
	const width = cropBox[2]! - cropBox[0]!;
	const height = cropBox[3]! - cropBox[1]!;
	const word = `<word xmin="${50 + cropBox[0]!}" ymin="${94 + offsetY}" xmax="${54 + cropBox[0]!}" ymax="${100 + offsetY}">A</word>`;
	const bbox = `<doc><page>${word}</page><page>${word}</page></doc>`;
	const use = "<use href=\"#glyph-0-0\" x=\"50\" y=\"100\"/>";
	const definitions = `<g id="glyph-0-0"><path d="${outline}"/></g>`;
	const svg = `<svg width="${width}pt" height="${height}pt" viewBox="0 0 ${width} ${height}"><defs>${definitions}</defs>${use}</svg>`;
	const inspect = (body = svg, text = bbox) => inspectIowaSampleSvg(text, body, geometry, county, 1, approvals);
	return { svg, bbox, use, geometry, inspect };
}
const fill = (value: number) => `rgb(${value}%, ${value}%, ${value}%)`;
function cover(color: string, top = 93, bottom = 101) {
	return `<path fill="${color}" d="M 49 ${top} L 55 ${top} L 55 ${bottom} L 49 ${bottom} Z"/>`;
}
function withDefinitions(body: string, definitions: string) {
	return body.replace("</defs>", `${definitions}</defs>`);
}

test("Iowa glyph approvals have unique SHA-256 identities and bounded literal sequences", () => {
	assert.equal(Object.keys(iowaSvgGlyphApprovals).length, 614);
	for (const [digest, value] of Object.entries(iowaSvgGlyphApprovals)) {
		assert.match(digest, /^[a-f\d]{64}$/u);
		assert.match(value, /^(?:[\x21-\x7E]|fi)$/u);
	}
});
test("Iowa appearance proof binds visible characters, native geometry and exact input hashes", () => {
	for (const county of ["Monona", "Woodbury"] as const) {
		const sample = fixture(county);
		const proof = sample.inspect();
		assert.equal(proof.words, 1);
		assert.equal(proof.characters, 1);
		assert.equal(proof.glyphs, 1);
		assert.equal(proof.minimumContrast, 21);
		assert.equal(proof.svgSha256, hash(sample.svg));
		assert.equal(proof.bboxSha256, hash(sample.bbox));
		assert.equal(proof.geometrySha256, hash(JSON.stringify(sample.geometry)));
	}
});
test("changed, unknown, duplicate, displaced and missing characters fail closed", () => {
	const sample = fixture();
	for (const changed of [
		sample.svg.replace(outline, alternative),
		sample.svg.replace(outline, `${outline} M 1 1`),
		sample.svg.replace(sample.use, sample.use + sample.use),
		sample.svg.replace("x=\"50\"", "x=\"500\""),
		sample.svg.replace(sample.use, "")
	])
		assert.throws(() => sample.inspect(changed), /character identity/u);
	assert.throws(() => sample.inspect(sample.svg, sample.bbox.replaceAll(">A<", ">B<")), /character identity/u);
});
test("ordinary opaque, translucent and hidden parent paint cannot suppress text", () => {
	const sample = fixture();
	for (const attributes of [
		"opacity=\"0\"",
		"fill-opacity=\"0\"",
		"fill-opacity=\"0.9\"",
		"display=\"none\"",
		"visibility=\"hidden\"",
		"style=\"opacity:0\"",
		"fill=\"none\"",
		`fill="${fill(100)}"`
	])
		assert.throws(() => sample.inspect(sample.svg.replace(sample.use, `<g ${attributes}>${sample.use}</g>`)));
});
test("later white and black covers fail even when native text and glyph placement remain unchanged", () => {
	const sample = fixture();
	for (const color of [fill(0), fill(100)])
		assert.throws(() => sample.inspect(sample.svg.replace("</svg>", `${cover(color)}</svg>`)), /occlusion/u);
	assert.throws(
		() =>
			sample.inspect(
				sample.svg.replace("</svg>", `${cover(fill(100)).replace("<path ", "<path fill-opacity=\"0\" ")}</svg>`)
			),
		/paint effects/u
	);
});
test("background contrast and later partial covers are enforced", () => {
	const sample = fixture();
	assert.equal(sample.inspect(sample.svg.replace(sample.use, cover(fill(100)) + sample.use)).minimumContrast, 21);
	assert.throws(() => sample.inspect(sample.svg.replace(sample.use, cover(fill(0)) + sample.use)), /contrast/u);
	assert.throws(
		() => sample.inspect(sample.svg.replace("</svg>", `${cover(fill(100), 94, 95)}</svg>`)),
		/occlusion/u
	);
});
test("a rectangular clip enclosing the complete glyph is accepted", () => {
	const sample = fixture();
	const svg = withDefinitions(
		sample.svg,
		"<clipPath id=\"clip-0\"><path d=\"M 49 93 L 55 93 L 55 101 L 49 101 Z M 49 93\"/></clipPath>"
	).replace(sample.use, `<g clip-path="url(#clip-0)">${sample.use}</g>`);
	assert.equal(sample.inspect(svg).words, 1);
});
test("empty, partial, triangular and cancelling compound clips are refused", () => {
	const sample = fixture();
	for (const path of [
		"M 0 0 L 1 0 L 1 1 L 0 1 Z",
		"M 50 94 L 53 94 L 53 100 L 50 100 Z",
		"M 49 93 L 55 93 L 55 101 Z",
		"M 49 93 L 55 93 L 55 101 L 49 101 Z M 49 93 L 49 101 L 55 101 L 55 93 Z"
	]) {
		const svg = withDefinitions(sample.svg, `<clipPath id="clip-0"><path d="${path}"/></clipPath>`).replace(
			sample.use,
			`<g clip-path="url(#clip-0)">${sample.use}</g>`
		);
		assert.throws(() => sample.inspect(svg), /clipping/u);
	}
});
test("earlier grey watermark paint retains contrast and later watermark covers are refused", () => {
	const sample = fixture();
	const watermark = "<g fill=\"rgb(82.745098%, 82.745098%, 82.745098%)\"><use href=\"#glyph-1-0\" x=\"49\" y=\"110\"/></g>";
	const svg = withDefinitions(sample.svg, "<g id=\"glyph-1-0\"><path d=\"M 0 0 L 20 0 L 20 -30 L 0 -30 Z\"/></g>");
	assert(sample.inspect(svg.replace(sample.use, watermark + sample.use)).minimumContrast >= 4.5);
	assert.throws(() => sample.inspect(svg.replace("</svg>", `${watermark}</svg>`)), /occlusion/u);
});
test("nested references are bounded and cyclic, foreign and missing references are refused", () => {
	const sample = fixture();
	const nested = withDefinitions(sample.svg, `<g id="source-0">${sample.use}</g>`).replace(
		`</defs>${sample.use}`,
		"</defs><use href=\"#source-0\"/>"
	);
	assert.equal(sample.inspect(nested).words, 1);
	for (const target of ["#absent", "https://example.test/glyph", "#source-0"]) {
		const body = withDefinitions(sample.svg, `<g id="source-0"><use href="${target}"/></g>`).replace(
			`</defs>${sample.use}`,
			"</defs><use href=\"#source-0\"/>"
		);
		assert.throws(() => sample.inspect(body));
	}
});
test("unverified geometry, transforms, filters, masks, images and identifiers are refused", () => {
	const sample = fixture();
	for (const changed of [
		sample.svg.replace("612pt", "613pt"),
		sample.svg.replace("0 0 612 1008", "1 0 612 1008"),
		sample.svg.replace(sample.use, sample.use.replace("/>", " transform=\"matrix(1,0,0,1,2,0)\"/>")),
		sample.svg.replace(sample.use, `<g filter="url(#glyph-0-0)">${sample.use}</g>`),
		sample.svg.replace(sample.use, `<g mask="url(#absent)">${sample.use}</g>`),
		withDefinitions(sample.svg, "<g id=\"glyph-0-0\"/>"),
		sample.svg.replace("</svg>", "<image width=\"1\" height=\"1\" href=\"data:image/png;base64,iVBORw0KGgo=\"/></svg>")
	])
		assert.throws(() => sample.inspect(changed));
});
test("native page inventory and input bounds are required", () => {
	const sample = fixture();
	assert.throws(() => sample.inspect(sample.svg, "<doc/>"));
	assert.throws(() => sample.inspect(" ".repeat(4 * 1024 * 1024) + sample.svg));
	assert.throws(() =>
		inspectIowaSampleSvg(sample.bbox, sample.svg, { ...sample.geometry, rotation: 90 }, "Woodbury", 1, approvals)
	);
	assert.throws(() => inspectIowaSampleSvg(sample.bbox, sample.svg, sample.geometry, "Woodbury", 3, approvals));
	assert.throws(
		() => sample.inspect(sample.svg.replace(sample.use, "<g>".repeat(40) + sample.use + "</g>".repeat(40))),
		/DOM bounds/u
	);
	assert.throws(() => sample.inspect(sample.svg, "<g>".repeat(40) + sample.bbox + "</g>".repeat(40)), /DOM bounds/u);
});
test("Monona's reviewed translucent red watermark preserves contrast without allowing arbitrary mask paint", () => {
	const sample = fixture("Monona");
	const definitions
		= "<filter id=\"filter-remove-color\" x=\"0%\" y=\"0%\" width=\"100%\" height=\"100%\"><feColorMatrix color-interpolation-filters=\"sRGB\" values=\"0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 1 0\"/></filter><mask id=\"mask-0\"><g filter=\"url(#filter-remove-color)\"><rect x=\"0\" y=\"0\" width=\"575\" height=\"909\" fill=\"rgb(0%, 0%, 0%)\" fill-opacity=\"0.23\"/></g></mask><g id=\"glyph-1-0\"><path d=\"M 0 0 L 20 0 L 20 -30 L 0 -30 Z\"/></g>";
	const watermark
		= "<g mask=\"url(#mask-0)\" fill=\"rgb(69.019608%, 0%, 0%)\"><use href=\"#glyph-1-0\" x=\"49\" y=\"110\"/></g>";
	const svg = withDefinitions(sample.svg, definitions).replace("</svg>", `${watermark}</svg>`);
	const proof = sample.inspect(svg);
	assert.equal(proof.watermarkLayers, 1);
	assert(proof.minimumContrast >= 4.5);
	for (const changed of [
		svg.replace("0.23", "1"),
		svg.replace(watermark, watermark + watermark),
		svg.replace("<use href=\"#glyph-1-0\" x=\"49\" y=\"110\"/>", cover(fill(100))),
		svg.replace("0 0 0 0 1 0 0 0 0 1", "0 0 0 0 0 0 0 0 0 1")
	])
		assert.throws(() => sample.inspect(changed));
	assert.throws(
		() =>
			sample.inspect(
				withDefinitions(sample.svg, definitions).replace(sample.use, `<g mask="url(#mask-0)">${sample.use}</g>`)
			),
		/watermark paint/u
	);
});
test("bounded header images are separated from text and never become invisible text covers", () => {
	const sample = fixture();
	const data = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==";
	const image = `<image x="300" y="300" width="1" height="1" href="data:image/png;base64,${data}"/>`;
	assert.equal(sample.inspect(sample.svg.replace("</svg>", `${image}</svg>`)).images, 1);
	for (const changed of [
		image.replace("x=\"300\" y=\"300\"", "x=\"50\" y=\"94\""),
		image.replace("width=\"1\"", "width=\"2\""),
		image.repeat(5)
	])
		assert.throws(() => sample.inspect(sample.svg.replace("</svg>", `${changed}</svg>`)));
});
