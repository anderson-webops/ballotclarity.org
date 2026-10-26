import type { EastGreenwichVisualProof } from "./state-ballot-east-greenwich-visual.js";
import type { StateCandidateRecord } from "./state-ballot-records.js";
import type { StateBallotSource } from "./state-ballot-sources.js";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { setTimeout as wait } from "node:timers/promises";
import { electionDocumentPolicyFingerprint } from "./election-document-collection.js";
import { fetchRemoteSourceDocument } from "./remote-json-source.js";
import { eastGreenwichRobotsPolicy, eastGreenwichRobotsSha256 } from "./state-ballot-east-greenwich-policy.js";
import { createEastGreenwichVisualProof, validateEastGreenwichVisualProof } from "./state-ballot-east-greenwich-visual.js";
import { readEastGreenwichCandidateSample } from "./state-ballot-east-greenwich.js";
import { stateHtmlAttribute as attribute, stateHtmlDescendants as descendants, parseStateHtml, stateHtmlText } from "./state-ballot-html.js";
import { extractStateBallotPdfSvg, extractStateBallotPdfText, resolveStateBallotPdfExtractor, resolveStateBallotPdfSvgExtractor } from "./state-ballot-pdf.js";
import { StateBallotAwaitingRecordsError } from "./state-ballot-source-state.js";
import { containsControlCharacters } from "./text-validation.js";

export const eastGreenwichDiscoveryUrl = "https://www.eastgreenwichri.gov/192/Voter-Registration-Elections";
const host = "www.eastgreenwichri.gov";
const hash = (body: string | Buffer) => createHash("sha256").update(body).digest("hex");
const exact = (value: unknown, keys: string[]): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).sort().join("|") === [...keys].sort().join("|"));
const clean = (value: string) => value.replace(/\s+/gu, " ").trim();
const precincts = ["0901", "0902", "0903", "0904", "0905"];
interface Page { url: string; body: string; sha256: string; retrievedAt: string }
interface Pdf { url: string; text: string; sha256: string; retrievedAt: string; visual: EastGreenwichVisualProof }
interface Options { requestDocument?: typeof fetchRemoteSourceDocument; extractor?: (bytes: Buffer) => Promise<string>; visualProof?: (bytes: Buffer, text: string, sha256: string, records: number) => Promise<EastGreenwichVisualProof>; now?: () => number; sleep?: (milliseconds: number) => Promise<void>; discovery?: string }
export interface EastGreenwichElection { electionId: null; electionDate: string; pageUrl: string; eastGreenwichDocuments: { precinct: string; url: string; sha256: string }[] }
export const eastGreenwichPolicyReceipts = {
	robots: eastGreenwichRobotsSha256,
	indexLinks: "20437f73e1a526d6c2325a6154a2b3bbf45c189c2c5c0cc8af13bf4df5e3b827",
	footer: "ab49034572419dfb0ac1e9fbfd0806a9a19dfd255be21499edf5cadf75809640",
	legalLinks: "b91879bf68e05421e79c3d9b5c6d9fab6133d9094114610f0cdb9abed4163212",
	accessibility: "88f4bb3ed1c096b138216dbb4392484f80759eab40d55a8745fa8fbaebb2387b",
	copyright: "556aab9ebaa22420b3e189e8af5027bdf92925ccd47bd8bc13a406867ba88705",
	privacy: "21affe9164031698e0f18c72e63eed72a68c601077700bd8f06f0760d472d29f",
} as const;

