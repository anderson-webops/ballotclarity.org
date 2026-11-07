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

function publicationUrl() {
	return "https://www.losranchosnm.gov/1195/Election-Info";
}
export const losRanchosDiscoveryUrl = publicationUrl();
const origin = "https://www.losranchosnm.gov";
const hash = (body: string) => createHash("sha256").update(body).digest("hex");
const text = (node: StateHtmlNode) => stateHtmlText(node).normalize("NFKC").replace(/\s+/gu, " ").trim();
type AncestryNode = StateHtmlNode & { parentNode?: AncestryNode };
function visiblePath(node: StateHtmlNode) {
	for (let current: AncestryNode | undefined = node; current; current = current.parentNode) {
		if (current.attrs?.some(item => item.name === "hidden") || attribute(current, "aria-hidden") === "true" || (attribute(current, "style") && attribute(current, "style") !== "white-space:pre-wrap;")) throw new Error("The Los Ranchos candidate visibility requires review.");
	}
}
function exact(value: unknown, keys: string[]): value is Record<string, unknown> {
	return Boolean(value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).sort().join(",") === [...keys].sort().join(","));
}
const policies = [
	{ id: "robots", url: `${origin}/robots.txt`, format: "robots", sha256: "b26c3d4773541fd7f99368a42d3d42d7fa44fe4d01ea7acd0676ab52f60b0db8" },
	{ id: "copyright", url: `${origin}/site/copyright`, format: "region", sha256: "16f821310fc613cb1a1fbccd596337ab488487c114314435fc22d37f5f9d838e" },
	{ id: "privacy", url: `${origin}/site/privacy`, format: "region", sha256: "a2278aa8a05e70f685bb6adfc9cca734426d50c6765ed18376d92a18258b4edb" },
] as const;
export const losRanchosPolicyReceipts = policies.map(({ id, url, sha256 }) => ({ id, url, sha256 }));
const legalLinksSha256 = "7f117aefea13e33dc241a6846c1a548cad3c39d471d527be90b4e7185c0f38ce";
const robotsLayout = { restrictiveGroups: [
	{ agents: ["Baiduspider"], unrelated: true as const },
	{ agents: ["Yandex"], unrelated: true as const },
	{ agents: ["*"] },
	{ agents: ["Siteimprove"], unrelated: true as const },
	{ agents: ["Siteimprovebot"], unrelated: true as const },
	{ agents: ["Siteimprovebot-crawler"], unrelated: true as const },
	{ agents: ["meta-webindexer", "meta-externalagent", "OAI-SearchBot", "GPTBot", "ClaudeBot", "Claude-SearchBot", "PerplexityBot", "Amazonbot", "Bytespider", "CCBot", "cohere-ai", "Reflectionbot", "LinkupBot", "ExaSearchBot", "YouBot", "DuckAssistBot", "serpstatbot", "AhrefsBot", "SemrushBot", "MJ12bot", "DotBot"] },
] };
type Factory = (source: StateBallotSource, values: StateCandidateValues) => StateCandidateRecord | null;
type TextRequest = (url: string, options: { allowedHosts: string[]; maxBytes: number; maxRedirects: number; timeoutMs: number }) => Promise<string>;
interface Page { url: string; body: string; sha256: string; retrievedAt: string }
export interface LosRanchosElection { electionId: null; electionDate: string; pageUrl: string }

