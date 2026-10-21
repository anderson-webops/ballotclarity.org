import type { StateBallotSource } from "./state-ballot-sources.js";
import type { LocationDistrictMatch } from "./types/civic.js";
import { createHash } from "node:crypto";
import { parse as parseCsv } from "csv-parse/sync";
import { parse as parseHtml } from "parse5";

export type StateCandidateStatus = "listed" | "filed" | "qualified" | "write-in" | "withdrawn" | "disqualified" | "defeated" | "elected" | "unopposed" | "inactive" | "unrecognized";
export type StateContestScope = "statewide" | "congressional" | "state-senate" | "state-house" | "local";

export interface StateCandidateRecord {
	id: string;
	name: string;
	party?: string;
	office: string;
	district: string;
	scope: StateContestScope;
	status: StateCandidateStatus;
	sourceStatus?: string;
}

interface HtmlNode {
	nodeName: string;
	value?: string;
	attrs?: Array<{ name: string; value: string }>;
	childNodes?: HtmlNode[];
}

function clean(value: unknown) {
	return typeof value === "string" ? value.normalize("NFKC").replace(/\s+/gu, " ").trim() : "";
}

export function normalizeStateDistrict(value: string) {
	return clean(value).toUpperCase().replace(/^0+(?=\d)/u, "");
}

function statusFromText(value: string, party: string): StateCandidateStatus {
	if (/withdraw|withdrew|^WITHD$|^WIT$|^declined\b/iu.test(value)) return "withdrawn";
	if (/^unopposed$/iu.test(value)) return "unopposed";
	if (/^deceased$|^removed$/iu.test(value)) return "inactive";
	if (/defeat|eliminat|^DEF$/iu.test(value)) return "defeated";
	if (/elected|^ELE$/iu.test(value)) return "elected";
	if (/disqual|unqualif|not.*qual|^DNQ$|^DISQ$|^failed to submit required number of signatures/iu.test(value)) return "disqualified";
	if (/filed|active|^ACT$/iu.test(value)) return "filed";
	if (/write.?in|^WRI$/iu.test(`${value} ${party}`)) return "write-in";
	if (/^qualif|^QUA$/iu.test(value)) return "qualified";
	return !clean(value) || /^listed$/iu.test(value) ? "listed" : "unrecognized";
}

export function classifyStateContest(office: string, district = ""): { scope: StateContestScope; district: string } {
	const originalLabel = clean(office);
	const prefix = originalLabel.match(/^(\d+)(?:st|nd|rd|th)\s+District\s+/iu);
	const label = prefix ? originalLabel.slice(prefix[0].length) : originalLabel;
	const number = district || prefix?.[1] || label.match(/(?:district|dist\.?|seat)\s*(?:[-:]\s*)?(\d+[A-Z]?)/iu)?.[1] || "";
	if (/^(?:u\.?\s*s\.?|united states)\s+senat/iu.test(label))
		return { scope: "statewide", district: "" };
	if (/^(?:(?:u\.?\s*s\.?|united states)\s+(?:house|representative)|representative in congress|congressional)/iu.test(label))
		return { scope: "congressional", district: normalizeStateDistrict(number || "0") };
	if (/^(?:NC\s+)?(?:state\s+)?senat/iu.test(label))
		return { scope: "state-senate", district: normalizeStateDistrict(number) };
	if (/^(?:NC\s+)?(?:state\s+)?(?:house|representative|assembly|delegate)/iu.test(label))
		return { scope: "state-house", district: normalizeStateDistrict(number) };
	if (/^(?:governor|lieutenant governor|lt\.? governor|attorney general|secretary of state|comptroller|state auditor|auditor of accounts|state treasurer|treasurer|superintendent of public instruction|commissioner of (?:agriculture|insurance|labor)|supreme court|NC supreme court|NC court of appeals)/iu.test(label))
		return { scope: "statewide", district: "" };
	return { scope: "local", district: normalizeStateDistrict(number) };
}

