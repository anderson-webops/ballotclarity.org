import type { verifyOrangeCandidateProof as VerifyProof } from "./state-ballot-orange-worker.js";
import type { StateBallotSnapshot } from "./state-ballot-repository.js";
import type { StateBallotSource } from "./state-ballot-sources.js";
import { Buffer } from "node:buffer";
import { setTimeout as wait } from "node:timers/promises";
import { fetchRemoteSourceDocument } from "./remote-json-source.js";
import { parseStateHtml, stateHtmlAttribute, stateHtmlDescendants } from "./state-ballot-html.js";
import { orangeHash as hash, orangeDiscoveryUrl, orangeGeneralDate, orangeOrigin, orangePolicyFingerprint, orangePolicySha256, orangeRobotsSha256, readOrangeCandidateIndex, rejectOrange as reject, validateOrangeDocumentUrl, validateOrangeSource } from "./state-ballot-orange-discovery.js";
import { inspectOrangePdfFonts } from "./state-ballot-orange-fonts.js";
import { orangeProofPages, readOrangeCandidateProof } from "./state-ballot-orange-proof.js";
import { orangeCandidateRecords, orangePublicationKey } from "./state-ballot-orange-records.js";
import { StateBallotAwaitingRecordsError } from "./state-ballot-source-state.js";

const exact = (value: unknown, keys: string[]): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).sort().join(",") === [...keys].sort().join(","));
const digest = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
interface Page { url: string; body: string; sha256: string; retrievedAt: string }
type NativeProof = Awaited<ReturnType<typeof VerifyProof>>;
interface Document { url: string; status: 200 | 404; sha256: string; retrievedAt: string; xml?: string; objects?: string; proof?: NativeProof["proof"] }
interface Options { request?: typeof fetchRemoteSourceDocument; now?: () => number; sleep?: (milliseconds: number) => Promise<void>; discovery?: string; analyze?: (bytes: Buffer, electionDate: string) => Promise<Pick<NativeProof, "xml" | "objects" | "proof">>; onResponse?: (url: string, response: Awaited<ReturnType<typeof fetchRemoteSourceDocument>>) => Promise<void> }
export interface OrangeElection { electionId: null; electionDate: string; pageUrl: string; orangeDocuments: { url: string; sha256: string; status: 200 | 404 }[] }
export const orangeDocumentDigest = (documents: { url: string; sha256: string; status?: 200 | 404 }[]) => hash(JSON.stringify(documents.map(document => ({ url: document.url, sha256: document.sha256, status: document.status ?? 200 }))));

