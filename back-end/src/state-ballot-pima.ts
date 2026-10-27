import type { PimaDocumentKind, PimaNativeField } from "./state-ballot-pima-native.js";
import type { StateCandidateRecord, StateContestScope } from "./state-ballot-records.js";
import type { StateBallotSource } from "./state-ballot-sources.js";
import { createHash } from "node:crypto";
import { pimaNativePages } from "./state-ballot-pima-native.js";
import { inspectPimaVisual } from "./state-ballot-pima-visual.js";

interface Office {
	office: string;
	scope: StateContestScope;
	district: string;
	jurisdiction?: string;
	termEnd?: string;
	voteLimit?: number;
	spanishVote?: boolean;
	spanishOffice?: boolean;
	candidates: number;
	exclude?: string;
}
export interface PimaClaim {
	name: string;
	party: string;
	office: string;
	district: string;
	jurisdiction?: string;
	page: number;
	recordId?: string;
	exclusion?: string;
}
const translations: Record<string, string> = {
	"U.S. Representative in Congress": "Representante de EE. UU. en el Congreso",
	"Governor and Lieutenant Governor": "Gobernador y Vicegobernador",
	"State Senator": "Senador Estatal",
	"State Representative": "Representante Estatal",
	"Secretary of State": "Secretario de Estado",
	"Attorney General": "Procurador General",
	"State Treasurer": "Tesorero Estatal",
	"Superintendent of Public Instruction": "Superintendente de Instrucción Pública",
	"State Mine Inspector": "Inspector Estatal de Minas",
	"Corporation Commissioner": "Comisionado de Corporaciones",
	"Board of Supervisors": "Junta de Supervisores",
	"Clerk of the Superior Court": "Archivero de la Corte Superior",
	"Justice of the Peace": "Juez de Paz",
	"Constable": "Alguacil",
	"Justice of the Arizona Supreme Court": "Juez de la Corte Suprema de Arizona",
	"Judge of the Court of Appeals Division II": "Juez de la Tribunal de Apelacíon División II",
	"Judge of the Superior Court": "Juez del Tribunal Superior",
	"Governing Board": "Junta de Gobierno",
	"Board Member": "Miembro de Junta",
	"Council Member": "Miembro de Concejo",
};
const categories = ["United States Offices", "State Offices", "County Offices", "Judges", "Nonpartisan Contests (Schools, Fire Districts, Municipalities)"];
const parties = new Set(["DEM", "REP", "LBT", "GRN", "PND", "NOL", "IND", "NONPARTISAN"]);
function reject(reason: string): never {
	throw new Error(`The Pima ${reason} requires review.`);
}
function base(label: string): Office {
	const scope: StateContestScope = label === "U.S. Representative in Congress" ? "congressional" : label === "State Senator" ? "state-senate" : label === "State Representative" ? "state-house" : ["Governor and Lieutenant Governor", "Secretary of State", "Attorney General", "State Treasurer", "Superintendent of Public Instruction", "State Mine Inspector", "Corporation Commissioner", "Justice of the Arizona Supreme Court"].includes(label) ? "statewide" : "local";
	const exclude = label === "Governor and Lieutenant Governor" ? "Running-mate pairing is not established by this list." : /^(?:Justice of the Arizona Supreme Court|Judge of the)/u.test(label) ? "Judicial retention requires separate corroboration." : undefined;
	return { office: label, scope, district: "", ...(scope === "local" ? { jurisdiction: "Pima County" } : {}), candidates: 0, ...(exclude ? { exclude } : {}) };
}
function nameValid(name: string) {
	return name.length <= 200 && /^[\p{L}\p{M} .,'’"-]+$/u.test(name) && /\p{L}/u.test(name) && name === name.toUpperCase();
}
function identity(source: StateBallotSource, office: Office, name: string, party: string, status: "listed" | "write-in"): StateCandidateRecord {
	const label = office.office + (office.termEnd ? ` (Term expires ${office.termEnd})` : "");
	return { id: createHash("sha256").update(JSON.stringify([source.id, source.electionDate, label, office.district, office.jurisdiction ?? "", name, party, status])).digest("hex").slice(0, 24), name, office: label, party, scope: office.scope, district: office.district, status, ...(office.jurisdiction ? { jurisdiction: office.jurisdiction } : {}), ...(office.district ? { sourceDistrictLabel: `${["Justice of the Peace", "Constable"].includes(office.office) ? "Justice Prec." : "Dist."} ${office.district}` } : {}), ...(office.termEnd ? { termEnd: office.termEnd } : {}), ...(office.voteLimit ? { voteLimit: office.voteLimit } : {}) };
}
function rows(fields: readonly PimaNativeField[]) {
	const result: PimaNativeField[][] = [];
	for (const field of fields) {
		const previous = result.at(-1);
		if (previous && field.top - previous[0]!.top <= 3)
			previous.push(field);
		else
			result.push([field]);
	}
	return result.map(row => row.sort((first, second) => first.left - second.left));
}
export function readPimaFields(source: StateBallotSource, pages: readonly (readonly PimaNativeField[])[], kind: PimaDocumentKind) {
	if (source.stateCode !== "AZ" || !/^20\d{2}-11-0[2-8]$/u.test(source.electionDate) || Number(source.electionDate.slice(0, 4)) % 2 || new Date(`${source.electionDate}T00:00:00Z`).getUTCDay() !== 2 || !pages.length || pages.length > 20)
		return reject("election");
	const records: StateCandidateRecord[] = [];
	const claims: PimaClaim[] = [];
	function add(office: Office, name: string, party: string, page: number, status: "listed" | "write-in") {
		const judicialName = office.exclude?.startsWith("Judicial") ? name.replace(/ - DIVISION [1-9]\d?$/u, "") : name;
		if (!nameValid(judicialName) || !parties.has(party))
			return reject("candidate row");
		office.candidates++;
		const claim: PimaClaim = { name, party, office: office.office, district: office.district, ...(office.jurisdiction ? { jurisdiction: office.jurisdiction } : {}), page };
		if (office.exclude) {
			claim.exclusion = office.exclude;
		}
		else {
			const record = identity(source, office, name, party, status);
			if (records.some(item => item.id === record.id))
				return reject("duplicate candidate");
			records.push(record);
			claim.recordId = record.id;
		}
		claims.push(claim);
	}
	if (kind === "write-ins") {
		if (pages.length !== 1)
			return reject("write-in pages");
		const fields = pages[0]!;
		const day = Number(source.electionDate.slice(8));
		const year = source.electionDate.slice(0, 4);
		const fixed = ["PIMA COUNTY, STATE OF ARIZONA", `GENERAL ELECTION - NOVEMBER ${day}, ${year} /`, `ELECCION GENERAL - ${day} DE NOVIEMBRE DE ${year}`, "WRITE-IN LIST / LISTA CANDIDATOS POR ESCRITO", "NAME / NOMBRE", "OFFICE / PUESTO", "PARTY /", "PARTIDO", "In accordance with A.R.S. 16-312 et seq. only the above names will be counted in the tally of ballots.", "De acuerdo con A.R.S. 16-312 et seq. solamente los nombres sobre escritos serán contados en la escrutación de", "boletas."];
		for (const label of fixed) {
			if (fields.filter(field => field.text === label && field.bold).length !== 1)
				return reject("write-in heading");
		}
		const body = fields.filter(field => !fixed.includes(field.text));
		if (body.some(field => field.bold || field.top < 190 || field.top > 790))
			return reject("write-in body");
		const names = body.filter(field => Math.abs(field.left - 41) <= 1);
		if (!names.length || names.length > 100)
			return reject("write-in names");
		const used = new Set(names);
		for (const [index, name] of names.entries()) {
			const top = index ? (names[index - 1]!.top + name.top) / 2 : 190;
			const bottom = names[index + 1] ? (names[index + 1]!.top + name.top) / 2 : 790;
			const row = body.filter(field => field !== name && field.top >= top && field.top < bottom);
			if (row.some(field => used.has(field)))
				return reject("write-in row overlap");
			row.forEach(field => used.add(field));
			const partyFields = row.filter(field => field.left >= 790 && field.left <= 825);
			const officeFields = row.filter(field => field.left >= 230 && field.left < 790);
			if (partyFields.length !== 1 || !officeFields.length || partyFields.length + officeFields.length !== row.length)
				return reject("write-in columns");
			const printed = officeFields.map(field => field.text).join(" ");
			const parts = printed.split(" / ");
			if (parts.length !== 2 || !parts[1] || !/^[\p{L}\p{M}\d .,/-]+$/u.test(parts[1]))
				return reject("write-in office translation");
			const label = parts[0]!;
			let office: Office;
			const district = /^(U\.S\. REPRESENTATIVE IN CONGRESS - DISTRICT|BOARD OF SUPERVISORS - DISTRICT|JUSTICE OF THE PEACE - PRECINCT|CONSTABLE, JUSTICE PRECINCT) ([1-9]\d?)$/u.exec(label);
			const jurisdiction = /^(GOVERNING BOARD|BOARD MEMBER) - ([\p{L}\p{M}\d .-]+)$/u.exec(label);
			if (district) {
				office = base(district[1]!.startsWith("U.S.") ? "U.S. Representative in Congress" : district[1]!.startsWith("BOARD") ? "Board of Supervisors" : district[1]!.startsWith("JUSTICE") ? "Justice of the Peace" : "Constable");
				office.district = district[2]!;
			}
			else if (jurisdiction) {
				office = base(jurisdiction[1] === "GOVERNING BOARD" ? "Governing Board" : "Board Member");
				office.jurisdiction = jurisdiction[2]!;
				if (!(office.office === "Governing Board" ? / Unified School District No\. [1-9]\d?$/iu : / Fire District$/iu).test(office.jurisdiction))
					return reject("write-in jurisdiction");
			}
			else if (label === "GOVERNOR") {
				office = base("Governor and Lieutenant Governor");
			}
			else if (label === "SUPERINTENDENT OF PUBLIC INSTRUCTION") {
				office = base("Superintendent of Public Instruction");
			}
			else {
				return reject("write-in office");
			}
			add(office, name.text, partyFields[0]!.text === "NON" ? "NONPARTISAN" : partyFields[0]!.text, 1, "write-in");
		}
		if (used.size !== body.length)
			return reject("write-in field inventory");
		return { records, claims };
	}
	let office: Office | undefined;
	let sourceAsOfDate: string | undefined;
	function finish() {
		if (office && (!office.candidates || !office.spanishOffice || (!office.exclude?.startsWith("Judicial") && (!office.voteLimit || !office.spanishVote)) || (["congressional", "state-senate", "state-house"].includes(office.scope) && !office.district) || (["Governing Board", "Board Member", "Council Member"].includes(office.office) && office.jurisdiction === "Pima County")))
			return reject("office completeness");
	}
	for (const [pageIndex, fields] of pages.entries()) {
		const header = fields.filter(field => field.top < 70);
		if (header.length !== 2 || header[0]!.text !== `General Election-November ${Number(source.electionDate.slice(8))}, ${source.electionDate.slice(0, 4)}` || header[1]!.text !== "Candidate List" || header.some(field => field.bold))
			return reject("candidate date heading");
		const footer = fields.filter(field => field.top > 1110);
		const stamp = footer.find(field => field.text.startsWith("UPDATED:"));
		const date = stamp && /^UPDATED: ([1-9]|1[0-2])\/([1-9]|[12]\d|3[01])\/(20\d{2}) (?:[1-9]|1[0-2]):[0-5]\d (?:AM|PM)$/u.exec(stamp.text);
		const updated = date ? `${date[3]}-${date[1]!.padStart(2, "0")}-${date[2]!.padStart(2, "0")}` : "";
		if (footer.length !== 2 || !updated || !Number.isFinite(Date.parse(updated)) || new Date(`${updated}T00:00:00Z`).toISOString().slice(0, 10) !== updated || updated > source.electionDate || updated.slice(0, 4) !== source.electionDate.slice(0, 4) || (sourceAsOfDate && sourceAsOfDate !== updated) || footer.filter(field => field.text === `Page ${pageIndex + 1} of ${pages.length}`).length !== 1 || footer.some(field => field.bold))
			return reject("candidate publication stamp");
		sourceAsOfDate = updated;
		for (const row of rows(fields.filter(field => field.top >= 70 && field.top <= 1110))) {
			const candidate = row.find(field => Math.abs(field.left - 186) <= 1);
			if (candidate) {
				if (!office || candidate.bold || row.length > 2 || row.some(field => field !== candidate && (Math.abs(field.left - 79) > 1 || field.bold)))
					return reject("candidate columns");
				const party = row.find(field => field !== candidate);
				const placeholder = /^\( ?[1-9]\d? Write-In Candidates?\)$/u.test(candidate.text);
				if (placeholder) {
					if (party && party.text !== "NONPARTISAN")
						return reject("write-in placeholder");
					office.candidates++;
					continue;
				}
				if (!party || (!office.exclude?.startsWith("Judicial") && (!office.voteLimit || !office.spanishVote)))
					return reject("candidate instructions");
				add(office, candidate.text, party.text, pageIndex + 1, "listed");
				continue;
			}
			if (row.length !== 1 || row[0]!.left < 180 || row[0]!.left > 440)
				return reject("heading geometry");
			const field = row[0]!;
			if (field.bold && categories.includes(field.text)) {
				finish();
				office = undefined;
				continue;
			}
			if (field.bold && Object.hasOwn(translations, field.text)) {
				finish();
				office = base(field.text);
				continue;
			}
			if (!office)
				return reject("office context");
			if (!field.bold && field.text === translations[office.office] && !office.spanishOffice && !office.candidates) {
				office.spanishOffice = true;
				continue;
			}
			const district = /^(Dist\.|Justice Prec\.) ([1-9]\d?)$/u.exec(field.text);
			if (field.bold && district && !office.candidates && !office.district && (district[1] === "Justice Prec." ? ["Justice of the Peace", "Constable"].includes(office.office) : ["U.S. Representative in Congress", "State Senator", "State Representative", "Board of Supervisors"].includes(office.office))) {
				office.district = district[2]!;
				continue;
			}
			if (!field.bold && field.text === `Dist. de Justicia ${office.district}` && office.district && ["Justice of the Peace", "Constable"].includes(office.office))
				continue;
			const vote = /^Vote for not more than ([1-9]|10)$/u.exec(field.text);
			if (field.bold && vote && !office.voteLimit && !office.candidates && !office.exclude?.startsWith("Judicial")) {
				office.voteLimit = Number(vote[1]);
				continue;
			}
			if (!field.bold && field.text === `Vote por no más de ${office.voteLimit}` && office.voteLimit && !office.spanishVote && !office.candidates) {
				office.spanishVote = true;
				continue;
			}
			if (["Governing Board", "Board Member", "Council Member"].includes(office.office) && !office.candidates) {
				if (field.bold && office.jurisdiction === "Pima County" && /^(?:[\p{L}\p{M}\d .-]+ (?:Unified School District No\. [1-9]\d?|Fire District)|Joint Technical Education District [1-9]\d?|City of [\p{L} .-]+)$/u.test(field.text)) {
					office.jurisdiction = field.text;
					continue;
				}
				if (!field.bold && /^(?:Distrito (?:Unificado Escolar|Conjunto de Educación Técnica|de Bomberos)|Ciudad de) [\p{L}\p{M}\d .-]+$/u.test(field.text) && office.jurisdiction !== "Pima County")
					continue;
				const term = /^Term expires (\d{2})\/(\d{2})\/(20\d{2})$/u.exec(field.text);
				if (field.bold && term && !office.termEnd) {
					const end = `${term[3]}-${term[1]}-${term[2]}`;
					if (!Number.isFinite(Date.parse(end)) || new Date(`${end}T00:00:00Z`).toISOString().slice(0, 10) !== end || end < source.electionDate)
						return reject("term date");
					office.termEnd = end;
					continue;
				}
				if (!field.bold && office.termEnd && field.text === `Cargo vence ${office.termEnd.slice(8)}/${office.termEnd.slice(5, 7)}/${office.termEnd.slice(0, 4)}`)
					continue;
			}
			return reject("unrecognized field");
		}
	}
	finish();
	if (!records.length || records.length > 1000 || !sourceAsOfDate)
		return reject("record inventory");
	return { records, claims, sourceAsOfDate };
}
export function readPimaDocument(source: StateBallotSource, xml: string, svgPages: readonly string[], kind: PimaDocumentKind) {
	const pages = pimaNativePages(xml, kind);
	if (svgPages.length !== pages.length)
		return reject("visible page inventory");
	const visual = svgPages.map((svg, index) => inspectPimaVisual(xml, svg, index + 1, kind));
	return { ...readPimaFields(source, pages, kind), visual };
}
