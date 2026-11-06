import type { StateHtmlNode } from "./state-ballot-html.js";
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { everettSvgGlyphApprovals } from "./state-ballot-everett-glyphs.js";
import { stateHtmlAttribute as attribute, stateHtmlDescendants as descendants, parseStateHtml, stateHtmlText } from "./state-ballot-html.js";
import { orangeRuleShapes as ruleShapes } from "./state-ballot-orange-shapes.js";
import { winnebagoGlyphBounds as glyphBounds } from "./state-ballot-winnebago-visual.js";

export type EverettGlyphCatalog = Readonly<Record<string, readonly string[]>>;
interface EverettProofGlyph { left: number; top: number; ink: number[]; hash: string; color: string; clipping: number[][]; paint: number; parent: StateHtmlNode; field?: EverettProofField }
export interface EverettProofField { text: string; left: number; top: number; width: number; height: number; font: { id: string; family: string; size: string; color: string }; substantive: boolean; box: number[]; glyphs: EverettProofGlyph[] }

const hash = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");
const officeHeadings = new Set(["SENATOR IN CONGRESS", "GOVERNOR AND LIEUTENANT GOVERNOR", "ATTORNEY GENERAL", "SECRETARY OF STATE", "TREASURER", "AUDITOR", "REPRESENTATIVE IN CONGRESS", "COUNCILLOR", "SENATOR IN GENERAL COURT", "REPRESENTATIVE IN GENERAL COURT", "DISTRICT ATTORNEY", "REGISTER OF PROBATE"]);
const enclosed = (ink: number[], box: number[]) => ink[0] >= box[0] - 0.01 && ink[1] >= box[1] - 0.01 && ink[2] <= box[2] + 0.01 && ink[3] <= box[3] + 0.01;
const overlaps = (first: number[], second: number[]) => first[0] < second[2] - 0.01 && first[2] > second[0] + 0.01 && first[1] < second[3] - 0.01 && first[3] > second[1] + 0.01;
const attributes = (node: StateHtmlNode, allowed: string[]) => assert(!node.attrs?.some(field => !allowed.includes(field.name)), `unexpected ${node.nodeName} attribute`);
const colors = ["rgb(0%, 0%, 0%)", "rgb(13.729858%, 12.159729%, 12.548828%)", "rgb(100%, 100%, 100%)"];
function color(value: string) {
	const match = /^rgb\((\d+(?:\.\d+)?)%, (\d+(?:\.\d+)?)%, (\d+(?:\.\d+)?)%\)$/u.exec(value);
	assert(match && match.slice(1).every(value => Number(value) <= 100), "invalid color");
	return match.slice(1).map(value => Number(value) * 2.55);
}
function contrast(first: number[], second: number[]) {
	const luminance = (values: number[]) => values.map(value => value / 255).map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
	const values = [luminance(first), luminance(second)].sort((first, second) => first - second);
	return (values[1] + 0.05) / (values[0] + 0.05);
}
export function parseEverettNativeTree(body: string) {
	assert(Buffer.byteLength(body) <= 4 * 1024 * 1024, "document byte bounds");
	const tree = parseStateHtml(body);
	const pending = [{ node: tree, depth: 0 }];
	let nodes = 0;
	while (pending.length) {
		const { node, depth } = pending.pop()!;
		assert(++nodes <= 60000 && depth <= 48, "document tree bounds");
		for (const child of node.childNodes ?? []) pending.push({ node: child, depth: depth + 1 });
	}
	return tree;
}

