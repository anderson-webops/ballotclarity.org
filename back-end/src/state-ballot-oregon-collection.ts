import type { fetchRemoteSourceDocument } from "./remote-json-source.js";
import type { StateCandidateValues } from "./state-ballot-additional-records.js";
import type { StateCandidateRecord } from "./state-ballot-records.js";
import type { StateBallotSource } from "./state-ballot-sources.js";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { electionDocumentPolicyFingerprint, electionDocumentRobotsPolicy } from "./election-document-collection.js";
import { fetchRemoteSourceText } from "./remote-json-source.js";
import { parseStateHtml, stateHtmlAttribute, stateHtmlDescendants, stateHtmlText } from "./state-ballot-html.js";
import { extractOregonCandidatePages, reconcileOregonCandidatePages } from "./state-ballot-oregon.js";
import { extractStateBallotPdfText, fetchStateBallotPdfDocument, resolveStateBallotPdfExtractor, stateBallotPdfCollectorContract } from "./state-ballot-pdf.js";

type TextRequest = (url: string, options: { allowedHosts: string[]; maxBytes: number; maxRedirects: number; timeoutMs: number }) => Promise<string>;
type OregonDocumentKind = "state-directive" | "county-general" | "county-rcv";
export interface OregonElection {
	electionId: null;
	electionDate: string;
	pageUrl: string;
	oregonDocuments: Array<{ kind: OregonDocumentKind; url: string }>;
}

export const oregonDiscoveryUrl = "https://multco.us/info/current-and-upcoming-elections-multnomah-county-elections";
const digest = (body: string | Buffer) => createHash("sha256").update(body).digest("hex");
const policyPages = [
	{ id: "robots", url: "https://multco.us/robots.txt", format: "robots", sha256: "803007435e82032fc59493356370597089f6e13a890990d6f3de11775be4dafe" },
	{ id: "home-links", url: "https://multco.us/", format: "links", sha256: "4df48d7dab285d5a8cc5a369d3cfdd373c13d067948eeacce3f3829d1cffb813" },
	{ id: "terms", url: "https://multco.us/info/multnomah-county-website-terms", format: "main", sha256: "4a281aa56b5992f5d1de04afdb86e84d33a2c50062140f105c2c60a6b1796406" },
	{ id: "privacy", url: "https://multco.us/info/privacy-policy", format: "main", sha256: "84856cc654aec7d6ccab2d07dcbb9b4c5c6fa75557ce03a9085459c4080dba00" },
	{ id: "accessibility", url: "https://multco.us/info/web-accessibility", format: "main", sha256: "c3bba0c40352e824b57681fadebab82f8a1c3f10988b2484970318112d763ff4" },
	{ id: "ada", url: "https://multco.us/info/ada-policy-notice-and-disability-complaint-process", format: "main", sha256: "60f4199dad779b3e11ae9af54f867fc04c2598e5552b162c62a1b61f93dea181" },
] as const;
export const oregonPolicyReceipts = policyPages.map(({ id, url, sha256 }) => ({ id, url, sha256 }));
const kinds: OregonDocumentKind[] = ["state-directive", "county-general", "county-rcv"];
const text = (node: Parameters<typeof stateHtmlText>[0]) => stateHtmlText(node).replace(/\s+/gu, " ").trim();
const generalDate = (date: string) => /^20\d{2}-11-0[2-8]$/u.test(date) && date >= "2026-11-03" && Number(date.slice(0, 4)) % 2 === 0 && new Date(`${date}T00:00:00Z`).getUTCDay() === 2;
const printedDate = (date: string) => `November ${Number(date.slice(-2))}, ${date.slice(0, 4)}`;
const pageUrl = (date: string) => `https://multco.us/info/november-${Number(date.slice(-2))}-${date.slice(0, 4)}-general-election`;
const bytes = (body: string) => Buffer.from(body, "utf8");

