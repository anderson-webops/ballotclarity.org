import type { StateCandidateValues } from "./state-ballot-additional-records.js";
import type { StateBallotQuestion } from "./state-ballot-questions.js";
import type { StateCandidateRecord } from "./state-ballot-records.js";
import type { StateBallotSource } from "./state-ballot-sources.js";
import { createHash } from "node:crypto";
import { nycNativePages, nycNativeRows } from "./state-ballot-nyc-native.js";

type Factory = (source: StateBallotSource, values: StateCandidateValues) => StateCandidateRecord | null;
export const nycBoroughs = ["New York", "Bronx", "Kings", "Queens", "Richmond"] as const;
const officeRoots = ["Governor/Lieutenant Governor", "State Comptroller", "Attorney General", "Surrogate", "Justice of the Supreme Court", "Judge of the Civil Court - County", "Representative in Congress", "State Senator", "Member of the City Council", "Member of the Assembly", "Judge of the Civil Court - District"];
function reject(detail: string): never {
	throw new Error(`The NYC ${detail} requires review.`);
}
export function nycGeneralDate(value: string) {
	if (!/^20\d{2}-11-0[2-8]$/u.test(value) || new Date(`${value}T00:00:00Z`).getUTCDay() !== 2) return reject("general-election date");
	return value;
}
export function nycPublicationDate(value: string, electionDate: string) {
	const found = /^(\d{1,2})\/(\d{1,2})\/(20\d{2}) (\d{1,2}):[0-5]\d:[0-5]\d(?:AM|PM)$/u.exec(value);
	if (!found || Number(found[4]) < 1 || Number(found[4]) > 12) return reject("printed publication time");
	const date = `${found[3]}-${found[1]!.padStart(2, "0")}-${found[2]!.padStart(2, "0")}`;
	if (!Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date || date > electionDate) return reject("printed publication date");
	return date;
}
export function nycOfficeGeography(label: string): Pick<StateCandidateValues, "scope" | "district" | "jurisdiction"> {
	if (/^(?:Governor\/Lieutenant Governor|State Comptroller|Attorney General) - Citywide$/u.test(label)) return { scope: "statewide", district: "" };
	const district = /^(Representative in Congress|State Senator|Member of the Assembly) - ([1-9]\d{0,2})(?:st|nd|rd|th) (Congressional|Senatorial|Assembly) District$/u.exec(label);
	if (district) {
		if (["Congressional", "Senatorial", "Assembly"].indexOf(district[3]!) !== ["Representative in Congress", "State Senator", "Member of the Assembly"].indexOf(district[1]!)) return reject("district type");
		return { scope: district[1] === "Representative in Congress" ? "congressional" : district[1] === "State Senator" ? "state-senate" : "state-house", district: district[2] };
	}
	if (/^Member of the City Council - [1-9]\d?(?:st|nd|rd|th) Council District$/u.test(label)) return { scope: "local", district: "", jurisdiction: "New York City" };
	const judicial = /^Justice of the Supreme Court - ([1-9]\d?(?:st|nd|rd|th) Judicial District)$/u.exec(label);
	if (judicial) return { scope: "local", district: "", jurisdiction: judicial[1] };
	const county = /^(?:Surrogate|Judge of the Civil Court - County) - (New York|Bronx|Kings|Queens|Richmond)$/u.exec(label);
	if (county) return { scope: "local", district: "", jurisdiction: county[1] };
	const municipal = /^Judge of the Civil Court - District - ([1-9]\d?(?:st|nd|rd|th) Municipal Court District - (?:New York|Bronx|Kings|Queens|Richmond))$/u.exec(label);
	if (municipal) return { scope: "local", district: "", jurisdiction: municipal[1] };
	return reject("office vocabulary");
}
const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 24);
interface Line { borough: string; page: number; officeLabel: string; seats: number; name: string; partyLabel: string; row: number }
interface QuestionOccurrence { borough: string; page: number; number: number; title: string; text: string; choices: string[] }

