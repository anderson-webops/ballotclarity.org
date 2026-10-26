import type { StateCandidateValues } from "./state-ballot-additional-records.js";
import type { StateHtmlNode } from "./state-ballot-html.js";
import type { StateCandidateRecord } from "./state-ballot-records.js";
import type { StateBallotSource } from "./state-ballot-sources.js";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { electionDocumentPolicyFingerprint, electionDocumentRobotsPolicy } from "./election-document-collection.js";
import { fetchRemoteSourceText } from "./remote-json-source.js";
import { stateHtmlAttribute as attribute, stateHtmlDescendants as descendants, parseStateHtml, stateHtmlTableRows, stateHtmlText } from "./state-ballot-html.js";
import { StateBallotAwaitingRecordsError } from "./state-ballot-source-state.js";

export const washoeDiscoveryUrl = "https://www.washoecounty.gov/voters/information/";
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const clean = (value: string) => value.normalize("NFKC").replace(/\s+/gu, " ").trim();
const text = (node: StateHtmlNode) => clean(stateHtmlText(node));
const exact = (value: unknown, keys: string[]): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).sort().join(",") === [...keys].sort().join(","));
const classes = (node: StateHtmlNode) => attribute(node, "class").split(/\s+/u);
const policyPages = [
	{ id: "robots", url: "https://www.washoecounty.gov/robots.txt", format: "robots", sha256: "95bed15d69f598231c1343c8837a760a753ea6f5d9063ed633f7422fcd085fb1" },
	{ id: "home-links", url: "https://www.washoecounty.gov/", format: "links", sha256: "936be5a45e3c5fdb6523bcee0d7b673c1ece79e65c4fb3119fd8a07351b15f51" },
	{ id: "privacy", url: "https://www.washoecounty.gov/Privacy/", format: "main", sha256: "61008e45ee00f5a1c9bd3510ffd94e2515b3ab151959a2c60da458c7a285565d" },
] as const;
export const washoePolicyReceipts = policyPages.map(({ id, url, sha256 }) => ({ id, url, sha256 }));
const partyNames: Record<string, string> = { DEM: "Democratic", REP: "Republican", IAP: "Independent American Party", NPP: "No Political Party", LPN: "Libertarian Party of Nevada" };
const sections = ["Federal District Partisan Offices", "Statewide Partisan Offices", "District Partisan Offices", "County Partisan Offices", "Statewide Nonpartisan Offices", "District Nonpartisan Offices", "City of Reno Offices", "City of Sparks Offices", "Statewide Ballot Questions", "County Ballot Questions"];
type Factory = (source: StateBallotSource, values: StateCandidateValues) => StateCandidateRecord | null;
type TextRequest = (url: string, options: { allowedHosts: string[]; maxBytes: number; maxRedirects: number; timeoutMs: number }) => Promise<string>;
export interface WashoeElection { electionId: null; electionDate: string; pageUrl: string }
export interface WashoeQuestion { title: string; designation: string; question: string; scope: "statewide" | "local" }