export function everettProofFields(body: string): EverettProofField[] {
	const tree = parseEverettNativeTree(body);
	const page = descendants(tree, node => node.nodeName === "page")[0];
	assert(page && attribute(page, "width") === "918" && attribute(page, "height") === "1944", "native page dimensions");
	const fontNodes = descendants(page, node => node.nodeName === "fontspec");
	const fonts = new Map(fontNodes.map(node => [attribute(node, "id"), { id: attribute(node, "id"), family: attribute(node, "family"), color: attribute(node, "color"), size: attribute(node, "size") }]));
	assert(fonts.size === fontNodes.length, "native font identity");
	return descendants(page, node => node.nodeName === "text").map((node) => {
		const font = fonts.get(attribute(node, "font"));
		assert(font, "native font reference");
		const field = { text: stateHtmlText(node).replace(/\s+/gu, " ").trim(), left: Number(attribute(node, "left")), top: Number(attribute(node, "top")), width: Number(attribute(node, "width")), height: Number(attribute(node, "height")), font };
		assert([field.left, field.top, field.width, field.height].every(Number.isFinite), "native field geometry");
		assert(field.left >= 0 && field.top >= 0 && field.width >= 0 && field.height > 0 && field.left + field.width <= 919 && field.top + field.height <= 1945, "native field bounds");
		return field;
	}).filter(field => field.text && (
		(field.font.color === "#000000" && field.left < 585 && field.top >= 410 && field.top < 1840)
		|| (field.font.color === "#000000" && field.text === "EVERETT")
		|| (field.font.color === "#000000" && /^WDS?\./u.test(field.text))
		|| (field.font.family.endsWith("+HelveticaNeueLTStd-Bd") && field.text.startsWith("Tuesday,"))
		|| (field.font.family.endsWith("+HelveticaNeueLTStd-Bd") && /^Card No\./u.test(field.text))
		|| (field.font.family.endsWith("+HelveticaNeueLTStd-Bd") && field.text === "STATE ELECTION")
	)).map(field => ({ ...field, substantive: field.top < 410 || officeHeadings.has(field.text) || (field.font.family === "HelveticaLTStd" && field.font.size === "13") || /(?:DISTRICT|COUNTY)$/u.test(field.text) || (field.font.family === "HelveticaLTStd-LightCond" && field.text.includes("/")) || field.text.includes("Candidate for Re-election") || field.text === "Vote for not more than ONE", box: [field.left / 1.5, field.top / 1.5, (field.left + field.width) / 1.5, (field.top + field.height) / 1.5], glyphs: [] as EverettProofGlyph[] }));
}

