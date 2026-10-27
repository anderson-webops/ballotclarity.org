import type { verifyNycCandidatePdf as VerifyPdf } from "./state-ballot-nyc-worker.js";
import type { StateBallotSnapshot } from "./state-ballot-repository.js";
import type { StateBallotSource } from "./state-ballot-sources.js";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { setTimeout as wait } from "node:timers/promises";
import { fetchRemoteSourceDocument } from "./remote-json-source.js";
import { stateHtmlAttribute as attribute, stateHtmlDescendants as descendants, parseStateHtml, stateHtmlText } from "./state-ballot-html.js";
import { nycCandidateDiscoveryUrl, readNycCandidateIndex } from "./state-ballot-nyc-discovery.js";
import { inspectNycPdfFonts } from "./state-ballot-nyc-fonts.js";
import { nycNativePages } from "./state-ballot-nyc-native.js";
import { nycGeneralDate, nycPublicationDate, readNycCandidateDocument } from "./state-ballot-nyc.js";
import { StateBallotAwaitingRecordsError } from "./state-ballot-source-state.js";
import { containsControlCharacters } from "./text-validation.js";

export const nycDiscoveryUrl = nycCandidateDiscoveryUrl;
const origin = "https://www.vote.nyc";
export const nycRobotsSha256 = "2a787f20489a257692bad5f16ae5ceb28876cd38d8d9cde9c84a2d3835e30bab";
export const nycPolicySha256 = "53ae5a2607d2c70b929bd903bcd9f743a1e3d6fa13091ca606aa63a6dc374475";
const hash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const digest = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
const exact = (value: unknown, keys: string[]): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).sort().join(",") === [...keys].sort().join(","));
interface Page { url: string; body: string; sha256: string; retrievedAt: string }
interface Document { url: string; xml: string; objects: string; sha256: string; retrievedAt: string; proof: Awaited<ReturnType<typeof VerifyPdf>>["proof"] }
interface Options { request?: typeof fetchRemoteSourceDocument; now?: () => number; sleep?: (milliseconds: number) => Promise<void>; discovery?: string; analyze?: (bytes: Buffer, electionDate: string) => Promise<{ xml: string; objects: string; proof: Document["proof"] }>; onResponse?: (url: string, response: Awaited<ReturnType<typeof fetchRemoteSourceDocument>>) => Promise<void> }
export interface NycElection { electionId: null; electionDate: string; pageUrl: string; nycDocuments: { url: string; sha256: string }[] }

