import type { StateHtmlNode } from "./state-ballot-html.js";
import type { PimaDocumentKind } from "./state-ballot-pima-native.js";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { stateHtmlAttribute as attribute, stateHtmlDescendants as descendants, parseStateHtml } from "./state-ballot-html.js";
import { pimaNativePages } from "./state-ballot-pima-native.js";
import { pimaDefinitionApprovals, pimaGlyphApprovals, pimaLogoApprovals } from "./state-ballot-pima-visual-approvals.js";
import { winnebagoGlyphBounds as glyphBounds } from "./state-ballot-winnebago-visual.js";

const hash = (value: string) => createHash("sha256").update(value).digest("hex");
function reject(reason = "visual/native document", cause?: unknown): never {
	throw new Error(`The Pima ${reason} requires review.`, { cause });
}
function canonical(node: StateHtmlNode): unknown {
	return { tag: node.nodeName, attributes: (node.attrs ?? []).map(item => [item.name, item.value]).sort(), children: (node.childNodes ?? []).filter(child => child.nodeName !== "#text").map(canonical) };
}
function rectangle(path: string) {
	if (path.length > 1000 || /[^MLZ\d\s+.,-]/u.test(path)) return reject("rectangle");
	const numbers = [...path.matchAll(/[-+]?(?:\d+\.?\d*|\.\d+)/gu)].map(match => Number(match[0]));
	const commands = path.replace(/[-+]?(?:\d+\.?\d*|\.\d+)|[\s,]/gu, "");
	if (!["MLLLZ", "MLLLZM"].includes(commands) || numbers.length !== (commands.endsWith("M") ? 10 : 8) || numbers.some(value => !Number.isFinite(value))) return reject("rectangle commands");
	const corners = [0, 2, 4, 6].map(index => [numbers[index]!, numbers[index + 1]!]);
	if (new Set(corners.map(point => point[0])).size !== 2 || new Set(corners.map(point => point[1])).size !== 2 || new Set(corners.map(point => point.join(","))).size !== 4 || corners.some((point, index) => point[0] !== corners[(index + 1) % 4]![0] && point[1] !== corners[(index + 1) % 4]![1]) || (numbers.length === 10 && (numbers[8] !== numbers[0] || numbers[9] !== numbers[1]))) return reject("rectangle geometry");
	return [Math.min(...corners.map(point => point[0]!)), Math.min(...corners.map(point => point[1]!)), Math.max(...corners.map(point => point[0]!)), Math.max(...corners.map(point => point[1]!))];
}
const overlaps = (first: number[], second: number[]) => first[0]! < second[2]! && first[2]! > second[0]! && first[1]! < second[3]! && first[3]! > second[1]!;
const enclosed = (inner: number[], outer: number[]) => inner[0]! >= outer[0]! - 0.005 && inner[1]! >= outer[1]! - 0.005 && inner[2]! <= outer[2]! + 0.005 && inner[3]! <= outer[3]! + 0.005;
export function inspectPimaVisual(xml: string, svg: string, page: number, kind: PimaDocumentKind) {
	const native = pimaNativePages(xml, kind)[page - 1];
	if (!native || Buffer.byteLength(svg) > 4 * 1024 * 1024 || !svg.trimEnd().endsWith("</svg>") || /<(?:script|style|foreignObject|animate|set)\b/iu.test(svg)) return reject();
	const document = parseStateHtml(svg);
	const structure = [{ node: document, depth: 0 }];
	let visited = 0;
	while (structure.length) {
		const item = structure.pop()!;
		if (++visited > 150000 || item.depth > 64) return reject("SVG bounds");
		for (const node of item.node.childNodes ?? []) structure.push({ node, depth: item.depth + 1 });
	}
	const roots = descendants(document, node => node.nodeName === "svg");
	const width = roots.length === 1 ? /^([\d.]+)pt$/u.exec(attribute(roots[0]!, "width"))?.[1] : undefined;
	const height = roots.length === 1 ? /^([\d.]+)pt$/u.exec(attribute(roots[0]!, "height"))?.[1] : undefined;
	if (!width || !height || !Number.isFinite(Number(width)) || !Number.isFinite(Number(height)) || Math.abs(Number(width) - 612) > 0.01 || Math.abs(Number(height) - 792) > 0.01 || attribute(roots[0]!, "viewBox") !== `0 0 ${width} ${height}` || roots[0]!.attrs?.some(item => !["xmlns", "xlink", "width", "height", "viewBox"].includes(item.name))) return reject("SVG dimensions");
	const root = roots[0]!;
	const identified = descendants(root, node => Boolean(attribute(node, "id")));
	if (new Set(identified.map(node => attribute(node, "id"))).size !== identified.length) return reject("SVG identifiers");
	const definitions = new Map(identified.filter(node => /^glyph-\d+-\d+$/u.test(attribute(node, "id"))).map((node) => {
		const paths = descendants(node, child => child.nodeName === "path");
		if (node.nodeName !== "g" || node.attrs?.some(item => item.name !== "id") || descendants(node, child => !["#text", "path"].includes(child.nodeName)).length || paths.length > 1 || paths.some(path => path.attrs?.some(item => item.name !== "d"))) return reject("glyph definition");
		const path = paths[0] ? attribute(paths[0], "d") : "";
		return [attribute(node, "id"), { sha256: hash(path), bounds: path.trim() ? glyphBounds(path) : [0, 0, 0, 0] }] as const;
	}));
	const clips = new Map(identified.filter(node => node.nodeName.toLowerCase() === "clippath").map((node) => {
		const paths = descendants(node, child => child.nodeName === "path");
		if (paths.length !== 1 || node.attrs?.some(item => item.name !== "id") || paths[0]!.attrs?.some(item => !["d", "clip-rule"].includes(item.name))) return reject("clip definition");
		return [attribute(node, "id"), rectangle(attribute(paths[0]!, "d"))] as const;
	}));
	const approvedDefinitions = identified.filter(node => ["image", "filter", "mask"].includes(node.nodeName));
	if (approvedDefinitions.some(node => !pimaDefinitionApprovals.includes(hash(JSON.stringify(canonical(node))))) || (kind === "candidates" ? approvedDefinitions.length !== 5 : approvedDefinitions.length !== 0)) return reject("header artwork");
	function validDefinition(node: StateHtmlNode): boolean {
		if (node.nodeName === "#text" || definitions.has(attribute(node, "id")) || clips.has(attribute(node, "id")) || approvedDefinitions.includes(node)) return true;
		return node.nodeName === "g" && !node.attrs?.length && (node.childNodes ?? []).every(validDefinition);
	}
	for (const node of descendants(root, node => node.nodeName === "defs")) {
		if (!(node.childNodes ?? []).every(validDefinition)) return reject("SVG definitions");
	}
	const fields = native.map(field => ({ ...field, left: field.left / 1.5, right: (field.left + field.width) / 1.5, top: field.top / 1.5, bottom: (field.top + field.height) / 1.5, glyphs: [] as { left: number; sha256: string; clipped: boolean }[] }));
	const allInk: number[][] = [];
	const editorialEdges = new Set<number[]>();
	const inkNodes = [{ node: root, clipping: [[0, 0, 612, 792]] }];
	while (inkNodes.length) {
		const item = inkNodes.pop()!;
		if (item.node.nodeName === "defs") continue;
		const clipping = [...item.clipping];
		const clip = attribute(item.node, "clip-path");
		if (clip) {
			const bounds = clips.get(clip.slice(5, -1));
			if (!/^url\(#clip-\d+\)$/u.test(clip) || !bounds) return reject("ink clipping");
			clipping.push(bounds);
		}
		if (item.node.nodeName === "use" && attribute(item.node, "href").startsWith("#glyph-")) {
			const definition = definitions.get(attribute(item.node, "href").slice(1));
			if (!definition) return reject("glyph reference");
			if (definition.bounds[2]! > definition.bounds[0]! && definition.bounds[3]! > definition.bounds[1]!) {
				const ink = definition.bounds.map((value, index) => value + Number(attribute(item.node, index % 2 ? "y" : "x")));
				const visible = [Math.max(ink[0]!, ...clipping.map(box => box[0]!)), Math.max(ink[1]!, ...clipping.map(box => box[1]!)), Math.min(ink[2]!, ...clipping.map(box => box[2]!)), Math.min(ink[3]!, ...clipping.map(box => box[3]!))];
				if (visible[0]! < visible[2]! && visible[1]! < visible[3]!) {
					allInk.push(visible);
					const horizontal = (ink[0]! + ink[2]!) / 2;
					const vertical = (ink[1]! + ink[3]!) / 2;
					if (kind === "write-ins" && !clipping.every(bounds => enclosed(ink, bounds)) && pimaGlyphApprovals["-"]?.includes(definition.sha256) && fields.some(field => horizontal >= field.left - 0.75 && horizontal < field.right + 0.75 && vertical >= field.top - 0.75 && vertical <= field.bottom + 0.75 && /^U\.S\. REPRESENTATIVE IN CONGRESS - DISTRICT \d{1,2} \/ REPRESENTANTE DE EE\.UU\. EN EL CONGRESO -$/u.test(field.text))) editorialEdges.add(visible);
				}
			}
		}
		for (const node of item.node.childNodes ?? []) inkNodes.push({ node, clipping });
	}
	const paintedInk: number[][] = [];
	const pending = [{ node: root, clips: [] as string[], color: "rgb(0%, 0%, 0%)", graphicOnly: false }];
	let visibleGlyphs = 0;
	let imageUses = 0;
	let logoPaths = 0;
	let rules = 0;
	while (pending.length) {
		const item = pending.pop()!;
		const node = item.node;
		if (node.nodeName === "defs") continue;
		if (!["svg", "g", "use", "path", "#text"].includes(node.nodeName) || ["style", "opacity"].some(key => attribute(node, key))) return reject("paint structure");
		const clipping = [...item.clips];
		const clip = attribute(node, "clip-path");
		if (clip) {
			if (node.nodeName !== "g" || !/^url\(#clip-\d+\)$/u.test(clip) || !clips.has(clip.slice(5, -1)) || clipping.length > 8) return reject("paint clipping");
			clipping.push(clip.slice(5, -1));
		}
		const graphicOnly = item.graphicOnly || Boolean(attribute(node, "mask") || attribute(node, "filter"));
		if (node.nodeName === "g" && (node.attrs?.some(value => !["id", "clip-path", "fill", "fill-opacity", "mask", "filter"].includes(value.name)) || (attribute(node, "mask") && attribute(node, "mask") !== "url(#mask-0)") || (attribute(node, "filter") && attribute(node, "filter") !== "url(#filter-remove-color)"))) return reject("group styling");
		if (attribute(node, "fill-opacity") && attribute(node, "fill-opacity") !== "1") return reject("paint opacity");
		const painted = attribute(node, "fill") || item.color;
		if (node.nodeName === "use" && attribute(node, "href").startsWith("#glyph-")) {
			if (graphicOnly || painted !== "rgb(0%, 0%, 0%)" || node.attrs?.some(value => !["href", "x", "y"].includes(value.name))) return reject("glyph visibility");
			const definition = definitions.get(attribute(node, "href").slice(1));
			if (!definition) return reject("glyph reference");
			const box = definition.bounds;
			if (box[2]! > box[0]! && box[3]! > box[1]!) {
				const left = Number(attribute(node, "x"));
				const top = Number(attribute(node, "y"));
				if (![left, top].every(Number.isFinite)) return reject("glyph position");
				const ink = box.map((value, index) => value + (index % 2 ? top : left));
				const horizontal = (ink[0]! + ink[2]!) / 2;
				const vertical = (ink[1]! + ink[3]!) / 2;
				const matches = fields.filter(field => horizontal >= field.left - 0.75 && horizontal < field.right + 0.75 && vertical >= field.top - 0.75 && vertical <= field.bottom + 0.75);
				if (matches.length !== 1) return reject("glyph/field assignment");
				matches[0]!.glyphs.push({ left, sha256: definition.sha256, clipped: !enclosed(ink, [0, 0, 612, 792]) || !clipping.every(id => enclosed(ink, clips.get(id)!)) });
				paintedInk.push(ink);
				visibleGlyphs++;
			}
		}
		else if (node.nodeName === "use") {
			if (kind !== "candidates" || attribute(node, "href") !== "#source-6" || attribute(node, "transform") !== "matrix(0.239, 0, 0, 0.238687, 50.28005, 21.70265)" || (attribute(node, "filter") && attribute(node, "filter") !== "url(#filter-color-to-alpha)") || node.attrs?.some(value => !["href", "transform", "filter"].includes(value.name))) return reject("image placement");
			imageUses++;
		}
		else if (node.nodeName === "path") {
			if (pimaLogoApprovals.includes(hash(JSON.stringify(canonical(node))))) {
				logoPaths++;
			}
			else if (attribute(node, "stroke")) {
				const expected = { "fill": "none", "stroke-width": "0.120196", "stroke-linecap": "square", "stroke-linejoin": "miter", "stroke": "rgb(0%, 0%, 0%)", "stroke-opacity": "1", "stroke-miterlimit": "10" };
				if (node.attrs?.length !== 9 || Object.entries(expected).some(([key, value]) => attribute(node, key) !== value)) return reject("rule style");
				const matrix = /^matrix\((0\.\d+), 0, 0, -(0\.\d+), ([-\d.]+), ([-\d.]+)\)$/u.exec(attribute(node, "transform"));
				const path = attribute(node, "d");
				const coordinates = [...path.matchAll(/[-+]?(?:\d+\.?\d*|\.\d+)/gu)].map(match => Number(match[0]));
				if (!matrix || matrix[1] !== matrix[2] || Number(matrix[1]) < 0.99 || Number(matrix[1]) > 1 || path.replace(/[-+]?(?:\d+\.?\d*|\.\d+)|[\s,]/gu, "") !== "ML" || coordinates.length !== 4 || coordinates.some(value => !Number.isFinite(value)) || (Math.abs(coordinates[0]! - coordinates[2]!) > 0.001 && Math.abs(coordinates[1]! - coordinates[3]!) > 0.001)) return reject("rule geometry");
				const points = [0, 2].map(index => [coordinates[index]! * Number(matrix[1]) + Number(matrix[3]), -coordinates[index + 1]! * Number(matrix[1]) + Number(matrix[4])]);
				const box = [Math.min(points[0]![0]!, points[1]![0]!) - 0.06, Math.min(points[0]![1]!, points[1]![1]!) - 0.06, Math.max(points[0]![0]!, points[1]![0]!) + 0.06, Math.max(points[0]![1]!, points[1]![1]!) + 0.06];
				const intersections = allInk.filter(ink => overlaps(ink, box) && !(editorialEdges.has(ink) && box[2]! - box[0]! <= 0.13 && box[0]! >= ink[2]! - 0.07 && box[2]! <= ink[2]! + 0.07));
				if (!enclosed(box, [0, 0, 612, 792]) || intersections.length) return reject("rule/text overlap", { rule: box, ink: intersections.slice(0, 3) });
				rules++;
			}
			else {
				if (node.attrs?.some(value => !["d", "fill", "fill-opacity", "fill-rule"].includes(value.name)) || !["nonzero", "evenodd"].includes(attribute(node, "fill-rule"))) return reject("background style");
				const box = rectangle(attribute(node, "d"));
				const gray = ["rgb(65.098572%, 65.098572%, 65.098572%)", "rgb(85.099792%, 85.099792%, 85.099792%)"].includes(painted);
				if (!enclosed(box, [0, 0, 612, 792]) || (gray ? paintedInk.some(ink => overlaps(ink, box)) : painted !== "rgb(0%, 0%, 0%)" || Math.min(box[2]! - box[0]!, box[3]! - box[1]!) > 2.1 || allInk.some(ink => overlaps(ink, box)))) return reject("background visibility", { box, painted, ink: (gray ? paintedInk : allInk).filter(ink => overlaps(ink, box)).slice(0, 3) });
				rules++;
			}
		}
		for (const child of [...(node.childNodes ?? [])].reverse()) pending.push({ node: child, clips: clipping, color: painted, graphicOnly });
	}
	let clippedEditorialDashes = 0;
	for (const field of fields) {
		field.glyphs.sort((first, second) => first.left - second.left);
		const letters = [...field.text.replace(/\s/gu, "")];
		if (letters.length !== field.glyphs.length) return reject("native/visible conservation");
		for (const [position, character] of letters.entries()) {
			const glyph = field.glyphs[position]!;
			if (!pimaGlyphApprovals[character]?.includes(glyph.sha256)) return reject("native/visible character agreement");
			if (glyph.clipped) {
				if (kind !== "write-ins" || character !== "-" || position !== letters.length - 1 || !/^U\.S\. REPRESENTATIVE IN CONGRESS - DISTRICT \d{1,2} \/ REPRESENTANTE DE EE\.UU\. EN EL CONGRESO -$/u.test(field.text)) return reject("candidate clipping");
				clippedEditorialDashes++;
			}
		}
	}
	if (kind === "candidates" ? imageUses !== 1 || logoPaths !== 0 : imageUses !== 0 || logoPaths !== 23) return reject("header inventory");
	return { fields: fields.length, visibleGlyphs, clippedEditorialDashes, imageUses, logoPaths, rules, svgSha256: hash(svg) };
}
