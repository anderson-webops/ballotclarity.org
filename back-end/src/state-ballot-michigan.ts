import type { StateCandidateRecord } from "./state-ballot-records.js";
import type { StateBallotSource } from "./state-ballot-sources.js";
import { Buffer } from "node:buffer";
import { stateHtmlAttribute as attribute, stateHtmlDescendants as descendants, parseStateHtml, stateHtmlText } from "./state-ballot-html.js";

export const michiganDiscoveryUrl = "https://www.michigan.gov/en/sos/elections";
const maximumReportBytes = 12 * 1024 * 1024;
const maximumCaptureBytes = 24 * 1024 * 1024;
type RequestText = (url: string, options: { allowedHosts: string[]; maxBytes: number; maxRedirects: number; timeoutMs: number }) => Promise<string>;
const text = (node: Parameters<typeof stateHtmlText>[0]) => stateHtmlText(node).normalize("NFKC").replace(/\s+/gu, " ").trim();
const requestOptions = (host: string, maxBytes: number) => ({ allowedHosts: [host], maxBytes, maxRedirects: 0, timeoutMs: 12000 });

export function normalizeMichiganCandidateRecord(record: StateCandidateRecord): StateCandidateRecord {
	return record.party?.trim().toUpperCase() === "INCUMBENT" ? { ...record, party: undefined, incumbent: true } : record;
}

export function serializeMichiganCandidateRecord(record: StateCandidateRecord): StateCandidateRecord {
	if (!record.incumbent) return record;
	if (record.party && record.party.trim().toUpperCase() !== "INCUMBENT") throw new Error("The Michigan incumbent record cannot use the legacy party encoding.");
	const legacy = { ...record, party: "INCUMBENT" };
	delete legacy.incumbent;
	return legacy;
}

function exact(value: unknown, keys: string[]): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value) && Object.keys(value).sort().join("|") === [...keys].sort().join("|");
}

function reportUrl(year: string) {
	if (!/^20\d{2}$/u.test(year) || year < "2026" || Number(year) % 2) throw new Error("The Michigan general-election year is unsupported.");
	return `https://mi-boe.entellitrak.com/etk-mi-boe-prod/page.request.do?page=page.miboePublicReport&electionType=GEN&electionYear=${year}`;
}

export function michiganCandidateRosterUrl(electionDate: string) {
	if (!/^20\d{2}-11-0[2-8]$/u.test(electionDate) || new Date(`${electionDate}T00:00:00Z`).getUTCDay() !== 2) throw new Error("The Michigan source requires a regular general-election date.");
	return reportUrl(electionDate.slice(0, 4));
}

export function validateMichiganSource(source: StateBallotSource) {
	const url = michiganCandidateRosterUrl(source.electionDate);
	if (source.stateCode !== "MI" || source.format !== "michigan-html" || source.retrievalPolicy || source.postBody || source.documentUrls?.length || source.documentLinks?.length || source.url !== url || source.pageUrl !== url || source.id !== (source.electionDate === "2026-11-03" ? "mi-dos-2026" : `mi-general-${source.electionDate}`)) throw new Error("The Michigan source does not retain its approved election identity.");
}

export function readMichiganCandidateIndex(body: string) {
	if (Buffer.byteLength(body) > 2 * 1024 * 1024) throw new Error("The Michigan candidate index exceeds its bounds.");
	const document = parseStateHtml(body);
	const titles = descendants(document, node => node.nodeName === "h1");
	const headings = descendants(document, node => node.nodeName === "h3" && text(node) === "Filing for Office and Petition Filing");
	if (titles.length !== 1 || text(titles[0]!) !== "Elections" || headings.length !== 1) throw new Error("The Michigan candidate index headings are missing or changed.");
	const section = descendants(document, node => Boolean(node.childNodes?.includes(headings[0]!)))[0];
	if (!section) throw new Error("The Michigan candidate section is missing.");
	const years = new Set<string>();
	for (const link of descendants(section, node => node.nodeName === "a")) {
		const label = /^(20\d{2}) November General Candidate Listing$/u.exec(text(link));
		if (!label || label[1]! < "2026") continue;
		const year = label[1]!;
		const url = new URL(attribute(link, "href"), michiganDiscoveryUrl);
		const expected = new URL(reportUrl(year));
		if (url.origin !== expected.origin || url.pathname !== expected.pathname || url.username || url.password || url.hash || [...url.searchParams].length !== 3 || [...expected.searchParams].some(([key, value]) => url.searchParams.get(key) !== value) || years.has(year)) throw new Error("The Michigan published general-election link is ambiguous or changed.");
		years.add(year);
	}
	if (!years.size || years.size > 10) throw new Error("The Michigan published general-election year set exceeds its bounds.");
	return [...years].sort().map(year => ({ year, url: reportUrl(year) }));
}

