import type { StateBallotSource } from "./state-ballot-sources.js";
import { Buffer } from "node:buffer";
import { createHash, randomUUID } from "node:crypto";
import { closeSync, constants, fstatSync, openSync, readSync, realpathSync } from "node:fs";
import { mkdir, open, realpath, rename, unlink } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve } from "node:path";
import process from "node:process";
import { dakotaCandidateRosterUrl, dakotaDiscoveryUrl, readDakotaElectionDiscovery } from "./state-ballot-dakota.js";
import { parseStateHtml, stateHtmlAttribute, stateHtmlDescendants, stateHtmlText } from "./state-ballot-html.js";
import { marylandCandidateRosterUrl, marylandDiscoveryUrl, marylandSourceElectionId, readMarylandElectionDiscovery } from "./state-ballot-maryland.js";
import { configuredStateBallotSources } from "./state-ballot-registry.js";
import { floridaCandidatePostBody, floridaDiscoveryUrl, floridaElectionDate, floridaSourceElectionId, readFloridaElectionDiscovery, readSouthCarolinaElectionDiscovery, southCarolinaCandidateRosterUrl, southCarolinaDiscoveryUrl } from "./state-ballot-southern.js";
import { assertExternalStateDataDirectory } from "./state-ballot-storage.js";
import { containsControlCharacters } from "./text-validation.js";

const maximumBytes = 128 * 1024;
const washington = configuredStateBallotSources.find(source => source.id === "wa-general-2026")!;
export const stateBallotCycleDiscoveryUrl = "https://voter.votewa.gov/CandidateList.aspx";
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
const cycleFamilies = [
	{ source: washington, format: "washington-html", discoveryUrl: stateBallotCycleDiscoveryUrl, prefix: "wa-general", electionLabel: "GENERAL", formId: null },
	{ source: configuredStateBallotSources.find(source => source.id === "mt-general-2026")!, format: "montana-csv", discoveryUrl: "https://candidatefiling.mt.gov/candidatefiling/CandidateList.aspx", prefix: "mt-general", electionLabel: "FEDERAL GENERAL", formId: "frmMain" },
	{ source: configuredStateBallotSources.find(source => source.id === "ms-sos-2026")!, format: "mississippi-csv", discoveryUrl: "https://www.sos.ms.gov/content/CandidateQualifying/default.aspx", prefix: "ms-general", electionLabel: "General Election:", formId: "form1" },
	{ source: configuredStateBallotSources.find(source => source.id === "wy-sos-2026")!, format: "csv", discoveryUrl: "https://sos.wyo.gov/elections/default.aspx", prefix: "wy-general", electionLabel: "General Election:", formId: null },
	{ source: configuredStateBallotSources.find(source => source.id === "de-doe-2026")!, format: "delaware-html", discoveryUrl: "https://elections.delaware.gov/candidates/candidatelist/", prefix: "de-general", electionLabel: "Statewide General", formId: null },
	{ source: configuredStateBallotSources.find(source => source.id === "sd-sos-2026")!, format: "south-dakota-csv", discoveryUrl: dakotaDiscoveryUrl("SD"), prefix: "sd-general", electionLabel: "General Election", formId: "Form1" },
	{ source: configuredStateBallotSources.find(source => source.id === "nd-sos-2026")!, format: "north-dakota-html", discoveryUrl: dakotaDiscoveryUrl("ND"), prefix: "nd-general", electionLabel: "General Election", formId: "aspnetForm" },
	{ source: configuredStateBallotSources.find(source => source.id === "fl-doe-2026")!, format: "csv", discoveryUrl: floridaDiscoveryUrl, prefix: "fl-general", electionLabel: "Election", formId: "CanDownload" },
	{ source: configuredStateBallotSources.find(source => source.id === "fl-doe-local-2026")!, format: "florida-local-tsv", discoveryUrl: floridaDiscoveryUrl, prefix: "fl-local-general", electionLabel: "Election", formId: "CanDownload" },
	{ source: configuredStateBallotSources.find(source => source.id === "sc-sec-2026")!, format: "south-carolina-html", discoveryUrl: southCarolinaDiscoveryUrl, prefix: "sc-general", electionLabel: "Statewide General Election", formId: "SelectElectionForm" },
	{ source: configuredStateBallotSources.find(source => source.id === "md-sbe-2026")!, format: "csv", discoveryUrl: marylandDiscoveryUrl, prefix: "md-general", electionLabel: "General Election Day", formId: null },
	{ source: configuredStateBallotSources.find(source => source.id === "md-sbe-local-2026")!, format: "maryland-local-csv", discoveryUrl: marylandDiscoveryUrl, prefix: "md-local-general", electionLabel: "General Election Day", formId: null },
] as const;

