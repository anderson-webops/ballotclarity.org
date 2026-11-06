import type { StateHtmlNode } from "./state-ballot-html.js";
import type { IowaSampleContext, IowaSampleLine, IowaSampleRead } from "./state-ballot-iowa-county-native.js";
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { stateHtmlAttribute as attribute, stateHtmlDescendants as descendants, parseStateHtml, stateHtmlText } from "./state-ballot-html.js";
import { readIowaSampleFields } from "./state-ballot-iowa-county-native.js";
import { containsControlCharacters } from "./text-validation.js";

export interface IowaSampleGeometry { mediaBox: number[]; cropBox: number[]; rotation: number; userUnit: number }
export interface IowaSampleNativeProof { geometry: IowaSampleGeometry[]; objectsSha256: string; visibleSha256: string; choices: number; names: number }
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const clean = (value: string) => value.normalize("NFKC").replace(/\s+/gu, " ").trim();
const object = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value));

export function validateIowaSampleGeometry(geometry: IowaSampleGeometry[], county: IowaSampleContext["county"]) {
	assert(["Monona", "Woodbury"].includes(county) && Array.isArray(geometry) && geometry.length === 2, "The Iowa PDF page geometry requires review.");
	for (const page of geometry) {
		assert(object(page) && Object.keys(page).sort().join("|") === "cropBox|mediaBox|rotation|userUnit", "The Iowa PDF geometry fields require review.");
		assert(Array.isArray(page.mediaBox) && page.mediaBox.length === 4 && page.mediaBox.every((value, index) => Number.isFinite(value) && Math.abs(value - [0, 0, 612, 1008][index]!) < 0.01), "The Iowa PDF media box requires review.");
		const expected = county === "Monona" ? [18.573, 66.596, 593.28, 974.929] : [0, 0, 612, 1008];
		assert(Array.isArray(page.cropBox) && page.cropBox.length === 4 && page.cropBox.every((value, index) => Number.isFinite(value) && Math.abs(value - expected[index]!) < 0.01) && page.rotation === 0 && page.userUnit === 1, "The Iowa PDF crop, rotation or units require review.");
	}
}

export function inspectIowaSampleGeometry(body: string, county: IowaSampleContext["county"]): IowaSampleGeometry[] {
	assert(Buffer.byteLength(body) <= 4 * 1024 * 1024, "The Iowa PDF object graph exceeds its bounds.");
	const data = JSON.parse(body);
	assert(object(data) && Array.isArray(data.pages) && data.pages.length === 2 && Array.isArray(data.qpdf) && data.qpdf.length === 2 && object(data.qpdf[1]), "The Iowa PDF page graph requires review.");
	const objects = data.qpdf[1];
	assert(Object.keys(objects).length > 0 && Object.keys(objects).length <= 10000, "The Iowa PDF object inventory exceeds its bounds.");
	const pageReferences = new Set<string>();
	const resolve = (reference: unknown): Record<string, unknown> => {
		assert(typeof reference === "string" && /^\d+ \d+ R$/u.test(reference), "The Iowa PDF page reference requires review.");
		const entry = objects[`obj:${reference}`];
		assert(object(entry) && object(entry.value), "The Iowa PDF page object is unavailable.");
		return entry.value;
	};
	const geometry = data.pages.map((page: unknown) => {
		assert(object(page), "The Iowa PDF page record is invalid.");
		assert(typeof page.object === "string" && !pageReferences.has(page.object), "The Iowa PDF page inventory is duplicated.");
		pageReferences.add(page.object);
		const initial = resolve(page.object);
		assert(initial["/Type"] === "/Page", "The Iowa PDF page type requires review.");
		const inherited = (key: string): unknown => {
			let current = initial;
			const seen = new Set<Record<string, unknown>>();
			while (seen.size < 16) {
				assert(!seen.has(current), "The Iowa PDF page inheritance is cyclic.");
				seen.add(current);
				if (current[key] !== undefined) return current[key];
				if (!current["/Parent"]) return undefined;
				current = resolve(current["/Parent"]);
			}
			throw new Error("The Iowa PDF page inheritance exceeds its bounds.");
		};
		const mediaBox = inherited("/MediaBox");
		const cropBox = inherited("/CropBox") ?? mediaBox;
		assert(Array.isArray(mediaBox) && Array.isArray(cropBox), "The Iowa PDF page boxes are unavailable.");
		return { mediaBox, cropBox, rotation: inherited("/Rotate") ?? 0, userUnit: inherited("/UserUnit") ?? 1 } as IowaSampleGeometry;
	});
	validateIowaSampleGeometry(geometry, county);
	return geometry;
}

