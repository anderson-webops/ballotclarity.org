import type { StateHtmlNode } from "./state-ballot-html.js";
import type { StateBallotSource } from "./state-ballot-sources.js";
import { Buffer } from "node:buffer";
import { stateHtmlAttribute as attribute, stateHtmlDescendants as descendants, parseStateHtml, stateHtmlText } from "./state-ballot-html.js";

export type DakotaState = "SD" | "ND";
interface DakotaElectionLink { year: string; electionId: string; calendarUrl: string }
const northDakotaCalendarUrl = "https://www.sos.nd.gov/elections/candidate/candidate-calendar";
const clean = (node: StateHtmlNode) => stateHtmlText(node).replace(/\s+/gu, " ").trim();

export function dakotaDiscoveryUrl(state: DakotaState) {
	return state === "SD" ? "https://sdsos.gov/elections-voting/default.aspx" : "https://www.sos.nd.gov/elections/candidate";
}

export function dakotaCandidateRosterUrl(state: DakotaState, electionId: string) {
	if (!/^[1-9]\d{0,8}$/u.test(electionId)) throw new Error("The Dakota election identifier is invalid.");
	return `https://${state === "SD" ? "vip.sdsos.gov" : "vip.sos.nd.gov"}/candidatelist.aspx?eid=${electionId}`;
}

function publishedHref(nodes: StateHtmlNode[], label: string, base: string) {
	const values = [...new Set(nodes.filter(node => node.nodeName === "a" && clean(node) === label).map(node => new URL(attribute(node, "href"), base).href))];
	if (values.length !== 1) throw new Error("The official Dakota election links are missing or conflicting.");
	return values[0]!;
}

function candidateElectionId(state: DakotaState, url: string) {
	const identifier = new URL(url).searchParams.get("eid") ?? "";
	if (url !== dakotaCandidateRosterUrl(state, identifier)) throw new Error("The official Dakota candidate link has changed.");
	return identifier;
}

export function readDakotaElectionIndex(state: DakotaState, body: string, minimumYear: string): DakotaElectionLink[] {
	if (Buffer.byteLength(body) > 2 * 1024 * 1024) throw new Error("The Dakota discovery page exceeds its bounds.");
	const document = parseStateHtml(body);
	const base = dakotaDiscoveryUrl(state);
	let entries: DakotaElectionLink[];
	if (state === "SD") {
		const sections = descendants(document, node => node.nodeName === "li" && (node.childNodes ?? []).some(child => child.nodeName === "a" && /^20\d{2} Election Information$/u.test(clean(child))));
		if (!sections.length || sections.length > 20) throw new Error("The South Dakota election-information sections have changed.");
		entries = sections.flatMap((section) => {
			const heading = (section.childNodes ?? []).find(child => child.nodeName === "a" && /^20\d{2} Election Information$/u.test(clean(child)))!;
			const year = clean(heading).slice(0, 4);
			if (year < minimumYear) return [];
			const links = descendants(section, node => node.nodeName === "a");
			const calendarUrl = publishedHref(links, "Election Calendar", base);
			if (calendarUrl !== `https://sdsos.gov/elections-voting/upcoming-elections/general-information/${year}%20Election%20Information/${year}-Election-Information.aspx`) throw new Error("The South Dakota published calendar does not match its election year.");
			return [{ year, calendarUrl, electionId: candidateElectionId(state, publishedHref(links, "Candidate List", base)) }];
		});
	}
	else {
		const headings = descendants(document, node => node.nodeName === "h1");
		if (headings.length !== 1 || clean(headings[0]!) !== "Candidate") throw new Error("The North Dakota candidate index has changed.");
		const links = descendants(document, node => node.nodeName === "a");
		const calendarUrl = publishedHref(links, "Candidate Calendar", base);
		if (calendarUrl !== northDakotaCalendarUrl) throw new Error("The North Dakota public calendar target has changed.");
		entries = links.filter(link => clean(link).startsWith("Election Contests & Candidates")).map((link) => {
			const identity = /^Election Contests & Candidates View candidates and contests on the ballot for the (20\d{2}) General Election\.$/u.exec(clean(link));
			if (!identity) throw new Error("The North Dakota candidate link does not identify its general-election year.");
			return { year: identity[1]!, calendarUrl, electionId: candidateElectionId(state, new URL(attribute(link, "href"), base).href) };
		}).filter(entry => entry.year >= minimumYear);
	}
	const years = new Map<string, DakotaElectionLink>();
	for (const entry of entries) {
		if (Number(entry.year) % 2 || (years.has(entry.year) && JSON.stringify(years.get(entry.year)) !== JSON.stringify(entry))) throw new Error("The Dakota general-election year or identity is conflicting.");
		years.set(entry.year, entry);
	}
	if (!years.size || years.size > 10) throw new Error("The Dakota published election list exceeds its bounds.");
	return [...years.values()].sort((first, second) => first.year.localeCompare(second.year));
}

