import type { StateHtmlNode } from "./state-ballot-html.js";
import type { StateBallotSnapshot } from "./state-ballot-repository.js";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { stateHtmlAttribute as attribute, stateHtmlDescendants as descendants, parseStateHtml, stateHtmlText } from "./state-ballot-html.js";
import { isActiveStateCandidateRecord } from "./state-ballot-records.js";

export const hennepinOfficeSource = {
	id: "mn-hennepin-offices",
	stateCode: "MN",
	countyName: "Hennepin County",
	url: "https://www.hennepincounty.gov/services/elections/offices-on-the-ballot",
} as const;

type ComparisonRole = "us-senate" | "us-house" | "president-ticket" | "governor-ticket" | "secretary-state" | "auditor" | "attorney-general" | "state-senate" | "state-house";
export interface ScheduledOfficeRow {
	id: string;
	group: string;
	kind: "office" | "district-list" | "jurisdiction-summary";
	office: string;
	area?: string;
	districts?: string[];
	comparisonRole?: ComparisonRole;
}
export interface ElectionOfficeInventory {
	schemaVersion: 1;
	type: "scheduled-office-inventory";
	sourceId: string;
	stateCode: string;
	countyName: string;
	electionDate: string;
	publicationDate: string;
	sourceUrl: string;
	sourceSha256: string;
	retrievedAt: string;
	rows: ScheduledOfficeRow[];
	questionReferences: { label: string; url: string }[];
}

const hash = (body: string) => createHash("sha256").update(body).digest("hex");
const clean = (value: string) => value.normalize("NFKC").replace(/\s+/gu, " ").trim();
const text = (node: StateHtmlNode) => clean(stateHtmlText(node));
const groups = ["Federal Offices", "State Offices", "Constitutional Amendment", "County Offices", "City Offices", "School District Offices", "Judicial Offices"];
const requiredGroups = groups.filter(group => group !== "Constitutional Amendment");
const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const statewideRoles: Record<string, ComparisonRole> = {
	"United States Senator": "us-senate",
	"President and Vice President": "president-ticket",
	"Governor and Lieutenant Governor": "governor-ticket",
	"Secretary of State": "secretary-state",
	"State Auditor": "auditor",
	"Attorney General": "attorney-general",
};

function date(value: string) {
	const match = /^([A-Z][a-z]+) ([1-9]\d?), (20\d{2})$/u.exec(value);
	if (!match || !months.includes(match[1]!)) throw new Error("The office inventory date requires review.");
	const result = `${match[3]}-${String(months.indexOf(match[1]!) + 1).padStart(2, "0")}-${match[2]!.padStart(2, "0")}`;
	if (!Number.isFinite(Date.parse(result)) || new Date(result).toISOString().slice(0, 10) !== result) throw new Error("The office inventory date is invalid.");
	return result;
}

function districtList(value: string, letters = false) {
	if (!/^[\dAB,\s]+(?:and [\dAB]+)?$/u.test(value)) throw new Error("The scheduled district list requires review.");
	const items = value.replace(/\band\b/gu, ",").split(",").map(clean).filter(Boolean);
	const pattern = letters ? /^[1-9]\d?[AB]$/u : /^[1-9]\d?$/u;
	if (!items.length || items.length > 100 || items.some(item => !pattern.test(item)) || new Set(items).size !== items.length) throw new Error("The scheduled districts are incomplete or duplicated.");
	return items;
}