function exactKeys(value: unknown, keys: string[]): value is Record<string, unknown> {
	return Boolean(value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).sort().join(",") === [...keys].sort().join(","));
}
function publicUrl(value: string) {
	const url = new URL(value, oregonDiscoveryUrl);
	if (url.origin !== "https://multco.us" || url.username || url.password || url.search || url.hash || /%2f|%5c/iu.test(url.pathname)) throw new Error("The Oregon county publication URL requires review.");
	url.pathname = url.pathname.replace(/,|%2c/giu, "%2C");
	return url.href;
}
function main(body: string) {
	const nodes = stateHtmlDescendants(parseStateHtml(body), node => node.nodeName === "main");
	if (nodes.length !== 1) throw new Error("The Oregon county publication has no unique main region.");
	return nodes[0]!;
}
function policyLinks(body: string) {
	const normalized = body.replace(/(?:©|&copy;)\s*20\d{2}(?=\s*\|)/gu, "© 2026");
	const fingerprint = electionDocumentPolicyFingerprint(bytes(normalized), "links", "https://multco.us/");
	if (![policyPages[1].sha256, "b54c25942c09261274bf03a9ddfbd90c11ebe8b986833638ab6f3d5e18ffc126"].includes(fingerprint)) throw new Error("Oregon county policy links require review.");
}
export function readOregonElectionIndex(body: string) {
	policyLinks(body);
	const region = main(body);
	const headings = stateHtmlDescendants(region, node => node.nodeName === "h1");
	if (headings.length !== 1 || text(headings[0]!) !== "Current and Upcoming Elections - Multnomah County Elections") throw new Error("The Oregon county election catalog identity changed.");
	const elections = new Map<string, string>();
	for (const anchor of stateHtmlDescendants(region, node => node.nodeName === "a")) {
		const label = text(anchor);
		if (!/^November .*General Election$/u.test(label)) continue;
		const match = /^November ([2-8]), (20\d{2}) General Election$/u.exec(label);
		const date = match ? `${match[2]}-11-0${match[1]}` : "";
		if (!generalDate(date) || elections.has(date) || publicUrl(stateHtmlAttribute(anchor, "href")) !== pageUrl(date)) throw new Error("The Oregon county offered election date is invalid or ambiguous.");
		elections.set(date, pageUrl(date));
	}
	if (!elections.size || elections.size > 10) throw new Error("The Oregon county catalog has no bounded general-election publications.");
	return [...elections.entries()].sort(([first], [second]) => first.localeCompare(second));
}
function documentUrl(url: string, kind: OregonDocumentKind, date: string) {
	const year = date.slice(0, 4);
	const expected = kind === "state-directive"
		? `/file/ballot_directive_-_november_${Number(date.slice(-2))}%2C_${year}_general/download`
		: `/file/ballot_content_${kind === "county-rcv" ? "rcv_" : ""}-_nov._${year}/download`;
	if (publicUrl(url) !== `https://multco.us${expected}`) throw new Error("The Oregon county document link does not match its election.");
	return publicUrl(url);
}
function readElectionPage(body: string, date: string): OregonElection | null {
	policyLinks(body);
	const region = main(body);
	const headings = stateHtmlDescendants(region, node => node.nodeName === "h1");
	if (headings.length !== 1 || text(headings[0]!) !== `${printedDate(date)} General Election`) throw new Error("The Oregon county election page identifies another election.");
	const documents: OregonElection["oregonDocuments"] = [];
	for (const anchor of stateHtmlDescendants(region, node => node.nodeName === "a")) {
		const label = text(anchor);
		const kind: OregonDocumentKind | null = label === `Ballot Directive - ${printedDate(date)} General`
			? "state-directive"
			: label === `Ballot Content - Nov. ${date.slice(0, 4)}`
				? "county-general"
				: label === `Ballot Content RCV - Nov. ${date.slice(0, 4)}` ? "county-rcv" : null;
		if (kind) documents.push({ kind, url: documentUrl(stateHtmlAttribute(anchor, "href"), kind, date) });
		else if (/^Ballot (?:Directive|Content)/u.test(label)) throw new Error("The Oregon county candidate document controls changed.");
	}
	if (!documents.length) return null;
	documents.sort((first, second) => kinds.indexOf(first.kind) - kinds.indexOf(second.kind));
	const election: OregonElection = { electionId: null, electionDate: date, pageUrl: pageUrl(date), oregonDocuments: documents };
	validateOregonElection(election);
	return election;
}
function readDiscovery(body: string) {
	if (Buffer.byteLength(body) > 12 * 1024 * 1024) throw new Error("The Oregon county discovery exceeds its bounds.");
	const value = JSON.parse(body);
	if (!exactKeys(value, ["schemaVersion", "type", "index", "pages", "policies"]) || value.schemaVersion !== 1 || value.type !== "oregon-county-discovery" || typeof value.index !== "string" || !Array.isArray(value.pages) || JSON.stringify(value.policies) !== JSON.stringify(oregonPolicyReceipts)) throw new Error("The Oregon county discovery is invalid or its policies changed.");
	return value as unknown as { index: string; pages: Array<{ url: string; body: string }> };
}
export function readOregonElectionDiscovery(body: string): OregonElection[] {
	const value = readDiscovery(body);
	const offered = readOregonElectionIndex(value.index);
	if (value.pages.length !== offered.length) throw new Error("The Oregon county discovery omitted an offered election page.");
	return offered.flatMap(([date, url], position) => {
		const page = value.pages[position];
		if (!exactKeys(page, ["url", "body"]) || page.url !== url || typeof page.body !== "string") throw new Error("The Oregon county discovery page set changed.");
		const election = readElectionPage(page.body, date);
		return election ? [election] : [];
	});
}
export function validateOregonElection(value: unknown): asserts value is OregonElection {
	if (!exactKeys(value, ["electionId", "electionDate", "pageUrl", "oregonDocuments"]) || value.electionId !== null || typeof value.electionDate !== "string" || !generalDate(value.electionDate) || value.pageUrl !== pageUrl(value.electionDate) || !Array.isArray(value.oregonDocuments) || value.oregonDocuments.length !== 3) throw new Error("The Oregon county election definition is invalid.");
	for (const [position, document] of value.oregonDocuments.entries()) {
		if (!exactKeys(document, ["kind", "url"]) || document.kind !== kinds[position] || typeof document.url !== "string" || document.url !== documentUrl(document.url, kinds[position]!, value.electionDate)) throw new Error("The Oregon county document set is incomplete or ambiguous.");
	}
}
export function validateOregonSource(source: StateBallotSource) {
	if (source.stateCode !== "OR" || source.format !== "oregon-pdf" || source.retrievalPolicy || source.postBody || source.delimiter || source.id !== (source.electionDate === "2026-11-03" ? "or-sos-multnomah-2026" : `or-multnomah-general-${source.electionDate}`) || source.url !== (source.electionDate === "2026-11-03" ? source.documentUrls?.[0] : source.pageUrl) || !source.documentUrls) throw new Error("The automatic Oregon county source identity is invalid.");
	validateOregonElection({ electionId: null, electionDate: source.electionDate, pageUrl: source.pageUrl, oregonDocuments: source.documentUrls.map((url, position) => ({ kind: kinds[position], url })) });
}
export async function fetchOregonCycleDiscovery(options: { requestText?: TextRequest; wait?: (delay: number) => Promise<void> } = {}) {
	const request = options.requestText ?? fetchRemoteSourceText;
	const wait = options.wait ?? (delay => new Promise(resolve => setTimeout(resolve, delay)));
	const transport = { allowedHosts: ["multco.us"], maxBytes: 2 * 1024 * 1024, maxRedirects: 0, timeoutMs: stateBallotPdfCollectorContract.timeoutMs };
	let robots: ReturnType<typeof electionDocumentRobotsPolicy> | undefined;
	const read = async (url: string) => {
		if (robots) {
			if (!robots.allowed(url)) throw new Error("The Oregon county robots policy disallows this publication.");
			await wait(robots.delay);
		}
		return request(url, transport);
	};
	for (const policy of policyPages) {
		const body = await read(policy.url);
		if (policy.format === "links") policyLinks(body);
		else if (electionDocumentPolicyFingerprint(bytes(body), policy.format, policy.url) !== policy.sha256) throw new Error("Oregon county access or reuse policy requires review.");
		if (policy.format === "robots") robots = electionDocumentRobotsPolicy(bytes(body));
	}
	const index = await read(oregonDiscoveryUrl);
	const pages = [];
	for (const [, url] of readOregonElectionIndex(index)) pages.push({ url, body: await read(url) });
	const body = JSON.stringify({ schemaVersion: 1, type: "oregon-county-discovery", index, pages, policies: oregonPolicyReceipts });
	readOregonElectionDiscovery(body);
	return body;
}