export function wyomingCandidateRosterUrl(electionDate: string) {
	const year = electionDate.slice(0, 4);
	return `https://sos.wyo.gov/Elections/Docs/${year}/${year}_WY_General_Election_Candidates.csv`;
}

export function delawareCandidateRosterUrl(electionDate: string) {
	return `https://elections.delaware.gov/candidates/candidatelist/genl_fcddt_${electionDate.slice(0, 4)}.html`;
}

export function getStateBallotCycleFamily(familyId: string) {
	const family = cycleFamilies.find(item => item.source.id === familyId);
	if (!family) throw new Error("The automatic election source family is unsupported or has changed.");
	let targetValid = family.source.pageUrl === family.source.url;
	if (family.source.stateCode === "FL") {
		targetValid = floridaSourceElectionId(family.source) === "20261103-GEN";
	}
	else if (family.source.stateCode === "MD") {
		targetValid = marylandSourceElectionId(family.source) === "2026_GG";
	}
	else if (family.format === "south-carolina-html") {
		targetValid = targetValid && family.source.stateCode === "SC" && family.source.url === southCarolinaCandidateRosterUrl("22596");
	}
	else if (family.format === "csv") {
		targetValid = family.source.stateCode === "WY" && family.source.url === wyomingCandidateRosterUrl(family.source.electionDate) && family.source.pageUrl === `https://sos.wyo.gov/Elections/${family.source.electionDate.slice(0, 4)}ElectionInformation.aspx`;
	}
	else if (family.format === "delaware-html") {
		targetValid = targetValid && family.source.stateCode === "DE" && family.source.url === delawareCandidateRosterUrl(family.source.electionDate);
	}
	else if (["south-dakota-csv", "north-dakota-html"].includes(family.format)) {
		const state = family.format === "south-dakota-csv" ? "SD" : "ND";
		targetValid = targetValid && family.source.stateCode === state && family.source.url === dakotaCandidateRosterUrl(state, new URL(family.source.url).searchParams.get("eid") ?? "");
	}
	else if (family.format === "mississippi-csv") {
		targetValid = targetValid && family.source.url === family.discoveryUrl;
	}
	else {
		targetValid = targetValid && new RegExp(`^${family.discoveryUrl.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")}\\?e=[1-9]\\d{0,8}$`, "u").test(family.source.url);
	}
	if (!targetValid || family.source.format !== family.format || family.source.retrievalPolicy || (family.source.stateCode !== "FL" && family.source.postBody) || family.source.documentUrls?.length || family.source.documentLinks?.length)
		throw new Error("The automatic election source family is unsupported or has changed.");
	return family;
}

export class StateBallotCycleCatalogError extends Error {
	constructor(readonly familyId: string, cause: unknown) {
		super(`The election cycle catalog for ${familyId} could not be loaded.`, { cause });
	}
}

