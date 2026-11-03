import type { fetchRemoteSourceDocument as RequestDocument } from "./remote-json-source.js";
import type { StateBallotTablePage } from "./state-ballot-pdf-grid.js";
import type { StateCandidateRecord } from "./state-ballot-records.js";
import type { StateBallotSource } from "./state-ballot-sources.js";
import { Buffer } from "node:buffer";
import { electionDocumentPolicyFingerprint, electionDocumentRobotsPolicy } from "./election-document-collection.js";
import { fetchRemoteSourceDocument } from "./remote-json-source.js";
import { bucksExact, bucksHash, bucksIndexUrl, bucksNoticeUrl, bucksOrigin, bucksReject, readBucksCandidateTables, validateBucksDocumentUrl, validateBucksSource, validBucksDate } from "./state-ballot-bucks.js";
import { stateHtmlAttribute as attribute, stateHtmlDescendants as descendants, parseStateHtml, stateHtmlText } from "./state-ballot-html.js";
import { extractStateBallotPdfTables } from "./state-ballot-pdf-grid.js";
import { extractStateBallotPdfText, resolveStateBallotPdfExtractor, resolveStateBallotPdfSvgExtractor } from "./state-ballot-pdf.js";
import { StateBallotAwaitingRecordsError } from "./state-ballot-source-state.js";

