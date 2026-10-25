import type { StateCandidateValues } from "./state-ballot-additional-records.js";
import type { StateHtmlNode } from "./state-ballot-html.js";
import type { StateCandidateRecord } from "./state-ballot-records.js";
import type { StateBallotSource } from "./state-ballot-sources.js";
import { Buffer } from "node:buffer";
import { parse } from "csv-parse/sync";
import { stateHtmlAttribute as attribute, stateHtmlDescendants as descendants, parseStateHtml, stateHtmlText } from "./state-ballot-html.js";
import { StateBallotAwaitingRecordsError } from "./state-ballot-source-state.js";

export const marylandDiscoveryUrl = "https://elections.maryland.gov/elections/";
type MarylandKind = "state" | "local";
type MarylandTextRequest = (url: string, options: { allowedHosts: string[]; maxBytes: number; maxRedirects: number; timeoutMs: number }) => Promise<string>;
const clean = (value: string) => value.normalize("NFKC").replace(/\s+/gu, " ").trim();
const text = (node: StateHtmlNode) => clean(stateHtmlText(node));
const elements = (node: StateHtmlNode) => (node.childNodes ?? []).filter(child => !child.nodeName.startsWith("#"));
const columns = "Office Name|Contest Run By District Name and Number|Candidate Ballot Last Name and Suffix|Candidate First Name and Middle Name|Additional Information|Office Political Party|Candidate Residential Jurisdiction|Candidate Gender|Candidate Status|Filing Type and Date|Campaign Mailing Address|Campaign Mailing City State and Zip|Public Phone|Email|Website|Facebook|X|Other|Committee Name|Has Related Candidate|Related Candidate Last Name and Suffix|Related Candidate First Name and Middle Name|Related Office Political Party|Related Candidate County of Residence|Related Candidate Gender|Related Candidate Status|Related Candidate Filing Type and Date|Related Candidate Campaign Mailing Address|Related Candidate Campaign Mailing City State and Zip|Related Candidate Email|Related Candidate Website|Related Candidate Facebook|Related Candidate X|Related Candidate Other Social".split("|");

function exact(value: unknown, keys: string[]): value is Record<string, unknown> {
	return Boolean(value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).sort().join(",") === keys.sort().join(","));
}

function main(body: string, title: string) {
	const document = parseStateHtml(body);
	const headings = descendants(document, node => node.nodeName === "h1");
	if (headings.length !== 1 || text(headings[0]!) !== title) throw new Error("The Maryland official page identity has changed.");
	const sections = descendants(document, node => node.nodeName === "section" && (node.childNodes ?? []).includes(headings[0]!));
	if (sections.length !== 1) throw new Error("The Maryland official page scope has changed.");
	return sections[0]!;
}

function codeContext(electionId: string) {
	const match = /^(20\d{2})_(GG|PG)$/u.exec(electionId);
	if (!match || Number(match[1]) % 2) throw new Error("The Maryland published general-election code is invalid.");
	return { year: match[1]!, cycle: match[2] === "GG" ? "Gubernatorial" : "Presidential" };
}

export function marylandCandidateRosterUrl(electionId: string, kind: MarylandKind, extension: "html" | "csv" = "csv") {
	const { year } = codeContext(electionId);
	return `${marylandDiscoveryUrl}${year}/general_candidates/${electionId}_${kind === "state" ? "statewide" : "all_counties"}_candidatelist.${extension}`;
}