export function stateBallotCycleCatalogLocations(environment: NodeJS.ProcessEnv = process.env) {
	const legacy = environment.STATE_BALLOT_CYCLE_CATALOG;
	const multiple = environment.STATE_BALLOT_CYCLE_CATALOGS;
	if (legacy && multiple !== undefined) throw new Error("Configure either one legacy catalog or a family catalog map.");
	if (multiple === undefined) return legacy ? [{ familyId: washington.id, catalogPath: legacy }] : [];
	if (Buffer.byteLength(multiple) > 16 * 1024) throw new Error("The election catalog configuration exceeds its bounds.");
	const value: unknown = JSON.parse(multiple);
	if (!value || typeof value !== "object" || Array.isArray(value) || !Object.keys(value).length || Object.keys(value).length > cycleFamilies.length)
		throw new Error("Election catalogs must map approved families to external file paths.");
	const paths = new Set<string>();
	return Object.entries(value).map(([familyId, catalogPath]) => {
		getStateBallotCycleFamily(familyId);
		if (typeof catalogPath !== "string" || !isAbsolute(catalogPath) || catalogPath.length > 4096 || containsControlCharacters(catalogPath) || paths.has(resolve(catalogPath)))
			throw new Error("Each election family requires a distinct absolute catalog path.");
		paths.add(resolve(catalogPath));
		return { familyId, catalogPath };
	});
}

export function readConfiguredStateBallotCycleCatalogs(environment: NodeJS.ProcessEnv = process.env, now = Date.now()) {
	return stateBallotCycleCatalogLocations(environment).flatMap(({ familyId, catalogPath }) => {
		try {
			const catalog = readStateBallotCycleCatalog(catalogPath, now);
			if (!catalog) return [];
			if (catalog.familyId !== familyId) throw new Error("The election catalog belongs to a different family.");
			return [catalog];
		}
		catch (error) { throw new StateBallotCycleCatalogError(familyId, error); }
	});
}

export interface StateBallotCycleCatalog {
	schemaVersion: 1;
	type: "state-ballot-cycle-catalog";
	familyId: string;
	sourceConfigurationSha256: string;
	discovery: { url: string; sha256: string; retrievedAt: string };
	elections: { electionId: string | null; electionDate: string }[];
}

function exactKeys(value: unknown, names: string[]): value is Record<string, unknown> {
	return Boolean(value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).sort().join(",") === names.sort().join(","));
}

export function validStateBallotGeneralDate(value: unknown): value is string {
	if (typeof value !== "string" || !/^20\d{2}-11-0[2-8]$/u.test(value)) return false;
	const date = new Date(`${value}T00:00:00Z`);
	return Number.isFinite(date.valueOf()) && date.toISOString().slice(0, 10) === value && date.getUTCDay() === 2;
}

export function readMississippiGeneralElectionDate(body: string) {
	if (Buffer.byteLength(body) > 2 * 1024 * 1024) throw new Error("The election discovery page exceeds its size limit.");
	const family = getStateBallotCycleFamily("ms-sos-2026");
	const document = parseStateHtml(body);
	const forms = stateHtmlDescendants(document, node => node.nodeName === "form");
	const headings = stateHtmlDescendants(document, node => node.nodeName === "h1");
	if (forms.length !== 1 || stateHtmlAttribute(forms[0]!, "id") !== family.formId || stateHtmlAttribute(forms[0]!, "method").toLowerCase() !== "post" || new URL(stateHtmlAttribute(forms[0]!, "action"), family.discoveryUrl).href !== family.discoveryUrl || headings.length !== 1 || stateHtmlText(headings[0]!).trim() !== "Candidate Qualifying List")
		throw new Error("The Mississippi public candidate form has changed.");
	const controls = stateHtmlDescendants(forms[0]!, node => node.nodeName === "input" && stateHtmlAttribute(node, "name") === "btnDownloadExcel" && stateHtmlAttribute(node, "type") === "submit" && stateHtmlAttribute(node, "value") === "Download CSV");
	if (controls.length !== 1 || stateHtmlDescendants(forms[0]!, node => node.nodeName === "select").length) throw new Error("The Mississippi public export controls have changed.");
	const labels = stateHtmlDescendants(forms[0]!, node => ["div", "p"].includes(node.nodeName)).map(node => stateHtmlText(node).replace(/\s+/gu, " ").trim()).filter(label => label.startsWith("General Election:") && label.length < 150);
	if (!labels.length || labels.length > 100) throw new Error("The Mississippi report has no bounded explicit general-election date.");
	const dates = labels.map((label) => {
		const match = /^General Election:\s*November ([2-8]), (20\d{2})$/u.exec(label);
		const date = match ? `${match[2]}-11-0${match[1]}` : "";
		if (!validStateBallotGeneralDate(date) || date < family.source.electionDate) throw new Error("The Mississippi report has an unsupported general-election date.");
		return date;
	});
	if (new Set(dates).size !== 1) throw new Error("The Mississippi report identifies conflicting general-election dates.");
	return dates[0]!;
}

