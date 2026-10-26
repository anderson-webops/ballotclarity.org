import type { StateCandidateRecord } from "./state-ballot-records.js";
import type { StateBallotSource } from "./state-ballot-sources.js";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { stateHtmlAttribute as attribute, stateHtmlDescendants as descendants, parseStateHtml, stateHtmlText } from "./state-ballot-html.js";
import { containsControlCharacters } from "./text-validation.js";

interface Word { text: string; left: number; right: number; top: number; bottom: number }
interface Line { top: number; words: Word[] }
const clean = (value: string) => value.replace(/\s+/gu, " ").trim();
const joined = (words: Word[]) => clean(words.map(word => word.text).join(" "));
const parties: Record<string, string> = { DEM: "Democratic", REP: "Republican", LIB: "Libertarian", IND: "Independent" };
const cityPattern = "Alexander|Jacksonville|Little Rock|Maumelle|N\\. Little Rock|North Little Rock|Sherwood|Wrightsville|Cammack Village";
const heading = new RegExp(`^(?:U\\.S\\. Senate|U\\.S\\. Congress District [1-9]\\d{0,2}|Governor|Lieutenant Governor|Secretary of State|Commissioner of State Lands|Attorney General|Auditor of State|State Treasurer|State Senate District [1-9]\\d{0,2}|State Representative District [1-9]\\d{0,2}|Pulaski County (?:Judge|Sheriff|Circuit/County Clerk|Treasurer|Assessor)|Justice of the Peace District [1-9]\\d{0,2}|Constable [\\p{L} .'-]+ Township|(?:${cityPattern}) [\\p{L}\\d /.-]+)$`, "u");

function lines(words: Word[]) {
	const result: Line[] = [];
	for (const word of [...words].sort((first, second) => first.top - second.top || first.left - second.left)) {
		let line = result.at(-1);
		if (!line || word.top - line.top > 0.7) result.push(line = { top: word.top, words: [] });
		line.words.push(word);
	}
	for (const line of result) line.words.sort((first, second) => first.left - second.left);
	return result;
}
function pages(body: string) {
	if (Buffer.byteLength(body) > 4 * 1024 * 1024 || containsControlCharacters(body.replace(/[\r\n\t\f]/gu, ""))) throw new Error("The Pulaski PDF text exceeds its bounds.");
	const document = parseStateHtml(body);
	const pending = [{ node: document, depth: 0 }];
	let visited = 0;
	while (pending.length) {
		const item = pending.pop()!;
		if (++visited > 150000 || item.depth > 64) throw new Error("The Pulaski PDF structure exceeds its bounds.");
		for (const child of item.node.childNodes ?? []) pending.push({ node: child, depth: item.depth + 1 });
	}
	const result = descendants(document, node => node.nodeName === "page");
	if (result.length < 3 || result.length > 40) throw new Error("The Pulaski PDF page count requires review.");
	let total = 0;
	return result.map((page) => {
		if (Number(attribute(page, "width")) !== 612 || Number(attribute(page, "height")) !== 1008) throw new Error("The Pulaski notice dimensions require review.");
		const words = descendants(page, node => node.nodeName === "word").map(node => ({ text: clean(stateHtmlText(node)), left: Number(attribute(node, "xmin")), right: Number(attribute(node, "xmax")), top: Number(attribute(node, "ymin")), bottom: Number(attribute(node, "ymax")) }));
		total += words.length;
		if (!words.length || total > 60000 || words.some(word => !word.text || word.text.length > 500 || [word.left, word.right, word.top, word.bottom].some(value => !Number.isFinite(value)) || word.left < 0 || word.right > 613 || word.top < 0 || word.bottom > 1009 || word.right <= word.left || word.bottom <= word.top || word.bottom - word.top > 35)) throw new Error("The Pulaski notice word geometry requires review.");
		return words;
	});
}
function geography(office: string) {
	const district = /^(?:U\.S\. Congress|State Senate|State Representative) District (\d+)$/u.exec(office)?.[1] ?? "";
	const scope: StateCandidateRecord["scope"] = office.startsWith("U.S. Congress") ? "congressional" : office.startsWith("State Senate") ? "state-senate" : office.startsWith("State Representative") ? "state-house" : /^(?:U\.S\. Senate|Governor|Lieutenant Governor|Secretary of State|Commissioner of State Lands|Attorney General|Auditor of State|State Treasurer)$/u.test(office) ? "statewide" : "local";
	const city = new RegExp(`^(${cityPattern}) `, "u").exec(office)?.[1];
	return { district, scope, jurisdiction: city ? `${city === "N. Little Rock" ? "North Little Rock" : city}, Arkansas` : scope === "local" ? "Pulaski County, Arkansas" : "Arkansas" };
}