export function marylandSourceElectionId(source: StateBallotSource) {
	const kind = source.format === "maryland-local-csv" ? "local" : "state";
	const match = /\/(20\d{2}_(?:GG|PG))_(?:statewide|all_counties)_candidatelist\.csv$/u.exec(source.url);
	const electionId = match?.[1] ?? "";
	const { year } = codeContext(electionId);
	const originalId = kind === "state" ? "md-sbe-2026" : "md-sbe-local-2026";
	const prefix = kind === "state" ? "md-general" : "md-local-general";
	if (source.stateCode !== "MD" || !["csv", "maryland-local-csv"].includes(source.format) || source.retrievalPolicy || source.postBody || source.documentUrls?.length || source.documentLinks?.length || source.url !== marylandCandidateRosterUrl(electionId, kind) || source.pageUrl !== marylandCandidateRosterUrl(electionId, kind, "html") || !/^20\d{2}-11-0[2-8]$/u.test(source.electionDate) || source.electionDate.slice(0, 4) !== year || new Date(source.electionDate).getUTCDay() !== 2 || source.electionDate < "2026-11-03" || source.id !== (source.electionDate === "2026-11-03" ? originalId : `${prefix}-${source.electionDate}`) || ((electionId === "2026_GG") !== (source.electionDate === "2026-11-03"))) throw new Error("The Maryland source does not retain its exact published general-election contract.");
	return electionId;
}

export function readMarylandYearLinks(body: string) {
	if (Buffer.byteLength(body) > 2 * 1024 * 1024) throw new Error("The Maryland election index exceeds its bounds.");
	main(body, "Elections");
	const years = new Map<string, string>();
	for (const link of descendants(parseStateHtml(body), node => node.nodeName === "a")) {
		const url = new URL(attribute(link, "href"), marylandDiscoveryUrl);
		const match = /^\/elections\/(20\d{2})\/(?:index\.html)?$/u.exec(url.pathname);
		if (!match || match[1]! < "2026") continue;
		if (url.origin !== new URL(marylandDiscoveryUrl).origin || url.search || url.hash || Number(match[1]) % 2 || (years.has(match[1]!) && years.get(match[1]!) !== url.href)) throw new Error("The Maryland published year links are ambiguous or unsupported.");
		years.set(match[1]!, url.href);
	}
	if (!years.size || years.size > 10) throw new Error("The Maryland published year list exceeds its bounds.");
	return [...years].sort(([first], [second]) => first.localeCompare(second)).map(([year, url]) => ({ year, url }));
}

export function readMarylandYearPage(url: string, body: string) {
	const year = /^https:\/\/elections\.maryland\.gov\/elections\/(20\d{2})\/(?:index\.html)?$/u.exec(url)?.[1];
	const document = parseStateHtml(body);
	const heading = descendants(document, node => node.nodeName === "h1");
	const cycle = heading.length === 1 ? new RegExp(`^${year} (Gubernatorial|Presidential) Election$`, "u").exec(text(heading[0]!))?.[1] : null;
	if (!year || !cycle) throw new Error("The Maryland election year and heading disagree.");
	main(body, `${year} ${cycle} Election`);
	const containers = descendants(document, node => node.nodeName === "dl");
	const dates = containers.flatMap(container => elements(container).flatMap((node, index, siblings) => node.nodeName === "dt" && text(node) === "General Election Day" && siblings[index + 1]?.nodeName === "dd" ? [text(siblings[index + 1]!)] : []));
	const date = dates.length === 1 ? /^November (0?[2-8]), (20\d{2})$/u.exec(dates[0]!) : null;
	const electionDate = date ? `${date[2]}-11-${date[1]!.padStart(2, "0")}` : "";
	if (!date || date[2] !== year || Number(year) % 2 || new Date(electionDate).getUTCDay() !== 2) throw new Error("The Maryland general-election date is missing or inconsistent.");
	const links = descendants(document, node => node.nodeName === "a" && text(node) === "General Election Candidates");
	const candidatesUrl = links.length === 1 ? new URL(attribute(links[0]!, "href"), url) : null;
	if (!candidatesUrl || candidatesUrl.origin !== new URL(marylandDiscoveryUrl).origin || candidatesUrl.search || candidatesUrl.hash || !new RegExp(`^/elections/${year}/general_candidates/(?:index\\.html)?$`, "u").test(candidatesUrl.pathname)) throw new Error("The Maryland published general-candidate link is missing or changed.");
	return { electionDate, electionId: `${year}_${cycle === "Gubernatorial" ? "GG" : "PG"}`, candidatesUrl: candidatesUrl.href };
}

