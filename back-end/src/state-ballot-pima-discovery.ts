import type { StateHtmlNode } from "./state-ballot-html.js";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { setTimeout as wait } from "node:timers/promises";
import { fetchRemoteSourceDocument } from "./remote-json-source.js";
import { stateHtmlAttribute as attribute, stateHtmlDescendants as descendants, parseStateHtml, stateHtmlText } from "./state-ballot-html.js";

export const pimaDiscoveryUrl = "https://www.pima.gov/elections";
const origin = "https://www.pima.gov";
const assignment = "window.__PRELOADED_STATE__=";
const hash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const exact = (value: unknown, keys: string[]): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).sort().join("|") === [...keys].sort().join("|"));
const publicLinkFields = /privacy|disclaimer|terms|copyright|conditions|legal|accessibility/iu;
const policyPaths = ["/privacy-statement-hipaa-notice-of-privacy-practices", "/disclaimer"] as const;
const offeredPolicyPaths = ["/124/Privacy-Policy", "/125/Disclaimer"] as const;
export const pimaPolicyReceipts = {
	robots: "5b070e93aa21b3328307a100a4e880ccaedbbc5fbd7954d490086c9614860156",
	contentRobots: "8f1aa9862d30461c8aae8c477f85e411a2e541a7fbf7556caa2f78ed821b6239",
	links: "7752c67a78d3e82bda6c4fd73bb54a59afa86b822573c87078a43f3526d8382d",
	privacy: "a1d3eaaad6af93e41244dae7ac2f666caebbee32343fc9801537e82fa8229c54",
	disclaimer: "f845d96a9ffcebe7b3448af381796531c5b8ed582f9ee409cab10b4a3e1b1205",
} as const;
interface Page { url: string; body: string; sha256: string; retrievedAt: string }
interface Redirect { url: string; status: 301; location: string; retrievedAt: string }
interface Options { requestDocument?: typeof fetchRemoteSourceDocument; sleep?: (milliseconds: number) => Promise<void>; now?: () => number }
export interface PimaOfferedElection { electionDate: string; documents: { kind: "candidates" | "write-ins"; url: string }[] }
function reject(): never {
	throw new Error("The Pima County election discovery requires review.");
}
function bounded(body: string) {
	if (Buffer.byteLength(body) > 2 * 1024 * 1024 || body.includes("\uFFFD")) return reject();
	const document = parseStateHtml(body);
	const pending = [{ node: document, depth: 0 }];
	let visited = 0;
	while (pending.length) {
		const item = pending.pop()!;
		if (++visited > 80000 || item.depth > 64) return reject();
		for (const node of item.node.childNodes ?? []) pending.push({ node, depth: item.depth + 1 });
	}
	return document;
}
export function readPimaPublicState(body: string): Record<string, unknown>[] {
	const scripts = descendants(bounded(body), node => node.nodeName === "script").map(node => (node.childNodes ?? []).map(child => child.value ?? "").join("").trim()).filter(value => value.startsWith(assignment));
	if (scripts.length !== 1) return reject();
	const literal = scripts[0]!.slice(assignment.length);
	if (!literal.startsWith("'") || !literal.endsWith("'") || literal.length < 4) return reject();
	let decoded = "";
	for (let position = 1; position < literal.length - 1; position++) {
		const character = literal[position]!;
		if (character === "'" || character.charCodeAt(0) <= 0x1F || ["\u2028", "\u2029"].includes(character)) return reject();
		if (character !== "\\") {
			decoded += character;
		}
		else {
			const escaped = literal[++position];
			if (position >= literal.length - 1) return reject();
			const simple: Record<string, string> = { "'": "'", "\"": "\"", "\\": "\\", "/": "/", "b": "\b", "f": "\f", "n": "\n", "r": "\r", "t": "\t" };
			if (escaped && Object.hasOwn(simple, escaped)) {
				decoded += simple[escaped];
			}
			else if (escaped === "u" || escaped === "x") {
				const length = escaped === "u" ? 4 : 2;
				const digits = literal.slice(position + 1, position + 1 + length);
				if (digits.length !== length || !/^[a-f0-9]+$/iu.test(digits)) return reject();
				decoded += String.fromCharCode(Number.parseInt(digits, 16));
				position += length;
			}
			else {
				return reject();
			}
		}
	}
	const value: unknown = JSON.parse(decoded);
	if (!value || typeof value !== "object" || Array.isArray(value)) return reject();
	const pending: { value: unknown; depth: number }[] = [{ value, depth: 0 }];
	const objects: Record<string, unknown>[] = [];
	let visited = 0;
	while (pending.length) {
		const item = pending.pop()!;
		if (++visited > 150000 || item.depth > 64) return reject();
		if (!item.value || typeof item.value !== "object") continue;
		if (!Array.isArray(item.value)) objects.push(item.value as Record<string, unknown>);
		for (const child of Object.values(item.value)) pending.push({ value: child, depth: item.depth + 1 });
	}
	return objects;
}
export function pimaPolicyFingerprint(body: string, region: "links" | "privacy" | "disclaimer") {
	const document = bounded(body);
	const links = [...new Set(readPimaPublicState(body).filter(value => typeof value.url === "string" && typeof value.displayName === "string" && publicLinkFields.test(`${value.displayName} ${value.url}`)).map(value => JSON.stringify([value.displayName, new URL(value.url as string, pimaDiscoveryUrl).href])))].sort();
	if (region === "links") return hash(JSON.stringify(links));
	const regions = descendants(document, node => attribute(node, "id") === "mainWrapTS");
	if (regions.length !== 1) return reject();
	function text(node: StateHtmlNode): string {
		if (["script", "style", "noscript", "template", "form"].includes(node.nodeName)) return "";
		if (node.nodeName === "#text") return node.value ?? "";
		return (node.nodeName === "a" ? ` ${attribute(node, "href")} ` : "") + (node.childNodes ?? []).map(text).join(" ");
	}
	const content = text(regions[0]!).replace(/\s+/gu, " ").trim();
	if (content.length < 100) return reject();
	return hash(content);
}
function validDate(value: string) {
	return /^20\d{2}-11-0[2-8]$/u.test(value) && value >= "2026-11-03" && Number(value.slice(0, 4)) % 2 === 0 && new Date(`${value}T00:00:00Z`).getUTCDay() === 2;
}
export function validatePimaDocumentUrl(value: string) {
	const url = new URL(value);
	if (url.href !== value || url.origin !== "https://content.civicplus.com" || url.username || url.password || url.port || url.search || url.hash || !/^\/api\/assets\/az-pimacounty\/[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/u.test(url.pathname)) return reject();
}
export function readPimaOfferedElections(body: string): PimaOfferedElection[] {
	const document = bounded(body);
	const links = descendants(document, node => node.nodeName === "a" && Boolean(attribute(node, "href"))).map(node => ({ label: stateHtmlText(node).replace(/\s+/gu, " ").trim(), url: new URL(attribute(node, "href"), pimaDiscoveryUrl) }));
	const objects = readPimaPublicState(body);
	const elections: PimaOfferedElection[] = [];
	for (const link of links.filter(link => /^20\d{2} General Election$/u.test(link.label))) {
		const id = link.url.searchParams.get("contentId");
		if (link.url.origin !== origin || link.url.pathname !== "/elections" || !id || !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/u.test(id) || [...link.url.searchParams].length !== 1 || link.url.hash || link.url.username || link.url.password || link.url.port) return reject();
		const events = objects.filter(value => value.id === id && value.contentTypeName === "event" && value.data && typeof value.data === "object" && !Array.isArray(value.data));
		const data = [...new Set(events.map(event => JSON.stringify(event.data)))];
		if (data.length !== 1) return reject();
		const event = JSON.parse(data[0]!) as { title?: { en?: unknown }; eventdate?: { iv?: { startDate?: unknown } } };
		const start = event.eventdate?.iv?.startDate;
		if (event.title?.en !== link.label || typeof start !== "string" || !/^20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/u.test(start) || !Number.isFinite(Date.parse(start)) || new Date(start).toISOString() !== start.replace("Z", ".000Z")) return reject();
		const electionDate = start.slice(0, 10);
		if (!validDate(electionDate) || electionDate.slice(0, 4) !== link.label.slice(0, 4)) return reject();
		const documents: PimaOfferedElection["documents"] = [];
		for (const item of links.filter(item => item.label.startsWith(`${link.label} Official `))) {
			const kind = item.label === `${link.label} Official Candidate List (PDF)` ? "candidates" : item.label === `${link.label} Official Write-In List (PDF)` ? "write-ins" : null;
			if (!kind) return reject();
			validatePimaDocumentUrl(item.url.href);
			if (!documents.some(document => document.kind === kind && document.url === item.url.href)) documents.push({ kind, url: item.url.href });
		}
		if (documents.length > 2 || documents.filter(document => document.kind === "candidates").length > 1 || documents.filter(document => document.kind === "write-ins").length > 1 || (documents.length && !documents.some(document => document.kind === "candidates"))) return reject();
		const election = { electionDate, documents: documents.sort((first, second) => first.kind.localeCompare(second.kind)) };
		const previous = elections.find(item => item.electionDate === electionDate);
		if (previous && JSON.stringify(previous) !== JSON.stringify(election)) return reject();
		if (!previous) elections.push(election);
	}
	if (elections.length > 4) return reject();
	return elections.sort((first, second) => first.electionDate.localeCompare(second.electionDate));
}
export function readPimaCycleDiscovery(body: string, now = Date.now()) {
	if (Buffer.byteLength(body) > 10 * 1024 * 1024 || !Number.isFinite(now)) return reject();
	const value: unknown = JSON.parse(body);
	if (!exact(value, ["schemaVersion", "type", "index", "policies", "redirects"]) || value.schemaVersion !== 1 || value.type !== "pima-election-discovery" || !Array.isArray(value.policies) || value.policies.length !== 4 || !Array.isArray(value.redirects) || value.redirects.length !== 2) return reject();
	function timestamp(value: unknown) {
		if (typeof value !== "string" || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value || Date.parse(value) > now) return reject();
	}
	function page(value: unknown, url: string): Page {
		if (!exact(value, ["url", "body", "sha256", "retrievedAt"]) || value.url !== url || typeof value.body !== "string" || Buffer.byteLength(value.body) > 2 * 1024 * 1024 || value.sha256 !== hash(value.body)) return reject();
		timestamp(value.retrievedAt);
		return value as unknown as Page;
	}
	const capturedPolicies = value.policies;
	const policies = [page(capturedPolicies[0], `${origin}/robots.txt`), page(capturedPolicies[1], "https://content.civicplus.com/robots.txt"), ...policyPaths.map((path, index) => page(capturedPolicies[index + 2], origin + path))];
	if (hash(policies[0]!.body) !== pimaPolicyReceipts.robots || hash(policies[1]!.body) !== pimaPolicyReceipts.contentRobots) return reject();
	const index = page(value.index, pimaDiscoveryUrl);
	for (const item of [index, ...policies.slice(2)]) {
		if (pimaPolicyFingerprint(item.body, "links") !== pimaPolicyReceipts.links) return reject();
	}
	for (const [position, name] of (["privacy", "disclaimer"] as const).entries()) {
		if (pimaPolicyFingerprint(policies[position + 2]!.body, name) !== pimaPolicyReceipts[name]) return reject();
		const redirect = value.redirects[position];
		if (!exact(redirect, ["url", "status", "location", "retrievedAt"]) || redirect.url !== origin + offeredPolicyPaths[position] || redirect.status !== 301 || redirect.location !== policyPaths[position]) return reject();
		timestamp(redirect.retrievedAt);
	}
	return { index, elections: readPimaOfferedElections(index.body) };
}
export async function fetchPimaCycleDiscovery(options: Options = {}) {
	const now = options.now ?? Date.now;
	const request = options.requestDocument ?? fetchRemoteSourceDocument;
	const sleep = options.sleep ?? (milliseconds => wait(milliseconds));
	const policies: Page[] = [];
	const redirects: Redirect[] = [];
	async function capture(url: string): Promise<Page> {
		const reply = await request(url, { allowedHosts: [new URL(url).hostname], maxBytes: 2 * 1024 * 1024, timeoutMs: 45000 });
		if (reply.status !== 200 || !["text/plain", "text/html"].includes(reply.contentType)) return reject();
		const body = new TextDecoder("utf-8", { fatal: true }).decode(reply.body);
		return { url, body, sha256: hash(body), retrievedAt: new Date(now()).toISOString() };
	}
	policies.push(await capture(`${origin}/robots.txt`));
	if (hash(policies[0]!.body) !== pimaPolicyReceipts.robots) return reject();
	policies.push(await capture("https://content.civicplus.com/robots.txt"));
	if (hash(policies[1]!.body) !== pimaPolicyReceipts.contentRobots) return reject();
	await sleep(20000);
	const index = await capture(pimaDiscoveryUrl);
	if (pimaPolicyFingerprint(index.body, "links") !== pimaPolicyReceipts.links) return reject();
	for (const [position, name] of (["privacy", "disclaimer"] as const).entries()) {
		await sleep(20000);
		const url = origin + offeredPolicyPaths[position];
		const reply = await request(url, { allowedHosts: ["www.pima.gov"], maxBytes: 2 * 1024 * 1024, timeoutMs: 45000 });
		if (reply.status !== 301 || reply.location !== policyPaths[position]) return reject();
		redirects.push({ url, status: 301, location: reply.location, retrievedAt: new Date(now()).toISOString() });
		await sleep(20000);
		const policy = await capture(origin + policyPaths[position]);
		if (pimaPolicyFingerprint(policy.body, "links") !== pimaPolicyReceipts.links || pimaPolicyFingerprint(policy.body, name) !== pimaPolicyReceipts[name]) return reject();
		policies.push(policy);
	}
	const body = JSON.stringify({ schemaVersion: 1, type: "pima-election-discovery", index, policies, redirects });
	readPimaCycleDiscovery(body, now());
	return body;
}