function instant(value: unknown, now: number): value is string {
	return typeof value === "string" && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value && Date.parse(value) <= now;
}
function page(value: unknown, url: string, now: number): Page {
	if (!exact(value, ["url", "body", "sha256", "retrievedAt"]) || value.url !== url || typeof value.body !== "string" || Buffer.byteLength(value.body) > 2 * 1024 * 1024 || value.sha256 !== hash(value.body) || !instant(value.retrievedAt, now)) return reject();
	return value as unknown as Page;
}
function offeredReports(body: string, retrievedAt: string) {
	const offered = readOrangeCandidateIndex(body).filter(item => item.electionDate >= "2026-11-03" && Date.parse(`${item.electionDate}T00:00:00Z`) + 2 * 86400000 > Date.parse(retrievedAt));
	if (offered.length > 6) return reject();
	return offered;
}
export function validateOrangeElection(value: unknown): asserts value is OrangeElection {
	if (!exact(value, ["electionId", "electionDate", "pageUrl", "orangeDocuments"]) || value.electionId !== null || typeof value.electionDate !== "string" || value.electionDate < "2026-11-03" || orangeGeneralDate(value.electionDate.slice(0, 4)) !== value.electionDate || value.pageUrl !== orangeDiscoveryUrl || !Array.isArray(value.orangeDocuments) || value.orangeDocuments.length !== 1) return reject();
	const document = value.orangeDocuments[0];
	if (!exact(document, ["url", "sha256", "status"]) || typeof document.url !== "string" || !digest(document.sha256) || (document.status !== 200 && document.status !== 404)) return reject();
	validateOrangeDocumentUrl(document.url, value.electionDate);
}
function verifyDocument(value: unknown, url: string, electionDate: string, now: number): Document {
	const available = Boolean(value && typeof value === "object" && "status" in value && value.status === 200);
	if (!exact(value, available ? ["url", "status", "sha256", "retrievedAt", "xml", "objects", "proof"] : ["url", "status", "sha256", "retrievedAt"]) || value.url !== url || !digest(value.sha256) || !instant(value.retrievedAt, now) || (value.status !== 200 && value.status !== 404)) return reject();
	validateOrangeDocumentUrl(url, electionDate);
	if (!available) return value as unknown as Document;
	if (typeof value.xml !== "string" || typeof value.objects !== "string" || !exact(value.proof, ["schemaVersion", "type", "sourceSha256", "xmlSha256", "objectsSha256", "fonts", "pages", "sourceDistrictLabelsApprovedForBallotMatching"])) return reject();
	const proof = value.proof;
	if (proof.schemaVersion !== 1 || proof.type !== "orange-native-verification" || proof.sourceSha256 !== value.sha256 || proof.xmlSha256 !== hash(value.xml) || proof.objectsSha256 !== hash(value.objects) || proof.sourceDistrictLabelsApprovedForBallotMatching !== false || JSON.stringify(inspectOrangePdfFonts(value.objects)) !== JSON.stringify(proof.fonts) || !Array.isArray(proof.pages)) return reject();
	const pages = orangeProofPages(value.xml);
	readOrangeCandidateProof(value.xml, electionDate);
	if (pages.length !== proof.pages.length) return reject();
	for (const [index, fields] of pages.entries()) {
		const item = proof.pages[index];
		if (!exact(item, ["page", "svgSha256", "fields", "nonspaceGlyphs", "fullInkClips", "captionStrokes", "clippedSourceDistrictLabels", "sourceDistrictLabelsApprovedForBallotMatching", "headerSeals"]) || item.page !== index + 1 || !digest(item.svgSha256) || item.fields !== fields.length || item.headerSeals !== Number(index === 0) || item.sourceDistrictLabelsApprovedForBallotMatching !== false || item.captionStrokes !== fields.filter(field => field.font === 5).length || !Array.isArray(item.clippedSourceDistrictLabels) || item.clippedSourceDistrictLabels.length > fields.length || ["nonspaceGlyphs", "fullInkClips"].some(key => !Number.isSafeInteger(item[key]) || Number(item[key]) < 0 || Number(item[key]) > 40000) || Number(item.fullInkClips) > Number(item.nonspaceGlyphs)) return reject();
		let omitted = 0;
		const positions = new Set<number>();
		for (const label of item.clippedSourceDistrictLabels) {
			if (!exact(label, ["left", "top", "visibleCharacters", "renderedCharacters", "sourceCharacters"]) || label.left !== 502 || typeof label.top !== "number" || positions.has(label.top)) return reject();
			const matching = fields.filter(field => field.left === 502 && field.top === label.top && field.font === 7);
			if (matching.length !== 1 || label.sourceCharacters !== matching[0]!.text.replace(/\s/gu, "").length || ["visibleCharacters", "renderedCharacters", "sourceCharacters"].some(key => !Number.isSafeInteger(label[key])) || Number(label.visibleCharacters) < 20 || Number(label.visibleCharacters) > Number(label.renderedCharacters) || Number(label.renderedCharacters) > Number(label.sourceCharacters)) return reject();
			positions.add(label.top);
			omitted += Number(label.sourceCharacters) - Number(label.renderedCharacters);
		}
		if (Number(item.nonspaceGlyphs) + omitted !== fields.reduce((sum, field) => sum + field.text.replace(/\s/gu, "").length, 0)) return reject();
	}
	return value as unknown as Document;
}
export function readOrangeDiscovery(body: string, now = Date.now()) {
	if (Buffer.byteLength(body) > 24 * 1024 * 1024) return reject();
	const value: unknown = JSON.parse(body);
	if (!exact(value, ["schemaVersion", "type", "robots", "home", "candidates", "index", "documents"]) || value.schemaVersion !== 1 || value.type !== "orange-candidate-discovery" || !Array.isArray(value.documents)) return reject();
	const robots = page(value.robots, `${orangeOrigin}/robots.txt`, now);
	if (robots.sha256 !== orangeRobotsSha256) return reject();
	const home = page(value.home, `${orangeOrigin}/`, now);
	const candidates = page(value.candidates, `${orangeOrigin}/candidates`, now);
	const index = page(value.index, orangeDiscoveryUrl, now);
	if ([home, candidates, index].some(item => orangePolicyFingerprint(item.body) !== orangePolicySha256) || !stateHtmlDescendants(parseStateHtml(candidates.body), node => node.nodeName === "a" && new URL(stateHtmlAttribute(node, "href"), orangeOrigin).href === orangeDiscoveryUrl).length) return reject();
	const offered = offeredReports(index.body, index.retrievedAt);
	if (value.documents.length !== offered.length) return reject();
	const documents = value.documents.map((item, index) => verifyDocument(item, offered[index]!.pdfUrl, offered[index]!.electionDate, now));
	const elections = documents.map((document, index) => ({ electionId: null, electionDate: offered[index]!.electionDate, pageUrl: orangeDiscoveryUrl, orangeDocuments: [{ url: document.url, sha256: document.sha256, status: document.status }] } satisfies OrangeElection));
	for (const election of elections) validateOrangeElection(election);
	return { index, documents, elections };
}
export async function fetchOrangeCycleDiscovery(options: Options = {}) {
	const request = options.request ?? fetchRemoteSourceDocument;
	const now = options.now ?? Date.now;
	let first = true;
	async function get(url: string) {
		if (!first) await (options.sleep ?? wait)(1000);
		first = false;
		const response = await request(url, { allowedHosts: ["ocvote.gov"], maxBytes: 12 * 1024 * 1024, timeoutMs: 30000 });
		await options.onResponse?.(url, response);
		return response;
	}
	async function text(url: string): Promise<Page> {
		const response = await get(url);
		if (response.status !== 200 || response.body.length > 2 * 1024 * 1024 || response.contentType !== (url.endsWith("robots.txt") ? "text/plain" : "text/html")) return reject();
		return { url, body: new TextDecoder("utf-8", { fatal: true }).decode(response.body), sha256: hash(response.body), retrievedAt: new Date(now()).toISOString() };
	}
	const robots = await text(`${orangeOrigin}/robots.txt`);
	if (robots.sha256 !== orangeRobotsSha256) return reject();
	const home = await text(`${orangeOrigin}/`);
	if (orangePolicyFingerprint(home.body) !== orangePolicySha256) return reject();
	const candidates = await text(`${orangeOrigin}/candidates`);
	if (orangePolicyFingerprint(candidates.body) !== orangePolicySha256) return reject();
	const index = await text(orangeDiscoveryUrl);
	if (orangePolicyFingerprint(index.body) !== orangePolicySha256) return reject();
	const offered = offeredReports(index.body, index.retrievedAt);
	const documents: Document[] = [];
	for (const offer of offered) {
		const response = await get(offer.pdfUrl);
		const receipt = { url: offer.pdfUrl, sha256: hash(response.body), retrievedAt: new Date(now()).toISOString() };
		if (response.status === 404 && response.body.length <= 2 * 1024 * 1024) {
			documents.push({ ...receipt, status: 404 });
			continue;
		}
		if (response.status !== 200 || response.contentType !== "application/pdf" || response.body.length > 12 * 1024 * 1024 || !response.body.subarray(0, 5).equals(Buffer.from("%PDF-"))) return reject();
		const verified = options.analyze
			? await options.analyze(response.body, offer.electionDate)
			: await (async () => {
					const { verifyOrangeCandidateProof } = await import("./state-ballot-orange-worker.js");
					return verifyOrangeCandidateProof(response.body, offer.electionDate);
				})();
		documents.push({ ...receipt, status: 200, xml: verified.xml, objects: verified.objects, proof: verified.proof });
	}
	const body = JSON.stringify({ schemaVersion: 1, type: "orange-candidate-discovery", robots, home, candidates, index, documents });
	readOrangeDiscovery(body, now());
	return body;
}
export async function fetchOrangeCandidateCapture(source: StateBallotSource, options: Options = {}) {
	validateOrangeSource(source);
	const discovery = options.discovery ?? await fetchOrangeCycleDiscovery(options);
	readOrangeDiscovery(discovery, (options.now ?? Date.now)());
	return JSON.stringify({ schemaVersion: 1, type: "orange-candidate-capture", electionDate: source.electionDate, discovery: JSON.parse(discovery) });
}
export function parseOrangeCandidateCapture(source: StateBallotSource, body: string, factory: typeof import("./state-ballot-records.js").createStateCandidateRecord, now = Date.now(), previous?: StateBallotSnapshot) {
	validateOrangeSource(source);
	if (Buffer.byteLength(body) > 24 * 1024 * 1024) return reject();
	const value: unknown = JSON.parse(body);
	if (!exact(value, ["schemaVersion", "type", "electionDate", "discovery"]) || value.schemaVersion !== 1 || value.type !== "orange-candidate-capture" || value.electionDate !== source.electionDate) return reject();
	const discovery = readOrangeDiscovery(JSON.stringify(value.discovery), now);
	const position = discovery.elections.findIndex(election => election.electionDate === source.electionDate);
	const document = discovery.documents[position];
	if (!document || document.status === 404) {
		if (previous?.records.length) return reject();
		throw new StateBallotAwaitingRecordsError(source.id);
	}
	const result = readOrangeCandidateProof(document.xml!, source.electionDate);
	const records = orangeCandidateRecords(source, result, factory);
	const sourceAsOf = result.printedClocks.map(clock => `${clock.date}T${clock.time}`).sort().at(-1)!;
	if (sourceAsOf.slice(0, 10) > document.retrievedAt.slice(0, 10) || sourceAsOf.slice(0, 10) > source.electionDate || (previous?.sourceAsOf && orangePublicationKey(sourceAsOf) < orangePublicationKey(previous.sourceAsOf)) || previous?.records.some(record => !records.some(item => item.id === record.id))) return reject();
	const documents = [{ url: document.url, sha256: document.sha256, retrievedAt: document.retrievedAt, includedRecordCount: records.length }];
	return { records, sourceAsOf, sourceAsOfDate: sourceAsOf.slice(0, 10), documents, retrievedAt: document.retrievedAt, sha256: hash(JSON.stringify(documents.map(({ url, sha256 }) => ({ url, sha256 })))), collectionIndexSha256: orangeDocumentDigest(discovery.elections[position]!.orangeDocuments) };
}
