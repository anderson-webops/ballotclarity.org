import type { StateCandidateRecord } from "./state-ballot-records.js";
import type { StateBallotSource } from "./state-ballot-sources.js";
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { electionDocumentPolicyFingerprint, electionDocumentRobotsPolicy } from "./election-document-collection.js";
import { fetchRemoteSourceDocument } from "./remote-json-source.js";
import { stateHtmlAttribute as attribute, stateHtmlDescendants as descendants, parseStateHtml, stateHtmlTableRows as rows, stateHtmlText } from "./state-ballot-html.js";
import { oklahomaCandidateUrl, oklahomaDiscoveryUrl, oklahomaHash, oklahomaHostingOrigin, oklahomaOrigin, oklahomaSource, readOklahomaCandidates, readOklahomaPublication, validateOklahomaCalendarUrl, validateOklahomaSource } from "./state-ballot-oklahoma.js";

const maximumBytes = 2 * 1024 * 1024;
const policyDefinitions = [
	{ id: "state-robots", url: `${oklahomaOrigin}/robots.txt`, status: 200, format: "robots", sha256: "af4db1e3153eddd7d68a0cd8134c1675c5db3c8b5464c2d1e27c2cb2243b9434" },
	{ id: "hosting-robots", url: `${oklahomaHostingOrigin}/robots.txt`, status: 404, format: "missing", sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855" },
	{ id: "policies", url: `${oklahomaOrigin}/about/policy-disclaimers.html`, status: 200, format: "region", sha256: "8be3c81c8326c33882226eff3e0e0cf532326a4cfcf8d9251f85c08c487d0389", links: "03276515b83d0da0035872239ff78a0ebc422f3fa9166a8ac3fb8c7bcd543875" },
	{ id: "privacy", url: `${oklahomaOrigin}/about/privacy-policy.html`, status: 200, format: "region", sha256: "b991d05169dea3d5377f38d238f3ea2e46d4040d81ea5d95b3f3177341d8b553", links: "bbc9b184e01d03a81aa1401abf5765891051fd97d798b51edcd8eaea07bcb6e9" },
	{ id: "linking", url: `${oklahomaOrigin}/about/linking-policy.html`, status: 200, format: "region", sha256: "8154ee20834dc3d4534e43b11a69fa3344d27c3fefc1dcef875b5d71557c1297", links: "bbc9b184e01d03a81aa1401abf5765891051fd97d798b51edcd8eaea07bcb6e9" },
	{ id: "copyright", url: `${oklahomaOrigin}/about/copyright-and-protection-acts.html`, status: 200, format: "region", sha256: "014b18335bd7a0dfa91831fe45af790d62c88b9418c76645a2df4c650a00b541", links: "f687a883bdb00383fb215a6bbdc362f506edfd885a88bc7fa6a2c290dee008ba" },
] as const;
export const oklahomaPolicyReceipts = policyDefinitions.map(({ id, url, status, sha256 }) => ({ id, url, status, sha256 }));
const policyLinks = "041626e51d2bcb9f22a31c1459f69be9239f655834bbf6314aea15d20d797484";
const exact = (value: unknown, keys: string[]): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).sort().join(",") === [...keys].sort().join(","));
const text = (node: Parameters<typeof stateHtmlText>[0]) => stateHtmlText(node).replace(/\s+/gu, " ").trim();
interface Page { url: string; status: number; body: string; sha256: string; retrievedAt: string }
export interface OklahomaElection { electionId: null; electionDate: string; pageUrl: string; oklahomaContentSha256: string }
type DocumentRequest = typeof fetchRemoteSourceDocument;

function reviewedRegion(page: Page) {
	assert(page.status === 200 && electionDocumentPolicyFingerprint(Buffer.from(page.body), "links", page.url) === policyLinks, "The Oklahoma policy-link inventory requires review.");
	const main = descendants(parseStateHtml(page.body), node => node.nodeName === "main" && attribute(node, "id") === "main");
	assert.equal(main.length, 1, "The Oklahoma calendar region requires review.");
	return main[0]!;
}

function offeredCalendars(index: Page) {
	const main = reviewedRegion(index);
	assert.equal(descendants(main, node => /^h[1-6]$/u.test(node.nodeName) && text(node) === "Next Election").length, 1);
	return descendants(main, node => node.nodeName === "a").filter(node => /Voter Information Calendar/iu.test(text(node))).map((node) => {
		const match = /^(20\d{2}) Voter Information Calendar$/u.exec(text(node));
		assert(match, "The Oklahoma calendar label requires review.");
		const url = new URL(attribute(node, "href"), oklahomaDiscoveryUrl).href;
		validateOklahomaCalendarUrl(url, match[1]!);
		return { year: match[1]!, url };
	});
}

