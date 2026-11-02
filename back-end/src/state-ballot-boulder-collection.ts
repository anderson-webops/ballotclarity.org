import type { StateCandidateRecord } from "./state-ballot-records.js";
import type { StateBallotSource } from "./state-ballot-sources.js";
import { Buffer } from "node:buffer";
import { electionDocumentPolicyFingerprint, electionDocumentRobotsPolicy } from "./election-document-collection.js";
import { fetchRemoteSourceText } from "./remote-json-source.js";
import { boulderBallotIndexUrl, boulderDiscoveryUrl, boulderHash, boulderOrigin, boulderPrivacyUrl, readBoulderCandidates, validateBoulderCandidateUrl, validateBoulderSource } from "./state-ballot-boulder.js";
import { stateHtmlAttribute as attribute, stateHtmlDescendants as descendants, parseStateHtml, stateHtmlText } from "./state-ballot-html.js";
import { StateBallotAwaitingRecordsError } from "./state-ballot-source-state.js";

const maximumBytes = 1024 * 1024;
const linksSha256 = "738ea76ef4bf660d3bc6f6ac16eb1414231666e0a60c336e5c37d4d9d5c8c64f";
const exact = (value: unknown, keys: string[]): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).sort().join(",") === [...keys].sort().join(","));
const clean = (value: string) => value.normalize("NFKC").replace(/\s+/gu, " ").trim();
const text = (node: Parameters<typeof stateHtmlText>[0]) => clean(stateHtmlText(node));
const policyPages = [
	{ id: "robots", url: `${boulderOrigin}/robots.txt`, format: "robots", sha256: "905468e53631eb69f22cb6ea86bef6854f5f30c6f86dbdf7cc1a7b254034e2ef" },
	{ id: "privacy", url: boulderPrivacyUrl, format: "region", sha256: "cfada3085d833306d3c101fc636a5008d73779ff5d2ac7c6a6bcbed37108cc13" },
] as const;
export const boulderPolicyReceipts = policyPages.map(({ id, url, sha256 }) => ({ id, url, sha256 }));
type TextRequest = (url: string, options: { allowedHosts: string[]; maxBytes: number; maxRedirects: number; timeoutMs: number }) => Promise<string>;
interface Page { url: string; body: string; sha256: string; retrievedAt: string }
export interface BoulderElection { electionId: null; electionDate: string; pageUrl: string | null; boulderContentSha256: string | null }
function reject(): never {
	throw new Error("The Boulder County publication, policy or election identity requires review.");
}

function reviewedPage(body: string, url: string) {
	if (Buffer.byteLength(body) > maximumBytes || electionDocumentPolicyFingerprint(Buffer.from(body), "links", url) !== linksSha256) return reject();
	const tree = parseStateHtml(body);
	const regions = descendants(tree, node => attribute(node, "id") === "content");
	if (regions.length !== 1) return reject();
	return regions[0]!;
}

export function validateBoulderElection(value: unknown): asserts value is BoulderElection {
	if (!exact(value, ["electionId", "electionDate", "pageUrl", "boulderContentSha256"]) || value.electionId !== null || typeof value.electionDate !== "string" || !/^20\d{2}-11-0[2-8]$/u.test(value.electionDate) || value.electionDate < "2026-11-03" || Number(value.electionDate.slice(0, 4)) % 2 || new Date(`${value.electionDate}T00:00:00Z`).getUTCDay() !== 2) return reject();
	if (value.pageUrl === null) {
		if (value.boulderContentSha256 !== null) return reject();
	}
	else {
		if (typeof value.pageUrl !== "string" || typeof value.boulderContentSha256 !== "string" || !/^[a-f\d]{64}$/u.test(value.boulderContentSha256)) return reject();
		validateBoulderCandidateUrl(value.pageUrl, value.electionDate);
	}
}

function offeredElection(index: string, ballotIndex: string) {
	const region = reviewedPage(index, boulderDiscoveryUrl);
	const titles = descendants(region, node => node.nodeName === "h1" && text(node).endsWith("General Election Information"));
	const match = titles.length === 1 ? /^(?:Nov\.|November) ([2-8]), (20\d{2}) General Election Information$/u.exec(text(titles[0]!)) : null;
	if (!match || !descendants(region, node => node.nodeName === "a" && new URL(attribute(node, "href"), boulderDiscoveryUrl).href === boulderBallotIndexUrl).length) return reject();
	const electionDate = `${match[2]}-11-0${match[1]}`;
	const links = descendants(reviewedPage(ballotIndex, boulderBallotIndexUrl), node => node.nodeName === "a" && /general-election-candidates-and-ballot-measures/u.test(attribute(node, "href")));
	const offered: string[] = [];
	for (const link of links) {
		const url = new URL(attribute(link, "href"), boulderBallotIndexUrl).href;
		const title = /^(20\d{2}) General Election Candidates and Ballot Measures$/u.exec(text(link));
		if (!title || Number(title[1]) > Number(match[2])) return reject();
		validateBoulderCandidateUrl(url, `${title[1]}-11-03`);
		if (title[1] === match[2]) offered.push(url);
	}
	if (offered.length > 1) return reject();
	return { electionDate, pageUrl: offered[0] ?? null };
}

