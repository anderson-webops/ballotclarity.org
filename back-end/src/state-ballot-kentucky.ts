import type { StateCandidateValues } from "./state-ballot-additional-records.js";
import type { StateHtmlNode } from "./state-ballot-html.js";
import type { StateCandidateRecord } from "./state-ballot-records.js";
import type { StateBallotSource } from "./state-ballot-sources.js";
import { Buffer } from "node:buffer";
import { stateHtmlAttribute as attribute, stateHtmlDescendants as descendants, parseStateHtml, stateHtmlTableRows, stateHtmlText } from "./state-ballot-html.js";
import { StateBallotAwaitingRecordsError } from "./state-ballot-source-state.js";

export const kentuckyDiscoveryUrl = "https://web.sos.ky.gov/CandidateFilings/";
export const kentuckyCalendarUrl = "https://elect.ky.gov/Pages/default.aspx";
export const kentuckyOriginalElectionId = "87";
const selection = "ctl00$MainContent$ddlElection";
const filters = ["ctl00$MainContent$tFName", "ctl00$MainContent$tLName", "ctl00$MainContent$tDatefiled"];
const hiddenControl = (name: string, value: string, url: string) => /^__(?:VIEWSTATE(?:\d*|GENERATOR|FIELDCOUNT)|EVENTVALIDATION|EVENTTARGET|EVENTARGUMENT)$/u.test(name) || (name === "ctl00$MainContent$hfLastResultsUrl" && (!value || new URL(value, url).href === url));
const clean = (value: string) => value.normalize("NFKC").replace(/[\u200B-\u200D\uFEFF]/gu, "").replace(/\s+/gu, " ").trim();
const text = (node: StateHtmlNode) => clean(stateHtmlText(node));
const cells = (node: StateHtmlNode) => (node.childNodes ?? []).filter(child => ["th", "td"].includes(child.nodeName));
const exact = (value: unknown, keys: string[]): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).sort().join(",") === keys.sort().join(","));
const originalDocuments = ["3", "4", "11", "12"].map(id => `${kentuckyDiscoveryUrl}Default.aspx?id=${id}`).concat(`${kentuckyDiscoveryUrl}Default.aspx?withdrawn=1`);
const courtOffice = (office: string) => /\b(?:Judge|Justice)\b|^Commonwealth's Attorney$/iu.test(office);
const measureOffice = (office: string) => /^Constitutional Amendment \d+$/iu.test(office);
type Kind = "core" | "courts";
type RequestText = (url: string, options: { allowedHosts: string[]; maxBytes: number; maxRedirects: number; timeoutMs: number; postBody?: string }) => Promise<string>;
const options = { allowedHosts: ["web.sos.ky.gov", "elect.ky.gov"], maxBytes: 2 * 1024 * 1024, maxRedirects: 0, timeoutMs: 12000 };

export function kentuckyCandidatePostBody(electionId: string) {
	if (!/^[1-9]\d{0,8}$/u.test(electionId)) throw new Error("The Kentucky election control is invalid.");
	return new URLSearchParams({ [selection]: electionId }).toString();
}

export function kentuckySourceElectionId(source: StateBallotSource) {
	const kind = source.format === "kentucky-html" ? "core" : "courts";
	const current = source.electionDate === "2026-11-03";
	const expected = current ? kind === "core" ? "ky-sos-2026" : "ky-courts-2026" : `ky-general-${kind}-${source.electionDate}`;
	const fields = new URLSearchParams(source.postBody);
	const electionId = current ? kentuckyOriginalElectionId : fields.get(selection) ?? "";
	if (source.stateCode !== "KY" || !["kentucky-html", "kentucky-courts-html"].includes(source.format) || source.id !== expected || source.retrievalPolicy || source.url !== kentuckyDiscoveryUrl || source.pageUrl !== kentuckyDiscoveryUrl || source.documentLinks?.length || source.delimiter || !/^20\d{2}-11-0[2-8]$/u.test(source.electionDate) || new Date(source.electionDate).getUTCDay() !== 2 || source.electionDate < "2026-11-03" || (current ? source.postBody !== undefined : source.postBody !== kentuckyCandidatePostBody(electionId)) || JSON.stringify(source.documentUrls) !== JSON.stringify(current && kind === "core" ? originalDocuments : undefined)) throw new Error("The Kentucky source does not retain its approved general-election identity.");
	return electionId;
}

