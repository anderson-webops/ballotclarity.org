import type { StateHtmlNode } from "./state-ballot-html.js";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { electionDocumentRobotsPolicy } from "./election-document-collection.js";
import { fultonPolicyReceipts } from "./state-ballot-fulton.js";
import { parseStateHtml, stateHtmlAttribute, stateHtmlDescendants, stateHtmlText } from "./state-ballot-html.js";

export const fultonCalendarPublication = {
	sourceId: "ga-fulton-election-calendar",
	stateCode: "GA",
	countyFips: "13121",
	indexUrl: "https://fultoncountyga.gov/Inside-Fulton-County/Fulton-County-Departments/Registration-and-Elections",
	calendarUrl: "https://fultoncountyga.gov/Inside-Fulton-County/Fulton-County-Departments/Registration-and-Elections/Election-Key-Dates",
	policies: fultonPolicyReceipts.slice(0, 2),
	minimumRefreshIntervalMs: 6 * 3600000,
	minimumRequestIntervalMs: 11000,
	maximumDocumentBytes: 3 * 1024 * 1024
} as const;

export interface FultonCalendarPage { url: string; body: string; capturedAt: string; sha256: string }
export interface FultonCalendarCapture { schemaVersion: 1; type: "fulton-election-calendar-capture"; documents: FultonCalendarPage[] }
export interface FultonCalendarEntry {
	id: string;
	label: string;
	printedDate: string;
	date: string | null;
	endDate: string | null;
	note?: string;
	issues: string[];
}
export interface FultonCalendarSection {
	title: "General Election" | "General Runoff Election";
	electionDate: string;
	status: "parsed" | "review-required";
	entries: FultonCalendarEntry[];
}
export interface FultonCalendarInventory {
	schemaVersion: 1;
	type: "official-election-calendar-inventory";
	sourceId: string;
	stateCode: "GA";
	countyFips: "13121";
	retrievedAt: string;
	sourceSha256: string;
	sourcePublishedAt: null;
	publicationApproved: false;
	electionOccurrenceConfirmed: false;
	documents: Omit<FultonCalendarPage, "body">[];
	sections: FultonCalendarSection[];
}

const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const datePattern = /^(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday),? (January|February|March|April|May|June|July|August|September|October|November|December) ([1-9]\d?)(?:, (20\d{2}))?$/u;
const labels = new Set([
	"First day to request an Absentee Ballot",
	"Uniformed and Overseas Citizens (UOCAVA) Absentee Ballots Mail Out",
	"Logic and Accuracy Testing of Voting Equipment",
	"First Day to mail Absentee Ballot",
	"Voter Registration Deadline",
	"Voter Registration Deadline for Federal Runoff",
	"Voter Registration Deadline (Federal races)",
	"First day for Early Voting",
	"Last day to request an Absentee Ballot",
	"Last day for Early Voting",
	"Last day to return the Absentee Ballot in the Drop Box",
	"Last day to return an Absentee Ballot in the Drop Box",
	"Last day for an Absentee Ballot submitted by mail",
	"Last day To Return UOCAVA Absentee Ballot",
	"Election Day",
	"Risk Limiting Audit"
]);
const requiredLabels = ["Voter Registration Deadline", "First day for Early Voting", "Last day to request an Absentee Ballot", "Last day for Early Voting", "Last day for an Absentee Ballot submitted by mail", "Election Day"];
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const clean = (value: string) => value.normalize("NFKC").replace(/\s+/gu, " ").trim();
const exact = (value: unknown, keys: string[]): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).sort().join(",") === [...keys].sort().join(","));

