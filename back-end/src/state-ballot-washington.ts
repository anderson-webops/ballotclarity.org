import type { StateCandidateValues } from "./state-ballot-additional-records.js";
import type { StateHtmlNode } from "./state-ballot-html.js";
import type { StateCandidateRecord, StateContestScope } from "./state-ballot-records.js";
import type { StateBallotSource } from "./state-ballot-sources.js";
import { Buffer } from "node:buffer";
import { setTimeout } from "node:timers/promises";
import { stateHtmlAttribute as attribute, stateHtmlDescendants as descendants, parseStateHtml, stateHtmlText } from "./state-ballot-html.js";

const prefix = "ctl00$ContentPlaceHolder1$";
const grid = `${prefix}grdCandidates`;
const headers = ["District Type", "District", "Race", "Term Type", "Term Length", "Name", "Mailing Address", "Email", "Phone", "Filing Date", "Party Preference", "Status", "Election Status", "Ballot Order"];
const filters = ["DistrictType", "Jurisdiction", "Race", "BallotName", "PetitionFilingDate", "PoliticalPartyID"];
const localTypes = ["PUBLIC UTILITY", "COUNTYWIDE", "COMMISSIONER", "COUNTY", "COUNCIL", "PORT", "FIRE", "DISTRICT COURT", "CITY/TOWN", "CITY COUNCIL", "JUDICIAL"];
const clean = (node: StateHtmlNode) => stateHtmlText(node).replace(/\s+/gu, " ").trim();
const hasClass = (node: StateHtmlNode, value: string) => attribute(node, "class").split(/\s+/u).includes(value);
const hasAttribute = (node: StateHtmlNode, value: string) => Boolean(node.attrs?.some(item => item.name === value));
type TextRequest = (url: string, options: { allowedHosts: string[]; maxBytes: number; maxRedirects: number; postBody?: string; timeoutMs: number }) => Promise<string>;
type RecordFactory = (source: StateBallotSource, values: StateCandidateValues) => StateCandidateRecord | null;

function selectedOption(form: StateHtmlNode, name: string, value: string, label: string) {
	const controls = descendants(form, node => node.nodeName === "select" && attribute(node, "name") === name);
	if (controls.length !== 1) throw new Error("The Washington candidate selection controls have changed.");
	const options = descendants(controls[0]!, node => node.nodeName === "option");
	const selected = options.filter(node => hasAttribute(node, "selected"));
	const option = selected.length ? selected[0] : options[0];
	if (selected.length > 1 || !option || attribute(option, "value") !== value || clean(option) !== label)
		throw new Error("The Washington public list does not select the unfiltered configured general election.");
}

