import type { StateCandidateRecord } from "./state-ballot-records.js";
import type { StateBallotSource } from "./state-ballot-sources.js";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { setTimeout as wait } from "node:timers/promises";
import { electionDocumentPolicyFingerprint, electionDocumentRobotsPolicy } from "./election-document-collection.js";
import { fetchRemoteSourceDocument } from "./remote-json-source.js";
import { stateHtmlAttribute as attribute, stateHtmlDescendants as descendants, parseStateHtml, stateHtmlText } from "./state-ballot-html.js";
import { extractStateBallotPdfText, fetchStateBallotPdfDocument, resolveStateBallotPdfExtractor } from "./state-ballot-pdf.js";
import { readPulaskiCandidateNotice } from "./state-ballot-pulaski.js";
import { StateBallotAwaitingRecordsError } from "./state-ballot-source-state.js";
import { containsControlCharacters } from "./text-validation.js";

export const pulaskiDiscoveryUrl = "https://votepulaskiar.gov/";
const hash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const clean = (value: string) => value.replace(/\s+/gu, " ").trim();
const exact = (value: unknown, keys: string[]): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).sort().join("|") === [...keys].sort().join("|"));
interface Page { url: string; body: string; sha256: string; retrievedAt: string }
interface Pdf { url: string; text: string; sha256: string; retrievedAt: string }
interface Options { requestDocument?: typeof fetchRemoteSourceDocument; extractor?: (bytes: Buffer, kind: "notice" | "calendar") => Promise<string>; sleep?: (milliseconds: number) => Promise<void>; now?: () => number; discovery?: string }
export interface PulaskiElection { electionId: null; electionDate: string; pageUrl: string; pulaskiDocuments: { kind: "notice" | "calendar"; url: string; sha256: string }[] }
export const pulaskiPolicyReceipts = [
	{ url: `${pulaskiDiscoveryUrl}robots.txt`, format: "bytes", sha256: "7785b0fd026feacafe2f03b350e90bcad666d6419827f25d2d3e64f68e9bf8e8" },
	{ url: pulaskiDiscoveryUrl, format: "links", sha256: "5b297628a15e16dfb0559dffa5f5b1842396641f05a19268c94b40d8b8719831" }
] as const;

