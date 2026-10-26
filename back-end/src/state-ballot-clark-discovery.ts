import type { StateBallotSource } from "./state-ballot-sources.js";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { electionDocumentPolicyFingerprint, electionDocumentRobotsPolicy } from "./election-document-collection.js";
import { fetchRemoteSourceText } from "./remote-json-source.js";
import { parseStateHtml, stateHtmlAttribute, stateHtmlDescendants, stateHtmlText } from "./state-ballot-html.js";

export interface ClarkElection { electionId: null; electionDate: string; pageUrl: string }
export interface ClarkDocument { kind: "candidate-table" | "newsletter"; url: string }
type TextRequest = (url: string, options: { allowedHosts: string[]; maxBytes: number; maxRedirects: number; timeoutMs: number }) => Promise<string>;
export const clarkDiscoveryUrl = "https://www.clarkcountynv.gov/government/departments/elections/";
export const clarkDigest = (body: string) => createHash("sha256").update(body).digest("hex");
export const clarkIndexDigest = (documents: readonly { url: string }[]) => clarkDigest(JSON.stringify(documents.map(({ url }) => ({ url }))));
const policyPages = [
	{ id: "robots", url: "https://www.clarkcountynv.gov/robots.txt", format: "robots", sha256: "67e79ffcb4c3f0f949e797f7b7ab860a1f4318377348729615dc32aa8e21cc0c" },
	{ id: "home-links", url: "https://www.clarkcountynv.gov/", format: "links", sha256: "587109450d8a3b2b21be9e2647fe9366f3c4c42e07270655aa2df5d215abe3cd" },
	{ id: "privacy", url: "https://www.clarkcountynv.gov/government/privacy-policy", format: "main", sha256: "951f2e61c56ae7a3ae51dbb4ddf746faafec29de1eec5ab9980ba9173b0d1a5f" },
] as const;
export const clarkPolicyReceipts = policyPages.map(({ id, url, sha256 }) => ({ id, url, sha256 }));
const text = (node: Parameters<typeof stateHtmlText>[0]) => stateHtmlText(node).replace(/\s+/gu, " ").trim();
const pageUrl = (date: string) => `${clarkDiscoveryUrl}${date.slice(2, 4)}g-info`;
const generalDate = (date: string) => /^20\d{2}-11-0[2-8]$/u.test(date) && date >= "2026-11-03" && Number(date.slice(0, 4)) % 2 === 0 && new Date(`${date}T00:00:00Z`).getUTCDay() === 2;
export function clarkExactKeys(value: unknown, fields: string[]): value is Record<string, unknown> {
	return Boolean(value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).sort().join(",") === [...fields].sort().join(","));
}
function publicUrl(value: string) {
	const url = new URL(value, clarkDiscoveryUrl);
	if (url.origin !== "https://www.clarkcountynv.gov" || url.username || url.password || url.hash || url.search || /%2f|%5c|\\/iu.test(value)) throw new Error("The Clark County publication URL requires review.");
	return url.href;
}
export function validateClarkDocumentUrl(value: string) {
	if (publicUrl(value) !== value || !/^https:\/\/www\.clarkcountynv\.gov\/adobe\/assets\/urn:aaid:aem:[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}\/original\/as\/[a-z\d-]{1,100}\.pdf$/u.test(value)) throw new Error("The Clark County offered PDF identity requires review.");
}
export function validateClarkElection(value: unknown): asserts value is ClarkElection {
	if (!clarkExactKeys(value, ["electionId", "electionDate", "pageUrl"]) || value.electionId !== null || typeof value.electionDate !== "string" || !generalDate(value.electionDate) || value.pageUrl !== pageUrl(value.electionDate)) throw new Error("The Clark County election identity requires review.");
}
export function validateClarkSource(source: StateBallotSource) {
	validateClarkElection({ electionId: null, electionDate: source.electionDate, pageUrl: source.pageUrl });
	if (source.stateCode !== "NV" || source.format !== "clark-pdf" || source.retrievalPolicy || source.postBody || source.delimiter || source.documentUrls || source.documentLinks || source.url !== source.pageUrl || source.snapshotStorage !== "external" || source.id !== (source.electionDate === "2026-11-03" ? "nv-clark-2026" : `nv-clark-general-${source.electionDate}`)) throw new Error("The automatic Clark County source identity is invalid.");
}
function main(body: string) {
	if (Buffer.byteLength(body) > 2 * 1024 * 1024) throw new Error("The Clark County page exceeds its bounds.");
	if (electionDocumentPolicyFingerprint(Buffer.from(body), "links", clarkDiscoveryUrl) !== "a05839b4184c60812a05ff585f03ffe510be062f450420ceb3346add903a889f") throw new Error("Clark County publication policy links require review.");
	const nodes = stateHtmlDescendants(parseStateHtml(body), node => node.nodeName === "main");
	if (nodes.length !== 1) throw new Error("The Clark County publication has no unique main region.");
	return nodes[0]!;
}
function offeredDocument(body: string, label: string, kind: ClarkDocument["kind"]): ClarkDocument | null {
	const anchors = stateHtmlDescendants(main(body), node => node.nodeName === "a" && text(node) === label);
	if (anchors.length > 1) throw new Error("The Clark County publication repeats a candidate document.");
	if (!anchors.length) return null;
	const url = publicUrl(stateHtmlAttribute(anchors[0]!, "href"));
	validateClarkDocumentUrl(url);
	return { kind, url };
}
export function readClarkElectionIndex(body: string): ClarkElection {
	const region = main(body);
	if (!stateHtmlDescendants(region, node => node.nodeName === "h2" && text(node) === "Current Interest").length) throw new Error("The Clark County current-election region changed.");
	const dates = [...text(region).matchAll(/Election Day is November ([2-8]), (20\d{2})/gu)].map(match => `${match[2]}-11-0${match[1]}`);
	if (!dates.length || new Set(dates).size !== 1) throw new Error("The Clark County current election has no unambiguous printed date.");
	const date = dates[0]!;
	const anchors = stateHtmlDescendants(region, node => node.nodeName === "a" && /^One-Stop Page for Information about the 20\d{2} General Election$/u.test(text(node)));
	if (anchors.length !== 1 || text(anchors[0]!) !== `One-Stop Page for Information about the ${date.slice(0, 4)} General Election`) throw new Error("The Clark County current-election control requires review.");
	const election: ClarkElection = { electionId: null, electionDate: date, pageUrl: publicUrl(stateHtmlAttribute(anchors[0]!, "href")) };
	validateClarkElection(election);
	return election;
}
export function readClarkDiscovery(body: string) {
	if (Buffer.byteLength(body) > 6 * 1024 * 1024) throw new Error("The Clark County discovery exceeds its bounds.");
	const value = JSON.parse(body);
	if (!clarkExactKeys(value, ["schemaVersion", "type", "index", "page", "policies"]) || value.schemaVersion !== 1 || value.type !== "clark-candidate-discovery" || typeof value.index !== "string" || !clarkExactKeys(value.page, ["url", "body"]) || typeof value.page.body !== "string" || JSON.stringify(value.policies) !== JSON.stringify(clarkPolicyReceipts)) throw new Error("The Clark County discovery is incomplete or its policies changed.");
	const election = readClarkElectionIndex(value.index);
	const headings = stateHtmlDescendants(main(value.page.body), node => node.nodeName === "h2" && stateHtmlAttribute(node, "id") === "general-election-information-index");
	if (value.page.url !== election.pageUrl || headings.length !== 1 || text(headings[0]!) !== `${election.electionDate.slice(0, 4)} General Election Information Index`) throw new Error("The Clark County election page does not match its offered election.");
	const year = election.electionDate.slice(0, 4);
	const documents = [offeredDocument(value.page.body, `Contests/Candidates in the ${year} General Election`, "candidate-table"), offeredDocument(value.index, `All Contests and Candidates in the ${year} General Election`, "newsletter")].filter((document): document is ClarkDocument => Boolean(document));
	if (new Set(documents.map(document => document.url)).size !== documents.length) throw new Error("The Clark County independent publications have the same URL.");
	return { election, documents };
}
export function readClarkElectionDiscovery(body: string) {
	return [readClarkDiscovery(body).election];
}
export async function fetchClarkCycleDiscovery(options: { requestText?: TextRequest; wait?: (delay: number) => Promise<void> } = {}) {
	const request = options.requestText ?? fetchRemoteSourceText;
	const wait = options.wait ?? (delay => new Promise(resolve => setTimeout(resolve, delay)));
	const transport = { allowedHosts: ["www.clarkcountynv.gov"], maxBytes: 2 * 1024 * 1024, maxRedirects: 0, timeoutMs: 25000 };
	let robots: ReturnType<typeof electionDocumentRobotsPolicy> | undefined;
	const read = async (url: string) => {
		if (robots) {
			if (!robots.allowed(url)) throw new Error("Clark County robots policy disallows this publication.");
			await wait(robots.delay);
		}
		return request(url, transport);
	};
	for (const policy of policyPages) {
		const body = await read(policy.url);
		if (electionDocumentPolicyFingerprint(Buffer.from(body), policy.format, policy.url) !== policy.sha256) throw new Error("Clark County access or reuse policy requires review.");
		if (policy.format === "robots") robots = electionDocumentRobotsPolicy(Buffer.from(body));
	}
	const index = await read(clarkDiscoveryUrl);
	const election = readClarkElectionIndex(index);
	const body = JSON.stringify({ schemaVersion: 1, type: "clark-candidate-discovery", index, page: { url: election.pageUrl, body: await read(election.pageUrl) }, policies: clarkPolicyReceipts });
	readClarkDiscovery(body);
	return body;
}
