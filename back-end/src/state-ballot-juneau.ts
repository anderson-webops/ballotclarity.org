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
	return "https://juneau.org/clerk/elections";
}
function candidateUrl(year: string) {
	return `https://juneau.org/clerk/certified-municipal-candidates-${year}`;
}
export const juneauDiscoveryUrl = publicationUrl();
const origin = "https://juneau.org";
const hash = (body: string) => createHash("sha256").update(body).digest("hex");
const text = (node: StateHtmlNode) => stateHtmlText(node).normalize("NFKC").replace(/\s+/gu, " ").trim();
type AncestryNode = StateHtmlNode & { parentNode?: AncestryNode };
type Factory = (source: StateBallotSource, values: StateCandidateValues) => StateCandidateRecord | null;
type TextRequest = (url: string, options: { allowedHosts: string[]; maxBytes: number; maxRedirects: number; timeoutMs: number }) => Promise<string>;
interface Page { url: string; body: string; sha256: string; retrievedAt: string }
export interface JuneauElection { electionId: null; electionDate: string; pageUrl: string }
export const juneauPolicyReceipts = [{ id: "robots", url: `${origin}/robots.txt`, sha256: "3efad7dbb9c8a0cd69db9e2a5136d6f6aa3d6c877c4f2324f4679db0adac3d7e" }];