function calendarDate(page: Page, year: string) {
	validateOklahomaCalendarUrl(page.url, year);
	const main = reviewedRegion(page);
	assert.equal(descendants(main, node => /^h[1-6]$/u.test(node.nodeName) && text(node) === `${year} Voter Information Calendar`).length, 1, "The Oklahoma calendar year requires review.");
	const tables = descendants(main, node => node.nodeName === "table");
	assert.equal(tables.length, 1);
	const tableRows = rows(tables[0]!);
	const columns = (tableRows[0]!.childNodes ?? []).filter(node => node.nodeName === "th" || node.nodeName === "td").map(text);
	assert.equal(columns.join("|"), "Election Date|Voter Registration Deadline|Absentee Ballot Deadline|Election Type|Election Day Hours|Early Voting Dates and Hours", "The Oklahoma calendar columns require review.");
	const matches = tableRows.slice(1).map(row => (row.childNodes ?? []).filter(node => node.nodeName === "td").map(text)).filter(cells => cells[3] === "General Elections");
	assert(matches.length === 1 && matches[0]!.length === 6);
	const match = /^November ([2-8]) \(1st Tuesday after 1st Monday\)$/u.exec(matches[0]![0]!);
	assert(match, "The Oklahoma general-election calendar date requires review.");
	const date = `${year}-11-0${match[1]}`;
	oklahomaSource(date);
	return date;
}

function page(value: unknown, url: string, now: number): Page {
	assert(exact(value, ["url", "status", "body", "sha256", "retrievedAt"]) && value.url === url && (value.status === 200 || (url === oklahomaCandidateUrl && value.status === 404)) && typeof value.body === "string" && Buffer.byteLength(value.body) <= maximumBytes && value.sha256 === oklahomaHash(value.body) && typeof value.retrievedAt === "string" && Number.isFinite(Date.parse(value.retrievedAt)) && new Date(value.retrievedAt).toISOString() === value.retrievedAt && Date.parse(value.retrievedAt) <= now, "The Oklahoma capture provenance requires review.");
	return value as unknown as Page;
}

export function validateOklahomaElection(value: unknown): asserts value is OklahomaElection {
	assert(exact(value, ["electionId", "electionDate", "pageUrl", "oklahomaContentSha256"]) && value.electionId === null && typeof value.electionDate === "string" && value.pageUrl === oklahomaCandidateUrl && typeof value.oklahomaContentSha256 === "string" && /^[a-f\d]{64}$/u.test(value.oklahomaContentSha256), "The Oklahoma election identity requires review.");
	oklahomaSource(value.electionDate);
}

export function readOklahomaDiscovery(body: string, now = Date.now()) {
	assert(Buffer.byteLength(body) <= 8 * maximumBytes);
	const value = JSON.parse(body);
	assert(exact(value, ["schemaVersion", "type", "policies", "index", "calendar", "candidates"]) && value.schemaVersion === 1 && value.type === "oklahoma-candidate-capture" && JSON.stringify(value.policies) === JSON.stringify(oklahomaPolicyReceipts), "The Oklahoma policy enrollment requires review.");
	const index = page(value.index, oklahomaDiscoveryUrl, now);
	const offered = offeredCalendars(index);
	assert(new Set(offered.map(item => item.year)).size === offered.length && offered.length <= 10);
	const candidates = page(value.candidates, oklahomaCandidateUrl, now);
	const publication = candidates.status === 200 ? readOklahomaPublication(candidates.body) : null;
	if (!publication || publication.month !== "NOVEMBER" || Number(publication.year) % 2) {
		assert(value.calendar === null);
		return { index, calendar: null, candidates, elections: [] as OklahomaElection[] };
	}
	const selected = offered.filter(item => item.year === publication.year);
	assert.equal(selected.length, 1, "The candidate list lacks its actually offered Oklahoma calendar.");
	const calendar = page(value.calendar, selected[0]!.url, now);
	const electionDate = calendarDate(calendar, publication.year);
	assert(Date.parse(`${publication.sourceAsOfDate}T00:00:00Z`) <= Date.parse(candidates.retrievedAt) + 86400000, "The Oklahoma publication clock is in the future.");
	const election: OklahomaElection = { electionId: null, electionDate, pageUrl: oklahomaCandidateUrl, oklahomaContentSha256: candidates.sha256 };
	validateOklahomaElection(election);
	return { index, calendar, candidates, elections: [election] };
}

