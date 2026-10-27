import type { StateBallotQuestion } from "./state-ballot-questions.js";
import type { StateCandidateRecord } from "./state-ballot-records.js";
import type { StateBallotSource } from "./state-ballot-sources.js";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { setTimeout as wait } from "node:timers/promises";
import { fetchRemoteSourceDocument } from "./remote-json-source.js";
import { hamiltonGeneralDate, readHamiltonBallotDocument, readHamiltonPublicationDate } from "./state-ballot-hamilton.js";
import { stateHtmlAttribute as attribute, stateHtmlDescendants as descendants, parseStateHtml, stateHtmlText } from "./state-ballot-html.js";
import { StateBallotAwaitingRecordsError } from "./state-ballot-source-state.js";

export const hamiltonDiscoveryUrl = "https://elect.hamiltontn.gov/sampleballots.aspx";
const origin = "https://elect.hamiltontn.gov";
const hash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const exact = (value: unknown, keys: string[]): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).sort().join(",") === [...keys].sort().join(","));
interface Page {
	url: string;
	body: string;
	sha256: string;
	retrievedAt: string;
}
interface Options {
	requestDocument?: typeof fetchRemoteSourceDocument;
	sleep?: (milliseconds: number) => Promise<void>;
	now?: () => number;
	discovery?: string;
}
export interface HamiltonElection {
	electionId: null;
	electionDate: string;
	pageUrl: string;
	hamiltonDocuments: {
		url: string;
		sha256: string;
	}[];
}
export const hamiltonRobotsSha256 = "8fa3036c68bfcbd32365f6225d24333264093b7cd38d306e106b4dbdc934fd5b";
export const hamiltonPolicySha256 = "fe6e65fe9cebbde6ea0485e9212108fcd276263067e5b6d58366f7802672993b";
export const hamiltonNotices = [
	{ url: "https://elect.hamiltontn.gov/VoterInfo/OpenRecordsPolicyandRequestForm.aspx", sha256: "aeb034c06529b95016613ba9f3cf954af95457124d5c0376c071b1476fdd4fee" },
	{ url: "https://elect.hamiltontn.gov/VoterInfo/PublicCommentPolicy.aspx", sha256: "0c3e62ded666f70b4ce1e860fa2cf3b8ba616723728d19568884408b613fe38b" }
] as const;
export function hamiltonNoticeFingerprint(body: string, url: string) {
	if (Buffer.byteLength(body) > 2 * 1024 * 1024 || body.includes("\uFFFD")) return reject();
	const nodes = descendants(parseStateHtml(body), node => attribute(node, "id").endsWith("HtmlModule_lblContent"));
	if (nodes.length !== 1) return reject();
	const text = stateHtmlText(nodes[0]!).replace(/\s+/gu, " ").trim();
	const links = descendants(nodes[0]!, node => node.nodeName === "a").map((node) => {
		const target = new URL(attribute(node, "href"), url);
		if (target.pathname === "/cdn-cgi/l/email-protection") target.hash = "";
		return [stateHtmlText(node).replace(/\s+/gu, " ").trim(), target.href];
	});
	return hash(JSON.stringify({ text, links }));
}
function reject(): never {
	throw new Error("The Hamilton County collection contract requires review.");
}
export function hamiltonPolicyFingerprint(body: string, url: string) {
	if (Buffer.byteLength(body) > 2 * 1024 * 1024 || body.includes("\uFFFD"))
		return reject();
	const dom = parseStateHtml(body);
	const footers = descendants(dom, node => node.nodeName === "footer");
	if (footers.length !== 1)
		return reject();
	const text = (node: Parameters<typeof stateHtmlText>[0]) => stateHtmlText(node).replace(/\s+/gu, " ").trim();
	const legal = descendants(dom, node => node.nodeName === "a" && /privacy|disclaimer|copyright|licen[cs]e|terms|polic(?:y|ies)/iu.test(`${text(node)} ${attribute(node, "href")}`)).map(node => [text(node), new URL(attribute(node, "href"), url).href]);
	const footerLinks = descendants(footers[0]!, node => node.nodeName === "a").map((node) => {
		const target = new URL(attribute(node, "href"), url);
		if (target.origin !== origin || target.pathname !== "/login.aspx" || target.searchParams.size !== 1 || !target.searchParams.has("ReturnUrl"))
			return reject();
		return target.origin + target.pathname;
	});
	return hash(JSON.stringify({ footer: text(footers[0]!), footerLinks, legal: [...new Set(legal.map(pair => JSON.stringify(pair)))].sort() }));
}
export function validateHamiltonDocumentUrl(value: string) {
	const url = new URL(value);
	if (url.href !== value || url.origin !== origin || url.username || url.password || url.port || url.search || url.hash || !/^\/Portals\/12\/HTML\/[\w-]{1,100}\.html$/u.test(url.pathname))
		return reject();
}
export function readHamiltonOfferedPublication(body: string) {
	if (hamiltonPolicyFingerprint(body, hamiltonDiscoveryUrl) !== hamiltonPolicySha256)
		return reject();
	const dom = parseStateHtml(body);
	const links = descendants(dom, node => node.nodeName === "a" && /GENERAL ELECTION SAMPLE BALLOT/u.test(stateHtmlText(node).replace(/\s+/gu, " ").trim()));
	const urls = [...new Set(links.map(node => new URL(attribute(node, "href"), hamiltonDiscoveryUrl).href))];
	if (urls.length > 1 || links.some(node => stateHtmlText(node).replace(/\s+/gu, " ").trim() !== "📄 GENERIC GENERAL ELECTION SAMPLE BALLOT"))
		return reject();
	if (urls[0])
		validateHamiltonDocumentUrl(urls[0]);
	return urls[0] ?? null;
}
export function hamiltonSource(electionDate: string): StateBallotSource {
	return { stateCode: "TN", id: electionDate === "2026-11-03" ? "tn-hamilton-2026" : `tn-hamilton-general-${electionDate}`, label: "Hamilton County general-election sample", electionDate, url: hamiltonDiscoveryUrl, pageUrl: hamiltonDiscoveryUrl, format: "hamilton-html", snapshotStorage: "external", countyName: "Hamilton County", defaultPriority: -10, withheldDistrictScopes: ["congressional"], scopeNotice: "Hamilton County sample only; precinct eligibility is unverified." };
}
export function validateHamiltonSource(source: StateBallotSource) {
	const expected = hamiltonSource(source.electionDate);
	if (hamiltonGeneralDate(source.electionDate.slice(8), source.electionDate.slice(0, 4)) !== source.electionDate || source.id !== expected.id || source.stateCode !== "TN" || source.format !== "hamilton-html" || source.url !== hamiltonDiscoveryUrl || source.pageUrl !== hamiltonDiscoveryUrl || source.snapshotStorage !== "external" || source.countyName !== expected.countyName || source.retrievalPolicy || source.postBody || source.delimiter || source.documentUrls || source.documentLinks || JSON.stringify(source.withheldDistrictScopes) !== JSON.stringify(expected.withheldDistrictScopes) || source.withheldStatewideOffices)
		return reject();
}
export function validateHamiltonElection(value: unknown): asserts value is HamiltonElection {
	if (!exact(value, ["electionId", "electionDate", "pageUrl", "hamiltonDocuments"]) || value.electionId !== null || typeof value.electionDate !== "string" || value.pageUrl !== hamiltonDiscoveryUrl || !Array.isArray(value.hamiltonDocuments) || value.hamiltonDocuments.length !== 1)
		return reject();
	validateHamiltonSource(hamiltonSource(value.electionDate));
	const item = value.hamiltonDocuments[0];
	if (!exact(item, ["url", "sha256"]) || typeof item.url !== "string" || typeof item.sha256 !== "string" || !/^[a-f0-9]{64}$/u.test(item.sha256))
		return reject();
	validateHamiltonDocumentUrl(item.url);
}
export function hamiltonDocumentDigest(documents: readonly {
	url: string;
	sha256: string;
}[]) {
	return hash(JSON.stringify(documents.map(({ url, sha256 }) => ({ url, sha256 }))));
}
export function readHamiltonCandidateDiscovery(body: string, now = Date.now()) {
	if (Buffer.byteLength(body) > 8 * 1024 * 1024 || !Number.isFinite(now))
		return reject();
	const value: unknown = JSON.parse(body);
	if (!exact(value, ["schemaVersion", "type", "robots", "home", "index", "policies", "publication"]) || value.schemaVersion !== 1 || value.type !== "hamilton-candidate-discovery")
		return reject();
	function page(value: unknown, url: string): Page {
		if (!exact(value, ["url", "body", "sha256", "retrievedAt"]) || value.url !== url || typeof value.body !== "string" || Buffer.byteLength(value.body) > 2 * 1024 * 1024 || value.sha256 !== hash(value.body) || typeof value.retrievedAt !== "string" || !Number.isFinite(Date.parse(value.retrievedAt)) || new Date(value.retrievedAt).toISOString() !== value.retrievedAt || Date.parse(value.retrievedAt) > now)
			return reject();
		return value as unknown as Page;
	}
	const robots = page(value.robots, `${origin}/robots.txt`);
	const home = page(value.home, `${origin}/`);
	const index = page(value.index, hamiltonDiscoveryUrl);
	if (robots.sha256 !== hamiltonRobotsSha256 || hamiltonPolicyFingerprint(home.body, home.url) !== hamiltonPolicySha256)
		return reject();
	const url = readHamiltonOfferedPublication(index.body);
	if (!Array.isArray(value.policies) || value.policies.length !== hamiltonNotices.length) return reject();
	const policies = hamiltonNotices.map((notice, index) => {
		const captured = page((value.policies as unknown[])[index], notice.url);
		if (hamiltonNoticeFingerprint(captured.body, captured.url) !== notice.sha256) return reject();
		return captured;
	});
	if (!url) {
		if (value.publication !== null)
			return reject();
		return { index, elections: [] as HamiltonElection[], publication: null };
	}
	const publication = page(value.publication, url);
	if (Date.parse(publication.retrievedAt) < Math.max(...[index, home, robots, ...policies].map(page => Date.parse(page.retrievedAt))))
		return reject();
	const date = readHamiltonPublicationDate(publication.body);
	const source = hamiltonSource(date);
	readHamiltonBallotDocument(source, publication.body);
	const election = { electionId: null, electionDate: date, pageUrl: hamiltonDiscoveryUrl, hamiltonDocuments: [{ url, sha256: publication.sha256 }] };
	validateHamiltonElection(election);
	return { index, elections: [election], publication };
}
export async function fetchHamiltonCandidateDiscovery(options: Options = {}) {
	const request = options.requestDocument ?? fetchRemoteSourceDocument;
	const now = options.now ?? Date.now;
	const sleep = options.sleep ?? (milliseconds => wait(milliseconds));
	async function capture(url: string): Promise<Page> {
		const reply = await request(url, { allowedHosts: ["elect.hamiltontn.gov"], maxBytes: 2 * 1024 * 1024, timeoutMs: 30000 });
		if (reply.status !== 200 || (url.endsWith("robots.txt") ? reply.contentType !== "text/plain" : reply.contentType !== "text/html"))
			return reject();
		const body = new TextDecoder("utf-8", { fatal: true }).decode(reply.body);
		return { url, body, sha256: hash(body), retrievedAt: new Date(now()).toISOString() };
	}
	const robots = await capture(`${origin}/robots.txt`);
	if (robots.sha256 !== hamiltonRobotsSha256)
		return reject();
	await sleep(1000);
	const home = await capture(`${origin}/`);
	if (hamiltonPolicyFingerprint(home.body, home.url) !== hamiltonPolicySha256)
		return reject();
	await sleep(1000);
	const index = await capture(hamiltonDiscoveryUrl);
	const url = readHamiltonOfferedPublication(index.body);
	const policies: Page[] = [];
	for (const notice of hamiltonNotices) {
		await sleep(1000);
		const page = await capture(notice.url);
		if (hamiltonNoticeFingerprint(page.body, page.url) !== notice.sha256) return reject();
		policies.push(page);
	}
	let publication: Page | null = null;
	if (url) {
		await sleep(1000);
		publication = await capture(url);
	}
	const body = JSON.stringify({ schemaVersion: 1, type: "hamilton-candidate-discovery", robots, home, index, policies, publication });
	readHamiltonCandidateDiscovery(body, now());
	return body;
}
export async function fetchHamiltonCandidateCapture(source: StateBallotSource, options: Options = {}) {
	validateHamiltonSource(source);
	const discovery = options.discovery ?? await fetchHamiltonCandidateDiscovery(options);
	const parsed = readHamiltonCandidateDiscovery(discovery, (options.now ?? Date.now)());
	if (parsed.elections.length && !parsed.elections.some(item => item.electionDate === source.electionDate))
		return reject();
	return JSON.stringify({ schemaVersion: 1, type: "hamilton-candidate-capture", electionDate: source.electionDate, discovery: JSON.parse(discovery) });
}
export function parseHamiltonCandidateCapture(source: StateBallotSource, body: string, now = Date.now(), previous: readonly StateCandidateRecord[] = [], previousQuestions: readonly StateBallotQuestion[] = []) {
	validateHamiltonSource(source);
	if (Buffer.byteLength(body) > 8 * 1024 * 1024)
		return reject();
	const value: unknown = JSON.parse(body);
	if (!exact(value, ["schemaVersion", "type", "electionDate", "discovery"]) || value.schemaVersion !== 1 || value.type !== "hamilton-candidate-capture" || value.electionDate !== source.electionDate)
		return reject();
	const discovery = readHamiltonCandidateDiscovery(JSON.stringify(value.discovery), now);
	if (!discovery.publication) {
		if (previous.length || previousQuestions.length)
			return reject();
		throw new StateBallotAwaitingRecordsError(source.id);
	}
	if (!discovery.elections.some(item => item.electionDate === source.electionDate))
		return reject();
	const parsed = readHamiltonBallotDocument(source, discovery.publication.body);
	const document = discovery.publication;
	const sha256 = hamiltonDocumentDigest([{ url: document.url, sha256: document.sha256 }]);
	if (previous.some(record => !parsed.records.some(item => item.id === record.id)) || previousQuestions.some(question => !parsed.ballotQuestions.some(item => item.id === question.id)))
		return reject();
	return { records: parsed.records, ballotQuestions: parsed.ballotQuestions, retrievedAt: document.retrievedAt, sha256, collectionIndexSha256: sha256, documents: [{ url: document.url, sha256: document.sha256, retrievedAt: document.retrievedAt, includedRecordCount: parsed.records.length }] };
}