function nativeTree(body: string) {
	assert(Buffer.byteLength(body) <= 4 * 1024 * 1024, "The Iowa visible-text proof exceeds its bounds.");
	const tree = parseStateHtml(body);
	const pending = [{ node: tree, depth: 0 }];
	let count = 0;
	while (pending.length) {
		const current = pending.pop()!;
		assert(++count <= 80000 && current.depth <= 64, "The Iowa visible-text structure exceeds its bounds.");
		for (const child of current.node.childNodes ?? []) pending.push({ node: child, depth: current.depth + 1 });
	}
	return tree;
}

function visibleColumns(tree: StateHtmlNode, context: IowaSampleContext): IowaSampleLine[][][] {
	const pages = descendants(tree, node => node.nodeName === "page");
	assert(pages.length === 2, "The Iowa visible-text page inventory requires review.");
	const fonts = new Map<string, { size: number; color: string }>();
	const fontSpecifications = descendants(tree, candidate => candidate.nodeName === "fontspec");
	assert(fontSpecifications.length > 0 && fontSpecifications.length <= 256, "The Iowa visible font inventory exceeds its bounds.");
	for (const node of fontSpecifications) {
		const id = attribute(node, "id");
		const value = { size: Number(attribute(node, "size")), color: attribute(node, "color") };
		assert(id && Number.isFinite(value.size) && value.size > 0 && value.size <= 128 && /^#[a-f\d]{6}$/iu.test(value.color), "The Iowa visible font specification requires review.");
		if (fonts.has(id)) assert.deepEqual(fonts.get(id), value, "The Iowa visible font ID is ambiguous.");
		fonts.set(id, value);
	}
	const bounds = context.county === "Monona" ? [19, 211, 403, 593.28] : [33, 215, 395, 577];
	return pages.map((page, pageIndex) => {
		assert(Number(attribute(page, "width")) === 612 && Number(attribute(page, "height")) === 1008, "The Iowa visible page dimensions require review.");
		const columns: { text: string; left: number; top: number; bottom: number }[][] = [[], [], []];
		const textNodes = descendants(page, candidate => candidate.nodeName === "text");
		assert(textNodes.length <= 10000, "The Iowa visible text inventory exceeds its bounds.");
		for (const node of textNodes) {
			const value = clean(stateHtmlText(node));
			const left = Number(attribute(node, "left"));
			const top = Number(attribute(node, "top"));
			const width = Number(attribute(node, "width"));
			const height = Number(attribute(node, "height"));
			const font = fonts.get(attribute(node, "font"));
			assert(value && !containsControlCharacters(value) && [left, top, width, height].every(Number.isFinite) && width > 0 && height > 0 && font, "The Iowa visible text geometry requires review.");
			if (font.size > 20 || height > 20) {
				const watermark = context.county === "Monona" ? font.size === 100 && font.color === "#b00000" && /^(?:SAMPLE|BALLOT)$/u.test(value) : font.size === 128 && font.color === "#d3d3d3" && value === "SAMPLE";
				assert(watermark || (context.county === "Woodbury" && font.size === 20 && font.color === "#000000" && /^20\d{2} General Election$/u.test(value)), "The Iowa large visible-text layer requires review.");
				continue;
			}
			assert(font.color === "#000000", "The Iowa visible text color requires review.");
			const column = bounds.findIndex((boundary, index) => index < 3 && left >= boundary - 1 && left < bounds[index + 1]! - 1);
			if (column < 0 || top < (context.county === "Monona" ? 33 : 25) || top + height > (context.county === "Monona" ? 942 : 978)) continue;
			if (pageIndex > 0 || top > 250) assert(left + width <= bounds[column + 1]! + 1, "An Iowa visible text field crosses columns.");
			columns[column]!.push({ text: value, left, top, bottom: top + height });
			assert(columns[column]!.length <= 1500, "The Iowa visible column inventory exceeds its bounds.");
		}
		return columns.map((values, column) => {
			const lines: { top: number; bottom: number; parts: typeof values }[] = [];
			for (const value of values.sort((first, second) => first.top - second.top || first.left - second.left)) {
				const existing = lines.find(line => Math.min(line.bottom, value.bottom) - Math.max(line.top, value.top) >= Math.min(line.bottom - line.top, value.bottom - value.top) * 0.5);
				if (existing) {
					existing.parts.push(value);
					existing.top = Math.min(existing.top, value.top);
					existing.bottom = Math.max(existing.bottom, value.bottom);
				}
				else {
					lines.push({ top: value.top, bottom: value.bottom, parts: [value] });
				}
			}
			return lines.sort((first, second) => first.top - second.top).map(line => ({ page: pageIndex + 1, column: column + 1, ymin: line.top, ymax: line.bottom, text: line.parts.sort((first, second) => first.left - second.left).map(value => value.text).join(" ") }));
		});
	});
}

export function verifyIowaSampleNative(parsed: IowaSampleRead, visible: string, geometry: IowaSampleGeometry[], objectsSha256: string, context: IowaSampleContext): IowaSampleNativeProof {
	validateIowaSampleGeometry(geometry, context.county);
	assert(/^[a-f\d]{64}$/u.test(objectsSha256), "The Iowa PDF object provenance requires review.");
	const tree = nativeTree(visible);
	const pages = descendants(tree, node => node.nodeName === "page");
	assert(pages.length === 2, "The Iowa native page set requires review.");
	const header = clean(descendants(pages[0]!, node => node.nodeName === "text" && Number(attribute(node, "top")) < 150).map(stateHtmlText).join(" "));
	assert(header.includes(`November ${Number(context.electionDate.slice(-2))}, ${context.electionDate.slice(0, 4)}`) && header.includes("General Election") && new RegExp(`${context.county} County|County of ${context.county}`, "iu").test(header), "The Iowa visible-text election identity requires review.");
	const independent = readIowaSampleFields(visibleColumns(tree, context), context);
	assert.deepEqual(independent.records, parsed.records, "The Iowa native paths disagree on candidate or retention fields.");
	const offices = (value: IowaSampleRead) => value.contests.map(({ office, scope, districtCode, jurisdiction, team, voteLimit, nonpartisanOffice, printedCaption, page, column, style }) => ({ office, scope, districtCode, jurisdiction, team, voteLimit, nonpartisanOffice, printedCaption, page, column, style }));
	assert.deepEqual(offices(independent), offices(parsed), "The Iowa native paths disagree on offices or vote limits.");
	assert.equal(independent.questionLines.map(line => line.text).join(" "), parsed.questionLines.map(line => line.text).join(" "), "The Iowa native paths disagree on measure-column text.");
	for (const claim of parsed.claims) {
		const other = independent.claims.find(candidate => candidate.key === claim.key && candidate.sourceName === claim.sourceName);
		assert(other && other.page === claim.page && other.column === claim.column && Math.abs(other.ymin - claim.ymin) <= 6, "The Iowa native name coordinates disagree.");
	}
	return { geometry, objectsSha256, visibleSha256: hash(visible), choices: parsed.records.length, names: parsed.claims.length };
}
