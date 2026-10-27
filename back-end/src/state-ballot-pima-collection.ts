import type { PimaDocumentKind } from "./state-ballot-pima-native.js";
import type { StateCandidateRecord } from "./state-ballot-records.js";
import type { StateBallotSource } from "./state-ballot-sources.js";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { setTimeout as wait } from "node:timers/promises";
import { fetchRemoteSourceDocument } from "./remote-json-source.js";
import { extractStateBallotPdfSvg, extractStateBallotPdfXml, resolveStateBallotPdfSvgExtractor, resolveStateBallotPdfXmlExtractor } from "./state-ballot-pdf.js";
import { fetchPimaCycleDiscovery, pimaDiscoveryUrl, readPimaCycleDiscovery, validatePimaDocumentUrl } from "./state-ballot-pima-discovery.js";
import { pimaNativePages } from "./state-ballot-pima-native.js";
import { readPimaDocument } from "./state-ballot-pima.js";
import { StateBallotAwaitingRecordsError } from "./state-ballot-source-state.js";

const hash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const exact = (value: unknown, keys: string[]): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).sort().join("|") === [...keys].sort().join("|"));
interface Pdf {
	kind: PimaDocumentKind;
	url: string;
	sha256: string;
	retrievedAt: string;
	xml: string;
	svgPages: string[];
}
interface Options {
	requestDocument?: typeof fetchRemoteSourceDocument;
	sleep?: (milliseconds: number) => Promise<void>;
	now?: () => number;
	discovery?: string;
	extract?: (bytes: Buffer, kind: PimaDocumentKind) => Promise<{
		xml: string;
		svgPages: string[];
	}>;
}
export interface PimaElection {
	electionId: null;
	electionDate: string;
	pageUrl: string;
	pimaDocuments: {
		kind: PimaDocumentKind;
		url: string;
		sha256: string;
	}[];
}
function reject(): never {
	throw new Error("The Pima candidate collection requires review.");
}
export function pimaSource(electionDate: string): StateBallotSource {
	return { stateCode: "AZ", id: electionDate === "2026-11-03" ? "az-pima-2026" : `az-pima-general-${electionDate}`, label: "Pima County candidate lists", electionDate, url: pimaDiscoveryUrl, pageUrl: pimaDiscoveryUrl, format: "pima-pdf", snapshotStorage: "external", defaultPriority: -10, countyName: "Pima County", scopeNotice: "Pima County lists only. Judges and incomplete governor tickets are excluded." };
}
export function validatePimaSource(source: StateBallotSource) {
	const expected = pimaSource(source.electionDate);
	if (!/^20\d{2}-11-0[2-8]$/u.test(source.electionDate) || source.electionDate < "2026-11-03" || Number(source.electionDate.slice(0, 4)) % 2 || new Date(`${source.electionDate}T00:00:00Z`).getUTCDay() !== 2 || source.stateCode !== "AZ" || source.id !== expected.id || source.format !== "pima-pdf" || source.url !== pimaDiscoveryUrl || source.pageUrl !== pimaDiscoveryUrl || source.snapshotStorage !== "external" || source.countyName !== expected.countyName || source.retrievalPolicy || source.postBody || source.delimiter || source.documentUrls || source.documentLinks || source.withheldDistrictScopes || source.withheldStatewideOffices)
		return reject();
}
export function validatePimaElection(value: unknown): asserts value is PimaElection {
	if (!exact(value, ["electionId", "electionDate", "pageUrl", "pimaDocuments"]) || value.electionId !== null || typeof value.electionDate !== "string" || value.pageUrl !== pimaDiscoveryUrl || !Array.isArray(value.pimaDocuments) || value.pimaDocuments.length > 2)
		return reject();
	validatePimaSource(pimaSource(value.electionDate));
	for (const [index, document] of value.pimaDocuments.entries()) {
		if (!exact(document, ["kind", "url", "sha256"]) || document.kind !== (index ? "write-ins" : "candidates") || typeof document.url !== "string" || typeof document.sha256 !== "string" || !/^[a-f0-9]{64}$/u.test(document.sha256))
			return reject();
		validatePimaDocumentUrl(document.url);
	}
	if (new Set(value.pimaDocuments.map(document => document.url)).size !== value.pimaDocuments.length)
		return reject();
}
export function pimaDocumentDigest(documents: readonly {
	url: string;
	sha256: string;
}[]) {
	return hash(JSON.stringify(documents.map(({ url, sha256 }) => ({ url, sha256 }))));
}
export function readPimaCandidateDiscovery(body: string, now = Date.now()) {
	if (Buffer.byteLength(body) > 32 * 1024 * 1024)
		return reject();
	const value: unknown = JSON.parse(body);
	if (!exact(value, ["schemaVersion", "type", "discovery", "documents"]) || value.schemaVersion !== 1 || value.type !== "pima-candidate-discovery" || !Array.isArray(value.documents))
		return reject();
	const discovery = readPimaCycleDiscovery(JSON.stringify(value.discovery), now);
	const documents = value.documents;
	let position = 0;
	const elections = discovery.elections.map((election) => {
		const pimaDocuments = election.documents.map((offered) => {
			const document: unknown = documents[position++];
			if (!exact(document, ["kind", "url", "sha256", "retrievedAt", "xml", "svgPages"]) || document.kind !== offered.kind || document.url !== offered.url || typeof document.sha256 !== "string" || !/^[a-f0-9]{64}$/u.test(document.sha256) || typeof document.retrievedAt !== "string" || !Number.isFinite(Date.parse(document.retrievedAt)) || new Date(document.retrievedAt).toISOString() !== document.retrievedAt || Date.parse(document.retrievedAt) > now || Date.parse(document.retrievedAt) < Date.parse(discovery.index.retrievedAt) || typeof document.xml !== "string" || !Array.isArray(document.svgPages) || !document.svgPages.length || document.svgPages.length > 20 || document.svgPages.some(page => typeof page !== "string"))
				return reject();
			const parsed = readPimaDocument(pimaSource(election.electionDate), document.xml, document.svgPages, offered.kind);
			if (parsed.sourceAsOfDate && parsed.sourceAsOfDate > document.retrievedAt.slice(0, 10))
				return reject();
			return { ...offered, sha256: document.sha256 };
		});
		const selected = { electionId: null, electionDate: election.electionDate, pageUrl: pimaDiscoveryUrl, pimaDocuments };
		validatePimaElection(selected);
		return selected;
	});
	if (position !== documents.length)
		return reject();
	return { elections, documents: documents as Pdf[], index: discovery.index };
}
export async function fetchPimaCandidateDiscovery(options: Options = {}) {
	const now = options.now ?? Date.now;
	const request = options.requestDocument ?? fetchRemoteSourceDocument;
	const sleep = options.sleep ?? (milliseconds => wait(milliseconds));
	const discovery = options.discovery ?? await fetchPimaCycleDiscovery(options);
	const offered = readPimaCycleDiscovery(discovery, now());
	const documents: Pdf[] = [];
	let bytes = Buffer.byteLength(discovery) + 4096;
	for (const election of offered.elections) {
		for (const document of election.documents) {
			await sleep(11000);
			const reply = await request(document.url, { allowedHosts: ["content.civicplus.com"], maxBytes: 12 * 1024 * 1024, timeoutMs: 45000 });
			if (reply.status !== 200 || reply.contentType !== "application/pdf" || !reply.body.subarray(0, 5).equals(Buffer.from("%PDF-")))
				return reject();
			const sha256 = hash(reply.body);
			const retrievedAt = new Date(now()).toISOString();
			let native;
			if (options.extract) {
				native = await options.extract(reply.body, document.kind);
			}
			else {
				const xml = await extractStateBallotPdfXml(reply.body, await resolveStateBallotPdfXmlExtractor());
				const pages = pimaNativePages(xml, document.kind);
				const svgPages: string[] = [];
				const extractor = await resolveStateBallotPdfSvgExtractor();
				for (let page = 1; page <= pages.length; page++)
					svgPages.push(await extractStateBallotPdfSvg(reply.body, extractor, page));
				native = { xml, svgPages };
			}
			readPimaDocument(pimaSource(election.electionDate), native.xml, native.svgPages, document.kind);
			const captured = { ...document, sha256, retrievedAt, ...native };
			bytes += Buffer.byteLength(JSON.stringify(captured));
			if (bytes > 32 * 1024 * 1024 - 4096)
				return reject();
			documents.push(captured);
		}
	}
	const body = JSON.stringify({ schemaVersion: 1, type: "pima-candidate-discovery", discovery: JSON.parse(discovery), documents });
	readPimaCandidateDiscovery(body, now());
	return body;
}
export async function fetchPimaCandidateCapture(source: StateBallotSource, options: Options = {}) {
	validatePimaSource(source);
	const discovery = options.discovery ?? await fetchPimaCandidateDiscovery(options);
	if (!readPimaCandidateDiscovery(discovery, (options.now ?? Date.now)()).elections.some(election => election.electionDate === source.electionDate))
		return reject();
	return JSON.stringify({ schemaVersion: 1, type: "pima-candidate-capture", electionDate: source.electionDate, discovery: JSON.parse(discovery) });
}
export function parsePimaCandidateCapture(source: StateBallotSource, body: string, now = Date.now(), previous: readonly StateCandidateRecord[] = [], previousDocuments: readonly {
	url: string;
	sha256: string;
}[] = []) {
	validatePimaSource(source);
	if (Buffer.byteLength(body) > 32 * 1024 * 1024)
		return reject();
	const value: unknown = JSON.parse(body);
	if (!exact(value, ["schemaVersion", "type", "electionDate", "discovery"]) || value.schemaVersion !== 1 || value.type !== "pima-candidate-capture" || value.electionDate !== source.electionDate)
		return reject();
	const discovery = readPimaCandidateDiscovery(JSON.stringify(value.discovery), now);
	const election = discovery.elections.find(election => election.electionDate === source.electionDate);
	if (!election)
		return reject();
	if (!election.pimaDocuments.length) {
		if (previous.length || previousDocuments.length)
			return reject();
		throw new StateBallotAwaitingRecordsError(source.id);
	}
	if (previousDocuments.length > election.pimaDocuments.length)
		return reject();
	const documents = discovery.documents.filter(document => election.pimaDocuments.some(item => item.kind === document.kind && item.url === document.url));
	const parsed = documents.map(document => readPimaDocument(source, document.xml, document.svgPages, document.kind));
	const records = parsed.flatMap(result => result.records);
	if (new Set(records.map(record => record.id)).size !== records.length || previous.some(record => !records.some(item => item.id === record.id)))
		return reject();
	const sourceAsOfDate = parsed[0]!.sourceAsOfDate;
	if (!sourceAsOfDate)
		return reject();
	const sha256 = pimaDocumentDigest(election.pimaDocuments);
	return { records, sourceAsOfDate, documents: documents.map((document, index) => ({ url: document.url, sha256: document.sha256, retrievedAt: document.retrievedAt, includedRecordCount: parsed[index]!.records.length })), retrievedAt: new Date(Math.min(...documents.map(document => Date.parse(document.retrievedAt)))).toISOString(), sha256, collectionIndexSha256: sha256 };
}
