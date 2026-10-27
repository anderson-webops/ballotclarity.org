import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { chicagoGlyphApprovals } from "./state-ballot-chicago-glyphs.js";

interface Component { glyph: number; sha256: string }
export interface ChicagoGlyphApproval { glyphs: Record<string, string[]>; components: Record<string, Component[]> }
export interface ChicagoFontProgram { signature: string; characters: { unicode: string; sha256: string }[]; components: Record<string, Component[]> }
const hash = (value: Buffer | string) => createHash("sha256").update(value).digest("hex");
const plain = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value));
function reject(): never {
	throw new Error("The Chicago PDF font mapping or glyph program requires review.");
}

export function chicagoUnicodeMappings(body: string) {
	if (Buffer.byteLength(body) > 128 * 1024 || /[^\x20-\x7E\r\n\t]/u.test(body)) return reject();
	const normalized = body.replace(/\s+/gu, " ").trim();
	const prefix = "/CIDInit /ProcSet findresource begin 12 dict begin begincmap /CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def /CMapName /Adobe-Identity-UCS def /CMapType 2 def 1 begincodespacerange <0000> <FFFF> endcodespacerange ";
	const suffix = " endcmap CMapName currentdict /CMap defineresource pop end end";
	if (!normalized.startsWith(prefix) || !normalized.endsWith(suffix)) return reject();
	const middle = normalized.slice(prefix.length, -suffix.length);
	const mappings = new Map<number, string>();
	let consumed = "";
	for (const match of middle.matchAll(/(\d{1,3}) beginbfchar (.*?) endbfchar/gu)) {
		const pairs = [...match[2]!.matchAll(/<([\da-f]{4})> <([\da-f]{4})>/giu)];
		if (pairs.length !== Number(match[1]) || !pairs.length || pairs.length > 256 || match[2]!.replace(/<[\da-f]{4}> <[\da-f]{4}>/giu, "").trim()) return reject();
		consumed += match[0];
		for (const pair of pairs) {
			const glyph = Number.parseInt(pair[1]!, 16);
			const unicode = Number.parseInt(pair[2]!, 16);
			if (mappings.has(glyph) || unicode < 32 || (unicode >= 127 && unicode <= 159) || (unicode >= 0xD800 && unicode <= 0xDFFF) || unicode >= 0xFFFE) return reject();
			mappings.set(glyph, pair[2]!.toLowerCase());
		}
	}
	if (!mappings.size || mappings.size > 1024 || consumed.replace(/\s/gu, "") !== middle.replace(/\s/gu, "")) return reject();
	return mappings;
}

