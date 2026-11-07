import type { StateHtmlNode } from "./state-ballot-html.js";
import type { IowaInkShape } from "./state-ballot-iowa-county-ink.js";
import type { IowaSampleCounty } from "./state-ballot-iowa-county-native.js";
import type { IowaSampleGeometry } from "./state-ballot-iowa-county-proof.js";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import {
	stateHtmlAttribute as attribute,
	stateHtmlDescendants as descendants,
	parseStateHtml,
	stateHtmlText
} from "./state-ballot-html.js";
import { iowaSvgGlyphApprovals } from "./state-ballot-iowa-county-glyphs.js";
import { iowaInkOverlaps, iowaInkShape } from "./state-ballot-iowa-county-ink.js";
import { validateIowaSampleGeometry } from "./state-ballot-iowa-county-proof.js";
import { orangePathCommands } from "./state-ballot-orange-shapes.js";
import { winnebagoGlyphBounds } from "./state-ballot-winnebago-visual.js";

type Box = [number, number, number, number];
type Color = [number, number, number];
type Matrix = [number, number, number, number, number, number];
interface Clip {
	box: Box;
	rectangular: boolean;
}
interface Glyph {
	box: Box;
	x: number;
	y: number;
	sequence: string | undefined;
	paint: number;
	color: Color;
	alpha: number;
	clips: Clip[];
	masked: boolean;
	filtered: boolean;
	transformed: boolean;
	assigned: boolean;
	path: string;
	matrix: Matrix;
	ink?: IowaInkShape;
}
interface Paint {
	box: Box;
	color?: Color;
	alpha: number;
	paint: number;
	stroke: boolean;
	overlay: boolean;
	ink?: IowaInkShape;
	strokeRadius?: number;
	rectangular?: boolean;
}
interface State {
	matrix: Matrix;
	clips: Clip[];
	color: Color;
	fill: boolean;
	alpha: number;
	masked: boolean;
	overlay: boolean;
	filtered: boolean;
	references: string[];
}
export interface IowaRenderedPageProof {
	page: number;
	svgSha256: string;
	bboxSha256: string;
	geometrySha256: string;
	wordInventorySha256: string;
	words: number;
	characters: number;
	glyphs: number;
	watermarkLayers: number;
	images: number;
	minimumContrast: number;
	ruleContacts: number;
}
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
function enclosed(inner: Box, outer: Box) {
	return (
		inner[0] >= outer[0] - 0.01
		&& inner[1] >= outer[1] - 0.01
		&& inner[2] <= outer[2] + 0.01
		&& inner[3] <= outer[3] + 0.01
	);
}
function overlaps(first: Box, second: Box) {
	return (
		first[0] < second[2] - 0.01
		&& first[2] > second[0] + 0.01
		&& first[1] < second[3] - 0.01
		&& first[3] > second[1] + 0.01
	);
}
function reject(detail: string): never {
	throw new Error(`The Iowa rendered ${detail} requires review.`);
}
function number(value: string) {
	if (
		!/^[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[-+]?\d+)?$/iu.test(value)
		|| !Number.isFinite(Number(value))
		|| Math.abs(Number(value)) > 100000
	) {
		return reject("coordinate");
	}
	return Number(value);
}
function attributes(node: StateHtmlNode, allowed: string[]) {
	if (node.attrs?.some(item => !allowed.includes(item.name))) return reject("attributes");
}
function color(value: string): Color {
	const match = /^rgb\((\d+(?:\.\d+)?)%, (\d+(?:\.\d+)?)%, (\d+(?:\.\d+)?)%\)$/u.exec(value);
	if (!match || match.slice(1).some(value => Number(value) > 100)) return reject("color");
	return match.slice(1).map(value => Math.round((Number(value) * 255) / 100)) as Color;
}
function opacity(value: string, fallback: number) {
	if (!value) return fallback;
	const result = number(value);
	if (result < 0 || result > 1) return reject("opacity");
	return result;
}
function contrast(first: Color, second: Color) {
	const luminance = (values: Color) =>
		values
			.map(value => value / 255)
			.map(value => (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4))
			.reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index]!, 0);
	const values = [luminance(first), luminance(second)].sort((first, second) => first - second);
	return (values[1]! + 0.05) / (values[0]! + 0.05);
}
function compose(parent: Matrix, value: string): Matrix {
	if (!value) return parent;
	const match = /^matrix\(([^)]+)\)$/u.exec(value);
	const values = match?.[1]
		?.trim()
		.split(/\s*,\s*|\s+/u)
		.map(number);
	if (
		!values
		|| values.length !== 6
		|| Math.abs(values[1]!) > 1e-9
		|| Math.abs(values[2]!) > 1e-9
		|| values[0] === 0
		|| values[3] === 0
		|| Math.abs(values[0]!) > 100
		|| Math.abs(values[3]!) > 100
	) {
		return reject("transform");
	}
	return [
		parent[0] * values[0]!,
		0,
		0,
		parent[3] * values[3]!,
		parent[0] * values[4]! + parent[4],
		parent[3] * values[5]! + parent[5]
	];
}
function transformed(box: Box, matrix: Matrix): Box {
	const horizontal = [box[0] * matrix[0] + matrix[4], box[2] * matrix[0] + matrix[4]];
	const vertical = [box[1] * matrix[3] + matrix[5], box[3] * matrix[3] + matrix[5]];
	return [Math.min(...horizontal), Math.min(...vertical), Math.max(...horizontal), Math.max(...vertical)];
}
function bounds(path: string): Box {
	try {
		return winnebagoGlyphBounds(path) as Box;
	}
	catch {
		return reject("path geometry");
	}
}
function rectangle(node: StateHtmlNode): Box {
	const left = number(attribute(node, "x") || "0");
	const top = number(attribute(node, "y") || "0");
	const width = number(attribute(node, "width"));
	const height = number(attribute(node, "height"));
	if (width <= 0 || height <= 0) return reject("empty rectangle");
	return [left, top, left + width, top + height];
}
function subpaths(path: string) {
	const commands = orangePathCommands(path);
	const groups: (typeof commands)[] = [];
	for (const command of commands) {
		if (command.kind === "M") groups.push([]);
		if (!groups.length) return reject("path start");
		groups.at(-1)!.push(command);
	}
	if (groups.length > 1000) return reject("path inventory");
	return groups;
}
function pathText(commands: ReturnType<typeof orangePathCommands>) {
	return commands.map(command => `${command.kind} ${command.values.join(" ")}`).join(" ");
}
function rectangularPath(commands: ReturnType<typeof orangePathCommands>) {
	const points = commands.filter(command => ["M", "L"].includes(command.kind)).map(command => command.values);
	return (
		commands.map(command => command.kind).join("") === "MLLLZ"
		&& points.length === 4
		&& new Set(points.map(point => point.join(","))).size === 4
		&& new Set(points.map(point => point[0])).size === 2
		&& new Set(points.map(point => point[1])).size === 2
		&& points.every(
			(point, index) => point[0] === points[(index + 3) % 4]![0] || point[1] === points[(index + 3) % 4]![1]
		)
	);
}
function boundedTree(body: string) {
	const tree = parseStateHtml(body);
	const pending = [{ node: tree, depth: 0 }];
	let count = 0;
	while (pending.length) {
		const current = pending.pop()!;
		if (++count > 80000 || current.depth > 32) return reject("DOM bounds");
		for (const child of current.node.childNodes ?? []) pending.push({ node: child, depth: current.depth + 1 });
	}
	return tree;
}
function strokeTangents(start: number[], command: ReturnType<typeof orangePathCommands>[number], end: number[]) {
	const points
		= command.kind === "C" ? [start, command.values.slice(0, 2), command.values.slice(2, 4), end] : [start, end];
	const direction = (origin: number[], candidates: number[][], reverse: boolean) => {
		const point = candidates.find(
			point => Math.abs(point[0]! - origin[0]!) + Math.abs(point[1]! - origin[1]!) > 0.00001
		);
		if (!point) return reject("empty stroke segment");
		const horizontal = (point[0]! - origin[0]!) * (reverse ? -1 : 1);
		const vertical = (point[1]! - origin[1]!) * (reverse ? -1 : 1);
		if (Math.abs(horizontal) > 0.00001 && Math.abs(vertical) > 0.00001) return reject("stroke tangent");
		return [
			Math.abs(horizontal) > 0.00001 ? Math.sign(horizontal) : 0,
			Math.abs(vertical) > 0.00001 ? Math.sign(vertical) : 0
		];
	};
	return {
		entry: direction(start, points.slice(1), false),
		exit: direction(end, points.slice(0, -1).reverse(), true)
	};
}

