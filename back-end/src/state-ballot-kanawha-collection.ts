import type { KanawhaElection } from "./state-ballot-kanawha-discovery.js";
import type { StateBallotSnapshot } from "./state-ballot-repository.js";
import type { StateBallotSource } from "./state-ballot-sources.js";
import { Buffer } from "node:buffer";
import { setTimeout as wait } from "node:timers/promises";
import { electionDocumentRobotsPolicy } from "./election-document-collection.js";
import { fetchRemoteSourceDocument } from "./remote-json-source.js";
import { kanawhaDiscoveryUrl, kanawhaDocumentDigest, kanawhaHash, kanawhaOrigin, kanawhaPolicies, kanawhaPolicyTextHash, kanawhaRobotsSha256, readKanawhaCandidateIndex, validateKanawhaPolicyLinks, validateKanawhaSource } from "./state-ballot-kanawha-discovery.js";
import { captureKanawhaTestDocument, readKanawhaPreparedDocument } from "./state-ballot-kanawha-native.js";
import { StateBallotAwaitingRecordsError } from "./state-ballot-source-state.js";

const exact = (value: unknown, keys: string[]): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).sort().join("|") === [...keys].sort().join("|"));
const digest = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
function reject(): never {
	throw new Error("The Kanawha County collection requires review.");
}
interface Page { url: string; body: string; sha256: string; retrievedAt: string }
interface Policy { requestUrl: string; url: string; sha256: string; textSha256: string; retrievedAt: string; redirectStatus?: 301 }
interface Document { year: string; url: string; status: 200 | 404; sha256: string; retrievedAt: string; evidence?: Awaited<ReturnType<typeof captureKanawhaTestDocument>> }
interface Options { request?: typeof fetchRemoteSourceDocument; now?: () => number; sleep?: (milliseconds: number) => Promise<void>; discovery?: string; native?: Parameters<typeof captureKanawhaTestDocument>[1]; onResponse?: (url: string, response: Awaited<ReturnType<typeof fetchRemoteSourceDocument>>) => Promise<void> }
function instant(value: unknown, now: number): value is string {
	return typeof value === "string" && Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value && Date.parse(value) <= now;
}
function page(value: unknown, url: string, now: number): Page {
	if (!exact(value, ["url", "body", "sha256", "retrievedAt"]) || value.url !== url || typeof value.body !== "string" || Buffer.byteLength(value.body) > 2 * 1024 * 1024 || value.sha256 !== kanawhaHash(value.body) || !instant(value.retrievedAt, now)) return reject();
	return value as unknown as Page;
}
export function readKanawhaDiscovery(body: string, now = Date.now()) {
	if (Buffer.byteLength(body) > 24 * 1024 * 1024) return reject();
	const value: unknown = JSON.parse(body);
	if (!exact(value, ["schemaVersion", "type", "robots", "home", "index", "policies", "documents"]) || value.schemaVersion !== 1 || value.type !== "kanawha-candidate-discovery" || !Array.isArray(value.policies) || value.policies.length !== kanawhaPolicies.length || !Array.isArray(value.documents)) return reject();
	const robots = page(value.robots, `${kanawhaOrigin}/robots.txt`, now);
	if (robots.sha256 !== kanawhaRobotsSha256) return reject();
	const home = page(value.home, `${kanawhaOrigin}/`, now);
	const index = page(value.index, kanawhaDiscoveryUrl, now);
	validateKanawhaPolicyLinks(home.body);
	validateKanawhaPolicyLinks(index.body);
	const policies = value.policies.map((item, position): Policy => {
		const expected = kanawhaPolicies[position]!;
		if (!exact(item, ["requestUrl", "url", "sha256", "textSha256", "retrievedAt", ...(item && typeof item === "object" && "redirectStatus" in item ? ["redirectStatus"] : [])]) || item.requestUrl !== expected.requestUrl || (item.url !== expected.requestUrl && item.url !== expected.url) || !digest(item.sha256) || item.textSha256 !== expected.textSha256 || !instant(item.retrievedAt, now) || (item.redirectStatus !== undefined && (item.redirectStatus !== 301 || item.url !== expected.url || item.url === item.requestUrl)) || (item.redirectStatus === undefined && item.url !== item.requestUrl)) return reject();
		return item as unknown as Policy;
	});
	const offers = readKanawhaCandidateIndex(index.body);
	if (value.documents.length !== offers.length) return reject();
	const elections: KanawhaElection[] = [];
	const documents = value.documents.map((item, position): Document => {
		const offer = offers[position]!;
		const available = Boolean(item && typeof item === "object" && item.status === 200);
		if (!exact(item, ["year", "url", "status", "sha256", "retrievedAt", ...(available ? ["evidence"] : [])]) || item.year !== offer.year || item.url !== offer.url || (item.status !== 200 && item.status !== 404) || !digest(item.sha256) || !instant(item.retrievedAt, now)) return reject();
		if (available) {
			const evidence = item.evidence;
			if (!exact(evidence, ["objects", "bbox", "text", "sha256"]) || evidence.sha256 !== item.sha256 || [evidence.objects, evidence.bbox, evidence.text].some(part => typeof part !== "string")) return reject();
			const report = readKanawhaPreparedDocument(evidence as unknown as Awaited<ReturnType<typeof captureKanawhaTestDocument>>);
			if (report.electionDate.slice(0, 4) !== offer.year || report.sourceAsOfDate > new Date(now + 14 * 3600000).toISOString().slice(0, 10)) return reject();
			elections.push({ electionId: null, electionDate: report.electionDate, pageUrl: kanawhaDiscoveryUrl, kanawhaDocuments: [{ url: offer.url, sha256: item.sha256, sourceAsOfDate: report.sourceAsOfDate }] });
		}
		else if (item.sha256 !== kanawhaHash("")) {
			return reject();
		}
		return item as unknown as Document;
	});
	return { robots, home, index, policies, documents, elections };
}
export async function fetchKanawhaCycleDiscovery(options: Options = {}) {
	const request = options.request ?? fetchRemoteSourceDocument;
	const now = options.now ?? Date.now;
	let policy: ReturnType<typeof electionDocumentRobotsPolicy> | undefined;
	async function get(url: string, maxBytes = 2 * 1024 * 1024) {
		if (policy) {
			if (!policy.allowed(url)) return reject();
			await (options.sleep ?? wait)(policy.delay);
		}
		const response = await request(url, { allowedHosts: ["kanawha.us"], maxBytes, timeoutMs: 30000 });
		await options.onResponse?.(url, response);
		return response;
	}
	async function capturePage(url: string): Promise<Page> {
		const response = await get(url);
		if (response.status !== 200 || response.contentType !== (url.endsWith("robots.txt") ? "text/plain" : "text/html")) return reject();
		return { url, body: new TextDecoder("utf-8", { fatal: true }).decode(response.body), sha256: kanawhaHash(response.body), retrievedAt: new Date(now()).toISOString() };
	}
	const robots = await capturePage(`${kanawhaOrigin}/robots.txt`);
	if (robots.sha256 !== kanawhaRobotsSha256) return reject();
	policy = electionDocumentRobotsPolicy(Buffer.from(robots.body));
	const home = await capturePage(`${kanawhaOrigin}/`);
	validateKanawhaPolicyLinks(home.body);
	const index = await capturePage(kanawhaDiscoveryUrl);
	validateKanawhaPolicyLinks(index.body);
	const policies: Policy[] = [];
	for (const expected of kanawhaPolicies) {
		let response = await get(expected.requestUrl);
		let url: string = expected.requestUrl;
		let redirectStatus: 301 | undefined;
		if (response.status === 301 && expected.requestUrl !== expected.url && response.location === expected.url) {
			url = expected.url;
			redirectStatus = 301;
			response = await get(url);
		}
		if (response.status !== 200 || response.contentType !== "text/html") return reject();
		const textSha256 = kanawhaPolicyTextHash(new TextDecoder("utf-8", { fatal: true }).decode(response.body));
		if (textSha256 !== expected.textSha256) return reject();
		policies.push({ requestUrl: expected.requestUrl, url, sha256: kanawhaHash(response.body), textSha256, retrievedAt: new Date(now()).toISOString(), ...(redirectStatus ? { redirectStatus } : {}) });
	}
	const documents: Document[] = [];
	for (const offer of readKanawhaCandidateIndex(index.body)) {
		const response = await get(offer.url, 12 * 1024 * 1024);
		const receipt = { ...offer, sha256: kanawhaHash(response.body), retrievedAt: new Date(now()).toISOString() };
		if (response.status === 404) {
			documents.push({ ...receipt, status: 404 });
		}
		else {
			if (response.status !== 200 || response.contentType !== "application/pdf") return reject();
			documents.push({ ...receipt, status: 200, evidence: await captureKanawhaTestDocument(response.body, options.native) });
		}
		if (Buffer.byteLength(JSON.stringify(documents)) > 16 * 1024 * 1024) return reject();
	}
	const body = JSON.stringify({ schemaVersion: 1, type: "kanawha-candidate-discovery", robots, home, index, policies, documents });
	readKanawhaDiscovery(body, now());
	return body;
}
export async function fetchKanawhaCandidateCapture(source: StateBallotSource, options: Options = {}) {
	validateKanawhaSource(source);
	const discovery = options.discovery ?? await fetchKanawhaCycleDiscovery(options);
	readKanawhaDiscovery(discovery, (options.now ?? Date.now)());
	return JSON.stringify({ schemaVersion: 1, type: "kanawha-candidate-capture", electionDate: source.electionDate, discovery: JSON.parse(discovery) });
}
export function parseKanawhaCandidateCapture(source: StateBallotSource, body: string, factory: typeof import("./state-ballot-records.js").createStateCandidateRecord, now = Date.now(), previous?: StateBallotSnapshot) {
	validateKanawhaSource(source);
	if (Buffer.byteLength(body) > 24 * 1024 * 1024) return reject();
	const value: unknown = JSON.parse(body);
	if (!exact(value, ["schemaVersion", "type", "electionDate", "discovery"]) || value.schemaVersion !== 1 || value.type !== "kanawha-candidate-capture" || value.electionDate !== source.electionDate) return reject();
	const discovery = readKanawhaDiscovery(JSON.stringify(value.discovery), now);
	const election = discovery.elections.find(item => item.electionDate === source.electionDate);
	const document = discovery.documents.find(item => item.year === source.electionDate.slice(0, 4));
	if (!election || !document?.evidence) {
		if (previous?.records.length) return reject();
		throw new StateBallotAwaitingRecordsError(source.id);
	}
	const report = readKanawhaPreparedDocument(document.evidence);
	if (!report.candidates.length) {
		if (previous?.records.length) return reject();
		throw new StateBallotAwaitingRecordsError(source.id);
	}
	const records = report.candidates.map((claim) => {
		const record = factory(source, { name: claim.name, office: claim.office, party: claim.party ?? "", scope: claim.scope, district: claim.district, jurisdiction: claim.jurisdiction, status: "listed" });
		if (!record) return reject();
		return { id: record.id, name: record.name, office: record.office, scope: record.scope, district: record.district, status: record.status, jurisdiction: claim.jurisdiction, ...(claim.party ? { party: claim.party } : {}), ...(claim.ballotDesignation ? { ballotDesignation: claim.ballotDesignation } : {}), ...(claim.sourceDivision ? { sourceDivision: claim.sourceDivision } : {}), voteLimit: claim.voteLimit };
	});
	if (new Set(records.map(record => record.id)).size !== records.length || previous?.records.some(record => !records.some(item => item.id === record.id)) || (previous?.sourceAsOfDate && report.sourceAsOfDate < previous.sourceAsOfDate) || (previous && Date.parse(document.retrievedAt) < Date.parse(previous.retrievedAt))) return reject();
	const documents = [{ url: document.url, sha256: document.sha256, retrievedAt: document.retrievedAt, includedRecordCount: records.length }];
	return { records, documents, retrievedAt: document.retrievedAt, sha256: kanawhaHash(JSON.stringify(documents.map(({ url, sha256 }) => ({ url, sha256 })))), collectionIndexSha256: kanawhaDocumentDigest(election.kanawhaDocuments), sourceAsOfDate: report.sourceAsOfDate };
}
