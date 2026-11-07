import type { StateBallotQuestion } from "./state-ballot-questions.js";
import type { StateBallotSource } from "./state-ballot-sources.js";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { containsControlCharacters } from "./text-validation.js";

export interface JohnsonQuestionHeading { id: string; title: string; text: string }
export interface JohnsonSampleText { url: string; sha256: string; retrievedAt: string; raw: string; layout: string }
const clean = (value: string) => value.normalize("NFKC").replace(/\s+/gu, " ").trim();
function requireValue(value: unknown, detail: string): asserts value {
	if (!value) throw new Error(`The Johnson County ballot question requires review: ${detail}.`);
}
export function johnsonSampleStyle(url: string, electionDate: string) {
	requireValue(/^20\d{2}-11-0[2-8]$/u.test(electionDate) && Number(electionDate.slice(0, 4)) % 2 === 0 && new Date(electionDate).getUTCDay() === 2, "regular election date");
	const parsed = new URL(url);
	const match = new RegExp(`^/sites/default/files/Elections/${electionDate.slice(0, 7)}SampleBallotStyle(\\d{1,3})\\.pdf$`, "u").exec(parsed.pathname);
	requireValue(parsed.origin === "https://johnsoncountyiowa.gov" && !parsed.username && !parsed.password && !parsed.port && parsed.href === url && !parsed.search && !parsed.hash && match && Number(match[1]) >= 1 && Number(match[1]) <= 500, "offered sample URL and election");
	return Number(match[1]);
}
export function johnsonQuestionAudience(title: string, officialText: string) {
	const body = clean(officialText);
	if (title.includes("Iowa Constitutional Amendment") && body.startsWith("Shall the following amendment to the Constitution be adopted?")) return "Iowa";
	const county = /Shall the County of (Johnson), State of Iowa,/u.exec(body);
	if (county) return `${county[1]} County`;
	const city = /Shall the City of ([\p{L} '-]+), in Johnson County, State of Iowa,/u.exec(body);
	if (city) return city[1]!;
	const school = /Shall the Board of Directors of the ([\p{L} '-]+(?:Community|Independent) School District) in the Counties of /u.exec(body);
	if (school) return school[1]!;
	const college = /Shall ([\p{L} '-]+Community College) \((Merged Area [A-Z]+)\) in the Counties of /u.exec(body);
	if (college) return `${college[1]} (${college[2]})`;
	throw new Error("The Johnson County question's printed jurisdiction requires review.");
}
function questionId(source: Pick<StateBallotSource, "id" | "electionDate">, question: Omit<StateBallotQuestion, "id">) {
	return createHash("sha256").update(JSON.stringify([source.id, source.electionDate, question.audience, question.title, question.officialText, question.choices, question.pages, question.sourceUrl])).digest("hex").slice(0, 24);
}
export function readJohnsonSampleQuestions(source: StateBallotSource, document: JohnsonSampleText, headings: readonly JohnsonQuestionHeading[]) {
	const style = johnsonSampleStyle(document.url, source.electionDate);
	requireValue([document.raw, document.layout].every(body => typeof body === "string" && Buffer.byteLength(body) <= 1024 * 1024 && !body.includes("\uFFFD") && !containsControlCharacters(body.replace(/[\r\n\t\f]/gu, ""))), "native text bounds");
	const pages = document.raw.split("\f").filter(page => page.trim());
	const layoutPages = document.layout.split("\f").filter(page => page.trim());
	requireValue(pages.length === 2 && layoutPages.length === pages.length, "complete reviewed page inventory");
	const header = `Official Ballot ${source.electionDate.slice(0, 4)} General Election November ${Number(source.electionDate.slice(-2))}, ${source.electionDate.slice(0, 4)} County of Johnson, State of Iowa`;
	requireValue(clean(pages[0]!).includes(header) && pages[0]!.split(/\r?\n/u).map(clean).includes(`Ballot Style ${style}`), "printed election and complete style label");
	const words = (body: string) => clean(body).split(" ").sort().join("\n");
	requireValue(pages.every((page, index) => words(page) === words(layoutPages[index]!)), "independent raw/layout text inventory");
	const result: StateBallotQuestion[] = [];
	for (const [pageIndex, page] of pages.entries()) {
		const lines = page.split(/\r?\n/u).map(clean).filter(Boolean);
		let cursor = lines.indexOf("Public Measures");
		if (cursor < 0) continue;
		while (cursor < lines.length) {
			if (lines[cursor] === "Public Measures") {
				cursor++;
				continue;
			}
			const code = lines[cursor++]!;
			const heading = headings.find(item => item.id === code);
			requireValue(/^[A-Z\d]{1,3}$/u.test(code) && heading, "printed code in the complete county issue list");
			const start = cursor;
			while (cursor < lines.length && lines[cursor] !== "YES") cursor++;
			requireValue(cursor > start && lines[cursor + 1] === "NO", "complete literal YES/NO choices");
			const content = lines.slice(start, cursor);
			requireValue(!content.includes("Public Measures") && !content.includes("NO"), "unassigned question-region content");
			const wording = content.join(" ");
			requireValue(wording.startsWith("Shall the following ") && wording.length >= 40 && wording.length <= 24000, "complete printed wording");
			cursor += 2;
			const officialText = wording.replace(/(?=Summary:|Full Text:)/gu, "\n\n").trim();
			const question = { audience: johnsonQuestionAudience(heading.title, officialText), title: heading.title, officialText, choices: ["YES", "NO"] as [string, string], pages: [pageIndex + 1], sourceUrl: document.url, explicitlyAdvisory: /\badvisory\b/iu.test(heading.title), voterApplicabilityVerified: false as const };
			result.push({ id: questionId(source, question), ...question });
		}
	}
	requireValue(result.length > 0 || headings.length === 0, "missing advertised public measures");
	requireValue(new Set(result.map(question => question.title)).size === result.length, "duplicate printed question code");
	return result;
}
export function buildJohnsonBallotQuestions(source: StateBallotSource, documents: readonly JohnsonSampleText[], headings: readonly JohnsonQuestionHeading[], previous: readonly StateBallotQuestion[] = []) {
	const questions: StateBallotQuestion[] = [];
	for (const document of documents) {
		for (const question of readJohnsonSampleQuestions(source, document, headings)) {
			const existing = questions.find(item => item.title === question.title);
			if (existing) requireValue(existing.audience === question.audience && existing.officialText === question.officialText && isDeepStrictEqual(existing.choices, question.choices), "conflicting repeated question");
			else questions.push(question);
		}
	}
	requireValue(questions.length === headings.length && questions.length <= 100 && new Set(questions.map(question => question.id)).size === questions.length, "complete distinct advertised issue inventory");
	for (const prior of previous) {
		const current = questions.find(question => question.title === prior.title && question.audience === prior.audience);
		requireValue(current && current.officialText === prior.officialText && isDeepStrictEqual(current.choices, prior.choices), "accepted question changed or disappeared");
	}
	return questions;
}
export function readJohnsonQuestionMetadata(source: StateBallotSource, data: Record<string, unknown>) {
	requireValue(data.sourceAsOf === undefined && data.sourceAsOfDate === undefined, "unsupported source clock");
	if (data.ballotQuestions === undefined) return {};
	requireValue(source.stateCode === "IA" && source.format === "iowa-johnson-html" && data.retrievalPolicy === "automatic" && Array.isArray(data.ballotQuestions) && data.ballotQuestions.length <= 100 && Array.isArray(data.documents), "stored inventory");
	const urls = data.documents.slice(1).map(document => document?.url);
	const fields = "audience,choices,explicitlyAdvisory,id,officialText,pages,sourceUrl,title,voterApplicabilityVerified";
	const ballotQuestions = data.ballotQuestions.map((value: unknown): StateBallotQuestion => {
		requireValue(value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).sort().join(",") === fields, "stored question fields");
		const question = value as StateBallotQuestion;
		requireValue(typeof question.title === "string" && /^Public Measure [A-Z\d]{1,3}: .{1,320}$/u.test(question.title) && typeof question.officialText === "string" && question.officialText.length >= 40 && question.officialText.length <= 24000 && !question.officialText.includes("\uFFFD") && !containsControlCharacters((question.title + question.officialText).replace(/\n/gu, "")) && question.audience === johnsonQuestionAudience(question.title, question.officialText), "stored printed wording and jurisdiction");
		requireValue(isDeepStrictEqual(question.choices, ["YES", "NO"]) && question.explicitlyAdvisory === /\badvisory\b/iu.test(question.title) && question.voterApplicabilityVerified === false && isDeepStrictEqual(question.pages, [2]) && typeof question.sourceUrl === "string" && urls.includes(question.sourceUrl) && question.id === questionId(source, question), "stored choices, source, page and identity");
		johnsonSampleStyle(question.sourceUrl, source.electionDate);
		return question;
	});
	requireValue(new Set(ballotQuestions.map(question => question.title)).size === ballotQuestions.length && new Set(ballotQuestions.map(question => question.id)).size === ballotQuestions.length, "duplicate stored question");
	return { ballotQuestions };
}
