import type { StateBallotQuestion } from "./state-ballot-questions.js";
import type { StateCandidateRecord, StateContestScope } from "./state-ballot-records.js";
import type { StateBallotSource } from "./state-ballot-sources.js";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { fetchRemoteSourceDocument, fetchRemoteSourceText } from "./remote-json-source.js";
import { parseFultonBallotQuestions } from "./state-ballot-fulton-questions.js";
import { parseStateHtml, stateHtmlAttribute, stateHtmlDescendants, stateHtmlText } from "./state-ballot-html.js";
import { extractStateBallotPdfText as extractFultonPdfText, StateBallotPdfCapabilityError as FultonCollectorCapabilityError, resolveStateBallotPdfExtractor as resolveFultonExtractor, stateBallotPdfCollectorContract } from "./state-ballot-pdf.js";
import { containsControlCharacters } from "./text-validation.js";

export const fultonDiscoveryUrl = "https://fultoncountyga.gov/inside-fulton-county/fulton-county-departments/registration-and-elections/sample-ballots";
export const fultonScopeUrl = "https://georgia.gov/organization/public-service-commission";
export const fultonCollectorContract = Object.freeze({ schemaVersion: 1, familyId: "ga-fulton-2026", ...stateBallotPdfCollectorContract });
export { extractFultonPdfText, FultonCollectorCapabilityError, resolveFultonExtractor };
export interface FultonElection {
	electionId: null;
	electionDate: string;
	documents: { kind: "consolidated" | "qualified-writeins" | "psc-scope"; url: string }[];
}
type TextRequest = (url: string, options: { allowedHosts: string[]; maxBytes: number; maxRedirects: number; timeoutMs: number }) => Promise<string>;
interface FultonDiscovery {
	schemaVersion: 1;
	type: "fulton-discovery";
	index: string;
	policies: typeof fultonPolicyReceipts;
	scope: string;
}
export const fultonPolicyReceipts = [
	{ url: "https://fultoncountyga.gov/robots.txt", sha256: "b230dabf49d3bef4fe0405897003ba431b21acfbffb760ba3dd8f8fbaa87a299", region: "bytes" },
	{ url: "https://fultoncountyga.gov/Privacy-Statement", sha256: "990d9934babb01802f951b8a3632a6eb395ef2d6c1622315de0466f7294cf941", region: "main-text" },
	{ url: "https://georgia.gov/robots.txt", sha256: "1ec8e6c4fed3dc4f55da7a82412fc7bb6649941ba44ccc6b47ba7968604d1c1b", region: "bytes" },
	{ url: "https://georgia.gov/privacy-and-security", sha256: "7581f778b908fa9331632f4c37b400dca187f9a7102267df84d55103147489cf", region: "main-text" },
] as const;
const digest = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const clean = (value: string) => value.replace(/\s+/gu, " ").trim();
const keys = (value: unknown, expected: string[]): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).sort().join("|") === [...expected].sort().join("|"));
function generalDate(value: string) {
	const date = new Date(`${value}T00:00:00Z`);
	return /^20\d{2}-11-0[2-8]$/u.test(value) && Number.isFinite(date.valueOf()) && date.toISOString().slice(0, 10) === value && date.getUTCDay() === 2 && value >= "2026-11-03";
}
function main(body: string) {
	if (Buffer.byteLength(body) > 3 * 1024 * 1024) throw new Error("The Fulton policy/index exceeds its bounds.");
	const nodes = stateHtmlDescendants(parseStateHtml(body), node => node.nodeName === "main");
	if (nodes.length !== 1) throw new Error("The Fulton policy/index layout has changed.");
	return nodes[0]!;
}
function mainText(body: string) {
	return clean(stateHtmlText(main(body)));
}
function pdfUrl(value: string) {
	const url = new URL(value, fultonDiscoveryUrl);
	if (url.origin !== "https://fultoncountyga.gov" || url.username || url.password || url.search || url.hash || !/^\/-\/media\/[\w/-]+\.pdf$/u.test(url.pathname)) throw new Error("The Fulton document must be a published same-host PDF.");
	return url.href;
}
export function validateFultonElection(value: unknown): asserts value is FultonElection {
	if (!keys(value, ["electionId", "electionDate", "documents"]) || value.electionId !== null || typeof value.electionDate !== "string" || !generalDate(value.electionDate) || !Array.isArray(value.documents) || value.documents.length < 2 || value.documents.length > 12) throw new Error("The Fulton election identity is invalid.");
	const urls: string[] = [];
	for (const [position, item] of value.documents.entries()) {
		if (!keys(item, ["kind", "url"]) || typeof item.url !== "string" || item.kind !== (position === 0 ? "consolidated" : position === value.documents.length - 1 ? "psc-scope" : "qualified-writeins") || (item.kind === "psc-scope" ? item.url !== fultonScopeUrl : pdfUrl(item.url) !== item.url)) throw new Error("The Fulton published document set is invalid.");
		urls.push(item.url);
	}
	if (new Set(urls).size !== urls.length) throw new Error("The Fulton document set repeats a URL.");
}
function readDiscovery(body: string): FultonDiscovery {
	if (Buffer.byteLength(body) > 4 * 1024 * 1024) throw new Error("The Fulton discovery exceeds its bounds.");
	const value: unknown = JSON.parse(body);
	if (!keys(value, ["schemaVersion", "type", "index", "policies", "scope"]) || value.schemaVersion !== 1 || value.type !== "fulton-discovery" || typeof value.index !== "string" || typeof value.scope !== "string" || JSON.stringify(value.policies) !== JSON.stringify(fultonPolicyReceipts)) throw new Error("The Fulton discovery evidence is invalid.");
	const result = value as unknown as FultonDiscovery;
	for (const [html, base, expected] of [[result.index, fultonDiscoveryUrl, "https://fultoncountyga.gov/Privacy-Statement"], [result.scope, fultonScopeUrl, "https://georgia.gov/privacysecurity"]]) {
		const links = stateHtmlDescendants(parseStateHtml(html!), node => node.nodeName === "a" && /privacy|terms of use|copyright|acceptable use|legal notice/iu.test(stateHtmlText(node))).map(node => new URL(stateHtmlAttribute(node, "href"), base).href);
		if (links.length !== 1 || links[0] !== expected) throw new Error("The published Fulton/Georgia policy link inventory changed.");
	}
	if (!mainText(result.scope).toLowerCase().includes("five members of the commission are determined by statewide election")) throw new Error("The official PSC statewide-election scope is not confirmed.");
	return result;
}
export function readFultonElectionDiscovery(body: string): FultonElection[] {
	const discovery = readDiscovery(body);
	const content = main(discovery.index);
	if (!mainText(discovery.index).includes("Sample Ballots")) throw new Error("The Fulton candidate index has changed.");
	const offered = new Map<string, FultonElection>();
	for (const link of stateHtmlDescendants(content, node => node.nodeName === "a")) {
		const label = clean(stateHtmlText(link));
		const consolidated = /^Click here for the November ([2-8]), (20\d{2}) General \/ Special Election Consolidated Sample Ballot\.$/u.exec(label);
		const writeins = /^Click here to view the November ([2-8]), (20\d{2}) Notice of Qualified Write-In Candidates for Fulton County Commission District [1-9]\d?\.$/u.exec(label);
		const identity = consolidated ?? writeins;
		if (!identity) {
			if (/Consolidated Sample Ballot|Qualified Write-In Candidates for Fulton/iu.test(label)) throw new Error("The Fulton dated publication label has changed.");
			continue;
		}
		const electionDate = `${identity[2]}-11-0${identity[1]}`;
		if (electionDate < "2026-11-03") continue;
		if (!generalDate(electionDate)) throw new Error("The Fulton publication date is not a supported November general election.");
		const entry = offered.get(electionDate) ?? { electionId: null, electionDate, documents: [] };
		if (consolidated && entry.documents.some(item => item.kind === "consolidated")) throw new Error("The Fulton consolidated publication is ambiguous.");
		entry.documents.push({ kind: consolidated ? "consolidated" : "qualified-writeins", url: pdfUrl(stateHtmlAttribute(link, "href")) });
		offered.set(electionDate, entry);
	}
	const elections = [...offered.values()].map((entry) => {
		entry.documents.sort((first, second) => Number(second.kind === "consolidated") - Number(first.kind === "consolidated"));
		entry.documents.push({ kind: "psc-scope", url: fultonScopeUrl });
		validateFultonElection(entry);
		return entry;
	});
	if (!elections.length || elections.length > 20) throw new Error("The Fulton index has no bounded dated general-election publications.");
	return elections.sort((first, second) => first.electionDate.localeCompare(second.electionDate));
}
export async function fetchFultonCycleDiscovery(request: TextRequest = fetchRemoteSourceText) {
	const options = { allowedHosts: ["fultoncountyga.gov", "georgia.gov"], maxBytes: 3 * 1024 * 1024, maxRedirects: 0, timeoutMs: 12000 };
	const fultonRobots = await request("https://fultoncountyga.gov/robots.txt", options);
	if (digest(fultonRobots) !== "b230dabf49d3bef4fe0405897003ba431b21acfbffb760ba3dd8f8fbaa87a299") throw new Error("Fulton robots policy requires review.");
	const index = await request(fultonDiscoveryUrl, options);
	const fultonPrivacy = await request("https://fultoncountyga.gov/Privacy-Statement", options);
	if (digest(mainText(fultonPrivacy)) !== "990d9934babb01802f951b8a3632a6eb395ef2d6c1622315de0466f7294cf941") throw new Error("Fulton privacy policy requires review.");
	const georgiaRobots = await request("https://georgia.gov/robots.txt", options);
	if (digest(georgiaRobots) !== "1ec8e6c4fed3dc4f55da7a82412fc7bb6649941ba44ccc6b47ba7968604d1c1b") throw new Error("Georgia.gov robots policy requires review.");
	const georgiaPrivacy = await request("https://georgia.gov/privacy-and-security", options);
	if (digest(mainText(georgiaPrivacy)) !== "7581f778b908fa9331632f4c37b400dca187f9a7102267df84d55103147489cf") throw new Error("Georgia.gov privacy policy requires review.");
	const scope = await request(fultonScopeUrl, options);
	const body = JSON.stringify({ schemaVersion: 1, type: "fulton-discovery", index, policies: fultonPolicyReceipts, scope });
	readFultonElectionDiscovery(body);
	return body;
}
export function validateFultonSource(source: StateBallotSource) {
	if (source.stateCode !== "GA" || source.format !== "fulton-pdf" || source.retrievalPolicy || source.postBody || source.delimiter || !generalDate(source.electionDate) || source.id !== (source.electionDate === "2026-11-03" ? "ga-fulton-2026" : `ga-fulton-general-${source.electionDate}`) || source.pageUrl !== fultonDiscoveryUrl || !source.documentUrls?.length || source.documentUrls.length < 2 || source.documentUrls.length > 12 || source.url !== (source.electionDate === "2026-11-03" ? source.documentUrls[0] : fultonDiscoveryUrl)) throw new Error("The automatic Fulton source identity is invalid.");
	validateFultonElection({ electionId: null, electionDate: source.electionDate, documents: source.documentUrls.map((url, position) => ({ kind: position === 0 ? "consolidated" : position === source.documentUrls!.length - 1 ? "psc-scope" : "qualified-writeins", url })) });
}

