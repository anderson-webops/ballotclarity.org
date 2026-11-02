import type { StateHtmlNode } from "./state-ballot-html.js";
import type { StateCandidateRecord, StateContestScope } from "./state-ballot-records.js";
import type { StateBallotSource } from "./state-ballot-sources.js";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { normalizePublicHref } from "./public-href.js";
import { stateHtmlAttribute as attribute, stateHtmlDescendants as descendants, parseStateHtml, stateHtmlTableRows, stateHtmlText } from "./state-ballot-html.js";
import { StateBallotAwaitingRecordsError } from "./state-ballot-source-state.js";
import { containsControlCharacters } from "./text-validation.js";

export const boulderOrigin = "https://bouldercounty.gov";
export const boulderDiscoveryUrl = `${boulderOrigin}/elections/information/`;
export const boulderBallotIndexUrl = `${boulderOrigin}/elections/ballot-information/`;
export const boulderPrivacyUrl = `${boulderOrigin}/privacy-policy/`;
export const boulderHash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const clean = (value: string) => value.normalize("NFKC").replace(/\s+/gu, " ").trim();
const text = (node: StateHtmlNode) => clean(stateHtmlText(node));
function reject(): never {
	throw new Error("The Boulder County candidate publication requires review.");
}

export function boulderSource(electionDate: string): StateBallotSource {
	return { stateCode: "CO", id: electionDate === "2026-11-03" ? "co-boulder-2026" : `co-boulder-general-${electionDate}`, label: "Boulder County candidate directory", electionDate, url: boulderDiscoveryUrl, pageUrl: boulderDiscoveryUrl, format: "boulder-html", countyName: "Boulder County", defaultPriority: -20, snapshotStorage: "external", ballotPreview: false, withheldDistrictScopes: ["congressional", "state-senate", "state-house"] };
}

export function validateBoulderSource(source: StateBallotSource) {
	const expected = boulderSource(source.electionDate);
	if (!/^20\d{2}-11-0[2-8]$/u.test(source.electionDate) || source.electionDate < "2026-11-03" || Number(source.electionDate.slice(0, 4)) % 2 || new Date(`${source.electionDate}T00:00:00Z`).getUTCDay() !== 2 || Object.keys(source).sort().join(",") !== Object.keys(expected).sort().join(",") || Object.entries(expected).some(([key, value]) => JSON.stringify(source[key as keyof StateBallotSource]) !== JSON.stringify(value))) return reject();
}

export function validateBoulderCandidateUrl(url: string, electionDate: string) {
	if (url !== `${boulderOrigin}/elections/information/${electionDate.slice(0, 4)}-general-election-candidates-and-ballot-measures/`) return reject();
}

function content(body: string) {
	if (Buffer.byteLength(body) > 1024 * 1024 || containsControlCharacters(body.replace(/[\r\n\t]/gu, ""))) return reject();
	const tree = parseStateHtml(body);
	const regions = descendants(tree, node => attribute(node, "id") === "content");
	if (regions.length !== 1) return reject();
	return regions[0]!;
}

