import type { fetchRemoteSourceDocument } from "./remote-json-source.js";
import type { StateCandidateRecord, StateContestScope } from "./state-ballot-records.js";
import type { StateBallotSource } from "./state-ballot-sources.js";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { fetchRemoteSourceText } from "./remote-json-source.js";
import {
	stateHtmlAttribute as attribute,
	stateHtmlDescendants as descendants,
	parseStateHtml,
	stateHtmlText
} from "./state-ballot-html.js";
import {
	extractStateBallotPdfText,
	fetchStateBallotPdfDocument,
	resolveStateBallotPdfExtractor
} from "./state-ballot-pdf.js";
import { containsControlCharacters } from "./text-validation.js";

export const texasDiscoveryUrl = "https://www.sos.state.tx.us/elections/index.shtml";
const origin = "https://www.sos.state.tx.us";
export const texasPdfCollectorContract = Object.freeze({
	maximumPages: 2000,
	maximumCounties: 254,
	maximumElections: 6
});
export const texasPolicyReceipts = [
	{
		url: `${origin}/robots.txt`,
		region: "bytes",
		sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
	},
	{
		url: `${origin}/policies.shtml`,
		region: "content",
		sha256: "40ad1c229c48d8b2bbaf540970f958bd8ea764682963b4602f3df18e2d2b7ee8"
	},
	{
		url: `${origin}/privacy.shtml`,
		region: "content",
		sha256: "f5c2a511cacc009cc41402d2a29efba5dab8a15671a461db27492b606c2f84ca"
	},
	{
		url: `${origin}/disclaimer.shtml`,
		region: "content",
		sha256: "3251d6fe1097fbdf444634f2b6b93c040f98416ed170aa33a4a9a8f06e55fb13"
	},
	{
		url: `${origin}/linkpolicy.shtml`,
		region: "content",
		sha256: "1f34b1596461ccf398b29843169047d3a9dd0116e8571ef6f057d9f17d9527f1"
	},
	{
		url: `${origin}/records.shtml`,
		region: "content",
		sha256: "1b3e24084b83f83731695cb9173b5b1130ba29440bf06467e17f5561a18fede7"
	}
] as const;
export interface TexasElection {
	electionId: null;
	electionDate: string;
	pageUrl: string;
	texasDocuments: { kind: "certification" | "write-ins"; url: string }[];
}
interface TexasDocument {
	url: string;
	text: string;
	sha256: string;
	retrievedAt: string;
}
interface TexasCapture {
	schemaVersion: 1;
	type: "texas-certification-discovery";
	policies: typeof texasPolicyReceipts;
	pages: { url: string; body: string }[];
	documents: TexasDocument[];
}
type TextRequest = (
	url: string,
	options: { allowedHosts: string[]; maxBytes: number; maxRedirects: number; timeoutMs: number }
) => Promise<string>;
interface Options {
	requestText?: TextRequest;
	requestDocument?: typeof fetchRemoteSourceDocument;
	extractor?: (bytes: Buffer) => Promise<string>;
	now?: () => number;
}
const clean = (value: string) => value.normalize("NFKC").replace(/\s+/gu, " ").trim();
const hash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
function exact(value: unknown, keys: string[]): value is Record<string, unknown> {
	return Boolean(
		value
		&& typeof value === "object"
		&& !Array.isArray(value)
		&& Object.keys(value).sort().join("|") === [...keys].sort().join("|")
	);
}
const text = (node: Parameters<typeof stateHtmlText>[0]) => clean(stateHtmlText(node));

