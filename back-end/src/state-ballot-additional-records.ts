import type { StateCandidateRecord, StateContestScope } from "./state-ballot-records.js";
import type { StateBallotSource } from "./state-ballot-sources.js";
import { parse as parseCsv } from "csv-parse/sync";
import { buildPublicStateExportForm } from "./state-ballot-fetch.js";
import { parseStateHtml, stateHtmlDescendants, stateHtmlTableRows, stateHtmlText } from "./state-ballot-html.js";

export interface StateCandidateValues {
	name: string;
	office: string;
	party: string;
	status?: string;
	district?: string;
	jurisdiction?: string;
	candidateUrl?: string;
	sourceCandidateId?: string;
	sourceDistrictLabel?: string;
	sourceDivision?: string;
	sourceAreaLabel?: string;
	scope?: StateContestScope;
}

type RecordFactory = (source: StateBallotSource, values: StateCandidateValues) => StateCandidateRecord | null;

function clean(value: string | undefined) {
	return (value ?? "").normalize("NFKC").replace(/\s+/gu, " ").trim();
}

function requiredRecord(source: StateBallotSource, values: StateCandidateValues, factory: RecordFactory) {
	const record = factory(source, values);
	if (!record) throw new Error("The official candidate export contains an incomplete candidate.");
	return record;
}

function parseUtah(source: StateBallotSource, body: string, factory: RecordFactory) {
	const document = parseStateHtml(body);
	const heading = stateHtmlDescendants(document, node => /^h[1-3]$/u.test(node.nodeName) && clean(stateHtmlText(node)) === "2026 Candidate Filings")[0];
	if (!heading) throw new Error("The official source does not identify the configured election year.");
	const tables = stateHtmlDescendants(document, node => node.nodeName === "table");
	if (tables.length !== 5) throw new Error("The official candidate table set has changed.");
	const knownStatuses = ["Election Candidate", "Out in Convention", "Out in Primary", "Withdrew", "Write-In", "Disqualified", "Deceased"];
	return tables.flatMap((table, index) => {
		const rows = stateHtmlTableRows(table);
		const cells = (row: typeof table) => (row.childNodes ?? []).filter(node => ["td", "th"].includes(node.nodeName)).map(node => clean(stateHtmlText(node)));
		const expected = index === 4 ? "Judicial Retention|Status" : "Candidate|Office|Party|Status";
		if (!rows.length || cells(rows[0]!).join("|") !== expected)
			throw new Error("The official candidate columns have changed.");
		return rows.slice(1).flatMap((row) => {
			const values = cells(row);
			if (values.length !== (index === 4 ? 2 : 4)) throw new Error("The official candidate row layout has changed.");
			const status = values.at(-1)!;
			if (!knownStatuses.includes(status)) throw new Error("The official candidate status vocabulary has changed.");
			if (!["Election Candidate", "Write-In"].includes(status)) return [];
			let name = values[0]!;
			let office = values[1]!;
			let scope: StateContestScope | undefined;
			if (index === 4) {
				const question = name.match(/^Shall (.+) be retained in the office of (.+)\?$/u);
				if (!question) throw new Error("The judicial retention question layout has changed.");
				name = question[1]!;
				office = question[2]!;
				scope = /^(?:Judge of the Court of Appeals of Utah|Justice of the Supreme Court of Utah)$/u.test(office) ? "statewide" : "local";
				office = values[0]!;
			}
			const record = requiredRecord(source, { name, office, party: index === 4 ? "" : values[2]!, status: status === "Write-In" ? "write-in" : "listed", scope }, factory);
			record.sourceStatus = status;
			return [record];
		});
	});
}

