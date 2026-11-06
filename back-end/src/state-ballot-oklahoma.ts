import type { StateCandidateValues } from "./state-ballot-additional-records.js";
import type { StateCandidateRecord } from "./state-ballot-records.js";
import type { StateBallotSource } from "./state-ballot-sources.js";
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { stateHtmlAttribute as attribute, stateHtmlDescendants as descendants, parseStateHtml, stateHtmlTableRows as rows, stateHtmlText } from "./state-ballot-html.js";

export const oklahomaOrigin = "https://oklahoma.gov";
export const oklahomaHostingOrigin = "https://hosting.okelections.gov";
export const oklahomaDiscoveryUrl = `${oklahomaOrigin}/elections/elections-results/next-election.html`;
export const oklahomaCandidateUrl = `${oklahomaHostingOrigin}/electionlist.html`;
export const oklahomaCountyNames = ["ADAIR", "ALFALFA", "ATOKA", "BEAVER", "BECKHAM", "BLAINE", "BRYAN", "CADDO", "CANADIAN", "CARTER", "CHEROKEE", "CHOCTAW", "CIMARRON", "CLEVELAND", "COAL", "COMANCHE", "COTTON", "CRAIG", "CREEK", "CUSTER", "DELAWARE", "DEWEY", "ELLIS", "GARFIELD", "GARVIN", "GRADY", "GRANT", "GREER", "HARMON", "HARPER", "HASKELL", "HUGHES", "JACKSON", "JEFFERSON", "JOHNSTON", "KAY", "KINGFISHER", "KIOWA", "LATIMER", "LEFLORE", "LINCOLN", "LOGAN", "LOVE", "MCCLAIN", "MCCURTAIN", "MCINTOSH", "MAJOR", "MARSHALL", "MAYES", "MURRAY", "MUSKOGEE", "NOBLE", "NOWATA", "OKFUSKEE", "OKLAHOMA", "OKMULGEE", "OSAGE", "OTTAWA", "PAWNEE", "PAYNE", "PITTSBURG", "PONTOTOC", "POTTAWATOMIE", "PUSHMATAHA", "ROGER MILLS", "ROGERS", "SEMINOLE", "SEQUOYAH", "STEPHENS", "TEXAS", "TILLMAN", "TULSA", "WAGONER", "WASHINGTON", "WASHITA", "WOODS", "WOODWARD"] as const;
export const oklahomaHash = (body: string) => createHash("sha256").update(body).digest("hex");
const text = (node: Parameters<typeof stateHtmlText>[0]) => stateHtmlText(node).replace(/\s+/gu, " ").trim();
const scriptHashes = ["5f335ed7851baa59dcfd0eb2e4ca2e806b5213b2af26982ca8298510a76f955b", "a9606824b72d7f4c86329f4b416b32566a4e270f06ff2d08f6ead849ad5bfc44", "34e2362e763f07774f0de7a794128a52256f2af87c93ddf8924a141a0fe2fe81"];
const sectionNames = new Set(["STATE OFFICERS", "CONGRESSIONAL OFFICERS", "LEGISLATIVE, DISTRICT AND COUNTY OFFICERS", "JUDICIAL OFFICERS", "JUDICIAL RETENTION", "STATE QUESTIONS"]);
const specialJurisdictions = ["BRIDGE CREEK FIRE", "SOUTHWEST LIN. CO. FIRE #1", "VERDIGRIS FIRE", "OAK GROVE FIRE MILLAGE"];
const allowedAttributes: Record<string, readonly string[]> = { html: ["lang"], font: ["size"], a: ["name"], script: ["type"], table: ["cellspacing", "border", "width"], td: ["width"], p: ["id", "onclick"] };
const tags = new Set(["html", "head", "body", "title", "font", "a", "script", "table", "tbody", "tr", "td", "p", "b", "u", "br", "#text", "#comment", "#documentType"]);
type Factory = (source: StateBallotSource, values: StateCandidateValues) => StateCandidateRecord | null;