function content(body: string) {
	if (Buffer.byteLength(body) > 2 * 1024 * 1024) throw new Error("The Texas election page exceeds its bounds.");
	const nodes = descendants(parseStateHtml(body), node => attribute(node, "id") === "content");
	if (nodes.length !== 1) throw new Error("The Texas election/policy content layout changed.");
	return nodes[0]!;
}
function policyLinks(body: string) {
	const links = [
		...new Set(
			descendants(
				parseStateHtml(body),
				node =>
					node.nodeName === "a"
					&& /website policies|privacy|terms of use|disclaimer|copyright policy/iu.test(text(node))
			).map(node => new URL(attribute(node, "href"), origin).href)
		)
	].sort();
	if (links.join("|") !== `${origin}/policies.shtml`)
		throw new Error("The Texas publisher policy-link inventory requires review.");
}
function generalDate(value: unknown): value is string {
	return (
		typeof value === "string"
		&& /^20\d{2}-11-0[2-8]$/u.test(value)
		&& value >= "2026-11-03"
		&& Number(value.slice(0, 4)) % 2 === 0
		&& Number.isFinite(Date.parse(value))
		&& new Date(`${value}T00:00:00Z`).getUTCDay() === 2
	);
}
function publicUrl(value: string, kind: "page" | "pdf", base = texasDiscoveryUrl) {
	const url = new URL(value, base);
	const path
		= kind === "pdf" ? /^\/elections\/forms\/[\w.-]{1,140}\.pdf$/u : /^\/elections\/laws\/[\w.-]{1,180}\.shtml$/u;
	if (
		url.href.length > 2048
		|| url.origin !== origin
		|| url.username
		|| url.password
		|| url.search
		|| url.hash
		|| !path.test(url.pathname)
		|| (kind === "page" && (!/^\/elections\/laws\/20\d{2}/u.test(url.pathname) || !url.pathname.includes("general")))
	) {
		throw new Error("The Texas certification link is outside its approved public publisher paths.");
	}
	return url.href;
}
function offeredPages(body: string) {
	policyLinks(body);
	const elections = new Map<string, { electionDate: string; pageUrl: string }>();
	for (const node of descendants(content(body), node => node.nodeName === "a")) {
		const match = /^(?:Nov\.?|November) ([1-9]\d?), (20\d{2}) General Election$/u.exec(text(node));
		if (!match || match[2]! < "2026") continue;
		const electionDate = `${match[2]}-11-${match[1]!.padStart(2, "0")}`;
		const pageUrl = publicUrl(attribute(node, "href"), "page");
		if (
			!generalDate(electionDate)
			|| !new URL(pageUrl).pathname.includes(match[2]!)
			|| (elections.has(electionDate) && elections.get(electionDate)!.pageUrl !== pageUrl)
		) {
			throw new Error("The offered Texas general election is ambiguous or unsupported.");
		}
		elections.set(electionDate, { electionDate, pageUrl });
	}
	if (!elections.size || elections.size > texasPdfCollectorContract.maximumElections)
		throw new Error("No bounded Texas general-election publications are offered.");
	return [...elections.values()].sort((first, second) => first.electionDate.localeCompare(second.electionDate));
}
function electionDocuments(body: string, electionDate: string, pageUrl: string): TexasElection {
	policyLinks(body);
	const year = electionDate.slice(0, 4);
	const day = Number(electionDate.slice(-2));
	const region = content(body);
	const headings = descendants(region, node => /^h[1-6]$/u.test(node.nodeName));
	const targets = headings.filter(
		node =>
			text(node) === `${year} November General Election – November ${day}, ${year}`
			|| text(node) === `${year} November General Election - November ${day}, ${year}`
	);
	if (targets.length !== 1)
		throw new Error("The Texas publication does not explicitly identify the selected general election.");
	const heading = targets[0]!;
	const parents = [region, ...descendants(region, node => Boolean(node.childNodes?.includes(heading)))].filter(node =>
		node.childNodes?.includes(heading)
	);
	const siblings = parents[0]?.childNodes ?? [];
	const links: Parameters<typeof text>[0][] = [];
	let selected = false;
	for (const node of siblings) {
		if (node === heading) selected = true;
		else if (selected && /^h[1-6]$/u.test(node.nodeName)) break;
		if (selected) links.push(...descendants(node, child => child.nodeName === "a"));
	}
	const result: TexasElection["texasDocuments"] = [];
	for (const node of links) {
		const label = text(node);
		if (label === `${year} Ballot Certification (PDF)`)
			result.push({ kind: "certification", url: publicUrl(attribute(node, "href"), "pdf", pageUrl) });
		else if (label === `${year} Certified List of Write-In Candidates (Federal, State, and District) (PDF)`)
			result.push({ kind: "write-ins", url: publicUrl(attribute(node, "href"), "pdf", pageUrl) });
		else if (/certification|certified.*write.in/iu.test(label))
			throw new Error("A Texas certification publication has an unfamiliar label requiring review.");
	}
	const election = { electionId: null, electionDate, pageUrl, texasDocuments: result };
	validateTexasElection(election);
	return election;
}
export function validateTexasElection(value: unknown): asserts value is TexasElection {
	if (
		!exact(value, ["electionId", "electionDate", "pageUrl", "texasDocuments"])
		|| value.electionId !== null
		|| !generalDate(value.electionDate)
		|| typeof value.pageUrl !== "string"
		|| publicUrl(value.pageUrl, "page") !== value.pageUrl
		|| !value.pageUrl.includes(value.electionDate.slice(0, 4))
		|| !Array.isArray(value.texasDocuments)
		|| value.texasDocuments.length < 1
		|| value.texasDocuments.length > 2
	) {
		throw new Error("The Texas general-election identity is invalid.");
	}
	for (const item of value.texasDocuments) {
		if (
			!exact(item, ["kind", "url"])
			|| !["certification", "write-ins"].includes(String(item.kind))
			|| typeof item.url !== "string"
			|| publicUrl(item.url, "pdf") !== item.url
		) {
			throw new Error("The Texas general-election document identity is invalid.");
		}
	}
	if (
		value.texasDocuments[0].kind !== "certification"
		|| (value.texasDocuments.length === 2 && value.texasDocuments[1].kind !== "write-ins")
		|| new Set(value.texasDocuments.map(item => item.url)).size !== value.texasDocuments.length
	) {
		throw new Error("The Texas certification document set is incomplete or duplicated.");
	}
}
function readCapture(body: string) {
	if (Buffer.byteLength(body) > 24 * 1024 * 1024)
		throw new Error("The Texas certification capture exceeds its bounds.");
	const value: unknown = JSON.parse(body);
	if (
		!exact(value, ["schemaVersion", "type", "policies", "pages", "documents"])
		|| value.schemaVersion !== 1
		|| value.type !== "texas-certification-discovery"
		|| JSON.stringify(value.policies) !== JSON.stringify(texasPolicyReceipts)
		|| !Array.isArray(value.pages)
		|| value.pages.length < 2
		|| value.pages.length > 7
		|| !Array.isArray(value.documents)
		|| !value.documents.length
		|| value.documents.length > 12
	) {
		throw new Error("The Texas certification capture is incomplete or has unreviewed policies.");
	}
	for (const page of value.pages) {
		if (
			!exact(page, ["url", "body"])
			|| typeof page.url !== "string"
			|| typeof page.body !== "string"
			|| Buffer.byteLength(page.body) > 2 * 1024 * 1024
		) {
			throw new Error("The Texas certification index evidence is invalid.");
		}
	}
	for (const document of value.documents) {
		if (
			!exact(document, ["url", "text", "sha256", "retrievedAt"])
			|| typeof document.url !== "string"
			|| publicUrl(document.url, "pdf") !== document.url
			|| typeof document.text !== "string"
			|| Buffer.byteLength(document.text) > 4 * 1024 * 1024
			|| typeof document.sha256 !== "string"
			|| !/^[a-f0-9]{64}$/u.test(document.sha256)
			|| typeof document.retrievedAt !== "string"
			|| !Number.isFinite(Date.parse(document.retrievedAt))
			|| new Date(document.retrievedAt).toISOString() !== document.retrievedAt
		) {
			throw new Error("The Texas certification document evidence is invalid.");
		}
	}
	if (
		new Set(value.pages.map(page => page.url)).size !== value.pages.length
			|| new Set(value.documents.map(document => document.url)).size !== value.documents.length
	) {
		throw new Error("The Texas certification evidence repeats a page or document.");
	}
	return value as unknown as TexasCapture;
}
export function readTexasElectionDiscovery(body: string) {
	const capture = readCapture(body);
	if (capture.pages[0]!.url !== texasDiscoveryUrl) throw new Error("The Texas discovery entry point changed.");
	const pages = offeredPages(capture.pages[0]!.body);
	if (pages.length + 1 !== capture.pages.length) throw new Error("The offered Texas election pages are incomplete.");
	const elections = pages.map((page, index) => {
		const captured = capture.pages[index + 1]!;
		if (captured.url !== page.pageUrl) throw new Error("The Texas election page was not actually offered.");
		return electionDocuments(captured.body, page.electionDate, page.pageUrl);
	});
	if (
		elections.flatMap(election => election.texasDocuments.map(document => document.url)).join("|")
		!== capture.documents.map(document => document.url).join("|")
	) {
		throw new Error("The Texas certification capture omits, adds or reorders documents.");
	}
	return elections;
}
export async function fetchTexasCycleDiscovery(options: Options = {}) {
	const executable = options.extractor ? null : await resolveStateBallotPdfExtractor();
	const request = options.requestText ?? fetchRemoteSourceText;
	const transport = {
		allowedHosts: ["www.sos.state.tx.us"],
		maxBytes: 2 * 1024 * 1024,
		maxRedirects: 0,
		timeoutMs: 12000
	};
	for (const policy of texasPolicyReceipts) {
		const body = await request(policy.url, transport);
		if (hash(policy.region === "content" ? text(content(body)) : body) !== policy.sha256)
			throw new Error("The Texas publisher policy changed and requires review.");
	}
	const index = await request(texasDiscoveryUrl, transport);
	const pages = [{ url: texasDiscoveryUrl, body: index }];
	const descriptors: TexasElection["texasDocuments"] = [];
	for (const page of offeredPages(index)) {
		const body = await request(page.pageUrl, transport);
		pages.push({ url: page.pageUrl, body });
		descriptors.push(...electionDocuments(body, page.electionDate, page.pageUrl).texasDocuments);
	}
	const documents: TexasDocument[] = [];
	for (const descriptor of descriptors) {
		documents.push(
			await fetchStateBallotPdfDocument(descriptor.url, {
				allowedHosts: transport.allowedHosts,
				request: options.requestDocument,
				now: options.now,
				extractor:
					options.extractor
					?? (bytes =>
						extractStateBallotPdfText(
							bytes,
							executable!,
							12000,
							"layout",
							texasPdfCollectorContract.maximumPages
						))
			})
		);
	}
	const capture: TexasCapture = {
		schemaVersion: 1,
		type: "texas-certification-discovery",
		policies: texasPolicyReceipts,
		pages,
		documents
	};
	const body = JSON.stringify(capture);
	readTexasElectionDiscovery(body);
	return body;
}
export function validateTexasSource(source: StateBallotSource) {
	const current = source.electionDate === "2026-11-03";
	if (
		source.stateCode !== "TX"
		|| source.format !== "texas-certified-pdf"
		|| source.retrievalPolicy
		|| source.postBody
		|| !generalDate(source.electionDate)
		|| source.id !== (current ? "tx-sos-2026" : `tx-general-${source.electionDate}`)
		|| source.url !== (current ? source.documentUrls?.[0] : source.pageUrl)
		|| publicUrl(source.pageUrl, "page") !== source.pageUrl
		|| !source.pageUrl.includes(source.electionDate.slice(0, 4))
		|| !source.documentUrls?.length
		|| source.documentUrls.length > 2
		|| source.documentLinks?.length
		|| source.withheldDistrictScopes?.join("|") !== "congressional"
	) {
		throw new Error("The Texas certification source is not configured for its general election.");
	}
	for (const url of source.documentUrls) publicUrl(url, "pdf");
}
export async function fetchTexasCandidateCapture(source: StateBallotSource, discovery?: string, options: Options = {}) {
	validateTexasSource(source);
	const body = discovery ?? (await fetchTexasCycleDiscovery(options));
	const election = readTexasElectionDiscovery(body).find(item => item.electionDate === source.electionDate);
	if (
		!election
		|| election.pageUrl !== source.pageUrl
		|| election.texasDocuments.map(item => item.url).join("|") !== source.documentUrls!.join("|")
	) {
		throw new Error("The Texas certification source is no longer offered by its discovery page.");
	}
	return body;
}
const statewideOffices = new Set([
	"U. S. SENATOR",
	"GOVERNOR",
	"LIEUTENANT GOVERNOR",
	"ATTORNEY GENERAL",
	"COMPTROLLER OF PUBLIC ACCOUNTS",
	"COMMISSIONER OF THE GENERAL LAND OFFICE",
	"COMMISSIONER OF AGRICULTURE",
	"RAILROAD COMMISSIONER"
]);
function geography(
	office: string,
	county?: string
): { scope: StateContestScope; district: string; jurisdiction?: string } {
	if (
		statewideOffices.has(office)
		|| /^(?:CHIEF JUSTICE|JUSTICE), SUPREME COURT(?:, PLACE [1-9]\d*)?(?: \(UNEXPIRED TERM\))?$/u.test(office)
		|| /^(?:PRESIDING JUDGE|JUDGE), COURT OF CRIMINAL APPEALS(?:, PLACE [1-9]\d*)?(?: \(UNEXPIRED TERM\))?$/u.test(
			office
		)
		|| /^(?:CHIEF JUSTICE|JUSTICE), 15TH COURT OF APPEALS DISTRICT(?:, PLACE [1-9]\d*)?(?: \(UNEXPIRED TERM\))?$/u.test(
			office
		)
	) {
		return { scope: "statewide", district: "" };
	}
	const legislative
		= /^(U\. S\. REPRESENTATIVE DISTRICT |STATE SENATOR, DISTRICT |STATE REPRESENTATIVE DISTRICT )([1-9]\d{0,2})(?: \(UNEXPIRED TERM\))?$/u.exec(
			office
		);
	if (legislative) {
		const scope = legislative[1]!.startsWith("U. S.")
			? "congressional"
			: legislative[1]!.startsWith("STATE SENATOR")
				? "state-senate"
				: "state-house";
		if (Number(legislative[2]) > (scope === "congressional" ? 38 : scope === "state-senate" ? 31 : 150))
			throw new Error("The Texas legislative district requires a reviewed boundary update.");
		return { scope, district: legislative[2]! };
	}
	if (
		/^(?:MEMBER, STATE BOARD OF EDUCATION, DISTRICT [1-9]\d?|DISTRICT (?:JUDGE|ATTORNEY), [1-9]\d{0,2}(?:ST|ND|RD|TH) JUDICIAL DISTRICT|(?:CHIEF JUSTICE|JUSTICE), [1-9]\d?(?:ST|ND|RD|TH) COURT OF APPEALS DISTRICT|1ST MULTICOUNTY COURT AT LAW)(?:, PLACE [1-9]\d*)?(?: \(UNEXPIRED TERM\))?$/u.test(
			office
		)
	) {
		const match = /DISTRICT (\d+)|, (\d+)(?:ST|ND|RD|TH)/u.exec(office);
		return { scope: "local", district: match?.[1] ?? match?.[2] ?? "", jurisdiction: `Texas: ${office}` };
	}
	if (
		!/^(?:COUNTY (?:JUDGE|CLERK|TREASURER|SURVEYOR|COMMISSIONER|TAX ASSESSOR-COLLECTOR|CONSTABLE|ATTORNEY)|DISTRICT JUDGE, JUDICIAL DISTRICT [1-9]\d*[A-Z]|DISTRICT CLERK|DISTRICT AND COUNTY CLERK|COUNTY AND DISTRICT CLERK|JUSTICE OF THE PEACE|JUDGE, (?:COUNTY|STATUTORY|PROBATE)|PROBATE COURT|CRIMINAL DISTRICT (?:ATTORNEY|JUDGE)|HARRIS COUNTY DEPARTMENT OF EDUCATION|SHERIFF)[ A-Z0-9,./#()&-]*$/u.test(
			office
		)
	) {
		throw new Error(`The Texas office requires jurisdiction or ticket review: ${office}`);
	}
	const namedCounty = /^CRIMINAL DISTRICT ATTORNEY ([A-Z ]+) COUNTY$/u.exec(office)?.[1];
	if (!county && !namedCounty) throw new Error("The Texas county candidate lacks an explicit source county.");
	if (namedCounty && county && namedCounty !== county)
		throw new Error("The Texas office and report disagree on their county.");
	return { scope: "local", district: "", jurisdiction: `${county ?? namedCounty} County, Texas` };
}
function candidate(
	source: StateBallotSource,
	name: string,
	office: string,
	party: string | undefined,
	county?: string,
	writeIn = false
): StateCandidateRecord {
	name = clean(name);
	if (
		!name
		|| name.length > 250
		|| containsControlCharacters(name)
		|| /https?:|@|\d{3}/iu.test(name)
		|| !office
		|| office.length > 300
	) {
		throw new Error("The Texas candidate name or office has an unsupported layout.");
	}
	const location = geography(office, county);
	const key = [
		"TX",
		source.electionDate,
		office.toLowerCase(),
		location.district,
		name.toLowerCase(),
		(party ?? "").toLowerCase(),
		...(location.jurisdiction ? [location.jurisdiction.toLowerCase()] : [])
	];
	return {
		id: hash(JSON.stringify(key)).slice(0, 24),
		name,
		office,
		district: location.district,
		scope: location.scope,
		status: writeIn ? "write-in" : "qualified",
		sourceStatus: writeIn ? "Certified properly-filed declared write-in candidate" : "Certified candidate",
		...(party ? { party } : {}),
		...(location.jurisdiction ? { jurisdiction: location.jurisdiction } : {})
	};
}
function certifiedRecords(source: StateBallotSource, document: TexasDocument) {
	const pages = document.text.split("\f").filter(page => page.trim());
	if (
		pages.length < 2
		|| pages.length > texasPdfCollectorContract.maximumPages
		|| !/constitutes the final ballot certification of candidates/u.test(clean(pages[0]!))
	) {
		throw new Error("The Texas candidate certification cover is missing or unsupported.");
	}
	const parties = {
		REP: "Republican",
		DEM: "Democratic",
		LIB: "Libertarian",
		GRE: "Green",
		IND: "Independent"
	} as const;
	const records = new Map<string, StateCandidateRecord>();
	const counties = new Set<string>();
	const statewide = new Map<string, Set<string>>();
	let office = "";
	let previousCounty = "";
	let footerRevision = "";
	let claims = 0;
	for (const [index, page] of pages.slice(1).entries()) {
		const lines = page.split(/\r?\n/u);
		if (lines.some(line => line.length > 700))
			throw new Error("The Texas certification row exceeds its reviewed bounds.");
		const countyLines = lines.filter(line => line.startsWith("County "));
		const footer = lines
			.map(line => /^(\d{2}\/\d{2}\/20\d{2} \d{2}:\d{2} [AP]M) +Page (\d+) of (\d+)$/u.exec(line.trim()))
			.filter(value => value !== null);
		const county = clean(countyLines[0]?.slice(6) ?? "");
		if (
			countyLines.length !== 1
			|| !county
			|| county.split(" ").some(word => !/^[A-Z]+$/u.test(word))
			|| footer.length !== 1
			|| Number(footer[0]![2]) !== index + 1
			|| Number(footer[0]![3]) !== pages.length - 1
			|| !page.includes("Texas Secretary of State")
			|| !page.includes("Ballot Certification Report")
			|| !page.includes(`${source.electionDate.slice(0, 4)} NOVEMBER GENERAL ELECTION`)
			|| !page.includes(`November ${source.electionDate.slice(-2)}, ${source.electionDate.slice(0, 4)}`)
		) {
			throw new Error("The Texas report has a missing, reordered, conflicting or incomplete page.");
		}
		if (footerRevision && footerRevision !== footer[0]![1])
			throw new Error("The Texas report combines different publisher revisions.");
		footerRevision = footer[0]![1]!;
		if (county !== previousCounty) {
			if (counties.has(county)) throw new Error("The Texas county report sequence repeats a completed county.");
			office = "";
		}
		counties.add(county);
		previousCounty = county;
		for (const line of lines) {
			const label = clean(line);
			if (
				!label
				|| /^County\s+(?:[A-Z][A-Z ]*| )$/u.test(label)
				|| [
					"Texas Secretary of State",
					"Ballot Certification Report",
					`${source.electionDate.slice(0, 4)} NOVEMBER GENERAL ELECTION`,
					`November ${source.electionDate.slice(-2)}, ${source.electionDate.slice(0, 4)}`
				].includes(label)
				|| /^\d{2}\/\d{2}\/20\d{2} \d{2}:\d{2} [AP]M Page \d+ of \d+$/u.test(label)
			) {
				continue;
			}
			const fields = line.trim().split(/ {3,}/u);
			if (fields.length === 2 && Object.hasOwn(parties, fields[1]!)) {
				const record = candidate(
					source,
					fields[0]!,
					office,
					parties[fields[1] as keyof typeof parties],
					county
				);
				const existing = records.get(record.id);
				if (existing && JSON.stringify(existing) !== JSON.stringify(record))
					throw new Error("The Texas repeated candidate claims conflict.");
				records.set(record.id, record);
				claims++;
				if (record.scope === "statewide") {
					const found = statewide.get(record.id) ?? new Set<string>();
					found.add(county);
					statewide.set(record.id, found);
				}
			}
			else if (fields.length === 1 && /^ {4,8}\S/u.test(line) && label === label.toUpperCase()) {
				geography(label, county);
				office = label;
			}
			else {
				throw new Error("The Texas certification contains an unfamiliar candidate row or field.");
			}
		}
	}
	if (
		counties.size !== texasPdfCollectorContract.maximumCounties
		|| !records.size
		|| !statewide.size
		|| [...statewide.values()].some(found => found.size !== counties.size)
	) {
		throw new Error("The Texas report does not reconcile its complete county and statewide candidate claims.");
	}
	return {
		records: [...records.values()],
		counties,
		pages: pages.length - 1,
		claims,
		publisherRevision: footerRevision
	};
}
function writeInRecords(source: StateBallotSource, document: TexasDocument, counties: Set<string>) {
	const lines = document.text.split(/\r?\n/u);
	const body = clean(document.text);
	const year = source.electionDate.slice(0, 4);
	const day = Number(source.electionDate.slice(-2));
	if (
		!body.includes(`November ${day}, ${year} General Election`)
		|| !body.includes("certified as properly-filed declared write-in candidates")
		|| !body.includes("Office Sought")
		|| !body.includes("Name of Candidate")
		|| document.text.split("\f").filter(page => page.trim()).length !== 1
	) {
		throw new Error("The Texas write-in certification is incomplete or identifies another election.");
	}
	let table = false;
	let ended = false;
	const records: StateCandidateRecord[] = [];
	for (const line of lines) {
		const label = clean(line);
		if (label === "Office Sought Name of Candidate") {
			if (table || ended) throw new Error("The Texas write-in table repeats its header.");
			table = true;
			continue;
		}
		if (!table || !label) continue;
		if (label.startsWith("IN TESTIMONY WHEREOF")) {
			table = false;
			ended = true;
			continue;
		}
		if (line.length > 700) throw new Error("The Texas write-in row exceeds its reviewed bounds.");
		const fields = line.trim().split(/ {2,}/u);
		if (fields.length !== 2) throw new Error("The Texas write-in table has an unfamiliar row.");
		let office = clean(fields[0]!);
		let name = clean(fields[1]!);
		if (document.sha256 === "eece7f9fa38c65eef150d62ba0a142672dc187b7feb2f90bc330f9c5a226aa24") {
			if (office === "District Attorney, 3fS1 Judicial District- Unexpired Term")
				office = "District Attorney, 31st Judicial District - Unexpired Term";
			if (name === "L.D.Howard") name = "L.D. Howard";
		}
		office = office
			.toUpperCase()
			.replace(/^U\.S\. SENATOR$/u, "U. S. SENATOR")
			.replace(/^U\.S\. REPRESENTATIVE, DISTRICT /u, "U. S. REPRESENTATIVE DISTRICT ")
			.replace(/^STATE REPRESENTATIVE, DISTRICT /u, "STATE REPRESENTATIVE DISTRICT ")
			.replace(/\s*[-–]\s*UNEXPIRED TERM$/u, " (UNEXPIRED TERM)");
		const record = candidate(source, name, office, undefined, undefined, true);
		if (record.jurisdiction?.endsWith(" County, Texas") && !counties.has(record.jurisdiction.slice(0, -14)))
			throw new Error("The Texas write-in names an unverified county.");
		records.push(record);
	}
	if (!ended || !records.length || new Set(records.map(record => record.id)).size !== records.length)
		throw new Error("The Texas write-in certification table is empty, incomplete or duplicated.");
	return records;
}
export function parseTexasCandidateCapture(source: StateBallotSource, body: string) {
	validateTexasSource(source);
	const capture = readCapture(body);
	const election = readTexasElectionDiscovery(body).find(item => item.electionDate === source.electionDate);
	if (
		!election
		|| election.pageUrl !== source.pageUrl
		|| election.texasDocuments.map(item => item.url).join("|") !== source.documentUrls!.join("|")
	) {
		throw new Error("The Texas candidate capture does not match its selected source.");
	}
	const selected = election.texasDocuments.map(item =>
		capture.documents.find(document => document.url === item.url)!
	);
	const main = certifiedRecords(source, selected[0]!);
	const writeIns = selected[1] ? writeInRecords(source, selected[1], main.counties) : [];
	const records = [...main.records, ...writeIns];
	if (records.length > 25000 || new Set(records.map(record => record.id)).size !== records.length)
		throw new Error("The Texas certification records exceed their bounds or conflict across documents.");
	const documents = selected.map((document, index) => ({
		url: document.url,
		sha256: document.sha256,
		retrievedAt: document.retrievedAt,
		includedRecordCount: index === 0 ? main.records.length : writeIns.length
	}));
	return {
		records,
		documents,
		sha256: hash(JSON.stringify(documents.map(({ url, sha256 }) => ({ url, sha256 })))),
		retrievedAt: new Date(Math.min(...documents.map(document => Date.parse(document.retrievedAt)))).toISOString(),
		verification: {
			reportPages: main.pages,
			counties: main.counties.size,
			repeatedCandidateClaims: main.claims,
			certifiedRecords: main.records.length,
			writeIns: writeIns.length,
			publisherRevision: main.publisherRevision
		}
	};
}