export function validateWashoeElection(value: unknown): asserts value is WashoeElection {
	if (!exact(value, ["electionId", "electionDate", "pageUrl"]) || value.electionId !== null || typeof value.electionDate !== "string" || !/^20\d{2}-11-0[2-8]$/u.test(value.electionDate) || value.electionDate < "2026-11-03" || Number(value.electionDate.slice(0, 4)) % 2 !== 0 || new Date(`${value.electionDate}T00:00:00Z`).getUTCDay() !== 2 || value.pageUrl !== washoeDiscoveryUrl) throw new Error("The Washoe County election identity requires review.");
}
export function validateWashoeSource(source: StateBallotSource) {
	validateWashoeElection({ electionId: null, electionDate: source.electionDate, pageUrl: source.pageUrl });
	if (source.stateCode !== "NV" || source.format !== "washoe-html" || source.countyName !== "Washoe County" || source.retrievalPolicy || source.postBody || source.delimiter || source.url !== washoeDiscoveryUrl || source.snapshotStorage !== "external" || JSON.stringify(source.documentUrls) !== JSON.stringify([washoeDiscoveryUrl]) || source.documentLinks || source.id !== (source.electionDate === "2026-11-03" ? "nv-washoe-2026" : `nv-washoe-general-${source.electionDate}`)) throw new Error("The automatic Washoe County source identity is invalid.");
}
function main(body: string) {
	if (Buffer.byteLength(body) > 2 * 1024 * 1024 || electionDocumentPolicyFingerprint(Buffer.from(body), "links", washoeDiscoveryUrl) !== "7eede680eb3f1652009848b2659e65c9ddb76309267013ad170f0314562d591c") throw new Error("Washoe County page size or publication policy links require review.");
	const nodes = descendants(parseStateHtml(body), node => node.nodeName === "main");
	if (nodes.length !== 1) throw new Error("The Washoe County election has no unique main region.");
	return nodes[0]!;
}
export function readWashoeElection(body: string): WashoeElection {
	const region = main(body);
	const callouts = descendants(region, node => node.nodeName === "section" && classes(node).includes("general-election-callout"));
	const titles = descendants(region, node => node.nodeName === "h2" && /^20\d{2} General Election$/u.test(text(node)));
	const dates = callouts.length === 1 ? [...text(callouts[0]!).matchAll(/Tuesday, November ([2-8]), (20\d{2})/gu)] : [];
	if (titles.length !== 1 || dates.length !== 1 || text(titles[0]!) !== `${dates[0]![2]} General Election`) throw new Error("The Washoe County printed general-election date is missing or ambiguous.");
	const election = { electionId: null, electionDate: `${dates[0]![2]}-11-0${dates[0]![1]}`, pageUrl: washoeDiscoveryUrl };
	validateWashoeElection(election);
	return election;
}
export function readWashoeDiscovery(body: string, now = Date.now()) {
	if (Buffer.byteLength(body) > 3 * 1024 * 1024) throw new Error("The Washoe County capture exceeds its bounds.");
	const value = JSON.parse(body);
	if (!exact(value, ["schemaVersion", "type", "policies", "page"]) || value.schemaVersion !== 1 || value.type !== "washoe-candidate-capture" || JSON.stringify(value.policies) !== JSON.stringify(washoePolicyReceipts) || !exact(value.page, ["url", "body", "sha256", "retrievedAt"]) || value.page.url !== washoeDiscoveryUrl || typeof value.page.body !== "string" || value.page.sha256 !== hash(value.page.body) || typeof value.page.retrievedAt !== "string" || !Number.isFinite(Date.parse(value.page.retrievedAt)) || new Date(value.page.retrievedAt).toISOString() !== value.page.retrievedAt || Date.parse(value.page.retrievedAt) > now) throw new Error("The Washoe County capture or provenance requires review.");
	return { election: readWashoeElection(value.page.body), page: value.page as unknown as { url: string; body: string; sha256: string; retrievedAt: string } };
}
function officeValues(title: string, section: string): Omit<StateCandidateValues, "name" | "party"> {
	let match: RegExpExecArray | null;
	match = /^REPRESENTATIVE IN CONGRESS, DISTRICT ([1-9]\d?)$/u.exec(title);
	if (section === "Federal District Partisan Offices" && match) return { office: `Representative in Congress, District ${match[1]}`, district: match[1], scope: "congressional" };
	const statewide: Record<string, string> = { "GOVERNOR": "Governor", "LIEUTENANT GOVERNOR": "Lieutenant Governor", "SECRETARY OF STATE": "Secretary of State", "STATE TREASURER": "State Treasurer", "STATE CONTROLLER": "State Controller", "ATTORNEY GENERAL": "Attorney General" };
	if (section === "Statewide Partisan Offices" && statewide[title]) return { office: statewide[title]!, scope: "statewide" };
	match = /^STATE (SENATE|ASSEMBLY), DISTRICT ([1-9]\d?)$/u.exec(title);
	if (section === "District Partisan Offices" && match) return { office: `State ${match[1] === "SENATE" ? "Senate" : "Assembly"}, District ${match[2]}`, district: match[2], scope: match[1] === "SENATE" ? "state-senate" : "state-house" };
	if (section === "County Partisan Offices") {
		match = /^COUNTY COMMISSIONER, DISTRICT ([1-9]\d?)$/u.exec(title);
		if (match) return { office: `County Commission, District ${match[1]}`, district: match[1], scope: "local", jurisdiction: "Washoe County" };
		const offices: Record<string, string> = { "COUNTY ASSESSOR": "County Assessor", "COUNTY CLERK": "County Clerk", "COUNTY DISTRICT ATTORNEY": "District Attorney", "COUNTY PUBLIC ADMINISTRATOR": "Public Administrator", "COUNTY RECORDER": "County Recorder", "COUNTY TREASURER": "County Treasurer" };
		if (offices[title]) return { office: offices[title]!, scope: "local", jurisdiction: "Washoe County" };
	}
	match = /^SUPREME COURT JUSTICE, SEAT ([A-Z])$/u.exec(title);
	if (section === "Statewide Nonpartisan Offices" && match) return { office: `Justice of the Supreme Court, Seat ${match[1]}`, scope: "statewide" };
	if (section === "District Nonpartisan Offices") {
		match = /^DISTRICT COURT JUDGE, DEPARTMENT ([1-9]\d?)(, FAMILY COURT)?$/u.exec(title);
		if (match) return { office: `District Court Judge, Department ${match[1]}${match[2] ? ", Family Court" : ""}`, scope: "local", jurisdiction: "Washoe County" };
		match = /^NEVADA BOARD OF REGENTS, DISTRICT ([1-9]\d?)$/u.exec(title);
		if (match) return { office: `Board of Regents, District ${match[1]}`, district: match[1], scope: "local", jurisdiction: "Board of Regents" };
		match = /^WASHOE COUNTY SCHOOL BOARD, DISTRICT ([A-Z]) AT-LARGE$/u.exec(title);
		if (match) return { office: `Washoe County School Board, District ${match[1]} At-Large`, district: match[1], scope: "local", jurisdiction: "Washoe County School Board" };
		const districts: Record<string, string> = { "INCLINE VILLAGE GENERAL IMPROVEMENT DISTRICT": "Incline Village General Improvement District", "PALOMINO VALLEY GENERAL IMPROVEMENT DISTRICT": "Palomino Valley General Improvement District", "VERDI TV DISTRICT": "Verdi TV District" };
		if (districts[title]) return { office: districts[title]!, scope: "local", jurisdiction: districts[title]! };
	}
	if (["City of Reno Offices", "City of Sparks Offices"].includes(section)) {
		const city = section === "City of Reno Offices" ? "Reno" : "Sparks";
		if (title === `${city.toUpperCase()} CITY MAYOR`) return { office: "Mayor", scope: "local", jurisdiction: `City of ${city}` };
		match = /^(RENO|SPARKS) CITY COUNCIL, WARD ([1-9]\d?)$/u.exec(title);
		if (match && match[1] === city.toUpperCase()) return { office: `City Council, Ward ${match[2]}`, district: match[2], scope: "local", jurisdiction: `City of ${city}` };
		if (city === "Reno" && title === "RENO CITY ATTORNEY") return { office: "City Attorney", scope: "local", jurisdiction: "City of Reno" };
		match = /^RENO MUNICIPAL COURT JUDGE, DEPARTMENT ([1-9]\d?)$/u.exec(title);
		if (city === "Reno" && match) return { office: `Municipal Court Judge, Department ${match[1]}`, scope: "local", jurisdiction: "City of Reno" };
	}
	throw new Error("The Washoe County printed office or section requires review.");
}
export function readWashoeCandidatePage(source: StateBallotSource, body: string, factory: Factory) {
	validateWashoeSource(source);
	const election = readWashoeElection(body);
	if (election.electionDate !== source.electionDate) throw new Error("The Washoe County roster belongs to another election.");
	const region = main(body);
	const markers = descendants(region, node => node.nodeName === "h1" && text(node) === "All Election Contests");
	const tables = descendants(region, node => node.nodeName === "table");
	if (!markers.length && !tables.length) throw new StateBallotAwaitingRecordsError(source.id);
	if (markers.length !== 1 || !tables.length || tables.length > 300 || descendants(region, node => ["form", "input", "button", "select"].includes(node.nodeName) || /\b(?:next|prev)\b/u.test(attribute(node, "rel"))).length) throw new Error("The Washoe County table set or controls require review.");
	const records: StateCandidateRecord[] = [];
	const nonpersonOptions: { title: string; text: string }[] = [];
	const questions: WashoeQuestion[] = [];
	const titles = new Set<string>();
	const printedSections: string[] = [];
	const printedOffices = new Map<string, StateCandidateRecord[]>();
	let started = false;
	let section = "";
	let count = 0;
	for (const node of descendants(region, node => ["h1", "h2", "table"].includes(node.nodeName))) {
		if (node === markers[0]) {
			started = true;
			continue;
		}
		if (!started) continue;
		if (node.nodeName === "h2") {
			section = text(node);
			if (section !== sections[printedSections.length]) throw new Error("The Washoe County contest section requires review.");
			printedSections.push(section);
			continue;
		}
		if (node.nodeName !== "table") throw new Error("The Washoe County contest boundaries changed.");
		count++;
		if (!section || !classes(node).includes("office-table") || [node, ...descendants(node, () => true)].some(item => Boolean(attribute(item, "rowspan")) || item.attrs?.some(entry => entry.name === "hidden") || attribute(item, "aria-hidden") === "true" || /display\s*:\s*none|visibility\s*:\s*hidden/iu.test(attribute(item, "style")))) throw new Error("The Washoe County table identity requires review.");
		const rows = stateHtmlTableRows(node).map(row => (row.childNodes ?? []).filter(cell => ["td", "th"].includes(cell.nodeName)));
		const headings = descendants(node, item => item.nodeName === "h3");
		if (headings.length !== 1 || !rows.length || rows.length > 100 || rows[0]!.length !== 1) throw new Error("The Washoe County office heading requires review.");
		const title = text(headings[0]!);
		if (!title || titles.has(title)) throw new Error("The Washoe County office is missing or duplicated.");
		titles.add(title);
		if (section.endsWith("Ballot Questions")) {
			if (rows.length !== 2 || rows[1]!.length !== 1 || (!/^STATE QUESTION NO\. [1-9]\d?$/u.test(title) && !/^WASHOE COUNTY QUESTION NO\. [1-9]\d?$/u.test(title)) || title.startsWith("STATE ") !== section.startsWith("Statewide ")) throw new Error("The Washoe County question scope or layout requires review.");
			const question = text(rows[1]![0]!);
			if (!question || question.length > 10000) throw new Error("The Washoe County question text requires review.");
			questions.push({ title, designation: text(rows[0]![0]!).slice(title.length).trim(), question, scope: section.startsWith("Statewide ") ? "statewide" : "local" });
			continue;
		}
		const partisan = section.includes("Partisan Offices") && !section.includes("Nonpartisan");
		const columns = partisan ? 2 : 1;
		const terms = descendants(rows[0]![0]!, item => item.nodeName === "p");
		const term = terms.length === 1 ? /^(Two|Four|Six) \(([246])\) Year Term \/ Vote for (One|Two|Three)$/u.exec(text(terms[0]!)) : null;
		if (!term || ({ Two: "2", Four: "4", Six: "6" } as Record<string, string>)[term[1]!] !== term[2] || rows.length < 3 || rows[1]!.map(text).join("|") !== (partisan ? "Candidate|Party" : "Candidate") || rows.slice(1).some(row => row.length !== columns || row.some(cell => Boolean(attribute(cell, "colspan"))))) throw new Error("The Washoe County candidate columns or vote instructions require review.");
		const values = officeValues(title, section);
		const named: StateCandidateRecord[] = [];
		for (const row of rows.slice(2)) {
			const name = text(row[0]!);
			const partyCode = partisan ? text(row[1]!) : "";
			if (name === "None of these candidates") {
				if (partyCode || !["Statewide Partisan Offices", "Statewide Nonpartisan Offices"].includes(section)) throw new Error("The Washoe County nonperson option requires review.");
				nonpersonOptions.push({ title, text: name });
				continue;
			}
			const parts = /^([^,]{1,100}), (?:(Jr\.|Sr\.|II|III|IV|V), )?([^,]{1,150})$/u.exec(name);
			if (!parts || (partisan && !partyNames[partyCode])) throw new Error("The Washoe County printed name or party requires review.");
			const record = factory(source, { ...values, name: `${parts[3]} ${parts[1]}${parts[2] ? `, ${parts[2]}` : ""}`, party: partisan ? partyNames[partyCode]! : "", termYears: Number(term[2]) });
			if (!record) throw new Error("The Washoe County candidate is incomplete.");
			record.voteLimit = ({ One: 1, Two: 2, Three: 3 } as Record<string, number>)[term[3]!]!;
			if (record.scope === "local") record.sourceAreaLabel = "Washoe County";
			records.push(record);
			named.push(record);
		}
		if (!named.length) throw new Error("The Washoe County candidate office is empty.");
		printedOffices.set(title, named);
	}
	if (printedSections.length !== sections.length || count !== tables.length || !records.length || records.length > 2000 || new Set(records.map(record => record.id)).size !== records.length) throw new Error("The Washoe County candidate tables are incomplete or duplicated.");
	const deathNotices = descendants(region, node => node.nodeName === "section" && classes(node).includes("candidate-death-notice"));
	const deathHeadings = descendants(region, node => /^h[1-6]$/u.test(node.nodeName) && text(node) === "Notice of Death of Candidate");
	if (deathHeadings.length !== deathNotices.length || deathNotices.some(notice => descendants(notice, node => deathHeadings.includes(node)).length !== 1)) throw new Error("The Washoe County candidate-death notice structure requires review.");
	for (const notice of deathNotices) {
		const match = /^Notice of Death of Candidate Voters are advised that (.{1,150}), candidate for (.{1,200}), has passed away\. His name will remain on the ballot for the November ([2-8]), (20\d{2}) General Election\.$/u.exec(text(notice));
		if (!match || `${match[4]}-11-0${match[3]}` !== source.electionDate) throw new Error("The Washoe County candidate-death notice requires review.");
		const matches = [...printedOffices.values()].flat().filter(record => record.name === clean(match[1]!) && record.office.toLowerCase() === clean(match[2]!).toLowerCase());
		if (matches.length !== 1) throw new Error("The Washoe County candidate-death notice has no unique matching record.");
		matches[0]!.status = "inactive";
		matches[0]!.sourceStatus = "Deceased; name remains on ballot";
	}
	return { records, nonpersonOptions, questions, offices: printedOffices.size };
}
export function parseWashoeCandidateCapture(source: StateBallotSource, body: string, factory: Factory, now = Date.now()) {
	const capture = readWashoeDiscovery(body, now);
	const result = readWashoeCandidatePage(source, capture.page.body, factory);
	return { records: result.records, retrievedAt: capture.page.retrievedAt, sha256: capture.page.sha256, collectionIndexSha256: capture.page.sha256, documents: [{ url: washoeDiscoveryUrl, sha256: capture.page.sha256, retrievedAt: capture.page.retrievedAt, includedRecordCount: result.records.length }] };
}
export async function fetchWashoeCycleDiscovery(options: { requestText?: TextRequest; wait?: (milliseconds: number) => Promise<void>; now?: () => number } = {}) {
	const request = options.requestText ?? fetchRemoteSourceText;
	const wait = options.wait ?? (milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds)));
	const transport = { allowedHosts: ["www.washoecounty.gov"], maxBytes: 2 * 1024 * 1024, maxRedirects: 0, timeoutMs: 25000 };
	let robots: ReturnType<typeof electionDocumentRobotsPolicy> | undefined;
	const get = async (url: string) => {
		if (robots) {
			if (!robots.allowed(url)) throw new Error("Washoe County robots policy disallows this publication.");
			await wait(robots.delay);
		}
		return request(url, transport);
	};
	for (const policy of policyPages) {
		const body = await get(policy.url);
		if (electionDocumentPolicyFingerprint(Buffer.from(body), policy.format, policy.url) !== policy.sha256) throw new Error("Washoe County access or reuse policy requires review.");
		if (policy.format === "robots") robots = electionDocumentRobotsPolicy(Buffer.from(body), ["ia_archiver", "fesswc"]);
	}
	const body = await get(washoeDiscoveryUrl);
	const capture = JSON.stringify({ schemaVersion: 1, type: "washoe-candidate-capture", policies: washoePolicyReceipts, page: { url: washoeDiscoveryUrl, body, sha256: hash(body), retrievedAt: new Date((options.now ?? Date.now)()).toISOString() } });
	readWashoeDiscovery(capture, (options.now ?? Date.now)());
	return capture;
}

export async function fetchWashoeCandidateCapture(source: StateBallotSource, options: Parameters<typeof fetchWashoeCycleDiscovery>[0] & { discovery?: string } = {}) {
	validateWashoeSource(source);
	const body = options.discovery ?? await fetchWashoeCycleDiscovery(options);
	if (readWashoeDiscovery(body, (options.now ?? Date.now)()).election.electionDate !== source.electionDate) throw new Error("The Washoe County offered election differs from its source.");
	return body;
}