export function oklahomaSource(electionDate: string): StateBallotSource {
	assert.match(electionDate, /^20\d{2}-11-0[2-8]$/u);
	const date = new Date(`${electionDate}T00:00:00Z`);
	assert(date.toISOString().slice(0, 10) === electionDate && date.getUTCDay() === 2 && Number(electionDate.slice(0, 4)) >= 2026 && !(Number(electionDate.slice(0, 4)) % 2), "The Oklahoma general-election date requires review.");
	return { stateCode: "OK", id: `ok-seb-${electionDate.slice(0, 4)}`, label: "Oklahoma State Election Board", electionDate, url: oklahomaCandidateUrl, pageUrl: oklahomaCandidateUrl, format: "oklahoma-html", defaultPriority: 20, snapshotStorage: "external" };
}

export function validateOklahomaSource(source: StateBallotSource) {
	assert.deepEqual(source, oklahomaSource(source.electionDate), "The Oklahoma source configuration requires review.");
}

export function validateOklahomaCalendarUrl(value: string, year: string) {
	const path = `${oklahomaOrigin}/elections/elections-results/next-election/`;
	assert(/^20\d{2}$/u.test(year) && (value === `${path}voter-information-calendar.html` || value === `${path}${year}-voter-information-calendar.html`), "The offered Oklahoma calendar URL requires review.");
}

export function oklahomaSourceCreated(value: string) {
	const match = /^(\d{1,2})\/(\d{1,2})\/(20\d{2}) (\d{1,2}):(\d{2}):(\d{2}) (?:AM|PM)$/u.exec(value);
	assert(match && Number(match[4]) >= 1 && Number(match[4]) <= 12 && Number(match[5]) < 60 && Number(match[6]) < 60, "The Oklahoma publication clock requires review.");
	const date = `${match[3]}-${match[1]!.padStart(2, "0")}-${match[2]!.padStart(2, "0")}`;
	assert(new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) === date, "The Oklahoma publication date requires review.");
	return date;
}

export function readOklahomaPublication(body: string) {
	assert(Buffer.byteLength(body) <= 2 * 1024 * 1024, "The Oklahoma publication exceeds its size limit.");
	const tree = parseStateHtml(body);
	const nodes = descendants(tree, () => true);
	assert(nodes.length <= 150_000 && nodes.every(node => tags.has(node.nodeName) && (node.attrs ?? []).every(field => allowedAttributes[node.nodeName]?.includes(field.name))), "The Oklahoma publication markup requires review.");
	assert(nodes.filter(node => node.nodeName === "font").every(node => /^[2-6]$/u.test(attribute(node, "size"))), "The Oklahoma text visibility requires review.");
	const scripts = nodes.filter(node => node.nodeName === "script");
	assert(!scripts.length || (scripts.length === scriptHashes.length && scripts.every((node, index) => attribute(node, "type") === "text/javascript" && oklahomaHash((node.childNodes ?? []).map(child => child.value ?? "").join("").replace(/\s+/gu, " ").trim()) === scriptHashes[index])), "The Oklahoma navigation scripts require review.");
	const headings = nodes.filter(node => node.nodeName === "a" && attribute(node, "name") === "00");
	const titles = nodes.filter(node => node.nodeName === "title");
	assert(headings.length === 1 && titles.length === 1);
	const match = /^(JANUARY|FEBRUARY|MARCH|APRIL|MAY|JUNE|JULY|AUGUST|SEPTEMBER|OCTOBER|NOVEMBER|DECEMBER) \/ (20\d{2}) LIST OF ELECTIONS$/u.exec(text(headings[0]!));
	assert(match && text(titles[0]!).toUpperCase() === match[0], "The Oklahoma election heading requires review.");
	const footers = nodes.filter(node => node.nodeName === "b" && text(node).startsWith("This file was created on:"));
	assert.equal(footers.length, 1, "The Oklahoma publication footer requires review.");
	const sourceAsOf = text(footers[0]!).replace("This file was created on: ", "");
	const sourceAsOfDate = oklahomaSourceCreated(sourceAsOf);
	assert(Number(sourceAsOfDate.slice(0, 4)) <= Number(match[2]) && Number(sourceAsOfDate.slice(0, 4)) >= Number(match[2]) - 1, "The Oklahoma publication year requires review.");
	return { tree, month: match[1]!, year: match[2]!, sourceAsOf, sourceAsOfDate };
}

