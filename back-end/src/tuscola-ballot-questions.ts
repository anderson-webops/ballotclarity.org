import type { StateBallotQuestion } from "./state-ballot-questions.js";
import type { StateBallotSource } from "./state-ballot-sources.js";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { containsControlCharacters } from "./text-validation.js";

const clean = (value: string) => value.normalize("NFKC").replace(/\s+/gu, " ").trim();
const operative = /^(?:Shall\b|Should\b|This proposal\b|The proposal would:)/u;
const stateHeading = /^Proposal (20\d{2})-[1-9]\d?$/u;
const audienceHeading = /^(?:[\p{L}\d &'’().-]+(?:County|Township|School District|Village|City)|(?:City|Village) of [\p{L} &'’.-]+)$/u;
function requireValue(value: unknown, detail: string): asserts value {
	if (!value) throw new Error(`The Tuscola ballot question requires review: ${detail}.`);
}
function questionId(source: StateBallotSource, question: Omit<StateBallotQuestion, "id">) {
	return createHash("sha256").update(JSON.stringify([source.id, source.electionDate, question.audience, question.title, question.officialText, question.choices, question.pages, question.sourceUrl])).digest("hex").slice(0, 24);
}
function audienceAt(lines: string[], index: number) {
	if (["Proposal Section", "State", "County", "Township", "Local School District", "School District", "City", "Village"].includes(lines[index] ?? "")) return undefined;
	for (let length = 1; length <= 3 && index + length <= lines.length; length++) {
		const audience = lines.slice(index, index + length).join(" ");
		if (audienceHeading.test(audience)) return { audience, length };
	}
	return undefined;
}
function firstQuestion(lines: string[], end: number) {
	const state = lines.findIndex(line => stateHeading.test(line));
	if (state >= 0 && state < end) return state;
	const body = lines.findIndex(line => operative.test(line));
	requireValue(body >= 0 && body < end, "first operative wording");
	for (let index = body - 1; index >= Math.max(0, body - 12); index--) {
		const scope = audienceAt(lines, index);
		if (scope && index + scope.length < body && !lines.slice(index, body).some(line => line.startsWith("Vote for "))) return index;
	}
	throw new Error("The Tuscola first question audience requires review.");
}
export function readTuscolaBallotQuestions(source: StateBallotSource, text: string, sourceUrl: string, previous: readonly StateBallotQuestion[] = []) {
	requireValue(source.stateCode === "MI" && source.format === "tuscola-pdf" && Buffer.byteLength(text) <= 8 * 1024 * 1024 && !containsControlCharacters(text.replace(/[\r\n\t\f]/gu, "")), "source and bounded text");
	const pages = text.split("\f").filter(page => page.trim());
	requireValue(pages.length > 0 && pages.length <= 200, "page inventory");
	const questions: StateBallotQuestion[] = [];
	for (const [pageIndex, page] of pages.entries()) {
		const lines = page.split(/\r?\n/u).map(clean).filter(line => line && !["VOTE BOTH FRONT AND BACK OF BALLOT", "S A M", "P L E", "S A M P L E", "SAMPLE"].includes(line));
		const pairs = lines.flatMap((line, index) => line === "Yes" ? [index] : []);
		const negatives = lines.flatMap((line, index) => line === "No" ? [index] : []);
		requireValue(pairs.length === negatives.length && pairs.every((index, position) => negatives[position] === index + 1), "complete literal choice pairs");
		if (!pairs.length) {
			requireValue(!lines.includes("Proposal Section"), "proposal section without choices");
			continue;
		}
		requireValue(lines.includes("Proposal Section") && page.includes("VOTE BOTH FRONT AND BACK OF BALLOT"), "printed proposal section and ending");
		let cursor = firstQuestion(lines, pairs[0]!);
		for (const end of pairs) {
			const section = lines.slice(cursor, end);
			const state = stateHeading.exec(section[0] ?? "");
			const scope = state ? { audience: "Michigan", length: 1 } : audienceAt(section, 0);
			requireValue(scope && (!state || state[1] === source.electionDate.slice(0, 4)), "printed question audience and cycle");
			const body = section.findIndex((line, index) => index >= scope.length && operative.test(line));
			requireValue(body > scope.length && body - scope.length <= 12 && !section.slice(scope.length, body).some(line => stateHeading.test(line) || line.startsWith("Vote for ")), "title and operative wording boundary");
			const heading = section.slice(scope.length, body).join(" ");
			const title = state ? `${section[0]}: ${heading}` : heading;
			const officialText = section.slice(body).join("\n");
			const existing = questions.find(question => question.audience === scope.audience && question.title === title);
			if (existing) {
				requireValue(existing.officialText === officialText, "contradictory repeated wording");
				existing.pages.push(pageIndex + 1);
			}
			else {
				const question = { audience: scope.audience, title, officialText, choices: ["Yes", "No"] as [string, string], pages: [pageIndex + 1], sourceUrl, explicitlyAdvisory: false, voterApplicabilityVerified: false as const };
				questions.push({ id: "", ...question });
			}
			cursor = end + 2;
		}
		requireValue(cursor === lines.length, "unassigned trailing proposal text");
	}
	for (const question of questions) question.id = questionId(source, question);
	readTuscolaQuestionMetadata(source, { ballotQuestions: questions, documents: [{ url: "" }, { url: sourceUrl }], retrievalPolicy: "automatic" });
	for (const prior of previous) {
		const current = questions.find(question => question.audience === prior.audience && question.title === prior.title);
		requireValue(current && current.officialText === prior.officialText && isDeepStrictEqual(current.choices, prior.choices), "accepted question changed or disappeared");
	}
	return questions;
}
export function readTuscolaQuestionMetadata(source: StateBallotSource, data: Record<string, unknown>) {
	requireValue(data.sourceAsOf === undefined && data.sourceAsOfDate === undefined, "unsupported source clock");
	if (data.ballotQuestions === undefined) return {};
	requireValue(source.stateCode === "MI" && source.format === "tuscola-pdf" && data.retrievalPolicy === "automatic" && Array.isArray(data.ballotQuestions) && data.ballotQuestions.length <= 100 && Array.isArray(data.documents) && data.documents.length === 2, "stored source and inventory");
	const sourceUrl = data.documents[1]?.url;
	requireValue(typeof sourceUrl === "string", "stored publication URL");
	const fields = "audience,choices,explicitlyAdvisory,id,officialText,pages,sourceUrl,title,voterApplicabilityVerified";
	const ballotQuestions = data.ballotQuestions.map((value: unknown): StateBallotQuestion => {
		requireValue(value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).sort().join(",") === fields, "stored fields");
		const question = value as StateBallotQuestion;
		requireValue(typeof question.audience === "string" && question.audience.length <= 200 && (question.audience === "Michigan" || audienceHeading.test(question.audience)) && typeof question.title === "string" && question.title.length > 0 && question.title.length <= 350 && typeof question.officialText === "string" && question.officialText.length >= 20 && question.officialText.length <= 24000 && operative.test(question.officialText) && !containsControlCharacters(question.audience + question.title + question.officialText.replace(/\n/gu, "")) && !question.officialText.includes("\uFFFD"), "stored scope and wording");
		requireValue(isDeepStrictEqual(question.choices, ["Yes", "No"]) && question.explicitlyAdvisory === false && question.voterApplicabilityVerified === false && question.sourceUrl === sourceUrl, "stored choices and publication");
		requireValue(Array.isArray(question.pages) && question.pages.length > 0 && question.pages.length <= 200 && question.pages.every((page, index) => Number.isSafeInteger(page) && page >= 1 && page <= 200 && (!index || page > question.pages[index - 1]!)) && question.id === questionId(source, question), "stored pages and identity");
		return question;
	});
	requireValue(new Set(ballotQuestions.map(question => `${question.audience}|${question.title}`)).size === ballotQuestions.length && new Set(ballotQuestions.map(question => question.id)).size === ballotQuestions.length, "duplicate questions");
	return { ballotQuestions };
}
