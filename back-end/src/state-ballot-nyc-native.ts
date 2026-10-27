import { Buffer } from "node:buffer";
import { stateHtmlAttribute as attribute, stateHtmlDescendants as descendants, parseStateHtml, stateHtmlText } from "./state-ballot-html.js";
import { containsControlCharacters } from "./text-validation.js";

export interface NycNativeField { text: string; left: number; top: number; width: number; height: number; size: number; bold: boolean }
function reject(): never {
	throw new Error("The NYC native candidate document requires review.");
}

export function nycNativePages(body: string) {
	if (Buffer.byteLength(body) > 4 * 1024 * 1024 || body.includes("\uFFFD") || containsControlCharacters(body.replace(/[\r\n\t]/gu, "")) || !/^<\?xml[^>]+>\s*<!DOCTYPE pdf2xml SYSTEM "pdf2xml.dtd">/u.test(body) || !/<\/pdf2xml>\s*$/u.test(body)) return reject();
	const document = parseStateHtml(body);
	const pending = [{ node: document, depth: 0 }];
	let visited = 0;
	while (pending.length) {
		const item = pending.pop()!;
		if (++visited > 100000 || item.depth > 64) return reject();
		for (const child of item.node.childNodes ?? []) pending.push({ node: child, depth: item.depth + 1 });
	}
	if (descendants(document, node => ["image", "img", "script", "iframe", "object"].includes(node.nodeName)).length) return reject();
	const pages = descendants(document, node => node.nodeName === "page");
	if (pages.length < 6 || pages.length > 60) return reject();
	const fonts = new Map<string, { size: number; bold: boolean }>();
	return pages.map((page, index) => {
		if (attribute(page, "number") !== String(index + 1) || attribute(page, "width") !== "1188" || attribute(page, "height") !== "918") return reject();
		for (const node of descendants(page, node => node.nodeName === "fontspec")) {
			const id = attribute(node, "id");
			const size = Number(attribute(node, "size"));
			const family = attribute(node, "family");
			if (!/^\d{1,2}$/u.test(id) || fonts.has(id) || fonts.size >= 24 || !Number.isFinite(size) || size < 8 || size > 30 || !/^(?:[A-Z]{6}\+)?Arial(?:,Bold)?$/u.test(family) || attribute(node, "color") !== "#000000") return reject();
			fonts.set(id, { size, bold: family.endsWith(",Bold") });
		}
		const fields = descendants(page, node => node.nodeName === "text").map((node): NycNativeField => {
			const font = fonts.get(attribute(node, "font"));
			const bold = descendants(node, child => child.nodeName === "b").length;
			if (!font || descendants(node, child => !["#text", "b"].includes(child.nodeName)).length || bold !== Number(font.bold)) return reject();
			const field = { text: stateHtmlText(node).replace(/\s+/gu, " ").trim(), left: Number(attribute(node, "left")), top: Number(attribute(node, "top")), width: Number(attribute(node, "width")), height: Number(attribute(node, "height")), ...font };
			if ([field.left, field.top, field.width, field.height].some(value => !Number.isFinite(value)) || field.left < 0 || field.top < 0 || field.width < 0 || field.height <= 0 || field.left + field.width > 1190 || field.top + field.height > 920 || field.text.length > 1800) return reject();
			return field;
		}).filter(field => field.text).sort((first, second) => first.top - second.top || first.left - second.left);
		if (!fields.length || fields.length > 2000) return reject();
		return fields;
	});
}

export function nycNativeRows(fields: readonly NycNativeField[]) {
	const rows: NycNativeField[][] = [];
	for (const field of [...fields].sort((first, second) => first.top - second.top || first.left - second.left)) {
		const last = rows.at(-1);
		if (last && field.top - last[0]!.top <= 1) last.push(field);
		else rows.push([field]);
	}
	return rows.map(row => row.sort((first, second) => first.left - second.left));
}
