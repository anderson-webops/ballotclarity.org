import type { StateHtmlNode } from "./state-ballot-html.js";
import type { StateBallotSource } from "./state-ballot-sources.js";
import { Buffer } from "node:buffer";
import { setTimeout as wait } from "node:timers/promises";
import { fetchRemoteSourceText } from "./remote-json-source.js";
import { stateHtmlAttribute as attribute, stateHtmlDescendants as descendants, parseStateHtml, stateHtmlText } from "./state-ballot-html.js";

export const utahDiscoveryUrl = "https://vote.utah.gov/resources-for-candidates-political-groups-parties/";
export const utahElectionUrl = "https://vote.utah.gov/current-election-information/";
const maximumBytes = 2 * 1024 * 1024;
const options = { allowedHosts: ["vote.utah.gov"], maxBytes: maximumBytes, maxRedirects: 0, timeoutMs: 12000 };
type RequestText = (url: string, configuration: typeof options) => Promise<string>;
const text = (node: StateHtmlNode) => stateHtmlText(node).normalize("NFKC").replace(/\s+/gu, " ").trim();

export function createUtahRequest(request: RequestText, now = Date.now, sleep: (milliseconds: number) => Promise<unknown> = wait) {
	let pending = Promise.resolve();
	let nextAt = 0;
	return (url: string) => {
		const result = pending.then(async () => {
			await sleep(Math.max(0, nextAt - now()));
			nextAt = now() + 10000;
			return request(url, options);
		});
		pending = result.then(() => undefined, () => undefined);
		return result;
	};
}

const productionRequest = createUtahRequest(fetchRemoteSourceText);
const requester = (request: RequestText) => request === fetchRemoteSourceText ? productionRequest : (url: string) => request(url, options);

export function utahCandidateRosterUrl(electionDate: string) {
	if (!/^20\d{2}-11-0[2-8]$/u.test(electionDate) || electionDate < "2026-11-03" || Number(electionDate.slice(0, 4)) % 2 || new Date(`${electionDate}T00:00:00Z`).getUTCDay() !== 2)
		throw new Error("The Utah source requires an even-year regular general-election date.");
	return `https://vote.utah.gov/${electionDate.slice(0, 4)}-candidate-filings/`;
}

export function validateUtahSource(source: StateBallotSource) {
	const url = utahCandidateRosterUrl(source.electionDate);
	if (source.stateCode !== "UT" || source.format !== "utah-html" || source.retrievalPolicy || source.postBody || source.documentUrls?.length || source.documentLinks?.length || source.url !== url || source.pageUrl !== url || source.id !== (source.electionDate === "2026-11-03" ? "ut-lg-2026" : `ut-general-${source.electionDate}`))
		throw new Error("The Utah candidate source does not retain its approved election identity.");
}

function parent(document: StateHtmlNode, child: StateHtmlNode) {
	return descendants(document, node => Boolean(node.childNodes?.includes(child)))[0];
}

function heading(document: StateHtmlNode, label: string, tag: string) {
	const matches = descendants(document, node => node.nodeName === tag && text(node) === label);
	if (matches.length !== 1) throw new Error("The Utah official election headings are missing or changed.");
	return matches[0]!;
}

function exact(value: unknown, keys: string[]): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value) && Object.keys(value).sort().join("|") === [...keys].sort().join("|");
}

