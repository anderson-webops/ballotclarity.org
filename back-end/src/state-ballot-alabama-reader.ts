import type {
	AlabamaContent,
	AlabamaFontGlyph,
	AlabamaGlyph,
	AlabamaPaint,
	AlabamaPdfDictionary,
	AlabamaPdfDocument,
	AlabamaStroke,
	AlabamaTextSpan,
	AlabamaToken
} from "./state-ballot-alabama-types.js";
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { createAlabamaFontVerifier } from "./state-ballot-alabama-fonts.js";
import { inspectAlabamaObjects } from "./state-ballot-alabama-objects.js";

const identity = () => [1, 0, 0, 1, 0, 0];
function plain(value: unknown): value is AlabamaPdfDictionary {
	return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
function dictionary(value: unknown): AlabamaPdfDictionary {
	if (!plain(value)) throw new Error("Missing PDF dictionary.");
	return value;
}
function finiteNumber(value: unknown): number {
	if (typeof value !== "number" || !Number.isFinite(value)) throw new Error("Invalid PDF numeric property.");
	return value;
}
function booleanValue(value: unknown): boolean {
	if (typeof value !== "boolean") throw new Error("Invalid PDF boolean property.");
	return value;
}
function stringValue(value: unknown): string {
	if (typeof value !== "string") throw new Error("Invalid PDF string property.");
	return value;
}
function numericToken(value: AlabamaToken): number {
	if (value.kind !== "number") throw new Error("Invalid PDF numeric token.");
	return value.value;
}
interface FontProgram {
	glyph: (code: number) => AlabamaFontGlyph;
	verify: ReturnType<typeof createAlabamaFontVerifier>;
}
interface FontData {
	baseFont: string;
	first: number;
	widths: number[];
	glyph?: FontProgram["glyph"];
	verify?: FontProgram["verify"];
	bounds: number[];
	decode: (code: number) => string;
}
interface GraphicsState {
	matrix: number[];
	clip: number[];
	unknownClip: boolean;
	font: string | null;
	size: number;
	spacing: number;
	wordSpacing: number;
	horizontalScale: number;
	leading: number;
	rise: number;
	render: number;
	alpha: number;
	fill: string;
	fillSpace: string;
	overprint: boolean;
	blend: string;
	lineWidth: number;
	lineCap: number;
	lineJoin: number;
	dashed: boolean;
	strokeAlpha: number;
	stroke: string;
	strokeSpace: string;
	strokeOverprint: boolean;
	overprintMode: number;
	miterLimit?: number;
}
interface DrawingPath {
	rectangles: number[][];
	segments: number[][][];
	curves: number[][][];
	points: number[][];
	previous: number[] | null;
	beginning: number[] | null;
	unknown: boolean;
}
function multiply(first: number[], second: number[]) {
	const result = [
		first[0] * second[0] + first[2] * second[1],
		first[1] * second[0] + first[3] * second[1],
		first[0] * second[2] + first[2] * second[3],
		first[1] * second[2] + first[3] * second[3],
		first[0] * second[4] + first[2] * second[5] + first[4],
		first[1] * second[4] + first[3] * second[5] + first[5]
	];
	if (result.some(value => !Number.isFinite(value) || Math.abs(value) > 1000000))
		throw new Error("The composed PDF matrix exceeds its bounds.");
	return result;
}
function point(matrix: number[], horizontal: number, vertical: number) {
	return [
		matrix[0] * horizontal + matrix[2] * vertical + matrix[4],
		matrix[1] * horizontal + matrix[3] * vertical + matrix[5]
	];
}
function bounds(points: number[][]) {
	return [
		Math.min(...points.map(item => item[0])),
		Math.min(...points.map(item => item[1])),
		Math.max(...points.map(item => item[0])),
		Math.max(...points.map(item => item[1]))
	];
}
function rectangle(matrix: number[], left: number, bottom: number, width: number, height: number) {
	return bounds(
		[
			[left, bottom],
			[left + width, bottom],
			[left, bottom + height],
			[left + width, bottom + height]
		].map(([horizontal, vertical]) => point(matrix, horizontal, vertical))
	);
}
function intersection(first: number[], second: number[]) {
	return [
		Math.max(first[0], second[0]),
		Math.max(first[1], second[1]),
		Math.min(first[2], second[2]),
		Math.min(first[3], second[3])
	];
}
const empty = (box: number[]) => box[0] >= box[2] || box[1] >= box[3];
function inside(inner: number[], outer: number[]) {
	return inner[0] >= outer[0] - 0.005
		&& inner[1] >= outer[1] - 0.005
		&& inner[2] <= outer[2] + 0.005
		&& inner[3] <= outer[3] + 0.005;
}
export function tokenizePdfContent(body: string): Generator<AlabamaToken> {
	if (typeof body !== "string" || Buffer.byteLength(body, "latin1") > 12 * 1024 * 1024)
		throw new Error("Content exceeds its bounds.");
	let position = 0;
	let count = 0;
	const whitespace = (character: string) => /[\0\t\n\f\r ]/u.test(character);
	const delimiter = (character: string) => whitespace(character) || "()<>[]{}/%".includes(character);
	function next(depth = 0): AlabamaToken | null {
		if (depth > 16 || ++count > 1500000) throw new Error("Content token budget exceeded.");
		while (position < body.length) {
			if (whitespace(body[position])) {
				position++;
			}
			else if (body[position] === "%") {
				while (position < body.length && !["\n", "\r"].includes(body[position])) position++;
			}
			else {
				break;
			}
		}
		if (position === body.length) return null;
		const start = position;
		const character = body[position++];
		if (character === "(") {
			const bytes = [];
			let nesting = 1;
			while (position < body.length && nesting) {
				let current = body[position++];
				if (current === "\\") {
					current = body[position++];
					if (current === undefined) throw new Error("Unterminated escape.");
					if (current === "\r" || current === "\n") {
						if (current === "\r" && body[position] === "\n") position++;
						continue;
					}
					if (/[0-7]/u.test(current)) {
						let octal = current;
						for (
							let index = 0;
							index < 2 && position < body.length && /[0-7]/u.test(body[position]);
							index++
						)
							octal += body[position++];
						bytes.push(Number.parseInt(octal, 8) & 255);
					}
					else {
						bytes.push(
							({ n: 10, r: 13, t: 9, b: 8, f: 12 } as Record<string, number>)[current]
							?? current.charCodeAt(0)
						);
					}
				}
				else if (current === "(") {
					if (++nesting > 16) throw new Error("String nesting exceeded.");
					bytes.push(40);
				}
				else if (current === ")") {
					if (--nesting) bytes.push(41);
				}
				else if (current === "\r") {
					if (body[position] === "\n") position++;
					bytes.push(10);
				}
				else {
					bytes.push(current.charCodeAt(0));
				}
				if (bytes.length > 65536) throw new Error("String exceeds its bounds.");
			}
			if (nesting) throw new Error("Unterminated string.");
			return { kind: "bytes", bytes: Buffer.from(bytes) };
		}
		if (character === "[") {
			const values = [];
			for (;;) {
				const value = next(depth + 1);
				if (!value) throw new Error("Unterminated array.");
				if (value.kind === "close-array") break;
				values.push(value);
				if (values.length > 4096) throw new Error("Array exceeds its bounds.");
			}
			return { kind: "array", values };
		}
		if (character === "]") return { kind: "close-array" };
		if (character === "<" && body[position] === "<") {
			position++;
			const entries: [string, AlabamaToken][] = [];
			for (;;) {
				const key = next(depth + 1);
				if (!key) throw new Error("Unterminated dictionary.");
				if (key.kind === "close-dictionary") break;
				if (key.kind !== "name") throw new Error("Invalid dictionary key.");
				const value = next(depth + 1);
				if (!value) throw new Error("Missing dictionary value.");
				entries.push([key.value, value]);
				if (entries.length > 64) throw new Error("Dictionary exceeds its bounds.");
			}
			if (new Set(entries.map(entry => entry[0])).size !== entries.length)
				throw new Error("Duplicate dictionary key.");
			return { kind: "dictionary", entries };
		}
		if (character === ">" && body[position] === ">") {
			position++;
			return { kind: "close-dictionary" };
		}
		if (character === "<") {
			let hexadecimal = "";
			while (position < body.length && body[position] !== ">") {
				const current = body[position++];
				if (!whitespace(current)) {
					if (!/[\da-f]/iu.test(current)) throw new Error("Invalid hexadecimal string.");
					hexadecimal += current;
					if (hexadecimal.length > 131072) throw new Error("Hexadecimal string exceeds bounds.");
				}
			}
			if (body[position++] !== ">") throw new Error("Unterminated hexadecimal string.");
			return {
				kind: "bytes",
				bytes: Buffer.from(hexadecimal.length % 2 ? `${hexadecimal}0` : hexadecimal, "hex")
			};
		}
		if (character === "/") {
			while (position < body.length && !delimiter(body[position])) position++;
			const value = body.slice(start, position);
			if (value.length > 128 || value.includes("#")) throw new Error("Unsupported encoded resource name.");
			return { kind: "name", value };
		}
		if (">{}".includes(character)) throw new Error("Unexpected delimiter.");
		while (position < body.length && !delimiter(body[position])) position++;
		const value = body.slice(start, position);
		if (value.length > 128) throw new Error("Oversized token.");
		if (/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/u.test(value)) {
			const number = Number(value);
			if (!Number.isFinite(number) || Math.abs(number) > 1000000) throw new Error("Number exceeds its bounds.");
			return { kind: "number", value: number };
		}
		return { kind: "operator", value };
	}
	return (function* () {
		for (;;) {
			const token = next();
			if (!token) return;
			yield token;
		}
	})();
}
function trueType(program: Buffer): (code: number) => AlabamaFontGlyph {
	if (program.length < 64 || program.length > 2 * 1024 * 1024 || program.readUInt32BE(0) !== 0x10000)
		throw new Error("Unsupported TrueType envelope.");
	const count = program.readUInt16BE(4);
	if (!count || count > 64 || 12 + count * 16 > program.length) throw new Error("Invalid font table inventory.");
	const tables = new Map<string, Buffer>();
	const spans: number[][] = [];
	for (let index = 0; index < count; index++) {
		const offset = 12 + index * 16;
		const name = program.subarray(offset, offset + 4).toString("ascii");
		const start = program.readUInt32BE(offset + 8);
		const length = program.readUInt32BE(offset + 12);
		if (
			start < 12 + count * 16
			|| start + length > program.length
			|| tables.has(name)
			|| spans.some(span => start < span[1] && start + length > span[0])
		) {
			throw new Error("Invalid font table range.");
		}
		tables.set(name, program.subarray(start, start + length));
		if (length) spans.push([start, start + length]);
	}
	const head = tables.get("head");
	const maximum = tables.get("maxp");
	const locations = tables.get("loca");
	const outlines = tables.get("glyf");
	const cmap = tables.get("cmap");
	if (
		!head
		|| head.length !== 54
		|| head.readUInt32BE(12) !== 0x5F0F3CF5
		|| !maximum
		|| maximum.length !== 32
		|| !locations
		|| !outlines
		|| !cmap
		|| cmap.length < 12
		|| cmap.readUInt16BE(0) !== 0
	) {
		throw new Error("Missing bounded font tables.");
	}
	const units = head.readUInt16BE(18);
	const glyphCount = maximum.readUInt16BE(4);
	const format = head.readInt16BE(50);
	const width = format === 0 ? 2 : format === 1 ? 4 : 0;
	if (units < 16 || !glyphCount || glyphCount > 20000 || !width || locations.length !== (glyphCount + 1) * width)
		throw new Error("Invalid glyph locations.");
	const offsets = Array.from({ length: glyphCount + 1 }, (_, index) =>
		width === 2 ? locations.readUInt16BE(index * 2) * 2 : locations.readUInt32BE(index * 4));
	if (offsets.some((offset, index) => offset > outlines.length || (index && offset < offsets[index - 1])))
		throw new Error("Invalid glyph program bounds.");
	const mappings: number[] = [];
	const encodings = cmap.readUInt16BE(2);
	if (!encodings || encodings > 16 || 4 + encodings * 8 > cmap.length) throw new Error("Invalid cmap inventory.");
	for (let index = 0; index < encodings; index++) {
		const offset = 4 + index * 8;
		if (cmap.readUInt16BE(offset) === 3 && cmap.readUInt16BE(offset + 2) === 1)
			mappings.push(cmap.readUInt32BE(offset + 4));
	}
	if (mappings.length !== 1) throw new Error("A unique Unicode cmap is required.");
	const start = mappings[0];
	if (start + 16 > cmap.length || cmap.readUInt16BE(start) !== 4) throw new Error("Unsupported Unicode cmap.");
	const end = start + cmap.readUInt16BE(start + 2);
	const segments = cmap.readUInt16BE(start + 6) / 2;
	if (
		!Number.isInteger(segments)
		|| !segments
		|| segments > 512
		|| start + 16 + segments * 8 > end
		|| end > cmap.length
	) {
		throw new Error("Invalid cmap segments.");
	}
	const decoder = new TextDecoder("windows-1252");
	return (code) => {
		const character = decoder.decode(Buffer.from([code]));
		const unicode = character.codePointAt(0)!;
		let glyph = 0;
		let previous = -1;
		for (let index = 0; index < segments; index++) {
			const last = cmap.readUInt16BE(start + 14 + index * 2);
			const first = cmap.readUInt16BE(start + 16 + segments * 2 + index * 2);
			if (first > last || first <= previous) throw new Error("Overlapping cmap segments.");
			previous = last;
			if (unicode < first || unicode > last) continue;
			const delta = cmap.readInt16BE(start + 16 + segments * 4 + index * 2);
			const position = start + 16 + segments * 6 + index * 2;
			const offset = cmap.readUInt16BE(position);
			if (!offset) {
				glyph = (unicode + delta) & 65535;
			}
			else {
				const address = position + offset + (unicode - first) * 2;
				if (address + 2 > end) throw new Error("Invalid cmap address.");
				const value = cmap.readUInt16BE(address);
				glyph = value ? (value + delta) & 65535 : 0;
			}
		}
		if (!glyph || glyph >= glyphCount) throw new Error(`Unmapped font character: ${code}`);
		const bytes = outlines.subarray(offsets[glyph], offsets[glyph + 1]);
		if (bytes.length && bytes.length < 10) throw new Error("Truncated glyph.");
		return {
			character,
			unicode,
			glyph,
			units,
			ink: bytes.length
				? [bytes.readInt16BE(2), bytes.readInt16BE(4), bytes.readInt16BE(6), bytes.readInt16BE(8)]
				: null,
			outline: bytes
		};
	};
}
export function alabamaTrueTypeMappings(program: Buffer, codes: number[]) {
	if (
		!Array.isArray(codes)
		|| codes.length > 256
		|| codes.some(code => !Number.isInteger(code) || code < 0 || code > 255)
		|| new Set(codes).size !== codes.length
	) {
		throw new Error("Font mapping evidence exceeds its bounds.");
	}
	const decode = trueType(program);
	return codes.map(code => ({ code, ...decode(code) }));
}
export function readAlabamaContent(value: unknown): AlabamaContent {
	const objectProof = inspectAlabamaObjects(value);
	const document = value as AlabamaPdfDocument;
	if (
		!plain(document)
		|| !Array.isArray(document.pages)
		|| document.pages.length !== 1
		|| document.qpdf?.length !== 2
		|| !plain(document.qpdf[1])
	) {
		throw new Error("Unsupported object envelope.");
	}
	const objects = document.qpdf[1];
	if (Object.keys(objects).length > 12000) throw new Error("Object budget exceeded.");
	const resolved = (value: unknown): unknown =>
		typeof value === "string" && /^\d+ 0 R$/u.test(value) ? objects[`obj:${value}`]?.value : value;
	const stream = (reference: unknown) => {
		const body = objects[`obj:${reference}`]?.stream?.data;
		if (typeof body !== "string" || body.length > 16 * 1024 * 1024) throw new Error("Missing bounded stream.");
		return Buffer.from(body, "base64");
	};
	const page = dictionary(resolved(document.pages[0].object));
	assert.deepEqual(page["/Contents"], document.pages[0].contents);
	assert.deepEqual(page["/MediaBox"], [0, 0, 1224, 792]);
	assert.deepEqual(page["/CropBox"], page["/MediaBox"]);
	const resources = dictionary(resolved(page["/Resources"]));
	const fonts = dictionary(resolved(resources["/Font"]));
	const fontCache = new Map<string, FontData>();
	const programCache = new Map<string, FontProgram>();
	function fontData(name: string): FontData {
		const cached = fontCache.get(name);
		if (cached) return cached;
		const font = resolved(fonts[name]);
		if (!plain(font) || font["/Type"] !== "/Font" || !["/TrueType", "/Type1"].includes(String(font["/Subtype"])))
			throw new Error("Unsupported font resource.");
		const descriptor = dictionary(resolved(font["/FontDescriptor"]));
		const widths = resolved(font["/Widths"]);
		const first = finiteNumber(font["/FirstChar"]);
		const last = finiteNumber(font["/LastChar"]);
		const baseFont = font["/BaseFont"];
		const fontBounds = descriptor["/FontBBox"];
		if (
			typeof baseFont !== "string"
			|| !Number.isSafeInteger(first)
			|| !Number.isSafeInteger(last)
			|| first < 0
			|| last > 255
			|| first > last
			|| !Array.isArray(fontBounds)
			|| fontBounds.length !== 4
			|| fontBounds.some(
				value => typeof value !== "number" || !Number.isFinite(value) || Math.abs(value) > 1000000
			)
			|| fontBounds[0] > fontBounds[2]
			|| fontBounds[1] > fontBounds[3]
		) {
			throw new Error("Invalid font identity or geometry.");
		}
		if (
			!plain(descriptor)
			|| !Array.isArray(widths)
			|| widths.length !== last - first + 1
			|| widths.some(value => typeof value !== "number" || value < 0 || value > 3000)
		) {
			throw new Error("Invalid font widths.");
		}
		let glyph: FontProgram["glyph"] | undefined, verify: FontProgram["verify"] | undefined;
		let decode = (code: number) => new TextDecoder("windows-1252").decode(Buffer.from([code]));
		if (font["/Subtype"] === "/TrueType") {
			if (
				font["/Encoding"] !== "/WinAnsiEncoding"
				|| !/^\/[A-Z]{6}\+Arial(?:MT|-BoldMT|Narrow|-Narrow|Narrow-Bold)$/u.test(baseFont)
			) {
				throw new Error("Unsupported font encoding.");
			}
			const reference = descriptor["/FontFile2"];
			if (typeof reference !== "string") throw new Error("Missing TrueType font-program identity.");
			if (!programCache.has(reference)) {
				if (programCache.size >= 16) throw new Error("The Alabama native font-program budget is exceeded.");
				const program = stream(reference);
				programCache.set(reference, { glyph: trueType(program), verify: createAlabamaFontVerifier(program) });
			}
			({ glyph, verify } = programCache.get(reference)!);
		}
		else {
			const encoding = dictionary(resolved(font["/Encoding"]));
			if (
				baseFont.slice(7) !== "+MyriadPro-Regular"
				|| encoding?.["/BaseEncoding"] !== "/WinAnsiEncoding"
				|| JSON.stringify(encoding["/Differences"]) !== "[31,\"/f_f_i\"]"
			) {
				throw new Error("Unreviewed CFF encoding.");
			}
			const unicode = stream(font["/ToUnicode"]).toString("ascii");
			const count = /(\d+) beginbfchar([\s\S]*?)endbfchar/u.exec(unicode);
			if (!count) throw new Error("Missing Myriad Unicode mapping.");
			const pairs = [...count[2].matchAll(/<([\da-f]{2})> <([\da-f]{4}(?:[\da-f]{4})*)>/giu)];
			if (pairs.length !== Number(count[1]) || count[2].replace(/<[\da-f]{2}> <(?:[\da-f]{4})+>/giu, "").trim())
				throw new Error("Invalid Myriad Unicode mapping.");
			const mappings = new Map<number, string>();
			for (const pair of pairs) {
				const code = Number.parseInt(pair[1], 16);
				const value = pair[2]
					.match(/.{4}/gu)!
					.map(part => String.fromCharCode(Number.parseInt(part, 16)))
					.join("");
				if (mappings.has(code) || value !== (code === 31 ? "ffi" : decode(code)))
					throw new Error("Conflicting Myriad Unicode mapping.");
				mappings.set(code, value);
			}
			decode = (code) => {
				if (!mappings.has(code)) throw new Error("Missing CFF Unicode character.");
				return mappings.get(code)!;
			};
		}
		const data: FontData = { baseFont, first, widths, glyph, verify, bounds: fontBounds, decode };
		fontCache.set(name, data);
		return data;
	}
	const body = document.pages[0].contents.map(reference => stream(reference).toString("latin1")).join("");
	const tokens = tokenizePdfContent(body);
	let state: GraphicsState = {
		matrix: identity(),
		clip: [0, 0, 1224, 792],
		unknownClip: false,
		font: null,
		size: 1,
		spacing: 0,
		wordSpacing: 0,
		horizontalScale: 1,
		leading: 0,
		rise: 0,
		render: 0,
		alpha: 1,
		fill: "black",
		fillSpace: "/DeviceGray",
		overprint: false,
		blend: "/Normal",
		lineWidth: 1,
		lineCap: 0,
		lineJoin: 0,
		dashed: false,
		strokeAlpha: 1,
		stroke: "black",
		strokeSpace: "/DeviceGray",
		strokeOverprint: false,
		overprintMode: 0
	};
	let textMatrix = identity();
	let lineMatrix = identity();
	let inText = false;
	let currentPath: DrawingPath = {
		rectangles: [],
		segments: [],
		curves: [],
		points: [],
		previous: null,
		beginning: null,
		unknown: false
	};
	let pendingClip = false;
	let markedDepth = 0;
	const stack: GraphicsState[] = [];
	const operands: AlabamaToken[] = [];
	const glyphs: AlabamaGlyph[] = [];
	const painted: AlabamaPaint[] = [];
	const strokes: AlabamaStroke[] = [];
	const textSpans: AlabamaTextSpan[] = [];
	const operatorCounts: Record<string, number> = {};
	let sourceCharacter = 0;
	let sourceNonspace = 0;
	let hidden = 0;
	let partial = 0;
	let totalGlyphs = 0;
	let operations = 0;
	function paint(item: AlabamaPaint) {
		if (item.bounds.some(value => !Number.isFinite(value))) throw new Error("Invalid paint bounds.");
		if (empty(item.bounds) || item.alpha === 0) return;
		if (painted.length >= 20000) throw new Error("Visible paint budget exceeded.");
		painted.push(item);
	}
	const numbers = (count: number): number[] => {
		if (operands.length !== count || operands.some(item => item.kind !== "number"))
			throw new Error("Wrong numeric operands.");
		return operands.map((item) => {
			if (item.kind !== "number") throw new Error("Wrong numeric operands.");
			return item.value;
		});
	};
	const move = (horizontal: number, vertical: number) => {
		textMatrix = multiply(textMatrix, [1, 0, 0, 1, horizontal, vertical]);
	};
	const nextLine = (horizontal: number, vertical: number) => {
		lineMatrix = multiply(lineMatrix, [1, 0, 0, 1, horizontal, vertical]);
		textMatrix = [...lineMatrix];
	};
	function show(value: AlabamaToken) {
		if (!inText || value.kind !== "bytes" || !state.font) throw new Error("Text outside a bounded text object.");
		const data = fontData(state.font);
		for (const code of value.bytes) {
			if (++totalGlyphs > 200000) throw new Error("Glyph budget exceeded.");
			const width = data.widths[code - data.first];
			if (width === undefined) throw new Error(`Character outside font widths: ${code}`);
			const position = multiply(state.matrix, textMatrix);
			const advance
				= ((width * state.size) / 1000 + state.spacing + (code === 32 ? state.wordSpacing : 0))
					* state.horizontalScale;
			let information: AlabamaFontGlyph = data.glyph
				? data.glyph(code)
				: {
						character: data.decode(code),
						unicode: 0,
						glyph: 0,
						units: 1000,
						ink: data.bounds,
						outline: Buffer.alloc(0)
					};
			if (information.ink && information.character.trim()) {
				sourceNonspace++;
				const [left, bottom, right, top] = information.ink;
				const ink = rectangle(
					position,
					((left * state.size) / information.units) * state.horizontalScale,
					(bottom * state.size) / information.units + state.rise,
					(((right - left) * state.size) / information.units) * state.horizontalScale,
					((top - bottom) * state.size) / information.units
				);
				if (state.unknownClip) throw new Error("Text has an unsupported clip.");
				if (empty(intersection(ink, state.clip)) || state.render === 3 || state.alpha === 0) {
					hidden++;
				}
				else {
					if (glyphs.length >= 25000) throw new Error("Visible glyph budget exceeded.");
					if (data.verify) {
						try {
							information = { ...information, ...data.verify(information) };
						}
						catch (error) {
							information = {
								...information,
								fontProven: false,
								fontProofError: error instanceof Error ? error.message : "Unproved font glyph."
							};
						}
					}
					const clipped = !inside(ink, state.clip);
					if (clipped) partial++;
					glyphs.push({
						character: information.character,
						font: state.font,
						fontParsed: Boolean(data.glyph),
						fontProven: information.fontProven === true,
						...(information.fontProofError ? { fontProofError: information.fontProofError } : {}),
						ink,
						origin: point(position, 0, state.rise),
						clip: [...state.clip],
						clipped,
						fill: state.fill,
						alpha: state.alpha,
						blend: state.blend,
						overprint: state.overprint,
						render: state.render,
						operation: operations,
						sourceCharacter
					});
				}
			}
			sourceCharacter += information.character.length;
			move(advance, 0);
		}
	}
	for (const token of tokens) {
		if (token.kind !== "operator") {
			operands.push(token);
			if (operands.length > 4096) throw new Error("Operand budget exceeded.");
			continue;
		}
		if (++operations > 500000) throw new Error("Operation budget exceeded.");
		const operator = token.value;
		operatorCounts[operator] = (operatorCounts[operator] ?? 0) + 1;
		const textValues
			= operator === "TJ" && operands[0]?.kind === "array"
				? operands[0].values
				: operator === "Tj" || operator === "'"
					? [operands[0]]
					: operator === "\""
						? [operands[2]]
						: null;
		const previousGlyphs = glyphs.length;
		sourceCharacter = 0;
		sourceNonspace = 0;
		if (operator === "q") {
			numbers(0);
			if (inText) throw new Error("Graphics save inside text requires review.");
			if (stack.length > 64) throw new Error("Graphics depth exceeded.");
			stack.push(structuredClone(state));
		}
		else if (operator === "Q") {
			numbers(0);
			if (inText) throw new Error("Graphics restore inside text requires review.");
			if (!stack.length) throw new Error("Graphics stack underflow.");
			state = stack.pop()!;
		}
		else if (operator === "cm") {
			state.matrix = multiply(state.matrix, numbers(6));
		}
		else if (operator === "re") {
			const [left, bottom, width, height] = numbers(4);
			const corners = [
				[left, bottom],
				[left + width, bottom],
				[left + width, bottom + height],
				[left, bottom + height]
			].map(([horizontal, vertical]) => point(state.matrix, horizontal, vertical));
			currentPath.points.push(...corners);
			for (let index = 0; index < 4; index++)
				currentPath.segments.push([corners[index], corners[(index + 1) % 4]]);
			if (state.matrix[1] || state.matrix[2]) currentPath.unknown = true;
			else currentPath.rectangles.push(rectangle(state.matrix, left, bottom, width, height));
		}
		else if (["m", "l", "c", "v", "y", "h"].includes(operator)) {
			const values = numbers(({ m: 2, l: 2, c: 6, v: 4, y: 4, h: 0 } as Record<string, number>)[operator]);
			const points = [];
			for (let index = 0; index < values.length; index += 2)
				points.push(point(state.matrix, values[index], values[index + 1]));
			if (operator === "m") {
				currentPath.beginning = points[0];
				currentPath.previous = points[0];
			}
			else if (operator === "l") {
				if (!currentPath.previous) throw new Error("Line without start.");
				currentPath.segments.push([currentPath.previous, points[0]]);
				currentPath.previous = points[0];
			}
			else if (operator === "h") {
				if (!currentPath.previous || !currentPath.beginning) throw new Error("Close without start.");
				currentPath.segments.push([currentPath.previous, currentPath.beginning]);
				currentPath.previous = currentPath.beginning;
			}
			else {
				if (!currentPath.previous) throw new Error("Curve without start.");
				currentPath.curves.push([currentPath.previous, ...points]);
				currentPath.previous = points[points.length - 1];
			}
			currentPath.points.push(...points);
			currentPath.unknown = true;
		}
		else if (operator === "W" || operator === "W*") {
			numbers(0);
			pendingClip = true;
		}
		else if (["n", "S", "s", "f", "f*", "B", "B*", "b", "b*"].includes(operator)) {
			numbers(0);
			if (pendingClip) {
				if (operator !== "n") throw new Error("Combined clipping and painting requires review.");
				if (currentPath.unknown || currentPath.rectangles.length !== 1) state.unknownClip = true;
				else state.clip = intersection(state.clip, currentPath.rectangles[0]);
				pendingClip = false;
			}
			if (!["n", "S", "s"].includes(operator) && currentPath.points.length) {
				paint({
					kind: currentPath.unknown ? "path" : "rectangle",
					bounds: intersection(bounds(currentPath.points), state.clip),
					unknown: currentPath.unknown || state.unknownClip || currentPath.rectangles.length !== 1,
					colorSpace: state.fillSpace,
					fill: state.fill,
					alpha: state.alpha,
					overprint: state.overprint,
					blend: state.blend,
					operation: operations
				});
			}
			if (["s", "b", "b*"].includes(operator) && currentPath.previous && currentPath.beginning)
				currentPath.segments.push([currentPath.previous, currentPath.beginning]);
			if (!["n", "f", "f*"].includes(operator)) {
				const scale = Math.max(
					Math.hypot(state.matrix[0], state.matrix[1]),
					Math.hypot(state.matrix[2], state.matrix[3])
				);
				const padding = ((state.lineWidth || 1) * scale * (state.miterLimit ?? 10)) / 2;
				for (const points of [...currentPath.segments, ...currentPath.curves]) {
					const box = bounds(points);
					const horizontal = points.length === 2 && Math.abs(box[3] - box[1]) < 0.001;
					const vertical = points.length === 2 && Math.abs(box[2] - box[0]) < 0.001;
					const width = ((state.lineWidth || 1) * scale) / 2;
					const ink = [
						box[0] - (horizontal ? padding : vertical ? width : padding),
						box[1] - (vertical ? padding : horizontal ? width : padding),
						box[2] + (horizontal ? padding : vertical ? width : padding),
						box[3] + (vertical ? padding : horizontal ? width : padding)
					];
					paint({
						kind: "stroke",
						geometry: horizontal
							? "horizontal"
							: vertical
								? "vertical"
								: points.length === 2
									? "diagonal"
									: "curve",
						bounds: intersection(ink, state.clip),
						unknown: true,
						fill: state.stroke,
						alpha: state.strokeAlpha,
						overprint: state.strokeOverprint,
						blend: state.blend,
						operation: operations
					});
				}
			}
			if (!["n", "f", "f*"].includes(operator)) {
				for (const [beginning, end] of currentPath.segments) {
					const horizontal = Math.abs(beginning[1] - end[1]) < 0.001;
					const vertical = Math.abs(beginning[0] - end[0]) < 0.001;
					const position = horizontal ? (beginning[1] + end[1]) / 2 : (beginning[0] + end[0]) / 2;
					if (!horizontal && !vertical) continue;
					const axis = horizontal ? "h" : "v";
					const start = Math.max(
						Math.min(beginning[horizontal ? 0 : 1], end[horizontal ? 0 : 1]),
						state.clip[horizontal ? 0 : 1]
					);
					const finish = Math.min(
						Math.max(beginning[horizontal ? 0 : 1], end[horizontal ? 0 : 1]),
						state.clip[horizontal ? 2 : 3]
					);
					if (
						!state.unknownClip
						&& finish - start > 5
						&& !state.matrix[1]
						&& !state.matrix[2]
						&& !state.dashed
						&& state.stroke === "black"
						&& state.strokeAlpha === 1
						&& state.blend === "/Normal"
						&& (!state.strokeOverprint || state.strokeSpace === "/DeviceCMYK")
						&& state.lineWidth > 0
					) {
						const along = (Math.abs(state.matrix[horizontal ? 0 : 3]) * state.lineWidth) / 2;
						const normal = (Math.abs(state.matrix[horizontal ? 3 : 0]) * state.lineWidth) / 2;
						const extended
							= (!currentPath.unknown && currentPath.rectangles.length === 1 && state.lineJoin === 0)
								|| state.lineCap === 2;
						const ink = intersection(
							horizontal
								? [
										start - (extended ? along : 0),
										position - normal,
										finish + (extended ? along : 0),
										position + normal
									]
								: [
										position - normal,
										start - (extended ? along : 0),
										position + normal,
										finish + (extended ? along : 0)
									],
							state.clip
						);
						if (!empty(ink)) {
							if (strokes.length >= 20000) throw new Error("Visible border budget exceeded.");
							strokes.push({
								axis,
								position,
								start,
								end: finish,
								ink,
								lineWidth: state.lineWidth,
								overprint: state.strokeOverprint,
								colorSpace: state.strokeSpace,
								operation: operations
							});
						}
					}
				}
			}
			currentPath = {
				rectangles: [],
				segments: [],
				curves: [],
				points: [],
				previous: null,
				beginning: null,
				unknown: false
			};
		}
		else if (operator === "BT") {
			numbers(0);
			if (inText) throw new Error("Nested text objects.");
			inText = true;
			textMatrix = identity();
			lineMatrix = identity();
		}
		else if (operator === "ET") {
			numbers(0);
			if (!inText) throw new Error("Text object underflow.");
			inText = false;
		}
		else if (operator === "Tf") {
			if (
				operands.length !== 2
				|| operands[0].kind !== "name"
				|| operands[1].kind !== "number"
				|| Math.abs(operands[1].value) > 100
			) {
				throw new Error("Invalid font selection.");
			}
			state.font = operands[0].value;
			state.size = operands[1].value;
		}
		else if (operator === "Tm") {
			if (!inText) throw new Error("Matrix outside text.");
			textMatrix = numbers(6);
			lineMatrix = [...textMatrix];
		}
		else if (operator === "Td" || operator === "TD") {
			const [horizontal, vertical] = numbers(2);
			if (operator === "TD") state.leading = -vertical;
			nextLine(horizontal, vertical);
		}
		else if (operator === "T*") {
			numbers(0);
			nextLine(0, -state.leading);
		}
		else if (["Tc", "Tw", "Tz", "TL", "Tr", "Ts"].includes(operator)) {
			const [value] = numbers(1);
			if (operator === "Tr" && ![0, 3].includes(value))
				throw new Error("Stroked or clipping text requires review.");
			state[
				(
					{
						Tc: "spacing",
						Tw: "wordSpacing",
						Tz: "horizontalScale",
						TL: "leading",
						Tr: "render",
						Ts: "rise"
					} as const
				)[operator as "Tc" | "Tw" | "Tz" | "TL" | "Tr" | "Ts"]
			] = operator === "Tz" ? value / 100 : value;
		}
		else if (operator === "Tj") {
			if (operands.length !== 1) throw new Error("Invalid text operands.");
			show(operands[0]);
		}
		else if (operator === "TJ") {
			if (operands.length !== 1 || operands[0].kind !== "array") throw new Error("Invalid text array.");
			for (const item of operands[0].values) {
				if (item.kind === "number") move((-item.value / 1000) * state.size * state.horizontalScale, 0);
				else show(item);
			}
		}
		else if (operator === "'") {
			if (operands.length !== 1) throw new Error("Invalid next-line text.");
			nextLine(0, -state.leading);
			show(operands[0]);
		}
		else if (operator === "\"") {
			if (operands.length !== 3 || operands[0].kind !== "number" || operands[1].kind !== "number")
				throw new Error("Invalid next-line spacing.");
			state.wordSpacing = operands[0].value;
			state.spacing = operands[1].value;
			nextLine(0, -state.leading);
			show(operands[2]);
		}
		else if (["g", "rg", "k", "sc", "scn"].includes(operator)) {
			if (operands.some(item => item.kind !== "number")) throw new Error("Unsupported fill color.");
			const values = operands.map((item) => {
				if (item.kind !== "number") throw new Error("Unsupported color operand.");
				return item.value;
			});
			if (["g", "rg", "k"].includes(operator)) {
				state.fillSpace = ({ g: "/DeviceGray", rg: "/DeviceRGB", k: "/DeviceCMYK" } as Record<string, string>)[
					operator
				];
			}
			state.fill
				= state.fillSpace === "/DeviceGray" && values.length === 1
					? values[0] === 0
						? "black"
						: values[0] === 1
							? "white"
							: "other"
					: state.fillSpace === "/DeviceRGB" && values.length === 3
						? values.every(value => value === 0)
							? "black"
							: values.every(value => value === 1)
								? "white"
								: "other"
						: state.fillSpace === "/DeviceCMYK" && values.length === 4
							? values.slice(0, 3).every(value => value === 0) && values[3] === 1
								? "black"
								: values.every(value => value === 0)
									? "white"
									: "other"
							: "other";
		}
		else if (operator === "gs") {
			if (operands.length !== 1 || operands[0].kind !== "name") throw new Error("Invalid graphics state.");
			const properties = dictionary(resolved(dictionary(resolved(resources["/ExtGState"]))[operands[0].value]));
			if (!plain(properties) || (properties["/SMask"] && properties["/SMask"] !== "/None"))
				throw new Error("Unsupported soft mask.");
			if (properties["/ca"] !== undefined) state.alpha = finiteNumber(properties["/ca"]);
			if (properties["/CA"] !== undefined) state.strokeAlpha = finiteNumber(properties["/CA"]);
			if (properties["/op"] !== undefined) state.overprint = booleanValue(properties["/op"]);
			if (properties["/OP"] !== undefined) {
				state.strokeOverprint = booleanValue(properties["/OP"]);
				if (properties["/op"] === undefined) state.overprint = booleanValue(properties["/OP"]);
			}
			if (properties["/OPM"] !== undefined) {
				if (![0, 1].includes(finiteNumber(properties["/OPM"]))) throw new Error("Invalid overprint mode.");
				state.overprintMode = finiteNumber(properties["/OPM"]);
			}
			if (properties["/BM"] !== undefined) state.blend = stringValue(properties["/BM"]);
			if (
				[state.alpha, state.strokeAlpha].some(
					value => typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1
				)
				|| typeof state.overprint !== "boolean"
				|| typeof state.strokeOverprint !== "boolean"
			) {
				throw new Error("Invalid opacity or overprint state.");
			}
			if (properties["/AIS"] !== undefined && properties["/AIS"] !== false)
				throw new Error("Alpha-is-shape graphics require review.");
			if (
				Object.keys(properties).some(
					key => !["/Type", "/ca", "/CA", "/op", "/OP", "/OPM", "/BM", "/SMask", "/SA", "/AIS"].includes(key)
				)
			) {
				throw new Error("An unsupported graphics-state entry requires review.");
			}
		}
		else if (operator === "Do") {
			if (operands.length !== 1 || operands[0].kind !== "name") throw new Error("Invalid image selection.");
			const selected = dictionary(resolved(resources["/XObject"]))[operands[0].value];
			const image = objects[`obj:${selected}`]?.stream?.dict;
			if (image?.["/Subtype"] !== "/Image") throw new Error("Unsupported nested form.");
			paint({
				kind: "image",
				bounds: intersection(rectangle(state.matrix, 0, 0, 1, 1), state.clip),
				unknown: true,
				alpha: state.alpha,
				operation: operations
			});
		}
		else if (operator === "w") {
			const [value] = numbers(1);
			if (value < 0 || value > 100) throw new Error("Invalid stroke width.");
			state.lineWidth = value;
		}
		else if (operator === "M") {
			const [value] = numbers(1);
			if (value < 1 || value > 100) throw new Error("Invalid miter limit.");
			state.miterLimit = value;
		}
		else if (operator === "J" || operator === "j") {
			const [value] = numbers(1);
			if (![0, 1, 2].includes(value)) throw new Error("Invalid stroke style.");
			state[operator === "J" ? "lineCap" : "lineJoin"] = value;
		}
		else if (operator === "d") {
			if (
				operands.length !== 2
				|| operands[0].kind !== "array"
				|| operands[1].kind !== "number"
				|| operands[0].values.some(value => value.kind !== "number" || value.value < 0)
			) {
				throw new Error("Invalid dash pattern.");
			}
			state.dashed = Boolean(operands[0].values.length);
		}
		else if (["G", "RG", "K", "SC", "SCN"].includes(operator)) {
			if (operands.some(item => item.kind !== "number")) throw new Error("Unsupported stroke color.");
			const values = operands.map((item) => {
				if (item.kind !== "number") throw new Error("Unsupported color operand.");
				return item.value;
			});
			if (["G", "RG", "K"].includes(operator)) {
				state.strokeSpace = (
					{ G: "/DeviceGray", RG: "/DeviceRGB", K: "/DeviceCMYK" } as Record<string, string>
				)[operator];
			}
			state.stroke
				= (state.strokeSpace === "/DeviceGray" && values.length === 1 && values[0] === 0)
					|| (state.strokeSpace === "/DeviceRGB" && values.length === 3 && values.every(value => value === 0))
					|| (state.strokeSpace === "/DeviceCMYK"
						&& values.length === 4
						&& values.slice(0, 3).every(value => value === 0)
						&& values[3] === 1)
					? "black"
					: "other";
		}
		else if (operator === "CS" || operator === "cs") {
			if (operands.length !== 1 || operands[0].kind !== "name") throw new Error("Invalid color space.");
			const space = operands[0].value;
			if (
				!["/DeviceGray", "/DeviceRGB", "/DeviceCMYK"].includes(space)
				&& !dictionary(resolved(resources["/ColorSpace"]))[space]
			) {
				throw new Error("Unknown color space.");
			}
			state[operator === "cs" ? "fillSpace" : "strokeSpace"] = space;
			state[operator === "cs" ? "fill" : "stroke"] = "other";
		}
		else if (["BMC", "BDC", "MP", "DP"].includes(operator)) {
			const properties = operator === "BDC" || operator === "DP";
			if (
				operands.length !== (properties ? 2 : 1)
				|| operands[0].kind !== "name"
				|| operands[0].value === "/OC"
				|| (properties && !["name", "dictionary"].includes(operands[1].kind))
			) {
				throw new Error("An optional or invalid marked-content appearance requires review.");
			}
			if (
				properties
				&& operands[1].kind === "dictionary"
				&& operands[1].entries.some(([key, value]) => {
					if (key === "/MCID")
						return value.kind !== "number" || !Number.isSafeInteger(value.value) || value.value < 0;
					if (key === "/Lang") return value.kind !== "bytes" || value.bytes.length > 64;
					if (key === "/O") return value.kind !== "name" || value.value !== "/Layout";
					if (key === "/BBox") {
						return (
							value.kind !== "array"
							|| value.values.length !== 4
							|| value.values.some(item => item.kind !== "number")
							|| value.values.some(item => item.kind !== "number")
							|| numericToken(value.values[0]) > numericToken(value.values[2])
							|| numericToken(value.values[1]) > numericToken(value.values[3])
						);
					}
					return true;
				})
			) {
				throw new Error("An unsupported marked-content dictionary requires review.");
			}
			if (
				properties
				&& operands[1].kind === "name"
				&& !dictionary(resolved(resources["/Properties"]))[operands[1].value]
			) {
				throw new Error("A marked-content property is unresolved.");
			}
			if (operator === "BMC" || operator === "BDC") {
				if (++markedDepth > 64) throw new Error("Marked-content depth exceeded.");
			}
		}
		else if (operator === "EMC") {
			numbers(0);
			if (--markedDepth < 0) throw new Error("Marked-content stack underflow.");
		}
		else if (operator === "ri") {
			if (
				operands.length !== 1
				|| operands[0].kind !== "name"
				|| !["/AbsoluteColorimetric", "/RelativeColorimetric", "/Saturation", "/Perceptual"].includes(
					operands[0].value
				)
			) {
				throw new Error("Invalid rendering intent.");
			}
		}
		else if (operator === "i") {
			const [flatness] = numbers(1);
			if (flatness < 0 || flatness > 100) throw new Error("Invalid path flatness.");
		}
		else {
			throw new Error(`Unsupported PDF content operator: ${operator}`);
		}
		if (textValues && glyphs.length > previousGlyphs) {
			if (textSpans.length >= 5000) throw new Error("Visible text-span budget exceeded.");
			if (!state.font) throw new Error("A text span is missing its font.");
			const selected = glyphs.slice(previousGlyphs);
			const font = fontData(state.font);
			const sourceText = textValues
				.filter(
					(
						value
					): value is Extract<
						AlabamaToken,
						{
							kind: "bytes";
						}
					> => value?.kind === "bytes"
				)
				.map(value => [...value.bytes].map(code => font.decode(code)).join(""))
				.join("");
			textSpans.push({
				text: sourceText,
				operation: operations,
				sourceNonspaceGlyphs: sourceNonspace,
				visibleGlyphs: selected.length,
				partialGlyphs: selected.filter(item => item.clipped).length,
				fontParsed: Boolean(font.glyph),
				fontProven: selected.every(glyph => glyph.fontProven),
				font: font.baseFont,
				clip: [...state.clip],
				bounds: bounds(
					selected.flatMap(item => [
						[item.ink[0], item.ink[1]],
						[item.ink[2], item.ink[3]]
					])
				),
				baseline: selected[0].origin[1],
				glyphs: selected
			});
		}
		if (
			currentPath.points.length > 16384
			|| currentPath.segments.length > 16384
			|| currentPath.curves.length > 4096
			|| currentPath.rectangles.length > 1024
		) {
			throw new Error("Current path budget exceeded.");
		}
		operands.length = 0;
	}
	if (operands.length || stack.length || inText || pendingClip || markedDepth)
		throw new Error("Incomplete content state.");
	return {
		glyphs,
		painted,
		strokes,
		textSpans,
		operatorCounts,
		totalGlyphs,
		hiddenGlyphs: hidden,
		partialGlyphs: partial,
		fontPrograms: programCache.size,
		fontResources: fontCache.size,
		objectProof,
		sourceFactsAccepted: false
	};
}