function rosterLink(body: string, electionId: string, kind: MarylandKind, base: string) {
	const { year, cycle } = codeContext(electionId);
	const section = main(body, `${year} ${cycle} General Candidate Listings`);
	const children = elements(section);
	const label = kind === "state" ? "Statewide Offices" : "Local Offices";
	const headings = children.flatMap((node, index) => node.nodeName === "h2" && text(node) === label ? [index] : []);
	if (headings.length !== 1) throw new Error("The Maryland candidate-list category is missing or ambiguous.");
	const following = children.slice(headings[0]! + 1);
	const nextHeading = following.findIndex(node => node.nodeName === "h2");
	const links = descendants({ nodeName: "region", childNodes: nextHeading < 0 ? following : following.slice(0, nextHeading) }, node => node.nodeName === "a" && text(node) === "All Candidates");
	if (links.length !== 1 || new URL(attribute(links[0]!, "href"), base).href !== marylandCandidateRosterUrl(electionId, kind, "html")) throw new Error("The Maryland candidate-list control has changed.");
	return marylandCandidateRosterUrl(electionId, kind, "html");
}

export function readMarylandElectionDiscovery(body: string, kind: MarylandKind) {
	if (Buffer.byteLength(body) > 2 * 1024 * 1024) throw new Error("The combined Maryland discovery exceeds its bounds.");
	const capture: unknown = JSON.parse(body);
	if (!exact(capture, ["schemaVersion", "type", "index", "years"]) || capture.schemaVersion !== 1 || capture.type !== "maryland-election-discovery" || typeof capture.index !== "string" || !Array.isArray(capture.years)) throw new Error("The Maryland discovery capture is invalid.");
	const years = readMarylandYearLinks(capture.index);
	if (capture.years.length !== years.length) throw new Error("The Maryland discovery year set is incomplete.");
	return capture.years.map((entry, index) => {
		if (!exact(entry, ["url", "page", "candidatesUrl", "candidates"]) || entry.url !== years[index]!.url || typeof entry.page !== "string" || typeof entry.candidates !== "string") throw new Error("The Maryland discovery year capture is invalid.");
		const election = readMarylandYearPage(entry.url as string, entry.page);
		if (entry.candidatesUrl !== election.candidatesUrl) throw new Error("The Maryland candidate index does not match its published link.");
		return { ...election, rosterUrl: rosterLink(entry.candidates, election.electionId, kind, election.candidatesUrl) };
	});
}

export async function fetchMarylandCycleDiscovery(request: MarylandTextRequest) {
	const options = { allowedHosts: ["elections.maryland.gov"], maxBytes: 2 * 1024 * 1024, maxRedirects: 0, timeoutMs: 12000 };
	const index = await request(marylandDiscoveryUrl, options);
	const years = [];
	for (const entry of readMarylandYearLinks(index)) {
		const page = await request(entry.url, options);
		const { candidatesUrl } = readMarylandYearPage(entry.url, page);
		years.push({ url: entry.url, page, candidatesUrl, candidates: await request(candidatesUrl, options) });
		if (Buffer.byteLength(JSON.stringify({ index, years })) > options.maxBytes) throw new Error("The combined Maryland discovery exceeds its bounds.");
	}
	return JSON.stringify({ schemaVersion: 1, type: "maryland-election-discovery", index, years });
}

export function validateMarylandRoster(source: StateBallotSource, body: string) {
	const electionId = marylandSourceElectionId(source);
	const { year, cycle } = codeContext(electionId);
	const section = main(body, `${year} ${cycle} General Election ${source.format === "csv" ? "State" : "Local"} Candidates List`);
	const links = descendants(section, node => node.nodeName === "a" && text(node) === "Download (CSV)");
	if (links.length !== 1 || new URL(attribute(links[0]!, "href"), source.pageUrl).href !== source.url) throw new Error("The Maryland public CSV control has changed.");
	return section;
}

interface MarylandHtmlCandidate {
	name: string;
	office: string;
	county: string;
	district: string;
	party: string;
	status: string;
	residence: string;
}