export function readWyomingGeneralElectionDate(body: string) {
	if (Buffer.byteLength(body) > 2 * 1024 * 1024) throw new Error("The election discovery page exceeds its size limit.");
	const family = getStateBallotCycleFamily("wy-sos-2026");
	const document = parseStateHtml(body);
	const normalizedText = (node: Parameters<typeof stateHtmlText>[0]) => stateHtmlText(node).replace(/\s+/gu, " ").trim();
	const headings = stateHtmlDescendants(document, node => node.nodeName === "h1");
	if (headings.length !== 1 || normalizedText(headings[0]!) !== "Welcome to the Election Center") throw new Error("The Wyoming election landing page has changed.");
	const labels = stateHtmlDescendants(document, node => node.nodeName === "h4" && normalizedText(node).includes("General Election:")).map(normalizedText);
	if (!labels.length || labels.length > 10) throw new Error("The Wyoming landing page has no bounded explicit election date.");
	const dates = labels.map((label) => {
		const match = /^(?:Primary Election: [A-Za-z]+ \d{1,2}, (20\d{2}) \| )?General Election: November ([2-8]), (20\d{2})$/u.exec(label);
		const date = match ? `${match[3]}-11-0${match[2]}` : "";
		if (!validStateBallotGeneralDate(date) || date < family.source.electionDate || Number(date.slice(0, 4)) % 2 || (match?.[1] && match[1] !== match[3])) throw new Error("The Wyoming general-election date is unsupported or inconsistent.");
		return date;
	});
	if (new Set(dates).size !== 1) throw new Error("The Wyoming landing page identifies conflicting general-election dates.");
	const date = dates[0]!;
	const year = date.slice(0, 4);
	const sections = stateHtmlDescendants(document, node => node.nodeName === "div" && (node.childNodes ?? []).some(child => child.nodeName === "h3" && normalizedText(child) === `${year} Election Information`));
	if (sections.length !== 1) throw new Error("The Wyoming election-information section is missing or ambiguous.");
	for (const [label, url] of [["General Election Candidates (Excel data file)", wyomingCandidateRosterUrl(date)], ["General Election Candidates Roster (PDF file)", wyomingCandidateRosterUrl(date).replace(/\.csv$/u, ".pdf")]]) {
		const links = stateHtmlDescendants(sections[0]!, node => node.nodeName === "a" && normalizedText(node) === label);
		if (links.length !== 1 || new URL(stateHtmlAttribute(links[0]!, "href"), family.discoveryUrl).href !== url) throw new Error("The Wyoming official roster links no longer match the explicit election year.");
	}
	return date;
}

