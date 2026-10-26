import type { StateCandidateValues } from "./state-ballot-additional-records.js";
import type { StateHtmlNode } from "./state-ballot-html.js";
import type { StateCandidateRecord } from "./state-ballot-records.js";
import type { StateBallotSource } from "./state-ballot-sources.js";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { setTimeout as wait } from "node:timers/promises";
import { electionDocumentPolicyFingerprint } from "./election-document-collection.js";
import { fetchRemoteSourceDocument, fetchRemoteSourceText } from "./remote-json-source.js";
import { stateHtmlAttribute as attribute, stateHtmlDescendants as descendants, parseStateHtml, stateHtmlTableRows, stateHtmlText } from "./state-ballot-html.js";
import { extractStateBallotPdfText, fetchStateBallotPdfDocument, resolveStateBallotPdfExtractor } from "./state-ballot-pdf.js";
import { StateBallotAwaitingRecordsError } from "./state-ballot-source-state.js";
import { containsControlCharacters } from "./text-validation.js";

const origin = "https://www.polkcountyiowa.gov";
export const iowaPolkDiscoveryUrl = `${origin}/county-auditor/election/`;
const hash = (body: string) => createHash("sha256").update(body).digest("hex");
const clean = (value: string) => value.normalize("NFKC").replace(/\s+/gu, " ").trim();
const text = (node: StateHtmlNode) => clean(stateHtmlText(node));
const exact = (value: unknown, keys: string[]): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).sort().join("|") === [...keys].sort().join("|"));
type Factory = (source: StateBallotSource, values: StateCandidateValues) => StateCandidateRecord | null;
interface Page {
	url: string;
	body: string;
	sha256: string;
	retrievedAt: string;
}
interface Pdf {
	url: string;
	text: string;
	sha256: string;
	retrievedAt: string;
}
interface Options {
	requestText?: (url: string, options: { allowedHosts: string[]; maxBytes: number; maxRedirects: number; timeoutMs: number }) => Promise<string>;
	requestDocument?: typeof fetchRemoteSourceDocument;
	extractor?: (bytes: Buffer) => Promise<string>;
	sleep?: (milliseconds: number) => Promise<void>;
	now?: () => number;
	discovery?: string;
}
export interface IowaPolkElection {
	electionId: null;
	electionDate: string;
	pageUrl: string;
	polkDocuments: {
		kind: "candidates" | "sample";
		url: string;
	}[];
}
export const iowaPolkPolicyReceipts = [
	{ url: `${origin}/robots.txt`, status: 404, region: "bytes", sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855" },
	{ url: `${origin}/human-resources/internal-policies/`, status: 200, region: "content-grid-item", sha256: "2de6e7ce6c728ec557ccb4b858303f96701da87e17258a7e6fbf0abbd1df9802" },
	{ url: `${origin}/accessibility-statement/`, status: 200, region: "content-grid-item", sha256: "a9f9b50e24f2de886a24d97240e5d0507df24905907c11ffcbd73658205282bf" },
	{ url: iowaPolkDiscoveryUrl, status: 200, region: "legal-inventory", sha256: "b6856cd961297a1a04bbff925716faa49a79dacea605549d03d884a0bbf18b48" }
] as const;
function html(body: string) {
	if (Buffer.byteLength(body) > 2 * 1024 * 1024)
		throw new Error("The Polk County publication exceeds its bounds.");
	const document = parseStateHtml(body);
	const pending = [{ node: document, depth: 0 }];
	let visited = 0;
	while (pending.length) {
		const item = pending.pop()!;
		if (++visited > 80000 || item.depth > 64)
			throw new Error("The Polk County publication structure requires review.");
		for (const child of item.node.childNodes ?? [])
			pending.push({ node: child, depth: item.depth + 1 });
	}
	return document;
}
export function iowaPolkPolicyFingerprint(body: string, region: "content-grid-item" | "legal-inventory") {
	const document = html(body);
	if (region === "content-grid-item")
		return electionDocumentPolicyFingerprint(Buffer.from(body), "region", origin, undefined, region);
	const footers = descendants(document, node => node.nodeName === "footer" && attribute(node, "class").split(/\s+/u).includes("bg-gray-900"));
	if (footers.length !== 1)
		throw new Error("The Polk County legal footer requires review.");
	const footer = text(footers[0]!);
	if ([...footer.matchAll(/\b20\d{2} Polk County Iowa\b/gu)].length !== 1)
		throw new Error("The Polk County copyright notice changed.");
	const links = descendants(document, node => node.nodeName === "a" && /privacy|disclaimer|copyright|licen[cs]e|terms|polic(?:y|ies)|legal|accessibility/iu.test(`${text(node)} ${attribute(node, "href")}`)).map(node => [text(node), new URL(attribute(node, "href"), origin).href]).filter(([label, url]) => {
		const application = /^(20\d{2}) Polk County Dog License Application$/u.exec(label!);
		return !application || new URL(url!).origin !== origin || !new RegExp(`^${origin}/media/[a-z0-9]{8}/${application[1]}-polk-county-dog-application\\.pdf$`, "u").test(url!);
	});
	return hash(JSON.stringify({ footer: footer.replace(/\b20\d{2}(?= Polk County Iowa\b)/u, "YYYY"), links: [...new Set(links.map(link => JSON.stringify(link)))].sort() }));
}
export function validateIowaPolkDocumentUrl(value: string) {
	const url = new URL(value);
	if (url.origin !== origin || url.username || url.password || url.search || url.hash || !/^\/media\/[a-z0-9]{8}\/[\w.-]{1,160}\.pdf$/iu.test(url.pathname) || url.href !== value)
		throw new Error("The Polk County PDF link requires review.");
}
function datePage(value: string) {
	const url = new URL(value);
	if (url.origin !== origin || url.username || url.password || url.search || url.hash || url.href !== value) throw new Error("The Polk County election host requires review.");
	const match = /^\/county-auditor\/election\/news-and-press-releases\/general-election-november-([2-8])-(20\d{2})-voter-information\/$/u.exec(url.pathname);
	if (!match)
		throw new Error("The Polk County election link requires review.");
	const date = `${match[2]}-11-0${match[1]}`;
	if (date < "2026-11-03" || Number(match[2]) % 2 || new Date(`${date}T00:00:00Z`).getUTCDay() !== 2)
		throw new Error("The Polk County general-election date requires review.");
	return date;
}
export function validateIowaPolkElection(value: unknown): asserts value is IowaPolkElection {
	if (!exact(value, ["electionId", "electionDate", "pageUrl", "polkDocuments"]) || value.electionId !== null || typeof value.pageUrl !== "string" || value.electionDate !== datePage(value.pageUrl) || !Array.isArray(value.polkDocuments) || ![0, 2].includes(value.polkDocuments.length))
		throw new Error("The Polk County election identity is invalid.");
	for (const [index, document] of value.polkDocuments.entries()) {
		if (!exact(document, ["kind", "url"]) || document.kind !== (index ? "sample" : "candidates") || typeof document.url !== "string")
			throw new Error("The Polk County document set requires review.");
		validateIowaPolkDocumentUrl(document.url);
	}
	if (new Set(value.polkDocuments.map(document => document.url)).size !== value.polkDocuments.length)
		throw new Error("The Polk County publications are duplicated.");
}
export function iowaPolkDocumentDigest(documents: IowaPolkElection["polkDocuments"]) {
	return hash(JSON.stringify(documents));
}
export function validateIowaPolkSource(source: StateBallotSource) {
	validateIowaPolkElection({ electionId: null, electionDate: source.electionDate, pageUrl: source.pageUrl, polkDocuments: [] });
	if (source.stateCode !== "IA" || source.format !== "iowa-polk-pdf" || source.countyName !== "Polk County" || source.snapshotStorage !== "external" || source.url !== source.pageUrl || source.retrievalPolicy || source.postBody || source.delimiter || source.documentUrls || source.documentLinks || source.id !== (source.electionDate === "2026-11-03" ? "ia-polk-2026" : `ia-polk-general-${source.electionDate}`))
		throw new Error("The Polk County source contract is invalid.");
}
function checkedPage(page: unknown, now: number): asserts page is Page {
	if (!exact(page, ["url", "body", "sha256", "retrievedAt"]) || typeof page.url !== "string" || typeof page.body !== "string" || hash(page.body) !== page.sha256 || typeof page.retrievedAt !== "string" || !Number.isFinite(Date.parse(page.retrievedAt)) || new Date(page.retrievedAt).toISOString() !== page.retrievedAt || Date.parse(page.retrievedAt) > now || iowaPolkPolicyFingerprint(page.body, "legal-inventory") !== iowaPolkPolicyReceipts[3].sha256)
		throw new Error("The Polk County page provenance or legal inventory requires review.");
}
function offeredPages(body: string) {
	const document = html(body);
	if (descendants(document, node => node.nodeName === "h1" && (text(node) === "Election" || (!text(node) && attribute(node, "aria-label") === "Election" && descendants(node, image => image.nodeName === "img" && attribute(image, "alt") === "Election logo").length === 1))).length !== 1)
		throw new Error("The Polk County election index requires review.");
	const links = new Set(descendants(document, node => node.nodeName === "a" && /general-election-november-[2-8]-20\d{2}-voter-information\//u.test(attribute(node, "href"))).map(node => new URL(attribute(node, "href"), iowaPolkDiscoveryUrl).href));
	for (const url of links)
		datePage(url);
	if (!links.size || links.size > 6)
		throw new Error("The Polk County offered election set requires review.");
	return [...links].sort();
}
function electionPage(page: Page): IowaPolkElection {
	const electionDate = datePage(page.url);
	const document = html(page.body);
	const heading = `General Election - November ${Number(electionDate.slice(-2))}, ${electionDate.slice(0, 4)} - Voter Information`;
	if (descendants(document, node => node.nodeName === "h1" && text(node) === heading).length !== 1)
		throw new Error("The Polk County printed election date changed.");
	const candidateLinks = descendants(document, node => node.nodeName === "a" && text(node) === "Full Candidate List");
	const tables = descendants(document, node => node.nodeName === "table" && stateHtmlTableRows(node).some(row => text(row) === "Precinct Location Address Sample Ballot"));
	if (!candidateLinks.length && !tables.length && /Candidate list and sample ballots will be posted\./u.test(text(document)))
		return { electionId: null, electionDate, pageUrl: page.url, polkDocuments: [] };
	if (candidateLinks.length !== 1 || tables.length !== 1)
		throw new Error("The Polk County candidate and sample publications require review.");
	const rows = stateHtmlTableRows(tables[0]!);
	const first = rows.find(row => text(row) !== "Precinct Location Address Sample Ballot" && descendants(row, node => node.nodeName === "td").length > 0);
	const samples = first ? descendants(first, node => node.nodeName === "a" && text(node) === "Sample Ballot") : [];
	if (samples.length !== 1)
		throw new Error("The Polk County first listed precinct has no unique sample ballot.");
	const election: IowaPolkElection = { electionId: null, electionDate, pageUrl: page.url, polkDocuments: [{ kind: "candidates", url: new URL(attribute(candidateLinks[0]!, "href"), page.url).href }, { kind: "sample", url: new URL(attribute(samples[0]!, "href"), page.url).href }] };
	validateIowaPolkElection(election);
	return election;
}
export function readIowaPolkDiscovery(body: string, now = Date.now()) {
	if (Buffer.byteLength(body) > 16 * 1024 * 1024)
		throw new Error("The Polk County discovery exceeds its bounds.");
	const value = JSON.parse(body);
	if (!exact(value, ["schemaVersion", "type", "policies", "index", "pages"]) || value.schemaVersion !== 1 || value.type !== "iowa-polk-discovery" || JSON.stringify(value.policies) !== JSON.stringify(iowaPolkPolicyReceipts) || !Array.isArray(value.pages) || !value.pages.length || value.pages.length > 6)
		throw new Error("The Polk County discovery contract is invalid.");
	checkedPage(value.index, now);
	if (value.index.url !== iowaPolkDiscoveryUrl)
		throw new Error("The Polk County index URL changed.");
	const offered = offeredPages(value.index.body);
	if (value.pages.length !== offered.length)
		throw new Error("The Polk County offered publication set is incomplete.");
	const pages = value.pages.map((page) => {
		checkedPage(page, now);
		return page;
	});
	if (pages.some((page, index) => page.url !== offered[index]))
		throw new Error("The Polk County publication identities changed.");
	return { index: value.index, pages, elections: pages.map(electionPage) };
}
export async function fetchIowaPolkCycleDiscovery(options: Options = {}) {
	const request = options.requestDocument ?? fetchRemoteSourceDocument;
	const sleep = options.sleep ?? wait;
	const now = options.now ?? Date.now;
	for (const policy of iowaPolkPolicyReceipts.slice(0, 3)) {
		const response = await request(policy.url, { allowedHosts: [new URL(origin).hostname], maxBytes: 2 * 1024 * 1024, timeoutMs: 25000 });
		if (response.status !== policy.status || (policy.region === "bytes" ? hash(response.body.toString("utf8")) : iowaPolkPolicyFingerprint(response.body.toString("utf8"), "content-grid-item")) !== policy.sha256)
			throw new Error("The Polk County public access policy requires review.");
		await sleep(11000);
	}
	const page = async (url: string): Promise<Page> => {
		const body = await (options.requestText ?? fetchRemoteSourceText)(url, { allowedHosts: [new URL(origin).hostname], maxBytes: 2 * 1024 * 1024, maxRedirects: 0, timeoutMs: 25000 });
		const result = { url, body, sha256: hash(body), retrievedAt: new Date(now()).toISOString() };
		checkedPage(result, now());
		return result;
	};
	const index = await page(iowaPolkDiscoveryUrl);
	const pages = [];
	for (const url of offeredPages(index.body)) {
		await sleep(11000);
		pages.push(await page(url));
	}
	const body = JSON.stringify({ schemaVersion: 1, type: "iowa-polk-discovery", policies: iowaPolkPolicyReceipts, index, pages });
	readIowaPolkDiscovery(body, now());
	return body;
}
function candidateName(value: string) {
	if (value.length < 4 || value.length > 160 || !value.includes(" ") || containsControlCharacters(value) || !/^[\p{L}\p{M} .,\u0022'’“”-]+$/u.test(value))
		throw new Error("A Polk County candidate name requires review.");
	return value;
}
function officeValues(office: string, group: string): Omit<StateCandidateValues, "name" | "party"> {
	const base = { office, district: "", status: "listed" as const };
	if (group === "statewide") {
		const district = /^United States Representative District ([1-4])$/u.exec(office);
		if (district)
			return { ...base, office: "U.S. House", district: district[1]!, scope: "congressional" };
		if (!["President", "Vice President", "United States Senator", "Governor", "Lieutenant Governor", "Secretary of State", "Auditor of State", "Treasurer of State", "Secretary of Agriculture", "Attorney General"].includes(office))
			throw new Error("The Polk County statewide office requires review.");
		const titles: Record<string, string> = { "United States Senator": "U.S. Senate", "Auditor of State": "State Auditor", "Treasurer of State": "State Treasurer" };
		return { ...base, office: titles[office] ?? office, scope: "statewide" };
	}
	const legislative = /^State (Senate|Representative) District ([1-9]\d{0,2})$/u.exec(office);
	if (legislative && group === (legislative[1] === "Senate" ? "senate" : "house"))
		return { ...base, office: legislative[1] === "Senate" ? "State Senate" : "State House", district: legislative[2]!, scope: legislative[1] === "Senate" ? "state-senate" : "state-house" };
	if (group === "county" && /^(?:County (?:Auditor|Sheriff|Treasurer|Recorder|Attorney)|Board of Supervisors - District [1-9]\d?)$/u.test(office))
		return { ...base, scope: "local", jurisdiction: office.startsWith("Board") ? `Polk County, ${office}` : "Polk County" };
	if (group === "nonpartisan" && /^(?:County Hospital Trustees|Soil & Water Commission|Agricultural Extension Council(?: \(Vacancy\))?)(?: - Vote for no more than [1-9]\d?)?$/u.test(office))
		return { ...base, scope: "local", jurisdiction: "Polk County" };
	throw new Error("The Polk County office or section requires review.");
}
function ticketPairs(sample: string, office: string) {
	const lines = sample.split("\f")[0]!.split("\n");
	const partisan = lines.map(line => /^ {0,8}\p{L}[\p{L}\p{M}.,'’-]*(?: [\p{L}\p{M}.,'’-]+)* {2,}([A-Z]{2,5})(?: {2,}|$)/u.exec(line)).find(Boolean);
	if (!partisan)
		throw new Error("The Polk County ballot columns require review.");
	const edge = partisan[0].trimEnd().length + 1;
	if (edge < 25 || edge > 70)
		throw new Error("The Polk County ballot column exceeds its bounds.");
	const column = lines.map(line => clean(line.slice(0, edge))).filter(Boolean);
	const first = office === "Governor" ? "GOVERNOR AND" : "PRESIDENT AND";
	const positions = column.flatMap((line, index) => line === first ? [index] : []);
	if (positions.length !== 1 || column[positions[0]! + 1] !== (office === "Governor" ? "LT. GOVERNOR" : "VICE PRESIDENT") || column[positions[0]! + 2] !== "Vote for no more than ONE team")
		throw new Error("The Polk County ballot joint-ticket instruction requires review.");
	const abbreviations = lines.find(line => line.startsWith("Party Abbreviations: "));
	if (!abbreviations)
		throw new Error("The Polk County printed party abbreviations are missing.");
	const parties: Record<string, string> = {};
	const pairs = [];
	for (const entry of abbreviations.slice("Party Abbreviations: ".length).split(";")) {
		const match = /^\s*(\p{L}[\p{L} '&.-]{0,70}):\(([A-Z]{2,5})\)\s*$/u.exec(entry);
		if (!match || parties[match[2]!])
			throw new Error("The Polk County party abbreviation set requires review.");
		parties[match[2]!] = match[1]!.replace(/ Party$/u, "");
	}
	let position = positions[0]! + 3;
	for (; position < column.length; position += 2) {
		if (column[position] === "Write-in, if any")
			break;
		const match = /^(.+?) ([A-Z]{2,5})$/u.exec(column[position]!);
		if (!match || !parties[match[2]!] || !column[position + 1])
			throw new Error("The Polk County ballot running mate requires review.");
		pairs.push({ name: candidateName(match[1]!), mate: candidateName(column[position + 1]!), party: parties[match[2]!]! });
	}
	if (!pairs.length || position >= column.length || new Set(pairs.map(pair => pair.party)).size !== pairs.length)
		throw new Error("The Polk County joint-ticket set requires review.");
	return pairs;
}
export function readIowaPolkCandidateDocuments(source: StateBallotSource, roster: string, sample: string, factory: Factory) {
	validateIowaPolkSource(source);
	const date = `November ${Number(source.electionDate.slice(-2))}, ${source.electionDate.slice(0, 4)}`;
	const pages = roster.split("\f").filter(page => page.trim());
	if (!pages.length || pages.length > 50 || Buffer.byteLength(roster) > 4 * 1024 * 1024 || Buffer.byteLength(sample) > 4 * 1024 * 1024 || !clean(pages[0]!).startsWith(`${date} - Statewide Offices`) || !clean(sample).includes(`SAMPLE BALLOT`) || !clean(sample).includes(`GENERAL ELECTION COUNTY OF POLK, STATE OF IOWA ${date.toUpperCase()}`))
		throw new Error("The Polk County PDF election identity or layout requires review.");
	const records: StateCandidateRecord[] = [];
	const emptyPartyRows: {
		office: string;
		party: string;
	}[] = [];
	const make = (values: StateCandidateValues) => {
		const value = factory(source, values);
		if (!value)
			throw new Error("The Polk County candidate cannot be normalized.");
		delete value.sourceStatus;
		return value;
	};
	for (const page of pages) {
		const rawLines = page.split("\n").filter(line => line.trim());
		const heading = clean(rawLines.shift()!);
		if (heading === "Judicial Retention") {
			if (clean(rawLines.shift()!) !== "Shall the following judges be retained in office? YES/NO")
				throw new Error("The Polk County retention instruction changed.");
			const titles = rawLines[0]!;
			const match = /^Court of Appeals\s{2,}(District [1-9]\d?[A-Z]? Judge)$/u.exec(titles.trim());
			if (!match)
				throw new Error("The Polk County judicial columns require review.");
			const edge = titles.indexOf(match[1]!);
			for (const [index, initial] of ["Court of Appeals", match[1]!].entries()) {
				let court = initial;
				for (const line of rawLines.slice(1)) {
					const value = clean(index ? line.slice(edge) : line.slice(0, edge));
					if (!value || value === "Candidate Name")
						continue;
					if (/^District [1-9]\d?[A-Z]? Associate Judge$/u.test(value) && index) {
						court = value;
						continue;
					}
					const name = candidateName(value);
					const record = make({ name, party: "", office: `${court} retention - ${name}`, district: "", scope: court === "Court of Appeals" ? "statewide" : "local", ...(court === "Court of Appeals" ? {} : { jurisdiction: court.replace(/ (?:Associate )?Judge$/u, "") }), status: "listed" });
					record.sourceStatus = "Judicial retention election";
					records.push(record);
				}
			}
			continue;
		}
		const group = heading === `${date} - Statewide Offices` ? "statewide" : ({ "State Senate": "senate", "State Representative": "house", "Countywide Offices": "county", "Countwide Offices - Nonpartisan": "nonpartisan" } as Record<string, string>)[heading];
		if (!group)
			throw new Error("The Polk County candidate section changed.");
		let context: ReturnType<typeof officeValues> | null = null;
		let rows = 0;
		let tableHeader = false;
		for (const raw of rawLines) {
			const line = clean(raw);
			if (line === "Board of Supervisors" && group === "county")
				continue;
			if (/^Candidate Name(?: Candidate Party)?(?: Email)?$/u.test(line)) {
				if (!context || tableHeader)
					throw new Error("The Polk County table header is misplaced.");
				tableHeader = true;
				continue;
			}
			const fields = raw.trim().split(/\s{2,}/u);
			if (!tableHeader || (fields.length === 1 && (group !== "nonpartisan" || /^(?:County Hospital Trustees|Soil & Water Commission|Agricultural Extension Council)/u.test(line)))) {
				if (context && !rows)
					throw new Error("The Polk County candidate table is empty or incomplete.");
				context = officeValues(line, group);
				rows = 0;
				tableHeader = false;
				continue;
			}
			if (!context || fields.length > 3 || !fields[0])
				throw new Error("The Polk County candidate row requires review.");
			rows++;
			const party = group === "nonpartisan" ? "Nonpartisan" : fields[1];
			if (!party || !/^\p{L}[\p{L} '&.-]{0,70}$/u.test(party) || (group === "nonpartisan" && fields.length > 2))
				throw new Error("The Polk County candidate party columns changed.");
			if (fields[0] === "(No candidate)") {
				emptyPartyRows.push({ office: context.office, party });
				continue;
			}
			const voteLimit = / - Vote for no more than ([1-9]\d?)$/u.exec(context.office);
			const name = candidateName(fields[0]);
			const record = make({ ...context, office: voteLimit ? context.office.replace(voteLimit[0], "") : context.office, name, party });
			if (voteLimit)
				record.voteLimit = Number(voteLimit[1]);
			records.push(record);
		}
		if (!context || !tableHeader || !rows)
			throw new Error("The Polk County candidate page is incomplete.");
	}
	const normalized = [...records];
	for (const [office, mate] of [["Governor", "Lieutenant Governor"], ["President", "Vice President"]]) {
		const members = records.filter(record => record.office === office || record.office === mate);
		if (!members.length)
			continue;
		const pairs = ticketPairs(sample, office!);
		if (members.length !== pairs.length * 2 || pairs.some(pair => !members.some(record => record.office === office && record.name === pair.name && record.party === pair.party) || !members.some(record => record.office === mate && record.name === pair.mate && record.party === pair.party)))
			throw new Error("The Polk County roster and sample disagree on joint tickets.");
		const position = normalized.findIndex(record => record.office === office);
		for (let index = normalized.length - 1; index >= 0; index--) {
			if (members.includes(normalized[index]!))
				normalized.splice(index, 1);
		}
		normalized.splice(position, 0, ...pairs.map(pair => make({ name: `${pair.name} / ${pair.mate}`, office: `${office} and ${mate}`, district: "", scope: "statewide", party: pair.party, status: "listed" })));
	}
	if (!normalized.length || normalized.length > 25000 || new Set(normalized.map(record => record.id)).size !== normalized.length)
		throw new Error("The Polk County candidate identities are empty or duplicated.");
	return { records: normalized, emptyPartyRows, printedCandidateRows: records.length };
}
export async function fetchIowaPolkCandidateCapture(source: StateBallotSource, options: Options = {}) {
	validateIowaPolkSource(source);
	const now = options.now ?? Date.now;
	const discovery = options.discovery ?? await fetchIowaPolkCycleDiscovery(options);
	const selected = readIowaPolkDiscovery(discovery, now()).elections.find(election => election.electionDate === source.electionDate);
	if (!selected || selected.pageUrl !== source.pageUrl)
		throw new Error("The Polk County offered publications changed.");
	if (!selected.polkDocuments.length)
		return JSON.stringify({ schemaVersion: 1, type: "iowa-polk-candidate-capture", discovery: JSON.parse(discovery), documents: [] });
	const executable = options.extractor ? null : await resolveStateBallotPdfExtractor();
	const documents = [];
	for (const document of selected.polkDocuments) {
		await (options.sleep ?? wait)(11000);
		documents.push(await fetchStateBallotPdfDocument(document.url, { allowedHosts: [new URL(origin).hostname], request: options.requestDocument, extractor: options.extractor ?? (bytes => extractStateBallotPdfText(bytes, executable!)), now }));
	}
	return JSON.stringify({ schemaVersion: 1, type: "iowa-polk-candidate-capture", discovery: JSON.parse(discovery), documents });
}
export function parseIowaPolkCandidateCapture(source: StateBallotSource, body: string, factory: Factory, now = Date.now()) {
	validateIowaPolkSource(source);
	if (Buffer.byteLength(body) > 24 * 1024 * 1024)
		throw new Error("The Polk County capture exceeds its bounds.");
	const capture = JSON.parse(body);
	if (!exact(capture, ["schemaVersion", "type", "discovery", "documents"]) || capture.schemaVersion !== 1 || capture.type !== "iowa-polk-candidate-capture" || !Array.isArray(capture.documents))
		throw new Error("The Polk County candidate capture requires review.");
	const selected = readIowaPolkDiscovery(JSON.stringify(capture.discovery), now).elections.find(election => election.electionDate === source.electionDate);
	if (!selected || selected.pageUrl !== source.pageUrl || capture.documents.length !== selected.polkDocuments.length)
		throw new Error("The Polk County captured document set is incomplete.");
	if (!capture.documents.length)
		throw new StateBallotAwaitingRecordsError(source.id);
	const documents: Pdf[] = capture.documents.map((document: unknown, index: number) => {
		if (!exact(document, ["url", "text", "sha256", "retrievedAt"]) || document.url !== selected.polkDocuments[index]!.url || typeof document.text !== "string" || Buffer.byteLength(document.text) > 4 * 1024 * 1024 || containsControlCharacters(document.text.replace(/[\n\r\t\f]/gu, "")) || typeof document.sha256 !== "string" || !/^[a-f0-9]{64}$/u.test(document.sha256) || typeof document.retrievedAt !== "string" || !Number.isFinite(Date.parse(document.retrievedAt)) || new Date(document.retrievedAt).toISOString() !== document.retrievedAt || Date.parse(document.retrievedAt) > now)
			throw new Error("The Polk County PDF provenance requires review.");
		return document as unknown as Pdf;
	});
	const parsed = readIowaPolkCandidateDocuments(source, documents[0]!.text, documents[1]!.text, factory);
	return { ...parsed, retrievedAt: new Date(Math.min(...documents.map(document => Date.parse(document.retrievedAt)))).toISOString(), sha256: hash(JSON.stringify(documents.map(({ url, sha256 }) => ({ url, sha256 })))), documents: documents.map(({ url, sha256, retrievedAt }, index) => ({ url, sha256, retrievedAt, includedRecordCount: index ? 0 : parsed.records.length })), collectionIndexSha256: iowaPolkDocumentDigest(selected.polkDocuments) };
}