export function readNycCandidateDocument(source: StateBallotSource, body: string, factory: Factory) {
	if (source.stateCode !== "NY") return reject("source identity");
	nycGeneralDate(source.electionDate);
	const year = source.electionDate.slice(0, 4);
	const electionLabel = `General Election ${year} - 11/${source.electionDate.slice(-2)}/${year}`;
	const pages = nycNativePages(body);
	const cover = pages[0]!;
	const printed = cover.find(field => field.text.startsWith("Printed On: "))?.text.slice("Printed On: ".length);
	if (!printed || cover.length !== 3 || cover.filter(field => field.text === "THE CONTEST LIST").length !== 1 || cover.filter(field => field.text === electionLabel).length !== 1 || cover.some(field => !field.bold)) return reject("cover identity");
	const asOfDate = nycPublicationDate(printed, source.electionDate);
	const lines: Line[] = [];
	const occurrences: QuestionOccurrence[] = [];
	const sections: { borough: string; firstPage: number; lastPage: number; printedPages: number; candidateLines: number; questions: number }[] = [];
	let section = -1;
	let number = 1;
	let total = 0;
	let declared = new Set<string>();
	let office: { label: string; seats: number; rows: number } | null = null;
	let question: QuestionOccurrence | null = null;
	const seenLines = new Set<string>();
	const seenOffices = new Set<string>();
	function finishOffice() {
		if (question || (office && !office.rows)) return reject("incomplete office or question");
		office = null;
	}
	for (const [index, fields] of pages.entries()) {
		if (!index) continue;
		const page = index + 1;
		const boroughFields = fields.filter(field => /^(?:New York|Bronx|Kings|Queens|Richmond) All Parties and Independent Bodies$/u.test(field.text));
		const footerFields = fields.filter(field => /^Page \d+ of \d+$/u.test(field.text) && field.top === 874);
		if (boroughFields.length !== 1 || footerFields.length !== 1) return reject("borough or printed page inventory");
		const borough = boroughFields[0]!.text.slice(0, -" All Parties and Independent Bodies".length);
		const footer = /^Page (\d+) of (\d+)$/u.exec(footerFields[0]!.text)!;
		if (borough !== nycBoroughs[section]) {
			finishOffice();
			if (section >= 0 && number !== total) return reject("truncated borough section");
			section++;
			if (borough !== nycBoroughs[section] || Number(footer[1]) !== (section ? 1 : 2)) return reject("borough sequence");
			number = section ? 0 : 1;
			total = Number(footer[2]);
			if (total < 2 || total > 60) return reject("printed section size");
			declared = new Set();
			sections.push({ borough, firstPage: page, lastPage: page, printedPages: total, candidateLines: 0, questions: 0 });
		}
		if (Number(footer[1]) !== ++number || Number(footer[2]) !== total || number > total) return reject("printed page sequence");
		sections[section]!.lastPage = page;
		const header = fields.filter(field => field.top < 125);
		const expected = ["THE CONTEST LIST", electionLabel, boroughFields[0]!.text, "TENTATIVE", "SUBJECT TO CHANGE", "BOARD OF ELECTIONS", "IN THE CITY OF NEW YORK", "PRINTED AS OF:", printed].sort();
		if (header.some(field => !field.bold) || JSON.stringify(header.map(field => field.text).sort()) !== JSON.stringify(expected)) return reject("page identity or tentative status");
		const columns = fields.filter(field => field.top >= 125 && field.top < 150);
		if (columns.length !== 3 || columns.map(field => `${field.left}:${field.text}:${field.bold}`).join("|") !== "26:Party\\Ind. Body:false|260:Name:false|575:Address:false") return reject("column identity");
		const content = fields.filter(field => field.top >= 150 && field.top < 850);
		if (!content.length || fields.length !== header.length + columns.length + content.length + 1) return reject("unaccounted page text");
		const intro = content.some(field => field.text === "All Parties and Independent Bodies");
		if (intro) {
			if (declared.size || office || number !== (section ? 1 : 2)) return reject("repeated section introduction");
			for (const field of content) {
				if (field.bold && ["All Parties and Independent Bodies", "Nominations for the following offices and positions:"].includes(field.text)) continue;
				if (field.bold || !officeRoots.includes(field.text) || declared.has(field.text)) return reject("declared office inventory");
				declared.add(field.text);
			}
			if (!declared.size || content.length !== declared.size + 2) return reject("incomplete office introduction");
			continue;
		}
		if (!declared.size) return reject("missing office introduction");
		for (const row of nycNativeRows(content)) {
			const first = row[0]!;
			const heading = row.length === 1 && first.left === 17 && first.bold ? /^(.+), # to be elected: ([1-9]\d?)$/u.exec(first.text) : null;
			if (heading) {
				finishOffice();
				const key = JSON.stringify([borough, heading[1]]);
				if (seenOffices.has(key)) return reject("repeated office");
				seenOffices.add(key);
				office = { label: heading[1]!, seats: Number(heading[2]), rows: 0 };
				const proposal = /^Proposal Number ([1-9]\d?), a Question: (.+) - Citywide$/u.exec(office.label);
				if (proposal) {
					if (office.seats !== 1) return reject("proposal selection count");
					question = { borough, page, number: Number(proposal[1]), title: proposal[2]!, text: "", choices: [] };
				}
				else {
					nycOfficeGeography(office.label);
					if (![...declared].some(root => office!.label.startsWith(`${root} - `))) return reject("undeclared office");
				}
				continue;
			}
			if (!office || row.some(field => field.bold)) return reject("unassigned content");
			if (question) {
				if (row.length === 1 && first.left === 14 && first.size === 13 && !question.choices.length) {
					question.text += (question.text ? " " : "") + first.text;
					if (question.text.length > 12000) return reject("proposal text bounds");
					continue;
				}
				if (row.length !== 1 || first.left !== 260 || first.size !== 11 || !question.text || first.text !== ["Yes", "No"][question.choices.length]) return reject("proposal choice sequence");
				question.choices.push(first.text);
				if (question.choices.length === 2) {
					occurrences.push(question);
					sections[section]!.questions++;
					office.rows++;
					question = null;
				}
				continue;
			}
			if (office.label.startsWith("Proposal Number ") || row.length < 2 || row.length > 3 || row[0]!.left !== 26 || row[1]!.left !== 260 || (row[2] && row[2].left !== 575) || row.some(field => field.size !== 11) || row[0]!.width > 225 || row[1]!.width > 310) return reject("candidate columns");
			const partyLabel = row[0]!.text;
			const name = row[1]!.text;
			if (partyLabel.length > 100 || !/\p{L}/u.test(partyLabel) || name.length > 250 || !/\p{L}/u.test(name) || /[<>\\]/u.test(partyLabel + name) || office.label.startsWith("Governor/Lieutenant Governor") !== name.includes(" / ")) return reject("candidate or printed ticket identity");
			const key = JSON.stringify([borough, office.label, partyLabel, name]);
			if (seenLines.has(key)) return reject("repeated candidate line");
			seenLines.add(key);
			lines.push({ borough, page, officeLabel: office.label, seats: office.seats, name, partyLabel, row: ++office.rows });
			sections[section]!.candidateLines++;
		}
	}
	finishOffice();
	if (section !== nycBoroughs.length - 1 || number !== total || sections.some(item => !item.candidateLines) || !lines.length) return reject("complete borough inventory");
	const groups = new Map<string, { line: Line; parties: string[]; lines: Line[] }>();
	for (const line of lines) {
		const key = JSON.stringify([line.officeLabel, line.name]);
		const group = groups.get(key) ?? { line, parties: [], lines: [] };
		if (group.line.seats !== line.seats) return reject("conflicting repeated seat counts");
		if (!group.parties.includes(line.partyLabel)) group.parties.push(line.partyLabel);
		group.lines.push(line);
		groups.set(key, group);
	}
	const claims: (Line & { recordId: string })[] = [];
	const records: StateCandidateRecord[] = [];
	for (const { line, parties, lines } of groups.values()) {
		const record = factory(source, { name: line.name, office: line.officeLabel, party: parties.join(" / "), status: "listed", ...nycOfficeGeography(line.officeLabel), seats: line.seats, sourceDistrictLabel: line.officeLabel });
		if (!record) return reject("candidate record");
		record.sourceStatus = "Tentative";
		records.push(record);
		claims.push(...lines.map(value => ({ ...value, recordId: record.id })));
	}
	const groupedQuestions = new Map<number, QuestionOccurrence[]>();
	for (const occurrence of occurrences) {
		const values = groupedQuestions.get(occurrence.number) ?? [];
		if (values.some(value => value.borough === occurrence.borough || value.title !== occurrence.title || value.text !== occurrence.text)) return reject("conflicting repeated proposal");
		values.push(occurrence);
		groupedQuestions.set(occurrence.number, values);
	}
	const questions: StateBallotQuestion[] = [...groupedQuestions].map(([number, values]) => {
		if (values.length !== nycBoroughs.length) return reject("incomplete citywide proposal inventory");
		const first = values[0]!;
		return { id: digest([source.id, source.electionDate, number, first.title, first.text]), audience: "New York City", title: `Proposal ${number}: ${first.title}`, officialText: first.text, choices: ["Yes", "No"], pages: values.map(value => value.page), explicitlyAdvisory: false, voterApplicabilityVerified: false };
	});
	if (new Set(records.map(record => record.id)).size !== records.length) return reject("unique candidate inventory");
	return { records, claims, questions, questionOccurrences: occurrences, sections, asOfDate, printedAt: printed, tentative: true as const, pages: pages.length };
}