export function chicagoFontProgram(program: Buffer, mappings: ReadonlyMap<number, string>): ChicagoFontProgram {
	if (program.length < 64 || program.length > 2 * 1024 * 1024 || program.readUInt32BE(0) !== 0x00010000) return reject();
	const count = program.readUInt16BE(4);
	if (!count || count > 64 || 12 + count * 16 > program.length) return reject();
	const tables = new Map<string, Buffer>();
	const spans: number[][] = [];
	for (let index = 0; index < count; index++) {
		const position = 12 + index * 16;
		const name = program.subarray(position, position + 4).toString("ascii");
		const offset = program.readUInt32BE(position + 8);
		const length = program.readUInt32BE(position + 12);
		if (tables.has(name) || offset < 12 + count * 16 || offset + length > program.length || spans.some(span => offset < span[1]! && offset + length > span[0]!)) return reject();
		tables.set(name, program.subarray(offset, offset + length));
		if (length) spans.push([offset, offset + length]);
	}
	const head = tables.get("head");
	const maximum = tables.get("maxp");
	const offsets = tables.get("loca");
	const outlines = tables.get("glyf");
	if (!head || head.length !== 54 || head.readUInt32BE(12) !== 0x5F0F3CF5 || !maximum || maximum.length !== 32 || !offsets || !outlines) return reject();
	const glyphs = maximum.readUInt16BE(4);
	const format = head.readInt16BE(50);
	const width = format === 0 ? 2 : format === 1 ? 4 : 0;
	if (!width || !glyphs || glyphs > 20000 || offsets.length !== (glyphs + 1) * width || head.readUInt16BE(18) < 16) return reject();
	const positions = Array.from({ length: glyphs + 1 }, (_, index) => format === 0 ? offsets.readUInt16BE(index * 2) * 2 : offsets.readUInt32BE(index * 4));
	if (positions.some((position, index) => position > outlines.length || (index > 0 && position < positions[index - 1]!))) return reject();
	const hints = ["cvt ", "fpgm", "prep", "gasp"].map((name) => {
		const bytes = tables.get(name);
		if (!bytes || bytes.length > 65536) return reject();
		return [name, hash(bytes)];
	});
	const signature = hash(JSON.stringify({ head: [head.subarray(0, 8).toString("hex"), head.subarray(16, 20).toString("hex"), head.subarray(44, 50).toString("hex")], maximum: hash(maximum), hints }));
	const components: Record<string, Component[]> = {};
	const checked = new Map<number, string>();
	function inspect(glyph: number, ancestors: Set<number>): string {
		if (!Number.isSafeInteger(glyph) || glyph < 0 || glyph >= glyphs || ancestors.has(glyph) || ancestors.size > 16) return reject();
		if (checked.has(glyph)) return checked.get(glyph)!;
		const bytes = outlines!.subarray(positions[glyph]!, positions[glyph + 1]!);
		const sha256 = hash(bytes);
		if (bytes.length && bytes.length < 10) return reject();
		const children: Component[] = [];
		if (bytes.length && bytes.readInt16BE(0) < 0) {
			let position = 10;
			let flags = 0;
			do {
				if (position + 4 > bytes.length || children.length > 32) return reject();
				flags = bytes.readUInt16BE(position);
				const child = bytes.readUInt16BE(position + 2);
				position += 4 + ((flags & 1) ? 4 : 2) + ((flags & 8) ? 2 : (flags & 64) ? 4 : (flags & 128) ? 8 : 0);
				if (position > bytes.length || [8, 64, 128].filter(flag => flags & flag).length > 1) return reject();
				children.push({ glyph: child, sha256: inspect(child, new Set([...ancestors, glyph])) });
			} while (flags & 32);
		}
		if (components[sha256] && JSON.stringify(components[sha256]) !== JSON.stringify(children)) return reject();
		components[sha256] = children;
		checked.set(glyph, sha256);
		return sha256;
	}
	const characters = [...mappings].map(([glyph, unicode]) => ({ unicode, sha256: inspect(glyph, new Set()) }));
	if (characters.some(character => character.unicode !== "0020" && character.sha256 === hash(Buffer.alloc(0)))) return reject();
	return { signature, characters, components };
}

export function validateChicagoFontProgram(font: ChicagoFontProgram, catalog: Readonly<Record<string, ChicagoGlyphApproval>> = chicagoGlyphApprovals) {
	const approved = catalog[font.signature];
	if (!approved || font.characters.some(character => !approved.glyphs[character.unicode]?.includes(character.sha256)) || Object.entries(font.components).some(([sha256, components]) => JSON.stringify(approved.components[sha256]) !== JSON.stringify(components))) return reject();
	return { characters: font.characters.length, signature: font.signature };
}

