import type { StateHtmlNode } from "./state-ballot-html.js";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { crc32, inflateSync } from "node:zlib";
import { stateHtmlAttribute as attribute, stateHtmlDescendants as descendants, parseStateHtml, stateHtmlText } from "./state-ballot-html.js";

const hash = (body: string | Buffer) => createHash("sha256").update(body).digest("hex");
const numeric = /[+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/giu;
const exact = (value: unknown, keys: string[]): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).sort().join("|") === [...keys].sort().join("|"));
const digest = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
export const eastGreenwichImages = [
	{ width: 600, height: 557, sha256: "e8d8b15092dba63a793efefcf825f1b706c904b21c4fc8918ad4ab0d80e26e06", bounds: [55.44, 74.04, 60, 55.68] },
	{ width: 4171, height: 561, sha256: "aa6d5fca07a34ec26367556ea7ea323553c2c4c2562fe36e77884a7a4195d216", bounds: [55.44, 146.04, 417.12, 56.04] },
] as const;

function paeth(left: number, above: number, upperLeft: number) {
	const prediction = left + above - upperLeft;
	const horizontal = Math.abs(prediction - left);
	const vertical = Math.abs(prediction - above);
	const diagonal = Math.abs(prediction - upperLeft);
	return horizontal <= vertical && horizontal <= diagonal ? left : vertical <= diagonal ? above : upperLeft;
}
export function eastGreenwichPngPixels(bytes: Buffer) {
	if (bytes.length > 2 * 1024 * 1024 || !bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) throw new Error("The East Greenwich raster encoding requires review.");
	let offset = 8;
	let width = 0;
	let height = 0;
	let ended = false;
	let dataStarted = false;
	const chunks: Buffer[] = [];
	while (offset < bytes.length) {
		if (offset + 12 > bytes.length || ended) throw new Error("The East Greenwich raster chunks are incomplete.");
		const length = bytes.readUInt32BE(offset);
		const type = bytes.subarray(offset + 4, offset + 8).toString("ascii");
		const end = offset + 12 + length;
		if (end > bytes.length || !/^[a-zA-Z]{4}$/u.test(type) || crc32(bytes.subarray(offset + 4, end - 4)) !== bytes.readUInt32BE(end - 4)) throw new Error("The East Greenwich raster checksum requires review.");
		const chunk = bytes.subarray(offset + 8, end - 4);
		if (type === "IHDR") {
			if (offset !== 8 || length !== 13) throw new Error("The East Greenwich raster header requires review.");
			width = chunk.readUInt32BE(0);
			height = chunk.readUInt32BE(4);
			if (!width || width > 4500 || !height || height > 600 || width * height * 3 > 8 * 1024 * 1024 || chunk[8] !== 8 || chunk[9] !== 2 || chunk[10] || chunk[11] || chunk[12]) throw new Error("The East Greenwich raster dimensions require review.");
		}
		else if (type === "IDAT" && width) {
			dataStarted = true;
			chunks.push(chunk);
		}
		else if (type === "IEND" && !length && dataStarted) {
			ended = true;
		}
		else if (!width || /^[A-Z]/u.test(type) || dataStarted) {
			throw new Error("The East Greenwich raster chunk requires review.");
		}
		offset = end;
	}
	if (!ended || !chunks.length) throw new Error("The East Greenwich raster is incomplete.");
	const stride = width * 3;
	const filtered = inflateSync(Buffer.concat(chunks), { maxOutputLength: (stride + 1) * height });
	if (filtered.length !== (stride + 1) * height) throw new Error("The East Greenwich raster pixel count requires review.");
	const pixels = Buffer.alloc(stride * height);
	for (let row = 0; row < height; row++) {
		const filter = filtered[row * (stride + 1)]!;
		if (filter > 4) throw new Error("The East Greenwich raster filter requires review.");
		for (let column = 0; column < stride; column++) {
			const position = row * stride + column;
			const left = column >= 3 ? pixels[position - 3]! : 0;
			const above = row ? pixels[position - stride]! : 0;
			const upperLeft = row && column >= 3 ? pixels[position - stride - 3]! : 0;
			const prediction = filter === 1 ? left : filter === 2 ? above : filter === 3 ? Math.floor((left + above) / 2) : filter === 4 ? paeth(left, above, upperLeft) : 0;
			pixels[position] = (filtered[row * (stride + 1) + column + 1]! + prediction) % 256;
		}
	}
	return { width, height, sha256: hash(pixels) };
}
function bounded(body: string) {
	if (Buffer.byteLength(body) > 4 * 1024 * 1024 || /<!ENTITY|<!DOCTYPE[^>]*\[|<(?:script|style|foreignObject|animate|set)\b/iu.test(body)) throw new Error("The East Greenwich visual structure requires review.");
	const document = parseStateHtml(body);
	const pending = [{ node: document, depth: 0 }];
	let count = 0;
	while (pending.length) {
		const item = pending.pop()!;
		if (++count > 80000 || item.depth > 64) throw new Error("The East Greenwich visual structure exceeds its bounds.");
		for (const node of item.node.childNodes ?? []) pending.push({ node, depth: item.depth + 1 });
	}
	return document;
}
function wordPages(text: string) {
	const pages = descendants(bounded(text), node => node.nodeName === "page");
	if (pages.length !== 2) throw new Error("The East Greenwich visual word pages require review.");
	return pages.map(page => descendants(page, node => node.nodeName === "word").map(node => ({ text: stateHtmlText(node), left: Number(attribute(node, "xmin")), right: Number(attribute(node, "xmax")), top: Number(attribute(node, "ymin")), bottom: Number(attribute(node, "ymax")) })));
}
function matrix(node: StateHtmlNode) {
	const raw = attribute(node, "transform");
	if (!raw) return [1, 0, 0, 1, 0, 0];
	if (!/^matrix\([^()]+\)$/u.test(raw)) throw new Error("The East Greenwich drawing transform requires review.");
	const values = raw.slice(7, -1).split(/[,\s]+/u).map(Number);
	if (values.length !== 6 || values.some(value => !Number.isFinite(value))) throw new Error("The East Greenwich drawing matrix requires review.");
	return values;
}
function drawing(node: StateHtmlNode) {
	const definition = attribute(node, "d");
	const commands = definition.replace(numeric, "").replace(/[\s,]/gu, "");
	const values = [...definition.matchAll(numeric)].map(item => Number(item[0]));
	const transform = matrix(node);
	if (values.length > 50 || values.length % 2 || values.some(value => !Number.isFinite(value)) || transform[0] !== 1 || transform[1] || transform[2] || Math.abs(transform[3]!) !== 1) throw new Error("The East Greenwich drawing bounds require review.");
	const points = Array.from({ length: values.length / 2 }, (_, index) => [values[index * 2]! + transform[4]!, values[index * 2 + 1]! * transform[3]! + transform[5]!]);
	if (points.some(point => point[0]! < -0.02 || point[0]! > 648.02 || point[1]! < -0.02 || point[1]! > 1260.02)) throw new Error("The East Greenwich drawing lies outside the page.");
	const fill = attribute(node, "fill");
	const stroke = attribute(node, "stroke");
	const width = Number(attribute(node, "stroke-width"));
	if (commands === "ML" && fill === "none" && stroke === "rgb(0%, 0%, 0%)" && width > 0 && width <= 4.2 && (Math.abs(points[0]![0]! - points[1]![0]!) < 0.01 || Math.abs(points[0]![1]! - points[1]![1]!) < 0.01)) return { choice: false, opaque: null };
	if (commands === "MLLLZM" && ["rgb(0%, 0%, 0%)", "rgb(100%, 100%, 100%)", "rgb(90.19928%, 90.19928%, 90.19928%)"].includes(fill) && !stroke && points.length === 5 && points.every((point, index) => Math.abs(point[0]! - points[(index + 1) % points.length]![0]!) < 0.01 || Math.abs(point[1]! - points[(index + 1) % points.length]![1]!) < 0.01)) return { choice: false, opaque: [Math.min(...points.map(point => point[0]!)), Math.min(...points.map(point => point[1]!)), Math.max(...points.map(point => point[0]!)), Math.max(...points.map(point => point[1]!))] };
	if (commands === "MCCCCZM" && fill === "rgb(100%, 100%, 100%)" && stroke === "rgb(0%, 0%, 0%)" && width === 0.24) {
		const horizontal = Math.max(...points.map(point => point[0]!)) - Math.min(...points.map(point => point[0]!));
		const vertical = Math.max(...points.map(point => point[1]!)) - Math.min(...points.map(point => point[1]!));
		if ([8.4, 8.52].some(value => Math.abs(horizontal - value) < 0.02) && [5.52, 5.64].some(value => Math.abs(vertical - value) < 0.02)) return { choice: true, opaque: null };
	}
	throw new Error("The East Greenwich unrecognized nontext drawing requires review.", { cause: { commands, fill, stroke, width, points } });
}
export function inspectEastGreenwichVisualPage(text: string, svg: string, page: number) {
	const words = wordPages(text)[page - 1];
	if (!words?.length || !svg.trimEnd().endsWith("</svg>")) throw new Error("The East Greenwich visual page is incomplete.");
	const roots = descendants(bounded(svg), node => node.nodeName === "svg");
	if (roots.length !== 1 || attribute(roots[0]!, "width") !== "648pt" || attribute(roots[0]!, "height") !== "1260pt" || attribute(roots[0]!, "viewBox") !== "0 0 648 1260") throw new Error("The East Greenwich SVG page bounds require review.");
	const root = roots[0]!;
	const definitions = descendants(root, node => Boolean(attribute(node, "id")));
	const ids = new Set(definitions.map(node => attribute(node, "id")));
	if (ids.size !== definitions.length) throw new Error("The East Greenwich visual identities are repeated.");
	const images = new Map(descendants(root, node => node.nodeName === "image").map((node) => {
		const address = attribute(node, "href");
		if (!/^data:image\/png;base64,[a-zA-Z0-9+/]+={0,2}$/u.test(address) || address.length > 3 * 1024 * 1024) throw new Error("The East Greenwich embedded image requires review.");
		const image = eastGreenwichPngPixels(Buffer.from(address.slice(22), "base64"));
		if (Number(attribute(node, "width")) !== image.width || Number(attribute(node, "height")) !== image.height || attribute(node, "x") !== "0" || attribute(node, "y") !== "0") throw new Error("The East Greenwich raster dimensions disagree.");
		return [attribute(node, "id"), image] as const;
	}));
	const usedImages: { width: number; height: number; sha256: string; bounds: number[] }[] = [];
	const matched = new Set<number>();
	const visibleText: number[][] = [];
	let glyphs = 0;
	let choices = 0;
	const pending = [{ node: root, opacity: 1 }];
	while (pending.length) {
		const { node, opacity } = pending.pop()!;
		if (node.nodeName === "defs") continue;
		if (!["svg", "g", "use", "path", "#text"].includes(node.nodeName) || attribute(node, "style") || (node.nodeName === "g" && attribute(node, "transform"))) throw new Error("The East Greenwich visible SVG element requires review.");
		const currentOpacity = attribute(node, "fill-opacity") ? Number(attribute(node, "fill-opacity")) : opacity;
		if (node.nodeName === "path") {
			if (currentOpacity !== 1) throw new Error("The East Greenwich drawing opacity requires review.");
			const shape = drawing(node);
			choices += Number(shape.choice);
			const covered = shape.opaque && visibleText.find(point => point[0]! > shape.opaque![0]! + 0.02 && point[0]! < shape.opaque![2]! - 0.02 && point[1]! > shape.opaque![1]! + 0.02 && point[1]! < shape.opaque![3]! - 0.02);
			if (covered) throw new Error("The East Greenwich opaque text overlay requires review.", { cause: { covered, bounds: shape.opaque, fill: attribute(node, "fill") } });
		}
		if (node.nodeName === "use") {
			const address = attribute(node, "href");
			if (!ids.has(address.slice(1))) throw new Error("The East Greenwich drawing reference is missing.");
			if (/^#glyph-\d+-\d+$/u.test(address)) {
				if (attribute(node, "transform")) throw new Error("The East Greenwich glyph transform requires review.");
				const left = Number(attribute(node, "x"));
				const top = Number(attribute(node, "y"));
				const matches = words.map((word, index) => ({ word, index })).filter(({ word }) => left >= word.left - 0.5 && left <= word.right + 0.5 && top >= word.top - 3 && top <= word.bottom + 3 && (currentOpacity === 1 || (Math.abs(currentOpacity - 0.300003) < 0.000001 && word.bottom - word.top >= 20 && address.startsWith("#glyph-0-"))));
				if (!matches.length) throw new Error("The East Greenwich visible glyph has no matching extracted word.");
				for (const match of matches) matched.add(match.index);
				if (currentOpacity === 1) visibleText.push([left, top]);
				glyphs++;
			}
			else {
				const image = images.get(address.slice(1));
				const transform = matrix(node);
				if (!image || transform[1] || transform[2] || transform[0]! <= 0 || transform[3]! <= 0 || usedImages.length >= 2) throw new Error("The East Greenwich raster placement requires review.");
				usedImages.push({ ...image, bounds: [transform[4]!, transform[5]!, image.width * transform[0]!, image.height * transform[3]!] });
			}
		}
		for (const child of [...(node.childNodes ?? [])].reverse()) pending.push({ node: child, opacity: currentOpacity });
	}
	if (matched.size !== words.length || usedImages.length !== images.size) throw new Error("The East Greenwich visual and extracted word inventories disagree.");
	return { svgSha256: hash(svg), wordCount: words.length, glyphCount: glyphs, choiceMarks: choices, images: usedImages };
}
export interface EastGreenwichVisualProof {
	textSha256: string;
	pdfSha256: string;
	pages: ReturnType<typeof inspectEastGreenwichVisualPage>[];
}
export function validateEastGreenwichVisualProof(text: string, value: unknown, pdfSha256: string, records: number): asserts value is EastGreenwichVisualProof {
	if (!exact(value, ["textSha256", "pdfSha256", "pages"]) || value.textSha256 !== hash(text) || !digest(pdfSha256) || value.pdfSha256 !== pdfSha256 || !Array.isArray(value.pages) || value.pages.length !== 2) throw new Error("The East Greenwich visual proof requires review.");
	const words = wordPages(text);
	for (const [index, page] of value.pages.entries()) {
		const expectedMarks = index ? words[index]!.filter(word => ["Approve", "Reject"].includes(word.text)).length : records + words[index]!.filter(word => word.text === "Write-in").length;
		if (!exact(page, ["svgSha256", "wordCount", "glyphCount", "choiceMarks", "images"]) || !digest(page.svgSha256) || page.wordCount !== words[index]!.length || !Number.isSafeInteger(page.glyphCount) || Number(page.glyphCount) < page.wordCount || Number(page.glyphCount) > 40000 || page.choiceMarks !== expectedMarks || !expectedMarks || !Array.isArray(page.images) || page.images.length !== (index ? 0 : 2)) throw new Error("The East Greenwich visible choice or word inventory requires review.");
		for (const [imageIndex, image] of page.images.entries()) {
			const expected = eastGreenwichImages[imageIndex]!;
			if (!exact(image, ["width", "height", "sha256", "bounds"]) || image.width !== expected.width || image.height !== expected.height || image.sha256 !== expected.sha256 || !Array.isArray(image.bounds) || image.bounds.length !== 4 || image.bounds.some((item, index) => typeof item !== "number" || !Number.isFinite(item) || Math.abs(item - expected.bounds[index]!) > 0.02)) throw new Error("The East Greenwich emblem or instruction image changed; review before import.");
		}
	}
}
export function createEastGreenwichVisualProof(text: string, drawings: string[], pdfSha256: string, records: number): EastGreenwichVisualProof {
	if (drawings.length !== 2) throw new Error("The East Greenwich drawings are incomplete.");
	const proof = { textSha256: hash(text), pdfSha256, pages: drawings.map((body, index) => inspectEastGreenwichVisualPage(text, body, index + 1)) };
	validateEastGreenwichVisualProof(text, proof, pdfSha256, records);
	return proof;
}
