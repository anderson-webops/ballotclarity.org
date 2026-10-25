import type { StateBallotSource } from "./state-ballot-sources.js";
import { Buffer } from "node:buffer";
import { parse } from "csv-parse/sync";
import { stateHtmlAttribute as attribute, stateHtmlDescendants as descendants, parseStateHtml, stateHtmlText } from "./state-ballot-html.js";

export const northCarolinaDiscoveryUrl = "https://www.ncsbe.gov/results-data/candidate-lists";
const headers = "election_dt|county_name|contest_name|name_on_ballot|first_name|middle_name|last_name|name_suffix_lbl|nick_name|street_address|city|state|zip_code|phone|office_phone|business_phone|email|candidacy_dt|party_contest|party_candidate|is_unexpired|has_primary|is_partisan|vote_for|term".split("|");
const clean = (value: string) => value.normalize("NFKC").replace(/\s+/gu, " ").trim();
const text = (node: Parameters<typeof stateHtmlText>[0]) => clean(stateHtmlText(node));
type RequestText = (url: string, options: { allowedHosts: string[]; maxBytes: number; maxRedirects: number; timeoutMs: number }) => Promise<string>;
const options = { allowedHosts: ["www.ncsbe.gov", "s3.amazonaws.com"], maxBytes: 12 * 1024 * 1024, maxRedirects: 0, timeoutMs: 12000 };
const exact = (value: unknown, keys: string[]): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).sort().join(",") === keys.sort().join(","));
const csvUrl = (year: string) => `https://s3.amazonaws.com/dl.ncsbe.gov/Elections/${year}/Candidate%20Filing/Candidate_Listing_${year}.csv`;

export function northCarolinaCandidateCsvUrl(electionDate: string) {
	if (!/^20\d{2}-11-0[2-8]$/u.test(electionDate) || Number(electionDate.slice(0, 4)) % 2 || new Date(electionDate).getUTCDay() !== 2 || electionDate < "2026-11-03") throw new Error("The North Carolina source requires a supported regular general-election date.");
	return csvUrl(electionDate.slice(0, 4));
}

export function validateNorthCarolinaSource(source: StateBallotSource) {
	if (source.stateCode !== "NC" || source.format !== "csv" || source.retrievalPolicy || source.postBody || source.documentUrls?.length || source.documentLinks?.length || source.delimiter || source.pageUrl !== northCarolinaDiscoveryUrl || source.url !== northCarolinaCandidateCsvUrl(source.electionDate) || source.id !== (source.electionDate === "2026-11-03" ? "nc-sbe-2026" : `nc-general-${source.electionDate}`)) throw new Error("The North Carolina source does not retain its approved identity.");
}

export function readNorthCarolinaCandidateIndex(body: string) {
	if (Buffer.byteLength(body) > 2 * 1024 * 1024) throw new Error("The North Carolina index exceeds its bounds.");
	const document = parseStateHtml(body);
	const headings = descendants(document, node => node.nodeName === "h1");
	if (headings.length !== 1 || text(headings[0]!) !== "Candidate Lists") throw new Error("The North Carolina candidate heading has changed.");
	const tables = descendants(document, node => node.nodeName === "table" && descendants(node, child => child.nodeName === "caption").some(caption => /^Table \d+: (?:North Carolina Candidate Detail List Files for 20\d{2} Elections|Past North Carolina Candidate Detail List Files by Election Year)$/u.test(text(caption))));
	if (!tables.length || tables.length > 3) throw new Error("The North Carolina candidate-year tables are missing or changed.");
	const years = new Map<string, string>();
	for (const table of tables) {
		const rows = descendants(table, node => node.nodeName === "tr");
		if (rows.length > 100 || !rows[0] || descendants(rows[0], node => node.nodeName === "th").map(text).join("|") !== "Election Year|Candidate List Spreadsheets|Candidate Lists by Contest|Candidate Detail Lists") throw new Error("The North Carolina candidate-year columns have changed.");
		for (const row of rows.slice(1)) {
			const cells = (row.childNodes ?? []).filter(node => node.nodeName === "td");
			const year = cells[0] ? text(cells[0]) : "";
			if (!/^20\d{2}$/u.test(year)) throw new Error("The North Carolina candidate year is ambiguous.");
			if (year < "2026" || Number(year) % 2) continue;
			if (cells.length !== 4) throw new Error("The North Carolina candidate-year row has changed.");
			const general = descendants(cells[2]!, node => node.nodeName === "a" && text(node).toLowerCase() === `${year} general candidate list by contest (pdf)`);
			if (!general.length) continue;
			const generalUrl = `https://s3.amazonaws.com/dl.ncsbe.gov/Elections/${year}/Candidate%20Filing/${year}_general_candidate_list_by_contest.pdf`;
			const csv = descendants(cells[1]!, node => node.nodeName === "a" && text(node) === `${year} Candidate List Spreadsheet (CSV)`);
			if (general.length !== 1 || attribute(general[0]!, "href") !== generalUrl || csv.length !== 1 || attribute(csv[0]!, "href") !== csvUrl(year) || years.has(year)) throw new Error("The North Carolina published candidate download controls are ambiguous or changed.");
			years.set(year, csvUrl(year));
		}
	}
	if (!years.size || years.size > 10) throw new Error("The North Carolina general-election year set exceeds its bounds.");
	return [...years].sort(([first], [second]) => first.localeCompare(second)).map(([year, url]) => ({ year, url }));
}