export function validateLosRanchosElection(value: unknown): asserts value is LosRanchosElection {
	if (!exact(value, ["electionId", "electionDate", "pageUrl"]) || value.electionId !== null || typeof value.electionDate !== "string" || !/^20\d{2}-11-0[2-8]$/u.test(value.electionDate) || value.electionDate < "2025-11-04" || Number(value.electionDate.slice(0, 4)) % 2 !== 1 || new Date(value.electionDate).getUTCDay() !== 2 || value.pageUrl !== publicationUrl()) throw new Error("The Los Ranchos local-election identity requires review.");
}
export function losRanchosSource(electionDate = "2025-11-04"): StateBallotSource {
	const url = publicationUrl();
	validateLosRanchosElection({ electionId: null, electionDate, pageUrl: url });
	return { id: electionDate === "2025-11-04" ? "nm-los-ranchos-2025" : `nm-los-ranchos-local-${electionDate}`, stateCode: "NM", label: "Los Ranchos municipal candidates", electionDate, url, pageUrl: url, placeName: "Los Ranchos de Albuquerque", format: "los-ranchos-html", snapshotStorage: "external", documentUrls: [url], ballotPreview: false };
}
export function validateLosRanchosSource(source: StateBallotSource) {
	const expected = losRanchosSource(source.electionDate);
	if (!exact(source, Object.keys(expected)) || Object.entries(expected).some(([key, value]) => JSON.stringify(source[key as keyof StateBallotSource]) !== JSON.stringify(value))) throw new Error("The Los Ranchos source configuration requires review.");
}
function publication(body: string) {
	if (!body || Buffer.byteLength(body) > 2 * 1024 * 1024 || electionDocumentPolicyFingerprint(Buffer.from(body), "links", losRanchosDiscoveryUrl) !== legalLinksSha256) throw new Error("The Los Ranchos page or legal links require review.");
	const tree = parseStateHtml(body);
	const pending = [{ node: tree, depth: 0 }];
	let visited = 0;
	while (pending.length) {
		const { node, depth } = pending.pop()!;
		if (++visited > 30000 || depth > 48) throw new Error("The Los Ranchos page exceeds its structural bounds.");
		for (const child of node.childNodes ?? []) pending.push({ node: child, depth: depth + 1 });
	}
	const mains = descendants(tree, node => node.nodeName === "main" && attribute(node, "id") === "mainWrapTS");
	if (mains.length !== 1 || descendants(mains[0]!, node => node.nodeName === "h1" && text(node) === "Election Info").length !== 1) throw new Error("The Los Ranchos publication identity requires review.");
	const regions = descendants(mains[0]!, node => node.nodeName === "div" && attribute(node, "class") === "fr-view" && (node.childNodes ?? []).some(child => child.nodeName === "h2" && text(child) === "Village of Los Ranchos Election"));
	if (regions.length !== 1) throw new Error("The Los Ranchos election section requires review.");
	const children = (regions[0]!.childNodes ?? []).filter(node => node.nodeName !== "#text" || text(node));
	const boundary = children.findIndex(node => node.nodeName === "h2" && text(node) === "Previous Election information");
	if (boundary < 0) throw new Error("The Los Ranchos historical boundary requires review.");
	const current = children.slice(0, boundary);
	const heading = current.findIndex(node => node.nodeName === "h2" && text(node) === "Village of Los Ranchos Election");
	if (heading < 1) throw new Error("The Los Ranchos local-election heading requires review.");
	const dated = current[heading - 1]!;
	const date = dated.nodeName === "p" ? /^(20\d{2}) Regular Local Election; Tuesday, November ([2-8]), \1; 7 am to 7 pm\.$/u.exec(text(dated)) : null;
	if (!date) throw new Error("The Los Ranchos candidate slate has no unambiguous local-election date.");
	visiblePath(dated);
	const election = { electionId: null, electionDate: `${date[1]}-11-0${date[2]}`, pageUrl: losRanchosDiscoveryUrl };
	validateLosRanchosElection(election);
	const year = date[1]!;
	const offices = current.filter(node => /^Qualified .+ Candidates$/u.test(text(node))).map(text);
	if (offices.length !== 1 || offices[0] !== "Qualified Trustee At-Large Candidates") throw new Error("The Los Ranchos office set requires review.");
	const headings = current.flatMap((node, index) => node.nodeName === "h2" && text(node) === "Qualified Trustee At-Large Candidates" ? [index] : []);
	if (headings.length !== 1 || headings[0]! <= heading) throw new Error("The Los Ranchos candidate-office heading requires review.");
	const position = headings[0]!;
	const alphabet = current[position + 1];
	const members = current[position + 2];
	const list = current[position + 3];
	if (!alphabet || alphabet.nodeName !== "p" || text(alphabet) !== `(In order of Ballot Appearance as selected by the NM SoS ${year}-${Number(year) + 1} Election Cycle Alphabet Randomization)` || !members || members.nodeName !== "h2" || text(members) !== "Members" || !list || list.nodeName !== "ul" || list.attrs?.length) throw new Error("The Los Ranchos candidate cycle or list layout requires review.");
	for (const node of [current[position]!, alphabet, members, list]) visiblePath(node);
	const guides = descendants(regions[0]!, node => node.nodeName === "a" && text(node) === `${year} Candidate Guide (PDF)`);
	if (guides.length !== 1 || !/^\/DocumentCenter\/View\/[1-9]\d*$/u.test(attribute(guides[0]!, "href")) || !current.some(node => descendants(node, child => child === guides[0]).length)) throw new Error("The Los Ranchos candidate guide belongs to another election or section.");
	return { election, list };
}
export function readLosRanchosCandidatePage(source: StateBallotSource, body: string, factory: Factory) {
	validateLosRanchosSource(source);
	const { election, list } = publication(body);
	if (election.electionDate !== source.electionDate) throw new Error("The Los Ranchos candidates belong to another election.");
	const items = (list.childNodes ?? []).filter(node => node.nodeName !== "#text" || text(node));
	if (!items.length || items.length > 50) throw new Error("The Los Ranchos candidate list is empty or exceeds its bounds.");
	const records: StateCandidateRecord[] = [];
	for (const item of items) {
		if (item.nodeName !== "li" || item.attrs?.length || item.childNodes?.some(node => node.nodeName !== "#text")) throw new Error("The Los Ranchos candidate row requires review.");
		const label = text(item);
		const judge = /^Municipal Judge (.+) \(unopposed\)$/u.exec(label);
		const name = judge ? judge[1]! : label;
		if (name.length < 4 || name.length > 160 || !name.includes(" ") || !/^[\p{L}\p{M}][\p{L}\p{M} .,'’-]+$/u.test(name) || /\b(?:vacant|withdrawn|elected|qualified|candidate|incumbent|municipal|judge|unopposed|write-in)\b/iu.test(name)) throw new Error("The Los Ranchos candidate identity requires review.");
		const record = factory(source, { name, office: judge ? "Municipal Judge" : "Trustee At-Large", party: "", scope: "local", district: "", jurisdiction: "Los Ranchos de Albuquerque, New Mexico", status: judge ? "listed" : "qualified" });
		if (!record || records.some(existing => existing.id === record.id)) throw new Error("The Los Ranchos candidate identities are invalid or duplicated.");
		if (judge) record.sourceStatus = "Unopposed";
		records.push(record);
	}
	if (records.filter(record => record.office === "Municipal Judge").length > 1) throw new Error("The Los Ranchos municipal-judge choices require review.");
	return records;
}
export function readLosRanchosDiscovery(body: string, now = Date.now()) {
	if (Buffer.byteLength(body) > 3 * 1024 * 1024) throw new Error("The Los Ranchos capture exceeds its bounds.");
	const value: unknown = JSON.parse(body);
	if (!exact(value, ["schemaVersion", "type", "policies", "index"]) || value.schemaVersion !== 1 || value.type !== "los-ranchos-candidate-capture" || JSON.stringify(value.policies) !== JSON.stringify(losRanchosPolicyReceipts) || !exact(value.index, ["url", "body", "sha256", "retrievedAt"])) throw new Error("The Los Ranchos capture contract requires review.");
	const page = value.index;
	if (page.url !== losRanchosDiscoveryUrl || typeof page.body !== "string" || page.sha256 !== hash(page.body) || typeof page.retrievedAt !== "string" || !Number.isFinite(Date.parse(page.retrievedAt)) || new Date(page.retrievedAt).toISOString() !== page.retrievedAt || Date.parse(page.retrievedAt) > now) throw new Error("The Los Ranchos capture provenance requires review.");
	return { elections: [publication(page.body).election], index: page as unknown as Page };
}
export function parseLosRanchosCandidateCapture(source: StateBallotSource, body: string, factory: Factory, now = Date.now(), previous?: readonly StateCandidateRecord[]) {
	const capture = readLosRanchosDiscovery(body, now);
	const records = readLosRanchosCandidatePage(source, capture.index.body, factory);
	if (previous?.some(record => !records.some(item => item.id === record.id))) throw new Error("An accepted Los Ranchos candidate disappeared; retain the snapshot for review.");
	return { records, retrievedAt: capture.index.retrievedAt, sha256: capture.index.sha256, collectionIndexSha256: capture.index.sha256, documents: [{ url: capture.index.url, sha256: capture.index.sha256, retrievedAt: capture.index.retrievedAt, includedRecordCount: records.length }] };
}
export async function fetchLosRanchosCycleDiscovery(options: { requestText?: TextRequest; now?: () => number; wait?: (milliseconds: number) => Promise<void> } = {}) {
	const request = options.requestText ?? fetchRemoteSourceText;
	const now = options.now ?? Date.now;
	const transport = { allowedHosts: [new URL(origin).hostname], maxBytes: 2 * 1024 * 1024, maxRedirects: 0, timeoutMs: 15000 };
	let robots: ReturnType<typeof electionDocumentRobotsPolicy> | undefined;
	const get = async (url: string) => {
		if (robots) {
			if (!robots.allowed(url)) throw new Error("The Los Ranchos publisher policy excludes this publication.");
			await (options.wait ?? wait)(robots.delay);
		}
		return request(url, transport);
	};
	for (const policy of policies) {
		const body = await get(policy.url);
		if (electionDocumentPolicyFingerprint(Buffer.from(body), policy.format, policy.url, policy.format === "region" ? "mainWrapTS" : undefined) !== policy.sha256) throw new Error("The Los Ranchos publisher policy requires review.");
		if (policy.format === "robots") robots = electionDocumentRobotsPolicy(Buffer.from(body), [], [], undefined, undefined, robotsLayout);
	}
	const body = await get(losRanchosDiscoveryUrl);
	const capture = JSON.stringify({ schemaVersion: 1, type: "los-ranchos-candidate-capture", policies: losRanchosPolicyReceipts, index: { url: losRanchosDiscoveryUrl, body, sha256: hash(body), retrievedAt: new Date(now()).toISOString() } });
	readLosRanchosDiscovery(capture, now());
	return capture;
}
export async function fetchLosRanchosCandidateCapture(source: StateBallotSource, options: Parameters<typeof fetchLosRanchosCycleDiscovery>[0] & { discovery?: string } = {}) {
	validateLosRanchosSource(source);
	const capture = options.discovery ?? await fetchLosRanchosCycleDiscovery(options);
	if (readLosRanchosDiscovery(capture, (options.now ?? Date.now)()).elections[0]!.electionDate !== source.electionDate) throw new Error("The Los Ranchos publication does not offer this election.");
	return capture;
}