function readPortal(body: string, url = kentuckyDiscoveryUrl) {
	if (Buffer.byteLength(body) > options.maxBytes) throw new Error("The Kentucky public page exceeds its bounds.");
	const document = parseStateHtml(body);
	const forms = descendants(document, node => node.nodeName === "form");
	const selects = descendants(document, node => node.nodeName === "select" && attribute(node, "name") === selection);
	if (forms.length !== 1 || selects.length !== 1 || attribute(forms[0]!, "id") !== "aspnetForm" || attribute(forms[0]!, "method").toLowerCase() !== "post" || new URL(attribute(forms[0]!, "action"), url).href !== url || !descendants(forms[0]!, node => node === selects[0]).length) throw new Error("The Kentucky public election form has changed.");
	const elections = descendants(selects[0]!, node => node.nodeName === "option");
	const chosen = elections.filter(node => node.attrs?.some(item => item.name === "selected"));
	const title = descendants(document, node => node.nodeName === "title");
	const expectedTitle = url === `${kentuckyDiscoveryUrl}Default.aspx?withdrawn=1` ? "Election Candidate Filings - Withdrawn/Deceased/Disqualified" : `Election: ${chosen[0] ? text(chosen[0]) : ""}`;
	if (!elections.length || elections.length > 100 || new Set(elections.map(node => attribute(node, "value"))).size !== elections.length || elections.some(node => !/^[1-9]\d{0,8}$/u.test(attribute(node, "value"))) || chosen.length !== 1 || title.length !== 1 || text(title[0]!) !== expectedTitle) throw new Error("The Kentucky selected election is missing or inconsistent.");
	const general = elections.flatMap((node) => {
		const label = /^(20\d{2}) General Election$/u.exec(text(node));
		return label && label[1]! >= "2026" ? [{ year: label[1]!, electionId: attribute(node, "value") }] : [];
	});
	if (new Set(general.map(item => item.year)).size !== general.length) throw new Error("The Kentucky general-election year controls are ambiguous.");
	const controls = descendants(forms[0]!, node => ["input", "select"].includes(node.nodeName));
	if (new Set(controls.map(node => attribute(node, "name"))).size !== controls.length) throw new Error("The Kentucky public form contains duplicate controls.");
	for (const input of controls.filter(node => node.nodeName === "input" && attribute(node, "type") === "hidden")) {
		if (!hiddenControl(attribute(input, "name"), attribute(input, "value"), url)) throw new Error("The Kentucky public form has unfamiliar hidden controls.");
	}
	for (const input of descendants(document, node => node.nodeName === "input" && attribute(node, "type") === "text")) {
		if (!filters.includes(attribute(input, "name")) || attribute(input, "value")) throw new Error("The Kentucky candidate view contains an unfamiliar or nonempty filter.");
	}
	for (const select of descendants(document, node => node.nodeName === "select")) {
		const name = attribute(select, "name");
		if (![selection, "ctl00$MainContent$ddlParty"].includes(name)) throw new Error("The Kentucky candidate view has an unfamiliar selection filter.");
		if (name === selection) continue;
		const entries = descendants(select, node => node.nodeName === "option");
		const selected = entries.filter(node => node.attrs?.some(item => item.name === "selected"));
		if (selected.length > 1 || !entries.length || attribute(selected[0] ?? entries[0]!, "value") !== "") throw new Error("The Kentucky candidate view is party-filtered.");
	}
	return { document, general, selectedId: attribute(chosen[0]!, "value"), selectedLabel: text(chosen[0]!) };
}

