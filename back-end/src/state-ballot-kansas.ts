import type { StateBallotSource } from "./state-ballot-sources.js";
import { Buffer } from "node:buffer";
import { stateHtmlAttribute as attribute, stateHtmlDescendants as descendants, parseStateHtml, stateHtmlText } from "./state-ballot-html.js";

export const kansasDiscoveryUrl = "https://www.jocoelection.org/events-elections/upcoming-elections";
export const kansasCandidateIndexUrl = "https://www.jocoelection.org/candidates-elected-officials/candidates";
const maximumBytes = 24 * 1024 * 1024;
const text = (node: Parameters<typeof stateHtmlText>[0]) => stateHtmlText(node).normalize("NFKC").replace(/\s+/gu, " ").trim();
type RequestText = (url: string, options: { allowedHosts: string[]; maxBytes: number; maxRedirects: number; timeoutMs: number }) => Promise<string>;
const requestOptions = (maxBytes = 2 * 1024 * 1024) => ({ allowedHosts: ["www.jocoelection.org"], maxBytes, maxRedirects: 0, timeoutMs: 12000 });

function exact(value: unknown, keys: string[]): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value) && Object.keys(value).sort().join("|") === [...keys].sort().join("|");
}

export function kansasElectionLabel(electionDate: string) {
	if (!/^20\d{2}-11-0[2-8]$/u.test(electionDate) || electionDate < "2026-11-03" || new Date(`${electionDate}T00:00:00Z`).getUTCDay() !== 2) throw new Error("The configured Kansas source requires a regular November general-election date.");
	return `November ${Number(electionDate.slice(8))}, ${electionDate.slice(0, 4)} General Election`;
}

export function kansasElectionPageUrl(electionDate: string) {
	kansasElectionLabel(electionDate);
	return `https://www.jocoelection.org/events-elections/november-${Number(electionDate.slice(8))}-${electionDate.slice(0, 4)}-general-election`;
}

export function kansasCandidateRosterUrl(electionId: string) {
	if (!/^[1-9]\d{0,8}$/u.test(electionId)) throw new Error("The configured Kansas election identifier is invalid.");
	return `${kansasCandidateIndexUrl}?field_election_reference_target_id=${electionId}&field_office_jurisdiction_target_id_1=All&field_office_level_target_id_1=All`;
}

export function kansasSourceElectionId(source: StateBallotSource) {
	const electionId = new URL(source.url).searchParams.get("field_election_reference_target_id") ?? "";
	if (source.stateCode !== "KS" || source.format !== "kansas-html" || source.retrievalPolicy || source.postBody || source.documentUrls?.length || source.documentLinks?.length || source.url !== kansasCandidateRosterUrl(electionId) || source.pageUrl !== kansasElectionPageUrl(source.electionDate) || source.id !== (source.electionDate === "2026-11-03" ? "ks-johnson-2026" : `ks-johnson-general-${source.electionDate}`) || (electionId === "6023") !== (source.electionDate === "2026-11-03")) throw new Error("The configured Kansas source does not retain its approved election identity.");
	return electionId;
}

function main(body: string, title: string) {
	if (Buffer.byteLength(body) > 2 * 1024 * 1024) throw new Error("The Kansas discovery page exceeds its bounds.");
	const document = parseStateHtml(body);
	const roots = descendants(document, node => node.nodeName === "main");
	const headings = roots.length === 1 ? descendants(roots[0]!, node => node.nodeName === "h1") : [];
	if (roots.length !== 1 || headings.length !== 1 || text(headings[0]!) !== title) throw new Error("The Kansas discovery page identity is missing or changed.");
	return roots[0]!;
}

function electionDate(label: string) {
	const match = /^November ([2-8]), (20\d{2}) General Election$/u.exec(label);
	if (!match) throw new Error("The Kansas published general-election label is unsupported.");
	const date = `${match[2]}-11-0${match[1]}`;
	kansasElectionLabel(date);
	return date;
}

