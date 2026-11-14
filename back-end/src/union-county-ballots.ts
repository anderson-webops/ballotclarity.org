import type { StateHtmlNode } from "./state-ballot-html.js";
import { Buffer } from "node:buffer";
import { setTimeout as wait } from "node:timers/promises";
import { fetchRemoteSourceDocument } from "./remote-json-source.js";
import { stateHtmlAttribute as attribute, stateHtmlDescendants as descendants, parseStateHtml, stateHtmlText } from "./state-ballot-html.js";
import { unionCandidateHash as hash, unionCandidateOrigin, unionCandidatePolicyHash, unionCandidatePolicyUrls } from "./union-county-candidates.js";

export const unionSampleLandingUrl = `${unionCandidateOrigin}/sample-ballots-2/`;
export const unionCountyOrigin = "https://ucnj.org";
export const unionCountyPolicyUrls = [`${unionCountyOrigin}/robots.txt`, `${unionCountyOrigin}/`, `${unionCountyOrigin}/privacy-statement/`] as const;
const municipalities = ["Berkeley Heights", "Clark", "Cranford", "Elizabeth", "Fanwood", "Garwood", "Hillside", "Kenilworth", "Linden", "Mountainside", "New Providence", "Plainfield", "Rahway", "Roselle", "Roselle Park", "Scotch Plains", "Springfield", "Summit", "Union", "Westfield", "Winfield"];
const clean = (value: string) => value.replace(/\s+/gu, " ").trim();
const text = (node: StateHtmlNode) => clean(stateHtmlText(node));
function reject(): never {
	throw new Error("The Union County sample-ballot source requires review.");
}
function legalLinks(document: StateHtmlNode, origin: string) {
	return [...new Set(descendants(document, node => node.nodeName === "a" && /privacy|terms|copyright|disclaimer|licen[cs]e/iu.test(`${text(node)} ${attribute(node, "href")}`)).flatMap((node) => {
		const address = new URL(attribute(node, "href"), origin);
		if (address.protocol === "mailto:" || (address.pathname === "/privacy-statement/" && (address.searchParams.has("share") || address.hash.startsWith("#print")))) return [];
		return [address.href];
	}))].sort();
}
function region(body: string) {
	if (Buffer.byteLength(body) > 2 * 1024 * 1024) return reject();
	const document = parseStateHtml(body);
	if (legalLinks(document, unionCandidateOrigin).join("\n") !== unionCandidatePolicyUrls[1]) return reject();
	const matches = descendants(document, node => attribute(node, "class").split(" ").includes("entry-content"));
	if (matches.length !== 1) return reject();
	return matches[0]!;
}
export function unionCountyPolicyHash(body: string, kind: "robots" | "home" | "privacy") {
	if (Buffer.byteLength(body) > 2 * 1024 * 1024) return reject();
	if (kind === "robots") {
		if (clean(body) !== "Sitemap: https://ucnj.org/sitemap.xml Sitemap: https://ucnj.org/news-sitemap.xml User-agent: * Disallow: /wp-admin/ Allow: /wp-admin/admin-ajax.php") return reject();
		return hash(clean(body));
	}
	const document = parseStateHtml(body);
	if (legalLinks(document, unionCountyOrigin).join("\n") !== unionCountyPolicyUrls[2]) return reject();
	if (kind === "home") return hash(JSON.stringify(legalLinks(document, unionCountyOrigin)));
	const matches = descendants(document, node => attribute(node, "class").split(" ").includes("entry-content"));
	if (matches.length !== 1) return reject();
	const value = text(matches[0]!).split("Share this Page")[0]!.trim();
	if (!value.startsWith("September 20, 2006") || !value.includes("Section A. Information Collected and How it is Used") || !value.includes("Section F. Disclaimer") || !value.includes("Section G. Contact Information")) return reject();
	return hash(value);
}
export interface UnionSampleEdition { electionDate: string; url: string }
function generalDate(month: string, day: string, year: string) {
	const date = `${year}-11-${day.padStart(2, "0")}`;
	if (month.toLowerCase() !== "november" || !/^20\d{2}-11-0[2-8]$/u.test(date) || Number(year) < 2026 || new Date(`${date}T00:00:00Z`).getUTCDay() !== 2) return reject();
	return date;
}
export function readUnionSampleEdition(body: string): UnionSampleEdition {
	const children = (region(body).childNodes ?? []).filter(node => node.nodeName !== "#text" || text(node));
	const current = children.findIndex(node => node.nodeName === "h4" && text(node) === "Current");
	const past = children.findIndex(node => node.nodeName === "h4" && text(node) === "Past");
	if (current < 0 || past <= current) return reject();
	const links = children.slice(current + 1, past).flatMap(node => node.nodeName === "a" ? [node] : descendants(node, child => child.nodeName === "a"));
	if (links.length !== 1) return reject();
	const match = /^Sample Ballots for the (November) ([2-8]), (20\d{2}) General Election$/u.exec(text(links[0]!));
	if (!match) return reject();
	const electionDate = generalDate(match[1]!, match[2]!, match[3]!);
	const expected = `${unionCandidateOrigin}/sample-ballots-for-the-november-${match[2]}-${match[3]}-general-election/`;
	if (new URL(attribute(links[0]!, "href"), unionSampleLandingUrl).href !== expected) return reject();
	return { electionDate, url: expected };
}
export interface UnionSampleClaim { municipality: string; labels: string[] }
export interface UnionSampleDocument { form: number; url: string; claims: UnionSampleClaim[] }
export interface UnionSampleCatalog { edition: UnionSampleEdition; documents: UnionSampleDocument[]; sha256: string }
function documentForm(address: string, year: string) {
	const url = new URL(address);
	const match = new RegExp(`^/wp-content/uploads/${year}/(?:0[1-9]|1[0-2])/${year}-UNION-GEN-samples-FORM-([1-9]\\d?)\\.pdf$`, "u").exec(url.pathname);
	if (url.href !== address || url.origin !== unionCountyOrigin || url.username || url.password || url.search || url.hash || !match) return reject();
	return Number(match[1]);
}
export function readUnionSampleCatalog(body: string, edition: UnionSampleEdition): UnionSampleCatalog {
	const date = generalDate("November", edition.electionDate.slice(8), edition.electionDate.slice(0, 4));
	if (date !== edition.electionDate || edition.url !== `${unionCandidateOrigin}/sample-ballots-for-the-november-${Number(date.slice(8))}-${date.slice(0, 4)}-general-election/`) return reject();
	const document = parseStateHtml(body);
	if (Buffer.byteLength(body) > 2 * 1024 * 1024 || legalLinks(document, unionCandidateOrigin).join("\n") !== unionCandidatePolicyUrls[1]) return reject();
	const headings = descendants(document, node => node.nodeName === "h1");
	if (headings.length !== 1 || text(headings[0]!) !== `Sample Ballots for the November ${Number(date.slice(8))}, ${date.slice(0, 4)} General Election`) return reject();
	const main = region(body);
	const sections = descendants(main, node => node.nodeName === "div" && (node.childNodes ?? []).some(child => child.nodeName === "h4" && municipalities.includes(text(child))));
	if (sections.length !== municipalities.length || new Set(sections.map(section => text((section.childNodes ?? []).find(child => child.nodeName === "h4")!))).size !== municipalities.length) return reject();
	const documents: UnionSampleDocument[] = [];
	function readList(list: StateHtmlNode, municipality: string, parents: string[] = []) {
		for (const row of (list.childNodes ?? []).filter(node => node.nodeName === "li")) {
			const children = row.childNodes ?? [];
			const leading = children.filter(node => node.nodeName !== "ul");
			const label = clean(leading.map(stateHtmlText).join(" "));
			const links = leading.flatMap(node => node.nodeName === "a" ? [node] : descendants(node, child => child.nodeName === "a"));
			const nested = children.filter(node => node.nodeName === "ul");
			if (label === "Back to Top") {
				if (links.length !== 1 || attribute(links[0]!, "href") !== "#top" || nested.length) return reject();
				continue;
			}
			if (label === "Find your Ward and District") {
				if (links.length !== 1 || new URL(attribute(links[0]!, "href"), edition.url).href !== `${unionCandidateOrigin}/wp-content/uploads/2025/03/Find-your-Ward-and-District.pdf` || nested.length) return reject();
				continue;
			}
			if (!/^(?:All Districts|All Wards|Ward [1-9]\d?|District [1-9]\d?)$/u.test(label) || parents.length > 1 || links.length > 1 || nested.length > 1 || (!links.length && !nested.length)) return reject();
			const labels = [...parents, label];
			if (links.length) {
				if (nested.length) return reject();
				const url = new URL(attribute(links[0]!, "href"), edition.url).href;
				const form = documentForm(url, date.slice(0, 4));
				let record = documents.find(document => document.form === form);
				if (record && (record.url !== url || record.claims.some(claim => claim.municipality !== municipality))) return reject();
				if (!record) {
					record = { form, url, claims: [] };
					documents.push(record);
				}
				const claim = { municipality, labels };
				if (record.claims.some(existing => JSON.stringify(existing) === JSON.stringify(claim))) return reject();
				record.claims.push(claim);
			}
			if (nested.length) readList(nested[0]!, municipality, labels);
		}
	}
	for (const section of sections) {
		const children = section.childNodes ?? [];
		const heading = children.find(node => node.nodeName === "h4")!;
		const lists = children.filter(node => node.nodeName === "ul");
		if (lists.length !== 1) return reject();
		readList(lists[0]!, text(heading));
	}
	if (!documents.length || documents.length > 99 || new Set(documents.flatMap(document => document.claims.map(claim => claim.municipality))).size !== municipalities.length) return reject();
	const claims = documents.flatMap(document => document.claims.map(claim => JSON.stringify(claim)));
	if (new Set(claims).size !== claims.length) return reject();
	const offered = [...new Set(descendants(main, node => node.nodeName === "a" && /\.pdf(?:$|[?#])/iu.test(attribute(node, "href"))).map(node => new URL(attribute(node, "href"), edition.url).href))].sort();
	const allowed = [...documents.map(document => document.url), `${unionCandidateOrigin}/wp-content/uploads/2025/03/Find-your-Ward-and-District.pdf`].filter(url => offered.includes(url)).sort();
	if (offered.join("\n") !== allowed.join("\n")) return reject();
	documents.sort((left, right) => left.form - right.form);
	for (const document of documents) document.claims.sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
	const catalog = { edition, documents };
	return { ...catalog, sha256: hash(JSON.stringify(catalog)) };
}

export interface UnionBallotCapture { role: string; url: string; sha256: string; capturedAt: string; requestedAt: string; body: Buffer }
export interface UnionBallotAccessReview { unionRobots: string; unionPrivacy: string; countyRobots: string; countyPrivacy: string }
export interface UnionBallotCollectionOptions { request?: typeof fetchRemoteSourceDocument; now?: () => number; sleep?: (milliseconds: number) => Promise<void>; onCapture?: (capture: UnionBallotCapture) => Promise<void> }
export async function collectUnionSampleBatch(forms: number[], review: UnionBallotAccessReview, expectedCatalog: string | null, options: UnionBallotCollectionOptions = {}) {
	if (!Array.isArray(forms) || !forms.length || forms.length > 25 || forms.some(form => !Number.isSafeInteger(form) || form < 1 || form > 99) || new Set(forms).size !== forms.length) return reject();
	return collectUnionSelectedSamples(catalog => forms.map(form => catalog.documents.find(document => document.form === form) ?? reject()), review, expectedCatalog, options);
}
export async function collectUnionSampleWindow(offset: number, review: UnionBallotAccessReview, expectedCatalog: string | null, options: UnionBallotCollectionOptions = {}) {
	if (!Number.isSafeInteger(offset) || offset < 0 || offset > 98 || offset % 25 !== 0) return reject();
	return collectUnionSelectedSamples(catalog => catalog.documents.slice(offset, offset + 25), review, expectedCatalog, options);
}
async function collectUnionSelectedSamples(select: (catalog: UnionSampleCatalog) => UnionSampleDocument[], review: UnionBallotAccessReview, expectedCatalog: string | null, options: UnionBallotCollectionOptions) {
	if (!review || Object.keys(review).sort().join(",") !== "countyPrivacy,countyRobots,unionPrivacy,unionRobots" || Object.values(review).some(value => !/^[a-f0-9]{64}$/u.test(value)) || (expectedCatalog !== null && !/^[a-f0-9]{64}$/u.test(expectedCatalog))) return reject();
	const now = options.now ?? Date.now;
	const previous = new Map<string, number>();
	const captures: UnionBallotCapture[] = [];
	let total = 0;
	const start = now();
	while (now() - start < 31000) await (options.sleep ?? wait)(Math.ceil(31000 - (now() - start)));
	async function request(role: string, url: string, pdf = false) {
		const host = new URL(url).hostname;
		if (!["unioncountyvotes.com", "ucnj.org"].includes(host)) return reject();
		const earliest = (previous.get(host) ?? -Infinity) + (host === "unioncountyvotes.com" ? 31000 : 1100);
		while (now() < earliest) await (options.sleep ?? wait)(Math.ceil(earliest - now()));
		const requestedAt = new Date(now()).toISOString();
		const response = await (options.request ?? fetchRemoteSourceDocument)(url, { allowedHosts: [host], maxBytes: pdf ? 12 * 1024 * 1024 : 2 * 1024 * 1024, timeoutMs: 20000 });
		previous.set(host, now());
		if (response.status !== 200 || !response.body.length || (pdf ? !response.body.subarray(0, 5).equals(Buffer.from("%PDF-")) || !/application\/pdf/iu.test(response.contentType) : !/text\/(?:plain|html)/iu.test(response.contentType))) return reject();
		total += response.body.length;
		if (total > 64 * 1024 * 1024) return reject();
		const capture = { role, url, requestedAt, capturedAt: new Date(now()).toISOString(), sha256: hash(response.body), body: response.body };
		await options.onCapture?.(capture);
		captures.push(capture);
		return capture.body.toString("utf8");
	}
	if (unionCandidatePolicyHash(await request("union-robots", unionCandidatePolicyUrls[0]), "robots") !== review.unionRobots) return reject();
	if (unionCountyPolicyHash(await request("county-robots", unionCountyPolicyUrls[0]), "robots") !== review.countyRobots) return reject();
	unionCountyPolicyHash(await request("county-home", unionCountyPolicyUrls[1]), "home");
	if (unionCountyPolicyHash(await request("county-privacy", unionCountyPolicyUrls[2]), "privacy") !== review.countyPrivacy) return reject();
	if (unionCandidatePolicyHash(await request("union-privacy", unionCandidatePolicyUrls[1]), "privacy") !== review.unionPrivacy) return reject();
	const edition = readUnionSampleEdition(await request("sample-landing", unionSampleLandingUrl));
	const catalog = readUnionSampleCatalog(await request("sample-edition", edition.url), edition);
	if (expectedCatalog !== null && catalog.sha256 !== expectedCatalog) return reject();
	const selected = select(catalog);
	if (!selected.length || selected.length > 25) return reject();
	for (const document of selected) await request(`form-${document.form}`, document.url, true);
	return { catalog, selected, captures, imported: false, publicationApproved: false, personalApplicabilityVerified: false };
}