function document(body: string) {
	if (typeof body !== "string" || Buffer.byteLength(body) > fultonCalendarPublication.maximumDocumentBytes || body.includes("\uFFFD")) throw new Error("The Fulton calendar document exceeds its reviewed bounds.");
	const root = parseStateHtml(body);
	const pending = [{ node: root, depth: 0 }];
	let visited = 0;
	while (pending.length) {
		const { node, depth } = pending.pop()!;
		if (++visited > 60000 || depth > 64) throw new Error("The Fulton calendar structure exceeds its reviewed bounds.");
		for (const child of node.childNodes ?? []) pending.push({ node: child, depth: depth + 1 });
	}
	const mains = stateHtmlDescendants(root, node => node.nodeName === "main");
	if (mains.length !== 1) throw new Error("The Fulton calendar main content requires review.");
	const policies = stateHtmlDescendants(root, node => node.nodeName === "a" && /privacy|terms of use|copyright|acceptable use|legal notice/iu.test(stateHtmlText(node))).map(node => new URL(stateHtmlAttribute(node, "href"), fultonCalendarPublication.indexUrl).href);
	if (policies.length !== 1 || policies[0] !== fultonCalendarPublication.policies[1]!.url) throw new Error("The Fulton calendar policy inventory changed.");
	return { root, main: mains[0]! };
}

export function verifyFultonCalendarPolicy(body: string, index: number) {
	const policy = fultonCalendarPublication.policies[index];
	if (!policy || typeof body !== "string" || Buffer.byteLength(body) > fultonCalendarPublication.maximumDocumentBytes) throw new Error("The Fulton calendar publisher policy is invalid.");
	const region = policy.region === "main-text" ? stateHtmlText(document(body).main).replace(/\s+/gu, " ").trim() : body;
	if (hash(region) !== policy.sha256) throw new Error("The Fulton calendar publisher policy changed.");
	if (index === 0) {
		const robots = electionDocumentRobotsPolicy(Buffer.from(body));
		for (const url of [fultonCalendarPublication.policies[1]!.url, fultonCalendarPublication.indexUrl, fultonCalendarPublication.calendarUrl]) {
			if (!robots.allowed(url)) throw new Error("The Fulton calendar publisher disallows collection.");
		}
		if (robots.delay > fultonCalendarPublication.minimumRequestIntervalMs) throw new Error("The Fulton calendar request interval requires review.");
	}
}

export function readFultonCalendarIndex(body: string) {
	const main = document(body).main;
	const links = stateHtmlDescendants(main, node => node.nodeName === "a" && /Key Election dates/iu.test(stateHtmlText(node)));
	if (links.length !== 1 || new URL(stateHtmlAttribute(links[0]!, "href"), fultonCalendarPublication.indexUrl).href !== fultonCalendarPublication.calendarUrl) throw new Error("The Fulton calendar discovery link requires review.");
	const edition = /^More about (20\d{2}) Key Election dates$/iu.exec(clean(stateHtmlText(links[0]!)));
	if (!edition) throw new Error("The Fulton calendar edition requires an explicit publisher year.");
	return Number(edition[1]);
}

function calendarDate(month: string, day: string, year: number) {
	const value = `${year}-${String(months.indexOf(month) + 1).padStart(2, "0")}-${day.padStart(2, "0")}`;
	if (!months.includes(month) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) throw new Error("The Fulton calendar contains an invalid date.");
	return value;
}

function printedDate(value: string, year: number) {
	const match = datePattern.exec(value);
	if (!match || (match[4] !== undefined && Number(match[4]) !== year)) throw new Error("The Fulton printed date requires review.");
	const date = calendarDate(match[2]!, match[3]!, year);
	const actualWeekday = weekdays[new Date(date).getUTCDay()];
	return { date, issue: actualWeekday === match[1] ? null : `weekday-date-conflict: printed ${match[1]}, calendar date is ${actualWeekday}` };
}

function lines(node: StateHtmlNode): string {
	if (node.nodeName === "br") return "\n";
	if (node.nodeName === "#text") return node.value ?? "";
	return `${["p", "hr"].includes(node.nodeName) ? "\n" : ""}${(node.childNodes ?? []).map(lines).join("")}`;
}

