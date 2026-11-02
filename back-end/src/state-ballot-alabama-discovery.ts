import type { StateHtmlNode } from "./state-ballot-html.js";
import { Buffer } from "node:buffer";
import { electionDocumentRobotsPolicy } from "./election-document-collection.js";
import { alabamaHash as hash } from "./state-ballot-alabama-types.js";
import { parseStateHtml, stateHtmlAttribute, stateHtmlDescendants, stateHtmlText } from "./state-ballot-html.js";

export interface AlabamaCapturedDocument {
	url: string;
	body: string;
	sha256: string;
	capturedAt: string;
}
export interface AlabamaReferenceCapture {
	schemaVersion: 1;
	type: "alabama-election-reference-capture";
	documents: AlabamaCapturedDocument[];
}
export interface AlabamaReferenceElection {
	electionDate: string;
	pageUrl: string;
	sampleIndexUrl: string;
	certifications: { label: string; url: string }[];
	countyBallots: { county: string; url: string }[];
	statewideBackUrl: string;
}
export interface AlabamaPendingPublication {
	status: "pending";
	year: string;
	pageUrl: string;
	reason: "general-election-not-published" | "ballot-resources-not-published";
}
type AlabamaPublishedGeneralElection = Pick<AlabamaReferenceElection, "electionDate" | "pageUrl" | "sampleIndexUrl" | "certifications">;
export interface AlabamaElectionReferences {
	schemaVersion: 1;
	type: "official-alabama-election-references";
	recordRole: "official-sample-ballot-reference";
	sourcePublisher: "Alabama Secretary of State";
	sourceUrl: string;
	sourceSha256: string;
	retrievedAt: string;
	documents: Omit<AlabamaCapturedDocument, "body">[];
	elections: AlabamaReferenceElection[];
	pendingPublications?: AlabamaPendingPublication[];
	candidateExtractionPerformed: false;
	candidateQualificationInferred: false;
	individualBallotApplicabilityVerified: false;
	countyFipsAssigned: false;
}
const origin = "https://www.sos.alabama.gov";
export const alabamaDiscoveryUrl = `${origin}/alabama-votes/voter/election-information`;
const text = (node: StateHtmlNode) => stateHtmlText(node).replace(/\s+/gu, " ").trim();
function exact(value: unknown, keys: string[]): value is Record<string, unknown> {
	return Boolean(
		value
		&& typeof value === "object"
		&& !Array.isArray(value)
		&& Object.keys(value).sort().join("|") === [...keys].sort().join("|")
	);
}

