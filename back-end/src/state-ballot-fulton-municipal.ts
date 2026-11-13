import type { FultonMunicipalEvidence } from "./fulton-municipal-evidence.js";
import type { StateCandidateValues } from "./state-ballot-additional-records.js";
import type { StateCandidateRecord } from "./state-ballot-records.js";
import type { StateBallotSource } from "./state-ballot-sources.js";
import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { mkdir, realpath } from "node:fs/promises";
import process from "node:process";
import { isDeepStrictEqual } from "node:util";
import { electionDocumentRobotsPolicy } from "./election-document-collection.js";
import { writeFultonCalendarFile } from "./fulton-election-calendar-storage.js";
import { verifyFultonCalendarPolicy } from "./fulton-election-calendar.js";
import { prepareFultonMunicipalEvidence, readFultonMunicipalEvidence } from "./fulton-municipal-evidence.js";
import { fetchRemoteSourceDocument } from "./remote-json-source.js";
import { fultonMunicipalDocumentUrl, validateFultonMunicipalElection, validateFultonMunicipalSource } from "./state-ballot-fulton-municipal-source.js";
import { fultonDiscoveryUrl, fultonPolicyReceipts } from "./state-ballot-fulton.js";
import { stateHtmlAttribute as attribute, stateHtmlDescendants as descendants, parseStateHtml, stateHtmlText } from "./state-ballot-html.js";
import { assertExternalStateDataDirectory } from "./state-ballot-storage.js";

export { fultonMunicipalDocumentUrl, fultonMunicipalSource, validateFultonMunicipalElection, validateFultonMunicipalSource } from "./state-ballot-fulton-municipal-source.js";
export type { FultonMunicipalElection } from "./state-ballot-fulton-municipal-source.js";

interface Page { url: string; body: string; sha256: string; retrievedAt: string }
export interface FultonMunicipalCapture { schemaVersion: 1; type: "fulton-municipal-candidate-capture"; policies: Page[]; index: Page; documents: FultonMunicipalEvidence[] }
type Factory = (source: StateBallotSource, values: StateCandidateValues) => StateCandidateRecord | null;
const hash = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");
const exact = (value: unknown, keys: string[]): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).sort().join(",") === [...keys].sort().join(","));

export const fultonMunicipalDocumentDigest = (document: { url: string; sha256: string }) => hash(JSON.stringify([{ url: document.url, sha256: document.sha256 }]));

