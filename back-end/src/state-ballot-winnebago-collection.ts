import type { StateCandidateRecord } from "./state-ballot-records.js";
import type { StateBallotSource } from "./state-ballot-sources.js";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { setTimeout as wait } from "node:timers/promises";
import { fetchRemoteSourceDocument } from "./remote-json-source.js";
import { stateHtmlAttribute as attribute, stateHtmlDescendants as descendants, parseStateHtml, stateHtmlText } from "./state-ballot-html.js";
import { extractStateBallotPdfSvg, extractStateBallotPdfXml, inspectStateBallotPdfObjects, resolveStateBallotPdfObjectInspector, resolveStateBallotPdfSvgExtractor, resolveStateBallotPdfXmlExtractor } from "./state-ballot-pdf.js";
import { StateBallotAwaitingRecordsError } from "./state-ballot-source-state.js";
import { inspectWinnebagoPdfFonts } from "./state-ballot-winnebago-fonts.js";
import { winnebagoNativePages } from "./state-ballot-winnebago-native.js";
import { inspectWinnebagoVisual } from "./state-ballot-winnebago-visual.js";
import { readWinnebagoWriteIns } from "./state-ballot-winnebago-write-ins.js";
import { readWinnebagoCandidateDocument } from "./state-ballot-winnebago.js";
import { containsControlCharacters } from "./text-validation.js";

const origin = "https://wincoil.gov";
export const winnebagoDiscoveryUrl = `${origin}/departments/clerks-office/election-information`;
export const winnebagoAccessibilityUrl = `${origin}/winnebago-county-accessibility-statement`;
export const winnebagoRobotsSha256 = "26544dbe89e8b9b6f2c1257447dd0f7832306dd5b5e144babf51599ec23ae9fc";
export const winnebagoPolicySha256 = "94f6ec0e453463aa26e4c23d71b620f511c0e156a5f934e78a04faa1a8d0b75f";
export const winnebagoAccessibilitySha256 = "f859a62b24189ceb1f9fbfd1e5d65665d8efd8ae85b28e73e337f5e1c2799644";
const hash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const exact = (value: unknown, keys: string[]): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).sort().join("|") === [...keys].sort().join("|"));
const digest = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
const text = (node: Parameters<typeof stateHtmlText>[0]) => stateHtmlText(node).normalize("NFKC").replace(/\s+/gu, " ").trim();
interface Page { url: string; body: string; sha256: string; retrievedAt: string }
interface Publication { kind: "candidates" | "write-ins"; url: string }
interface Document extends Publication { xml: string; objects: string; sha256: string; retrievedAt: string; visual: { pdfSha256: string; xmlSha256: string; objectsSha256: string; pages: ReturnType<typeof inspectWinnebagoVisual>[] } }
export interface WinnebagoElection { electionId: null; electionDate: string; pageUrl: string; winnebagoDocuments: (Publication & { sha256: string })[] }
interface Options {
	request?: typeof fetchRemoteSourceDocument;
	analyze?: (bytes: Buffer) => Promise<{ xml: string; objects: string; drawings: string[] }>;
	sleep?: (milliseconds: number) => Promise<void>;
	now?: () => number;
	discovery?: string;
}

