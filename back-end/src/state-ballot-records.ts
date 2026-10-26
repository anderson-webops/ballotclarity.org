import type { StateCandidateValues } from "./state-ballot-additional-records.js";
import type { StateHtmlNode as HtmlNode } from "./state-ballot-html.js";
import type { StateBallotSource } from "./state-ballot-sources.js";
import type { LocationDistrictMatch } from "./types/civic.js";
import { createHash } from "node:crypto";
import { parse as parseCsv } from "csv-parse/sync";
import { normalizePublicHref } from "./public-href.js";
import { parseAdditionalStateRecords } from "./state-ballot-additional-records.js";
import { parseArkansasCandidateRecords } from "./state-ballot-arkansas.js";
import { parseCassiaCandidateCapture } from "./state-ballot-cassia.js";
import { parseCertifiedPdfCapture } from "./state-ballot-certified-pdf.js";
import { parseClarkCandidateCapture } from "./state-ballot-clark-collection.js";
import { parseConnecticutCandidateCapture } from "./state-ballot-connecticut-collection.js";
import { parseConnecticutCandidateRecords } from "./state-ballot-connecticut.js";
import { validateDakotaCandidatePage } from "./state-ballot-dakota.js";
import { parseDcCandidateCapture } from "./state-ballot-dc-collection.js";
import { parseFloridaLocalCandidateRecords } from "./state-ballot-florida-local.js";
import { parseFranklinCandidateCapture } from "./state-ballot-franklin-collection.js";
import { parseFultonCandidateCapture } from "./state-ballot-fulton.js";
import {
	stateHtmlAttribute as attribute,
	stateHtmlDescendants as descendants,
	parseStateHtml as parseHtml,
	stateHtmlTableRows,
	stateHtmlText as textContent
} from "./state-ballot-html.js";
import { parseIowaJohnsonCandidateCapture } from "./state-ballot-iowa-johnson.js";
import { parseIowaPolkCandidateCapture } from "./state-ballot-iowa-polk.js";
import { kentuckySourceElectionId, parseKentuckyCandidateRecords } from "./state-ballot-kentucky.js";
import { parseMarylandCandidateRecords } from "./state-ballot-maryland.js";
import {
	normalizeMichiganCandidateRecord,
	readMichiganCandidateCapture,
	validateMichiganSource
} from "./state-ballot-michigan.js";
import { readNorthCarolinaCandidateCapture } from "./state-ballot-north-carolina.js";
import { parseOregonCandidateCapture } from "./state-ballot-oregon-collection.js";
import { parseOregonCandidateRecords } from "./state-ballot-oregon.js";
import { parseStatePortalRecords } from "./state-ballot-portal-records.js";
import { parsePulaskiCandidateCapture } from "./state-ballot-pulaski-collection.js";
import { StateBallotAwaitingRecordsError } from "./state-ballot-source-state.js";
import { floridaSourceElectionId } from "./state-ballot-southern.js";
import { parseTexasCandidateCapture } from "./state-ballot-texas.js";
import { parseTuscolaCandidateCapture } from "./state-ballot-tuscola-collection.js";
import { parseVermontCandidateCapture } from "./state-ballot-vermont.js";
import { parseVirginiaCandidateRecords, validateVirginiaSource } from "./state-ballot-virginia.js";
import { parseWashingtonCandidateRecords } from "./state-ballot-washington.js";
import { parseWashoeCandidateCapture } from "./state-ballot-washoe.js";

export type StateCandidateStatus = "listed" | "filed" | "qualified" | "write-in" | "withdrawn" | "disqualified" | "defeated" | "elected" | "unopposed" | "inactive" | "unrecognized";
export type StateContestScope = "statewide" | "congressional" | "state-senate" | "state-house" | "local";

