import type { StateCandidateValues } from "./state-ballot-additional-records.js";
import type { StateHtmlNode } from "./state-ballot-html.js";
import type { StateCandidateRecord } from "./state-ballot-records.js";
import type { StateBallotSource } from "./state-ballot-sources.js";
import { Buffer } from "node:buffer";
import { normalizePublicHref } from "./public-href.js";
import { fetchRemoteSourceText } from "./remote-json-source.js";
import { parseStateHtml, stateHtmlAttribute, stateHtmlDescendants, stateHtmlTableRows, stateHtmlText } from "./state-ballot-html.js";
import { StateBallotAwaitingRecordsError } from "./state-ballot-source-state.js";

export const virginiaDiscoveryUrl = "https://www.elections.virginia.gov/casting-a-ballot/candidate-list/";
export type VirginiaReportKind = "federal" | "presidential" | "senate" | "house" | "local";
export interface VirginiaElection {
	electionId: null;
	electionDate: string;
	reports: { kind: VirginiaReportKind; url: string }[];
	allOfficesUrl: string | null;
}
const originalFederalUrl = `${virginiaDiscoveryUrl}november-3-2026-gen-elect-federal-offices/`;
const originalLocalUrl = `${virginiaDiscoveryUrl}november-3-2026-gen-elect-local-offices/`;
const originalAllUrl = `${virginiaDiscoveryUrl}november-3-2026-gen-elect-all-offices/`;
const text = (node: StateHtmlNode) => stateHtmlText(node).normalize("NFKC").replace(/\s+/gu, " ").trim();
const cells = (node: StateHtmlNode) => (node.childNodes ?? []).filter(child => ["td", "th"].includes(child.nodeName));
const exactKeys = (value: unknown, keys: string[]): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).sort().join("|") === [...keys].sort().join("|"));

function generalDate(value: string) {
	const date = new Date(`${value}T00:00:00Z`);
	return /^20\d{2}-11-0[2-8]$/u.test(value) && Number.isFinite(date.valueOf()) && date.toISOString().slice(0, 10) === value && date.getUTCDay() === 2;
}

export function virginiaReportUrl(value: string) {
	const url = new URL(value, virginiaDiscoveryUrl);
	if (url.origin !== "https://www.elections.virginia.gov" || url.username || url.password || url.search || url.hash || !/^\/casting-a-ballot\/(?:candidate-list|previous-candidate-lists)\/[a-z0-9-]+\/$/u.test(url.pathname))
		throw new Error("The Virginia candidate link is not an approved public HTML report.");
	return url.href;
}

function mainContent(body: string) {
	if (Buffer.byteLength(body) > 3 * 1024 * 1024) throw new Error("The Virginia HTML report exceeds its bounds.");
	const mains = stateHtmlDescendants(parseStateHtml(body), node => node.nodeName === "main");
	if (mains.length !== 1) throw new Error("The Virginia public report layout has changed.");
	return mains[0]!;
}

export function validateVirginiaElection(value: unknown, kind: "federal" | "local", minimumDate = "2026-11-03"): asserts value is VirginiaElection {
	if (!exactKeys(value, ["electionId", "electionDate", "reports", "allOfficesUrl"]) || value.electionId !== null || typeof value.electionDate !== "string" || !generalDate(value.electionDate) || value.electionDate < minimumDate || !Array.isArray(value.reports) || !value.reports.length || value.reports.length > 3)
		throw new Error("The Virginia general-election identity is invalid.");
	const kinds: string[] = [];
	const urls: string[] = [];
	for (const report of value.reports) {
		if (!exactKeys(report, ["kind", "url"]) || typeof report.kind !== "string" || !["federal", "presidential", "senate", "house", "local"].includes(report.kind) || typeof report.url !== "string" || virginiaReportUrl(report.url) !== report.url)
			throw new Error("The Virginia candidate report set is invalid.");
		kinds.push(report.kind);
		urls.push(report.url);
	}
	const signature = kinds.join("|");
	if (new Set(kinds).size !== kinds.length || (kind === "local" ? signature !== "local" : !["federal", "senate|house", "presidential|senate|house"].includes(signature)))
		throw new Error("The Virginia candidate report set is ambiguous or incomplete.");
	if (value.allOfficesUrl !== null) {
		if (kind !== "local" || typeof value.allOfficesUrl !== "string" || virginiaReportUrl(value.allOfficesUrl) !== value.allOfficesUrl) throw new Error("The Virginia all-offices report is invalid.");
		urls.push(value.allOfficesUrl);
	}
	if (new Set(urls).size !== urls.length) throw new Error("The Virginia reports repeat a source URL.");
}

