import { Buffer } from "node:buffer";
import { chicagoFontProgram, validateChicagoFontProgram } from "./state-ballot-chicago-fonts.js";
import { nycGlyphApprovals } from "./state-ballot-nyc-glyphs.js";

const plain = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value));
function reject(): never {
	throw new Error("The NYC PDF font mapping or object structure requires review.");
}

export function nycUnicodeMappings(body: string, name: string) {
	if (Buffer.byteLength(body) > 128 * 1024 || /[^\x20-\x7E\r\n\t]/u.test(body) || !/^[A-Z]{6}\+Arial(?:,Bold)?$/u.test(name)) return reject();
	const text = body.replace(/\s+/gu, " ").trim();
	const prefix = `/CIDInit /ProcSet findresource begin 12 dict begin begincmap /CIDSystemInfo << /Registry (${name}) /Ordering (UCS) /Supplement 0 >> def /CMapName /${name} def 1 begincodespacerange `;
	const suffix = " endbfrange endcmap CMapName currentdict /CMap defineresource pop end end";
	if (!text.startsWith(prefix) || !text.endsWith(suffix)) return reject();
	const middle = text.slice(prefix.length, -suffix.length);
	const envelope = /^<[\da-f]{2}> <[\da-f]{2}> endcodespacerange (\d{1,3}) beginbfrange (.+)$/iu.exec(middle);
	if (!envelope) return reject();
	const entries = [...envelope[2]!.matchAll(/<([\da-f]{2})> <([\da-f]{2})> <([\da-f]{4})>/giu)];
	if (entries.length !== Number(envelope[1]) || !entries.length || entries.length > 224 || envelope[2]!.replace(/<[\da-f]{2}> <[\da-f]{2}> <[\da-f]{4}>/giu, "").trim()) return reject();
	const mappings = new Map<number, string>();
	const decoder = new TextDecoder("windows-1252");
	for (const entry of entries) {
		const code = Number.parseInt(entry[1]!, 16);
		const unicode = Number.parseInt(entry[3]!, 16);
		if (entry[1]!.toLowerCase() !== entry[2]!.toLowerCase() || mappings.has(code) || code < 32 || (code >= 127 && code <= 159 && ![128, 130, 131, 132, 133, 134, 135, 136, 137, 138, 139, 140, 142, 145, 146, 147, 148, 149, 150, 151, 152, 153, 154, 155, 156, 158, 159].includes(code)) || decoder.decode(Buffer.from([code])).codePointAt(0) !== unicode) return reject();
		mappings.set(code, entry[3]!.toLowerCase());
	}
	return mappings;
}

export function nycSymbolFontMappings(program: Buffer, mappings: ReadonlyMap<number, string>) {
	chicagoFontProgram(program, new Map(), "nyc");
	let table: Buffer | undefined;
	for (let index = 0; index < program.readUInt16BE(4); index++) {
		const position = 12 + index * 16;
		if (program.subarray(position, position + 4).toString("ascii") === "cmap") table = program.subarray(program.readUInt32BE(position + 8), program.readUInt32BE(position + 8) + program.readUInt32BE(position + 12));
	}
	if (!table || table.length < 28 || table.readUInt16BE(0) !== 0 || table.readUInt16BE(2) !== 1 || table.readUInt16BE(4) !== 3 || table.readUInt16BE(6) !== 0) return reject();
	const start = table.readUInt32BE(8);
	if (start < 12 || start + 16 > table.length || table.readUInt16BE(start) !== 4) return reject();
	const end = start + table.readUInt16BE(start + 2);
	const segments = table.readUInt16BE(start + 6) / 2;
	if (!Number.isInteger(segments) || !segments || segments > 256 || start + 16 + segments * 8 > end || end > table.length) return reject();
	const result = new Map<number, string>();
	for (const [code, unicode] of mappings) {
		const character = 0xF000 + code;
		let glyph = 0;
		let previousEnd = -1;
		for (let index = 0; index < segments; index++) {
			const last = table.readUInt16BE(start + 14 + index * 2);
			const first = table.readUInt16BE(start + 16 + segments * 2 + index * 2);
			if (first > last || first <= previousEnd) return reject();
			previousEnd = last;
			if (character < first || character > last) continue;
			const delta = table.readInt16BE(start + 16 + segments * 4 + index * 2);
			const position = start + 16 + segments * 6 + index * 2;
			const offset = table.readUInt16BE(position);
			if (!offset) {
				glyph = (character + delta) & 0xFFFF;
			}
			else {
				const address = position + offset + (character - first) * 2;
				if (address + 2 > end) return reject();
				const value = table.readUInt16BE(address);
				glyph = value ? (value + delta) & 0xFFFF : 0;
			}
		}
		if (!glyph || result.has(glyph)) return reject();
		result.set(glyph, unicode);
	}
	return result;
}