function makeRecord(source: StateBallotSource, values: { name: string; office: string; party: string; status?: string; district?: string }): StateCandidateRecord | null {
	const name = clean(values.name);
	const office = clean(values.office);
	if (!name || !office || name.length > 250 || office.length > 300)
		return null;
	const party = clean(values.party);
	const geography = classifyStateContest(office, values.district);
	if (geography.scope === "congressional" && geography.district === "0" && ["AK", "DE", "ND", "SD", "VT", "WY"].includes(source.stateCode)) {
		geography.scope = "statewide";
		geography.district = "";
	}
	const key = JSON.stringify([source.stateCode, source.electionDate, office.toLowerCase(), geography.district, name.toLowerCase(), party.toLowerCase()]);
	return {
		id: createHash("sha256").update(key).digest("hex").slice(0, 24),
		name,
		office,
		party: party || undefined,
		...geography,
		status: statusFromText(values.status ?? "", party),
		sourceStatus: clean(values.status) || undefined,
	};
}

function candidateFromCsv(source: StateBallotSource, row: Record<string, string>): StateCandidateRecord | null {
	switch (source.stateCode) {
		case "NC": {
			const [month, day, year] = clean(row.election_dt).split("/");
			if (`${year}-${month?.padStart(2, "0")}-${day?.padStart(2, "0")}` !== source.electionDate)
				return null;
			return makeRecord(source, { name: row.name_on_ballot ?? "", office: row.contest_name ?? "", party: row.party_candidate ?? "" });
		}
		case "WY":
			if (!/2026.*general|general.*2026/iu.test(row.Election ?? "")) return null;
			return makeRecord(source, {
				name: row["Ballot Name"] || [row["Candidate First Name"], row["Candidate Middle Name"], row["Candidate Last Name"], row["Candidate Suffix"]].filter(Boolean).join(" "),
				office: row["Office Sought"] ?? "",
				party: row["Party Affiliation"] ?? "",
				status: clean(row["Date Withdrawn"]) ? "withdrawn" : "listed",
			});
		case "MD": {
			const name = [row["Candidate First Name and Middle Name"], row["Candidate Ballot Last Name and Suffix"]].filter(Boolean).join(" ");
			const runningMate = [row["Related Candidate First Name and Middle Name"], row["Related Candidate Last Name and Suffix"]].filter(Boolean).join(" ");
			return makeRecord(source, {
				name: runningMate ? `${name} / ${runningMate}` : name,
				office: row["Office Name"] ?? "",
				district: row["Contest Run By District Name and Number"]?.match(/(?:district\s*)?(\d+[A-Z]?)$/iu)?.[1],
				party: row["Office Political Party"] ?? "",
				status: row["Candidate Status"],
			});
		}
		case "FL":
			if (row.ElectionID !== "20261103-GEN") return null;
			return makeRecord(source, {
				name: [row.NameFirst, row.NameMiddle, row.NameLast].filter(Boolean).join(" "),
				office: row.OfficeDesc ?? "",
				district: row.Juris1num,
				party: row.PartyDesc || row.PartyCode || "",
				status: row.PartyCode === "WRI" && row.StatusCode === "QUA" ? "write-in" : row.StatusDesc || row.StatusCode,
			});
		default:
			throw new Error("No parser is configured for this official source.");
	}
}

function descendants(node: HtmlNode, predicate: (child: HtmlNode) => boolean): HtmlNode[] {
	return (node.childNodes ?? []).flatMap(child => [
		...(predicate(child) ? [child] : []),
		...descendants(child, predicate),
	]);
}

function attribute(node: HtmlNode, name: string) {
	return node.attrs?.find(item => item.name === name)?.value ?? "";
}

function textContent(node: HtmlNode): string {
	if (node.nodeName === "script" || node.nodeName === "style") return "";
	return node.value ?? (node.childNodes ?? []).map(textContent).join(" ");
}