interface CapturedDocument { url: string; sha256: string; retrievedAt: string; text: string }
export async function fetchOregonCandidateCapture(source: StateBallotSource, options: { requestText?: TextRequest; requestDocument?: typeof fetchRemoteSourceDocument; extractor?: (body: Buffer) => Promise<string>; discovery?: string; now?: () => number; wait?: (delay: number) => Promise<void> } = {}) {
	validateOregonSource(source);
	const executable = options.extractor ? null : await resolveStateBallotPdfExtractor();
	const discovery = options.discovery ?? await fetchOregonCycleDiscovery(options);
	const election = readOregonElectionDiscovery(discovery).find(item => item.electionDate === source.electionDate);
	if (!election || election.oregonDocuments.map(item => item.url).join("|") !== source.documentUrls!.join("|")) throw new Error("The Oregon county published document set requires review.");
	const documents: CapturedDocument[] = [];
	for (const document of election.oregonDocuments) {
		await (options.wait ?? (delay => new Promise(resolve => setTimeout(resolve, delay))))(11000);
		documents.push(await fetchStateBallotPdfDocument(document.url, { allowedHosts: ["multco.us"], request: options.requestDocument, extractor: options.extractor ?? (body => extractStateBallotPdfText(body, executable!)), now: options.now }));
	}
	const body = JSON.stringify({ schemaVersion: 1, type: "oregon-county-candidates", discovery, documents });
	if (Buffer.byteLength(body) > 12 * 1024 * 1024) throw new Error("The Oregon candidate capture exceeds its bounds.");
	return body;
}

