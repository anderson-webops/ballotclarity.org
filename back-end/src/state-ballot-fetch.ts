import type { StateBallotSource } from "./state-ballot-sources.js";
import { Buffer } from "node:buffer";
import { fetchRemoteSourceText } from "./remote-json-source.js";
import { parseStateHtml, stateHtmlAttribute, stateHtmlDescendants, stateHtmlText } from "./state-ballot-html.js";
import { buildSouthCarolinaSearchForm } from "./state-ballot-portal-records.js";
import { fetchWashingtonCandidatePages } from "./state-ballot-washington.js";

type SourceTextRequest = (url: string, options: { allowedHosts: string[]; maxBytes: number; maxRedirects: number; postBody?: string; timeoutMs: number }) => Promise<string>;

export const publicStateExportFormats = ["mississippi-csv", "south-dakota-csv", "hawaii-csv", "illinois-tsv", "montana-csv"];

export function buildPublicStateExportForm(source: StateBallotSource, body: string) {
	const document = parseStateHtml(body);
	const content = stateHtmlText(document).replace(/\s+/gu, " ").trim();
	const fields = new URLSearchParams();
	for (const input of stateHtmlDescendants(document, node => node.nodeName === "input" && stateHtmlAttribute(node, "type") === "hidden")) {
		const name = stateHtmlAttribute(input, "name");
		if (/^__(?:VIEWSTATE(?:\d*|GENERATOR|FIELDCOUNT)|EVENTVALIDATION|EVENTTARGET|EVENTARGUMENT)$/u.test(name) || (source.format === "south-dakota-csv" && ["ctl00$MainContent$hidElectionDate", "ctl00$MainContent$hidElectionType"].includes(name)))
			fields.set(name, stateHtmlAttribute(input, "value"));
	}
	let control: string;
	if (source.format === "montana-csv") {
		if (source.electionDate !== "2026-11-03") throw new Error("The Montana public export election date is not configured.");
		if (!content.includes("* = Incumbent")) throw new Error("The Montana public candidate marker legend has changed.");
		const forms = stateHtmlDescendants(document, node => node.nodeName === "form" && stateHtmlAttribute(node, "id") === "frmMain");
		if (forms.length !== 1 || stateHtmlAttribute(forms[0]!, "method").toLowerCase() !== "post") throw new Error("The Montana public export form has changed.");
		const action = new URL(stateHtmlAttribute(forms[0]!, "action"), source.url);
		if (action.href !== source.url) throw new Error("The Montana public export target has changed.");
		if (stateHtmlDescendants(forms[0]!, node => node.nodeName === "select").length !== 2) throw new Error("The Montana public export filters have changed.");
		for (const [name, value] of [["hidElectionDate", "FEDERAL GENERAL 2026"], ["hidElectionType", "General"]]) {
			const key = `ctl00$ContentPlaceHolder1$${name}`;
			const inputs = stateHtmlDescendants(forms[0]!, node => node.nodeName === "input" && stateHtmlAttribute(node, "type") === "hidden" && stateHtmlAttribute(node, "name") === key);
			if (inputs.length !== 1 || stateHtmlAttribute(inputs[0]!, "value") !== value) throw new Error("The Montana public export election identity has changed.");
			fields.set(key, value!);
		}
		for (const [name, value, label] of [["ddlElection", "450002987", "FEDERAL GENERAL 2026 (11/03/2026) (General)"], ["ddlCounty", "99", "STATE"]]) {
			const key = `ctl00$ContentPlaceHolder1$${name}`;
			const selects = stateHtmlDescendants(forms[0]!, node => node.nodeName === "select" && stateHtmlAttribute(node, "name") === key);
			const selected = selects.length === 1 ? stateHtmlDescendants(selects[0]!, node => node.nodeName === "option" && Boolean(node.attrs?.some(attribute => attribute.name === "selected"))) : [];
			if (selected.length !== 1 || stateHtmlAttribute(selected[0]!, "value") !== value || stateHtmlText(selected[0]!).replace(/\s+/gu, " ").trim() !== label)
				throw new Error("The Montana public export does not select the unfiltered general election.");
			fields.set(key, value!);
		}
		control = "ctl00$ContentPlaceHolder1$grdCandidates$ctl00$ctl02$ctl00$ExportToCsvButton";
		const controls = stateHtmlDescendants(forms[0]!, node => node.nodeName === "input" && stateHtmlAttribute(node, "name") === control && stateHtmlAttribute(node, "type") === "button" && stateHtmlAttribute(node, "onclick") === `javascript:__doPostBack('${control}','')`);
		if (controls.length !== 1) throw new Error("The Montana public CSV control has changed.");
		fields.set("__EVENTTARGET", control);
		fields.set("__EVENTARGUMENT", "");
	}
	else if (source.format === "mississippi-csv") {
		if (!/Candidate Qualifying List/u.test(content) || !/November 3, 2026/u.test(content))
			throw new Error("The public candidate export does not identify the configured election.");
		control = "btnDownloadExcel";
		if (!stateHtmlDescendants(document, node => node.nodeName === "input" && stateHtmlAttribute(node, "name") === control && stateHtmlAttribute(node, "value") === "Download CSV").length)
			throw new Error("The public CSV control has changed.");
		fields.set(control, "Download CSV");
	}
	else if (source.format === "hawaii-csv") {
		const select = stateHtmlDescendants(document, node => node.nodeName === "select" && stateHtmlAttribute(node, "name") === "ctl00$cphFooter$ddlElection")[0];
		const selected = select && stateHtmlDescendants(select, node => node.nodeName === "option" && Boolean(node.attrs?.some(item => item.name === "selected")))[0];
		if (!selected || stateHtmlAttribute(selected, "value") !== "94" || stateHtmlText(selected).trim() !== "2026 Candidate Report")
			throw new Error("The public candidate export does not select the configured election.");
		control = "ctl00$cphFooter$rdgSearch$ctl00$ctl02$ctl00$ExportToCsvButton";
		if (!stateHtmlDescendants(document, node => node.nodeName === "input" && stateHtmlAttribute(node, "name") === control && stateHtmlAttribute(node, "type") === "submit").length)
			throw new Error("The public CSV control has changed.");
		fields.set(control, "");
		fields.set("ctl00$cphFooter$ddlElection", "94");
	}
	else {
		if (source.format === "south-dakota-csv") {
			if (!/2026 General Election Candidate List/u.test(content))
				throw new Error("The public candidate export does not identify the configured general election.");
			control = "ctl00$MainContent$grdCandidates$ctl00$ctl02$ctl00$ExportToCsvButton";
		}
		else if (source.format === "illinois-tsv") {
			if (!/GENERAL ELECTION - 11\/3\/2026/u.test(content))
				throw new Error("The public candidate export does not identify the configured general election.");
			control = "ctl00$ContentPlaceHolder1$btnText";
		}
		else {
			throw new Error("No public export form is configured for this source.");
		}
		const command = `javascript:__doPostBack('${control}','')`;
		if (!stateHtmlDescendants(document, node => stateHtmlAttribute(node, "onclick") === command || stateHtmlAttribute(node, "href") === command).length)
			throw new Error("The public export command has changed.");
		fields.set("__EVENTTARGET", control);
		fields.set("__EVENTARGUMENT", "");
	}
	if (fields.toString().length > 2 * 1024 * 1024)
		throw new Error("The public export form exceeds its size limit.");
	return fields.toString();
}