function parseDelaware(source: StateBallotSource, body: string) {
	const document = parseHtml(body) as unknown as HtmlNode;
	if (!/General Election\s+11\/3\/2026/iu.test(clean(textContent(document))))
		throw new Error("The official source does not identify the configured general election.");
	return descendants(document, node => node.nodeName === "tr").flatMap((row) => {
		const cells = descendants(row, node => node.nodeName === "td");
		const field = (label: string) => cells.find(cell => attribute(cell, "data-label") === label);
		const nameCell = field("Candidate");
		const nameNode = nameCell && descendants(nameCell, node => attribute(node, "class").split(/\s/u).includes("main-span"))[0];
		const value = (label: string) => {
			const cell = field(label);
			return cell ? clean(textContent(cell)) : "";
		};
		const record = nameNode ? makeRecord(source, { name: clean(textContent(nameNode)), office: value("Office"), party: value("Party"), status: value("Status") }) : null;
		return record ? [record] : [];
	});
}

function parseMichigan(source: StateBallotSource, body: string) {
	const document = parseHtml(body) as unknown as HtmlNode;
	const reportText = clean(textContent(document));
	if (!/General Election\s+Tuesday, November 3, 2026/iu.test(reportText))
		throw new Error("The official source does not identify the configured general election.");
	let office = "";
	let schemaSeen = false;
	const records: StateCandidateRecord[] = [];
	for (const row of descendants(document, node => node.nodeName === "tr")) {
		const cells = (row.childNodes ?? []).filter(node => node.nodeName === "td");
		const heading = cells.find(cell => attribute(cell, "colspan") === "12" && descendants(cell, node => node.nodeName === "a" && Boolean(attribute(node, "id"))).length);
		if (heading) {
			office = clean(textContent(heading));
			continue;
		}
		const columns = cells.flatMap(cell => Array.from({ length: Math.min(20, Math.max(1, Number(attribute(cell, "colspan")) || 1)) }, () => clean(textContent(cell))));
		if (columns[6] === "Candidate Name" && columns[4] === "Party / Incumbent" && columns[1] === "Status") {
			schemaSeen = true;
			continue;
		}
		if (!/^\d{2}\/\d{2}\/\d{4}$/u.test(columns[9] ?? "")) continue;
		if (!schemaSeen || columns.length !== 14 || !office || !columns[6])
			throw new Error("The official candidate report has an unexpected layout.");
		const record = makeRecord(source, { name: columns[6], office, party: columns[4] ?? "", status: columns[1] });
		if (record) {
			if (/^(?:Justice of (?:the )?Supreme Court|Member of (?:the )?State Board of Education|Regent of (?:the )?University of Michigan|Trustee of Michigan State University|Governor of Wayne State University)/iu.test(office))
				record.scope = "statewide";
			records.push(record);
		}
	}
	const expectedCount = reportText.match(/(\d+)\s+Candidates as of/iu)?.[1];
	const individualCount = records.reduce((total, record) => total + record.name.split(/\s\/\s/u).length, 0);
	if (!expectedCount || individualCount !== Number(expectedCount))
		throw new Error("The official candidate report is incomplete.");
	return records;
}

function parseStateTable(source: StateBallotSource, body: string) {
	const document = parseHtml(body) as unknown as HtmlNode;
	const virginia = source.format === "virginia-html";
	const expectedTitle = virginia ? /November 3, 2026\s*-\s*Federal Offices/iu : /2026 General Election Contest\/Candidate List/iu;
	if (!expectedTitle.test(clean(textContent(document))))
		throw new Error("The official source does not identify the configured general election.");
	const table = descendants(document, node => node.nodeName === "table" && (virginia || attribute(node, "id") === "ctl00_MainContent_rgCandidate_ctl00"))[0];
	if (!table || descendants(table, node => /rgPager/u.test(attribute(node, "class"))).length)
		throw new Error("The official candidate report is missing or paginated.");
	const rows = descendants(table, node => node.nodeName === "tr").map(row => (row.childNodes ?? []).filter(node => ["td", "th"].includes(node.nodeName)).map(cell => clean(textContent(cell))));
	const headers = rows.shift() ?? [];
	const required = virginia ? ["Office Title", "District", "Candidate Party", "Candidate Name"] : ["Contest", "District", "Name", "Party", "Status"];
	if (required.some(header => !headers.includes(header)))
		throw new Error("The official candidate report has an unexpected layout.");
	return rows.flatMap((row) => {
		if (!row.some(Boolean)) return [];
		if (row.length !== headers.length)
			throw new Error("The official candidate report has an inconsistent row layout.");
		const field = (name: string) => row[headers.indexOf(name)] ?? "";
		const office = field(virginia ? "Office Title" : "Contest");
		const record = makeRecord(source, {
			name: field(virginia ? "Candidate Name" : "Name"),
			office,
			party: field(virginia ? "Candidate Party" : "Party"),
			district: field("District").match(virginia ? /\d+/u : /\d+[A-Z]?/iu)?.[0],
			status: virginia ? "listed" : field("Status"),
		});
		if (record && virginia) {
			if (office === "Member, United States Senate") record.scope = "statewide";
			else if (office === "Member, House of Representatives") record.scope = "congressional";
			else throw new Error("The federal candidate list contains an unexpected office.");
		}
		return record ? [record] : [];
	});
}

