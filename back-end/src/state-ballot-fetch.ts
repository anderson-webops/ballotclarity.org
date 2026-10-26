import type { StateBallotSource } from "./state-ballot-sources.js";
import { Buffer } from "node:buffer";
import { fetchRemoteSourceText } from "./remote-json-source.js";
import { fetchCassiaCandidateCapture } from "./state-ballot-cassia.js";
import { fetchCertifiedPdfCapture } from "./state-ballot-certified-pdf.js";
import { fetchClarkCandidateCapture } from "./state-ballot-clark-collection.js";
import { fetchConnecticutCandidateCapture } from "./state-ballot-connecticut-collection.js";
import {
	delawareCandidateRosterUrl,
	getStateBallotCycleFamily,
	readMississippiGeneralElectionDate,
	validStateBallotGeneralDate,
	wyomingCandidateRosterUrl
} from "./state-ballot-cycles.js";
import { dakotaCandidateRosterUrl, validateDakotaCandidatePage } from "./state-ballot-dakota.js";
import { fetchDaneCandidateCapture } from "./state-ballot-dane-collection.js";
import { fetchDcCandidateCapture } from "./state-ballot-dc-collection.js";
import { fetchEastGreenwichCandidateCapture } from "./state-ballot-east-greenwich-collection.js";
import { fetchFranklinCandidateCapture } from "./state-ballot-franklin-collection.js";
import { fetchFultonCandidateCapture } from "./state-ballot-fulton.js";
import { parseStateHtml, stateHtmlAttribute, stateHtmlDescendants, stateHtmlText } from "./state-ballot-html.js";
import { fetchIowaJohnsonCandidateCapture } from "./state-ballot-iowa-johnson.js";
import { fetchIowaPolkCandidateCapture } from "./state-ballot-iowa-polk.js";
import { fetchKansasCandidateCapture } from "./state-ballot-kansas.js";
import { fetchKentuckyCandidateCapture } from "./state-ballot-kentucky.js";
import {
	fetchMarylandCycleDiscovery,
	marylandSourceElectionId,
	readMarylandElectionDiscovery,
	validateMarylandRoster
} from "./state-ballot-maryland.js";
import { fetchMichiganCandidateCapture } from "./state-ballot-michigan.js";
import { fetchNorthCarolinaCandidateCapture } from "./state-ballot-north-carolina.js";
import { fetchOregonCandidateCapture } from "./state-ballot-oregon-collection.js";
import { buildSouthCarolinaSearchForm } from "./state-ballot-portal-records.js";
import { fetchPulaskiCandidateCapture } from "./state-ballot-pulaski-collection.js";
import {
	buildFloridaCandidateForm,
	buildFloridaCountyForm,
	floridaCountyCodesUrl,
	floridaSourceElectionId,
	southCarolinaCandidateRosterUrl
} from "./state-ballot-southern.js";
import { fetchTexasCandidateCapture } from "./state-ballot-texas.js";
import { fetchTuscolaCandidateCapture } from "./state-ballot-tuscola-collection.js";
import { fetchUtahCandidatePage } from "./state-ballot-utah.js";
import { fetchVermontCandidateCapture } from "./state-ballot-vermont.js";
import { fetchVirginiaCandidateCapture } from "./state-ballot-virginia.js";
import { fetchWashingtonCandidatePages } from "./state-ballot-washington.js";
import { fetchWashoeCandidateCapture } from "./state-ballot-washoe.js";

type SourceTextRequest = (url: string, options: { allowedHosts: string[]; maxBytes: number; maxRedirects: number; postBody?: string; timeoutMs: number; textEncoding?: "utf-8" | "utf-8-or-windows-1252" }) => Promise<string>;

export const publicStateExportFormats = ["mississippi-csv", "south-dakota-csv", "hawaii-csv", "illinois-tsv", "montana-csv"];

