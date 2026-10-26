import type { StateCandidateValues } from "./state-ballot-additional-records.js";
import type { StateCandidateRecord } from "./state-ballot-records.js";
import type { StateBallotSource } from "./state-ballot-sources.js";
import { Buffer } from "node:buffer";
import { containsControlCharacters } from "./text-validation.js";

type Factory = (source: StateBallotSource, values: StateCandidateValues) => StateCandidateRecord | null;
const clean = (value: string) => value.normalize("NFKC").replace(/\s+/gu, " ").trim();
const offices = ["Senator in Congress", "Governor and Lieutenant Governor", "Attorney General", "Secretary of State", "Treasurer", "Auditor", "Representative in Congress", "Councillor", "Senator in General Court", "Representative in General Court", "District Attorney", "Register of Probate"];
const parties = ["Democratic", "Republican", "Independent", "Socialism and Liberation", "Libertarian", "Unenrolled", "Justice for All"];
const ordinals = ["First", "Second", "Third", "Fourth", "Fifth", "Sixth", "Seventh", "Eighth", "Ninth", "Tenth"];

function geography(office: string, district: string): Pick<StateCandidateValues, "scope" | "district" | "jurisdiction" | "sourceDistrictLabel"> {
	if (offices.indexOf(office) < 6) {
		if (district) throw new Error("The Cambridge statewide office has a district label.");
		return { scope: "statewide", district: "" };
	}
	if (!district || district.length > 100) throw new Error("The Cambridge district label requires review.");
	if (office === "Representative in Congress") {
		const ordinal = /^(\w+) District$/u.exec(district);
		const number = ordinal ? ordinals.indexOf(ordinal[1]!) + 1 : 0;
		if (!number) throw new Error("The Cambridge congressional district requires review.");
		return { scope: "congressional", district: String(number), sourceDistrictLabel: district };
	}
	if (["Senator in General Court", "Representative in General Court"].includes(office)) {
		if (!/^[\p{L} &-]+ District$/u.test(district)) throw new Error("The Cambridge legislative district requires review.");
		return { scope: office === "Senator in General Court" ? "state-senate" : "state-house", district: district.replace(/ District$/u, "").toUpperCase(), sourceDistrictLabel: district };
	}
	if (!/^[\p{L} &-]+ (?:District|County)$/u.test(district)) throw new Error("The Cambridge regional office requires review.");
	return { scope: "local", district: "", jurisdiction: `Massachusetts, ${district}`, sourceDistrictLabel: district };
}

export function readCambridgeCandidateDocument(source: StateBallotSource, body: string, factory: Factory) {
	if (Buffer.byteLength(body) > 2 * 1024 * 1024 || containsControlCharacters(body.replace(/[\r\n\t\f]/gu, ""))) throw new Error("The Cambridge PDF text exceeds its bounds.");
	const date = new Date(`${source.electionDate}T00:00:00Z`);
	const heading = `${new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).format(date)} State Election`;
	const pages = body.split("\f");
	if (!pages.at(-1)?.trim()) pages.pop();
	if (!pages.length || pages.length > 30) throw new Error("The Cambridge PDF page count requires review.");
	const records: StateCandidateRecord[] = [];
	let office = "";
	let district = "";
	let questions = false;
	let previousOffice = -1;
	let rowsInOffice = 0;
	const seen = new Set<string>();
	const claims: { recordId: string; page: number }[] = [];
	for (const [pageIndex, page] of pages.entries()) {
		const lines = page.split(/\r?\n/u).filter(line => line.trim());
		if (clean(lines.shift() ?? "") !== heading || clean(lines.shift() ?? "") !== "Candidates in Cambridge Districts") throw new Error("The Cambridge PDF election heading or page sequence requires review.");
		if (!lines.length) throw new Error("The Cambridge publication has an empty page.");
		for (const line of lines) {
			const value = clean(line);
			if (value === "Ballot Questions") {
				if (questions || !records.length || (office && !rowsInOffice)) throw new Error("The Cambridge question section requires review.");
				questions = true;
				continue;
			}
			if (questions) continue;
			if (offices.includes(value)) {
				const position = offices.indexOf(value);
				if (position <= previousOffice || (office && !rowsInOffice)) throw new Error("The Cambridge office order or empty office requires review.");
				office = value;
				district = "";
				previousOffice = position;
				rowsInOffice = 0;
				continue;
			}
			if (!office) throw new Error("The Cambridge candidate is missing its office heading.");
			if (!line.startsWith(" ") && /^[\p{L} &-]+ (?:District|County)$/u.test(value)) {
				if (district && !rowsInOffice) throw new Error("The Cambridge district has no candidates.");
				district = value;
				geography(office, district);
				rowsInOffice = 0;
				continue;
			}
			const columns = value.split(",").map(clean);
			const party = columns.at(-1)!;
			const name = columns[0]!;
			const ticket = office === "Governor and Lieutenant Governor";
			if (!/^\s{3,}\S/u.test(line) || !parties.includes(party) || name.length < 4 || name.length > 180 || !/^[\p{L}\p{M} .,'’&-]+$/u.test(name) || (ticket ? columns.length !== 2 || !/ AND /u.test(name) : columns.length !== 4 || !/\d/u.test(columns[1]!) || !/^[\p{L} .'-]+$/u.test(columns[2]!))) throw new Error("The Cambridge candidate row or party label requires review.");
			const record = factory(source, { name, office, party, ...geography(office, district), status: "listed" });
			if (!record || seen.has(record.id)) throw new Error("The Cambridge candidate identity is invalid or duplicated.");
			record.sourceStatus = "Published general-election candidate";
			seen.add(record.id);
			records.push(record);
			claims.push({ recordId: record.id, page: pageIndex + 1 });
			rowsInOffice++;
		}
	}
	if (!records.length || records.length > 2000 || !rowsInOffice || !questions) throw new Error("The Cambridge publication is incomplete or exceeds its bounds.");
	return { records, claims, pageCount: pages.length };
}