export function readKentuckyGeneralDates(body: string) {
	if (Buffer.byteLength(body) > options.maxBytes) throw new Error("The Kentucky election-date page exceeds its bounds.");
	const document = parseStateHtml(body);
	const candidates = descendants(document, node => node.nodeName === "li").flatMap((node) => {
		const label = text(node);
		const date = /^November (\d{1,2}), (20\d{2}) [-\u2013\u2014] General Election Day$/u.exec(label);
		if (!date && label.includes("General Election Day")) throw new Error("The Kentucky general-election date label is unfamiliar.");
		return date ? [`${date[2]}-11-${date[1]!.padStart(2, "0")}`] : [];
	});
	const dates = [...new Set(candidates)];
	if (!dates.length || dates.length > 25 || new Set(dates.map(date => date.slice(0, 4))).size !== dates.length || dates.some(date => !/^20\d{2}-11-0[2-8]$/u.test(date) || date < "2026-11-03" || new Date(date).getUTCDay() !== 2 || !text(document).includes(`${date.slice(0, 4)} General Election Dates`))) throw new Error("The Kentucky published general-election date is missing or contradictory.");
	return dates.sort();
}

export function buildKentuckyElectionForm(body: string, url: string, electionId: string) {
	const portal = readPortal(body, url);
	if (!portal.general.some(item => item.electionId === electionId)) throw new Error("The Kentucky general election is not offered by this public form.");
	const fields = new URLSearchParams();
	for (const input of descendants(portal.document, node => node.nodeName === "input")) {
		const name = attribute(input, "name");
		const type = attribute(input, "type");
		if (type === "hidden") {
			if (!hiddenControl(name, attribute(input, "value"), url) || fields.has(name)) throw new Error("The Kentucky public form has unfamiliar hidden controls.");
			fields.set(name, attribute(input, "value"));
		}
		else if (type === "text") {
			if (!filters.includes(name) || attribute(input, "value")) throw new Error("The Kentucky public form has an unfamiliar or nonempty filter.");
			fields.set(name, "");
		}
	}
	for (const select of descendants(portal.document, node => node.nodeName === "select")) {
		const name = attribute(select, "name");
		if (![selection, "ctl00$MainContent$ddlParty"].includes(name)) throw new Error("The Kentucky candidate form contains an unfamiliar filter.");
		fields.set(name, name === selection ? electionId : "");
	}
	if (!fields.get("__VIEWSTATE") || !fields.get("__EVENTVALIDATION")) throw new Error("The Kentucky public form state is incomplete.");
	fields.set("__EVENTTARGET", selection);
	fields.set("__EVENTARGUMENT", "");
	const encoded = fields.toString();
	if (Buffer.byteLength(encoded) > 4 * 1024 * 1024) throw new Error("The Kentucky public form state exceeds its bounds.");
	return encoded;
}

async function selectedPage(request: RequestText, url: string, body: string, electionId: string, year: string) {
	const initial = readPortal(body, url);
	const selected = initial.selectedId === electionId ? body : await request(url, { ...options, postBody: buildKentuckyElectionForm(body, url, electionId) });
	const portal = readPortal(selected, url);
	if (portal.selectedId !== electionId || portal.selectedLabel !== `${year} General Election`) throw new Error("The Kentucky public response did not apply the selected general election.");
	return selected;
}

interface OfficeGroup { url: string; label: string; count: number; kind: Kind }

function officeHeading(value: string) {
	const suffix = /\((\d{1,5})\)$/u.exec(value);
	const label = suffix ? value.slice(0, suffix.index).trim() : "";
	return suffix && label ? { label, count: Number(suffix[1]) } : null;
}

