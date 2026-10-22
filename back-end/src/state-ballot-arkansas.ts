import type { StateCandidateValues } from "./state-ballot-additional-records.js";
import type { StateHtmlNode } from "./state-ballot-html.js";
import type { StateCandidateRecord, StateContestScope } from "./state-ballot-records.js";
import type { StateBallotSource } from "./state-ballot-sources.js";
import { Buffer } from "node:buffer";
import { parseStateHtml, stateHtmlAttribute, stateHtmlDescendants, stateHtmlTableRows, stateHtmlText } from "./state-ballot-html.js";

type RecordFactory = (source: StateBallotSource, values: StateCandidateValues) => StateCandidateRecord | null;

const headers = [
	["Offices Up for Election", "District", "Candidate Name", "Party", "Filing Date", "filing Number", "Ballot order", "Email", "Address", "City", "Zip"],
	["City", "Office", "Candidate Name", "Filing Date", "Time", "Ballot Order", "Email", "Address", "City", "Zip"],
	["Offices Up For Election", "Candidate Name", "Filing Date", "Filing Order", "Ballot Order", "Email", "Address", "City", "Zip"],
	["School District", "School Board Office", "Candidate Name", "filing date", "Ballot Order", "Email", "address", "city", "zip"],
];
const statewideOffices = ["Governor", "Lieutenant Governor", "Attorney General", "Secretary of State", "State Treasurer", "Auditor of State", "Commissioner of State Lands"];
const countyOffices = ["County Judge", "County Sheriff", "County Assessor", "Circuit Clerk", "County Clerk", "County Collector", "County Treasurer", "County Coroner", "Justice of the Peace", "Constable"];
const electLabels: Record<string, string> = {
	"U.S. Senate": "Senator-Elect",
	"Attorney General": "Attorney General-Elect",
	"State Treasurer": "State Treasurer-Elect",
	"Auditor of State": "Auditor-Elect",
	"State Senate": "Senator-Elect",
	"State House": "Representative-Elect",
	"County Sheriff": "Sheriff-Elect",
	"Circuit Clerk": "Circuit Clerk-Elect",
	"County Clerk": "County Clerk-Elect",
	"County Coroner": "Coroner-Elect",
	"Justice of the Peace": "JP-Elect",
	"Constable": "Constable-Elect",
};

function clean(value: string) {
	return value.normalize("NFKC").replace(/\s+/gu, " ").trim();
}

function cells(row: StateHtmlNode) {
	return (row.childNodes ?? []).filter(node => ["td", "th"].includes(node.nodeName));
}

function positiveNumber(value: string) {
	if (!/^[1-9]\d{0,2}$/u.test(value)) throw new Error("The Arkansas district or ballot order has changed.");
	return value;
}

function officeKey(value: string) {
	return value.replace(/\bPos\.\s*/gu, "Pos. ").replace(/\bCouncill\b/gu, "Council");
}

