import type { UnionSampleDocument } from "./union-county-ballots.js";
import { Buffer } from "node:buffer";
import { stateHtmlAttribute as attribute, stateHtmlDescendants as descendants, parseStateHtml, stateHtmlText } from "./state-ballot-html.js";
import { readUnionBallotCells } from "./union-ballot-witnesses.js";

const clean = (value: string) => value.normalize("NFKC").replace(/\s+/gu, " ").trim();
const canonical = (value: string) => clean(value).toLocaleUpperCase("en-US").replace(/[^\p{L}\p{N}]/gu, "");
interface Line { text: string; left: number; right: number; top: number; bottom: number }
export interface UnionSampleQuestion {
	printedHeading: string;
	municipality: string;
	officialText: { en: string; es: string };
	interpretiveStatement: { en: string; es: string };
	printedChoices: ["YES/SÍ", "NO"];
	page: 1;
}
function reject(): never {
	throw new Error("The Union County printed public-question layout requires review.");
}
export function readUnionSampleQuestion(bbox: string, layout: string, document: UnionSampleDocument, electionDate: string): UnionSampleQuestion | null {
	readUnionBallotCells(bbox, layout, document, electionDate);
	if (Buffer.byteLength(bbox) > 4 * 1024 * 1024) return reject();
	const lines = descendants(parseStateHtml(bbox), node => node.nodeName === "line").map((node): Line => {
		const line = { text: clean(stateHtmlText(node)), left: Number(attribute(node, "xmin")), right: Number(attribute(node, "xmax")), top: Number(attribute(node, "ymin")), bottom: Number(attribute(node, "ymax")) };
		if (!line.text || line.text.length > 2000 || ![line.left, line.right, line.top, line.bottom].every(Number.isFinite) || line.left < 0 || line.right > 1824 || line.top < 0 || line.bottom > 1284 || line.left >= line.right || line.top >= line.bottom) return reject();
		return line;
	});
	if (!lines.length || lines.length > 10000) return reject();
	const markers = lines.filter(line => /PUBLIC QUESTION|PREGUNTA PÚBLICA|^QUESTION:|^PREGUNTA:|INTERPRETIVE STATEMENT|DECLARACIÓN INTERPRETATIVA/u.test(line.text));
	const visibleMarkers = [...layout.matchAll(/PUBLIC\s+QUESTION|PREGUNTA\s+PÚBLICA|QUESTION:|PREGUNTA:|INTERPRETIVE\s+STATEMENT|DECLARACIÓN\s+INTERPRETATIVA/gu)];
	if (!markers.length && !visibleMarkers.length) return null;
	const headings = ["PUBLIC QUESTION TO BE VOTED UPON", "PREGUNTA PÚBLICA PARA VOTACIÓN", "QUESTION:", "INTERPRETIVE STATEMENT:", "PREGUNTA:", "DECLARACIÓN INTERPRETATIVA:"];
	if (markers.length !== headings.length || visibleMarkers.length !== headings.length) return reject();
	const selected = headings.map((heading) => {
		const matches = markers.filter(line => line.text === heading);
		if (matches.length !== 1) return reject();
		return matches[0]!;
	});
	if (selected.some((line, index) => line.left < 120 || line.right > 640 || line.top < 750 || line.bottom > 1200 || (index > 0 && line.top <= selected[index - 1]!.top))) return reject();
	const choices = lines.filter(line => line.top >= selected[2]!.top && line.bottom <= selected[3]!.top && line.left >= 575 && line.right <= 640 && ["YES/SÍ", "NO"].includes(line.text)).sort((left, right) => left.top - right.top);
	if (choices.map(line => line.text).join(",") !== "YES/SÍ,NO") return reject();
	const visible = canonical(layout);
	if (lines.some(line => line.left < 640 && line.right > 120 && line.top >= selected[0]!.top && (line.left < 120 || line.right > 640 || line.bottom > 1200))) return reject();
	const panel = lines.filter(line => line.left >= 120 && line.right <= 640 && line.top >= selected[0]!.top && line.bottom <= 1200).sort((left, right) => left.top - right.top || left.left - right.left);
	const consumed = new Set<Line>([...selected, ...choices]);
	function paragraph(start: Line, end: number) {
		const content = panel.filter(line => line.top > start.top && line.top < end && !consumed.has(line));
		if (!content.length || content.length > 30 || content.some(line => line.left > 135 || line.bottom - line.top < 10 || line.bottom - line.top > 17 || !visible.includes(canonical(line.text)))) return reject();
		for (const line of content) consumed.add(line);
		const value = clean(content.map(line => line.text).join(" "));
		if (value.length < 30 || value.length > 6000) return reject();
		return value;
	}
	const englishQuestion = paragraph(selected[2]!, selected[3]!.top);
	const englishStatement = paragraph(selected[3]!, selected[4]!.top);
	const spanishQuestion = paragraph(selected[4]!, selected[5]!.top);
	const spanishStatement = paragraph(selected[5]!, 1200);
	if (panel.some(line => !consumed.has(line)) || !englishQuestion.endsWith("?") || !spanishQuestion.startsWith("¿") || !spanishQuestion.endsWith("?")) return reject();
	return { printedHeading: headings[0]!, municipality: document.claims[0]!.municipality, officialText: { en: englishQuestion, es: spanishQuestion }, interpretiveStatement: { en: englishStatement, es: spanishStatement }, printedChoices: ["YES/SÍ", "NO"], page: 1 };
}
