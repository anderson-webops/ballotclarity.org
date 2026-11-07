import type { StateCandidateValues } from "./state-ballot-additional-records.js";
import type { StateHtmlNode } from "./state-ballot-html.js";
import type { StateCandidateRecord } from "./state-ballot-records.js";
import type { StateBallotSource } from "./state-ballot-sources.js";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { setTimeout as wait } from "node:timers/promises";
import { electionDocumentPolicyFingerprint, electionDocumentRobotsPolicy } from "./election-document-collection.js";
import { fetchRemoteSourceText } from "./remote-json-source.js";
import { stateHtmlAttribute as attribute, stateHtmlDescendants as descendants, parseStateHtml, stateHtmlText } from "./state-ballot-html.js";
import { StateBallotAwaitingRecordsError } from "./state-ballot-source-state.js";

const origin = "https://www.ci.independence.mn.us";
function publicationUrl() {
	return "https://www.ci.independence.mn.us/government/elections";
}
export const independenceDiscoveryUrl = publicationUrl();
const hash = (body: string) => createHash("sha256").update(body).digest("hex");
const text = (node: StateHtmlNode) => stateHtmlText(node).normalize("NFKC").replace(/\s+/gu, " ").trim();
function exact(value: unknown, keys: string[]): value is Record<string, unknown> {
	return Boolean(value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).sort().join(",") === [...keys].sort().join(","));
}
const named = (node: StateHtmlNode, name: string) => attribute(node, "class").split(/\s+/u).includes(name);
const policies = [
	{ id: "robots", url: `${origin}/robots.txt`, format: "robots", sha256: "7986a0c78bc01f545fbd6c76d9406f0e9e0e6ebf8b5ba1e25600f367fe05c2ca" },
	{ id: "sms", url: `${origin}/hidden-pages/sms-terms-and-conditions`, format: "region", sha256: "34f016ef2f96458ae4b72065d14b667ca5e1cf8724e4f14b71051473ff110f27" },
	{ id: "privacy", url: `${origin}/hidden-pages/privacy-policy`, format: "region", sha256: "cc395eb03423c5aec9157fbd06f07bde781352c4f0589e54651cbc394e69275f" },
] as const;
export const independencePolicyReceipts = policies.map(({ id, url, sha256 }) => ({ id, url, sha256 }));
const legalLinksSha256 = "52c092684acd61ca1d59e3a6bcc67c484511a59eaeb18177fd80a692c68aceb8";
type Factory = (source: StateBallotSource, values: StateCandidateValues) => StateCandidateRecord | null;
type TextRequest = (url: string, options: { allowedHosts: string[]; maxBytes: number; maxRedirects: number; timeoutMs: number }) => Promise<string>;
interface Page { url: string; body: string; sha256: string; retrievedAt: string }
export interface IndependenceElection { electionId: null; electionDate: string; pageUrl: string }

