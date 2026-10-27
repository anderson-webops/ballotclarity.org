import type { StateCandidateRecord } from "./state-ballot-records.js";
import type { StateBallotSnapshot } from "./state-ballot-repository.js";
import type { StateBallotSource } from "./state-ballot-sources.js";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { setTimeout as wait } from "node:timers/promises";
import { maineHouseCandidateUrl, readMaineHouseCandidates } from "./maine-house-candidates.js";
import { fetchRemoteSourceText } from "./remote-json-source.js";
import { stateHtmlAttribute as attribute, stateHtmlDescendants as descendants, parseStateHtml, stateHtmlText } from "./state-ballot-html.js";
import { StateBallotAwaitingRecordsError } from "./state-ballot-source-state.js";

interface Page { url: string; body: string; sha256: string; retrievedAt: string }
interface Options { requestText?: typeof fetchRemoteSourceText; sleep?: (milliseconds: number) => Promise<void>; now?: () => number; discovery?: string; onPage?: (page: Page) => Promise<void> }
export interface MaineHouseElection { electionId: null; electionDate: string; pageUrl: string; maineHouseLegislature: number; maineHouseContentSha256: string }
export const maineHouseUrls = {
	robots: "https://mainelegislature.org/robots.txt",
	home: "https://mainelegislature.org/",
	houseHome: "https://mainelegislature.org/house/house/",
	policyHub: "https://mainelegislature.org/lio/special-accommodations/",
	disclaimer: "https://mainelegislature.org/lio/legislative-information-office-disclaimer/31",
	constitution: "https://mainelegislature.org/ros/LawsOfMaine/App/views/constitution.html",
	index: maineHouseCandidateUrl,
} as const;
export const maineHouseRobotsSha256 = "77b8e93a1e9a3052fa00422f121a650fa2a0c378ff632da0a89dd40ea537e62a";
export const maineHouseConstitutionSha256 = "2794ee614f106b55d228ab96c2a7968009caa3acd06dbaf8c2314ff1d612835d";
export const maineHousePolicySha256: Readonly<Record<"home" | "houseHome" | "policyHub" | "disclaimer" | "index", string>> = { home: "7adfdf79aeb77407f8a22a683908082d8324eddc7f80d079de45a8a16b46227e", houseHome: "748fb80ac2bb4dd5db25ba96ae4b55327f38ca0d63a05216fa3501bc6041910d", policyHub: "82c68355521e32080bca6850db2b55336ce9c7d39b86f67f236cfb0cc552c61e", disclaimer: "737b3d0da033f7827df85fc1567b24ea526ea617bfd0ae51dfdd7e1c210d3041", index: "748fb80ac2bb4dd5db25ba96ae4b55327f38ca0d63a05216fa3501bc6041910d" };
const hash = (body: string) => createHash("sha256").update(body).digest("hex");
const exact = (value: unknown, keys: string[]): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).sort().join(",") === [...keys].sort().join(","));
const text = (node: Parameters<typeof stateHtmlText>[0]) => stateHtmlText(node).replace(/\s+/gu, " ").trim();
function reject(): never {
	throw new Error("The Maine House collection contract requires review.");
}
export function maineHouseScheduledDate(legislature: number) {
	if (!Number.isInteger(legislature) || legislature < 133 || legislature > 169) return reject();
	const year = 2026 + 2 * (legislature - 133);
	const firstMonday = 1 + (8 - new Date(`${year}-11-01T00:00:00Z`).getUTCDay()) % 7;
	return `${year}-11-${String(firstMonday + 1).padStart(2, "0")}`;
}
export function maineHouseLegislatureForDate(date: string) {
	if (!/^20\d{2}-11-0[2-8]$/u.test(date)) return reject();
	const legislature = 133 + (Number(date.slice(0, 4)) - 2026) / 2;
	if (maineHouseScheduledDate(legislature) !== date) return reject();
	return legislature;
}
export function maineHouseSource(electionDate: string): StateBallotSource {
	maineHouseLegislatureForDate(electionDate);
	return { stateCode: "ME", id: electionDate === "2026-11-03" ? "me-house-clerk-2026" : `me-house-clerk-general-${electionDate}`, label: "Maine House Clerk", electionDate, url: maineHouseCandidateUrl, pageUrl: maineHouseCandidateUrl, format: "maine-house-html", snapshotStorage: "external", defaultPriority: -30, ballotPreview: false, scopeNotice: "Unofficial House list." };
}
export function validateMaineHouseSource(source: StateBallotSource) {
	const expected = maineHouseSource(source.electionDate);
	if (Object.keys(source).sort().join(",") !== Object.keys(expected).sort().join(",") || Object.entries(expected).some(([key, value]) => source[key as keyof StateBallotSource] !== value)) return reject();
}
export function maineHousePolicyFingerprint(body: string, kind: keyof typeof maineHousePolicySha256, now = Date.now()) {
	if (Buffer.byteLength(body) > 2 * 1024 * 1024 || body.includes("\uFFFD")) return reject();
	const dom = parseStateHtml(body);
	const normalize = (value: string) => value.replace(/© (20\d{2})/gu, (_match, year: string) => {
		if (Number(year) < 2020 || Number(year) > new Date(now).getUTCFullYear()) return reject();
		return "© [copyright year]";
	}).replace(/Last Edited: (?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday), [A-Z][a-z]+ \d{1,2}, 20\d{2}/gu, "[site edit date]");
	let footers = descendants(dom, node => node.nodeName === "footer");
	if (!footers.length) footers = descendants(dom, node => attribute(node, "id") === "footer");
	if (footers.length !== 1) return reject();
	const legalLinks = descendants(dom, node => node.nodeName === "a" && /privacy|copyright|terms|conditions|disclaimer|accessibility|special-accommodations/iu.test(`${text(node)} ${attribute(node, "href")}`)).map(node => [text(node), new URL(attribute(node, "href"), "https://mainelegislature.org").href]);
	const contents = ["disclaimer", "policyHub"].includes(kind) ? descendants(dom, node => attribute(node, "id") === "content") : [];
	if (["disclaimer", "policyHub"].includes(kind) && contents.length !== 1) return reject();
	const content = contents[0];
	return hash(JSON.stringify({ footer: normalize(text(footers[0]!)), legalLinks, ...(content ? { content: text(content), images: descendants(content, node => node.nodeName === "img").map(node => [attribute(node, "src"), attribute(node, "alt")]) } : {}) }));
}
export function validateMaineHouseElection(value: unknown): asserts value is MaineHouseElection {
	if (!exact(value, ["electionId", "electionDate", "pageUrl", "maineHouseLegislature", "maineHouseContentSha256"]) || value.electionId !== null || value.pageUrl !== maineHouseCandidateUrl || typeof value.electionDate !== "string" || maineHouseLegislatureForDate(value.electionDate) !== value.maineHouseLegislature || typeof value.maineHouseContentSha256 !== "string" || !/^[a-f0-9]{64}$/u.test(value.maineHouseContentSha256)) return reject();
}
export function readMaineHouseDiscovery(body: string, now = Date.now()) {
	if (Buffer.byteLength(body) > 12 * 1024 * 1024) return reject();
	const value: unknown = JSON.parse(body);
	if (!exact(value, ["schemaVersion", "type", ...Object.keys(maineHouseUrls)]) || value.schemaVersion !== 1 || value.type !== "maine-house-discovery") return reject();
	const pages = {} as Record<keyof typeof maineHouseUrls, Page>;
	let previousCaptureTime = -Infinity;
	for (const [key, url] of Object.entries(maineHouseUrls)) {
		const page = value[key];
		if (!exact(page, ["url", "body", "sha256", "retrievedAt"]) || page.url !== url || typeof page.body !== "string" || Buffer.byteLength(page.body) > 2 * 1024 * 1024 || page.sha256 !== hash(page.body) || typeof page.retrievedAt !== "string" || !Number.isFinite(Date.parse(page.retrievedAt)) || new Date(page.retrievedAt).toISOString() !== page.retrievedAt || Date.parse(page.retrievedAt) > now) return reject();
		pages[key as keyof typeof maineHouseUrls] = page as unknown as Page;
		if (Date.parse(page.retrievedAt) < previousCaptureTime) return reject();
		previousCaptureTime = Date.parse(page.retrievedAt);
	}
	if (pages.robots.sha256 !== maineHouseRobotsSha256 || pages.constitution.sha256 !== maineHouseConstitutionSha256) return reject();
	for (const key of Object.keys(maineHousePolicySha256) as (keyof typeof maineHousePolicySha256)[]) {
		if (maineHousePolicyFingerprint(pages[key].body, key, now) !== maineHousePolicySha256[key]) return reject();
	}
	const parsed = readMaineHouseCandidates(pages.index.body);
	const electionDate = maineHouseScheduledDate(parsed.legislature);
	const contentSha256 = hash(JSON.stringify(parsed));
	const elections: MaineHouseElection[] = parsed.records.length ? [{ electionId: null, electionDate, pageUrl: maineHouseCandidateUrl, maineHouseLegislature: parsed.legislature, maineHouseContentSha256: contentSha256 }] : [];
	for (const election of elections) validateMaineHouseElection(election);
	return { pages, parsed, elections, contentSha256 };
}
export async function fetchMaineHouseDiscovery(options: Options = {}) {
	const request = options.requestText ?? fetchRemoteSourceText;
	const now = options.now ?? Date.now;
	const pages = {} as Record<keyof typeof maineHouseUrls, Page>;
	let size = 0;
	for (const [key, url] of Object.entries(maineHouseUrls)) {
		if (size) await (options.sleep ?? wait)(1000);
		const body = await request(url, { allowedHosts: ["mainelegislature.org"], maxBytes: 2 * 1024 * 1024, maxRedirects: 0, timeoutMs: 30000 });
		size += Buffer.byteLength(body);
		if (size > 12 * 1024 * 1024) return reject();
		const page = { url, body, sha256: hash(body), retrievedAt: new Date(now()).toISOString() };
		await options.onPage?.(page);
		if (key === "robots" && page.sha256 !== maineHouseRobotsSha256) return reject();
		if (key === "constitution" && page.sha256 !== maineHouseConstitutionSha256) return reject();
		if (key in maineHousePolicySha256 && maineHousePolicyFingerprint(body, key as keyof typeof maineHousePolicySha256, now()) !== maineHousePolicySha256[key as keyof typeof maineHousePolicySha256]) return reject();
		pages[key as keyof typeof maineHouseUrls] = page;
	}
	const body = JSON.stringify({ schemaVersion: 1, type: "maine-house-discovery", ...pages });
	readMaineHouseDiscovery(body, now());
	return body;
}
export async function fetchMaineHouseCapture(source: StateBallotSource, options: Options = {}) {
	validateMaineHouseSource(source);
	const discovery = options.discovery ?? await fetchMaineHouseDiscovery(options);
	readMaineHouseDiscovery(discovery, (options.now ?? Date.now)());
	return JSON.stringify({ schemaVersion: 1, type: "maine-house-capture", electionDate: source.electionDate, discovery: JSON.parse(discovery) });
}
export function maineHouseRecord(source: StateBallotSource, input: ReturnType<typeof readMaineHouseCandidates>["records"][number]): StateCandidateRecord {
	const name = input.name.normalize("NFKC").replace(/\s+/gu, " ").trim();
	const party = input.party.normalize("NFKC").replace(/\s+/gu, " ").trim();
	const office = "Maine House of Representatives";
	const district = String(input.district);
	const id = hash(JSON.stringify([source.stateCode, source.electionDate, office.toLowerCase(), district, name.toLowerCase(), party.toLowerCase()])).slice(0, 24);
	return { id, name, office, party, scope: "state-house", district, status: "listed", sourceStatus: "Unofficial", sourceDistrictLabel: `District ${input.district}`, ...(input.incumbent ? { incumbent: true } : {}) };
}
export function parseMaineHouseCapture(source: StateBallotSource, body: string, now = Date.now(), previous?: StateBallotSnapshot) {
	validateMaineHouseSource(source);
	if (Buffer.byteLength(body) > 12 * 1024 * 1024) return reject();
	const value: unknown = JSON.parse(body);
	if (!exact(value, ["schemaVersion", "type", "electionDate", "discovery"]) || value.schemaVersion !== 1 || value.type !== "maine-house-capture" || value.electionDate !== source.electionDate) return reject();
	const discovery = readMaineHouseDiscovery(JSON.stringify(value.discovery), now);
	if (maineHouseScheduledDate(discovery.parsed.legislature) !== source.electionDate || !discovery.parsed.records.length) {
		if (previous?.records.length) return reject();
		throw new StateBallotAwaitingRecordsError(source.id);
	}
	const records = discovery.parsed.records.map(input => maineHouseRecord(source, input));
	if (previous?.records.some(record => !records.some(item => item.id === record.id))) return reject();
	const documents = [discovery.pages.index, discovery.pages.constitution, discovery.pages.disclaimer].map((page, index) => ({ url: page.url, sha256: page.sha256, retrievedAt: page.retrievedAt, includedRecordCount: index ? 0 : records.length }));
	if (previous && Math.min(...documents.map(document => Date.parse(document.retrievedAt))) < Date.parse(previous.retrievedAt)) return reject();
	return { records, documents, retrievedAt: new Date(Math.min(...documents.map(document => Date.parse(document.retrievedAt)))).toISOString(), sha256: hash(JSON.stringify(documents.map(({ url, sha256 }) => ({ url, sha256 })))), collectionIndexSha256: discovery.contentSha256 };
}
export function validateMaineHouseSnapshot(source: StateBallotSource, data: Record<string, unknown>) {
	validateMaineHouseSource(source);
	if (!Array.isArray(data.records) || !data.records.length || data.records.length > 1500 || !Array.isArray(data.documents) || data.documents.length !== 3 || data.sourceAsOf !== undefined || data.sourceAsOfDate !== undefined || data.ballotQuestions !== undefined) return reject();
	const documents = data.documents;
	for (const [index, url] of [maineHouseUrls.index, maineHouseUrls.constitution, maineHouseUrls.disclaimer].entries()) {
		if (documents[index]?.url !== url || documents[index]?.includedRecordCount !== (index ? 0 : data.records.length)) return reject();
	}
	if (documents[1]?.sha256 !== maineHouseConstitutionSha256) return reject();
	for (const input of data.records) {
		if (!input || typeof input !== "object" || typeof input.name !== "string" || typeof input.district !== "string" || !/^(?:[1-9]|[1-9]\d|1[0-4]\d|15[01])$/u.test(input.district) || !["Democrat", "Republican", "Unenrolled", "Independent", "No Labels"].includes(input.party) || (input.incumbent !== undefined && input.incumbent !== true)) return reject();
		const expected = maineHouseRecord(source, { id: "", name: input.name, district: Number(input.district), party: input.party, partyCode: "", incumbent: input.incumbent === true });
		const keys = Object.keys(expected).filter(key => expected[key as keyof StateCandidateRecord] !== undefined).sort();
		if (Object.keys(input).sort().join(",") !== keys.join(",") || keys.some(key => input[key] !== expected[key as keyof StateCandidateRecord])) return reject();
	}
}