function validDate(value: unknown): value is string {
	return typeof value === "string" && /^20\d{2}-11-0[2-8]$/u.test(value) && value >= "2026-11-03" && Number(value.slice(0, 4)) % 2 === 0 && new Date(`${value}T00:00:00Z`).getUTCDay() === 2;
}
export function validatePulaskiDocumentUrl(value: string, kind: "notice" | "calendar", date?: string) {
	const url = new URL(value);
	if (url.origin !== "https://votepulaskiar.gov" || url.username || url.password || url.search || url.hash || url.href !== value) throw new Error("The Pulaski document origin requires review.");
	const match = kind === "calendar" ? /^\/wp-content\/uploads\/(20\d{2})(?:_(20\d{2}))?_Election-Dates_v[1-9]\d?\.pdf$/u.exec(url.pathname) : /^\/wp-content\/uploads\/(\d{2})(\d{2})(20\d{2})_(?:Amended-)?Notice-of-Election_v[1-9]\d?\.pdf$/u.exec(url.pathname);
	if (!match || (kind === "calendar" && (Number(match[1]) < 2025 || (match[2] && (Number(match[2]) < Number(match[1]) || Number(match[2]) - Number(match[1]) > 2)))) || (kind === "notice" && (!date || !validDate(date) || `${match[3]}-${match[1]}-${match[2]}` !== date))) throw new Error("The Pulaski offered document/date control requires review.");
}
export function validatePulaskiElection(value: unknown): asserts value is PulaskiElection {
	if (!exact(value, ["electionId", "electionDate", "pageUrl", "pulaskiDocuments"]) || value.electionId !== null || !validDate(value.electionDate) || value.pageUrl !== pulaskiDiscoveryUrl || !Array.isArray(value.pulaskiDocuments) || ![1, 2].includes(value.pulaskiDocuments.length)) throw new Error("The Pulaski election configuration requires review.");
	for (const [index, document] of value.pulaskiDocuments.entries()) {
		const kind = value.pulaskiDocuments.length === 2 && !index ? "notice" : "calendar";
		if (!exact(document, ["kind", "url", "sha256"]) || document.kind !== kind || typeof document.url !== "string" || typeof document.sha256 !== "string" || !/^[a-f0-9]{64}$/u.test(document.sha256)) throw new Error("The Pulaski publication identity requires review.");
		validatePulaskiDocumentUrl(document.url, kind, value.electionDate);
	}
}
export function validatePulaskiSource(source: StateBallotSource) {
	if (source.stateCode !== "AR" || source.format !== "pulaski-pdf" || source.url !== pulaskiDiscoveryUrl || source.pageUrl !== pulaskiDiscoveryUrl || source.countyName !== "Pulaski County" || !validDate(source.electionDate) || source.snapshotStorage !== "external" || source.retrievalPolicy || source.postBody || source.documentUrls || source.documentLinks || source.delimiter || source.id !== (source.electionDate === "2026-11-03" ? "ar-pulaski-candidates-2026" : `ar-pulaski-general-${source.electionDate}`)) throw new Error("The Pulaski source contract requires review.");
}
export function pulaskiDocumentDigest(documents: PulaskiElection["pulaskiDocuments"]) {
	return hash(JSON.stringify(documents));
}
function html(body: string) {
	if (Buffer.byteLength(body) > 2 * 1024 * 1024 || containsControlCharacters(body.replace(/[\r\n\t]/gu, ""))) throw new Error("The Pulaski election HTML exceeds its bounds.");
	const document = parseStateHtml(body);
	const pending = [{ node: document, depth: 0 }];
	let visited = 0;
	while (pending.length) {
		const item = pending.pop()!;
		if (++visited > 80000 || item.depth > 64) throw new Error("The Pulaski index structure requires review.");
		for (const child of item.node.childNodes ?? []) pending.push({ node: child, depth: item.depth + 1 });
	}
	return document;
}
function offered(body: string) {
	const document = html(body);
	const years = [...new Set(descendants(document, node => ["b", "strong"].includes(node.nodeName)).map(node => /^(20\d{2}) GENERAL ELECTION$/u.exec(clean(stateHtmlText(node)))?.[1]).filter((value): value is string => Boolean(value)))];
	if (!years.length || years.length > 4 || years.some(year => Number(year) < 2026 || Number(year) % 2)) throw new Error("The Pulaski offered general-election headings require review.");
	const links = descendants(document, node => node.nodeName === "a").map(node => ({ label: clean(stateHtmlText(node)), url: new URL(attribute(node, "href"), pulaskiDiscoveryUrl).href }));
	const calendars = links.filter(link => link.label === "Scheduled Election Dates");
	if (calendars.length !== 1) throw new Error("The Pulaski offered calendar is missing or duplicated.");
	validatePulaskiDocumentUrl(calendars[0]!.url, "calendar");
	const notices = links.filter(link => /notice.*election.*general|general.*notice.*election/iu.test(link.label));
	if (notices.some(link => !/^Notice of Election 20\d{2} General$/u.test(link.label)) || notices.length > years.length || new Set(notices.map(link => link.label)).size !== notices.length || notices.some(link => !years.includes(/20\d{2}/u.exec(link.label)![0]))) throw new Error("The Pulaski offered notice inventory requires review.");
	return { years, calendarUrl: calendars[0]!.url, notices };
}
function calendarDates(document: Pdf, now: number) {
	const pages = document.text.split("\f").filter(page => page.trim());
	if (!pages.length || pages.length > 20 || !clean(document.text).includes("www.votepulaskiar.gov")) throw new Error("The Pulaski calendar identity requires review.");
	const result: string[] = [];
	const lines = document.text.split(/\r?\n/u).map(clean).filter(Boolean);
	for (const [index, line] of lines.entries()) {
		const match = /^November ([2-8]), (20\d{2})(?: \(if a runoff is needed in the general, it will be December \d{1,2}(?:st|nd|rd|th)\))?$/u.exec(line);
		if (!match || Number(match[2]) < 2026 || Number(match[2]) % 2) continue;
		const date = `${match[2]}-11-0${match[1]}`;
		if (!validDate(date) || !lines.includes(`${match[2]} ELECTION DATES`) || !/^(?:[^\p{L}\d]+ )?General Election(?:\/| |$)/u.test(lines[index + 1] ?? "")) throw new Error("The Pulaski general-election calendar date requires review.");
		if (Date.parse(`${date}T00:00:00Z`) + 2 * 86400000 > now) result.push(date);
	}
	if (!result.length || result.length > 4 || new Set(result).size !== result.length) throw new Error("The Pulaski current/future calendar inventory requires review.");
	return result.sort();
}
function checkedPdf(value: unknown, url: string, now: number): asserts value is Pdf {
	if (!exact(value, ["url", "text", "sha256", "retrievedAt"]) || value.url !== url || typeof value.text !== "string" || Buffer.byteLength(value.text) > 4 * 1024 * 1024 || containsControlCharacters(value.text.replace(/[\r\n\t\f]/gu, "")) || typeof value.sha256 !== "string" || !/^[a-f0-9]{64}$/u.test(value.sha256) || typeof value.retrievedAt !== "string" || !Number.isFinite(Date.parse(value.retrievedAt)) || new Date(value.retrievedAt).toISOString() !== value.retrievedAt || Date.parse(value.retrievedAt) > now) throw new Error("The Pulaski document provenance requires review.");
}
export function readPulaskiDiscovery(body: string, now = Date.now()) {
	if (Buffer.byteLength(body) > 24 * 1024 * 1024) throw new Error("The Pulaski discovery exceeds its bounds.");
	const value: unknown = JSON.parse(body);
	if (!exact(value, ["schemaVersion", "type", "policies", "index", "calendar", "notices"]) || value.schemaVersion !== 1 || value.type !== "pulaski-discovery" || JSON.stringify(value.policies) !== JSON.stringify(pulaskiPolicyReceipts) || !exact(value.index, ["url", "body", "sha256", "retrievedAt"]) || value.index.url !== pulaskiDiscoveryUrl || typeof value.index.body !== "string" || hash(value.index.body) !== value.index.sha256 || typeof value.index.retrievedAt !== "string" || !Number.isFinite(Date.parse(value.index.retrievedAt)) || new Date(value.index.retrievedAt).toISOString() !== value.index.retrievedAt || Date.parse(value.index.retrievedAt) > now || electionDocumentPolicyFingerprint(Buffer.from(value.index.body), "links", pulaskiDiscoveryUrl) !== pulaskiPolicyReceipts[1].sha256 || !Array.isArray(value.notices)) throw new Error("The Pulaski discovery provenance or legal inventory requires review.");
	const index = value.index as unknown as Page;
	const selected = offered(index.body);
	checkedPdf(value.calendar, selected.calendarUrl, now);
	const calendar = value.calendar;
	const dates = calendarDates(calendar, now).filter(date => selected.years.includes(date.slice(0, 4)));
	if (dates.length !== selected.years.filter(year => Number(year) >= new Date(now).getUTCFullYear()).length || value.notices.length !== selected.notices.length) throw new Error("The Pulaski offered years, calendar and notices disagree.");
	const capturedNotices = value.notices;
	const notices = selected.notices.map((notice, position) => {
		const date = dates.find(date => notice.label === `Notice of Election ${date.slice(0, 4)} General`);
		if (!date) throw new Error("The Pulaski notice has no current offered calendar date.");
		validatePulaskiDocumentUrl(notice.url, "notice", date);
		checkedPdf(capturedNotices[position], notice.url, now);
		return capturedNotices[position] as unknown as Pdf;
	});
	const elections: PulaskiElection[] = dates.map((electionDate) => {
		const notice = notices.find(document => document.url.includes(`${electionDate.slice(5, 7)}${electionDate.slice(8, 10)}${electionDate.slice(0, 4)}_`));
		return { electionId: null, electionDate, pageUrl: pulaskiDiscoveryUrl, pulaskiDocuments: [...(notice ? [{ kind: "notice" as const, url: notice.url, sha256: notice.sha256 }] : []), { kind: "calendar" as const, url: calendar.url, sha256: calendar.sha256 }] };
	});
	for (const election of elections) validatePulaskiElection(election);
	return { index, calendar, notices, elections };
}
export async function fetchPulaskiCycleDiscovery(options: Options = {}) {
	const request = options.requestDocument ?? fetchRemoteSourceDocument;
	const sleep = options.sleep ?? (milliseconds => wait(milliseconds));
	const now = options.now ?? Date.now;
	let robots: ReturnType<typeof electionDocumentRobotsPolicy> | undefined, index: Page | undefined;
	for (const [position, policy] of pulaskiPolicyReceipts.entries()) {
		if (position) await sleep(11000);
		if (robots && !robots.allowed(policy.url)) throw new Error("The Pulaski robots policy disallows this request.");
		const response = await request(policy.url, { allowedHosts: ["votepulaskiar.gov"], maxBytes: 2 * 1024 * 1024, timeoutMs: 25000 });
		if (response.status !== 200 || (policy.format === "bytes" ? hash(response.body) : response.contentType !== "text/html" ? "" : electionDocumentPolicyFingerprint(response.body, "links", policy.url)) !== policy.sha256) throw new Error("The Pulaski access or reuse policy changed; review before collection.");
		if (!position) robots = electionDocumentRobotsPolicy(response.body);
		if (policy.url === pulaskiDiscoveryUrl) index = { url: policy.url, body: response.body.toString("utf8"), sha256: hash(response.body), retrievedAt: new Date(now()).toISOString() };
	}
	const selected = offered(index!.body);
	const executable = options.extractor ? null : await resolveStateBallotPdfExtractor();
	async function get(url: string, kind: "notice" | "calendar") {
		if (!robots!.allowed(url)) throw new Error("The Pulaski robots policy disallows this publication.");
		await sleep(11000);
		return fetchStateBallotPdfDocument(url, { allowedHosts: ["votepulaskiar.gov"], request, now, extractor: bytes => options.extractor ? options.extractor(bytes, kind) : extractStateBallotPdfText(bytes, executable!, 12000, kind === "notice" ? "bbox-layout" : "layout", kind === "notice" ? 40 : 20) });
	}
	const calendar = await get(selected.calendarUrl, "calendar");
	const dates = calendarDates(calendar, now());
	const notices: Pdf[] = [];
	for (const notice of selected.notices) {
		const date = dates.find(date => notice.label === `Notice of Election ${date.slice(0, 4)} General`);
		if (!date) throw new Error("The Pulaski offered notice lacks a validated calendar date.");
		validatePulaskiDocumentUrl(notice.url, "notice", date);
		notices.push(await get(notice.url, "notice"));
	}
	const body = JSON.stringify({ schemaVersion: 1, type: "pulaski-discovery", policies: pulaskiPolicyReceipts, index, calendar, notices });
	readPulaskiDiscovery(body, now());
	return body;
}
export async function fetchPulaskiCandidateCapture(source: StateBallotSource, options: Options = {}) {
	validatePulaskiSource(source);
	const body = options.discovery ?? await fetchPulaskiCycleDiscovery(options);
	if (!readPulaskiDiscovery(body, (options.now ?? Date.now)()).elections.some(item => item.electionDate === source.electionDate)) throw new Error("The Pulaski election is not offered.");
	return JSON.stringify({ schemaVersion: 1, type: "pulaski-candidate-capture", discovery: JSON.parse(body), electionDate: source.electionDate });
}
export function parsePulaskiCandidateCapture(source: StateBallotSource, body: string, now = Date.now(), previous: readonly StateCandidateRecord[] = []) {
	validatePulaskiSource(source);
	if (Buffer.byteLength(body) > 24 * 1024 * 1024) throw new Error("The Pulaski candidate capture exceeds its bounds.");
	const value: unknown = JSON.parse(body);
	if (!exact(value, ["schemaVersion", "type", "discovery", "electionDate"]) || value.schemaVersion !== 1 || value.type !== "pulaski-candidate-capture" || value.electionDate !== source.electionDate) throw new Error("The Pulaski candidate capture requires review.");
	const discovery = readPulaskiDiscovery(JSON.stringify(value.discovery), now);
	const election = discovery.elections.find(election => election.electionDate === source.electionDate);
	if (!election) throw new Error("The Pulaski captured election is not offered.");
	if (election.pulaskiDocuments.length !== 2) throw new StateBallotAwaitingRecordsError(source.id);
	const notice = discovery.notices.find(document => document.url === election.pulaskiDocuments[0]!.url)!;
	const parsed = readPulaskiCandidateNotice(source, notice.text);
	const identities = new Set(parsed.records.map(record => record.id));
	if (previous.some(record => !identities.has(record.id))) throw new Error("An accepted Pulaski candidate disappeared or changed identity; retain the accepted data for review.");
	const documents = [notice, discovery.calendar];
	return { records: parsed.records, retrievedAt: new Date(Math.min(...documents.map(document => Date.parse(document.retrievedAt)))).toISOString(), sha256: hash(JSON.stringify(documents.map(({ url, sha256 }) => ({ url, sha256 })))), documents: documents.map(({ url, sha256, retrievedAt }, index) => ({ url, sha256, retrievedAt, includedRecordCount: index ? 0 : parsed.records.length })), collectionIndexSha256: pulaskiDocumentDigest(election.pulaskiDocuments) };
}