export function readVirginiaElectionDiscovery(body: string, kind: "federal" | "local", minimumDate = "2026-11-03"): VirginiaElection[] {
	const main = mainContent(body);
	const headings = stateHtmlDescendants(main, node => node.nodeName === "h1");
	if (headings.length !== 1 || !["Candidates & Referendums", "Previous Candidate Lists"].includes(text(headings[0]!))) throw new Error("The Virginia candidate index heading has changed.");
	const elections: VirginiaElection[] = [];
	const visit = (parent: StateHtmlNode) => {
		const children = parent.childNodes ?? [];
		for (const [position, heading] of children.entries()) {
			if (heading.nodeName !== "h2") {
				visit(heading);
				continue;
			}
			const label = text(heading);
			const match = /^November ([2-8]), (20\d{2}) General(?: and Special)? Elections?$/u.exec(label);
			if (!match) {
				if (/November.*General/u.test(label)) throw new Error("The Virginia general-election heading has changed.");
				continue;
			}
			const electionDate = `${match[2]}-11-0${match[1]}`;
			if (electionDate < minimumDate) continue;
			const list = children.slice(position + 1).find(node => !["#text", "#comment"].includes(node.nodeName));
			if (list?.nodeName !== "ul") throw new Error("The Virginia election report links have changed.");
			const found = new Map<string, string>();
			for (const link of stateHtmlDescendants(list, node => node.nodeName === "a")) {
				const identity = /^(20\d{2}) November (?:General )?(Federal Offices|Local Offices|All Offices|Local|President|US Senate|House of Representatives) Candidates? List$/u.exec(text(link));
				if (!identity) continue;
				if (identity[1] !== match[2] || found.has(identity[2]!)) throw new Error("The Virginia election links conflict with their published date.");
				found.set(identity[2]!, virginiaReportUrl(stateHtmlAttribute(link, "href")));
			}
			const reports: VirginiaElection["reports"] = [];
			if (kind === "local") {
				if (found.has("Local Offices") && found.has("Local")) throw new Error("The Virginia local report is ambiguous.");
				const url = found.get("Local Offices") ?? found.get("Local");
				if (url) reports.push({ kind: "local", url });
			}
			else {
				if (found.has("Federal Offices")) reports.push({ kind: "federal", url: found.get("Federal Offices")! });
				for (const [key, reportKind] of [["President", "presidential"], ["US Senate", "senate"], ["House of Representatives", "house"]] as const) {
					if (found.has(key)) reports.push({ kind: reportKind, url: found.get(key)! });
				}
			}
			if (!reports.length) continue;
			const election: VirginiaElection = { electionId: null, electionDate, reports, allOfficesUrl: kind === "local" ? found.get("All Offices") ?? null : null };
			validateVirginiaElection(election, kind, minimumDate);
			elections.push(election);
		}
	};
	visit(main);
	if (elections.length > 100 || new Set(elections.map(election => election.electionDate)).size !== elections.length) throw new Error("The Virginia election index is duplicate or exceeds its bounds.");
	return elections.sort((first, second) => first.electionDate.localeCompare(second.electionDate));
}

