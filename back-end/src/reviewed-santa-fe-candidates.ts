import type { StateCandidateRecord } from "./state-ballot-records.js";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { stateHtmlAttribute as attribute, stateHtmlDescendants as descendants, parseStateHtml, stateHtmlText } from "./state-ballot-html.js";
import { containsControlCharacters } from "./text-validation.js";

interface Word { left: number; right: number; top: number; value: string }
interface Row { page: number; top: number; words: Word[] }
interface Block { rows: Row[]; page: number }
const clean = (value: string) => value.normalize("NFKC").replace(/\s+/gu, " ").trim();
const joined = (words: Word[]) => clean(words.map(word => word.value).join(" "));
const leftText = (row: Row) => joined(row.words.filter(word => word.left < 180));
const candidateText = (row: Row) => joined(row.words.filter(word => word.left >= 180 && word.left < 365));
const start = /^(?:UNITED STATES(?: SENATOR)?|GOVERNOR &|SECRETARY OF STATE|ATTORNEY GENERAL|STATE (?:AUDITOR|TREASURER|REPRESENTATIVE)|COMMISSIONER OF|JUDGE OF THE COURT OF|DISTRICT COURT JUDGE,|MAGISTRATE JUDGE,|COUNTY(?: SHEIRFF| SHERIFF| ASSESSOR)?|PROBATE JUDGE|JUDICIAL RETENTION,)$/u;

