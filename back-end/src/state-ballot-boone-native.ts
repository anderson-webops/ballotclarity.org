import type { Buffer } from "node:buffer";
import type { StateBallotWorkbookSheet } from "./state-ballot-workbook.js";
import { createHash } from "node:crypto";
import { readStateBallotWorkbook } from "./state-ballot-workbook.js";
import { containsControlCharacters } from "./text-validation.js";

export interface BooneCandidateClaim {
	name: string;
	office: string;
	officePath: string[];
	party?: string;
	sourcePartyCode?: string;
	sourceDistrictLabel?: string;
	ballotExclusion?: true;
	ballotInstruction?: "Do not put on ballot";
	sourceRow: number;
}

function reject(): never {
	throw new Error("The Boone County candidate workbook requires review.");
}
function cell(value: unknown) {
	if (value === null || value === undefined) return "";
	if (typeof value !== "string" || value.length > 1000 || containsControlCharacters(value.replace(/[\r\n\t]/gu, ""))) return reject();
	return value.normalize("NFKC").replace(/\s+/gu, " ").trim();
}
function section(value: string) {
	return /^(?:Assessor|Clerk|Prosecutor|Sheriff|Surveyor|Commissioners District [1-3]|County Council District #[1-4]|Trustee \([A-Za-z ]+ Twp\.\)|Trustee Washington|[A-Za-z ]+ (?:Township|Twp\.?) Advisory Board|Sugar Creek Advisory Board|[A-Za-z ]+ (?:Clerk Treasurer|Town Board|Town Council(?: \([1-9]\d?\))?)|Boone Superior Court (?:I|II|III)|Western Boone|[A-Za-z ]+ School Corp)$/u.test(value);
}
const divisions = new Set(["At-Large", "Adams", "Center", "Clinton", "Eagle", "Harrison", "Jackson", "Jefferson", "Marion", "Perry", "Sugar Creek", "Union", "Washington", "Worth"]);
const parties: Readonly<Record<string, string>> = { R: "Republican", D: "Democratic", I: "Independent" };

export function parseBooneCandidateSheets(sheets: StateBallotWorkbookSheet[]) {
	if (!Array.isArray(sheets) || sheets.length !== 1 || sheets[0]?.sheet !== "Sheet1" || !Array.isArray(sheets[0].data) || sheets[0].data.length < 3 || sheets[0].data.length > 2000) return reject();
	const rows = sheets[0].data;
	if (JSON.stringify(rows[0]) !== JSON.stringify(["Candidate Name", null, "Office", "Party", "Address", "Contact"])) return reject();
	const claims: BooneCandidateClaim[] = [];
	const offices: { path: string[]; sourceRow: number; areaNotes: { text: string; sourceRow: number }[] }[] = [];
	const identities = new Set<string>();
	let current: typeof offices[number] | undefined;
	let currentSection = "";
	let school = false;
	for (let index = 1; index < rows.length; index++) {
		const row = rows[index];
		if (!Array.isArray(row) || row.length > 6) return reject();
		const [name, unused, office, party, address, contact] = Array.from({ length: 6 }, (_, column) => cell(row[column]));
		if (unused) return reject();
		if (![name, office, party, address, contact].some(Boolean)) continue;
		if (!name) {
			if (!office || party || address || contact) return reject();
			if (section(office!)) {
				currentSection = office!;
				school = office === "Western Boone" || office!.endsWith(" School Corp");
				current = school ? undefined : { path: [office!], sourceRow: index + 1, areaNotes: [] };
				if (current) offices.push(current);
			}
			else if (school && divisions.has(office!)) {
				current = { path: [currentSection, office!], sourceRow: index + 1, areaNotes: [] };
				offices.push(current);
			}
			else if (current && /^(?:County Council District #[1-4]|Commissioners District [1-3])$/u.test(currentSection) && /^(?:Center|Clinton|Eagle|Harrison|Jackson|Jefferson|Marion|Perry|Sugar Creek|Union|Washington|Worth)(?:[ ,0-9-]|$)[A-Za-z0-9 ,.-]*$/u.test(office!)) {
				current.areaNotes.push({ text: office!, sourceRow: index + 1 });
			}
			else {
				return reject();
			}
			continue;
		}
		if (!current || name!.length > 250 || name === "Candidate Name" || (party && !["R", "D", "I"].includes(party!))) return reject();
		const district = /^District #([1-4])$/u.exec(office!);
		const instruction = office === "Do not put on ballot";
		if (office && !instruction && (!district || district[1] !== /^County Council District #([1-4])$/u.exec(currentSection)?.[1])) return reject();
		const key = JSON.stringify([current.path, name!.toLowerCase(), party]);
		if (identities.has(key)) return reject();
		identities.add(key);
		claims.push({ name: name!, office: current.path.join(" / "), officePath: [...current.path], sourceRow: index + 1, ...(party ? { sourcePartyCode: party, party: parties[party]! } : {}), ...(district ? { sourceDistrictLabel: office } : {}), ...(instruction ? { ballotExclusion: true, ballotInstruction: "Do not put on ballot" as const } : {}) });
	}
	if (!claims.length || claims.length > 1000) return reject();
	return { claims, offices, sourceRows: rows.length };
}

export async function readBooneCandidateDocument(bytes: Buffer) {
	return { sourceSha256: createHash("sha256").update(bytes).digest("hex"), ...parseBooneCandidateSheets(await readStateBallotWorkbook(bytes, "boone-candidates")) };
}