function officeValues(group: string, court: string, value: string): Omit<ScheduledOfficeRow, "id" | "group"> {
	if (["Federal Offices", "State Offices"].includes(group)) {
		const role = statewideRoles[value];
		if (role && (group === "Federal Offices") === ["us-senate", "president-ticket"].includes(role)) return { kind: "office", office: value, comparisonRole: role };
		const match = /^(United States Representative|State Senator|State Representative)(?: for)? Districts: (.+)$/u.exec(value);
		if (match && (group === "Federal Offices") === (match[1] === "United States Representative")) return { kind: "district-list", office: match[1]!, districts: districtList(match[2]!, match[1] === "State Representative"), comparisonRole: match[1] === "United States Representative" ? "us-house" : match[1] === "State Senator" ? "state-senate" : "state-house" };
	}
	if (group === "County Offices") {
		if (["County Attorney", "County Sheriff"].includes(value)) return { kind: "office", office: value };
		const match = /^(County Commissioner|Three Rivers Park Commissioner) for Districts (.+)$/u.exec(value);
		if (match) return { kind: "district-list", office: match[1]!, districts: districtList(match[2]!) };
	}
	if (["City Offices", "School District Offices"].includes(group)) {
		const match = /^([\p{L}\d .'-]{1,100})(?::|,) (.{1,500})$/u.exec(value);
		if (!match || (group === "School District Offices" && !/^(?:Minneapolis SSD|ISD) \d+/u.test(match[1]!)) || !/Mayor|Council member|School Board member|Treasurer/u.test(match[2]!)) throw new Error("The local office inventory requires review.");
		return { kind: "jurisdiction-summary", area: match[1]!, office: match[2]! };
	}
	if (group === "Judicial Offices") {
		if (!["Supreme Court", "Court of Appeals", "4th District Court"].includes(court)) throw new Error("The judicial office context requires review.");
		const named = /^(.+?) \(([^()]+)\)$/u.exec(value);
		if (named && (!/^\p{Lu}/u.test(named[2]!) || !named[2]!.includes(" ") || !Array.from(named[2]!).every(character => /^[\p{L} .'-]$/u.test(character) || /^\p{M}$/u.test(character)) || /unexpired|term|year|vacan|appoint|retention/iu.test(named[2]!))) throw new Error("The judicial reference is not a verified name-only annotation.");
		const office = named?.[1] ?? value;
		if (court === "4th District Court" ? !/^Judge, Fourth District Court, Seat [1-9]\d?$/u.test(office) : !/^Associate Justice, (?:Seat )?[1-9]\d?$/u.test(office)) throw new Error("The scheduled judicial office requires review.");
		return { kind: "office", area: court, office };
	}
	throw new Error("The scheduled office label requires review.");
}

export function parseHennepinOfficeInventory(body: string, retrievedAt: string, now = Date.now()): ElectionOfficeInventory {
	if (Buffer.byteLength(body) > 2 * 1024 * 1024 || !Number.isFinite(Date.parse(retrievedAt)) || new Date(retrievedAt).toISOString() !== retrievedAt || Date.parse(retrievedAt) > now) throw new Error("The office inventory capture or clock is invalid.");
	const document = parseStateHtml(body);
	const pending = [{ node: document, depth: 0 }];
	let visited = 0;
	while (pending.length) {
		const { node, depth } = pending.pop()!;
		if (++visited > 80000 || depth > 64) throw new Error("The office inventory structure exceeds its bounds.");
		for (const child of node.childNodes ?? []) pending.push({ node: child, depth: depth + 1 });
	}
	const mains = descendants(document, node => node.nodeName === "main");
	if (mains.length !== 1 || descendants(document, node => node.nodeName === "h1" && text(node) === "Offices on the ballot").length !== 1) throw new Error("The office inventory publication identity requires review.");
	const updates = [...text(mains[0]!).matchAll(/Last updated: ([A-Z][a-z]+ [1-9]\d?, 20\d{2})/gu)];
	if (updates.length !== 1) throw new Error("The office inventory publication date requires review.");
	const publicationDate = date(updates[0]![1]!);
	if (publicationDate > retrievedAt.slice(0, 10)) throw new Error("The office inventory publication date is in the future.");
	const regions = descendants(mains[0]!, node => (node.childNodes ?? []).some(child => child.nodeName === "h2" && attribute(child, "id") === "general-election"));
	if (regions.length !== 1) throw new Error("The office inventory has no unique general-election section.");
	const region = regions[0]!;
	if ([region, ...descendants(region, () => true)].some(node => ["form", "input", "script", "iframe", "table"].includes(node.nodeName) || node.attrs?.some(item => item.name === "hidden") || attribute(node, "aria-hidden") === "true" || /display\s*:\s*none|visibility\s*:\s*hidden/iu.test(attribute(node, "style")))) throw new Error("The office inventory contains unreviewed hidden or interactive content.");
	const dates = descendants(region, node => node.nodeName === "h3");
	if (dates.length !== 1) throw new Error("The office inventory election date is ambiguous.");
	const electionDate = date(text(dates[0]!));
	if (!/^20\d{2}-11-0[2-8]$/u.test(electionDate) || electionDate < "2026-11-03" || new Date(electionDate).getUTCDay() !== 2) throw new Error("The scheduled general election requires review.");
	const rows: ScheduledOfficeRow[] = [];
	const questionReferences: ElectionOfficeInventory["questionReferences"] = [];
	const observedGroups = new Set<string>();
	let group = "";
	let court = "";
	let lastGroup = -1;
	for (const node of region.childNodes ?? []) {
		if (node.nodeName === "#text" && !text(node)) continue;
		if (node.nodeName === "h2" && attribute(node, "id") === "general-election") continue;
		if (node === dates[0]) continue;
		if (node.nodeName === "h4") {
			group = text(node);
			const position = groups.indexOf(group);
			if (position <= lastGroup || observedGroups.has(group)) throw new Error("The office inventory section order requires review.");
			lastGroup = position;
			observedGroups.add(group);
			court = "";
			continue;
		}
		if (node.nodeName === "h5" && group === "Judicial Offices") {
			court = text(node);
			continue;
		}
		if (node.nodeName !== "ul" || !group || (node.childNodes ?? []).some(child => child.nodeName !== "li" && text(child))) throw new Error("The office inventory list structure requires review.");
		const items = (node.childNodes ?? []).filter(child => child.nodeName === "li");
		if (!items.length || descendants(node, child => child.nodeName === "li").length !== items.length) throw new Error("The office inventory contains empty or nested lists.");
		for (const item of items) {
			if (group === "Constitutional Amendment") {
				const links = descendants(item, child => child.nodeName === "a");
				if (links.length !== 1 || text(item) !== `Constitutional amendments on the ballot in ${electionDate.slice(0, 4)}` || attribute(links[0]!, "href") !== "https://sos.mn.gov/elections-voting/whats-on-my-ballot/constitutional-amendments/") throw new Error("The separate amendment reference requires review.");
				questionReferences.push({ label: text(item), url: attribute(links[0]!, "href") });
				continue;
			}
			const values = officeValues(group, court, text(item));
			rows.push({ id: hash(JSON.stringify([hennepinOfficeSource.id, electionDate, group, values])).slice(0, 24), group, ...values });
		}
	}
	if (requiredGroups.some(item => !observedGroups.has(item) || !rows.some(row => row.group === item)) || !rows.length || rows.length > 1000 || new Set(rows.map(row => row.id)).size !== rows.length || questionReferences.length > 1) throw new Error("The scheduled office set is incomplete or duplicated.");
	return { schemaVersion: 1, type: "scheduled-office-inventory", sourceId: hennepinOfficeSource.id, stateCode: "MN", countyName: "Hennepin County", electionDate, publicationDate, sourceUrl: hennepinOfficeSource.url, sourceSha256: hash(body), retrievedAt, rows, questionReferences };
}

export function auditOfficeInventory(inventory: ElectionOfficeInventory, snapshots: readonly StateBallotSnapshot[]) {
	if (snapshots.length > 100 || snapshots.some(snapshot => snapshot.source.stateCode !== inventory.stateCode) || new Set(snapshots.map(snapshot => snapshot.source.id)).size !== snapshots.length) throw new Error("Office comparisons require distinct candidate sources from the same state.");
	const current = snapshots.filter(snapshot => snapshot.source.electionDate === inventory.electionDate);
	const evidence = new Map<string, { sourceId: string; recordId: string }[]>();
	for (const snapshot of current) {
		for (const record of snapshot.records.filter(isActiveStateCandidateRecord)) {
			let role: ComparisonRole | undefined;
			let district = "";
			if (["congressional", "state-senate", "state-house"].includes(record.scope)) {
				role = record.scope === "congressional" ? "us-house" : record.scope === "state-senate" ? "state-senate" : "state-house";
				district = record.district ?? "";
			}
			else if (record.scope === "statewide") {
				role = statewideRoles[record.office];
			}
			if (!role) continue;
			const key = `${role}:${district}`;
			evidence.set(key, [...evidence.get(key) ?? [], { sourceId: snapshot.source.id, recordId: record.id }]);
		}
	}
	const comparisons = inventory.rows.filter(row => row.comparisonRole).flatMap(row => (row.districts ?? [""]).map((district) => {
		const key = `${row.comparisonRole}:${district}`;
		return { inventoryRowId: row.id, key, status: !current.length ? "not-compared" : evidence.has(key) ? "represented-in-selected-snapshots" : "not-represented-in-selected-snapshots", records: evidence.get(key) ?? [] };
	}));
	return {
		schemaVersion: 1,
		type: "scheduled-office-coverage-audit",
		sourceId: inventory.sourceId,
		electionDate: inventory.electionDate,
		sourceSha256: inventory.sourceSha256,
		status: !snapshots.length ? "candidate-input-not-configured" : !current.length ? "no-same-election-candidate-snapshot" : "compared",
		comparisonScope: "Exact federal and nonjudicial state office/district keys in the selected snapshots; not candidate qualification, personal eligibility, all current officials, or a coverage percentage.",
		candidateSources: snapshots.map(snapshot => ({ id: snapshot.source.id, electionDate: snapshot.source.electionDate, sourceSha256: snapshot.sha256, factsSha256: hash(JSON.stringify(snapshot.records)), retrievedAt: snapshot.retrievedAt, compared: current.includes(snapshot) })).sort((first, second) => first.id.localeCompare(second.id)),
		inventoryRows: inventory.rows.length,
		comparableScheduledOffices: comparisons.length,
		representedOffices: comparisons.filter(item => item.status === "represented-in-selected-snapshots").length,
		notRepresentedOffices: comparisons.filter(item => item.status === "not-represented-in-selected-snapshots").length,
		unassessedInventoryRows: inventory.rows.filter(row => !row.comparisonRole).length,
		comparisons,
	};
}

export function serializeOfficeInventoryCsv(inventory: ElectionOfficeInventory) {
	const cell = (value: string) => `"${(/^[=+\-@\t\r]/u.test(value) ? "'" : "") + value.replace(/"/gu, "\"\"")}"`;
	const rows = [["id", "group", "kind", "area", "office", "districts", "election_date", "publication_date", "source_url", "source_sha256", "retrieved_at"], ...inventory.rows.map(row => [row.id, row.group, row.kind, row.area ?? "", row.office, row.districts?.join("|") ?? "", inventory.electionDate, inventory.publicationDate, inventory.sourceUrl, inventory.sourceSha256, inventory.retrievedAt])];
	return `${rows.map(row => row.map(cell).join(",")).join("\n")}\n`;
}