export function readMichiganReportElection(body: string, year: string) {
	if (Buffer.byteLength(body) > maximumReportBytes) throw new Error("The Michigan candidate report exceeds its bounds.");
	const document = parseStateHtml(body);
	const cells = descendants(document, node => node.nodeName === "td").map(text);
	for (const label of ["Michigan Department of State", "Official Candidate Listing", "All State and Judicial Offices", "General Election"]) {
		if (cells.filter(value => value === label).length !== 1) throw new Error("The Michigan official general-election report headers are missing or changed.");
	}
	if (cells.some(value => /^(?:Special|Primary).*Election$/u.test(value))) throw new Error("The Michigan report contains conflicting election types.");
	const dates = cells.filter(value => /^Tuesday, November \d{1,2}, 20\d{2}$/u.test(value));
	const date = dates[0] && /^Tuesday, November ([2-8]), (20\d{2})$/u.exec(dates[0]);
	if (dates.length !== 1 || !date || date[2] !== year) throw new Error("The Michigan report date is missing, ambiguous or belongs to another year.");
	const electionDate = `${year}-11-0${date[1]}`;
	michiganCandidateRosterUrl(electionDate);
	return electionDate;
}

export function readMichiganElectionDiscovery(body: string) {
	if (Buffer.byteLength(body) > maximumCaptureBytes) throw new Error("The Michigan discovery capture exceeds its bounds.");
	const value: unknown = JSON.parse(body);
	if (!exact(value, ["schemaVersion", "type", "index", "reports"]) || value.schemaVersion !== 1 || value.type !== "michigan-election-discovery" || typeof value.index !== "string" || !Array.isArray(value.reports)) throw new Error("The Michigan discovery capture is invalid.");
	const offered = readMichiganCandidateIndex(value.index);
	if (value.reports.length !== offered.length) throw new Error("The Michigan discovery report set is incomplete.");
	return value.reports.map((entry, index) => {
		if (!exact(entry, ["year", "url", "records"]) || entry.year !== offered[index]!.year || entry.url !== offered[index]!.url || typeof entry.records !== "string") throw new Error("The Michigan discovery report is not its published control.");
		return { electionId: null, electionDate: readMichiganReportElection(entry.records, entry.year as string) };
	});
}

export async function fetchMichiganCycleDiscovery(request: RequestText) {
	const index = await request(michiganDiscoveryUrl, requestOptions("www.michigan.gov", 2 * 1024 * 1024));
	const reports = [];
	for (const entry of readMichiganCandidateIndex(index)) {
		reports.push({ ...entry, records: await request(entry.url, requestOptions("mi-boe.entellitrak.com", maximumReportBytes)) });
		if (Buffer.byteLength(JSON.stringify({ index, reports })) > maximumCaptureBytes) throw new Error("The combined Michigan discovery exceeds its bounds.");
	}
	const body = JSON.stringify({ schemaVersion: 1, type: "michigan-election-discovery", index, reports });
	readMichiganElectionDiscovery(body);
	return body;
}

export function michiganCandidateCapture(source: StateBallotSource, discovery: string) {
	validateMichiganSource(source);
	if (!readMichiganElectionDiscovery(discovery).some(election => election.electionDate === source.electionDate)) throw new Error("The Michigan source election is not currently published.");
	const value = JSON.parse(discovery);
	const report = value.reports.find((report: { url: string }) => report.url === source.url);
	return JSON.stringify({ schemaVersion: 1, type: "michigan-candidate-report", index: value.index, url: report.url, records: report.records });
}

export function readMichiganCandidateCapture(source: StateBallotSource, body: string) {
	validateMichiganSource(source);
	if (Buffer.byteLength(body) > maximumCaptureBytes) throw new Error("The Michigan candidate capture exceeds its bounds.");
	const value: unknown = JSON.parse(body);
	if (!exact(value, ["schemaVersion", "type", "index", "url", "records"]) || value.schemaVersion !== 1 || value.type !== "michigan-candidate-report" || typeof value.index !== "string" || typeof value.records !== "string" || value.url !== source.url || !readMichiganCandidateIndex(value.index).some(entry => entry.url === value.url) || readMichiganReportElection(value.records, source.electionDate.slice(0, 4)) !== source.electionDate) throw new Error("The Michigan candidate capture does not identify its published general election.");
	return value.records;
}

export async function fetchMichiganCandidateCapture(source: StateBallotSource, request: RequestText) {
	validateMichiganSource(source);
	const index = await request(michiganDiscoveryUrl, requestOptions("www.michigan.gov", 2 * 1024 * 1024));
	if (!readMichiganCandidateIndex(index).some(entry => entry.url === source.url)) throw new Error("The Michigan candidate source is not currently published.");
	const records = await request(source.url, requestOptions("mi-boe.entellitrak.com", maximumReportBytes));
	const body = JSON.stringify({ schemaVersion: 1, type: "michigan-candidate-report", index, url: source.url, records });
	readMichiganCandidateCapture(source, body);
	return body;
}
