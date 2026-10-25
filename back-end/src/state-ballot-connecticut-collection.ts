import type { fetchRemoteSourceDocument } from "./remote-json-source.js";
import type { StateCandidateValues } from "./state-ballot-additional-records.js";
import type { StateBallotGridPage } from "./state-ballot-pdf-grid.js";
import type { StateCandidateRecord } from "./state-ballot-records.js";
import type { StateBallotSource } from "./state-ballot-sources.js";
import { Buffer } from "node:buffer";
import { connecticutDigest, connecticutExactKeys, connecticutIndexDigest, fetchConnecticutCycleDiscovery, readConnecticutDiscovery, validateConnecticutSource } from "./state-ballot-connecticut-discovery.js";
import { connecticutInstructionPageSha256, reconcileConnecticutBallots } from "./state-ballot-connecticut.js";
import { extractStateBallotPdfGrid } from "./state-ballot-pdf-grid.js";
import { fetchStateBallotPdfDocument, resolveStateBallotPdfExtractor, resolveStateBallotPdfSvgExtractor } from "./state-ballot-pdf.js";

interface CapturedDocument { town: string; url: string; sha256: string; retrievedAt: string; text: string }
type ConnecticutCaptureOptions = Parameters<typeof fetchConnecticutCycleDiscovery>[0] & {
	requestDocument?: typeof fetchRemoteSourceDocument;
	extractor?: (body: Buffer) => Promise<StateBallotGridPage[]>;
	discovery?: string;
	now?: () => number;
};

function capturedPages(document: CapturedDocument, electionDate: string) {
	const pages = JSON.parse(document.text) as StateBallotGridPage[];
	if (!Array.isArray(pages) || !pages.length || pages.length > 50) throw new Error("The Connecticut captured page set exceeds its bounds.");
	const ballot = { town: document.town, url: document.url, pageCount: pages.length, pages };
	reconcileConnecticutBallots(JSON.stringify({ documents: [ballot] }), { electionDate, documents: [{ town: ballot.town, url: ballot.url, pageCount: ballot.pageCount }], retainUnassignedDistrictClaims: true, publishedOfficeSet: true });
	return ballot;
}
export async function fetchConnecticutCandidateCapture(source: StateBallotSource, options: ConnecticutCaptureOptions = {}) {
	validateConnecticutSource(source);
	const textExecutable = options.extractor ? undefined : await resolveStateBallotPdfExtractor();
	const svgExecutable = options.extractor ? undefined : await resolveStateBallotPdfSvgExtractor();
	const discovery = options.discovery ?? await fetchConnecticutCycleDiscovery(options);
	const offered = readConnecticutDiscovery(discovery).find(item => item.election.electionDate === source.electionDate && item.election.pageUrl === source.pageUrl);
	if (!offered?.documents.length) throw new Error("The Connecticut election has no offered town ballots.");
	const documents: CapturedDocument[] = [];
	for (const document of offered.documents) {
		await (options.wait ?? (delay => new Promise(resolve => setTimeout(resolve, delay))))(11000);
		const captured = { town: document.town, ...await fetchStateBallotPdfDocument(document.url, { allowedHosts: ["portal.ct.gov"], request: options.requestDocument, extractor: async bytes => JSON.stringify(await (options.extractor ? options.extractor(bytes) : extractStateBallotPdfGrid(bytes, { textExecutable, svgExecutable, allowSmallCandidateGrids: true, allowQuestionPages: true, instructionPageTextSha256: connecticutInstructionPageSha256 }))), now: options.now }) };
		capturedPages(captured, source.electionDate);
		documents.push(captured);
		if (Buffer.byteLength(JSON.stringify({ discovery, documents })) > 12 * 1024 * 1024 - 1024) throw new Error("The Connecticut candidate capture exceeds its bounds.");
	}
	return JSON.stringify({ schemaVersion: 1, type: "connecticut-town-candidates", discovery, documents });
}

export function parseConnecticutCandidateCapture(source: StateBallotSource, body: string, factory: (source: StateBallotSource, values: StateCandidateValues) => StateCandidateRecord | null, now = Date.now(), previous: readonly StateCandidateRecord[] = []) {
	validateConnecticutSource(source);
	if (Buffer.byteLength(body) > 12 * 1024 * 1024) throw new Error("The Connecticut candidate capture exceeds its bounds.");
	const value = JSON.parse(body);
	if (!connecticutExactKeys(value, ["schemaVersion", "type", "discovery", "documents"]) || value.schemaVersion !== 1 || value.type !== "connecticut-town-candidates" || typeof value.discovery !== "string" || !Array.isArray(value.documents)) throw new Error("The Connecticut candidate capture is incomplete.");
	const offered = readConnecticutDiscovery(value.discovery).find(item => item.election.electionDate === source.electionDate && item.election.pageUrl === source.pageUrl);
	if (!offered?.documents.length || value.documents.length !== offered.documents.length) throw new Error("The Connecticut capture is not bound to its complete offered election.");
	const captured = value.documents.map((document, position) => {
		if (!connecticutExactKeys(document, ["town", "url", "sha256", "retrievedAt", "text"]) || document.town !== offered.documents[position]!.town || document.url !== offered.documents[position]!.url || typeof document.sha256 !== "string" || !/^[a-f0-9]{64}$/u.test(document.sha256) || typeof document.retrievedAt !== "string" || !Number.isFinite(Date.parse(document.retrievedAt)) || new Date(document.retrievedAt).toISOString() !== document.retrievedAt || Date.parse(document.retrievedAt) > now || typeof document.text !== "string" || Buffer.byteLength(document.text) > 4 * 1024 * 1024) throw new Error("The Connecticut document provenance is invalid.");
		return document as unknown as CapturedDocument;
	});
	const documents = captured.map(document => capturedPages(document, source.electionDate));
	const result = reconcileConnecticutBallots(JSON.stringify({ documents }), { electionDate: source.electionDate, documents: documents.map(({ town, url, pageCount }) => ({ town, url, pageCount })), retainUnassignedDistrictClaims: true, publishedOfficeSet: true });
	const identity = (record: StateCandidateValues | StateCandidateRecord) => JSON.stringify([record.scope, record.office, record.district, record.jurisdiction ?? "", record.name.toLowerCase().replace(/[\s.'’‘"]/gu, ""), (record.party ?? "").split(" / ").sort()]);
	const previousValues = new Map(previous.map(record => [identity(record), record]));
	const records = result.records.map(({ value, ballotDesignation }) => {
		const prior = previousValues.get(identity(value));
		const record = factory(source, prior ? { ...value, name: prior.name, party: prior.party ?? "" } : value);
		if (!record) throw new Error("The Connecticut candidate record is incomplete.");
		record.sourceStatus = "Printed sample ballot";
		if (ballotDesignation) record.ballotDesignation = ballotDesignation;
		return record;
	});
	const provenance = captured.map(({ town, url, sha256, retrievedAt }, position) => ({ town, url, sha256, retrievedAt, includedRecordCount: result.records.filter(record => result.claims[record.claimIndexes[0]!]!.documentIndex === position).length }));
	return { records, documents: provenance, collectionIndexSha256: connecticutIndexDigest(offered.documents), retrievedAt: new Date(Math.min(...provenance.map(document => Date.parse(document.retrievedAt)))).toISOString(), sha256: connecticutDigest(JSON.stringify(provenance.map(({ url, sha256 }) => ({ url, sha256 })))) };
}