function readExport(source: StateBallotSource, body: string) {
	const envelope = JSON.parse(body) as { page?: unknown; records?: unknown };
	if (typeof envelope.page !== "string" || typeof envelope.records !== "string") throw new Error("The official export envelope is invalid.");
	buildPublicStateExportForm(source, envelope.page);
	const table = parseCsv(envelope.records, { bom: true, delimiter: source.format === "illinois-tsv" ? "\t" : ",", quote: source.format === "illinois-tsv" ? false : "\"", relax_column_count: source.format === "illinois-tsv", skip_empty_lines: true, max_record_size: 100_000 }) as string[][];
	const headers = table.shift() ?? [];
	if (source.format === "illinois-tsv") {
		while (headers.at(-1) === "") headers.pop();
	}
	if (!table.length || table.length > 25_000 || new Set(headers).size !== headers.length)
		throw new Error("The official export has an unexpected layout.");
	const rows = table.map((values) => {
		if (values.length !== headers.length) throw new Error("The official export has an inconsistent row layout.");
		return Object.fromEntries(headers.map((header, index) => [header, clean(values[index])])) as Record<string, string>;
	});
	if (["hawaii-csv", "south-dakota-csv", "montana-csv"].includes(source.format)) {
		const total = clean(stateHtmlText(parseStateHtml(envelope.page))).match(/(\d+) items in \d+ pages/u)?.[1];
		if (!total || Number(total) !== rows.length) throw new Error("The official export does not match its complete public record count.");
	}
	return { headers, rows };
}

function requireColumns(headers: string[], expected: string[]) {
	if (expected.some(column => !headers.includes(column))) throw new Error("The official export columns have changed.");
}

