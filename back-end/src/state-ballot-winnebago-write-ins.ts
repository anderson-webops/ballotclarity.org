import type { StateCandidateRecord } from "./state-ballot-records.js";
import type { StateBallotSource } from "./state-ballot-sources.js";
import { winnebagoNativePages } from "./state-ballot-winnebago-native.js";

export function readWinnebagoWriteIns(source: StateBallotSource, body: string, factory: typeof import("./state-ballot-records.js").createStateCandidateRecord) {
	const reject = (): never => {
		throw new Error("The Winnebago write-in publication requires review.");
	};
	if (source.stateCode !== "IL" || !/^20\d{2}-11-0[2-8]$/u.test(source.electionDate) || new Date(`${source.electionDate}T00:00:00Z`).getUTCDay() !== 2) return reject();
	const pages = winnebagoNativePages(body);
	if (pages.length !== 1) return reject();
	const date = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${source.electionDate}T00:00:00Z`)).toUpperCase();
	const headings = ["WINNEBAGO COUNTY", "VALID WRITE-IN CANDIDATE", "GENERAL ELECTION", date];
	const fields = pages[0]!;
	if (headings.some(text => fields.filter(field => field.text === text && field.top < 240 && field.bold).length !== 1) || fields.some(field => !field.bold || (field.top < 240 && !headings.includes(field.text)))) return reject();
	const bodyFields = fields.filter(field => field.top >= 240).sort((first, second) => first.top - second.top || first.left - second.left);
	const lines: { top: number; office: string; name: string; parts: { left: number; text: string }[] }[] = [];
	for (const field of bodyFields) {
		let line = lines.at(-1);
		if (!line || field.top - line.top > 3) lines.push(line = { top: field.top, office: "", name: "", parts: [] });
		if (field.left >= 150 && field.left < 450) line.parts.push({ left: field.left, text: field.text });
		else if (field.left === 540 && !line.name && /^- [\p{L}\p{M} .,'’\u0022-]+$/u.test(field.text)) line.name = field.text.slice(2);
		else return reject();
	}
	for (const line of lines) line.office = line.parts.sort((first, second) => first.left - second.left).map(part => part.text).join(" ");
	const records: StateCandidateRecord[] = [];
	const held: { name: string; printedOffice: string; reason: "unpaired-executive-entry" }[] = [];
	const seen = new Set<string>();
	let printedPeople = 0;
	function add(name: string, office: string, scope: "statewide" | "congressional" | "local", district = "", jurisdiction = "") {
		const record = factory(source, { name, office, party: "", status: "write-in", scope, district, jurisdiction });
		if (!record || seen.has(record.id)) return reject();
		seen.add(record.id);
		record.sourceStatus = "Valid write-in candidate";
		records.push(record);
	}
	for (let index = 0; index < lines.length; index++) {
		const line = lines[index]!;
		if (!line.office || line.name.length > 180 || (line.name && !line.name.includes(" "))) return reject();
		if (line.office === "GOVERNOR /" && !line.name) {
			const next = lines[++index];
			if (!next || next.top - line.top > 23 || !/^L(?:EI|IE)UTENANT GOVERNOR [-–]$/u.test(next.office) || !next.name) return reject();
			held.push({ name: next.name, printedOffice: `${line.office} ${next.office}`, reason: "unpaired-executive-entry" });
			printedPeople++;
		}
		else if (line.office === "GOVERNOR /" && line.name) {
			const next = lines[++index];
			if (!next || next.top - line.top > 23 || next.top <= line.top || !/^L(?:EI|IE)UTENANT GOVERNOR -$/u.test(next.office) || !next.name) return reject();
			add(`${line.name} / ${next.name}`, "GOVERNOR/LIEUTENANT GOV.", "statewide");
			printedPeople += 2;
		}
		else if (/^(?:GOVERNOR|L(?:EI|IE)UTENANT GOVERNOR)(?: -)?$/u.test(line.office) && line.name) {
			held.push({ name: line.name, printedOffice: line.office, reason: "unpaired-executive-entry" });
			printedPeople++;
		}
		else if (["STATE TREASURER -", "STATE COMPTROLLER -"].includes(line.office) && line.name) {
			add(line.name, line.office.slice(0, -2), "statewide");
			printedPeople++;
		}
		else {
			const district = /^([1-9]\d?) (?:st|nd|rd|th) CONGRESSIONAL DISTRICT -$/u.exec(line.office);
			const board = /^COUNTY BOARD DISTRICT ([1-9]\d?)$/u.exec(line.office);
			if (!line.name || (!district && !board)) return reject();
			if (district) add(line.name, `${district[1]}${line.office.split(" ")[1]!.toUpperCase()} CONGRESSIONAL`, "congressional", district[1]);
			else add(line.name, `COUNTY BOARD DISTRICT ${board![1]}`, "local", "", `Winnebago County, Illinois, County Board District ${board![1]}`);
			printedPeople++;
		}
	}
	if (!printedPeople || printedPeople > 500 || new Set(held.map(entry => `${entry.name}|${entry.printedOffice}`)).size !== held.length) return reject();
	return { records, held, printedPeople, pageCount: 1 };
}