function reject(): never {
	throw new Error("The NYC managed candidate publication requires review.");
}
function validDate(value: unknown): value is string {
	if (typeof value !== "string" || value < "2026-11-03") return false;
	try {
		nycGeneralDate(value);
		return true;
	}
	catch {
		return false;
	}
}
export function nycSource(electionDate: string): StateBallotSource {
	if (!validDate(electionDate)) return reject();
	return { stateCode: "NY", id: electionDate === "2026-11-03" ? "ny-nyc-2026" : `ny-nyc-general-${electionDate}`, label: "New York City Board of Elections", electionDate, url: nycDiscoveryUrl, pageUrl: nycDiscoveryUrl, format: "nyc-pdf", snapshotStorage: "external", placeName: "New York city", defaultPriority: -20, scopeNotice: "Tentative list." };
}
export function validateNycSource(source: StateBallotSource) {
	const expected = nycSource(source.electionDate);
	if (Object.keys(source).sort().join(",") !== Object.keys(expected).sort().join(",") || Object.entries(expected).some(([key, value]) => source[key as keyof StateBallotSource] !== value)) return reject();
}
export function validateNycDocumentUrl(value: string, electionDate: string) {
	const url = new URL(value);
	const path = decodeURIComponent(url.pathname);
	if (!validDate(electionDate) || url.href !== value || url.origin !== origin || url.username || url.password || url.search || url.hash || !path.startsWith(`/sites/default/files/pdf/candidates/${electionDate.slice(0, 4)}/`) || !path.endsWith(".pdf") || path.length > 600 || path.includes("\\") || containsControlCharacters(path) || path.split("/").some(item => item === "." || item === "..")) return reject();
}
export function validateNycElection(value: unknown): asserts value is NycElection {
	if (!exact(value, ["electionId", "electionDate", "pageUrl", "nycDocuments"]) || value.electionId !== null || !validDate(value.electionDate) || value.pageUrl !== nycDiscoveryUrl || !Array.isArray(value.nycDocuments) || value.nycDocuments.length !== 1) return reject();
	const document = value.nycDocuments[0];
	if (!exact(document, ["url", "sha256"]) || typeof document.url !== "string" || !digest(document.sha256)) return reject();
	validateNycDocumentUrl(document.url, value.electionDate);
}
export const nycDocumentDigest = (documents: NycElection["nycDocuments"]) => hash(JSON.stringify(documents));
export function nycPolicyFingerprint(body: string) {
	if (Buffer.byteLength(body) > 2 * 1024 * 1024 || body.includes("\uFFFD")) return reject();
	const dom = parseStateHtml(body);
	const footers = descendants(dom, node => node.nodeName === "footer");
	if (footers.length !== 1) return reject();
	const text = (node: Parameters<typeof stateHtmlText>[0]) => stateHtmlText(node).replace(/\s+/gu, " ").trim();
	const links = (node: Parameters<typeof stateHtmlText>[0]) => descendants(node, child => child.nodeName === "a").map(child => [text(child), new URL(attribute(child, "href"), origin).href]);
	const legalLinks = descendants(dom, node => node.nodeName === "a" && /privacy|terms|copyright|licen[cs]e|disclaimer|polic(?:y|ies)/iu.test(`${text(node)} ${attribute(node, "href")}`)).map(node => [text(node), new URL(attribute(node, "href"), origin).href]);
	return hash(JSON.stringify({ footerTexts: footers.map(text), footerLinks: footers.map(links), legalLinks }));
}
function instant(value: unknown, now: number): value is string {
	return typeof value === "string" && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value && Date.parse(value) <= now;
}
function page(value: unknown, url: string, now: number): Page {
	if (!exact(value, ["url", "body", "sha256", "retrievedAt"]) || value.url !== url || typeof value.body !== "string" || Buffer.byteLength(value.body) > 2 * 1024 * 1024 || value.sha256 !== hash(value.body) || !instant(value.retrievedAt, now)) return reject();
	return value as unknown as Page;
}
export function readNycDiscovery(body: string, now = Date.now()) {
	if (Buffer.byteLength(body) > 24 * 1024 * 1024) return reject();
	const value: unknown = JSON.parse(body);
	if (!exact(value, ["schemaVersion", "type", "robots", "home", "index", "documents"]) || value.schemaVersion !== 1 || value.type !== "nyc-candidate-discovery" || !Array.isArray(value.documents) || value.documents.length > 6) return reject();
	const robots = page(value.robots, `${origin}/robots.txt`, now);
	if (robots.sha256 !== nycRobotsSha256) return reject();
	const home = page(value.home, `${origin}/`, now);
	const index = page(value.index, nycDiscoveryUrl, now);
	if (nycPolicyFingerprint(home.body) !== nycPolicySha256 || nycPolicyFingerprint(index.body) !== nycPolicySha256) return reject();
	const offered = readNycCandidateIndex(index.body).filter(item => item.electionDate >= "2026-11-03");
	if (offered.length !== value.documents.length) return reject();
	const documents = value.documents.map((item, position) => {
		const expected = offered[position]!;
		if (!exact(item, ["url", "xml", "objects", "sha256", "retrievedAt", "proof"]) || item.url !== expected.pdfUrl || typeof item.xml !== "string" || typeof item.objects !== "string" || !digest(item.sha256) || !instant(item.retrievedAt, now) || !exact(item.proof, ["schemaVersion", "type", "sourceSha256", "xmlSha256", "objectsSha256", "fonts", "pages"]) || item.proof.schemaVersion !== 1 || item.proof.type !== "nyc-native-verification" || item.proof.sourceSha256 !== item.sha256 || item.proof.xmlSha256 !== hash(item.xml) || item.proof.objectsSha256 !== hash(item.objects) || !Array.isArray(item.proof.pages)) return reject();
		validateNycDocumentUrl(item.url, expected.electionDate);
		if (JSON.stringify(inspectNycPdfFonts(item.objects)) !== JSON.stringify(item.proof.fonts)) return reject();
		const native = nycNativePages(item.xml);
		const proofs = item.proof.pages;
		if (native.length !== proofs.length || native[0]!.filter(field => field.text === `General Election ${expected.electionDate.slice(0, 4)} - 11/${expected.electionDate.slice(-2)}/${expected.electionDate.slice(0, 4)}`).length !== 1) return reject();
		for (const [index, fields] of native.entries()) {
			const proof = proofs[index];
			const columnLabelGlyphs = fields.filter(field => field.top >= 125 && field.top < 150 && ["Party\\Ind. Body", "Name", "Address"].includes(field.text)).reduce((sum, field) => sum + field.text.replace(/\s/gu, "").length, 0);
			const suffix = fields.filter(field => /^Proposal Number [1-9]\d?, a Question: .+ - Citywide, # to be elected: 1$/u.test(field.text)).length * ", # to be elected: 1".replace(/\s/gu, "").length;
			if (!exact(proof, ["page", "svgSha256", "fields", "nonspaceGlyphs", "fullInkClips", "clippedProposalSuffixGlyphs", "omittedProposalSuffixGlyphs", "intersectedColumnLabelGlyphs", "headerSeals", "rules"]) || proof.page !== index + 1 || !digest(proof.svgSha256) || proof.fields !== fields.length || proof.headerSeals !== Number(index > 0) || ["nonspaceGlyphs", "fullInkClips", "clippedProposalSuffixGlyphs", "omittedProposalSuffixGlyphs", "intersectedColumnLabelGlyphs", "rules"].some(key => !Number.isSafeInteger(proof[key]) || Number(proof[key]) < 0 || Number(proof[key]) > 40000) || Number(proof.nonspaceGlyphs) + Number(proof.omittedProposalSuffixGlyphs) !== fields.reduce((sum, field) => sum + field.text.replace(/\s/gu, "").length, 0) || Number(proof.omittedProposalSuffixGlyphs) + Number(proof.clippedProposalSuffixGlyphs) > suffix || Number(proof.intersectedColumnLabelGlyphs) > columnLabelGlyphs) return reject();
		}
		return item as unknown as Document;
	});
	const elections = documents.map((document, index) => ({ electionId: null, electionDate: offered[index]!.electionDate, pageUrl: nycDiscoveryUrl, nycDocuments: [{ url: document.url, sha256: document.sha256 }] } satisfies NycElection));
	for (const election of elections) validateNycElection(election);
	return { index, documents, elections };
}
export async function fetchNycCycleDiscovery(options: Options = {}) {
	const request = options.request ?? fetchRemoteSourceDocument;
	const now = options.now ?? Date.now;
	let first = true;
	async function get(url: string) {
		if (!first) await (options.sleep ?? wait)(1000);
		first = false;
		const response = await request(url, { allowedHosts: ["www.vote.nyc"], maxBytes: 12 * 1024 * 1024, timeoutMs: 30000 });
		await options.onResponse?.(url, response);
		if (response.status !== 200) return reject();
		return response;
	}
	async function text(url: string): Promise<Page> {
		const response = await get(url);
		if (response.body.length > 2 * 1024 * 1024 || !(url.endsWith("robots.txt") ? response.contentType === "text/plain" : response.contentType === "text/html")) return reject();
		return { url, body: new TextDecoder("utf-8", { fatal: true }).decode(response.body), sha256: hash(response.body), retrievedAt: new Date(now()).toISOString() };
	}
	const robots = await text(`${origin}/robots.txt`);
	if (robots.sha256 !== nycRobotsSha256) return reject();
	const home = await text(`${origin}/`);
	if (nycPolicyFingerprint(home.body) !== nycPolicySha256) return reject();
	const index = await text(nycDiscoveryUrl);
	if (nycPolicyFingerprint(index.body) !== nycPolicySha256) return reject();
	const offered = readNycCandidateIndex(index.body).filter(item => item.electionDate >= "2026-11-03");
	if (offered.length > 6) return reject();
	const documents: Document[] = [];
	for (const offer of offered) {
		const response = await get(offer.pdfUrl);
		const retrievedAt = new Date(now()).toISOString();
		if (response.contentType !== "application/pdf" || response.body.length > 12 * 1024 * 1024 || !response.body.subarray(0, 5).equals(Buffer.from("%PDF-"))) return reject();
		const verified = options.analyze
			? await options.analyze(response.body, offer.electionDate)
			: await (async () => {
					const { verifyNycCandidatePdf } = await import("./state-ballot-nyc-worker.js");
					const { createStateCandidateRecord } = await import("./state-ballot-records.js");
					const value = await verifyNycCandidatePdf(nycSource(offer.electionDate), response.body, createStateCandidateRecord);
					return { xml: value.xml, proof: value.proof, objects: value.objects };
				})();
		documents.push({ url: offer.pdfUrl, xml: verified.xml, objects: verified.objects, proof: verified.proof, sha256: hash(response.body), retrievedAt });
	}
	const body = JSON.stringify({ schemaVersion: 1, type: "nyc-candidate-discovery", robots, home, index, documents });
	readNycDiscovery(body, now());
	return body;
}
export async function fetchNycCandidateCapture(source: StateBallotSource, options: Options = {}) {
	validateNycSource(source);
	const discovery = options.discovery ?? await fetchNycCycleDiscovery(options);
	readNycDiscovery(discovery, (options.now ?? Date.now)());
	return JSON.stringify({ schemaVersion: 1, type: "nyc-candidate-capture", electionDate: source.electionDate, discovery: JSON.parse(discovery) });
}
export function nycCivilPublicationKey(value: string, electionDate: string) {
	const date = nycPublicationDate(value, electionDate);
	const time = / (\d{1,2}):([0-5]\d):([0-5]\d)(AM|PM)$/u.exec(value)!;
	const hour = Number(time[1]) % 12 + (time[4] === "PM" ? 12 : 0);
	return `${date}T${String(hour).padStart(2, "0")}:${time[2]}:${time[3]}`;
}
export function parseNycCandidateCapture(source: StateBallotSource, body: string, factory: typeof import("./state-ballot-records.js").createStateCandidateRecord, now = Date.now(), previous?: StateBallotSnapshot) {
	validateNycSource(source);
	if (Buffer.byteLength(body) > 24 * 1024 * 1024) return reject();
	const value: unknown = JSON.parse(body);
	if (!exact(value, ["schemaVersion", "type", "electionDate", "discovery"]) || value.schemaVersion !== 1 || value.type !== "nyc-candidate-capture" || value.electionDate !== source.electionDate) return reject();
	const discovery = readNycDiscovery(JSON.stringify(value.discovery), now);
	const position = discovery.elections.findIndex(election => election.electionDate === source.electionDate);
	if (position < 0) {
		if (previous?.records.length) return reject();
		throw new StateBallotAwaitingRecordsError(source.id);
	}
	const document = discovery.documents[position]!;
	const result = readNycCandidateDocument(source, document.xml, factory);
	if (result.asOfDate > document.retrievedAt.slice(0, 10) || (previous?.sourceAsOf && nycCivilPublicationKey(result.printedAt, source.electionDate) < nycCivilPublicationKey(previous.sourceAsOf, source.electionDate)) || previous?.records.some(record => !result.records.some(item => item.id === record.id)) || previous?.ballotQuestions?.some(question => !result.questions.some(item => item.id === question.id))) return reject();
	const documents = [{ url: document.url, sha256: document.sha256, retrievedAt: document.retrievedAt, includedRecordCount: result.records.length }];
	return { records: result.records, ballotQuestions: result.questions, sourceAsOfDate: result.asOfDate, sourceAsOf: result.printedAt, documents, retrievedAt: document.retrievedAt, sha256: hash(JSON.stringify(documents.map(({ url, sha256 }) => ({ url, sha256 })))), collectionIndexSha256: nycDocumentDigest(discovery.elections[position]!.nycDocuments) };
}