interface Office { office: string; district: string; scope: StateContestScope; jurisdiction?: string }
function officeFields(label: string, group: string): Office {
	if (group === "Federal Offices") {
		if (label === "United States Senator") return { office: "U.S. Senator", district: "", scope: "statewide" };
		const house = /^Representative to the \d{3}(?:st|nd|rd|th) United States Congress [–-] District ([1-9]\d?)$/u.exec(label);
		if (house) return { office: "U.S. Representative", district: house[1]!, scope: "congressional" };
	}
	if (group === "State Offices") {
		if (["Governor/Lieutenant Governor", "Secretary of State", "State Treasurer", "Attorney General"].includes(label)) return { office: label, district: "", scope: "statewide" };
		const legislative = /^State (Senator|Representative) [–-] District ([1-9]\d?)$/u.exec(label);
		if (legislative) return { office: `State ${legislative[1]}`, district: legislative[2]!, scope: legislative[1] === "Senator" ? "state-senate" : "state-house" };
		const regent = /^Regent of the University of Colorado [–-] Congressional District ([1-9]\d?)$/u.exec(label);
		if (regent) return { office: "Regent of the University of Colorado", district: regent[1]!, scope: "local", jurisdiction: `University of Colorado Board of Regents, Congressional District ${regent[1]}` };
		const transit = /^Regional Transportation District Director [–-] District ([A-Z])$/u.exec(label);
		if (transit) return { office: "Regional Transportation District Director", district: transit[1]!, scope: "local", jurisdiction: `Regional Transportation District ${transit[1]}, Colorado` };
	}
	if (group === "County Offices") {
		const commissioner = /^Boulder County Commissioner [–-] District ([1-9])$/u.exec(label);
		if (commissioner) return { office: "County Commissioner", district: commissioner[1]!, scope: "local", jurisdiction: "Boulder County, Colorado" };
		if (/^Boulder County (?:Clerk and Recorder|Treasurer|Assessor|Sheriff|Surveyor|Coroner)$/u.test(label)) return { office: label.replace(/^Boulder /u, ""), district: "", scope: "local", jurisdiction: "Boulder County, Colorado" };
	}
	if (/^(?:City|Town) of [\p{L} .-]+$/u.test(group)) {
		const prefix = `${group} `;
		if (!label.startsWith(prefix)) return reject();
		const position = label.slice(prefix.length);
		if (["Mayoral Candidates", "Mayor"].includes(position)) return { office: "Mayor", district: "", scope: "local", jurisdiction: `${group}, Colorado` };
		if (["Council Candidates", "Council Member"].includes(position)) return { office: "Council Member", district: "", scope: "local", jurisdiction: `${group}, Colorado` };
		const council = /^Town Council District ([1-9]\d?)$/u.exec(position);
		if (council) return { office: "Town Council Member", district: council[1]!, scope: "local", jurisdiction: `${group}, Colorado` };
	}
	return reject();
}

function blocks(node: StateHtmlNode): StateHtmlNode[] {
	return ["h2", "h3", "p", "table"].includes(node.nodeName) ? [node] : (node.childNodes ?? []).flatMap(blocks);
}

