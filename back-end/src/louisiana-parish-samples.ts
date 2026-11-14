import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { setTimeout } from "node:timers/promises";
import { electionDocumentPolicyFingerprint, electionDocumentRobotsPolicy } from "./election-document-collection.js";
import { fetchRemoteSourceDocument } from "./remote-json-source.js";
import { parseStateHtml, stateHtmlAttribute, stateHtmlDescendants, stateHtmlText } from "./state-ballot-html.js";

export const parishSampleOrigin = "https://powercoalition.org";
export const parishSampleIndexUrl = `${parishSampleOrigin}/sampleballots/`;
export const parishSamplePolicyUrls = [`${parishSampleOrigin}/robots.txt`, `${parishSampleOrigin}/privacy-policy/`, `${parishSampleOrigin}/terms-of-service/`] as const;
export const parishSampleHash = (body: string | Uint8Array) => createHash("sha256").update(body).digest("hex");
const clean = (text: string) => text.replace(/\s+/gu, " ").trim();
const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const maximumBytes = 12 * 1024 * 1024;
const parishNames = "Acadia|Allen|Ascension|Assumption|Avoyelles|Beauregard|Bienville|Bossier|Caddo|Calcasieu|Caldwell|Cameron|Catahoula|Claiborne|Concordia|De Soto|East Baton Rouge|East Carroll|East Feliciana|Evangeline|Franklin|Grant|Iberia|Iberville|Jackson|Jefferson|Jefferson Davis|Lafayette|Lafourche|La Salle|Lincoln|Livingston|Madison|Morehouse|Natchitoches|Orleans|Ouachita|Plaquemines|Pointe Coupee|Rapides|Red River|Richland|Sabine|St Bernard|St Charles|St Helena|St James|St John the Baptist|St Landry|St Martin|St Mary|St Tammany|Tangipahoa|Tensas|Terrebonne|Union|Vermilion|Vernon|Washington|Webster|West Baton Rouge|West Carroll|West Feliciana|Winn".split("|");

export interface ParishSampleAccessReview {
	robots: string;
	privacy: string;
	terms: string;
	secureNavigation: "upgrade-insecure-requests";
}

export function parishSamplePolicyHash(body: Buffer, url: string) {
	return electionDocumentPolicyFingerprint(body, url.endsWith("robots.txt") ? "robots" : "region", url, undefined, url.endsWith("robots.txt") ? undefined : "entry-content");
}

function content(body: string) {
	if (!body.trim() || Buffer.byteLength(body) > 3 * 1024 * 1024 || body.includes("\uFFFD")) throw new Error("Parish sample index requires review.");
	const tree = parseStateHtml(body);
	const regions = stateHtmlDescendants(tree, node => stateHtmlAttribute(node, "class").split(/\s+/u).includes("entry-content"));
	if (regions.length !== 1) throw new Error("Parish sample index layout changed.");
	const policies = stateHtmlDescendants(tree, node => node.nodeName === "a").filter(node => /privacy|terms|copyright|legal/iu.test(stateHtmlAttribute(node, "href") + stateHtmlText(node))).map(node => new URL(stateHtmlAttribute(node, "href"), parishSampleIndexUrl).href);
	if (policies.some(url => ![...parishSamplePolicyUrls, `${parishSampleOrigin}/privacy-policy`, `${parishSampleOrigin}/terms-of-service`, "https://www.constantcontact.com/legal/about-constant-contact"].includes(url))) throw new Error("Parish publisher policy links changed.");
	return regions[0]!;
}

export function parishSampleDownloadControl(value: string) {
	const url = new URL(value);
	if (url.origin !== parishSampleOrigin || url.username || url.password || url.port || url.hash || url.pathname !== "/" || url.href !== value || !/^\?sdm_process_download=1&download_id=[1-9]\d{0,8}$/u.test(url.search)) throw new Error("Parish download control requires review.");
	return value;
}

