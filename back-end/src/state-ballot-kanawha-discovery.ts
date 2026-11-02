import type { StateHtmlNode } from "./state-ballot-html.js";
import type { StateBallotSource } from "./state-ballot-sources.js";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { parseStateHtml, stateHtmlAttribute, stateHtmlDescendants, stateHtmlText } from "./state-ballot-html.js";

export const kanawhaOrigin = "https://kanawha.us";
export const kanawhaDiscoveryUrl = `${kanawhaOrigin}/county-clerk/election-center/`;
export const kanawhaRobotsSha256 = "445b9750469051a0d0d37e97909ce7fff8367ea634059af6b388cf0b338213ee";
export const kanawhaHash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
export const kanawhaPolicies = [
	{ requestUrl: `${kanawhaOrigin}/privacy-policy`, url: `${kanawhaOrigin}/privacy-policy/`, textSha256: "daca5a42730a5fe632c92483513bf9b96b140f1acabf5f561e4edf7de791473c" },
	{ requestUrl: `${kanawhaOrigin}/accessibility`, url: `${kanawhaOrigin}/accessibility/`, textSha256: "905be55b2f5189fe5aebfbfabeabf78e19c6c4538d07270a83858510428a05cf" },
	{ requestUrl: `${kanawhaOrigin}/notice-of-non-discrimination/`, url: `${kanawhaOrigin}/notice-of-non-discrimination/`, textSha256: "0e8fe9f387843cefbbb199fedd43c9c262a4b01cceb0136c9af66d082c206c02" },
] as const;
const links = [["Accessibility", `${kanawhaOrigin}/accessibility/`], ["Accessibility", `${kanawhaOrigin}/accessibility`], ["Notice of Non-Discrimination", `${kanawhaOrigin}/notice-of-non-discrimination/`], ["Privacy Policy", `${kanawhaOrigin}/privacy-policy`]];
const exact = (value: unknown, keys: string[]): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).sort().join("|") === [...keys].sort().join("|"));
const digest = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
const clean = (value: string) => value.normalize("NFKC").replace(/\s+/gu, " ").trim();
const text = (node: StateHtmlNode) => clean(stateHtmlText(node));
function reject(): never {
	throw new Error("The Kanawha County publication or collection policy requires review.");
}
function document(body: string) {
	if (Buffer.byteLength(body) > 2 * 1024 * 1024 || body.includes("\uFFFD") || /checking your browser|access denied|_Incapsula_Resource/iu.test(body)) return reject();
	const dom = parseStateHtml(body);
	const paths = new Map<StateHtmlNode, StateHtmlNode[]>();
	const pending = [{ node: dom, path: [] as StateHtmlNode[] }];
	while (pending.length) {
		const { node, path } = pending.pop()!;
		if (paths.size >= 20000 || path.length > 64) return reject();
		paths.set(node, path);
		for (const child of node.childNodes ?? []) pending.push({ node: child, path: [...path, node] });
	}
	return { dom, paths };
}
function visible(path: StateHtmlNode[]) {
	return !path.some(node => node.attrs?.some(attribute => attribute.name === "hidden" || attribute.name === "inert" || (attribute.name === "aria-hidden" && attribute.value === "true") || (attribute.name === "style" && /display\s*:\s*none|visibility\s*:\s*(?:hidden|collapse)/iu.test(attribute.value))));
}
export function validateKanawhaPolicyLinks(body: string) {
	const { dom } = document(body);
	const content = text(dom);
	const rights = [...content.matchAll(/Copyright © 20\d{2} Kanawha County, West Virginia/gu)];
	if (rights.length !== 1 || /copyright|scrap(?:e|ing)|crawling|automated (?:access|collection)|republish/iu.test(content.replace(rights[0]![0], ""))) return reject();
	const found = stateHtmlDescendants(dom, node => node.nodeName === "a" && /privacy|terms|copyright|licen[cs]e|disclaim|accessib|legal|non-discrimination/iu.test(`${text(node)} ${stateHtmlAttribute(node, "href")}`)).map(node => [text(node), new URL(stateHtmlAttribute(node, "href"), kanawhaOrigin).href]);
	if (JSON.stringify(found) !== JSON.stringify(links)) return reject();
}
export function kanawhaPolicyTextHash(body: string) {
	validateKanawhaPolicyLinks(body);
	const { dom } = document(body);
	const articles = stateHtmlDescendants(dom, node => node.nodeName === "article");
	if (articles.length !== 1) return reject();
	return kanawhaHash(text(articles[0]!));
}
export function readKanawhaCandidateIndex(body: string) {
	validateKanawhaPolicyLinks(body);
	const { dom, paths } = document(body);
	const titles = stateHtmlDescendants(dom, node => node.nodeName === "title");
	if (titles.length !== 1 || text(titles[0]!) !== "Election Center - Kanawha County, West Virginia") return reject();
	const offers: { year: string; url: string }[] = [];
	for (const anchor of stateHtmlDescendants(dom, node => node.nodeName === "a" && /public test results|general election.*unofficial results/iu.test(text(node)))) {
		const label = text(anchor);
		const resultLabel = /^(20\d{2}) General Election \(Unofficial Results\)$/u.exec(label);
		if ((label !== "View Public Test Results" && !resultLabel) || !visible([...(paths.get(anchor) ?? []), anchor])) return reject();
		let year: string | undefined;
		for (const parent of [...(paths.get(anchor) ?? [])].reverse()) {
			const headings = stateHtmlDescendants(parent, node => /^h[1-6]$/u.test(node.nodeName) && /^20\d{2} General Election(?: Results)?$/u.test(text(node)));
			if (!headings.length) continue;
			if (headings.length !== 1 || !visible([...(paths.get(headings[0]!) ?? []), headings[0]!])) return reject();
			year = text(headings[0]!).slice(0, 4);
			break;
		}
		if (!year || year < "2026" || (resultLabel && resultLabel[1] !== year)) return reject();
		const url = new URL(stateHtmlAttribute(anchor, "href"), kanawhaOrigin).href;
		validateKanawhaDocumentUrl(url, year);
		if (offers.some(offer => offer.year === year && offer.url === url)) continue;
		if (offers.some(offer => offer.year === year || offer.url === url)) return reject();
		offers.push({ year, url });
	}
	if (offers.length > 8) return reject();
	return offers.sort((first, second) => first.year.localeCompare(second.year));
}
export function validateKanawhaDocumentUrl(value: string, year: string) {
	const url = new URL(value);
	if (!/^20\d{2}$/u.test(year) || url.href !== value || url.origin !== kanawhaOrigin || url.username || url.password || url.search || url.hash || !new RegExp(`^/wp-content/uploads/${year}/(?:0[1-9]|1[0-2])/Zero-Test-${year}-General\\.pdf$`, "u").test(url.pathname)) return reject();
}
export function kanawhaSource(electionDate: string): StateBallotSource {
	if (!/^20\d{2}-11-0[2-8]$/u.test(electionDate) || electionDate < "2026-11-03" || new Date(`${electionDate}T00:00:00Z`).getUTCDay() !== 2) return reject();
	return { stateCode: "WV", id: electionDate === "2026-11-03" ? "wv-kanawha-2026" : `wv-kanawha-general-${electionDate}`, label: "Kanawha County Clerk", electionDate, url: kanawhaDiscoveryUrl, pageUrl: kanawhaDiscoveryUrl, format: "kanawha-pdf", snapshotStorage: "external", countyName: "Kanawha County", defaultPriority: -20, ballotPreview: false, withheldDistrictScopes: ["congressional", "state-senate", "state-house"], scopeNotice: "Pre-election test roster; district and municipal applicability is unverified." };
}
export function validateKanawhaSource(source: StateBallotSource) {
	const expected = kanawhaSource(source.electionDate);
	if (!exact(source, Object.keys(expected)) || Object.entries(expected).some(([key, value]) => JSON.stringify(source[key as keyof StateBallotSource]) !== JSON.stringify(value))) return reject();
}
export interface KanawhaElection { electionId: null; electionDate: string; pageUrl: string; kanawhaDocuments: { url: string; sha256: string; sourceAsOfDate: string }[] }
export const kanawhaDocumentDigest = (documents: KanawhaElection["kanawhaDocuments"]) => kanawhaHash(JSON.stringify(documents));
export function validateKanawhaElection(value: unknown): asserts value is KanawhaElection {
	if (!exact(value, ["electionId", "electionDate", "pageUrl", "kanawhaDocuments"]) || value.electionId !== null || typeof value.electionDate !== "string" || value.pageUrl !== kanawhaDiscoveryUrl || !Array.isArray(value.kanawhaDocuments) || value.kanawhaDocuments.length !== 1) return reject();
	kanawhaSource(value.electionDate);
	const publication = value.kanawhaDocuments[0];
	if (!exact(publication, ["url", "sha256", "sourceAsOfDate"]) || typeof publication.url !== "string" || !digest(publication.sha256) || typeof publication.sourceAsOfDate !== "string" || !/^20\d{2}-\d{2}-\d{2}$/u.test(publication.sourceAsOfDate) || new Date(publication.sourceAsOfDate).toISOString().slice(0, 10) !== publication.sourceAsOfDate || publication.sourceAsOfDate.slice(0, 4) !== value.electionDate.slice(0, 4) || publication.sourceAsOfDate > value.electionDate) return reject();
	validateKanawhaDocumentUrl(publication.url, value.electionDate.slice(0, 4));
}
export function readKanawhaSnapshotMetadata(source: StateBallotSource, data: Record<string, unknown>) {
	validateKanawhaSource(source);
	if (!Array.isArray(data.documents) || data.documents.length !== 1 || typeof data.sourceAsOfDate !== "string" || data.sourceAsOf !== undefined || data.ballotQuestions !== undefined || !Array.isArray(data.records)) return reject();
	const documents = data.documents.map((item) => {
		if (!exact(item, ["url", "sha256", "retrievedAt", "includedRecordCount"]) || item.includedRecordCount !== data.recordCount) return reject();
		return { url: item.url, sha256: item.sha256, sourceAsOfDate: data.sourceAsOfDate };
	});
	const election: unknown = { electionId: null, electionDate: source.electionDate, pageUrl: source.pageUrl, kanawhaDocuments: documents };
	validateKanawhaElection(election);
	if (data.collectionIndexSha256 !== kanawhaDocumentDigest(election.kanawhaDocuments)) return reject();
	const allowed = ["id", "name", "office", "party", "district", "scope", "status", "jurisdiction", "ballotDesignation", "sourceDivision", "voteLimit"];
	for (const item of data.records) {
		if (!item || typeof item !== "object" || Array.isArray(item) || Object.keys(item).some(key => !allowed.includes(key))) return reject();
		const record = item as Record<string, unknown>;
		if (record.status !== "listed" || typeof record.name !== "string" || typeof record.office !== "string" || typeof record.district !== "string" || typeof record.jurisdiction !== "string" || !Number.isInteger(record.voteLimit) || Number(record.voteLimit) < 1 || Number(record.voteLimit) > 20 || (record.party !== undefined && !["Republican", "Democratic", "Constitution", "Independent"].includes(String(record.party))) || (record.ballotDesignation !== undefined && record.ballotDesignation !== "Unexpired term") || (record.sourceDivision !== undefined && !/^[1-9]\d?$/u.test(String(record.sourceDivision)))) return reject();
		if (record.scope === "local" ? record.district !== "" || !/^(?:Kanawha County|(?:City|Town) of [A-Za-z .'-]+)$/u.test(record.jurisdiction) : record.jurisdiction !== "West Virginia" || !["statewide", "congressional", "state-senate", "state-house"].includes(String(record.scope))) return reject();
		const identity = [source.stateCode, source.electionDate, record.office.toLowerCase(), record.district.toLowerCase(), record.name.toLowerCase(), String(record.party ?? "").toLowerCase(), ...(record.scope === "local" ? [record.jurisdiction.toLowerCase()] : [])];
		if (record.id !== kanawhaHash(JSON.stringify(identity)).slice(0, 24)) return reject();
	}
	return { sourceAsOfDate: data.sourceAsOfDate };
}