function documentPages(body: string) {
	const pages = body.split("\f").filter(page => page.trim()).map(page => page.replace(/^[\r\n]+/u, ""));
	if (!pages.length || pages.length > stateBallotPdfCollectorContract.maximumPages || Buffer.byteLength(body) > stateBallotPdfCollectorContract.maximumTextBytes || body.includes("\uFFFD")) throw new Error("The Oregon document text exceeds its reviewed bounds.");
	return pages;
}
function publicationDay(year: number, month: number, day: number) {
	if (!Number.isSafeInteger(year) || !Number.isSafeInteger(month) || !Number.isSafeInteger(day) || year < 2026 || year > 2099 || month < 1 || month > 12 || day < 1 || day > 31) throw new Error("The Oregon publication date is invalid.");
	const date = new Date(Date.UTC(year, month - 1, day));
	if (date.getUTCFullYear() !== year || date.getUTCMonth() + 1 !== month || date.getUTCDate() !== day) throw new Error("The Oregon publication date is invalid.");
	return date.toISOString().slice(0, 10);
}
function statePages(body: string, electionDate: string, retrievedAt: string) {
	const pages = documentPages(body);
	const normalized = body.replace(/\s+/gu, " ");
	if (!normalized.includes(`SUBJECT: Official Ballot Statement for the General Election on ${printedDate(electionDate)}`)) throw new Error("The Oregon state directive does not identify the selected election.");
	const start = pages.findIndex(page => page.includes("Candidate Ballot Statement"));
	if (start < 1 || start > 10) throw new Error("The Oregon state directive has no bounded candidate statement.");
	const publicationDates = new Set<string>();
	return pages.slice(start).map((text, offset) => {
		const number = start + offset + 1;
		const date = new RegExp(`^([A-Z][a-z]+ [1-9]\\d?, ${electionDate.slice(0, 4)})\\s*$`, "mu").exec(text)?.[1];
		if (!text.startsWith("Secretary of State Elections Division") || !text.includes("Candidate Ballot Statement") || !text.includes(`${electionDate.slice(0, 4)} General Election`) || !date || !new RegExp(`Page ${number} of ${pages.length}\\s*$`, "u").test(text)) throw new Error("The Oregon state statement page sequence or election identity changed.");
		publicationDates.add(date);
		const parsed = /^([A-Z][a-z]+) ([1-9]\d?), (20\d{2})$/u.exec(date)!;
		const month = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].indexOf(parsed[1]!) + 1;
		const day = publicationDay(Number(parsed[3]), month, Number(parsed[2]));
		if (publicationDates.size !== 1 || day > electionDate || day > retrievedAt.slice(0, 10)) throw new Error("The Oregon state statement publication date is inconsistent.");
		return { number, text };
	});
}
function countyPages(body: string, electionDate: string, rcv: boolean, retrievedAt: string) {
	const pages = documentPages(body);
	const selected: Array<{ number: number; text: string }> = [];
	let measures = false;
	let printedAt: string | undefined;
	const numericDate = `11/${electionDate.slice(-2)}/${electionDate.slice(0, 4)}`;
	for (const [offset, page] of pages.entries()) {
		const number = offset + 1;
		const normalized = page.replace(/\s+/gu, " ").trim();
		const currentDate = /Ballot Content(?: RCV)? Date : (\d{1,2}\/\d{1,2}\/20\d{2} \d{1,2}:\d{2}:\d{2} [AP]M)/u.exec(normalized)?.[1];
		if (!page.startsWith("County: MULTNOMAH") || !normalized.includes(`Election : ${numericDate} - November ${rcv ? "RCV" : "General"} Election ${electionDate.slice(0, 4)}`) || !normalized.includes("Report No. : E-019") || !currentDate || (printedAt && ((!measures && currentDate !== printedAt) || currentDate.split(" ")[0] !== printedAt.split(" ")[0])) || !new RegExp(`Oregon Centralized Voter Registration\\s+Page\\s*:\\s*${number}\\s*$`, "u").test(page)) throw new Error("The Oregon county report page sequence, capture date or election identity changed.");
		const dateParts = /^(\d{1,2})\/(\d{1,2})\/(20\d{2}) (\d{1,2}):(\d{2}):(\d{2}) [AP]M$/u.exec(currentDate)!;
		const day = publicationDay(Number(dateParts[3]), Number(dateParts[1]), Number(dateParts[2]));
		if (day > electionDate || day > retrievedAt.slice(0, 10) || Number(dateParts[4]) < 1 || Number(dateParts[4]) > 12 || Number(dateParts[5]) > 59 || Number(dateParts[6]) > 59) throw new Error("The Oregon county report publication date is invalid.");
		printedAt = currentDate;
		const summary = /^Number of Contest\s*:\s*(\d+)\s*\nNumber of Filed Candidates:\s*(\d+)\s*$/mu.exec(page);
		if (summary) {
			if (rcv || number !== pages.length || /Number Candidates Filed:/u.test(page)) throw new Error("The Oregon county totals page changed.");
			if ([summary[1], summary[2]].some(value => !Number.isSafeInteger(Number(value)) || Number(value) < 1 || Number(value) > 25000) || [...body.matchAll(/^Number of Contest\s*:/gmu)].length !== 1 || [...body.matchAll(/^Number of Filed Candidates:/gmu)].length !== 1) throw new Error("The Oregon county aggregate report metadata is invalid.");
			continue;
		}
		const firstMeasure = page.indexOf("Measure No:");
		if (firstMeasure >= 0) {
			if (rcv || /Number Candidates Filed:/u.test(page.slice(firstMeasure))) throw new Error("Candidate controls follow the Oregon measure boundary.");
			if (!measures && /Number Candidates Filed:/u.test(page.slice(0, firstMeasure))) selected.push({ number, text: page.slice(0, firstMeasure) });
			measures = true;
		}
		else if (measures) {
			throw new Error("The Oregon measure continuation has no recognized measure identity.");
		}
		else {
			selected.push({ number, text: page });
		}
	}
	if (!selected.length || (!rcv && !/^Number of Contest\s*:/mu.test(pages.at(-1)!))) throw new Error("The Oregon county candidate pages or complete report totals are missing.");
	return selected;
}
export function parseOregonCandidateCapture(source: StateBallotSource, body: string, factory: (source: StateBallotSource, values: StateCandidateValues) => StateCandidateRecord | null, now = Date.now()) {
	validateOregonSource(source);
	if (Buffer.byteLength(body) > 12 * 1024 * 1024) throw new Error("The Oregon candidate capture exceeds its bounds.");
	const value = JSON.parse(body);
	if (!exactKeys(value, ["schemaVersion", "type", "discovery", "documents"]) || value.schemaVersion !== 1 || value.type !== "oregon-county-candidates" || typeof value.discovery !== "string" || !Array.isArray(value.documents) || value.documents.length !== 3) throw new Error("The Oregon candidate capture is incomplete.");
	const election = readOregonElectionDiscovery(value.discovery).find(item => item.electionDate === source.electionDate);
	if (!election || election.oregonDocuments.map(item => item.url).join("|") !== source.documentUrls!.join("|")) throw new Error("The Oregon capture is not bound to its offered election.");
	const documents = value.documents.map((document, position) => {
		if (!exactKeys(document, ["url", "sha256", "retrievedAt", "text"]) || document.url !== source.documentUrls![position] || typeof document.sha256 !== "string" || !/^[a-f0-9]{64}$/u.test(document.sha256) || typeof document.retrievedAt !== "string" || !Number.isFinite(Date.parse(document.retrievedAt)) || new Date(document.retrievedAt).toISOString() !== document.retrievedAt || Date.parse(document.retrievedAt) > now || typeof document.text !== "string") throw new Error("The Oregon document provenance is invalid.");
		return position === 0 ? statePages(document.text, source.electionDate, document.retrievedAt) : countyPages(document.text, source.electionDate, position === 2, document.retrievedAt);
	});
	const result = reconcileOregonCandidatePages(extractOregonCandidatePages(documents, source.electionDate.slice(0, 4)));
	const records = result.records.map(({ value, ballotDesignation, claimIndexes }) => {
		const record = factory(source, value);
		if (!record) throw new Error("The Oregon candidate record is incomplete.");
		record.sourceStatus = result.claims[claimIndexes[0]!]!.documentIndex === 0 ? "Official Ballot Statement" : "County ballot content";
		if (ballotDesignation) record.ballotDesignation = ballotDesignation;
		return record;
	});
	const provenance = (value.documents as CapturedDocument[]).map(({ url, sha256, retrievedAt }, position) => ({ url, sha256, retrievedAt, includedRecordCount: result.records.filter(record => result.claims[record.claimIndexes[0]!]!.documentIndex === position).length }));
	return { records, documents: provenance, retrievedAt: new Date(Math.min(...provenance.map(document => Date.parse(document.retrievedAt)))).toISOString(), sha256: digest(JSON.stringify(provenance.map(({ url, sha256 }) => ({ url, sha256 })))) };
}
