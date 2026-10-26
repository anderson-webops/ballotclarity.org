import type { StateCandidateValues } from "./state-ballot-additional-records.js";
import type { StateHtmlNode } from "./state-ballot-html.js";
import type { StateCandidateRecord } from "./state-ballot-records.js";
import type { StateBallotSource } from "./state-ballot-sources.js";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { electionDocumentPolicyFingerprint, electionDocumentRobotsPolicy } from "./election-document-collection.js";
import { fetchRemoteSourceText } from "./remote-json-source.js";
import { stateHtmlAttribute as attribute, stateHtmlDescendants as descendants, parseStateHtml, stateHtmlText } from "./state-ballot-html.js";
import { StateBallotAwaitingRecordsError } from "./state-ballot-source-state.js";

export const iowaJohnsonDiscoveryUrl = "https://johnsoncountyiowa.gov/auditor/elections";
const origin = "https://johnsoncountyiowa.gov";
const hash = (body: string) => createHash("sha256").update(body).digest("hex");
const clean = (value: string) => value.normalize("NFKC").replace(/\s+/gu, " ").trim();
const text = (node: StateHtmlNode) => clean(stateHtmlText(node));
const exact = (value: unknown, keys: string[]): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).sort().join(",") === [...keys].sort().join(","));
type Factory = (source: StateBallotSource, values: StateCandidateValues) => StateCandidateRecord | null;
type TextRequest = (url: string, options: { allowedHosts: string[]; maxBytes: number; maxRedirects: number; timeoutMs: number }) => Promise<string>;
interface Page { url: string; body: string; sha256: string; retrievedAt: string }
export interface IowaJohnsonElection { electionId: null; electionDate: string; pageUrl: string }
const policies = [
	{ id: "robots", url: `${origin}/robots.txt`, format: "robots", sha256: "fbb9e50dc760db7ccf06a498c56f78f170ae0e5cf51d576c0dd2b54831714ede" },
	{ id: "home", url: `${origin}/`, format: "links", sha256: "35d5a264819a7fec5cf5623ccc59aa7be582d578ad03bfff98809fc9bb59d39d" },
] as const;
export const iowaJohnsonPolicyReceipts = policies.map(({ id, url, sha256 }) => ({ id, url, sha256 }));
const serviceLinks = new Set([
	JSON.stringify(["Renew my driver's license", "https://iowadot.gov/drivers-licenses-ids/get-or-renew-drivers-licenses-ids-permits"]),
	JSON.stringify(["Fill out a Driver's License Reinstatement Pay Plans (CAPPs)", `${origin}/county-attorney/capps`]),
	JSON.stringify(["How do I get license plates?", `${origin}/department-of-motor-vehicle`]),
	JSON.stringify(["How do I apply for a marriage license?", `${origin}/recorder/marriage-license`]),
	JSON.stringify(["Alcohol-Tobacco Licenses", `${origin}/auditor/alcohol-tobacco-licensing`]),
]);
export function iowaJohnsonPolicyFingerprint(body: string, url: string) {
	electionDocumentPolicyFingerprint(Buffer.from(body), "links", url);
	const document = parseStateHtml(body);
	const footers = descendants(document, node => node.nodeName === "footer");
	if (footers.length !== 1) throw new Error("The Johnson County legal footer requires review.");
	const legalLinks = descendants(document, node => node.nodeName === "a" && /privacy|disclaimer|copyright|licen[cs]e|terms|polic(?:y|ies)/iu.test(`${text(node)} ${attribute(node, "href")}`)).map(node => [text(node), new URL(attribute(node, "href"), url).href]).filter(pair => !serviceLinks.has(JSON.stringify(pair)));
	return hash(JSON.stringify({ footer: text(footers[0]!), footerLinks: descendants(footers[0]!, node => node.nodeName === "a").map(node => new URL(attribute(node, "href"), url).href), legalLinks: [...new Set(legalLinks.map(pair => pair[1]))].sort() }));
}
const groups = ["Federal Offices", "Statewide Offices", "State Legislative Offices", "County Partisan Offices", "Township offices", "Countywide Nonpartisan Offices", "Judicial Retention (Yes or No for judges to remain in office)", "Ballot Issues"];
const terms: Record<string, number> = { two: 2, four: 4, six: 6 };
const statewide: Record<string, string> = { "Governor and Lieutenant Governor": "Governor and Lieutenant Governor", "President and Vice President": "President and Vice President", "Secretary of State": "Secretary of State", "Auditor of State": "State Auditor", "Treasurer of State": "State Treasurer", "Secretary of Agriculture": "Secretary of Agriculture", "Attorney General": "Attorney General" };

