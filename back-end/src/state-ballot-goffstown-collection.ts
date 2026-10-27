import type { StateCandidateValues } from "./state-ballot-additional-records.js";
import type { ChicagoQuestion } from "./state-ballot-chicago.js";
import type { StateCandidateRecord } from "./state-ballot-records.js";
import type { StateBallotSource } from "./state-ballot-sources.js";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { setTimeout as wait } from "node:timers/promises";
import { fetchRemoteSourceDocument } from "./remote-json-source.js";
import { fetchGoffstownCycleDiscovery, goffstownDiscoveryUrl, readGoffstownCycleDiscovery, validateGoffstownDocumentUrl } from "./state-ballot-goffstown-discovery.js";
import { readGoffstownBallotDocument } from "./state-ballot-goffstown.js";
import { extractStateBallotPdfSvg, extractStateBallotPdfXml, resolveStateBallotPdfSvgExtractor, resolveStateBallotPdfXmlExtractor } from "./state-ballot-pdf.js";
import { StateBallotAwaitingRecordsError } from "./state-ballot-source-state.js";

const hash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const exact = (value: unknown, keys: string[]): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).sort().join("|") === [...keys].sort().join("|"));
interface Pdf { url: string; sha256: string; retrievedAt: string; xml: string; svgPages: string[] }
interface Options { requestDocument?: typeof fetchRemoteSourceDocument; sleep?: (milliseconds: number) => Promise<void>; now?: () => number; discovery?: string; extract?: (bytes: Buffer) => Promise<{ xml: string; svgPages: string[] }> }
export interface GoffstownCandidateElection { electionId: null; electionDate: string; pageUrl: string; goffstownDocuments: { url: string; sha256: string }[] }
function reject(): never {
	throw new Error("The Goffstown collection contract requires review.");
}
function record(source: StateBallotSource, values: StateCandidateValues): StateCandidateRecord {
	if (!values.scope || typeof values.name !== "string" || typeof values.office !== "string" || typeof values.party !== "string" || values.status !== "listed") return reject();
	return { id: hash(JSON.stringify([source.id, source.electionDate, values.office, values.district ?? "", values.name])).slice(0, 24), name: values.name, office: values.office, party: values.party, scope: values.scope, district: values.district ?? "", status: "listed", sourceAreaLabel: values.sourceAreaLabel, sourceDistrictLabel: values.sourceDistrictLabel, ...(values.seats !== undefined ? { seats: values.seats } : {}) };
}
export function goffstownSource(electionDate: string): StateBallotSource {
	return { stateCode: "NH", id: electionDate === "2026-11-03" ? "nh-goffstown-2026" : `nh-goffstown-general-${electionDate}`, label: "Goffstown general-election sample", electionDate, url: goffstownDiscoveryUrl, pageUrl: goffstownDiscoveryUrl, format: "goffstown-pdf", snapshotStorage: "external", defaultPriority: -10, withheldDistrictScopes: ["congressional", "state-senate", "state-house"], scopeNotice: "Goffstown sample only; district applicability is unverified." };
}
export function validateGoffstownSource(source: StateBallotSource) {
	const expected = goffstownSource(source.electionDate);
	if (source.stateCode !== "NH" || !/^20\d{2}-11-0[2-8]$/u.test(source.electionDate) || source.electionDate < "2026-11-03" || Number(source.electionDate.slice(0, 4)) % 2 || new Date(`${source.electionDate}T00:00:00Z`).getUTCDay() !== 2 || source.id !== expected.id || source.format !== "goffstown-pdf" || source.url !== goffstownDiscoveryUrl || source.pageUrl !== goffstownDiscoveryUrl || source.snapshotStorage !== "external" || source.retrievalPolicy || source.postBody || source.delimiter || source.documentUrls || source.documentLinks || JSON.stringify(source.withheldDistrictScopes) !== JSON.stringify(expected.withheldDistrictScopes)) return reject();
}
export function validateGoffstownElection(value: unknown): asserts value is GoffstownCandidateElection {
	if (!exact(value, ["electionId", "electionDate", "pageUrl", "goffstownDocuments"]) || value.electionId !== null || typeof value.electionDate !== "string" || value.pageUrl !== goffstownDiscoveryUrl || !Array.isArray(value.goffstownDocuments) || value.goffstownDocuments.length > 1) return reject();
	validateGoffstownSource(goffstownSource(value.electionDate));
	for (const document of value.goffstownDocuments) {
		if (!exact(document, ["url", "sha256"]) || typeof document.url !== "string" || typeof document.sha256 !== "string" || !/^[a-f0-9]{64}$/u.test(document.sha256)) return reject();
		validateGoffstownDocumentUrl(document.url, value.electionDate);
	}
}
export const goffstownDocumentDigest = (documents: GoffstownCandidateElection["goffstownDocuments"]) => hash(JSON.stringify(documents));
export function readGoffstownCandidateDiscovery(body: string, now = Date.now()) {
	if (Buffer.byteLength(body) > 32 * 1024 * 1024) return reject();
	const value: unknown = JSON.parse(body);
	if (!exact(value, ["schemaVersion", "type", "discovery", "documents"]) || value.schemaVersion !== 1 || value.type !== "goffstown-candidate-discovery" || !Array.isArray(value.documents)) return reject();
	const discovery = readGoffstownCycleDiscovery(JSON.stringify(value.discovery), now);
	const documents = value.documents;
	let documentIndex = 0;
	const elections = discovery.elections.map((election) => {
		const goffstownDocuments = election.documentUrls.map((url) => {
			const document: unknown = documents[documentIndex++];
			if (!exact(document, ["url", "sha256", "retrievedAt", "xml", "svgPages"]) || document.url !== url || typeof document.sha256 !== "string" || !/^[a-f0-9]{64}$/u.test(document.sha256) || typeof document.retrievedAt !== "string" || !Number.isFinite(Date.parse(document.retrievedAt)) || new Date(document.retrievedAt).toISOString() !== document.retrievedAt || Date.parse(document.retrievedAt) > now || typeof document.xml !== "string" || !Array.isArray(document.svgPages) || document.svgPages.length !== 2 || document.svgPages.some(page => typeof page !== "string")) return reject();
			readGoffstownBallotDocument(goffstownSource(election.electionDate), document.xml, document.svgPages, record);
			return { url, sha256: document.sha256 };
		});
		const selected = { electionId: null, electionDate: election.electionDate, pageUrl: goffstownDiscoveryUrl, goffstownDocuments };
		validateGoffstownElection(selected);
		return selected;
	});
	if (documentIndex !== documents.length) return reject();
	return { elections, documents: documents as Pdf[], index: discovery.index };
}
export async function fetchGoffstownCandidateDiscovery(options: Options = {}) {
	const now = options.now ?? Date.now;
	const request = options.requestDocument ?? fetchRemoteSourceDocument;
	const sleep = options.sleep ?? (milliseconds => wait(milliseconds));
	const discovery = options.discovery ?? await fetchGoffstownCycleDiscovery(options);
	const offered = readGoffstownCycleDiscovery(discovery, now());
	const documents: Pdf[] = [];
	let bytes = Buffer.byteLength(discovery) + 4096;
	for (const election of offered.elections) {
		for (const url of election.documentUrls) {
			await sleep(11000);
			const reply = await request(url, { allowedHosts: ["www.goffstownnh.gov"], maxBytes: 12 * 1024 * 1024, timeoutMs: 45000 });
			if (reply.status !== 200 || reply.contentType !== "application/pdf" || !reply.body.subarray(0, 5).equals(Buffer.from("%PDF-"))) return reject();
			const sha256 = hash(reply.body);
			const retrievedAt = new Date(now()).toISOString();
			const native = options.extract ? await options.extract(reply.body) : { xml: await extractStateBallotPdfXml(reply.body, await resolveStateBallotPdfXmlExtractor()), svgPages: await Promise.all([1, 2].map(async page => extractStateBallotPdfSvg(reply.body, await resolveStateBallotPdfSvgExtractor(), page))) };
			readGoffstownBallotDocument(goffstownSource(election.electionDate), native.xml, native.svgPages, record);
			const document = { url, sha256, retrievedAt, ...native };
			bytes += Buffer.byteLength(JSON.stringify(document));
			if (bytes > 32 * 1024 * 1024 - 4096) return reject();
			documents.push(document);
		}
	}
	const body = JSON.stringify({ schemaVersion: 1, type: "goffstown-candidate-discovery", discovery: JSON.parse(discovery), documents });
	readGoffstownCandidateDiscovery(body, now());
	return body;
}
export async function fetchGoffstownCandidateCapture(source: StateBallotSource, options: Options = {}) {
	validateGoffstownSource(source);
	const discovery = options.discovery ?? await fetchGoffstownCandidateDiscovery(options);
	if (!readGoffstownCandidateDiscovery(discovery, (options.now ?? Date.now)()).elections.some(election => election.electionDate === source.electionDate)) return reject();
	return JSON.stringify({ schemaVersion: 1, type: "goffstown-candidate-capture", electionDate: source.electionDate, discovery: JSON.parse(discovery) });
}
export function parseGoffstownCandidateCapture(source: StateBallotSource, body: string, now = Date.now(), previous: readonly StateCandidateRecord[] = [], previousQuestions: readonly ChicagoQuestion[] = []) {
	validateGoffstownSource(source);
	if (Buffer.byteLength(body) > 32 * 1024 * 1024) return reject();
	const value: unknown = JSON.parse(body);
	if (!exact(value, ["schemaVersion", "type", "electionDate", "discovery"]) || value.schemaVersion !== 1 || value.type !== "goffstown-candidate-capture" || value.electionDate !== source.electionDate) return reject();
	const discovery = readGoffstownCandidateDiscovery(JSON.stringify(value.discovery), now);
	const election = discovery.elections.find(election => election.electionDate === source.electionDate);
	if (!election) return reject();
	if (!election.goffstownDocuments.length) {
		if (previous.length || previousQuestions.length) return reject();
		throw new StateBallotAwaitingRecordsError(source.id);
	}
	const document = discovery.documents.find(document => document.url === election.goffstownDocuments[0]!.url)!;
	const parsed = readGoffstownBallotDocument(source, document.xml, document.svgPages, record);
	if (previous.some(record => !parsed.records.some(item => item.id === record.id)) || previousQuestions.some(question => !parsed.ballotQuestions.some(item => item.id === question.id))) return reject();
	return { records: parsed.records, ballotQuestions: parsed.ballotQuestions, documents: [{ url: document.url, sha256: document.sha256, retrievedAt: document.retrievedAt, includedRecordCount: parsed.records.length }], retrievedAt: document.retrievedAt, sha256: goffstownDocumentDigest(election.goffstownDocuments), collectionIndexSha256: goffstownDocumentDigest(election.goffstownDocuments) };
}