function readDelawareGeneralElections(body: string): StateBallotCycleCatalog["elections"] {
	const family = getStateBallotCycleFamily("de-doe-2026");
	const document = parseStateHtml(body);
	const headings = stateHtmlDescendants(document, node => node.nodeName === "h1");
	if (headings.length !== 1 || stateHtmlText(headings[0]!).trim() !== "Candidate List") throw new Error("The Delaware official candidate index has changed.");
	const links = stateHtmlDescendants(document, node => node.nodeName === "a" && stateHtmlText(node).trim().endsWith("Statewide General"));
	if (!links.length || links.length > 100) throw new Error("The Delaware general-election index exceeds its bounds.");
	return links.flatMap((link) => {
		const label = stateHtmlText(link).replace(/\s+/gu, " ").trim();
		const year = /\b(20\d{2}) Statewide General$/u.exec(label)?.[1];
		if (year && year < family.source.electionDate.slice(0, 4)) return [];
		const match = /^11\/(0?[2-8])\/(20\d{2}) Statewide General$/u.exec(label);
		const date = match ? `${match[2]}-11-${match[1]!.padStart(2, "0")}` : "";
		if (!validStateBallotGeneralDate(date) || date < family.source.electionDate || Number(date.slice(0, 4)) % 2 || new URL(stateHtmlAttribute(link, "href"), family.discoveryUrl).href !== delawareCandidateRosterUrl(date)) throw new Error("The Delaware published general-election date and roster link do not match.");
		return [{ electionId: null, electionDate: date }];
	});
}

export function parseStateBallotCycleCatalog(value: unknown, now = Date.now()): StateBallotCycleCatalog {
	if (!exactKeys(value, ["schemaVersion", "type", "familyId", "sourceConfigurationSha256", "discovery", "elections"]) || value.schemaVersion !== 1 || value.type !== "state-ballot-cycle-catalog" || typeof value.familyId !== "string")
		throw new Error("The election cycle catalog must match the approved automatic source family.");
	const family = getStateBallotCycleFamily(value.familyId);
	const original = family.source;
	if (value.sourceConfigurationSha256 !== digest(JSON.stringify(original))) throw new Error("The election cycle catalog must match the approved automatic source family.");
	const discovery = value.discovery;
	if (!exactKeys(discovery, ["url", "sha256", "retrievedAt"]) || discovery.url !== family.discoveryUrl || typeof discovery.sha256 !== "string" || !/^[a-f0-9]{64}$/u.test(discovery.sha256) || typeof discovery.retrievedAt !== "string" || !Number.isFinite(Date.parse(discovery.retrievedAt)) || new Date(discovery.retrievedAt).toISOString() !== discovery.retrievedAt || Date.parse(discovery.retrievedAt) > now)
		throw new Error("The election discovery provenance is invalid.");
	if (!Array.isArray(value.elections) || !value.elections.length || value.elections.length > 100)
		throw new Error("The election cycle catalog exceeds its bounds.");
	const identifiers = new Set<string>();
	const dates = new Set<string>();
	const florida = original.stateCode === "FL";
	const maryland = original.stateCode === "MD";
	const dateOnly = !florida && !maryland && ["mississippi-csv", "csv", "delaware-html"].includes(family.format);
	const originalElectionId = florida ? floridaSourceElectionId(original) : maryland ? marylandSourceElectionId(original) : new URL(original.url).searchParams.get(family.format === "south-carolina-html" ? "electionId" : ["south-dakota-csv", "north-dakota-html"].includes(family.format) ? "eid" : "e");
	for (const election of value.elections) {
		if (!exactKeys(election, ["electionId", "electionDate"]) || !validStateBallotGeneralDate(election.electionDate) || election.electionDate < original.electionDate || dates.has(election.electionDate) || (dateOnly ? election.electionId !== null : typeof election.electionId !== "string" || (florida ? floridaElectionDate(election.electionId) !== election.electionDate : maryland ? !new RegExp(`^${election.electionDate.slice(0, 4)}_(GG|PG)$`, "u").test(election.electionId) : !/^[1-9]\d{0,8}$/u.test(election.electionId)) || identifiers.has(election.electionId) || ((election.electionId === originalElectionId) !== (election.electionDate === original.electionDate))) || ((maryland || ["montana-csv", "csv", "delaware-html", "south-dakota-csv", "north-dakota-html", "south-carolina-html"].includes(family.format)) && Number(election.electionDate.slice(0, 4)) % 2 !== 0))
			throw new Error("The official election identity is duplicate, unsupported or inconsistent.");
		if (typeof election.electionId === "string") identifiers.add(election.electionId);
		dates.add(election.electionDate);
	}
	return value as unknown as StateBallotCycleCatalog;
}

