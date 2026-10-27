import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { chicagoNativePages } from "./state-ballot-chicago-native.js";
import { stateHtmlAttribute as attribute, stateHtmlDescendants as descendants, parseStateHtml } from "./state-ballot-html.js";
import { winnebagoGlyphBounds as glyphBounds } from "./state-ballot-winnebago-visual.js";

function reject(): never {
	throw new Error("The Chicago rendered/native PDF inventory requires review.");
}
function rectangles(body: string) {
	if (body.length > 100000 || /[^MLZ\d\s+.,-]/u.test(body)) return reject();
	const tokens = body.match(/[MLZ]|[-+]?(?:\d+\.?\d*|\.\d+)/gu) ?? [];
	const boxes: number[][] = [];
	let position = 0;
	while (position < tokens.length) {
		const corners: number[][] = [];
		for (const command of ["M", "L", "L", "L"]) {
			if (tokens[position++] !== command) {
				if (command === "L" && position === tokens.length + 1 && corners.length === 1 && boxes.length && corners[0]![0] === boxes.at(-1)![0] && corners[0]![1] === boxes.at(-1)![1]) return boxes;
				return reject();
			}
			const left = Number(tokens[position++]);
			const top = Number(tokens[position++]);
			if (!Number.isFinite(left) || !Number.isFinite(top)) return reject();
			corners.push([left, top]);
		}
		if (tokens[position++] !== "Z" || new Set(corners.map(point => point[0])).size !== 2 || new Set(corners.map(point => point[1])).size !== 2 || new Set(corners.map(point => point.join(","))).size !== 4 || corners.some((point, index) => point[0] !== corners[(index + 1) % 4]![0] && point[1] !== corners[(index + 1) % 4]![1])) return reject();
		boxes.push([Math.min(...corners.map(point => point[0]!)), Math.min(...corners.map(point => point[1]!)), Math.max(...corners.map(point => point[0]!)), Math.max(...corners.map(point => point[1]!))]);
		if (boxes.length > 1000) return reject();
	}
	return boxes;
}
function color(value: string) {
	const match = /^rgb\((\d+(?:\.\d+)?)%, (\d+(?:\.\d+)?)%, (\d+(?:\.\d+)?)%\)$/u.exec(value);
	if (!match) return reject();
	const channels = match.slice(1).map(Number);
	if (channels.some(channel => channel < 0 || channel > 100)) return reject();
	return channels;
}