function wordPages(body: string) {
	if (Buffer.byteLength(body) > 4 * 1024 * 1024 || /<!ENTITY|<!DOCTYPE[^>]*\[/iu.test(body) || !body.trimEnd().endsWith("</html>") || [...body.matchAll(/<page\b/gu)].length !== [...body.matchAll(/<\/page>/gu)].length) throw new Error("The Santa Fe master text is incomplete or exceeds its bounds.");
	const pages = descendants(parseStateHtml(body), node => node.nodeName === "page");
	if (!pages.length || pages.length > 100) throw new Error("The Santa Fe master page count requires review.");
	return pages.map((page, index) => {
		if (Number(attribute(page, "width")) !== 612 || Number(attribute(page, "height")) !== 792) throw new Error("The Santa Fe master page dimensions changed.");
		const words = descendants(page, node => node.nodeName === "word").map((node) => {
			if (["xmin", "xmax", "ymin"].some(name => !/^\d+(?:\.\d+)?$/u.test(attribute(node, name)))) throw new Error("The Santa Fe master coordinates require review.");
			return { left: Number(attribute(node, "xmin")), right: Number(attribute(node, "xmax")), top: Number(attribute(node, "ymin")), value: stateHtmlText(node) };
		});
		if (!words.length || words.length > 15000 || words.some(word => word.left < 0 || word.right < word.left || word.right > 613 || word.top > 793 || containsControlCharacters(word.value))) throw new Error("The Santa Fe master word geometry requires review.");
		const rows: Row[] = [];
		for (const word of words.sort((first, second) => first.top - second.top || first.left - second.left)) {
			let row = rows.at(-1);
			if (!row || Math.abs(row.top - word.top) >= 1) rows.push(row = { page: index + 1, top: word.top, words: [] });
			row.words.push(word);
		}
		for (const row of rows) row.words.sort((first, second) => first.left - second.left);
		return rows;
	});
}

function officeFields(printed: string): Pick<StateCandidateRecord, "office" | "district" | "scope"> {
	const fixed: Record<string, string> = {
		"UNITED STATES SENATOR": "United States Senator",
		"GOVERNOR & LIEUTENANT GOVERNOR": "Governor & Lieutenant Governor",
		"SECRETARY OF STATE": "Secretary of State",
		"ATTORNEY GENERAL": "Attorney General",
		"STATE AUDITOR": "State Auditor",
		"STATE TREASURER": "State Treasurer",
		"COMMISSIONER OF PUBLIC LANDS": "Commissioner of Public Lands",
	};
	if (fixed[printed]) return { office: fixed[printed], district: "", scope: "statewide" };
	let match = /^(UNITED STATES|STATE) REPRESENTATIVE DISTRICT ([1-9]\d?)$/u.exec(printed);
	if (match) return { office: `${match[1] === "STATE" ? "State" : "United States"} Representative District ${match[2]}`, district: match[2]!, scope: match[1] === "STATE" ? "state-house" : "congressional" };
	match = /^JUDGE OF THE COURT OF APPEALS POSITION ([1-9]\d?)$/u.exec(printed);
	if (match) return { office: `Judge of the Court of Appeals Position ${match[1]}`, district: "", scope: "statewide" };
	match = /^DISTRICT COURT JUDGE, FIRST JUDICIAL DISTRICT, DIVISION (0?[1-9]\d?)$/u.exec(printed);
	if (match) return { office: `District Court Judge, First Judicial District, Division ${match[1]}`, district: String(Number(match[1])), scope: "local" };
	match = /^MAGISTRATE JUDGE, DIVISION ([1-9]\d?)$/u.exec(printed);
	if (match) return { office: `Magistrate Judge, Division ${match[1]}`, district: match[1]!, scope: "local" };
	match = /^COUNTY COMM?ISSIONER, DISTRICT ([1-9]\d?)$/u.exec(printed);
	if (match) return { office: `County Commissioner District ${match[1]}`, district: match[1]!, scope: "local" };
	const local: Record<string, string> = { "COUNTY SHEIRFF": "County Sheriff", "COUNTY SHERIFF": "County Sheriff", "COUNTY ASSESSOR": "County Assessor", "PROBATE JUDGE": "Probate Judge" };
	if (local[printed]) return { office: local[printed], district: "", scope: "local" };
	throw new Error("The Santa Fe master office requires review.");
}

function person(value: string) {
	if (!value || value.length > 250 || !/^[\p{Lu}\p{M} .,'’\-]+$/u.test(value) || /\b(?:YES|NO|FOR|AGAINST|WITHDRAWN|VACANT)\b/u.test(value)) throw new Error("The Santa Fe master candidate name requires review.");
	return value;
}

export function readReviewedSantaFeCandidates(body: string, electionDate: string) {
	if (!/^20\d{2}-11-0[2-8]$/u.test(electionDate) || new Date(`${electionDate}T00:00:00Z`).getUTCDay() !== 2) throw new Error("The Santa Fe general-election date requires review.");
	const pages = wordPages(body);
	const first = pages[0]!;
	const heading = joined(first.filter(row => row.top < 175).flatMap(row => row.words));
	const dates = [...heading.matchAll(/ELECTION DAY- Tuesday November ([1-9]\d?), (20\d{2})/gu)];
	if (!heading.includes(`SANTA FE COUNTY CLERK’S OFFICE ${electionDate.slice(0, 4)} GENERAL ELECTION MASTER BALLOT LIST`) || dates.length !== 1 || `${dates[0]![2]}-11-${dates[0]![1]!.padStart(2, "0")}` !== electionDate) throw new Error("The Santa Fe master printed publisher or election date changed.");
	const headers = first.filter(row => leftText(row) === "RACE");
	const style = first.find(row => joined(row.words) === "STYLE" && row.words[0]!.left > 370 && row.words[0]!.left < 380);
	if (headers.length !== 1 || candidateText(headers[0]!) !== "CANDIDATE(S)" || joined(headers[0]!.words) !== "RACE CANDIDATE(S) BALLOT PRECINCTS" || !style || Math.abs(style.top - headers[0]!.top - 17.1) > 1) throw new Error("The Santa Fe master columns changed.");
	const blocks: Block[] = [];
	let measures = false;
	for (const row of pages.flat()) {
		if (row.page === 1 && row.top <= style.top) continue;
		const left = leftText(row);
		if (left === "CONSTITUTIONAL" && candidateText(row) === "FOR/AGAINST") measures = true;
		if (measures) {
			if (start.test(left)) throw new Error("A Santa Fe candidate office appears after the measure boundary.");
			continue;
		}
		if (row.words.some(word => word.left >= 180 && word.left < 365 && word.right > 365)) throw new Error("The Santa Fe candidate column overflows its reviewed boundary.");
		if (start.test(left)) blocks.push({ rows: [], page: row.page });
		const block = blocks.at(-1);
		if (!block) throw new Error("The Santa Fe master begins outside a candidate office.");
		block.rows.push(row);
	}
	if (!measures || !blocks.length || blocks.length > 1000) throw new Error("The Santa Fe master candidate/measure boundary requires review.");
	const evidence: { record: StateCandidateRecord; page: number }[] = [];
	for (const block of blocks) {
		const printed = clean(block.rows.map(leftText).join(" "));
		const candidates = clean(block.rows.map(candidateText).join(" "));
		const values: { name: string; party?: string; office: string; district: string; scope: StateCandidateRecord["scope"]; sourceStatus: string }[] = [];
		if (printed.startsWith("JUDICIAL RETENTION,")) {
			const candidate = /^(.+) YES\/NO$/u.exec(candidates);
			const question = / Shall (.+?) be retained as (.+?)\?/u.exec(printed);
			if (!candidate || !question || candidate[1] !== question[1]) throw new Error("The Santa Fe named retention question disagrees with its candidate.");
			const name = person(candidate[1]!);
			const role = question[2]!;
			const district = /^District Court Judge, Division ([1-9]\d?)$/u.exec(role)?.[1];
			if (!district && !["Justice of the Supreme Court", "Judge of the Court of Appeals"].includes(role)) throw new Error("The Santa Fe retention office requires review.");
			const label = district ? `DISTRICT COURT JUDGE, DIVISION ${district}` : role === "Justice of the Supreme Court" ? "SUPREME COURT" : "COURT OF APPEALS";
			if (!printed.startsWith(`JUDICIAL RETENTION, ${label} Shall `)) throw new Error("The Santa Fe retention heading disagrees with its question.");
			values.push({ name, office: `Retain ${name} as ${role}`, district: district ?? "", scope: district ? "local" : "statewide", sourceStatus: "Named judicial retention question" });
		}
		else {
			const fields = officeFields(printed);
			const parties: Record<string, string> = { D: "Democratic Party", R: "Republican Party", FWD: "Forward Party" };
			let remainder = candidates;
			while (remainder) {
				const match = /^(.+?) \((D|R|FWD)\)(?: |$)/u.exec(remainder);
				if (!match) throw new Error("The Santa Fe candidate/party column requires review.");
				values.push({ name: person(match[1]!), party: parties[match[2]!]!, ...fields, sourceStatus: "County master ballot list" });
				remainder = remainder.slice(match[0].length);
			}
		}
		if (!values.length) throw new Error("The Santa Fe candidate office is empty.");
		for (const value of values) {
			const jurisdiction = value.scope === "local" ? "Santa Fe County, New Mexico" : undefined;
			const id = createHash("sha256").update(JSON.stringify(["NM", value.office, value.district, value.name, value.party ?? "", jurisdiction ?? ""])).digest("hex").slice(0, 24);
			evidence.push({ record: { id, ...value, status: "listed", ...(jurisdiction ? { jurisdiction } : {}) }, page: block.page });
		}
	}
	if (evidence.length > 5000 || new Set(evidence.map(item => item.record.id)).size !== evidence.length) throw new Error("The Santa Fe master has duplicated or excessive identities.");
	return { evidence, pageCount: pages.length };
}
