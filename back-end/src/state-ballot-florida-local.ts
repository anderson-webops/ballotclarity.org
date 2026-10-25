import type { StateCandidateValues } from "./state-ballot-additional-records.js";
import type { StateCandidateRecord } from "./state-ballot-records.js";
import type { StateBallotSource } from "./state-ballot-sources.js";
import { Buffer } from "node:buffer";
import { parse } from "csv-parse/sync";
import { StateBallotAwaitingRecordsError } from "./state-ballot-source-state.js";
import { buildFloridaCandidateForm, buildFloridaCountyForm, floridaSourceElectionId } from "./state-ballot-southern.js";

export { StateBallotAwaitingRecordsError } from "./state-ballot-source-state.js";

const columns = "AcctNum,VoterID,ElectionID,OfficeCode,OfficeDesc,Juris1num,Juris2num,StatusCode,StatusDesc,PartyCode,PartyDesc,NameLast,NameFirst,NameMiddle,SuppressAddress,Addr1,Addr2,City,State,Zip,County,Phone,TrsNameLast,TrsNameFirst,TrsNameMiddle,Email".split(",");
const statuses: Record<string, string> = { UNO: "Unopposed", DNQ: "Did Not Qualify", QUA: "Qualified", DEF: "Defeated", WIT: "Withdrew", DEC: "Deceased" };
const clean = (value: string) => value.normalize("NFKC").replace(/\s+/gu, " ").trim();
const numberLabel = (value: string) => value.replace(/^0+(?=\d)/u, "");

function table(body: string, headers: string[], maximum: number) {
	const rows = parse(body, { bom: true, delimiter: "\t", quote: false, skip_empty_lines: true, max_record_size: 100_000 }) as string[][];
	if (JSON.stringify(rows.shift()) !== JSON.stringify(headers) || rows.length > maximum || rows.some(row => row.length !== headers.length)) throw new Error("The Florida local export layout has changed.");
	return rows;
}

export function parseFloridaLocalCandidateRecords(source: StateBallotSource, body: string, makeRecord: (source: StateBallotSource, values: StateCandidateValues) => StateCandidateRecord | null) {
	if (source.format !== "florida-local-tsv" || Buffer.byteLength(body) > 12 * 1024 * 1024) throw new Error("The Florida local export identity or size is invalid.");
	const electionId = floridaSourceElectionId(source);
	const capture = JSON.parse(body);
	if (!capture || Object.keys(capture).sort().join(",") !== "countyCodes,page,records,schemaVersion,type" || capture.schemaVersion !== 1 || capture.type !== "florida-local-export" || [capture.page, capture.countyCodes, capture.records].some(value => typeof value !== "string")) throw new Error("The Florida local export capture is invalid.");
	buildFloridaCandidateForm(source, capture.page);
	buildFloridaCountyForm(capture.page);
	const counties = new Map<string, string>();
	const countyNames = new Set<string>();
	const countyRows = table(capture.countyCodes, ["CountyCode", "CountyName"], 67);
	if (countyRows.length !== 67) throw new Error("The Florida county-code list is incomplete.");
	for (const [code, name] of countyRows) {
		if (!code || !/^[A-Z]{3}$/u.test(code) || !name || name !== clean(name) || name.length > 80 || /[\p{Cc}\uFFFD]/u.test(name) || counties.has(code) || countyNames.has(name)) throw new Error("The Florida county-code list is ambiguous or invalid.");
		counties.set(code, name);
		countyNames.add(name);
	}
	const rows = table(capture.records, columns, 25_000);
	if (!rows.length) throw new StateBallotAwaitingRecordsError(source.id);
	const identifiers = new Set<string>();
	return rows.map((values) => {
		const row = Object.fromEntries(columns.map((column, index) => [column, values[index]!])) as Record<string, string>;
		const identifier = row.AcctNum!;
		const county = row.County!;
		const district = row.Juris1num!;
		const seat = row.Juris2num!;
		if (!/^[1-9]\d{0,14}$/u.test(identifier) || identifiers.has(identifier) || row.ElectionID !== electionId || !/^[A-Z]{3}$/u.test(row.OfficeCode!) || !/^[A-Z0-9-]{0,10}$/u.test(district) || !/^[A-Z0-9-]{0,10}$/u.test(seat) || (county && !counties.has(county))) throw new Error("The Florida local candidate identity, election or source geography is invalid.");
		identifiers.add(identifier);
		const statusCode = row.StatusCode!;
		const status = clean(row.StatusDesc!);
		if (!/^[A-Z]{3}$/u.test(statusCode) || !status || (statuses[statusCode] && statuses[statusCode] !== status)) throw new Error("The Florida local candidate status has changed.");
		const office = [row.OfficeDesc!, district ? `District ${numberLabel(district)}` : "", seat ? `Group/seat ${numberLabel(seat)}` : ""].filter(Boolean).join(" · ");
		const name = [row.NameFirst!, row.NameMiddle!, row.NameLast!].map(clean).filter(Boolean).join(" ");
		if ([name, office, row.PartyDesc!, status].some(value => /[\p{Cc}\uFFFD]/u.test(value)) || row.OfficeDesc!.length > 200 || !row.OfficeDesc!.trim() || row.PartyDesc!.length > 100 || status.length > 150) throw new Error("The Florida local candidate facts are invalid.");
		const record = makeRecord(source, { name, office, party: row.PartyDesc! || row.PartyCode!, status: statuses[statusCode] ? status : "Unrecognized source status", scope: "local", district, sourceCandidateId: identifier, sourceAreaLabel: county ? `${counties.get(county)} County` : undefined });
		if (!record) throw new Error("The Florida local candidate row is incomplete.");
		if (!statuses[statusCode]) record.sourceStatus = `${statusCode}: ${status}`;
		return record;
	});
}
