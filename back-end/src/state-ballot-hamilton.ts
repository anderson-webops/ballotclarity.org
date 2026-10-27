import type { StateHtmlNode } from "./state-ballot-html.js";
import type { StateBallotQuestion } from "./state-ballot-questions.js";
import type { StateCandidateRecord, StateContestScope } from "./state-ballot-records.js";
import type { StateBallotSource } from "./state-ballot-sources.js";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { stateHtmlAttribute as attribute, stateHtmlDescendants as descendants, parseStateHtml, stateHtmlText } from "./state-ballot-html.js";

const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const text = (node: StateHtmlNode) => stateHtmlText(node).normalize("NFKC").replace(/\s+/gu, " ").trim();
const classes = (node: StateHtmlNode) => attribute(node, "class").split(/\s+/u).filter(Boolean);
const has = (node: StateHtmlNode, name: string) => classes(node).includes(name);
const children = (node: StateHtmlNode) => (node.childNodes ?? []).filter(child => child.nodeName !== "#comment" && !(child.nodeName === "#text" && !child.value?.trim()));
export const hamiltonStyleSha256 = "45bd5f78307465cdd28d56ac7009688aaa1d786551957f6fff8e4d11cdc0bd62";
export const hamiltonChoicePairs = [["Yes", "No"], ["For the amendment", "Against the amendment"], ["For", "Against"]] as const;
interface Contest {
	title: string;
	voteLimit: number;
	scope?: StateContestScope;
	district: string;
	jurisdiction?: string;
	question: boolean;
	paragraphs: string[];
	summary: string[];
	collecting: boolean;
	summaryLabelSeen: boolean;
	questionLabelSeen: boolean;
	pages: number[];
}
export interface HamiltonClaim {
	recordId: string;
	name: string;
	office: string;
	district: string;
	jurisdiction?: string;
	partyLabel?: string;
	page: number;
	voteLimit: number;
}
function reject(reason: string): never {
	throw new Error(`The Hamilton County ${reason} requires review.`);
}
function telemetry(node: StateHtmlNode) {
	const src = attribute(node, "src");
	if (!/^https:\/\/static\.cloudflareinsights\.com\/beacon\.min\.js\/v[a-f0-9]{32,64}$/u.test(src) || attribute(node, "type") !== "module" || attribute(node, "crossorigin") !== "anonymous" || !/^sha512-[A-Za-z0-9+/]{86}==$/u.test(attribute(node, "integrity")) || (node.childNodes ?? []).some(child => child.value?.trim()) || (node.attrs ?? []).map(item => item.name).sort().join(",") !== "crossorigin,data-cf-beacon,integrity,src,type")
		return reject("embedded script");
	const beacon = attribute(node, "data-cf-beacon");
	if (beacon.length > 1000)
		return reject("telemetry metadata");
	const value: unknown = JSON.parse(beacon);
	if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).sort().join(",") !== "r,spa,token,version" || typeof (value as Record<string, unknown>).token !== "string" || !/^[a-f0-9]{32}$/u.test(String((value as Record<string, unknown>).token)))
		return reject("telemetry metadata");
}
function bounded(body: string) {
	if (Buffer.byteLength(body) > 2 * 1024 * 1024 || body.includes("\uFFFD"))
		return reject("ballot size or encoding");
	const dom = parseStateHtml(body);
	const pending = [{ node: dom, depth: 0 }];
	let count = 0;
	while (pending.length) {
		const item = pending.pop()!;
		if (++count > 80000 || item.depth > 64)
			return reject("ballot structure");
		for (const node of item.node.childNodes ?? [])
			pending.push({ node, depth: item.depth + 1 });
	}
	return dom;
}
export function hamiltonGeneralDate(day: string, year: string) {
	const date = `${year}-11-${day.padStart(2, "0")}`;
	if (!/^20\d{2}-11-0[2-8]$/u.test(date) || date < "2026-11-03" || Number(year) % 2 || new Date(`${date}T00:00:00Z`).getUTCDay() !== 2)
		return reject("general-election date");
	return date;
}
export function readHamiltonPublicationDate(body: string) {
	const dom = bounded(body);
	const titles = descendants(dom, node => node.nodeName === "title");
	const headers = descendants(dom, node => attribute(node, "class") === "p1-title-col center");
	const accessible = descendants(dom, node => attribute(node, "class") === "sr-only");
	const title = titles.length === 1 ? /^Official Sample Ballot - State & Federal General Election - November ([2-8]), (20\d{2})$/u.exec(text(titles[0]!)) : null;
	if (!title || headers.length !== 1 || accessible.length !== 1)
		return reject("publication identity");
	const date = hamiltonGeneralDate(title[1]!, title[2]!);
	if (text(headers[0]!) !== `OFFICIAL BALLOT State of Tennessee, Hamilton County State and Federal General Election November ${Number(date.slice(8))}, ${date.slice(0, 4)}` || text(accessible[0]!) !== `Official Sample Ballot – State & Federal General Election – November ${Number(date.slice(8))}, ${date.slice(0, 4)}`)
		return reject("publication date agreement");
	return date;
}
function office(title: string, jurisdiction: string | undefined) {
	if (title === "Governor" || title === "United States Senate")
		return { scope: "statewide" as const, district: "" };
	const match = /^(United States House of Representatives|Tennessee Senate|Tennessee House of Representatives), District ([1-9]\d?)$/u.exec(title);
	if (match)
		return { scope: (match[1]!.startsWith("United") ? "congressional" : match[1] === "Tennessee Senate" ? "state-senate" : "state-house") as StateContestScope, district: match[2]! };
	if (jurisdiction && ["Commissioner", "Mayor", "City Council", "City Court Clerk", "Town Council", "Alderman"].includes(title))
		return { scope: "local" as const, district: "", jurisdiction };
	return reject("office label");
}
export function hamiltonQuestionId(source: StateBallotSource, question: Pick<StateBallotQuestion, "audience" | "title" | "officialText" | "choices">) {
	return hash(JSON.stringify([source.id, source.electionDate, question.audience, question.title, question.officialText, question.choices])).slice(0, 24);
}
export function readHamiltonBallotFields(source: StateBallotSource, pages: readonly StateHtmlNode[]) {
	if (source.stateCode !== "TN" || hamiltonGeneralDate(source.electionDate.slice(8), source.electionDate.slice(0, 4)) !== source.electionDate || !pages.length || pages.length > 20)
		return reject("source election");
	const records: StateCandidateRecord[] = [];
	const claims: HamiltonClaim[] = [];
	const ballotQuestions: StateBallotQuestion[] = [];
	const summaryEvidence: {
		questionId: string;
		characters: number;
		sha256: string;
	}[] = [];
	let jurisdiction: string | undefined, contest: Contest | undefined;
	const numbers = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"];
	let candidateRows = 0;
	let measureRows = 0;
	let writeInRows = 0;
	let headers = 0;
	for (const [pageIndex, page] of pages.entries()) {
		if (attribute(page, "id") !== `page-${pageIndex + 1}` || attribute(page, "aria-label") !== `Ballot Page ${pageIndex + 1} of ${pages.length}` || attribute(page, "class") !== "ballot-page")
			return reject("page sequence");
		const columns = descendants(page, node => attribute(node, "class") === "ballot-column");
		if (columns.length !== 3)
			return reject("ballot columns");
		let footers = 0;
		for (const [columnIndex, column] of columns.entries()) {
			for (const node of children(column)) {
				if (has(node, "column-footer")) {
					if (contest || columnIndex !== 2 || footers++ || text(node) !== `SAMPLE PAGE ${pageIndex + 1} OF ${pages.length} ${pageIndex + 1 === pages.length ? "END OF BALLOT" : "BALLOT CONTINUES"}`)
						return reject("page footer");
					continue;
				}
				if (has(node, "municipality-box")) {
					const match = /^(City|Town) of ([\p{L} .'-]+) Municipal$/u.exec(text(node));
					const next = match ? `${match[1]} of ${match[2]}` : "";
					if (!next || (contest && contest.jurisdiction !== next) || (has(node, "print-only") && jurisdiction !== next))
						return reject("municipal context");
					jurisdiction = next;
					continue;
				}
				if (has(node, "contest-header")) {
					if (contest || children(node).length !== 2)
						return reject("unfinished contest");
					const titles = descendants(node, child => attribute(child, "class") === "contest-title");
					const votes = descendants(node, child => attribute(child, "class") === "vote-for");
					const vote = votes.length === 1 ? /^Vote for (One|Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten) \(([1-9]|10)\)$/u.exec(text(votes[0]!)) : null;
					if (titles.length !== 1 || !vote || numbers[Number(vote[2])] !== vote[1])
						return reject("contest instructions");
					const title = text(titles[0]!);
					const question = /^(?:Constitutional Amendment #[1-9]\d?|Charter Amendment [1-9]\d?|Charter Referendum|General Obligation Bond Referendum)$/u.test(title);
					if (question && (!title.startsWith("Constitutional") && !jurisdiction))
						return reject("question jurisdiction");
					const context = question ? { district: "", ...(title.startsWith("Constitutional") ? {} : { jurisdiction }) } : office(title, jurisdiction);
					if ("scope" in context && context.scope !== "local")
						jurisdiction = undefined;
					contest = { title, voteLimit: Number(vote[2]), question, paragraphs: [], summary: [], collecting: !title.startsWith("Constitutional"), summaryLabelSeen: false, questionLabelSeen: false, pages: [pageIndex + 1], ...context };
					headers++;
					continue;
				}
				if (has(node, "amendment-block")) {
					if (!contest?.question)
						return reject("question text context");
					const paragraphs = children(node);
					if (!paragraphs.length)
						return reject("empty question block");
					for (const [index, paragraph] of paragraphs.entries()) {
						if (!classes(paragraph).some(name => ["amendment-p", "amendment-indent", "amendment-section-label"].includes(name)) || !text(paragraph))
							return reject("question paragraph");
						if (has(paragraph, "amendment-section-label")) {
							if (!contest.title.startsWith("Constitutional") || (text(paragraph) !== "Summary:" && text(paragraph) !== "Question:"))
								return reject("question section label");
							if (text(paragraph) === "Summary:") {
								if (contest.summaryLabelSeen || contest.questionLabelSeen)
									return reject("summary sequence");
								contest.summaryLabelSeen = true;
							}
							else {
								if (!contest.summaryLabelSeen || !contest.summary.length || contest.questionLabelSeen)
									return reject("question sequence");
								contest.questionLabelSeen = true;
								contest.collecting = true;
							}
							continue;
						}
						const destination = contest.collecting ? contest.paragraphs : contest.summary;
						if (has(node, "split-continuation") && index === 0) {
							if (!destination.length)
								return reject("orphan question continuation");
							destination[destination.length - 1] += ` ${text(paragraph)}`;
						}
						else {
							destination.push(text(paragraph));
						}
					}
					if (!contest.pages.includes(pageIndex + 1))
						contest.pages.push(pageIndex + 1);
					continue;
				}
				if (!has(node, "choices-list") || attribute(node, "role") !== "list" || !contest)
					return reject("unexpected ballot region");
				const rows = children(node);
				if (!rows.length || rows.some(row => attribute(row, "role") !== "listitem" || descendants(row, child => attribute(child, "class") === "voting-oval").length !== 1))
					return reject("ballot choice structure");
				if (contest.question) {
					const choices = rows.map((row) => {
						const labels = descendants(row, child => attribute(child, "class") === "measure-choice-text");
						if (attribute(row, "class") !== "measure-choice-row" || labels.length !== 1 || text(row) !== text(labels[0]!))
							return reject("question choice");
						return text(labels[0]!);
					});
					if (contest.voteLimit !== 1 || !hamiltonChoicePairs.some(pair => JSON.stringify(pair) === JSON.stringify(choices)))
						return reject("question choice labels");
					const officialText = contest.paragraphs.join("\n\n");
					if (officialText.length < 30 || officialText.length > 5000 || (contest.title.startsWith("Constitutional") && !contest.questionLabelSeen))
						return reject("question wording length");
					const question = { audience: contest.jurisdiction ?? "Tennessee", title: contest.title, officialText, choices: choices as [
						string,
						string
					], pages: contest.pages, explicitlyAdvisory: false, voterApplicabilityVerified: false as const };
					const id = hamiltonQuestionId(source, question);
					if (ballotQuestions.some(item => item.id === id))
						return reject("duplicate question");
					ballotQuestions.push({ id, ...question });
					if (contest.summary.length) {
						const summary = contest.summary.join("\n\n");
						summaryEvidence.push({ questionId: id, characters: summary.length, sha256: hash(summary) });
					}
					measureRows += rows.length;
				}
				else {
					if (contest.paragraphs.length || !contest.scope)
						return reject("candidate contest context");
					let names = 0;
					let blanks = 0;
					for (const row of rows) {
						if (has(row, "write-in-row")) {
							if (text(row) !== "Write-in" || descendants(row, child => attribute(child, "class") === "write-in-label").length !== 1)
								return reject("blank write-in line");
							blanks++;
							continue;
						}
						if (!has(row, "candidate-row") || blanks)
							return reject("candidate row order");
						const nameNodes = descendants(row, child => has(child, "candidate-name"));
						const partyNodes = descendants(row, child => attribute(child, "class") === "party-name");
						const name = nameNodes.length === 1 ? text(nameNodes[0]!) : "";
						const partyLabel = partyNodes.length === 1 ? text(partyNodes[0]!) : undefined;
						if (!name || name.length > 200 || !/^[\p{L}\p{M} .,'’"()-]+$/u.test(name) || !/\p{L}/u.test(name) || descendants(row, child => has(child, "candidate-info")).length !== (partyLabel ? 1 : 0) || partyNodes.length > 1 || text(row) !== [name, partyLabel].filter(Boolean).join(" "))
							return reject("candidate name or party columns");
						const party = partyLabel === "Republican Party Nominee" ? "Republican" : partyLabel === "Democratic Party Nominee" ? "Democratic" : partyLabel === "Independent Candidate" ? "Independent" : undefined;
						if ((partyLabel && !party) || (contest.scope !== "local" && !party) || (contest.scope === "local" && partyLabel))
							return reject("source party label");
						const id = hash(JSON.stringify([source.id, source.electionDate, contest.title, contest.district, contest.jurisdiction ?? "", name, party ?? ""])).slice(0, 24);
						if (records.some(record => record.id === id))
							return reject("duplicate candidate");
						records.push({ id, name, office: contest.title, scope: contest.scope, district: contest.district, status: "listed", ...(party ? { party } : {}), ...(contest.jurisdiction ? { jurisdiction: contest.jurisdiction } : {}), voteLimit: contest.voteLimit });
						claims.push({ recordId: id, name, office: contest.title, district: contest.district, ...(contest.jurisdiction ? { jurisdiction: contest.jurisdiction } : {}), ...(partyLabel ? { partyLabel } : {}), page: pageIndex + 1, voteLimit: contest.voteLimit });
						names++;
					}
					if (!names || blanks !== contest.voteLimit)
						return reject("candidate and write-in inventory");
					candidateRows += names;
					writeInRows += blanks;
				}
				contest = undefined;
			}
		}
		if (footers !== 1)
			return reject("complete page footer");
	}
	if (contest || !records.length || records.length > 1000 || ballotQuestions.length > 100 || headers !== ballotQuestions.length + new Set(records.map(record => JSON.stringify([record.office, record.district, record.jurisdiction]))).size || pages.reduce((sum, page) => sum + descendants(page, node => has(node, "candidate-row")).length, 0) !== candidateRows || pages.reduce((sum, page) => sum + descendants(page, node => has(node, "measure-choice-row")).length, 0) !== measureRows || pages.reduce((sum, page) => sum + descendants(page, node => has(node, "write-in-row")).length, 0) !== writeInRows)
		return reject("complete contest inventory");
	return { records, ballotQuestions, claims, summaryEvidence, candidateRows, measureRows, writeInRows };
}
export function readHamiltonBallotDocument(source: StateBallotSource, body: string) {
	if (readHamiltonPublicationDate(body) !== source.electionDate)
		return reject("configured election date");
	const dom = bounded(body);
	const styles = descendants(dom, node => node.nodeName === "style").map(node => (node.childNodes ?? []).map(node => node.value ?? "").join("").replace(/\/\*[\s\S]*?\*\//gu, "").replace(/\s+/gu, " ").trim());
	if (hash(JSON.stringify(styles)) !== hamiltonStyleSha256 || descendants(dom, node => ["iframe", "embed", "object", "img", "svg", "form", "input", "link"].includes(node.nodeName)).length)
		return reject("publication style or embedded content");
	const scripts = descendants(dom, node => node.nodeName === "script");
	if (scripts.length > 1)
		return reject("script inventory");
	scripts.forEach(telemetry);
	const mains = descendants(dom, node => node.nodeName === "main");
	if (mains.length !== 1 || attribute(mains[0]!, "role") !== "main")
		return reject("publication main region");
	const pages = descendants(mains[0]!, node => has(node, "ballot-page"));
	if (children(mains[0]!).length !== pages.length + 1 || pages.some(page => children(page).length !== 1 || attribute(children(page)[0]!, "class") !== "ballot-frame"))
		return reject("publication page regions");
	for (const [index, page] of pages.entries()) {
		const frame = children(page)[0]!;
		const regions = children(frame);
		if (regions.map(node => attribute(node, "class")).join(",") !== (index ? "columns-container" : "p1-header-title-box,p1-instructions-box,p1-columns-container") || children(regions.at(-1)!).some(node => attribute(node, "class") !== "ballot-column") || children(regions.at(-1)!).length !== 3)
			return reject("complete page frame");
	}
	const knownClasses = new Set(["sr-only", "ballot-page", "ballot-frame", "p1-header-title-box", "p1-title-col left", "p1-title-col center", "p1-title-col right", "p1-instructions-box", "p1-instructions-title", "p1-instructions-text", "p1-commission-text", "p1-columns-container", "ballot-column", "contest-header top-of-col", "contest-title", "vote-for", "choices-list", "candidate-row dense", "candidate-info", "candidate-name", "party-name", "voting-oval", "write-in-row dense", "write-in-label", "amendment-block dense", "amendment-section-label", "amendment-p dense", "amendment-indent dense", "amendment-block dense split-continuation", "measure-choice-row", "measure-choice-text", "contest-header", "column-footer", "columns-container", "candidate-row", "write-in-row", "municipality-box", "candidate-name single-line", "municipality-box top-of-col", "municipality-box top-of-col print-only", "amendment-block", "amendment-p"]);
	const inlineStyles: Record<string, string[]> = { "span": ["display:inline-block; width:16px; height:10px; border:1.5px solid #000; border-radius:50%; vertical-align:middle; background-color:#000;"], "div.amendment-p dense": ["margin-left: 6pt;", "font-weight: bold; margin-top: 4pt; margin-bottom: 2pt;"], "div.amendment-block dense split-continuation": ["padding-top: 2pt;", "padding-top: 3pt;"], "div.contest-header": ["margin-top: 2pt;", "margin-top: 1.5pt;", "margin-top: 4pt;"] };
	const leaves = ["candidate-name", "party-name", "contest-title", "vote-for", "measure-choice-text", "write-in-label"];
	for (const node of descendants(dom, node => node.nodeName !== "#text" && node.nodeName !== "#comment")) {
		const className = attribute(node, "class");
		const style = attribute(node, "style");
		const attributes = node.attrs ?? [];
		if ((className && !knownClasses.has(className)) || attributes.some(item => item.name === "hidden" || item.name.startsWith("on")) || (attribute(node, "aria-hidden") && attribute(node, "aria-hidden") !== "true"))
			return reject("hidden or changed ballot fields");
		if (attribute(node, "aria-hidden") && className !== "voting-oval" && !(node.nodeName === "span" && !className && style === inlineStyles.span![0]))
			return reject("hidden ballot content");
		if (style && !inlineStyles[node.nodeName + (className ? `.${className}` : "")]?.includes(style))
			return reject("inline ballot styling");
		if (classes(node).some(name => leaves.includes(name)) && children(node).some(child => child.nodeName !== "#text" && !(child.nodeName === "br" && !(child.attrs ?? []).length)))
			return reject("nested candidate or choice text");
		if (has(node, "amendment-p") || has(node, "amendment-indent")) {
			for (const child of descendants(node, child => child.nodeName !== "#text")) {
				if (!["strong", "br"].includes(child.nodeName) || (child.attrs ?? []).length)
					return reject("hidden question text");
			}
		}
	}
	return readHamiltonBallotFields(source, pages);
}
