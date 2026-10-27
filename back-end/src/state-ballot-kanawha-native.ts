import type { StateContestScope } from "./state-ballot-records.js";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { extractStateBallotPdfText, inspectStateBallotPdfObjects, resolveStateBallotPdfExtractor, resolveStateBallotPdfObjectInspector } from "./state-ballot-pdf.js";
import { containsControlCharacters } from "./text-validation.js";

const parties: Readonly<Record<string, string>> = { REP: "Republican", DEM: "Democratic", CST: "Constitution", IND: "Independent" };
interface Position { page: number; line: number }
export interface KanawhaCandidateClaim {
	name: string;
	office: string;
	party?: string;
	sourcePartyCode?: string;
	scope: StateContestScope;
	district: string;
	jurisdiction: string;
	sourceHeading: string;
	sourceDivision?: string;
	ballotDesignation?: string;
	voteLimit: number;
	occurrences: Position[];
}
interface Office { office: string; scope: StateContestScope; district: string; jurisdiction: string; partyRequired: boolean; sourceDivision?: string; ballotDesignation?: string }
function reject(): never {
	throw new Error("The Kanawha County pre-election test report requires review.");
}
function title(value: string) {
	return value.toLowerCase().replace(/\b[a-z]/gu, letter => letter.toUpperCase());
}
function office(heading: string): Office | null {
	if (/^AMENDMENT NO\. [1-9]\d?$|^(?:BOE|LIBRARY) LEVY$|^SPECIAL LEVY CITY OF [A-Z ]+$/u.test(heading)) return null;
	const base = { district: "", jurisdiction: "Kanawha County", partyRequired: true };
	if (heading === "FOR U.S. SENATOR") return { ...base, office: "U.S. Senate", scope: "statewide", jurisdiction: "West Virginia" };
	const house = /^FOR U\.S\. HOUSE OF REPRESENTATIVES ([1-9]\d?)(?:ST|ND|RD|TH) DIST$/u.exec(heading);
	if (house) return { ...base, office: `U.S. House District ${house[1]}`, scope: "congressional", district: house[1]!, jurisdiction: "West Virginia" };
	const senate = /^FOR STATE SENATOR (UNEXPIRED )?([1-9]\d?)(?:ST|ND|RD|TH) DISTRICT$/u.exec(heading);
	if (senate) return { ...base, office: `State Senate District ${senate[2]}${senate[1] ? " (Unexpired term)" : ""}`, scope: "state-senate", district: senate[2]!, jurisdiction: "West Virginia", ...(senate[1] ? { ballotDesignation: "Unexpired term" } : {}) };
	const delegates = /^FOR MEMBER OF HOUSE OF DELEGATES ([1-9]\d{0,2})(?:ST|ND|RD|TH) DISTRICT$/u.exec(heading);
	if (delegates) return { ...base, office: `House of Delegates District ${delegates[1]}`, scope: "state-house", district: delegates[1]!, jurisdiction: "West Virginia" };
	const magistrate = /^FOR MAGISTRATE DIV ([1-9]\d?) UNEXP$/u.exec(heading);
	if (magistrate) return { ...base, office: `Magistrate, Division ${magistrate[1]} (Unexpired term)`, scope: "local", partyRequired: false, sourceDivision: magistrate[1]!, ballotDesignation: "Unexpired term" };
	if (heading === "FOR COUNTY COMMISSIONER") return { ...base, office: "County Commissioner", scope: "local" };
	const municipal = /^FOR ((?:CITY )?COUNCIL WARD [1-9]\d?|(?:CITY )?COUNCIL AT LARGE|MAYOR|RECORDER|CLERK|TREASURER|MUNICIPAL JUDGE) (TOWN|CITY) OF ([A-Z][A-Z .'-]{1,50})$/u.exec(heading);
	if (!municipal) throw new Error(`The Kanawha County office heading requires review: ${heading.slice(0, 150)}`);
	const label = municipal[1]!.replace(" AT LARGE", ", At-large").replace(/ WARD ([1-9]\d?)/u, ", Ward $1");
	return { ...base, office: title(label).replace("At-Large", "At-large"), scope: "local", jurisdiction: `${title(municipal[2]!)} of ${title(municipal[3]!)}`, partyRequired: municipal[3] !== "CHESAPEAKE" };
}
function calendarDate(month: string, day: string, year: string) {
	const date = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
	if (!/^20\d{2}-\d{2}-\d{2}$/u.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date) return reject();
	return date;
}
export function readKanawhaTestText(body: string, sourceSha256: string) {
	if (Buffer.byteLength(body) > 4 * 1024 * 1024 || containsControlCharacters(body.replace(/[\r\n\t\f]/gu, "")) || body.includes("\uFFFD") || !/^[a-f0-9]{64}$/u.test(sourceSha256)) return reject();
	const pages = body.split("\f").filter(page => page.trim());
	if (!pages.length || pages.length > 50) return reject();
	const candidates = new Map<string, KanawhaCandidateClaim>();
	const contests: { heading: string; voteLimit: number; page: number; candidateOccurrences: number; placeholderRows: number }[] = [];
	const questions: { heading: string; voteLimit: number; choices: string[]; page: number; completeBallotText: false }[] = [];
	const dates = new Set<string>();
	const clocks = new Set<string>();
	const headings = new Set<string>();
	let totalOccurrences = 0;
	for (const [pageIndex, page] of pages.entries()) {
		const lines = page.split(/\r?\n/u).map((line, index) => ({ raw: line.trim(), text: line.trim().replace(/\s+/gu, " "), line: index + 1 })).filter(item => item.text);
		if (lines[0]?.text !== "Summary Results Report UNOFFICIAL RESULTS" || lines[1]?.text !== "General Election") return reject();
		const date = /^November ([1-9]\d?), (20\d{2}) Kanawha County, WV$/u.exec(lines[2]?.text ?? "");
		if (!date) return reject();
		const electionDate = calendarDate("11", date[1]!, date[2]!);
		if (electionDate < "2026-11-03" || !/^20\d{2}-11-0[2-8]$/u.test(electionDate) || new Date(electionDate).getUTCDay() !== 2) return reject();
		dates.add(electionDate);
		const footer = /^Election Summary - (\d{2})\/(\d{2})\/(20\d{2}) (\d{2}):(\d{2})(AM|PM) Page ([1-9]\d?) of ([1-9]\d?)$/u.exec(lines.at(-1)?.text ?? "");
		if (!footer || Number(footer[7]) !== pageIndex + 1 || Number(footer[8]) !== pages.length || Number(footer[4]) < 1 || Number(footer[4]) > 12 || Number(footer[5]) > 59) return reject();
		const publishedDate = calendarDate(footer[1]!, footer[2]!, footer[3]!);
		if (footer[3] !== date[2] || publishedDate > electionDate) return reject();
		const hour = Number(footer[4]) % 12 + (footer[6] === "PM" ? 12 : 0);
		clocks.add(`${publishedDate}T${String(hour).padStart(2, "0")}:${footer[5]}`);
		let offset = 3;
		if (pageIndex === 0) {
			const statistics = lines.slice(offset, offset + 8).map(item => item.text);
			if (statistics[0] !== "TOTAL" || statistics[1] !== "Statistics" || !/^Election Day Precincts Reporting 0 of [1-9]\d{0,4}$/u.test(statistics[2] ?? "") || !/^Absentee\/ Early Precincts Reporting 0 of [1-9]\d{0,4}$/u.test(statistics[3] ?? "") || statistics[2]!.split(" of ")[1] !== statistics[3]!.split(" of ")[1] || !/^Registered Voters - Total [\d,]+$/u.test(statistics[4] ?? "") || statistics[5] !== "Ballots Cast - Total 0" || statistics[6] !== "Ballots Cast - Blank 0" || statistics[7] !== "Voter Turnout - Total 0.00%") return reject();
			offset += 8;
		}
		while (offset < lines.length - 1) {
			const heading = lines[offset++]!.text;
			if (headings.has(heading)) return reject();
			headings.add(heading);
			const context = office(heading);
			const limit = /^Vote For ([1-9]\d?)$/u.exec(lines[offset++]?.text ?? "");
			if (!limit || Number(limit[1]) > 20 || lines[offset++]?.text !== "TOTAL VOTE %") return reject();
			const voteLimit = Number(limit[1]);
			let ended = false;
			let placeholders = 0;
			let writeIns = 0;
			let occurrences = 0;
			const choices: string[] = [];
			while (offset < lines.length - 1) {
				const line = lines[offset++]!;
				const column = line.raw.lastIndexOf("  ");
				if (column < 0 || line.raw.slice(column).trim() !== "0") return reject();
				const label = line.raw.slice(0, column).trimEnd();
				if (!label) return reject();
				if (label === "Total Votes Cast") {
					ended = true;
					break;
				}
				if (label === "NO CANDIDATE(S) NOMINATED") {
					if (!context) return reject();
					placeholders++;
					continue;
				}
				if (label === "Write-In Totals") {
					if (!context || ++writeIns > 1) return reject();
					continue;
				}
				if (writeIns) return reject();
				if (!context) {
					if (!/^(?:FOR|AGAINST|For the Levies|Against the Levies|FOR THE LEVIES|AGAINST THE LEVIES)$/u.test(label) || choices.includes(label)) return reject();
					choices.push(label);
					continue;
				}
				const party = /^(REP|DEM|CST|IND) (.+)$/u.exec(label);
				const name = party?.[2] ?? label;
				if ((!party && context.partyRequired) || name.length > 250 || !/^[A-Z][A-Z0-9 .,'"()-]*[A-Z.)]$/u.test(name)) return reject();
				const key = JSON.stringify([heading, party?.[1] ?? "", name]);
				const position = { page: pageIndex + 1, line: line.line };
				const duplicate = candidates.get(key);
				if (duplicate) return reject();
				const { partyRequired: _partyRequired, ...fields } = context;
				candidates.set(key, { ...fields, name, ...(party ? { sourcePartyCode: party[1]!, party: parties[party[1]!]! } : {}), sourceHeading: heading, voteLimit, occurrences: [position] });
				occurrences++;
				totalOccurrences++;
			}
			if (!ended || (context ? writeIns !== 1 || occurrences + placeholders === 0 : voteLimit !== 1 || ![["FOR", "AGAINST"], ["For the Levies", "Against the Levies"], ["FOR THE LEVIES", "AGAINST THE LEVIES"]].some(pair => JSON.stringify(pair) === JSON.stringify(choices)))) return reject();
			if (context) contests.push({ heading, voteLimit, page: pageIndex + 1, candidateOccurrences: occurrences, placeholderRows: placeholders });
			else questions.push({ heading, voteLimit, choices, page: pageIndex + 1, completeBallotText: false });
		}
	}
	if (dates.size !== 1 || clocks.size !== 1 || !contests.length || candidates.size > 1000 || contests.length > 300 || questions.length > 50) return reject();
	const publicationClock = [...clocks][0]!;
	return { electionDate: [...dates][0]!, sourceAsOfDate: publicationClock.slice(0, 10), publicationClock, publicationClockPrecision: "minute" as const, sourceSha256, pages: pages.length, candidates: [...candidates.values()], candidateOccurrences: totalOccurrences, contests, questions };
}
export function validateKanawhaPdfStructure(body: string) {
	if (Buffer.byteLength(body) > 4 * 1024 * 1024) return reject();
	const document = JSON.parse(body);
	if (!document || !Array.isArray(document.qpdf) || document.qpdf.length !== 2 || document.qpdf[0]?.jsonversion !== 2 || !document.qpdf[1] || typeof document.qpdf[1] !== "object" || !Array.isArray(document.pages) || !document.pages.length || document.pages.length > 20 || document.encrypt?.encrypted !== false || document.acroform?.needappearances !== false || !Array.isArray(document.acroform.fields) || document.acroform.fields.length || !document.attachments || Object.keys(document.attachments).length) return reject();
	const objects = document.qpdf[1] as Record<string, { value?: Record<string, unknown> }>;
	if (Object.keys(objects).length > 2000) return reject();
	const forbidden = new Set(["/A", "/AA", "/OpenAction", "/JavaScript", "/JS", "/Launch", "/EmbeddedFile", "/OCProperties", "/SMask", "/ExtGState", "/XObject", "/ToUnicode"]);
	const pending: { value: unknown; depth: number }[] = [{ value: objects, depth: 0 }];
	let visited = 0;
	while (pending.length) {
		const item = pending.pop()!;
		if (++visited > 20000 || item.depth > 32) return reject();
		if (!item.value || typeof item.value !== "object") continue;
		for (const [key, value] of Object.entries(item.value)) {
			if (forbidden.has(key)) return reject();
			if (value && typeof value === "object") pending.push({ value, depth: item.depth + 1 });
		}
	}
	const fonts = Object.entries(objects).filter(([, item]) => item.value?.["/Type"] === "/Font");
	if (fonts.length !== 1 || JSON.stringify(Object.entries(fonts[0]![1].value!).sort()) !== JSON.stringify(Object.entries({ "/BaseFont": "/Helvetica", "/Encoding": "/WinAnsiEncoding", "/Subtype": "/Type1", "/Type": "/Font" }).sort())) return reject();
	const fontReference = fonts[0]![0].replace(/^obj:/u, "");
	for (const page of document.pages) {
		const value = objects[`obj:${page.object}`]?.value;
		if (!value || value["/Type"] !== "/Page" || JSON.stringify(value["/MediaBox"]) !== "[0,0,612,792]" || value["/Rotate"] !== undefined || value["/CropBox"] !== undefined || value["/Annots"] !== undefined) return reject();
		const resources = value["/Resources"] as Record<string, unknown> | undefined;
		if (!resources || JSON.stringify(resources["/Font"]) !== JSON.stringify({ "/F1": fontReference })) return reject();
	}
	return { pages: document.pages.length, font: "Helvetica", encoding: "WinAnsiEncoding" };
}
export async function readKanawhaTestDocument(bytes: Buffer, options: { textExecutable?: string; objectExecutable?: string } = {}) {
	const sourceSha256 = createHash("sha256").update(bytes).digest("hex");
	const structure = validateKanawhaPdfStructure(await inspectStateBallotPdfObjects(bytes, await resolveStateBallotPdfObjectInspector(options.objectExecutable)));
	const report = readKanawhaTestText(await extractStateBallotPdfText(bytes, await resolveStateBallotPdfExtractor(options.textExecutable)), sourceSha256);
	if (report.pages !== structure.pages) return reject();
	return report;
}
