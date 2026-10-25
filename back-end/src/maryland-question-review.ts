import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { mkdir, realpath, writeFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, join } from "node:path";
import { isSupportedMeasureBallotOptions } from "./coverage-repository.js";
import { parseStateHtml, stateHtmlAttribute, stateHtmlDescendants, stateHtmlText } from "./state-ballot-html.js";
import { assertExternalStateDataDirectory, readBoundedStateData, readBoundedStateDataBytes } from "./state-ballot-storage.js";

export interface MarylandQuestionReview {
	electionDate: string;
	areas: { label: string; questionIds: string[] }[];
}

const jurisdictions: Record<string, { type: "state" | "county" | "city"; name: string }> = {
	"SBE": { type: "state", name: "Maryland" },
	"Anne Arundel": { type: "county", name: "Anne Arundel County" },
	"Baltimore County": { type: "county", name: "Baltimore County" },
	"Baltimore City": { type: "city", name: "Baltimore City" },
	"Cecil": { type: "county", name: "Cecil County" },
	"Dorchester": { type: "county", name: "Dorchester County" },
	"Frederick": { type: "county", name: "Frederick County" },
	"Howard": { type: "county", name: "Howard County" },
	"Prince George's": { type: "county", name: "Prince George's County" },
	"Wicomico": { type: "county", name: "Wicomico County" },
};
const hash = (body: string | Uint8Array) => createHash("sha256").update(body).digest("hex");
const clean = (node: Parameters<typeof stateHtmlText>[0]) => stateHtmlText(node).replace(/\s+/gu, " ").trim();
const questionId = (heading: string, language: "en" | "es") => new RegExp(`^${language === "en" ? "Question" : "Pregunta"}\\s+([1-9]\\d{0,2}|[A-Z]{1,2})$`, "iu").exec(heading)?.[1]?.toUpperCase();