function localCandidates(section: StateHtmlNode): MarylandHtmlCandidate[] {
	const children = elements(section);
	const counties = descendants(section, node => node.nodeName === "h2").map(text);
	if (counties.length !== 24 || new Set(counties).size !== 24 || counties.some(label => !/^(?:.{1,80} County|Baltimore City)$/u.test(label))) throw new Error("The Maryland source county sections are incomplete or changed.");
	let county = "";
	let office = "";
	let district = "";
	let name = "";
	let party = "";
	const candidates: MarylandHtmlCandidate[] = [];
	for (const [index, node] of children.entries()) {
		if (name && ["h2", "h3", "h4", "h5"].includes(node.nodeName)) throw new Error("The Maryland candidate heading has no recognized detail block.");
		if (node.nodeName === "h2") {
			county = text(node);
			district = "";
		}
		else if (node.nodeName === "h3") {
			office = text(node);
			district = "";
		}
		else if (node.nodeName === "h4") {
			if (children[index + 1]?.nodeName === "h5" || (children[index + 1]?.nodeName === "p" && text(children[index + 1]!) === "No candidates have filed for this office.")) {
				district = text(node);
				name = "";
			}
			else {
				name = text(node);
				district = "";
			}
			party = "";
		}
		else if (node.nodeName === "h5") {
			name = text(node);
			party = "";
		}
		else if (node.nodeName === "span" && name) {
			party = text(node);
		}
		else if (node.nodeName === "div" && attribute(node, "class") === "candidate") {
			const lists = descendants(node, child => child.nodeName === "dl");
			const values = lists.length === 1 ? elements(lists[0]!) : [];
			const statuses = values.flatMap((value, offset) => value.nodeName === "dt" && text(value) === "Status" && values[offset + 1]?.nodeName === "dd" ? [text(values[offset + 1]!)] : []);
			const residences = values.flatMap((value, offset) => value.nodeName === "dt" && text(value) === "Jurisdiction" && values[offset + 1]?.nodeName === "dd" ? [text(values[offset + 1]!)] : []);
			if (!county || !office || !name || !party || statuses.length !== 1 || !statuses[0] || residences.length !== 1 || name.length > 250 || office.length > 200 || party.length > 100 || statuses[0].length > 200 || residences[0]!.length > 100) throw new Error("The Maryland local candidate page layout has changed.");
			candidates.push({ county, office, name, district, party, status: statuses[0]!, residence: residences[0]! });
			name = "";
			party = "";
		}
	}
	if (name || candidates.length !== descendants(section, node => node.nodeName === "div" && attribute(node, "class") === "candidate").length) throw new Error("The Maryland local candidate set contains unscoped entries.");
	return candidates;
}

function csvRows(body: string, strict: boolean) {
	const table = parse(body, { bom: true, relax_quotes: true, relax_column_count: true, skip_empty_lines: true, max_record_size: 100_000 }) as string[][];
	const headers = table.shift() ?? [];
	while (headers.at(-1) === "") headers.pop();
	const required = ["Office Name", "Candidate First Name and Middle Name", "Candidate Ballot Last Name and Suffix"];
	if (table.length > 25_000 || (strict ? JSON.stringify(headers) !== JSON.stringify(columns) : required.some(header => !headers.includes(header)))) throw new Error("The Maryland CSV layout has changed.");
	return table.map((row) => {
		while (row.length > headers.length && row.at(-1) === "") row.pop();
		if (row.length !== headers.length) throw new Error("The Maryland candidate CSV has an inconsistent row layout.");
		return Object.fromEntries(headers.map((header, index) => [header, row[index]!])) as Record<string, string>;
	});
}