function directory(body: string) {
	const document = readPortal(body).document;
	const groups: OfficeGroup[] = [];
	let withdrawn: { url: string; count: number } | undefined;
	for (const link of descendants(document, node => node.nodeName === "a")) {
		const label = officeHeading(text(link));
		if (!label) continue;
		const name = label.label;
		const count = label.count;
		const url = new URL(attribute(link, "href"), kentuckyDiscoveryUrl);
		if (url.origin !== new URL(kentuckyDiscoveryUrl).origin || url.pathname !== "/CandidateFilings/Default.aspx" || url.hash || count > 25000) throw new Error("A Kentucky directory control is outside its public candidate view.");
		if (name.replaceAll(" ", "") === "Withdrawn/Deceased/Disqualified") {
			if (withdrawn || url.search !== "?withdrawn=1") throw new Error("The Kentucky inactive-candidate control is ambiguous.");
			withdrawn = { url: url.href, count };
		}
		else if (measureOffice(name)) {
			if (!/^\?id=[1-9]\d{0,8}$/u.test(url.search)) throw new Error("The Kentucky measure directory control has changed.");
		}
		else {
			const kind = courtOffice(name) ? "courts" : "core";
			if (!/^\?id=[1-9]\d{0,8}$/u.test(url.search) || groups.some(group => group.url === url.href || group.label === name)) throw new Error("The Kentucky office directory is unfamiliar or duplicated.");
			groups.push({ url: url.href, label: name, count, kind });
		}
	}
	if (!withdrawn || groups.length > 30) throw new Error("The Kentucky office directory is incomplete or oversized.");
	return { groups, withdrawn };
}

export function readKentuckyElectionDiscovery(body: string) {
	if (Buffer.byteLength(body) > 4 * 1024 * 1024) throw new Error("The Kentucky discovery capture exceeds its bounds.");
	const value: unknown = JSON.parse(body);
	if (!exact(value, ["schemaVersion", "type", "index", "calendar", "selections"]) || value.schemaVersion !== 1 || value.type !== "kentucky-election-discovery" || typeof value.index !== "string" || typeof value.calendar !== "string" || !Array.isArray(value.selections)) throw new Error("The Kentucky election discovery capture is invalid.");
	const offered = readPortal(value.index).general;
	const elections = readKentuckyGeneralDates(value.calendar).flatMap((electionDate) => {
		const election = offered.find(item => item.year === electionDate.slice(0, 4));
		return election ? [{ electionId: election.electionId, electionDate }] : [];
	});
	if (!elections.length || value.selections.length !== elections.length) throw new Error("The Kentucky calendar and candidate election do not agree.");
	for (const [index, election] of elections.entries()) {
		const captured = value.selections[index];
		if (!exact(captured, ["electionId", "body"]) || captured.electionId !== election.electionId || typeof captured.body !== "string") throw new Error("The Kentucky election selections are missing or changed.");
		const selected = readPortal(captured.body);
		const year = election.electionDate.slice(0, 4);
		if (selected.selectedId !== election.electionId || selected.selectedLabel !== `${year} General Election` || !selected.general.some(item => item.year === year && item.electionId === election.electionId)) throw new Error("The Kentucky selected calendar and candidate election do not agree.");
		directory(captured.body);
	}
	return elections;
}

export async function fetchKentuckyCycleDiscovery(request: RequestText) {
	const index = await request(kentuckyDiscoveryUrl, options);
	const calendar = await request(kentuckyCalendarUrl, options);
	const offered = readPortal(index).general;
	const selections = [];
	let selected = index;
	for (const electionDate of readKentuckyGeneralDates(calendar)) {
		const election = offered.find(item => item.year === electionDate.slice(0, 4));
		if (!election) continue;
		selected = await selectedPage(request, kentuckyDiscoveryUrl, selected, election.electionId, election.year);
		selections.push({ electionId: election.electionId, body: selected });
	}
	const body = JSON.stringify({ schemaVersion: 1, type: "kentucky-election-discovery", index, calendar, selections });
	readKentuckyElectionDiscovery(body);
	return body;
}