export function readParishSampleIndex(body: string) {
	const region = content(body);
	const headings = stateHtmlDescendants(region, node => node.nodeName === "h1").map(node => ({ node, text: clean(stateHtmlText(node)) })).filter(item => /^[A-Z][a-z]+ \d{1,2}, 20\d{2} /u.test(item.text));
	if (headings.length !== 1) throw new Error("Parish election heading is ambiguous.");
	const heading = /^([A-Za-z]+) (\d{1,2}), (20\d{2}) (U\.S\. Representative Runoff & Municipal General)$/u.exec(headings[0]!.text);
	if (!heading) throw new Error("Parish election type requires review.");
	const electionDate = `${heading[3]}-${String(months.indexOf(heading[1]!) + 1).padStart(2, "0")}-${String(heading[2]).padStart(2, "0")}`;
	if (!Number.isFinite(Date.parse(electionDate)) || new Date(electionDate).toISOString().slice(0, 10) !== electionDate) throw new Error("Parish election date is invalid.");
	let active = false;
	const links: { parish: string; downloadUrl: string | null; issue: string | null }[] = [];
	for (const node of stateHtmlDescendants(region, node => node.nodeName === "h1" || node.nodeName === "a")) {
		if (node.nodeName === "h1") {
			active = node === headings[0]!.node;
			continue;
		}
		if (!active) continue;
		const label = clean(stateHtmlText(node)).replace(/ \(opens in a new tab\)$/u, "");
		const parish = label === "Lasalle" ? "La Salle" : label;
		if (!parishNames.includes(parish)) throw new Error("Parish election section contains an unrecognized link.");
		let downloadUrl: string | null = null;
		try {
			downloadUrl = parishSampleDownloadControl(new URL(stateHtmlAttribute(node, "href"), parishSampleIndexUrl).href);
		}
		catch { downloadUrl = null; }
		links.push({ parish, downloadUrl, issue: downloadUrl ? null : "download-link-unavailable" });
	}
	if (!links.length || links.length > 64 || new Set(links.map(item => item.parish)).size !== links.length || new Set(links.flatMap(item => item.downloadUrl ? [item.downloadUrl] : [])).size !== links.filter(item => item.downloadUrl).length) throw new Error("Parish publication inventory is inconsistent.");
	return { electionDate, electionLabel: heading[4]!, links };
}

function upgradePolicy(value: string | undefined) {
	return Boolean(value && value.split(";").some(part => part.trim() === "upgrade-insecure-requests"));
}

export function resolveParishSampleDocument(location: string, electionDate: string, indexPolicy: string | undefined, responsePolicy: string | undefined) {
	const url = new URL(location);
	if (!["http:", "https:"].includes(url.protocol) || url.hostname !== "powercoalition.org" || url.username || url.password || url.port || url.search || url.hash || url.href !== location || !/^\/wp-content\/uploads\/20\d{2}\/\d{2}\/[A-Za-z0-9-]+-Sample-?Ballot-Printable-[A-Z]{3}-20\d{2}(?:-\d+)?\.pdf$/u.test(url.pathname) || !url.pathname.includes(`-${electionDate.slice(0, 4)}`)) throw new Error("Parish document redirect requires review.");
	if (url.protocol === "http:") {
		if (!upgradePolicy(indexPolicy) || !upgradePolicy(responsePolicy)) throw new Error("Parish secure navigation policy is unavailable.");
		url.protocol = "https:";
	}
	return url.href;
}

export interface ParishSampleCapture {
	url: string;
	body: Buffer;
	sha256: string;
	capturedAt: string;
	contentSecurityPolicy?: string;
}

export class ParishSamplePersistenceError extends Error {}

interface ParishSampleNavigation {
	location: string;
	contentSecurityPolicy?: string;
	capturedAt: string;
}

