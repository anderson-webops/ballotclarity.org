import type { StateCandidateValues } from "./state-ballot-additional-records.js";
import type { StateCandidateRecord } from "./state-ballot-records.js";
import type { StateBallotSource } from "./state-ballot-sources.js";
import { Buffer } from "node:buffer";
import { stateHtmlAttribute as attribute, stateHtmlDescendants as descendants, parseStateHtml, stateHtmlText } from "./state-ballot-html.js";
import { containsControlCharacters } from "./text-validation.js";

type Factory = (source: StateBallotSource, values: StateCandidateValues) => StateCandidateRecord | null;
interface Field { text: string; left: number; top: number; width: number; height: number; bold: boolean }
interface Office { label: string; top: number; section: string }
const clean = (value: string) => value.normalize("NFKC").replace(/\s+/gu, " ").trim();
function fail(detail: string): never {
	throw new Error(`The Winnebago ${detail} requires review.`);
}
const nameValue = (value: string) => value.length >= 4 && value.length <= 180 && value.includes(" ") && /^[\p{L}\p{M} .,'’\u0022-]+$/u.test(value) && !/\b(?:candidate|vacancy|requested|withdrawn)\b/iu.test(value);
const numberWords = ["ONE", "TWO", "THREE", "FOUR", "FIVE", "SIX", "SEVEN", "EIGHT", "NINE", "TEN", "ELEVEN", "TWELVE", "THIRTEEN", "FOURTEEN", "FIFTEEN", "SIXTEEN", "SEVENTEEN", "EIGHTEEN", "NINETEEN", "TWENTY"];
const categories = ["FEDERAL", "STATE", "COUNTY WIDE", "COUNTY BOARD", "NON-PARTISAN CANDIDATES:"];

function geography(office: Office): StateCandidateValues & { ballotDesignation?: string } {
	const label = office.label;
	const base = { name: "", party: "", status: "listed", office: label, district: "", scope: "local", jurisdiction: "Winnebago County, Illinois", sourceDistrictLabel: label } satisfies StateCandidateValues;
	if (["UNITED STATES SENATOR", "GOVERNOR/LIEUTENANT GOV.", "ATTORNEY GENERAL", "SECRETARY OF STATE", "STATE COMPTROLLER", "STATE TREASURER"].includes(label)) return { ...base, jurisdiction: "", sourceDistrictLabel: "", scope: "statewide" };
	const numbered = /^(\d{1,3})(?:ST|ND|RD|TH) (CONGRESSIONAL|SENATOR|REPRESENTATIVE)$/u.exec(label);
	if (numbered && Number(numbered[1]) > 0) return { ...base, jurisdiction: "", scope: numbered[2] === "CONGRESSIONAL" ? "congressional" : numbered[2] === "SENATOR" ? "state-senate" : "state-house", district: String(Number(numbered[1])) };
	if (office.section === "COUNTY BOARD") {
		const match = /^DISTRICT ([A-Z]+)(?: - UN-EXPIRED ([1-9]\d?)-YEAR TERM)?$/u.exec(label);
		const district = match ? numberWords.indexOf(match[1]!) + 1 : 0;
		if (!district) return fail("county-board district");
		return { ...base, office: `COUNTY BOARD DISTRICT ${district}`, jurisdiction: `Winnebago County, Illinois, County Board District ${district}`, ballotDesignation: match![2] ? `Unexpired ${match![2]}-year term` : "" };
	}
	if (/^(?:BOONE-WINNEBAGO|LEE\/OGLE\/WHITESIDE|DeKALB) SUPERINTENDENT OF SCHOOLS$/u.test(label)) return { ...base, jurisdiction: `Illinois, ${label.replace(/ SUPERINTENDENT OF SCHOOLS$/u, "")} school region` };
	if (/^[1-9]\d?(?:ST|ND|RD|TH) CIRCUIT - [1-9]\d?(?:ST|ND|RD|TH) SUB CIRCUIT [A-Z '’-]+ VACANCY$/u.test(label)) return { ...base, jurisdiction: `Illinois, ${label.split(" VACANCY")[0]}`, ballotDesignation: label.slice(label.indexOf("SUB CIRCUIT") + 12) };
	if (/^[1-9]\d?(?:ST|ND|RD|TH) (?:APPELLATE COURT JUDGE RETENTION|CIRCUIT COURT JUDGE RETENTIONS)$/u.test(label)) return { ...base, jurisdiction: `Illinois, ${label}`, ballotDesignation: "Judicial retention" };
	if (["COUNTY CLERK", "TREASURER", "SHERIFF", "FOREST PRESERVE COMMISSIONER"].includes(label)) return base;
	return fail("office vocabulary");
}

export function readWinnebagoCandidateDocument(source: StateBallotSource, body: string, factory: Factory) {
	if (source.stateCode !== "IL" || !/^20\d{2}-11-0[2-8]$/u.test(source.electionDate) || new Date(`${source.electionDate}T00:00:00Z`).getUTCDay() !== 2) return fail("election identity");
	if (Buffer.byteLength(body) > 4 * 1024 * 1024 || containsControlCharacters(body.replace(/[\r\n\t]/gu, "")) || body.includes("\uFFFD") || !/^<\?xml[^>]+>\s*<!DOCTYPE pdf2xml SYSTEM "pdf2xml.dtd">/u.test(body) || !/<\/pdf2xml>\s*$/u.test(body)) return fail("native document envelope");
	const document = parseStateHtml(body);
	const pending = [{ node: document, depth: 0 }];
	let visited = 0;
	while (pending.length) {
		const item = pending.pop()!;
		if (++visited > 60000 || item.depth > 80) return fail("native document bounds");
		for (const child of item.node.childNodes ?? []) pending.push({ node: child, depth: item.depth + 1 });
	}
	const pages = descendants(document, node => node.nodeName === "page");
	if (!pages.length || pages.length > 20 || descendants(document, node => ["image", "img", "script", "iframe", "object"].includes(node.nodeName)).length) return fail("page inventory");
	const records: StateCandidateRecord[] = [];
	const claims: { recordId: string; page: number; officeLabel: string; partyLabel: string }[] = [];
	const seen = new Set<string>();
	let section = "";
	let publicationDate = "";
	for (const [pageIndex, page] of pages.entries()) {
		if (attribute(page, "number") !== String(pageIndex + 1) || attribute(page, "width") !== "918" || attribute(page, "height") !== "1188") return fail("page sequence or dimensions");
		const fields: Field[] = descendants(page, node => node.nodeName === "text").map((node) => {
			const field = { text: clean(stateHtmlText(node)), left: Number(attribute(node, "left")), top: Number(attribute(node, "top")), width: Number(attribute(node, "width")), height: Number(attribute(node, "height")), bold: descendants(node, child => child.nodeName === "b").length > 0 };
			if ([field.left, field.top, field.width, field.height].some(value => !Number.isFinite(value)) || field.left < 0 || field.top < 0 || field.width < 0 || field.height <= 0 || field.left + field.width > 920 || field.top + field.height > 1190 || field.text.length > 500) return fail("text geometry");
			return field;
		}).filter(field => field.text);
		if (fields.length < 15 || fields.length > 4000) return fail("native text inventory");
		const required = [[434, 59, source.electionDate.slice(0, 4)], [346, 87, "GENERAL"], [456, 85, "ELECTION"], [372, 112, "List of Candidates"], [33, 167, "OFFICE"], [293, 167, "DEMOCRAT"], [681, 167, "REPUBLICAN"]] as const;
		if (required.some(([left, top, text]) => fields.filter(field => field.bold && field.left === left && field.top === top && field.text === text).length !== 1)) return fail("election or column headings");
		if (fields.filter(field => field.text === `Page ${pageIndex + 1} of ${pages.length}` && field.top > 1100).length !== 1 || fields.filter(field => field.text === `Page ${pageIndex + 1}` && field.top < 80).length !== 1) return fail("printed page inventory");
		const reportDates = fields.filter(field => field.left === 82 && field.top === 59 && /^\d{1,2}\/\d{1,2}\/20\d{2}$/u.test(field.text));
		if (reportDates.length !== 1) return fail("publication date");
		const [month, day, year] = reportDates[0]!.text.split("/");
		const reportDate = `${year}-${month!.padStart(2, "0")}-${day!.padStart(2, "0")}`;
		if (year !== source.electionDate.slice(0, 4) || !Number.isFinite(Date.parse(`${reportDate}T00:00:00Z`)) || new Date(`${reportDate}T00:00:00Z`).toISOString().slice(0, 10) !== reportDate || reportDate > source.electionDate) return fail("publication date");
		if (publicationDate && publicationDate !== reportDate) return fail("mixed publication dates");
		publicationDate = reportDate;
		const content = fields.filter(field => field.top > 175 && field.top < 1100);
		if (content.some(field => ![33, 293, 681].includes(field.left) || (field.left === 33 && !field.bold))) return fail("body column or office styling");
		if (fields.some(field => field.bold && !required.some(([left, top, text]) => field.left === left && field.top === top && field.text === text) && !content.includes(field))) return fail("unexpected heading");
		const offices: Office[] = [];
		const officeFields = content.filter(field => field.bold && field.left === 33).sort((first, second) => first.top - second.top);
		for (const field of officeFields) {
			const category = field.text.replace(/ \(cont\.\)$/u, "");
			if (categories.includes(category)) {
				section = category;
				continue;
			}
			if (!section) return fail("office category");
			const previous = offices.at(-1);
			if (field.text === "OF SCHOOLS" || field.text === "COMMISSIONER" || /^[A-Z '’-]+ VACANCY$/u.test(field.text) || /^UN-EXPIRED [1-9]\d?-YEAR TERM$/u.test(field.text)) {
				if (!previous || field.top - previous.top > 23 || previous.section !== section) return fail("wrapped office label");
				previous.label += ` ${field.text}`;
			}
			else {
				offices.push({ label: field.text, top: field.top, section });
			}
		}
		if (!offices.length) return fail("empty office page");
		for (const [officeIndex, office] of offices.entries()) {
			const values = geography(office);
			const end = offices[officeIndex + 1]?.top ?? 1100;
			const rows = content.filter(field => field.top >= office.top && field.top < end && field.left !== 33);
			if (rows.some(field => field.bold && ![293, 681].includes(field.left))) return fail("candidate column alignment");
			let count = 0;
			for (const [left, label] of [[293, "DEMOCRAT"], [681, "REPUBLICAN"]] as const) {
				let party = office.section === "NON-PARTISAN CANDIDATES:" ? "Nonpartisan" : label;
				const named = rows.filter(field => field.left === left && field.bold).sort((first, second) => first.top - second.top);
				const contact = rows.filter(field => field.left === left && !field.bold);
				if (contact.some(field => field.text !== "Redaction Requested" && !/^\d[\p{L}\p{N} .,'’@:/_()&+-]*$/u.test(field.text) && !/^[\p{L} .,'’-]+ II?L? \d{5}(?:-\d{4})?$/u.test(field.text) && !/^[^\s@]+@[^\s@][^\s.@]*\.[^\s@]+$/u.test(field.text) && !/^https?:\/\/\S+$/u.test(field.text)) || (contact.length > 0 && !named.length)) return fail("unclassified candidate or contact text");
				if (party === "Nonpartisan" && left === 681 && named.length) return fail("nonpartisan column");
				const names: string[] = [];
				for (const field of named) {
					if (field.text === "NO CANDIDATE") continue;
					if (field.text === "INDEPENDENT CANDIDATE") {
						if (names.length || party !== "DEMOCRAT" || named.filter(item => item.text === "INDEPENDENT CANDIDATE").length !== 1) return fail("independent candidate marker");
						party = "Independent";
						continue;
					}
					if (/^\d[A-Z0-9 .,-]+(?:AVE|RD|ST|CT|DR|PKWY|CIR)\.$/u.test(field.text) && names.length) continue;
					if (!nameValue(field.text.replace(/ \/$/u, ""))) return fail("candidate name");
					names.push(field.text);
				}
				if (party === "Independent" && names.length !== 1) return fail("independent candidate count");
				const ticket = office.label === "GOVERNOR/LIEUTENANT GOV.";
				if (ticket && names.length && (names.length !== 2 || !names[0]!.endsWith(" /") || names[1]!.includes("/"))) return fail("printed joint ticket");
				if (!ticket && office.section !== "NON-PARTISAN CANDIDATES:" && names.length > 1) return fail("multiple party candidates");
				for (const name of ticket && names.length ? [[names[0]!.slice(0, -2), names[1]!].join(" / ")] : names) {
					const candidateOffice = values.ballotDesignation === "Judicial retention" ? `${values.office.replace(/RETENTIONS$/u, "RETENTION")}: ${name}` : values.office;
					const record = factory(source, { ...values, office: candidateOffice, name, party });
					if (!record || seen.has(record.id)) return fail("candidate identity");
					record.sourceStatus = "Published general-election candidate";
					if (values.ballotDesignation) record.ballotDesignation = values.ballotDesignation;
					seen.add(record.id);
					records.push(record);
					count++;
					claims.push({ recordId: record.id, page: pageIndex + 1, officeLabel: office.label, partyLabel: party === "Nonpartisan" ? "NON-PARTISAN CANDIDATES:" : party });
				}
			}
			if (!count) return fail("empty candidate office");
		}
	}
	if (!records.length || records.length > 2000) return fail("candidate count");
	return { records, claims, pageCount: pages.length };
}
