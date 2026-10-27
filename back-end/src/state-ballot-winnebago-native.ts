import { Buffer } from "node:buffer";
import { stateHtmlAttribute as attribute, stateHtmlDescendants as descendants, parseStateHtml, stateHtmlText } from "./state-ballot-html.js";
import { containsControlCharacters } from "./text-validation.js";

export function winnebagoNativePages(body: string) {
	if (Buffer.byteLength(body) > 4 * 1024 * 1024 || containsControlCharacters(body.replace(/[\r\n\t]/gu, "")) || body.includes("\uFFFD") || !/^<\?xml[^>]+>\s*<!DOCTYPE pdf2xml SYSTEM "pdf2xml.dtd">/u.test(body) || !/<\/pdf2xml>\s*$/u.test(body)) throw new Error("The Winnebago native envelope requires review.");
	const document = parseStateHtml(body);
	const pending = [{ node: document, depth: 0 }];
	let visited = 0;
	while (pending.length) {
		const item = pending.pop()!;
		if (++visited > 60000 || item.depth > 80) throw new Error("The Winnebago native structure exceeds its bounds.");
		for (const child of item.node.childNodes ?? []) pending.push({ node: child, depth: item.depth + 1 });
	}
	if (descendants(document, node => ["image", "img", "script", "object", "iframe"].includes(node.nodeName)).length) throw new Error("The Winnebago native nontext content requires review.");
	const pages = descendants(document, node => node.nodeName === "page");
	if (!pages.length || pages.length > 20) throw new Error("The Winnebago native page inventory requires review.");
	return pages.map((page, index) => {
		if (attribute(page, "number") !== String(index + 1) || attribute(page, "width") !== "918" || attribute(page, "height") !== "1188") throw new Error("The Winnebago native page dimensions require review.");
		const fields = descendants(page, node => node.nodeName === "text").map((node) => {
			const field = { text: stateHtmlText(node).normalize("NFKC").replace(/\s+/gu, " ").trim(), left: Number(attribute(node, "left")), top: Number(attribute(node, "top")), width: Number(attribute(node, "width")), height: Number(attribute(node, "height")), bold: descendants(node, child => child.nodeName === "b").length > 0 };
			if ([field.left, field.top, field.width, field.height].some(value => !Number.isFinite(value)) || field.left < 0 || field.top < 0 || field.width < 0 || field.height <= 0 || field.left + field.width > 920 || field.top + field.height > 1190 || field.text.length > 500) throw new Error("The Winnebago native field geometry requires review.");
			return field;
		}).filter(field => field.text);
		if (!fields.length || fields.length > 4000) throw new Error("The Winnebago native field inventory requires review.");
		return fields;
	});
}