function assertDakotaSourceIdentity(source: StateBallotSource) {
	const state = source.format === "south-dakota-csv" ? "SD" : "ND";
	const family = getStateBallotCycleFamily(state === "SD" ? "sd-sos-2026" : "nd-sos-2026");
	const electionId = new URL(source.url).searchParams.get("eid") ?? "";
	if (source.stateCode !== state || source.retrievalPolicy || source.postBody || source.documentUrls?.length || source.documentLinks?.length || !validStateBallotGeneralDate(source.electionDate) || source.electionDate < family.source.electionDate || Number(source.electionDate.slice(0, 4)) % 2 || source.id !== (source.electionDate === family.source.electionDate ? family.source.id : `${family.prefix}-${source.electionDate}`) || source.url !== dakotaCandidateRosterUrl(state, electionId) || source.pageUrl !== source.url || ((electionId === new URL(family.source.url).searchParams.get("eid")) !== (source.electionDate === family.source.electionDate))) throw new Error("The Dakota candidate source does not identify the configured general election.");
}

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
		const family = getStateBallotCycleFamily("mt-general-2026");
		const electionId = new URL(source.url).searchParams.get("e");
		const originalId = new URL(family.source.url).searchParams.get("e");
		if (source.stateCode !== "MT" || source.retrievalPolicy || !validStateBallotGeneralDate(source.electionDate) || source.electionDate < family.source.electionDate || Number(source.electionDate.slice(0, 4)) % 2 !== 0 || !electionId || !/^[1-9]\d{0,8}$/u.test(electionId) || source.url !== `${family.discoveryUrl}?e=${electionId}` || source.pageUrl !== source.url || source.id !== (source.electionDate === family.source.electionDate ? family.source.id : `${family.prefix}-${source.electionDate}`) || ((electionId === originalId) !== (source.electionDate === family.source.electionDate)))
			throw new Error("The Montana public export election identity is not configured.");
		const year = source.electionDate.slice(0, 4);
		const label = `FEDERAL GENERAL ${year}`;
		const date = `${source.electionDate.slice(5, 7)}/${source.electionDate.slice(8, 10)}/${year}`;
		if (!content.includes("* = Incumbent")) throw new Error("The Montana public candidate marker legend has changed.");
		const forms = stateHtmlDescendants(document, node => node.nodeName === "form" && stateHtmlAttribute(node, "id") === "frmMain");
		if (forms.length !== 1 || stateHtmlAttribute(forms[0]!, "method").toLowerCase() !== "post") throw new Error("The Montana public export form has changed.");
		const action = new URL(stateHtmlAttribute(forms[0]!, "action"), source.url);
		if (action.href !== source.url) throw new Error("The Montana public export target has changed.");
		if (stateHtmlDescendants(forms[0]!, node => node.nodeName === "select").length !== 2) throw new Error("The Montana public export filters have changed.");
		for (const [name, value] of [["hidElectionDate", label], ["hidElectionType", "General"]]) {
			const key = `ctl00$ContentPlaceHolder1$${name}`;
			const inputs = stateHtmlDescendants(forms[0]!, node => node.nodeName === "input" && stateHtmlAttribute(node, "type") === "hidden" && stateHtmlAttribute(node, "name") === key);
			if (inputs.length !== 1 || stateHtmlAttribute(inputs[0]!, "value") !== value) throw new Error("The Montana public export election identity has changed.");
			fields.set(key, value!);
		}
		for (const [name, value, selectedLabel] of [["ddlElection", electionId, `${label} (${date}) (General)`], ["ddlCounty", "99", "STATE"]]) {
			const key = `ctl00$ContentPlaceHolder1$${name}`;
			const selects = stateHtmlDescendants(forms[0]!, node => node.nodeName === "select" && stateHtmlAttribute(node, "name") === key);
			const selected = selects.length === 1 ? stateHtmlDescendants(selects[0]!, node => node.nodeName === "option" && Boolean(node.attrs?.some(attribute => attribute.name === "selected"))) : [];
			if (selected.length !== 1 || stateHtmlAttribute(selected[0]!, "value") !== value || stateHtmlText(selected[0]!).replace(/\s+/gu, " ").trim() !== selectedLabel)
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
		const family = getStateBallotCycleFamily("ms-sos-2026");
		try {
			if (source.stateCode !== "MS" || source.retrievalPolicy || source.url !== family.discoveryUrl || source.pageUrl !== source.url || source.id !== (source.electionDate === family.source.electionDate ? family.source.id : `${family.prefix}-${source.electionDate}`) || readMississippiGeneralElectionDate(body) !== source.electionDate)
				throw new Error("The Mississippi source identity does not match its report.");
		}
		catch (error) { throw new Error("The public candidate export does not identify the configured general election.", { cause: error }); }
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
			assertDakotaSourceIdentity(source);
			validateDakotaCandidatePage(source, document);
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

export function buildNorthDakotaSearchForm(source: StateBallotSource, body: string) {
	assertDakotaSourceIdentity(source);
	const document = parseStateHtml(body);
	const form = validateDakotaCandidatePage(source, document);
	const fields = new URLSearchParams();
	for (const input of stateHtmlDescendants(form, node => node.nodeName === "input" && stateHtmlAttribute(node, "type") === "hidden")) {
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
	if (source.format === "east-greenwich-pdf") return fetchEastGreenwichCandidateCapture(source);
	if (source.format === "dane-pdf") return fetchDaneCandidateCapture(source);
	if (source.format === "pulaski-pdf") return fetchPulaskiCandidateCapture(source);
	if (source.format === "tuscola-pdf") return fetchTuscolaCandidateCapture(source);
	if (source.format === "dc-pdf") return fetchDcCandidateCapture(source, { requestText: request });
	if (source.format === "franklin-pdf") return fetchFranklinCandidateCapture(source, { requestText: request });
	if (source.format === "cassia-pdf") return fetchCassiaCandidateCapture(source, { requestText: request });
	if (source.format === "iowa-polk-pdf") return fetchIowaPolkCandidateCapture(source, { requestText: request });
	if (source.format === "iowa-johnson-html") return fetchIowaJohnsonCandidateCapture(source, { requestText: request });
	if (source.format === "washoe-html") return fetchWashoeCandidateCapture(source, { requestText: request });
	if (source.format === "clark-pdf") return fetchClarkCandidateCapture(source, { requestText: request });
	if (source.format === "connecticut-pdf") return fetchConnecticutCandidateCapture(source, { requestText: request });
	if (source.retrievalPolicy === "manual-snapshot")
		throw new Error("This publisher requires a manually supplied candidate snapshot; automatic retrieval is disabled.");
	if (source.stateCode === "UT") return fetchUtahCandidatePage(source, request);
	if (source.stateCode === "MI") return fetchMichiganCandidateCapture(source, request);
	if (source.format === "kansas-html") return fetchKansasCandidateCapture(source, request);
	if (source.stateCode === "VA") return fetchVirginiaCandidateCapture(source, request);
	if (source.format === "oregon-pdf") return fetchOregonCandidateCapture(source, { requestText: request });
	if (source.format === "fulton-pdf") return fetchFultonCandidateCapture(source, { requestText: request });
	if (source.format === "vermont-xlsx") return fetchVermontCandidateCapture(source, undefined, { requestText: request });
	if (source.format === "texas-certified-pdf") return fetchTexasCandidateCapture(source, undefined, { requestText: request });
	if (source.format === "certified-pdf") return fetchCertifiedPdfCapture(source, undefined, { requestText: request });
	if (source.stateCode === "WY" && (source.format !== "csv" || !validStateBallotGeneralDate(source.electionDate) || Number(source.electionDate.slice(0, 4)) % 2 || source.url !== wyomingCandidateRosterUrl(source.electionDate))) throw new Error("The Wyoming roster must retain its exact official election URL.");
	if (["south-dakota-csv", "north-dakota-html"].includes(source.format)) assertDakotaSourceIdentity(source);
	if (source.stateCode === "FL" || source.format === "south-carolina-html") {
		const family = getStateBallotCycleFamily(source.stateCode === "FL" ? source.format === "florida-local-tsv" ? "fl-doe-local-2026" : "fl-doe-2026" : "sc-sec-2026");
		const electionId = source.stateCode === "FL" ? floridaSourceElectionId(source) : new URL(source.url).searchParams.get("electionId") ?? "";
		if (source.stateCode !== family.source.stateCode || source.retrievalPolicy || source.documentUrls?.length || source.documentLinks?.length || !validStateBallotGeneralDate(source.electionDate) || source.electionDate < family.source.electionDate || Number(source.electionDate.slice(0, 4)) % 2 || source.id !== (source.electionDate === family.source.electionDate ? family.source.id : `${family.prefix}-${source.electionDate}`) || (source.stateCode === "SC" && (source.postBody || source.url !== southCarolinaCandidateRosterUrl(electionId) || source.pageUrl !== source.url || ((electionId === "22596") !== (source.electionDate === family.source.electionDate))))) throw new Error("The public candidate source does not identify the approved state and general election.");
	}
	if (source.format === "delaware-html") {
		const family = getStateBallotCycleFamily("de-doe-2026");
		if (source.stateCode !== "DE" || !validStateBallotGeneralDate(source.electionDate) || source.electionDate < family.source.electionDate || Number(source.electionDate.slice(0, 4)) % 2 || source.id !== (source.electionDate === family.source.electionDate ? family.source.id : `${family.prefix}-${source.electionDate}`) || source.url !== delawareCandidateRosterUrl(source.electionDate) || source.pageUrl !== source.url) throw new Error("The Delaware roster must retain its exact official election identity and URL.");
	}
	if (source.stateCode === "NC") return fetchNorthCarolinaCandidateCapture(source, request);
	if (source.stateCode === "KY") return fetchKentuckyCandidateCapture(source, request);
	const options = { allowedHosts: [new URL(source.url).hostname], maxBytes: 12 * 1024 * 1024, maxRedirects: ["WY", "FL"].includes(source.stateCode) || ["montana-csv", "mississippi-csv", "delaware-html", "south-dakota-csv", "north-dakota-html", "south-carolina-html"].includes(source.format) ? 0 : 2, timeoutMs: 12_000 };
	if (source.stateCode === "MD") {
		const electionId = marylandSourceElectionId(source);
		const discovery = await fetchMarylandCycleDiscovery(request);
		const elections = readMarylandElectionDiscovery(discovery, source.format === "csv" ? "state" : "local");
		if (elections.filter(election => election.electionId === electionId && election.electionDate === source.electionDate && election.rosterUrl === source.pageUrl).length !== 1) throw new Error("The Maryland candidate source is not currently published by its election index.");
		const bounded = { ...options, maxRedirects: 0 };
		const roster = await request(source.pageUrl, bounded);
		validateMarylandRoster(source, roster);
		const records = await request(source.url, bounded);
		const body = JSON.stringify({ schemaVersion: 1, type: "maryland-candidate-export", discovery, roster, records });
		if (Buffer.byteLength(body) > options.maxBytes) throw new Error("The combined Maryland candidate capture exceeds its bounds.");
		return body;
	}
	if (source.stateCode === "FL") {
		const page = await request(source.pageUrl, options);
		const postBody = buildFloridaCandidateForm(source, page);
		if (source.format === "florida-local-tsv") {
			const countyCodes = await request(floridaCountyCodesUrl, { ...options, postBody: buildFloridaCountyForm(page) });
			const records = await request(source.url, { ...options, postBody, textEncoding: "utf-8-or-windows-1252" });
			const envelope = JSON.stringify({ schemaVersion: 1, type: "florida-local-export", page, countyCodes, records });
			if (Buffer.byteLength(envelope) > options.maxBytes) throw new Error("The combined Florida local export exceeds its bounds.");
			return envelope;
		}
		return request(source.url, { ...options, postBody });
	}
	if (source.format === "washington-html")
		return fetchWashingtonCandidatePages(source, request, options);
	if (source.format === "south-carolina-html") {
		const page = await request(source.url, options);
		const records = await request(new URL("/Candidate/CandidateSearch/", source.url).href, { ...options, postBody: buildSouthCarolinaSearchForm(source, page) });
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
	if (source.format === "north-dakota-html") {
		const form = await request(source.url, options);
		return request(source.url, { ...options, postBody: buildNorthDakotaSearchForm(source, form) });
	}
	return request(source.url, { ...options, postBody: source.postBody });
}
