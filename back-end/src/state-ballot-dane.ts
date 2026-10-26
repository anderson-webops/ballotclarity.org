import type { StateCandidateRecord } from "./state-ballot-records.js";
import type { StateBallotSource } from "./state-ballot-sources.js";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { stateHtmlAttribute as attribute, stateHtmlDescendants as descendants, parseStateHtml, stateHtmlText } from "./state-ballot-html.js";
import { containsControlCharacters } from "./text-validation.js";

interface Word { text: string; left: number; top: number }
interface Line { text: string; left: number; top: number; words: Word[] }
const clean = (value: string) => value.replace(/\s+/gu, " ").trim();
const parties = ["Republican", "Democratic", "Wisconsin Green", "Independent", "Libertarian", "Constitution", "Nonpartisan"];
const offices = ["Governor / Lieutenant Governor", "Attorney General", "Secretary of State", "State Treasurer", "Representative in Congress", "State Senator", "Representative to the Assembly", "Sheriff", "Clerk of Circuit Court"];

function pages(body: string): Line[][] {
	if (Buffer.byteLength(body) > 4 * 1024 * 1024 || /<!ENTITY|<!DOCTYPE[^>]*\[/iu.test(body) || !body.trimEnd().endsWith("</html>") || [...body.matchAll(/<page\b/gu)].length !== [...body.matchAll(/<\/page>/gu)].length) throw new Error("The Dane PDF is incomplete or exceeds its bounds.");
	const nodes = descendants(parseStateHtml(body), node => node.nodeName === "page");
	if (nodes.length !== 2) throw new Error("The Dane PDF page count requires review.");
	return nodes.map((page) => {
		if (Number(attribute(page, "width")) !== 612 || Number(attribute(page, "height")) !== 792) throw new Error("The Dane PDF geometry requires review.");
		return descendants(page, node => node.nodeName === "line").map((line) => {
			const words = descendants(line, node => node.nodeName === "word");
			const bounds = ["xmin", "xmax", "ymin", "ymax"].map(key => Number(attribute(line, key)));
			if (bounds.some(value => !Number.isFinite(value)) || bounds[0]! < 0 || bounds[1]! > 612 || bounds[0]! >= bounds[1]! || bounds[2]! < 0 || bounds[3]! > 792 || bounds[2]! >= bounds[3]!) throw new Error("The Dane PDF line coordinates require review.");
			for (const word of words) {
				const values = ["xmin", "xmax", "ymin", "ymax"].map(key => Number(attribute(word, key)));
				if (values.some(value => !Number.isFinite(value)) || values[0]! < 0 || values[1]! > 612 || values[0]! >= values[1]! || values[2]! < 0 || values[3]! > 792 || values[2]! >= values[3]!) throw new Error("The Dane PDF word coordinates require review.");
				if (values[0]! < bounds[0]! - 0.01 || values[1]! > bounds[1]! + 0.01 || values[2]! < bounds[2]! - 0.01 || values[3]! > bounds[3]! + 0.01) throw new Error("The Dane PDF line and word coordinates disagree.");
			}
			const visible = words.filter(word => Number(attribute(word, "ymax")) - Number(attribute(word, "ymin")) < 20);
			return { text: clean(visible.map(stateHtmlText).join(" ")), left: Number(attribute(line, "xmin")), top: Number(attribute(line, "ymin")), words: visible.map(word => ({ text: stateHtmlText(word), left: Number(attribute(word, "xmin")), top: Number(attribute(word, "ymin")) })) };
		}).filter(line => line.text).sort((first, second) => first.top - second.top || first.left - second.left);
	});
}
function dateLabel(source: StateBallotSource) {
	if (source.stateCode !== "WI" || !/^20\d{2}-11-0[2-8]$/u.test(source.electionDate) || new Date(`${source.electionDate}T00:00:00Z`).getUTCDay() !== 2 || Number(source.electionDate.slice(0, 4)) % 2) throw new Error("The Dane election date requires review.");
	return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${source.electionDate}T00:00:00Z`));
}
function record(source: StateBallotSource, name: string, office: string, party: string, district: string): StateCandidateRecord {
	const position = offices.indexOf(office);
	if (position < 0 || !parties.includes(party) || !/^[\p{L}\p{M} .,'’/-]{3,180}$/u.test(name) || (office === offices[0] ? name.split(" / ").length !== 2 : name.includes("/"))) throw new Error("The Dane candidate or ticket requires review.");
	const scope = position < 4 ? "statewide" : position === 4 ? "congressional" : position === 5 ? "state-senate" : position === 6 ? "state-house" : "local";
	if (["congressional", "state-senate", "state-house"].includes(scope) ? !/^[1-9]\d{0,2}$/u.test(district) : district !== "") throw new Error("The Dane printed district requires review.");
	return { id: createHash("sha256").update(JSON.stringify([source.id, name, office, scope, district])).digest("hex").slice(0, 24), name, office, party, scope, district, status: "listed", ...(scope === "local" ? { jurisdiction: "Dane County" } : {}) };
}

export function readDaneCandidateSample(source: StateBallotSource, body: string, style: "Lodi" | "Waunakee" | "Sauk") {
	if (!["Lodi", "Waunakee", "Sauk"].includes(style)) throw new Error("The Dane school-area sample identity requires review.");
	const label = dateLabel(source);
	const parsed = pages(body);
	for (const [index, page] of parsed.entries()) {
		const text = page.map(line => line.text).join(" ");
		const marker = style === "Sauk" ? index ? "Initials of inspectors who remade ballot" : "Continue voting at top of next column." : index ? "Page 2 of 2-sided ballot. Ballot begins on other side." : "Page 1 of 2-sided ballot. Ballot continues on other side.";
		if (!text.includes("Official Ballot") || !text.includes(label) || !text.includes(marker) || containsControlCharacters(text)) throw new Error("The Dane sample identity, date or page order requires review.");
	}
	const reverse = parsed[1]!.map(line => line.text).join(" ");
	if (!reverse.includes("T Dane Wd 1") || (style === "Sauk" ? /School District|Referendum \(cont\.\)/u.test(reverse) : !reverse.includes(style === "Lodi" ? "School District of Lodi" : "Waunakee Community School District"))) throw new Error("The Dane school-area reverse-side identity requires review.");
	const secondary = [...parsed[1]!, ...parsed[0]!.filter(line => line.left >= 380)];
	if (secondary.some(line => /^Vote for [1-9]\d*$|^\([^()]+\)$/u.test(line.text))) throw new Error("The Dane secondary candidate regions require review.");
	const first = parsed[0]!;
	if (!first.some(line => line.text === "Referendum" && line.left > 380)) throw new Error("The Dane referendum boundary requires review.");
	const records: StateCandidateRecord[] = [];
	const seen = new Set<string>();
	let partyRows = 0;
	for (const [column, beginning] of [[0, offices[0]!], [1, offices[3]!]] as const) {
		const columnLines = first.flatMap((line) => {
			const words = line.words.filter(word => word.left >= (column ? 240 : 100) && word.left < (column ? 380 : 240) && word.top < 680);
			const groups: Word[][] = [];
			for (const word of words) {
				let group = groups.find(group => Math.abs(group[0]!.top - word.top) < 0.5);
				if (!group) groups.push((group = []));
				group.push(word);
			}
			return groups.map(group => ({ text: clean(group.sort((first, second) => first.left - second.left).map(word => word.text).join(" ")), left: group[0]!.left, top: group[0]!.top }));
		}).sort((first, second) => first.top - second.top || first.left - second.left);
		const start = columnLines.findIndex(line => line.text === beginning);
		if (start < 0 || columnLines.filter(line => line.text === beginning).length !== 1) throw new Error("The Dane candidate column heading requires review.");
		let office = "";
		let district = "";
		let names: string[] = [];
		let count = 0;
		let voteLimit = false;
		for (const line of columnLines.slice(start)) {
			if (offices.includes(line.text)) {
				if (names.length || (office && (!count || !voteLimit))) throw new Error("The Dane candidate office is incomplete.");
				office = line.text;
				district = "";
				count = 0;
				voteLimit = false;
				continue;
			}
			if (["Statewide", "Congressional", "Legislative", "County"].includes(line.text)) {
				if (names.length || !count) throw new Error("The Dane category interrupts a candidate.");
				continue;
			}
			if (/^District [1-9]\d{0,2}$/u.test(line.text)) {
				if (district || names.length || voteLimit || ![offices[4], offices[5], offices[6]].includes(office)) throw new Error("The Dane district header requires review.");
				district = line.text.slice(9);
				continue;
			}
			if (line.text === "Vote for 1") {
				if (voteLimit || names.length || count) throw new Error("The Dane vote limit requires review.");
				voteLimit = true;
				continue;
			}
			if (/^write-in:\s*$|^write-in \((?:Lieutenant )?Governor\)$/u.test(line.text)) {
				if (!count || names.length || !voteLimit) throw new Error("The Dane write-in placeholder interrupts a candidate.");
				continue;
			}
			const party = /^\(([^()]+)\)$/u.exec(line.text)?.[1];
			if (party) {
				if (!voteLimit || !names.length) throw new Error("The Dane party row is missing its candidate.");
				const candidate = record(source, clean(names.join(" ")), office, party, district);
				if (seen.has(candidate.id)) throw new Error("The Dane sample repeats a candidate identity.");
				seen.add(candidate.id);
				records.push(candidate);
				names = [];
				count++;
				partyRows++;
				continue;
			}
			if (!voteLimit || !/^[\p{L}\p{M} .,'’/-]{3,180}$/u.test(line.text) || names.length > 1 || (names.length && (office !== offices[0] || !names[0]!.endsWith("/")))) throw new Error("The Dane candidate row requires review.");
			names.push(line.text);
		}
		if (names.length || !count || !voteLimit) throw new Error("The Dane candidate column is incomplete.");
	}
	if (!records.length || records.length > 100 || new Set(records.map(item => item.office)).size !== offices.length || partyRows !== first.filter(line => parties.some(party => line.text === `(${party})`)).length) throw new Error("The Dane sample candidate inventory requires review.");
	return { records, pageCount: 2, namedPeople: records.reduce((sum, item) => sum + (item.office === offices[0] ? 2 : 1), 0) };
}

export function readDaneCandidateNotice(source: StateBallotSource, body: string) {
	const label = dateLabel(source);
	const parsed = pages(body);
	const text = parsed.flat().map(line => line.text).join(" ");
	if (!text.includes("Notice of General Election and Sample Ballots") || !text.includes(label.replace(", ", ",")) || !text.includes("Office of the Dane County Clerk") || !text.includes("The sample ballots contain candidates for Assembly District") || containsControlCharacters(text)) throw new Error("The Dane notice identity or date requires review.");
	const rows = parsed[1]!;
	const records: StateCandidateRecord[] = [];
	for (const [side, title, office] of [[0, "State Senator", "State Senator"], [1, "State Assembly", "Representative to the Assembly"]] as const) {
		const column = rows.filter(line => side ? line.left > 300 : line.left < 300);
		const header = column.findIndex(line => new RegExp(`^${title} [–-] District [1-9]\\d{0,2}$`, "u").test(line.text));
		if (header < 0) throw new Error("The Dane notice legislative heading requires review.");
		const district = /District (\d+)$/u.exec(column[header]!.text)![1]!;
		for (const line of column.slice(header + 1)) {
			const match = /^([\p{L}\p{M} .,'’/-]+) \(([^()]+)\)$/u.exec(line.text);
			if (!match) throw new Error("The Dane notice legislative row requires review.");
			records.push(record(source, clean(match[1]!), office, match[2]!, district));
		}
	}
	if (records.length < 2 || records.length > 40 || new Set(records.map(item => item.id)).size !== records.length) throw new Error("The Dane notice legislative inventory requires review.");
	return { records, pageCount: 2 };
}