export function buildNorthDakotaSearchForm(body: string) {
	const document = parseStateHtml(body);
	const title = stateHtmlDescendants(document, node => node.nodeName === "title")[0];
	if (!title || stateHtmlText(title).trim() !== "2026 General Election Contest/Candidate List")
		throw new Error("The public search form does not identify the configured general election.");
	const fields = new URLSearchParams();
	for (const input of stateHtmlDescendants(document, node => node.nodeName === "input" && stateHtmlAttribute(node, "type") === "hidden")) {
		const name = stateHtmlAttribute(input, "name");
		if (/^__(?:VIEWSTATE(?:\d*|GENERATOR|FIELDCOUNT)|EVENTVALIDATION|EVENTTARGET|EVENTARGUMENT)$/u.test(name))
			fields.set(name, stateHtmlAttribute(input, "value"));
	}
	for (const suffix of ["ddlJursdiction", "ddlDistrict", "ddlContest", "ddlCandidate"]) {
		const name = `ctl00$ContentPlaceHolder1$${suffix}`;
		const select = stateHtmlDescendants(document, node => node.nodeName === "select" && stateHtmlAttribute(node, "name") === name)[0];
		const value = suffix === "ddlJursdiction" ? "AL" : "0";
		if (!select || !stateHtmlDescendants(select, node => node.nodeName === "option" && stateHtmlAttribute(node, "value") === value).length)
			throw new Error("The public candidate search form no longer supports an unfiltered request.");
		fields.set(name, value);
	}
	const button = "ctl00$ContentPlaceHolder1$btnSearch";
	if (!stateHtmlDescendants(document, node => node.nodeName === "input" && stateHtmlAttribute(node, "name") === button && stateHtmlAttribute(node, "value") === "Search").length)
		throw new Error("The public candidate search control has changed.");
	fields.set(button, "Search");
	if (fields.toString().length > 2 * 1024 * 1024)
		throw new Error("The public candidate search form exceeds its size limit.");
	return fields.toString();
}