export function parseMarylandQuestionPage(body: Uint8Array, review: MarylandQuestionReview) {
	const date = new Date(review?.electionDate);
	if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== review.electionDate || !Array.isArray(review.areas) || !review.areas.length || review.areas.length > 25 || new Set(review.areas.map(area => area.label)).size !== review.areas.length
		|| review.areas.some(area => !area || Object.keys(area).sort().join(",") !== "label,questionIds" || !Object.hasOwn(jurisdictions, area.label) || !Array.isArray(area.questionIds) || !area.questionIds.length || area.questionIds.length > 100 || new Set(area.questionIds).size !== area.questionIds.length || area.questionIds.some(id => !/^(?:[1-9]\d{0,2}|[A-Z]{1,2})$/u.test(id)))) {
		throw new Error("Provide explicit dated Maryland question groups and reviewed jurisdiction labels.");
	}
	if (!body.byteLength || body.byteLength > 2 * 1024 * 1024) throw new Error("Maryland question HTML exceeds its size limit.");
	const document = parseStateHtml(new TextDecoder("utf-8", { fatal: true }).decode(body));
	const pending = [{ node: document, depth: 0 }];
	let visited = 0;
	while (pending.length) {
		const { node, depth } = pending.pop()!;
		if (++visited > 80_000 || depth > 64) throw new Error("Maryland question HTML exceeds its structure limit.");
		for (const child of node.childNodes ?? []) pending.push({ node: child, depth: depth + 1 });
	}
	const mains = stateHtmlDescendants(document, node => stateHtmlAttribute(node, "id") === "bodyMain");
	if (mains.length !== 1) throw new Error("Maryland question content region changed.");
	const main = mains[0]!;
	const title = `Ballot Questions for the ${new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).format(date)} Election`;
	if (!stateHtmlDescendants(main, node => node.nodeName === "h1").some(node => clean(node) === title) || !clean(main).includes("All comment periods have now closed.")) throw new Error("Maryland question election or comment status changed.");
	const groups = main.childNodes?.filter(node => node.nodeName === "details") ?? [];
	if (groups.length !== review.areas.length) throw new Error("Maryland question groups changed.");
	const questions = [];
	const translations = [];
	for (const [index, group] of groups.entries()) {
		const area = review.areas[index]!;
		const summaries = group.childNodes?.filter(node => node.nodeName === "summary") ?? [];
		if (summaries.length !== 1 || clean(summaries[0]!) !== area.label) throw new Error("Maryland question jurisdiction order changed.");
		const chunks: { id: string; paragraphs: string[]; lists: string[][]; translations: { heading: string; text: string }[] }[] = [];
		let current: typeof chunks[number] | undefined;
		for (const node of group.childNodes ?? []) {
			if (["#text", "#comment", "summary", "hr"].includes(node.nodeName)) continue;
			if (node.nodeName === "h2") {
				const id = questionId(clean(node), "en");
				if (!id) throw new Error("Maryland English question heading changed.");
				current = { id, paragraphs: [], lists: [], translations: [] };
				chunks.push(current);
				continue;
			}
			if (!current) continue;
			if (stateHtmlDescendants(node, child => ["script", "style", "template", "form", "input", "iframe"].includes(child.nodeName)).length) throw new Error("Maryland question contains unsupported active content.");
			if (node.nodeName === "p") {
				current.paragraphs.push(clean(node));
			}
			else if (node.nodeName === "ul") {
				current.lists.push((node.childNodes ?? []).filter(child => child.nodeName === "li").map(clean));
			}
			else if (node.nodeName === "div" && stateHtmlAttribute(node, "lang") === "es") {
				const headings = stateHtmlDescendants(node, child => child.nodeName === "h2");
				if (headings.length !== 1 || questionId(clean(headings[0]!), "es") !== current.id) throw new Error("Maryland translation does not match its English question.");
				current.translations.push({ heading: clean(headings[0]!), text: clean(node) });
			}
			else {
				throw new Error("Maryland question content shape changed.");
			}
		}
		if (chunks.map(chunk => chunk.id).join(",") !== area.questionIds.join(",")) throw new Error("Maryland question identities changed or are duplicated.");
		for (const chunk of chunks) {
			const choices = chunk.lists.filter(items => items.length === 2 && /^For\b/iu.test(items[0]!) && /^Against\b/iu.test(items[1]!));
			if (choices.length !== 1 || !chunk.paragraphs.some(text => text.length >= 40) || chunk.translations.length > 1) throw new Error("Maryland question requires one explicit binary choice pair and substantive text.");
			const [yesText, noText] = choices[0]!;
			const separate = (text: string) => text.split(/\s*-\s*(?=A vote)/iu);
			const yes = separate(yesText!);
			const no = separate(noText!);
			const ballotOptions = { yes: yes[0]!.trim(), no: no[0]!.trim() };
			if (!isSupportedMeasureBallotOptions(ballotOptions)) throw new Error("Maryland question has an unsupported binary label pair.");
			const jurisdiction = jurisdictions[area.label]!;
			questions.push({ area: area.label, jurisdictionType: jurisdiction.type, jurisdictionName: jurisdiction.name, questionId: chunk.id, heading: `Question ${chunk.id}`, paragraphs: chunk.paragraphs, ballotOptions, forExplanation: yes.slice(1).join(" - ") || chunk.paragraphs.find(text => /^A vote FOR\b/iu.test(text)) || "", againstExplanation: no.slice(1).join(" - ") || chunk.paragraphs.find(text => /^A vote AGAINST\b/iu.test(text)) || "", meaningInferred: false, personalBallotAssignment: false });
			for (const translation of chunk.translations) translations.push({ area: area.label, jurisdictionType: jurisdiction.type, jurisdictionName: jurisdiction.name, questionId: chunk.id, language: "es", ...translation, updatedTranslationPending: new RegExp(`\\btranslation is forthcoming for Question ${chunk.id}\\b`, "iu").test(clean(group)), semanticReviewApproved: false });
		}
	}
	if (questions.length > 500) throw new Error("Maryland question count exceeds its bound.");
	return { questions, translations };
}