function section(title: FultonCalendarSection["title"], values: string[], year: number) {
	const rows: Omit<FultonCalendarEntry, "id">[] = [];
	for (let position = 0; position < values.length;) {
		const rawDate = values[position++]!;
		const range = rawDate.split(" - ");
		if (range.length > 2) throw new Error("The Fulton calendar date range requires review.");
		const first = printedDate(range[0]!, year);
		const last = range[1] === undefined ? null : printedDate(range[1], year);
		const label = values[position++]!;
		if (!labels.has(label) || rows.some(row => row.label === label)) throw new Error("The Fulton calendar event label changed or repeats.");
		if ((last && label !== "Risk Limiting Audit") || (last && last.date < first.date)) throw new Error("The Fulton calendar event range requires review.");
		const note = values[position]?.startsWith("(") ? values[position++]! : undefined;
		if (note && (label !== "Last day To Return UOCAVA Absentee Ballot" || !/^\(must be postmarked by (?:January|February|March|April|May|June|July|August|September|October|November|December) [1-9]\d?, 20\d{2}\)$/u.test(note))) throw new Error("The Fulton calendar event note requires review.");
		const issues = [first.issue, last?.issue].filter((value): value is string => Boolean(value));
		rows.push({ label, printedDate: rawDate, date: issues.length ? null : first.date, endDate: issues.length ? null : last?.date ?? null, ...(note ? { note } : {}), issues });
		if (rows.length > 60) throw new Error("The Fulton calendar event count exceeds its bounds.");
	}
	if (requiredLabels.some(label => !rows.some(row => row.label === label))) throw new Error("The Fulton calendar omits a required election event.");
	const electionDate = rows.find(row => row.label === "Election Day")?.date;
	if (!electionDate || (title === "General Election" ? !/^20\d{2}-11-0[2-8]$/u.test(electionDate) : !/^20\d{2}-12-0[1-7]$/u.test(electionDate)) || new Date(electionDate).getUTCDay() !== 2) throw new Error("The Fulton calendar election date requires review.");
	for (const row of rows) {
		if (!row.note) continue;
		const note = /^\(must be postmarked by (\w+) ([1-9]\d?), (20\d{2})\)$/u.exec(row.note)!;
		if (Number(note[3]) !== year || calendarDate(note[1]!, note[2]!, year) !== electionDate) throw new Error("The Fulton calendar postmark condition disagrees with its election.");
	}
	return { title, electionDate, status: rows.some(row => row.issues.length) ? "review-required" as const : "parsed" as const, entries: rows.map(row => ({ id: hash(JSON.stringify([title, electionDate, row.label])).slice(0, 24), ...row })) };
}

export function parseFultonCalendarPage(body: string, year: number): FultonCalendarSection[] {
	if (!Number.isSafeInteger(year) || year < 2026 || year > 2099) throw new Error("The Fulton calendar publication year requires review.");
	const main = document(body).main;
	const headings = stateHtmlDescendants(main, node => node.nodeName === "h1");
	if (headings.length !== 1 || clean(stateHtmlText(headings[0]!)) !== "Registration and Elections Key Election Dates") throw new Error("The Fulton calendar publication identity changed.");
	const upcoming = [...clean(stateHtmlText(main)).matchAll(/Upcoming Elections: ((?:Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday), \w+ [1-9]\d?, 20\d{2}) - General Election/gu)];
	if (upcoming.length !== 1) throw new Error("The Fulton calendar requires one explicit election date.");
	const expected = printedDate(upcoming[0]![1]!, year);
	if (expected.issue) throw new Error("The Fulton calendar election heading has a weekday conflict.");
	const regions = stateHtmlDescendants(main, node => node.nodeName === "div" && stateHtmlAttribute(node, "class").trim() === "text" && clean(stateHtmlText(node)).startsWith("Key Dates for General Election"));
	if (regions.length !== 1) throw new Error("The Fulton calendar event region changed.");
	const region = regions[0]!;
	const emptyEditorMarker = (node: StateHtmlNode) => node.nodeName === "span" && stateHtmlAttribute(node, "id") === "PING_CONTENT_MB_MAIN" && stateHtmlAttribute(node, "style") === "display: none;" && node.attrs?.length === 2 && !node.childNodes?.length;
	if ([region, ...stateHtmlDescendants(region, () => true)].some(node => !emptyEditorMarker(node) && (["script", "style", "form", "input", "table", "iframe"].includes(node.nodeName) || node.attrs?.some(attribute => attribute.name === "hidden") || stateHtmlAttribute(node, "aria-hidden") === "true" || /display\s*:\s*none|visibility\s*:\s*hidden/iu.test(stateHtmlAttribute(node, "style"))))) throw new Error("The Fulton calendar contains unreviewed hidden or interactive content.");
	const values = lines(region).split(/\r?\n/u).map(clean).filter(Boolean);
	if (values.shift() !== "Key Dates for General Election" || values.length > 250) throw new Error("The Fulton calendar event structure requires review.");
	const boundary = values.indexOf("General Runoff Election");
	if (boundary < 0 || values.lastIndexOf("General Runoff Election") !== boundary) throw new Error("The Fulton calendar runoff section is missing or ambiguous.");
	const sections = [section("General Election", values.slice(0, boundary), year), section("General Runoff Election", values.slice(boundary + 1), year)];
	if (sections[0]!.electionDate !== expected.date) throw new Error("The Fulton calendar event date disagrees with its heading.");
	return sections;
}