function readDakotaCalendar(state: DakotaState, body: string, year: string, now: number) {
	const document = parseStateHtml(body);
	const headings = descendants(document, node => node.nodeName === "h1");
	if (headings.length !== 1 || clean(headings[0]!) !== (state === "SD" ? `${year} Election Calendar` : "Candidate Calendar")) throw new Error("The Dakota election calendar heading has changed.");
	let date: string | undefined;
	if (state === "SD") {
		const paragraphs = descendants(document, node => node.nodeName === "p" && descendants(node, child => child.nodeName === "strong" && clean(child) === "General Election Date:").length > 0);
		if (paragraphs.length !== 1) throw new Error("The South Dakota explicit general-election date is missing or ambiguous.");
		const text = clean(paragraphs[0]!);
		const matches = [...text.matchAll(/General Election Date:\s*November ([2-8]), (20\d{2})(?!\d)/gu)];
		if (matches.length !== 1 || (text.match(/General Election Date:/gu) ?? []).length !== 1 || matches[0]![2] !== year) throw new Error("The South Dakota general-election date and published year do not match.");
		date = `${year}-11-0${matches[0]![1]}`;
	}
	else {
		const labels = descendants(document, node => node.nodeName === "h2" && clean(node).includes("General Election")).map(clean);
		const dates = labels.map((label) => {
			const match = /^November ([2-8]), (20\d{2}) – General Election$/u.exec(label);
			if (!match) throw new Error("The North Dakota explicit general-election date has changed.");
			return `${match[2]}-11-0${match[1]}`;
		}).filter(value => value.startsWith(year));
		if (!dates.length && Number(year) < new Date(now).getUTCFullYear()) return null;
		if (dates.length !== 1) throw new Error("The North Dakota general-election date is missing or ambiguous.");
		date = dates[0]!;
	}
	return date;
}

function exactKeys(value: unknown, keys: string[]): value is Record<string, unknown> {
	return Boolean(value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).sort().join(",") === keys.sort().join(","));
}

export function readDakotaElectionDiscovery(state: DakotaState, body: string, minimumYear: string, now: number) {
	if (Buffer.byteLength(body) > 2 * 1024 * 1024) throw new Error("The combined Dakota discovery exceeds its bounds.");
	const value: unknown = JSON.parse(body);
	if (!exactKeys(value, ["page", "calendars"]) || typeof value.page !== "string" || !Array.isArray(value.calendars)) throw new Error("The Dakota discovery envelope is invalid.");
	const entries = readDakotaElectionIndex(state, value.page, minimumYear);
	const expected = [...new Set(entries.map(entry => entry.calendarUrl))];
	const calendars = value.calendars;
	if (calendars.length !== expected.length || calendars.some((calendar, index) => !exactKeys(calendar, ["url", "body"]) || calendar.url !== expected[index] || typeof calendar.body !== "string")) throw new Error("The Dakota discovery calendar set is incomplete or changed.");
	return entries.flatMap((entry) => {
		const electionDate = readDakotaCalendar(state, calendars.find(calendar => calendar.url === entry.calendarUrl)!.body, entry.year, now);
		return electionDate ? [{ electionId: entry.electionId, electionDate }] : [];
	});
}

export function validateDakotaCandidatePage(source: StateBallotSource, document: StateHtmlNode) {
	const state = source.format === "south-dakota-csv" ? "SD" : "ND";
	const forms = descendants(document, node => node.nodeName === "form");
	if (source.stateCode !== state || forms.length !== 1 || attribute(forms[0]!, "id") !== (state === "SD" ? "Form1" : "aspnetForm") || attribute(forms[0]!, "method").toLowerCase() !== "post" || !attribute(forms[0]!, "action") || new URL(attribute(forms[0]!, "action"), source.url).href !== source.url) throw new Error("The Dakota public candidate form target has changed.");
	const form = forms[0]!;
	const year = source.electionDate.slice(0, 4);
	if (state === "SD") {
		const label = `${year} General Election Candidate List`;
		const headings = descendants(form, node => node.nodeName === "span" && attribute(node, "id") === "MainContent_lblFormHeader");
		if (headings.length !== 1 || clean(headings[0]!) !== label || descendants(form, node => node.nodeName === "select").length) throw new Error("The South Dakota public report does not identify the configured unfiltered general election.");
		for (const [suffix, value] of [["hidElectionDate", label], ["hidElectionType", "General"]]) {
			const fields = descendants(form, node => node.nodeName === "input" && attribute(node, "type") === "hidden" && attribute(node, "name") === `ctl00$MainContent$${suffix}`);
			if (fields.length !== 1 || attribute(fields[0]!, "value") !== value) throw new Error("The South Dakota public export election identity has changed.");
		}
	}
	else {
		const titles = descendants(document, node => node.nodeName === "title");
		if (titles.length !== 1 || clean(titles[0]!) !== `${year} General Election Contest/Candidate List`) throw new Error("The public search form does not identify the configured general election.");
		const selectors = descendants(form, node => node.nodeName === "select");
		if (selectors.filter(node => attribute(node, "name") !== "ctl00$ContentPlaceHolder1$ddlExportFormat").length !== 4 || selectors.filter(node => attribute(node, "name") === "ctl00$ContentPlaceHolder1$ddlExportFormat").length > 1) throw new Error("The North Dakota public candidate filters have changed.");
		for (const suffix of ["ddlJursdiction", "ddlDistrict", "ddlContest", "ddlCandidate"]) {
			const selectors = descendants(form, node => node.nodeName === "select" && attribute(node, "name") === `ctl00$ContentPlaceHolder1$${suffix}`);
			const selected = selectors.length === 1 ? descendants(selectors[0]!, node => node.nodeName === "option" && Boolean(node.attrs?.some(value => value.name === "selected"))) : [];
			if (selected.length !== 1 || attribute(selected[0]!, "value") !== (suffix === "ddlJursdiction" ? "AL" : "0") || clean(selected[0]!) !== (["ddlJursdiction", "ddlDistrict"].includes(suffix) ? "All" : "")) throw new Error("The North Dakota public candidate report no longer selects the unfiltered request.");
		}
	}
	return form;
}
