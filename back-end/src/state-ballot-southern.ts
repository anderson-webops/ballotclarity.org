import type { StateHtmlNode } from "./state-ballot-html.js";
import type { StateBallotSource } from "./state-ballot-sources.js";
import { Buffer } from "node:buffer";
import { parse } from "parse5";
import { stateHtmlAttribute as attribute, stateHtmlDescendants as descendants, parseStateHtml, stateHtmlText } from "./state-ballot-html.js";

export const floridaDiscoveryUrl = "https://dos.elections.myflorida.com/candidates/downloadcanlist.asp";
export const floridaCandidateUrl = "https://dos.elections.myflorida.com/candidates/extractCanList.asp";
export const southCarolinaDiscoveryUrl = "https://vrems.scvotes.sc.gov/Candidate/SelectElection";
export const southCarolinaScriptUrl = "https://vrems.scvotes.sc.gov/js/Candidate/SelectElection.js";
export const southCarolinaYearsUrl = "https://vrems.scvotes.sc.gov/Candidate/GetYearsByElectionType?electionType=General";
const clean = (node: StateHtmlNode) => stateHtmlText(node).replace(/\s+/gu, " ").trim();

function generalDate(value: string) {
	if (!/^20\d{2}-11-0[2-8]$/u.test(value) || Number(value.slice(0, 4)) % 2 || new Date(value).getUTCDay() !== 2) throw new Error("The published regular general-election date is invalid.");
	return value;
}

function exactKeys(value: unknown, keys: string[]): value is Record<string, unknown> {
	return Boolean(value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).sort().join(",") === keys.sort().join(","));
}

export function floridaElectionDate(electionId: string) {
	const match = /^(20\d{2})(11)(0[2-8])-GEN$/u.exec(electionId);
	if (!match) throw new Error("The Florida published general-election identifier is invalid.");
	return generalDate(`${match[1]}-${match[2]}-${match[3]}`);
}

export function floridaCandidatePostBody(electionId: string) {
	floridaElectionDate(electionId);
	return new URLSearchParams({ elecID: electionId, office: "All", status: "All", cantype: "STA", FormSubmit: "Download Candidate List" }).toString();
}

export function floridaSourceElectionId(source: StateBallotSource) {
	const identifier = new URLSearchParams(source.postBody).get("elecID") ?? "";
	if (source.stateCode !== "FL" || source.format !== "csv" || source.delimiter !== "\t" || source.url !== floridaCandidateUrl || source.pageUrl !== floridaDiscoveryUrl || source.postBody !== floridaCandidatePostBody(identifier) || source.electionDate !== floridaElectionDate(identifier)) throw new Error("The Florida source does not retain its exact state-candidate download contract.");
	return identifier;
}

