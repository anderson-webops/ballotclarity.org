import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";

const fontNames = ["/ArialMT", "/Arial-BoldMT", "/TimesNewRomanPSMT", "/TimesNewRomanPS-BoldMT"];
const plain = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value));
const hash = (value: Buffer) => createHash("sha256").update(value).digest("hex");
function reject(): never {
	throw new Error("The Winnebago PDF font or object structure requires review.");
}

export function inspectWinnebagoPdfFonts(body: string) {
	if (Buffer.byteLength(body) > 4 * 1024 * 1024) return reject();
	const value: unknown = JSON.parse(body);
	if (!plain(value) || !Array.isArray(value.qpdf) || value.qpdf.length !== 2 || !plain(value.qpdf[0]) || value.qpdf[0].jsonversion !== 2 || !plain(value.qpdf[1]) || Object.keys(value.qpdf[1]).length > 20000) return reject();
	const objects = value.qpdf[1];
	function resolved(reference: unknown): unknown {
		if (typeof reference !== "string" || !/^\d+ 0 R$/u.test(reference)) return reference;
		const object = objects[`obj:${reference}`];
		if (!plain(object)) return reject();
		return object.value;
	}
	function stream(reference: unknown, expected: string) {
		if (typeof reference !== "string" || !/^\d+ 0 R$/u.test(reference)) return reject();
		const object = objects[`obj:${reference}`];
		if (!plain(object) || !plain(object.stream) || typeof object.stream.data !== "string" || !/^[a-zA-Z0-9+/]*={0,2}$/u.test(object.stream.data) || hash(Buffer.from(object.stream.data, "base64")) !== expected) return reject();
	}
	const checked = new Set<unknown>();
	let standard = 0;
	let dash = 0;
	function font(reference: unknown) {
		if (checked.has(reference)) return;
		checked.add(reference);
		const definition = resolved(reference);
		if (!plain(definition) || definition["/Type"] !== "/Font" || !fontNames.includes(String(definition["/BaseFont"]))) return reject();
		if (definition["/Subtype"] === "/Type0") {
			if (definition["/BaseFont"] !== "/TimesNewRomanPS-BoldMT" || definition["/Encoding"] !== "/Identity-H" || Object.keys(definition).some(key => !["/BaseFont", "/DescendantFonts", "/Encoding", "/Subtype", "/ToUnicode", "/Type"].includes(key))) return reject();
			stream(definition["/ToUnicode"], "8fabe6a45e6869c0df147f3e3c2dfc57005613ae2cd9896836c91264dc4d5f9d");
			const children = resolved(definition["/DescendantFonts"]);
			if (!Array.isArray(children) || children.length !== 1) return reject();
			const child = resolved(children[0]);
			if (!plain(child) || child["/Subtype"] !== "/CIDFontType2" || child["/BaseFont"] !== definition["/BaseFont"] || child["/CIDToGIDMap"] !== "/Identity" || child["/Type"] !== "/Font") return reject();
			const descriptor = resolved(child["/FontDescriptor"]);
			if (!plain(descriptor) || descriptor["/FontName"] !== child["/BaseFont"] || descriptor["/FontFile"] || descriptor["/FontFile3"]) return reject();
			stream(descriptor["/FontFile2"], "d72bb2f217c1e40412cc32cca5be7438ae1b971e2c337e7c82cb49694af29cf1");
			dash++;
			return;
		}
		if (definition["/Subtype"] !== "/TrueType" || definition["/Encoding"] !== "/WinAnsiEncoding" || Object.keys(definition).some(key => !["/BaseFont", "/Encoding", "/FirstChar", "/FontDescriptor", "/LastChar", "/Name", "/Subtype", "/Type", "/Widths"].includes(key))) return reject();
		const descriptor = resolved(definition["/FontDescriptor"]);
		if (!plain(descriptor) || descriptor["/Type"] !== "/FontDescriptor" || descriptor["/FontName"] !== definition["/BaseFont"] || descriptor["/Flags"] !== 32 || descriptor["/FontFile"] || descriptor["/FontFile2"] || descriptor["/FontFile3"]) return reject();
		const widths = resolved(definition["/Widths"]);
		if (!Number.isInteger(definition["/FirstChar"]) || !Number.isInteger(definition["/LastChar"]) || Number(definition["/FirstChar"]) < 0 || Number(definition["/LastChar"]) > 255 || !Array.isArray(widths) || widths.length !== Number(definition["/LastChar"]) - Number(definition["/FirstChar"]) + 1 || widths.some(width => typeof width !== "number" || !Number.isFinite(width) || width < 0 || width > 3000)) return reject();
		standard++;
	}
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
				if (!plain(resources) || !Object.keys(resources).length || Object.keys(resources).length > 16) return reject();
				for (const reference of Object.values(resources)) font(reference);
			}
			pending.push(...Object.values(item));
		}
	}
	if (!standard || standard > 8 || dash > 1) return reject();
	return { standardFonts: standard, reviewedDashFonts: dash };
}