export function inspectWashingtonCandidatePage(source: StateBallotSource, body: string, pageNumber: number) {
	const url = new URL(source.url);
	const electionId = url.searchParams.get("e");
	const electionTime = Date.parse(`${source.electionDate}T00:00:00Z`);
	if (source.stateCode !== "WA" || url.origin !== "https://voter.votewa.gov" || url.username || url.password || url.pathname !== "/CandidateList.aspx" || !electionId || !/^\d+$/u.test(electionId) || [...url.searchParams.keys()].join(",") !== "e" || url.hash || !/^\d{4}-\d{2}-\d{2}$/u.test(source.electionDate) || !Number.isFinite(electionTime) || new Date(electionTime).toISOString().slice(0, 10) !== source.electionDate)
		throw new Error("The Washington public candidate source is not configured.");
	if (Buffer.byteLength(body) > 2 * 1024 * 1024) throw new Error("The Washington candidate page exceeds its size limit.");
	const document = parseStateHtml(body);
	const forms = descendants(document, node => node.nodeName === "form");
	if (forms.length !== 1 || attribute(forms[0]!, "method").toLowerCase() !== "post" || new URL(attribute(forms[0]!, "action"), source.url).href !== source.url)
		throw new Error("The Washington public candidate form target has changed.");
	const form = forms[0]!;
	if (descendants(form, node => node.nodeName === "select").length !== 3) throw new Error("The Washington public candidate filters have changed.");
	const [year, month, day] = source.electionDate.split("-");
	selectedOption(form, `${prefix}ddlElection`, electionId, `GENERAL ${year} (${month}/${day}/${year}) (General)`);
	selectedOption(form, `${prefix}ddlCounty`, "", "");
	selectedOption(form, "ctl00$ddlLanguages", "en-us", "English");
	for (const [name, value] of [["hidElectionDate", `GENERAL ${year}`], ["hidElectionType", "General"]]) {
		const inputs = descendants(form, node => node.nodeName === "input" && attribute(node, "name") === `${prefix}${name}` && attribute(node, "type") === "hidden");
		if (inputs.length !== 1 || attribute(inputs[0]!, "value") !== value) throw new Error("The Washington public candidate election identity has changed.");
	}
	const filterInputs = descendants(form, node => node.nodeName === "input" && hasClass(node, "rgFilterBox"));
	if (filterInputs.length !== filters.length || filterInputs.some((node, index) => attribute(node, "name") !== `${grid}$ctl00$ctl02$ctl03$FilterTextBox_${filters[index]}` || attribute(node, "value")))
		throw new Error("The Washington public candidate list is filtered or its filters have changed.");
	const tables = descendants(form, node => node.nodeName === "table" && attribute(node, "id") === "ctl00_ContentPlaceHolder1_grdCandidates_ctl00");
	if (tables.length !== 1) throw new Error("The Washington candidate table has changed.");
	const table = tables[0]!;
	const columns = descendants(table, node => node.nodeName === "th" && hasClass(node, "rgHeader")).map(clean);
	if (columns.join("|") !== headers.join("|")) throw new Error("The Washington public candidate columns have changed.");
	const info = descendants(table, node => hasClass(node, "rgInfoPart"));
	const counts = info.length === 1 ? /^(\d+) items in (\d+) pages$/u.exec(clean(info[0]!)) : null;
	if (!counts) throw new Error("The Washington candidate pagination totals have changed.");
	const totalRecords = Number(counts[1]);
	const totalPages = Number(counts[2]);
	if (!totalRecords || totalRecords > 2500 || totalPages !== Math.ceil(totalRecords / 100) || pageNumber < 1 || pageNumber > totalPages)
		throw new Error("The Washington candidate pagination exceeds its bounds.");
	const current = descendants(table, node => node.nodeName === "a" && hasClass(node, "rgCurrentPage"));
	if (current.length !== 1 || clean(current[0]!) !== String(pageNumber)) throw new Error("The Washington candidate page is repeated or out of order.");
	const sizes = descendants(table, node => node.nodeName === "input" && attribute(node, "name") === `${grid}$ctl00$ctl03$ctl01$PageSizeComboBox`);
	if (sizes.length !== 1 || attribute(sizes[0]!, "value") !== "100") throw new Error("The Washington candidate page size has changed.");
	const rows = descendants(table, node => node.nodeName === "tr" && (hasClass(node, "rgRow") || hasClass(node, "rgAltRow")));
	if (rows.length !== Math.min(100, totalRecords - (pageNumber - 1) * 100)) throw new Error("The Washington candidate page is incomplete.");
	const records = rows.map((row) => {
		const cells = (row.childNodes ?? []).filter(node => node.nodeName === "td");
		if (cells.length !== headers.length) throw new Error("The Washington candidate row layout has changed.");
		return { cells, values: cells.map(clean) };
	});
	return { form, table, electionId, totalRecords, totalPages, records };
}

export function buildWashingtonPageForm(source: StateBallotSource, body: string, currentPage: number) {
	const page = inspectWashingtonCandidatePage(source, body, currentPage);
	if (currentPage >= page.totalPages) throw new Error("The Washington candidate list has no next page.");
	const links = descendants(page.table, node => node.nodeName === "a" && clean(node) === String(currentPage + 1));
	const target = links.length === 1 ? /^javascript:__doPostBack\('(ctl00\$ContentPlaceHolder1\$grdCandidates\$ctl00\$ctl03\$ctl01\$ctl\d+)',''\)$/u.exec(attribute(links[0]!, "href")) : null;
	if (!target) throw new Error("The Washington public pagination control has changed.");
	const fields = new URLSearchParams();
	for (const input of descendants(page.form, node => node.nodeName === "input" && attribute(node, "type") === "hidden")) {
		const name = attribute(input, "name");
		if (!name || fields.has(name) || hasAttribute(input, "disabled")) throw new Error("The Washington public hidden controls have changed.");
		fields.set(name, attribute(input, "value"));
	}
	for (const [name, value] of [["ctl00$ddlLanguages", "en-us"], ["ctl00$txtSearch", ""], [`${prefix}ddlElection`, page.electionId], [`${prefix}ddlCounty`, ""], [`${grid}$ctl00$ctl03$ctl01$PageSizeComboBox`, "100"]]) fields.set(name!, value!);
	for (const filter of filters) fields.set(`${grid}$ctl00$ctl02$ctl03$FilterTextBox_${filter}`, "");
	fields.set("__EVENTTARGET", target[1]!);
	fields.set("__EVENTARGUMENT", "");
	if (fields.toString().length > 2 * 1024 * 1024) throw new Error("The Washington public pagination form exceeds its size limit.");
	return fields.toString();
}

export async function fetchWashingtonCandidatePages(source: StateBallotSource, request: TextRequest, options: Parameters<TextRequest>[1], pause: () => Promise<unknown> = () => setTimeout(1000)) {
	const pages: string[] = [];
	let size = 0;
	let totalRecords = 0;
	let totalPages = 1;
	for (let pageNumber = 1; pageNumber <= totalPages; pageNumber++) {
		if (pageNumber > 1) await pause();
		const body = await request(source.url, { ...options, maxRedirects: 0, ...(pageNumber > 1 ? { postBody: buildWashingtonPageForm(source, pages.at(-1)!, pageNumber - 1) } : {}) });
		size += Buffer.byteLength(body);
		if (size > options.maxBytes) throw new Error("The combined Washington candidate pages exceed their size limit.");
		const page = inspectWashingtonCandidatePage(source, body, pageNumber);
		if (pageNumber > 1 && (page.totalPages !== totalPages || page.totalRecords !== totalRecords)) throw new Error("The Washington candidate totals changed during pagination.");
		totalPages = page.totalPages;
		totalRecords = page.totalRecords;
		pages.push(body);
	}
	const envelope = JSON.stringify({ pages });
	if (Buffer.byteLength(envelope) > options.maxBytes) throw new Error("The Washington candidate envelope exceeds its size limit.");
	return envelope;
}

