import type { StateHtmlNode } from "./state-ballot-html.js";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { goffstownDecorationApprovals, goffstownGlyphApprovals, goffstownOvalApprovals } from "./state-ballot-goffstown-visual-approvals.js";
import { stateHtmlAttribute as attribute, stateHtmlDescendants as descendants, parseStateHtml, stateHtmlText } from "./state-ballot-html.js";
import { winnebagoGlyphBounds } from "./state-ballot-winnebago-visual.js";
import { containsControlCharacters } from "./text-validation.js";

export interface GoffstownField { text: string; left: number; top: number; width: number; height: number; size: number; family: string; color: string }
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
function reject(): never {
	throw new Error("The Goffstown native/visible ballot requires review.");
}
function bounded(body: string) {
	if (Buffer.byteLength(body) > 4 * 1024 * 1024 || body.includes("\uFFFD") || containsControlCharacters(body.replace(/[\r\n\t]/gu, "")) || /<!ENTITY|<!DOCTYPE[^>]*\[|<(?:script|style|image|img|iframe|object|foreignObject|animate|set)\b/iu.test(body)) return reject();
	const document = parseStateHtml(body);
	const pending = [{ node: document, depth: 0 }];
	let count = 0;
	while (pending.length) {
		const item = pending.pop()!;
		if (++count > 80000 || item.depth > 64) return reject();
		for (const node of item.node.childNodes ?? []) pending.push({ node, depth: item.depth + 1 });
	}
	return document;
}
export function goffstownNativePages(body: string): GoffstownField[][] {
	if (!/^<\?xml[^>]+>\s*<!DOCTYPE pdf2xml SYSTEM "pdf2xml.dtd">/u.test(body) || !/<\/pdf2xml>\s*$/u.test(body)) return reject();
	const document = bounded(body);
	const pages = descendants(document, node => node.nodeName === "page");
	if (pages.length !== 2) return reject();
	const fonts = new Map<string, { size: number; family: string; color: string }>();
	return pages.map((page, index) => {
		if (attribute(page, "number") !== String(index + 1) || attribute(page, "width") !== "918" || attribute(page, "height") !== "1512") return reject();
		for (const node of descendants(page, node => node.nodeName === "fontspec")) {
			const id = attribute(node, "id");
			const family = attribute(node, "family");
			const size = Number(attribute(node, "size"));
			const color = attribute(node, "color");
			if (!/^\d{1,3}$/u.test(id) || fonts.has(id) || !/^[A-Z]{6}\+Helvetica(?:NeueLTStd-BdCn|-Condensed)$/u.test(family) || !Number.isFinite(size) || size < 8 || size > 45 || !["#000000", "#ffffff"].includes(color)) return reject();
			fonts.set(id, { family: family.slice(7), size, color });
		}
		const fields = descendants(page, node => node.nodeName === "text").map((node): GoffstownField => {
			const font = fonts.get(attribute(node, "font"));
			if (!font || descendants(node, child => !["#text", "b", "i"].includes(child.nodeName)).length) return reject();
			const field = { text: stateHtmlText(node).replace(/\s+/gu, " ").trim(), left: Number(attribute(node, "left")), top: Number(attribute(node, "top")), width: Number(attribute(node, "width")), height: Number(attribute(node, "height")), ...font };
			if ([field.left, field.top, field.width, field.height].some(value => !Number.isFinite(value)) || field.left < 0 || field.top < 0 || field.width <= 0 || field.height <= 0 || field.left + field.width > 919 || field.top + field.height > 1513 || field.text.length > 1500) return reject();
			return field;
		}).filter(field => field.text).sort((first, second) => first.top - second.top || first.left - second.left);
		if (fields.length < 10 || fields.length > 2000) return reject();
		return fields;
	});
}
function canonical(node: StateHtmlNode): unknown {
	return { tag: node.nodeName, attributes: (node.attrs ?? []).map(item => [item.name, item.value]).sort((first, second) => first[0]!.localeCompare(second[0]!)), children: (node.childNodes ?? []).filter(child => child.nodeName !== "#text").map(canonical) };
}
interface Glyph { left: number; top: number; sha256: string; ink: number[] }
export function goffstownBallotOval(node: StateHtmlNode) {
	if (node.nodeName !== "path" || attribute(node, "fill") !== "none" || attribute(node, "transform") !== "matrix(0.1, 0, 0, -0.1, 0, 1008)") return null;
	const expected = { "fill": "none", "stroke-width": "7.5", "stroke-linecap": "butt", "stroke-linejoin": "miter", "stroke": "rgb(0%, 0%, 0%)", "stroke-opacity": "1", "stroke-miterlimit": "4", "transform": "matrix(0.1, 0, 0, -0.1, 0, 1008)" };
	if (node.attrs?.length !== 9 || Object.entries(expected).some(([key, value]) => attribute(node, key) !== value)) return reject();
	const path = attribute(node, "d");
	if (path.length > 4000 || /[^MCLZ\d\s+.,-]/u.test(path)) return reject();
	const box = winnebagoGlyphBounds(path);
	if (Math.abs(box[2]! - box[0]! - 135) > 0.001 || Math.abs(box[3]! - box[1]! - 90) > 0.001) return reject();
	const numbers = [...path.matchAll(/[-+]?(?:\d+\.?\d*|\.\d+)/gu)].map(match => Number(match[0]));
	if (numbers.length % 2 || numbers.some(value => !Number.isFinite(value))) return reject();
	const signature = hash(JSON.stringify({ commands: path.replace(/[-+]?(?:\d+\.?\d*|\.\d+)|[\s,]/gu, ""), relative: numbers.map((value, index) => Math.round((value - box[index % 2]!) * 10000)) }));
	return { left: (box[0]! + box[2]!) * 0.075, top: (1008 - (box[1]! + box[3]!) * 0.05) * 1.5, signature, bounds: [box[0]! * 0.1, 1008 - box[3]! * 0.1, box[2]! * 0.1, 1008 - box[1]! * 0.1] };
}
export function inspectGoffstownVisual(xml: string, svg: string, page: number) {
	const native = goffstownNativePages(xml)[page - 1];
	if (!native || !svg.trimEnd().endsWith("</svg>")) return reject();
	const roots = descendants(bounded(svg), node => node.nodeName === "svg");
	if (roots.length !== 1 || attribute(roots[0]!, "width") !== "612pt" || attribute(roots[0]!, "height") !== "1008pt" || attribute(roots[0]!, "viewBox") !== "0 0 612 1008") return reject();
	const root = roots[0]!;
	const identified = descendants(root, node => Boolean(attribute(node, "id")));
	if (new Set(identified.map(node => attribute(node, "id"))).size !== identified.length) return reject();
	const definitions = new Map(identified.filter(node => /^glyph-\d+-\d+$/u.test(attribute(node, "id"))).map((node) => {
		const paths = descendants(node, child => child.nodeName === "path");
		if (node.nodeName !== "g" || node.attrs?.some(item => item.name !== "id") || descendants(node, child => !["#text", "path"].includes(child.nodeName)).length || paths.length > 1 || paths.some(path => path.attrs?.some(item => item.name !== "d"))) return reject();
		const path = paths[0] ? attribute(paths[0], "d") : "";
		return [attribute(node, "id"), { path, sha256: hash(path), bounds: path.trim() ? winnebagoGlyphBounds(path) : [0, 0, 0, 0] }] as const;
	}));
	const fields = native.map(field => ({ ...field, glyphs: [] as Glyph[], left: field.left / 1.5, right: (field.left + field.width) / 1.5, top: field.top / 1.5, bottom: (field.top + field.height) / 1.5 }));
	const ambiguous: { glyph: Glyph; fields: typeof fields }[] = [];
	const decorations: unknown[] = [];
	const marks: NonNullable<ReturnType<typeof goffstownBallotOval>>[] = [];
	const horizontalRules: number[] = [];
	const ink: number[][] = [];
	const pending = [{ node: root, ancestors: [] as StateHtmlNode[], color: "rgb(0%, 0%, 0%)" }];
	while (pending.length) {
		const { node, ancestors, color } = pending.pop()!;
		if (node.nodeName === "defs") {
			for (const child of (node.childNodes ?? []).filter(child => child.nodeName !== "#text" && !/^glyph-\d+-\d+$/u.test(attribute(child, "id")))) decorations.push(canonical(child));
			continue;
		}
		if (!["svg", "g", "use", "path", "rect", "#text"].includes(node.nodeName) || ["style", "opacity", "mask", "filter"].some(key => attribute(node, key)) || (!["path", "rect"].includes(node.nodeName) && attribute(node, "fill-opacity") && attribute(node, "fill-opacity") !== "1") || (node.nodeName === "g" && attribute(node, "transform"))) return reject();
		if (node.nodeName === "g" && node.attrs?.some(item => !["id", "fill", "fill-opacity", "clip-path"].includes(item.name))) return reject();
		const painted = attribute(node, "fill") || color;
		if (node.nodeName === "use" && attribute(node, "href").startsWith("#glyph-")) {
			if (node.attrs?.some(item => !["href", "x", "y"].includes(item.name)) || ancestors.some(parent => attribute(parent, "clip-path"))) return reject();
			const definition = definitions.get(attribute(node, "href").slice(1));
			if (!definition) return reject();
			const box = definition.bounds;
			if (box[2]! > box[0]! && box[3]! > box[1]!) {
				const left = Number(attribute(node, "x"));
				const top = Number(attribute(node, "y"));
				if (![left, top].every(Number.isFinite)) return reject();
				const horizontal = left + (box[0]! + box[2]!) / 2;
				const vertical = top + (box[1]! + box[3]!) / 2;
				const glyph = { left, top, sha256: definition.sha256, ink: box.map((value, index) => value + (index % 2 ? top : left)) };
				const matches = fields.filter(field => horizontal >= field.left - 0.75 && horizontal < field.right + 0.25 && vertical >= field.top - 0.75 && vertical <= field.bottom + 0.75 && painted === (field.color === "#ffffff" ? "rgb(100%, 100%, 100%)" : "rgb(0%, 0%, 0%)"));
				if (!matches.length) return reject();
				if (matches.length === 1) matches[0]!.glyphs.push(glyph);
				else ambiguous.push({ glyph, fields: matches });
				ink.push(glyph.ink);
			}
		}
		else if (["path", "rect", "use"].includes(node.nodeName)) {
			const oval = goffstownBallotOval(node);
			if (oval) {
				if (ancestors.some(parent => attribute(parent, "clip-path"))) return reject();
				marks.push(oval);
			}
			else {
				decorations.push({ node: canonical(node), ancestors: ancestors.map(parent => (parent.attrs ?? []).map(item => [item.name, item.value]).sort()) });
			}
			if (node.nodeName === "path" && painted !== "none" && !attribute(node, "transform")) {
				const box = winnebagoGlyphBounds(attribute(node, "d"));
				if (ink.some(glyph => glyph[0]! < box[2]! && glyph[2]! > box[0]! && glyph[1]! < box[3]! && glyph[3]! > box[1]!)) return reject();
				if (painted === "rgb(0%, 0%, 0%)" && box[2]! - box[0]! > 535 && box[2]! - box[0]! < 540 && box[3]! - box[1]! > 0 && box[3]! - box[1]! <= 2) horizontalRules.push(box[1]! * 1.5);
			}
		}
		for (const child of [...(node.childNodes ?? [])].reverse()) pending.push({ node: child, ancestors: [...ancestors, node], color: painted });
	}
	for (let index = ambiguous.length - 1; index >= 0; index--) {
		const item = ambiguous[index]!;
		const matches = item.fields.filter(field => !field.glyphs.length || field.glyphs.every(glyph => Math.abs(glyph.top - item.glyph.top) < 0.01));
		if (matches.length !== 1) return reject();
		matches[0]!.glyphs.push(item.glyph);
	}
	const characters: { character: string; sha256: string }[] = [];
	for (const field of fields) {
		field.glyphs.sort((first, second) => first.left - second.left);
		const letters = [...field.text.replace(/\s/gu, "")];
		if (letters.length !== field.glyphs.length || (field.glyphs.length && field.glyphs.some(glyph => Math.abs(glyph.top - field.glyphs[0]!.top) > 0.01))) return reject();
		for (const [index, glyph] of field.glyphs.entries()) characters.push({ character: letters[index]!, sha256: glyph.sha256 });
	}
	if (marks.some(mark => ink.some(glyph => glyph[0]! < mark.bounds[2]! && glyph[2]! > mark.bounds[0]! && glyph[1]! < mark.bounds[3]! && glyph[3]! > mark.bounds[1]!))) return reject();
	return { characters, decorationsSha256: hash(JSON.stringify(decorations)), svgSha256: hash(svg), fields: fields.length, visibleGlyphs: characters.length, marks, horizontalRules };
}
export function validateGoffstownVisual(xml: string, svg: string, page: number) {
	const inspected = inspectGoffstownVisual(xml, svg, page);
	if (inspected.decorationsSha256 !== goffstownDecorationApprovals[page - 1] || inspected.characters.some(item => !goffstownGlyphApprovals[item.character]?.includes(item.sha256)) || inspected.marks.some(mark => !goffstownOvalApprovals.includes(mark.signature))) return reject();
	return { svgSha256: inspected.svgSha256, fields: inspected.fields, visibleGlyphs: inspected.visibleGlyphs, decorationsSha256: inspected.decorationsSha256 };
}
