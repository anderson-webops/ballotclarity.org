import type { StateCandidateRecord, StateContestScope } from "./state-ballot-records.js";
import type { StateBallotSource } from "./state-ballot-sources.js";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { setTimeout as wait } from "node:timers/promises";
import { fetchRemoteSourceDocument, fetchRemoteSourceText } from "./remote-json-source.js";
import { stateHtmlAttribute as attribute, stateHtmlDescendants as descendants, parseStateHtml, stateHtmlText } from "./state-ballot-html.js";
import { extractStateBallotPdfText, fetchStateBallotPdfDocument, resolveStateBallotPdfExtractor } from "./state-ballot-pdf.js";
import { StateBallotAwaitingRecordsError } from "./state-ballot-source-state.js";
import { containsControlCharacters } from "./text-validation.js";

const origin = "https://www.cassia.gov";
export const cassiaDiscoveryUrl = `${origin}/sample-ballots`;
const hash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const clean = (value: string) => value.normalize("NFKC").replace(/\s+/gu, " ").trim();
const text = (node: Parameters<typeof stateHtmlText>[0]) => clean(stateHtmlText(node));
const exact = (value: unknown, fields: string[]): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).sort().join("|") === [...fields].sort().join("|"));
export interface CassiaElection {
	electionId: null;
	electionDate: string;
	cassiaDocuments: { kind: "general" | "supplement"; url: string }[];
}
interface PageCapture { url: string; body: string; sha256: string; retrievedAt: string }
interface PdfCapture { url: string; text: string; sha256: string; retrievedAt: string }
interface Word { text: string; left: number; top: number; right: number; bottom: number }
interface WordPage { width: number; height: number; words: Word[] }
interface Line { top: number; text: string }
interface Question { title: string; scope: "statewide" | "local"; choices: string[]; textSha256: string; sourceDocumentIndex: number; pageNumber: number }
interface Options {
	requestText?: (url: string, options: { allowedHosts: string[]; maxBytes: number; maxRedirects: number; timeoutMs: number }) => Promise<string>;
	requestDocument?: typeof fetchRemoteSourceDocument;
	extractor?: (bytes: Buffer) => Promise<string>;
	sleep?: (milliseconds: number) => Promise<void>;
	now?: () => number;
	discovery?: string;
}
export const cassiaPolicyReceipts = [
	{ url: `${origin}/robots.txt`, region: "bytes", sha256: "9c3299bfdd3dfcf4e13b3c574bbf1cbe9194782f3300bb321bbaf4b171de5720" },
	{ url: `${origin}/accessibility-statement/`, region: "main-text", sha256: "66b8eecfe06c2e7f2ce410f78f67e7e9f003fafe8ffb6865ec7ca5436e128d1a" },
	{ url: `${origin}/`, region: "legal-inventory", sha256: "c876186c0e84394595d3a0294e36c18d08a3f29b33664e462c69b3db21e5ca32" },
] as const;
function html(body: string) {
	if (Buffer.byteLength(body) > 4 * 1024 * 1024) throw new Error("The Cassia document exceeds its bounds.");
	const document = parseStateHtml(body);
	const pending = [{ node: document, depth: 0 }];
	let visited = 0;
	while (pending.length) {
		const entry = pending.pop()!;
		if (++visited > 100000 || entry.depth > 64) throw new Error("The Cassia document structure requires review.");
		for (const child of entry.node.childNodes ?? []) pending.push({ node: child, depth: entry.depth + 1 });
	}
	return document;
}
export function cassiaPolicyFingerprint(body: string, region: "bytes" | "main-text" | "legal-inventory") {
	if (region === "bytes") return hash(body);
	const document = html(body);
	if (region === "main-text") {
		const mains = descendants(document, node => node.nodeName === "main");
		if (mains.length !== 1 || text(mains[0]!).length < 100) throw new Error("The Cassia policy region requires review.");
		return hash(text(mains[0]!));
	}
	const links = descendants(document, node => node.nodeName === "a" && /accessib|privacy|disclaim|copyright|licen[cs]e|terms|polic(?:y|ies)/iu.test(`${text(node)} ${attribute(node, "href")}`)).map(node => ({ label: text(node), url: new URL(attribute(node, "href"), origin).href })).sort((first, second) => first.url.localeCompare(second.url) || first.label.localeCompare(second.label));
	const footers = descendants(document, node => node.nodeName === "footer" || attribute(node, "role") === "contentinfo" || /(?:^|\s)(?:site-)?footer(?:\s|$)/u.test(attribute(node, "class"))).map(text);
	if (footers.length !== 1) throw new Error("The Cassia legal inventory requires review.");
	return hash(JSON.stringify({ links, footers }));
}
function timestamp(value: unknown, now: number) {
	if (typeof value !== "string" || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString() !== value || Date.parse(value) > now) throw new Error("The Cassia capture time is invalid.");
	return value;
}
function generalDate(value: string) {
	const date = new Date(`${value}T00:00:00Z`);
	return /^20\d{2}-11-0[2-8]$/u.test(value) && Number.isFinite(date.valueOf()) && date.toISOString().slice(0, 10) === value && date.getUTCDay() === 2 && value >= "2026-11-03";
}
export function validateCassiaDocumentUrl(value: string, date: string) {
	const url = new URL(value);
	const pathname = decodeURIComponent(url.pathname);
	if (url.origin !== origin || url.username || url.password || url.search || url.hash || url.href !== value || !new RegExp(`^/media/Elections/SAMPLE BALLOTS/${date.slice(0, 4)}/[\\p{L}\\d (),.&_-]{1,200}\\.pdf$`, "u").test(pathname)) throw new Error("The Cassia PDF link requires review.");
}
export function validateCassiaElection(value: unknown): asserts value is CassiaElection {
	if (!exact(value, ["electionId", "electionDate", "cassiaDocuments"]) || value.electionId !== null || typeof value.electionDate !== "string" || !generalDate(value.electionDate) || !Array.isArray(value.cassiaDocuments) || value.cassiaDocuments.length > 12) throw new Error("The Cassia election identity is invalid.");
	const urls = [];
	for (const [index, document] of value.cassiaDocuments.entries()) {
		if (!exact(document, ["kind", "url"]) || document.kind !== (index ? "supplement" : "general") || typeof document.url !== "string") throw new Error("The Cassia offered document set requires review.");
		validateCassiaDocumentUrl(document.url, value.electionDate);
		urls.push(document.url);
	}
	if (new Set(urls).size !== urls.length) throw new Error("The Cassia offered documents are duplicated.");
}
export function cassiaDocumentDigest(documents: CassiaElection["cassiaDocuments"]) {
	return hash(JSON.stringify(documents));
}
export function validateCassiaSource(source: StateBallotSource) {
	if (!generalDate(source.electionDate) || source.stateCode !== "ID" || source.format !== "cassia-pdf" || source.countyName !== "Cassia County" || source.url !== cassiaDiscoveryUrl || source.pageUrl !== cassiaDiscoveryUrl || source.snapshotStorage !== "external" || source.retrievalPolicy || source.documentUrls || source.documentLinks || source.postBody || source.delimiter || source.id !== (source.electionDate === "2026-11-03" ? "id-cassia-2026" : `id-cassia-general-${source.electionDate}`)) throw new Error("The Cassia source contract is invalid.");
}
function offeredElections(body: string): CassiaElection[] {
	const document = html(body);
	const regions = descendants(document, node => attribute(node, "class").split(/\s+/u).includes("fr-view") && descendants(node, child => child.nodeName === "h2" && text(child).endsWith("General Election Sample Ballots")).length > 0);
	if (regions.length !== 1) throw new Error("The Cassia sample-ballot index requires review.");
	const elections: CassiaElection[] = [];
	let current: CassiaElection | undefined;
	let pending = false;
	const finish = () => {
		if (!current) return;
		if (!current.cassiaDocuments.length && !pending) throw new Error("The Cassia sample publication set is missing.");
		current.cassiaDocuments.sort((first, second) => Number(second.kind === "general") - Number(first.kind === "general") || first.url.localeCompare(second.url));
		validateCassiaElection(current);
		elections.push(current);
	};
	for (const node of regions[0]!.childNodes ?? []) {
		if (node.nodeName === "h2") {
			finish();
			const match = /^November ([2-8]), (20\d{2}) General Election Sample Ballots$/u.exec(text(node));
			if (!match) throw new Error("The Cassia printed election heading requires review.");
			current = { electionId: null, electionDate: `${match[2]}-11-0${match[1]}`, cassiaDocuments: [] };
			pending = false;
		}
		if (!current) continue;
		if (text(node) === "Sample ballots will be posted.") pending = true;
		for (const link of descendants(node, child => child.nodeName === "a" && /\.pdf(?:[?#]|$)/iu.test(attribute(child, "href")))) {
			const url = new URL(attribute(link, "href"), origin).href;
			validateCassiaDocumentUrl(url, current.electionDate);
			const label = text(link);
			if (!/Sample Ballot\.pdf$/u.test(label) || label.length > 240) throw new Error("The Cassia publication label requires review.");
			current.cassiaDocuments.push({ kind: label === "Cassia County General Election Sample Ballot.pdf" ? "general" : "supplement", url });
		}
	}
	finish();
	if (!elections.length || elections.length > 6 || new Set(elections.map(election => election.electionDate)).size !== elections.length) throw new Error("The Cassia election set is empty or duplicated.");
	return elections.sort((first, second) => first.electionDate.localeCompare(second.electionDate));
}
export function readCassiaDiscovery(body: string, now = Date.now()) {
	const value = JSON.parse(body);
	if (!exact(value, ["schemaVersion", "type", "policies", "index"]) || value.schemaVersion !== 1 || value.type !== "cassia-discovery" || JSON.stringify(value.policies) !== JSON.stringify(cassiaPolicyReceipts) || !exact(value.index, ["url", "body", "sha256", "retrievedAt"]) || value.index.url !== cassiaDiscoveryUrl || typeof value.index.body !== "string" || value.index.sha256 !== hash(value.index.body) || cassiaPolicyFingerprint(value.index.body, "legal-inventory") !== cassiaPolicyReceipts[2].sha256) throw new Error("The Cassia discovery provenance or policy requires review.");
	const index = value.index as unknown as PageCapture;
	timestamp(index.retrievedAt, now);
	return { index, elections: offeredElections(index.body) };
}
export async function fetchCassiaCycleDiscovery(options: Options = {}) {
	const request = options.requestText ?? fetchRemoteSourceText;
	const pause = options.sleep ?? wait;
	for (const [index, policy] of cassiaPolicyReceipts.entries()) {
		if (index) await pause(11000);
		let body: string;
		if (!index) {
			const response = await (options.requestDocument ?? fetchRemoteSourceDocument)(policy.url, { allowedHosts: ["www.cassia.gov"], maxBytes: 1024 * 1024, timeoutMs: 30000 });
			if (response.status !== 200 || response.contentType !== "text/plain") throw new Error("The Cassia robots policy requires review.");
			body = response.body.toString("utf8");
		}
		else {
			body = await request(policy.url, { allowedHosts: ["www.cassia.gov"], maxBytes: 2 * 1024 * 1024, maxRedirects: 0, timeoutMs: 30000 });
		}
		if (cassiaPolicyFingerprint(body, policy.region) !== policy.sha256) throw new Error("The Cassia access policy requires review.");
	}
	await pause(11000);
	const body = await request(cassiaDiscoveryUrl, { allowedHosts: ["www.cassia.gov"], maxBytes: 2 * 1024 * 1024, maxRedirects: 0, timeoutMs: 30000 });
	const index = { url: cassiaDiscoveryUrl, body, sha256: hash(body), retrievedAt: new Date((options.now ?? Date.now)()).toISOString() };
	const capture = JSON.stringify({ schemaVersion: 1, type: "cassia-discovery", policies: cassiaPolicyReceipts, index });
	readCassiaDiscovery(capture, (options.now ?? Date.now)());
	return capture;
}
function lines(words: Word[]): Line[] {
	const groups: { top: number; words: Word[] }[] = [];
	for (const word of [...words].sort((first, second) => first.top - second.top || first.left - second.left)) {
		let group = groups.find(group => Math.abs(group.top - word.top) < 0.8);
		if (!group) groups.push(group = { top: word.top, words: [] });
		group.words.push(word);
	}
	return groups.map(group => ({ top: group.top, text: clean(group.words.sort((first, second) => first.left - second.left).map(word => word.text).join(" ")) }));
}
function wordPages(body: string): WordPage[] {
	const pages = descendants(html(body), node => node.nodeName === "page");
	if (!pages.length || pages.length > 8) throw new Error("The Cassia PDF page count requires review.");
	return pages.map((page) => {
		const width = Number(attribute(page, "width"));
		const height = Number(attribute(page, "height"));
		if (width !== 612 || height !== 1008) throw new Error("The Cassia PDF dimensions require review.");
		const words = descendants(page, node => node.nodeName === "word").map(node => ({ text: text(node), left: Number(attribute(node, "xmin")), right: Number(attribute(node, "xmax")), top: Number(attribute(node, "ymin")), bottom: Number(attribute(node, "ymax")) }));
		if (!words.length || words.length > 12000 || words.some(word => !word.text || word.text.length > 500 || containsControlCharacters(word.text) || [word.left, word.right, word.top, word.bottom].some(value => !Number.isFinite(value)) || word.left < 0 || word.top < 0 || word.right > width + 1 || word.bottom > height + 1 || word.right <= word.left || word.bottom <= word.top)) throw new Error("The Cassia PDF word geometry requires review.");
		const watermark = words.filter(word => word.bottom - word.top > 30).sort((first, second) => first.left - second.left);
		if (watermark.length && (watermark.length > 6 || watermark.map(word => word.text).join("") !== "SAMPLE")) throw new Error("The Cassia oversized text requires review.");
		return { width, height, words: words.filter(word => word.bottom - word.top <= 30) };
	});
}
function columnBoundaries(page: WordPage) {
	const anchors = [...new Set(page.words.filter(word => word.text === "CANDIDATES").map(word => word.left))].sort((first, second) => first - second);
	if (anchors.length !== 3 || anchors[0]! < 60 || anchors[0]! > 95 || anchors[1]! - anchors[0]! < 175 || anchors[1]! - anchors[0]! > 190 || Math.abs((anchors[2]! - anchors[1]!) - (anchors[1]! - anchors[0]!)) > 1) throw new Error("The Cassia ballot columns require review.");
	const offset = (anchors[1]! - anchors[0]!) / 4;
	return [0, anchors[1]! - offset, anchors[2]! - offset, page.width];
}
function columns(page: WordPage, boundaries: number[]) {
	return boundaries.slice(0, -1).map((left, index) => lines(page.words.filter(word => (word.left + word.right) / 2 >= left && (word.left + word.right) / 2 < boundaries[index + 1]!)));
}
const ordinals = ["First", "Second", "Third", "Fourth", "Fifth", "Sixth", "Seventh"];
function candidateName(value: string) {
	if (!value || value.length > 160 || !/^[\p{L}\p{M} .,'’“-]+$/u.test(value) || /^(?:Yes|No|SAMPLE|WRITE-IN)$/iu.test(value)) throw new Error("The Cassia candidate name requires review.");
	return value;
}
function officeValues(title: string, group: string, suffix: string[]) {
	const district = /^District ([1-9]\d{0,2})$/u.exec(suffix[0] ?? "");
	let office = title;
	let scope: StateContestScope = "statewide";
	let designation = "";
	let number = "";
	if (group === "UNITED STATES OFFICES" && title === "United States Senator" && !suffix.length) return { office, scope, district: number, designation };
	if (group === "UNITED STATES OFFICES" && title === "United States Representative" && district && suffix.length === 1) {
		scope = "congressional";
	}
	else if (group === "STATE OFFICES" && ["Governor", "Lieutenant Governor", "Secretary of State", "State Controller", "State Treasurer", "Attorney General", "Superintendent of Public Instruction"].includes(title) && !suffix.length) {
		return { office, scope, district: number, designation };
	}
	else if (group === "LEGISLATIVE OFFICES" && district && ((title === "State Senator" && suffix.length === 1) || (title === "State Representative" && suffix.length === 2 && /^Seat [A-Z]$/u.test(suffix[1]!)))) {
		scope = title === "State Senator" ? "state-senate" : "state-house";
	}
	else if (group === "COUNTY OFFICES" && title === "County Commissioner" && district && suffix.length === 2 && /^[1-9]\d? Year Term$/u.test(suffix[1]!)) {
		scope = "local";
		designation = suffix[1]!;
	}
	else if (group === "COUNTY OFFICES" && ["Clerk of the District Court", "County Treasurer", "County Assessor", "County Coroner", "County Sheriff", "County Prosecutor"].includes(title) && !suffix.length) {
		return { office, scope: "local" as const, district: "", designation };
	}
	else {
		throw new Error("The Cassia office or section requires review.");
	}
	number = district![1]!;
	office += ` ${suffix.filter(value => !value.endsWith("Year Term")).join(" ")}`;
	return { office, scope, district: number, designation };
}
function record(source: StateBallotSource, name: string, office: string, scope: StateContestScope, district: string, party = "", designation = "", districtLabel = ""): StateCandidateRecord {
	candidateName(name);
	return { id: hash(JSON.stringify([source.id, office, name])).slice(0, 24), name, office, scope, district, status: "listed", ...(party ? { party } : {}), ...(designation ? { ballotDesignation: designation } : {}), ...(scope === "statewide" ? { jurisdiction: "Idaho" } : {}), ...(district ? { sourceDistrictLabel: districtLabel || `District ${district}` } : {}), sourceAreaLabel: "Cassia County general-election sample" };
}
function candidatePage(source: StateBallotSource, page: WordPage, boundaries: number[]) {
	const header = clean(lines(page.words.filter(word => word.top < 120)).map(line => line.text).join(" "));
	if (!header.includes("CASSIA COUNTY STATE OF IDAHO") || !header.includes(`NOVEMBER ${Number(source.electionDate.slice(-2))}, ${source.electionDate.slice(0, 4)}`) || !header.includes("SAMPLE BALLOT")) throw new Error("The Cassia printed ballot identity requires review.");
	const records: StateCandidateRecord[] = [];
	for (const column of columns(page, boundaries)) {
		let group = "";
		let context: ReturnType<typeof officeValues> | undefined;
		let contextRows = 0;
		const finish = () => {
			if (context && !contextRows) throw new Error("The Cassia office contains no candidate rows.");
			context = undefined;
			contextRows = 0;
		};
		const body = column.filter(line => line.top >= 120);
		for (let index = 0; index < body.length; index++) {
			const value = body[index]!.text;
			if (!group && value === "INSTRUCTIONS TO VOTER") continue;
			if (value === "CANDIDATES FOR") {
				finish();
				group = body[++index]?.text ?? "";
				if (!["UNITED STATES OFFICES", "STATE OFFICES", "LEGISLATIVE OFFICES", "COUNTY OFFICES"].includes(group)) throw new Error("The Cassia candidate section requires review.");
				continue;
			}
			if (!group) continue;
			if (value === "NONPARTISAN BALLOT") {
				finish();
				if (group !== "COUNTY OFFICES" || body[++index]?.text !== "MAGISTRATE JUDGE") throw new Error("The Cassia retention section requires review.");
				const question = [];
				while (body[index + 1] && body[index + 1]!.text !== "Yes") question.push(body[++index]!.text);
				const match = /^Shall Magistrate (.+) of Cassia County of the (First|Second|Third|Fourth|Fifth|Sixth|Seventh) Judicial District be retained in office\?$/u.exec(question.join(" "));
				if (!match || body[++index]?.text !== "Yes" || body[++index]?.text !== "No") throw new Error("The Cassia named retention question requires review.");
				const label = `${match[2]} Judicial District`;
				records.push(record(source, match[1]!, `Magistrate Judge, Cassia County, ${label} (Retention)`, "local", String(ordinals.indexOf(match[2]!) + 1), "", "Retention; Nonpartisan ballot", label));
				continue;
			}
			if (value === "VOTE BOTH SIDES" || /^Typ:\d+ Seq:\d+ Spl:\d+$/u.test(value) || value === "(WRITE-IN)") continue;
			if (value.startsWith("(Please note: ")) {
				if (body.slice(index).map(line => line.text).join(" ") !== "(Please note: the order of candidates on this sample ballot may not necessarily reflect the name rotation on the official precinct ballots.)") throw new Error("The Cassia ballot note requires review.");
				break;
			}
			const candidate = /^(.+) \(([A-Z]{2,6})\)$/u.exec(value);
			if (candidate) {
				if (!context) throw new Error("A Cassia candidate has no validated office.");
				let designation = context.designation;
				if (body[index + 1]?.text.startsWith("(a person, formerly known as ")) {
					const annotation = [body[++index]!.text];
					while (!annotation.at(-1)!.endsWith(")") && annotation.length < 3 && body[index + 1]) annotation.push(body[++index]!.text);
					const joined = annotation.join(" ");
					if (!/^\(a person, formerly known as [\p{L}\p{M} .,'’-]{1,150}\)$/u.test(joined) || designation) throw new Error("The Cassia former-name annotation requires review.");
					designation = joined.slice(1, -1);
				}
				records.push(record(source, candidate[1]!, context.office, context.scope, context.district, candidate[2]!, designation));
				contextRows++;
				continue;
			}
			finish();
			const suffix = [];
			while (body[index + 1] && body[index + 1]!.text !== "(Vote for One)" && suffix.length < 3) suffix.push(body[++index]!.text);
			if (body[++index]?.text !== "(Vote for One)") throw new Error("The Cassia office voting instruction requires review.");
			context = officeValues(value, group, suffix);
		}
		finish();
		if (!group) throw new Error("The Cassia candidate column is empty.");
	}
	if (!records.length || records.length > 500 || new Set(records.map(item => item.id)).size !== records.length) throw new Error("The Cassia candidate set is empty or duplicated.");
	return records;
}
function questionPage(page: WordPage, boundaries: number[], sourceDocumentIndex: number, pageNumber: number): Question[] {
	const questionColumns = columns(page, boundaries).map(column => column.filter(line => line.text !== "VOTE BOTH SIDES" && !/^Typ:\d+ Seq:\d+ Spl:\d+$/u.test(line.text) && !(sourceDocumentIndex > 0 && line.top > 930 && /^\d{1,3} [\p{L} .'-]{1,80} \d{1,4}$/u.test(line.text))));
	if (questionColumns[0]?.[0]?.text !== "BALLOT MEASURES") throw new Error("The Cassia question-page heading requires review.");
	const result: Question[] = [];
	for (const column of questionColumns) {
		for (let index = 0; index < column.length; index++) {
			const title = column[index]!.text;
			if (!/^(?:House Joint Resolution [1-9]\d{0,2}|PROPOSITION [1-9]\d{0,2}|IDAHO ADVISORY QUESTION)$/u.test(title)) continue;
			let end = index + 1;
			while (end < column.length && !/^(?:House Joint Resolution [1-9]\d{0,2}|PROPOSITION [1-9]\d{0,2}|IDAHO ADVISORY QUESTION|[A-Z][A-Z &'’-]+(?:FIRE|DISTRICT))$/u.test(column[end]!.text)) end++;
			const section = column.slice(index + 1, end);
			let choices: string[];
			if (title === "IDAHO ADVISORY QUESTION") {
				const instruction = section.findIndex(line => line.text === "choose only one answer");
				if (instruction < 1) throw new Error("The Cassia advisory voting instruction requires review.");
				choices = [];
				let previous = -Infinity;
				for (const line of section.slice(instruction + 1)) {
					if (line.top - previous > 14) choices.push(line.text);
					else choices[choices.length - 1] += ` ${line.text}`;
					previous = line.top;
				}
				if (choices.length < 2 || choices.length > 20 || new Set(choices).size !== choices.length) throw new Error("The Cassia advisory choices require review.");
			}
			else {
				choices = section.filter(line => /^(?:Yes|No)$/u.test(line.text)).map(line => line.text);
				if (choices.join("|") !== "Yes|No") throw new Error("The Cassia question choices require review.");
			}
			result.push({ title: title.replace(/^PROPOSITION/u, "Proposition").replace(/^IDAHO ADVISORY QUESTION$/u, "Idaho advisory question"), scope: "statewide", choices, textSha256: hash(section.map(line => line.text).join(" ")), sourceDocumentIndex, pageNumber });
			index = end - 1;
		}
	}
	if (!result.length || result.length > 20) throw new Error("The Cassia statewide question inventory requires review.");
	return result;
}
function localQuestion(source: StateBallotSource, page: WordPage, sourceDocumentIndex: number, pageNumber: number): Question {
	const full = lines(page.words);
	const heading = full.find(line => line.top > 120 && line.top < 200 && /^[A-Z][A-Z .0-9&'-]+SCHOOL DISTRICT NO\. [1-9]\d{0,3}$/u.test(line.text));
	const date = `November ${Number(source.electionDate.slice(-2))}, ${source.electionDate.slice(0, 4)}`;
	const body = full.map(line => line.text).join(" ");
	if (!heading || !body.includes("SUPPLEMENTAL LEVY ELECTION") || !body.includes(date) || !body.includes("CASSIA COUNTY STATE OF IDAHO") || !body.includes("SAMPLE BALLOT")) throw new Error("The Cassia supplemental question requires review.");
	const choices = full.filter(line => /^(?:IN FAVOR OF|AGAINST) AUTHORIZING A SUPPLEMENTAL LEVY /u.test(line.text)).map(line => line.text);
	if (choices.length !== 2 || !choices[0]!.startsWith("IN FAVOR OF ") || !choices[1]!.startsWith("AGAINST ")) throw new Error("The Cassia local question choices require review.");
	return { title: `${heading.text} supplemental levy`, scope: "local", choices, textSha256: hash(body), sourceDocumentIndex, pageNumber };
}
function fireQuestion(source: StateBallotSource, page: WordPage, boundaries: number[], sourceDocumentIndex: number, pageNumber: number): Question {
	const column = columns(page, boundaries)[2]!.filter(line => line.text !== "VOTE BOTH SIDES" && !/^Typ:\d+ Seq:\d+ Spl:\d+$/u.test(line.text));
	const beginning = column.findIndex(line => /^[A-Z][A-Z &'’-]+ RURAL FIRE$/u.test(line.text));
	const section = column.slice(beginning);
	const body = section.map(line => line.text).join(" ");
	const date = `November ${Number(source.electionDate.slice(-2))}, ${source.electionDate.slice(0, 4)}`;
	if (beginning < 0 || section[1]?.text !== "PROTECTION DISTRICT" || !body.includes("OVERRIDE LEVY") || !body.includes(`to be voted on ${date}.`)) throw new Error("The Cassia fire question identity requires review.");
	const choiceStart = section.findIndex(line => line.text.startsWith("IN FAVOR OF "));
	const againstStart = section.findIndex(line => line.text.startsWith("AGAINST "));
	if (choiceStart < 1 || againstStart <= choiceStart) throw new Error("The Cassia fire question choices require review.");
	const choices = [section.slice(choiceStart, againstStart), section.slice(againstStart)].map(value => value.map(line => line.text).join(" "));
	return { title: `${section[0]!.text} ${section[1]!.text} temporary override levy`, scope: "local", choices, textSha256: hash(body), sourceDocumentIndex, pageNumber };
}
export function readCassiaCandidateDocuments(source: StateBallotSource, documents: string[]) {
	validateCassiaSource(source);
	if (!documents.length || documents.length > 12) throw new Error("The Cassia PDF set is incomplete.");
	const general = wordPages(documents[0]!);
	const boundaries = columnBoundaries(general[0]!);
	const records = candidatePage(source, general[0]!, boundaries);
	const questions = general.slice(1).flatMap((page, index) => questionPage(page, boundaries, 0, index + 2));
	for (const [index, body] of documents.slice(1).entries()) {
		const pages = wordPages(body);
		if (pages.length !== 1) throw new Error("The Cassia supporting page set requires review.");
		const page = pages[0]!;
		if (lines(page.words)[0]?.text === "BALLOT MEASURES") {
			const repeated = questionPage(page, boundaries, index + 1, 1);
			for (const question of repeated) {
				if (!questions.some(original => original.scope === "statewide" && original.title === question.title && original.textSha256 === question.textSha256 && JSON.stringify(original.choices) === JSON.stringify(question.choices))) throw new Error("The Cassia repeated statewide question disagrees with the general sample.", { cause: { question, general: questions.filter(original => original.title === question.title) } });
			}
			questions.push(...repeated, fireQuestion(source, page, boundaries, index + 1, 1));
		}
		else {
			questions.push(localQuestion(source, page, index + 1, 1));
		}
	}
	return { records, questions, officeCount: new Set(records.map(item => item.office)).size };
}
export async function fetchCassiaCandidateCapture(source: StateBallotSource, options: Options = {}) {
	validateCassiaSource(source);
	const now = options.now ?? Date.now;
	const configuredExtractor = !options.discovery && !options.extractor ? await resolveStateBallotPdfExtractor() : null;
	const discovery = options.discovery ?? await fetchCassiaCycleDiscovery(options);
	const election = readCassiaDiscovery(discovery, now()).elections.find(item => item.electionDate === source.electionDate);
	if (!election) throw new Error("The Cassia offered election disappeared.");
	const documents = [];
	if (election.cassiaDocuments.length) {
		const executable = options.extractor ? null : configuredExtractor ?? await resolveStateBallotPdfExtractor();
		for (const document of election.cassiaDocuments) {
			await (options.sleep ?? wait)(11000);
			documents.push(await fetchStateBallotPdfDocument(document.url, { allowedHosts: ["www.cassia.gov"], request: options.requestDocument, extractor: options.extractor ?? (bytes => extractStateBallotPdfText(bytes, executable!, 12000, "bbox-layout")), now }));
		}
	}
	return JSON.stringify({ schemaVersion: 1, type: "cassia-candidate-capture", discovery: JSON.parse(discovery), documents });
}
export function parseCassiaCandidateCapture(source: StateBallotSource, body: string, now = Date.now()) {
	validateCassiaSource(source);
	if (Buffer.byteLength(body) > 32 * 1024 * 1024) throw new Error("The Cassia candidate capture exceeds its bounds.");
	const capture = JSON.parse(body);
	if (!exact(capture, ["schemaVersion", "type", "discovery", "documents"]) || capture.schemaVersion !== 1 || capture.type !== "cassia-candidate-capture" || !Array.isArray(capture.documents)) throw new Error("The Cassia candidate capture requires review.");
	const election = readCassiaDiscovery(JSON.stringify(capture.discovery), now).elections.find(item => item.electionDate === source.electionDate);
	if (!election || election.cassiaDocuments.length !== capture.documents.length) throw new Error("The Cassia captured publication set is incomplete.");
	if (!capture.documents.length) throw new StateBallotAwaitingRecordsError(source.id);
	const documents = capture.documents.map((document: unknown, index) => {
		if (!exact(document, ["url", "text", "sha256", "retrievedAt"]) || document.url !== election.cassiaDocuments[index]!.url || typeof document.text !== "string" || typeof document.sha256 !== "string" || !/^[a-f0-9]{64}$/u.test(document.sha256)) throw new Error("The Cassia PDF provenance requires review.");
		timestamp(document.retrievedAt, now);
		return document as unknown as PdfCapture;
	});
	const facts = readCassiaCandidateDocuments(source, documents.map(document => document.text));
	return { ...facts, retrievedAt: new Date(Math.min(...documents.map(document => Date.parse(document.retrievedAt)))).toISOString(), sha256: hash(JSON.stringify(documents.map(({ url, sha256 }) => ({ url, sha256 })))), documents: documents.map(({ url, sha256, retrievedAt }, index) => ({ url, sha256, retrievedAt, includedRecordCount: index ? 0 : facts.records.length })), collectionIndexSha256: cassiaDocumentDigest(election.cassiaDocuments) };
}