export function discoverWashingtonElectionCycles(body: string, now = Date.now()): StateBallotCycleCatalog {
	return discoverStateBallotElectionCycles(body, washington.id, now);
}

export function discoverStateBallotElectionCycles(body: string, familyId: string, now = Date.now()): StateBallotCycleCatalog {
	const family = getStateBallotCycleFamily(familyId);
	if (Buffer.byteLength(body) > 2 * 1024 * 1024) throw new Error("The election discovery page exceeds its size limit.");
	if (family.source.stateCode === "MD") return parseStateBallotCycleCatalog({ schemaVersion: 1, type: "state-ballot-cycle-catalog", familyId, sourceConfigurationSha256: digest(JSON.stringify(family.source)), discovery: { url: family.discoveryUrl, sha256: digest(body), retrievedAt: new Date(now).toISOString() }, elections: readMarylandElectionDiscovery(body, family.format === "csv" ? "state" : "local").map(({ electionId, electionDate }) => ({ electionId, electionDate })) }, now);
	if (family.source.stateCode === "FL") return parseStateBallotCycleCatalog({ schemaVersion: 1, type: "state-ballot-cycle-catalog", familyId, sourceConfigurationSha256: digest(JSON.stringify(family.source)), discovery: { url: family.discoveryUrl, sha256: digest(body), retrievedAt: new Date(now).toISOString() }, elections: readFloridaElectionDiscovery(body, family.source.electionDate.slice(0, 4), family.format === "florida-local-tsv" ? "LOC" : "STA") }, now);
	if (family.format === "south-carolina-html") return parseStateBallotCycleCatalog({ schemaVersion: 1, type: "state-ballot-cycle-catalog", familyId, sourceConfigurationSha256: digest(JSON.stringify(family.source)), discovery: { url: family.discoveryUrl, sha256: digest(body), retrievedAt: new Date(now).toISOString() }, elections: readSouthCarolinaElectionDiscovery(body, family.source.electionDate.slice(0, 4)) }, now);
	if (family.format === "mississippi-csv") return parseStateBallotCycleCatalog({ schemaVersion: 1, type: "state-ballot-cycle-catalog", familyId, sourceConfigurationSha256: digest(JSON.stringify(family.source)), discovery: { url: family.discoveryUrl, sha256: digest(body), retrievedAt: new Date(now).toISOString() }, elections: [{ electionId: null, electionDate: readMississippiGeneralElectionDate(body) }] }, now);
	if (family.format === "csv") return parseStateBallotCycleCatalog({ schemaVersion: 1, type: "state-ballot-cycle-catalog", familyId, sourceConfigurationSha256: digest(JSON.stringify(family.source)), discovery: { url: family.discoveryUrl, sha256: digest(body), retrievedAt: new Date(now).toISOString() }, elections: [{ electionId: null, electionDate: readWyomingGeneralElectionDate(body) }] }, now);
	if (family.format === "delaware-html") return parseStateBallotCycleCatalog({ schemaVersion: 1, type: "state-ballot-cycle-catalog", familyId, sourceConfigurationSha256: digest(JSON.stringify(family.source)), discovery: { url: family.discoveryUrl, sha256: digest(body), retrievedAt: new Date(now).toISOString() }, elections: readDelawareGeneralElections(body) }, now);
	if (["south-dakota-csv", "north-dakota-html"].includes(family.format)) return parseStateBallotCycleCatalog({ schemaVersion: 1, type: "state-ballot-cycle-catalog", familyId, sourceConfigurationSha256: digest(JSON.stringify(family.source)), discovery: { url: family.discoveryUrl, sha256: digest(body), retrievedAt: new Date(now).toISOString() }, elections: readDakotaElectionDiscovery(family.format === "south-dakota-csv" ? "SD" : "ND", body, family.source.electionDate.slice(0, 4), now) }, now);
	const document = parseStateHtml(body);
	const forms = stateHtmlDescendants(document, node => node.nodeName === "form");
	const selections = stateHtmlDescendants(document, node => node.nodeName === "select" && stateHtmlAttribute(node, "name") === "ctl00$ContentPlaceHolder1$ddlElection");
	if (forms.length !== 1 || selections.length !== 1 || !stateHtmlDescendants(forms[0]!, node => node === selections[0]).length || stateHtmlAttribute(forms[0]!, "method").toLowerCase() !== "post" || (family.formId && stateHtmlAttribute(forms[0]!, "id") !== family.formId))
		throw new Error("The official election discovery controls have changed.");
	const action = new URL(stateHtmlAttribute(forms[0]!, "action"), family.discoveryUrl);
	const landing = new URL(family.discoveryUrl);
	if (action.origin !== landing.origin || action.pathname !== landing.pathname || action.username || action.password || action.hash || (action.search && (!/^\?e=[1-9]\d{0,8}$/u.test(action.search))))
		throw new Error("The official election discovery form target has changed.");
	const options = stateHtmlDescendants(selections[0]!, node => node.nodeName === "option");
	if (!options.length || options.length > 1000) throw new Error("The official election discovery list exceeds its bounds.");
	const elections: StateBallotCycleCatalog["elections"] = [];
	for (const option of options) {
		const label = stateHtmlText(option).replace(/\s+/gu, " ").trim();
		if (!/\(General\)$/u.test(label)) continue;
		const identity = /\((\d{2})\/(\d{2})\/((?:19|20)\d{2})\) \(General\)$/u.exec(label);
		if (!identity) throw new Error("An official general election has no supported date.");
		const electionDate = `${identity[3]}-${identity[1]}-${identity[2]}`;
		if (electionDate < family.source.electionDate) continue;
		if (label !== `${family.electionLabel} ${identity[3]} (${identity[1]}/${identity[2]}/${identity[3]}) (General)`)
			throw new Error("The official general-election label has changed.");
		elections.push({ electionId: stateHtmlAttribute(option, "value"), electionDate });
	}
	return parseStateBallotCycleCatalog({ schemaVersion: 1, type: "state-ballot-cycle-catalog", familyId: family.source.id, sourceConfigurationSha256: digest(JSON.stringify(family.source)), discovery: { url: family.discoveryUrl, sha256: digest(body), retrievedAt: new Date(now).toISOString() }, elections: elections.sort((first, second) => first.electionDate.localeCompare(second.electionDate)) }, now);
}

