import type { FairbanksCandidateDocument } from "./fairbanks-ballot-candidates.js";
import type { FairbanksPublicationCapture } from "./fairbanks-election-publications.js";
import type { StateBallotQuestion } from "./state-ballot-questions.js";
import type { StateBallotSource } from "./state-ballot-sources.js";
import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { readFairbanksNativePages } from "./fairbanks-ballot-candidates.js";
import { containsControlCharacters } from "./text-validation.js";

type Page = ReturnType<typeof readFairbanksNativePages>[number];
type Line = Page["lines"][number];
const clean = (value: string) => value.normalize("NFKC").replace(/\s+/gu, " ").trim();
const marker = /^PROPOSITION ([1-9]\d?|[A-Z])$/u;
const audiences = new Map([["FAIRBANKS NORTH STAR BOROUGH", "Fairbanks North Star Borough"], ["CITY OF FAIRBANKS", "City of Fairbanks"], ["CITY OF NORTH POLE", "City of North Pole"]]);
function requireValue(condition: unknown, detail: string): asserts condition {
	if (!condition) throw new Error(`The Fairbanks ballot questions require review: ${detail}.`);
}
export function fairbanksQuestionId(source: Pick<StateBallotSource, "id" | "electionDate">, question: Omit<StateBallotQuestion, "id">) {
	return createHash("sha256").update(JSON.stringify([source.id, source.electionDate, question.audience, question.title, question.officialText, question.pages])).digest("hex").slice(0, 24);
}
function join(lines: Line[]) {
	return clean(lines.map(line => line.text).join(" "));
}
function parsePage(page: Page, flat: string) {
	const markers = page.lines.flatMap((line, index) => marker.test(line.text) ? [{ line, index }] : []);
	requireValue(markers.length <= 20, "page question bound");
	for (const [index, line] of page.lines.entries()) {
		if (/^PROPOSITION\b/iu.test(line.text) && audiences.has(page.lines[index - 1]?.text ?? "")) requireValue(marker.test(line.text), "unknown proposition marker");
	}
	if (page.lines.some(line => line.text === "END OF BALLOT") && page.lines.some(line => audiences.has(line.text))) requireValue(page.lines.filter(line => line.text.startsWith("Shall ")).length === markers.length, "unassigned operative questions");
	const parsed: Array<{ number: string; audience: string; title: string; officialText: string; page: number }> = [];
	for (const [position, entry] of markers.entries()) {
		const scope = page.lines[entry.index - 1];
		const audience = scope && audiences.get(scope.text);
		requireValue(scope && audience && scope.top < entry.line.top && entry.line.top - scope.bottom < 10, "printed jurisdiction heading");
		requireValue(page.lines.filter(line => audiences.has(line.text) && line.top <= scope.top).every(line => audiences.get(line.text) === audience), "consistent page and question jurisdiction");
		const next = markers[position + 1];
		const endings = page.lines.filter(line => line.text === "END OF BALLOT" && line.top > entry.line.bottom);
		requireValue(endings.length === 1, "complete question page ending");
		const bottom = next ? page.lines[next.index - 1]!.top : endings[0]!.top;
		const lines = page.lines.filter(line => line.top >= entry.line.top && line.bottom < bottom && line !== entry.line).sort((first, second) => first.top - second.top || first.left - second.left);
		const starts = lines.flatMap((line, index) => line.text.startsWith("Shall ") ? [index] : []);
		requireValue(starts.length === 1, "single operative question");
		const start = starts[0]!;
		const preamble = lines.slice(0, start);
		const redline = preamble.findIndex(line => line.text.startsWith("*UNDERLINED"));
		const heading = redline < 0 ? preamble : preamble.slice(0, redline);
		requireValue(heading.length > 0 && heading.length <= 8 && heading.every(line => /^[\p{Lu}\d\p{P}\p{Zs}]+$/u.test(line.text)), "printed proposition title");
		if (redline >= 0) {
			const context = preamble.slice(redline);
			requireValue(audience === "City of North Pole" && context[0]?.text === "*UNDERLINED AND BOLD WORDS ARE ADDITIONS TO THE CHARTER" && context[1]?.text === "*STRIKETHROUGHS ARE DELETIONS FROM THE CHARTER" && /^North Pole City Charter Section [\d.]+ REGULAR CITY ELECTIONS:$/u.test(context[2]?.text ?? "") && context.length >= 4 && context.length <= 20, "marked-up charter context");
		}
		const yes = lines.flatMap((line, index) => /^A [“"]?YES[”"]? VOTE\b/iu.test(line.text) ? [index] : []);
		const no = lines.flatMap((line, index) => /^A [“"]?NO[”"]? VOTE\b/iu.test(line.text) ? [index] : []);
		requireValue(yes.length === 1 && no.length === 1 && yes[0]! > start && no[0]! > yes[0]!, "published yes/no effects");
		const labels = lines.filter(line => line.text === "YES" || line.text === "NO");
		requireValue(labels.length === 2 && labels.filter(line => line.text === "YES").length === 1 && labels.filter(line => line.text === "NO").length === 1, "published yes/no choices");
		const content = lines.filter(line => !labels.includes(line));
		const first = content.indexOf(lines[start]!);
		const affirmative = content.indexOf(lines[yes[0]!]!);
		const negative = content.indexOf(lines[no[0]!]!);
		const paragraphs = [join(content.slice(first, affirmative)), join(content.slice(affirmative, negative)), join(content.slice(negative))];
		requireValue(content.slice(first).every(line => !/SAMPLE BALLOT|END OF BALLOT|PROPOSITION /u.test(line.text)), "unexpected question-region content");
		requireValue(paragraphs.every(paragraph => paragraph.length >= 20 && paragraph.length <= 12000 && clean(flat).includes(paragraph)) && /^Shall .+\?/u.test(paragraphs[0]!), "complete native and layout wording agreement");
		const title = `Proposition ${marker.exec(entry.line.text)![1]}: ${join(heading)}`;
		requireValue(title.length <= 350 && clean(flat).includes(join(heading)), "native and layout title agreement");
		parsed.push({ number: marker.exec(entry.line.text)![1]!, audience, title, officialText: paragraphs.join("\n\n"), page: page.page });
	}
	return parsed;
}
export function readFairbanksBallotQuestions(source: Pick<StateBallotSource, "id" | "electionDate">, capture: FairbanksPublicationCapture, documents: FairbanksCandidateDocument[]): StateBallotQuestion[] {
	requireValue(documents.length === 2, "complete paired publications");
	const inventories = documents.map((document, index) => {
		const original = capture.documents[index]!;
		requireValue(document.kind === original.kind && document.sourceSha256 === original.sha256, "original publication binding");
		const pages = readFairbanksNativePages(document.bbox);
		const flat = original.text.split("\f").filter(value => value.trim());
		requireValue(pages.length === flat.length, "native/layout page inventory");
		const inventory = pages.flatMap(page => parsePage(page, flat[page.page - 1]!));
		if (document.kind === "sample") requireValue(pages.every(page => page.lines.some(line => line.text === "OFFICIAL BALLOT") || inventory.some(question => question.page === page.page)), "unclassified primary sample page");
		const printedMarkers = flat.flatMap(page => page.split(/\r?\n/u).map(clean).filter(line => marker.test(line)));
		requireValue(inventory.length === printedMarkers.length && inventory.length <= 40 && new Set(inventory.map(question => `${question.audience}|${question.number}`)).size === inventory.length, "complete distinct proposition inventory");
		return inventory;
	});
	const sample = inventories[0]!;
	const notice = inventories[1]!;
	requireValue(sample.every(question => question.audience === "Fairbanks North Star Borough"), "borough-only primary sample");
	const borough = notice.filter(question => question.audience === "Fairbanks North Star Borough");
	requireValue(sample.length === borough.length && sample.every(question => borough.some(other => question.number === other.number && question.title === other.title && question.officialText === other.officialText)), "paired borough question agreement");
	return notice.map((item) => {
		const question = { audience: item.audience, title: item.title, officialText: item.officialText, choices: ["Yes", "No"] as [string, string], pages: [item.page], explicitlyAdvisory: /\badvisory\b/iu.test(item.title), voterApplicabilityVerified: false as const };
		return { id: fairbanksQuestionId(source, question), ...question };
	});
}
export function readFairbanksQuestionMetadata(source: StateBallotSource, data: Record<string, unknown>) {
	if (data.sourceAsOf !== undefined || data.sourceAsOfDate !== undefined) throw new Error("Fairbanks source-clock metadata requires review.");
	if (data.ballotQuestions === undefined) return {};
	requireValue(source.stateCode === "AK" && source.format === "fairbanks-pdf" && data.retrievalPolicy === "automatic" && Array.isArray(data.ballotQuestions) && data.ballotQuestions.length <= 40, "stored source and inventory");
	const fields = "audience,choices,explicitlyAdvisory,id,officialText,pages,title,voterApplicabilityVerified";
	const ballotQuestions = data.ballotQuestions.map((value: unknown): StateBallotQuestion => {
		requireValue(value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).sort().join(",") === fields, "stored question fields");
		const question = value as StateBallotQuestion;
		requireValue([...audiences.values()].includes(question.audience) && typeof question.title === "string" && /^Proposition (?:[1-9]\d?|[A-Z]): .+/u.test(question.title) && question.title.length <= 350 && typeof question.officialText === "string" && question.officialText.length <= 20000 && question.officialText.split("\n\n").length === 3 && question.officialText.startsWith("Shall ") && !containsControlCharacters(question.title + question.officialText.replace(/\n\n/gu, "")) && !question.officialText.includes("\uFFFD") && isDeepStrictEqual(question.choices, ["Yes", "No"]) && question.voterApplicabilityVerified === false && question.explicitlyAdvisory === /\badvisory\b/iu.test(question.title) && Array.isArray(question.pages) && question.pages.length === 1 && Number.isSafeInteger(question.pages[0]) && question.pages[0]! >= 1 && question.pages[0]! <= 20 && question.id === fairbanksQuestionId(source, question), "stored wording, identity and applicability");
		return question;
	});
	requireValue(new Set(ballotQuestions.map(question => question.id)).size === ballotQuestions.length && new Set(ballotQuestions.map(question => `${question.audience}|${/^Proposition ([^:]+):/u.exec(question.title)?.[1]}`)).size === ballotQuestions.length, "stored duplicate propositions");
	return { ballotQuestions };
}
