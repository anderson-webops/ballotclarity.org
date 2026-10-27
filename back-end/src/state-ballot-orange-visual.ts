import type { StateHtmlNode } from "./state-ballot-html.js";
import type { OrangeProofField } from "./state-ballot-orange-proof.js";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { stateHtmlAttribute as attribute, stateHtmlDescendants as descendants, parseStateHtml } from "./state-ballot-html.js";
import { orangePathCommands, orangeRuleShapes, orangeStrokeMatches } from "./state-ballot-orange-shapes.js";
import { orangeSvgGlyphApprovals } from "./state-ballot-orange-svg-glyphs.js";
import { winnebagoGlyphBounds as glyphBounds } from "./state-ballot-winnebago-visual.js";

type Catalog = Readonly<Record<string, readonly string[]>>;
interface Glyph { left: number; top: number; ink: number[]; clipping: number[][]; sha256: string; path: string; paint: number; color: number[] }
const enclosed = (ink: number[], box: number[]) => ink[0]! >= box[0]! - 0.01 && ink[1]! >= box[1]! - 0.01 && ink[2]! <= box[2]! + 0.01 && ink[3]! <= box[3]! + 0.01;
const overlaps = (first: number[], second: number[]) => first[0]! < second[2]! - 0.01 && first[2]! > second[0]! + 0.01 && first[1]! < second[3]! - 0.01 && first[3]! > second[1]! + 0.01;
function reject(detail: string): never {
	throw new Error(`The Orange County rendered ${detail} requires review.`);
}
function rgb(value: string) {
	const match = /^rgb\((\d+(?:\.\d+)?)%, (\d+(?:\.\d+)?)%, (\d+(?:\.\d+)?)%\)$/u.exec(value);
	if (!match || match.slice(1).some(value => Number(value) > 100)) return reject("color");
	return match.slice(1).map(value => Math.round(Number(value) * 255 / 100));
}
function contrast(first: number[], second: number[]) {
	const luminance = (color: number[]) => color.map(value => value / 255).map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4).reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index]!, 0);
	const values = [luminance(first), luminance(second)].sort((left, right) => left - right);
	return (values[1]! + 0.05) / (values[0]! + 0.05);
}
function attributes(node: StateHtmlNode, allowed: string[]) {
	if (node.attrs?.some(item => !allowed.includes(item.name))) return reject("attributes");
}
export function inspectOrangeProofVisual(native: readonly OrangeProofField[], svg: string, page: number, approvals: Catalog = orangeSvgGlyphApprovals) {
	if (!native.length || !Number.isInteger(page) || page < 1 || page > 256 || Buffer.byteLength(svg) > 2 * 1024 * 1024 || !svg.trimEnd().endsWith("</svg>")) return reject("page bounds");
	const dom = parseStateHtml(svg);
	const bounded = [{ node: dom, depth: 0 }];
	let nodes = 0;
	while (bounded.length) {
		const item = bounded.pop()!;
		if (++nodes > 60000 || item.depth > 32) return reject("DOM bounds");
		for (const child of item.node.childNodes ?? []) bounded.push({ node: child, depth: item.depth + 1 });
	}
	const roots = descendants(dom, node => node.nodeName === "svg");
	if (roots.length !== 1 || attribute(roots[0]!, "width") !== "792pt" || attribute(roots[0]!, "height") !== "612pt" || attribute(roots[0]!, "viewBox") !== "0 0 792 612") return reject("dimensions");
	const root = roots[0]!;
	const identified = descendants(root, node => Boolean(attribute(node, "id")));
	if (new Set(identified.map(node => attribute(node, "id"))).size !== identified.length) return reject("identifiers");
	const definitions = new Map(identified.filter(node => /^glyph-\d+-\d+$/u.test(attribute(node, "id"))).map((node) => {
		const paths = descendants(node, child => child.nodeName === "path");
		attributes(node, ["id"]);
		if (node.nodeName !== "g" || paths.length > 1 || descendants(node, child => !["#text", "path"].includes(child.nodeName)).length) return reject("glyph definition");
		for (const path of paths) attributes(path, ["d"]);
		const path = paths[0] ? attribute(paths[0], "d") : "";
		return [attribute(node, "id"), { path, sha256: createHash("sha256").update(path).digest("hex"), bounds: path.trim() ? glyphBounds(path) : [0, 0, 0, 0] }] as const;
	}));
	const clips = new Map(identified.filter(node => node.nodeName.toLowerCase() === "clippath").map((node) => {
		attributes(node, ["id"]);
		const paths = descendants(node, child => child.nodeName === "path");
		if (paths.length !== 1 || descendants(node, child => !["#text", "path"].includes(child.nodeName)).length) return reject("clip definition");
		attributes(paths[0]!, ["d", "clip-rule"]);
		const shapes = orangeRuleShapes(attribute(paths[0]!, "d"));
		if (shapes.length !== 1 || !shapes[0]!.closed) return reject("clip rectangle");
		return [attribute(node, "id"), shapes[0]!.box] as const;
	}));
	const images = new Map<string, number>(identified.filter(node => node.nodeName === "image").map((node) => {
		attributes(node, ["id", "x", "y", "width", "height", "href"]);
		const match = /^data:image\/png;base64,([A-Za-z0-9+/]*={0,2})$/u.exec(attribute(node, "href"));
		if (!match || attribute(node, "x") !== "0" || attribute(node, "y") !== "0" || attribute(node, "width") !== "93" || attribute(node, "height") !== "93" || createHash("sha256").update(Buffer.from(match[1]!, "base64")).digest("hex") !== "f153e7f1bab63717802dc8dd7c995c34da3f47a7bc90942ba0198c49980f9622") return reject("header seal");
		return [attribute(node, "id"), 0] as const;
	}));
	if (identified.length !== definitions.size + clips.size + images.size || images.size !== Number(page === 1)) return reject("definition inventory");
	const fields = native.map(field => ({ ...field, box: [field.left / 1.5, field.top / 1.5, (field.left + field.width) / 1.5, (field.top + field.height) / 1.5], glyphs: [] as Glyph[] }));
	const paints: { box: number[]; paint: number; color: number[]; stroke: boolean }[] = [];
	const reinforcements: { commands: ReturnType<typeof orangePathCommands>; paint: number }[] = [];
	const pending = [{ node: root, clipping: [] as number[][], color: [0, 0, 0], parent: undefined as StateHtmlNode | undefined }];
	let visited = 0;
	let paint = 0;
	while (pending.length) {
		const item = pending.pop()!;
		const node = item.node;
		const tag = node.nodeName.toLowerCase();
		if (++visited > 60000) return reject("node bounds");
		if (tag === "defs") {
			attributes(node, []);
			const children = (node.childNodes ?? []).flatMap(child => child.nodeName === "g" && !child.attrs?.length ? child.childNodes ?? [] : [child]);
			if (children.some(child => child.nodeName !== "#text" && !identified.includes(child))) return reject("definition structure");
			continue;
		}
		if (!["svg", "g", "use", "path", "#text"].includes(tag) || (attribute(node, "fill-opacity") && attribute(node, "fill-opacity") !== "1")) return reject("paint structure");
		if (tag === "#text") {
			if (node.value?.trim()) return reject("unassigned text");
			continue;
		}
		const clipping = [...item.clipping];
		const clip = attribute(node, "clip-path");
		if (clip) {
			const box = clips.get(clip.slice(5, -1));
			if (tag !== "g" || !/^url\(#clip-\d+\)$/u.test(clip) || !box || clipping.length >= 8) return reject("clip reference");
			clipping.push(box);
		}
		const color = attribute(node, "fill") && attribute(node, "fill") !== "none" ? rgb(attribute(node, "fill")) : item.color;
		if (tag === "svg") attributes(node, ["xmlns", "xlink", "width", "height", "viewBox"]);
		if (tag === "g") {
			attributes(node, ["fill", "fill-opacity", "clip-path"]);
			if (attribute(node, "fill") === "none") return reject("hidden text fill");
			const uses = (node.childNodes ?? []).filter(child => child.nodeName === "use" && attribute(child, "href").startsWith("#glyph-"));
			const meaningful = uses.filter((use) => {
				const definition = definitions.get(attribute(use, "href").slice(1));
				if (!definition) return reject("glyph reference");
				return definition.bounds[2]! > definition.bounds[0]! && definition.bounds[3]! > definition.bounds[1]!;
			});
			if (meaningful.length) {
				const left = Number(attribute(meaningful[0]!, "x"));
				const top = Number(attribute(meaningful[0]!, "y"));
				const matches = fields.filter(field => left >= field.box[0]! - 0.75 && left < field.box[2]! + 0.75 && top >= field.box[1]! - 0.75 && top <= field.box[3]! + 0.75).sort((first, second) => second.left - first.left);
				if (!matches.length || (matches.length > 1 && matches[0]!.left === matches[1]!.left)) return reject("glyph assignment");
				const field = matches[0]!;
				const expected = [1, 13, 14].includes(field.font) ? [0, 0, 255] : [3, 4].includes(field.font) ? [255, 255, 255] : field.font === 6 ? [128, 0, 0] : [0, 0, 0];
				if (color.join(",") !== expected.join(",")) return reject("text color");
				for (const use of uses) {
					attributes(use, ["href", "x", "y"]);
					const definition = definitions.get(attribute(use, "href").slice(1))!;
					const origin = Number(attribute(use, "x"));
					const baseline = Number(attribute(use, "y"));
					if (![origin, baseline].every(Number.isFinite) || Math.abs(baseline - top) > 0.01 || origin < field.box[0]! - 0.75 || origin > field.box[2]! + 0.75) return reject("glyph position");
					if (definition.bounds[2]! <= definition.bounds[0]! || definition.bounds[3]! <= definition.bounds[1]!) continue;
					field.glyphs.push({ left: origin, top: baseline, ink: definition.bounds.map((value, index) => value + (index % 2 ? baseline : origin)), clipping, sha256: definition.sha256, path: definition.path, paint: ++paint, color });
				}
			}
		}
		if (tag === "use") {
			const reference = attribute(node, "href").slice(1);
			if (images.has(reference)) {
				attributes(node, ["href", "transform"]);
				const match = /^matrix\(([\d.]+), 0, 0, ([\d.]+), ([\d.]+), ([\d.]+)\)$/u.exec(attribute(node, "transform"));
				if (!match || images.get(reference)) return reject("seal placement");
				const [horizontal, vertical, left, top] = match.slice(1).map(Number);
				const box = [left!, top!, left! + horizontal! * 93, top! + vertical! * 93];
				if (horizontal! < 0.2905 || horizontal! > 0.2907 || vertical! < 0.2716 || vertical! > 0.2718 || left! < 24.4 || left! > 24.6 || top! < 23 || top! > 23.3 || fields.some(field => overlaps(box, field.box))) return reject("seal bounds");
				images.set(reference, 1);
			}
			else {
				attributes(node, ["href", "x", "y"]);
				if (!definitions.has(reference) || item.parent?.nodeName !== "g") return reject("unassigned glyph");
			}
		}
		if (tag === "path") {
			const stroke = attribute(node, "fill") === "none";
			attributes(node, stroke ? ["fill", "stroke-width", "stroke-linecap", "stroke-linejoin", "stroke", "stroke-opacity", "stroke-miterlimit", "d"] : ["fill-rule", "fill", "fill-opacity", "d"]);
			if (stroke) {
				if (attribute(node, "stroke") !== "rgb(0%, 0%, 0%)" || attribute(node, "stroke-opacity") !== "1" || attribute(node, "stroke-linejoin") !== "miter" || attribute(node, "stroke-miterlimit") !== "10") return reject("stroke paint");
				if (attribute(node, "stroke-width") === "0.3" && attribute(node, "stroke-linecap") === "butt") {
					reinforcements.push({ commands: orangePathCommands(attribute(node, "d")), paint: ++paint });
				}
				else {
					if (!["0.12", "0.5", "1"].includes(attribute(node, "stroke-width")) || attribute(node, "stroke-linecap") !== "square") return reject("rule stroke");
					const width = Number(attribute(node, "stroke-width"));
					for (const shape of orangeRuleShapes(attribute(node, "d"))) {
						const [left, top, right, bottom] = shape.box;
						const segments = shape.closed ? [[left!, top!, right!, top!], [left!, bottom!, right!, bottom!], [left!, top!, left!, bottom!], [right!, top!, right!, bottom!]] : [shape.box];
						for (const segment of segments) paints.push({ box: segment.map((value, index) => value + (index < 2 ? -width / 2 : width / 2)), paint: ++paint, color: [0, 0, 0], stroke: true });
					}
				}
			}
			else {
				if (color[0] !== color[1] || color[1] !== color[2]) return reject("background paint");
				for (const shape of orangeRuleShapes(attribute(node, "d"))) {
					if (!shape.closed) return reject("background rectangle");
					paints.push({ box: shape.box, paint: ++paint, color, stroke: false });
				}
			}
		}
		for (const child of [...node.childNodes ?? []].reverse()) pending.push({ node: child, clipping, color, parent: node });
	}
	const clippedSourceDistrictLabels: { left: number; top: number; visibleCharacters: number; sourceCharacters: number }[] = [];
	let nonspaceGlyphs = 0;
	let fullInkClips = 0;
	for (const field of fields) {
		const characters = field.text.replace(/\s/gu, "");
		field.glyphs.sort((first, second) => first.left - second.left);
		const district = field.font === 7 && field.left === 502;
		const cropped = field.glyphs.length !== characters.length;
		if (cropped && (!district || field.glyphs.length < 20 || field.glyphs.length > characters.length || field.box[2]! <= 551.65 || field.glyphs.at(-1)!.ink[2]! < 550)) return reject(`field glyph inventory on page ${page}, font ${field.font}, field ${field.left}/${field.top}, ${field.glyphs.length}/${characters.length}`);
		if (field.glyphs.some((glyph, index) => Math.abs(glyph.top - field.glyphs[0]!.top) > 0.01 || (index > 0 && glyph.left - field.glyphs[index - 1]!.left < 0.5))) return reject("field glyph spacing");
		let partialInkFrom: number | undefined;
		for (const [position, glyph] of field.glyphs.entries()) {
			if (!approvals[characters[position]!]?.includes(glyph.sha256)) return reject(`character shape on page ${page}, font ${field.font}`);
			if (!glyph.clipping.every(box => enclosed(glyph.ink, box))) {
				if (!district || !glyph.clipping.every(box => enclosed(glyph.ink, box) || (box[0]! >= 334.5 && box[0]! <= Math.min(551.65, glyph.ink[0]!) && box[2]! >= 551.5 && box[2]! <= 552 && glyph.ink[2]! > box[2]! && glyph.ink[1]! >= box[1]! - 0.01 && glyph.ink[3]! <= box[3]! + 0.01))) return reject(`substantive clipping on page ${page}, font ${field.font}`);
				partialInkFrom ??= position;
			}
			else if (glyph.clipping.length) {
				fullInkClips++;
			}
			const intersecting = paints.filter(item => overlaps(glyph.ink, item.box));
			if (intersecting.some(item => item.paint > glyph.paint)) return reject(`substantive occlusion on page ${page}, font ${field.font}`);
			const covering = intersecting.filter(item => !item.stroke && enclosed(glyph.ink, item.box)).sort((first, second) => second.paint - first.paint)[0];
			if (contrast(glyph.color, covering?.color ?? [255, 255, 255]) < 4.5 || intersecting.some(item => item.paint > (covering?.paint ?? 0) && contrast(glyph.color, item.color) < 4.5)) return reject(`substantive contrast on page ${page}, font ${field.font}`);
			nonspaceGlyphs++;
		}
		if (cropped || partialInkFrom !== undefined) clippedSourceDistrictLabels.push({ left: field.left, top: field.top, visibleCharacters: partialInkFrom ?? field.glyphs.length, sourceCharacters: characters.length });
	}
	const captions = fields.filter(field => field.font === 5);
	if (reinforcements.length !== captions.length) return reject("caption stroke inventory");
	for (const [index, field] of captions.entries()) {
		const expected = field.glyphs.flatMap(glyph => orangePathCommands(glyph.path, glyph.left, glyph.top));
		if (!orangeStrokeMatches(reinforcements[index]!.commands, expected)) return reject("caption stroke outline");
	}
	if ([...images.values()].some(count => count !== 1)) return reject("seal inventory");
	return { svgSha256: createHash("sha256").update(svg).digest("hex"), fields: fields.length, nonspaceGlyphs, fullInkClips, captionStrokes: captions.length, clippedSourceDistrictLabels, sourceDistrictLabelsApprovedForBallotMatching: false as const, headerSeals: images.size };
}
