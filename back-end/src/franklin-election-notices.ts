import type { StateHtmlNode } from "./state-ballot-html.js";
import type { StateBallotQuestion } from "./state-ballot-questions.js";
import type { StateBallotSource } from "./state-ballot-sources.js";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { stateHtmlAttribute as attribute, stateHtmlDescendants as descendants, parseStateHtml, stateHtmlText } from "./state-ballot-html.js";
import { extractStateBallotPdfSvg, extractStateBallotPdfText, resolveStateBallotPdfExtractor, resolveStateBallotPdfSvgExtractor } from "./state-ballot-pdf.js";
import { containsControlCharacters } from "./text-validation.js";

interface Word { text: string; left: number; right: number; top: number; bottom: number }
interface Line { top: number; words: Word[] }
interface Rectangle { left: number; right: number; top: number; bottom: number }
const clean = (value: string) => value.normalize("NFKC").replace(/\s+/gu, " ").trim();
const joined = (words: Word[]) => words.map(word => word.text).join(" ");
function requireValue(value: unknown, detail: string): asserts value {
	if (!value) throw new Error(`The Franklin election notice requires review: ${detail}.`);
}
function document(body: string) {
	requireValue(Buffer.byteLength(body) <= 4 * 1024 * 1024, "native document bound");
	const parsed = parseStateHtml(body);
	const pending = [{ node: parsed, depth: 0 }];
	let visited = 0;
	while (pending.length) {
		const entry = pending.pop()!;
		requireValue(++visited <= 150000 && entry.depth <= 64, "native structure bound");
		for (const node of entry.node.childNodes ?? []) pending.push({ node, depth: entry.depth + 1 });
	}
	return parsed;
}
function lines(words: Word[]) {
	const result: Line[] = [];
	for (const word of [...words].sort((first, second) => first.top - second.top || first.left - second.left)) {
		let line = result.at(-1);
		if (!line || word.top - line.top > 0.6) result.push(line = { top: word.top, words: [] });
		line.words.push(word);
	}
	return result;
}
function rectangles(svg: string) {
	const roots = descendants(document(svg), node => node.nodeName === "svg");
	requireValue(roots.length === 1 && attribute(roots[0]!, "viewBox") === "0 0 612 792", "native grid dimensions");
	const pending: { node: StateHtmlNode; transformed: boolean }[] = [{ node: roots[0]!, transformed: false }];
	const result: Rectangle[] = [];
	while (pending.length) {
		const { node, transformed } = pending.pop()!;
		if (["defs", "clipPath"].includes(node.nodeName)) continue;
		const shifted = transformed || Boolean(attribute(node, "transform"));
		if (node.nodeName === "path") {
			const path = attribute(node, "d");
			if (/^M [-\d.]+ [-\d.]+ L [-\d.]+ [-\d.]+ L [-\d.]+ [-\d.]+ L [-\d.]+ [-\d.]+ Z(?: M [-\d.]+ [-\d.]+)?\s*$/u.test(path)) {
				const values = path.match(/-?\d+(?:\.\d+)?/gu)!.map(Number);
				if (values[1] === values[3] && values[2] === values[4] && values[5] === values[7] && values[0] === values[6]) {
					const rectangle = { left: Math.min(values[0]!, values[2]!), right: Math.max(values[0]!, values[2]!), top: Math.min(values[1]!, values[5]!), bottom: Math.max(values[1]!, values[5]!) };
					if (rectangle.left >= 0 && rectangle.right <= 612 && rectangle.top >= 0 && rectangle.bottom <= 792 && (rectangle.right - rectangle.left <= 1 || rectangle.bottom - rectangle.top <= 1)) {
						requireValue(!shifted, "transformed table rules");
						result.push(rectangle);
					}
				}
			}
		}
		for (const child of node.childNodes ?? []) pending.push({ node: child, transformed: shifted });
	}
	return result;
}
function questionId(source: StateBallotSource, question: Omit<StateBallotQuestion, "id">) {
	return createHash("sha256").update(JSON.stringify([source.id, source.electionDate, question.audience, question.title, question.officialText, question.pages, question.sourceUrl, "notice"])).digest("hex").slice(0, 24);
}
export async function prepareFranklinIssueDocument(bytes: Buffer) {
	const text = await resolveStateBallotPdfExtractor();
	const vector = await resolveStateBallotPdfSvgExtractor();
	const bbox = await extractStateBallotPdfText(bytes, text, 12000, "raw-bbox", 20);
	const layout = await extractStateBallotPdfText(bytes, text, 12000, "layout", 20);
	const pages = descendants(document(bbox), node => node.nodeName === "page");
	requireValue(pages.length > 0 && pages.length <= 20, "native preparation page count");
	const deadline = Date.now() + 90000;
	const svg = [];
	for (let page = 1; page <= pages.length; page++) {
		requireValue(deadline - Date.now() >= 12000, "native preparation duration");
		svg.push(await extractStateBallotPdfSvg(bytes, vector, page));
	}
	const result = JSON.stringify({ schemaVersion: 1, type: "franklin-certified-issue-grid", bbox, layout, svg });
	requireValue(Buffer.byteLength(result) <= 4 * 1024 * 1024, "prepared native document bound");
	return result;
}
export function readFranklinIssueNotices(source: StateBallotSource, body: string, sourceUrl: string, previous: readonly StateBallotQuestion[] = []) {
	requireValue(Buffer.byteLength(body) <= 4 * 1024 * 1024, "capture bound");
	const capture = JSON.parse(body);
	requireValue(capture && Object.keys(capture).sort().join(",") === "bbox,layout,schemaVersion,svg,type" && capture.schemaVersion === 1 && capture.type === "franklin-certified-issue-grid" && typeof capture.bbox === "string" && typeof capture.layout === "string" && Array.isArray(capture.svg), "native capture fields");
	const pages = descendants(document(capture.bbox), node => node.nodeName === "page");
	const layout = capture.layout.split("\f").filter((page: string) => page.trim());
	requireValue(pages.length > 0 && pages.length <= 20 && pages.length === capture.svg.length && pages.length === layout.length, "complete native page set");
	const questions: StateBallotQuestion[] = [];
	for (const [pageIndex, page] of pages.entries()) {
		requireValue(attribute(page, "width") === "612.000000" && attribute(page, "height") === "792.000000", "page dimensions");
		const words: Word[] = descendants(page, node => node.nodeName === "word").map(node => ({ text: clean(stateHtmlText(node)), left: Number(attribute(node, "xmin")), right: Number(attribute(node, "xmax")), top: Number(attribute(node, "ymin")), bottom: Number(attribute(node, "ymax")) }));
		requireValue(words.length > 0 && words.length <= 12000 && words.every(word => word.text && [word.left, word.right, word.top, word.bottom].every(Number.isFinite) && word.left >= 0 && word.right <= 612 && word.top >= 0 && word.bottom <= 792 && word.left < word.right && word.top < word.bottom && !containsControlCharacters(word.text)), "bounded word geometry");
		const grouped = lines(words);
		const date = `NOVEMBER ${Number(source.electionDate.slice(-2))}, ${source.electionDate.slice(0, 4)} GENERAL ELECTION`;
		requireValue(grouped.filter(line => joined(line.words) === "CERTIFIED QUESTIONS AND ISSUES").length === 1 && grouped.filter(line => joined(line.words) === date).length === 1 && grouped.filter(line => joined(line.words) === `Page ${pageIndex + 1}`).length === 1, "election and page identity");
		const headers = grouped.filter(line => joined(line.words) === "# Subdivision Purpose Rate");
		requireValue(headers.length === 1, "four printed column labels");
		const header = headers[0]!;
		const middle = (Math.min(...header.words.map(word => word.top)) + Math.max(...header.words.map(word => word.bottom))) / 2;
		const rules = rectangles(capture.svg[pageIndex]);
		const boundaries = [...new Set(rules.filter(rule => rule.right - rule.left <= 1 && rule.top < middle && rule.bottom > middle).map(rule => Math.round((rule.left + rule.right) * 5) / 10))].sort((first, second) => first - second);
		requireValue(boundaries.length === 5 && header.words.every((word, index) => word.left > boundaries[index]! && word.right < boundaries[index + 1]!), "column rules and labels agree");
		const horizontal = new Map<number, Rectangle[]>();
		for (const rule of rules.filter(rule => rule.bottom - rule.top <= 1 && rule.right - rule.left > 1)) {
			const height = Math.round((rule.top + rule.bottom) * 5) / 10;
			horizontal.set(height, [...(horizontal.get(height) ?? []), rule]);
		}
		const rows = [...horizontal].filter(([height, segments]) => {
			if (height <= middle) return false;
			let right = boundaries[0]!;
			for (const segment of [...segments].sort((first, second) => first.left - second.left)) {
				if (segment.left > right + 1) return false;
				right = Math.max(right, segment.right);
			}
			return right >= boundaries[4]! - 0.6;
		}).map(([height]) => height).sort((first, second) => first - second);
		requireValue(rows.length >= 2 && rows.length <= 100, "complete framed row inventory");
		const assigned: Word[] = [];
		for (let index = 0; index + 1 < rows.length; index++) {
			const rowWords = words.filter(word => (word.top + word.bottom) / 2 > rows[index]! && (word.top + word.bottom) / 2 < rows[index + 1]!);
			requireValue(rowWords.length > 0 && rowWords.every(word => word.left > boundaries[0]! && word.right < boundaries[4]!), "framed row text");
			assigned.push(...rowWords);
			const number = clean(joined(rowWords.filter(word => word.left < boundaries[1]!).sort((first, second) => first.top - second.top || first.left - second.left)));
			requireValue(!number || /^(?:#?\d{1,3}[A-Za-z]?|Issue \d{1,3})$/u.test(number), "literal published numbering");
			const subdivisions = lines(rowWords.filter(word => word.left >= boundaries[1]! && word.left < boundaries[2]!));
			const subdivision = clean(subdivisions.map(line => joined(line.words)).join(" "));
			const content = lines(rowWords.filter(word => word.left >= boundaries[2]!));
			requireValue(subdivision && content.length > 0, "subdivision and substantive notice cells");
			const descriptors = subdivisions.filter(line => /\bProposed /u.test(joined(line.words)));
			const sections = descriptors.length > 1
				? descriptors.map((entry, position) => {
						const left = subdivisions.filter(line => line.top >= entry.top && line.top < (descriptors[position + 1]?.top ?? Infinity)).map(line => joined(line.words)).join(" ");
						const title = left.slice(left.indexOf("Proposed "));
						const details = content.filter(line => line.top >= (position ? entry.top - 0.6 : -Infinity) && line.top < (descriptors[position + 1]?.top ?? Infinity) - 0.6).map(line => joined(line.words)).join("\n");
						requireValue(details, "compound notice purpose and rate association");
						return `${title}\n${details}`;
					})
				: [content.map(line => joined(line.words)).join("\n")];
			const audience = subdivision.startsWith("General Assembly Initiated ") ? "Ohio" : clean(subdivision.split(/\s+[–-]\s+|\bProposed /u)[0]!).replace(/[–-]$/u, "").trim();
			const question = { audience, title: `${number ? `${number} ` : ""}${subdivision}`, officialText: sections.join("\n\n"), choices: [] as [], textKind: "notice" as const, pages: [pageIndex + 1], sourceUrl, explicitlyAdvisory: false, voterApplicabilityVerified: false as const };
			questions.push({ id: questionId(source, question), ...question });
		}
		const tableWords = words.filter(word => (word.top + word.bottom) / 2 > rows[0]! && (word.top + word.bottom) / 2 < rows.at(-1)!);
		requireValue(assigned.length === tableWords.length && new Set(assigned).size === assigned.length, "every native table word assigned exactly once");
		const furniture = grouped.filter(line => !line.words.some(word => assigned.includes(word)));
		requireValue(furniture.length === 5 && furniture.every(line => ["CERTIFIED QUESTIONS AND ISSUES", date, `Page ${pageIndex + 1}`, "# Subdivision Purpose Rate"].includes(joined(line.words)) || /^Revised \d{1,2}\/\d{1,2}\/20\d{2}$/u.test(joined(line.words))), "complete printed furniture inventory");
		const tokens = (text: string) => clean(text).split(" ").sort().join("\n");
		requireValue(tokens(words.map(word => word.text).join(" ")) === tokens(layout[pageIndex]), "native and layout word inventories agree");
	}
	readFranklinNoticeMetadata(source, { ballotQuestions: questions, documents: [{}, {}, { url: sourceUrl }], retrievalPolicy: "automatic" });
	for (const prior of previous) {
		const current = questions.find(question => question.title === prior.title && question.audience === prior.audience);
		requireValue(current && current.officialText === prior.officialText, "accepted notice changed or disappeared");
	}
	return questions;
}
export function readFranklinNoticeMetadata(source: StateBallotSource, data: Record<string, unknown>) {
	requireValue(data.sourceAsOf === undefined && data.sourceAsOfDate === undefined, "unsupported source clock");
	if (data.ballotQuestions === undefined) return {};
	requireValue(source.stateCode === "OH" && source.format === "franklin-pdf" && data.retrievalPolicy === "automatic" && Array.isArray(data.documents) && data.documents.length === 3 && Array.isArray(data.ballotQuestions) && data.ballotQuestions.length > 0 && data.ballotQuestions.length <= 200, "stored source and inventory");
	const sourceUrl = data.documents[2]?.url;
	requireValue(typeof sourceUrl === "string", "stored publication URL");
	const fields = "audience,choices,explicitlyAdvisory,id,officialText,pages,sourceUrl,textKind,title,voterApplicabilityVerified";
	const ballotQuestions = data.ballotQuestions.map((value: unknown): StateBallotQuestion => {
		requireValue(value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).sort().join(",") === fields, "stored fields");
		const question = value as StateBallotQuestion;
		requireValue(typeof question.audience === "string" && question.audience.length > 0 && question.audience.length <= 250 && typeof question.title === "string" && question.title.length > 0 && question.title.length <= 350 && typeof question.officialText === "string" && question.officialText.length > 0 && question.officialText.length <= 24000 && !containsControlCharacters(question.audience + question.title + question.officialText.replace(/\n/gu, "")) && !question.officialText.includes("\uFFFD"), "stored notice wording");
		requireValue(question.textKind === "notice" && isDeepStrictEqual(question.choices, []) && question.explicitlyAdvisory === false && question.voterApplicabilityVerified === false && question.sourceUrl === sourceUrl && Array.isArray(question.pages) && question.pages.length === 1 && Number.isSafeInteger(question.pages[0]) && question.pages[0]! >= 1 && question.pages[0]! <= 20 && question.id === questionId(source, question), "stored notice kind, citation and identity");
		return question;
	});
	requireValue(new Set(ballotQuestions.map(question => question.id)).size === ballotQuestions.length && new Set(ballotQuestions.map(question => `${question.audience}|${question.title}`)).size === ballotQuestions.length, "duplicate notices");
	return { ballotQuestions };
}
