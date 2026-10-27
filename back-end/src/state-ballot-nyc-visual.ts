import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { stateHtmlAttribute as attribute, stateHtmlDescendants as descendants, parseStateHtml } from "./state-ballot-html.js";
import { nycNativePages } from "./state-ballot-nyc-native.js";
import { nycSvgGlyphApprovals } from "./state-ballot-nyc-svg-glyphs.js";
import { winnebagoGlyphBounds as glyphBounds } from "./state-ballot-winnebago-visual.js";

function reject(detail: string): never {
	throw new Error(`The NYC rendered ${detail} requires review.`);
}
function polygons(body: string) {
	if (body.length > 100000 || /[^MLZ\d\s+.,-]/u.test(body)) return reject("rule geometry");
	const tokens = body.match(/[MLZ]|[-+]?(?:\d+\.?\d*|\.\d+)/gu) ?? [];
	const result: { points: number[][]; closed: boolean }[] = [];
	let current: number[][] = [];
	for (let index = 0; index < tokens.length;) {
		const command = tokens[index++];
		if (command === "Z") {
			if (current.length !== 4) return reject("closed rule");
			result.push({ points: current, closed: true });
			current = [];
			continue;
		}
		if (!["M", "L"].includes(command ?? "")) return reject("rule command");
		const point = [Number(tokens[index++]), Number(tokens[index++])];
		if (point.some(value => !Number.isFinite(value))) return reject("rule point");
		if (command === "M" && current.length) {
			if (current.length !== 2) return reject("rule move");
			result.push({ points: current, closed: false });
			current = [];
		}
		current.push(point);
	}
	if (current.length > 1) result.push({ points: current, closed: false });
	else if (current.length && (!result.length || current[0]!.join(",") !== result.at(-1)!.points[0]!.join(","))) return reject("rule tail");
	if (!result.length || result.length > 1000) return reject("rule inventory");
	return result;
}
const bounds = (points: number[][]) => [Math.min(...points.map(point => point[0]!)), Math.min(...points.map(point => point[1]!)), Math.max(...points.map(point => point[0]!)), Math.max(...points.map(point => point[1]!))];
const enclosed = (ink: number[], box: number[]) => ink[0]! >= box[0]! - 0.01 && ink[1]! >= box[1]! - 0.01 && ink[2]! <= box[2]! + 0.01 && ink[3]! <= box[3]! + 0.01;
const overlaps = (first: number[], second: number[]) => first[0]! < second[2]! - 0.01 && first[2]! > second[0]! + 0.01 && first[1]! < second[3]! - 0.01 && first[3]! > second[1]! + 0.01;