export interface StateCandidateRecord {
	id: string;
	name: string;
	party?: string;
	incumbent?: true;
	office: string;
	district: string;
	scope: StateContestScope;
	status: StateCandidateStatus;
	sourceStatus?: string;
	ballotDesignation?: string;
	jurisdiction?: string;
	candidateUrl?: string;
	sourceCandidateId?: string;
	sourceDistrictLabel?: string;
	sourceDivision?: string;
	sourceAreaLabel?: string;
	termYears?: number;
	termEnd?: string;
	seats?: number;
	voteLimit?: number;
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
	if (/^deceased$|^removed$|^inactive$/iu.test(value)) return "inactive";
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

function makeRecord(source: StateBallotSource, values: StateCandidateValues): StateCandidateRecord | null {
	const name = clean(values.name);
	const office = clean(values.office);
	if (!name || !office || name.length > 250 || office.length > 300)
		return null;
	const party = clean(values.party);
	const geography = values.scope ? { scope: values.scope, district: values.scope === "statewide" ? "" : normalizeStateDistrict(values.district ?? "") } : classifyStateContest(office, values.district);
	if (geography.scope === "congressional" && geography.district === "0" && ["AK", "DE", "ND", "SD", "VT", "WY"].includes(source.stateCode)) {
		geography.scope = "statewide";
		geography.district = "";
	}
	const jurisdiction = geography.scope === "local" || source.format === "virginia-local-html" ? clean(values.jurisdiction) || undefined : undefined;
	const keyParts = [source.stateCode, source.electionDate, office.toLowerCase(), geography.district, name.toLowerCase(), party.toLowerCase()];
	if (jurisdiction) keyParts.push(jurisdiction.toLowerCase());
	if (source.format === "kentucky-courts-html") keyParts.push(clean(values.sourceDistrictLabel).toLowerCase());
	if (source.stateCode === "KY" && source.id.startsWith("ky-general-core-") && geography.scope === "local") keyParts.push(clean(values.sourceDistrictLabel).toLowerCase());
	if (source.format === "maryland-local-csv") {
		const area = clean(values.sourceAreaLabel);
		if (!area) return null;
		keyParts.push(area.toLowerCase());
	}
	if (source.format === "virginia-local-html") keyParts.push(clean(values.sourceAreaLabel).toLowerCase(), clean(values.sourceDistrictLabel).toLowerCase(), String(values.termYears ?? ""), values.termEnd ?? "", String(values.seats ?? ""));
	const sourceCandidateId = clean(values.sourceCandidateId) || undefined;
	if (sourceCandidateId) keyParts.push(sourceCandidateId);
	const key = JSON.stringify(keyParts);
	return {
		id: createHash("sha256").update(key).digest("hex").slice(0, 24),
		name,
		office,
		party: party || undefined,
		...geography,
		status: statusFromText(values.status ?? "", party),
		sourceStatus: clean(values.status) || undefined,
		jurisdiction,
		candidateUrl: /^https?:\/\//iu.test(values.candidateUrl ?? "") ? normalizePublicHref(values.candidateUrl) || undefined : undefined,
		sourceCandidateId,
		sourceDistrictLabel: clean(values.sourceDistrictLabel) || undefined,
		sourceDivision: clean(values.sourceDivision) || undefined,
		sourceAreaLabel: clean(values.sourceAreaLabel) || undefined,
		...(values.termYears !== undefined ? { termYears: values.termYears } : {}),
		...(values.termEnd !== undefined ? { termEnd: values.termEnd } : {}),
		...(values.seats !== undefined ? { seats: values.seats } : {}),
	};
}

export { makeRecord as createStateCandidateRecord };

function candidateFromCsv(source: StateBallotSource, row: Record<string, string>): StateCandidateRecord | null {
	switch (source.stateCode) {
		case "NC": {
			const [month, day, year] = clean(row.election_dt).split("/");
			if (`${year}-${month?.padStart(2, "0")}-${day?.padStart(2, "0")}` !== source.electionDate)
				return null;
			return makeRecord(source, { name: row.name_on_ballot ?? "", office: row.contest_name ?? "", party: row.party_candidate ?? "", jurisdiction: row.county_name });
		}
		case "WY": {
			if (clean(row.Election).toUpperCase() !== `${source.electionDate.slice(0, 4)} GENERAL ELECTION`) throw new Error("The Wyoming roster election label does not match its configured election.");
			const office = clean(row["Office Sought"]);
			const legislativeDistrict = /^STATE (?:SENATOR|REPRESENTATIVE) (\d{1,3})$/iu.exec(office)?.[1];
			if (/^STATE (?:SENATOR|REPRESENTATIVE)\b/iu.test(office) && (!legislativeDistrict || Number(legislativeDistrict) === 0)) throw new Error("The Wyoming legislative office has no unambiguous district number.");
			return makeRecord(source, {
				name: row["Ballot Name"] || [row["Candidate First Name"], row["Candidate Middle Name"], row["Candidate Last Name"], row["Candidate Suffix"]].filter(Boolean).join(" "),
				office,
				district: legislativeDistrict,
				party: row["Party Affiliation"] ?? "",
				status: clean(row["Date Withdrawn"]) ? "withdrawn" : "listed",
				candidateUrl: row["Web Address"],
			});
		}
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
			if (row.ElectionID !== floridaSourceElectionId(source)) return null;
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

function parseDelaware(source: StateBallotSource, body: string) {
	const document = parseHtml(body) as unknown as HtmlNode;
	const headings = descendants(document, node => node.nodeName === "h1");
	const identity = headings.length === 1 ? /^General Election 11\/(0?[2-8])\/(20\d{2})$/u.exec(clean(textContent(headings[0]!))) : null;
	if (!identity || `${identity[2]}-11-${identity[1]!.padStart(2, "0")}` !== source.electionDate)
		throw new Error("The official source does not identify the configured general election.");
	const tables = descendants(document, node => node.nodeName === "table");
	if (tables.length !== 1) throw new Error("The Delaware candidate table set has changed.");
	const rows = stateHtmlTableRows(tables[0]!);
	if (!rows.length || (rows[0]!.childNodes ?? []).filter(node => node.nodeName === "th").map(node => clean(textContent(node))).join("|") !== "Office|County|Party|Candidate|Status|Filed") throw new Error("The Delaware candidate columns have changed.");
	return rows.slice(1).map((row) => {
		const cells = (row.childNodes ?? []).filter(node => node.nodeName === "td");
		if (cells.map(cell => attribute(cell, "data-label")).join("|") !== "Office|County|Party|Candidate|Status|Date Filed") throw new Error("The Delaware candidate row layout has changed.");
		const field = (label: string) => cells.find(cell => attribute(cell, "data-label") === label);
		const nameCell = field("Candidate");
		const names = nameCell ? descendants(nameCell, node => attribute(node, "class").split(/\s/u).includes("main-span")) : [];
		if (names.length !== 1) throw new Error("The Delaware candidate name field has changed.");
		const value = (label: string) => {
			const cell = field(label);
			return cell ? clean(textContent(cell)) : "";
		};
		const record = makeRecord(source, { name: clean(textContent(names[0]!)), office: value("Office"), party: value("Party"), status: value("Status"), jurisdiction: value("County") });
		if (!record || (record.scope === "local" && !record.jurisdiction)) throw new Error("The Delaware public candidate row is incomplete.");
		return record;
	});
}

function parseMichigan(source: StateBallotSource, body: string) {
	validateMichiganSource(source);
	const document = parseHtml(body) as unknown as HtmlNode;
	const reportText = clean(textContent(document));
	if (!new RegExp(`General Election\\s+Tuesday, November ${Number(source.electionDate.slice(8))}, ${source.electionDate.slice(0, 4)}`, "iu").test(reportText) || /\b(?:Special General|Primary) Election\b/iu.test(reportText))
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
			if (columns.join("|") !== "|Status|Status||Party / Incumbent|Party / Incumbent|Candidate Name|Candidate Name|Candidate Name|Filed On|Filed On|Filed On|Filing Method|") throw new Error("The official candidate report columns have changed.");
			schemaSeen = true;
			continue;
		}
		if (!/^\d{2}\/\d{2}\/\d{4}$/u.test(columns[9] ?? "")) continue;
		if (!schemaSeen || columns.length !== 14 || !office || !columns[6])
			throw new Error("The official candidate report has an unexpected layout.");
		if (!["", "DISQ", "WITHD"].includes(columns[1] ?? "")) throw new Error("The Michigan candidate status vocabulary has changed.");
		const record = makeRecord(source, { name: columns[6], office, party: columns[4] ?? "", status: columns[1] });
		if (record) {
			if (/^(?:Justice of (?:the )?Supreme Court|Member of (?:the )?State Board of Education|Regent of (?:the )?University of Michigan|Trustee of Michigan State University|Governor of Wayne State University)/iu.test(office))
				record.scope = "statewide";
			records.push(normalizeMichiganCandidateRecord(record));
		}
	}
	const counts = [...reportText.matchAll(/(\d+)\s+Candidates as of/giu)];
	const expectedCount = counts[0]?.[1];
	const individualCount = records.reduce((total, record) => total + record.name.split(/\s\/\s/u).length, 0);
	if (!schemaSeen || counts.length !== 1 || !expectedCount || Number(expectedCount) > 25000 || individualCount !== Number(expectedCount))
		throw new Error("The official candidate report is incomplete.");
	if (!records.length && source.id !== "mi-dos-2026") throw new StateBallotAwaitingRecordsError(source.id);
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

function tableCells(row: HtmlNode) {
	return (row.childNodes ?? []).filter(node => ["td", "th"].includes(node.nodeName));
}

function findCandidateTable(document: HtmlNode, required: string[]) {
	return descendants(document, node => node.nodeName === "table").find((table) => {
		const first = stateHtmlTableRows(table)[0];
		const headers = first ? tableCells(first).map(cell => clean(textContent(cell))) : [];
		return required.every(header => headers.includes(header));
	});
}

function parseColorado(source: StateBallotSource, body: string) {
	const document = parseHtml(body);
	const title = descendants(document, node => node.nodeName === "title")[0];
	if (!title || clean(textContent(title)) !== "2026 General Election Official Candidate List")
		throw new Error("The official source does not identify the configured general election.");
	const table = findCandidateTable(document, ["Candidate name", "Office", "District", "Party", "Write in?"]);
	if (!table) throw new Error("The official candidate table has an unexpected layout.");
	if (tableCells(stateHtmlTableRows(table)[0]!).map(cell => clean(textContent(cell))).join("|") !== "Candidate name|Office|District|Party|Write in?")
		throw new Error("The official candidate columns have changed order.");
	return stateHtmlTableRows(table).slice(1).map((row) => {
		const cells = tableCells(row);
		if (cells.length !== 5) throw new Error("The official candidate table has an inconsistent row layout.");
		const [name, office, district, party, writeIn] = cells.map(cell => clean(textContent(cell)));
		if (!["Y", "N", ""].includes(writeIn ?? "")) throw new Error("The official write-in marker has changed.");
		const hasWithdrawalMark = (node: HtmlNode) => ["s", "del", "strike"].includes(node.nodeName) || /text-decoration(?:-line)?\s*:[^;]*line-through/iu.test(attribute(node, "style"));
		const withdrawn = hasWithdrawalMark(row) || cells.some(cell => hasWithdrawalMark(cell) || descendants(cell, hasWithdrawalMark).length > 0);
		const record = makeRecord(source, { name: name ?? "", office: office ?? "", district: district ?? "", party: party ?? "", status: withdrawn ? "withdrawn" : writeIn === "Y" ? "write-in" : "qualified", jurisdiction: district });
		if (!record) throw new Error("The official candidate table contains an incomplete candidate.");
		if (["Colorado Supreme Court", "Colorado Court of Appeals", "University of Colorado Board of Regents"].includes(office ?? "") && /^(?:state|at[- ]large)$/iu.test(district ?? "")) {
			record.scope = "statewide";
			record.district = "";
			delete record.jurisdiction;
		}
		return record;
	});
}

function parseNorthDakota(source: StateBallotSource, body: string) {
	const document = parseHtml(body);
	validateDakotaCandidatePage(source, document);
	const tables = descendants(document, node => node.nodeName === "table").filter((table) => {
		const heading = stateHtmlTableRows(table)[0];
		const columns = heading ? tableCells(heading).map(cell => clean(textContent(cell))) : [];
		return ["Contest", "District", "Name", "Party", "Term Length"].every(column => columns.includes(column));
	});
	const table = tables.length === 1 ? tables[0] : undefined;
	if (!table || descendants(table, node => /rgPager/u.test(attribute(node, "class"))).length)
		throw new Error("The official candidate table is missing or paginated.");
	const rows = stateHtmlTableRows(table);
	const headers = tableCells(rows.shift()!).map(cell => clean(textContent(cell)));
	return rows.flatMap((row) => {
		const cells = tableCells(row).map(cell => clean(textContent(cell)));
		if (cells.length !== headers.length) throw new Error("The official candidate table has an inconsistent row layout.");
		const field = (name: string) => cells[headers.lastIndexOf(name)] ?? "";
		const office = field("Contest");
		if (!office) throw new Error("The official candidate table contains an incomplete contest.");
		if (!field("Name") && !field("First Name") && !field("Last Name")) return [];
		const record = makeRecord(source, { name: field("Name"), office, party: field("Party"), district: field("District").match(/\d+[A-Z]?/iu)?.[0], status: "listed", jurisdiction: field("County") || field("District"), candidateUrl: field("Website") });
		if (!record) throw new Error("The official candidate table contains an incomplete candidate.");
		if (["Agriculture Commissioner", "Public Service Commissioner", "Tax Commissioner", "Justice of the Supreme Court"].includes(office)) {
			record.scope = "statewide";
			record.district = "";
			delete record.jurisdiction;
		}
		return [record];
	});
}

function parseKentucky(source: StateBallotSource, body: string) {
	const envelope = JSON.parse(body) as { documents?: Array<{ url?: unknown; body?: unknown }> };
	if (!Array.isArray(envelope.documents) || JSON.stringify(envelope.documents.map(document => document.url)) !== JSON.stringify(source.documentUrls))
		throw new Error("The official candidate document set is incomplete.");
	return envelope.documents.flatMap((item) => {
		if (typeof item.body !== "string" || typeof item.url !== "string") throw new Error("The official candidate document is invalid.");
		const document = parseHtml(item.body);
		const election = descendants(document, node => node.nodeName === "select" && attribute(node, "name") === "ctl00$MainContent$ddlElection")[0];
		const selected = election && descendants(election, node => node.nodeName === "option" && Boolean(node.attrs?.some(item => item.name === "selected")))[0];
		if (!selected || clean(textContent(selected)) !== "2026 General Election")
			throw new Error("The official source does not identify the configured general election.");
		const inactive = new URL(item.url).searchParams.get("withdrawn") === "1";
		const nameColumn = inactive ? "Name" : "Name / Running Mate";
		const tables = descendants(document, node => node.nodeName === "table").filter((table) => {
			const first = stateHtmlTableRows(table)[0];
			return first && tableCells(first).some(cell => clean(textContent(cell)) === nameColumn);
		});
		if (!tables.length) throw new Error("The official candidate table has an unexpected layout.");
		return tables.flatMap((table) => {
			const rows = stateHtmlTableRows(table);
			const headers = tableCells(rows.shift()!).map(cell => clean(textContent(cell)));
			if (["Office", "District/Division", "Party"].some(header => !headers.includes(header)))
				throw new Error("The official candidate table has an unexpected layout.");
			return rows.map((row) => {
				const cells = tableCells(row).map(cell => clean(textContent(cell)));
				if (cells.length !== headers.length) throw new Error("The official candidate table has an inconsistent row layout.");
				const field = (name: string) => cells[headers.indexOf(name)] ?? "";
				const record = makeRecord(source, { name: field(nameColumn), office: field("Office"), district: field("District/Division").match(/\d+/u)?.[0], party: field("Party"), status: inactive ? "inactive" : "listed" });
				if (!record) throw new Error("The official candidate table contains an incomplete candidate.");
				return record;
			});
		});
	});
}

const requiredColumns: Record<string, string[]> = {
	NC: ["election_dt", "contest_name", "name_on_ballot", "party_candidate"],
	WY: ["Election", "Office Sought", "Ballot Name", "Date Withdrawn"],
	MD: ["Office Name", "Candidate Ballot Last Name and Suffix", "Candidate First Name and Middle Name", "Candidate Status"],
	FL: ["ElectionID", "OfficeDesc", "StatusCode", "NameFirst", "NameLast"],
};

export function parseStateCandidateRecords(source: StateBallotSource, body: string): StateCandidateRecord[] {
	if (source.format === "virginia-html" && source.id === "va-elect-2026-federal") validateVirginiaSource(source);
	if (source.stateCode === "MI" && source.format === "michigan-html" && (source.id !== "mi-dos-2026" || body.trimStart().startsWith("{"))) body = readMichiganCandidateCapture(source, body);
	if (source.stateCode === "NC" && (source.id !== "nc-sbe-2026" || body.trimStart().startsWith("{"))) body = readNorthCarolinaCandidateCapture(source, body);
	if (["reviewed-pdf", "reviewed-xlsx", "reviewed-image"].includes(source.format))
		throw new Error("Reviewed document sources require a validated snapshot.");
	let records: StateCandidateRecord[];
	if (source.format === "pulaski-pdf") return parsePulaskiCandidateCapture(source, body).records;
	if (source.format === "tuscola-pdf") return parseTuscolaCandidateCapture(source, body).records;
	if (source.format === "dc-pdf") return parseDcCandidateCapture(source, body, makeRecord).records;
	if (source.format === "franklin-pdf") return parseFranklinCandidateCapture(source, body, makeRecord).records;
	if (source.format === "cassia-pdf") return parseCassiaCandidateCapture(source, body).records;
	if (source.format === "iowa-polk-pdf") return parseIowaPolkCandidateCapture(source, body, makeRecord).records;
	if (source.format === "iowa-johnson-html") {
		records = parseIowaJohnsonCandidateCapture(source, body, makeRecord).records;
	}
	else if (source.format === "washoe-html") {
		records = parseWashoeCandidateCapture(source, body, makeRecord).records;
	}
	else if (source.format === "clark-pdf") {
		records = parseClarkCandidateCapture(source, body, makeRecord).records;
	}
	else if (source.format === "oregon-pdf") {
		records = parseOregonCandidateCapture(source, body, makeRecord).records;
	}
	else if (source.format === "texas-certified-pdf") {
		records = parseTexasCandidateCapture(source, body).records;
	}
	else if (source.format === "vermont-xlsx") {
		records = parseVermontCandidateCapture(source, body).records;
	}
	else if (source.format === "certified-pdf") {
		records = parseCertifiedPdfCapture(source, body).records;
	}
	else if (source.format === "fulton-pdf") {
		records = parseFultonCandidateCapture(source, body).records;
	}
	else if (source.format === "virginia-local-html" || (source.format === "virginia-html" && (source.id !== "va-elect-2026-federal" || body.trimStart().startsWith("{")))) {
		records = parseVirginiaCandidateRecords(source, body, makeRecord);
	}
	else if (source.stateCode === "MD") {
		records = parseMarylandCandidateRecords(source, body, makeRecord);
	}
	else if (source.format === "florida-local-tsv") {
		records = parseFloridaLocalCandidateRecords(source, body, makeRecord);
	}
	else if (source.format === "arkansas-html") {
		records = parseArkansasCandidateRecords(source, body, makeRecord);
	}
	else if (source.format === "washington-html") {
		records = parseWashingtonCandidateRecords(source, body, makeRecord);
	}
	else if (source.format === "oregon-ballots") {
		records = parseOregonCandidateRecords(source, body, makeRecord);
	}
	else if (source.format === "connecticut-ballots") {
		records = parseConnecticutCandidateRecords(source, body, makeRecord);
	}
	else if (source.format === "connecticut-pdf") {
		records = parseConnecticutCandidateCapture(source, body, makeRecord).records;
	}
	else if (source.format === "delaware-html") {
		records = parseDelaware(source, body);
	}
	else if (source.format === "michigan-html") {
		records = parseMichigan(source, body);
	}
	else if (source.format === "new-mexico-html" || source.format === "virginia-html") {
		records = parseStateTable(source, body);
	}
	else if (source.format === "colorado-html") {
		records = parseColorado(source, body);
	}
	else if (source.format === "north-dakota-html") {
		records = parseNorthDakota(source, body);
	}
	else if (["kentucky-html", "kentucky-courts-html"].includes(source.format)) {
		kentuckySourceElectionId(source);
		records = source.id === "ky-sos-2026" && !Object.hasOwn(JSON.parse(body), "type") ? parseKentucky(source, body) : parseKentuckyCandidateRecords(source, body, makeRecord);
	}
	else if (["utah-html", "mississippi-csv", "south-dakota-csv", "hawaii-csv", "illinois-tsv", "montana-csv"].includes(source.format)) {
		records = parseAdditionalStateRecords(source, body, makeRecord);
	}
	else if (["pennsylvania-html", "west-virginia-json", "alaska-html", "south-carolina-html", "kansas-html"].includes(source.format)) {
		records = parseStatePortalRecords(source, body, makeRecord);
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

export function isActiveStateCandidateRecord(record: StateCandidateRecord) {
	return ["listed", "filed", "qualified", "write-in"].includes(record.status);
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