function electionDateFromCsv(year: string, body: string) {
	if (Buffer.byteLength(body) > options.maxBytes) throw new Error("The North Carolina candidate file exceeds its bounds.");
	const table = parse(body, { bom: true, skip_empty_lines: true, max_record_size: 100000 }) as string[][];
	if (JSON.stringify(table.shift()) !== JSON.stringify(headers) || table.length > 25000) throw new Error("The North Carolina combined-year CSV layout has changed.");
	const dates = new Set<string>();
	for (const row of table) {
		if (row.length !== headers.length || !row[2]?.trim() || !row[3]?.trim() || !["TRUE", "FALSE"].includes(row[21]!)) throw new Error("The North Carolina candidate row is incomplete or changed.");
		const date = /^(\d{2})\/(\d{2})\/(20\d{2})$/u.exec(row[0]!);
		const iso = date ? `${date[3]}-${date[1]}-${date[2]}` : "";
		if (!date || date[3] !== year || !Number.isFinite(Date.parse(iso)) || new Date(iso).toISOString().slice(0, 10) !== iso) throw new Error("The North Carolina row election date is invalid or belongs to another year.");
		if (date[1] !== "11" || !/^0[2-8]$/u.test(date[2]!)) continue;
		if (new Date(iso).getUTCDay() !== 2 || row[21] !== "FALSE") throw new Error("The North Carolina November election context is inconsistent.");
		dates.add(iso);
	}
	if (dates.size !== 1) throw new Error("The published North Carolina general list has no unique explicit general-election record date.");
	return [...dates][0]!;
}

export function readNorthCarolinaElectionDiscovery(body: string) {
	if (Buffer.byteLength(body) > 24 * 1024 * 1024) throw new Error("The North Carolina discovery capture exceeds its bounds.");
	const value: unknown = JSON.parse(body);
	if (!exact(value, ["schemaVersion", "type", "index", "exports"]) || value.schemaVersion !== 1 || value.type !== "north-carolina-election-discovery" || typeof value.index !== "string" || !Array.isArray(value.exports)) throw new Error("The North Carolina discovery capture is invalid.");
	const offered = readNorthCarolinaCandidateIndex(value.index);
	if (value.exports.length !== offered.length) throw new Error("The North Carolina discovery export set is incomplete.");
	return value.exports.map((entry, index) => {
		if (!exact(entry, ["year", "url", "records"]) || entry.year !== offered[index]!.year || entry.url !== offered[index]!.url || typeof entry.records !== "string") throw new Error("The North Carolina discovery export is not its published control.");
		return { electionId: null, electionDate: electionDateFromCsv(entry.year as string, entry.records) };
	});
}

export async function fetchNorthCarolinaCycleDiscovery(request: RequestText) {
	const index = await request(northCarolinaDiscoveryUrl, { ...options, maxBytes: 2 * 1024 * 1024 });
	const exports = [];
	for (const entry of readNorthCarolinaCandidateIndex(index)) {
		exports.push({ ...entry, records: await request(entry.url, options) });
		if (Buffer.byteLength(JSON.stringify({ index, exports })) > 24 * 1024 * 1024) throw new Error("The combined North Carolina capture exceeds its bounds.");
	}
	return JSON.stringify({ schemaVersion: 1, type: "north-carolina-election-discovery", index, exports });
}

export function northCarolinaCandidateCapture(source: StateBallotSource, discovery: string) {
	validateNorthCarolinaSource(source);
	if (!readNorthCarolinaElectionDiscovery(discovery).some(entry => entry.electionDate === source.electionDate)) throw new Error("The North Carolina source election is not offered.");
	const value = JSON.parse(discovery);
	const entry = value.exports.find((entry: { url: string }) => entry.url === source.url);
	return JSON.stringify({ schemaVersion: 1, type: "north-carolina-candidate-export", index: value.index, year: entry.year, url: entry.url, records: entry.records });
}

export function readNorthCarolinaCandidateCapture(source: StateBallotSource, body: string) {
	validateNorthCarolinaSource(source);
	if (Buffer.byteLength(body) > options.maxBytes) throw new Error("The North Carolina candidate capture exceeds its bounds.");
	const value: unknown = JSON.parse(body);
	if (!exact(value, ["schemaVersion", "type", "index", "year", "url", "records"]) || value.schemaVersion !== 1 || value.type !== "north-carolina-candidate-export" || typeof value.index !== "string" || typeof value.records !== "string" || value.year !== source.electionDate.slice(0, 4) || value.url !== source.url || !readNorthCarolinaCandidateIndex(value.index).some(entry => entry.url === value.url) || electionDateFromCsv(value.year as string, value.records) !== source.electionDate) throw new Error("The North Carolina candidate capture does not identify its published general election.");
	return value.records;
}

export async function fetchNorthCarolinaCandidateCapture(source: StateBallotSource, request: RequestText) {
	validateNorthCarolinaSource(source);
	const index = await request(northCarolinaDiscoveryUrl, { ...options, maxBytes: 2 * 1024 * 1024 });
	if (!readNorthCarolinaCandidateIndex(index).some(entry => entry.url === source.url)) throw new Error("The North Carolina candidate source is not published.");
	const records = await request(source.url, options);
	const body = JSON.stringify({ schemaVersion: 1, type: "north-carolina-candidate-export", index, year: source.electionDate.slice(0, 4), url: source.url, records });
	readNorthCarolinaCandidateCapture(source, body);
	return body;
}