export function validateIndependenceElection(value: unknown): asserts value is IndependenceElection {
	if (!exact(value, ["electionId", "electionDate", "pageUrl"]) || value.electionId !== null || typeof value.electionDate !== "string" || !/^20\d{2}-11-0[2-8]$/u.test(value.electionDate) || value.electionDate < "2026-11-03" || new Date(value.electionDate).getUTCDay() !== 2 || value.pageUrl !== publicationUrl()) throw new Error("The Independence city election requires review.");
}
export function independenceSource(electionDate = "2026-11-03"): StateBallotSource {
	const url = publicationUrl();
	validateIndependenceElection({ electionId: null, electionDate, pageUrl: url });
	return { id: electionDate === "2026-11-03" ? "mn-independence-city-2026" : `mn-independence-city-general-${electionDate}`, stateCode: "MN", label: "Independence city candidate list", electionDate, url, pageUrl: url, placeName: "Independence", format: "independence-html", snapshotStorage: "external", documentUrls: [url], ballotPreview: false };
}
export function validateIndependenceSource(source: StateBallotSource) {
	const expected = independenceSource(source.electionDate);
	if (!exact(source, Object.keys(expected)) || Object.entries(expected).some(([key, value]) => JSON.stringify(source[key as keyof StateBallotSource]) !== JSON.stringify(value))) throw new Error("The Independence city source configuration requires review.");
}
function main(body: string) {
	if (!body || Buffer.byteLength(body) > 2 * 1024 * 1024 || electionDocumentPolicyFingerprint(Buffer.from(body), "links", independenceDiscoveryUrl) !== legalLinksSha256) throw new Error("The Independence city page or legal links require review.");
	const tree = parseStateHtml(body);
	const pending = [{ node: tree, depth: 0 }];
	let visited = 0;
	while (pending.length) {
		const { node, depth } = pending.pop()!;
		if (++visited > 30000 || depth > 48) throw new Error("The Independence city page exceeds its structural bounds.");
		for (const child of node.childNodes ?? []) pending.push({ node: child, depth: depth + 1 });
	}
	const mains = descendants(tree, node => node.nodeName === "div" && attribute(node, "role") === "main" && named(node, "main"));
	if (mains.length !== 1 || descendants(mains[0]!, node => node.nodeName === "h1" && text(node) === "Elections").length !== 1 || descendants(mains[0]!, node => node.nodeName === "h2" && text(node) === "Elections in Independence").length !== 1) throw new Error("The Independence city publication identity requires review.");
	return mains[0]!;
}
function toggle(region: StateHtmlNode, label: string) {
	const sections = descendants(region, node => node.nodeName === "section" && named(node, "toggle") && (node.childNodes ?? []).some(child => child.nodeName === "label" && text(child) === label));
	if (sections.length !== 1) throw new Error("The Independence city publication sections require review.");
	const contents = (sections[0]!.childNodes ?? []).filter(node => node.nodeName === "div" && named(node, "toggle-content"));
	if (contents.length !== 1) throw new Error("The Independence city section content requires review.");
	return contents[0]!;
}
function pageElection(body: string) {
	const region = main(body);
	const dates = descendants(toggle(region, "Important Election Dates"), node => node.nodeName === "big").map(text);
	const match = dates.length === 1 ? /^GENERAL ELECTION - TUESDAY, NOVEMBER ([2-8]), (20\d{2})$/u.exec(dates[0]!) : null;
	if (!match) throw new Error("The Independence city general-election date requires review.");
	const election = { electionId: null, electionDate: `${match[2]}-11-0${match[1]}`, pageUrl: independenceDiscoveryUrl };
	validateIndependenceElection(election);
	const labels = descendants(region, node => node.nodeName === "label" && /\bCandidates\b/iu.test(text(node))).map(text);
	if (labels.length !== 1 || labels[0] !== `${match[2]} City Council Candidates`) throw new Error("The Independence city candidate year or office requires review.");
	return { election, candidates: toggle(region, labels[0]!) };
}
export function readIndependenceCandidatePage(source: StateBallotSource, body: string, factory: Factory) {
	validateIndependenceSource(source);
	const { election, candidates } = pageElection(body);
	if (election.electionDate !== source.electionDate) throw new Error("The Independence candidates belong to another election.");
	const children = (candidates.childNodes ?? []).filter(node => !(node.nodeName === "#text" && !text(node)) && !(node.nodeName === "p" && !text(node)));
	if (children.length === 1 && children[0]!.nodeName === "p" && /^Candidate (?:filing has not opened|statements will be posted)\.$/u.test(text(children[0]!))) throw new StateBallotAwaitingRecordsError(source.id);
	if (!children.length || children.length > 100 || children.length % 2) throw new Error("The Independence city candidate list requires review.");
	const records: StateCandidateRecord[] = [];
	for (let position = 0; position < children.length; position += 2) {
		const heading = children[position]!;
		const links = children[position + 1]!;
		if (heading.nodeName !== "div" || attribute(heading, "style") !== "background:#eeeeee;border:1px solid #cccccc;padding:5px 10px;" || heading.childNodes?.some(node => node.nodeName !== "#text") || heading.attrs?.some(item => item.name !== "style") || links.nodeName !== "ul" || links.attrs?.length) throw new Error("The Independence city candidate layout requires review.");
		const label = text(heading);
		const incumbent = label.endsWith(" - incumbent");
		const name = incumbent ? label.slice(0, -12) : label;
		if (name.length < 4 || name.length > 160 || !name.includes(" ") || !/^[\p{L}\p{M}][\p{L}\p{M} .,'’-]+$/u.test(name) || /\b(?:vacant|withdrawn|elected|qualified|candidate|incumbent|council|write-in)\b/iu.test(name)) throw new Error("The Independence city candidate identity requires review.");
		const items = (links.childNodes ?? []).filter(node => node.nodeName !== "#text" || text(node));
		const labels = items.length === 1 ? (items[0]!.childNodes ?? []).filter(node => node.nodeName !== "#text" || text(node)) : [];
		if (items.length !== 1 || items[0]!.nodeName !== "li" || !labels.length || labels.length > 2 || labels.some(node => node.nodeName !== "a") || labels.map(text).join("") !== `Meet your Candidate, ${name}` || descendants(links, node => !["#text", "li", "a"].includes(node.nodeName)).length) throw new Error("The Independence city statement labels require review.");
		for (const link of descendants(links, node => node.nodeName === "a")) {
			const url = new URL(attribute(link, "href"));
			if (url.username || url.password || url.hash || (!(url.origin === "https://youtu.be" && /^\/[\w-]{11}$/u.test(url.pathname) && !url.search) && !(url.origin === "https://m.youtube.com" && url.pathname === "/watch" && /^\?v=[\w-]{11}$/u.test(url.search)))) throw new Error("The Independence city statement link requires review.");
		}
		const record = factory(source, { name, office: "City Council", party: "", scope: "local", district: "", jurisdiction: "Independence", status: "listed" });
		if (!record || records.some(item => item.id === record.id)) throw new Error("The Independence city candidates are duplicated or invalid.");
		if (incumbent) record.incumbent = true;
		records.push(record);
	}
	return records;
}
export function readIndependenceDiscovery(body: string, now = Date.now()) {
	if (Buffer.byteLength(body) > 3 * 1024 * 1024) throw new Error("The Independence city capture exceeds its bounds.");
	const value: unknown = JSON.parse(body);
	if (!exact(value, ["schemaVersion", "type", "policies", "index"]) || value.schemaVersion !== 1 || value.type !== "independence-city-candidate-capture" || JSON.stringify(value.policies) !== JSON.stringify(independencePolicyReceipts) || !exact(value.index, ["url", "body", "sha256", "retrievedAt"])) throw new Error("The Independence city capture contract requires review.");
	const page = value.index;
	if (page.url !== independenceDiscoveryUrl || typeof page.body !== "string" || page.sha256 !== hash(page.body) || typeof page.retrievedAt !== "string" || !Number.isFinite(Date.parse(page.retrievedAt)) || new Date(page.retrievedAt).toISOString() !== page.retrievedAt || Date.parse(page.retrievedAt) > now) throw new Error("The Independence city capture provenance requires review.");
	return { elections: [pageElection(page.body).election], index: page as unknown as Page };
}
export function parseIndependenceCandidateCapture(source: StateBallotSource, body: string, factory: Factory, now = Date.now(), previous?: readonly StateCandidateRecord[]) {
	const capture = readIndependenceDiscovery(body, now);
	const records = readIndependenceCandidatePage(source, capture.index.body, factory);
	if (previous?.some(record => !records.some(item => item.id === record.id))) throw new Error("An accepted Independence city candidate disappeared; retain the snapshot for review.");
	return { records, retrievedAt: capture.index.retrievedAt, sha256: capture.index.sha256, collectionIndexSha256: capture.index.sha256, documents: [{ url: capture.index.url, sha256: capture.index.sha256, retrievedAt: capture.index.retrievedAt, includedRecordCount: records.length }] };
}
export async function fetchIndependenceCycleDiscovery(options: { requestText?: TextRequest; now?: () => number; wait?: (milliseconds: number) => Promise<void> } = {}) {
	const request = options.requestText ?? fetchRemoteSourceText;
	const now = options.now ?? Date.now;
	const transport = { allowedHosts: [new URL(origin).hostname], maxBytes: 2 * 1024 * 1024, maxRedirects: 0, timeoutMs: 15000 };
	let robots: ReturnType<typeof electionDocumentRobotsPolicy> | undefined;
	const get = async (url: string) => {
		if (robots) {
			if (!robots.allowed(url)) throw new Error("The Independence city robots policy excludes this publication.");
			await (options.wait ?? wait)(robots.delay);
		}
		return request(url, transport);
	};
	for (const policy of policies) {
		const body = await get(policy.url);
		if (electionDocumentPolicyFingerprint(Buffer.from(body), policy.format, policy.url, undefined, policy.format === "region" ? "article" : undefined) !== policy.sha256) throw new Error("The Independence city publisher policy requires review.");
		if (policy.format === "robots") robots = electionDocumentRobotsPolicy(Buffer.from(body));
	}
	const body = await get(independenceDiscoveryUrl);
	const capture = JSON.stringify({ schemaVersion: 1, type: "independence-city-candidate-capture", policies: independencePolicyReceipts, index: { url: independenceDiscoveryUrl, body, sha256: hash(body), retrievedAt: new Date(now()).toISOString() } });
	readIndependenceDiscovery(capture, now());
	return capture;
}
export async function fetchIndependenceCandidateCapture(source: StateBallotSource, options: Parameters<typeof fetchIndependenceCycleDiscovery>[0] & { discovery?: string } = {}) {
	validateIndependenceSource(source);
	const capture = options.discovery ?? await fetchIndependenceCycleDiscovery(options);
	if (readIndependenceDiscovery(capture, (options.now ?? Date.now)()).elections[0]!.electionDate !== source.electionDate) throw new Error("The Independence city publication does not offer this election.");
	return capture;
}