function floridaDownloadForm(body: string) {
	if (Buffer.byteLength(body) > 2 * 1024 * 1024) throw new Error("The Florida election index exceeds its bounds.");
	const document = parse(body, { sourceCodeLocationInfo: true }) as unknown as StateHtmlNode;
	const forms = descendants(document, node => node.nodeName === "form" && attribute(node, "name") === "CanDownload");
	if (forms.length !== 1 || attribute(forms[0]!, "method").toLowerCase() !== "post" || new URL(attribute(forms[0]!, "action"), floridaDiscoveryUrl).href !== floridaCandidateUrl) throw new Error("The Florida public download form has changed.");
	const location = (forms[0] as StateHtmlNode & { sourceCodeLocation?: { startTag?: { startOffset: number; endOffset: number } } }).sourceCodeLocation?.startTag;
	if (!location) throw new Error("The Florida public download form has no source boundary.");
	const remainder = body.slice(location.endOffset);
	const closing = /<\/form\s*>/iu.exec(remainder);
	if (!closing || /<form\b/iu.test(remainder.slice(0, closing.index))) throw new Error("The Florida public download form is incomplete or nested.");
	const bounded = parseStateHtml(body.slice(location.startOffset, location.endOffset + closing.index + closing[0].length));
	const scoped = descendants(bounded, node => node.nodeName === "form");
	if (scoped.length !== 1) throw new Error("The Florida public download form boundary is ambiguous.");
	const form = scoped[0]!;
	const selectors = descendants(form, node => node.nodeName === "select");
	if (selectors.length !== 4 || selectors.filter(node => attribute(node, "name") === "elecID").length !== 1) throw new Error("The Florida public download filters have changed.");
	for (const [name, value, label] of [["office", "All", "ALL"], ["status", "All", "ALL"], ["cantype", "STA", "State Candidates"]]) {
		const matches = selectors.filter(node => attribute(node, "name") === name);
		if (matches.length !== 1 || descendants(matches[0]!, node => node.nodeName === "option" && attribute(node, "value") === value && clean(node) === label).length !== 1) throw new Error("The Florida public download no longer supports the approved unfiltered state request.");
	}
	const submits = descendants(form, node => node.nodeName === "input" && attribute(node, "type") === "submit");
	if (submits.length !== 1 || attribute(submits[0]!, "name") !== "FormSubmit" || attribute(submits[0]!, "value") !== "Download Candidate List") throw new Error("The Florida public candidate download control has changed.");
	return selectors.find(node => attribute(node, "name") === "elecID")!;
}

export function readFloridaElectionDiscovery(body: string, minimumYear: string) {
	const selector = floridaDownloadForm(body);
	const options = descendants(selector, node => node.nodeName === "option");
	if (!options.length || options.length > 200) throw new Error("The Florida published election list exceeds its bounds.");
	return options.flatMap((option) => {
		const electionId = attribute(option, "value");
		if (!electionId.endsWith("-GEN")) return [];
		if (/^\d{4}/u.test(electionId) && electionId.slice(0, 4) < minimumYear) return [];
		const electionDate = floridaElectionDate(electionId);
		if (electionDate.slice(0, 4) < minimumYear) return [];
		if (clean(option) !== `${electionDate.slice(0, 4)} Election`) throw new Error("The Florida general-election label and published identifier conflict.");
		return [{ electionId, electionDate }];
	});
}

export function buildFloridaCandidateForm(source: StateBallotSource, body: string) {
	const electionId = floridaSourceElectionId(source);
	const elections = readFloridaElectionDiscovery(body, source.electionDate.slice(0, 4));
	if (elections.filter(item => item.electionId === electionId && item.electionDate === source.electionDate).length !== 1) throw new Error("The configured Florida general election is not uniquely published in its public form.");
	return floridaCandidatePostBody(electionId);
}

export function southCarolinaCandidateRosterUrl(electionId: string) {
	if (!/^[1-9]\d{0,8}$/u.test(electionId)) throw new Error("The South Carolina election identifier is invalid.");
	return `https://vrems.scvotes.sc.gov/Candidate/CandidateSearch?electionId=${electionId}`;
}

export function southCarolinaSourceElectionId(source: StateBallotSource) {
	const identifier = new URL(source.url).searchParams.get("electionId") ?? "";
	if (source.stateCode !== "SC" || source.format !== "south-carolina-html" || source.url !== southCarolinaCandidateRosterUrl(identifier) || source.pageUrl !== source.url || source.postBody || source.electionDate !== generalDate(source.electionDate)) throw new Error("The South Carolina source does not retain its exact general-election search contract.");
	return identifier;
}

export function southCarolinaElectionsUrl(year: string) {
	if (!/^20\d{2}$/u.test(year)) throw new Error("The South Carolina published year is invalid.");
	return `https://vrems.scvotes.sc.gov/Candidate/GetElections?electionType=General&year=${year}`;
}

