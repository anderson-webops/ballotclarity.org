import type { StateBallotSnapshot } from "./state-ballot-repository.js";
import type { StateBallotSource } from "./state-ballot-sources.js";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { setTimeout as wait } from "node:timers/promises";
import { fetchRemoteSourceDocument } from "./remote-json-source.js";
import { inspectChicagoPdfFonts } from "./state-ballot-chicago-fonts.js";
import { chicagoNativePages } from "./state-ballot-chicago-native.js";
import { inspectChicagoVisual } from "./state-ballot-chicago-visual.js";
import { readChicagoBallotDocument } from "./state-ballot-chicago.js";
import { stateHtmlAttribute as attribute, stateHtmlDescendants as descendants, parseStateHtml, stateHtmlText } from "./state-ballot-html.js";
import { extractStateBallotPdfSvg, extractStateBallotPdfXml, inspectStateBallotPdfObjects, resolveStateBallotPdfObjectInspector, resolveStateBallotPdfSvgExtractor, resolveStateBallotPdfXmlExtractor } from "./state-ballot-pdf.js";
import { containsControlCharacters } from "./text-validation.js";

const origin = "https://chicagoelections.gov";
const blob = "https://cboeprod.blob.core.usgovcloudapi.net";
export const chicagoDiscoveryUrl = `${origin}/getting-ballot/candidates`;
export const chicagoRobotsSha256 = "4b36cd241043ffa252dd88e903deb6a1f02f3d76447b8a0209d52ef572a4911c";
export const chicagoPolicySha256 = "b3927531b33edf89d3ac4d6b51b5a0b5186c16dbe33fc09c4c63a36cbcab57aa";
const hash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const exact = (value: unknown, keys: string[]): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).sort().join("|") === [...keys].sort().join("|"));
const digest = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
const text = (node: Parameters<typeof stateHtmlText>[0]) => stateHtmlText(node).normalize("NFKC").replace(/\s+/gu, " ").trim();
interface Page { url: string; body: string; sha256: string; retrievedAt: string }
interface Document { kind: "general"; url: string; xml: string; objects: string; sha256: string; retrievedAt: string; visual: { pdfSha256: string; xmlSha256: string; objectsSha256: string; pages: ReturnType<typeof inspectChicagoVisual>[] } }
export interface ChicagoElection { electionId: null; electionDate: string; pageUrl: string; chicagoDocuments: { kind: "general"; url: string; sha256: string }[] }
interface Options { request?: typeof fetchRemoteSourceDocument; analyze?: (bytes: Buffer) => Promise<{ xml: string; objects: string; drawings: string[] }>; sleep?: (milliseconds: number) => Promise<void>; now?: () => number; discovery?: string }