export function parseMarylandCandidateRecords(source: StateBallotSource, body: string, makeRecord: (source: StateBallotSource, values: StateCandidateValues) => StateCandidateRecord | null): StateCandidateRecord[] {
	const electionId = marylandSourceElectionId(source);
	if (Buffer.byteLength(body) > 12 * 1024 * 1024) throw new Error("The Maryland candidate capture exceeds its bounds.");
	const local = source.format === "maryland-local-csv";
	let html: MarylandHtmlCandidate[] = [];
	let stateCandidateMarkers = 0;
	let records = body;
	const captured = body.trimStart().startsWith("{");
	if (captured) {
		const capture: unknown = JSON.parse(body);
		if (!exact(capture, ["schemaVersion", "type", "discovery", "roster", "records"]) || capture.schemaVersion !== 1 || capture.type !== "maryland-candidate-export" || typeof capture.discovery !== "string" || typeof capture.roster !== "string" || typeof capture.records !== "string") throw new Error("The Maryland candidate capture is invalid.");
		const elections = readMarylandElectionDiscovery(capture.discovery, local ? "local" : "state");
		if (elections.filter(election => election.electionId === electionId && election.electionDate === source.electionDate && election.rosterUrl === source.pageUrl).length !== 1) throw new Error("The Maryland candidate source is not uniquely published in its discovery capture.");
		const section = validateMarylandRoster(source, capture.roster);
		if (local) html = localCandidates(section);
		else stateCandidateMarkers = descendants(section, node => (node.nodeName === "div" && attribute(node, "class") === "candidate") || ["h4", "h5"].includes(node.nodeName)).length;
		records = capture.records;
	}
	else if (local || source.id !== "md-sbe-2026") {
		throw new Error("Future and local Maryland sources require complete published discovery evidence.");
	}
	const rows = csvRows(records, captured);
	if (local && html.length !== rows.length) throw new Error("The Maryland local HTML and CSV candidate counts disagree.");
	if (!rows.length) {
		if (stateCandidateMarkers) throw new Error("The Maryland state HTML and empty CSV disagree.");
		if (captured) throw new StateBallotAwaitingRecordsError(source.id);
		throw new Error("The Maryland legacy CSV contains no candidate records.");
	}
	const remaining = new Set(html);
	const nameKey = (name: string) => clean(name).replace(/"([^"]+)"/gu, "$1");
	const result = rows.map((row) => {
		const name = clean([row["Candidate First Name and Middle Name"], row["Candidate Ballot Last Name and Suffix"]].filter(Boolean).join(" "));
		const related = clean([row["Related Candidate First Name and Middle Name"], row["Related Candidate Last Name and Suffix"]].filter(Boolean).join(" "));
		const values: StateCandidateValues = { name: related ? `${name} / ${related}` : name, office: row["Office Name"] ?? "", district: row["Contest Run By District Name and Number"]?.match(/(?:district\s*)?(\d+[A-Z]?)$/iu)?.[1], party: row["Office Political Party"] ?? "", status: row["Candidate Status"] };
		if (local) {
			if (related) throw new Error("Maryland local joint-ticket formatting requires review.");
			const matches = [...remaining].filter(item => nameKey(item.name) === nameKey(name) && item.office === clean(values.office) && item.party === clean(values.party) && item.status === clean(values.status ?? "") && item.residence === clean(row["Candidate Residential Jurisdiction"] ?? "") && (!item.district || item.district === clean(row["Contest Run By District Name and Number"] ?? "")));
			if (matches.length !== 1) throw new Error("The Maryland local candidate cannot be uniquely reconciled with its official county section.");
			const item = matches[0]!;
			remaining.delete(item);
			values.name = item.name;
			values.office = item.district ? `${item.office} · ${item.district}` : item.office;
			values.scope = "local";
			values.district = item.district.match(/\bDistrict ([A-Z]|\d{1,3})$/u)?.[1] ?? "";
			values.sourceDistrictLabel = item.district || undefined;
			values.sourceAreaLabel = item.county;
			values.candidateUrl = /^www\./iu.test(clean(row.Website ?? "")) ? `https://${clean(row.Website!)}` : row.Website;
		}
		const record = makeRecord(source, values);
		if (!record) throw new Error("The Maryland candidate row is incomplete.");
		if (local && /^Deceased\b/u.test(values.status ?? "")) record.status = "inactive";
		return record;
	});
	if (remaining.size) throw new Error("The Maryland local page contains unmatched candidate entries.");
	return result;
}
