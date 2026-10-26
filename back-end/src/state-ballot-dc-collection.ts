import type { fetchRemoteSourceDocument as RequestDocument } from "./remote-json-source.js";
import type { StateCandidateValues } from "./state-ballot-additional-records.js";
import type { StateCandidateRecord } from "./state-ballot-records.js";
import type { StateBallotSource } from "./state-ballot-sources.js";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { electionDocumentPolicyFingerprint } from "./election-document-collection.js";
import { fetchRemoteSourceDocument, fetchRemoteSourceText } from "./remote-json-source.js";
import { readDcCandidateDocuments } from "./state-ballot-dc.js";
import { stateHtmlAttribute as attribute, stateHtmlDescendants as descendants, parseStateHtml, stateHtmlText as text } from "./state-ballot-html.js";
import { extractStateBallotPdfText, fetchStateBallotPdfDocument, resolveStateBallotPdfExtractor } from "./state-ballot-pdf.js";
import { StateBallotAwaitingRecordsError } from "./state-ballot-source-state.js";

const origin = "https://dcboe.org";
export const dcDiscoveryUrl = `${origin}/`;
const accessibilityUrl = `${origin}/Accessibility`;
const footerHash = "1d132f942695f57f731fdbc4299281f8fac47cd16d545190531d4ff94fa26ba9";
export const dcPolicyReceipts = [
	{ url: `${origin}/robots.txt`, status: 404, sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855" },
	{ url: dcDiscoveryUrl, status: 200, region: "links", sha256: footerHash },
	{ url: accessibilityUrl, status: 200, region: "main-content", sha256: "cd269f51e6aadecd04ec6f4731839a646569b050f57daa96f193c6b07cb9f922" }
];
type Kind = "general" | "anc" | "write-ins";
interface Page { url: string; body: string; sha256: string; retrievedAt: string }
interface Pdf { url: string; text: string; sha256: string; retrievedAt: string }
export interface DcElection {
	electionId: null;
	electionDate: string;
	pageUrl: string;
	dcDocuments: { kind: Kind; url: string; sha256: string }[];
}
interface Options {
	requestDocument?: typeof RequestDocument;
	requestText?: (url: string, options: { allowedHosts: string[]; maxBytes: number; maxRedirects: number; timeoutMs: number }) => Promise<string>;
	extractor?: (bytes: Buffer) => Promise<string>;
	now?: () => number;
	sleep?: (milliseconds: number) => Promise<void>;
	discovery?: string;
}
const hash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const clean = (value: string) => value.replace(/\s+/gu, " ").trim();
const exact = (value: unknown, keys: string[]): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).sort().join("|") === [...keys].sort().join("|"));
const labels = ["General Election Candidates in Ballot Order", "Advisory Neighborhood Commission (ANC) Candidates in Ballot Order", "List of General Election Write-in Candidates"];
const kinds: Kind[] = ["general", "anc", "write-ins"];