export function readUtahElectionDiscovery(body: string) {
	if (Buffer.byteLength(body) > 4 * maximumBytes) throw new Error("The Utah discovery capture exceeds its bounds.");
	const value: unknown = JSON.parse(body);
	if (!exact(value, ["schemaVersion", "type", "resources", "election"]) || value.schemaVersion !== 1 || value.type !== "utah-election-discovery" || typeof value.resources !== "string" || typeof value.election !== "string" || Buffer.byteLength(value.resources) > maximumBytes || Buffer.byteLength(value.election) > maximumBytes)
		throw new Error("The Utah discovery capture is invalid.");
	const resources = parseStateHtml(value.resources);
	heading(resources, "Resources for Candidates, Political Groups & Parties", "h2");
	const essentials = parent(resources, heading(resources, "Candidate Essentials", "h3"));
	if (!essentials) throw new Error("The Utah candidate resource section is missing.");
	const offered = new Map<string, string>();
	for (const link of descendants(essentials, node => node.nodeName === "a")) {
		const match = /^(20\d{2}) Candidate Filings$/u.exec(text(link));
		if (!match || match[1]! < "2026" || Number(match[1]) % 2) continue;
		const year = match[1]!;
		const url = `https://vote.utah.gov/${year}-candidate-filings/`;
		if (attribute(link, "href") !== url || offered.has(year)) throw new Error("The Utah published candidate links are ambiguous or changed.");
		offered.set(year, url);
	}
	if (!offered.size || offered.size > 10) throw new Error("The Utah published candidate year set exceeds its bounds.");
	const election = parseStateHtml(value.election);
	heading(election, "Current Election Information", "h2");
	const cycles = descendants(election, node => node.nodeName === "h2" && /^20\d{2} Election Cycle$/u.test(text(node)));
	if (cycles.length !== 1) throw new Error("The Utah election cycle is missing or ambiguous.");
	const year = text(cycles[0]!).slice(0, 4);
	const cycleHeader = parent(election, cycles[0]!);
	const cycle = cycleHeader && parent(election, cycleHeader);
	if (!cycle) throw new Error("The Utah election cycle section is missing.");
	const section = parent(cycle, heading(cycle, "Regular General Election", "h3"));
	if (!section) throw new Error("The Utah general-election section is missing.");
	const dates = [...text(section).matchAll(/\bElection Day November ([2-8]), (20\d{2})\b/gu)];
	if (dates.length !== 1 || dates[0]![2] !== year || !offered.has(year)) throw new Error("The Utah general-election date and published candidate year do not agree.");
	const electionDate = `${year}-11-0${dates[0]![1]}`;
	if (utahCandidateRosterUrl(electionDate) !== offered.get(year)) throw new Error("The Utah general-election candidate link has changed.");
	return [{ electionId: null, electionDate }];
}

export async function fetchUtahCycleDiscovery(request: RequestText) {
	const fetch = requester(request);
	const resources = await fetch(utahDiscoveryUrl);
	const election = await fetch(utahElectionUrl);
	const body = JSON.stringify({ schemaVersion: 1, type: "utah-election-discovery", resources, election });
	readUtahElectionDiscovery(body);
	return body;
}

export async function fetchUtahCandidatePage(source: StateBallotSource, request: RequestText) {
	validateUtahSource(source);
	return requester(request)(source.url);
}

export function readUtahCandidateTables(source: StateBallotSource, body: string) {
	validateUtahSource(source);
	if (Buffer.byteLength(body) > maximumBytes) throw new Error("The Utah candidate page exceeds its bounds.");
	const document = parseStateHtml(body);
	const headings = descendants(document, node => /^h[1-3]$/u.test(node.nodeName) && text(node) === `${source.electionDate.slice(0, 4)} Candidate Filings`);
	if (headings.length !== 1) throw new Error("The official source does not identify the configured election year.");
	const tables = descendants(document, node => node.nodeName === "table");
	const sectionNames = ["Federal Offices", "State Offices", "State Senate", "State House", "State School Board", "State Judicial"];
	const sections = descendants(document, node => node.nodeName === "h3");
	if (!sections.length && source.id === "ut-lg-2026") {
		if (tables.length !== 5) throw new Error("The official candidate table set has changed.");
		return tables.map((table, index) => ({ table, judicial: index === 4 }));
	}
	const names = sections.map(text);
	const expected = names.includes("State Offices") ? sectionNames : sectionNames.filter(name => name !== "State Offices");
	if (names.join("|") !== expected.join("|") || tables.length !== expected.length || parent(document, headings[0]!) !== parent(document, sections[0]!)) throw new Error("The official candidate table set has changed.");
	const container = parent(document, headings[0]!)!;
	const ordered = descendants(container, node => node.nodeName === "h3" || node.nodeName === "table");
	if (ordered.length !== expected.length * 2 || expected.some((name, index) => ordered[index * 2] !== sections[index] || ordered[index * 2 + 1] !== tables[index])) throw new Error("The Utah candidate section and table associations have changed.");
	return tables.map((table, index) => ({ table, judicial: expected[index] === "State Judicial" }));
}