export async function collectParishSampleBatch(parishes: string[], accessReview: ParishSampleAccessReview, options: { now?: () => number; sleep?: (milliseconds: number) => Promise<unknown>; fetchDocument?: typeof fetchRemoteSourceDocument; onCapture?: (capture: ParishSampleCapture) => Promise<void> } = {}) {
	if (!parishes.length || parishes.length > 25 || new Set(parishes).size !== parishes.length || parishes.some(parish => !parishNames.includes(parish)) || accessReview.secureNavigation !== "upgrade-insecure-requests" || [accessReview.robots, accessReview.privacy, accessReview.terms].some(value => !/^[a-f\d]{64}$/u.test(value))) throw new Error("Provide at most 25 explicitly selected parishes and a reviewed publisher policy.");
	const captures: ParishSampleCapture[] = [];
	async function retain(capture: ParishSampleCapture) {
		if (captures.reduce((total, item) => total + item.body.length, 0) + capture.body.length > 64 * 1024 * 1024) throw new ParishSamplePersistenceError("Parish batch exceeds its 64 MiB evidence bound.");
		try {
			await options.onCapture?.(capture);
		}
		catch { throw new ParishSamplePersistenceError("Parish evidence persistence failed; retain the interrupted intake for review."); }
		captures.push(capture);
	}
	const now = options.now ?? Date.now;
	const sleep = options.sleep ?? setTimeout;
	let lastRequest = now();
	let delay = 11000;
	let allowed = (_url: string) => true;
	async function request(url: string) {
		if (!allowed(url)) throw new Error("Parish publisher robots policy excludes this request.");
		const wait = Math.max(0, lastRequest + delay - now());
		if (wait) await sleep(wait);
		lastRequest = now();
		const response = await (options.fetchDocument ?? fetchRemoteSourceDocument)(url, { allowedHosts: ["powercoalition.org"], maxBytes: maximumBytes, timeoutMs: 20000 });
		const capturedAt = new Date(now()).toISOString();
		return { response, capturedAt };
	}
	for (const [index, url] of parishSamplePolicyUrls.entries()) {
		const { response, capturedAt } = await request(url);
		if (response.status !== 200 || parishSamplePolicyHash(response.body, url) !== [accessReview.robots, accessReview.privacy, accessReview.terms][index]) throw new Error("Parish publisher access policy changed or is unavailable.");
		if (!index) {
			const policy = electionDocumentRobotsPolicy(response.body);
			allowed = policy.allowed;
			delay = Math.max(delay, policy.delay);
		}
		await retain({ url, body: response.body, sha256: parishSampleHash(response.body), capturedAt });
	}
	const { response: indexResponse, capturedAt } = await request(parishSampleIndexUrl);
	if (indexResponse.status !== 200 || indexResponse.contentType !== "text/html" || !upgradePolicy(indexResponse.contentSecurityPolicy)) throw new Error("Parish sample index or secure navigation policy is unavailable.");
	const catalog = readParishSampleIndex(new TextDecoder("utf-8", { fatal: true }).decode(indexResponse.body));
	await retain({ url: parishSampleIndexUrl, body: indexResponse.body, sha256: parishSampleHash(indexResponse.body), capturedAt, contentSecurityPolicy: indexResponse.contentSecurityPolicy });
	const results: { parish: string; status: "collected" | "held"; downloadUrl: string | null; documentUrl?: string; sha256?: string; capturedAt?: string; reason?: string; navigation?: ParishSampleNavigation }[] = [];
	let publisherHeld = false;
	for (const parish of parishes) {
		const offered = catalog.links.find(link => link.parish === parish);
		if (publisherHeld) {
			results.push({ parish, status: "held", downloadUrl: offered?.downloadUrl ?? null, reason: "publisher-access-or-capacity-held" });
			continue;
		}
		if (!offered?.downloadUrl) {
			results.push({ parish, status: "held", downloadUrl: offered?.downloadUrl ?? null, reason: offered?.issue ?? "parish-not-offered" });
			continue;
		}
		let navigation: ParishSampleNavigation | undefined;
		try {
			const redirect = await request(offered.downloadUrl);
			if ([401, 403, 429].includes(redirect.response.status)) publisherHeld = true;
			if (redirect.response.status !== 302 || !redirect.response.location) throw new Error("Parish download control changed or is unavailable.");
			const location = new URL(redirect.response.location);
			if (["http:", "https:"].includes(location.protocol) && location.hostname === "powercoalition.org" && !location.username && !location.password && !location.port && !location.search && !location.hash && location.pathname.startsWith("/wp-content/uploads/")) navigation = { location: redirect.response.location, contentSecurityPolicy: redirect.response.contentSecurityPolicy, capturedAt: redirect.capturedAt };
			const documentUrl = resolveParishSampleDocument(redirect.response.location, catalog.electionDate, indexResponse.contentSecurityPolicy, redirect.response.contentSecurityPolicy);
			const { response, capturedAt } = await request(documentUrl);
			if ([401, 403, 429].includes(response.status)) publisherHeld = true;
			if (response.status !== 200 || response.contentType !== "application/pdf" || !response.body.subarray(0, 5).equals(Buffer.from("%PDF-"))) throw new Error("Parish sample PDF is unavailable.");
			if (captures.reduce((total, capture) => total + capture.body.length, 0) + response.body.length > 64 * 1024 * 1024) {
				publisherHeld = true;
				throw new Error("Parish batch exceeds its 64 MiB evidence bound.");
			}
			const sha256 = parishSampleHash(response.body);
			await retain({ url: documentUrl, body: response.body, sha256, capturedAt });
			results.push({ parish, status: "collected", downloadUrl: offered.downloadUrl, documentUrl, sha256, capturedAt, navigation });
		}
		catch (error) {
			if (error instanceof ParishSamplePersistenceError) throw error;
			results.push({ parish, status: "held", downloadUrl: offered.downloadUrl, reason: error instanceof Error ? error.message : "Parish collection requires review.", ...(navigation ? { navigation } : {}) });
		}
	}
	return { schemaVersion: 1, type: "louisiana-parish-sample-research-capture", publisher: "Power Coalition for Equity and Justice", official: false, catalog, captures, results, automaticImportApproved: false, publicationApproved: false };
}