export function chicagoFooterMappings(program: Buffer) {
	chicagoFontProgram(program, new Map());
	const count = program.readUInt16BE(4);
	let table: Buffer | undefined;
	for (let index = 0; index < count; index++) {
		const position = 12 + index * 16;
		if (program.subarray(position, position + 4).toString("ascii") === "cmap") table = program.subarray(program.readUInt32BE(position + 8), program.readUInt32BE(position + 8) + program.readUInt32BE(position + 12));
	}
	if (!table || table.length < 4 || table.readUInt16BE(0) !== 0 || table.readUInt16BE(2) > 32 || 4 + table.readUInt16BE(2) * 8 > table.length) return reject();
	const offsets: number[] = [];
	for (let index = 0; index < table.readUInt16BE(2); index++) {
		const position = 4 + index * 8;
		if (table.readUInt16BE(position) === 3 && table.readUInt16BE(position + 2) === 1) offsets.push(table.readUInt32BE(position + 4));
	}
	if (offsets.length !== 1 || offsets[0]! + 16 > table.length || table.readUInt16BE(offsets[0]!) !== 4) return reject();
	const start = offsets[0]!;
	const end = start + table.readUInt16BE(start + 2);
	const segments = table.readUInt16BE(start + 6) / 2;
	if (!Number.isInteger(segments) || !segments || segments > 1024 || start + 16 + segments * 8 > end || end > table.length) return reject();
	const mappings = new Map<number, string>();
	for (const character of new Set(" Page0123456789of")) {
		const unicode = character.charCodeAt(0);
		let glyph = 0;
		for (let index = 0; index < segments; index++) {
			const last = table.readUInt16BE(start + 14 + index * 2);
			const first = table.readUInt16BE(start + 16 + segments * 2 + index * 2);
			if (first > last) return reject();
			if (unicode < first || unicode > last) continue;
			const delta = table.readInt16BE(start + 16 + segments * 4 + index * 2);
			const position = start + 16 + segments * 6 + index * 2;
			const offset = table.readUInt16BE(position);
			if (!offset) {
				glyph = (unicode + delta) & 0xFFFF;
			}
			else {
				const address = position + offset + (unicode - first) * 2;
				if (address + 2 > end) return reject();
				const value = table.readUInt16BE(address);
				glyph = value ? (value + delta) & 0xFFFF : 0;
			}
			break;
		}
		if (!glyph || mappings.has(glyph)) return reject();
		mappings.set(glyph, unicode.toString(16).padStart(4, "0"));
	}
	return mappings;
}