export function inspectEverettVisual(xml: string, svg: string, approvals: EverettGlyphCatalog = everettSvgGlyphApprovals) {
	assert(svg.trimEnd().endsWith("</svg>"), "complete rendered document");
	const tree = parseEverettNativeTree(svg);
	const roots = descendants(tree, node => node.nodeName === "svg");
	assert(roots.length === 1, "rendered page inventory");
	const document = roots[0];
	assert(attribute(document, "width") === "612pt" && attribute(document, "height") === "1296pt" && attribute(document, "viewBox") === "0 0 612 1296", "rendered dimensions");
	const identified = descendants(document, node => Boolean(attribute(node, "id")));
	assert(new Set(identified.map(node => attribute(node, "id"))).size === identified.length, "rendered identity inventory");
	const definitions = new Map(identified.filter(node => /^glyph-\d+-\d+$/u.test(attribute(node, "id"))).map((node) => {
		attributes(node, ["id"]);
		const paths = descendants(node, child => child.nodeName === "path");
		assert(node.nodeName === "g" && paths.length <= 1 && descendants(node, child => !["#text", "path"].includes(child.nodeName)).length === 0, "glyph definition structure");
		paths.forEach(path => attributes(path, ["d"]));
		const path = paths[0] ? attribute(paths[0], "d") : "";
		return [attribute(node, "id"), { hash: hash(path), bounds: path.trim() ? glyphBounds(path) : [0, 0, 0, 0] }];
	}));
	const clips = new Map(identified.filter(node => node.nodeName.toLowerCase() === "clippath").map((node) => {
		attributes(node, ["id"]);
		const paths = descendants(node, child => child.nodeName === "path");
		assert(paths.length === 1 && descendants(node, child => !["#text", "path"].includes(child.nodeName)).length === 0, "clip structure");
		attributes(paths[0], ["d", "clip-rule"]);
		const shapes = ruleShapes(attribute(paths[0], "d"));
		assert(shapes.length === 1 && shapes[0].closed, "clip rectangle");
		return [attribute(node, "id"), shapes[0].box];
	}));
	const auxiliary = identified.filter(node => !definitions.has(attribute(node, "id")) && !clips.has(attribute(node, "id")));
	if (auxiliary.length) {
		assert.deepEqual(auxiliary.map(node => [node.nodeName, attribute(node, "id")]), [["filter", "filter-remove-color"], ["filter", "filter-color-to-alpha"], ["image", "source-5"], ["mask", "mask-0"]], "auxiliary inventory");
		for (const [index, filter] of auxiliary.slice(0, 2).entries()) {
			attributes(filter, ["id", "x", "y", "width", "height"]);
			assert(attribute(filter, "x") === "0%" && attribute(filter, "y") === "0%" && attribute(filter, "width") === "100%" && attribute(filter, "height") === "100%", "filter bounds");
			const children = (filter.childNodes ?? []).filter(node => node.nodeName !== "#text");
			assert(children.length === 1 && children[0].nodeName === "feColorMatrix", "filter structure");
			attributes(children[0], ["color-interpolation-filters", "values"]);
			assert((children[0].childNodes ?? []).every(child => child.nodeName === "#text" && !child.value?.trim()), "filter child structure");
			assert.equal(attribute(children[0], "color-interpolation-filters"), "sRGB");
			assert.equal(attribute(children[0], "values"), index === 0 ? "0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 1 0" : "0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0.2126 0.7152 0.0722 0 0");
		}
		const image = auxiliary[2];
		attributes(image, ["id", "x", "y", "width", "height", "href"]);
		const encoded = /^data:image\/png;base64,([A-Za-z0-9+/]*={0,2})$/u.exec(attribute(image, "href"));
		assert(encoded && attribute(image, "x") === "0" && attribute(image, "y") === "0" && attribute(image, "width") === "3600" && attribute(image, "height") === "864" && hash(Buffer.from(encoded[1], "base64")) === "2232ba3aa7422b367d98f1f64ed72a5a1e83dd4cda20ccd2dad02c86b674d83b", "signature image");
		const mask = auxiliary[3];
		attributes(mask, ["id"]);
		const maskGroup = (mask.childNodes ?? []).filter(node => node.nodeName !== "#text");
		assert(maskGroup.length === 1 && maskGroup[0].nodeName === "g", "signature mask");
		attributes(maskGroup[0], ["filter"]);
		assert.equal(attribute(maskGroup[0], "filter"), "url(#filter-remove-color)");
		const maskUse = (maskGroup[0].childNodes ?? []).filter(node => node.nodeName !== "#text");
		assert(maskUse.length === 1 && maskUse[0].nodeName === "use", "signature mask use");
		attributes(maskUse[0], ["href", "filter", "transform"]);
		assert.equal(attribute(maskUse[0], "href"), "#source-5");
		assert.equal(attribute(maskUse[0], "filter"), "url(#filter-color-to-alpha)");
		assert.equal(attribute(maskUse[0], "transform"), "matrix(0.0344147, 0, 0, 0.0344147, 439.854023, 137.385119)");
	}
	const fields = everettProofFields(xml);
	assert(fields.length > 0 && fields.length <= 1000, "proof field bounds");
	const pending: { node: StateHtmlNode; clipping: number[][]; color: string; parent?: StateHtmlNode; mask: boolean }[] = [{ node: document, clipping: [[0, 0, 612, 1296]], color: colors[0], mask: false }];
	const glyphs: EverettProofGlyph[] = [];
	const paints: { box: number[]; color: number[]; clipping: number[][]; paint: number; stroke: boolean }[] = [];
	let paint = 0;
	while (pending.length) {
		const item = pending.pop()!;
		const node = item.node;
		const tag = node.nodeName;
		if (tag === "defs") {
			attributes(node, []);
			const children = (node.childNodes ?? []).flatMap(child => child.nodeName === "g" && !child.attrs?.length ? child.childNodes ?? [] : [child]);
			assert(children.every(child => child.nodeName === "#text" || identified.includes(child)), "definition inventory");
			continue;
		}
		assert(["svg", "g", "use", "path", "rect", "#text"].includes(tag), "paint structure");
		if (tag === "#text") {
			assert(!node.value?.trim(), "unassigned visible text");
			continue;
		}
		assert(!attribute(node, "fill-opacity") || attribute(node, "fill-opacity") === "1", "paint opacity");
		const clipping = [...item.clipping];
		const reference = attribute(node, "clip-path");
		if (reference) {
			assert(tag === "g" && /^url\(#clip-\d+\)$/u.test(reference) && clips.has(reference.slice(5, -1)) && clipping.length < 8, "clip reference");
			clipping.push(clips.get(reference.slice(5, -1))!);
		}
		const fill = attribute(node, "fill") || item.color;
		if (tag === "svg") attributes(node, ["xmlns", "xlink", "width", "height", "viewBox"]);
		if (tag === "g") {
			attributes(node, ["fill", "fill-opacity", "clip-path", "mask"]);
			assert(fill !== "none", "hidden text");
			color(fill);
			if (attribute(node, "mask")) {
				assert(auxiliary.length === 4 && attribute(node, "mask") === "url(#mask-0)" && (node.childNodes ?? []).filter(child => child.nodeName !== "#text").every(child => child.nodeName === "rect"), "masked paint");
			}
		}
		if (tag === "use") {
			attributes(node, ["href", "x", "y"]);
			const definition = definitions.get(attribute(node, "href").slice(1));
			assert(definition && item.parent?.nodeName === "g", "glyph reference");
			const left = Number(attribute(node, "x"));
			const top = Number(attribute(node, "y"));
			assert(Number.isFinite(left) && Number.isFinite(top) && Math.abs(left) <= 2000 && Math.abs(top) <= 2000, "glyph bounds");
			if (definition.bounds[2] > definition.bounds[0] && definition.bounds[3] > definition.bounds[1]) glyphs.push({ left, top, ink: definition.bounds.map((value, coordinate) => value + (coordinate % 2 ? top : left)), hash: definition.hash, color: fill, clipping, paint: ++paint, parent: item.parent });
		}
		if (tag === "path") {
			const stroke = fill === "none";
			attributes(node, stroke ? ["fill", "stroke-width", "stroke-linecap", "stroke-linejoin", "stroke", "stroke-opacity", "stroke-miterlimit", "d", "transform"] : ["fill", "fill-rule", "fill-opacity", "d"]);
			const box = glyphBounds(attribute(node, "d"));
			let width = 0;
			if (stroke) {
				assert(attribute(node, "stroke-opacity") === "1" && attribute(node, "stroke-linecap") === "butt" && attribute(node, "stroke-linejoin") === "miter", "stroke attributes");
				assert(["4", "10"].includes(attribute(node, "stroke-miterlimit")), "stroke miter limit");
				const transform = /^matrix\(([\d.]+), 0, 0, (-[\d.]+), ([\d.]+), ([\d.]+)\)$/u.exec(attribute(node, "transform"));
				assert(transform, "stroke transform");
				const [horizontal, vertical, left, top] = transform.slice(1).map(Number);
				assert(horizontal > 0 && horizontal <= 2 && vertical < 0 && vertical >= -2 && Math.abs(left) <= 2000 && Math.abs(top) <= 2000, "stroke transform bounds");
				const translated = [box[0] * horizontal + left, box[3] * vertical + top, box[2] * horizontal + left, box[1] * vertical + top];
				box.splice(0, 4, ...translated);
				width = Number(attribute(node, "stroke-width")) * Math.max(horizontal, -vertical);
				assert(width > 0 && width <= 3, "stroke width");
				const commands = attribute(node, "d").match(/[MLCZ]/gu) ?? [];
				if (commands.length > 2) width *= Number(attribute(node, "stroke-miterlimit"));
			}
			else {
				assert(attribute(node, "fill-rule") === "nonzero", "fill rule");
			}
			paints.push({ box: box.map((value, coordinate) => value + (coordinate < 2 ? -width / 2 : width / 2)), color: color(stroke ? attribute(node, "stroke") : fill), clipping, paint: ++paint, stroke });
		}
		if (tag === "rect") {
			attributes(node, ["x", "y", "width", "height", "fill", "fill-opacity"]);
			assert(item.mask && attribute(node, "x") === "-61.2" && attribute(node, "y") === "-129.6" && attribute(node, "width") === "734.4" && attribute(node, "height") === "1555.2", "masked rectangle");
			paints.push({ box: [439.854023, 137.385119, 563.746943, 167.1199], color: color(fill), clipping, paint: ++paint, stroke: false });
		}
		for (const child of [...node.childNodes ?? []].reverse()) pending.push({ node: child, clipping, color: fill, parent: node, mask: item.mask || Boolean(attribute(node, "mask")) });
	}
	const groups: { parent: StateHtmlNode; top: number; glyphs: EverettProofGlyph[] }[] = [];
	for (const glyph of glyphs) {
		let group = groups.find(group => group.parent === glyph.parent && Math.abs(group.top - glyph.top) < 0.01);
		if (!group) {
			group = { parent: glyph.parent, top: glyph.top, glyphs: [] };
			groups.push(group);
		}
		group.glyphs.push(glyph);
	}
	for (const group of groups) {
		const left = Math.min(...group.glyphs.map(glyph => glyph.left));
		const right = Math.max(...group.glyphs.map(glyph => glyph.ink[2]));
		const center = (Math.min(...group.glyphs.map(glyph => glyph.ink[1])) + Math.max(...group.glyphs.map(glyph => glyph.ink[3]))) / 2;
		const matches = fields.filter(field => center >= field.box[1] && center <= field.box[3] && left >= field.box[0] - 1 && right < field.box[2] + 1 && group.top >= field.box[1] - 1 && group.top < field.box[3] + 1).sort((first, second) => Math.abs(first.box[0] - left) - Math.abs(second.box[0] - left));
		if (matches.length) {
			assert(matches.length === 1 || Math.abs(matches[0].box[0] - left) !== Math.abs(matches[1].box[0] - left), "ambiguous glyph assignment");
			matches[0].glyphs.push(...group.glyphs);
			for (const glyph of group.glyphs) glyph.field = matches[0];
		}
		else {
			assert(!(left >= 45 && left < 373 && group.top >= 275 && group.top < 1226), "unexpected candidate-area glyph");
		}
	}
	let selectedGlyphs = 0;
	let substantiveGlyphs = 0;
	for (const field of fields) {
		field.glyphs.sort((first, second) => first.left - second.left);
		const characters = [...field.text.replace(/\s/gu, "")];
		assert.equal(field.glyphs.length, characters.length, "field glyph inventory");
		for (const [position, glyph] of field.glyphs.entries()) {
			assert(approvals[characters[position]]?.includes(glyph.hash), "unapproved glyph shape");
			assert.equal(glyph.color, field.font.color === "#000000" ? colors[0] : colors[1], "native/rendered color");
			selectedGlyphs++;
			if (!field.substantive) continue;
			assert(glyph.clipping.every(box => enclosed(glyph.ink, box)), "substantive clipping");
			const intersecting = paints.filter(paint => overlaps(paint.box, glyph.ink) && paint.clipping.every(box => overlaps(box, glyph.ink)));
			assert(!intersecting.some(paint => paint.paint > glyph.paint), `substantive occlusion: ${JSON.stringify({ field: [field.left, field.top, field.font.family], glyph: glyph.ink, paint: glyph.paint, covering: intersecting.filter(paint => paint.paint > glyph.paint).map(paint => ({ box: paint.box, paint: paint.paint, stroke: paint.stroke })) })}`);
			assert(!glyphs.some(other => other.field !== field && overlaps(other.ink, glyph.ink) && other.clipping.every(box => overlaps(box, glyph.ink))), "unassigned text occlusion");
			const background = intersecting.filter(paint => !paint.stroke && enclosed(glyph.ink, paint.box) && paint.clipping.every(box => enclosed(glyph.ink, box))).sort((first, second) => second.paint - first.paint)[0];
			assert(contrast(color(glyph.color), background?.color ?? [255, 255, 255]) >= 4.5, "substantive contrast");
			assert(intersecting.every(paint => paint.paint <= (background?.paint ?? 0) || contrast(color(glyph.color), paint.color) >= 4.5), "partial background contrast");
			substantiveGlyphs++;
		}
	}
	return { svgSha256: hash(svg), fields: fields.length, selectedGlyphs, substantiveFields: fields.filter(field => field.substantive).length, substantiveGlyphs, clippingChecksPassed: true, paintChecksPassed: true };
}