export function stateBallotCycleSources(catalog: StateBallotCycleCatalog, now = Date.now()): StateBallotSource[] {
	parseStateBallotCycleCatalog(catalog, now);
	const family = getStateBallotCycleFamily(catalog.familyId);
	return catalog.elections.filter(election => election.electionDate !== family.source.electionDate).map((election) => {
		if (family.source.stateCode === "MD") {
			const kind = family.format === "csv" ? "state" : "local";
			return { ...family.source, id: `${family.prefix}-${election.electionDate}`, label: `${family.source.label} (${election.electionDate.slice(0, 4)})`, electionDate: election.electionDate, url: marylandCandidateRosterUrl(election.electionId!, kind), pageUrl: marylandCandidateRosterUrl(election.electionId!, kind, "html") };
		}
		if (family.source.stateCode === "FL") return { ...family.source, id: `${family.prefix}-${election.electionDate}`, label: `${family.source.label} (${election.electionDate.slice(0, 4)})`, electionDate: election.electionDate, postBody: floridaCandidatePostBody(election.electionId!, family.format === "florida-local-tsv" ? "LOC" : "STA") };
		if (family.format === "south-carolina-html") {
			const url = southCarolinaCandidateRosterUrl(election.electionId!);
			return { ...family.source, id: `${family.prefix}-${election.electionDate}`, label: `${family.source.label} (${election.electionDate.slice(0, 4)})`, electionDate: election.electionDate, url, pageUrl: url };
		}
		if (family.format === "csv") return { ...family.source, id: `${family.prefix}-${election.electionDate}`, label: `${family.source.label} (${election.electionDate.slice(0, 4)})`, electionDate: election.electionDate, url: wyomingCandidateRosterUrl(election.electionDate), pageUrl: family.discoveryUrl };
		if (family.format === "delaware-html") return { ...family.source, id: `${family.prefix}-${election.electionDate}`, label: `${family.source.label} (${election.electionDate.slice(0, 4)})`, electionDate: election.electionDate, url: delawareCandidateRosterUrl(election.electionDate), pageUrl: delawareCandidateRosterUrl(election.electionDate) };
		if (["south-dakota-csv", "north-dakota-html"].includes(family.format)) {
			const url = dakotaCandidateRosterUrl(family.format === "south-dakota-csv" ? "SD" : "ND", election.electionId!);
			return { ...family.source, id: `${family.prefix}-${election.electionDate}`, label: `${family.source.label} (${election.electionDate.slice(0, 4)})`, electionDate: election.electionDate, url, pageUrl: url };
		}
		const url = new URL(family.discoveryUrl);
		if (election.electionId !== null) url.searchParams.set("e", election.electionId);
		return { ...family.source, id: `${family.prefix}-${election.electionDate}`, label: `${family.source.label} (${election.electionDate.slice(0, 4)})`, electionDate: election.electionDate, url: url.href, pageUrl: url.href };
	}).sort((first, second) => first.electionDate.localeCompare(second.electionDate));
}