interface CapturedFultonDocument { url: string; sha256: string; retrievedAt: string; text: string }
export async function fetchFultonCandidateCapture(source: StateBallotSource, options: { requestText?: TextRequest; requestDocument?: typeof fetchRemoteSourceDocument; extractor?: (bytes: Buffer) => Promise<string>; discovery?: string; now?: () => number } = {}) {
	validateFultonSource(source);
	const executable = options.extractor ? null : await resolveFultonExtractor();
	const discovery = options.discovery ?? await fetchFultonCycleDiscovery(options.requestText);
	const parsed = readDiscovery(discovery);
	const election = readFultonElectionDiscovery(discovery).find(entry => entry.electionDate === source.electionDate);
	if (!election || election.documents.map(item => item.url).join("|") !== source.documentUrls!.join("|")) throw new Error("The Fulton published document set changed and requires review.");
	const documents: CapturedFultonDocument[] = [];
	for (const item of election.documents) {
		if (item.kind === "psc-scope") {
			documents.push({ url: item.url, text: parsed.scope, sha256: digest(parsed.scope), retrievedAt: new Date((options.now ?? Date.now)()).toISOString() });
		}
		else {
			const response = await (options.requestDocument ?? fetchRemoteSourceDocument)(item.url, { allowedHosts: ["fultoncountyga.gov"], maxBytes: fultonCollectorContract.maximumPdfBytes, timeoutMs: fultonCollectorContract.timeoutMs });
			if (response.status !== 200 || response.contentType !== "application/pdf") throw new Error("The Fulton PDF request failed without a permitted document.");
			const text = await (options.extractor ?? (bytes => extractFultonPdfText(bytes, executable!)))(response.body);
			documents.push({ url: item.url, text, sha256: digest(response.body), retrievedAt: new Date((options.now ?? Date.now)()).toISOString() });
		}
	}
	const body = JSON.stringify({ schemaVersion: 1, type: "fulton-candidate-export", discovery, documents });
	if (Buffer.byteLength(body) > 12 * 1024 * 1024) throw new Error("The Fulton candidate capture exceeds its bounds.");
	return body;
}

