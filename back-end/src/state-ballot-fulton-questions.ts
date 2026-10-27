import type { StateBallotQuestion } from "./state-ballot-questions.js";
import type { StateBallotSource } from "./state-ballot-sources.js";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { containsControlCharacters } from "./text-validation.js";

const audience = "Fulton County consolidated sample ballot";
const maximumQuestions = 100;
const clean = (value: string) => value.replace(/\s+/gu, " ").trim();
const fields = "audience,choices,explicitlyAdvisory,id,officialText,pages,title,voterApplicabilityVerified";

export function fultonQuestionId(source: StateBallotSource, question: Omit<StateBallotQuestion, "id">) {
	return createHash("sha256").update(JSON.stringify([source.id, source.electionDate, question.audience, question.title, clean(question.officialText), question.pages])).digest("hex").slice(0, 24);
}

function precedingHeading(lines: string[], marker: number) {
	let end = marker - 1;
	while (end >= 0 && !lines[end]!.trim()) end--;
	if (end < 0) throw new Error("A Fulton question has no printed heading.");
	let start = end;
	while (start > 0 && lines[start - 1]!.trim()) start--;
	const heading = lines.slice(start, end + 1);
	if (heading.length > 4 || heading.some(line => line.search(/\S/u) > 40 || /^\s*(?:For |Notice|FULTON COUNTY|CONSOLIDATED|Yes or No)/u.test(line)))
		throw new Error("The Fulton question heading layout requires review.");
	const title = clean(heading.join(" "));
	if (title.length < 5 || title.length > 350 || !/^[\p{L}\d]/u.test(title) || /[?.]$/u.test(title))
		throw new Error("The Fulton question heading requires review.");
	return { start, title };
}

function questionParagraph(lines: string[]) {
	const paragraphs: string[] = [];
	let paragraph: string[] = [];
	for (const line of lines) {
		if (line.trim() && (line.search(/\S/u) < 40 || line.search(/\S/u) > 150))
			throw new Error("The Fulton question text columns require review.");
		if (line.trim()) {
			paragraph.push(line.trim());
		}
		else if (paragraph.length) {
			paragraphs.push(clean(paragraph.join(" ")));
			paragraph = [];
		}
	}
	if (paragraph.length) paragraphs.push(clean(paragraph.join(" ")));
	return paragraphs.join("\n\n");
}