export function validateVirginiaSource(source: StateBallotSource) {
	const local = source.format === "virginia-local-html";
	if (source.stateCode !== "VA" || !["virginia-html", "virginia-local-html"].includes(source.format) || source.retrievalPolicy || source.postBody || !generalDate(source.electionDate) || source.electionDate < "2026-11-03") throw new Error("The Virginia automatic source identity is invalid.");
	const original = source.electionDate === "2026-11-03";
	if (source.id !== (original ? local ? "va-elect-2026-local" : "va-elect-2026-federal" : `va-general-${local ? "local" : "federal"}-${source.electionDate}`) || source.pageUrl !== source.url || source.url !== (original ? local ? originalLocalUrl : originalFederalUrl : virginiaDiscoveryUrl)) throw new Error("The Virginia source must retain its published election identity.");
	if (original && JSON.stringify(source.documentUrls ?? []) !== JSON.stringify(local ? [originalLocalUrl, originalAllUrl] : [])) throw new Error("The original Virginia source links have changed.");
	if (!original && (!source.documentUrls?.length || source.documentUrls.length > 3 || new Set(source.documentUrls).size !== source.documentUrls.length || source.documentUrls.some(url => virginiaReportUrl(url) !== url))) throw new Error("The Virginia source has invalid report links.");
	if (local ? source.withheldDistrictScopes?.join("|") !== "state-house" : Boolean(source.withheldDistrictScopes?.length)) throw new Error("The Virginia source must preserve district applicability safeguards.");
	if (!local && !original && source.withheldStatewideOffices?.join("|") !== "President|Vice President") throw new Error("Separate presidential records require verified ticket relationships before ballot matching.");
	return local ? "local" : "federal";
}

function boundElection(source: StateBallotSource, index: string) {
	const kind = validateVirginiaSource(source);
	const election = readVirginiaElectionDiscovery(index, kind).find(election => election.electionDate === source.electionDate);
	if (!election) throw new Error("The Virginia candidate reports are not published for this election.");
	const urls = [...election.reports.map(report => report.url), ...(election.allOfficesUrl ? [election.allOfficesUrl] : [])];
	if (source.id === "va-elect-2026-federal" ? urls.join("|") !== originalFederalUrl : urls.join("|") !== source.documentUrls?.join("|")) throw new Error("The Virginia candidate links changed; retain the accepted source for review.");
	return election;
}

type VirginiaRequest = (url: string, options: { allowedHosts: string[]; maxBytes: number; maxRedirects: number; timeoutMs: number }) => Promise<string>;

export async function fetchVirginiaCandidateCapture(source: StateBallotSource, request: VirginiaRequest = fetchRemoteSourceText, discovery?: string) {
	validateVirginiaSource(source);
	const options = { allowedHosts: ["www.elections.virginia.gov"], maxBytes: 3 * 1024 * 1024, maxRedirects: 0, timeoutMs: 12000 };
	const index = discovery ?? await request(virginiaDiscoveryUrl, options);
	const election = boundElection(source, index);
	const reports = [];
	for (const report of election.reports) reports.push({ ...report, body: await request(report.url, options) });
	const allOffices = election.allOfficesUrl ? { url: election.allOfficesUrl, body: await request(election.allOfficesUrl, options) } : null;
	const capture = JSON.stringify({ schemaVersion: 1, type: "virginia-candidate-export", index, reports, allOffices });
	if (Buffer.byteLength(capture) > 12 * 1024 * 1024) throw new Error("The combined Virginia export exceeds its bounds.");
	return capture;
}

const localHeaders = ["Locality", "Office Ballot Order", "Party Ballot Order", "Office Title", "District", "Number of Seats", "Office Term", "Special Office Unexpired Term End Date", "Candidate Party", "Candidate Name", "Incumbent", "Campaign Email", "Campaign Website", "Campaign Phone", "Campaign Address Line 1", "Campaign Address Line 2", "Campaign City", "Campaign State", "Campaign Zip"];
const federalHeaders = ["Office Title", "District", "Candidate Party", "Candidate Name", "Incumbent", "Campaign Email", "Campaign Website", "Campaign Phone", "Campaign Address Line 1", "Campaign Address Line 2", "Campaign City", "Campaign State", "Campaign Zip"];
const historicalHeaders = {
	presidential: ["Office Title", "Political Party", "Name", "Incumbent", "Email", "Phone", "Website", "Address1", "City", "State", "Zip"],
	senate: ["Office Title", "Political Party", "Name", "Incumbent", "Email", "Phone", "Website", "Address", "City", "State", "Zip"],
	house: ["Office Title", "District", "Party Draw Order", "Political Party", "Name", "Incumbent", "Email", "Phone", "Website", "Address", "City", "State", "Zip"]
};