export function iowaRenderedWords(bbox: string, geometry: IowaSampleGeometry, page: number) {
	if (Buffer.byteLength(bbox) > 4 * 1024 * 1024 || ![1, 2].includes(page)) return reject("word bounds");
	const nativePages = descendants(boundedTree(bbox), node => node.nodeName === "page");
	if (nativePages.length !== 2) return reject("native page set");
	const offsetX = geometry.cropBox[0]!;
	const offsetY = 1008 - geometry.cropBox[3]!;
	const words = descendants(nativePages[page - 1]!, node => node.nodeName === "word")
		.map(node => ({
			text: stateHtmlText(node).normalize("NFKC").replace(/\s/gu, ""),
			box: [
				number(attribute(node, "xmin")) - offsetX,
				number(attribute(node, "ymin")) - offsetY,
				number(attribute(node, "xmax")) - offsetX,
				number(attribute(node, "ymax")) - offsetY
			] as Box
		}))
		.filter(word => word.box[3] - word.box[1] <= 32);
	if (
		!words.length
		|| words.length > 10000
		|| words.some(word => !word.text || word.box[0] >= word.box[2] || word.box[1] >= word.box[3])
	) {
		return reject("word inventory");
	}
	return words;
}
export function inspectIowaSampleSvg(
	bbox: string,
	svg: string,
	geometry: IowaSampleGeometry,
	county: IowaSampleCounty,
	page: number,
	approvals: Readonly<Record<string, string>> = iowaSvgGlyphApprovals
): IowaRenderedPageProof {
	const started = Date.now();
	if (
		!["Monona", "Woodbury"].includes(county)
		|| ![1, 2].includes(page)
		|| Buffer.byteLength(svg) > 4 * 1024 * 1024
		|| Buffer.byteLength(bbox) > 4 * 1024 * 1024
		|| !svg.trimEnd().endsWith("</svg>")
	) {
		return reject("input bounds");
	}
	validateIowaSampleGeometry([geometry, geometry], county);
	const tree = boundedTree(svg);
	const roots = descendants(tree, node => node.nodeName === "svg");
	if (roots.length !== 1) return reject("root inventory");
	const root = roots[0]!;
	attributes(root, ["xmlns", "xlink", "width", "height", "viewBox"]);
	const width = geometry.cropBox[2]! - geometry.cropBox[0]!;
	const height = geometry.cropBox[3]! - geometry.cropBox[1]!;
	const viewBox = attribute(root, "viewBox").trim().split(/\s+/u).map(number);
	if (
		Math.abs(number(attribute(root, "width").replace(/pt$/u, "")) - width) > 0.001
		|| Math.abs(number(attribute(root, "height").replace(/pt$/u, "")) - height) > 0.001
		|| viewBox.length !== 4
		|| viewBox.some((value, index) => Math.abs(value - [0, 0, width, height][index]!) > 0.001)
	) {
		return reject("page geometry");
	}
	const identified = descendants(root, node => Boolean(attribute(node, "id")));
	if (identified.length > 10000 || new Set(identified.map(node => attribute(node, "id"))).size !== identified.length)
		return reject("identifiers");
	const byId = new Map(identified.map(node => [attribute(node, "id"), node]));
	const definitions = new Map(
		identified
			.filter(node => /^glyph-\d+-\d+$/u.test(attribute(node, "id")))
			.map((node) => {
				attributes(node, ["id"]);
				const paths = descendants(node, child => child.nodeName === "path");
				if (
					node.nodeName !== "g"
					|| paths.length > 1
					|| descendants(node, child => !["#text", "path"].includes(child.nodeName)).length
				) {
					return reject("glyph definition");
				}
				for (const path of paths) attributes(path, ["d"]);
				const path = paths[0] ? attribute(paths[0], "d") : "";
				return [
					attribute(node, "id"),
					{ path, box: path.trim() ? bounds(path) : null, sequence: approvals[digest(path)] }
				] as const;
			})
	);
	const clips = new Map(
		identified
			.filter(node => node.nodeName.toLowerCase() === "clippath")
			.map((node) => {
				attributes(node, ["id"]);
				const children = (node.childNodes ?? []).filter(child => child.nodeName !== "#text");
				if (children.length !== 1) return reject("clip definition");
				const child = children[0]!;
				if (child.nodeName === "rect") {
					attributes(child, ["x", "y", "width", "height"]);
					return [attribute(node, "id"), { box: rectangle(child), rectangular: true }] as const;
				}
				if (child.nodeName !== "path") return reject("clip path");
				attributes(child, ["clip-rule", "d"]);
				const path = attribute(child, "d");
				const commands = orangePathCommands(path);
				const points = commands
					.filter(command => ["M", "L"].includes(command.kind))
					.map(command => command.values);
				const box = bounds(path);
				if (attribute(child, "clip-rule") && !["nonzero", "evenodd"].includes(attribute(child, "clip-rule")))
					return reject("clip rule");
				const rectangular
					= commands.map(command => command.kind).join("") === "MLLLZ"
						&& points.length === 4
						&& new Set(points.map(point => point.join(","))).size === 4
						&& new Set(points.map(point => point[0])).size === 2
						&& new Set(points.map(point => point[1])).size === 2
						&& points.every(
							(point, index) =>
								point[0] === points[(index + 3) % 4]![0] || point[1] === points[(index + 3) % 4]![1]
						);
				return [attribute(node, "id"), { box, rectangular }] as const;
			})
	);
	for (const filter of identified.filter(node => node.nodeName === "filter")) {
		attributes(filter, ["id", "x", "y", "width", "height"]);
		const matrices = descendants(filter, child => child.nodeName.toLowerCase() === "fecolormatrix");
		if (
			matrices.length !== 1
			|| descendants(filter, child => !["#text", "feColorMatrix"].includes(child.nodeName)).length
		) {
			return reject("filter definition");
		}
		attributes(matrices[0]!, ["color-interpolation-filters", "values"]);
		const expected
			= attribute(filter, "id") === "filter-remove-color"
				? "0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 1 0"
				: attribute(filter, "id") === "filter-color-to-alpha"
					? "0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 0.2126 0.7152 0.0722 0 0"
					: "";
		if (
			!expected
			|| attribute(matrices[0]!, "values").replace(/\s+/gu, " ").trim() !== expected
			|| attribute(matrices[0]!, "color-interpolation-filters") !== "sRGB"
		) {
			return reject("filter matrix");
		}
	}
	const masks = new Map(
		identified
			.filter(node => node.nodeName === "mask")
			.map((node) => {
				attributes(node, ["id"]);
				const rectangles = descendants(node, child => child.nodeName === "rect");
				const images = descendants(node, child => child.nodeName === "use");
				if (rectangles.length === 1 && images.length === 0) {
					const rectangleNode = rectangles[0]!;
					attributes(rectangleNode, ["x", "y", "width", "height", "fill", "fill-opacity"]);
					rectangle(rectangleNode);
					if (
						attribute(rectangleNode, "fill") !== "rgb(0%, 0%, 0%)"
						|| attribute(rectangleNode, "fill-opacity") !== "0.23"
						|| descendants(node, child => !["#text", "g", "rect"].includes(child.nodeName)).length
					) {
						return reject("watermark mask");
					}
					for (const group of descendants(node, child => child.nodeName === "g")) {
						attributes(group, ["filter"]);
						if (attribute(group, "filter") !== "url(#filter-remove-color)")
							return reject("watermark filter");
					}
					return [attribute(node, "id"), "watermark"] as const;
				}
				if (
					rectangles.length
					|| images.length !== 1
					|| descendants(node, child => !["#text", "g", "use"].includes(child.nodeName)).length
				) {
					return reject("image mask");
				}
				for (const group of descendants(node, child => child.nodeName === "g")) {
					attributes(group, ["filter"]);
					if (attribute(group, "filter") !== "url(#filter-remove-color)") return reject("image filter");
				}
				const image = images[0]!;
				attributes(image, ["href", "filter", "transform"]);
				if (
					attribute(image, "filter") !== "url(#filter-color-to-alpha)"
					|| byId.get(attribute(image, "href").slice(1))?.nodeName !== "image"
				) {
					return reject("image mask reference");
				}
				return [attribute(node, "id"), "image"] as const;
			})
	);
	const glyphs: Glyph[] = [];
	const paints: Paint[] = [];
	let paint = 0;
	let watermarkLayers = 0;
	let images = 0;
	let visited = 0;
	const initial: State = {
		matrix: [1, 0, 0, 1, 0, 0],
		clips: [{ box: [0, 0, width, height], rectangular: true }],
		color: [0, 0, 0],
		fill: true,
		alpha: 1,
		masked: false,
		overlay: false,
		filtered: false,
		references: []
	};
	const pending = [{ node: root, state: initial }];
	const addPaint = (
		box: Box,
		state: State,
		paintColor: Color | undefined,
		alpha: number,
		stroke: boolean,
		detail: Pick<Paint, "ink" | "strokeRadius" | "rectangular"> = {}
	) => {
		for (const clip of state.clips) {
			box = [
				Math.max(box[0], clip.box[0]),
				Math.max(box[1], clip.box[1]),
				Math.min(box[2], clip.box[2]),
				Math.min(box[3], clip.box[3])
			];
		}
		if (box[0] < box[2] && box[1] < box[3])
			paints.push({ box, color: paintColor, alpha, paint: ++paint, stroke, overlay: state.overlay, ...detail });
	};
	while (pending.length) {
		const current = pending.pop()!;
		const node = current.node;
		const tag = node.nodeName.toLowerCase();
		if (Date.now() - started > 30000) return reject("processing duration");
		if (++visited > 100000 || paints.length > 30000 || glyphs.length > 20000) return reject("paint bounds");
		if (tag === "defs") {
			attributes(node, []);
			continue;
		}
		if (tag === "#text") {
			if (node.value?.trim()) return reject("unassigned text");
			continue;
		}
		if (!["svg", "g", "use", "path", "image", "rect"].includes(tag)) return reject("paint structure");
		const state: State = {
			...current.state,
			matrix: compose(current.state.matrix, attribute(node, "transform")),
			clips: [...current.state.clips]
		};
		if (tag === "g") attributes(node, ["id", "fill", "fill-opacity", "clip-path", "mask", "filter"]);
		if (attribute(node, "fill")) {
			state.fill = attribute(node, "fill") !== "none";
			if (state.fill) state.color = color(attribute(node, "fill"));
		}
		state.alpha = opacity(attribute(node, "fill-opacity"), state.alpha);
		if (attribute(node, "filter")) {
			if (
				!/^url\(#filter-(?:remove-color|color-to-alpha)\)$/u.test(attribute(node, "filter"))
				|| byId.get(attribute(node, "filter").slice(5, -1))?.nodeName !== "filter"
			) {
				return reject("filter reference");
			}
			state.filtered = true;
		}
		if (attribute(node, "clip-path")) {
			const match = /^url\(#([^()]+)\)$/u.exec(attribute(node, "clip-path"));
			const clip = match ? clips.get(match[1]!) : undefined;
			if (!clip || state.clips.length >= 16) return reject("clip reference");
			state.clips.push({ box: transformed(clip.box, state.matrix), rectangular: clip.rectangular });
		}
		if (attribute(node, "mask")) {
			const match = /^url\(#([^()]+)\)$/u.exec(attribute(node, "mask"));
			const mask = match ? masks.get(match[1]!) : undefined;
			if (!mask || state.masked || state.overlay) return reject("mask reference");
			if (mask === "watermark") {
				if (++watermarkLayers > 1) return reject("watermark inventory");
				state.overlay = true;
			}
			else {
				state.masked = true;
			}
		}
		if (tag === "use") {
			attributes(node, ["href", "x", "y", "transform", "filter"]);
			const reference = attribute(node, "href");
			if (!/^#[A-Za-z][\w-]*$/u.test(reference)) return reject("use reference");
			const target = byId.get(reference.slice(1));
			if (!target || state.references.includes(reference) || state.references.length >= 16)
				return reject("cyclic reference");
			const coordinateX = number(attribute(node, "x") || "0");
			const coordinateY = number(attribute(node, "y") || "0");
			if (reference.startsWith("#glyph-")) {
				const definition = definitions.get(reference.slice(1));
				if (!definition) return reject("glyph reference");
				if (definition.box) {
					const matrix: Matrix = [...state.matrix];
					matrix[4] += coordinateX * matrix[0];
					matrix[5] += coordinateY * matrix[3];
					const box = transformed(definition.box, matrix);
					glyphs.push({
						box,
						x: matrix[4],
						y: matrix[5],
						sequence: definition.sequence,
						paint: ++paint,
						color: state.color,
						alpha: state.fill ? state.alpha : 0,
						clips: state.clips,
						masked: state.masked || state.overlay,
						filtered: state.filtered,
						transformed: state.matrix.some(
							(value, index) => Math.abs(value - initial.matrix[index]!) > 1e-9
						),
						assigned: false,
						path: definition.path,
						matrix
					});
					if (state.overlay) {
						if (
							state.color.join(",") !== "176,0,0"
							|| box[3] - box[1] < 20
							|| state.alpha !== 1
							|| state.filtered
						) {
							return reject("watermark paint");
						}
						addPaint(box, state, state.color, 0.23, false);
					}
				}
				continue;
			}
			if (!["g", "image"].includes(target.nodeName)) return reject("use target");
			state.references = [...state.references, reference];
			state.matrix = [...state.matrix];
			state.matrix[4] += coordinateX * state.matrix[0];
			state.matrix[5] += coordinateY * state.matrix[3];
			pending.push({ node: target, state });
			continue;
		}
		if (tag === "image") {
			attributes(node, ["id", "x", "y", "width", "height", "href"]);
			const encoded = /^data:image\/png;base64,([A-Za-z\d+/=]+)$/u.exec(attribute(node, "href"));
			if (!encoded || encoded[1]!.length > 4 * 1024 * 1024) return reject("image data");
			const bytes = Buffer.from(encoded[1]!, "base64");
			const box = rectangle(node);
			if (
				bytes.length < 24
				|| bytes.toString("base64") !== encoded[1]
				|| bytes.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a"
				|| bytes.readUInt32BE(16) !== box[2] - box[0]
				|| bytes.readUInt32BE(20) !== box[3] - box[1]
				|| bytes.readUInt32BE(16) * bytes.readUInt32BE(20) > 16 * 1024 * 1024
				|| ++images > 4
				|| state.overlay
			) {
				return reject("image geometry");
			}
			addPaint(transformed(box, state.matrix), state, undefined, 1, false);
			continue;
		}
		if (["path", "rect"].includes(tag) && (state.masked || state.overlay || state.filtered || state.alpha !== 1))
			return reject("unverified paint effects");
		if (tag === "rect") {
			attributes(node, ["x", "y", "width", "height", "fill", "fill-opacity"]);
			if (state.fill) {
				addPaint(transformed(rectangle(node), state.matrix), state, state.color, state.alpha, false, {
					rectangular: true
				});
			}
			continue;
		}
		if (tag === "path") {
			attributes(node, [
				"fill-rule",
				"fill",
				"fill-opacity",
				"stroke",
				"stroke-width",
				"stroke-linecap",
				"stroke-linejoin",
				"stroke-opacity",
				"stroke-miterlimit",
				"d",
				"transform"
			]);
			if (attribute(node, "fill-rule") && !["nonzero", "evenodd"].includes(attribute(node, "fill-rule")))
				return reject("fill rule");
			const groups = subpaths(attribute(node, "d"));
			for (const group of groups) {
				if (state.fill) {
					addPaint(
						transformed(bounds(pathText(group)), state.matrix),
						state,
						state.color,
						state.alpha,
						false,
						{
							ink: rectangularPath(group) ? undefined : iowaInkShape(group, state.matrix),
							rectangular: rectangularPath(group)
						}
					);
				}
				if (attribute(node, "stroke") && attribute(node, "stroke") !== "none") {
					const strokeColor = color(attribute(node, "stroke"));
					const strokeWidth = number(attribute(node, "stroke-width"));
					if (
						strokeWidth <= 0
						|| strokeWidth > 5
						|| opacity(attribute(node, "stroke-opacity"), 1) !== 1
						|| !["square", "round", "butt"].includes(attribute(node, "stroke-linecap"))
						|| !["miter", "round", "bevel"].includes(attribute(node, "stroke-linejoin"))
						|| number(attribute(node, "stroke-miterlimit") || "10") > 10
					) {
						return reject("stroke style");
					}
					let position = group[0]!.values;
					let start = position;
					const tangents: ReturnType<typeof strokeTangents>[] = [];
					for (const command of group.slice(1)) {
						const end = command.kind === "Z" ? start : command.values.slice(-2);
						if (
							Math.abs(end[0]! - position[0]!) + Math.abs(end[1]! - position[1]!) < 0.00001
							&& command.kind !== "C"
						) {
							continue;
						}
						tangents.push(strokeTangents(position, command, end));
						const segment = `M ${position.join(" ")} ${command.kind === "Z" ? `L ${start.join(" ")}` : `${command.kind} ${command.values.join(" ")}`}`;
						const box = transformed(bounds(segment), state.matrix);
						const expansion
							= (strokeWidth / 2) * Math.max(Math.abs(state.matrix[0]), Math.abs(state.matrix[3]));
						addPaint(
							[box[0] - expansion, box[1] - expansion, box[2] + expansion, box[3] + expansion],
							state,
							strokeColor,
							1,
							true,
							{
								ink: iowaInkShape(segment, state.matrix, false),
								strokeRadius:
									expansion
									* (attribute(node, "stroke-linejoin") === "miter"
										|| attribute(node, "stroke-linecap") === "square"
										? Math.SQRT2
										: 1)
							}
						);
						position = end;
						start = group[0]!.values;
					}
					for (let index = group.at(-1)?.kind === "Z" ? 0 : 1; index < tangents.length; index++) {
						const prior = tangents[(index + tangents.length - 1) % tangents.length]!.exit;
						const next = tangents[index]!.entry;
						if (prior[0]! * next[0]! + prior[1]! * next[1]! < 0) return reject("stroke reversal");
					}
				}
			}
			continue;
		}
		for (const child of [...(node.childNodes ?? [])].reverse()) pending.push({ node: child, state });
	}
	const words = iowaRenderedWords(bbox, geometry, page);
	for (const glyph of glyphs.filter(glyph => glyph.box[3] - glyph.box[1] > 20)) {
		if (
			glyph.color.join(",") !== (county === "Monona" ? "176,0,0" : "211,211,211")
			|| glyph.alpha !== 1
			|| glyph.filtered
			|| (county === "Monona" && !glyph.masked)
			|| (county === "Woodbury" && (glyph.masked || glyph.transformed))
		) {
			return reject("watermark glyph");
		}
		if (county === "Woodbury") {
			paints.push({
				box: glyph.box,
				color: glyph.color,
				alpha: 1,
				paint: glyph.paint,
				stroke: false,
				overlay: false
			});
		}
	}
	let characters = 0;
	let matchedGlyphs = 0;
	let minimumContrast = 21;
	let ruleContacts = 0;
	for (const word of words) {
		const matches = glyphs
			.filter(
				glyph =>
					glyph.box[0] >= word.box[0] - 1
					&& glyph.box[2] <= word.box[2] + 1
					&& glyph.box[1] >= word.box[1] - 1
					&& glyph.box[3] <= word.box[3] + 1
			)
			.sort((first, second) => first.x - second.x);
		if (
			matches.map(glyph => glyph.sequence ?? "\uFFFD").join("") !== word.text
			|| matches.some(glyph => glyph.assigned)
		) {
			return reject(`character identity on page ${page} at ${word.box[0]}/${word.box[1]}`);
		}
		for (const glyph of matches) {
			if (Date.now() - started > 30000) return reject("processing duration");
			if (
				glyph.color.join(",") !== "0,0,0"
				|| glyph.alpha !== 1
				|| glyph.masked
				|| glyph.filtered
				|| glyph.transformed
			) {
				return reject("text paint");
			}
			if (glyph.clips.some(clip => !clip.rectangular || !enclosed(glyph.box, clip.box)))
				return reject(`text clipping on page ${page} at ${word.box[0]}/${word.box[1]}`);
			const intersecting = paints.filter((item) => {
				if (!overlaps(glyph.box, item.box)) return false;
				if (!item.ink) return true;
				glyph.ink ??= iowaInkShape(glyph.path, glyph.matrix);
				return iowaInkOverlaps(glyph.ink, item.ink, item.strokeRadius);
			});
			const blackRuleContact = (item: Paint) =>
				item.stroke
				&& item.alpha === 1
				&& item.color?.join(",") === "0,0,0"
				&& item.strokeRadius !== undefined
				&& item.strokeRadius <= 0.31
				&& (item.box[1] >= glyph.y + 0.25
					|| (item.ink?.edges.length === 1
						&& (item.box[2] <= glyph.box[0] + 0.1
							|| item.box[0] >= glyph.box[2] - 0.1
							|| item.box[3] <= glyph.box[1] + 0.1
							|| item.box[1] >= glyph.box[3] - 0.1)));
			if (intersecting.some(item => !item.overlay && item.paint > glyph.paint && !blackRuleContact(item))) {
				return reject(
					`text occlusion on page ${page} at ${word.box[0]}/${word.box[1]} (${JSON.stringify({
						word: word.text,
						sequence: glyph.sequence,
						box: glyph.box,
						baseline: glyph.y,
						paints: intersecting
							.filter(item => !item.overlay && item.paint > glyph.paint)
							.slice(0, 5)
							.map(item => ({ box: item.box, radius: item.strokeRadius, stroke: item.stroke }))
					})})`
				);
			}
			ruleContacts += intersecting.filter(blackRuleContact).length;
			if (intersecting.some(item => !item.color)) return reject("image intersection");
			const covering = intersecting
				.filter(item => !item.overlay && item.rectangular && enclosed(glyph.box, item.box))
				.sort((first, second) => second.paint - first.paint)[0];
			const backgrounds = [
				covering?.color ?? ([255, 255, 255] as Color),
				...intersecting
					.filter(item => !item.overlay && !blackRuleContact(item) && item.paint > (covering?.paint ?? 0))
					.map(item => item.color!)
			];
			const overlay = intersecting.some(item => item.overlay);
			const blend = (value: Color): Color =>
				value.map((component, index) => component * 0.77 + [176, 0, 0][index]! * 0.23) as Color;
			const foregrounds: Color[] = overlay ? [[0, 0, 0], blend([0, 0, 0])] : [[0, 0, 0]];
			const options = overlay ? backgrounds.flatMap(value => [value, blend(value)]) : backgrounds;
			const ratio = Math.min(
				...foregrounds.flatMap(foreground => options.map(background => contrast(foreground, background)))
			);
			if (ratio < 4.5) return reject(`text contrast on page ${page} at ${word.box[0]}/${word.box[1]}`);
			minimumContrast = Math.min(minimumContrast, ratio);
			glyph.assigned = true;
			matchedGlyphs++;
		}
		characters += Array.from(word.text).length;
	}
	for (const glyph of glyphs.filter(glyph => !glyph.assigned)) {
		if (
			glyph.box[3] - glyph.box[1] <= 20
			|| glyph.color.join(",") !== (county === "Monona" ? "176,0,0" : "211,211,211")
			|| (county === "Monona" && !glyph.masked)
		) {
			return reject(
				`unassigned glyph ${JSON.stringify({ box: glyph.box, sequence: glyph.sequence, color: glyph.color })}`
			);
		}
	}
	return {
		page,
		svgSha256: digest(svg),
		bboxSha256: digest(bbox),
		geometrySha256: digest(JSON.stringify(geometry)),
		wordInventorySha256: digest(JSON.stringify(words)),
		words: words.length,
		characters,
		glyphs: matchedGlyphs,
		watermarkLayers,
		images,
		minimumContrast: Math.floor(minimumContrast * 1000) / 1000,
		ruleContacts
	};
}
