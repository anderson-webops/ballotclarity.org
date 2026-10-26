import type { StateCandidateValues } from "./state-ballot-additional-records.js";
import type { StateCandidateRecord } from "./state-ballot-records.js";
import type { StateBallotSource } from "./state-ballot-sources.js";
import { Buffer } from "node:buffer";
import { stateHtmlAttribute as attribute, stateHtmlDescendants as descendants, parseStateHtml, stateHtmlText as text } from "./state-ballot-html.js";
import { containsControlCharacters } from "./text-validation.js";

interface Word { left: number; right: number; top: number; value: string }
type Factory = (source: StateBallotSource, values: StateCandidateValues) => StateCandidateRecord | null;
const parties = ["Republican", "Democrat", "Statehood Green", "Independent", "Libertarian", "One Home Party", "N/A"];
const ancPattern = /^[1-8](?:\/[1-8])?[A-Z]\d{2}$/u;
const clean = (value: string) => value.normalize("NFKC").replace(/\s+/gu, " ").trim();
const joined = (words: Word[]) => clean(words.map(word => word.value).join(" "));

function pages(body: string) {
	if (Buffer.byteLength(body) > 4 * 1024 * 1024 || /<!ENTITY|<!DOCTYPE[^>]*\[/iu.test(body) || !body.trimEnd().endsWith("</html>") || [...body.matchAll(/<page\b/gu)].length !== [...body.matchAll(/<\/page>/gu)].length) throw new Error("The D.C. PDF text exceeds its reviewed bounds or is incomplete.");
	const result = descendants(parseStateHtml(body), node => node.nodeName === "page").map((page) => {
		if (Math.abs(Number(attribute(page, "width")) - 792) > 1 || Math.abs(Number(attribute(page, "height")) - 612) > 1) throw new Error("The D.C. publication page dimensions changed.");
		const words = descendants(page, node => node.nodeName === "word").map((node) => {
			if (["xmin", "xmax", "ymin"].some(name => !/^\d+(?:\.\d+)?$/u.test(attribute(node, name)))) throw new Error("The D.C. publication word coordinates are missing.");
			return { left: Number(attribute(node, "xmin")), right: Number(attribute(node, "xmax")), top: Number(attribute(node, "ymin")), value: text(node) };
		});
		if (!words.length || words.length > 15000 || words.some(word => !Number.isFinite(word.left) || !Number.isFinite(word.right) || !Number.isFinite(word.top) || word.left < 0 || word.right > 793 || word.right < word.left || word.top < 0 || word.top > 613 || containsControlCharacters(word.value))) throw new Error("The D.C. publication word geometry changed.");
		return words;
	});
	if (!result.length || result.length > 50) throw new Error("The D.C. publication page set is unsupported.");
	return result;
}
function rows(words: Word[]) {
	const groups: { top: number; words: Word[] }[] = [];
	for (const word of [...words].sort((first, second) => first.top - second.top || first.left - second.left)) {
		let group = groups.at(-1);
		if (!group || Math.abs(group.top - word.top) >= 1.8) groups.push(group = { top: word.top, words: [] });
		group.words.push(word);
	}
	return groups.map(group => ({ ...group, words: group.words.sort((first, second) => first.left - second.left) }));
}
function field(words: Word[], left: number, right: number) {
	return clean(rows(words.filter(word => word.left >= left - 0.6 && word.left < right - 0.6)).map(row => joined(row.words)).join(" "));
}
function person(value: string) {
	if (!value || value.length > 250 || !/\p{L}/u.test(value) || /@|https?:|\d{3}|candidate|withdr[ae]w|vacant|write.in|date filed/iu.test(value)) throw new Error("The D.C. candidate name requires review.");
	return value;
}
function candidateName(published: string, electionDate: string) {
	const withdrawn = /^(.+?) \(withdrew (\d{1,2}\/\d{1,2}\/\d{2})\)$/u.exec(published);
	if (!withdrawn) return { name: person(published), withdrawal: null };
	const [month, day, year] = withdrawn[2]!.split("/");
	const date = `20${year}-${month!.padStart(2, "0")}-${day!.padStart(2, "0")}`;
	if (!Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date || withdrawn[2]!.slice(-2) !== electionDate.slice(2, 4) || date > electionDate) throw new Error("The D.C. withdrawal date requires review.");
	return { name: person(withdrawn[1]!), withdrawal: `Withdrew ${withdrawn[2]}` };
}
function officeValues(value: string): Omit<StateCandidateValues, "name" | "party"> {
	const office = value.replace(/^Delegate to the U\.S\. House of Representatives$/u, "Delegate to the House of Representatives").replace(/^Chairman of the Council$/u, "Chairman of the Council of the District of Columbia");
	const ward = /^Ward ([1-8]) Member of the (?:Council|State Board of Education)$/u.exec(office);
	const anc = /^ANC (.+)$/u.exec(office);
	if (anc && !ancPattern.test(anc[1]!)) throw new Error("The D.C. ANC-SMD label requires review.");
	if (ward) return { office, scope: "local", district: ward[1]!, jurisdiction: `Ward ${ward[1]}` };
	if (anc) return { office: "Advisory Neighborhood Commissioner", scope: "local", district: anc[1]!, jurisdiction: `ANC-SMD ${anc[1]}` };
	if (!["Delegate to the House of Representatives", "Mayor of the District of Columbia", "Chairman of the Council of the District of Columbia", "At-Large Member of the Council", "Attorney General", "United States Senator", "United States Representative"].includes(office)) throw new Error("The D.C. office requires review.");
	return { office: /^United States (?:Senator|Representative)$/u.test(office) ? `${office} (D.C. shadow delegation)` : office, scope: "statewide", district: "" };
}
function dateHeading(words: Word[], electionDate: string) {
	const content = joined(rows(words.filter(word => word.top < 68)).flatMap(row => row.words));
	const dates = [...content.matchAll(/November ([1-9]\d?), (20\d{2})/gu)];
	if (dates.length !== 1 || `${dates[0]![2]}-11-${dates[0]![1]!.padStart(2, "0")}` !== electionDate || !content.includes("General Election")) throw new Error("The D.C. publication election identity changed.");
}
function generalRecords(body: string, electionDate: string) {
	const wordPages = pages(body);
	dateHeading(wordPages[0]!, electionDate);
	let office = "";
	let closed = true;
	const values: StateCandidateValues[] = [];
	const counts: number[] = [];
	for (const [pageIndex, words] of wordPages.entries()) {
		const before = values.length;
		if (!pageIndex && field(words.filter(word => word.top > 59 && word.top < 67), 52, 217) !== "Candidate's Name") throw new Error("The D.C. general candidate column changed.");
		for (const row of rows(words.filter(word => word.left >= 52 && word.left < 217 && word.top > (pageIndex ? 0 : 68)))) {
			const cluster: Word[] = [];
			for (const word of row.words) {
				if (cluster.length && word.left - cluster.at(-1)!.right > 12) break;
				cluster.push(word);
			}
			const value = joined(cluster);
			if (value === "Write-In, if any") {
				if (!office || closed) throw new Error("The D.C. general office boundary is duplicated.");
				closed = true;
				continue;
			}
			if (/^(?:Delegate to|Mayor of|Chairman of|At-Large Member|Ward [1-8] Member|Attorney General|United States)/u.test(value)) {
				if (!closed) throw new Error("The D.C. general office block is incomplete.");
				officeValues(value);
				office = value;
				closed = false;
				continue;
			}
			if (!office || closed) throw new Error("The D.C. candidate is outside an office block.");
			const candidate = /^(.+) - (Republican|Democrat|Statehood Green|Independent)$/u.exec(value);
			if (!candidate && !office.includes("State Board of Education")) throw new Error("The D.C. candidate party or row requires review.");
			values.push({ name: person(candidate?.[1] ?? value), ...officeValues(office), party: candidate?.[2] ?? "", status: "General-election candidates in ballot order" });
		}
		counts.push(values.length - before);
	}
	if (!closed || !values.length || counts.some(count => !count)) throw new Error("The D.C. general candidate publication is incomplete.");
	return { values, counts };
}
function ancRecords(body: string, electionDate: string) {
	const values: StateCandidateValues[] = [];
	const counts: number[] = [];
	let vacancies = 0;
	for (const [pageIndex, words] of pages(body).entries()) {
		dateHeading(words, electionDate);
		const page = words.find(word => word.value === "Page" && word.top > 570);
		const footer = words.find(word => /^\d{1,2}\/\d{1,2}\/20\d{2}$/u.test(word.value) && word.top > 550);
		if (!page || !footer || field(words.filter(word => Math.abs(word.top - page.top) < 1), 375, 430) !== `Page ${pageIndex + 1}` || field(words.filter(word => word.top > 60 && word.top < 67), 24, 219) !== "ANC-SMD Name") throw new Error("The D.C. ANC columns or sequential pages changed.");
		const starts = words.filter(word => word.left >= 24 && word.left < 65 && word.top > 70 && word.top < footer.top).sort((first, second) => first.top - second.top);
		if (!starts.length || starts.some(word => !ancPattern.test(word.value))) throw new Error("The D.C. ANC district column requires review.");
		const before = values.length;
		for (const [index, start] of starts.entries()) {
			const selected = words.filter(word => word.top >= start.top - 0.8 && word.top < (starts[index + 1]?.top ?? footer.top) - 0.8);
			const published = field(selected, 65, 219);
			if (!published) {
				vacancies++;
				continue;
			}
			const candidate = candidateName(published, electionDate);
			values.push({ name: candidate.name, ...officeValues(`ANC ${start.value}`), party: "", status: candidate.withdrawal ?? "ANC candidates in ballot order" });
		}
		counts.push(values.length - before);
	}
	return { values, counts, vacancies };
}
function writeInRecords(body: string, electionDate: string) {
	const values: StateCandidateValues[] = [];
	const counts: number[] = [];
	for (const words of pages(body)) {
		dateHeading(words, electionDate);
		const header = words.find(word => word.value === "Candidate's" && word.left < 141 && word.top > 65 && word.top < 80);
		const footer = words.find(word => /^\d{1,2}\/\d{1,2}\/20\d{2}$/u.test(word.value) && word.top > 550);
		if (!header || !footer || field(words.filter(word => Math.abs(word.top - header.top) < 1), 52, 318) !== "Candidate's Name Office Sought Party") throw new Error("The D.C. write-in columns changed.");
		const before = values.length;
		for (const row of rows(words.filter(word => word.left >= 52 && word.left < 318 && word.top > header.top + 4 && word.top < footer.top))) {
			const name = field(row.words, 52, 141);
			const office = field(row.words, 141, 258);
			const party = field(row.words, 258, 318);
			if (!name || !office || !parties.includes(party)) throw new Error("The D.C. write-in row or party requires review.");
			const candidate = candidateName(name, electionDate);
			values.push({ name: candidate.name, ...officeValues(office), party, status: candidate.withdrawal ?? "Registered general-election write-in candidate" });
		}
		counts.push(values.length - before);
	}
	if (!values.length || counts.some(count => !count)) throw new Error("The D.C. write-in publication is empty or incomplete.");
	return { values, counts };
}
export function readDcCandidateDocuments(source: StateBallotSource, documents: string[], factory: Factory) {
	if (source.stateCode !== "DC" || !/^20\d{2}-11-0[2-8]$/u.test(source.electionDate) || new Date(`${source.electionDate}T00:00:00Z`).getUTCDay() !== 2 || documents.length !== 3) throw new Error("The D.C. general-election source requires review.");
	const general = generalRecords(documents[0]!, source.electionDate);
	const anc = ancRecords(documents[1]!, source.electionDate);
	const writeIns = writeInRecords(documents[2]!, source.electionDate);
	const records = [...general.values, ...anc.values, ...writeIns.values].map((values) => {
		const status = values.status!.startsWith("Withdrew ") ? "withdrawn" : values.status === "Registered general-election write-in candidate" ? "write-in" : "listed";
		const record = factory(source, { ...values, status });
		if (!record) throw new Error("The D.C. candidate record is invalid.");
		return { ...record, sourceStatus: values.status };
	});
	if (records.length > 3000 || new Set(records.map(record => record.id)).size !== records.length) throw new Error("The D.C. candidate inventory is excessive or duplicated.");
	return { records, documentCounts: [general.values.length, anc.values.length, writeIns.values.length], pageCounts: [general.counts, anc.counts, writeIns.counts], vacancies: anc.vacancies };
}