export function validateSouthCarolinaElectionIndex(page: string, script: string) {
	const document = parseStateHtml(page);
	const forms = descendants(document, node => node.nodeName === "form");
	const scripts = descendants(document, node => node.nodeName === "script" && attribute(node, "src") === "/js/Candidate/SelectElection.js");
	if (forms.length !== 1 || attribute(forms[0]!, "id") !== "SelectElectionForm" || attribute(forms[0]!, "method").toLowerCase() !== "post" || scripts.length !== 1) throw new Error("The South Carolina public election selector has changed.");
	const selectors = descendants(forms[0]!, node => node.nodeName === "select" && attribute(node, "name") === "ElectionKindSid");
	if (selectors.length !== 1 || descendants(selectors[0]!, node => node.nodeName === "option" && attribute(node, "value") === "General" && clean(node) === "Statewide Primaries and General Elections").length !== 1) throw new Error("The South Carolina public selector no longer offers the approved election type.");
	for (const expression of ["url: '/Candidate/GetYearsByElectionType?electionType=' + electionType", "url: '/Candidate/GetElections?electionType=' + electionType + '&year=' + electionYear"]) {
		if (script.split(expression).length !== 2) throw new Error("The South Carolina public election-selection endpoints have changed.");
	}
}

export function readSouthCarolinaElectionYears(body: string, minimumYear: string) {
	const values: unknown = JSON.parse(body);
	if (!Array.isArray(values) || !values.length || values.length > 100 || values.some(value => !exactKeys(value, ["electionYear"]) || !Number.isInteger(value.electionYear) || !/^20\d{2}$/u.test(String(value.electionYear)))) throw new Error("The South Carolina public election-year list has changed.");
	const years = values.map(value => String(value.electionYear));
	if (new Set(years).size !== years.length) throw new Error("The South Carolina public election-year list is duplicated.");
	const selected = years.filter(year => year >= minimumYear).sort();
	if (!selected.length || selected.length > 10) throw new Error("The South Carolina published current/future years exceed their bounds.");
	return selected;
}

export function readSouthCarolinaElectionDiscovery(body: string, minimumYear: string) {
	if (Buffer.byteLength(body) > 2 * 1024 * 1024) throw new Error("The combined South Carolina discovery exceeds its bounds.");
	const value: unknown = JSON.parse(body);
	if (!exactKeys(value, ["page", "script", "years", "elections"]) || typeof value.page !== "string" || typeof value.script !== "string" || typeof value.years !== "string" || !Array.isArray(value.elections)) throw new Error("The South Carolina discovery envelope is invalid.");
	validateSouthCarolinaElectionIndex(value.page, value.script);
	const years = readSouthCarolinaElectionYears(value.years, minimumYear);
	const captures = value.elections;
	if (captures.length !== years.length || captures.some((capture, index) => !exactKeys(capture, ["url", "body"]) || capture.url !== southCarolinaElectionsUrl(years[index]!) || typeof capture.body !== "string")) throw new Error("The South Carolina discovery election set is incomplete or changed.");
	return captures.flatMap((capture, index) => {
		const entries: unknown = JSON.parse(capture.body);
		if (!Array.isArray(entries) || !entries.length || entries.length > 200) throw new Error("The South Carolina public election list exceeds its bounds.");
		return entries.flatMap((entry) => {
			if (!exactKeys(entry, ["electionId", "electionName", "displayName", "electionDate", "filingPeriodBeginDate"]) || typeof entry.electionId !== "string" || !/^[1-9]\d{0,8}$/u.test(entry.electionId) || typeof entry.electionName !== "string" || typeof entry.displayName !== "string" || typeof entry.electionDate !== "string" || !entry.electionDate.startsWith(`${years[index]}-`)) throw new Error("The South Carolina public election metadata has changed.");
			if (entry.electionName !== "Statewide General Election") return [];
			const electionDate = generalDate(entry.electionDate.slice(0, 10));
			if (entry.electionDate !== `${electionDate}T00:00:00` || entry.displayName !== `11/${Number(electionDate.slice(8))}/${electionDate.slice(0, 4)} Statewide General Election`) throw new Error("The South Carolina general-election date and label conflict.");
			return [{ electionId: entry.electionId, electionDate }];
		});
	});
}
