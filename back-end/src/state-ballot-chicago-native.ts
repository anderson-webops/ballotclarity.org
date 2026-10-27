import { Buffer } from "node:buffer";
import { stateHtmlAttribute as attribute, stateHtmlDescendants as descendants, parseStateHtml, stateHtmlText } from "./state-ballot-html.js";
import { containsControlCharacters } from "./text-validation.js";

export interface ChicagoNativeField { text: string; left: number; top: number; width: number; height: number; size: number; family: string; color: string }
export function chicagoNativePages(body: string) {
	if (Buffer.byteLength(body) > 4 * 1024 * 1024 || body.includes("\uFFFD") || containsControlCharacters(body.replace(/[\r\n\t]/gu, "")) || !/^<\?xml[^>]+>\s*<!DOCTYPE pdf2xml SYSTEM "pdf2xml.dtd">/u.test(body) || !/<\/pdf2xml>\s*$/u.test(body)) throw new Error("The Chicago native PDF envelope requires review.");
	const document = parseStateHtml(body);
	const pending = [{ node: document, depth: 0 }];
	let visited = 0;
	while (pending.length) {
		const item = pending.pop()!;
		if (++visited > 150000 || item.depth > 64) throw new Error("The Chicago native structure exceeds its bounds.");
		for (const child of item.node.childNodes ?? []) pending.push({ node: child, depth: item.depth + 1 });
	}
	if (descendants(document, node => ["image", "img", "script", "iframe", "object"].includes(node.nodeName)).length) throw new Error("The Chicago native document has an unsupported non-text region.");
	const pages = descendants(document, node => node.nodeName === "page");
	if (!pages.length || pages.length > 60) throw new Error("The Chicago page inventory exceeds its bounds.");
	const fonts = new Map<string, { size: number; family: string; color: string }>();
	return pages.map((page, index) => {
		if (attribute(page, "number") !== String(index + 1) || attribute(page, "width") !== "918" || attribute(page, "height") !== "1188") throw new Error("The Chicago native page sequence or dimensions require review.");
		for (const font of descendants(page, node => node.nodeName === "fontspec")) {
			const id = attribute(font, "id");
			const size = Number(attribute(font, "size"));
			const family = attribute(font, "family");
			const color = attribute(font, "color");
			if (!/^\d{1,3}$/u.test(id) || fonts.has(id) || !Number.isFinite(size) || size < 8 || size > 30 || !/^(?:CIDFont\+F\d{1,2}|Arial)$/u.test(family) || !["#000000", "#000080"].includes(color)) throw new Error("The Chicago native font specification requires review.");
			fonts.set(id, { size, family, color });
		}
		const fields = descendants(page, node => node.nodeName === "text").map((node): ChicagoNativeField => {
			const font = fonts.get(attribute(node, "font"));
			if (!font || descendants(node, child => !["#text", "b", "i"].includes(child.nodeName)).length) throw new Error("The Chicago native text styling requires review.");
			const field = { text: stateHtmlText(node).replace(/\s+/gu, " ").trim(), left: Number(attribute(node, "left")), top: Number(attribute(node, "top")), width: Number(attribute(node, "width")), height: Number(attribute(node, "height")), ...font };
			if ([field.left, field.top, field.width, field.height].some(value => !Number.isFinite(value)) || field.left < 0 || field.top < 0 || field.width < 0 || field.height <= 0 || field.left + field.width > 920 || field.top + field.height > 1190 || field.text.length > 1000 || (field.family === "Arial" && (field.text !== `Page ${index + 1} of ${pages.length}` || field.top < 1100))) throw new Error("The Chicago native text geometry requires review.");
			return field;
		}).filter(field => field.text).sort((first, second) => first.top - second.top || first.left - second.left);
		if (fields.length < 6 || fields.length > 3000 || fields.filter(field => field.text === `Page ${index + 1} of ${pages.length}` && field.top > 1100).length !== 1) throw new Error("The Chicago printed page inventory requires review.");
		return fields;
	});
}

export function chicagoNativeRows(fields: readonly ChicagoNativeField[]) {
	const rows: ChicagoNativeField[][] = [];
	for (const field of fields) {
		const last = rows.at(-1);
		if (last && field.top - last[0]!.top <= 2) last.push(field);
		else rows.push([field]);
	}
	return rows.map(row => row.sort((first, second) => first.left - second.left));
}