function captureContext(source: StateBallotSource, discovery: string) {
	const electionId = kentuckySourceElectionId(source);
	const election = readKentuckyElectionDiscovery(discovery).find(item => item.electionId === electionId && item.electionDate === source.electionDate);
	if (!election) throw new Error("The Kentucky source is not the published general election.");
	const kind: Kind = source.format === "kentucky-html" ? "core" : "courts";
	const offered = directory(JSON.parse(discovery).selections.find((item: { electionId: string }) => item.electionId === electionId).body);
	const groups = offered.groups.filter(group => group.kind === kind);
	const urls = groups.map(group => group.url).concat(offered.withdrawn.url);
	if (source.documentUrls && JSON.stringify(source.documentUrls) !== JSON.stringify(urls)) throw new Error("The Kentucky legacy candidate document set has changed.");
	return { electionId, kind, groups, urls, reportedInactiveDirectoryTotal: offered.withdrawn.count };
}

export async function fetchKentuckyCandidateCapture(source: StateBallotSource, request: RequestText, discovery?: string) {
	kentuckySourceElectionId(source);
	const evidence = discovery ?? await fetchKentuckyCycleDiscovery(request);
	const context = captureContext(source, evidence);
	const documents = [];
	for (const url of context.urls) {
		const page = await request(url, options);
		const body = await selectedPage(request, url, page, context.electionId, source.electionDate.slice(0, 4));
		documents.push({ url, body });
		if (Buffer.byteLength(JSON.stringify({ discovery: evidence, documents })) > 12 * 1024 * 1024) throw new Error("The combined Kentucky candidate pages exceed their bounds.");
	}
	return JSON.stringify({ schemaVersion: 1, type: "kentucky-candidate-export", discovery: evidence, documents });
}

interface ParsedRow { values: StateCandidateValues; tableOffice: string; fullSeat: string }

