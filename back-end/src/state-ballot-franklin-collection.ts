import type { StateCandidateValues } from "./state-ballot-additional-records.js";
import type { StateHtmlNode } from "./state-ballot-html.js";
import type { StateCandidateRecord } from "./state-ballot-records.js";
import type { StateBallotSource } from "./state-ballot-sources.js";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { setTimeout as wait } from "node:timers/promises";
import { fetchRemoteSourceDocument, fetchRemoteSourceText } from "./remote-json-source.js";
import { readFranklinCandidateDocuments } from "./state-ballot-franklin.js";
import { stateHtmlAttribute as attribute, stateHtmlDescendants as descendants, parseStateHtml, stateHtmlText } from "./state-ballot-html.js";
import { extractStateBallotPdfText, fetchStateBallotPdfDocument, resolveStateBallotPdfExtractor } from "./state-ballot-pdf.js";
import { StateBallotAwaitingRecordsError } from "./state-ballot-source-state.js";
import { containsControlCharacters } from "./text-validation.js";

const origin = "https://www.vote.franklincountyohio.gov";
export const franklinDiscoveryUrl = `${origin}/home`;
const hash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const clean = (value: string) => value.normalize("NFKC").replace(/\s+/gu, " ").trim();
const text = (node: StateHtmlNode) => clean(stateHtmlText(node));
const exact = (value: unknown, keys: string[]): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).sort().join("|") === [...keys].sort().join("|"));
interface Page { url: string; body: string; sha256: string; retrievedAt: string }
interface Pdf { url: string; text: string; sha256: string; retrievedAt: string }
interface Publication { kind: "candidates" | "notice" | "schedule"; url: string }
export interface FranklinElection {
	electionId: null;
	electionDate: string;
	pageUrl: string;
	franklinDocuments: { kind: "candidates" | "notice"; url: string; sha256: string }[];
}
interface Options {
	requestText?: (url: string, options: { allowedHosts: string[]; maxBytes: number; maxRedirects: number; timeoutMs: number }) => Promise<string>;
	requestDocument?: typeof fetchRemoteSourceDocument;
	extractor?: (bytes: Buffer, kind: Publication["kind"]) => Promise<string>;
	sleep?: (milliseconds: number) => Promise<void>;
	now?: () => number;
	discovery?: string;
}
export const franklinPolicyReceipts = [
	{ url: `${origin}/robots.txt`, status: 404, region: "bytes", sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855" },
	{ url: franklinDiscoveryUrl, status: 200, region: "legal-inventory", sha256: "1813ecb0bd8cfbf5738733f44006a1b29db4f6d752222d40c81f75394740bc19" }
] as const;
function html(body: string) {
	if (Buffer.byteLength(body) > 2 * 1024 * 1024 || containsControlCharacters(body.replace(/[\r\n\t]/gu, ""))) throw new Error("The Franklin County HTML exceeds its bounds.");
	const document = parseStateHtml(body);
	const pending = [{ node: document, depth: 0 }];
	let visited = 0;
	while (pending.length) {
		const item = pending.pop()!;
		if (++visited > 80000 || item.depth > 64) throw new Error("The Franklin County page structure requires review.");
		for (const child of item.node.childNodes ?? []) pending.push({ node: child, depth: item.depth + 1 });
	}
	return document;
}
export function franklinPolicyFingerprint(body: string) {
	const document = html(body);
	const footers = descendants(document, node => node.nodeName === "footer");
	if (footers.length !== 1 || !text(footers[0]!).startsWith("Franklin County Board of Elections ")) throw new Error("The Franklin County public footer requires review.");
	const links = descendants(footers[0]!, node => node.nodeName === "a").map((node) => {
		const label = text(node);
		const href = attribute(node, "href");
		const url = new URL(href, franklinDiscoveryUrl);
		if (["Email", "FCBOE Press"].includes(label)) {
			if (url.origin !== origin || url.pathname !== "/cdn-cgi/l/email-protection" || url.search || !/^#[a-f0-9]{20,200}$/u.test(url.hash)) throw new Error("The Franklin County opaque contact control changed.");
			return [label, `${origin}/cdn-cgi/l/email-protection#opaque-contact`];
		}
		return [label, href];
	});
	const legal = descendants(document, node => node.nodeName === "a" && /privacy|disclaimer|copyright|licen[cs]e|terms|polic(?:y|ies)|legal|accessibility/iu.test(`${text(node)} ${attribute(node, "href")}`)).map(node => [text(node), new URL(attribute(node, "href"), franklinDiscoveryUrl).href]);
	return hash(JSON.stringify({ footer: text(footers[0]!), links, legal: [...new Set(legal.map(value => JSON.stringify(value)))].sort() }));
}
function pageYear(value: string) {
	const url = new URL(value);
	const match = /^\/election-info\/(20\d{2})$/u.exec(url.pathname);
	if (url.origin !== origin || url.username || url.password || url.search || url.hash || url.href !== value || !match || Number(match[1]) < 2026) throw new Error("The Franklin County election-page identity requires review.");
	return Number(match[1]);
}
export function validateFranklinDocumentUrl(value: string) {
	const url = new URL(value);
	if (url.origin !== origin || url.username || url.password || url.search || url.hash || url.href !== value || !/^\/getmedia\/[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}\/[\w().-]{1,180}$/u.test(url.pathname)) throw new Error("The Franklin County document control requires review.");
}
function validDate(value: unknown): value is string {
	return typeof value === "string" && /^20\d{2}-11-0[2-8]$/u.test(value) && value >= "2026-11-03" && new Date(`${value}T00:00:00Z`).getUTCDay() === 2;
}
export function validateFranklinElection(value: unknown): asserts value is FranklinElection {
	if (!exact(value, ["electionId", "electionDate", "pageUrl", "franklinDocuments"]) || value.electionId !== null || !validDate(value.electionDate) || typeof value.pageUrl !== "string" || String(pageYear(value.pageUrl)) !== value.electionDate.slice(0, 4) || !Array.isArray(value.franklinDocuments) || ![0, 2].includes(value.franklinDocuments.length)) throw new Error("The Franklin County election configuration requires review.");
	for (const [index, document] of value.franklinDocuments.entries()) {
		if (!exact(document, ["kind", "url", "sha256"]) || document.kind !== (index ? "notice" : "candidates") || typeof document.url !== "string" || typeof document.sha256 !== "string" || !/^[a-f0-9]{64}$/u.test(document.sha256)) throw new Error("The Franklin County publication set is invalid.");
		validateFranklinDocumentUrl(document.url);
	}
	if (new Set(value.franklinDocuments.map(document => document.url)).size !== value.franklinDocuments.length) throw new Error("The Franklin County publications are duplicated.");
}
export function franklinDocumentDigest(documents: FranklinElection["franklinDocuments"]) {
	return hash(JSON.stringify(documents));
}
export function validateFranklinSource(source: StateBallotSource) {
	validateFranklinElection({ electionId: null, electionDate: source.electionDate, pageUrl: source.pageUrl, franklinDocuments: [] });
	if (source.stateCode !== "OH" || source.format !== "franklin-pdf" || source.countyName !== "Franklin County" || source.url !== source.pageUrl || source.snapshotStorage !== "external" || source.retrievalPolicy || source.postBody || source.documentUrls || source.documentLinks || source.delimiter || source.id !== (source.electionDate === "2026-11-03" ? "oh-franklin-2026" : `oh-franklin-general-${source.electionDate}`)) throw new Error("The Franklin County source contract requires review.");
}
function checkedPage(value: unknown, now: number): asserts value is Page {
	if (!exact(value, ["url", "body", "sha256", "retrievedAt"]) || typeof value.url !== "string" || typeof value.body !== "string" || hash(value.body) !== value.sha256 || typeof value.retrievedAt !== "string" || !Number.isFinite(Date.parse(value.retrievedAt)) || new Date(value.retrievedAt).toISOString() !== value.retrievedAt || Date.parse(value.retrievedAt) > now || franklinPolicyFingerprint(value.body) !== franklinPolicyReceipts[1].sha256) throw new Error("The Franklin County page provenance or legal inventory requires review.");
}
function offeredPages(body: string, now: number) {
	const document = html(body);
	const earliest = Math.max(2026, new Date(now).getUTCFullYear());
	const links = descendants(document, node => node.nodeName === "a" && /^20\d{2}$/u.test(text(node)) && Number(text(node)) >= earliest).map((node) => {
		const url = new URL(attribute(node, "href"), franklinDiscoveryUrl).href;
		if (pageYear(url) !== Number(text(node))) throw new Error("The Franklin County offered year labels disagree.");
		return url;
	});
	const selected = [...new Set(links)].sort();
	if (!selected.length || selected.length > 6) throw new Error("The Franklin County offered year set requires review.");
	return selected;
}
function publications(page: Page): Publication[] {
	const year = pageYear(page.url);
	const mains = descendants(html(page.body), node => node.nodeName === "main");
	if (mains.length !== 1 || descendants(mains[0]!, node => node.nodeName === "h1" && text(node) === `${year} Election Info`).length !== 1) throw new Error("The Franklin County election-year heading requires review.");
	let general = false;
	let seen = 0;
	const result: Publication[] = [];
	for (const node of descendants(mains[0]!, node => node.nodeName === "h2" || node.nodeName === "a")) {
		const label = text(node);
		if (node.nodeName === "h2") {
			general = label === "General Election";
			if (general) seen++;
			continue;
		}
		if (!general) continue;
		let kind: Publication["kind"] | undefined;
		if (label === `${year} General Election Candidates (PDF)`) kind = "candidates";
		else if (label === "46 Day Notice for Federal Write-in Absentee Ballot (PDF)") kind = "notice";
		else if (label === `${year} General Election Schedule with Candidate Requirements (PDF)`) kind = "schedule";
		else if (/candidate|46 day|fwab|schedule/iu.test(label) && !/^100 Day Notice for Federal Write-in Absentee Ballot \(PDF\)$/u.test(label)) throw new Error("A Franklin County general-election publication label requires review.");
		if (kind) {
			const url = new URL(attribute(node, "href"), page.url).href;
			validateFranklinDocumentUrl(url);
			if (!new URL(url).pathname.includes(`/${year}-`) || !/general/iu.test(new URL(url).pathname)) throw new Error("The Franklin County document does not identify the offered general-election year.");
			result.push({ kind, url });
		}
	}
	if (seen !== 1 || new Set(result.map(item => item.kind)).size !== result.length || !result.some(item => item.kind === "notice" || item.kind === "schedule")) throw new Error("The Franklin County general-election date publication is missing or duplicated.");
	return result.sort((first, second) => ["candidates", "notice", "schedule"].indexOf(first.kind) - ["candidates", "notice", "schedule"].indexOf(second.kind));
}
function checkedPdf(value: unknown, url: string, now: number): asserts value is Pdf {
	if (!exact(value, ["url", "text", "sha256", "retrievedAt"]) || value.url !== url || typeof value.text !== "string" || Buffer.byteLength(value.text) > 4 * 1024 * 1024 || containsControlCharacters(value.text.replace(/[\r\n\t\f]/gu, "")) || typeof value.sha256 !== "string" || !/^[a-f0-9]{64}$/u.test(value.sha256) || typeof value.retrievedAt !== "string" || !Number.isFinite(Date.parse(value.retrievedAt)) || new Date(value.retrievedAt).toISOString() !== value.retrievedAt || Date.parse(value.retrievedAt) > now) throw new Error("The Franklin County document provenance requires review.");
}
function documentDate(document: Pdf, kind: "notice" | "schedule", year: number) {
	let value: string;
	if (kind === "notice") {
		const parsed = parseStateHtml(document.text);
		const words = descendants(parsed, node => node.nodeName === "word").map(text).join(" ");
		if (!words.includes("Issued by the Franklin County Board of Elections")) throw new Error("The Franklin County date notice identifies a different publisher.");
		const dates = [...words.matchAll(/November ([2-8]), (20\d{2}) GENERAL ELECTION/gu)];
		if (dates.length !== 1 || Number(dates[0]![2]) !== year) throw new Error("The Franklin County general notice date requires review.");
		value = `${year}-11-0${dates[0]![1]}`;
	}
	else {
		const pages = document.text.split("\f").filter(page => page.trim());
		const first = clean(pages[0] ?? "");
		if (!pages.length || pages.length > 50 || !first.startsWith(`${year} GENERAL ELECTION SCHEDULE Page 1 of ${pages.length} `)) throw new Error("The Franklin County schedule heading or page count requires review.");
		for (const [index, page] of pages.entries()) {
			if (!clean(page).startsWith(`${year} GENERAL ELECTION SCHEDULE Page ${index + 1} of ${pages.length} `)) throw new Error("The Franklin County schedule page sequence requires review.");
		}
		const dates = [...first.matchAll(/General Election Day \.{3,}November ([2-8]), (20\d{2})\b/gu)];
		if (dates.length !== 1 || Number(dates[0]![2]) !== year) throw new Error("The Franklin County schedule date requires review.");
		value = `${year}-11-0${dates[0]![1]}`;
	}
	if (!validDate(value)) throw new Error("The Franklin County published general-election date is invalid.");
	return value;
}
export function readFranklinDiscovery(body: string, now = Date.now()) {
	if (Buffer.byteLength(body) > 24 * 1024 * 1024) throw new Error("The Franklin County discovery exceeds its bounds.");
	const value = JSON.parse(body);
	if (!exact(value, ["schemaVersion", "type", "policies", "index", "pages", "documents"]) || value.schemaVersion !== 1 || value.type !== "franklin-discovery" || JSON.stringify(value.policies) !== JSON.stringify(franklinPolicyReceipts) || !Array.isArray(value.pages) || !Array.isArray(value.documents) || value.documents.length !== value.pages.length) throw new Error("The Franklin County discovery contract is invalid.");
	const indexPage = value.index;
	const capturedDocuments = value.documents;
	checkedPage(indexPage, now);
	if (indexPage.url !== franklinDiscoveryUrl) throw new Error("The Franklin County discovery index changed.");
	const offered = offeredPages(indexPage.body, Date.parse(indexPage.retrievedAt));
	if (offered.length !== value.pages.length) throw new Error("The Franklin County offered year set is incomplete.");
	const pages: Page[] = value.pages.map((page: unknown, index: number) => {
		checkedPage(page, now);
		if (page.url !== offered[index] || Date.parse(page.retrievedAt) < Date.parse(indexPage.retrievedAt)) throw new Error("The Franklin County year-page set or acquisition order changed.");
		return page;
	});
	const elections = pages.map((page, index): FranklinElection => {
		const selected = publications(page);
		const documents = capturedDocuments[index];
		if (!Array.isArray(documents) || documents.length !== selected.length) throw new Error("The Franklin County captured publication set is incomplete.");
		for (const [position, document] of documents.entries()) {
			checkedPdf(document, selected[position]!.url, now);
			if (Date.parse(document.retrievedAt) < Date.parse(page.retrievedAt)) throw new Error("The Franklin County document acquisition precedes its linking page.");
		}
		const dates = selected.flatMap((item, position) => item.kind === "candidates" ? [] : [documentDate(documents[position], item.kind, pageYear(page.url))]);
		if (new Set(dates).size !== 1) throw new Error("The Franklin County source election dates disagree.");
		const complete = selected.some(item => item.kind === "candidates") && selected.some(item => item.kind === "notice");
		const election: FranklinElection = { electionId: null, electionDate: dates[0]!, pageUrl: page.url, franklinDocuments: complete ? selected.flatMap((item, position) => item.kind === "schedule" ? [] : [{ kind: item.kind, url: item.url, sha256: documents[position].sha256 }]) : [] };
		validateFranklinElection(election);
		return election;
	});
	return { index: indexPage, pages, documents: capturedDocuments as Pdf[][], elections };
}
export async function fetchFranklinCycleDiscovery(options: Options = {}) {
	const request = options.requestDocument ?? fetchRemoteSourceDocument;
	const sleep = options.sleep ?? wait;
	const now = options.now ?? Date.now;
	const robots = await request(franklinPolicyReceipts[0].url, { allowedHosts: [new URL(origin).hostname], maxBytes: 2 * 1024 * 1024, timeoutMs: 25000 });
	if (robots.status !== 404 || hash(robots.body) !== franklinPolicyReceipts[0].sha256) throw new Error("The Franklin County public robots response requires review.");
	await sleep(11000);
	const getPage = async (url: string): Promise<Page> => {
		const body = await (options.requestText ?? fetchRemoteSourceText)(url, { allowedHosts: [new URL(origin).hostname], maxBytes: 2 * 1024 * 1024, maxRedirects: 0, timeoutMs: 25000 });
		const result = { url, body, sha256: hash(body), retrievedAt: new Date(now()).toISOString() };
		checkedPage(result, now());
		return result;
	};
	const index = await getPage(franklinDiscoveryUrl);
	const pages: Page[] = [];
	const documents: Pdf[][] = [];
	const executable = options.extractor ? null : await resolveStateBallotPdfExtractor();
	for (const url of offeredPages(index.body, now())) {
		await sleep(11000);
		const page = await getPage(url);
		pages.push(page);
		const entries: Pdf[] = [];
		for (const item of publications(page)) {
			await sleep(11000);
			entries.push(await fetchStateBallotPdfDocument(item.url, { allowedHosts: [new URL(origin).hostname], request, now, extractor: bytes => options.extractor ? options.extractor(bytes, item.kind) : extractStateBallotPdfText(bytes, executable!, 12000, item.kind === "schedule" ? "layout" : "raw-bbox") }));
		}
		documents.push(entries);
	}
	const body = JSON.stringify({ schemaVersion: 1, type: "franklin-discovery", policies: franklinPolicyReceipts, index, pages, documents });
	readFranklinDiscovery(body, now());
	return body;
}
export async function fetchFranklinCandidateCapture(source: StateBallotSource, options: Options = {}) {
	validateFranklinSource(source);
	const body = options.discovery ?? await fetchFranklinCycleDiscovery(options);
	const discovery = readFranklinDiscovery(body, (options.now ?? Date.now)());
	if (!discovery.elections.some(election => election.electionDate === source.electionDate && election.pageUrl === source.pageUrl)) throw new Error("The Franklin County source is no longer offered.");
	return JSON.stringify({ schemaVersion: 1, type: "franklin-candidate-capture", discovery: JSON.parse(body), electionDate: source.electionDate });
}
export function parseFranklinCandidateCapture(source: StateBallotSource, body: string, factory: (source: StateBallotSource, values: StateCandidateValues) => StateCandidateRecord | null, now = Date.now()) {
	validateFranklinSource(source);
	if (Buffer.byteLength(body) > 24 * 1024 * 1024) throw new Error("The Franklin County candidate capture exceeds its bounds.");
	const capture = JSON.parse(body);
	if (!exact(capture, ["schemaVersion", "type", "discovery", "electionDate"]) || capture.schemaVersion !== 1 || capture.type !== "franklin-candidate-capture" || capture.electionDate !== source.electionDate) throw new Error("The Franklin County candidate capture requires review.");
	const discovery = readFranklinDiscovery(JSON.stringify(capture.discovery), now);
	const index = discovery.elections.findIndex(election => election.electionDate === source.electionDate && election.pageUrl === source.pageUrl);
	if (index < 0) throw new Error("The Franklin County captured election is not offered.");
	const election = discovery.elections[index]!;
	if (!election.franklinDocuments.length) throw new StateBallotAwaitingRecordsError(source.id);
	const documents = election.franklinDocuments.map(item => discovery.documents[index]!.find(document => document.url === item.url)!);
	const aliases = source.electionDate === "2026-11-03" ? [["Eboney C. Eldridge", "Ebony C. Eldridge"], ["Meredith R. Lawson-Rowe", "Meredith Lawson-Rowe"]].map(([name, noticeName]) => ({ name: name!, noticeName: noticeName!, electionDate: source.electionDate, office: "STATE REPRESENTATIVE OHIO HOUSE DISTRICT 05" })) : [];
	const parsed = readFranklinCandidateDocuments(source, documents[0]!.text, documents[1]!.text, factory, aliases);
	const supplemental = parsed.noticeAudit.supplementedNames.length;
	return { records: parsed.records, retrievedAt: new Date(Math.min(...documents.map(document => Date.parse(document.retrievedAt)))).toISOString(), sha256: hash(JSON.stringify(documents.map(({ url, sha256 }) => ({ url, sha256 })))), documents: documents.map(({ url, sha256, retrievedAt }, position) => ({ url, sha256, retrievedAt, includedRecordCount: position ? supplemental : parsed.records.length - supplemental })), collectionIndexSha256: franklinDocumentDigest(election.franklinDocuments) };
}