function reportTable(body: string, date: string, kind: VirginiaReportKind | "all") {
	const main = mainContent(body);
	const heading = stateHtmlDescendants(main, node => node.nodeName === "h1");
	const expected = `November ${Number(date.slice(-2))}, ${date.slice(0, 4)} - ${kind === "all" ? "All Offices" : kind === "local" ? "Local Offices" : "Federal Offices"}`;
	const historical = kind === "presidential" ? `November ${Number(date.slice(-2))}, ${date.slice(0, 4)} General Election Presidential` : kind === "senate" ? `Nov ${date.slice(0, 4)} US Senate` : kind === "house" ? `Nov ${date.slice(0, 4)} US House` : "";
	if (heading.length !== 1 || text(heading[0]!) !== (historical || expected)) throw new Error("The Virginia report heading conflicts with the selected election.");
	const tables = stateHtmlDescendants(main, node => node.nodeName === "table");
	if (tables.length !== 1) throw new Error("The Virginia report table is missing or ambiguous.");
	const rows = stateHtmlTableRows(tables[0]!);
	const headers = kind === "all" || kind === "local" ? localHeaders : kind === "federal" ? federalHeaders : historicalHeaders[kind];
	if (!rows.length || cells(rows[0]!).map(text).join("|") !== headers.join("|")) throw new Error("The Virginia candidate columns have changed.");
	return { headers, rows: rows.slice(1).map((row) => {
		const items = cells(row);
		if (items.some(cell => ["rowspan", "colspan"].some(key => stateHtmlAttribute(cell, key) && stateHtmlAttribute(cell, key) !== "1"))) throw new Error("The Virginia candidate table has merged cells.");
		if (items.length !== headers.length && !(["local", "all"].includes(kind) && items.length === 18) && !(kind === "presidential" && items.length === 3)) throw new Error("The Virginia candidate row layout has changed.");
		return items.map(text);
	}) };
}

function campaignUrl(value: string) {
	const url = /^[a-z0-9.-]+\.[a-z]{2,}(?:\/|$)/iu.test(value) ? `https://${value}` : value;
	return /^https?:\/\//iu.test(url) ? normalizePublicHref(url) ?? undefined : undefined;
}