export function readFultonCalendarCapture(value: unknown, now = Date.now()): FultonCalendarInventory {
	if (!exact(value, ["schemaVersion", "type", "documents"]) || value.schemaVersion !== 1 || value.type !== "fulton-election-calendar-capture" || !Array.isArray(value.documents) || value.documents.length !== 4 || !Number.isFinite(now)) throw new Error("The Fulton calendar capture is invalid.");
	const capture = value as unknown as FultonCalendarCapture;
	const urls = [...fultonCalendarPublication.policies.map(policy => policy.url), fultonCalendarPublication.indexUrl, fultonCalendarPublication.calendarUrl];
	for (const [index, page] of capture.documents.entries()) {
		if (!exact(page, ["url", "body", "capturedAt", "sha256"]) || page.url !== urls[index] || typeof page.body !== "string" || Buffer.byteLength(page.body) > fultonCalendarPublication.maximumDocumentBytes || hash(page.body) !== page.sha256 || typeof page.capturedAt !== "string" || !Number.isFinite(Date.parse(page.capturedAt)) || new Date(page.capturedAt).toISOString() !== page.capturedAt || Date.parse(page.capturedAt) > now || (index > 0 && page.capturedAt < capture.documents[index - 1]!.capturedAt)) throw new Error("The Fulton calendar capture provenance is invalid.");
		if (index < 2) verifyFultonCalendarPolicy(page.body, index);
	}
	const sections = parseFultonCalendarPage(capture.documents[3]!.body, readFultonCalendarIndex(capture.documents[2]!.body));
	const documents = capture.documents.map(({ body: _body, ...page }) => page);
	return { schemaVersion: 1, type: "official-election-calendar-inventory", sourceId: fultonCalendarPublication.sourceId, stateCode: "GA", countyFips: "13121", retrievedAt: capture.documents[3]!.capturedAt, sourceSha256: hash(JSON.stringify(documents)), sourcePublishedAt: null, publicationApproved: false, electionOccurrenceConfirmed: false, documents, sections };
}

export function fultonCalendarCsv(inventory: FultonCalendarInventory) {
	const fields = ["election", "electionDate", "event", "printedDate", "date", "endDate", "condition", "reviewIssues"];
	const csv = (value: string) => `"${value.replace(/"/gu, "\"\"")}"`;
	return `${[fields, ...inventory.sections.flatMap(section => section.entries.map(row => [section.title, section.electionDate, row.label, row.printedDate, row.date ?? "", row.endDate ?? "", row.note ?? "", row.issues.join("; ")]))].map(row => row.map(csv).join(",")).join("\n")}\n`;
}
