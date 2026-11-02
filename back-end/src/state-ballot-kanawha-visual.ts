import { Buffer } from "node:buffer";
import { parseStateHtml, stateHtmlAttribute, stateHtmlDescendants, stateHtmlText } from "./state-ballot-html.js";

interface Field { text: string; left: number; bottom: number; right: number; top: number; order: number }
interface Draw { text: string; left: number; baseline: number; size: number; order: number }
interface Paint { left: number; bottom: number; right: number; top: number; order: number; columnBorder?: true }
const number = "-?(?:0|[1-9]\\d{0,3})(?:\\.\\d{1,5})?";
const matrix = new RegExp(`^1 0 0 1 (${number}) (${number}) Tm$`, "u");
const coordinate = new RegExp(`^(${number}) (${number}) ([ml])$`, "u");
const rectangle = new RegExp(`^(${number}) (${number}) (${number}) (${number}) re$`, "u");
const corner = new RegExp(`^(${number}) (${number}) (${number}) (${number}) (${number}) (${number}) c$`, "u");
function reject(): never {
	throw new Error("The Kanawha County visible report requires review.");
}
function literal(value: string) {
	const match = /^\(((?:\\[()\\]|[^()\\\r\n])*)\)Tj$/u.exec(value);
	if (!match) return reject();
	const text = match[1]!.replace(/\\([()\\])/gu, "$1");
	if (text.length > 300 || !/^[\x20-\x7E]*$/u.test(text)) return reject();
	return text;
}
function overlaps(first: Paint, second: Paint) {
	return first.left < second.right - 0.005001 && first.right > second.left + 0.005001 && first.bottom < second.top - 0.005001 && first.top > second.bottom + 0.005001;
}
function content(body: string) {
	const lines = body.trimEnd().split("\n");
	if (lines.length > 15000 || lines.slice(0, 6).join("\n") !== "q\nBT\n36 756 Td\nET\nQ\n2 J") return reject();
	const draws: Draw[] = [];
	const paints: Paint[] = [];
	let points: number[][] = [];
	let white = false;
	let stroke = "black";
	for (let offset = 6; offset < lines.length; offset++) {
		const line = lines[offset]!;
		if (line === "BT") {
			const position = matrix.exec(lines[++offset] ?? "");
			const font = /^\/F1 ([789]|10|12|13) Tf$/u.exec(lines[++offset] ?? "");
			if (!position || !font) return reject();
			const left = Number(position[1]);
			const baseline = Number(position[2]);
			const size = Number(font[1]);
			if (lines[offset + 1] === "()Tj" && lines[offset + 2] === "ET" && left === 0 && baseline === 792 && size === 10 && !draws.length) {
				offset += 2;
				continue;
			}
			if (lines[++offset] !== "0 0 0 rg") return reject();
			const text = literal(lines[++offset] ?? "");
			if (!text.trim() || left < 20 || left > 590 || baseline < 25 || baseline > 765 || lines[++offset] !== "0 g" || lines[++offset] !== "ET") return reject();
			draws.push({ text, left, baseline, size, order: offset });
			white = false;
			continue;
		}
		if (["1 0 0 1 0 0 cm", "[] 0 d", "2 J", "0 J", "1 w"].includes(line)) continue;
		if (line === "1 1 1 rg") {
			white = true;
			continue;
		}
		if (["0 0 0 RG", "1 1 1 RG", "0.8549 0.85098 0.84314 RG"].includes(line)) {
			stroke = line;
			continue;
		}
		const point = coordinate.exec(line);
		const box = rectangle.exec(line);
		const curve = corner.exec(line);
		if (point) {
			if (point[3] === "m" && points.length) return reject();
			if (point[3] === "l" && !points.length) return reject();
			points.push([Number(point[1]), Number(point[2])]);
		}
		else if (box) {
			if (points.length) return reject();
			const [left, top, width, height] = box.slice(1).map(Number) as [number, number, number, number];
			if (width <= 0 || height >= 0) return reject();
			points = [[left, top], [left + width, top], [left + width, top + height], [left, top + height]];
		}
		else if (curve) {
			const values = curve.slice(1).map(Number);
			if (!points.length || values[0] !== values[2] || values[2] !== values[4] || values[1] !== values[3] || values[3] !== values[5] || points.at(-1)![0] !== values[0] || points.at(-1)![1] !== values[1]) return reject();
		}
		else if (line === "f" || line === "S") {
			if (points.length < 2 || (line === "f" && (!white || points.length < 4))) return reject();
			const horizontal = points.length === 2 && points[0]![1] === points[1]![1];
			if (line === "S" && stroke !== "1 1 1 RG" && !horizontal) return reject();
			const left = Math.min(...points.map(point => point[0]!));
			const right = Math.max(...points.map(point => point[0]!));
			const bottom = Math.min(...points.map(point => point[1]!));
			const top = Math.max(...points.map(point => point[1]!));
			if (left < 19.5 || right > 590.5 || bottom < 25 || top > 723) return reject();
			if (line === "f") {
				paints.push({ left, right, bottom, top, order: offset });
			}
			else {
				for (const [position, end] of points.slice(1).entries()) {
					const start = points[position]!;
					if (start[0] !== end[0] && start[1] !== end[1]) return reject();
					const columnBorder = stroke === "1 1 1 RG" && start[0] === end[0] && [20, 160, 200, 240].includes(start[0]!);
					paints.push({ left: Math.min(start[0]!, end[0]!) - 0.5, right: Math.max(start[0]!, end[0]!) + 0.5, bottom: Math.min(start[1]!, end[1]!) - 0.5, top: Math.max(start[1]!, end[1]!) + 0.5, order: offset, ...(columnBorder ? { columnBorder: true as const } : {}) });
				}
			}
			points = [];
		}
		else {
			return reject();
		}
		if (points.length > 8) return reject();
	}
	if (points.length || !draws.length || draws.length > 2000) return reject();
	return { draws, paints };
}
export function readKanawhaNativeRendering(objectBody: string, bboxBody: string) {
	if (Buffer.byteLength(objectBody) > 4 * 1024 * 1024 || Buffer.byteLength(bboxBody) > 4 * 1024 * 1024) return reject();
	const document = JSON.parse(objectBody);
	const objects = document.qpdf?.[1];
	const dom = parseStateHtml(bboxBody);
	const pages = stateHtmlDescendants(dom, node => node.nodeName === "page");
	if (!objects || !Array.isArray(document.pages) || document.pages.length !== pages.length || !pages.length || pages.length > 20) return reject();
	const usedStreams = new Set<string>();
	const output: Field[][] = [];
	for (const [index, page] of pages.entries()) {
		if (stateHtmlAttribute(page, "width") !== "612.000000" || stateHtmlAttribute(page, "height") !== "792.000000") return reject();
		const reference = objects[`obj:${document.pages[index].object}`]?.value?.["/Contents"];
		const stream = objects[`obj:${reference}`]?.stream;
		if (typeof reference !== "string" || usedStreams.has(reference) || !stream || JSON.stringify(stream.dict) !== "{}" || typeof stream.data !== "string") return reject();
		usedStreams.add(reference);
		const bytes = Buffer.from(stream.data, "base64");
		if (bytes.toString("base64") !== stream.data) return reject();
		const native = content(bytes.toString("latin1"));
		const words = stateHtmlDescendants(page, node => node.nodeName === "word").map((node) => {
			const [left, bottom, right, top] = ["xmin", "ymax", "xmax", "ymin"].map(name => Number(stateHtmlAttribute(node, name)));
			if (![left, bottom, right, top].every(Number.isFinite) || left < 20 || right > 591 || bottom > 768 || top < 20 || left >= right || top >= bottom) return reject();
			return { text: stateHtmlText(node), left, bottom: 792 - bottom, right, top: 792 - top, used: false };
		});
		if (!words.length || words.length > 6000) return reject();
		const fields = native.draws.map((draw) => {
			const next = native.draws.filter(other => Math.abs(other.baseline - draw.baseline) < 0.1 && other.left > draw.left).sort((first, second) => first.left - second.left)[0];
			const selected = words.filter(word => word.left >= draw.left - 0.1 && (!next || word.left < next.left - 0.1) && Math.abs(word.top - (draw.baseline + draw.size * 0.718)) < 0.1).sort((first, second) => first.left - second.left);
			const leading = draw.text.length - draw.text.trimStart().length;
			if (!selected.length || selected.some(word => word.used) || selected.map(word => word.text).join(" ") !== draw.text.trim() || Math.abs(selected[0]!.left - draw.left - leading * draw.size * 0.278) > 0.1) throw new Error(`The Kanawha County visible position for ${draw.text.slice(0, 80)} requires review.`);
			for (const word of selected) word.used = true;
			return { text: draw.text.trim(), left: selected[0]!.left, right: selected.at(-1)!.right, bottom: Math.min(...selected.map(word => word.bottom)), top: Math.max(...selected.map(word => word.top)), order: draw.order };
		});
		if (words.some(word => !word.used)) return reject();
		for (const [position, field] of fields.entries()) {
			if (fields.slice(position + 1).some(other => overlaps(field, other))) throw new Error(`The Kanawha County overlapping text for ${field.text.slice(0, 80)} requires review.`);
			const overlay = native.paints.find(paint => paint.order > field.order && overlaps(field, paint) && !(paint.columnBorder && (paint.right - field.left <= 0.505001 || field.right - paint.left <= 0.505001)));
			if (overlay) throw new Error(`The Kanawha County overpainted text for ${field.text.slice(0, 80)} requires review.`);
		}
		output.push(fields);
	}
	if (Object.values(objects).filter(item => item && typeof item === "object" && "stream" in item).length !== usedStreams.size) return reject();
	return output;
}
