import type { BooneElection } from "./state-ballot-boone-discovery.js";
import type { StateBallotSnapshot } from "./state-ballot-repository.js";
import type { StateBallotSource } from "./state-ballot-sources.js";
import type { StateBallotWorkbookSheet } from "./state-ballot-workbook.js";
import { Buffer } from "node:buffer";
import { setTimeout as wait } from "node:timers/promises";
import { electionDocumentRobotsPolicy } from "./election-document-collection.js";
import { fetchRemoteSourceDocument } from "./remote-json-source.js";
import { booneDiscoveryUrl, booneDocumentDigest, booneHash, booneOrigin, boonePolicyFingerprint, boonePolicySha256, booneRobotsSha256, readBooneBallotDate, readBooneCandidateIndex, validateBooneElection, validateBooneSource } from "./state-ballot-boone-discovery.js";
import { parseBooneCandidateSheets } from "./state-ballot-boone-native.js";
import { extractStateBallotPdfText, resolveStateBallotPdfExtractor } from "./state-ballot-pdf.js";

import { StateBallotAwaitingRecordsError } from "./state-ballot-source-state.js";
import { readStateBallotWorkbook } from "./state-ballot-workbook.js";

const exact = (value: unknown, keys: string[]): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).sort().join("|") === [...keys].sort().join("|"));
const digest = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
function reject(): never {
	throw new Error("The Boone County candidate publication requires review.");
}
interface Page { url: string; body: string; sha256: string; retrievedAt: string }
interface Offer { year: string; workbookUrl: string; ballotUrl?: string }
interface Document { year: string; role: "workbook" | "ballots"; url: string; status: 200 | 404; sha256: string; retrievedAt: string; rows?: StateBallotWorkbookSheet["data"]; text?: string }
interface Options { request?: typeof fetchRemoteSourceDocument; now?: () => number; sleep?: (milliseconds: number) => Promise<void>; discovery?: string; readWorkbook?: typeof readStateBallotWorkbook; extractBallots?: (bytes: Buffer) => Promise<string>; onResponse?: (url: string, response: Awaited<ReturnType<typeof fetchRemoteSourceDocument>>) => Promise<void> }
function instant(value: unknown, now: number): value is string {
	return typeof value === "string" && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value && Date.parse(value) <= now;
}
function page(value: unknown, url: string, now: number): Page {
	if (!exact(value, ["url", "body", "sha256", "retrievedAt"]) || value.url !== url || typeof value.body !== "string" || Buffer.byteLength(value.body) > 2 * 1024 * 1024 || value.sha256 !== booneHash(value.body) || !instant(value.retrievedAt, now)) return reject();
	return value as unknown as Page;
}
function workbook(rows: unknown) {
	if (!Array.isArray(rows) || !rows.length || rows.length > 2000 || JSON.stringify(rows[0]) !== JSON.stringify(["Candidate Name", null, "Office", "Party"])) return reject();
	const data = rows.map((row, index) => {
		if (!Array.isArray(row) || row.length > 4 || row.some(value => value !== null && typeof value !== "string")) return reject();
		return index === 0 ? [...row, "Address", "Contact"] : [...Array.from({ length: 4 }, (_, column) => row[column] ?? null), null, null];
	});
	return parseBooneCandidateSheets([{ sheet: "Sheet1", data }], { allowEmpty: true });
}
function capturedDocument(value: unknown, offer: Offer, role: Document["role"], now: number): Document {
	const available = Boolean(value && typeof value === "object" && "status" in value && value.status === 200);
	const fields = ["year", "role", "url", "status", "sha256", "retrievedAt", ...(available ? [role === "workbook" ? "rows" : "text"] : [])];
	if (!exact(value, fields) || value.year !== offer.year || value.role !== role || value.url !== (role === "workbook" ? offer.workbookUrl : offer.ballotUrl) || (value.status !== 200 && value.status !== 404) || !digest(value.sha256) || !instant(value.retrievedAt, now)) return reject();
	if (available && role === "workbook") workbook(value.rows);
	if (available && role === "ballots") {
		if (typeof value.text !== "string") return reject();
		readBooneBallotDate(value.text, offer.year);
	}
	return value as unknown as Document;
}
export function readBooneDiscovery(body: string, now = Date.now()) {
	if (Buffer.byteLength(body) > 24 * 1024 * 1024) return reject();
	const value: unknown = JSON.parse(body);
	if (!exact(value, ["schemaVersion", "type", "robots", "home", "index", "documents"]) || value.schemaVersion !== 1 || value.type !== "boone-candidate-discovery" || !Array.isArray(value.documents)) return reject();
	const robots = page(value.robots, `${booneOrigin}/robots.txt`, now);
	if (robots.sha256 !== booneRobotsSha256) return reject();
	const home = page(value.home, `${booneOrigin}/`, now);
	const index = page(value.index, booneDiscoveryUrl, now);
	if ([home, index].some(item => boonePolicyFingerprint(item.body) !== boonePolicySha256)) return reject();
	const policy = electionDocumentRobotsPolicy(Buffer.from(robots.body), [], [], true);
	const offers = readBooneCandidateIndex(index.body);
	if (value.documents.length !== offers.reduce((count, offer) => count + (offer.ballotUrl ? 2 : 1), 0)) return reject();
	const documents: Document[] = [];
	const elections: BooneElection[] = [];
	let offset = 0;
	for (const offer of offers) {
		if (!policy.allowed(offer.workbookUrl) || (offer.ballotUrl && !policy.allowed(offer.ballotUrl))) return reject();
		const candidates = capturedDocument(value.documents[offset++], offer, "workbook", now);
		documents.push(candidates);
		if (!offer.ballotUrl) continue;
		const ballots = capturedDocument(value.documents[offset++], offer, "ballots", now);
		documents.push(ballots);
		if (ballots.status === 404) continue;
		const election = { electionId: null, electionDate: readBooneBallotDate(ballots.text!, offer.year), pageUrl: booneDiscoveryUrl, booneDocuments: [candidates, ballots].map(({ url, sha256, status }) => ({ url, sha256, status })) } satisfies BooneElection;
		validateBooneElection(election);
		elections.push(election);
	}
	return { index, offers, documents, elections };
}
export async function fetchBooneCycleDiscovery(options: Options = {}) {
	const request = options.request ?? fetchRemoteSourceDocument;
	const now = options.now ?? Date.now;
	let policy: ReturnType<typeof electionDocumentRobotsPolicy> | undefined;
	async function get(url: string, maximumBytes = 2 * 1024 * 1024) {
		if (policy) {
			if (!policy.allowed(url)) return reject();
			await (options.sleep ?? wait)(policy.delay);
		}
		const response = await request(url, { allowedHosts: ["boonecounty.in.gov"], maxBytes: maximumBytes, timeoutMs: 30000 });
		await options.onResponse?.(url, response);
		return response;
	}
	async function capturePage(url: string): Promise<Page> {
		const response = await get(url);
		if (response.status !== 200 || response.contentType !== (url.endsWith("robots.txt") ? "text/plain" : "text/html")) return reject();
		return { url, body: new TextDecoder("utf-8", { fatal: true }).decode(response.body), sha256: booneHash(response.body), retrievedAt: new Date(now()).toISOString() };
	}
	const robots = await capturePage(`${booneOrigin}/robots.txt`);
	if (robots.sha256 !== booneRobotsSha256) return reject();
	policy = electionDocumentRobotsPolicy(Buffer.from(robots.body), [], [], true);
	const home = await capturePage(`${booneOrigin}/`);
	if (boonePolicyFingerprint(home.body) !== boonePolicySha256) return reject();
	const index = await capturePage(booneDiscoveryUrl);
	if (boonePolicyFingerprint(index.body) !== boonePolicySha256) return reject();
	const documents: Document[] = [];
	for (const offer of readBooneCandidateIndex(index.body)) {
		for (const [role, url] of [["workbook", offer.workbookUrl], ...offer.ballotUrl ? [["ballots", offer.ballotUrl]] : []] as [Document["role"], string][]) {
			const response = await get(url, role === "ballots" ? 12 * 1024 * 1024 : 2 * 1024 * 1024);
			const receipt = { year: offer.year, role, url, status: response.status, sha256: booneHash(response.body), retrievedAt: new Date(now()).toISOString() };
			if (response.status === 404) {
				documents.push({ ...receipt, status: 404 });
				continue;
			}
			if (response.status !== 200) return reject();
			if (role === "workbook") {
				if (!response.body.subarray(0, 4).equals(Buffer.from([0x50, 0x4B, 0x03, 0x04]))) return reject();
				const sheets = await (options.readWorkbook ?? readStateBallotWorkbook)(response.body, "boone-candidates");
				parseBooneCandidateSheets(sheets, { allowEmpty: true });
				const rows = sheets[0]!.data.map(row => row.slice(0, 4));
				workbook(rows);
				documents.push({ ...receipt, status: 200, rows });
			}
			else {
				if (response.contentType !== "application/pdf" || !response.body.subarray(0, 5).equals(Buffer.from("%PDF-"))) return reject();
				const body = options.extractBallots ? await options.extractBallots(response.body) : await extractStateBallotPdfText(response.body, await resolveStateBallotPdfExtractor(), 12000, "layout", 1000);
				readBooneBallotDate(body, offer.year);
				documents.push({ ...receipt, status: 200, text: body });
			}
			if (Buffer.byteLength(JSON.stringify(documents)) > 20 * 1024 * 1024) return reject();
		}
	}
	const body = JSON.stringify({ schemaVersion: 1, type: "boone-candidate-discovery", robots, home, index, documents });
	readBooneDiscovery(body, now());
	return body;
}
export async function fetchBooneCandidateCapture(source: StateBallotSource, options: Options = {}) {
	validateBooneSource(source);
	const discovery = options.discovery ?? await fetchBooneCycleDiscovery(options);
	readBooneDiscovery(discovery, (options.now ?? Date.now)());
	return JSON.stringify({ schemaVersion: 1, type: "boone-candidate-capture", electionDate: source.electionDate, discovery: JSON.parse(discovery) });
}
export function parseBooneCandidateCapture(source: StateBallotSource, body: string, factory: typeof import("./state-ballot-records.js").createStateCandidateRecord, now = Date.now(), previous?: StateBallotSnapshot) {
	validateBooneSource(source);
	if (Buffer.byteLength(body) > 24 * 1024 * 1024) return reject();
	const value: unknown = JSON.parse(body);
	if (!exact(value, ["schemaVersion", "type", "electionDate", "discovery"]) || value.schemaVersion !== 1 || value.type !== "boone-candidate-capture" || value.electionDate !== source.electionDate) return reject();
	const discovery = readBooneDiscovery(JSON.stringify(value.discovery), now);
	const election = discovery.elections.find(item => item.electionDate === source.electionDate);
	const candidates = discovery.documents.find(item => item.year === source.electionDate.slice(0, 4) && item.role === "workbook");
	if (!election || !candidates || candidates.status === 404) {
		if (previous?.records.length) return reject();
		throw new StateBallotAwaitingRecordsError(source.id);
	}
	const facts = workbook(candidates.rows);
	if (!facts.claims.length) {
		if (previous?.records.length) return reject();
		throw new StateBallotAwaitingRecordsError(source.id);
	}
	const records = facts.claims.map((claim) => {
		const record = factory(source, { name: claim.name, office: claim.office, party: claim.party ?? "", scope: "local", district: "", jurisdiction: "Boone County", status: claim.ballotExclusion ? "inactive" : "filed", sourceDistrictLabel: claim.sourceDistrictLabel });
		if (!record) return reject();
		return { ...record, sourceStatus: claim.ballotInstruction };
	});
	const identities = new Map(records.map(record => [record.id, record]));
	if (previous?.records.some(record => !identities.has(record.id) || (record.status === "inactive" && identities.get(record.id)!.status !== "inactive"))) return reject();
	const selected = discovery.documents.filter(item => item.year === source.electionDate.slice(0, 4));
	const documents = selected.map(({ url, sha256, retrievedAt, role }) => ({ url, sha256, retrievedAt, includedRecordCount: role === "workbook" ? records.length : 0 }));
	const retrievedAt = documents.map(item => item.retrievedAt).sort()[0]!;
	if (previous && Date.parse(retrievedAt) < Date.parse(previous.retrievedAt)) return reject();
	return { records, documents, retrievedAt, sha256: booneHash(JSON.stringify(documents.map(({ url, sha256 }) => ({ url, sha256 })))), collectionIndexSha256: booneDocumentDigest(election.booneDocuments) };
}