export function readNycPdfFontPrograms(body: string) {
	if (Buffer.byteLength(body) > 4 * 1024 * 1024) return reject();
	const document: unknown = JSON.parse(body);
	if (!plain(document) || !Array.isArray(document.qpdf) || document.qpdf.length !== 2 || !plain(document.qpdf[0]) || document.qpdf[0].jsonversion !== 2 || !plain(document.qpdf[1]) || Object.keys(document.qpdf[1]).length > 12000 || !Array.isArray(document.pages) || document.pages.length < 6 || document.pages.length > 60 || !plain(document.acroform) || !Array.isArray(document.acroform.fields) || document.acroform.fields.length || document.acroform.needappearances !== false) return reject();
	const objects = document.qpdf[1];
	function resolved(value: unknown): unknown {
		if (typeof value !== "string" || !/^\d+ 0 R$/u.test(value)) return value;
		const object = objects[`obj:${value}`];
		if (!plain(object) || !("value" in object)) return reject();
		return object.value;
	}
	function stream(value: unknown) {
		const object = typeof value === "string" ? objects[`obj:${value}`] : null;
		if (!plain(object) || !plain(object.stream) || typeof object.stream.data !== "string" || object.stream.data.length > 3 * 1024 * 1024 || !/^[a-zA-Z0-9+/]*={0,2}$/u.test(object.stream.data)) return reject();
		return Buffer.from(object.stream.data, "base64");
	}
	const programs: ReturnType<typeof chicagoFontProgram>[] = [];
	const checked = new Set<string>();
	const pending: unknown[] = Object.values(objects);
	let visited = 0;
	while (pending.length) {
		const item = pending.pop();
		if (++visited > 200000) return reject();
		if (Array.isArray(item)) {
			pending.push(...item);
		}
		else if (plain(item)) {
			if (Object.keys(item).some(key => ["/OpenAction", "/AA", "/JS", "/JavaScript", "/EmbeddedFiles", "/AcroForm", "/XFA"].includes(key))) return reject();
			if (item["/Font"]) {
				const resources = resolved(item["/Font"]);
				if (!plain(resources) || !Object.keys(resources).length || Object.keys(resources).length > 2) return reject();
				for (const reference of Object.values(resources)) {
					if (typeof reference !== "string") return reject();
					if (checked.has(reference)) continue;
					checked.add(reference);
					const font = resolved(reference);
					if (!plain(font) || font["/Type"] !== "/Font" || font["/Subtype"] !== "/TrueType" || typeof font["/BaseFont"] !== "string" || !/^\/[A-Z]{6}\+Arial(?:,Bold)?$/u.test(font["/BaseFont"]) || Object.keys(font).some(key => !["/BaseFont", "/FirstChar", "/FontDescriptor", "/LastChar", "/Subtype", "/ToUnicode", "/Type", "/Widths"].includes(key))) return reject();
					const descriptor = resolved(font["/FontDescriptor"]);
					const widths = resolved(font["/Widths"]);
					if (!plain(descriptor) || descriptor["/Type"] !== "/FontDescriptor" || descriptor["/FontName"] !== font["/BaseFont"] || descriptor["/Flags"] !== 4 || descriptor["/FontFile"] || descriptor["/FontFile3"] || !Number.isInteger(font["/FirstChar"]) || !Number.isInteger(font["/LastChar"]) || Number(font["/FirstChar"]) < 32 || Number(font["/LastChar"]) > 255 || !Array.isArray(widths) || widths.length !== Number(font["/LastChar"]) - Number(font["/FirstChar"]) + 1 || widths.some(value => typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 3000)) return reject();
					const program = stream(descriptor["/FontFile2"]);
					const mappings = nycUnicodeMappings(stream(font["/ToUnicode"]).toString("ascii"), font["/BaseFont"].slice(1));
					programs.push(chicagoFontProgram(program, nycSymbolFontMappings(program, mappings), "nyc"));
				}
			}
			pending.push(...Object.values(item));
		}
	}
	if (programs.length !== 2) return reject();
	return programs;
}

export function inspectNycPdfFonts(body: string) {
	const programs = readNycPdfFontPrograms(body);
	for (const program of programs) validateChicagoFontProgram(program, nycGlyphApprovals);
	return { fonts: programs.length, mappedCharacters: programs.reduce((sum, program) => sum + program.characters.length, 0) };
}