export function readOklahomaCandidates(source: StateBallotSource, body: string, factory: Factory) {
	validateOklahomaSource(source);
	const publication = readOklahomaPublication(body);
	assert(publication.month === "NOVEMBER" && publication.year === source.electionDate.slice(0, 4), "The Oklahoma list identifies another election.");
	const candidates = new Map<string, StateCandidateRecord>();
	const claims: { recordId: string; county: string; publisherCountyCode: string; section: string; office: string; name: string; party: string; tableOrdinal: number }[] = [];
	const headings: { county: string; publisherCountyCode: string; section: string; office: string; tableOrdinal: number }[] = [];
	const claimKeys = new Set<string>();
	const officeCounties = new Map<string, Map<string, Set<string>>>();
	const counties: string[] = [];
	let county = "";
	let publisherCountyCode = "";
	let section = "";
	let office = "";
	let tableOrdinal = 0;
	for (const node of descendants(publication.tree, node => node.nodeName === "table" || node.nodeName === "a")) {
		if (node.nodeName === "a") {
			if (attribute(node, "name") === "00") continue;
			publisherCountyCode = attribute(node, "name");
			county = text(node);
			assert(publisherCountyCode === String(counties.length + 1).padStart(2, "0") && county === oklahomaCountyNames[counties.length], "The Oklahoma county inventory requires review.");
			counties.push(county);
			section = office = "";
			continue;
		}
		tableOrdinal++;
		assert(county && tableOrdinal <= 20_000 && attribute(node, "width") === "1000" && attribute(node, "cellspacing") === "3" && attribute(node, "border") === "0" && rows(node).length === 1, "The Oklahoma table requires review.");
		const cells = (rows(node)[0]!.childNodes ?? []).filter(child => child.nodeName === "td");
		assert(cells.length >= 2 && cells.length <= 4 && cells.slice(0, -1).every(cell => attribute(cell, "width") === "10" && !text(cell)) && attribute(cells.at(-1)!, "width") === String(1010 - 10 * cells.length), "The Oklahoma table indentation requires review.");
		const value = text(cells.at(-1)!);
		assert(value && value.length <= 250);
		if (cells.length === 2) {
			section = value;
			assert(sectionNames.has(section) || /^(?:CITY OF|TOWN OF|[A-Z ]+ COUNTY QUESTIONS) /u.test(`${section} `) || specialJurisdictions.includes(section), "The Oklahoma jurisdiction requires review.");
			office = "";
			continue;
		}
		assert(section);
		if (cells.length === 3) {
			office = value;
			headings.push({ county, publisherCountyCode, section, office, tableOrdinal });
			continue;
		}
		assert(office && !["JUDICIAL RETENTION", "STATE QUESTIONS"].includes(section), "The Oklahoma candidate context requires review.");
		const named = /^(.+), (REPUBLICAN|DEMOCRAT|LIBERTARIAN|INDEPENDENT|NONPARTISAN)$/u.exec(value);
		const partyRequired = ["STATE OFFICERS", "CONGRESSIONAL OFFICERS", "LEGISLATIVE, DISTRICT AND COUNTY OFFICERS"].includes(section);
		assert(named || (!partyRequired && !value.includes(",")), "The Oklahoma party designation requires review.");
		const name = named?.[1] ?? value;
		const party = named?.[2] ?? "";
		assert.match(name, /^[\p{L}\p{M}][\p{L}\p{M} .,'"’-]{1,179}$/u);
		let scope: StateCandidateValues["scope"];
		let jurisdiction = "";
		let district = "";
		if (section === "STATE OFFICERS" || (section === "CONGRESSIONAL OFFICERS" && office === "UNITED STATES SENATOR")) {
			scope = "statewide";
		}
		else if (section === "CONGRESSIONAL OFFICERS") {
			const match = /^UNITED STATES REPRESENTATIVE - DISTRICT (\d{2})$/u.exec(office);
			assert(match && Number(match[1]) >= 1 && Number(match[1]) <= 5, "The Oklahoma congressional district requires review.");
			scope = "congressional";
			district = String(Number(match[1]));
		}
		else if (section === "LEGISLATIVE, DISTRICT AND COUNTY OFFICERS") {
			const match = /^STATE (SENATOR|REPRESENTATIVE) - DISTRICT (\d{1,3})(?: \(Unexpired Term\))?$/u.exec(office);
			if (match) {
				scope = match[1] === "SENATOR" ? "state-senate" : "state-house";
				district = String(Number(match[2]));
				assert(Number(district) >= 1 && Number(district) <= (scope === "state-senate" ? 48 : 101));
			}
			else {
				assert.match(office, /^COUNTY (?:COMMISSIONER DISTRICT NO\. [1-3]|ASSESSOR|TREASURER|SHERIFF(?: \(Unexpired Term\))?)$/u);
				scope = "local";
				jurisdiction = `${county} COUNTY`;
			}
		}
		else if (section === "JUDICIAL OFFICERS") {
			assert.match(office, /^(?:ASSOCIATE DISTRICT JUDGE - [A-Z ]+ COUNTY|DISTRICT JUDGE - DISTRICT \d{1,2}, OFFICE \d{1,2})$/u);
			scope = "local";
			jurisdiction = office;
		}
		else {
			assert.match(office, /^(?:COUNCILMEMBER - |MAYOR$|BOARD MEMBER - )/u);
			scope = "local";
			jurisdiction = section;
		}
		const candidate = factory(source, { name, party, office, scope, district, ...(jurisdiction ? { jurisdiction } : {}), status: "listed" });
		assert(candidate, "The Oklahoma candidate identity requires review.");
		if (office.endsWith(" (Unexpired Term)")) candidate.ballotDesignation = "Unexpired Term";
		const previous = candidates.get(candidate.id);
		assert(!previous || JSON.stringify(previous) === JSON.stringify(candidate), "Conflicting Oklahoma candidate facts require review.");
		const claimKey = `${publisherCountyCode}:${candidate.id}`;
		assert(!claimKeys.has(claimKey), "Duplicate Oklahoma county candidate requires review.");
		claimKeys.add(claimKey);
		candidates.set(candidate.id, candidate);
		const officeKey = JSON.stringify([scope, district, jurisdiction, office]);
		if (!officeCounties.has(officeKey)) officeCounties.set(officeKey, new Map());
		const countyRecords = officeCounties.get(officeKey)!;
		if (!countyRecords.has(county)) countyRecords.set(county, new Set());
		countyRecords.get(county)!.add(candidate.id);
		claims.push({ recordId: candidate.id, county, publisherCountyCode, section, office, name, party, tableOrdinal });
	}
	assert(counties.length === oklahomaCountyNames.length && candidates.size > 0 && candidates.size <= 25_000 && counties.every(county => claims.some(claim => claim.county === county)), "The complete Oklahoma county candidate inventory requires review.");
	for (const countyRecords of officeCounties.values()) {
		const sets = [...countyRecords.values()].map(values => [...values].sort().join(","));
		assert(sets.every(value => value === sets[0]), "The Oklahoma counties list inconsistent candidates for the same office.");
	}
	for (const record of candidates.values()) {
		if (record.scope === "statewide") assert.equal(claims.filter(claim => claim.recordId === record.id).length, oklahomaCountyNames.length, "An Oklahoma statewide candidate is missing from a county context.");
	}
	return { records: [...candidates.values()], claims, headings, sourceAsOf: publication.sourceAsOf, sourceAsOfDate: publication.sourceAsOfDate };
}

export function readOklahomaSnapshotMetadata(source: StateBallotSource, value: Record<string, unknown>) {
	validateOklahomaSource(source);
	assert(typeof value.sourceAsOf === "string" && value.sourceAsOfDate === oklahomaSourceCreated(value.sourceAsOf), "The stored Oklahoma publication clock requires review.");
	assert(typeof value.sourceAsOfDate === "string" && value.sourceAsOfDate.slice(0, 4) >= String(Number(source.electionDate.slice(0, 4)) - 1) && value.sourceAsOfDate.slice(0, 4) <= source.electionDate.slice(0, 4));
	assert(Array.isArray(value.documents) && value.documents.length === 3 && value.collectionIndexSha256 === value.sourceSha256, "The stored Oklahoma provenance requires review.");
	const documents = value.documents as { url?: unknown; sha256?: unknown; includedRecordCount?: unknown }[];
	assert(documents[0]!.url === oklahomaDiscoveryUrl && documents[0]!.includedRecordCount === 0 && documents[1]!.includedRecordCount === 0 && typeof documents[1]!.url === "string");
	validateOklahomaCalendarUrl(documents[1]!.url, source.electionDate.slice(0, 4));
	assert(documents[2]!.url === oklahomaCandidateUrl && documents[2]!.sha256 === value.sourceSha256 && documents[2]!.includedRecordCount === value.recordCount, "The stored Oklahoma candidate provenance requires review.");
	return { sourceAsOfDate: value.sourceAsOfDate, sourceAsOf: value.sourceAsOf };
}