export function inspectChicagoVisual(xml: string, svg: string, page: number) {
	const native = chicagoNativePages(xml)[page - 1];
	if (!native || Buffer.byteLength(svg) > 4 * 1024 * 1024 || !svg.trimEnd().endsWith("</svg>")) return reject();
	const roots = descendants(parseStateHtml(svg), node => node.nodeName === "svg");
	if (roots.length !== 1 || attribute(roots[0]!, "width") !== "612pt" || attribute(roots[0]!, "height") !== "792pt" || attribute(roots[0]!, "viewBox") !== "0 0 612 792") return reject();
	const identified = descendants(roots[0]!, node => Boolean(attribute(node, "id")));
	if (new Set(identified.map(node => attribute(node, "id"))).size !== identified.length) return reject();
	const definitions = new Map(identified.filter(node => attribute(node, "id").startsWith("glyph-")).map((node) => {
		if (descendants(node, child => !["#text", "path"].includes(child.nodeName)).length || descendants(node, child => child.nodeName === "path").some(child => child.attrs?.some(item => item.name !== "d"))) return reject();
		return [attribute(node, "id"), descendants(node, child => child.nodeName === "path").map(child => attribute(child, "d")).join(" ")];
	}));
	const clips = new Map(descendants(roots[0]!, node => node.nodeName.toLowerCase() === "clippath").map((node) => {
		const paths = descendants(node, child => child.nodeName === "path");
		if (paths.length !== 1) return reject();
		const boxes = rectangles(attribute(paths[0]!, "d"));
		if (boxes.length !== 1) return reject();
		return [attribute(node, "id"), boxes[0]!];
	}));
	const fields = native.map(field => ({ ...field, left: field.left / 1.5, right: (field.left + field.width) / 1.5, top: field.top / 1.5, bottom: (field.top + field.height) / 1.5, count: 0 }));
	const inkBounds = new Map([...definitions].map(([id, definition]) => [id, definition.trim() ? glyphBounds(definition) : [0, 0, 0, 0]]));
	const pending = [{ node: roots[0]!, clipping: [] as string[], color: [0, 0, 0] }];
	let visited = 0;
	let visibleGlyphs = 0;
	let ruleRectangles = 0;
	let clippedEditorialGlyphs = 0;
	let fullInkClips = 0;
	while (pending.length) {
		const item = pending.pop()!;
		const node = item.node;
		if (++visited > 60000) return reject();
		if (node.nodeName === "defs") continue;
		if (!["svg", "g", "use", "path", "#text"].includes(node.nodeName) || ["style", "transform", "mask", "opacity", "filter", "stroke"].some(key => attribute(node, key)) || (attribute(node, "fill-opacity") && attribute(node, "fill-opacity") !== "1")) return reject();
		const painted = attribute(node, "fill") ? color(attribute(node, "fill")) : item.color;
		const clipping = [...item.clipping];
		const clip = attribute(node, "clip-path");
		if (clip) {
			if (node.nodeName !== "g" || !/^url\(#clip-\d+\)$/u.test(clip) || !clips.has(clip.slice(5, -1)) || clipping.length > 8) return reject();
			clipping.push(clip.slice(5, -1));
		}
		if (node.nodeName === "use") {
			const reference = attribute(node, "href");
			if (!/^#glyph-\d+-\d+$/u.test(reference) || !definitions.has(reference.slice(1))) return reject();
			const bounds = inkBounds.get(reference.slice(1))!;
			if (bounds[2]! > bounds[0]! && bounds[3]! > bounds[1]!) {
				const left = Number(attribute(node, "x"));
				const top = Number(attribute(node, "y"));
				if (!Number.isFinite(left) || !Number.isFinite(top)) return reject();
				const matches = fields.filter(field => left >= field.left - 0.75 && left < field.right + 0.75 && top >= field.top - 0.75 && top <= field.bottom + 0.75);
				if (matches.length !== 1) return reject();
				const field = matches[0]!;
				if (painted[0] !== 0 || painted[1] !== 0 || (field.color === "#000080" ? painted[2]! < 49 || painted[2]! > 51 : painted[2] !== 0)) return reject();
				if (clipping.length) {
					const ink = bounds.map((value, index) => value + (index % 2 ? top : left));
					const enclosed = clipping.every((id) => {
						const box = clips.get(id)!;
						return ink[0]! >= box[0]! - 0.005 && ink[1]! >= box[1]! - 0.005 && ink[2]! <= box[2]! + 0.005 && ink[3]! <= box[3]! + 0.005;
					});
					if (enclosed) fullInkClips++;
					else if (field.family === "Arial" || (page === 1 && field.text.startsWith("part of the City of Chicago."))) clippedEditorialGlyphs++;
					else return reject();
				}
				field.count++;
				visibleGlyphs++;
			}
		}
		else if (node.nodeName === "path") {
			const navy = painted[0] === 0 && painted[1] === 0 && painted[2]! > 49 && painted[2]! < 51;
			const gray = painted.every(channel => channel > 75 && channel < 76);
			if (!navy && !gray) return reject();
			for (const box of rectangles(attribute(node, "d"))) {
				if (box[0]! < 0 || box[1]! < 0 || box[2]! > 612 || box[3]! > 792 || box[3]! - box[1]! > 3.1 || fields.some(field => field.left < box[2]! && field.right > box[0]! && field.top < box[3]! && field.bottom > box[1]!)) return reject();
				ruleRectangles++;
			}
		}
		for (const child of [...(node.childNodes ?? [])].reverse()) pending.push({ node: child, clipping, color: painted });
	}
	if (fields.some(field => field.count !== field.text.replace(/\s/gu, "").length)) return reject();
	return { svgSha256: createHash("sha256").update(svg).digest("hex"), fields: fields.length, visibleGlyphs, ruleRectangles, clippedEditorialGlyphs, fullInkClips };
}