export function readChicagoPdfFontPrograms(body: string) {
	if (Buffer.byteLength(body) > 16 * 1024 * 1024) return reject();
	const value: unknown = JSON.parse(body);
	if (!plain(value) || !Array.isArray(value.qpdf) || value.qpdf.length !== 2 || !plain(value.qpdf[0]) || value.qpdf[0].jsonversion !== 2 || !plain(value.qpdf[1]) || !Array.isArray(value.pages) || !value.pages.length || value.pages.length > 60 || !plain(value.acroform) || !Array.isArray(value.acroform.fields) || value.acroform.fields.length || value.acroform.needappearances !== false) return reject();
	const objects = value.qpdf[1];
	if (Object.keys(objects).length > 12000) return reject();
	function resolved(reference: unknown): unknown {
		if (typeof reference !== "string" || !/^\d+ 0 R$/u.test(reference)) return reference;
		const object = objects[`obj:${reference}`];
		if (!plain(object)) return reject();
		return object.value;
	}
	function stream(reference: unknown) {
		if (typeof reference !== "string" || !/^\d+ 0 R$/u.test(reference)) return reject();
		const object = objects[`obj:${reference}`];
		if (!plain(object) || !plain(object.stream) || typeof object.stream.data !== "string" || !/^[\da-zA-Z+/]*={0,2}$/u.test(object.stream.data)) return reject();
		return Buffer.from(object.stream.data, "base64");
	}
	const queue: unknown[] = Object.values(objects);
	let visited = 0;
	while (queue.length) {
		const item = queue.pop();
		if (++visited > 400000) return reject();
		if (Array.isArray(item)) {
			queue.push(...item);
		}
		else if (plain(item)) {
			if (Object.keys(item).some(key => ["/OpenAction", "/AA", "/JS", "/JavaScript", "/EmbeddedFiles", "/XFA", "/Encrypt"].includes(key))) return reject();
			queue.push(...Object.values(item));
		}
	}
	const used = new Set<unknown>();
	const programs: ChicagoFontProgram[] = [];
	const resourcesPending: { resources: unknown; ancestors: Set<unknown> }[] = [];
	for (const page of value.pages) {
		if (!plain(page)) return reject();
		const definition = resolved(page.object);
		if (!plain(definition) || definition["/Annots"] || definition["/Rotate"] || !plain(definition["/Resources"])) return reject();
		resourcesPending.push({ resources: definition["/Resources"], ancestors: new Set() });
	}
	let resourceCount = 0;
	while (resourcesPending.length) {
		const item = resourcesPending.pop()!;
		const resources = resolved(item.resources);
		if (!plain(resources) || ++resourceCount > 500 || item.ancestors.size > 16) return reject();
		const fonts = resolved(resources["/Font"]);
		if (!plain(fonts) || !Object.keys(fonts).length || Object.keys(fonts).length > 24) return reject();
		const states = resolved(resources["/ExtGState"]);
		if (states !== undefined && (!plain(states) || Object.values(states).some((reference) => {
			const state = resolved(reference);
			return !plain(state) || Object.keys(state).some(key => !["/Type", "/CA", "/ca"].includes(key)) || state["/Type"] !== "/ExtGState" || state["/CA"] !== 1 || state["/ca"] !== 1;
		}))) {
			return reject();
		}
		const forms = resolved(resources["/XObject"]);
		if (forms !== undefined) {
			if (!plain(forms) || Object.keys(forms).length > 8) return reject();
			for (const reference of Object.values(forms)) {
				const object = typeof reference === "string" ? objects[`obj:${reference}`] : null;
				if (!plain(object) || !plain(object.stream) || !plain(object.stream.dict) || object.stream.dict["/Subtype"] !== "/Form" || item.ancestors.has(reference)) return reject();
				if (JSON.stringify(object.stream.dict["/Matrix"]) !== "[1,0,0,1,0,0]") return reject();
				resourcesPending.push({ resources: object.stream.dict["/Resources"], ancestors: new Set([...item.ancestors, reference]) });
			}
		}
		for (const reference of Object.values(fonts)) {
			if (used.has(reference)) continue;
			used.add(reference);
			const font = resolved(reference);
			if (!plain(font) || font["/Type"] !== "/Font") return reject();
			if (font["/Subtype"] === "/TrueType" && font["/BaseFont"] === "/Arial" && font["/Encoding"] === "/WinAnsiEncoding" && !font["/ToUnicode"]) {
				const descriptor = resolved(font["/FontDescriptor"]);
				if (!plain(descriptor) || descriptor["/FontName"] !== "/Arial" || descriptor["/FontFile"] || descriptor["/FontFile3"]) return reject();
				const program = stream(descriptor["/FontFile2"]);
				programs.push(chicagoFontProgram(program, chicagoFooterMappings(program)));
				continue;
			}
			if (font["/Subtype"] !== "/Type0" || font["/Encoding"] !== "/Identity-H" || !/^\/CIDFont\+F\d{1,2}$/u.test(String(font["/BaseFont"])) || !Array.isArray(font["/DescendantFonts"]) || font["/DescendantFonts"].length !== 1) return reject();
			const descendant = resolved(font["/DescendantFonts"][0]);
			if (!plain(descendant) || descendant["/Subtype"] !== "/CIDFontType2" || descendant["/CIDToGIDMap"] !== "/Identity" || descendant["/BaseFont"] !== font["/BaseFont"]) return reject();
			const descriptor = resolved(descendant["/FontDescriptor"]);
			if (!plain(descriptor) || descriptor["/FontFile"] || descriptor["/FontFile3"]) return reject();
			programs.push(chicagoFontProgram(stream(descriptor["/FontFile2"]), chicagoUnicodeMappings(stream(font["/ToUnicode"]).toString("utf8"))));
		}
	}
	if (!programs.length || programs.length > 24) return reject();
	return programs;
}

export function inspectChicagoPdfFonts(body: string) {
	const programs = readChicagoPdfFontPrograms(body);
	for (const program of programs) validateChicagoFontProgram(program);
	return { programs: programs.length, characters: programs.reduce((total, program) => total + program.characters.length, 0) };
}
