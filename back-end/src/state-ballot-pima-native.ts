import { Buffer } from "node:buffer";
import { stateHtmlAttribute as attribute, stateHtmlDescendants as descendants, parseStateHtml, stateHtmlText } from "./state-ballot-html.js";
import { containsControlCharacters } from "./text-validation.js";

export type PimaDocumentKind = "candidates" | "write-ins";
export interface PimaNativeField { text: string; left: number; top: number; width: number; height: number; size: number; family: string; bold: boolean }
export function pimaNativePages(body: string, kind: PimaDocumentKind) {
	if (!["candidates", "write-ins"].includes(kind) || Buffer.byteLength(body) > 4 * 1024 * 1024 || body.includes("\uFFFD") || containsControlCharacters(body.replace(/[\r\n\t]/gu, "")) || !/^<\?xml[^>]+>\s*<!DOCTYPE pdf2xml SYSTEM "pdf2xml.dtd">/u.test(body) || !/<\/pdf2xml>\s*$/u.test(body)) throw new Error("The Pima native document requires review.");
	const document = parseStateHtml(body);
	const pending = [{ node: document, depth: 0 }];
	let visited = 0;
	while (pending.length) {
		const item = pending.pop()!;
		if (++visited > 150000 || item.depth > 64 || ["image", "img", "script", "iframe", "object"].includes(item.node.nodeName)) throw new Error("The Pima native structure requires review.");
		for (const node of item.node.childNodes ?? []) pending.push({ node, depth: item.depth + 1 });
	}
	const pages = descendants(document, node => node.nodeName === "page");
	if (!pages.length || pages.length > 20) throw new Error("The Pima page inventory requires review.");
	const fonts = new Map<string, { size: number; family: string }>();
	return pages.map((page, index) => {
		if (attribute(page, "number") !== String(index + 1) || attribute(page, "width") !== "918" || attribute(page, "height") !== "1188") throw new Error("The Pima page dimensions or sequence require review.");
		for (const font of descendants(page, node => node.nodeName === "fontspec")) {
			const id = attribute(font, "id");
			const size = Number(attribute(font, "size"));
			const match = /^[A-Z]{6}\+(Calibri|Arial|ArialNarrow)$/u.exec(attribute(font, "family"));
			if (!/^\d{1,3}$/u.test(id) || fonts.has(id) || !match || !Number.isFinite(size) || size < 8 || size > 40 || attribute(font, "color") !== "#000000" || (kind === "candidates" ? match[1] !== "Calibri" : !["Arial", "ArialNarrow"].includes(match[1]!))) throw new Error("The Pima native font requires review.");
			fonts.set(id, { size, family: match[1]! });
		}
		const fields = descendants(page, node => node.nodeName === "text").map((node): PimaNativeField => {
			const font = fonts.get(attribute(node, "font"));
			if (!font || descendants(node, child => !["#text", "b", "i"].includes(child.nodeName)).length) throw new Error("The Pima native text styling requires review.");
			const original = stateHtmlText(node);
			const boldNodes = descendants(node, child => child.nodeName === "b");
			if (boldNodes.length > 1 || (boldNodes.length && stateHtmlText(boldNodes[0]!).trim() !== original.trim())) throw new Error("The Pima native emphasis requires review.");
			const field = { text: original.replace(/\s+/gu, " ").trim(), left: Number(attribute(node, "left")), top: Number(attribute(node, "top")), width: Number(attribute(node, "width")), height: Number(attribute(node, "height")), bold: boldNodes.length === 1, ...font };
			if (kind === "write-ins" && original.trimEnd().length < original.length && /^GENERAL ELECTION - NOVEMBER [2-8], 20\d{2} \/$/u.test(field.text)) field.width = Math.min(field.width, 918 - field.left);
			if ([field.left, field.top, field.width, field.height].some(value => !Number.isFinite(value)) || field.left < 0 || field.top < 0 || field.width < 0 || field.height <= 0 || field.left + field.width > 920 || field.top + field.height > 1190 || field.text.length > 1500) throw new Error("The Pima text geometry requires review.");
			return field;
		}).filter(field => field.text).sort((first, second) => first.top - second.top || first.left - second.left);
		if (fields.length < 10 || fields.length > 3000) throw new Error("The Pima native field inventory requires review.");
		return fields;
	});
}