export function parseOklahomaCandidateCapture(source: StateBallotSource, body: string, factory: typeof import("./state-ballot-records.js").createStateCandidateRecord, now = Date.now(), previous?: { records: readonly StateCandidateRecord[] }) {
	validateOklahomaSource(source);
	const capture = readOklahomaDiscovery(body, now);
	assert(capture.calendar && capture.elections.length === 1 && capture.elections[0]!.electionDate === source.electionDate, "The Oklahoma publication belongs to another election.");
	const result = readOklahomaCandidates(source, capture.candidates.body, factory);
	assert(!previous?.records.some(record => !result.records.some(candidate => candidate.id === record.id)), "An accepted Oklahoma candidate disappeared; retain the snapshot for review.");
	const documents = [capture.index, capture.calendar, capture.candidates].map((item, index) => ({ url: item.url, sha256: item.sha256, retrievedAt: item.retrievedAt, includedRecordCount: index === 2 ? result.records.length : 0 }));
	return { ...result, retrievedAt: new Date(Math.min(...documents.map(document => Date.parse(document.retrievedAt)))).toISOString(), sha256: capture.candidates.sha256, collectionIndexSha256: capture.candidates.sha256, documents };
}

export async function fetchOklahomaCycleDiscovery(options: { request?: DocumentRequest; wait?: (milliseconds: number) => Promise<void>; now?: () => number } = {}) {
	const request = options.request ?? fetchRemoteSourceDocument;
	const wait = options.wait ?? (milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds)));
	const now = options.now ?? Date.now;
	let robots: ReturnType<typeof electionDocumentRobotsPolicy> | undefined;
	let fetched = false;
	const get = async (url: string): Promise<Page> => {
		const host = new URL(url).hostname;
		assert(["oklahoma.gov", "hosting.okelections.gov"].includes(host));
		if (host === "oklahoma.gov" && robots) assert(robots.allowed(url), "The Oklahoma robots policy denies this publication.");
		if (fetched) await wait(Math.max(20000, robots?.delay ?? 0));
		fetched = true;
		const response = await request(url, { allowedHosts: [host], maxBytes: maximumBytes, timeoutMs: 25000 });
		const body = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(response.body);
		assert(response.status === 200 || ((url === `${oklahomaHostingOrigin}/robots.txt` || url === oklahomaCandidateUrl) && response.status === 404), "The Oklahoma publisher response requires review.");
		return { url, status: response.status, body, sha256: oklahomaHash(body), retrievedAt: new Date(now()).toISOString() };
	};
	for (const policy of policyDefinitions) {
		const captured = await get(policy.url);
		assert(captured.status === policy.status && (policy.format === "missing" ? !captured.body && captured.sha256 === policy.sha256 : electionDocumentPolicyFingerprint(Buffer.from(captured.body), policy.format, policy.url, policy.format === "region" ? "main" : undefined) === policy.sha256), "The Oklahoma publisher policy requires review.");
		if ("links" in policy) assert.equal(electionDocumentPolicyFingerprint(Buffer.from(captured.body), "links", policy.url), policy.links, "The Oklahoma policy links require review.");
		if (policy.id === "state-robots") robots = electionDocumentRobotsPolicy(Buffer.from(captured.body));
	}
	const index = await get(oklahomaDiscoveryUrl);
	const offered = offeredCalendars(index);
	const candidates = await get(oklahomaCandidateUrl);
	const identity = candidates.status === 200 ? readOklahomaPublication(candidates.body) : null;
	let calendar: Page | null = null;
	if (identity?.month === "NOVEMBER" && !(Number(identity.year) % 2)) {
		const selected = offered.filter(item => item.year === identity.year);
		assert.equal(selected.length, 1, "The Oklahoma list lacks its offered calendar.");
		calendar = await get(selected[0]!.url);
	}
	const body = JSON.stringify({ schemaVersion: 1, type: "oklahoma-candidate-capture", policies: oklahomaPolicyReceipts, index, calendar, candidates });
	readOklahomaDiscovery(body, now());
	return body;
}

export async function fetchOklahomaCandidateCapture(source: StateBallotSource, options: Parameters<typeof fetchOklahomaCycleDiscovery>[0] & { discovery?: string } = {}) {
	validateOklahomaSource(source);
	const body = options.discovery ?? await fetchOklahomaCycleDiscovery(options);
	assert(readOklahomaDiscovery(body, (options.now ?? Date.now)()).elections.some(election => election.electionDate === source.electionDate), "The Oklahoma candidate publication is unavailable for this election.");
	return body;
}