function document(body: string) {
	if (typeof body !== "string" || Buffer.byteLength(body) > 3 * 1024 * 1024 || body.includes("\uFFFD"))
		throw new Error("The Alabama publication exceeds its reviewed bounds.");
	const parsed = parseStateHtml(body);
	const pending = [{ node: parsed, depth: 0 }];
	let count = 0;
	while (pending.length) {
		const { node, depth } = pending.pop()!;
		if (++count > 80000 || depth > 64) throw new Error("The Alabama publication structure requires review.");
		for (const child of node.childNodes ?? []) pending.push({ node: child, depth: depth + 1 });
	}
	const policies = [
		...new Set(
			stateHtmlDescendants(
				parsed,
				node =>
					node.nodeName === "a"
					&& /privacy|terms|copyright|disclaimer|use polic|licen[cs]e/iu.test(
						`${text(node)} ${stateHtmlAttribute(node, "href")}`
					)
			).map(node => new URL(stateHtmlAttribute(node, "href"), origin).href)
		)
	];
	if (policies.length) throw new Error("New Alabama publisher policy links require independent review.");
	return parsed;
}
function main(body: string) {
	const matches = stateHtmlDescendants(document(body), node => node.nodeName === "main");
	if (matches.length !== 1) throw new Error("The Alabama main publication is ambiguous.");
	return matches[0];
}
function address(value: string) {
	const url = new URL(value, origin);
	if (
		url.origin !== origin
		|| url.username
		|| url.password
		|| url.port
		|| url.search
		|| url.hash
		|| url.href.includes("%")
	) {
		throw new Error("The Alabama offered URL requires review.");
	}
	return url.href;
}
export function alabamaAnnualPages(body: string) {
	const pages = new Map<string, string>();
	for (const anchor of stateHtmlDescendants(main(body), node => node.nodeName === "a")) {
		const year = /^(20\d{2})$/u.exec(text(anchor));
		if (!year || year[1] < "2026" || Number(year[1]) % 2) continue;
		const url = address(stateHtmlAttribute(anchor, "href"));
		if (url !== `${alabamaDiscoveryUrl}/${year[1]}` || pages.has(year[1]))
			throw new Error("The Alabama offered annual pages conflict.");
		pages.set(year[1], url);
	}
	if (!pages.size || pages.size > 10) throw new Error("No bounded current/future Alabama annual pages are offered.");
	return [...pages.entries()].sort(([first], [second]) => first.localeCompare(second));
}
export function alabamaGeneralElection(body: string, year: string): AlabamaPublishedGeneralElection;
export function alabamaGeneralElection(body: string, year: string, pendingAsOf: number): AlabamaPublishedGeneralElection | AlabamaPendingPublication;
export function alabamaGeneralElection(body: string, year: string, pendingAsOf?: number): AlabamaPublishedGeneralElection | AlabamaPendingPublication {
	const content = main(body);
	const headings = stateHtmlDescendants(content, node => /^h[1-4]$/u.test(node.nodeName));
	const selected = headings.filter(node => /^General Election\s[–-]\s/u.test(text(node)));
	const pending = (reason: AlabamaPendingPublication["reason"]): AlabamaPendingPublication => ({ status: "pending", year, pageUrl: `${alabamaDiscoveryUrl}/${year}`, reason });
	const awaitingCutoff = new Date(`${year}-11-02T00:00:00Z`);
	awaitingCutoff.setUTCDate(awaitingCutoff.getUTCDate() + (2 - awaitingCutoff.getUTCDay() + 7) % 7);
	const futureYear = pendingAsOf !== undefined && Number.isFinite(pendingAsOf) && /^20\d{2}$/u.test(year) && Number(year) >= 2026 && Number(year) % 2 === 0 && Number(year) >= new Date(pendingAsOf).getUTCFullYear() && pendingAsOf < awaitingCutoff.getTime();
	if (!selected.length && futureYear && headings.filter(node => node.nodeName === "h1" && text(node) === `${year} Election Information`).length === 1 && !/general\s*election/iu.test(text(content))) return pending("general-election-not-published");
	if (selected.length !== 1) throw new Error("The regular Alabama general election must be explicit and unique.");
	const date = /^General Election\s[–-]\sNovember ([2-8]), (20\d{2})$/u.exec(text(selected[0]));
	const electionDate = date ? `${date[2]}-11-0${date[1]}` : null;
	if (
		!electionDate
		|| date![2] !== year
		|| new Date(electionDate).toISOString().slice(0, 10) !== electionDate
		|| new Date(electionDate).getUTCDay() !== 2
	) {
		throw new Error("The Alabama general-election date conflicts with its offered year.");
	}
	const canPend = futureYear && Date.parse(`${electionDate}T00:00:00Z`) > pendingAsOf!;
	const links: { label: string; url: string }[] = [];
	let active = false;
	for (const node of stateHtmlDescendants(
		content,
		node => /^h[1-4]$/u.test(node.nodeName) || node.nodeName === "a"
	)) {
		if (/^h[1-4]$/u.test(node.nodeName)) {
			active = node === selected[0];
			continue;
		}
		if (active && /certif|sample ballots|candidate|amendment/iu.test(text(node)))
			links.push({ label: text(node), url: address(stateHtmlAttribute(node, "href")) });
	}
	const samples = links.filter(link => link.label === "Sample Ballots");
	if ((!samples.length && !canPend) || samples.length > 1 || (samples.length === 1 && samples[0].url !== `${origin}/alabama-votes/${year}-general-election-sample-ballots`))
		throw new Error("The Alabama sample-ballot page is not uniquely offered by the general-election section.");
	const certifications = links.filter(link => /certif/iu.test(link.label));
	const known
		= /^(?:State Certification of (?:Democratic Party Candidates|Republican Party Candidates|Independent Candidate|Constitutional Amendments)|Certification of (?:Democratic|Republican) Party Candidates|Amended Certification of Democratic Party Candidates|Republican Party Amended Certification of Candidates)$/u;
	if (
		certifications.length > 25
		|| certifications.some(
			link =>
				!known.test(link.label)
				|| !new RegExp(`^${origin}/sites/default/files/election-${year}/[A-Za-z0-9_.-]+\\.pdf$`, "u").test(
					link.url
				)
		)
		|| new Set(certifications.map(link => link.url)).size !== certifications.length
	) {
		throw new Error("The complete Alabama certification inventory requires review.");
	}
	let missingParty = false;
	for (const label of [
		"State Certification of Democratic Party Candidates",
		"State Certification of Republican Party Candidates"
	]) {
		const count = certifications.filter(link => link.label === label).length;
		if (count > 1) throw new Error("The Alabama state-certified party inventory is duplicated.");
		if (!count) missingParty = true;
	}
	if (!samples.length || certifications.length < 3 || missingParty) {
		if (canPend) return pending("ballot-resources-not-published");
		throw new Error("The Alabama state-certified party inventory is incomplete.");
	}
	return { electionDate, pageUrl: `${alabamaDiscoveryUrl}/${year}`, sampleIndexUrl: samples[0].url, certifications };
}
export function alabamaCountySamples(body: string, year: string) {
	const content = main(body);
	const headings = stateHtmlDescendants(content, node => node.nodeName === "h1");
	if (headings.length !== 1 || text(headings[0]) !== `${year} General Election Sample Ballots`)
		throw new Error("The Alabama county-sample heading conflicts with the election.");
	const tables = stateHtmlDescendants(content, node => node.nodeName === "table");
	if (tables.length !== 1) throw new Error("The county sample table requires review.");
	const backs = stateHtmlDescendants(
		content,
		node => node.nodeName === "a" && stateHtmlAttribute(node, "href").includes("GeneralElectionStatewideBack.pdf")
	);
	const prefix = `${origin}/sites/default/files/sample-ballots/${year}/gen/`;
	if (
		backs.length !== 1
		|| address(stateHtmlAttribute(backs[0], "href")) !== `${prefix}${year}GeneralElectionStatewideBack.pdf`
	) {
		throw new Error("The statewide amendment reference is missing, duplicated or mismatched.");
	}
	const result: { county: string; url: string }[] = [];
	const statewideBackUrl = address(stateHtmlAttribute(backs[0], "href"));
	for (const anchor of stateHtmlDescendants(tables[0], node => node.nodeName === "a")) {
		const href = stateHtmlAttribute(anchor, "href");
		const url = address(href);
		if (!url.startsWith(prefix)) throw new Error("An Alabama sample refers to a different or unsupported election.");
		const basename = url.slice(prefix.length);
		const county = text(anchor);
		const filename = /^([A-Za-z]+(?:[.-][A-Za-z]+)*)[-_]Sample\.pdf$/u.exec(basename);
		if (
			!/^[A-Z][A-Za-z. ]{1,40}$/u.test(county)
			|| !filename
			|| filename[1].replace(/[.-]/gu, "").toLowerCase() !== county.replace(/[. ]/gu, "").toLowerCase()
		) {
			throw new Error("The county label and offered Alabama sample filename do not agree.");
		}
		result.push({ county, url });
	}
	if (
		!result.length
		|| result.length > 67
		|| !statewideBackUrl
		|| new Set(result.map(item => item.county)).size !== result.length
		|| new Set(result.map(item => item.url)).size !== result.length
	) {
		throw new Error("The Alabama county sample inventory is empty, duplicate or out of bounds.");
	}
	return { countyBallots: result, statewideBackUrl };
}
export function prepareAlabamaReferences(capture: unknown, now = Date.now()): AlabamaElectionReferences {
	if (
		!exact(capture, ["schemaVersion", "type", "documents"])
		|| capture.schemaVersion !== 1
		|| capture.type !== "alabama-election-reference-capture"
		|| !Array.isArray(capture.documents)
		|| capture.documents.length < 3
		|| capture.documents.length > 32
	) {
		throw new Error("The Alabama discovery capture is invalid.");
	}
	const documents = new Map<string, AlabamaCapturedDocument>();
	for (const item of capture.documents) {
		if (
			!exact(item, ["url", "body", "sha256", "capturedAt"])
			|| typeof item.url !== "string"
			|| address(item.url) !== item.url
			|| typeof item.sha256 !== "string"
			|| typeof item.capturedAt !== "string"
			|| typeof item.body !== "string"
			|| Buffer.byteLength(item.body) > 3 * 1024 * 1024
			|| hash(item.body) !== item.sha256
			|| !Number.isFinite(Date.parse(item.capturedAt))
			|| Date.parse(item.capturedAt) > now
			|| new Date(item.capturedAt).toISOString() !== item.capturedAt
			|| documents.has(item.url)
		) {
			throw new Error("The Alabama discovery provenance is invalid.");
		}
		documents.set(item.url, { url: item.url, body: item.body, sha256: item.sha256, capturedAt: item.capturedAt });
	}
	const robots = documents.get(`${origin}/robots.txt`);
	const discovery = documents.get(alabamaDiscoveryUrl);
	if (!robots || !discovery || robots.sha256 !== "8e8cb58d810473a52cce903be5ffb73d948eef981bbd101cffbf8dc2c02fcf4e")
		throw new Error("The Alabama robots publication requires review.");
	const permissions = electionDocumentRobotsPolicy(Buffer.from(robots.body));
	const pages = alabamaAnnualPages(discovery.body);
	const elections: AlabamaReferenceElection[] = [];
	const pendingPublications: AlabamaPendingPublication[] = [];
	const used = new Set([robots.url, discovery.url]);
	for (const [year, url] of pages) {
		const annual = documents.get(url);
		if (!annual) throw new Error("The offered Alabama annual page is missing.");
		const election = alabamaGeneralElection(annual.body, year, Date.parse(annual.capturedAt));
		used.add(annual.url);
		if ("status" in election) {
			pendingPublications.push(election);
			continue;
		}
		const sample = documents.get(election.sampleIndexUrl);
		if (!sample) throw new Error("The offered Alabama sample index is missing.");
		used.add(sample.url);
		elections.push({ ...election, ...alabamaCountySamples(sample.body, year) });
	}
	if (
		used.size !== documents.size
		|| [...documents.keys()].some(url => !url.endsWith("/robots.txt") && !permissions.allowed(url))
	) {
		throw new Error("The Alabama capture includes extra or prohibited publications.");
	}
	const provenance = [...documents.values()].map(({ url, sha256, capturedAt }) => ({ url, sha256, capturedAt }));
	return {
		schemaVersion: 1,
		type: "official-alabama-election-references",
		recordRole: "official-sample-ballot-reference",
		sourcePublisher: "Alabama Secretary of State",
		sourceUrl: alabamaDiscoveryUrl,
		sourceSha256: hash(JSON.stringify(provenance)),
		retrievedAt: provenance
			.map(item => item.capturedAt)
			.sort()
			.at(-1)!,
		documents: provenance,
		elections,
		...(pendingPublications.length ? { pendingPublications } : {}),
		candidateExtractionPerformed: false,
		candidateQualificationInferred: false,
		individualBallotApplicabilityVerified: false,
		countyFipsAssigned: false
	};
}
const csvCell = (value: unknown) => `"${String(value).replaceAll("\"", "\"\"")}"`;
export function alabamaReferenceCsv(snapshot: AlabamaElectionReferences) {
	const rows = [
		[
			"stateCode",
			"electionDate",
			"county",
			"recordRole",
			"sampleBallotUrl",
			"sourceUrl",
			"retrievedAt",
			"sourceSha256"
		]
	];
	for (const election of snapshot.elections) {
		for (const item of election.countyBallots) {
			rows.push([
				"AL",
				election.electionDate,
				item.county,
				snapshot.recordRole,
				item.url,
				election.sampleIndexUrl,
				snapshot.retrievedAt,
				snapshot.sourceSha256
			]);
		}
	}
	return `${rows.map(row => row.map(csvCell).join(",")).join("\n")}\n`;
}