export function parseArkansasCandidateRecords(source: StateBallotSource, body: string, factory: RecordFactory): StateCandidateRecord[] {
	if (source.stateCode !== "AR" || Buffer.byteLength(body) > 12 * 1024 * 1024 || !/^\d{4}-\d{2}-\d{2}$/u.test(source.electionDate) || !Number.isFinite(Date.parse(source.electionDate)) || new Date(source.electionDate).toISOString().slice(0, 10) !== source.electionDate)
		throw new Error("The Arkansas public source configuration is invalid.");
	const document = parseStateHtml(body);
	const headings = stateHtmlDescendants(document, node => /^h[1-6]$/u.test(node.nodeName)).map(node => clean(stateHtmlText(node)));
	const date = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(source.electionDate));
	if (!headings.includes(`Elections to be held on ${date}`) || !headings.includes("General Election, Nonpartisan Judicial General Run-Off and Annual School Run-Off Information") || !headings.includes("Municipal General Election") || !headings.includes("Nonpartisan Judicial General Election Run Off"))
		throw new Error("The Arkansas page does not identify the configured general election and runoff stages.");
	const visible = clean(stateHtmlText(document));
	const notices = [
		"Office-Elect is for Candidates who are Unopposed in the General Election",
		"Unopposed Candidates for State Offices will appear on the General Election Ballot",
		"The Unopposed Candidate for Circuit Clerk will appear on the General Election Ballot",
		"Unopposed Candidates for all other County Offices will not appear on the General Election Ballot",
		"Candidate Information is unofficial until the names are certified to the Election Commission by the Secretary of State's Office and County Clerk's Office.",
		"All Names are Unofficial",
		"Unopposed Candidates for Mayor will appear on the Ballot",
		"Unopposed Candidates for City Attorney, City Clerk and City Council Members will not appear on the Ballot",
		"Annual School Election Run-Off",
	];
	const deadline = /Certification Deadline is ([A-Za-z]+ \d{1,2}, (\d{4}))/u.exec(visible);
	if (notices.some(notice => !visible.includes(notice)) || deadline?.[2] !== source.electionDate.slice(0, 4) || !Number.isFinite(Date.parse(deadline[1]!)) || Date.parse(deadline[1]!) > Date.parse(source.electionDate))
		throw new Error("The Arkansas unofficial, unopposed or ballot-appearance notices have changed.");
	const tables = stateHtmlDescendants(document, node => node.nodeName === "table").filter(table => stateHtmlTableRows(table).some(row => cells(row).some(cell => clean(stateHtmlText(cell)) === "Candidate Name")));
	if (tables.length !== 4 || stateHtmlDescendants(document, node => ["a", "link"].includes(node.nodeName) && /\b(?:next|prev)\b/u.test(stateHtmlAttribute(node, "rel"))).length) throw new Error("The Arkansas candidate table set or pagination has changed.");
	const records: StateCandidateRecord[] = [];
	const orders = new Map<string, number[]>();
	const identities = new Set<string>();
	for (const [tableIndex, table] of tables.entries()) {
		const rows = stateHtmlTableRows(table);
		if (cells(rows[0]!).map(cell => clean(stateHtmlText(cell))).join("|") !== headers[tableIndex]!.join("|") || stateHtmlDescendants(table, node => ["input", "button", "select"].includes(node.nodeName) || Boolean(stateHtmlAttribute(node, "rowspan") || stateHtmlAttribute(node, "colspan"))).length)
			throw new Error("The Arkansas candidate columns or table controls have changed.");
		let section = "";
		let office = "";
		let district = "";
		let jurisdiction = "";
		const populatedSections = new Set<string>();
		const before = records.length;
		for (const row of rows.slice(1)) {
			const values = cells(row).map(cell => clean(stateHtmlText(cell)));
			if (values.length !== headers[tableIndex]!.length) throw new Error("The Arkansas candidate row layout has changed.");
			if (values.every(value => !value)) continue;
			if (tableIndex === 0 && ["Federal", "State", "County"].includes(values[0]!) && values.slice(1).every(value => !value)) {
				if (["Federal", "State", "County"].indexOf(values[0]!) !== ["", "Federal", "State"].indexOf(section)) throw new Error("The Arkansas candidate section order has changed.");
				section = values[0]!;
				office = "";
				district = "";
				continue;
			}
			let scope: StateContestScope = "local";
			let name: string;
			let party = "";
			let stage: string;
			let order: string;
			let appearance = "";
			let sourceCandidateId: string | undefined;
			let sourceDivision: string | undefined;
			if (tableIndex === 0) {
				if (values[0]) {
					office = values[0];
					district = values[1]!;
				}
				else if (values[1]) {
					district = values[1];
				}
				name = values[2]!;
				party = values[3]!;
				order = values[6]!;
				stage = "General Election";
				if (!["Democratic", "Republican", "Libertarian", "Independent"].includes(party)) throw new Error("The Arkansas printed party labels have changed.");
				if (section === "Federal" && office === "U.S. Senate") scope = "statewide";
				else if (section === "Federal" && office === "U.S. Congress (House of Representatives)") scope = "congressional";
				else if (section === "State" && statewideOffices.includes(office)) scope = "statewide";
				else if (section === "State" && ["State Senate", "State House"].includes(office)) scope = office === "State Senate" ? "state-senate" : "state-house";
				else if (section !== "County" || !countyOffices.includes(office)) throw new Error("The Arkansas candidate office or section has changed.");
				if (scope === "statewide" || (scope === "local" && !["Justice of the Peace", "Constable"].includes(office))) {
					if (district) throw new Error("The Arkansas statewide or countywide office has an unexpected district.");
				}
				else {
					positiveNumber(district);
				}
				jurisdiction = scope === "local" ? "Washington County" : "";
				if (section !== "County") {
					if (!/^\d{6}$/u.test(values[5]!)) throw new Error("The Arkansas public filing identifier has changed.");
					sourceCandidateId = values[5];
				}
				populatedSections.add(section);
				if (!/^[1-9]\d{0,2}$/u.test(order)) {
					if ((electLabels[office] ?? `${office}-Elect`) !== order) throw new Error("The Arkansas unopposed office label has changed.");
					appearance = section === "State" || office === "Circuit Clerk" ? "Printed on ballot" : section === "County" ? "Not printed on ballot" : "Ballot appearance not specified";
				}
			}
			else if (tableIndex === 1) {
				jurisdiction = values[0]!;
				office = values[1]!;
				name = values[2]!;
				order = values[5]!;
				district = "";
				stage = "Municipal General Election";
				if (!jurisdiction) throw new Error("The Arkansas municipal jurisdiction is missing.");
				if (order === "Unopposed") appearance = /^(?:City )?Mayor$/u.test(office) ? "Printed on ballot" : /^(?:City )?(?:Attorney|Clerk(?:\/Treasurer)?|Councill? Member\b)/u.test(office) ? "Not printed on ballot" : "Ballot appearance not specified";
				else positiveNumber(order);
			}
			else if (tableIndex === 2) {
				if (values[0]) office = values[0];
				const match = /^Circuit Judge, District ([1-9]\d*), Division ([1-9]\d*)$/u.exec(office);
				if (!match) throw new Error("The Arkansas judicial runoff office has changed.");
				name = values[1]!;
				district = match[1]!;
				sourceDivision = match[2];
				jurisdiction = `Judicial District ${district}`;
				stage = "Nonpartisan Judicial General Election Run Off";
				order = positiveNumber(values[4]!);
				if (!/^\d{6}$/u.test(values[3]!)) throw new Error("The Arkansas judicial filing identifier has changed.");
				sourceCandidateId = values[3];
			}
			else {
				if (values[0]) {
					jurisdiction = values[0];
					office = values[1]!;
				}
				else if (values[1]) {
					office = values[1];
				}
				if (!jurisdiction || !/^Zone [1-9]\d*$/u.test(office)) throw new Error("The Arkansas school runoff district or zone has changed.");
				name = values[2]!;
				district = office.slice(5);
				stage = "Annual School Election Run-Off";
				order = positiveNumber(values[4]!);
			}
			if (!name || !office || /^(?:vacant|none|no candidate|write.?in|tba)\b/iu.test(name) || /\b(?:withdrawn|withdrew|disqualified|deceased|cancelled)\b/iu.test(name)) throw new Error("The Arkansas public table contains an unnamed candidate or unreviewed status.");
			const unopposed = Boolean(appearance);
			const identity = JSON.stringify([officeKey(office), district, jurisdiction, name, party]);
			if (identities.has(identity)) throw new Error("The Arkansas table contains duplicate candidate identities.");
			identities.add(identity);
			const key = JSON.stringify([officeKey(office), district, jurisdiction]);
			const ballotOrders = orders.get(key) ?? [];
			if (unopposed ? orders.has(key) : ballotOrders.includes(Number(order))) throw new Error("The Arkansas candidate ballot order is duplicated or contradictory.");
			ballotOrders.push(unopposed ? 0 : Number(order));
			if (!unopposed && ballotOrders.includes(0)) throw new Error("The Arkansas unopposed office has multiple candidates.");
			orders.set(key, ballotOrders);
			const record = factory(source, { name, office: tableIndex === 3 ? `School Board ${office}` : office, party, scope, district, jurisdiction, status: "listed", sourceCandidateId, sourceDivision, sourceDistrictLabel: tableIndex === 1 ? office : district ? tableIndex === 3 ? office : `District ${district}` : undefined, sourceAreaLabel: scope === "statewide" ? "Arkansas" : "Washington County list" });
			if (!record) throw new Error("The Arkansas public candidate record is incomplete.");
			record.sourceStatus = [tableIndex < 2 ? "Unofficial" : "Listed", unopposed ? "Unopposed" : "", appearance].filter(Boolean).join("; ");
			record.ballotDesignation = `${stage}; ${unopposed ? order : `Ballot order: ${order}`}`;
			records.push(record);
		}
		if (records.length === before || records.length > 25_000 || (tableIndex === 0 && (section !== "County" || populatedSections.size !== 3)) || (tableIndex > 1 && records.length - before < 2)) throw new Error("The Arkansas candidate table is empty, incomplete or too large.");
	}
	for (const values of orders.values()) {
		if (values.length && values[0] !== 0 && values.toSorted((first, second) => first - second).some((value, index) => value !== index + 1)) throw new Error("The Arkansas candidate ballot order is incomplete.");
	}
	if (new Set(records.map(record => record.id)).size !== records.length) throw new Error("The Arkansas candidate count does not reconcile.");
	return records;
}