export function readKansasElectionControls(index: string, controls: string) {
	const links = descendants(main(index, "Upcoming Elections"), node => node.nodeName === "a" && /General Election/u.test(text(node)));
	const dates = new Map<string, string>();
	for (const link of links) {
		if (/^November [2-8], 20\d{2} General Election$/u.test(text(link)) && text(link).slice(12, 16) < "2026") continue;
		const date = electionDate(text(link));
		const url = new URL(attribute(link, "href"), kansasDiscoveryUrl).href;
		if (url !== kansasElectionPageUrl(date) || dates.has(date)) throw new Error("The Kansas published general-election link is duplicate or changed.");
		dates.set(date, url);
	}
	if (!dates.size || dates.size > 10) throw new Error("The Kansas published general-election set exceeds its bounds.");
	const root = main(controls, "Candidates");
	const forms = descendants(root, node => node.nodeName === "form" && attribute(node, "id") === "views-exposed-form-candidates-candidate-listing");
	if (forms.length !== 1 || attribute(forms[0]!, "method").toLowerCase() !== "get" || new URL(attribute(forms[0]!, "action"), kansasCandidateIndexUrl).href !== kansasCandidateIndexUrl) throw new Error("The Kansas public candidate form has changed.");
	const selectors = descendants(forms[0]!, node => node.nodeName === "select" && attribute(node, "name") === "field_election_reference_target_id");
	if (selectors.length !== 1) throw new Error("The Kansas election selector is missing or ambiguous.");
	const options = descendants(selectors[0]!, node => node.nodeName === "option");
	if (!options.length || options.length > 100) throw new Error("The Kansas election selector exceeds its bounds.");
	const identifiers = new Set<string>();
	const offeredDates = new Set<string>();
	const elections = [];
	for (const option of options) {
		const label = text(option);
		if (!/General Election/u.test(label)) continue;
		if (/^November [2-8], 20\d{2} General Election$/u.test(label) && label.slice(12, 16) < "2026") continue;
		const date = electionDate(label);
		const identifier = attribute(option, "value");
		kansasCandidateRosterUrl(identifier);
		if (identifiers.has(identifier) || offeredDates.has(date)) throw new Error("The Kansas election selector has duplicate identities.");
		identifiers.add(identifier);
		offeredDates.add(date);
		if (dates.has(date)) elections.push({ electionId: identifier, electionDate: date, url: dates.get(date)! });
	}
	if (elections.length !== dates.size) throw new Error("The Kansas published general election lacks a matching public candidate control.");
	return elections.sort((first, second) => first.electionDate.localeCompare(second.electionDate));
}

export function readKansasElectionDiscovery(body: string) {
	if (Buffer.byteLength(body) > maximumBytes) throw new Error("The Kansas discovery capture exceeds its bounds.");
	const value: unknown = JSON.parse(body);
	if (!exact(value, ["schemaVersion", "type", "index", "controls", "elections"]) || value.schemaVersion !== 1 || value.type !== "kansas-election-discovery" || typeof value.index !== "string" || typeof value.controls !== "string" || !Array.isArray(value.elections)) throw new Error("The Kansas discovery capture is invalid.");
	const offered = readKansasElectionControls(value.index, value.controls);
	if (value.elections.length !== offered.length) throw new Error("The Kansas discovery election pages are incomplete.");
	return value.elections.map((entry, index) => {
		const expected = offered[index]!;
		if (!exact(entry, ["electionId", "electionDate", "url", "body"]) || entry.electionId !== expected.electionId || entry.electionDate !== expected.electionDate || entry.url !== expected.url || typeof entry.body !== "string") throw new Error("The Kansas election page does not match its published control.");
		const root = main(entry.body, kansasElectionLabel(expected.electionDate));
		const marker = `The following will be on a ${kansasElectionLabel(expected.electionDate).replace("General Election", "general election")} ballot in Johnson County, Kansas:`;
		if (descendants(root, node => node.nodeName === "p" && text(node) === marker).length !== 1) throw new Error("The Kansas election page does not establish the Johnson County election date.");
		return { electionId: expected.electionId, electionDate: expected.electionDate };
	});
}

export async function fetchKansasCycleDiscovery(request: RequestText) {
	const index = await request(kansasDiscoveryUrl, requestOptions());
	const controls = await request(kansasCandidateIndexUrl, requestOptions());
	const elections = [];
	for (const entry of readKansasElectionControls(index, controls)) {
		elections.push({ ...entry, body: await request(entry.url, requestOptions()) });
		if (Buffer.byteLength(JSON.stringify({ index, controls, elections })) > maximumBytes) throw new Error("The combined Kansas discovery exceeds its bounds.");
	}
	const body = JSON.stringify({ schemaVersion: 1, type: "kansas-election-discovery", index, controls, elections });
	readKansasElectionDiscovery(body);
	return body;
}

export function readKansasCandidateCapture(source: StateBallotSource, body: string) {
	const electionId = kansasSourceElectionId(source);
	if (Buffer.byteLength(body) > maximumBytes) throw new Error("The Kansas candidate capture exceeds its bounds.");
	if (!body.trimStart().startsWith("{") && source.id === "ks-johnson-2026") return body;
	const value: unknown = JSON.parse(body);
	if (!exact(value, ["schemaVersion", "type", "discovery", "url", "records"]) || value.schemaVersion !== 1 || value.type !== "kansas-candidate-report" || value.url !== source.url || typeof value.discovery !== "string" || typeof value.records !== "string" || !readKansasElectionDiscovery(value.discovery).some(election => election.electionId === electionId && election.electionDate === source.electionDate)) throw new Error("The Kansas candidate capture does not identify its published election.");
	return value.records;
}

export async function fetchKansasCandidateCapture(source: StateBallotSource, request: RequestText, discovery?: string) {
	const electionId = kansasSourceElectionId(source);
	if (source.id === "ks-johnson-2026" && !discovery) return request(source.url, requestOptions(12 * 1024 * 1024));
	const evidence = discovery ?? await fetchKansasCycleDiscovery(request);
	if (!readKansasElectionDiscovery(evidence).some(election => election.electionId === electionId && election.electionDate === source.electionDate)) throw new Error("The Kansas candidate election is not currently published.");
	const records = await request(source.url, requestOptions(12 * 1024 * 1024));
	const body = JSON.stringify({ schemaVersion: 1, type: "kansas-candidate-report", discovery: evidence, url: source.url, records });
	readKansasCandidateCapture(source, body);
	return body;
}