export function readStateBallotCycleCatalog(path: string, now = Date.now()): StateBallotCycleCatalog | null {
	assertExternalStateDataDirectory(dirname(path));
	let handle: number | undefined;
	try {
		assertExternalStateDataDirectory(realpathSync(dirname(path)));
		handle = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
		const metadata = fstatSync(handle);
		if (!metadata.isFile() || metadata.size > maximumBytes) throw new Error("The election cycle catalog must be a bounded regular file.");
		const buffer = Buffer.alloc(maximumBytes + 1);
		let length = 0;
		while (length < buffer.length) {
			const bytes = readSync(handle, buffer, length, buffer.length - length, length);
			if (!bytes) break;
			length += bytes;
		}
		if (length > maximumBytes) throw new Error("The election cycle catalog exceeds its size limit.");
		return parseStateBallotCycleCatalog(JSON.parse(buffer.subarray(0, length).toString("utf8")), now);
	}
	catch (error) {
		if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
		throw error;
	}
	finally {
		if (handle !== undefined) closeSync(handle);
	}
}

export async function writeStateBallotCycleCatalog(path: string, catalog: StateBallotCycleCatalog, now = Date.now()) {
	parseStateBallotCycleCatalog(catalog, now);
	assertExternalStateDataDirectory(dirname(path));
	await mkdir(dirname(path), { recursive: true });
	const directory = await realpath(dirname(path));
	assertExternalStateDataDirectory(directory);
	const target = join(directory, path.slice(path.lastIndexOf("/") + 1));
	const previous = readStateBallotCycleCatalog(target, now);
	if (previous && previous.familyId !== catalog.familyId) throw new Error("An election catalog cannot replace a different source family.");
	if (previous && JSON.stringify(previous) === JSON.stringify(catalog)) return false;
	const temporary = `${target}.${randomUUID()}.tmp`;
	try {
		const handle = await open(temporary, "wx");
		try {
			await handle.writeFile(`${JSON.stringify(catalog)}\n`);
			await handle.sync();
		}
		finally { await handle.close(); }
		await rename(temporary, target);
	}
	finally {
		await unlink(temporary).catch((error: NodeJS.ErrnoException) => {
			if (error.code !== "ENOENT") throw error;
		});
	}
	return true;
}