export function parseWashingtonCandidateRecords(source: StateBallotSource, body: string, factory: RecordFactory) {
	if (Buffer.byteLength(body) > 12 * 1024 * 1024) throw new Error("The Washington candidate envelope exceeds its size limit.");
	const envelope = JSON.parse(body) as { pages?: unknown };
	if (!envelope || Object.keys(envelope).join(",") !== "pages" || !Array.isArray(envelope.pages) || !envelope.pages.length || envelope.pages.length > 25 || envelope.pages.some(page => typeof page !== "string"))
		throw new Error("The Washington public candidate envelope has changed.");
	const pages = (envelope.pages as string[]).map((page, index) => inspectWashingtonCandidatePage(source, page, index + 1));
	const first = pages[0]!;
	if (pages.length !== first.totalPages || pages.some(page => page.totalRecords !== first.totalRecords || page.totalPages !== first.totalPages))
		throw new Error("The Washington candidate page set is incomplete or inconsistent.");
	const identifiers = new Set<string>();
	const records = pages.flatMap(page => page.records.map(({ cells, values }) => {
		const [type, label, title, termType, termLength, name] = values;
		const party = values[10]!;
		const status = values[11]!;
		const electionStatus = values[12]!;
		const order = values[13]!;
		if (!name || !title || !label || status !== "Active" || !["", "In General"].includes(electionStatus) || !["Regular", "Short & Full", "Unexpired", "Initial Full"].includes(termType!) || !/^[1-6]$/u.test(termLength!) || !/^[1-9]\d*$/u.test(order))
			throw new Error("The Washington candidate status, identity or term vocabulary has changed.");
		const links = descendants(cells[5]!, node => node.nodeName === "a");
		const href = links.length === 1 ? new URL(attribute(links[0]!, "href"), source.url) : null;
		const candidate = href ? /^#\/candidates\/([1-9]\d*)\/([1-9]\d*)$/u.exec(href.hash) : null;
		if (!href || href.origin !== new URL(source.url).origin || href.pathname !== "/genericvoterguide.aspx" || href.search !== `?e=${page.electionId}&c=` || !candidate || clean(links[0]!) !== name)
			throw new Error("The Washington public candidate identifiers have changed.");
		const sourceCandidateId = `${candidate[1]}/${candidate[2]}`;
		if (identifiers.has(sourceCandidateId)) throw new Error("The Washington public pages contain duplicate candidate identities.");
		identifiers.add(sourceCandidateId);
		let scope: StateContestScope = "local";
		let district = "";
		let office = title!;
		const category = type!.toUpperCase();
		if (category === "CONGRESSIONAL" || category === "LEGISLATIVE") {
			const match = new RegExp(`^${category === "CONGRESSIONAL" ? "CONGRESSIONAL" : "LEGISLATIVE"} DISTRICT ([1-9]\\d*)$`, "u").exec(label!.toUpperCase());
			if (!match || Number(match[1]) > (category === "CONGRESSIONAL" ? 10 : 49) || (category === "CONGRESSIONAL" ? title !== "U.S. Representative" : !/^(?:State Senator|State Representative Pos\. [12])$/u.test(title!)))
				throw new Error("The Washington legislative or congressional district has changed.");
			scope = category === "CONGRESSIONAL" ? "congressional" : title === "State Senator" ? "state-senate" : "state-house";
			district = match[1]!;
		}
		else if (category === "JUDICIAL" && label === "Supreme Court") {
			if (!/^Justice Position #0?[1-9]$/u.test(title!)) throw new Error("The Washington statewide judicial office has changed.");
			scope = "statewide";
			office = `${label} - ${title}`;
		}
		else if (!localTypes.includes(category)) {
			throw new Error("The Washington candidate district-type vocabulary has changed.");
		}
		if (termType !== "Regular") office += ` (${termType})`;
		const record = factory(source, { name: name!, office, party, scope, district, jurisdiction: scope === "local" ? label : undefined, status, sourceCandidateId, sourceDistrictLabel: label });
		if (!record) throw new Error("The Washington public list contains an incomplete candidate.");
		record.sourceStatus = [status, electionStatus].filter(Boolean).join("; ");
		record.ballotDesignation = `${termType}; listed term length: ${termLength}; ballot order: ${order}`;
		return record;
	}));
	if (records.length !== first.totalRecords || new Set(records.map(record => record.id)).size !== records.length) throw new Error("The Washington public candidate count does not reconcile.");
	return records;
}
