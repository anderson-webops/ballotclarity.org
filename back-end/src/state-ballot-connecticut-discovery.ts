import type { StateBallotSource } from "./state-ballot-sources.js";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { electionDocumentPolicyFingerprint, electionDocumentRobotsPolicy } from "./election-document-collection.js";
import { fetchRemoteSourceText } from "./remote-json-source.js";
import { connecticutBallotDocuments } from "./state-ballot-connecticut-documents.js";
import { parseStateHtml, stateHtmlAttribute, stateHtmlDescendants, stateHtmlText } from "./state-ballot-html.js";

export interface ConnecticutElection { electionId: null; electionDate: string; pageUrl: string }
export interface ConnecticutTownDocument { town: string; url: string }
type TextRequest = (url: string, options: { allowedHosts: string[]; maxBytes: number; maxRedirects: number; timeoutMs: number }) => Promise<string>;
export const connecticutDiscoveryUrl = "https://portal.ct.gov/SOTS/Election-Services/Town-Ballots/Ballots";
export const connecticutDigest = (body: string) => createHash("sha256").update(body).digest("hex");
export const connecticutIndexDigest = (documents: readonly ConnecticutTownDocument[]) => connecticutDigest(JSON.stringify(documents.map(({ town, url }) => ({ town, url }))));
const policyPages = [
	{ id: "robots", url: "https://portal.ct.gov/robots.txt", format: "robots", sha256: "e46be168ff122ee9f0ce6b57dcd24c71196b367fecdbc85b935d257c6a8be31f" },
	{ id: "home", url: "https://portal.ct.gov/", format: "links", sha256: "c4c6e86bbd88afd0a04e7d9dee66171f0cb9e61db30404507fa92dff3e3033a6" },
	{ id: "privacy", url: "https://portal.ct.gov/Policies/State-Privacy-Policy", format: "main", sha256: "f48b53824b81d7ce5e07866870c2e9435dcfba78d1d0c6785b16cadc1890acc1" },
	{ id: "disclaimer", url: "https://portal.ct.gov/portal/policies/disclaimer/", format: "main", sha256: "f72ce31f237b0eefdb77c58260951ccfc3cf8f32e0b2d921adcab48b3cf64ef8" },
] as const;
export const connecticutPolicyReceipts = policyPages.map(({ id, url, sha256 }) => ({ id, url, sha256 }));
const text = (node: Parameters<typeof stateHtmlText>[0]) => stateHtmlText(node).replace(/\s+/gu, " ").trim();
const generalDate = (date: string) => /^20\d{2}-11-0[2-8]$/u.test(date) && date >= "2026-11-03" && new Date(`${date}T00:00:00Z`).getUTCDay() === 2;

