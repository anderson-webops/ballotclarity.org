import { Buffer } from "node:buffer";
import { chicagoFontProgram, validateChicagoFontProgram } from "./state-ballot-chicago-fonts.js";
import { nycSymbolFontMappings } from "./state-ballot-nyc-fonts.js";
import { orangeGlyphApprovals } from "./state-ballot-orange-glyphs.js";

const plain = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value));
function reject(): never {
	throw new Error("The Orange County PDF font or object contract requires review.");
}
export function orangeUnicodeMappings(body: string, name: string) {
	if (Buffer.byteLength(body) > 128 * 1024 || /[^\x20-\x7E\r\n\t]/u.test(body) || !/^[A-Z]{6}\+Arial(?:-BoldItalic|-Unicode-MS-Bold|-Italic|-Bold)?$/u.test(name)) return reject();
	const text = body.replace(/\s+/gu, " ").trim();
	const prefix = `/CIDInit /ProcSet findresource begin 12 dict begin begincmap /CIDSystemInfo << /Registry (${name}) /Ordering (UCS) /Supplement 0 >> def /CMapName /${name} def 1 begincodespacerange `;
	const suffix = " endbfrange endcmap CMapName currentdict /CMap defineresource pop end end";
	if (!text.startsWith(prefix) || !text.endsWith(suffix)) return reject();
	const envelope = /^<([\da-f]{2})> <([\da-f]{2})> endcodespacerange (\d{1,3}) beginbfrange (.+)$/iu.exec(text.slice(prefix.length, -suffix.length));
	if (!envelope) return reject();
	const lower = Number.parseInt(envelope[1]!, 16);
	const upper = Number.parseInt(envelope[2]!, 16);
	const entries = [...envelope[4]!.matchAll(/<([\da-f]{2})> <([\da-f]{2})> <([\da-f]{4})>/giu)];
	if (lower > upper || entries.length !== Number(envelope[3]) || !entries.length || entries.length > 224 || envelope[4]!.replace(/<[\da-f]{2}> <[\da-f]{2}> <[\da-f]{4}>/giu, "").trim()) return reject();
	const mappings = new Map<number, string>();
	const decoder = new TextDecoder("windows-1252");
	for (const entry of entries) {
		const code = Number.parseInt(entry[1]!, 16);
		const character = decoder.decode(Buffer.from([code]));
		if (entry[1]!.toLowerCase() !== entry[2]!.toLowerCase() || mappings.has(code) || code < 32 || code === 127 || /[\u0080-\u009F]/u.test(character) || character.codePointAt(0) !== Number.parseInt(entry[3]!, 16)) return reject();
		mappings.set(code, entry[3]!.toLowerCase());
	}
	if (!mappings.has(lower) || !mappings.has(upper) || Math.max(...mappings.keys()) !== upper) return reject();
	return { mappings, declaredCodeSpace: [lower, upper], mappingsOutsideDeclaredCodeSpace: [...mappings.keys()].filter(code => code < lower || code > upper).length };
}
export function readOrangePdfFontPrograms(body: string) {
	if (Buffer.byteLength(body) > 8 * 1024 * 1024) return reject();
	const document: unknown = JSON.parse(body);
	if (!plain(document) || !Array.isArray(document.qpdf) || document.qpdf.length !== 2 || !plain(document.qpdf[0]) || document.qpdf[0].jsonversion !== 2 || !plain(document.qpdf[1]) || Object.keys(document.qpdf[1]).length > 12000 || !Array.isArray(document.pages) || !document.pages.length || document.pages.length > 256 || !plain(document.acroform) || !Array.isArray(document.acroform.fields) || document.acroform.fields.length || document.acroform.needappearances !== false || !plain(document.encrypt) || document.encrypt.encrypted !== false) return reject();
	const objects = document.qpdf[1];
	function resolved(value: unknown): unknown {
		if (typeof value !== "string" || !/^\d+ 0 R$/u.test(value)) return value;
		const object = objects[`obj:${value}`];
		if (!plain(object) || !("value" in object)) return reject();
		return object.value;
	}
	function stream(reference: unknown) {
		if (typeof reference !== "string" || !/^\d+ 0 R$/u.test(reference)) return reject();
		const object = objects[`obj:${reference}`];
		if (!plain(object) || !plain(object.stream) || typeof object.stream.data !== "string" || !/^[A-Za-z0-9+/]*={0,2}$/u.test(object.stream.data) || object.stream.data.length > 3 * 1024 * 1024) return reject();
		const bytes = Buffer.from(object.stream.data, "base64");
		if (bytes.toString("base64") !== object.stream.data) return reject();
		return bytes;
	}
	const pending: unknown[] = Object.values(objects);
	let visited = 0;
	while (pending.length) {
		const item = pending.pop();
		if (++visited > 100000) return reject();
		if (!item || typeof item !== "object") continue;
		if (Array.isArray(item)) {
			pending.push(...item);
		}
		else if (plain(item)) {
			if (Object.keys(item).some(key => ["/JS", "/JavaScript", "/OpenAction", "/AA", "/AcroForm", "/XFA", "/Encrypt", "/Annots"].includes(key))) return reject();
			pending.push(...Object.values(item));
		}
	}
	const programs: { name: string; program: ReturnType<typeof chicagoFontProgram>; declaredCodeSpace: number[]; mappingsOutsideDeclaredCodeSpace: number }[] = [];
	const references = new Set<string>();
	for (const page of document.pages) {
		if (!plain(page)) return reject();
		const value = resolved(page.object);
		if (!plain(value) || value["/Type"] !== "/Page") return reject();
		const resources = resolved(value["/Resources"]);
		if (!plain(resources)) return reject();
		const fonts = resolved(resources["/Font"]);
		if (!plain(fonts) || !Object.keys(fonts).length || Object.keys(fonts).length > 5) return reject();
		for (const reference of Object.values(fonts)) {
			if (typeof reference !== "string") return reject();
			if (references.has(reference)) continue;
			references.add(reference);
			const font = resolved(reference);
			if (!plain(font) || font["/Type"] !== "/Font" || font["/Subtype"] !== "/TrueType" || Object.keys(font).some(key => !["/BaseFont", "/FirstChar", "/FontDescriptor", "/LastChar", "/Name", "/Subtype", "/ToUnicode", "/Type", "/Widths"].includes(key))) return reject();
			const name = resolved(font["/BaseFont"]);
			const descriptor = resolved(font["/FontDescriptor"]);
			const widths = resolved(font["/Widths"]);
			if (typeof name !== "string" || !/^\/[A-Z]{6}\+Arial(?:-BoldItalic|-Unicode-MS-Bold|-Italic|-Bold)?$/u.test(name) || !plain(descriptor) || descriptor["/Type"] !== "/FontDescriptor" || resolved(descriptor["/FontName"]) !== name || descriptor["/Flags"] !== (name.endsWith("Italic") ? 69 : 5) || descriptor["/ItalicAngle"] !== (name.endsWith("Italic") ? -12 : 0) || descriptor["/FontFile"] || descriptor["/FontFile3"] || !Number.isInteger(font["/FirstChar"]) || !Number.isInteger(font["/LastChar"]) || Number(font["/FirstChar"]) < 32 || Number(font["/LastChar"]) > 255 || !Array.isArray(widths) || widths.length !== Number(font["/LastChar"]) - Number(font["/FirstChar"]) + 1 || widths.some(value => typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 4000)) return reject();
			const mapping = orangeUnicodeMappings(stream(font["/ToUnicode"]).toString("ascii"), name.slice(1));
			if ([...mapping.mappings.keys()].some(code => code < Number(font["/FirstChar"]) || code > Number(font["/LastChar"]) || !widths[code - Number(font["/FirstChar"])])) return reject();
			const bytes = stream(descriptor["/FontFile2"]);
			programs.push({ name, program: chicagoFontProgram(bytes, nycSymbolFontMappings(bytes, mapping.mappings), "nyc"), declaredCodeSpace: mapping.declaredCodeSpace, mappingsOutsideDeclaredCodeSpace: mapping.mappingsOutsideDeclaredCodeSpace });
		}
	}
	if (programs.length !== 5 || new Set(programs.map(item => item.name.replace(/^\/[A-Z]{6}\+/u, ""))).size !== 5) return reject();
	return programs;
}
export function inspectOrangePdfFonts(body: string) {
	const programs = readOrangePdfFontPrograms(body);
	for (const item of programs) validateChicagoFontProgram(item.program, orangeGlyphApprovals);
	return { fonts: programs.length, mappedCharacters: programs.reduce((sum, item) => sum + item.program.characters.length, 0), mappingsOutsideDeclaredCodeSpace: programs.reduce((sum, item) => sum + item.mappingsOutsideDeclaredCodeSpace, 0) };
}