export function parseKentuckyCandidateRecords(source: StateBallotSource, body: string, makeRecord: (source: StateBallotSource, values: StateCandidateValues) => StateCandidateRecord | null): StateCandidateRecord[] {
	if (Buffer.byteLength(body) > 12 * 1024 * 1024) throw new Error("The Kentucky candidate capture exceeds its bounds.");
	const value: unknown = JSON.parse(body);
	if (!exact(value, ["schemaVersion", "type", "discovery", "documents"]) || value.schemaVersion !== 1 || value.type !== "kentucky-candidate-export" || typeof value.discovery !== "string" || !Array.isArray(value.documents)) throw new Error("The Kentucky candidate capture is invalid.");
	const context = captureContext(source, value.discovery);
	if (JSON.stringify(value.documents.map(item => item?.url)) !== JSON.stringify(context.urls)) throw new Error("The Kentucky candidate pages are missing, reordered or substituted.");
	const rows: ParsedRow[] = [];
	for (const item of value.documents) {
		if (!exact(item, ["url", "body"]) || typeof item.url !== "string" || typeof item.body !== "string") throw new Error("The Kentucky candidate page is invalid.");
		const portal = readPortal(item.body, item.url);
		if (portal.selectedId !== context.electionId || portal.selectedLabel !== `${source.electionDate.slice(0, 4)} General Election`) throw new Error("The Kentucky candidate page belongs to another election.");
		const group = context.groups.find(group => group.url === item.url);
		const globalInactive = !group;
		const resultId = globalInactive ? "ctl00_MainContent_pnlResults" : "ctl00_MainContent_pOfficeResults";
		if (descendants(portal.document, node => node.nodeName === "div" && attribute(node, "id") === resultId).length !== 1) throw new Error("The Kentucky candidate result section is missing or changed.");
		const inactiveTables = new Set(descendants(portal.document, node => node.nodeName === "div" && ["ctl00_MainContent_pnlOfficeWddResults", "ctl00_MainContent_pnlWddResults"].includes(attribute(node, "id"))).flatMap(node => descendants(node, child => child.nodeName === "table")));
		const tables = descendants(portal.document, node => node.nodeName === "table").filter((table) => {
			const header = stateHtmlTableRows(table)[0];
			return header && cells(header).map(text).some(label => label === "Office" || label === "District/Division");
		});
		let activeCount = 0;
		for (const table of tables) {
			const tableRows = stateHtmlTableRows(table);
			const headers = cells(tableRows.shift()!).map(text);
			const nameColumn = globalInactive ? "Name" : "Name / Running Mate";
			const expectedHeaders = [nameColumn, "POBox Address / Email", "Office", "District/Division", "Party", ...globalInactive ? [] : ["Date Filed"]];
			if (headers.join("|") !== expectedHeaders.join("|")) throw new Error("The Kentucky candidate columns have changed.");
			const details = descendants(portal.document, node => node.nodeName === "details" && descendants(node, child => child === table).length > 0);
			const summaries = details.length === 1 ? descendants(details[0]!, node => node.nodeName === "summary") : [];
			const summary = summaries.length === 1 ? officeHeading(text(summaries[0]!)) : null;
			if (!summary || summary.count !== tableRows.length) throw new Error("The Kentucky candidate section is incomplete or changed.");
			const inactive = globalInactive || inactiveTables.has(table);
			if (!inactive) activeCount += tableRows.length;
			for (const row of tableRows) {
				const fields = cells(row);
				if (fields.length !== headers.length) throw new Error("The Kentucky candidate row is incomplete.");
				const tableOffice = text(fields[2]!);
				const fullSeat = text(fields[3]!);
				const name = text(fields[0]!);
				const party = text(fields[4]!);
				if (!name || !tableOffice || tableOffice.length > 250 || measureOffice(tableOffice) || ["FOR", "AGAINST", "YES", "NO"].includes(name.toUpperCase()) || (group && tableOffice !== group.label && !(group.label === "Circuit Judge Family Court" && tableOffice === "Circuit Judge") && !(context.kind === "core" && /^Governor\b/u.test(group.label) && tableOffice === "Governor"))) throw new Error("The Kentucky candidate row does not match its published office.");
				if (globalInactive && context.kind === "courts" && !courtOffice(tableOffice)) continue;
				if (globalInactive && context.kind === "core" && source.id !== "ky-sos-2026" && courtOffice(tableOffice)) continue;
				const values: StateCandidateValues = { name, office: context.kind === "courts" && group ? group.label : tableOffice, district: fullSeat.match(/\d+/u)?.[0], party, status: inactive ? "inactive" : "listed", ...(context.kind === "courts" ? { scope: "local" as const, sourceDistrictLabel: fullSeat } : source.id !== "ky-sos-2026" ? { sourceDistrictLabel: fullSeat } : {}) };
				if (globalInactive && context.kind === "courts") {
					const matches = rows.filter(row => row.tableOffice === tableOffice && row.fullSeat === fullSeat && row.values.name === name && row.values.party === party);
					if (new Set(matches.map(row => row.values.office)).size > 1) throw new Error("The Kentucky inactive filing cannot be uniquely reconciled with its court section.");
					if (matches.length) {
						for (const match of matches) match.values.status = "inactive";
						continue;
					}
				}
				rows.push({ values, tableOffice, fullSeat });
			}
		}
		if (group && activeCount !== group.count) throw new Error("The Kentucky active office count disagrees with its published directory control.");
	}
	if (rows.length > 25000) throw new Error("The Kentucky candidate set exceeds its bounds.");
	if (!rows.length) throw new StateBallotAwaitingRecordsError(source.id);
	return rows.map(({ values }) => {
		const record = makeRecord(source, values);
		if (!record) throw new Error("The Kentucky public candidate row is incomplete.");
		return record;
	});
}