export function readFultonMunicipalIndex(body: string) {
	assert(typeof body === "string" && Buffer.byteLength(body) <= 3 * 1024 * 1024 && !body.includes("\uFFFD"));
	const root = parseStateHtml(body);
	const mains = descendants(root, node => node.nodeName === "main");
	assert(mains.length === 1);
	const headings = descendants(mains[0]!, node => node.nodeName === "h1");
	assert(headings.length === 1 && stateHtmlText(headings[0]!).replace(/\s+/gu, " ").trim() === "Voting and Elections Sample Ballots", "The municipal publication index changed.");
	const policies = descendants(root, node => node.nodeName === "a" && /privacy|terms of use|copyright|acceptable use|legal notice/iu.test(stateHtmlText(node))).map(node => new URL(attribute(node, "href"), fultonDiscoveryUrl).href);
	assert.deepEqual(policies, [fultonPolicyReceipts[1]!.url], "The municipal publisher policy inventory changed.");
	const links = descendants(mains[0]!, node => node.nodeName === "a" && /runoff/iu.test(`${stateHtmlText(node)} ${attribute(node, "href")}`) && /ballot/iu.test(`${stateHtmlText(node)} ${attribute(node, "href")}`)).map(node => fultonMunicipalDocumentUrl(attribute(node, "href")));
	assert(links.length <= 4 && new Set(links).size === links.length, "The municipal publication inventory requires review.");
	return links;
}
export function readFultonMunicipalDiscovery(body: string, now = Date.now()) {
	assert(typeof body === "string" && Buffer.byteLength(body) <= 12 * 1024 * 1024);
	const value: unknown = JSON.parse(body);
	assert(exact(value, ["schemaVersion", "type", "policies", "index", "documents"]) && value.schemaVersion === 1 && value.type === "fulton-municipal-candidate-capture" && Array.isArray(value.policies) && value.policies.length === 2 && Array.isArray(value.documents));
	const capture = value as unknown as FultonMunicipalCapture;
	function page(entry: unknown, url: string): asserts entry is Page {
		assert(exact(entry, ["url", "body", "sha256", "retrievedAt"]) && entry.url === url && typeof entry.body === "string" && Buffer.byteLength(entry.body) <= 3 * 1024 * 1024 && hash(entry.body) === entry.sha256 && typeof entry.retrievedAt === "string" && Number.isFinite(Date.parse(entry.retrievedAt)) && new Date(entry.retrievedAt).toISOString() === entry.retrievedAt && Date.parse(entry.retrievedAt) <= now);
	}
	for (const [index, policy] of capture.policies.entries()) {
		page(policy, fultonPolicyReceipts[index]!.url);
		verifyFultonCalendarPolicy(policy.body, index);
	}
	page(capture.index, fultonDiscoveryUrl);
	const urls = readFultonMunicipalIndex(capture.index.body);
	assert(capture.documents.length === urls.length);
	const robots = electionDocumentRobotsPolicy(Buffer.from(capture.policies[0]!.body));
	for (const url of urls) assert(robots.allowed(url), "The publisher disallows municipal document collection.");
	const inventories = capture.documents.map((document, index) => {
		const inventory = readFultonMunicipalEvidence(document);
		assert(inventory.source.url === urls[index] && Date.parse(inventory.retrievedAt) <= now);
		return inventory;
	});
	const elections = inventories.map(inventory => ({ electionId: null, electionDate: inventory.electionDate, pageUrl: fultonDiscoveryUrl, municipalDocument: { url: inventory.source.url, sha256: inventory.source.sha256 } }));
	assert(new Set(elections.map(election => election.electionDate)).size === elections.length, "Competing municipal runoff editions require review.");
	for (const election of elections) validateFultonMunicipalElection(election);
	return { capture, index: capture.index, inventories, elections };
}
export function parseFultonMunicipalCapture(source: StateBallotSource, body: string, factory: Factory, now = Date.now(), previous?: { records: readonly StateCandidateRecord[]; documents?: readonly { url: string; sha256: string; retrievedAt: string }[] }) {
	validateFultonMunicipalSource(source);
	const result = readFultonMunicipalDiscovery(body, now);
	const inventory = result.inventories.find(inventory => inventory.electionDate === source.electionDate);
	assert(inventory, "The selected municipal election is not offered.");
	const records = inventory.contests.flatMap(contest => contest.candidates.map((candidate) => {
		const record = factory(source, { name: candidate.name, office: [contest.office, contest.district].filter(Boolean).join(" - "), district: contest.district, jurisdiction: contest.municipality, scope: "local", status: "listed", party: "" });
		assert(record);
		record.voteLimit = 1;
		record.sourceStatus = "Sample ballot candidate";
		if (candidate.incumbent) record.incumbent = true;
		return record;
	}));
	assert(!previous?.records.some(record => !records.some(candidate => isDeepStrictEqual(JSON.parse(JSON.stringify(candidate)), record))), "An accepted municipal candidate changed or disappeared; retain the snapshot for review.");
	const document = { url: inventory.source.url, sha256: inventory.source.sha256, retrievedAt: previous?.documents?.find(document => document.url === inventory.source.url && document.sha256 === inventory.source.sha256)?.retrievedAt ?? inventory.retrievedAt, includedRecordCount: records.length };
	const sha256 = fultonMunicipalDocumentDigest(document);
	return { records, documents: [document], retrievedAt: document.retrievedAt, sha256, collectionIndexSha256: sha256 };
}
export function validateFultonMunicipalStoredSnapshot(source: StateBallotSource, data: Record<string, unknown>) {
	validateFultonMunicipalSource(source);
	assert(Array.isArray(data.documents) && data.documents.length === 1 && typeof data.documents[0]?.url === "string" && fultonMunicipalDocumentUrl(data.documents[0].url) === data.documents[0].url && /^[a-f\d]{64}$/u.test(String(data.documents[0].sha256)));
	assert(data.collectionIndexSha256 === hash(JSON.stringify(data.documents.map(({ url, sha256 }) => ({ url, sha256 })))) && data.sourceSha256 === data.collectionIndexSha256);
	assert(Array.isArray(data.records) && data.records.every((record) => {
		const office = typeof record?.office === "string" ? record.office.replace(/ - District [1-9]\d?(?: At Large)?$/u, "") : "";
		const scoped = office === "Mayor" ? record.district === "" : /^DISTRICT [1-9]\d?(?: AT LARGE)?$/u.test(record.district) && record.office.toUpperCase() === `${office.toUpperCase()} - ${record.district}`;
		return record && record.scope === "local" && record.status === "listed" && !record.party && !record.candidateUrl && record.voteLimit === 1 && record.sourceStatus === "Sample ballot candidate" && /^City of [A-Z][A-Za-z .'-]{1,79}$/u.test(record.jurisdiction) && ["Mayor", "City Council", "City Council Member", "Board of Education Member"].includes(office) && scoped && record.termYears === undefined && record.termEnd === undefined && record.seats === undefined;
	}), "The stored municipal ballot facts require review.");
}
interface Options { discovery?: string; now?: () => number; wait?: (milliseconds: number) => Promise<void>; requestDocument?: typeof fetchRemoteSourceDocument; prepare?: typeof prepareFultonMunicipalEvidence; scratchDirectory?: string }
export async function fetchFultonMunicipalCycleDiscovery(options: Options = {}) {
	const now = options.now ?? Date.now;
	const wait = options.wait ?? (milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds)));
	const request = options.requestDocument ?? fetchRemoteSourceDocument;
	let requests = 0;
	let robots: ReturnType<typeof electionDocumentRobotsPolicy> | undefined;
	const get = async (url: string, pdf = false) => {
		assert(!robots || robots.allowed(url));
		if (requests++) await wait(11000);
		const response = await request(url, { allowedHosts: [new URL(url).hostname], maxBytes: pdf ? 12 * 1024 * 1024 : 3 * 1024 * 1024, timeoutMs: 20000 });
		assert(response.status === 200 && (pdf ? /^application\/pdf(?:;|$)/iu.test(response.contentType ?? "") && response.body.subarray(0, 5).toString("ascii") === "%PDF-" : /^(?:text\/html|text\/plain)(?:;|$)/iu.test(response.contentType ?? "")), "The municipal publisher response requires review.");
		return { bytes: response.body, page: { url, body: response.body.toString("utf8"), sha256: hash(response.body), retrievedAt: new Date(now()).toISOString() } };
	};
	const policies: Page[] = [];
	for (const [index, policy] of fultonPolicyReceipts.slice(0, 2).entries()) {
		const { page } = await get(policy.url);
		verifyFultonCalendarPolicy(page.body, index);
		policies.push(page);
		if (!index) robots = electionDocumentRobotsPolicy(Buffer.from(page.body));
	}
	const { page: index } = await get(fultonDiscoveryUrl);
	const urls = readFultonMunicipalIndex(index.body);
	const documents: FultonMunicipalEvidence[] = [];
	if (urls.length) {
		const directory = options.scratchDirectory ?? process.env.STATE_BALLOT_FULTON_MUNICIPAL_EVIDENCE_DIR;
		assert(directory, "Configure the private municipal native collection directory.");
		assertExternalStateDataDirectory(directory);
		await mkdir(directory, { recursive: true, mode: 0o700 });
		assert(await realpath(directory) === directory);
		for (const url of urls) {
			const { bytes, page } = await get(url, true);
			const source = { url, sha256: hash(bytes), bytes: bytes.length, retrievedAt: page.retrievedAt };
			await writeFultonCalendarFile(directory, `municipal-original-${source.sha256}.json`, JSON.stringify({ sha256: source.sha256, bytes: bytes.length, body: bytes.toString("base64") }), true);
			documents.push(await (options.prepare ?? prepareFultonMunicipalEvidence)(bytes, source, directory));
		}
	}
	const body = JSON.stringify({ schemaVersion: 1, type: "fulton-municipal-candidate-capture", policies, index, documents });
	readFultonMunicipalDiscovery(body, now());
	const directory = options.scratchDirectory ?? process.env.STATE_BALLOT_FULTON_MUNICIPAL_EVIDENCE_DIR;
	if (directory) {
		assertExternalStateDataDirectory(directory);
		await mkdir(directory, { recursive: true, mode: 0o700 });
		assert(await realpath(directory) === directory);
		await writeFultonCalendarFile(directory, `municipal-capture-${hash(body)}.json`, body, true);
	}
	return body;
}
export async function fetchFultonMunicipalCapture(source: StateBallotSource, options: Options = {}) {
	validateFultonMunicipalSource(source);
	const body = options.discovery ?? await fetchFultonMunicipalCycleDiscovery(options);
	assert(readFultonMunicipalDiscovery(body, (options.now ?? Date.now)()).elections.some(election => election.electionDate === source.electionDate));
	return body;
}