export function readPulaskiCandidateNotice(source: StateBallotSource, body: string) {
	const wordPages = pages(body);
	const date = new Date(`${source.electionDate}T00:00:00Z`);
	if (!Number.isFinite(date.getTime()) || source.stateCode !== "AR" || source.electionDate !== date.toISOString().slice(0, 10)) throw new Error("The Pulaski election identity requires review.");
	const label = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).format(date);
	const day = date.getUTCDate();
	const ordinal = day === 3 ? "rd" : day === 2 ? "nd" : "th";
	const footer = `November ${day}${ordinal} General Election`;
	const first = lines(wordPages[0]!.filter(word => word.top < 110)).map(line => joined(line.words));
	if (!first.includes("NOTICE OF ELECTION") && !first.includes("AMENDED NOTICE OF ELECTION")) throw new Error("The Pulaski notice title requires review.");
	if (!first.includes(`${label} General Election`) || !first.includes("**Provided by the Pulaski County Board of Election Commissioners**")) throw new Error("The Pulaski notice date or publisher requires review.");
	for (const [index, words] of wordPages.entries()) {
		const bottom = lines(words.filter(word => word.top >= 975)).map(line => joined(line.words));
		if (bottom.length !== 1 || bottom[0]?.replace(/(\d) (st|nd|rd|th)\b/u, "$1$2") !== `${footer} Page ${index + 1} of ${wordPages.length}`) throw new Error("The Pulaski notice footer or page sequence requires review.");
	}
	const starts = wordPages.flatMap((words, page) => lines(words).filter(line => joined(line.words) === "CANDIDATES FOR THIS ELECTION").map(line => ({ page, top: line.top + 15 })));
	const endings = wordPages.flatMap((words, page) => lines(words).filter(line => /^CONSTITUTIONAL AMENDMENTS \(OR OTHER MEASURE\) REFERRED TO THE PEOPLE BY THE GENERAL ASSEMBLY$/u.test(joined(line.words))).map(line => ({ page, top: line.top })));
	if (starts.length !== 1) throw new Error("The Pulaski candidate section is missing or repeated.");
	const start = starts[0]!;
	const end = endings.find(item => item.page > start.page || (item.page === start.page && item.top > start.top));
	if (!end || end.page - start.page > 10) throw new Error("The Pulaski candidate section end requires review.");
	const records: StateCandidateRecord[] = [];
	const claims: { recordId: string; page: number; column: number }[] = [];
	const groups: { office: string; page: number; column: number; candidates: number; unopposed: boolean }[] = [];
	let unopposed = false;
	let markers = 0;
	for (let page = start.page; page <= end.page; page++) {
		const words = wordPages[page]!.filter(word => word.top >= (page === start.page ? start.top : 0) && word.top < (page === end.page ? end.top : 975));
		if (!words.length || words.some(word => ![36, 228, 420].some(left => word.left >= left - 1 && word.left < left + 183 && word.right <= left + 184))) throw new Error("The Pulaski candidate columns require review.");
		for (const [column, left] of [36, 228, 420].entries()) {
			let office = "";
			let pending = "";
			let group: typeof groups[number] | undefined;
			for (const line of lines(words.filter(word => word.left >= left - 1 && word.left < left + 183))) {
				const value = joined(line.words);
				if (value === "Unopposed Candidates:") {
					if (pending || ++markers !== 1) throw new Error("The Pulaski unopposed marker is detached or repeated.");
					unopposed = true;
					continue;
				}
				if (heading.test(value)) {
					if (pending || (group && !group.candidates)) throw new Error("The Pulaski office group is incomplete.");
					office = value;
					group = { office, page: page + 1, column: column + 1, candidates: 0, unopposed };
					groups.push(group);
					continue;
				}
				const combined = clean(`${pending} ${value}`);
				const candidate = /^(.+?)-\s*(DEM|REP|LIB|IND)$/u.exec(combined);
				if (!candidate) {
					if (pending || !office || (!value.endsWith("-") && !(office === "Pulaski County Assessor" && /^Pulaski County Assessor, [\p{L} .’'-]+$/u.test(value)))) throw new Error("The Pulaski wrapped row or office heading requires review.");
					pending = value;
					continue;
				}
				const name = clean(candidate[1]!);
				if (!group || name.length < 4 || name.length > 250 || !/^[\p{L}\p{M}\d .,'’“”"&/-]+$/u.test(name) || /\b(?:email|telephone|https?|street|ballot)\b/iu.test(name)) throw new Error("The Pulaski candidate name requires review.");
				const party = parties[candidate[2]!]!;
				const fields = geography(office);
				const identity = [source.id, source.stateCode, source.electionDate, ...[name, office, party, fields.district, fields.scope, fields.jurisdiction, ""].map(value => value.toLocaleLowerCase("en-US"))];
				const record: StateCandidateRecord = { id: createHash("sha256").update(JSON.stringify(identity)).digest("hex").slice(0, 24), name, office, ...fields, party, status: "listed", ...(unopposed ? { sourceStatus: "Unopposed" } : {}), ...(fields.district ? { sourceDistrictLabel: `District ${fields.district}` } : {}), ...(fields.scope === "local" ? { sourceAreaLabel: office } : {}) };
				records.push(record);
				claims.push({ recordId: record.id, page: page + 1, column: column + 1 });
				group.candidates++;
				pending = "";
			}
			if (pending || !group?.candidates) throw new Error("The Pulaski candidate column is truncated.");
		}
	}
	if (!records.length || records.length > 5000 || new Set(records.map(record => record.id)).size !== records.length || groups.some(group => !group.candidates)) throw new Error("The Pulaski candidate identity inventory requires review.");
	return { records, claims, pageCount: wordPages.length, namedOfficeGroups: groups.length, unopposedAsPrinted: records.filter(record => record.sourceStatus === "Unopposed").length };
}