function validDate(value: unknown): value is string {
	return typeof value === "string" && /^20\d{2}-11-0[2-8]$/u.test(value) && value >= "2026-11-03" && Number(value.slice(0, 4)) % 2 === 0 && new Date(`${value}T00:00:00Z`).getUTCDay() === 2;
}
function sourceFor(electionDate: string): StateBallotSource {
	return { stateCode: "RI", id: electionDate === "2026-11-03" ? "ri-east-greenwich-2026" : `ri-east-greenwich-general-${electionDate}`, label: "East Greenwich general-election samples", electionDate, url: eastGreenwichDiscoveryUrl, pageUrl: eastGreenwichDiscoveryUrl, format: "east-greenwich-pdf", snapshotStorage: "external" };
}
export function validateEastGreenwichDocumentUrl(value: string, precinct: string) {
	const url = new URL(value);
	if (!/^09\d{2}$/u.test(precinct) || url.origin !== `https://${host}` || url.href !== value || url.username || url.password || url.search || url.hash || !new RegExp(`^/DocumentCenter/View/[1-9]\\d{0,8}/General-Election-Precinct-${precinct}-Sample-Ballot-PDF$`, "u").test(url.pathname)) throw new Error("The offered East Greenwich document requires review.");
}
export function validateEastGreenwichElection(value: unknown): asserts value is EastGreenwichElection {
	if (!exact(value, ["electionId", "electionDate", "pageUrl", "eastGreenwichDocuments"]) || value.electionId !== null || !validDate(value.electionDate) || value.pageUrl !== eastGreenwichDiscoveryUrl || !Array.isArray(value.eastGreenwichDocuments) || value.eastGreenwichDocuments.length > 20) throw new Error("The East Greenwich election configuration requires review.");
	const observed: string[] = [];
	for (const item of value.eastGreenwichDocuments) {
		if (!exact(item, ["precinct", "url", "sha256"]) || typeof item.precinct !== "string" || typeof item.url !== "string" || typeof item.sha256 !== "string" || !/^[a-f0-9]{64}$/u.test(item.sha256) || observed.includes(item.precinct)) throw new Error("The East Greenwich document configuration requires review.");
		validateEastGreenwichDocumentUrl(item.url, item.precinct);
		observed.push(item.precinct);
	}
	if (observed.length && (observed.length < 5 || !precincts.every(precinct => observed.includes(precinct)) || observed.join("|") !== [...observed].sort().join("|"))) throw new Error("The East Greenwich accepted precinct inventory requires review.");
}
export function validateEastGreenwichSource(source: StateBallotSource) {
	if (!validDate(source.electionDate) || source.stateCode !== "RI" || source.id !== sourceFor(source.electionDate).id || source.format !== "east-greenwich-pdf" || source.url !== eastGreenwichDiscoveryUrl || source.pageUrl !== eastGreenwichDiscoveryUrl || source.snapshotStorage !== "external" || source.retrievalPolicy || source.documentUrls || source.documentLinks || source.postBody || source.delimiter) throw new Error("The East Greenwich source contract requires review.");
}
export const eastGreenwichDocumentDigest = (documents: EastGreenwichElection["eastGreenwichDocuments"]) => hash(JSON.stringify(documents));
export function eastGreenwichPolicyFingerprint(body: Buffer, format: "links" | "region", url: string, region?: string, now = Date.now()) {
	let normalized = new TextDecoder("utf-8", { fatal: true }).decode(body);
	for (const pattern of [/(1997-)(20\d{2})(\s+CivicPlus\b)/gu, /(2006-)(20\d{2})(\s+East Greenwich, RI and its representatives\b)/gu]) {
		normalized = normalized.replace(pattern, (_match, beginning: string, year: string, owner: string) => {
			if (Number(year) < 2026 || Number(year) > new Date(now).getUTCFullYear()) throw new Error("The East Greenwich copyright year requires review.");
			return `${beginning}2026${owner}`;
		});
	}
	return electionDocumentPolicyFingerprint(Buffer.from(normalized), format, url, region);
}
function offered(body: string, now = Date.now()) {
	if (Buffer.byteLength(body) > 2 * 1024 * 1024 || containsControlCharacters(body.replace(/[\r\n\t]/gu, "")) || body.includes("\uFFFD")) throw new Error("The East Greenwich index exceeds its bounds.");
	const bytes = Buffer.from(body);
	if (eastGreenwichPolicyFingerprint(bytes, "links", eastGreenwichDiscoveryUrl, undefined, now) !== eastGreenwichPolicyReceipts.indexLinks || eastGreenwichPolicyFingerprint(bytes, "region", eastGreenwichDiscoveryUrl, "footerContainerTS", now) !== eastGreenwichPolicyReceipts.footer) throw new Error("The East Greenwich index or footer policy requires review.");
	const document = parseStateHtml(body);
	const sections = descendants(document, node => attribute(node, "class").split(/\s+/u).includes("relatedDocumentsSection"));
	const result: { electionDate: string; documents: { precinct: string; url: string }[] }[] = [];
	for (const section of sections) {
		const labels = descendants(section, node => node.nodeName === "h3").map(node => clean(stateHtmlText(node)));
		if (!labels.some(label => label.startsWith("Sample Ballots "))) continue;
		const match = labels.length === 1 ? /^Sample Ballots General Election November ([2-8]), (20\d{2})$/u.exec(labels[0]!) : null;
		const electionDate = match ? `${match[2]}-11-0${match[1]}` : "";
		if (!validDate(electionDate) || result.some(item => item.electionDate === electionDate)) throw new Error("The East Greenwich dated sample heading requires review.");
		const documents: { precinct: string; url: string }[] = [];
		for (const anchor of descendants(section, node => node.nodeName === "a")) {
			const label = clean(stateHtmlText(anchor));
			const item = /^General Election Precinct (09\d{2}) Sample Ballot \(PDF\)$/u.exec(label);
			if (!item) throw new Error("The East Greenwich offered sample label requires review.");
			const precinct = item[1]!;
			const url = new URL(attribute(anchor, "href"), eastGreenwichDiscoveryUrl).href;
			validateEastGreenwichDocumentUrl(url, precinct);
			if (documents.some(document => document.precinct === precinct || document.url === url)) throw new Error("The East Greenwich offered sample is duplicated.");
			documents.push({ precinct, url });
		}
		if (documents.length > 20) throw new Error("The East Greenwich style inventory exceeds its bounds.");
		result.push({ electionDate, documents: documents.length >= 5 && precincts.every(precinct => documents.some(item => item.precinct === precinct)) ? documents.sort((first, second) => first.precinct.localeCompare(second.precinct)) : [] });
	}
	if (!result.length || result.length > 4) throw new Error("The East Greenwich offered election inventory requires review.");
	return result.sort((first, second) => first.electionDate.localeCompare(second.electionDate));
}
function checkedTime(value: unknown, now: number): value is string {
	return typeof value === "string" && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value && Date.parse(value) <= now;
}
export function readEastGreenwichDiscovery(body: string, now = Date.now()) {
	if (Buffer.byteLength(body) > 32 * 1024 * 1024) throw new Error("The East Greenwich discovery exceeds its bounds.");
	const value: unknown = JSON.parse(body);
	if (!exact(value, ["schemaVersion", "type", "policies", "index", "documents"]) || value.schemaVersion !== 1 || value.type !== "east-greenwich-discovery" || JSON.stringify(value.policies) !== JSON.stringify(eastGreenwichPolicyReceipts) || !exact(value.index, ["url", "body", "sha256", "retrievedAt"]) || value.index.url !== eastGreenwichDiscoveryUrl || typeof value.index.body !== "string" || value.index.sha256 !== hash(value.index.body) || !checkedTime(value.index.retrievedAt, now) || !Array.isArray(value.documents)) throw new Error("The East Greenwich discovery contract requires review.");
	let documentIndex = 0;
	const captured = value.documents;
	const elections = offered(value.index.body, now).map((entry) => {
		const documents = entry.documents.map((item) => {
			const pdf: unknown = captured[documentIndex++];
			if (!exact(pdf, ["url", "text", "sha256", "retrievedAt", "visual"]) || pdf.url !== item.url || typeof pdf.text !== "string" || Buffer.byteLength(pdf.text) > 4 * 1024 * 1024 || typeof pdf.sha256 !== "string" || !/^[a-f0-9]{64}$/u.test(pdf.sha256) || !checkedTime(pdf.retrievedAt, now)) throw new Error("The East Greenwich PDF provenance requires review.");
			const parsed = readEastGreenwichCandidateSample(sourceFor(entry.electionDate), pdf.text, item.precinct);
			validateEastGreenwichVisualProof(pdf.text, pdf.visual, pdf.sha256, parsed.records.length);
			return { ...item, sha256: pdf.sha256 };
		});
		const election = { electionId: null, electionDate: entry.electionDate, pageUrl: eastGreenwichDiscoveryUrl, eastGreenwichDocuments: documents };
		validateEastGreenwichElection(election);
		return election;
	});
	if (documentIndex !== captured.length) throw new Error("The East Greenwich captured PDF inventory requires review.");
	return { elections, documents: captured as Pdf[], index: value.index as unknown as Page };
}
export async function fetchEastGreenwichCycleDiscovery(options: Options = {}) {
	const request = options.requestDocument ?? fetchRemoteSourceDocument;
	const sleep = options.sleep ?? (milliseconds => wait(milliseconds));
	const now = options.now ?? Date.now;
	let completed = false;
	async function get(url: string) {
		if (completed) await sleep(11000);
		const reply = await request(url, { allowedHosts: [host], maxBytes: 2 * 1024 * 1024, timeoutMs: 45000 });
		completed = true;
		return reply;
	}
	const response = await get(`https://${host}/robots.txt`);
	if (response.status !== 200) throw new Error("The East Greenwich robots request failed.");
	const robots = eastGreenwichRobotsPolicy(response.body);
	async function page(url: string): Promise<Page> {
		if (!robots.allowed(url)) throw new Error("The East Greenwich robots policy disallows this page.");
		const reply = await get(url);
		if (reply.status !== 200 || reply.contentType !== "text/html") throw new Error("The East Greenwich page access requires review.");
		return { url, body: new TextDecoder("utf-8", { fatal: true }).decode(reply.body), sha256: hash(reply.body), retrievedAt: new Date(now()).toISOString() };
	}
	const index = await page(eastGreenwichDiscoveryUrl);
	const elections = offered(index.body, now());
	for (const [name, path] of [["accessibility", "/accessibility"], ["copyright", "/site/copyright"], ["privacy", "/privacy"]] as const) {
		const policy = await page(`https://${host}${path}`);
		if (eastGreenwichPolicyFingerprint(Buffer.from(policy.body), "links", policy.url, undefined, now()) !== eastGreenwichPolicyReceipts.legalLinks || eastGreenwichPolicyFingerprint(Buffer.from(policy.body), "region", policy.url, "mainWrapTS", now()) !== eastGreenwichPolicyReceipts[name] || eastGreenwichPolicyFingerprint(Buffer.from(policy.body), "region", policy.url, "footerContainerTS", now()) !== eastGreenwichPolicyReceipts.footer) throw new Error("The East Greenwich linked policy changed; review before PDF collection.");
	}
	const documents: Pdf[] = [];
	let capturedBytes = Buffer.byteLength(JSON.stringify(index)) + 4096;
	for (const election of elections) {
		for (const item of election.documents) {
			if (!robots.allowed(item.url)) throw new Error("The East Greenwich robots policy disallows this PDF.");
			const reply = await get(item.url);
			if (reply.status !== 200 || reply.contentType !== "application/pdf" || !reply.body.subarray(0, 5).equals(Buffer.from("%PDF-"))) throw new Error("The East Greenwich PDF access requires review.");
			const sha256 = hash(reply.body);
			const retrievedAt = new Date(now()).toISOString();
			const text = options.extractor ? await options.extractor(reply.body) : await extractStateBallotPdfText(reply.body, await resolveStateBallotPdfExtractor(), 12000, "bbox-layout", 2);
			const parsed = readEastGreenwichCandidateSample(sourceFor(election.electionDate), text, item.precinct);
			const visual = options.visualProof ? await options.visualProof(reply.body, text, sha256, parsed.records.length) : createEastGreenwichVisualProof(text, await Promise.all([1, 2].map(async page => extractStateBallotPdfSvg(reply.body, await resolveStateBallotPdfSvgExtractor(), page))), sha256, parsed.records.length);
			validateEastGreenwichVisualProof(text, visual, sha256, parsed.records.length);
			const document = { url: item.url, text, sha256, retrievedAt, visual };
			capturedBytes += Buffer.byteLength(JSON.stringify(document));
			if (capturedBytes > 32 * 1024 * 1024 - 4096) throw new Error("The combined East Greenwich capture exceeds its bounds.");
			documents.push(document);
		}
	}
	const body = JSON.stringify({ schemaVersion: 1, type: "east-greenwich-discovery", policies: eastGreenwichPolicyReceipts, index, documents });
	readEastGreenwichDiscovery(body, now());
	return body;
}
export async function fetchEastGreenwichCandidateCapture(source: StateBallotSource, options: Options = {}) {
	validateEastGreenwichSource(source);
	const body = options.discovery ?? await fetchEastGreenwichCycleDiscovery(options);
	if (!readEastGreenwichDiscovery(body, (options.now ?? Date.now)()).elections.some(item => item.electionDate === source.electionDate)) throw new Error("The East Greenwich election is not offered.");
	return JSON.stringify({ schemaVersion: 1, type: "east-greenwich-candidate-capture", discovery: JSON.parse(body), electionDate: source.electionDate });
}
export function parseEastGreenwichCandidateCapture(source: StateBallotSource, body: string, now = Date.now(), previous: readonly StateCandidateRecord[] = []) {
	validateEastGreenwichSource(source);
	if (Buffer.byteLength(body) > 32 * 1024 * 1024) throw new Error("The East Greenwich capture exceeds its bounds.");
	const value: unknown = JSON.parse(body);
	if (!exact(value, ["schemaVersion", "type", "discovery", "electionDate"]) || value.schemaVersion !== 1 || value.type !== "east-greenwich-candidate-capture" || value.electionDate !== source.electionDate) throw new Error("The East Greenwich capture contract requires review.");
	const discovery = readEastGreenwichDiscovery(JSON.stringify(value.discovery), now);
	const election = discovery.elections.find(item => item.electionDate === source.electionDate);
	if (!election) throw new Error("The East Greenwich election is not offered.");
	if (!election.eastGreenwichDocuments.length) {
		if (previous.length) throw new Error("Accepted East Greenwich publications disappeared; retain records for review.");
		throw new StateBallotAwaitingRecordsError(source.id);
	}
	const records: StateCandidateRecord[] = [];
	const documents: { url: string; sha256: string; retrievedAt: string; includedRecordCount: number }[] = [];
	let common: string | undefined;
	for (const item of election.eastGreenwichDocuments) {
		const pdf = discovery.documents.find(document => document.url === item.url)!;
		const parsed = readEastGreenwichCandidateSample(source, pdf.text, item.precinct);
		const shared = JSON.stringify(parsed.records.filter(record => ["statewide", "local"].includes(record.scope)).sort((first, second) => first.id.localeCompare(second.id)));
		if (common && common !== shared) throw new Error("The East Greenwich shared statewide or town candidates disagree.");
		common = shared;
		let includedRecordCount = 0;
		for (const record of parsed.records) {
			const existing = records.find(item => item.id === record.id);
			if (existing && JSON.stringify(existing) !== JSON.stringify(record)) throw new Error("The repeated East Greenwich candidate claims disagree.");
			if (!existing) {
				records.push(record);
				includedRecordCount++;
			}
		}
		documents.push({ url: pdf.url, sha256: pdf.sha256, retrievedAt: pdf.retrievedAt, includedRecordCount });
	}
	if (previous.some(record => !records.some(item => item.id === record.id))) throw new Error("An accepted East Greenwich candidate disappeared; retain records for review.");
	return { records, documents, retrievedAt: new Date(Math.min(...documents.map(item => Date.parse(item.retrievedAt)))).toISOString(), sha256: hash(JSON.stringify(documents.map(({ url, sha256 }) => ({ url, sha256 })))), collectionIndexSha256: eastGreenwichDocumentDigest(election.eastGreenwichDocuments) };
}
