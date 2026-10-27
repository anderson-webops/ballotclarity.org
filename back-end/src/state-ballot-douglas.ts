import type { StateHtmlNode } from "./state-ballot-html.js";
import type { StateCandidateRecord } from "./state-ballot-records.js";
import type { StateBallotSource } from "./state-ballot-sources.js";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { stateHtmlAttribute as attribute, stateHtmlDescendants as descendants, parseStateHtml, stateHtmlTableRows as rows, stateHtmlText } from "./state-ballot-html.js";
import { containsControlCharacters } from "./text-validation.js";

export const douglasOrigin = "https://www.votedouglascounty-ne.gov";
export const douglasDiscoveryUrl = `${douglasOrigin}/candidate_info.aspx`;
export const douglasCalendarUrl = `${douglasOrigin}/deadlines.aspx`;
export const douglasPrivacyUrl = `${douglasOrigin}/privacy_policy.aspx`;
export const douglasRobotsSha256 = "8d04be94ae9e5b385d9cd67db8ad31fe49a0b3aa34d27e56f977ac7400155266";
export const douglasLinksSha256 = "e218e463914dd543a814fcbba35d758f4da14cf454bc320759c6581d1bb901b2";
export const douglasPrivacySha256 = "4972c60c339d464924ccf660c1acee342a2cce3af7c95b71cd2b2e39fd38096d";
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const text = (node: StateHtmlNode) => stateHtmlText(node).normalize("NFKC").replace(/\s+/gu, " ").trim();
const elements = (node: StateHtmlNode) => (node.childNodes ?? []).filter(child => !child.nodeName.startsWith("#"));
const id = (node: StateHtmlNode, value: string) => descendants(node, child => attribute(child, "id") === value);
function reject(): never {
	throw new Error("The Douglas County public filing contract requires review.");
}
function visible(node: StateHtmlNode) {
	let current: (StateHtmlNode & { parentNode?: StateHtmlNode }) | undefined = node;
	while (current) {
		if (current.attrs?.some(item => item.name === "hidden" || item.name === "inert") || /display\s*:\s*none|visibility\s*:\s*(?:hidden|collapse)|(?:opacity|font-size)\s*:\s*0(?:\s|;|$)/iu.test(attribute(current, "style")) || attribute(current, "aria-hidden") === "true") return reject();
		current = current.parentNode;
	}
}
function document(body: string) {
	if (Buffer.byteLength(body) > 2 * 1024 * 1024) return reject();
	const dom = parseStateHtml(body);
	const pending = [{ node: dom, depth: 0 }];
	let count = 0;
	while (pending.length) {
		const item = pending.pop()!;
		if (++count > 70000 || item.depth > 64) return reject();
		for (const child of item.node.childNodes ?? []) pending.push({ node: child, depth: item.depth + 1 });
	}
	return dom;
}
function field(root: StateHtmlNode, identifier: string) {
	const found = id(root, identifier);
	if (found.length !== 1) return reject();
	const node = found[0]!;
	visible(node);
	const value = text(node);
	if (value.includes("\uFFFD") || containsControlCharacters(value)) return reject();
	return value;
}
export function douglasPolicyFingerprint(body: string, kind: "links" | "privacy") {
	const dom = document(body);
	const footers = id(dom, "footer");
	if (footers.length !== 1) return reject();
	if (kind === "privacy") {
		const contents = descendants(dom, node => attribute(node, "class") === "content");
		if (contents.length !== 1) return reject();
		const content = contents[0]!;
		const value = stateHtmlText(content).replace(/\s+/gu, " ").trim();
		const links = descendants(content, node => node.nodeName === "a" && Boolean(attribute(node, "href"))).map(node => [stateHtmlText(node).replace(/\s+/gu, " ").trim(), new URL(attribute(node, "href"), douglasPrivacyUrl).href]);
		return hash(JSON.stringify({ text: value, links }));
	}
	const footer = stateHtmlText(footers[0]!).replace(/\s+/gu, " ").trim().replace(/Copyright © 2004-20\d{2}/u, "Copyright © 2004-<year>");
	const legal = [...new Set(descendants(dom, node => node.nodeName === "a" && Boolean(attribute(node, "href")) && /privacy|disclaimer|copyright|licen[cs]e|terms|polic(?:y|ies)/iu.test(`${stateHtmlText(node)} ${attribute(node, "href")}`)).map(node => JSON.stringify([stateHtmlText(node).replace(/\s+/gu, " ").trim(), new URL(attribute(node, "href"), `${douglasOrigin}/`).href])))].sort();
	return hash(JSON.stringify({ footer, legal }));
}
export function validateDouglasDate(value: string) {
	if (!/^20\d{2}-11-0[2-8]$/u.test(value) || value < "2026-11-03" || Number(value.slice(0, 4)) % 2 || new Date(`${value}T00:00:00Z`).getUTCDay() !== 2) return reject();
}
function filingDate(value: string, year: string) {
	const match = /^(\d{1,2})\/(\d{1,2})\/(20\d{2})$/u.exec(value);
	if (!match || match[3] !== year) return reject();
	const date = `${year}-${match[1]!.padStart(2, "0")}-${match[2]!.padStart(2, "0")}`;
	if (!Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date) return reject();
	return date;
}
export function readDouglasCalendar(body: string) {
	const dom = document(body);
	const descriptions = descendants(dom, node => attribute(node, "id").includes("lblDescription_") && text(node).startsWith("Statewide General Election Day."));
	if (descriptions.length > 10) return reject();
	const dates = descriptions.map((node) => {
		const identifier = attribute(node, "id").replace("lblDescription_", "lblDate_");
		const match = /^Tuesday, November ([2-8]), (20\d{2})$/u.exec(field(dom, identifier));
		if (!match) return reject();
		const date = `${match[2]}-11-${match[1]!.padStart(2, "0")}`;
		validateDouglasDate(date);
		return date;
	});
	if (new Set(dates.map(date => date.slice(0, 4))).size !== dates.length) return reject();
	return dates.sort();
}
export function readDouglasForm(body: string) {
	const dom = document(body);
	const forms = descendants(dom, node => node.nodeName === "form");
	const allSelects = descendants(dom, node => node.nodeName === "select");
	const selects = allSelects.filter(node => attribute(node, "name") === "ctl00$ContentPlaceHolder1$ddlElections");
	if (forms.length !== 1 || attribute(forms[0]!, "method").toLowerCase() !== "post" || new URL(attribute(forms[0]!, "action"), douglasDiscoveryUrl).href !== douglasDiscoveryUrl || selects.length !== 1 || attribute(selects[0]!, "id") !== "ContentPlaceHolder1_ddlElections" || allSelects.length > 2 || allSelects.some(node => !["ctl00$ContentPlaceHolder1$ddlElections", "ctl00$ContentPlaceHolder1$ddlOffices"].includes(attribute(node, "name")))) return reject();
	const officeSelect = allSelects.find(node => attribute(node, "name") === "ctl00$ContentPlaceHolder1$ddlOffices");
	const officeOptions = officeSelect ? descendants(officeSelect, node => node.nodeName === "option") : [];
	if (officeSelect && (officeOptions.filter(node => node.attrs?.some(item => item.name === "selected")).length !== 1 || !officeOptions.some(node => node.attrs?.some(item => item.name === "selected") && attribute(node, "value") === ""))) return reject();
	const options = descendants(selects[0]!, node => node.nodeName === "option");
	if (!options.length || options.length > 100 || new Set(options.map(node => attribute(node, "value"))).size !== options.length) return reject();
	const general = options.flatMap((node) => {
		const match = /^(20\d{2}) General$/u.exec(text(node));
		if (!match) {
			if (/General/iu.test(text(node))) return reject();
			return [];
		}
		if (attribute(node, "value") !== `${match[1]}G` || Number(match[1]) % 2 || match[1]! < "2026") return reject();
		return [{ year: match[1]!, value: attribute(node, "value") }];
	});
	const hidden = descendants(forms[0]!, node => node.nodeName === "input");
	const names = ["__VIEWSTATE", "__VIEWSTATEGENERATOR", "__EVENTVALIDATION", "ctl00$ContentPlaceHolder1$hfOfficeID", "ctl00$ContentPlaceHolder1$hfElection"];
	if (hidden.length !== names.length || hidden.some(node => attribute(node, "type") !== "hidden" || !names.includes(attribute(node, "name")) || attribute(node, "value").length > (attribute(node, "name") === "__VIEWSTATE" ? 1024 * 1024 : 65536)) || new Set(hidden.map(node => attribute(node, "name"))).size !== names.length) return reject();
	const fields = new URLSearchParams();
	for (const node of hidden) fields.append(attribute(node, "name"), attribute(node, "value"));
	const selected = options.filter(node => node.attrs?.some(item => item.name === "selected"));
	if (selected.length !== 1) return reject();
	return { dom, general, fields, selected: attribute(selected[0]!, "value"), officeOptions: officeOptions.filter(node => attribute(node, "value")).map(node => ({ id: attribute(node, "value"), title: text(node) })) };
}
export function buildDouglasElectionForm(body: string, year: string) {
	const form = readDouglasForm(body);
	const choice = form.general.find(item => item.year === year);
	if (!choice || form.selected !== "" || form.fields.get("ctl00$ContentPlaceHolder1$hfOfficeID") || form.fields.get("ctl00$ContentPlaceHolder1$hfElection")) return reject();
	form.fields.append("ctl00$ContentPlaceHolder1$ddlElections", choice.value);
	if (Buffer.byteLength(form.fields.toString()) > 256 * 1024) return reject();
	return form.fields.toString();
}
interface DouglasOffice {
	title: string;
	id: string;
	category: "Partisan" | "Nonpartisan";
}
export interface DouglasFiling {
	name: string;
	office: DouglasOffice;
	filedDate: string;
	candidateId?: string;
	profileUrl?: string;
	writeIn: boolean;
}
export function validateDouglasProfileUrl(value: string, year: string) {
	const url = new URL(value);
	const candidateId = url.searchParams.get("cid") ?? "";
	const officeId = url.searchParams.get("oid") ?? "";
	if (!/^[1-9]\d{0,8}$/u.test(candidateId) || !/^[1-9]\d{0,8}$/u.test(officeId) || value !== `${douglasOrigin}/candidates.aspx?cid=${candidateId}&oid=${officeId}&eid=${year}%20General`) return reject();
	return { candidateId, officeId };
}
export function readDouglasRoster(body: string, date: string) {
	validateDouglasDate(date);
	const year = date.slice(0, 4);
	const form = readDouglasForm(body);
	if (form.selected !== `${year}G` || form.fields.get("ctl00$ContentPlaceHolder1$hfElection") !== year || form.fields.get("ctl00$ContentPlaceHolder1$hfOfficeID")) return reject();
	const containers = id(form.dom, "ContentPlaceHolder1_lblOffices");
	if (containers.length !== 1) return reject();
	if (!text(containers[0]!)) return { filings: [] as DouglasFiling[], offices: [] as DouglasOffice[] };
	const tables = elements(containers[0]!);
	if (tables.length !== 1 || tables[0]!.nodeName !== "table") return reject();
	const offices: DouglasOffice[] = [];
	const filings: DouglasFiling[] = [];
	let pending: DouglasOffice | undefined;
	for (const row of rows(tables[0]!)) {
		if (!text(row)) continue;
		visible(row);
		const cells = elements(row);
		if (cells.length !== 1 || cells[0]!.nodeName !== "td") return reject();
		const cell = cells[0]!;
		const labels = descendants(cell, node => node.nodeName === "a" && attribute(node, "href").startsWith("office_detail.aspx?"));
		if (labels.length) {
			if (pending || labels.length !== 1) return reject();
			const title = text(labels[0]!);
			const match = new RegExp(`^${title.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")} - (Partisan|Nonpartisan) Office$`, "u").exec(text(cell));
			const url = new URL(attribute(labels[0]!, "href"), douglasDiscoveryUrl);
			const officeId = url.searchParams.get("oid") ?? "";
			const seatId = url.searchParams.get("sid") ?? "";
			if (!match || !/^[1-9]\d{0,8}$/u.test(officeId) || !/^[1-9]\d{0,8}$/u.test(seatId) || url.href !== `${douglasOrigin}/office_detail.aspx?oid=${officeId}&sid=${seatId}` || title.length > 250 || offices.some(office => office.id === officeId)) return reject();
			pending = { title, id: officeId, category: match[1] as DouglasOffice["category"] };
			offices.push(pending);
			continue;
		}
		if (!pending) return reject();
		if (text(cell) === "No candidates have filed at this time.") {
			pending = undefined;
			continue;
		}
		const lists = descendants(cell, node => node.nodeName === "table");
		if (lists.length !== 1 || !rows(lists[0]!).length) return reject();
		for (const candidateRow of rows(lists[0]!)) {
			visible(candidateRow);
			const cells = elements(candidateRow);
			const links = descendants(candidateRow, node => node.nodeName === "a");
			if (cells.length !== 3 || cells.some(node => node.nodeName !== "td") || links.length !== 1 || text(cells[1]!) || text(cells[0]!) !== text(links[0]!) || !/^Filed: \d{2}\/\d{2}\/20\d{2}$/u.test(text(cells[2]!))) return reject();
			const profileUrl = new URL(attribute(links[0]!, "href"), douglasDiscoveryUrl).href;
			const identity = validateDouglasProfileUrl(profileUrl, year);
			if (identity.officeId !== pending.id) return reject();
			filings.push({ name: text(links[0]!), office: pending, filedDate: filingDate(text(cells[2]!).slice(7), year), candidateId: identity.candidateId, profileUrl, writeIn: false });
		}
		pending = undefined;
	}
	if (pending || offices.length > 200 || filings.length > 400 || new Set(filings.map(item => item.profileUrl)).size !== filings.length) return reject();
	if (JSON.stringify(form.officeOptions) !== JSON.stringify(offices.map(office => ({ id: office.id, title: office.title })))) return reject();
	const writeIns = id(form.dom, "ContentPlaceHolder1_writein");
	if (writeIns.length > 1) return reject();
	for (const table of writeIns[0] ? descendants(writeIns[0], node => node.nodeName === "table") : []) {
		let office: DouglasOffice | undefined;
		for (const row of rows(table)) {
			if (!text(row)) continue;
			visible(row);
			const cells = elements(row);
			if (cells.length === 1 && attribute(cells[0]!, "colspan") === "3") {
				const found = offices.filter(item => item.title === text(cells[0]!));
				if (found.length !== 1 || office) return reject();
				office = found[0]!;
				continue;
			}
			const links = descendants(row, node => node.nodeName === "a");
			if (!office || cells.length !== 2 || links.length !== 1 || text(cells[0]!) !== text(links[0]!) || !/^Filed: \d{2}\/\d{2}\/20\d{2}$/u.test(text(cells[1]!))) return reject();
			const documentUrl = new URL(attribute(links[0]!, "href"), douglasDiscoveryUrl);
			if (documentUrl.origin !== douglasOrigin || !documentUrl.pathname.startsWith(`/elections/${year}/General/`) || !documentUrl.pathname.endsWith(".pdf") || documentUrl.search || documentUrl.hash) return reject();
			filings.push({ name: text(links[0]!), office, filedDate: filingDate(text(cells[1]!).slice(7), year), writeIn: true });
		}
	}
	if (filings.some(item => item.name.length > 200 || !/^[\p{L}\p{M} .,'’"()-]+$/u.test(item.name) || !/\p{L}/u.test(item.name) || item.filedDate > date) || filings.length > 500) return reject();
	return { filings, offices };
}
export function readDouglasProfile(body: string, filing: DouglasFiling, year: string) {
	if (!filing.profileUrl || !filing.candidateId || filing.writeIn) return reject();
	const dom = document(body);
	const identity = validateDouglasProfileUrl(filing.profileUrl, year);
	if (id(dom, "ContentPlaceHolder1_hfCID").length !== 1 || attribute(id(dom, "ContentPlaceHolder1_hfCID")[0]!, "value") !== identity.candidateId || id(dom, "ContentPlaceHolder1_hfOID").length !== 1 || attribute(id(dom, "ContentPlaceHolder1_hfOID")[0]!, "value") !== identity.officeId || field(dom, "ContentPlaceHolder1_lblElectionName") !== `${year} General Election` || field(dom, "ContentPlaceHolder1_gvCandidateInfo_lblCandidateHeader_0") !== `${filing.name}, ${filing.office.title}` || filingDate(field(dom, "ContentPlaceHolder1_gvCandidateInfo_lblFileDate_0"), year) !== filing.filedDate) return reject();
	const affiliation = field(dom, "ContentPlaceHolder1_gvCandidateInfo_lblParty_0");
	if (affiliation.length > 120 || (affiliation && !/^[\p{L}\p{N} .,'’()/-]+$/u.test(affiliation))) return reject();
	const party = filing.office.category === "Partisan" || /^(?:Nonpartisan|Non-Partisan)$/iu.test(affiliation) ? affiliation || undefined : undefined;
	return { affiliation: affiliation || undefined, party };
}
function scope(office: DouglasOffice) {
	if (["Governor", "Lieutenant Governor", "Attorney General", "Auditor of Public Accounts", "Secretary of State", "State Treasurer", "United States Senator"].includes(office.title)) return { scope: "statewide" as const, district: "" };
	const legislature = /^Legislature - District (\d{1,2})$/u.exec(office.title);
	if (legislature) return { scope: "state-senate" as const, district: String(Number(legislature[1])) };
	const congress = /^United States House of Representatives - District (One|Two|Three|[1-9]\d?)$/u.exec(office.title);
	if (congress) return { scope: "congressional" as const, district: ({ One: "1", Two: "2", Three: "3" } as Record<string, string>)[congress[1]!] ?? congress[1]! };
	if (/Board of (?:Education|Governors|Regents|Trustees)|City Council|Village Board|(?:County|Appeals|Juvenile|Compensation) Court|Court of Appeals|Douglas County |Educational Service Unit|Learning Community Coordinating Council|Metropolitan Utilities District|Public Power District|Public Service Commission|Papio-Missouri River NRD|Regional Metropolitan Transit Board|Public Schools - Subdistrict/u.test(office.title)) return { scope: "local" as const, district: "", jurisdiction: office.title };
	return reject();
}
export function douglasRecord(source: StateBallotSource, filing: DouglasFiling, party?: string): StateCandidateRecord {
	const identifier = hash(JSON.stringify([source.id, filing.writeIn ? filing.office.title : filing.office.id, filing.candidateId ?? [filing.name, filing.filedDate, "write-in"]])).slice(0, 24);
	return { id: identifier, name: filing.name, office: filing.office.title, ...scope(filing.office), status: filing.writeIn ? "write-in" : "filed", sourceStatus: `${filing.writeIn ? "Write-in filed" : "Filed"} ${filing.filedDate}`, ...(party ? { party } : {}), ...(filing.profileUrl ? { candidateUrl: filing.profileUrl, sourceCandidateId: filing.candidateId } : { candidateUrl: `${douglasDiscoveryUrl}#WriteIns` }) };
}
