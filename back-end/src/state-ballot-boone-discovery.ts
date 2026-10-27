import type { StateBallotSource } from "./state-ballot-sources.js";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { parseStateHtml, stateHtmlAttribute, stateHtmlDescendants, stateHtmlText } from "./state-ballot-html.js";

export const booneOrigin = "https://boonecounty.in.gov";
export const booneDiscoveryUrl = `${booneOrigin}/offices/clerk/election-information/`;
export const booneRobotsSha256 = "609142149eadf0d41405e82c23486e83972d9e62e6e3d403ab97d5bebec26727";
export const booneHash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const rightsNotice = "Boone County Government. All Rights Reserved.";
const serviceLinks = [["File for a Marriage License", `${booneOrigin}/offices/clerk/marriage-licenses/`], ["Marriage Licenses", `${booneOrigin}/offices/clerk/marriage-licenses/`]];
export const boonePolicySha256 = booneHash(JSON.stringify({ rightsNotice, legalLinks: serviceLinks }));
const exact = (value: unknown, keys: string[]): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).sort().join("|") === [...keys].sort().join("|"));
const digest = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
const clean = (value: string) => value.normalize("NFKC").replace(/\s+/gu, " ").trim();
const text = (node: Parameters<typeof stateHtmlText>[0]) => clean(stateHtmlText(node));
function reject(): never {
	throw new Error("The Boone County candidate publication requires review.");
}
interface Offer { year: string; workbookUrl: string; ballotUrl?: string }
export interface BooneElection { electionId: null; electionDate: string; pageUrl: string; booneDocuments: { url: string; sha256: string; status: 200 | 404 }[] }
export const booneDocumentDigest = (documents: BooneElection["booneDocuments"]) => booneHash(JSON.stringify(documents));