function html(body: string) {
	if (Buffer.byteLength(body) > 2 * 1024 * 1024 || body.includes("\uFFFD")) throw new Error("The Chicago election page exceeds its bounds.");
	const document = parseStateHtml(body);
	const pending = [{ node: document, depth: 0 }];
	let visited = 0;
	while (pending.length) {
		const item = pending.pop()!;
		if (++visited > 80000 || item.depth > 64) throw new Error("The Chicago page structure requires review.");
		for (const child of item.node.childNodes ?? []) pending.push({ node: child, depth: item.depth + 1 });
	}
	return document;
}
export function chicagoPolicyFingerprint(body: string, now = Date.now()) {
	const document = html(body);
	const footers = descendants(document, node => node.nodeName === "footer");
	if (footers.length !== 1) throw new Error("The Chicago policy footer requires review.");
	const footer = text(footers[0]!);
	const notices = [...footer.matchAll(/Board of Election Commissioners for the City of Chicago © (20\d{2}) All Rights Reserved/gu)];
	if (notices.length !== 1 || Number(notices[0]![1]) < 2026 || Number(notices[0]![1]) > new Date(now).getUTCFullYear()) throw new Error("The Chicago copyright notice requires review.");
	const legal = descendants(document, node => node.nodeName === "a").flatMap((node) => {
		const href = attribute(node, "href");
		if (!href) return [];
		const url = new URL(href, chicagoDiscoveryUrl);
		return /privacy|terms|copyright|disclaimer|\blegal\b|licen[cs]e|\bpolic(?:y|ies)\b/iu.test(`${text(node)} ${url.pathname}`) ? [[text(node), url.href]] : [];
	});
	return hash(JSON.stringify({ footer: footer.replace(/© 20\d{2}/u, "© {year}"), legal: [...new Set(legal.map(value => JSON.stringify(value)))].sort() }));
}
function validDate(value: unknown): value is string {
	return typeof value === "string" && /^20\d{2}-11-0[2-8]$/u.test(value) && value >= "2026-11-03" && new Date(`${value}T00:00:00Z`).getUTCDay() === 2;
}
export function validateChicagoDocumentUrl(value: string) {
	const url = new URL(value);
	const filename = decodeURIComponent(url.pathname.split("/").at(-1)!);
	if (url.origin !== blob || url.username || url.password || url.search || url.hash || url.href !== value || !/^\/prod\/20\d{2}-(?:0[1-9]|1[0-2])\/[\w%(). -]{1,200}\.pdf$/u.test(url.pathname) || /[\\/]|\.\./u.test(filename) || containsControlCharacters(filename)) throw new Error("The offered Chicago document URL requires review.");
}
export function chicagoOfferedElections(body: string) {
	const offers = new Map<string, string>();
	for (const node of descendants(html(body), node => node.nodeName === "a")) {
		const label = text(node);
		const match = /^Click here for the full Candidate List for the November ([1-8]), (20\d{2}) General Election!$/u.exec(label);
		if (!match) continue;
		const electionDate = `${match[2]}-11-${match[1]!.padStart(2, "0")}`;
		if (!validDate(electionDate)) throw new Error("The Chicago offered election date requires review.");
		const url = new URL(attribute(node, "href"), chicagoDiscoveryUrl).href;
		validateChicagoDocumentUrl(url);
		if (offers.has(electionDate) && offers.get(electionDate) !== url) throw new Error("The Chicago full-list links are ambiguous.");
		offers.set(electionDate, url);
	}
	if (offers.size > 6) throw new Error("The Chicago election inventory exceeds its bounds.");
	return [...offers].sort(([left], [right]) => left.localeCompare(right)).map(([electionDate, url]) => ({ electionDate, url }));
}
export function validateChicagoElection(value: unknown): asserts value is ChicagoElection {
	if (!exact(value, ["electionId", "electionDate", "pageUrl", "chicagoDocuments"]) || value.electionId !== null || !validDate(value.electionDate) || value.pageUrl !== chicagoDiscoveryUrl || !Array.isArray(value.chicagoDocuments) || value.chicagoDocuments.length !== 1) throw new Error("The Chicago election configuration requires review.");
	const item = value.chicagoDocuments[0];
	if (!exact(item, ["kind", "url", "sha256"]) || item.kind !== "general" || typeof item.url !== "string" || !digest(item.sha256)) throw new Error("The Chicago document configuration requires review.");
	validateChicagoDocumentUrl(item.url);
}
export function validateChicagoSource(source: StateBallotSource) {
	if (source.stateCode !== "IL" || !validDate(source.electionDate) || source.id !== (source.electionDate === "2026-11-03" ? "il-chicago-2026" : `il-chicago-general-${source.electionDate}`) || source.format !== "chicago-pdf" || source.url !== chicagoDiscoveryUrl || source.pageUrl !== chicagoDiscoveryUrl || source.snapshotStorage !== "external" || source.retrievalPolicy || source.documentUrls || source.documentLinks || source.postBody || source.delimiter || source.countyName || source.placeName !== "Chicago city") throw new Error("The Chicago source identity requires review.");
}
export const chicagoDocumentDigest = (documents: ChicagoElection["chicagoDocuments"]) => hash(JSON.stringify(documents));
function instant(value: unknown, now: number): value is string {
	return typeof value === "string" && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value && Date.parse(value) <= now;
}
export function readChicagoDiscovery(body: string, now = Date.now()) {
	if (Buffer.byteLength(body) > 32 * 1024 * 1024) throw new Error("The Chicago capture exceeds its bounds.");
	const value: unknown = JSON.parse(body);
	if (!exact(value, ["schemaVersion", "type", "robotsSha256", "blobRobots", "index", "documents"]) || value.schemaVersion !== 1 || value.type !== "chicago-discovery" || value.robotsSha256 !== chicagoRobotsSha256 || !exact(value.index, ["url", "body", "sha256", "retrievedAt"]) || value.index.url !== chicagoDiscoveryUrl || typeof value.index.body !== "string" || value.index.sha256 !== hash(value.index.body) || !instant(value.index.retrievedAt, now) || chicagoPolicyFingerprint(value.index.body, now) !== chicagoPolicySha256 || !Array.isArray(value.documents) || value.documents.length > 6 || !exact(value.blobRobots, ["status", "sha256", "retrievedAt"]) || value.blobRobots.status !== 404 || value.blobRobots.sha256 !== hash("") || !instant(value.blobRobots.retrievedAt, now)) throw new Error("The Chicago discovery or policy receipt requires review.");
	const index = value.index as unknown as Page;
	const offered = chicagoOfferedElections(index.body);
	if (offered.length !== value.documents.length) throw new Error("The Chicago captured inventory disagrees with the offered full lists.");
	const documents = value.documents.map((item, position) => {
		const expected = offered[position]!;
		if (!exact(item, ["kind", "url", "xml", "objects", "sha256", "retrievedAt", "visual"]) || item.kind !== "general" || item.url !== expected.url || typeof item.xml !== "string" || typeof item.objects !== "string" || !digest(item.sha256) || !instant(item.retrievedAt, now) || !exact(item.visual, ["pdfSha256", "xmlSha256", "objectsSha256", "pages"]) || item.visual.pdfSha256 !== item.sha256 || item.visual.xmlSha256 !== hash(item.xml) || item.visual.objectsSha256 !== hash(item.objects) || !Array.isArray(item.visual.pages)) throw new Error("The Chicago captured PDF requires review.");
		inspectChicagoPdfFonts(item.objects);
		const pages = chicagoNativePages(item.xml);
		const visual = item.visual.pages;
		if (pages.length !== visual.length || pages.some((fields, page) => {
			const proof = visual[page];
			return !exact(proof, ["svgSha256", "fields", "visibleGlyphs", "ruleRectangles", "clippedEditorialGlyphs", "fullInkClips"]) || !digest(proof.svgSha256) || proof.fields !== fields.length || proof.visibleGlyphs !== fields.reduce((count, field) => count + field.text.replace(/\s/gu, "").length, 0) || ["ruleRectangles", "clippedEditorialGlyphs", "fullInkClips"].some(key => !Number.isSafeInteger(proof[key]) || Number(proof[key]) < 0 || Number(proof[key]) > 40000);
		})) {
			throw new Error("The Chicago rendered PDF proof requires review.");
		}
		return item as unknown as Document;
	});
	return { index, documents, elections: offered.map((offer, position) => ({ electionId: null, electionDate: offer.electionDate, pageUrl: chicagoDiscoveryUrl, chicagoDocuments: [{ kind: "general", url: offer.url, sha256: documents[position]!.sha256 }] } satisfies ChicagoElection)) };
}
async function analyze(bytes: Buffer) {
	const [xml, objects] = await Promise.all([extractStateBallotPdfXml(bytes, await resolveStateBallotPdfXmlExtractor(), "chicago"), inspectStateBallotPdfObjects(bytes, await resolveStateBallotPdfObjectInspector(), "chicago")]);
	inspectChicagoPdfFonts(objects);
	const count = chicagoNativePages(xml).length;
	const drawings: string[] = [];
	const executable = await resolveStateBallotPdfSvgExtractor();
	for (let page = 1; page <= count; page += 2) drawings.push(...await Promise.all(Array.from({ length: Math.min(2, count - page + 1) }, (_, index) => extractStateBallotPdfSvg(bytes, executable, page + index))));
	return { xml, objects, drawings };
}
export async function fetchChicagoCycleDiscovery(options: Options = {}) {
	const request = options.request ?? fetchRemoteSourceDocument;
	const now = options.now ?? Date.now;
	let requested = false;
	async function get(url: string) {
		if (requested) await (options.sleep ?? wait)(1000);
		requested = true;
		return request(url, { allowedHosts: [new URL(url).hostname], maxBytes: 12 * 1024 * 1024, timeoutMs: 30000 });
	}
	const robots = await get(`${origin}/robots.txt`);
	if (robots.status !== 200 || hash(robots.body) !== chicagoRobotsSha256) throw new Error("The Chicago robots policy changed; review before collection.");
	const reply = await get(chicagoDiscoveryUrl);
	if (reply.status !== 200 || reply.contentType !== "text/html") throw new Error("The Chicago candidate index is unavailable.");
	const index: Page = { url: chicagoDiscoveryUrl, body: new TextDecoder("utf-8", { fatal: true }).decode(reply.body), sha256: hash(reply.body), retrievedAt: new Date(now()).toISOString() };
	if (chicagoPolicyFingerprint(index.body, now()) !== chicagoPolicySha256) throw new Error("The Chicago index policy changed; review before PDF collection.");
	const policy = await get(`${blob}/robots.txt`);
	if (policy.status !== 404 || policy.body.length !== 0) throw new Error("The Chicago publication-host robots policy changed; review before collection.");
	const blobRobots = { status: 404, sha256: hash(policy.body), retrievedAt: new Date(now()).toISOString() };
	const documents: Document[] = [];
	for (const publication of chicagoOfferedElections(index.body)) {
		if (!options.analyze) await Promise.all([resolveStateBallotPdfXmlExtractor(), resolveStateBallotPdfObjectInspector(), resolveStateBallotPdfSvgExtractor()]);
		const pdf = await get(publication.url);
		if (pdf.status !== 200 || pdf.contentType !== "application/pdf" || pdf.body.length > 12 * 1024 * 1024 || !pdf.body.subarray(0, 5).equals(Buffer.from("%PDF-"))) throw new Error("The offered Chicago PDF is unavailable.");
		const result = await (options.analyze ?? analyze)(pdf.body);
		inspectChicagoPdfFonts(result.objects);
		if (chicagoNativePages(result.xml).length !== result.drawings.length) throw new Error("The Chicago rendered page inventory is incomplete.");
		documents.push({ kind: "general", url: publication.url, xml: result.xml, objects: result.objects, sha256: hash(pdf.body), retrievedAt: new Date(now()).toISOString(), visual: { pdfSha256: hash(pdf.body), xmlSha256: hash(result.xml), objectsSha256: hash(result.objects), pages: result.drawings.map((drawing, page) => inspectChicagoVisual(result.xml, drawing, page + 1)) } });
	}
	const body = JSON.stringify({ schemaVersion: 1, type: "chicago-discovery", robotsSha256: chicagoRobotsSha256, blobRobots, index, documents });
	readChicagoDiscovery(body, now());
	return body;
}
export async function fetchChicagoCandidateCapture(source: StateBallotSource, options: Options = {}) {
	validateChicagoSource(source);
	const body = options.discovery ?? await fetchChicagoCycleDiscovery(options);
	if (!readChicagoDiscovery(body, (options.now ?? Date.now)()).elections.some(election => election.electionDate === source.electionDate)) throw new Error("The Chicago election is not offered.");
	return JSON.stringify({ schemaVersion: 1, type: "chicago-candidate-capture", discovery: JSON.parse(body), electionDate: source.electionDate });
}
export function parseChicagoCandidateCapture(source: StateBallotSource, body: string, factory: typeof import("./state-ballot-records.js").createStateCandidateRecord, now = Date.now(), previous?: StateBallotSnapshot) {
	validateChicagoSource(source);
	if (Buffer.byteLength(body) > 32 * 1024 * 1024) throw new Error("The Chicago candidate capture exceeds its bounds.");
	const value: unknown = JSON.parse(body);
	if (!exact(value, ["schemaVersion", "type", "discovery", "electionDate"]) || value.schemaVersion !== 1 || value.type !== "chicago-candidate-capture" || value.electionDate !== source.electionDate) throw new Error("The Chicago candidate capture requires review.");
	const discovery = readChicagoDiscovery(JSON.stringify(value.discovery), now);
	const position = discovery.elections.findIndex(item => item.electionDate === source.electionDate);
	if (position < 0) throw new Error("The Chicago election is not offered.");
	const document = discovery.documents[position]!;
	const parsed = readChicagoBallotDocument(source, document.xml, factory);
	if (parsed.asOfDate > new Date(now).toISOString().slice(0, 10) || (previous?.sourceAsOfDate && parsed.asOfDate < previous.sourceAsOfDate)) throw new Error("The Chicago printed source date moved backward or into the future.");
	if (previous?.records.some(record => !parsed.records.some(item => item.id === record.id)) || previous?.ballotQuestions?.some(question => !parsed.questions.some(item => item.id === question.id))) throw new Error("An accepted Chicago candidate or question disappeared; retain the snapshot for review.");
	const documents = [{ url: document.url, sha256: document.sha256, retrievedAt: document.retrievedAt, includedRecordCount: parsed.records.length }];
	return { records: parsed.records, ballotQuestions: parsed.questions, sourceAsOfDate: parsed.asOfDate, sourceAsOf: parsed.asOf, documents, retrievedAt: document.retrievedAt, sha256: hash(JSON.stringify(documents.map(({ url, sha256 }) => ({ url, sha256 })))), collectionIndexSha256: chicagoDocumentDigest(discovery.elections[position]!.chicagoDocuments) };
}
