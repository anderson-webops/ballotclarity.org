import type { StateCandidateRecord } from "./state-ballot-records.js";
import type { StateBallotSource } from "./state-ballot-sources.js";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { stateHtmlAttribute as attribute, stateHtmlDescendants as descendants, parseStateHtml, stateHtmlText } from "./state-ballot-html.js";
import { containsControlCharacters } from "./text-validation.js";

interface Word { text: string; left: number; top: number; right: number; bottom: number }
interface Line { text: string; left: number; top: number }
const offices = ["Senator in Congress", "Governor", "Lieutenant Governor", "Secretary of State", "Attorney General", "General Treasurer", "Representative in Congress", "Senator in General Assembly", "Representative in General Assembly", "Town Council", "School Committee"];
const parties = ["REPUBLICAN", "DEMOCRAT", "Independent", "LIBERTARIAN", "GREEN"];
const clean = (value: string) => value.replace(/\s+/gu, " ").trim();
const watermarks = [{ text: "SA", left: -33.49, top: 667.797 }, { text: "M", left: 117.435, top: 573.553 }, { text: "PL", left: 211.678, top: 435.187 }, { text: "E", left: 350.045, top: 359.724 }];

function pages(body: string): Word[][] {
	if (Buffer.byteLength(body) > 4 * 1024 * 1024 || /<!ENTITY|<!DOCTYPE[^>]*\[/iu.test(body) || !body.trimEnd().endsWith("</html>") || [...body.matchAll(/<page\b/gu)].length !== [...body.matchAll(/<\/page>/gu)].length) throw new Error("The East Greenwich PDF is incomplete or exceeds its bounds.");
	const nodes = descendants(parseStateHtml(body), node => node.nodeName === "page");
	if (nodes.length !== 2) throw new Error("The East Greenwich page count requires review.");
	return nodes.map((page) => {
		if (Number(attribute(page, "width")) !== 648 || Number(attribute(page, "height")) !== 1260) throw new Error("The East Greenwich page geometry requires review.");
		const result: Word[] = [];
		const observed = new Set<string>();
		let visitedWords = 0;
		const lines = descendants(page, node => node.nodeName === "line");
		if (lines.length > 5000) throw new Error("The East Greenwich line count exceeds its bounds.");
		for (const line of lines) {
			const bounds = ["xmin", "xmax", "ymin", "ymax"].map(key => Number(attribute(line, key)));
			if (bounds.some(value => !Number.isFinite(value)) || bounds[0]! < -35 || bounds[1]! > 648 || bounds[0]! >= bounds[1]! || bounds[2]! < 0 || bounds[3]! > 1260 || bounds[2]! >= bounds[3]!) throw new Error("The East Greenwich line bounds require review.");
			for (const node of descendants(line, node => node.nodeName === "word")) {
				visitedWords++;
				const values = ["xmin", "xmax", "ymin", "ymax"].map(key => Number(attribute(node, key)));
				const word = { text: stateHtmlText(node), left: values[0]!, right: values[1]!, top: values[2]!, bottom: values[3]! };
				if (values.some(value => !Number.isFinite(value)) || word.left >= word.right || word.top >= word.bottom || word.left < bounds[0]! - 0.02 || word.right > bounds[1]! + 0.02 || word.top < bounds[2]! - 0.02 || word.bottom > bounds[3]! + 0.02 || containsControlCharacters(word.text)) throw new Error("The East Greenwich word and line bounds disagree.");
				if (word.bottom - word.top >= 20) {
					const marker = watermarks.find(item => item.text === word.text && Math.abs(item.left - word.left) < 0.02 && Math.abs(item.top - word.top) < 0.02);
					if (!marker || observed.has(marker.text)) throw new Error("The East Greenwich large text requires review.");
					observed.add(marker.text);
				}
				else {
					if (word.left < 0 || word.right > 648 || word.top < 0 || word.bottom > 1260 || !word.text.trim()) throw new Error("The East Greenwich word bounds require review.");
					result.push(word);
				}
			}
		}
		if (observed.size !== 4 || result.length > 15000 || visitedWords !== descendants(page, node => node.nodeName === "word").length) throw new Error("The East Greenwich watermark or word inventory requires review.");
		return result;
	});
}
function lines(words: Word[]): Line[] {
	const groups: Word[][] = [];
	for (const word of words.sort((first, second) => first.top - second.top || first.left - second.left)) {
		let group = groups.find(item => Math.abs(item[0]!.top - word.top) < 0.4);
		if (!group) groups.push((group = []));
		group.push(word);
	}
	return groups.map(group => ({ text: clean(group.sort((first, second) => first.left - second.left).map(word => word.text).join(" ")), left: group[0]!.left, top: group[0]!.top }));
}
function record(source: StateBallotSource, name: string, office: string, party: string, district: string, designation: string): StateCandidateRecord {
	const position = offices.indexOf(office);
	const scope = position < 6 ? "statewide" : position === 6 ? "congressional" : position === 7 ? "state-senate" : position === 8 ? "state-house" : "local";
	if (position < 0 || !parties.includes(party) || !/^[\p{L}\p{M} .,'’/-]{3,180}$/u.test(name)) throw new Error("The East Greenwich candidate or party requires review.");
	if (["congressional", "state-senate", "state-house"].includes(scope) ? !/^[1-9]\d{0,2}$/u.test(district) : district !== "") throw new Error("The East Greenwich office district requires review.");
	const jurisdiction = scope === "local" ? "East Greenwich" : "";
	return { id: createHash("sha256").update(JSON.stringify([source.id, office, scope, district, jurisdiction, name])).digest("hex").slice(0, 24), name, office, district, scope, status: "listed", party, ...(jurisdiction ? { jurisdiction } : {}), ballotDesignation: designation, sourceAreaLabel: "East Greenwich" };
}

export function readEastGreenwichCandidateSample(source: StateBallotSource, body: string, precinct: string) {
	if (source.stateCode !== "RI" || !/^20\d{2}-11-0[2-8]$/u.test(source.electionDate) || new Date(`${source.electionDate}T00:00:00Z`).getUTCDay() !== 2 || Number(source.electionDate.slice(0, 4)) % 2 || !/^09\d{2}$/u.test(precinct)) throw new Error("The East Greenwich election or precinct requires review.");
	const parsed = pages(body);
	const first = parsed[0]!;
	const reverse = [[50, 230], [230, 415], [415, 605]].flatMap(([left, right]) => lines(parsed[1]!.filter(word => word.left >= left! && word.left < right!)));
	const date = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${source.electionDate}T00:00:00Z`));
	const heading = lines(first.filter(word => word.top < 200 && word.left < 480)).map(line => line.text);
	if (heading.join("|") !== ["State of Rhode Island Official Ballot", "General Election", date, "East Greenwich"].join("|")) throw new Error("The East Greenwich election heading requires review.");
	const districtLines = lines(first.filter(word => word.top < 200 && word.left >= 480)).map(line => line.text);
	const districts = districtLines.slice(1).map((line, index) => new RegExp(`^${["Congressional", "Senate", "Representative"][index]} District ([1-9]\\d{0,2})$`, "u").exec(line)?.[1]);
	if (districtLines.length !== 4 || districtLines[0] !== `Precinct ${precinct}` || districts.length !== 3 || districts.some(value => !value)) throw new Error("The East Greenwich header districts require review.");
	if (!reverse.some(line => line.text === "State Questions") || !reverse.some(line => line.text === "East Greenwich") || reverse.some(line => /^(?:Vote|Choose|Select|Write-in)\b|^(?:REPUBLICAN|DEMOCRAT|Independent|LIBERTARIAN|GREEN)$/u.test(line.text) || offices.includes(line.text))) throw new Error("The East Greenwich reverse-side candidate inventory requires review.");
	if (first.some(word => word.top >= 200 && (word.top >= 1170 || word.left < 50 || word.right > 605))) throw new Error("The East Greenwich candidate regions require review.");
	const footer = lines(first.filter(word => word.top >= 1100 && word.left >= 415)).map(line => line.text);
	if (footer.filter(line => line === "Voting continues").length !== 1 || footer.filter(line => line === "on back").length !== 1) throw new Error("The East Greenwich continuation marker requires review.");
	const records: StateCandidateRecord[] = [];
	const observed = new Set<string>();
	for (const [left, right] of [[50, 230], [230, 415], [415, 605]]) {
		const column = lines(first.filter(word => word.top >= 200 && word.left >= left! && word.left < right!));
		let office = "";
		let district = "";
		let term = "";
		let vote = "";
		let count = 0;
		for (let index = 0; index < column.length; index++) {
			let label = column[index]!.text;
			if (["Senator in", "Representative in"].includes(label)) label += ` ${column[++index]?.text}`;
			if (offices.includes(label)) {
				if ((office && !count) || observed.has(label)) throw new Error("The East Greenwich office completeness requires review.");
				observed.add(label);
				office = label;
				district = "";
				term = "";
				vote = "";
				count = 0;
				continue;
			}
			if (/^District [1-9]\d{0,2}$/u.test(label)) {
				if (district || term || ![offices[6], offices[7], offices[8]].includes(office)) throw new Error("The East Greenwich district row requires review.");
				district = label.slice(9);
				if (district !== districts[offices.indexOf(office) - 6]) throw new Error("The East Greenwich header and contest districts disagree.");
				continue;
			}
			if (/^(?:Two|Four|Six) Year Term$/u.test(label)) {
				if (!office || term || vote || count) throw new Error("The East Greenwich term row requires review.");
				term = label;
				continue;
			}
			if (/^Vote for (?:1|up to [1-9])$/u.test(label)) {
				if (!term || vote || count || (offices.indexOf(office) < 9 && label !== "Vote for 1")) throw new Error("The East Greenwich vote limit requires review.");
				vote = label;
				continue;
			}
			if (label === "Write-in") {
				if (!count || !vote) throw new Error("The East Greenwich write-in placeholder requires review.");
				continue;
			}
			if (["Voting continues", "on back"].includes(label)) {
				if (!count || office !== "School Committee" || column[index]!.top < 1100) throw new Error("The East Greenwich continuation footer requires review.");
				continue;
			}
			const party = column[++index]?.text;
			if (!office || !term || !vote || !party || !parties.includes(party)) throw new Error("The East Greenwich candidate row requires review.");
			records.push(record(source, label, office, party, district, `${term}; ${vote}`));
			count++;
		}
		if (!count) throw new Error("The East Greenwich candidate column is incomplete.");
	}
	if (new Set(records.map(item => item.id)).size !== records.length || records.length > 300) throw new Error("The East Greenwich candidate identities require review.");
	records.sort((first, second) => offices.indexOf(first.office) - offices.indexOf(second.office));
	return { records, precinct, congressionalDistrict: districts[0]!, senateDistrict: districts[1]!, houseDistrict: districts[2]!, pageCount: 2 };
}