export function readParishCandidateReferences(text: string, parish: string, electionDate: string) {
	const date = /^(20\d{2})-(\d{2})-(\d{2})$/u.exec(electionDate);
	if (!date || !parishNames.includes(parish) || Buffer.byteLength(text) > 4 * 1024 * 1024 || /[^\P{Cc}\n\r\t\f]/u.test(text)) throw new Error("Parish candidate evidence requires review.");
	const compact = text.replace(/\s+/gu, "").toLowerCase();
	const dateLabel = `${months[Number(date[2]) - 1]}${Number(date[3])},${date[1]}`.toLowerCase();
	const label = parish.replace(/\s+/gu, "").toLowerCase();
	if (!compact.includes(dateLabel) || ![`${label}sampleballot`, `${label}parishsampleballot`].some(title => compact.includes(title)) || !["u.s.representativerunoff", "municipalgeneral"].some(title => compact.includes(title))) throw new Error("Parish sample identity or election date changed.");
	const pages = text.split("\f");
	if (!pages.at(-1)?.trim()) pages.pop();
	if (!pages.length || pages.length > 50) throw new Error("Parish sample page bound exceeded.");
	const records: { id: string; name: string; office: string; statedParty: string; sourcePage: number; voteFor?: number }[] = [];
	for (const [pageIndex, page] of pages.entries()) {
		let office = "";
		let adjacent = false;
		let headingOpen = false;
		let continuationLines = 0;
		let voteFor: number | undefined;
		let precedingJurisdiction = "";
		for (const line of page.split(/\r?\n/u).map(clean).filter(Boolean)) {
			if (/^(?:U\.\s*S\.\s*Representative|State Senator|Mayor|Alderm[ae]n(?: at Large)?|Councilm[ae]n(?: at Large)?|Councilwoman|Council ?[Mm]ember(?:\(s\))?(?: at Large)?|Chief of Police|Member of School Board|Justice of the Peace|Constable(?: Justice of the Peace)?|District Judge|City Judge|City Marshal|Judge|District Attorney|Assessor|Sheriff|Clerk of Court|Police Juror)(?:,| (?:District|Ward)\b)/u.test(line) && line.length <= 180) {
				office = precedingJurisdiction && !line.includes(precedingJurisdiction) ? `${line}, ${precedingJurisdiction}` : line;
				precedingJurisdiction = "";
				adjacent = true;
				headingOpen = true;
				continuationLines = 0;
				voteFor = undefined;
				continue;
			}
			const limit = /^([1-9]\d?) to be elected$/u.exec(line);
			if (headingOpen && limit && voteFor === undefined) {
				voteFor = Number(limit[1]);
				continue;
			}
			if (headingOpen && continuationLines < 2 && ((office.endsWith(",") && (/^(?:City|Town|Village) of [\p{L} .’'-]{1,80}$/u.test(line) || /^[1-9]\d?(?:st|nd|rd|th) Just\.Court$/u.test(line))) || (/^District Judge,.*Judicial District$/u.test(office) && /^Court,\s*(?:ES [1-9]\d?,\s*)?(?:Division [A-Z0-9]+|Div\.[A-Z])$/u.test(line)) || (/^District Judge,.*Judicial District Court,$/u.test(office) && /^ES [1-9]\d?,\s*Div\.[A-Z]$/u.test(line)))) {
				office += ` ${line}`;
				continuationLines++;
				continue;
			}
			if (/^(?:City|Town|Village) of [\p{L} .’'-]{1,80}$/u.test(line)) {
				precedingJurisdiction = line;
				adjacent = false;
				headingOpen = false;
				continue;
			}
			if (/^■\s*Yes\s*■\s*No$/u.test(line)) {
				adjacent = false;
				continue;
			}
			if (line.startsWith("■")) {
				const row = /^■\s*([\p{L}‘'"’][\p{L}\p{M}\d .,'’‘()"-]{0,120}?)\s*[–-]\s*(Democrat|Republican|No Party|Libertarian|Green|Other)(?:, [^,]{1,50}, (?:Male|Female))?$/u.exec(line);
				if (!row || !office || !adjacent) throw new Error("Parish candidate row or office association requires review.");
				const name = row[1]!.trim();
				const statedParty = row[2]!;
				records.push({ id: parishSampleHash(`${parish}\n${electionDate}\n${office}\n${name}\n${statedParty}`).slice(0, 24), name, office, statedParty, sourcePage: pageIndex + 1, ...(voteFor === undefined ? {} : { voteFor }) });
				headingOpen = false;
				continue;
			}
			adjacent = false;
			headingOpen = false;
			precedingJurisdiction = "";
		}
	}
	if (records.length > 1000 || new Set(records.map(record => record.id)).size !== records.length) throw new Error("Parish candidate inventory is inconsistent.");
	return records;
}