function classifyOffice(office: string): { scope: StateContestScope; district: string } {
	const district = /District (\d+)$/u.exec(office)?.[1] ?? "";
	if (/^United States House of Representatives [-–] District [1-9]\d?$/u.test(office)) return { scope: "congressional", district };
	if (/^State Senate District [1-9]\d?$/u.test(office)) return { scope: "state-senate", district };
	if (/^State House of Representatives [-–] District [1-9]\d{0,2}$/u.test(office)) return { scope: "state-house", district };
	if (/^(?:County Commission Chairperson|County Commissioner [-–] District [1-9]\d?|Fulton Soil & Water Conservation District Supervisor)$/u.test(office)) return { scope: "local", district };
	if (/^(?:United States Senate|Governor|Lieutenant Governor|Secretary of State|Attorney General|Commissioner of Agriculture|Commissioner of Insurance|State School Superintendent|Labor Commissioner|Public Service Commissioner District [1-5])$/u.test(office)) return { scope: "statewide", district };
	throw new Error("The Fulton candidate office is unsupported and requires review.");
}
function recordIdentity(source: StateBallotSource, office: string, name: string) {
	return digest(JSON.stringify([source.id, office, name])).slice(0, 24);
}
function printedDate(date: string) {
	return `November ${Number(date.slice(-2))}, ${date.slice(0, 4)}`;
}
function validateName(name: string) {
	if (!name || name.length > 250 || containsControlCharacters(name) || /\b(?:Notice|Election|Secretary|Voter|Write[ -]?in|SAMPLE|Shall|Yes|No)\b|https?:|@|\d{4}/iu.test(name)) throw new Error("The Fulton candidate name has an unsupported layout.");
}
function consolidatedRecords(source: StateBallotSource, body: string) {
	const pages = body.split("\f").filter(page => page.trim());
	if (!pages.length || pages.length > 50) throw new Error("The Fulton ballot page count is unsupported.");
	const records: StateCandidateRecord[] = [];
	let questionsStarted = false;
	for (const page of pages) {
		if (!page.includes("FULTON COUNTY ELECTIONS") || !page.includes(`${printedDate(source.electionDate)} General Special Election`) || !page.includes("CONSOLIDATED SAMPLE BALLOT")) throw new Error("The Fulton ballot does not identify the selected election.");
		const lines = page.split(/\r?\n/u);
		const first = lines.findIndex(line => line.trim().startsWith("For ") && !line.trim().startsWith("For the "));
		if (first < 0) {
			if (!/Yes or No/u.test(page)) throw new Error("A Fulton ballot page has no recognized candidate or question structure.");
			questionsStarted = true;
			continue;
		}
		if (questionsStarted) throw new Error("Candidate pages follow unvalidated ballot-question pages.");
		let contest: { office: string; district: string; scope: StateContestScope; column: number; term?: string } | undefined;
		for (let position = first; position < lines.length; position++) {
			const line = lines[position]!;
			if (!line.trim()) continue;
			const columns = line.trim().split(/ {2,}/u);
			const office = columns.length === 2 && columns[0]!.startsWith("For ") ? columns[0]!.slice(4) : null;
			const unexpired = columns.length === 2 && /^\(Unexpired Term [^\r\n()]+\)$/u.test(columns[0]!) ? columns[0]! : null;
			let printed: string;
			if (office) {
				contest = { office, ...classifyOffice(office), column: line.lastIndexOf(columns[1]!) };
				printed = columns[1]!;
			}
			else if (contest && unexpired) {
				if (contest.term || !records.length) throw new Error("The Fulton unexpired-term annotation is ambiguous.");
				contest.term = unexpired;
				contest.office += " (Unexpired Term)";
				const previous = records.at(-1)!;
				previous.office = contest.office;
				previous.ballotDesignation = [previous.ballotDesignation, contest.term].filter(Boolean).join("; ");
				previous.id = recordIdentity(source, contest.office, previous.name);
				printed = columns[1]!;
			}
			else if (contest && Math.abs(line.search(/\S/u) - contest.column) <= 1) {
				printed = line.trim();
			}
			else {
				if (lines.slice(position, position + 5).some(value => /^\s*Yes or No\s*$/u.test(value))) {
					questionsStarted = true;
					break;
				}
				throw new Error("An unrecognized row interrupts the Fulton candidate table.");
			}
			if (!contest || contest.column < 25 || contest.column > 150) throw new Error("The Fulton candidate columns have changed.");
			const incumbent = /\(Incumbent\)?$/u.exec(printed)?.[0];
			if (incumbent && !printed.slice(0, -incumbent.length).endsWith(" ")) throw new Error("The Fulton incumbency annotation has changed.");
			const candidateLine = incumbent ? printed.slice(0, -incumbent.length).trim() : printed;
			const separator = candidateLine.search(/\s[–-]\s/u);
			const party = separator < 0 ? undefined : candidateLine.slice(separator + 3).trim();
			const name = separator < 0 ? candidateLine : candidateLine.slice(0, separator).trim();
			if (party !== undefined && !/^(?:Republican|Democrat|Democratic|Libertarian|Independent|Green|Nonpartisan)$/u.test(party)) throw new Error("The Fulton printed party label is unsupported and requires review.");
			validateName(name);
			if ((incumbent && !incumbent.endsWith(")") && source.electionDate !== "2026-11-03") || (!party && /\s[–-]\s/u.test(printed))) throw new Error("The Fulton party/incumbency line requires review.");
			records.push({ id: recordIdentity(source, contest.office, name), name, office: contest.office, district: contest.district, scope: contest.scope, status: "listed", ...(party ? { party } : {}), ...(contest.scope === "statewide" ? { jurisdiction: "Georgia" } : {}), ...(contest.district ? { sourceDistrictLabel: `District ${contest.district}` } : {}), sourceAreaLabel: "Fulton County consolidated sample ballot", ...((incumbent || contest.term) ? { ballotDesignation: [incumbent, contest.term].filter(Boolean).join("; ") } : {}) });
		}
	}
	if (!records.length || records.length > 25000) throw new Error("The Fulton ballot has no validated candidate records.");
	return records;
}
function writeInRecords(source: StateBallotSource, body: string) {
	if (body.split("\f").filter(page => page.trim()).length !== 1) throw new Error("The Fulton write-in notice layout has changed.");
	const text = clean(body);
	const date = printedDate(source.electionDate).replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
	const match = new RegExp(`^NOTICE OF QUALIFIED WRITE-IN CANDIDATES Pursuant to Election Code 21-2-133 and 21-2-401\\(d\\), the following Write-In Candidates have qualified for the ${date}, General Election: For Fulton County Commission District ([1-9]\\d?) (.+?) Write-in votes will be counted only for the candidates on this list pursuant to O\\.C\\.G\\.A 21-2-494$`, "u").exec(text);
	if (!match) throw new Error("The Fulton qualified write-in notice does not match the selected election.");
	const district = match[1]!;
	const office = `County Commissioner – District ${district}`;
	const lines = body.split(/\r?\n/u).map(value => value.trim()).filter(Boolean);
	const start = lines.findIndex(line => line === `For Fulton County Commission District ${district}`);
	const end = lines.findIndex((line, index) => index > start && line.startsWith("Write-in votes"));
	if (start < 0 || end <= start + 1 || end - start > 30) throw new Error("The Fulton write-in names are not a bounded list.");
	return lines.slice(start + 1, end).map((name) => {
		validateName(name);
		return { id: recordIdentity(source, office, name), name, office, district, scope: "local" as const, status: "write-in" as const, sourceStatus: "Qualified write-in", sourceDistrictLabel: `District ${district}`, sourceAreaLabel: "Fulton County" };
	});
}
export function parseFultonCandidateCapture(source: StateBallotSource, body: string, previousQuestions?: readonly StateBallotQuestion[]) {
	validateFultonSource(source);
	if (Buffer.byteLength(body) > 12 * 1024 * 1024) throw new Error("The Fulton candidate capture exceeds its bounds.");
	const value: unknown = JSON.parse(body);
	if (!keys(value, ["schemaVersion", "type", "discovery", "documents"]) || value.schemaVersion !== 1 || value.type !== "fulton-candidate-export" || typeof value.discovery !== "string" || !Array.isArray(value.documents)) throw new Error("The Fulton candidate capture is invalid.");
	const discovery = readDiscovery(value.discovery);
	const election = readFultonElectionDiscovery(value.discovery).find(entry => entry.electionDate === source.electionDate);
	if (!election || election.documents.map(item => item.url).join("|") !== source.documentUrls!.join("|") || value.documents.length !== election.documents.length) throw new Error("The Fulton document evidence is incomplete or no longer published.");
	const records: StateCandidateRecord[] = [];
	const ballotQuestions: StateBallotQuestion[] = [];
	const documents = value.documents.map((item: unknown, position: number) => {
		const expected = election.documents[position]!;
		if (!keys(item, ["url", "sha256", "retrievedAt", "text"]) || item.url !== expected.url || typeof item.sha256 !== "string" || !/^[a-f0-9]{64}$/u.test(item.sha256) || typeof item.retrievedAt !== "string" || !Number.isFinite(Date.parse(item.retrievedAt)) || new Date(item.retrievedAt).toISOString() !== item.retrievedAt || typeof item.text !== "string" || Buffer.byteLength(item.text) > 4 * 1024 * 1024 || item.text.includes("\uFFFD")) throw new Error("The Fulton document provenance or text is invalid.");
		const selected = expected.kind === "consolidated" ? consolidatedRecords(source, item.text) : expected.kind === "qualified-writeins" ? writeInRecords(source, item.text) : [];
		if (expected.kind === "consolidated") ballotQuestions.push(...parseFultonBallotQuestions(source, item.text));
		if (expected.kind === "psc-scope" && (item.text !== discovery.scope || item.sha256 !== digest(item.text))) throw new Error("The Fulton PSC evidence changed within the capture.");
		records.push(...selected);
		return { url: expected.url, sha256: item.sha256, retrievedAt: item.retrievedAt, includedRecordCount: selected.length };
	});
	if (new Set(records.map(record => record.id)).size !== records.length || records.length > 25000) throw new Error("The Fulton candidate identities conflict or exceed their bounds.");
	if (previousQuestions?.some(question => !ballotQuestions.some(current => current.id === question.id))) throw new Error("An accepted Fulton question changed or disappeared; retain its snapshot for review.");
	return { records, ballotQuestions, documents, retrievedAt: new Date(Math.min(...documents.map(item => Date.parse(item.retrievedAt)))).toISOString(), sha256: digest(JSON.stringify(documents.map(({ url, sha256 }) => ({ url, sha256 })))) };
}
