import type { StateBallotQuestion } from "./state-ballot-questions.js";
import type { StateBallotSource } from "./state-ballot-sources.js";
import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { containsControlCharacters } from "./text-validation.js";

export interface CassiaQuestionEvidence {
	title: string;
	audience: string;
	officialText: string;
	choices: string[];
	sourceDocumentIndex: number;
	pageNumber: number;
}
function requireValue(value: unknown, detail: string): asserts value {
	if (!value) throw new Error(`The Cassia ballot question requires review: ${detail}.`);
}
function questionId(source: StateBallotSource, question: Omit<StateBallotQuestion, "id">) {
	return createHash("sha256").update(JSON.stringify([source.id, source.electionDate, question.audience, question.title, question.officialText, question.choices, question.pages, question.sourceUrl])).digest("hex").slice(0, 24);
}
export function readCassiaQuestionMetadata(source: StateBallotSource, data: Record<string, unknown>) {
	requireValue(data.sourceAsOf === undefined && data.sourceAsOfDate === undefined, "unsupported source clock");
	if (data.ballotQuestions === undefined) return {};
	requireValue(source.stateCode === "ID" && source.format === "cassia-pdf" && data.retrievalPolicy === "automatic" && Array.isArray(data.ballotQuestions) && data.ballotQuestions.length <= 100 && Array.isArray(data.documents), "stored inventory");
	const urls = data.documents.map(document => document?.url);
	const fields = "audience,choices,explicitlyAdvisory,id,officialText,pages,sourceUrl,title,voterApplicabilityVerified";
	const ballotQuestions = data.ballotQuestions.map((value: unknown): StateBallotQuestion => {
		requireValue(value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).sort().join(",") === fields, "stored fields");
		const question = value as StateBallotQuestion;
		requireValue(typeof question.title === "string" && question.title.length <= 350 && typeof question.audience === "string" && (question.audience === "Idaho" || /^[A-Z][A-Z .0-9&'’-]+(?:SCHOOL DISTRICT NO\. [1-9]\d{0,3}|RURAL FIRE PROTECTION DISTRICT)$/u.test(question.audience)) && typeof question.officialText === "string" && question.officialText.length >= 20 && question.officialText.length <= 24000 && !containsControlCharacters(question.title + question.audience + question.officialText.replace(/\n/gu, "")) && !question.officialText.includes("\uFFFD"), "stored wording and audience");
		requireValue(Array.isArray(question.choices) && question.choices.length >= 2 && question.choices.length <= 20 && question.choices.every(choice => typeof choice === "string" && choice.length > 0 && choice.length <= 1000 && choice.trim() === choice && !containsControlCharacters(choice)) && new Set(question.choices).size === question.choices.length, "stored choices");
		const advisory = question.title === "Idaho advisory question";
		requireValue(question.audience === "Idaho" ? /^(?:House Joint Resolution [1-9]\d{0,2}|Proposition [1-9]\d{0,2}|Idaho advisory question)$/u.test(question.title) : question.title === `${question.audience} ${question.audience.includes("SCHOOL DISTRICT") ? "supplemental levy" : "temporary override levy"}`, "printed title");
		requireValue(question.explicitlyAdvisory === advisory && question.voterApplicabilityVerified === false && (advisory || question.choices.length === 2) && (question.audience !== "Idaho" || advisory || isDeepStrictEqual(question.choices, ["Yes", "No"])), "stored voting instruction");
		requireValue(question.audience === "Idaho" ? question.sourceUrl === urls[0] : urls.slice(1).includes(question.sourceUrl) && question.choices[0]?.startsWith("IN FAVOR OF ") && question.choices[1]?.startsWith("AGAINST "), "question publication and choice labels");
		requireValue(typeof question.sourceUrl === "string" && urls.includes(question.sourceUrl) && Array.isArray(question.pages) && question.pages.length === 1 && Number.isSafeInteger(question.pages[0]) && question.pages[0]! >= 1 && question.pages[0]! <= 40 && question.id === questionId(source, question), "stored identity and document");
		return question;
	});
	requireValue(new Set(ballotQuestions.map(question => `${question.audience}|${question.title}`)).size === ballotQuestions.length && new Set(ballotQuestions.map(question => question.id)).size === ballotQuestions.length, "duplicate questions");
	return { ballotQuestions };
}
export function buildCassiaBallotQuestions(source: StateBallotSource, evidence: CassiaQuestionEvidence[], documents: { url: string }[], previous: StateBallotQuestion[] = []) {
	const ballotQuestions: StateBallotQuestion[] = [];
	for (const item of evidence) {
		const original = ballotQuestions.find(question => question.audience === item.audience && question.title === item.title);
		if (original) {
			requireValue(original.officialText === item.officialText && isDeepStrictEqual(original.choices, item.choices), "contradictory repeated wording");
			continue;
		}
		const sourceUrl = documents[item.sourceDocumentIndex]?.url;
		requireValue(sourceUrl, "document binding");
		const question = { audience: item.audience, title: item.title, officialText: item.officialText, choices: item.choices as StateBallotQuestion["choices"], pages: [item.pageNumber], sourceUrl, explicitlyAdvisory: item.title === "Idaho advisory question", voterApplicabilityVerified: false as const };
		ballotQuestions.push({ id: questionId(source, question), ...question });
	}
	readCassiaQuestionMetadata(source, { ballotQuestions, documents, retrievalPolicy: "automatic" });
	for (const prior of previous) {
		const current = ballotQuestions.find(question => question.audience === prior.audience && question.title === prior.title);
		requireValue(current && current.officialText === prior.officialText && isDeepStrictEqual(current.choices, prior.choices), "accepted question changed or disappeared");
	}
	return ballotQuestions;
}
