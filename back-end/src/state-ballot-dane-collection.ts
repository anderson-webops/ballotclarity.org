import type { StateCandidateRecord } from "./state-ballot-records.js";
import type { StateBallotSource } from "./state-ballot-sources.js";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { setTimeout as wait } from "node:timers/promises";
import { electionDocumentPolicyFingerprint, electionDocumentRobotsPolicy } from "./election-document-collection.js";
import { fetchRemoteSourceDocument } from "./remote-json-source.js";
import { readDaneCandidateNotice, readDaneCandidateSample } from "./state-ballot-dane.js";
import { stateHtmlAttribute as attribute, stateHtmlDescendants as descendants, parseStateHtml, stateHtmlText } from "./state-ballot-html.js";
import { extractStateBallotPdfText, fetchStateBallotPdfDocument, resolveStateBallotPdfExtractor } from "./state-ballot-pdf.js";
import { StateBallotAwaitingRecordsError } from "./state-ballot-source-state.js";
import { containsControlCharacters } from "./text-validation.js";

export const daneDiscoveryUrl = "https://townofdane.gov/news-notices/";
const hash = (body: string | Buffer) => createHash("sha256").update(body).digest("hex");
const clean = (value: string) => value.replace(/\s+/gu, " ").trim();
const exact = (value: unknown, keys: string[]): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).sort().join("|") === [...keys].sort().join("|"));
const roles = ["Lodi", "Waunakee", "Sauk", "notice"] as const;
export function danePolicyFingerprint(body: Buffer, format: "links" | "main", url: string) {
	if (body.length > 2 * 1024 * 1024) throw new Error("The Dane policy exceeds its bounds.");
	const normalized = new TextDecoder("utf-8", { fatal: true }).decode(body).replace(/href=(["'])(\/cdn-cgi\/l\/email-protection)#[a-f0-9]{6,2048}\1/giu, "href=$1$2$1");
	return electionDocumentPolicyFingerprint(Buffer.from(normalized), format, url);
}
type Role = typeof roles[number];
interface Page { url: string; body: string; sha256: string; retrievedAt: string }
interface Pdf { url: string; text: string; sha256: string; retrievedAt: string }
interface Options { requestDocument?: typeof fetchRemoteSourceDocument; extractor?: (bytes: Buffer) => Promise<string>; now?: () => number; sleep?: (milliseconds: number) => Promise<void>; discovery?: string }
export interface DaneElection { electionId: null; electionDate: string; pageUrl: string; daneDocuments: { kind: Role; url: string; sha256: string }[] }
export const danePolicyReceipts = {
	townRobots: "b94f11d843c0133fe086a7c5e83bdac5ade85c6b39ca74890bfa21e96187959c",
	newsLinks: "93d8755c63604f385493cac1c1024d1571c9ffcdd2ca86c231faf22858c602a3",
	articleLinks: "1b964991b883b2de0bfbb4aff463d07687beafcaccf62872bee815222a36e02b",
	vendorRobots: "02073cdec133b0c5ee07ff78c9fcac04cd474f4b485038d810004a8ff4f3979d",
	vendorMain: "b911c91f8e6022231dc000327ea0227d68e1920bd2eb80c1cd1c1d71675976e5",
	vendorLinks: "ae7bfb9b45eea34a6bd9c79254d2e30659e6f89a6a9bc78fb38e41fc23f2faf4",
	cdnRobots: "e5c4b84484ee4216e9373be99380320c25dd94805f99f0a805846f087636553f"
} as const;

function validDate(value: unknown): value is string {
	return typeof value === "string" && /^20\d{2}-11-0[2-8]$/u.test(value) && value >= "2026-11-03" && Number(value.slice(0, 4)) % 2 === 0 && new Date(`${value}T00:00:00Z`).getUTCDay() === 2;
}
function articleDate(value: string) {
	const url = new URL(value);
	const match = /^\/(20\d{2})\/(0[1-9]|1[01])\/([0-3]\d)\/november-([2-8])-(20\d{2})-general-election-information\/$/u.exec(url.pathname);
	const date = match ? `${match[5]}-11-0${match[4]}` : "";
	if (url.origin !== "https://townofdane.gov" || url.username || url.password || url.search || url.hash || url.href !== value || !match || match[1] !== match[5] || !validDate(date) || !Number.isFinite(Date.parse(`${match[1]}-${match[2]}-${match[3]}T00:00:00Z`)) || new Date(`${match[1]}-${match[2]}-${match[3]}T00:00:00Z`).toISOString().slice(0, 10) !== `${match[1]}-${match[2]}-${match[3]}` || `${match[1]}-${match[2]}-${match[3]}` > date) throw new Error("The Dane offered election article requires review.");
	return date;
}
export function validateDaneDocumentUrl(value: string, kind: Role, electionDate: string) {
	const url = new URL(value);
	const match = /^\/townofdane\.gov\/wp-content\/uploads\/(20\d{2})\/(?:0[1-9]|1[01])\/([^/]+)$/u.exec(url.pathname);
	const filename = kind === "notice" ? `Dane-County-Type-B-ToD-Notice-for-Fall-${electionDate.slice(0, 4)}.pdf` : `Sample-Nov-${Number(electionDate.slice(8))}-Ballot-${kind}.pdf`;
	if (!roles.includes(kind) || !validDate(electionDate) || url.origin !== "https://cdn.townweb.com" || url.href !== value || url.username || url.password || url.search || url.hash || !match || match[1] !== electionDate.slice(0, 4) || match[2] !== filename) throw new Error("The Dane offered PDF identity or date requires review.");
}
export function validateDaneElection(value: unknown): asserts value is DaneElection {
	if (!exact(value, ["electionId", "electionDate", "pageUrl", "daneDocuments"]) || value.electionId !== null || !validDate(value.electionDate) || typeof value.pageUrl !== "string" || articleDate(value.pageUrl) !== value.electionDate || !Array.isArray(value.daneDocuments) || value.daneDocuments.length > 4) throw new Error("The Dane election configuration requires review.");
	const kinds: string[] = [];
	for (const item of value.daneDocuments) {
		if (!exact(item, ["kind", "url", "sha256"]) || !roles.includes(item.kind as Role) || typeof item.url !== "string" || typeof item.sha256 !== "string" || !/^[a-f0-9]{64}$/u.test(item.sha256) || kinds.includes(String(item.kind))) throw new Error("The Dane document configuration requires review.");
		validateDaneDocumentUrl(item.url, item.kind as Role, value.electionDate);
		kinds.push(item.kind as string);
	}
	if (kinds.join("|") !== roles.filter(kind => kinds.includes(kind)).join("|")) throw new Error("The Dane document order requires review.");
}
export function validateDaneSource(source: StateBallotSource) {
	if (source.stateCode !== "WI" || source.format !== "dane-pdf" || source.url !== daneDiscoveryUrl || articleDate(source.pageUrl) !== source.electionDate || !validDate(source.electionDate) || source.id !== (source.electionDate === "2026-11-03" ? "wi-town-dane-2026" : `wi-town-dane-general-${source.electionDate}`) || source.snapshotStorage !== "external" || source.retrievalPolicy || source.postBody || source.documentUrls || source.documentLinks || source.delimiter) throw new Error("The Dane source contract requires review.");
}
export const daneDocumentDigest = (documents: DaneElection["daneDocuments"]) => hash(JSON.stringify(documents));
function links(body: string, url: string) {
	if (Buffer.byteLength(body) > 2 * 1024 * 1024 || containsControlCharacters(body.replace(/[\r\n\t]/gu, ""))) throw new Error("The Dane index exceeds its bounds.");
	const document = parseStateHtml(body);
	const pending = [{ node: document, depth: 0 }];
	let visited = 0;
	while (pending.length) {
		const item = pending.pop()!;
		if (++visited > 80000 || item.depth > 64) throw new Error("The Dane index structure requires review.");
		for (const child of item.node.childNodes ?? []) pending.push({ node: child, depth: item.depth + 1 });
	}
	return { document, links: descendants(document, node => node.nodeName === "a").map(node => ({ label: clean(stateHtmlText(node)), url: new URL(attribute(node, "href"), url).href })) };
}
function offeredArticles(pages: Page[]) {
	const result = new Map<string, string>();
	let expected = daneDiscoveryUrl;
	if (!pages.length || pages.length > 3) throw new Error("The Dane news inventory exceeds its bounds.");
	for (const [index, page] of pages.entries()) {
		if (page.url !== expected || danePolicyFingerprint(Buffer.from(page.body), "links", page.url) !== danePolicyReceipts.newsLinks) throw new Error("The Dane news or legal inventory requires review.");
		const selected = links(page.body, page.url).links;
		for (const link of selected.filter(link => /general election information/iu.test(link.label))) {
			const date = articleDate(link.url);
			if (link.label !== `November ${Number(date.slice(8))}, ${date.slice(0, 4)} General Election Information`) throw new Error("The Dane offered election label requires review.");
			if (result.has(date) && result.get(date) !== link.url) throw new Error("The Dane election article is duplicated.");
			result.set(date, link.url);
		}
		const next = selected.filter(link => link.label === "Next »");
		if (next.length > 1 || (next[0] && next[0].url !== `${daneDiscoveryUrl}page/${index + 2}/`) || (index < pages.length - 1 ? !next.length : next.length)) throw new Error("The Dane offered news pagination requires review.");
		expected = next[0]?.url ?? "";
	}
	if (!result.size || result.size > 4) throw new Error("The Dane current/future election inventory requires review.");
	return [...result].sort(([first], [second]) => first.localeCompare(second));
}
function offeredDocuments(page: Page, date: string) {
	if (articleDate(page.url) !== date || danePolicyFingerprint(Buffer.from(page.body), "links", page.url) !== danePolicyReceipts.articleLinks) throw new Error("The Dane election article legal inventory requires review.");
	const parsed = links(page.body, page.url);
	if (descendants(parsed.document, node => node.nodeName === "h2" && attribute(node, "class").split(/\s+/u).includes("entry-title")).filter(node => clean(stateHtmlText(node)) === `November ${Number(date.slice(8))}, ${date.slice(0, 4)} General Election Information`).length !== 1) throw new Error("The Dane election article heading requires review.");
	const candidates = parsed.links.filter(link => /Sample-Nov-|Dane-County-Type-B-ToD-Notice/iu.test(`${link.label} ${link.url}`));
	const result: { kind: Role; url: string }[] = [];
	for (const link of candidates) {
		const matches = roles.filter((kind) => {
			try {
				validateDaneDocumentUrl(link.url, kind, date);
				return true;
			}
			catch { return false; }
		});
		if (matches.length !== 1 || result.some(item => item.kind === matches[0])) throw new Error("The Dane sample/notice inventory requires review.");
		result.push({ kind: matches[0]!, url: link.url });
	}
	return roles.flatMap(kind => result.filter(item => item.kind === kind));
}
function checkedPage(value: unknown, now: number): asserts value is Page {
	if (!exact(value, ["url", "body", "sha256", "retrievedAt"]) || typeof value.url !== "string" || typeof value.body !== "string" || hash(value.body) !== value.sha256 || typeof value.retrievedAt !== "string" || !Number.isFinite(Date.parse(value.retrievedAt)) || new Date(value.retrievedAt).toISOString() !== value.retrievedAt || Date.parse(value.retrievedAt) > now) throw new Error("The Dane page provenance requires review.");
}
function checkedPdf(value: unknown, url: string, now: number): asserts value is Pdf {
	if (!exact(value, ["url", "text", "sha256", "retrievedAt"]) || value.url !== url || typeof value.text !== "string" || Buffer.byteLength(value.text) > 4 * 1024 * 1024 || containsControlCharacters(value.text.replace(/[\r\n\t\f]/gu, "")) || typeof value.sha256 !== "string" || !/^[a-f0-9]{64}$/u.test(value.sha256) || typeof value.retrievedAt !== "string" || !Number.isFinite(Date.parse(value.retrievedAt)) || new Date(value.retrievedAt).toISOString() !== value.retrievedAt || Date.parse(value.retrievedAt) > now) throw new Error("The Dane PDF provenance requires review.");
}
export function readDaneDiscovery(body: string, now = Date.now()) {
	if (Buffer.byteLength(body) > 24 * 1024 * 1024) throw new Error("The Dane discovery exceeds its bounds.");
	const value: unknown = JSON.parse(body);
	if (!exact(value, ["schemaVersion", "type", "policies", "news", "articles", "documents"]) || value.schemaVersion !== 1 || value.type !== "dane-discovery" || JSON.stringify(value.policies) !== JSON.stringify(danePolicyReceipts) || !Array.isArray(value.news) || !Array.isArray(value.articles) || !Array.isArray(value.documents)) throw new Error("The Dane discovery contract requires review.");
	for (const page of [...value.news, ...value.articles]) checkedPage(page, now);
	const offered = offeredArticles(value.news as Page[]);
	if (offered.length !== value.articles.length) throw new Error("The Dane offered articles are incomplete.");
	const articles = value.articles;
	const capturedDocuments = value.documents;
	let documentIndex = 0;
	const elections = offered.map(([electionDate, url], index) => {
		const page = articles[index] as Page;
		if (page.url !== url) throw new Error("The Dane captured article order requires review.");
		const documents = offeredDocuments(page, electionDate).map((item) => {
			const captured = capturedDocuments[documentIndex++]!;
			checkedPdf(captured, item.url, now);
			return { ...item, sha256: captured.sha256 };
		});
		const election = { electionId: null, electionDate, pageUrl: url, daneDocuments: documents };
		validateDaneElection(election);
		return election;
	});
	if (documentIndex !== value.documents.length) throw new Error("The Dane captured PDF inventory requires review.");
	return { elections, documents: value.documents as Pdf[], index: value.news[0] as Page };
}
export async function fetchDaneCycleDiscovery(options: Options = {}) {
	const request = options.requestDocument ?? fetchRemoteSourceDocument;
	const sleep = options.sleep ?? (milliseconds => wait(milliseconds));
	const now = options.now ?? Date.now;
	let completed = false;
	async function get(url: string) {
		if (completed) await sleep(11000);
		const response = await request(url, { allowedHosts: [new URL(url).hostname], maxBytes: 2 * 1024 * 1024, timeoutMs: 25000 });
		completed = true;
		return response;
	}
	const townResponse = await get("https://townofdane.gov/robots.txt");
	if (townResponse.status !== 200 || hash(townResponse.body) !== danePolicyReceipts.townRobots) throw new Error("The Dane robots policy changed; review before collection.");
	const townRobots = electionDocumentRobotsPolicy(townResponse.body, ["amazonbot"]);
	async function getPage(url: string, policy = townRobots): Promise<Page> {
		if (!policy.allowed(url)) throw new Error("The Dane policy disallows the requested page.");
		const response = await get(url);
		if (response.status !== 200 || response.contentType !== "text/html") throw new Error("The Dane page access requires review.");
		return { url, body: new TextDecoder("utf-8", { fatal: true }).decode(response.body), sha256: hash(response.body), retrievedAt: new Date(now()).toISOString() };
	}
	const news: Page[] = [];
	const articles: Page[] = [];
	const documents: Pdf[] = [];
	let next = daneDiscoveryUrl;
	while (next) {
		if (news.length >= 3) throw new Error("The Dane news pagination exceeds its bounds.");
		const page = await getPage(next);
		news.push(page);
		if (danePolicyFingerprint(Buffer.from(page.body), "links", page.url) !== danePolicyReceipts.newsLinks) throw new Error("The Dane news legal inventory changed.");
		const offered = links(page.body, page.url).links.filter(link => link.label === "Next »");
		if (offered.length > 1 || (offered[0] && offered[0].url !== `${daneDiscoveryUrl}page/${news.length + 1}/`)) throw new Error("The Dane next-page control requires review.");
		next = offered[0]?.url ?? "";
	}
	const offered = offeredArticles(news);
	const redirectRobots = await get("https://www.townweb.com/robots.txt");
	if (redirectRobots.status !== 301 || redirectRobots.location !== "https://townweb.com/robots.txt" || redirectRobots.body.length) throw new Error("The reviewed Town Web canonical robots redirect changed.");
	const vendorResponse = await get("https://townweb.com/robots.txt");
	if (vendorResponse.status !== 200 || hash(vendorResponse.body) !== danePolicyReceipts.vendorRobots) throw new Error("The Town Web robots policy changed.");
	const vendor = electionDocumentRobotsPolicy(vendorResponse.body);
	if (!vendor.allowed("https://townweb.com/privacy-policy/")) throw new Error("The Town Web robots policy disallows its linked policy.");
	const redirectPrivacy = await get("https://www.townweb.com/privacy-policy/");
	if (redirectPrivacy.status !== 301 || redirectPrivacy.location !== "https://townweb.com/privacy-policy/" || redirectPrivacy.body.length) throw new Error("The reviewed Town Web canonical privacy redirect changed.");
	const privacy = await getPage("https://townweb.com/privacy-policy/", vendor);
	if (danePolicyFingerprint(Buffer.from(privacy.body), "main", privacy.url) !== danePolicyReceipts.vendorMain || danePolicyFingerprint(Buffer.from(privacy.body), "links", privacy.url) !== danePolicyReceipts.vendorLinks) throw new Error("The Town Web linked privacy or legal policy changed.");
	const cdnResponse = await get("https://cdn.townweb.com/robots.txt");
	if (cdnResponse.status !== 200 || hash(cdnResponse.body) !== danePolicyReceipts.cdnRobots) throw new Error("The Town Web document robots policy changed.");
	const cdn = electionDocumentRobotsPolicy(cdnResponse.body);
	const executable = options.extractor ? null : await resolveStateBallotPdfExtractor();
	for (const [date, url] of offered) {
		const page = await getPage(url);
		articles.push(page);
		for (const item of offeredDocuments(page, date)) {
			if (!cdn.allowed(item.url)) throw new Error("The Town Web robots policy disallows this PDF.");
			await sleep(11000);
			documents.push(await fetchStateBallotPdfDocument(item.url, { allowedHosts: ["cdn.townweb.com"], request, now, extractor: bytes => options.extractor ? options.extractor(bytes) : extractStateBallotPdfText(bytes, executable!, 12000, "bbox-layout", 2) }));
		}
	}
	const body = JSON.stringify({ schemaVersion: 1, type: "dane-discovery", policies: danePolicyReceipts, news, articles, documents });
	readDaneDiscovery(body, now());
	return body;
}
export async function fetchDaneCandidateCapture(source: StateBallotSource, options: Options = {}) {
	validateDaneSource(source);
	const body = options.discovery ?? await fetchDaneCycleDiscovery(options);
	if (!readDaneDiscovery(body, (options.now ?? Date.now)()).elections.some(item => item.electionDate === source.electionDate && item.pageUrl === source.pageUrl)) throw new Error("The Dane election is not offered.");
	return JSON.stringify({ schemaVersion: 1, type: "dane-candidate-capture", discovery: JSON.parse(body), electionDate: source.electionDate });
}
export function parseDaneCandidateCapture(source: StateBallotSource, body: string, now = Date.now(), previous: readonly StateCandidateRecord[] = []) {
	validateDaneSource(source);
	if (Buffer.byteLength(body) > 24 * 1024 * 1024) throw new Error("The Dane candidate capture exceeds its bounds.");
	const value: unknown = JSON.parse(body);
	if (!exact(value, ["schemaVersion", "type", "discovery", "electionDate"]) || value.schemaVersion !== 1 || value.type !== "dane-candidate-capture" || value.electionDate !== source.electionDate) throw new Error("The Dane capture contract requires review.");
	const discovery = readDaneDiscovery(JSON.stringify(value.discovery), now);
	const election = discovery.elections.find(item => item.electionDate === source.electionDate && item.pageUrl === source.pageUrl);
	if (!election) throw new Error("The Dane captured election is not offered.");
	if (election.daneDocuments.length !== 4) throw new StateBallotAwaitingRecordsError(source.id);
	const records: StateCandidateRecord[] = [];
	const documents: { url: string; sha256: string; retrievedAt: string; includedRecordCount: number }[] = [];
	let shared: string | undefined;
	for (const item of election.daneDocuments) {
		const pdf = discovery.documents.find(document => document.url === item.url)!;
		const parsed = item.kind === "notice" ? readDaneCandidateNotice(source, pdf.text) : readDaneCandidateSample(source, pdf.text, item.kind);
		if (item.kind !== "notice") {
			const common = JSON.stringify(parsed.records.filter(item => ["statewide", "local"].includes(item.scope)));
			if (shared && common !== shared) throw new Error("The Dane samples disagree on shared statewide/county candidates.");
			shared = common;
		}
		else if (JSON.stringify(parsed.records.map(item => item.id).sort()) !== JSON.stringify(records.filter(item => ["state-senate", "state-house"].includes(item.scope)).map(item => item.id).sort())) {
			throw new Error("The Dane notice legislative inventory differs from its samples.");
		}
		let includedRecordCount = 0;
		for (const record of parsed.records) {
			const existing = records.find(item => item.id === record.id);
			if (existing && JSON.stringify(existing) !== JSON.stringify(record)) throw new Error("The Dane repeated candidate claims disagree.");
			if (!existing) {
				if (item.kind === "notice") throw new Error("The Dane notice and sample candidates disagree.");
				records.push(record);
				includedRecordCount++;
			}
		}
		documents.push({ url: pdf.url, sha256: pdf.sha256, retrievedAt: pdf.retrievedAt, includedRecordCount });
	}
	if (previous.some(record => !records.some(item => item.id === record.id))) throw new Error("An accepted Dane candidate disappeared or changed identity; retain accepted data for review.");
	return { records, retrievedAt: new Date(Math.min(...documents.map(item => Date.parse(item.retrievedAt)))).toISOString(), sha256: hash(JSON.stringify(documents.map(({ url, sha256 }) => ({ url, sha256 })))), documents, collectionIndexSha256: daneDocumentDigest(election.daneDocuments) };
}