function termEnd(value: string, electionDate: string) {
	if (!value) return undefined;
	const match = /^(\d{2})\/(\d{2})\/(20\d{2})$/u.exec(value);
	const date = match ? `${match[3]}-${match[1]}-${match[2]}` : "";
	const parsed = new Date(`${date}T00:00:00Z`);
	if (!Number.isFinite(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== date || date < electionDate) throw new Error("The Virginia unexpired term date is invalid.");
	return date;
}

function districtNumber(value: string) {
	const match = /^([1-9]\d{0,2})(?:(?:st|nd|rd|th) District)?$/u.exec(value);
	if (!match) throw new Error("The Virginia legislative district label has changed.");
	return match[1]!;
}

export function parseVirginiaCandidateRecords(source: StateBallotSource, body: string, factory: (source: StateBallotSource, values: StateCandidateValues) => StateCandidateRecord | null) {
	if (Buffer.byteLength(body) > 12 * 1024 * 1024) throw new Error("The Virginia capture exceeds its bounds.");
	const capture: unknown = JSON.parse(body);
	if (!exactKeys(capture, ["schemaVersion", "type", "index", "reports", "allOffices"]) || capture.schemaVersion !== 1 || capture.type !== "virginia-candidate-export" || typeof capture.index !== "string" || !Array.isArray(capture.reports)) throw new Error("The Virginia candidate capture is invalid.");
	const election = boundElection(source, capture.index);
	if (capture.reports.length !== election.reports.length) throw new Error("The Virginia report set is incomplete.");
	const records: StateCandidateRecord[] = [];
	let localPrefixes: string[] | undefined;
	for (const [position, report] of capture.reports.entries()) {
		const identity = election.reports[position]!;
		if (!exactKeys(report, ["kind", "url", "body"]) || report.kind !== identity.kind || report.url !== identity.url || typeof report.body !== "string") throw new Error("The Virginia report identity is invalid.");
		const { headers, rows } = reportTable(report.body, source.electionDate, identity.kind);
		if (identity.kind === "local") localPrefixes = rows.map(row => JSON.stringify(row.slice(0, 11))).sort();
		for (const row of rows) {
			const field = (name: string) => row[headers.indexOf(name)] ?? "";
			const local = identity.kind === "local";
			const office = field("Office Title");
			const name = field(local || identity.kind === "federal" ? "Candidate Name" : "Name");
			const party = field(local || identity.kind === "federal" ? "Candidate Party" : "Political Party");
			if (!name || !office || !party || name.length > 250 || office.length > 300 || party.length > 300) throw new Error("The Virginia report contains an incomplete public candidate claim.");
			const incumbent = field("Incumbent");
			if (incumbent && !["Yes", "No", "true", "false"].includes(incumbent)) throw new Error("The Virginia incumbency label has changed.");
			const district = field("District");
			const values: StateCandidateValues = { name, office, party, status: "listed", candidateUrl: row.length === headers.length ? campaignUrl(field(local || identity.kind === "federal" ? "Campaign Website" : "Website")) : undefined };
			if (local) {
				const area = field("Locality");
				const years = /^(\d+) year$/u.exec(field("Office Term"));
				if (!area || area.length > 300 || district.length > 300 || !years || Number(years[1]) < 1 || Number(years[1]) > 12 || !/^[1-9]\d?$/u.test(field("Number of Seats")) || !/^\d{1,3}$/u.test(field("Office Ballot Order")) || !/^\d{1,3}$/u.test(field("Party Ballot Order")) || !["Yes", "No"].includes(incumbent)) throw new Error("The Virginia local office metadata is incomplete or invalid.");
				values.scope = office === "Member, House of Delegates" ? "state-house" : "local";
				values.district = values.scope === "state-house" ? districtNumber(district) : "";
				values.jurisdiction = district && district !== area ? `${area} · ${district}` : area;
				if (values.jurisdiction.length > 300) throw new Error("The Virginia local jurisdiction label exceeds its bounds.");
				values.sourceAreaLabel = area;
				values.sourceDistrictLabel = district;
				values.termYears = Number(years[1]);
				values.termEnd = termEnd(field("Special Office Unexpired Term End Date"), source.electionDate);
				values.seats = Number(field("Number of Seats"));
			}
			else {
				const senate = office === "Member, United States Senate";
				const house = office === "Member, House of Representatives";
				const presidential = ["President", "Vice President"].includes(office);
				if (!(identity.kind === "federal" ? senate || house : identity.kind === "senate" ? senate : identity.kind === "house" ? house : presidential) || (house && Number(districtNumber(district)) > 99) || (senate && identity.kind === "federal" && district !== "Statewide")) throw new Error("The Virginia federal office or district is unsupported.");
				values.scope = house ? "congressional" : "statewide";
				values.district = house ? districtNumber(district) : "";
			}
			const record = factory(source, values);
			if (!record) throw new Error("The Virginia public candidate record is invalid.");
			if (["Yes", "true"].includes(incumbent)) record.ballotDesignation = "Incumbent";
			records.push(record);
		}
	}
	if (election.allOfficesUrl) {
		if (!exactKeys(capture.allOffices, ["url", "body"]) || capture.allOffices.url !== election.allOfficesUrl || typeof capture.allOffices.body !== "string") throw new Error("The Virginia all-offices cross-check is missing.");
		const all = reportTable(capture.allOffices.body, source.electionDate, "all").rows.filter(row => !["Member, United States Senate", "Member, House of Representatives", "President", "Vice President"].includes(row[3]!)).map(row => JSON.stringify(row.slice(0, 11))).sort();
		if (JSON.stringify(all) !== JSON.stringify(localPrefixes)) throw new Error("The Virginia local and all-offices reports disagree.");
	}
	else if (capture.allOffices !== null) {
		throw new Error("The Virginia capture contains an unpublished all-offices report.");
	}
	const unique = new Map<string, StateCandidateRecord>();
	for (const record of records) {
		const previous = unique.get(record.id);
		if (previous && JSON.stringify({ ...previous, name: previous.name.toLowerCase() }) !== JSON.stringify({ ...record, name: record.name.toLowerCase() })) throw new Error("The Virginia report contains conflicting duplicate public claims.");
		if (!previous) unique.set(record.id, record);
	}
	if (!records.length && !source.id.startsWith("va-elect-2026-")) throw new StateBallotAwaitingRecordsError(source.id);
	return [...unique.values()];
}