export function validateIowaJohnsonElection(value: unknown): asserts value is IowaJohnsonElection {
	if (!exact(value, ["electionId", "electionDate", "pageUrl"]) || value.electionId !== null || typeof value.electionDate !== "string" || !/^20\d{2}-11-0[2-8]$/u.test(value.electionDate) || value.electionDate < "2026-11-03" || Number(value.electionDate.slice(0, 4)) % 2 || new Date(value.electionDate).getUTCDay() !== 2 || value.pageUrl !== `${origin}/november-${Number(value.electionDate.slice(-2))}-${value.electionDate.slice(0, 4)}-general-election`) throw new Error("The Johnson County election identity requires review.");
}
export function validateIowaJohnsonSource(source: StateBallotSource) {
	validateIowaJohnsonElection({ electionId: null, electionDate: source.electionDate, pageUrl: source.pageUrl });
	if (source.stateCode !== "IA" || source.format !== "iowa-johnson-html" || source.countyName !== "Johnson County" || source.retrievalPolicy || source.postBody || source.delimiter || source.url !== source.pageUrl || source.snapshotStorage !== "external" || JSON.stringify(source.documentUrls) !== JSON.stringify([source.pageUrl]) || source.documentLinks || source.id !== (source.electionDate === "2026-11-03" ? "ia-johnson-2026" : `ia-johnson-general-${source.electionDate}`)) throw new Error("The Johnson County candidate source is invalid.");
}
function documentMain(body: string, url: string) {
	if (Buffer.byteLength(body) > 2 * 1024 * 1024 || iowaJohnsonPolicyFingerprint(body, url) !== policies[1].sha256) throw new Error("The Johnson County page or legal-link inventory requires review.");
	const document = parseStateHtml(body);
	const pending = [{ node: document, depth: 0 }];
	let visited = 0;
	while (pending.length) {
		const { node, depth } = pending.pop()!;
		if (++visited > 80000 || depth > 64) throw new Error("The Johnson County publication structure exceeds its bounds.");
		for (const child of node.childNodes ?? []) pending.push({ node: child, depth: depth + 1 });
	}
	const mains = descendants(document, node => node.nodeName === "main");
	if (mains.length !== 1) throw new Error("The Johnson County publication has no unique main region.");
	return mains[0]!;
}
function pageElection(body: string, url: string) {
	const region = documentMain(body, url);
	const headings = descendants(parseStateHtml(body), node => node.nodeName === "h1");
	const match = headings.length === 1 ? /^November ([2-8]), (20\d{2}) General Election$/u.exec(text(headings[0]!)) : null;
	if (!match) throw new Error("The Johnson County printed election date requires review.");
	const election = { electionId: null, electionDate: `${match[2]}-11-0${match[1]}`, pageUrl: url };
	validateIowaJohnsonElection(election);
	return { election, region };
}
function offeredElections(body: string) {
	const region = documentMain(body, iowaJohnsonDiscoveryUrl);
	if (descendants(parseStateHtml(body), node => node.nodeName === "h1" && text(node) === "Elections - Voter Registration").length !== 1) throw new Error("The Johnson County election index requires review.");
	const offered = new Map<string, IowaJohnsonElection>();
	for (const link of descendants(region, node => node.nodeName === "a")) {
		const match = /^November ([2-8]), (20\d{2}) General Election$/u.exec(text(link));
		if (!match) continue;
		const electionDate = `${match[2]}-11-0${match[1]}`;
		if (electionDate < "2026-11-03") continue;
		const election = { electionId: null, electionDate, pageUrl: new URL(attribute(link, "href"), iowaJohnsonDiscoveryUrl).href };
		validateIowaJohnsonElection(election);
		if (offered.has(electionDate) && offered.get(electionDate)!.pageUrl !== election.pageUrl) throw new Error("The Johnson County election links conflict.");
		offered.set(electionDate, election);
	}
	if (!offered.size || offered.size > 6) throw new Error("The Johnson County offered election set requires review.");
	return [...offered.values()].sort((first, second) => first.electionDate.localeCompare(second.electionDate));
}
export function readIowaJohnsonDiscovery(body: string, now = Date.now()) {
	if (Buffer.byteLength(body) > 16 * 1024 * 1024) throw new Error("The Johnson County capture exceeds its bounds.");
	const value = JSON.parse(body);
	if (!exact(value, ["schemaVersion", "type", "policies", "index", "pages"]) || value.schemaVersion !== 1 || value.type !== "iowa-johnson-candidate-capture" || JSON.stringify(value.policies) !== JSON.stringify(iowaJohnsonPolicyReceipts) || !Array.isArray(value.pages) || !value.pages.length || value.pages.length > 6) throw new Error("The Johnson County capture contract requires review.");
	const pages = [value.index, ...value.pages];
	for (const page of pages) {
		if (!exact(page, ["url", "body", "sha256", "retrievedAt"]) || typeof page.url !== "string" || typeof page.body !== "string" || page.sha256 !== hash(page.body) || typeof page.retrievedAt !== "string" || !Number.isFinite(Date.parse(page.retrievedAt)) || new Date(page.retrievedAt).toISOString() !== page.retrievedAt || Date.parse(page.retrievedAt) > now) throw new Error("The Johnson County capture provenance requires review.");
	}
	const indexPage = value.index as Page;
	const publicationPages = value.pages as Page[];
	if (indexPage.url !== iowaJohnsonDiscoveryUrl) throw new Error("The Johnson County index identity is invalid.");
	const elections = offeredElections(indexPage.body);
	if (elections.length !== publicationPages.length || elections.some((election, index) => publicationPages[index]?.url !== election.pageUrl || pageElection(publicationPages[index]!.body, election.pageUrl).election.electionDate !== election.electionDate)) throw new Error("The Johnson County publication set is incomplete or mismatched.");
	return { elections, pages: publicationPages, index: indexPage };
}
function lines(node: StateHtmlNode): string[] {
	const value = (item: StateHtmlNode): string => item.nodeName === "br" ? "\n" : item.nodeName === "script" || item.nodeName === "style" ? "" : item.value?.replace(/\s+/gu, " ") ?? (item.childNodes ?? []).map(child => value(child) + (["p", "div", "li"].includes(child.nodeName) ? "\n" : "")).join("");
	return value(node).split("\n").map(clean).filter(Boolean);
}
function name(value: string) {
	if (value.length < 4 || value.length > 160 || !value.includes(" ") || /\b(?:Box|Suite|Apt|Unit|Bldg|Road|Street|protected)\b/iu.test(value) || !Array.from(value).every(character => /^[\p{L} .,'-]$/u.test(character) || /^\p{M}$/u.test(character))) throw new Error("A Johnson County candidate name requires review.");
	return value;
}
export function readIowaJohnsonCandidatePage(source: StateBallotSource, body: string, factory: Factory) {
	validateIowaJohnsonSource(source);
	const { election, region } = pageElection(body, source.pageUrl);
	if (election.electionDate !== source.electionDate) throw new Error("The Johnson County roster belongs to another election.");
	const lists = descendants(region, node => node.nodeName === "dl" && (node.childNodes ?? []).some(child => child.nodeName === "dt" && text(child) === groups[0]));
	if (!lists.length && /Candidate information will be posted|Candidate filing has not opened/u.test(text(region))) throw new StateBallotAwaitingRecordsError(source.id);
	if (lists.length !== 1) throw new Error("The Johnson County candidate sections require review.");
	const list = lists[0]!;
	if ([list, ...descendants(list, () => true)].some(node => ["form", "input", "button", "select", "script", "iframe", "table"].includes(node.nodeName) || node.attrs?.some(item => item.name === "hidden") || attribute(node, "aria-hidden") === "true" || /display\s*:\s*none|visibility\s*:\s*hidden/iu.test(attribute(node, "style")))) throw new Error("The Johnson County candidate content contains unreviewed controls or hidden rows.");
	const nodes = (list.childNodes ?? []).filter(node => node.nodeName !== "#text" || text(node));
	if (nodes.length !== groups.length * 2 || nodes.some((node, index) => node.nodeName !== (index % 2 ? "dd" : "dt") || (!(index % 2) && text(node) !== groups[index / 2]))) throw new Error("The Johnson County candidate section order changed.");
	const records: StateCandidateRecord[] = [];
	const emptyOffices: { office: string; jurisdiction: string; seats: number }[] = [];
	const excludedOffices: string[] = [];
	const questions: { id: string; title: string; text: string }[] = [];
	let context: Omit<StateCandidateValues, "name" | "party"> | null = null;
	let voteLimit: number | undefined;
	const add = (raw: string, party = "") => {
		if (!context) throw new Error("A Johnson County candidate has no printed office.");
		let candidate = name(raw);
		if (["Governor and Lieutenant Governor", "President and Vice President"].includes(context.office)) {
			const members = raw.split(" and ");
			if (members.length !== 2) throw new Error("The Johnson County running-mate ticket requires review.");
			candidate = members.map(name).join(" / ");
		}
		const record = factory(source, { ...context, name: candidate, party, status: "listed" });
		if (!record) throw new Error("The Johnson County candidate could not be normalized.");
		if (context.office.includes(" retention - ")) record.sourceStatus = "Judicial retention election";
		else delete record.sourceStatus;
		if (voteLimit) record.voteLimit = voteLimit;
		records.push(record);
	};
	for (let groupIndex = 0; groupIndex < groups.length; groupIndex++) {
		const section = nodes[groupIndex * 2 + 1]!;
		const content = lines(section);
		if (content.some(line => line.length > (groupIndex === 7 ? 24000 : 1000))) throw new Error("A Johnson County published row exceeds its reviewed bounds.");
		context = null;
		voteLimit = undefined;
		if (groupIndex === 7) {
			for (const line of content) {
				if (line === "Additional issues may be added.") continue;
				const heading = /^Public Measure ([A-Z\d]+): /u.exec(line);
				if (heading) {
					questions.push({ id: heading[1]!, title: line, text: "" });
				}
				else {
					const question = questions.at(-1);
					if (!question) throw new Error("The Johnson County measure text has no title.");
					question.text += (question.text ? "\n" : "") + line;
				}
			}
			if (questions.some(question => !question.text || question.text.length > 24000) || questions.length > 100 || new Set(questions.map(question => question.id)).size !== questions.length) throw new Error("The Johnson County measure references require review.");
			continue;
		}
		if (groupIndex === 4) {
			const ordinary = /^All rural townships will elect (a clerk and )?(one|two|three) trustees? to (two|four) year terms\.$/u.exec(content[0] ?? "");
			const exceptions = /^([A-Za-z]+(?: [A-Za-z]+)*) and ([A-Za-z]+(?: [A-Za-z]+)*) townships will elect (two|three) trustees to (two|four) year terms\.$/u.exec(content[1] ?? "");
			if (!ordinary || !exceptions || content[2] !== "Some townships may elect additional trustees to two year terms to fill vacancies.") throw new Error("The Johnson County township term and seat rules require review.");
			const counts: Record<string, number> = { one: 1, two: 2, three: 3 };
			for (const line of content.slice(3)) {
				const match = /^([A-Za-z]+(?: [A-Za-z]+)*) (Trustee|Clerk)( to fill vacancy)?(?: \((two|three) seats\))?:(.*)$/u.exec(line);
				if (!match) throw new Error("The Johnson County township candidate row requires review.");
				const seats = match[4] ? match[4] === "two" ? 2 : 3 : 1;
				const exception = [exceptions[1], exceptions[2]].includes(match[1]);
				if (!match[3] && match[2] === "Trustee" && seats !== counts[exception ? exceptions[3]! : ordinary[2]!]) throw new Error("The Johnson County township seats contradict the published rule.");
				if (match[2] === "Clerk" && !ordinary[1] && !match[3]) throw new Error("The Johnson County clerk election contradicts the published rule.");
				context = { office: `Township ${match[2]}${match[3] ? ", to fill vacancy" : ""}`, scope: "local", jurisdiction: `${match[1]} Township, Johnson County`, termYears: match[3] ? 2 : terms[exception && match[2] === "Trustee" ? exceptions[4]! : ordinary[3]!]!, seats };
				voteLimit = seats;
				const choices = clean(match[5]!);
				if (!choices) {
					emptyOffices.push({ office: context.office, jurisdiction: context.jurisdiction!, seats });
				}
				else {
					for (const candidate of choices.split(", ")) add(candidate);
				}
			}
			continue;
		}
		let legislative = "";
		let countyBoard = false;
		let lastCandidate = false;
		for (const line of content) {
			let match: RegExpExecArray | null;
			match = /^(.+), (Democratic Party|Republican Party|Libertarian Party|Green Party|No Party)$/u.exec(line);
			if (groupIndex < 4 && match) {
				add(match[1]!, match[2] === "No Party" ? match[2] : match[2]!.replace(/ Party$/u, ""));
				lastCandidate = true;
				continue;
			}
			match = /^U\.S\. (Senator|Representative, ([1-9]\d?)(?:st|nd|rd|th) District) \((two|six) year term\)$/u.exec(line);
			if (groupIndex === 0 && match) {
				context = { office: match[1] === "Senator" ? "United States Senator" : `United States Representative, District ${match[2]}`, scope: match[1] === "Senator" ? "statewide" : "congressional", ...(match[2] ? { district: match[2], sourceDistrictLabel: `District ${match[2]}` } : {}), termYears: terms[match[3]!]! };
				lastCandidate = false;
				continue;
			}
			if ((groupIndex === 0 || groupIndex === 1) && statewide[line]) {
				if (line === "President and Vice President" && Number(source.electionDate.slice(0, 4)) % 4) throw new Error("The presidential office contradicts the printed regular election date.");
				context = { office: statewide[line]!, scope: "statewide", termYears: 4 };
				lastCandidate = false;
				continue;
			}
			if (groupIndex === 1 && line === "All terms four years.") continue;
			if (groupIndex === 2) {
				if (["State Senators", "State Representatives"].includes(line)) {
					legislative = line;
					context = null;
					lastCandidate = false;
					continue;
				}
				if (["(All terms four years)", "(All terms two years)"].includes(line)) {
					if (line !== (legislative === "State Senators" ? "(All terms four years)" : "(All terms two years)")) throw new Error("The Johnson County legislative term contradicts its office.");
					continue;
				}
				match = /^District ([1-9]\d{0,2}) map$/u.exec(line);
				if (match && legislative) {
					context = { office: `State ${legislative === "State Senators" ? "Senator" : "Representative"}, District ${match[1]}`, scope: legislative === "State Senators" ? "state-senate" : "state-house", district: match[1], sourceDistrictLabel: `District ${match[1]}`, termYears: legislative === "State Senators" ? 4 : 2 };
					lastCandidate = false;
					continue;
				}
				if (/^\(Note: District [1-9]\d{0,2} senator elected to four year term in 20\d{2}; not on ballot\.\)$/u.test(line)) {
					excludedOffices.push(line);
					context = null;
					lastCandidate = false;
					continue;
				}
			}
			if (groupIndex === 3) {
				if (line === "Board of Supervisors") {
					countyBoard = true;
					context = null;
					lastCandidate = false;
					continue;
				}
				if (line === "More Information on Supervisor Districts") continue;
				match = /^(District ([1-9]\d?)|County Treasurer|County Recorder|County Attorney) \((two|four) year term\)$/u.exec(line);
				if (match && (!match[2] || countyBoard)) {
					context = { office: match[2] ? `Board of Supervisors, District ${match[2]}` : match[1]!, scope: "local", jurisdiction: "Johnson County", ...(match[2] ? { district: match[2] } : {}), termYears: terms[match[3]!]! };
					countyBoard = Boolean(match[2]);
					lastCandidate = false;
					continue;
				}
			}
			if (groupIndex === 5) {
				if (/^Candidates for the Agricultural Extension Council and the Soil and Water Commission may file with our office until 5 p\.m\. on (?:July|August) (?:[1-9]|[12]\d|3[01])\. All terms are four years$/u.test(line)) continue;
				match = /^(Agricultural Extension Council|Soil and Water Commission) \((two|five) to be elected\)$/u.exec(line);
				if (match) {
					voteLimit = match[2] === "two" ? 2 : 5;
					context = { office: match[1]!, scope: "local", jurisdiction: "Johnson County", termYears: 4, seats: voteLimit };
					lastCandidate = false;
					continue;
				}
			}
			if (groupIndex === 6) {
				if (/^Judges standing for retention needed to file a declaration of candidacy with the Secretary of State by (?:June|July|August) (?:[1-9]|[12]\d|3[01])\.$/u.test(line)) continue;
				if (["Supreme Court", "Court of Appeals", "District Judge", "District Associate Judge"].includes(line)) {
					context = { office: line, scope: ["Supreme Court", "Court of Appeals"].includes(line) ? "statewide" : "local" };
					lastCandidate = false;
					continue;
				}
				if (context) {
					const office: string = context.office;
					context = { ...context, office: `${office} retention - ${name(line)}` };
					add(line);
					context = { ...context, office };
					continue;
				}
			}
			const contactLine = line.replace(/^Mail: /u, "");
			const contact = /^[A-Za-z .,'-]+ (?:[A-Z]{2}|Iowa) \d{5}(?:-\d{4})?$/u.test(contactLine) || /^(?:PO|P\.O\.) Box \d[A-Za-z\d -]*$/u.test(contactLine) || (/^\d+[A-Za-z]? [A-Za-z\d.,'#/-]+(?: [A-Za-z\d.,'#/-]+)*$/u.test(contactLine) && /\b(?:Street|St|Road|Rd|Avenue|Ave|Drive|Dr|Lane|Ln|Way|Court|Ct|Trail|Trl|Circle|Cir|Terrace|Ter|Highway|Hwy)\b/iu.test(contactLine)) || /^(?:\+?1[- .]?)?\(?\d{3}\)?[- .]\d{3}[- .]\d{4}$/u.test(contactLine) || /^\[email\s+protected\]$/u.test(contactLine);
			if (lastCandidate && contact) continue;
			if (groupIndex === 5 && context && !/\b(?:Council|Commission|Trustee|Clerk|Mayor|Board|Office|District)\b/u.test(line)) {
				add(line);
				lastCandidate = true;
				continue;
			}
			throw new Error(`The Johnson County ${groups[groupIndex]} office, party or contact boundary at line ${content.indexOf(line) + 1} requires review.`);
		}
	}
	if (!records.length || records.length > 2500 || new Set(records.map(record => record.id)).size !== records.length || emptyOffices.length > 200) throw new Error("The Johnson County candidate set is empty, duplicated or outside its bounds.");
	return { records, emptyOffices, excludedOffices, questions };
}
export function parseIowaJohnsonCandidateCapture(source: StateBallotSource, body: string, factory: Factory, now = Date.now()) {
	validateIowaJohnsonSource(source);
	const discovery = readIowaJohnsonDiscovery(body, now);
	const page = discovery.pages.find(page => page.url === source.pageUrl);
	if (!page) throw new Error("The Johnson County capture does not offer the selected election.");
	const { records } = readIowaJohnsonCandidatePage(source, page.body, factory);
	return { records, sha256: page.sha256, retrievedAt: page.retrievedAt, collectionIndexSha256: page.sha256, documents: [{ url: page.url, sha256: page.sha256, retrievedAt: page.retrievedAt, includedRecordCount: records.length }] };
}
export async function fetchIowaJohnsonCycleDiscovery(options: { requestText?: TextRequest; wait?: (milliseconds: number) => Promise<void>; now?: () => number } = {}) {
	const request = options.requestText ?? fetchRemoteSourceText;
	const wait = options.wait ?? (milliseconds => new Promise(accept => setTimeout(accept, milliseconds)));
	const now = options.now ?? Date.now;
	const transport = { allowedHosts: ["johnsoncountyiowa.gov"], maxBytes: 2 * 1024 * 1024, maxRedirects: 0, timeoutMs: 25000 };
	let robots: ReturnType<typeof electionDocumentRobotsPolicy> | undefined;
	const get = async (url: string) => {
		if (robots) {
			if (!robots.allowed(url)) throw new Error("The county robots policy excludes this publication.");
			await wait(robots.delay);
		}
		const body = await request(url, transport);
		return { url, body, sha256: hash(body), retrievedAt: new Date(now()).toISOString() };
	};
	for (const policy of policies) {
		const page = await get(policy.url);
		if ((policy.format === "robots" ? electionDocumentPolicyFingerprint(Buffer.from(page.body), policy.format, policy.url) : iowaJohnsonPolicyFingerprint(page.body, policy.url)) !== policy.sha256) throw new Error("The Johnson County access or legal-link policy requires review.");
		if (policy.format === "robots") robots = electionDocumentRobotsPolicy(Buffer.from(page.body));
	}
	const index = await get(iowaJohnsonDiscoveryUrl);
	const pages: Page[] = [];
	for (const election of offeredElections(index.body)) pages.push(await get(election.pageUrl));
	const capture = JSON.stringify({ schemaVersion: 1, type: "iowa-johnson-candidate-capture", policies: iowaJohnsonPolicyReceipts, index, pages });
	readIowaJohnsonDiscovery(capture, now());
	return capture;
}
export async function fetchIowaJohnsonCandidateCapture(source: StateBallotSource, options: Parameters<typeof fetchIowaJohnsonCycleDiscovery>[0] & { discovery?: string } = {}) {
	validateIowaJohnsonSource(source);
	const capture = options.discovery ?? await fetchIowaJohnsonCycleDiscovery(options);
	if (!readIowaJohnsonDiscovery(capture, (options.now ?? Date.now)()).pages.some(page => page.url === source.pageUrl)) throw new Error("The county publication does not offer this candidate source.");
	return capture;
}