export async function prepareMarylandQuestionReview(planPath: string, now = Date.now()) {
	const plan = JSON.parse(await readBoundedStateData(planPath));
	if (!plan || Object.keys(plan).sort().join(",") !== "capture,electionDate,expectedAreas,outputDirectory,outputName,schemaVersion,type" || plan.schemaVersion !== 1 || plan.type !== "maryland-question-review-preparation" || typeof plan.outputDirectory !== "string" || !isAbsolute(plan.outputDirectory) || !/^[a-z0-9][a-z0-9-]{0,100}$/u.test(plan.outputName)) throw new Error("Provide a bounded Maryland question review plan.");
	const capture = plan.capture;
	if (!capture || Object.keys(capture).sort().join(",") !== "capturedAt,path,sha256,url" || !isAbsolute(capture.path) || !/^[a-f0-9]{64}$/u.test(capture.sha256) || !Number.isFinite(Date.parse(capture.capturedAt)) || Date.parse(capture.capturedAt) > now || capture.url !== `https://elections.maryland.gov/elections/${String(plan.electionDate).slice(0, 4)}/ballot_questions.html`) throw new Error("Maryland capture provenance does not match its current source.");
	const body = await readBoundedStateDataBytes(capture.path);
	if (hash(body) !== capture.sha256) throw new Error("Maryland capture digest differs from its reviewed original.");
	const result = parseMarylandQuestionPage(body, { electionDate: plan.electionDate, areas: plan.expectedAreas });
	assertExternalStateDataDirectory(plan.outputDirectory);
	assertExternalStateDataDirectory(join(await realpath(dirname(plan.outputDirectory)), basename(plan.outputDirectory)));
	const metadata = { schemaVersion: 1, type: "maryland-question-review", stateCode: "MD", electionDate: plan.electionDate, sourceUrl: capture.url, sourceSha256: capture.sha256, capturedAt: capture.capturedAt, publicationDate: null, preparedAt: new Date(now).toISOString(), questions: result.questions.length, translations: result.translations.length, pendingTranslations: result.translations.filter(item => item.updatedTranslationPending).length, publicationApproved: false, automaticImportApproved: false, personalBallotAssignment: false, meaningInferred: false };
	const records = result.questions.map(question => ({ ...metadata, type: "maryland-question-review-record", ...question }));
	const csvCell = (value: string) => `"${(/^\s*[=+@-]|^[\t\r\n]/u.test(value) ? "'" : "") + value.replaceAll("\"", "\"\"")}"`;
	const header = ["state", "election_date", "jurisdiction_type", "jurisdiction", "question", "official_text", "for_label", "against_label", "official_for_explanation", "official_against_explanation", "source_url", "source_sha256", "captured_at", "publication_approved", "personal_ballot_assignment"];
	const rows = records.map(item => ["MD", item.electionDate, item.jurisdictionType, item.jurisdictionName, item.questionId, item.paragraphs.join(" "), item.ballotOptions.yes, item.ballotOptions.no, item.forExplanation, item.againstExplanation, item.sourceUrl, item.sourceSha256, item.capturedAt, "false", "false"]);
	const outputs = [
		{ name: `${plan.outputName}.jsonl`, body: `${[metadata, ...records].map(item => JSON.stringify(item)).join("\n")}\n` },
		{ name: `${plan.outputName}.csv`, body: `${[header, ...rows].map(row => row.map(csvCell).join(",")).join("\n")}\n` },
		{ name: `${plan.outputName}-translations.jsonl`, body: `${result.translations.map(item => JSON.stringify({ ...metadata, type: "maryland-translation-review", ...item })).join("\n")}\n` },
	];
	const manifest = { ...metadata, files: outputs.map(file => ({ name: file.name, bytes: Buffer.byteLength(file.body), sha256: hash(file.body) })), publisherRequests: 0, imported: false };
	outputs.push({ name: `${plan.outputName}-manifest.json`, body: `${JSON.stringify(manifest, null, 2)}\n` });
	outputs.push({ name: `${plan.outputName}-SHA256SUMS`, body: `${outputs.map(file => `${hash(file.body)}  ${file.name}`).join("\n")}\n` });
	if (outputs.some(file => Buffer.byteLength(file.body) > 12 * 1024 * 1024)) throw new Error("Prepared Maryland review output exceeds its size limit.");
	await mkdir(plan.outputDirectory);
	assertExternalStateDataDirectory(await realpath(plan.outputDirectory));
	for (const file of outputs) await writeFile(join(plan.outputDirectory, file.name), file.body, { flag: "wx" });
	return { outputDirectory: plan.outputDirectory, files: outputs.length, questions: result.questions.length, translations: result.translations.length, publisherRequests: 0, imported: false, publicationApproved: false };
}
