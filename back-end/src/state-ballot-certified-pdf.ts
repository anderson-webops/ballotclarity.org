import type { fetchRemoteSourceDocument } from "./remote-json-source.js";
import type { StateCandidateRecord, StateContestScope } from "./state-ballot-records.js";
import type { StateBallotSource } from "./state-ballot-sources.js";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { fetchRemoteSourceText } from "./remote-json-source.js";
import { stateHtmlAttribute as attribute, stateHtmlDescendants as descendants, parseStateHtml, stateHtmlTableRows, stateHtmlText } from "./state-ballot-html.js";
import { extractStateBallotPdfText, fetchStateBallotPdfDocument, resolveStateBallotPdfExtractor, stateBallotPdfCollectorContract } from "./state-ballot-pdf.js";
import { containsControlCharacters } from "./text-validation.js";

export const certifiedPdfDiscoveryUrls = { MO: "https://www.sos.mo.gov/", NJ: "https://www.nj.gov/state/elections/election-information.shtml" } as const;
export const missouriCalendarUrl = "https://www.sos.mo.gov/elections/calendar";
type SupportedState = keyof typeof certifiedPdfDiscoveryUrls;
interface PdfDocument { kind: "certified-candidates" | "senate" | "house" | "house-amendment"; url: string; district?: string }
export interface CertifiedPdfElection { electionId: null; electionDate: string; pageUrl: string; pdfDocuments: PdfDocument[] }
interface CaptureDocument { url: string; text: string; sha256: string; retrievedAt: string }
interface Capture { schemaVersion: 1; type: "certified-pdf-discovery"; stateCode: SupportedState; policies: readonly PolicyReceipt[]; pages: { url: string; body: string }[]; documents: CaptureDocument[] }
interface PolicyReceipt { url: string; region: "bytes" | "main-text" | "redirect-target"; sha256: string }
type TextRequest = (url: string, options: { allowedHosts: string[]; maxBytes: number; maxRedirects: number; timeoutMs: number }) => Promise<string>;
const clean = (value: string) => value.replace(/\s+/gu, " ").trim();
const hash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const text = (node: Parameters<typeof stateHtmlText>[0]) => clean(stateHtmlText(node));
const exact = (value: unknown, keys: string[]): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).sort().join("|") === [...keys].sort().join("|"));
export const certifiedPdfPolicyReceipts: Readonly<Record<SupportedState, readonly PolicyReceipt[]>> = {
	MO: [
		{ url: "https://www.sos.mo.gov/robots.txt", region: "bytes", sha256: "04f50b1bc52d4ab179745658c45c448e5166f12d4cbead53ce505b04ccef6db2" },
		{ url: "https://www.sos.mo.gov/ipolicy", region: "main-text", sha256: "15785263215822ef339a96ebd3efb9ad53b975ca70366abaab2862f158a4effc" },
	],
	NJ: [
		{ url: "https://www.nj.gov/robots.txt", region: "bytes", sha256: "ff9ce81f5dd01928fdffd1cca9176678f1d15d1671f6ee5658a063d5d234a421" },
		{ url: "https://nj.gov/robots.txt", region: "bytes", sha256: "ff9ce81f5dd01928fdffd1cca9176678f1d15d1671f6ee5658a063d5d234a421" },
		{ url: "https://nj.gov/nj/privacy.html", region: "redirect-target", sha256: hash("https://www.nj.gov/nj/privacy.shtml") },
		{ url: "https://nj.gov/nj/legal.html", region: "redirect-target", sha256: hash("https://www.nj.gov/nj/legal.shtml") },
		{ url: "https://www.nj.gov/nj/privacy.shtml", region: "main-text", sha256: "fda12ee197ac00e02114eb9f912370a5ac0329dad9adc8a3d7ff098c6b393f04" },
		{ url: "https://www.nj.gov/nj/legal.shtml", region: "main-text", sha256: "64a27f7a9a5a2a077b5eaf2aec065c90c27b8a7373d49aaece758ac674e2893f" },
	],
};
function main(body: string) {
	if (Buffer.byteLength(body) > 3 * 1024 * 1024) throw new Error("The official PDF index/policy exceeds its bounds.");
	const nodes = descendants(parseStateHtml(body), node => attribute(node, "id") === "main");
	if (nodes.length !== 1) throw new Error("The official PDF policy/calendar layout changed.");
	return nodes[0]!;
}
function dateValue(month: string, day: string, year: string) {
	const value = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
	if (!/^20\d{2}-\d{2}-\d{2}$/u.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) throw new Error("The official PDF date is invalid.");
	return value;
}
function generalDate(value: string) {
	return /^20\d{2}-11-0[2-8]$/u.test(value) && value >= "2026-11-03" && Number(value.slice(0, 4)) % 2 === 0 && Number.isFinite(Date.parse(value)) && new Date(value).getUTCDay() === 2;
}
function publicPdf(value: string, stateCode: SupportedState, year: string) {
	const url = new URL(value, certifiedPdfDiscoveryUrls[stateCode]);
	const path = stateCode === "MO" ? /^\/CMSImages\/ElectionCandidates\/[\w.-]+\.pdf$/u : new RegExp(`^/state/elections/assets/pdf/election-results/${year}/[A-Za-z0-9_.-]+\\.pdf$`, "u");
	if (url.origin !== (stateCode === "MO" ? "https://www.sos.mo.gov" : "https://www.nj.gov") || url.username || url.password || url.search || url.hash || !path.test(url.pathname)) throw new Error("The candidate PDF is not an offered same-publisher document.");
	return url.href;
}
function policyLinks(body: string, stateCode: SupportedState) {
	const links = [...new Set(descendants(parseStateHtml(body), node => node.nodeName === "a" && /privacy|conditions of use|terms of use|legal statement|copyright policy/iu.test(text(node))).map(node => new URL(attribute(node, "href"), certifiedPdfDiscoveryUrls[stateCode]).href))].sort();
	const expected = stateCode === "MO" ? ["https://www.sos.mo.gov/ipolicy"] : ["https://nj.gov/nj/legal.html", "https://nj.gov/nj/privacy.html"];
	if (links.join("|") !== expected.join("|")) throw new Error("The publisher policy-link inventory requires review.");
}
function jerseyPages(body: string) {
	const pages = new Map<string, string>();
	for (const node of descendants(parseStateHtml(body), node => node.nodeName === "a")) {
		const label = /^(20\d{2}) Election Year Information$/u.exec(text(node));
		if (!label || label[1]! < "2026" || Number(label[1]) % 2) continue;
		const url = new URL(attribute(node, "href"), certifiedPdfDiscoveryUrls.NJ);
		if (url.origin !== "https://www.nj.gov" || url.username || url.password || url.search || url.hash || url.pathname !== `/state/elections/election-information-${label[1]}.shtml` || (pages.has(label[1]!) && pages.get(label[1]!) !== url.href)) throw new Error("The New Jersey offered election-year links changed.");
		pages.set(label[1]!, url.href);
	}
	if (!pages.size || pages.size > 10) throw new Error("No bounded New Jersey federal election-year pages are offered.");
	return [...pages.entries()].sort(([first], [second]) => first.localeCompare(second));
}
function jerseyDocuments(body: string, year: string, pageUrl: string) {
	policyLinks(body, "NJ");
	const result: PdfDocument[] = [];
	for (const node of descendants(parseStateHtml(body), node => node.nodeName === "a")) {
		const label = text(node);
		const amendment = /^Amended Certification of Nominees General Election U\.S\. House of Representatives: ([1-9]\d?)(?:st|nd|rd|th) Congressional District$/u.exec(label);
		const kind = label === "Official General Election Candidates: U.S. Senate" ? "senate" : label === "Official General Election Candidates: U.S. House of Representatives" ? "house" : amendment ? "house-amendment" : null;
		if (!kind) continue;
		const url = publicPdf(new URL(attribute(node, "href"), pageUrl).href, "NJ", year);
		result.push({ kind, url, ...(amendment ? { district: amendment[1]! } : {}) });
	}
	if (result.filter(item => item.kind === "house").length !== 1 || result.filter(item => item.kind === "senate").length > 1 || result.length > 14 || new Set(result.map(item => item.url)).size !== result.length) throw new Error("The complete New Jersey candidate document controls require review.");
	return result.sort((first, second) => ({ "senate": 0, "house": 1, "house-amendment": 2, "certified-candidates": 3 }[first.kind] - { "senate": 0, "house": 1, "house-amendment": 2, "certified-candidates": 3 }[second.kind]));
}
function missouriElection(index: string, calendar: string): CertifiedPdfElection {
	policyLinks(index, "MO");
	policyLinks(calendar, "MO");
	const content = main(calendar);
	const year = /^(20\d{2}) Missouri Election Calendar$/u.exec(text(descendants(content, node => node.nodeName === "h1")[0]!))?.[1];
	const rows = descendants(content, node => node.nodeName === "table").flatMap(stateHtmlTableRows).map(row => (row.childNodes ?? []).filter(cell => cell.nodeName === "td" || cell.nodeName === "th").map(text));
	const selected = rows.filter(row => row[1] === "General Election");
	const printed = selected.length === 1 ? /^November ([1-9]\d?), (20\d{2})$/u.exec(selected[0]![0]!) : null;
	if (!printed || printed[2] !== year) throw new Error("The Missouri calendar must explicitly identify the regular November general election.");
	const electionDate = dateValue("11", printed[1]!, year!);
	const links = [...new Set(descendants(parseStateHtml(index), node => node.nodeName === "a" && text(node) === `Certified Candidates - November ${year}`).map(node => publicPdf(attribute(node, "href"), "MO", year!)))];
	if (links.length !== 1 || !generalDate(electionDate)) throw new Error("The Missouri dated candidate certification is absent or ambiguous.");
	return { electionId: null, electionDate, pageUrl: certifiedPdfDiscoveryUrls.MO, pdfDocuments: [{ kind: "certified-candidates", url: links[0]! }] };
}
function readCapture(body: string): Capture {
	if (Buffer.byteLength(body) > 12 * 1024 * 1024) throw new Error("The certified PDF evidence exceeds its bounds.");
	const value: unknown = JSON.parse(body);
	if (!exact(value, ["schemaVersion", "type", "stateCode", "policies", "pages", "documents"]) || value.schemaVersion !== 1 || value.type !== "certified-pdf-discovery" || !["MO", "NJ"].includes(String(value.stateCode)) || JSON.stringify(value.policies) !== JSON.stringify(certifiedPdfPolicyReceipts[value.stateCode as SupportedState]) || !Array.isArray(value.pages) || !Array.isArray(value.documents) || value.pages.length < 2 || value.pages.length > 11 || !value.documents.length || value.documents.length > 30) throw new Error("The certified PDF acquisition evidence is invalid.");
	for (const page of value.pages) {
		if (!exact(page, ["url", "body"]) || typeof page.url !== "string" || typeof page.body !== "string" || Buffer.byteLength(page.body) > 3 * 1024 * 1024) throw new Error("The certified PDF index evidence is invalid.");
	}
	for (const document of value.documents) {
		if (!exact(document, ["url", "text", "sha256", "retrievedAt"]) || typeof document.url !== "string" || typeof document.text !== "string" || !document.text.trim() || Buffer.byteLength(document.text) > stateBallotPdfCollectorContract.maximumTextBytes || document.text.includes("\uFFFD") || typeof document.sha256 !== "string" || !/^[a-f0-9]{64}$/u.test(document.sha256) || typeof document.retrievedAt !== "string" || !Number.isFinite(Date.parse(document.retrievedAt)) || new Date(document.retrievedAt).toISOString() !== document.retrievedAt) throw new Error("The certified PDF document provenance is invalid.");
	}
	if (new Set(value.pages.map(page => page.url)).size !== value.pages.length || new Set(value.documents.map(document => document.url)).size !== value.documents.length) throw new Error("The certified PDF evidence repeats a publication.");
	return value as unknown as Capture;
}
export function validateCertifiedPdfElection(value: unknown, stateCode: SupportedState): asserts value is CertifiedPdfElection {
	if (!exact(value, ["electionId", "electionDate", "pageUrl", "pdfDocuments"]) || value.electionId !== null || typeof value.electionDate !== "string" || !generalDate(value.electionDate) || typeof value.pageUrl !== "string" || !Array.isArray(value.pdfDocuments) || !value.pdfDocuments.length || value.pdfDocuments.length > 14) throw new Error("The certified PDF election identity is invalid.");
	const year = value.electionDate.slice(0, 4);
	if (value.pageUrl !== (stateCode === "MO" ? certifiedPdfDiscoveryUrls.MO : `https://www.nj.gov/state/elections/election-information-${year}.shtml`)) throw new Error("The certified PDF election page is invalid.");
	for (const item of value.pdfDocuments) {
		if (!exact(item, item?.kind === "house-amendment" ? ["kind", "url", "district"] : ["kind", "url"]) || typeof item.url !== "string" || publicPdf(item.url, stateCode, year) !== item.url || (stateCode === "MO" ? item.kind !== "certified-candidates" : !["senate", "house", "house-amendment"].includes(String(item.kind))) || (item.kind === "house-amendment" && (typeof item.district !== "string" || !/^(?:[1-9]|1[0-2])$/u.test(item.district)))) throw new Error("The certified PDF document set is invalid.");
	}
	if (new Set(value.pdfDocuments.map(item => item.url)).size !== value.pdfDocuments.length || (stateCode === "MO" ? value.pdfDocuments.length !== 1 : value.pdfDocuments.filter(item => item.kind === "house").length !== 1 || value.pdfDocuments.filter(item => item.kind === "senate").length > 1)) throw new Error("The certified PDF document set is ambiguous.");
}
export function readCertifiedPdfElectionDiscovery(body: string): CertifiedPdfElection[] {
	const capture = readCapture(body);
	if (capture.pages[0]!.url !== certifiedPdfDiscoveryUrls[capture.stateCode]) throw new Error("The certified PDF discovery page changed.");
	policyLinks(capture.pages[0]!.body, capture.stateCode);
	let elections: CertifiedPdfElection[];
	if (capture.stateCode === "MO") {
		if (capture.pages.length !== 2 || capture.pages[1]!.url !== missouriCalendarUrl) throw new Error("The Missouri calendar evidence is incomplete.");
		elections = [missouriElection(capture.pages[0]!.body, capture.pages[1]!.body)];
	}
	else {
		const pages = jerseyPages(capture.pages[0]!.body);
		if (pages.length + 1 !== capture.pages.length) throw new Error("The New Jersey election-year evidence is incomplete.");
		elections = pages.map(([year, pageUrl], position) => {
			const page = capture.pages[position + 1]!;
			if (page.url !== pageUrl) throw new Error("The New Jersey election page is not actually offered.");
			const pdfDocuments = jerseyDocuments(page.body, year, pageUrl);
			const dates = pdfDocuments.map(item => jerseyPdfDate(capture.documents.find(document => document.url === item.url)?.text ?? ""));
			if (new Set(dates).size !== 1 || !generalDate(dates[0]!) || dates[0]!.slice(0, 4) !== year) throw new Error("The New Jersey candidate documents disagree on the general-election date.");
			return { electionId: null, electionDate: dates[0]!, pageUrl, pdfDocuments };
		});
	}
	for (const election of elections) validateCertifiedPdfElection(election, capture.stateCode);
	if (elections.flatMap(election => election.pdfDocuments.map(document => document.url)).join("|") !== capture.documents.map(document => document.url).join("|")) throw new Error("The certified PDF capture has missing, reordered or additional documents.");
	return elections;
}
export async function fetchCertifiedPdfCycleDiscovery(stateCode: SupportedState, options: { requestText?: TextRequest; requestDocument?: typeof fetchRemoteSourceDocument; extractor?: (bytes: Buffer) => Promise<string>; now?: () => number } = {}) {
	const executable = options.extractor ? null : await resolveStateBallotPdfExtractor();
	const request = options.requestText ?? fetchRemoteSourceText;
	const transport = { allowedHosts: stateCode === "MO" ? ["www.sos.mo.gov"] : ["www.nj.gov", "nj.gov"], maxBytes: 3 * 1024 * 1024, maxRedirects: 0, timeoutMs: 12000 };
	for (const policy of certifiedPdfPolicyReceipts[stateCode]) {
		const body = await request(policy.url, transport);
		const target = policy.region === "redirect-target" ? /window\.location\s*=\s*"(https:\/\/www\.nj\.gov\/nj\/(?:privacy|legal)\.shtml)"/u.exec(body)?.[1] : undefined;
		if (policy.region === "redirect-target" && descendants(parseStateHtml(body), node => node.nodeName === "body").some(node => text(node))) throw new Error("The policy redirect page now contains additional content requiring review.");
		if (hash(policy.region === "main-text" ? text(main(body)) : policy.region === "redirect-target" ? target ?? "" : body) !== policy.sha256) throw new Error("The certified PDF publisher policy requires review.");
	}
	const index = await request(certifiedPdfDiscoveryUrls[stateCode], transport);
	policyLinks(index, stateCode);
	const pages: Capture["pages"] = [{ url: certifiedPdfDiscoveryUrls[stateCode], body: index }];
	let descriptors: PdfDocument[];
	if (stateCode === "MO") {
		const calendar = await request(missouriCalendarUrl, transport);
		pages.push({ url: missouriCalendarUrl, body: calendar });
		descriptors = missouriElection(index, calendar).pdfDocuments;
	}
	else {
		descriptors = [];
		for (const [year, url] of jerseyPages(index)) {
			const body = await request(url, transport);
			pages.push({ url, body });
			descriptors.push(...jerseyDocuments(body, year, url));
		}
	}
	const documents: CaptureDocument[] = [];
	for (const descriptor of descriptors) {
		documents.push(await fetchStateBallotPdfDocument(descriptor.url, { allowedHosts: transport.allowedHosts, request: options.requestDocument, now: options.now, extractor: options.extractor ?? (bytes => extractStateBallotPdfText(bytes, executable!, stateBallotPdfCollectorContract.timeoutMs, stateCode === "NJ" ? "bbox-layout" : "layout")) }));
	}
	const body = JSON.stringify({ schemaVersion: 1, type: "certified-pdf-discovery", stateCode, policies: certifiedPdfPolicyReceipts[stateCode], pages, documents });
	readCertifiedPdfElectionDiscovery(body);
	return body;
}
export function validateCertifiedPdfSource(source: StateBallotSource) {
	const stateCode = source.stateCode as SupportedState;
	if (!["MO", "NJ"].includes(stateCode) || source.format !== "certified-pdf" || source.retrievalPolicy || source.postBody || source.delimiter || !generalDate(source.electionDate) || !source.documentUrls?.length || source.documentLinks?.length) throw new Error("The automatic certified PDF source is invalid.");
	const originalId = stateCode === "MO" ? "mo-sos-2026" : "nj-doe-2026-federal";
	if (source.id !== (source.electionDate === "2026-11-03" ? originalId : `${stateCode === "MO" ? "mo-general" : "nj-federal-general"}-${source.electionDate}`)) throw new Error("The certified PDF source identifier is invalid.");
	for (const url of source.documentUrls) publicPdf(url, stateCode, source.electionDate.slice(0, 4));
	if (stateCode === "MO" ? source.documentUrls.length !== 1 || source.url !== source.documentUrls[0] || source.pageUrl !== (source.id === originalId ? source.url : certifiedPdfDiscoveryUrls.MO) : source.url !== source.pageUrl || !/^https:\/\/www\.nj\.gov\/state\/elections\/election-information-20\d{2}\.shtml$/u.test(source.pageUrl) || !source.pageUrl.includes(source.electionDate.slice(0, 4))) throw new Error("The certified PDF source document binding is invalid.");
}
function candidate(values: Omit<StateCandidateRecord, "id">, source: StateBallotSource): StateCandidateRecord {
	const name = clean(values.name);
	if (!name || name.length > 250 || containsControlCharacters(name) || /https?:|@|\d{3}|\b(?:Address|County|Slogan|Candidates|Election|Certified)\b/iu.test(name)) throw new Error("A certified PDF candidate name has an unsupported layout.");
	const key = [source.stateCode, source.electionDate, values.office.toLowerCase(), values.district, name.toLowerCase(), (values.party ?? "").toLowerCase(), ...(values.jurisdiction ? [values.jurisdiction.toLowerCase()] : [])];
	return { ...values, name, id: hash(JSON.stringify(key)).slice(0, 24) };
}
function missouriRecords(source: StateBallotSource, body: string) {
	const date = source.electionDate;
	if (!body.includes(`General Election on Tuesday, November ${Number(date.slice(-2))}, ${date.slice(0, 4)}`) || !body.includes("Certificate of Judicial Candidates") || !body.includes("NOTICE OF ELECTION")) throw new Error("The Missouri certification is incomplete or identifies another election.");
	const records: StateCandidateRecord[] = [];
	const sections = new Set<string>();
	let party = "";
	let office = "";
	let active = false;
	let judicial = false;
	for (const line of body.replace(/\f/gu, "\n").split("\n").map(clean)) {
		const heading = /^(REPUBLICAN|DEMOCRATIC|LIBERTARIAN|INDEPENDENT|JUDICIAL) CANDIDATES$/u.exec(line);
		if (heading) {
			if (sections.has(heading[1]!)) throw new Error("The Missouri candidate section repeats.");
			sections.add(heading[1]!);
			judicial = heading[1] === "JUDICIAL";
			party = judicial ? "" : heading[1]![0]! + heading[1]!.slice(1).toLowerCase();
			active = true;
			office = "";
			continue;
		}
		if (/^(?:CERTIFICATION|Certificate of Judicial Candidates|NOTICE OF ELECTION)$/u.test(line)) {
			active = false;
			continue;
		}
		if (!active) {
			if (/^For (?:State |U\.S\.|Circuit|Associate Circuit|the Missouri)|^District \d+,|^[A-Z ]+ CANDIDATES$/u.test(line)) throw new Error("An unrecognized Missouri candidate section would be omitted.");
			continue;
		}
		if (!line || /^\d+$|^Article V, Section 25\(c\)$|^(?:REPUBLICAN|DEMOCRATIC|LIBERTARIAN) PARTY EMBLEM$/u.test(line)) continue;
		if (line.startsWith("For ")) {
			office = line.replace(/^For (?:the )?/u, "");
			if (!/^(?:State Auditor|U\.S\. Representative|State Senator|State Representative|Circuit Judge|Associate Circuit Judge|Missouri Supreme Court|Missouri Court of Appeals|Governor|Lieutenant Governor|Secretary of State|State Treasurer|Attorney General|U\.S\. Senator)$/u.test(office)) throw new Error("The Missouri office heading requires review.");
			continue;
		}
		if (!office) throw new Error("The Missouri candidate has no office.");
		const numbered = /^District (\d+), (.+)$/u.exec(line);
		const circuit = /^Circuit (\d+),? (?:Division (\d+), )?(.+)$/u.exec(line);
		const appeal = /^(Eastern|Western|Southern) District, (.+)$/u.exec(line);
		const district = numbered?.[1] ?? circuit?.[1] ?? appeal?.[1] ?? "";
		const name = numbered?.[2] ?? circuit?.[3] ?? appeal?.[2] ?? line;
		const jurisdiction = circuit ? `Circuit ${district}${circuit[2] ? `, Division ${circuit[2]}` : ""}` : appeal ? `${district} District` : undefined;
		const scope: StateContestScope = numbered ? office === "U.S. Representative" ? "congressional" : office === "State Senator" ? "state-senate" : office === "State Representative" ? "state-house" : "local" : circuit || appeal ? "local" : "statewide";
		if ((!numbered && !circuit && !appeal && !["State Auditor", "Missouri Supreme Court", "Governor", "Lieutenant Governor", "Secretary of State", "State Treasurer", "Attorney General", "U.S. Senator"].includes(office)) || (numbered && !["U.S. Representative", "State Senator", "State Representative"].includes(office)) || (circuit && !["Circuit Judge", "Associate Circuit Judge"].includes(office)) || (appeal && office !== "Missouri Court of Appeals") || (judicial && numbered) || (!judicial && appeal)) throw new Error("The Missouri office/geography context requires review.");
		const title = judicial ? `Retention of ${name}, ${office}${jurisdiction ? `, ${jurisdiction}` : ""}` : `${office}${jurisdiction ? `, ${jurisdiction}` : ""}`;
		records.push(candidate({ name, office: title, ...(party ? { party } : {}), district, scope, ...(jurisdiction ? { jurisdiction } : {}), status: "listed", sourceStatus: judicial ? "Certified judicial retention candidate" : "Certified general-election nominee" }, source));
	}
	if (!["REPUBLICAN", "DEMOCRATIC", "LIBERTARIAN", "JUDICIAL"].every(section => sections.has(section)) || !records.length) throw new Error("The Missouri certification has an incomplete section set.");
	return records;
}
function jerseyPdfDate(body: string) {
	const visible = clean(stateHtmlText(parseStateHtml(body)));
	const dates = [...visible.matchAll(/For GENERAL ELECTION (\d{2})\/(\d{2})\/(20\d{2}) Election, \* denotes incumbent/gu)].map(match => dateValue(match[1]!, match[2]!, match[3]!));
	if (!dates.length || new Set(dates).size !== 1) throw new Error("The New Jersey PDF does not identify one general election.");
	return dates[0]!;
}
interface JerseyWord { value: string; xmin: number; xmax: number; ymin: number; ymax: number }
function jerseyRows(body: string) {
	const pages = descendants(parseStateHtml(body), node => node.nodeName === "page");
	if (!pages.length || pages.length > stateBallotPdfCollectorContract.maximumPages) throw new Error("The New Jersey positional PDF evidence has an unsupported page count.");
	return pages.map((page) => {
		const width = Number(attribute(page, "width"));
		const height = Number(attribute(page, "height"));
		if (![width, height].every(value => Number.isFinite(value) && value >= 200 && value <= 2000)) throw new Error("The New Jersey PDF page dimensions are invalid.");
		const words = descendants(page, node => node.nodeName === "word").map((node): JerseyWord => {
			const positions = ["xmin", "xmax", "ymin", "ymax"].map(key => Number(attribute(node, key)));
			if (["xmin", "xmax", "ymin", "ymax"].some(key => !attribute(node, key)) || positions.some(value => !Number.isFinite(value) || value < 0) || positions[0]! >= positions[1]! || positions[2]! >= positions[3]! || positions[1]! > width || positions[3]! > height) throw new Error("The New Jersey PDF word coordinates are invalid.");
			return { value: text(node), xmin: positions[0]!, xmax: positions[1]!, ymin: positions[2]!, ymax: positions[3]! };
		}).sort((first, second) => first.ymin - second.ymin || first.xmin - second.xmin);
		const rows: { y: number; words: JerseyWord[]; value: string }[] = [];
		for (const word of words) {
			const previous = rows.at(-1);
			if (previous && Math.abs(previous.y - word.ymin) < 1.8) previous.words.push(word);
			else rows.push({ y: word.ymin, words: [word], value: "" });
		}
		for (const row of rows) {
			row.words.sort((first, second) => first.xmin - second.xmin);
			row.value = clean(row.words.map(word => word.value).join(" "));
		}
		return rows;
	}).filter(rows => rows.length);
}
function jerseyRecords(source: StateBallotSource, descriptor: PdfDocument, body: string) {
	if (jerseyPdfDate(body) !== source.electionDate) throw new Error("The New Jersey PDF identifies a different election.");
	const pages = jerseyRows(body);
	const records: StateCandidateRecord[] = [];
	const ordinals = ["First", "Second", "Third", "Fourth", "Fifth", "Sixth", "Seventh", "Eighth", "Ninth", "Tenth", "Eleventh", "Twelfth"];
	let district = "";
	let issueDate = "";
	let total: number | undefined;
	const partyTotals = new Map<string, number>();
	for (const [position, rows] of pages.entries()) {
		const visible = rows.map(row => row.value).join(" ");
		const header = /^(\d{2})\/(\d{2})\/(20\d{2}) Official List Page (\d+) of (\d+)$/u.exec(rows[0]!.value);
		if (!header || Number(header[4]) !== position + 1 || Number(header[5]) !== pages.length || !visible.includes(descriptor.kind === "senate" ? "Candidates for US Senate" : "Candidates for House of Representatives")) throw new Error("The New Jersey PDF pagination or office header changed.");
		const printedIssue = dateValue(header[1]!, header[2]!, header[3]!);
		if ((issueDate && printedIssue !== issueDate) || printedIssue > source.electionDate) throw new Error("The New Jersey PDF revision date is inconsistent.");
		issueDate = printedIssue;
		const summary = rows.findIndex(row => row.value === "Candidate Totals for Party");
		if (summary >= 0) {
			if (position !== pages.length - 1) throw new Error("The New Jersey candidate summary is misplaced.");
			for (const row of rows.slice(summary + 1)) {
				const count = row.words.at(-1)!.value;
				const label = row.words.slice(0, -1).map(word => word.value).join(" ");
				if (!label || !/^\d+$/u.test(count)) throw new Error("The New Jersey published totals changed layout.");
				if (label === "Total Candidates") {
					if (total !== undefined) throw new Error("The New Jersey total candidate count repeats.");
					total = Number(count);
				}
				else if (partyTotals.has(label)) {
					throw new Error("The New Jersey party summary repeats.");
				}
				else {
					partyTotals.set(label, Number(count));
				}
			}
			continue;
		}
		const start = rows.findIndex(row => row.value === "Name Address Party County Slogan");
		if (start < 0) throw new Error("The New Jersey candidate columns changed.");
		const heading = rows[start]!;
		const nameStart = heading.words.find(word => word.value === "Name")!.xmin;
		const addressStart = heading.words.find(word => word.value === "Address")!.xmin;
		const partyStart = heading.words.find(word => word.value === "Party")!.xmin;
		const countyStart = heading.words.find(word => word.value === "County")!.xmin;
		if (!(nameStart < addressStart && addressStart < partyStart && partyStart < countyStart)) throw new Error("The New Jersey PDF column order changed.");
		let geographicContinuation = false;
		for (const row of rows.slice(start + 1)) {
			const districtHeading = /^(\w+) Congressional District:/u.exec(row.value);
			if (districtHeading) {
				const index = ordinals.indexOf(districtHeading[1]!);
				if (index < 0 || descriptor.kind === "senate") throw new Error("The New Jersey district heading is unsupported.");
				district = String(index + 1);
				geographicContinuation = !/\b(?:County|Counties)$/u.test(row.value);
				continue;
			}
			if (geographicContinuation) {
				if (!/^[A-Z ()a-z-]+ (?:County|Counties)$/u.test(row.value)) throw new Error("The New Jersey district continuation changed.");
				geographicContinuation = false;
				continue;
			}
			const name = clean(row.words.filter(word => word.xmin >= nameStart - 1 && word.xmin < addressStart - 1).map(word => word.value).join(" ")).replace(/\s*\*$/u, "");
			if (!name) continue;
			const party = clean(row.words.filter(word => word.xmin >= partyStart - 1).map(word => word.value).join(" "));
			if (!party || party.length > 300 || containsControlCharacters(party) || (descriptor.kind !== "senate" && !district)) throw new Error("The New Jersey candidate row is incomplete or ambiguous.");
			records.push(candidate({ name, party, office: descriptor.kind === "senate" ? "U.S. Senate" : "U.S. Representative", district: descriptor.kind === "senate" ? "" : district, scope: descriptor.kind === "senate" ? "statewide" : "congressional", status: "listed", sourceStatus: "Official general-election candidate list" }, source));
		}
		if (geographicContinuation) throw new Error("The New Jersey district heading was truncated.");
	}
	const actualParties = new Map<string, number>();
	for (const record of records) actualParties.set(record.party!, (actualParties.get(record.party!) ?? 0) + 1);
	if (!records.length || records.length > 25000 || total !== records.length || [...partyTotals.values()].reduce((sum, count) => sum + count, 0) !== total || [...actualParties].some(([party, count]) => partyTotals.get(party) !== count) || (descriptor.kind === "house-amendment" && records.some(record => record.district !== descriptor.district))) throw new Error("The New Jersey candidate list does not reconcile with its published totals or amendment district.");
	return { records, issueDate };
}
export function parseCertifiedPdfCapture(source: StateBallotSource, body: string) {
	validateCertifiedPdfSource(source);
	const capture = readCapture(body);
	if (capture.stateCode !== source.stateCode) throw new Error("The certified PDF evidence belongs to another state.");
	const election = readCertifiedPdfElectionDiscovery(body).find(item => item.electionDate === source.electionDate);
	if (!election || election.pdfDocuments.map(item => item.url).join("|") !== source.documentUrls!.join("|")) throw new Error("The certified PDF publication set changed and requires review.");
	const chosen = election.pdfDocuments.map(descriptor => ({ descriptor, document: capture.documents.find(item => item.url === descriptor.url)! }));
	let records: StateCandidateRecord[];
	let counts: number[];
	if (source.stateCode === "MO") {
		records = missouriRecords(source, chosen[0]!.document.text);
		counts = [records.length];
	}
	else {
		const parsed = chosen.map(item => jerseyRecords(source, item.descriptor, item.document.text));
		const replacements = new Map<string, number>();
		const house = chosen.findIndex(item => item.descriptor.kind === "house");
		for (const [position, item] of chosen.entries()) {
			if (item.descriptor.kind === "house-amendment") {
				const district = item.descriptor.district!;
				const previous = replacements.get(district);
				if (parsed[position]!.issueDate < parsed[house]!.issueDate) continue;
				if (previous !== undefined && parsed[position]!.issueDate === parsed[previous]!.issueDate) throw new Error("The New Jersey amendment order is ambiguous.");
				if (previous === undefined || parsed[position]!.issueDate > parsed[previous]!.issueDate) replacements.set(district, position);
			}
		}
		const selected = parsed.map((item, position) => item.records.filter(record => chosen[position]!.descriptor.kind === "senate" || (chosen[position]!.descriptor.kind === "house" ? !replacements.has(record.district) : replacements.get(record.district) === position)));
		records = selected.flat();
		counts = selected.map(items => items.length);
	}
	if (!records.length || records.length > 25000 || new Set(records.map(item => item.id)).size !== records.length) throw new Error("The certified PDF candidate identities conflict or exceed their bounds.");
	const documents = chosen.map(({ document }, position) => ({ url: document.url, sha256: document.sha256, retrievedAt: document.retrievedAt, includedRecordCount: counts[position]! }));
	return { records, documents, retrievedAt: new Date(Math.min(...documents.map(item => Date.parse(item.retrievedAt)))).toISOString(), sha256: hash(JSON.stringify(documents.map(({ url, sha256 }) => ({ url, sha256 })))) };
}
export async function fetchCertifiedPdfCapture(source: StateBallotSource, discovery?: string, options: Parameters<typeof fetchCertifiedPdfCycleDiscovery>[1] = {}) {
	validateCertifiedPdfSource(source);
	const body = discovery ?? await fetchCertifiedPdfCycleDiscovery(source.stateCode as SupportedState, options);
	parseCertifiedPdfCapture(source, body);
	return body;
}