export function parseFultonBallotQuestions(source: StateBallotSource, body: string): StateBallotQuestion[] {
	if (source.stateCode !== "GA" || source.format !== "fulton-pdf" || Buffer.byteLength(body) > 4 * 1024 * 1024 || body.includes("\uFFFD") || containsControlCharacters(body.replace(/[\r\n\f]/gu, "")))
		throw new Error("The Fulton question text or source requires review.");
	const pages = body.split("\f");
	if (!pages.at(-1)?.trim()) pages.pop();
	if (pages.length > 100) throw new Error("The Fulton question page count exceeds its bounds.");
	const questions: StateBallotQuestion[] = [];
	let questionsStarted = false;
	for (const [pageIndex, page] of pages.entries()) {
		const lines = page.split(/\r?\n/u);
		const markers = lines.flatMap((line, index) => {
			const match = /^Yes or No(?: +(\S.*))?$/u.exec(line.trim());
			if (!match) {
				if (/Yes\s*(?:or|\/)\s*No/iu.test(line)) throw new Error("The Fulton question choices require review.");
				return [];
			}
			return [{ index, first: match[1]?.trim() ?? "", constitutional: /^\d+\. /u.test(match[1] ?? "") }];
		});
		if (!markers.length) {
			if ((questionsStarted && page.trim()) || /\bShall /u.test(page)) throw new Error("A Fulton question continuation requires review.");
			continue;
		}
		questionsStarted = true;
		if (markers.some(marker => marker.constitutional !== markers[0]!.constitutional))
			throw new Error("The Fulton question sections require review.");
		const headings = markers.map(marker => marker.constitutional ? null : precedingHeading(lines, marker.index));
		if (markers[0]!.constitutional && !lines.slice(0, markers[0]!.index).some(line => line.trim() === "Proposed Constitutional Amendments"))
			throw new Error("The Fulton constitutional question heading is missing.");
		for (const [position, marker] of markers.entries()) {
			const next = markers[position + 1];
			const end = next ? headings[position + 1]?.start ?? next.index : lines.length;
			const remainder = questionParagraph(lines.slice(marker.index + 1, end));
			const printed = `${marker.first}${marker.first && remainder ? " " : ""}${remainder}`.trim();
			let title = headings[position]?.title ?? "";
			let officialText = printed;
			if (marker.constitutional) {
				const match = /^([1-9]\d?\. .+?) (House Resolution [1-9]\d{0,5}) Ga\. L\. 20\d{2}, p\. \d+ ([“"]?Shall .+)$/u.exec(clean(printed));
				if (!match || !/Constitution of Georgia/u.test(match[3]!)) throw new Error("The Fulton constitutional question wording requires review.");
				title = `${match[1]} (${match[2]})`;
				officialText = printed.slice(printed.search(/[“"]?Shall /u));
				if (clean(officialText) !== match[3]) throw new Error("The Fulton constitutional question paragraphs require review.");
			}
			else if (!officialText.startsWith("Shall ")) {
				throw new Error("The Fulton question text has no recognized opening.");
			}
			if (title.length > 350 || officialText.length < 20 || officialText.length > 20000 || !/[?.][”"]?$/u.test(officialText))
				throw new Error("The Fulton question is incomplete or exceeds its bounds.");
			const question = { audience, title, officialText, choices: ["Yes", "No"] as [string, string], pages: [pageIndex + 1], explicitlyAdvisory: /\badvisory\b/iu.test(title), voterApplicabilityVerified: false as const };
			questions.push({ id: fultonQuestionId(source, question), ...question });
		}
	}
	if (questions.length > maximumQuestions || new Set(questions.map(question => question.id)).size !== questions.length)
		throw new Error("The Fulton questions are duplicated or exceed their bounds.");
	return questions;
}

export function readFultonSnapshotMetadata(source: StateBallotSource, data: Record<string, unknown>) {
	if (data.sourceAsOfDate !== undefined || data.sourceAsOf !== undefined)
		throw new Error("The Fulton snapshot has unsupported source-clock metadata.");
	if (data.ballotQuestions === undefined) return {};
	if (source.stateCode !== "GA" || source.format !== "fulton-pdf" || data.retrievalPolicy !== "automatic" || !Array.isArray(data.ballotQuestions) || data.ballotQuestions.length > maximumQuestions)
		throw new Error("The stored Fulton question inventory requires review.");
	const ballotQuestions = data.ballotQuestions.map((value: unknown): StateBallotQuestion => {
		if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).sort().join(",") !== fields)
			throw new Error("The stored Fulton question fields require review.");
		const question = value as StateBallotQuestion;
		if (question.audience !== audience || typeof question.title !== "string" || question.title.length < 5 || question.title.length > 350 || typeof question.officialText !== "string" || question.officialText.length < 20 || question.officialText.length > 20000 || containsControlCharacters(question.title + question.officialText.replace(/\n\n/gu, "")) || question.officialText.includes("\uFFFD") || JSON.stringify(question.choices) !== "[\"Yes\",\"No\"]" || question.explicitlyAdvisory !== /\badvisory\b/iu.test(question.title) || question.voterApplicabilityVerified !== false || !Array.isArray(question.pages) || question.pages.length !== 1 || !Number.isInteger(question.pages[0]) || question.pages[0]! < 1 || question.pages[0]! > 100 || question.id !== fultonQuestionId(source, question))
			throw new Error("The stored Fulton question wording, identity or applicability requires review.");
		return question;
	});
	if (new Set(ballotQuestions.map(question => question.id)).size !== ballotQuestions.length)
		throw new Error("The stored Fulton questions are duplicated.");
	return { ballotQuestions };
}