export async function fetchStateBallotSourceText(source: StateBallotSource, request: SourceTextRequest = fetchRemoteSourceText) {
	if (source.retrievalPolicy === "manual-snapshot")
		throw new Error("This publisher requires a manually supplied candidate snapshot; automatic retrieval is disabled.");
	const options = { allowedHosts: [new URL(source.url).hostname], maxBytes: 12 * 1024 * 1024, maxRedirects: 2, timeoutMs: 12_000 };
	if (source.format === "washington-html")
		return fetchWashingtonCandidatePages(source, request, options);
	if (source.format === "south-carolina-html") {
		const page = await request(source.url, options);
		const records = await request(new URL("/Candidate/CandidateSearch/", source.url).href, { ...options, postBody: buildSouthCarolinaSearchForm(page) });
		if (Buffer.byteLength(page) + Buffer.byteLength(records) > options.maxBytes)
			throw new Error("The public candidate search exceeds its size limit.");
		return JSON.stringify({ page, records });
	}
	if (publicStateExportFormats.includes(source.format)) {
		const page = await request(source.url, options);
		const records = await request(source.url, { ...options, postBody: buildPublicStateExportForm(source, page) });
		if (Buffer.byteLength(page) + Buffer.byteLength(records) > options.maxBytes)
			throw new Error("The combined candidate export exceeds its size limit.");
		return JSON.stringify({ page, records });
	}
	if (source.format === "kentucky-html") {
		const documents = [];
		let size = 0;
		for (const url of source.documentUrls ?? []) {
			if (new URL(url).hostname !== new URL(source.url).hostname)
				throw new Error("A candidate document is outside the source host.");
			const body = await request(url, options);
			size += new TextEncoder().encode(body).length;
			if (size > options.maxBytes) throw new Error("The combined candidate documents exceed their size limit.");
			documents.push({ url, body });
		}
		return JSON.stringify({ documents });
	}
	if (source.format === "north-dakota-html") {
		const form = await request(source.url, options);
		return request(source.url, { ...options, postBody: buildNorthDakotaSearchForm(form) });
	}
	return request(source.url, { ...options, postBody: source.postBody });
}