function capturedPage(value: unknown, url: string, now: number): Page {
	if (!exact(value, ["url", "body", "sha256", "retrievedAt"]) || value.url !== url || typeof value.body !== "string" || Buffer.byteLength(value.body) > maximumBytes || value.sha256 !== boulderHash(value.body) || typeof value.retrievedAt !== "string" || !Number.isFinite(Date.parse(value.retrievedAt)) || new Date(value.retrievedAt).toISOString() !== value.retrievedAt || Date.parse(value.retrievedAt) > now) return reject();
	return value as unknown as Page;
}

export function readBoulderDiscovery(body: string, now = Date.now()) {
	if (Buffer.byteLength(body) > 8 * maximumBytes) return reject();
	const value = JSON.parse(body);
	if (!exact(value, ["schemaVersion", "type", "policies", "index", "ballotIndex", "candidates"]) || value.schemaVersion !== 1 || value.type !== "boulder-candidate-capture" || JSON.stringify(value.policies) !== JSON.stringify(boulderPolicyReceipts)) return reject();
	const index = capturedPage(value.index, boulderDiscoveryUrl, now);
	const ballotIndex = capturedPage(value.ballotIndex, boulderBallotIndexUrl, now);
	const offered = offeredElection(index.body, ballotIndex.body);
	const candidates = offered.pageUrl ? capturedPage(value.candidates, offered.pageUrl, now) : null;
	if ((!offered.pageUrl && value.candidates !== null) || Date.parse(ballotIndex.retrievedAt) < Date.parse(index.retrievedAt) || (candidates && Date.parse(candidates.retrievedAt) < Date.parse(ballotIndex.retrievedAt))) return reject();
	const election: BoulderElection = { electionId: null, ...offered, boulderContentSha256: candidates?.sha256 ?? null };
	validateBoulderElection(election);
	if (candidates) reviewedPage(candidates.body, candidates.url);
	if (!candidates && election.electionDate <= new Date(now).toISOString().slice(0, 10)) return reject();
	return { election, index, ballotIndex, candidates };
}

export function parseBoulderCandidateCapture(source: StateBallotSource, body: string, factory: typeof import("./state-ballot-records.js").createStateCandidateRecord, now = Date.now(), previous?: { records: readonly StateCandidateRecord[] }) {
	validateBoulderSource(source);
	const capture = readBoulderDiscovery(body, now);
	if (capture.election.electionDate !== source.electionDate) return reject();
	if (!capture.candidates) {
		if (previous?.records.length) return reject();
		throw new StateBallotAwaitingRecordsError(source.id);
	}
	const page = capture.candidates;
	const records = readBoulderCandidates(source, page.body, factory);
	if (previous?.records.some(record => !records.some(candidate => candidate.id === record.id))) return reject();
	return { records, retrievedAt: page.retrievedAt, sha256: page.sha256, collectionIndexSha256: page.sha256, documents: [{ url: page.url, sha256: page.sha256, retrievedAt: page.retrievedAt, includedRecordCount: records.length }] };
}

export async function fetchBoulderCycleDiscovery(options: { requestText?: TextRequest; wait?: (milliseconds: number) => Promise<void>; now?: () => number } = {}) {
	const request = options.requestText ?? fetchRemoteSourceText;
	const wait = options.wait ?? (milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds)));
	const now = options.now ?? Date.now;
	const transport = { allowedHosts: ["bouldercounty.gov"], maxBytes: maximumBytes, maxRedirects: 0, timeoutMs: 25000 };
	let robots: ReturnType<typeof electionDocumentRobotsPolicy> | undefined;
	const get = async (url: string) => {
		if (robots) {
			if (!robots.allowed(url)) return reject();
			await wait(Math.max(20_000, robots.delay));
		}
		const body = await request(url, transport);
		return { url, body, sha256: boulderHash(body), retrievedAt: new Date(now()).toISOString() };
	};
	for (const policy of policyPages) {
		const page = await get(policy.url);
		if (electionDocumentPolicyFingerprint(Buffer.from(page.body), policy.format, policy.url, policy.format === "region" ? "content" : undefined) !== policy.sha256) return reject();
		if (policy.id === "privacy" && electionDocumentPolicyFingerprint(Buffer.from(page.body), "links", policy.url) !== "a82babaa6b972ba52c76d38a43fe2770587ea984a7f938a8b7c6d299d3947cfb") return reject();
		if (policy.format === "robots") robots = electionDocumentRobotsPolicy(Buffer.from(page.body));
	}
	const index = await get(boulderDiscoveryUrl);
	const ballotIndex = await get(boulderBallotIndexUrl);
	const offered = offeredElection(index.body, ballotIndex.body);
	const candidates = offered.pageUrl ? await get(offered.pageUrl) : null;
	const body = JSON.stringify({ schemaVersion: 1, type: "boulder-candidate-capture", policies: boulderPolicyReceipts, index, ballotIndex, candidates });
	readBoulderDiscovery(body, now());
	return body;
}

export async function fetchBoulderCandidateCapture(source: StateBallotSource, options: Parameters<typeof fetchBoulderCycleDiscovery>[0] & { discovery?: string } = {}) {
	validateBoulderSource(source);
	const body = options.discovery ?? await fetchBoulderCycleDiscovery(options);
	if (readBoulderDiscovery(body, (options.now ?? Date.now)()).election.electionDate !== source.electionDate) return reject();
	return body;
}