function pageYear(url: string) {
	return /^https:\/\/dcboe\.org\/elections\/(20\d{2})-elections$/u.exec(url)?.[1];
}
function validDate(value: unknown): value is string {
	return typeof value === "string" && /^20\d{2}-11-0[2-8]$/u.test(value) && new Date(`${value}T00:00:00Z`).getUTCDay() === 2;
}
export function validateDcDocumentUrl(value: string, year?: string) {
	const parsed = new URL(value);
	if (parsed.origin !== origin || parsed.username || parsed.password || parsed.hash || parsed.search !== "?language=en" || !/^\/getContentAsset\/[a-f0-9-]{36}\/[a-f0-9-]{36}\/20\d{2}-General-(?:Election-)?(?:CANDIDATES|WRITE-IN-CANDIDATES)-\d{8}\.pdf$/u.test(parsed.pathname) || (year && !parsed.pathname.split("/").at(-1)!.startsWith(`${year}-`))) throw new Error("The D.C. offered publication URL requires review.");
}
export function validateDcElection(value: unknown): asserts value is DcElection {
	if (!exact(value, ["electionId", "electionDate", "pageUrl", "dcDocuments"]) || value.electionId !== null || !validDate(value.electionDate) || typeof value.pageUrl !== "string" || pageYear(value.pageUrl) !== value.electionDate.slice(0, 4) || !Array.isArray(value.dcDocuments) || ![0, 3].includes(value.dcDocuments.length)) throw new Error("The D.C. election configuration requires review.");
	for (const [index, document] of value.dcDocuments.entries()) {
		if (!exact(document, ["kind", "url", "sha256"]) || document.kind !== kinds[index] || typeof document.url !== "string" || typeof document.sha256 !== "string" || !/^[a-f0-9]{64}$/u.test(document.sha256)) throw new Error("The D.C. publication configuration requires review.");
		validateDcDocumentUrl(document.url, value.electionDate.slice(0, 4));
	}
	if (new Set(value.dcDocuments.map(document => document.url)).size !== value.dcDocuments.length) throw new Error("The D.C. publications are duplicated.");
}
export function validateDcSource(source: StateBallotSource) {
	validateDcElection({ electionId: null, electionDate: source.electionDate, pageUrl: source.pageUrl, dcDocuments: [] });
	if (source.stateCode !== "DC" || source.format !== "dc-pdf" || source.url !== source.pageUrl || source.snapshotStorage !== "external" || source.retrievalPolicy || source.postBody || source.documentUrls || source.documentLinks || source.countyName || source.id !== (source.electionDate === "2026-11-03" ? "dc-boe-2026" : `dc-general-${source.electionDate}`)) throw new Error("The D.C. source contract requires review.");
}
export function dcDocumentDigest(documents: DcElection["dcDocuments"]) {
	return hash(JSON.stringify(documents));
}
function checkedPage(value: unknown, now: number): Page {
	if (!exact(value, ["url", "body", "sha256", "retrievedAt"]) || typeof value.url !== "string" || typeof value.body !== "string" || Buffer.byteLength(value.body) > 2 * 1024 * 1024 || hash(value.body) !== value.sha256 || typeof value.retrievedAt !== "string" || !Number.isFinite(Date.parse(value.retrievedAt)) || new Date(value.retrievedAt).toISOString() !== value.retrievedAt || Date.parse(value.retrievedAt) > now || electionDocumentPolicyFingerprint(Buffer.from(value.body), "links", value.url) !== footerHash) throw new Error("The D.C. page provenance or legal inventory requires review.");
	return value as unknown as Page;
}
function offeredPages(body: string, now: number) {
	const urls = new Set<string>();
	for (const node of descendants(parseStateHtml(body), node => node.nodeName === "a")) {
		const year = /^(20\d{2}) Elections$/u.exec(clean(text(node)))?.[1];
		if (!year || Number(year) < new Date(now).getUTCFullYear()) continue;
		const url = new URL(attribute(node, "href"), dcDiscoveryUrl).href;
		if (pageYear(url) !== year) throw new Error("The D.C. offered election-year control changed.");
		urls.add(url);
	}
	if (!urls.size || urls.size > 6) throw new Error("The D.C. offered election-year set requires review.");
	return [...urls].sort();
}
function publications(page: Page) {
	const document = parseStateHtml(page.body);
	const mains = descendants(document, node => attribute(node, "id") === "main-content");
	if (mains.length !== 1 || descendants(mains[0]!, node => node.nodeName === "h2" && clean(text(node)) === `${pageYear(page.url)} Elections`).length !== 1) throw new Error("The D.C. election content region changed.");
	const events: { value: string; url?: string }[] = [];
	const visit = (node: (typeof mains)[number]) => {
		if (["script", "style", "form", "template", "noscript"].includes(node.nodeName)) return;
		if (node.nodeName === "a") {
			events.push({ value: clean(text(node)), url: new URL(attribute(node, "href"), page.url).href });
			return;
		}
		if (node.nodeName === "#text" && clean(node.value ?? "")) events.push({ value: clean(node.value!) });
		for (const child of node.childNodes ?? []) visit(child);
	};
	visit(mains[0]!);
	let electionDate = "";
	let selected = false;
	const result: { kind: Kind; url: string }[] = [];
	for (const event of events) {
		const date = /^GENERAL ELECTION - November ([1-9]\d?), (20\d{2})$/u.exec(event.value);
		if (date) {
			if (electionDate) throw new Error("The D.C. general election is duplicated.");
			electionDate = `${date[2]}-11-${date[1]!.padStart(2, "0")}`;
			selected = true;
		}
		else if (/^(?:PRIMARY|SPECIAL) ELECTION\b/u.test(event.value)) {
			selected = false;
		}
		if (!selected || !event.url) continue;
		const index = labels.indexOf(event.value);
		if (index < 0) {
			if (/candidate/iu.test(event.value)) throw new Error("A new D.C. candidate publication requires review.");
			continue;
		}
		validateDcDocumentUrl(event.url, pageYear(page.url));
		result.push({ kind: kinds[index]!, url: event.url });
	}
	if (!validDate(electionDate) || electionDate.slice(0, 4) !== pageYear(page.url) || new Set(result.map(item => item.kind)).size !== result.length || new Set(result.map(item => item.url)).size !== result.length) throw new Error("The D.C. general-election date or publications require review.");
	return { electionDate, documents: result.sort((first, second) => kinds.indexOf(first.kind) - kinds.indexOf(second.kind)) };
}
export function readDcDiscovery(body: string, now = Date.now()) {
	if (Buffer.byteLength(body) > 24 * 1024 * 1024) throw new Error("The D.C. discovery exceeds its bounds.");
	const value: unknown = JSON.parse(body);
	if (!exact(value, ["schemaVersion", "type", "policies", "accessibility", "index", "pages", "documents"]) || value.schemaVersion !== 1 || value.type !== "dc-discovery" || JSON.stringify(value.policies) !== JSON.stringify(dcPolicyReceipts) || !Array.isArray(value.pages) || !Array.isArray(value.documents) || value.pages.length !== value.documents.length) throw new Error("The D.C. discovery contract is invalid.");
	const index = checkedPage(value.index, now);
	const accessibility = checkedPage(value.accessibility, now);
	if (index.url !== dcDiscoveryUrl || accessibility.url !== accessibilityUrl || electionDocumentPolicyFingerprint(Buffer.from(accessibility.body), "region", accessibilityUrl, "main-content") !== dcPolicyReceipts[2]!.sha256) throw new Error("The D.C. linked accessibility policy changed.");
	const offered = offeredPages(index.body, now);
	if (value.pages.length !== offered.length) throw new Error("The D.C. offered election set is incomplete.");
	const documents: Pdf[][] = [];
	const elections: DcElection[] = [];
	for (const [position, raw] of value.pages.entries()) {
		const page = checkedPage(raw, now);
		if (page.url !== offered[position]) throw new Error("The D.C. captured year is not offered.");
		const publication = publications(page);
		const captured = value.documents[position];
		if (!Array.isArray(captured) || captured.length !== publication.documents.length) throw new Error("The D.C. publication capture is incomplete.");
		for (const [index, document] of captured.entries()) {
			if (!exact(document, ["url", "text", "sha256", "retrievedAt"]) || document.url !== publication.documents[index]!.url || typeof document.text !== "string" || Buffer.byteLength(document.text) > 4 * 1024 * 1024 || typeof document.sha256 !== "string" || !/^[a-f0-9]{64}$/u.test(document.sha256) || typeof document.retrievedAt !== "string" || !Number.isFinite(Date.parse(document.retrievedAt)) || new Date(document.retrievedAt).toISOString() !== document.retrievedAt || Date.parse(document.retrievedAt) > now || Date.parse(document.retrievedAt) < Date.parse(page.retrievedAt)) throw new Error("The D.C. PDF provenance requires review.");
		}
		documents.push(captured);
		const election: DcElection = { electionId: null, electionDate: publication.electionDate, pageUrl: page.url, dcDocuments: captured.length === 3 ? captured.map((item, index) => ({ kind: kinds[index]!, url: item.url, sha256: item.sha256 })) : [] };
		validateDcElection(election);
		elections.push(election);
	}
	return { index, accessibility, elections, documents };
}
export async function fetchDcCycleDiscovery(options: Options = {}) {
	const request = options.requestDocument ?? fetchRemoteSourceDocument;
	const sleep = options.sleep ?? (milliseconds => new Promise(accept => setTimeout(accept, milliseconds)));
	const now = options.now ?? Date.now;
	const robots = await request(dcPolicyReceipts[0]!.url, { allowedHosts: ["dcboe.org"], maxBytes: 2 * 1024 * 1024, timeoutMs: 25000 });
	if (robots.status !== 404 || hash(robots.body) !== dcPolicyReceipts[0]!.sha256) throw new Error("The D.C. public robots response requires review.");
	const getPage = async (url: string): Promise<Page> => {
		await sleep(11000);
		const body = await (options.requestText ?? fetchRemoteSourceText)(url, { allowedHosts: ["dcboe.org"], maxBytes: 2 * 1024 * 1024, maxRedirects: 0, timeoutMs: 25000 });
		return checkedPage({ url, body, sha256: hash(body), retrievedAt: new Date(now()).toISOString() }, now());
	};
	const index = await getPage(dcDiscoveryUrl);
	const accessibility = await getPage(accessibilityUrl);
	if (electionDocumentPolicyFingerprint(Buffer.from(accessibility.body), "region", accessibilityUrl, "main-content") !== dcPolicyReceipts[2]!.sha256) throw new Error("The D.C. linked policy requires review.");
	const pages: Page[] = [];
	const documents: Pdf[][] = [];
	const executable = options.extractor ? null : await resolveStateBallotPdfExtractor();
	for (const url of offeredPages(index.body, now())) {
		const page = await getPage(url);
		pages.push(page);
		const captured: Pdf[] = [];
		for (const item of publications(page).documents) {
			await sleep(11000);
			captured.push(await fetchStateBallotPdfDocument(item.url, { allowedHosts: ["dcboe.org"], request, now, extractor: bytes => options.extractor ? options.extractor(bytes) : extractStateBallotPdfText(bytes, executable!, 12000, "raw-bbox") }));
		}
		documents.push(captured);
	}
	const body = JSON.stringify({ schemaVersion: 1, type: "dc-discovery", policies: dcPolicyReceipts, accessibility, index, pages, documents });
	readDcDiscovery(body, now());
	return body;
}
export async function fetchDcCandidateCapture(source: StateBallotSource, options: Options = {}) {
	validateDcSource(source);
	const body = options.discovery ?? await fetchDcCycleDiscovery(options);
	const discovery = readDcDiscovery(body, (options.now ?? Date.now)());
	if (!discovery.elections.some(election => election.electionDate === source.electionDate && election.pageUrl === source.pageUrl)) throw new Error("The D.C. source is no longer offered.");
	return JSON.stringify({ schemaVersion: 1, type: "dc-candidate-capture", discovery: JSON.parse(body), electionDate: source.electionDate });
}
export function parseDcCandidateCapture(source: StateBallotSource, body: string, factory: (source: StateBallotSource, values: StateCandidateValues) => StateCandidateRecord | null, now = Date.now(), previousRecords: readonly StateCandidateRecord[] = []) {
	validateDcSource(source);
	if (Buffer.byteLength(body) > 24 * 1024 * 1024) throw new Error("The D.C. candidate capture exceeds its bounds.");
	const capture: unknown = JSON.parse(body);
	if (!exact(capture, ["schemaVersion", "type", "discovery", "electionDate"]) || capture.schemaVersion !== 1 || capture.type !== "dc-candidate-capture" || capture.electionDate !== source.electionDate) throw new Error("The D.C. candidate capture requires review.");
	const discovery = readDcDiscovery(JSON.stringify(capture.discovery), now);
	const index = discovery.elections.findIndex(election => election.electionDate === source.electionDate && election.pageUrl === source.pageUrl);
	if (index < 0) throw new Error("The D.C. captured election is not offered.");
	const election = discovery.elections[index]!;
	if (!election.dcDocuments.length) throw new StateBallotAwaitingRecordsError(source.id);
	const documents = discovery.documents[index]!;
	const parsed = readDcCandidateDocuments(source, documents.map(document => document.text), factory);
	const identity = (record: StateCandidateRecord) => JSON.stringify([record.name, record.office, record.district, record.jurisdiction ?? ""]);
	const current = new Set(parsed.records.map(identity));
	if (previousRecords.some(record => !current.has(identity(record)))) throw new Error("An accepted D.C. candidate disappeared without an explicit retained status; review the publication change.");
	return { records: parsed.records, retrievedAt: new Date(Math.min(...documents.map(document => Date.parse(document.retrievedAt)))).toISOString(), sha256: hash(JSON.stringify(documents.map(({ url, sha256 }) => ({ url, sha256 })))), documents: documents.map(({ url, sha256, retrievedAt }, position) => ({ url, sha256, retrievedAt, includedRecordCount: parsed.documentCounts[position]! })), collectionIndexSha256: dcDocumentDigest(election.dcDocuments) };
}
