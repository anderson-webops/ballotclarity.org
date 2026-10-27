import type { StateHtmlNode } from "./state-ballot-html.js";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { setTimeout as wait } from "node:timers/promises";
import { fetchRemoteSourceDocument } from "./remote-json-source.js";
import { stateHtmlAttribute as attribute, stateHtmlDescendants as descendants, parseStateHtml, stateHtmlText } from "./state-ballot-html.js";

export const goffstownDiscoveryUrl = "https://www.goffstownnh.gov/325/Elections";
const origin = "https://www.goffstownnh.gov";
const hash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const exact = (value: unknown, keys: string[]): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).sort().join("|") === [...keys].sort().join("|"));
export const goffstownPolicyReceipts = {
	robots: "018c4d9e5d8a97c402950a8640595e983cc60f2b2aaf2f69aa2d48e14284aebe",
	links: "b72701cd94a83b1c0a48c21f0b10ea4168dac4ff7779bb967691049e7668d6ae",
	footer: "fbf20fd4f9e3f38c4de7a1245f2355cf04a3a877a2e2ae74e1651f81c905a606",
	copyright: "2d79038f486d7054e2042716da2f875c7117ea38eab6e849d9739ddae9510582",
	privacy: "a380ab7c0039b5a3466d48886d6f3fb022fa45a4971186320da8daa2708d0ef9",
	accessibility: "8b8d226ec33939170af5dece3d7e2e9abd4ee68bb164a21ca2bb0c6d80385172",
} as const;
interface Page { url: string; body: string; sha256: string; retrievedAt: string }
export interface GoffstownElection { electionDate: string; documentUrls: string[] }
interface Options { requestDocument?: typeof fetchRemoteSourceDocument; sleep?: (milliseconds: number) => Promise<void>; now?: () => number }
function reject(): never {
	throw new Error("The Goffstown election discovery requires review.");
}
function validDate(value: string) {
	return /^20\d{2}-11-0[2-8]$/u.test(value) && value >= "2026-11-03" && Number(value.slice(0, 4)) % 2 === 0 && new Date(`${value}T00:00:00Z`).getUTCDay() === 2;
}
export function validateGoffstownDocumentUrl(value: string, electionDate: string) {
	if (!validDate(electionDate)) return reject();
	const url = new URL(value);
	const date = `${electionDate.slice(5, 7)}${electionDate.slice(8, 10)}${electionDate.slice(2, 4)}`;
	if (url.href !== value || url.origin !== origin || url.username || url.password || url.port || url.search || url.hash || !new RegExp(`^/DocumentCenter/View/[1-9]\\d{0,8}/Goffstown-SAMPLE-BALLOT---State-General-Election-${date}-PDF$`, "u").test(url.pathname)) return reject();
}
export function goffstownPolicyFingerprint(body: Buffer, format: "links" | "region", url: string, region?: string, now = Date.now()) {
	if (body.byteLength > 2 * 1024 * 1024) return reject();
	let normalized = new TextDecoder("utf-8", { fatal: true }).decode(body);
	for (const pattern of [/(1997-)(20\d{2})(\s+CivicPlus\b)/gu, /(2006-)(20\d{2})(\s+Goffstown, NH and its representatives\b)/gu]) {
		normalized = normalized.replace(pattern, (_match, prefix: string, year: string, suffix: string) => {
			if (Number(year) < 2026 || Number(year) > new Date(now).getUTCFullYear()) return reject();
			return `${prefix}YEAR${suffix}`;
		});
	}
	const document = parseStateHtml(normalized);
	const pending = [{ node: document, depth: 0 }];
	let visited = 0;
	while (pending.length) {
		const item = pending.pop()!;
		if (++visited > 80000 || item.depth > 64) return reject();
		for (const node of item.node.childNodes ?? []) pending.push({ node, depth: item.depth + 1 });
	}
	function text(node: StateHtmlNode): string {
		if (["script", "style", "noscript", "template", "form"].includes(node.nodeName)) return "";
		if (node.nodeName === "#text") return node.value ?? "";
		return (node.nodeName === "a" ? ` ${attribute(node, "href")} ` : "") + (node.childNodes ?? []).map(text).join(" ");
	}
	if (format === "links") {
		const links = [...new Set(descendants(document, node => node.nodeName === "a").filter(node => /privacy|disclaimer|copyright|licen[cs]e|terms|polic(?:y|ies)/iu.test(`${stateHtmlText(node)} ${attribute(node, "href")}`)).map(node => new URL(attribute(node, "href"), url).href))].sort();
		const footers = descendants(document, node => node.nodeName === "footer" || attribute(node, "role") === "contentinfo" || /(?:^|\s)(?:site-)?footer(?:\s|$)/u.test(attribute(node, "class"))).map(node => text(node).replace(/\s+/gu, " ").trim());
		return hash(JSON.stringify({ links, footers }));
	}
	if (!region || !/^[a-z][\w.-]{0,100}$/iu.test(region)) return reject();
	const regions = descendants(document, node => attribute(node, "id") === region);
	if (regions.length !== 1) return reject();
	const content = text(regions[0]!).replace(/\s+/gu, " ").trim();
	if (content.length < 50) return reject();
	return hash(content);
}
function checkedRobots(body: string) {
	if (Buffer.byteLength(body) > 32000 || hash(body.replace(/\r\n?/gu, "\n")) !== goffstownPolicyReceipts.robots) return reject();
}
function checkedPage(page: Page, now: number, policy?: "copyright" | "privacy" | "accessibility") {
	if (goffstownPolicyFingerprint(Buffer.from(page.body), "links", page.url, undefined, now) !== goffstownPolicyReceipts.links || goffstownPolicyFingerprint(Buffer.from(page.body), "region", page.url, "footerContainerTS", now) !== goffstownPolicyReceipts.footer || (policy && goffstownPolicyFingerprint(Buffer.from(page.body), "region", page.url, "mainWrapTS", now) !== goffstownPolicyReceipts[policy])) return reject();
}
export function readGoffstownOfferedElections(body: string): GoffstownElection[] {
	if (Buffer.byteLength(body) > 2 * 1024 * 1024) return reject();
	const document = parseStateHtml(body);
	const pending = [{ node: document, depth: 0 }];
	let visited = 0;
	while (pending.length) {
		const item = pending.pop()!;
		if (++visited > 80000 || item.depth > 64) return reject();
		for (const node of item.node.childNodes ?? []) pending.push({ node, depth: item.depth + 1 });
	}
	const elections: GoffstownElection[] = [];
	const sections = descendants(document, node => attribute(node, "class").split(/\s+/u).includes("relatedDocumentsSection"));
	for (const section of sections) {
		const headings = descendants(section, node => ["h2", "h3", "h4"].includes(node.nodeName)).map(node => stateHtmlText(node).replace(/\s+/gu, " ").trim());
		if (!headings.some(heading => heading.startsWith("State General Election"))) continue;
		const match = headings.length === 1 ? /^State General Election - November ([2-8]), (20\d{2})$/u.exec(headings[0]!) : null;
		const electionDate = match ? `${match[2]}-11-0${match[1]}` : "";
		if (!validDate(electionDate) || elections.some(election => election.electionDate === electionDate)) return reject();
		const documentUrls: string[] = [];
		for (const anchor of descendants(section, node => node.nodeName === "a")) {
			const label = stateHtmlText(anchor).replace(/\s+/gu, " ").trim();
			if (label !== `Goffstown SAMPLE BALLOT - State General Election 11/0${match![1]}/${match![2]!.slice(2)} (PDF)`) return reject();
			const url = new URL(attribute(anchor, "href"), goffstownDiscoveryUrl).href;
			validateGoffstownDocumentUrl(url, electionDate);
			if (documentUrls.includes(url)) return reject();
			documentUrls.push(url);
		}
		if (documentUrls.length > 1) return reject();
		elections.push({ electionDate, documentUrls });
	}
	if (elections.length > 4) return reject();
	return elections.sort((first, second) => first.electionDate.localeCompare(second.electionDate));
}
export function readGoffstownCycleDiscovery(body: string, now = Date.now()) {
	if (Buffer.byteLength(body) > 10 * 1024 * 1024 || !Number.isFinite(now)) return reject();
	const value: unknown = JSON.parse(body);
	if (!exact(value, ["schemaVersion", "type", "index", "policies"]) || value.schemaVersion !== 1 || value.type !== "goffstown-election-discovery" || !Array.isArray(value.policies) || value.policies.length !== 4) return reject();
	function page(value: unknown, url: string): Page {
		if (!exact(value, ["url", "body", "sha256", "retrievedAt"]) || value.url !== url || typeof value.body !== "string" || Buffer.byteLength(value.body) > 2 * 1024 * 1024 || value.sha256 !== hash(value.body) || typeof value.retrievedAt !== "string" || !Number.isFinite(Date.parse(value.retrievedAt)) || new Date(value.retrievedAt).toISOString() !== value.retrievedAt || Date.parse(value.retrievedAt) > now) return reject();
		return value as unknown as Page;
	}
	const robots = page(value.policies[0], `${origin}/robots.txt`);
	checkedRobots(robots.body);
	const index = page(value.index, goffstownDiscoveryUrl);
	checkedPage(index, now);
	for (const [offset, name] of (["copyright", "privacy", "accessibility"] as const).entries()) checkedPage(page(value.policies[offset + 1], `${origin}/${name}`), now, name);
	return { index, elections: readGoffstownOfferedElections(index.body) };
}
export async function fetchGoffstownCycleDiscovery(options: Options = {}) {
	const request = options.requestDocument ?? fetchRemoteSourceDocument;
	const sleep = options.sleep ?? (milliseconds => wait(milliseconds));
	const now = options.now ?? Date.now;
	let requested = false;
	async function page(url: string, contentType: string): Promise<Page> {
		if (requested) await sleep(11000);
		requested = true;
		const reply = await request(url, { allowedHosts: ["www.goffstownnh.gov"], maxBytes: 2 * 1024 * 1024, timeoutMs: 45000 });
		if (reply.status !== 200 || reply.contentType !== contentType) return reject();
		const body = new TextDecoder("utf-8", { fatal: true }).decode(reply.body);
		return { url, body, sha256: hash(reply.body), retrievedAt: new Date(now()).toISOString() };
	}
	const robots = await page(`${origin}/robots.txt`, "text/plain");
	checkedRobots(robots.body);
	const index = await page(goffstownDiscoveryUrl, "text/html");
	checkedPage(index, now());
	readGoffstownOfferedElections(index.body);
	const policies = [robots];
	for (const name of ["copyright", "privacy", "accessibility"] as const) {
		const policy = await page(`${origin}/${name}`, "text/html");
		checkedPage(policy, now(), name);
		policies.push(policy);
	}
	const body = JSON.stringify({ schemaVersion: 1, type: "goffstown-election-discovery", index, policies });
	readGoffstownCycleDiscovery(body, now());
	return body;
}