function publishedWebsite(value: string | undefined) {
	const website = clean(value);
	return /^[a-z0-9][a-z0-9.-]+\.[a-z]{2,}(?:[/?#]\S*)?$/iu.test(website) ? `https://${website}` : website;
}

function parseMontana(source: StateBallotSource, headers: string[], rows: Record<string, string>[], factory: RecordFactory) {
	const expected = ["Status", "District Type", "District", "Race", "Term Type", "Term Length", "Name", "Mailing Address", "Email/Web Address", "Phone", "Filing Date", "Party Preference", "Ballot Order"];
	if (headers.length !== expected.length || expected.some(column => !headers.includes(column))) throw new Error("The Montana public export columns have changed.");
	const parties: Record<string, string> = { DEM: "Democratic", REP: "Republican", IND: "Independent", LIB: "Libertarian", NON: "Nonpartisan" };
	const identifiers = new Set<string>();
	return rows.map((row) => {
		if (!["FILED", "WITHDRAWN"].includes(row.Status!) || !["REGULAR", "UNEXPIRED"].includes(row["Term Type"]!))
			throw new Error("The Montana public candidate status or term vocabulary has changed.");
		const office = row.Race!;
		const type = row["District Type"]!;
		const label = row.District!;
		const party = parties[row["Party Preference"]!];
		if (!party) throw new Error("The Montana party-preference vocabulary has changed.");
		let scope: StateContestScope;
		let district = "";
		let jurisdiction: string | undefined;
		let expectedTerm: string;
		if (type === "Statewide" && label === "STATE" && office === "UNITED STATES SENATOR") {
			scope = "statewide";
			expectedTerm = "6";
		}
		else if (type === "Supreme Court Justice" && label === "SUPREME COURT JUSTICE" && /^SUPREME COURT JUSTICE #[1-9]\d*$/u.test(office) && row["Party Preference"] === "NON") {
			scope = "statewide";
			expectedTerm = "8";
		}
		else if (type === "Congressional" && office === "UNITED STATES REPRESENTATIVE" && /^(?:1ST|2ND) CONGRESSIONAL$/u.test(label)) {
			scope = "congressional";
			district = label.slice(0, 1);
			expectedTerm = "2";
		}
		else if (["Senate", "House"].includes(type)) {
			const match = label.match(new RegExp(`^${type.toUpperCase()} DISTRICT ([1-9]\\d*)$`, "u"));
			if (!match || office !== `${type === "Senate" ? "STATE SENATOR" : "STATE REPRESENTATIVE"} DISTRICT ${match[1]}` || Number(match[1]) > (type === "Senate" ? 50 : 100))
				throw new Error("The Montana legislative district or office has changed.");
			scope = type === "Senate" ? "state-senate" : "state-house";
			district = match[1]!;
			expectedTerm = type === "Senate" ? "4" : "2";
		}
		else if (type === "Public Service Commission") {
			const match = label.match(/^PUBLIC SERVICE COMMISSIONER DISTRICT ([1-5])$/u);
			if (!match || office !== `PUBLIC SERVICE COMMISSIONER, DISTRICT ${match[1]}`) throw new Error("The Montana commission district has changed.");
			scope = "local";
			district = match[1]!;
			jurisdiction = `Public Service Commission District ${district}`;
			expectedTerm = "4";
		}
		else if (type === "Judicial" && row["Party Preference"] === "NON") {
			const match = office.match(/^DISTRICT COURT JUDGE DISTRICT ([1-9]\d*), DEPT [1-9]\d*( UNEXPIRED)?$/u);
			if (!match || label !== `JUDICIAL DISTRICT ${match[1]}` || Boolean(match[2]) !== (row["Term Type"] === "UNEXPIRED")) throw new Error("The Montana judicial district or term has changed.");
			scope = "local";
			district = match[1]!;
			jurisdiction = `Judicial District ${district}`;
			expectedTerm = "6";
		}
		else {
			throw new Error("The Montana public office or district vocabulary has changed.");
		}
		if (row["Term Length"] !== expectedTerm || (row["Term Type"] === "UNEXPIRED" && type !== "Judicial")) throw new Error("The Montana public term has changed.");
		const incumbent = row.Name!.startsWith("*");
		const name = incumbent ? row.Name!.slice(1).trim() : row.Name!;
		if (name.includes("*")) throw new Error("The Montana candidate name marker has changed.");
		const record = requiredRecord(source, { name, office, party, scope, district, jurisdiction, status: row.Status, sourceDistrictLabel: label }, factory);
		if (identifiers.has(record.id)) throw new Error("The Montana public export contains duplicate candidate identities.");
		identifiers.add(record.id);
		record.ballotDesignation = [incumbent ? "Incumbent" : "", row["Term Type"] === "UNEXPIRED" ? `Unexpired; listed term length: ${expectedTerm} years` : `${expectedTerm}-year term`].filter(Boolean).join("; ");
		return record;
	});
}

function parseIllinois(source: StateBallotSource, rows: Record<string, string>[], factory: RecordFactory) {
	const brackets = new Map<string, Record<string, string>[]>();
	for (const row of rows) {
		if (row.ElecDate !== "11/3/2026" || row.ElectionType !== "GE") throw new Error("The official export includes a different election.");
		if (!["Active", "Removed", "Withdrawn"].includes(row.CandidateStatus!)) throw new Error("The official candidate status vocabulary has changed.");
		if (row.OfficeName === "GOVERNOR AND LIEUTENANT GOVERNOR") {
			if (!/^\d+$/u.test(row.BracketID ?? "") || row.BracketID === "0") throw new Error("The official joint-ticket identity is missing.");
			const group = brackets.get(row.BracketID!) ?? [];
			group.push(row);
			brackets.set(row.BracketID!, group);
		}
	}
	const seen = new Set<string>();
	return rows.flatMap((row) => {
		const name = (candidate: Record<string, string>) => clean(`${candidate.FirstName ?? ""} ${candidate.LastName ?? ""}`);
		let candidateName = name(row);
		let candidateStatus = row.CandidateStatus!;
		let website = row.WebSiteAddress;
		let office = row.OfficeName!;
		let scope: StateContestScope = ["UNITED STATES SENATOR", "GOVERNOR AND LIEUTENANT GOVERNOR", "ATTORNEY GENERAL", "SECRETARY OF STATE", "COMPTROLLER", "TREASURER"].includes(office) ? "statewide" : "local";
		let district = "";
		const numbered = office.match(/^(\d+)(?:ST|ND|RD|TH) (CONGRESS|SENATE|REPRESENTATIVE)$/u);
		if (numbered) {
			district = numbered[1]!;
			scope = numbered[2] === "CONGRESS" ? "congressional" : numbered[2] === "SENATE" ? "state-senate" : "state-house";
			office = `${scope === "congressional" ? "U.S. House" : scope === "state-senate" ? "State Senate" : "State House"} District ${district}`;
		}
		if (brackets.has(row.BracketID!) && row.OfficeName === "GOVERNOR AND LIEUTENANT GOVERNOR") {
			if (seen.has(row.BracketID!)) return [];
			seen.add(row.BracketID!);
			const group = brackets.get(row.BracketID!)!;
			const head = group.find(candidate => candidate.CandidateID === row.BracketID);
			if (!head || group.length > 2 || group.some(candidate => candidate.PartyName !== head.PartyName) || (group.length !== 2 && group.some(candidate => candidate.CandidateStatus === "Active")))
				throw new Error("The official joint-ticket layout has changed.");
			candidateName = [head, ...group.filter(candidate => candidate !== head)].map(name).join(" / ");
			candidateStatus = group.every(candidate => candidate.CandidateStatus === head.CandidateStatus) ? head.CandidateStatus! : "Removed";
			website = head.WebSiteAddress;
		}
		const record = requiredRecord(source, { name: candidateName, office, party: row.PartyName!, status: candidateStatus, scope, district, candidateUrl: publishedWebsite(website) }, factory);
		return [record];
	});
}

export function parseAdditionalStateRecords(source: StateBallotSource, body: string, factory: RecordFactory): StateCandidateRecord[] {
	if (source.format === "utah-html") return parseUtah(source, body, factory);
	const { headers, rows } = readExport(source, body);
	if (source.format === "montana-csv") return parseMontana(source, headers, rows, factory);
	if (source.format === "illinois-tsv") {
		requireColumns(headers, ["CandidateID", "BracketID", "FirstName", "LastName", "CandidateStatus", "WebSiteAddress", "ElecDate", "ElectionType", "PartyName", "OfficeName"]);
		return parseIllinois(source, rows, factory);
	}
	if (source.format === "mississippi-csv") {
		requireColumns(headers, ["Office", "Candidate Name", "Party", "District", "Place", "General Election", "Election"]);
		return rows.flatMap((row) => {
			if (![row["General Election"], row.Election].includes("November 3, 2026")) return [];
			let office = row.Office!.replace(/^Candidates for /u, "");
			if (office.startsWith("State House of Representatives")) office = "State House of Representatives (Special Election)";
			if (row.Place) office += `, Place ${row.Place}`;
			return [requiredRecord(source, { name: row["Candidate Name"]!, office, party: row.Party!, district: row.District, jurisdiction: row.District ? `Judicial District ${row.District}` : undefined, status: "listed" }, factory)];
		});
	}
	if (source.format === "hawaii-csv") {
		requireColumns(headers, ["Contests", "Party", "BallotName", "Status", "Website"]);
		return rows.flatMap((row) => {
			if (!["Issued", "In General", "In Primary", "Withdrawn", "Void", "Elected After Primary", "Filed"].includes(row.Status!))
				throw new Error("The official candidate status vocabulary has changed.");
			if (row.Status !== "In General") return [];
			const district = row.Contests!.match(/\bDIST\s+(\d+|II|I)$/u)?.[1];
			const record = requiredRecord(source, { name: row.BallotName!, office: row.Contests!, party: row.Party!, district: district === "I" ? "1" : district === "II" ? "2" : district, candidateUrl: publishedWebsite(row.Website), status: "listed" }, factory);
			record.sourceStatus = row.Status;
			return [record];
		});
	}
	if (source.format === "south-dakota-csv") {
		requireColumns(headers, ["Contest", "Name", "Party", "District/County", "Ballot Order"]);
		return rows.map((row) => {
			const withdrawn = row.Name!.match(/\s*\(Withdrawn \d{1,2}\/\d{1,2}\/2026(?: 12:00:00 AM)?\)$/u);
			if (/\(withdrawn/iu.test(row.Name!) && !withdrawn) throw new Error("The official withdrawal marker has changed.");
			const district = row["District/County"]!.match(/^District (\d+[A-Z]?)$/u)?.[1];
			const record = requiredRecord(source, { name: withdrawn ? row.Name!.slice(0, withdrawn.index) : row.Name!, office: row.Contest!, party: row.Party!, district, jurisdiction: row["District/County"], status: withdrawn ? "withdrawn" : "listed", scope: ["Commissioner of School and Public Lands", "Public Utilities Commissioner"].includes(row.Contest!) ? "statewide" : undefined }, factory);
			if (!withdrawn && record.scope === "local" && !row["Ballot Order"]) {
				record.sourceStatus = "No ballot order published";
			}
			else if (withdrawn) {
				record.sourceStatus = withdrawn[0].trim();
			}
			return record;
		});
	}
	throw new Error("No additional state parser is configured for this source.");
}
