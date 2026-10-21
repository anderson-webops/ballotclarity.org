import type { StateBallotSource } from "./state-ballot-sources.js";
import { fetchRemoteSourceText } from "./remote-json-source.js";
import { parseStateHtml, stateHtmlAttribute, stateHtmlDescendants, stateHtmlText } from "./state-ballot-html.js";

type SourceTextRequest = (url: string, options: { allowedHosts: string[]; maxBytes: number; maxRedirects: number; postBody?: string; timeoutMs: number }) => Promise<string>;

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
	const options = { allowedHosts: [new URL(source.url).hostname], maxBytes: 12 * 1024 * 1024, maxRedirects: 2, timeoutMs: 12_000 };
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