const requiredColumns: Record<string, string[]> = {
	NC: ["election_dt", "contest_name", "name_on_ballot", "party_candidate"],
	WY: ["Election", "Office Sought", "Ballot Name", "Date Withdrawn"],
	MD: ["Office Name", "Candidate Ballot Last Name and Suffix", "Candidate First Name and Middle Name", "Candidate Status"],
	FL: ["ElectionID", "OfficeDesc", "StatusCode", "NameFirst", "NameLast"],
};

export function parseStateCandidateRecords(source: StateBallotSource, body: string): StateCandidateRecord[] {
	let records: StateCandidateRecord[];
	if (source.format === "delaware-html") {
		records = parseDelaware(source, body);
	}
	else if (source.format === "michigan-html") {
		records = parseMichigan(source, body);
	}
	else if (source.format === "new-mexico-html" || source.format === "virginia-html") {
		records = parseStateTable(source, body);
	}
	else {
		const table = parseCsv(body, {
			bom: true,
			delimiter: source.delimiter ?? ",",
			quote: source.stateCode === "FL" ? false : "\"",
			relax_quotes: source.stateCode === "MD",
			relax_column_count: source.stateCode === "MD",
			skip_empty_lines: true,
			max_record_size: 100_000,
		}) as string[][];
		const headers = table.shift() ?? [];
		while (headers.at(-1) === "") headers.pop();
		const rows = table.map((row) => {
			while (row.length > headers.length && row.at(-1) === "") row.pop();
			if (row.length !== headers.length) throw new Error("The official candidate file has an inconsistent row layout.");
			return Object.fromEntries(headers.map((header, index) => [header, row[index]!])) as Record<string, string>;
		});
		if (rows.length > 25_000 || !rows.length || requiredColumns[source.stateCode]?.some(column => !headers.includes(column)))
			throw new Error("The official candidate file has an unexpected layout.");
		records = rows.map(row => candidateFromCsv(source, row)).filter((record): record is StateCandidateRecord => Boolean(record));
	}
	if (!records.length)
		throw new Error("The official source contains no records for the configured election.");
	const unique = new Map<string, StateCandidateRecord>();
	for (const record of records) {
		const previous = unique.get(record.id);
		if (!previous || !["withdrawn", "disqualified", "defeated", "elected", "unopposed", "inactive", "unrecognized"].includes(previous.status))
			unique.set(record.id, record);
	}
	return [...unique.values()];
}

export function stateRecordMatchesDistricts(record: StateCandidateRecord, matches: LocationDistrictMatch[]) {
	if (record.scope === "statewide") return true;
	if (record.scope === "local" || !record.district) return false;
	return matches.some((match) => {
		const type = match.districtType.toLowerCase().replace(/[\s_]+/gu, "-");
		const scope = ["congressional", "congressional-district", "cd"].includes(type)
			? "congressional"
			: ["state-senate", "state-senate-district", "state-upper", "upper", "sldu"].includes(type)
					? "state-senate"
					: ["state-house", "state-house-district", "state-lower", "lower", "sldl"].includes(type) ? "state-house" : null;
		return record.scope === scope && record.district === normalizeStateDistrict(match.districtCode);
	});
}