export function inspectNycVisual(xml: string, svg: string, page: number, approvals: Readonly<Record<string, readonly string[]>> = nycSvgGlyphApprovals) {
	const native = nycNativePages(xml)[page - 1];
	if (!native || Buffer.byteLength(svg) > 4 * 1024 * 1024 || !svg.trimEnd().endsWith("</svg>")) return reject("page");
	const roots = descendants(parseStateHtml(svg), node => node.nodeName === "svg");
	if (roots.length !== 1 || attribute(roots[0]!, "width") !== "792pt" || attribute(roots[0]!, "height") !== "612pt" || attribute(roots[0]!, "viewBox") !== "0 0 792 612") return reject("dimensions");
	if (descendants(roots[0]!, node => !["svg", "g", "defs", "path", "use", "clippath", "image", "#text"].includes(node.nodeName.toLowerCase())).length) return reject("unsupported element");
	const identified = descendants(roots[0]!, node => Boolean(attribute(node, "id")));
	if (new Set(identified.map(node => attribute(node, "id"))).size !== identified.length) return reject("identifiers");
	const glyphs = new Map(identified.filter(node => /^glyph-\d+-\d+$/u.test(attribute(node, "id"))).map((node) => {
		const paths = descendants(node, child => child.nodeName === "path");
		if (node.nodeName !== "g" || node.attrs?.some(item => item.name !== "id") || descendants(node, child => !["#text", "path"].includes(child.nodeName)).length || paths.length > 1 || paths.some(path => path.attrs?.some(item => item.name !== "d"))) return reject("glyph definition");
		const definition = paths[0] ? attribute(paths[0], "d") : "";
		return [attribute(node, "id"), { bounds: definition.trim() ? glyphBounds(definition) : [0, 0, 0, 0], sha256: createHash("sha256").update(definition).digest("hex") }] as const;
	}));
	const clips = new Map(identified.filter(node => node.nodeName.toLowerCase() === "clippath").map((node) => {
		const paths = descendants(node, child => child.nodeName === "path");
		if (paths.length !== 1 || node.attrs?.some(item => item.name !== "id")) return reject("clip definition");
		const shapes = polygons(attribute(paths[0]!, "d"));
		if (shapes.length !== 1 || !shapes[0]!.closed || new Set(shapes[0]!.points.map(point => point[0])).size !== 2 || new Set(shapes[0]!.points.map(point => point[1])).size !== 2 || new Set(shapes[0]!.points.map(point => point.join(","))).size !== 4 || shapes[0]!.points.some((point, index, points) => point[0] !== points[(index + 1) % 4]![0] && point[1] !== points[(index + 1) % 4]![1])) return reject("clip shape");
		return [attribute(node, "id"), bounds(shapes[0]!.points)] as const;
	}));
	const images = new Map<string, number>(identified.filter(node => node.nodeName === "image").map((node) => {
		const image = /^data:image\/png;base64,([a-zA-Z0-9+/]*={0,2})$/u.exec(attribute(node, "href"));
		if (!image || attribute(node, "x") !== "0" || attribute(node, "y") !== "0" || attribute(node, "width") !== "290" || attribute(node, "height") !== "306" || node.attrs?.some(item => !["id", "x", "y", "width", "height", "href"].includes(item.name)) || createHash("sha256").update(Buffer.from(image[1]!, "base64")).digest("hex") !== "8df7d5fcc0db09feb27b426ceabac51f9a130836d78c2e85845502b586797be0") return reject("header seal");
		return [attribute(node, "id"), 0] as const;
	}));
	if (identified.length !== glyphs.size + clips.size + images.size) return reject("unknown definition");
	const fields = native.map(field => ({ ...field, left: field.left / 1.5, right: (field.left + field.width) / 1.5, top: field.top / 1.5, bottom: (field.top + field.height) / 1.5, glyphs: [] as { left: number; ink: number[]; clipping: number[][]; sha256: string }[] }));
	const obstacles: number[][] = [];
	const pending = [{ node: roots[0]!, clipping: [] as number[][], black: true }];
	let visited = 0;
	let rules = 0;
	while (pending.length) {
		const item = pending.pop()!;
		const node = item.node;
		if (++visited > 60000) return reject("node bounds");
		if (node.nodeName === "defs") continue;
		if (!["svg", "g", "use", "path", "#text"].includes(node.nodeName) || ["style", "mask", "opacity", "filter"].some(key => attribute(node, key)) || (attribute(node, "fill-opacity") && attribute(node, "fill-opacity") !== "1")) return reject("paint structure");
		const clipping = [...item.clipping];
		const clip = attribute(node, "clip-path");
		if (clip) {
			const box = clips.get(clip.slice(5, -1));
			if (node.nodeName !== "g" || !/^url\(#clip-\d+\)$/u.test(clip) || !box || clipping.length > 8) return reject("clip reference");
			clipping.push(box);
		}
		const black = attribute(node, "fill") ? attribute(node, "fill") === "rgb(0%, 0%, 0%)" : item.black;
		if (node.nodeName === "use") {
			const reference = attribute(node, "href").slice(1);
			if (images.has(reference)) {
				const transform = /^matrix\((\d+(?:\.\d+)?), 0, 0, (\d+(?:\.\d+)?), (\d+(?:\.\d+)?), (\d+(?:\.\d+)?)\)$/u.exec(attribute(node, "transform"));
				if (!transform || images.get(reference) || node.attrs?.some(item => !["href", "transform"].includes(item.name))) return reject("seal placement");
				const [horizontal, vertical, left, top] = transform.slice(1).map(Number);
				const box = [left!, top!, left! + horizontal! * 290, top! + vertical! * 306];
				if (horizontal! < 0.1875 || horizontal! > 0.1877 || vertical! < 0.1875 || vertical! > 0.1877 || left! < 700 || left! > 702 || top! < 18 || top! > 27 || fields.some(field => overlaps(box, [field.left, field.top, field.right, field.bottom]))) return reject("seal bounds");
				images.set(reference, 1);
			}
			else {
				const definition = glyphs.get(reference);
				if (!black || !definition || node.attrs?.some(item => !["href", "x", "y"].includes(item.name))) return reject("glyph reference");
				const box = definition.bounds;
				if (box[2]! > box[0]! && box[3]! > box[1]!) {
					const left = Number(attribute(node, "x"));
					const top = Number(attribute(node, "y"));
					if (!Number.isFinite(left) || !Number.isFinite(top)) return reject("glyph position");
					const matched = fields.filter(field => left >= field.left - 0.75 && left < field.right + 0.75 && top >= field.top - 0.75 && top <= field.bottom + 0.75);
					if (matched.length !== 1) return reject("glyph assignment");
					matched[0]!.glyphs.push({ left, ink: box.map((value, index) => value + (index % 2 ? top : left)), clipping, sha256: definition.sha256 });
				}
			}
		}
		else if (node.nodeName === "path") {
			const stroke = attribute(node, "fill") === "none";
			if (stroke) {
				if (attribute(node, "transform") !== "matrix(1, 0, 0, -1, 0, 0)" || attribute(node, "stroke-width") !== "1" || attribute(node, "stroke-opacity") !== "1" || !["square", "butt"].includes(attribute(node, "stroke-linecap")) || attribute(node, "stroke-linejoin") !== "miter" || attribute(node, "stroke-miterlimit") !== "10" || !/^rgb\((?:0%, 0%, 0%|50\.\d+%, 50\.\d+%, 50\.\d+%)\)$/u.test(attribute(node, "stroke"))) return reject("rule paint");
			}
			else if (!black || attribute(node, "transform") || attribute(node, "stroke")) {
				return reject("filled rule");
			}
			for (const polygon of polygons(attribute(node, "d"))) {
				const points = polygon.points.map(point => [point[0]!, stroke ? -point[1]! : point[1]!]);
				if ((polygon.closed ? points.length !== 4 : !stroke || points.length !== 2) || points.some((point, index) => (index || polygon.closed) && point[0] !== points[(index + points.length - 1) % points.length]![0] && point[1] !== points[(index + points.length - 1) % points.length]![1])) return reject("rule shape");
				const box = bounds(points);
				if (box[0]! < 0 || box[1]! < 0 || box[2]! > 792 || box[3]! > 612) return reject("rule bounds");
				if (stroke) {
					for (let index = 1; index < points.length + Number(polygon.closed); index++) {
						const segment = bounds([points[index - 1]!, points[index % points.length]!]);
						obstacles.push([segment[0]! - 0.5, segment[1]! - 0.5, segment[2]! + 0.5, segment[3]! + 0.5]);
					}
				}
				else {
					if (Math.min(box[2]! - box[0]!, box[3]! - box[1]!) > 3.01) return reject("opaque region");
					obstacles.push(box);
				}
				rules++;
			}
		}
		else if (attribute(node, "transform") || attribute(node, "stroke")) {
			return reject("group transformation");
		}
		for (const child of node.childNodes ?? []) pending.push({ node: child, clipping, black });
	}
	let nonspaceGlyphs = 0;
	let fullInkClips = 0;
	let clippedProposalSuffixGlyphs = 0;
	let intersectedColumnLabelGlyphs = 0;
	let omittedProposalSuffixGlyphs = 0;
	for (const field of fields) {
		const characters = field.text.replace(/\s/gu, "");
		field.glyphs.sort((first, second) => first.left - second.left);
		const metadata = /^Proposal Number [1-9]\d?, a Question: .+ - Citywide, # to be elected: 1$/u.test(field.text) ? field.text.split(", # to be elected:")[0]!.replace(/\s/gu, "").length : Number.POSITIVE_INFINITY;
		if (field.glyphs.length !== characters.length && (field.glyphs.length < metadata || field.glyphs.length > characters.length)) return reject("field glyph inventory");
		omittedProposalSuffixGlyphs += characters.length - field.glyphs.length;
		const columnLabel = field.size === 12 && field.top < 100 && ["Party\\Ind. Body", "Name", "Address"].includes(field.text);
		for (const [index, glyph] of field.glyphs.entries()) {
			if (!approvals[characters[index]!]?.includes(glyph.sha256)) return reject(`character shape on page ${page} at ${field.left},${field.top}, glyph ${index}, U+${characters.codePointAt(index)?.toString(16)}`);
			const visible = glyph.clipping.every(box => enclosed(glyph.ink, box));
			const occluded = obstacles.some(box => overlaps(glyph.ink, box));
			if (!visible || occluded) {
				if (columnLabel && visible) intersectedColumnLabelGlyphs++;
				else if (index >= metadata) clippedProposalSuffixGlyphs++;
				else return reject(`substantive ink on page ${page} at ${field.left},${field.top}, glyph ${index} (visible ${visible}, occluded ${occluded})`);
			}
			else if (glyph.clipping.length) {
				fullInkClips++;
			}
			nonspaceGlyphs++;
		}
	}
	if (images.size !== (page === 1 ? 0 : 1) || [...images.values()].some(count => count !== 1)) return reject("seal inventory");
	return { svgSha256: createHash("sha256").update(svg).digest("hex"), fields: fields.length, nonspaceGlyphs, fullInkClips, clippedProposalSuffixGlyphs, omittedProposalSuffixGlyphs, intersectedColumnLabelGlyphs, headerSeals: images.size, rules };
}