function document(body: string) {
	if (Buffer.byteLength(body) > 2 * 1024 * 1024 || body.includes("\uFFFD") || /_Incapsula_Resource|checking your browser|access denied/iu.test(body)) return reject();
	const dom = parseStateHtml(body);
	const pending = [{ node: dom, depth: 0 }];
	let visited = 0;
	while (pending.length) {
		const { node, depth } = pending.pop()!;
		if (++visited > 20000 || depth > 64) return reject();
		for (const child of node.childNodes ?? []) pending.push({ node: child, depth: depth + 1 });
	}
	return dom;
}
function visible(dom: Parameters<typeof stateHtmlText>[0], target: Parameters<typeof stateHtmlText>[0]) {
	const pending = [{ node: dom, hidden: false }];
	while (pending.length) {
		const current = pending.pop()!;
		const hidden = current.hidden || Boolean(current.node.attrs?.some(attribute => attribute.name === "hidden" || attribute.name === "inert" || (attribute.name === "aria-hidden" && attribute.value === "true") || (attribute.name === "style" && /display\s*:\s*none|visibility\s*:\s*(?:hidden|collapse)/iu.test(attribute.value))));
		if (current.node === target) return !hidden;
		for (const node of current.node.childNodes ?? []) pending.push({ node, hidden });
	}
	return false;
}
export function boonePolicyFingerprint(body: string) {
	const dom = document(body);
	const visible = text(dom);
	if (visible.split(rightsNotice).length !== 2 || /©|copyright|all rights reserved|privacy policy|terms of (?:use|service)|automated access|scrap(?:e|ing)|crawling|licen[cs]e to (?:use|reproduce)/iu.test(visible.replace(rightsNotice, ""))) return reject();
	const legalLinks = stateHtmlDescendants(dom, node => node.nodeName === "a" && /privacy|terms|copyright|licen[cs]e|disclaim|accessib|legal/iu.test(`${text(node)} ${stateHtmlAttribute(node, "href")}`)).map(node => [text(node), new URL(stateHtmlAttribute(node, "href"), booneOrigin).href]);
	return booneHash(JSON.stringify({ rightsNotice, legalLinks }));
}
function validDate(value: unknown): value is string {
	return typeof value === "string" && /^20\d{2}-11-0[2-8]$/u.test(value) && value >= "2026-11-03" && new Date(`${value}T00:00:00Z`).getUTCDay() === 2;
}
export function booneSource(electionDate: string): StateBallotSource {
	if (!validDate(electionDate)) return reject();
	return { stateCode: "IN", id: electionDate === "2026-11-03" ? "in-boone-2026" : `in-boone-general-${electionDate}`, label: "Boone County Clerk", electionDate, url: booneDiscoveryUrl, pageUrl: booneDiscoveryUrl, format: "boone-xlsx", snapshotStorage: "external", countyName: "Boone County", defaultPriority: -20, ballotPreview: false };
}
export function validateBooneSource(source: StateBallotSource) {
	const expected = booneSource(source.electionDate);
	if (!exact(source, Object.keys(expected)) || Object.entries(expected).some(([key, value]) => source[key as keyof StateBallotSource] !== value)) return reject();
}
export function validateBooneDocumentUrl(value: string, role: "workbook" | "ballots", year: string) {
	const url = new URL(value);
	const filename = decodeURIComponent(url.pathname.split("/").at(-1)!);
	if (url.origin !== booneOrigin || url.username || url.password || url.search || url.hash || url.href !== value || !/^\/wp-content\/uploads\/20\d{2}\/(?:0[1-9]|1[0-2])\//u.test(url.pathname) || !/^[A-Za-z0-9][\w .()-]{0,180}\.(?:xlsx|pdf)$/u.test(filename) || filename.includes("..") || !filename.endsWith(role === "workbook" ? ".xlsx" : ".pdf") || [...filename.matchAll(/20\d{2}/gu)].some(match => match[0] !== year)) return reject();
}
export function readBooneCandidateIndex(body: string) {
	const dom = document(body);
	const titles = stateHtmlDescendants(dom, node => node.nodeName === "title");
	if (titles.length !== 1 || text(titles[0]!) !== "Clerk Election Info - Boone County, Indiana" || boonePolicyFingerprint(body) !== boonePolicySha256) return reject();
	const workbooks = new Map<string, string>();
	const ballots = new Map<string, string>();
	for (const anchor of stateHtmlDescendants(dom, node => node.nodeName === "a")) {
		const label = text(anchor);
		const workbook = /^(20\d{2}) General Candidates$/u.exec(label);
		const ballot = /^(20\d{2}) General Election Sample Ballots$/u.exec(label);
		const year = workbook?.[1] ?? ballot?.[1];
		if (!year) continue;
		if (year < "2026") continue;
		if (!visible(dom, anchor) || anchor.attrs?.some(attribute => attribute.name === "disabled")) return reject();
		const url = new URL(stateHtmlAttribute(anchor, "href"), booneOrigin).href;
		validateBooneDocumentUrl(url, workbook ? "workbook" : "ballots", year);
		const entries = workbook ? workbooks : ballots;
		if (entries.has(year)) return reject();
		entries.set(year, url);
	}
	if (workbooks.size > 8 || ballots.size > 8) return reject();
	return [...workbooks].sort().map(([year, workbookUrl]) => {
		const headings = stateHtmlDescendants(dom, node => /^h[1-6]$/u.test(node.nodeName) && text(node) === `${year} General Election Candidates That Have Filed`);
		if (headings.length !== 1 || !visible(dom, headings[0]!)) return reject();
		return { year, workbookUrl, ...(ballots.has(year) ? { ballotUrl: ballots.get(year)! } : {}) } satisfies Offer;
	});
}
export function readBooneBallotDate(body: string, year: string) {
	if (Buffer.byteLength(body) > 4 * 1024 * 1024 || body.includes("\uFFFD")) return reject();
	const pages = body.split("\f").filter(page => page.trim());
	if (!pages.length || pages.length > 1000) return reject();
	const headers = pages.filter(page => page.includes("OFFICIAL BALLOT"));
	if (!headers.length) return reject();
	const dates = new Set<string>();
	for (const page of headers) {
		if (!page.includes("GENERAL ELECTION") || !page.includes("BOONE COUNTY, INDIANA")) return reject();
		const boundary = page.indexOf("===========");
		if (boundary < 0 || boundary > 4000) return reject();
		const matches = [...page.slice(0, boundary).matchAll(/\b(JANUARY|FEBRUARY|MARCH|APRIL|MAY|JUNE|JULY|AUGUST|SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER)\s+([1-3]?\d),\s+(20\d{2})\b/gu)];
		if (matches.length !== 1 || matches[0]![1] !== "NOVEMBER" || matches[0]![3] !== year) return reject();
		const date = `${year}-11-${matches[0]![2]!.padStart(2, "0")}`;
		if (!validDate(date)) return reject();
		dates.add(date);
	}
	if (dates.size !== 1) return reject();
	return [...dates][0]!;
}
export function validateBooneElection(value: unknown): asserts value is BooneElection {
	if (!exact(value, ["electionId", "electionDate", "pageUrl", "booneDocuments"]) || value.electionId !== null || !validDate(value.electionDate) || value.pageUrl !== booneDiscoveryUrl || !Array.isArray(value.booneDocuments) || value.booneDocuments.length !== 2) return reject();
	for (const [position, item] of value.booneDocuments.entries()) {
		if (!exact(item, ["url", "sha256", "status"]) || typeof item.url !== "string" || !digest(item.sha256) || (item.status !== 200 && item.status !== 404) || (position === 1 && item.status !== 200)) return reject();
		validateBooneDocumentUrl(item.url, position === 0 ? "workbook" : "ballots", value.electionDate.slice(0, 4));
	}
}

export function validateBooneStoredSnapshot(source: StateBallotSource, data: Record<string, unknown>) {
	validateBooneSource(source);
	if (!Array.isArray(data.documents) || data.documents.length !== 2 || data.sourceAsOf !== undefined || data.sourceAsOfDate !== undefined) return reject();
	const documents = data.documents.map((item: unknown, position) => {
		if (!exact(item, ["url", "sha256", "retrievedAt", "includedRecordCount"]) || typeof item.url !== "string" || !digest(item.sha256) || item.includedRecordCount !== (position === 0 ? data.recordCount : 0)) return reject();
		validateBooneDocumentUrl(item.url, position === 0 ? "workbook" : "ballots", source.electionDate.slice(0, 4));
		return { url: item.url, sha256: item.sha256, status: 200 as const };
	});
	if (data.collectionIndexSha256 !== booneDocumentDigest(documents) || data.sourceSha256 !== booneHash(JSON.stringify(documents.map(({ url, sha256 }) => ({ url, sha256 })))) || !Array.isArray(data.records)) return reject();
	const allowed = ["id", "name", "office", "party", "district", "scope", "status", "sourceStatus", "jurisdiction", "sourceDistrictLabel"];
	for (const item of data.records) {
		if (!item || typeof item !== "object" || Array.isArray(item)) return reject();
		const record = item as Record<string, unknown>;
		if (Object.keys(record).some(key => !allowed.includes(key)) || typeof record.name !== "string" || typeof record.office !== "string" || record.scope !== "local" || record.district !== "" || record.jurisdiction !== "Boone County" || (record.party !== undefined && !["Republican", "Democratic", "Independent"].includes(String(record.party))) || (!(record.status === "filed" && record.sourceStatus === undefined) && !(record.status === "inactive" && record.sourceStatus === "Do not put on ballot"))) return reject();
		const identity = [source.stateCode, source.electionDate, record.office.toLowerCase(), "", record.name.toLowerCase(), String(record.party ?? "").toLowerCase(), "boone county"];
		if (record.id !== booneHash(JSON.stringify(identity)).slice(0, 24)) return reject();
	}
}