function candidate(source: StateBallotSource, field: StateHtmlNode, prefix: string | undefined, office: Office, factory: typeof import("./state-ballot-records.js").createStateCandidateRecord) {
	const raw = text(field);
	const value = prefix ? raw.slice(prefix.length).trim() : raw;
	if (prefix && !raw.startsWith(prefix)) return reject();
	const writeIn = / \(Certified Write-in Candidate\)$/u.test(value);
	const name = writeIn ? value.replace(/ \(Certified Write-in Candidate\)$/u, "") : value;
	if (!name || name.length > 250 || !/^[\p{L}\p{M}\d .,'’"()/-]+$/u.test(name) || /\b(?:none found|candidate name|public email|contact form|withdrawn|vacant|not available)\b/iu.test(name)) return reject();
	const links = descendants(field, node => node.nodeName === "a").map((node) => {
		const href = attribute(node, "href");
		if (/^(?:mailto:|tel:)/iu.test(href)) return null;
		const url = normalizePublicHref(href);
		if (!url || !/^https?:\/\//u.test(url)) return reject();
		return { name: text(node).replace(/ \(Certified Write-in Candidate\)$/u, ""), url };
	}).filter((link): link is { name: string; url: string } => link !== null);
	const primary = links.filter(link => link.name === name || (office.office === "Governor/Lieutenant Governor" && link.name === name.split("/")[0]!.trim()));
	if (new Set(primary.map(link => link.url)).size > 1) return reject();
	const record = factory(source, { name, party: "", ...office, status: writeIn ? "write-in" : "listed", ...(primary[0] ? { candidateUrl: primary[0].url } : {}) });
	if (!record) return reject();
	if (writeIn) record.sourceStatus = "Certified Write-in Candidate";
	return record;
}

export function readBoulderCandidates(source: StateBallotSource, body: string, factory: typeof import("./state-ballot-records.js").createStateCandidateRecord) {
	validateBoulderSource(source);
	const region = content(body);
	const titles = descendants(region, node => node.nodeName === "h1");
	if (titles.length !== 1 || text(titles[0]!) !== `${source.electionDate.slice(0, 4)} General Election Candidates and Ballot Measures`) return reject();
	const records: StateCandidateRecord[] = [];
	const groups = new Set<string>();
	const populatedGroups = new Set<string>();
	const offices = new Set<string>();
	let group = "";
	let label = "";
	let fields: StateHtmlNode[] = [];
	let started = false;
	let finished = false;
	const flush = () => {
		if (!label) return;
		populatedGroups.add(group);
		const office = officeFields(label, group);
		const tables = fields.filter(node => node.nodeName === "table");
		if (tables.length) {
			if (tables.length !== 1 || fields.some(node => node.nodeName === "p" && text(node))) return reject();
			if ([tables[0]!, ...descendants(tables[0]!, () => true)].some(node => attribute(node, "rowspan") || attribute(node, "colspan") || node.attrs?.some(item => item.name === "hidden") || attribute(node, "aria-hidden") === "true" || /display\s*:\s*none|visibility\s*:\s*hidden/iu.test(attribute(node, "style")))) return reject();
			const rows = stateHtmlTableRows(tables[0]!);
			const cells = rows.map(row => (row.childNodes ?? []).filter(node => ["td", "th"].includes(node.nodeName)));
			if (!cells.length || cells.some(row => row.length !== 2) || !/^Candidate Name\/Link to Website(?: \(if found\))?$/u.test(text(cells[0]![0]!)) || !/^Public Email(?: or Contact Form)?$/u.test(text(cells[0]![1]!))) return reject();
			for (const row of cells.slice(1)) records.push(candidate(source, row[0]!, undefined, office, factory));
			if (cells.length === 1) return reject();
		}
		else {
			const candidates = fields.filter(node => node.nodeName === "p" && /^Candidate Name(?:\/Link to Website)? /u.test(text(node)));
			if (candidates.length !== 1 || fields.some(node => node.nodeName !== "p" || (text(node) && !/^(?:Candidate Name(?:\/Link to Website)? |Public Email|Contact Form)/u.test(text(node))))) return reject();
			const prefix = text(candidates[0]!).startsWith("Candidate Name/Link to Website") ? "Candidate Name/Link to Website" : "Candidate Name";
			records.push(candidate(source, candidates[0]!, prefix, office, factory));
		}
		label = "";
		fields = [];
	};
	for (const node of blocks(region)) {
		const value = text(node);
		if (node.nodeName === "h2") {
			if (["Federal Offices", "State Offices", "County Offices"].includes(value) || /^(?:City|Town) of [\p{L} .-]+$/u.test(value)) {
				if (finished || groups.has(value)) return reject();
				flush();
				group = value;
				groups.add(value);
				started = true;
			}
			else if (["Judicial Retention Questions", "State Ballot Measures", "Boulder County Ballot Measures", "Local Ballot Measures"].includes(value)) {
				flush();
				finished = true;
			}
			else if (started && !finished) {
				return reject();
			}
		}
		else if (started && !finished && node.nodeName === "h3") {
			flush();
			const key = `${group}:${value}`;
			if (offices.has(key)) return reject();
			offices.add(key);
			label = value;
		}
		else if (label && !finished) {
			fields.push(node);
		}
	}
	flush();
	if (!finished || !["Federal Offices", "State Offices", "County Offices"].every(value => populatedGroups.has(value)) || records.length > 2000 || new Set(records.map(record => record.id)).size !== records.length) return reject();
	if (!records.length) throw new StateBallotAwaitingRecordsError(source.id);
	return records;
}