function exact(value: unknown, keys: string[]): value is Record<string, unknown> {
	return Boolean(value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).sort().join(",") === [...keys].sort().join(","));
}
function visible(node: StateHtmlNode) {
	for (let current: AncestryNode | undefined = node; current; current = current.parentNode) {
		if (current.attrs?.some(item => item.name === "hidden") || attribute(current, "aria-hidden") === "true" || /display\s*:\s*none|visibility\s*:\s*hidden|opacity\s*:\s*0(?:\D|$)/iu.test(attribute(current, "style"))) throw new Error("The Juneau publication visibility requires review.");
	}
}
function main(body: string, heading: string, url: string, fingerprint: string) {
	if (!body || Buffer.byteLength(body) > 2 * 1024 * 1024) throw new Error("The Juneau publication exceeds its bounds.");
	const normalized = body.replace(/((?:©|&copy;|&#169;)\s*2001-)20\d{2}(\s*City and Borough of Juneau)/gu, "$12026$2");
	if (electionDocumentPolicyFingerprint(Buffer.from(normalized), "links", url) !== fingerprint) throw new Error("The Juneau publisher legal links require review.");
	const tree = parseStateHtml(body);
	const pending = [{ node: tree, depth: 0 }];
	let visited = 0;
	while (pending.length) {
		const { node, depth } = pending.pop()!;
		if (++visited > 40000 || depth > 64) throw new Error("The Juneau publication structure exceeds its bounds.");
		for (const child of node.childNodes ?? []) pending.push({ node: child, depth: depth + 1 });
	}
	const mains = descendants(tree, node => node.nodeName === "main" && attribute(node, "id") === "main");
	if (mains.length !== 1 || descendants(mains[0]!, node => node.nodeName === "h1" && Boolean(text(node))).map(text).join("|") !== heading) throw new Error("The Juneau publication identity requires review.");
	visible(mains[0]!);
	return mains[0]!;
}
export function validateJuneauElection(value: unknown): asserts value is JuneauElection {
	if (!exact(value, ["electionId", "electionDate", "pageUrl"]) || value.electionId !== null || typeof value.electionDate !== "string" || !/^20\d{2}-10-0[1-7]$/u.test(value.electionDate) || value.electionDate < "2026-10-06" || new Date(value.electionDate).getUTCDay() !== 2 || value.pageUrl !== candidateUrl(value.electionDate.slice(0, 4))) throw new Error("The Juneau municipal-election identity requires review.");
}
export function juneauSource(electionDate = "2026-10-06"): StateBallotSource {
	const url = candidateUrl(electionDate.slice(0, 4));
	validateJuneauElection({ electionId: null, electionDate, pageUrl: url });
	return { id: electionDate === "2026-10-06" ? "ak-juneau-2026" : `ak-juneau-municipal-${electionDate}`, stateCode: "AK", label: "Juneau certified municipal candidates", electionDate, url, pageUrl: url, countyName: "Juneau", format: "juneau-html", snapshotStorage: "external", documentUrls: [url], ballotPreview: false };
}
export function validateJuneauSource(source: StateBallotSource) {
	const expected = juneauSource(source.electionDate);
	if (!exact(source, Object.keys(expected)) || Object.entries(expected).some(([key, value]) => JSON.stringify(source[key as keyof StateBallotSource]) !== JSON.stringify(value))) throw new Error("The Juneau source configuration requires review.");
}
function offeredPage(body: string) {
	const region = main(body, "Elections", publicationUrl(), "b981689ed5275e09d558f356a998468cfac3300ad0d118f8acb5851ad423cb75");
	const links = descendants(region, node => node.nodeName === "a" && /certified-municipal-candidates/iu.test(attribute(node, "href")));
	const urls = new Set<string>();
	for (const link of links) {
		visible(link);
		const url = new URL(attribute(link, "href"), publicationUrl());
		if (url.origin !== origin || url.search || url.hash || !/^\/clerk\/certified-municipal-candidates-20\d{2}$/u.test(url.pathname) || Number(url.pathname.slice(-4)) < 2026 || !text(link)) throw new Error("The Juneau candidate publication link requires review.");
		urls.add(url.href);
	}
	if (urls.size > 10) throw new Error("The Juneau publication inventory exceeds its bounds.");
	return [...urls].sort().at(-1) ?? null;
}
function publication(body: string, url: string) {
	const region = main(body, "CERTIFIED MUNICIPAL CANDIDATES", url, "2acf0e5aa906945498c1a8e09d6a4e780681dc3a04d5163604912f473cb7765d");
	const dated = descendants(region, node => node.nodeName === "p" && text(node).startsWith("To appear on the "));
	const match = dated.length === 1 ? /^To appear on the October ([1-7]), (20\d{2}) Municipal Election ballot, candidates must have completed and submitted the required filing forms during the candidate filing period\./u.exec(text(dated[0]!)) : null;
	if (!match) throw new Error("The Juneau candidate election date requires review.");
	visible(dated[0]!);
	const election = { electionId: null, electionDate: `${match[2]}-10-0${match[1]}`, pageUrl: url };
	validateJuneauElection(election);
	const geography = descendants(region, node => node.nodeName === "p" && text(node) === "Important: Assembly districts apply only to candidate residency requirements and are different from State elections. All Assembly and Board of Education seats are elected at-large, and all qualified voters may vote in every Assembly and Board of Education race on the ballot.");
	if (geography.length !== 1) throw new Error("The Juneau at-large voting scope requires review.");
	visible(geography[0]!);
	return { region, election };
}
export function readJuneauCandidatePage(source: StateBallotSource, body: string, factory: Factory) {
	validateJuneauSource(source);
	const { region, election } = publication(body, source.pageUrl);
	if (election.electionDate !== source.electionDate) throw new Error("The Juneau candidates belong to another election.");
	const groups = descendants(region, node => node.nodeName === "div" && attribute(node, "class") === "fusion-text" && (node.childNodes ?? []).some(child => child.nodeName === "h3"));
	if (groups.length !== 2 || descendants(region, node => node.nodeName === "h3").length !== 4) throw new Error("The Juneau candidate office set requires review.");
	const offices = new Set<string>();
	const records: StateCandidateRecord[] = [];
	for (const group of groups) {
		visible(group);
		let office = "";
		let seats = 0;
		let count = 0;
		for (const node of group.childNodes ?? []) {
			if (node.nodeName === "#text" && !text(node)) continue;
			visible(node);
			if (node.nodeName === "h3") {
				if (office && !count) throw new Error("The Juneau candidate office is empty.");
				const heading = /^(Assembly Areawide|Assembly District [12]|Board of Education) – (One|Two|Three|Four) open seats? \(3-year terms?\)$/u.exec(text(node));
				if (!heading || offices.has(heading[1]!)) throw new Error("The Juneau office heading requires review.");
				office = heading[1]!;
				seats = ["One", "Two", "Three", "Four"].indexOf(heading[2]!) + 1;
				offices.add(office);
				count = 0;
				continue;
			}
			const first = (node.childNodes ?? []).find(child => child.nodeName !== "#text" || text(child));
			const label = first && first.nodeName === "b" ? /^(.*?) \[ Official Candidate Statement \]$/u.exec(text(first)) : null;
			const name = label?.[1] ?? "";
			const statements = first ? descendants(first, child => child.nodeName === "a") : [];
			if (/\b(?:withdrawn|disqualified|deceased|elected|incumbent|unopposed|write-in)\b/iu.test(text(node)) || !office || node.nodeName !== "p" || node.attrs?.length || first?.attrs?.length || first?.childNodes?.some(child => !["#text", "a"].includes(child.nodeName)) || name.length < 4 || name.length > 160 || !name.includes(" ") || !/^[\p{L}\p{M}][\p{L}\p{M} .,'’-]+$/u.test(name) || /\b(?:withdrawn|elected|incumbent|vacant|write-in|candidate)\b/iu.test(name) || statements.length !== 1 || text(statements[0]!) !== "Official Candidate Statement" || !new RegExp(`^https://juneau[.]org/wp-content/uploads/${source.electionDate.slice(0, 4)}/(?:0[1-9]|1[0-2])/[\\w.-]+[.]pdf$`, "u").test(attribute(statements[0]!, "href"))) throw new Error("The Juneau candidate row requires review.");
			visible(first!);
			visible(statements[0]!);
			const record = factory(source, { name, office, district: "", party: "", jurisdiction: "City and Borough of Juneau", scope: "local", status: "qualified" });
			if (!record || records.some(existing => existing.id === record.id) || records.length >= 100) throw new Error("The Juneau candidate identities are invalid or duplicated.");
			record.termYears = 3;
			record.seats = seats;
			records.push(record);
			count++;
		}
		if (!count) throw new Error("The Juneau candidate office is empty.");
	}
	if (["Assembly Areawide", "Assembly District 1", "Assembly District 2", "Board of Education"].some(office => !offices.has(office))) throw new Error("The Juneau candidate office set is incomplete.");
	if (descendants(region, node => node.nodeName === "a" && text(node) === "Official Candidate Statement").length !== records.length) throw new Error("The Juneau candidate statements extend beyond the reviewed offices.");
	return records;
}
export function readJuneauDiscovery(body: string, now = Date.now()) {
	if (Buffer.byteLength(body) > 6 * 1024 * 1024) throw new Error("The Juneau capture exceeds its bounds.");
	const value: unknown = JSON.parse(body);
	if (!exact(value, ["schemaVersion", "type", "policies", "index", "page"]) || value.schemaVersion !== 1 || value.type !== "juneau-candidate-capture" || JSON.stringify(value.policies) !== JSON.stringify(juneauPolicyReceipts)) throw new Error("The Juneau capture contract requires review.");
	const page = (value: unknown): Page => {
		if (!exact(value, ["url", "body", "sha256", "retrievedAt"]) || typeof value.url !== "string" || typeof value.body !== "string" || value.sha256 !== hash(value.body) || typeof value.retrievedAt !== "string" || !Number.isFinite(Date.parse(value.retrievedAt)) || new Date(value.retrievedAt).toISOString() !== value.retrievedAt || Date.parse(value.retrievedAt) > now) throw new Error("The Juneau capture provenance requires review.");
		return value as unknown as Page;
	};
	const index = page(value.index);
	if (index.url !== publicationUrl()) throw new Error("The Juneau discovery URL requires review.");
	const offered = offeredPage(index.body);
	const candidate = value.page === null ? null : page(value.page);
	if ((candidate?.url ?? null) !== offered || (candidate && candidate.retrievedAt < index.retrievedAt)) throw new Error("The Juneau candidate page was not offered by its captured index.");
	const elections = candidate ? [publication(candidate.body, candidate.url).election] : [];
	return { elections, index, page: candidate };
}
export function parseJuneauCandidateCapture(source: StateBallotSource, body: string, factory: Factory, now = Date.now(), previous?: readonly StateCandidateRecord[]) {
	const capture = readJuneauDiscovery(body, now);
	if (!capture.page) throw new Error("The Juneau candidate publication is pending.");
	const records = readJuneauCandidatePage(source, capture.page.body, factory);
	if (previous?.some(record => !records.some(item => item.id === record.id))) throw new Error("An accepted Juneau candidate disappeared; retain the snapshot for review.");
	return { records, retrievedAt: capture.page.retrievedAt, sha256: capture.page.sha256, collectionIndexSha256: capture.page.sha256, documents: [{ url: capture.page.url, sha256: capture.page.sha256, retrievedAt: capture.page.retrievedAt, includedRecordCount: records.length }] };
}
export async function fetchJuneauCycleDiscovery(options: { requestText?: TextRequest; now?: () => number; wait?: (milliseconds: number) => Promise<void> } = {}) {
	const request = options.requestText ?? fetchRemoteSourceText;
	const now = options.now ?? Date.now;
	const transport = { allowedHosts: ["juneau.org"], maxBytes: 2 * 1024 * 1024, maxRedirects: 0, timeoutMs: 15000 };
	const robots = await request(juneauPolicyReceipts[0]!.url, transport);
	if (electionDocumentPolicyFingerprint(Buffer.from(robots), "robots", juneauPolicyReceipts[0]!.url) !== juneauPolicyReceipts[0]!.sha256) throw new Error("The Juneau publisher policy requires review.");
	const policy = electionDocumentRobotsPolicy(Buffer.from(robots));
	const get = async (url: string): Promise<Page> => {
		if (!policy.allowed(url)) throw new Error("The Juneau publisher excludes this publication.");
		await (options.wait ?? wait)(policy.delay);
		const body = await request(url, transport);
		return { url, body, sha256: hash(body), retrievedAt: new Date(now()).toISOString() };
	};
	const index = await get(publicationUrl());
	const offered = offeredPage(index.body);
	const capture = JSON.stringify({ schemaVersion: 1, type: "juneau-candidate-capture", policies: juneauPolicyReceipts, index, page: offered ? await get(offered) : null });
	readJuneauDiscovery(capture, now());
	return capture;
}
export async function fetchJuneauCandidateCapture(source: StateBallotSource, options: Parameters<typeof fetchJuneauCycleDiscovery>[0] & { discovery?: string } = {}) {
	validateJuneauSource(source);
	const capture = options.discovery ?? await fetchJuneauCycleDiscovery(options);
	if (!readJuneauDiscovery(capture, (options.now ?? Date.now)()).elections.some(election => election.electionDate === source.electionDate)) throw new Error("The Juneau publication does not offer this election.");
	return capture;
}