export function connecticutExactKeys(value: unknown, fields: string[]): value is Record<string, unknown> {
	return Boolean(value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).sort().join(",") === [...fields].sort().join(","));
}
function publicUrl(value: string) {
	const url = new URL(value, connecticutDiscoveryUrl);
	if (url.origin !== "https://portal.ct.gov" || url.username || url.password || url.hash || /%2f|%5c/iu.test(url.pathname)) throw new Error("The Connecticut publication URL requires review.");
	return url;
}
export function validateConnecticutDocument(document: ConnecticutTownDocument, electionDate: string) {
	if (!connecticutExactKeys(document, ["town", "url"]) || typeof document.town !== "string" || !/^[A-Z][A-Za-z ]{1,60}$/u.test(document.town) || typeof document.url !== "string") throw new Error("The Connecticut town document identity is invalid.");
	const url = publicUrl(document.url);
	if (!url.pathname.startsWith(`/-/media/sots/electionservices/town_ballots/${electionDate.slice(0, 4)}/`) || !url.pathname.endsWith(".pdf") || url.href !== document.url || [...url.searchParams.keys()].sort().join(",") !== "hash,rev" || !/^[a-f\d]{32}$/u.test(url.searchParams.get("rev")!) || !/^[A-F\d]{32}$/u.test(url.searchParams.get("hash")!)) throw new Error("The Connecticut town document does not identify its official election.");
}
export function validateConnecticutElection(value: unknown): asserts value is ConnecticutElection {
	if (!connecticutExactKeys(value, ["electionId", "electionDate", "pageUrl"]) || value.electionId !== null || typeof value.electionDate !== "string" || !generalDate(value.electionDate) || typeof value.pageUrl !== "string") throw new Error("The Connecticut election definition is invalid.");
	const url = publicUrl(value.pageUrl);
	if (url.search || url.href !== value.pageUrl || !new RegExp(`^/sots/election-services/town-ballots/${value.electionDate.slice(0, 4)}-[a-z0-9-]+$`, "u").test(url.pathname)) throw new Error("The Connecticut election page requires review.");
}
export function validateConnecticutSource(source: StateBallotSource) {
	validateConnecticutElection({ electionId: null, electionDate: source.electionDate, pageUrl: source.pageUrl });
	if (source.stateCode !== "CT" || source.format !== "connecticut-pdf" || source.retrievalPolicy || source.postBody || source.delimiter || source.documentUrls || source.documentLinks || source.url !== source.pageUrl || source.snapshotStorage !== "external" || source.id !== (source.electionDate === "2026-11-03" ? "ct-sots-2026" : `ct-general-${source.electionDate}`)) throw new Error("The automatic Connecticut source identity is invalid.");
}
function main(body: string) {
	if (Buffer.byteLength(body) > 2 * 1024 * 1024) throw new Error("The Connecticut publication exceeds its bounds.");
	const nodes = stateHtmlDescendants(parseStateHtml(body), node => node.nodeName === "main" && stateHtmlAttribute(node, "id") === "mainContent");
	if (nodes.length !== 1) throw new Error("The Connecticut publication has no unique main region.");
	if (electionDocumentPolicyFingerprint(Buffer.from(body), "links", "https://portal.ct.gov/") !== policyPages[1].sha256) throw new Error("Connecticut publication policy links require review.");
	return nodes[0]!;
}
export function readConnecticutElectionIndex(body: string): ConnecticutElection[] {
	const region = main(body);
	if (!stateHtmlDescendants(region, node => node.nodeName === "h1").some(node => text(node) === "Ballots")) throw new Error("The Connecticut election catalog identity changed.");
	const elections: ConnecticutElection[] = [];
	for (const anchor of stateHtmlDescendants(region, node => node.nodeName === "a")) {
		const label = text(anchor);
		if (!label.startsWith("November ") || !/Election/u.test(label) || /Primary|Special/u.test(label)) continue;
		const printed = /^November ([2-8]), (20\d{2}), /u.exec(label);
		if (printed && `${printed[2]}-11-0${printed[1]}` < "2026-11-03") continue;
		const match = /^November ([2-8]), (20\d{2}), (?:State Election, Sample Town Ballots|(?:Municipal )?General Election Sample (?:Town )?Ballots|Municipal Election Town Ballots|Presidential Election)$/u.exec(label);
		if (!match) throw new Error("The Connecticut general-election label requires review.");
		const date = `${match[2]}-11-0${match[1]}`;
		if (date < "2026-11-03") continue;
		const election: ConnecticutElection = { electionId: null, electionDate: date, pageUrl: publicUrl(stateHtmlAttribute(anchor, "href")).href };
		validateConnecticutElection(election);
		if (elections.some(item => item.electionDate === date)) throw new Error("The Connecticut catalog repeats an election date.");
		elections.push(election);
	}
	if (!elections.length || elections.length > 10) throw new Error("The Connecticut catalog has no bounded general-election publications.");
	return elections.sort((first, second) => first.electionDate.localeCompare(second.electionDate));
}
export function readConnecticutTownDocuments(body: string, election: ConnecticutElection): ConnecticutTownDocument[] {
	validateConnecticutElection(election);
	const region = main(body);
	const date = `November ${Number(election.electionDate.slice(-2))}, ${election.electionDate.slice(0, 4)}`;
	if (!stateHtmlDescendants(region, node => node.nodeName === "h1").some(node => text(node) === date) || !/Sample\s+Town Ballots/u.test(text(region))) throw new Error("The Connecticut town index does not identify its election.");
	const documents: ConnecticutTownDocument[] = [];
	for (const anchor of stateHtmlDescendants(region, node => node.nodeName === "a")) {
		const href = stateHtmlAttribute(anchor, "href");
		if (!/\/town_ballots\//iu.test(href)) continue;
		const document = { town: text(anchor), url: publicUrl(href).href };
		validateConnecticutDocument(document, election.electionDate);
		if (documents.some(item => item.town === document.town || item.url === document.url)) throw new Error("The Connecticut town index repeats a town or document.");
		documents.push(document);
	}
	if (documents.length > 169) throw new Error("The Connecticut town index exceeds its bounds.");
	const orderedTowns = election.electionDate === "2026-11-03" ? connecticutBallotDocuments.map(document => document.town as string) : [];
	return documents.sort((first, second) => {
		const firstRank = orderedTowns.indexOf(first.town);
		const secondRank = orderedTowns.indexOf(second.town);
		return (firstRank < 0 ? 169 : firstRank) - (secondRank < 0 ? 169 : secondRank) || first.town.localeCompare(second.town);
	});
}
export function readConnecticutDiscovery(body: string) {
	if (Buffer.byteLength(body) > 12 * 1024 * 1024) throw new Error("The Connecticut discovery exceeds its bounds.");
	const value = JSON.parse(body);
	if (!connecticutExactKeys(value, ["schemaVersion", "type", "index", "pages", "policies"]) || value.schemaVersion !== 1 || value.type !== "connecticut-town-discovery" || typeof value.index !== "string" || !Array.isArray(value.pages) || JSON.stringify(value.policies) !== JSON.stringify(connecticutPolicyReceipts)) throw new Error("The Connecticut discovery is invalid or its policies changed.");
	const offered = readConnecticutElectionIndex(value.index);
	if (value.pages.length !== offered.length) throw new Error("The Connecticut discovery omitted an offered election page.");
	const pages = value.pages;
	return offered.map((election, index) => {
		const page = pages[index];
		if (!connecticutExactKeys(page, ["url", "body"]) || page.url !== election.pageUrl || typeof page.body !== "string") throw new Error("The Connecticut discovery page set changed.");
		return { election, documents: readConnecticutTownDocuments(page.body, election) };
	});
}
export function readConnecticutElectionDiscovery(body: string) {
	return readConnecticutDiscovery(body).filter(item => item.documents.length).map(item => item.election);
}
export async function fetchConnecticutCycleDiscovery(options: { requestText?: TextRequest; wait?: (delay: number) => Promise<void> } = {}) {
	const request = options.requestText ?? fetchRemoteSourceText;
	const wait = options.wait ?? (delay => new Promise(resolve => setTimeout(resolve, delay)));
	const transport = { allowedHosts: ["portal.ct.gov"], maxBytes: 2 * 1024 * 1024, maxRedirects: 0, timeoutMs: 25000 };
	let robots: ReturnType<typeof electionDocumentRobotsPolicy> | undefined;
	const read = async (url: string) => {
		if (robots) {
			if (!robots.allowed(url)) throw new Error("Connecticut robots policy disallows this publication.");
			await wait(robots.delay);
		}
		return request(url, transport);
	};
	for (const policy of policyPages) {
		const body = await read(policy.url);
		if (electionDocumentPolicyFingerprint(Buffer.from(body), policy.format, policy.url) !== policy.sha256) throw new Error("Connecticut access or reuse policy requires review.");
		if (policy.format === "robots") robots = electionDocumentRobotsPolicy(Buffer.from(body), ["ahrefsbot", "ahrefssiteaudit", "*semrush*", "awariobot"], [], true);
	}
	const index = await read(connecticutDiscoveryUrl);
	const pages = [];
	for (const election of readConnecticutElectionIndex(index)) pages.push({ url: election.pageUrl, body: await read(election.pageUrl) });
	const body = JSON.stringify({ schemaVersion: 1, type: "connecticut-town-discovery", index, pages, policies: connecticutPolicyReceipts });
	readConnecticutDiscovery(body);
	return body;
}