const maximumPageBytes = 2 * 1024 * 1024;
const clean = (value: string) => value.normalize("NFKC").replace(/\s+/gu, " ").trim();
const text = (node: Parameters<typeof stateHtmlText>[0]) => clean(stateHtmlText(node));
export function bucksPolicyFingerprint(body: Uint8Array, format: Parameters<typeof electionDocumentPolicyFingerprint>[1], address: string, regionId?: string) {
	if (body.byteLength > maximumPageBytes) return bucksReject();
	const normalized = new TextDecoder("utf-8", { fatal: true }).decode(body).replace(/href=(["'])(\/cdn-cgi\/l\/email-protection)#[a-f0-9]{6,2048}\1/giu, "href=$1$2$1");
	return electionDocumentPolicyFingerprint(Buffer.from(normalized), format, address, regionId);
}
export const bucksRobotsLayout = { restrictiveGroups: [{ agents: ["Baiduspider"], unrelated: true }, { agents: ["Yandex"], unrelated: true }, { agents: ["*"] }, { agents: ["Siteimprove"], unrelated: true }, { agents: ["Siteimprovebot"], unrelated: true }, { agents: ["Siteimprovebot-crawler"], unrelated: true }, { agents: ["meta-webindexer", "meta-externalagent", "OAI-SearchBot", "GPTBot", "ClaudeBot", "Claude-SearchBot", "PerplexityBot", "Amazonbot", "Bytespider", "CCBot", "cohere-ai", "Reflectionbot", "LinkupBot", "ExaSearchBot", "YouBot", "DuckAssistBot", "serpstatbot", "AhrefsBot", "SemrushBot", "MJ12bot", "DotBot"] }] } as const;
const policyPages = [
	{ id: "robots", url: `${bucksOrigin}/robots.txt`, format: "robots", sha256: "a9ddf1842cfd17cc3dcd5794e090689be3610b75ef8eddfb68390e3f436cb3f7" },
	{ id: "copyright", url: `${bucksOrigin}/copyright`, format: "region", region: "contentarea", sha256: "170135ed43030dc6cfd935607f07841660b905ca83a0d6e86c760bbbe086bbb5", links: "f2b9dc455b75fcfe4d619b832462693a516aff6ccfd57130cbf2559933f60fbc" },
	{ id: "privacy", url: `${bucksOrigin}/privacy`, format: "region", region: "mainWrapTS", sha256: "2c5e8ea0639684fdddc8cc6b32c16632c7a92e0e1630cacd757aefbe45d8e632", links: "f2b9dc455b75fcfe4d619b832462693a516aff6ccfd57130cbf2559933f60fbc" }
] as const;
export const bucksPolicyReceipts = policyPages.map(({ id, url, sha256 }) => ({ id, url, sha256 }));
interface Page { url: string; body: string; sha256: string; retrievedAt: string }
interface Document { url: string; sha256: string; retrievedAt: string; tables: StateBallotTablePage[]; redirect: { url: string; status: 301; location: string; retrievedAt: string } | null }
export interface BucksElection { electionId: null; electionDate: string; pageUrl: string | null; bucksContentSha256: string | null }
interface Capture { schemaVersion: 1; type: "bucks-candidate-capture"; policies: typeof bucksPolicyReceipts; index: Page; notice: Page; document: Document | null }

function timestamp(value: unknown, now: number) {
	if (typeof value !== "string" || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value || Date.parse(value) > now) return bucksReject();
	return value;
}

function main(body: string, url: string, links: string) {
	if (Buffer.byteLength(body) > maximumPageBytes || bucksPolicyFingerprint(Buffer.from(body), "links", url) !== links) return bucksReject();
	const regions = descendants(parseStateHtml(body), node => attribute(node, "id") === "mainWrapTS");
	if (regions.length !== 1) return bucksReject();
	return regions[0]!;
}

function offered(index: string, notice: string) {
	const noticeRegion = main(notice, bucksNoticeUrl, "f2b9dc455b75fcfe4d619b832462693a516aff6ccfd57130cbf2559933f60fbc");
	const dates = descendants(noticeRegion, node => node.nodeName === "a").map(node => /^UMOVA Notice for the November ([2-8]), (20\d{2}) General Election$/u.exec(text(node))).filter(match => match !== null);
	const paragraph = /The County of Bucks announces that the General Election will be held on November ([2-8])\s*,\s*(20\d{2})\s*\./u.exec(text(noticeRegion));
	if (dates.length !== 1 || !paragraph || dates[0]![1] !== paragraph[1] || dates[0]![2] !== paragraph[2]) return bucksReject();
	const electionDate = `${paragraph[2]}-11-0${paragraph[1]}`;
	if (!validBucksDate(electionDate)) return bucksReject();
	const region = main(index, bucksIndexUrl, "f2b9dc455b75fcfe4d619b832462693a516aff6ccfd57130cbf2559933f60fbc");
	const headings = descendants(region, node => node.nodeName === "h1" && attribute(node, "id") === "versionHeadLine");
	if (headings.length !== 1 || text(headings[0]!) !== "Running For Office") return bucksReject();
	const links = descendants(region, node => node.nodeName === "a" && /General Election.*Candidate Listing/u.test(text(node)));
	const selected: string[] = [];
	for (const link of links) {
		const match = /^(20\d{2}) General Election (?:Unofficial|Official) Candidate Listing(?: - Updated \d{2}\.\d{2}\.\d{4})?$/u.exec(text(link));
		if (!match || Number(match[1]) > Number(paragraph[2])) return bucksReject();
		if (match[1] !== paragraph[2]) continue;
		const url = new URL(attribute(link, "href"), bucksIndexUrl).href;
		validateBucksDocumentUrl(url, electionDate);
		selected.push(url);
	}
	if (selected.length > 1) return bucksReject();
	return { electionDate, offeredUrl: selected[0] ?? null };
}

export function validateBucksElection(value: unknown): asserts value is BucksElection {
	if (!bucksExact(value, ["electionId", "electionDate", "pageUrl", "bucksContentSha256"]) || value.electionId !== null || typeof value.electionDate !== "string" || !validBucksDate(value.electionDate)) return bucksReject();
	if (value.pageUrl === null) {
		if (value.bucksContentSha256 !== null) return bucksReject();
	}
	else {
		if (typeof value.pageUrl !== "string" || typeof value.bucksContentSha256 !== "string" || !/^[a-f\d]{64}$/u.test(value.bucksContentSha256)) return bucksReject();
		validateBucksDocumentUrl(value.pageUrl, value.electionDate);
	}
}

export function readBucksDiscovery(body: string, now = Date.now()) {
	if (Buffer.byteLength(body) > 10 * 1024 * 1024) return bucksReject();
	const value = JSON.parse(body);
	if (!bucksExact(value, ["schemaVersion", "type", "policies", "index", "notice", "document"]) || value.schemaVersion !== 1 || value.type !== "bucks-candidate-capture" || JSON.stringify(value.policies) !== JSON.stringify(bucksPolicyReceipts)) return bucksReject();
	for (const [name, url] of [["index", bucksIndexUrl], ["notice", bucksNoticeUrl]]) {
		const page = value[name!];
		if (!bucksExact(page, ["url", "body", "sha256", "retrievedAt"]) || page.url !== url || typeof page.body !== "string" || Buffer.byteLength(page.body) > maximumPageBytes || page.sha256 !== bucksHash(page.body)) return bucksReject();
		timestamp(page.retrievedAt, now);
	}
	const capture = value as unknown as Capture;
	const selected = offered(capture.index.body, capture.notice.body);
	const document = capture.document;
	if (selected.offeredUrl) {
		if (!bucksExact(document, ["url", "sha256", "retrievedAt", "tables", "redirect"]) || typeof document.url !== "string" || typeof document.sha256 !== "string" || !/^[a-f\d]{64}$/u.test(document.sha256)) return bucksReject();
		timestamp(document.retrievedAt, now);
		validateBucksDocumentUrl(document.url, selected.electionDate, selected.offeredUrl);
		if (document.url === selected.offeredUrl) {
			if (document.redirect !== null) return bucksReject();
		}
		else {
			const redirect = document.redirect;
			if (!bucksExact(redirect, ["url", "status", "location", "retrievedAt"]) || redirect.url !== selected.offeredUrl || redirect.status !== 301 || typeof redirect.location !== "string" || new URL(redirect.location, selected.offeredUrl).href !== document.url) return bucksReject();
			if (Date.parse(timestamp(redirect.retrievedAt, now)) > Date.parse(document.retrievedAt)) return bucksReject();
		}
		readBucksCandidateTables(document.tables);
	}
	else if (document !== null || selected.electionDate <= new Date(now).toISOString().slice(0, 10)) {
		return bucksReject();
	}
	const election: BucksElection = { electionId: null, electionDate: selected.electionDate, pageUrl: document?.url ?? null, bucksContentSha256: document?.sha256 ?? null };
	validateBucksElection(election);
	return { ...capture, election };
}

export function parseBucksCandidateCapture(source: StateBallotSource, body: string, factory: typeof import("./state-ballot-records.js").createStateCandidateRecord, now = Date.now(), previous?: { records: readonly StateCandidateRecord[] }) {
	validateBucksSource(source);
	const capture = readBucksDiscovery(body, now);
	if (source.electionDate !== capture.election.electionDate) return bucksReject();
	if (!capture.document) {
		if (previous?.records.length) return bucksReject();
		throw new StateBallotAwaitingRecordsError(source.id);
	}
	const parsed = readBucksCandidateTables(capture.document.tables);
	const records = parsed.claims.map(claim => factory(source, claim));
	if (records.some(record => !record) || new Set(records.map(record => record!.id)).size !== records.length || previous?.records.some(record => !records.some(candidate => candidate!.id === record.id))) return bucksReject();
	for (const record of records) {
		if (record!.office === "Governor / Lieutenant Governor") record!.ballotDesignation = "Joint ticket";
	}
	return { records: records as StateCandidateRecord[], retrievedAt: capture.document.retrievedAt, sha256: capture.document.sha256, collectionIndexSha256: capture.document.sha256, documents: [{ url: capture.document.url, sha256: capture.document.sha256, retrievedAt: capture.document.retrievedAt, includedRecordCount: records.length }] };
}

interface FetchOptions { requestDocument?: typeof RequestDocument; wait?: (milliseconds: number) => Promise<void>; now?: () => number; extractTables?: (body: Buffer) => Promise<StateBallotTablePage[]>; discovery?: string }

export async function fetchBucksCycleDiscovery(options: FetchOptions = {}) {
	const request = options.requestDocument ?? fetchRemoteSourceDocument;
	const wait = options.wait ?? (milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds)));
	const now = options.now ?? Date.now;
	let robots: ReturnType<typeof electionDocumentRobotsPolicy> | undefined;
	const get = async (url: string, pdf = false) => {
		if (robots) {
			if (!robots.allowed(url)) return bucksReject();
			await wait(Math.max(20_000, robots.delay));
		}
		const response = await request(url, { allowedHosts: ["www.buckscounty.gov"], maxBytes: pdf ? 8 * 1024 * 1024 : maximumPageBytes, timeoutMs: 25000 });
		if (!pdf && response.status !== 200) return bucksReject();
		return { response, url, sha256: bucksHash(response.body), retrievedAt: new Date(now()).toISOString() };
	};
	for (const policy of policyPages) {
		const page = await get(policy.url);
		if (bucksPolicyFingerprint(page.response.body, policy.format, policy.url, "region" in policy ? policy.region : undefined) !== policy.sha256 || ("links" in policy && bucksPolicyFingerprint(page.response.body, "links", policy.url) !== policy.links)) return bucksReject();
		if (policy.id === "robots") robots = electionDocumentRobotsPolicy(page.response.body, [], [], undefined, undefined, bucksRobotsLayout);
	}
	const noticePage = await get(bucksNoticeUrl);
	const indexPage = await get(bucksIndexUrl);
	const notice: Page = { url: bucksNoticeUrl, body: noticePage.response.body.toString("utf8"), sha256: noticePage.sha256, retrievedAt: noticePage.retrievedAt };
	const index: Page = { url: bucksIndexUrl, body: indexPage.response.body.toString("utf8"), sha256: indexPage.sha256, retrievedAt: indexPage.retrievedAt };
	const selected = offered(index.body, notice.body);
	let document: Document | null = null;
	if (selected.offeredUrl) {
		let page = await get(selected.offeredUrl, true);
		let redirect: Document["redirect"] = null;
		if (page.response.status === 301 && page.response.body.length === 0 && typeof page.response.location === "string") {
			const canonical = new URL(page.response.location, selected.offeredUrl).href;
			validateBucksDocumentUrl(canonical, selected.electionDate, selected.offeredUrl);
			if (canonical === selected.offeredUrl) return bucksReject();
			redirect = { url: selected.offeredUrl, status: 301, location: page.response.location, retrievedAt: page.retrievedAt };
			page = await get(canonical, true);
		}
		if (page.response.status !== 200 || !/^application\/pdf(?:;|$)/iu.test(page.response.contentType ?? "") || !page.response.body.subarray(0, 5).equals(Buffer.from("%PDF-"))) return bucksReject();
		const extract = options.extractTables ?? (async (bytes: Buffer) => {
			const textExecutable = await resolveStateBallotPdfExtractor();
			const svgExecutable = await resolveStateBallotPdfSvgExtractor();
			await extractStateBallotPdfText(bytes, textExecutable, undefined, "layout", 20);
			return extractStateBallotPdfTables(bytes, { textExecutable, svgExecutable });
		});
		document = { url: page.url, sha256: page.sha256, retrievedAt: page.retrievedAt, tables: await extract(page.response.body), redirect };
	}
	const body = JSON.stringify({ schemaVersion: 1, type: "bucks-candidate-capture", policies: bucksPolicyReceipts, index, notice, document });
	readBucksDiscovery(body, now());
	return body;
}

export async function fetchBucksCandidateCapture(source: StateBallotSource, options: FetchOptions = {}) {
	validateBucksSource(source);
	const body = options.discovery ?? await fetchBucksCycleDiscovery(options);
	if (readBucksDiscovery(body, (options.now ?? Date.now)()).election.electionDate !== source.electionDate) return bucksReject();
	return body;
}