function html(body: string) {
	if (Buffer.byteLength(body) > 2 * 1024 * 1024 || containsControlCharacters(body.replace(/[\r\n\t]/gu, "")) || body.includes("\uFFFD")) throw new Error("The Winnebago election page exceeds its bounds.");
	const document = parseStateHtml(body);
	const pending = [{ node: document, depth: 0 }];
	let visited = 0;
	while (pending.length) {
		const item = pending.pop()!;
		if (++visited > 80000 || item.depth > 64) throw new Error("The Winnebago election page structure requires review.");
		for (const child of item.node.childNodes ?? []) pending.push({ node: child, depth: item.depth + 1 });
	}
	return document;
}
export function winnebagoPolicyFingerprint(body: string, now = Date.now()) {
	const document = html(body);
	const copyrights = [...text(document).matchAll(/Copyright © (20\d{2}) Winnebago County\. All Rights Reserved\./gu)];
	if (copyrights.length !== 1 || Number(copyrights[0]![1]) < 2026 || Number(copyrights[0]![1]) > new Date(now).getUTCFullYear()) throw new Error("The Winnebago copyright notice requires review.");
	const legal = descendants(document, node => node.nodeName === "a").flatMap((node) => {
		const href = attribute(node, "href");
		if (!href) return [];
		const url = new URL(href, winnebagoDiscoveryUrl);
		const service = (url.pathname === "/how-do-i/apply-for/marriage-license" && text(node) === "Marriage License") || (url.pathname === "/how-do-i/apply-for/liquor-license-and-video-gaming" && text(node) === "Liquor License and Video Gaming");
		return !service && /privacy|terms|copyright|disclaimer|\blegal\b|accessibility|licen[cs]e|\bpolic(?:y|ies)\b/iu.test(`${text(node)} ${url.pathname}`) ? [[text(node), url.href]] : [];
	});
	return hash(JSON.stringify({ copyright: "Copyright © {year} Winnebago County. All Rights Reserved.", legal: [...new Set(legal.map(value => JSON.stringify(value)))].sort() }));
}
export function winnebagoAccessibilityFingerprint(body: string) {
	const components = descendants(html(body), node => attribute(node, "id") === "sp-component");
	if (components.length !== 1) throw new Error("The Winnebago accessibility policy region requires review.");
	const component = components[0]!;
	return hash(JSON.stringify({ text: text(component), links: descendants(component, node => node.nodeName === "a").map(node => [text(node), attribute(node, "href")]) }));
}
function validDate(value: unknown): value is string {
	return typeof value === "string" && /^20\d{2}-11-0[2-8]$/u.test(value) && value >= "2026-11-03" && new Date(`${value}T00:00:00Z`).getUTCDay() === 2;
}
export function validateWinnebagoDocumentUrl(value: string) {
	const url = new URL(value);
	if (url.origin !== origin || url.username || url.password || url.search || url.hash || url.href !== value || !/^\/media\/attachments\/20\d{2}\/(?:0[1-9]|1[0-2])\/(?:0[1-9]|[12]\d|3[01])\/[\w.-]{1,160}\.pdf$/u.test(url.pathname)) throw new Error("The offered Winnebago document URL requires review.");
}
function offered(body: string) {
	const document = html(body);
	const headings = descendants(document, node => /^h[1-4]$/u.test(node.nodeName)).map(node => text(node).toUpperCase()).filter(label => label.startsWith("NEXT ELECTION:"));
	if (headings.length !== 1) throw new Error("The Winnebago offered-election heading requires review.");
	const match = /^NEXT ELECTION: GENERAL ELECTION NOVEMBER ([1-8]), (20\d{2})$/u.exec(headings[0]!);
	if (!match) {
		if (/^NEXT ELECTION: (?:GENERAL PRIMARY|CONSOLIDATED(?: PRIMARY)?) ELECTION\b/u.test(headings[0]!)) return [];
		throw new Error("The Winnebago election date requires review.");
	}
	const electionDate = `${match[2]}-11-${match[1]!.padStart(2, "0")}`;
	if (!validDate(electionDate)) throw new Error("The Winnebago general-election date is invalid.");
	const publications: Publication[] = [];
	for (const kind of ["candidates", "write-ins"] as const) {
		const label = `${kind === "candidates" ? "Candidate List" : "Write-In Candidate List"} for November ${match[2]}`;
		const links = [...new Set(descendants(document, node => node.nodeName === "a" && text(node) === label).map(node => new URL(attribute(node, "href"), winnebagoDiscoveryUrl).href))];
		if (links.length > 1) throw new Error("The Winnebago publication controls are ambiguous.");
		if (links[0]) {
			validateWinnebagoDocumentUrl(links[0]);
			publications.push({ kind, url: links[0] });
		}
	}
	if (publications[0]?.kind === "write-ins") throw new Error("The Winnebago regular candidate list is unavailable.");
	return [{ electionDate, publications }];
}
export function validateWinnebagoElection(value: unknown): asserts value is WinnebagoElection {
	if (!exact(value, ["electionId", "electionDate", "pageUrl", "winnebagoDocuments"]) || value.electionId !== null || !validDate(value.electionDate) || value.pageUrl !== winnebagoDiscoveryUrl || !Array.isArray(value.winnebagoDocuments) || value.winnebagoDocuments.length > 2) throw new Error("The Winnebago election configuration requires review.");
	for (const [index, item] of value.winnebagoDocuments.entries()) {
		if (!exact(item, ["kind", "url", "sha256"]) || item.kind !== (index ? "write-ins" : "candidates") || typeof item.url !== "string" || !digest(item.sha256)) throw new Error("The Winnebago document configuration requires review.");
		validateWinnebagoDocumentUrl(item.url);
	}
}
export function validateWinnebagoSource(source: StateBallotSource) {
	if (source.stateCode !== "IL" || !validDate(source.electionDate) || source.id !== (source.electionDate === "2026-11-03" ? "il-winnebago-2026" : `il-winnebago-general-${source.electionDate}`) || source.format !== "winnebago-pdf" || source.url !== winnebagoDiscoveryUrl || source.pageUrl !== winnebagoDiscoveryUrl || source.snapshotStorage !== "external" || source.retrievalPolicy || source.documentUrls || source.documentLinks || source.postBody || source.delimiter) throw new Error("The Winnebago source identity requires review.");
}
export const winnebagoDocumentDigest = (documents: WinnebagoElection["winnebagoDocuments"]) => hash(JSON.stringify(documents));
function instant(value: unknown, now: number): value is string {
	return typeof value === "string" && Number.isFinite(Date.parse(value)) && Date.parse(value) <= now;
}
export function readWinnebagoDiscovery(body: string, now = Date.now()) {
	if (Buffer.byteLength(body) > 32 * 1024 * 1024) throw new Error("The Winnebago capture exceeds its bounds.");
	const value: unknown = JSON.parse(body);
	if (!exact(value, ["schemaVersion", "type", "robotsSha256", "accessibility", "index", "documents"]) || value.schemaVersion !== 1 || value.type !== "winnebago-discovery" || value.robotsSha256 !== winnebagoRobotsSha256 || !exact(value.index, ["url", "body", "sha256", "retrievedAt"]) || value.index.url !== winnebagoDiscoveryUrl || typeof value.index.body !== "string" || value.index.sha256 !== hash(value.index.body) || !instant(value.index.retrievedAt, now) || winnebagoPolicyFingerprint(value.index.body, now) !== winnebagoPolicySha256 || !Array.isArray(value.documents) || value.documents.length > 2 || !exact(value.accessibility, ["url", "sha256", "contentSha256", "retrievedAt"]) || value.accessibility.url !== winnebagoAccessibilityUrl || !digest(value.accessibility.sha256) || value.accessibility.contentSha256 !== winnebagoAccessibilitySha256 || !instant(value.accessibility.retrievedAt, now)) throw new Error("The Winnebago discovery or policy receipt requires review.");
	const index = value.index as unknown as Page;
	const elections = offered(index.body);
	const required = elections.flatMap(election => election.publications);
	if (required.length !== value.documents.length) throw new Error("The Winnebago captured publication inventory disagrees with its offered links.");
	const documents = value.documents.map((item, position) => {
		const expected = required[position]!;
		if (!exact(item, ["kind", "url", "xml", "objects", "sha256", "retrievedAt", "visual"]) || item.kind !== expected.kind || item.url !== expected.url || typeof item.xml !== "string" || typeof item.objects !== "string" || !digest(item.sha256) || !instant(item.retrievedAt, now) || !exact(item.visual, ["pdfSha256", "xmlSha256", "objectsSha256", "pages"]) || item.visual.pdfSha256 !== item.sha256 || item.visual.xmlSha256 !== hash(item.xml) || item.visual.objectsSha256 !== hash(item.objects) || !Array.isArray(item.visual.pages)) throw new Error("The Winnebago captured PDF requires review.");
		inspectWinnebagoPdfFonts(item.objects);
		const pages = winnebagoNativePages(item.xml);
		const visual = item.visual.pages;
		if (pages.length !== visual.length || pages.some((fields, page) => {
			const proof = visual[page];
			return !exact(proof, ["svgSha256", "fields", "visibleGlyphs", "underlines", "clippedContactGlyphs", "reviewedCandidateClips", "backgrounds"]) || !digest(proof.svgSha256) || proof.fields !== fields.length || proof.visibleGlyphs !== fields.reduce((count, field) => count + field.text.replace(/\s/gu, "").length, 0) || ["underlines", "clippedContactGlyphs", "reviewedCandidateClips", "backgrounds"].some(key => !Number.isSafeInteger(proof[key]) || Number(proof[key]) < 0 || Number(proof[key]) > 40000);
		})) {
			throw new Error("The Winnebago rendered PDF proof requires review.");
		}
		return item as unknown as Document;
	});
	return { index, documents, elections: elections.map(election => ({ electionId: null, electionDate: election.electionDate, pageUrl: winnebagoDiscoveryUrl, winnebagoDocuments: documents.map(({ kind, url, sha256 }) => ({ kind, url, sha256 })) } satisfies WinnebagoElection)) };
}
async function analyze(bytes: Buffer) {
	const xml = await extractStateBallotPdfXml(bytes, await resolveStateBallotPdfXmlExtractor());
	const objects = await inspectStateBallotPdfObjects(bytes, await resolveStateBallotPdfObjectInspector());
	inspectWinnebagoPdfFonts(objects);
	const drawings: string[] = [];
	for (let page = 1; page <= winnebagoNativePages(xml).length; page++) drawings.push(await extractStateBallotPdfSvg(bytes, await resolveStateBallotPdfSvgExtractor(), page));
	return { xml, objects, drawings };
}
export async function fetchWinnebagoCycleDiscovery(options: Options = {}) {
	const request = options.request ?? fetchRemoteSourceDocument;
	const now = options.now ?? Date.now;
	let requested = false;
	async function get(url: string) {
		if (requested) await (options.sleep ?? wait)(1000);
		requested = true;
		return request(url, { allowedHosts: ["wincoil.gov"], maxBytes: 12 * 1024 * 1024, timeoutMs: 30000 });
	}
	const robots = await get(`${origin}/robots.txt`);
	if (robots.status !== 200 || hash(robots.body) !== winnebagoRobotsSha256) throw new Error("The Winnebago robots policy changed; review before collection.");
	const reply = await get(winnebagoDiscoveryUrl);
	if (reply.status !== 200 || reply.contentType !== "text/html") throw new Error("The Winnebago election page is unavailable.");
	const index: Page = { url: winnebagoDiscoveryUrl, body: new TextDecoder("utf-8", { fatal: true }).decode(reply.body), sha256: hash(reply.body), retrievedAt: new Date(now()).toISOString() };
	if (winnebagoPolicyFingerprint(index.body, now()) !== winnebagoPolicySha256) throw new Error("The Winnebago index policy changed; review before PDF collection.");
	const policyReply = await get(winnebagoAccessibilityUrl);
	if (policyReply.status !== 200 || policyReply.contentType !== "text/html" || winnebagoAccessibilityFingerprint(new TextDecoder("utf-8", { fatal: true }).decode(policyReply.body)) !== winnebagoAccessibilitySha256) throw new Error("The Winnebago linked policy changed; review before PDF collection.");
	const accessibility = { url: winnebagoAccessibilityUrl, sha256: hash(policyReply.body), contentSha256: winnebagoAccessibilitySha256, retrievedAt: new Date(now()).toISOString() };
	const documents: Document[] = [];
	for (const election of offered(index.body)) {
		for (const publication of election.publications) {
			if (!options.analyze) await Promise.all([resolveStateBallotPdfXmlExtractor(), resolveStateBallotPdfObjectInspector(), resolveStateBallotPdfSvgExtractor()]);
			const pdf = await get(publication.url);
			if (pdf.status !== 200 || pdf.contentType !== "application/pdf" || pdf.body.length > 12 * 1024 * 1024 || !pdf.body.subarray(0, 5).equals(Buffer.from("%PDF-"))) throw new Error("The offered Winnebago PDF is unavailable.");
			const result = await (options.analyze ?? analyze)(pdf.body);
			inspectWinnebagoPdfFonts(result.objects);
			const pages = winnebagoNativePages(result.xml);
			if (pages.length !== result.drawings.length) throw new Error("The Winnebago rendered page inventory is incomplete.");
			documents.push({ ...publication, xml: result.xml, objects: result.objects, sha256: hash(pdf.body), retrievedAt: new Date(now()).toISOString(), visual: { pdfSha256: hash(pdf.body), xmlSha256: hash(result.xml), objectsSha256: hash(result.objects), pages: result.drawings.map((drawing, page) => inspectWinnebagoVisual(result.xml, drawing, page + 1)) } });
		}
	}
	const body = JSON.stringify({ schemaVersion: 1, type: "winnebago-discovery", robotsSha256: winnebagoRobotsSha256, accessibility, index, documents });
	readWinnebagoDiscovery(body, now());
	return body;
}
export async function fetchWinnebagoCandidateCapture(source: StateBallotSource, options: Options = {}) {
	validateWinnebagoSource(source);
	const body = options.discovery ?? await fetchWinnebagoCycleDiscovery(options);
	if (!readWinnebagoDiscovery(body, (options.now ?? Date.now)()).elections.some(election => election.electionDate === source.electionDate)) throw new Error("The Winnebago election is not offered.");
	return JSON.stringify({ schemaVersion: 1, type: "winnebago-candidate-capture", discovery: JSON.parse(body), electionDate: source.electionDate });
}
export function parseWinnebagoCandidateCapture(source: StateBallotSource, body: string, factory: typeof import("./state-ballot-records.js").createStateCandidateRecord, now = Date.now(), previous: readonly StateCandidateRecord[] = [], previousDocuments: readonly { url: string }[] = []) {
	validateWinnebagoSource(source);
	if (Buffer.byteLength(body) > 32 * 1024 * 1024) throw new Error("The Winnebago candidate capture exceeds its bounds.");
	const value: unknown = JSON.parse(body);
	if (!exact(value, ["schemaVersion", "type", "discovery", "electionDate"]) || value.schemaVersion !== 1 || value.type !== "winnebago-candidate-capture" || value.electionDate !== source.electionDate) throw new Error("The Winnebago candidate capture requires review.");
	const discovery = readWinnebagoDiscovery(JSON.stringify(value.discovery), now);
	const election = discovery.elections.find(item => item.electionDate === source.electionDate);
	if (!election) throw new Error("The Winnebago election is not offered.");
	if (previousDocuments.length > discovery.documents.length && previous.length) throw new Error("An accepted Winnebago publication disappeared; retain records for review.");
	if (!election.winnebagoDocuments.length) {
		if (previous.length) throw new Error("The accepted Winnebago publications disappeared; retain records for review.");
		throw new StateBallotAwaitingRecordsError(source.id);
	}
	const records: StateCandidateRecord[] = [];
	const documents: { url: string; sha256: string; retrievedAt: string; includedRecordCount: number }[] = [];
	const held: ReturnType<typeof readWinnebagoWriteIns>["held"] = [];
	for (const document of discovery.documents) {
		const parsed = document.kind === "candidates" ? readWinnebagoCandidateDocument(source, document.xml, factory) : readWinnebagoWriteIns(source, document.xml, factory);
		if ("held" in parsed) held.push(...parsed.held);
		records.push(...parsed.records);
		documents.push({ url: document.url, sha256: document.sha256, retrievedAt: document.retrievedAt, includedRecordCount: parsed.records.length });
	}
	if (new Set(records.map(record => record.id)).size !== records.length || previous.some(record => !records.some(item => item.id === record.id))) throw new Error("An accepted Winnebago candidate disappeared or was repeated; retain records for review.");
	return { records, documents, held, retrievedAt: new Date(Math.min(...documents.map(document => Date.parse(document.retrievedAt)))).toISOString(), sha256: hash(JSON.stringify(documents.map(({ url, sha256 }) => ({ url, sha256 })))), collectionIndexSha256: winnebagoDocumentDigest(election.winnebagoDocuments) };
}
