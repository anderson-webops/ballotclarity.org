import { Buffer } from "node:buffer";
import { parishSampleHash, readParishSamplePages } from "./louisiana-parish-samples.js";
import { parseStateHtml, stateHtmlAttribute, stateHtmlDescendants, stateHtmlText } from "./state-ballot-html.js";

const clean = (text: string) => text.replace(/\s+/gu, " ").trim();
const compact = (text: string) => text.replace(/\s+/gu, "");

export function readParishQuestionReferences(raw: string, xml: string, parish: string, electionDate: string) {
	const rawPages = readParishSamplePages(raw, parish, electionDate);
	if (Buffer.byteLength(xml) > 4 * 1024 * 1024 || xml.includes("\uFFFD")) throw new Error("Parish question XML exceeds its reviewed bounds.");
	const tree = parseStateHtml(xml);
	const roots = stateHtmlDescendants(tree, node => node.nodeName === "pdf2xml");
	if (roots.length !== 1 || stateHtmlAttribute(roots[0]!, "producer") !== "poppler") throw new Error("Parish question XML producer changed.");
	const fonts = new Map<string, { family: string; size: number; color: string }>();
	for (const node of stateHtmlDescendants(tree, node => node.nodeName === "fontspec")) {
		const identity = stateHtmlAttribute(node, "id");
		const font = { family: stateHtmlAttribute(node, "family").replace(/^[A-Z]{6}\+/u, ""), size: Number(stateHtmlAttribute(node, "size")), color: stateHtmlAttribute(node, "color") };
		if (!identity || (fonts.has(identity) && JSON.stringify(fonts.get(identity)) !== JSON.stringify(font))) throw new Error("Parish question font inventory changed.");
		fonts.set(identity, font);
	}
	const pages = stateHtmlDescendants(roots[0]!, node => node.nodeName === "page");
	if (!pages.length || pages.length > 20 || pages.length !== rawPages.length) throw new Error("Parish question page inventories disagree.");
	const questions = [];
	for (const [pageIndex, page] of pages.entries()) {
		if (stateHtmlAttribute(page, "number") !== String(pageIndex + 1)) throw new Error("Parish question page numbering changed.");
		const rows = stateHtmlDescendants(page, node => node.nodeName === "text").map(node => ({ text: clean(stateHtmlText(node)), font: fonts.get(stateHtmlAttribute(node, "font")), top: Number(stateHtmlAttribute(node, "top") || Number.NaN), left: Number(stateHtmlAttribute(node, "left") || Number.NaN) })).filter(row => row.text);
		if (rows.length > 5000 || rows.some(row => !row.font)) throw new Error("Parish question text inventory changed.");
		if (pageIndex === 0) {
			const markers = rows.filter(row => row.text === "ELECTION DAY" && row.font!.family === "Rockwell" && row.font!.size === 25 && row.font!.color === "#252d69");
			const marker = markers[0];
			const dateLabel = new Date(`${electionDate}T12:00:00Z`).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
			if (markers.length !== 1 || !marker || rows.filter(row => row.text === dateLabel && row.font!.family === "Rockwell" && row.font!.size === 29 && row.font!.color === "#252d69" && Math.abs(row.left - marker.left) <= 2 && row.top - marker.top >= 30 && row.top - marker.top <= 65).length !== 1) throw new Error("Parish visible election-day date requires review.");
		}
		const heading = (row: typeof rows[number]) => row.font!.family === "Rockwell" && [17, 18].includes(row.font!.size) && row.font!.color === "#4a95d7";
		const pageQuestions = [];
		for (let position = 0; position < rows.length; position++) {
			if (!heading(rows[position]!)) continue;
			const titleRows = [];
			while (position < rows.length && heading(rows[position]!)) titleRows.push(rows[position++]!.text);
			const title = titleRows.join(" ");
			if (!/\bProposition\b/u.test(title)) {
				position--;
				continue;
			}
			if (titleRows.length > 3 || title.length > 350 || !/^\p{L}/u.test(title) || !rows[position]?.text.startsWith("Shall ")) throw new Error("Parish question heading or opening changed.");
			const bodyRows = [];
			while (position < rows.length && rows[position]!.text !== "■") {
				const row = rows[position++]!;
				if (row.font!.family !== "NunitoSans" || row.font!.size !== 15 || row.font!.color !== "#231f20") throw new Error("Parish question wording style changed.");
				bodyRows.push(row.text);
			}
			const text = bodyRows.join(" ");
			const choices = rows.slice(position, position + 4);
			if (!text.endsWith("?") || text.length > 10000 || choices.map(row => row.text).join(" ") !== "■ Yes ■ No" || rows[position + 4]?.text === "■" || choices.some(row => ["Yes", "No"].includes(row.text) && (row.font!.family !== "NunitoSans-SemiBold" || row.font!.size !== 17 || row.font!.color !== "#231f20"))) throw new Error("Parish question wording or binary choices changed.");
			if (!compact(rawPages[pageIndex]!).includes(compact(`${title}${text}■Yes■No`))) throw new Error("Parish question visible and raw wording disagree.");
			const municipality = /^(?:City|Town|Village) of .+?(?= Proposition\b)/u.exec(title)?.[0];
			const held = municipality && !/\bDistrict\b/u.test(municipality) && !text.startsWith(`Shall the ${municipality},`) && !text.startsWith(`Shall ${municipality},`);
			pageQuestions.push({ id: parishSampleHash(`${parish}\n${electionDate}\n${title}\n${text}\nYes\nNo`).slice(0, 24), title, text, choices: ["Yes", "No"], sourcePage: pageIndex + 1, reviewStatus: held ? "held" as const : "prepared" as const, ...(held ? { holdReason: "heading-body-jurisdiction-conflict" } : {}) });
			position += 3;
		}
		const rawChoices = [...rawPages[pageIndex]!.matchAll(/■\s*Yes\s*■\s*No/gu)].length;
		if (pageQuestions.length !== rawChoices || pageQuestions.length !== rows.filter(row => row.text === "Yes" || row.text === "No").length / 2) throw new Error("Parish question inventories are incomplete or inconsistent.");
		questions.push(...pageQuestions);
	}
	if (questions.length > 100 || new Set(questions.map(question => question.id)).size !== questions.length) throw new Error("Parish question inventory is duplicated or exceeds its bound.");
	return questions;
}
