import type { fetchRemoteSourceDocument } from "./remote-json-source.js";
import type { StateCandidateValues } from "./state-ballot-additional-records.js";
import type { ClarkCandidateClaim } from "./state-ballot-clark-tables.js";
import type { StateBallotTablePage } from "./state-ballot-pdf-grid.js";
import type { StateCandidateRecord } from "./state-ballot-records.js";
import type { StateBallotSource } from "./state-ballot-sources.js";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { clarkDigest, clarkExactKeys, clarkIndexDigest, fetchClarkCycleDiscovery, readClarkDiscovery, validateClarkSource } from "./state-ballot-clark-discovery.js";
import { reconcileClarkCandidateTables } from "./state-ballot-clark-tables.js";
import { extractStateBallotPdfTables } from "./state-ballot-pdf-grid.js";
import { fetchStateBallotPdfDocument, resolveStateBallotPdfExtractor, resolveStateBallotPdfSvgExtractor } from "./state-ballot-pdf.js";
import { StateBallotAwaitingRecordsError } from "./state-ballot-source-state.js";

const parties: Record<string, string> = { DEM: "Democratic", REP: "Republican", NP: "Nonpartisan", NPP: "No Political Party", IAP: "Independent American Party", LPN: "Libertarian Party of Nevada" };
function officeValues(claim: ClarkCandidateClaim): Omit<StateCandidateValues, "name" | "party"> {
	const raw = claim.officeParts.join(" ");
	const label = raw.replace(/ NOTE: This office covers areas in multiple Counties, i\.e\., [A-Za-z ,;.]+$/u, "").replace(/ \(See NRS 396\.040; AB118 \[2023\]\)/u, "").replace(/ Vote for not more than \d{1,2}$/u, "");
	let match: RegExpExecArray | null;
	match = /^(Representative in Congress|State Senate|State Assembly) District ([1-9]\d?)$/u.exec(label);
	if (match) {
		const scope = match[1] === "Representative in Congress" ? "congressional" : match[1] === "State Senate" ? "state-senate" : "state-house";
		if (claim.section !== (scope === "congressional" ? "FEDERAL PARTISAN" : "STATE PARTISAN")) throw new Error("The Clark County legislative section conflicts with its office.");
		return { office: `${match[1]}, District ${match[2]}`, district: match[2], scope };
	}
	if (claim.section === "STATE PARTISAN" && ["Governor", "Lieutenant Governor", "Secretary of State", "State Treasurer", "State Controller", "Attorney General"].includes(label)) return { office: label, scope: "statewide" };
	if (claim.section === "COUNTY PARTISAN") {
		match = /^County Commission District ([A-Z])$/u.exec(label);
		if (match) return { office: `County Commission, District ${match[1]}`, district: match[1], scope: "local", jurisdiction: "Clark County" };
		if (["District Attorney", "County Assessor", "County Clerk", "County Recorder", "County Treasurer", "Public Administrator"].includes(label)) return { office: label, scope: "local", jurisdiction: "Clark County" };
	}
	if (claim.section === "STATE AND DISTRICT NONPARTISAN") {
		match = /^Justice of the Supreme Court Seat ([A-Z])$/u.exec(label);
		if (match) return { office: `Justice of the Supreme Court, Seat ${match[1]}`, scope: "statewide" };
		match = /^District Court Judge (Family Division )?Department ([A-Z]|[1-9]\d?)$/u.exec(label);
		if (match) return { office: `District Court Judge, ${match[1] ?? ""}Department ${match[2]}`, scope: "local" };
		match = /^Board of Regents District ([1-9]\d?)$/u.exec(label);
		if (match) return { office: `Board of Regents, District ${match[1]}`, district: match[1], scope: "local", jurisdiction: "Board of Regents" };
	}
	if (claim.section === "COUNTY NONPARTISAN") {
		match = /^Trustee Clark County School District ([A-Z])$/u.exec(label);
		if (match) return { office: `Trustee, Clark County School District ${match[1]}`, district: match[1], scope: "local", jurisdiction: "Clark County School District" };
		match = /^Board Member (Moapa Valley Water District) (Logandale|Overton)$/u.exec(label) ?? /^Board Member (Virgin Valley Water District) (Mesquite)$/u.exec(label);
		if (match) return { office: "Board Member", scope: "local", jurisdiction: `${match[1]}, ${match[2]}` };
		if (label === "Moapa Valley Town Advisory Board") return { office: label, scope: "local", jurisdiction: "Moapa Valley" };
	}
	if (claim.section === "CITY (ALL NONPARTISAN)" && claim.localSection && label.startsWith(`${claim.localSection} `)) {
		const local = label.slice(claim.localSection.length + 1);
		const base = { scope: "local" as const, jurisdiction: claim.localSection };
		if (["Mayor", "Council Member At Large"].includes(local)) return { ...base, office: local };
		match = /^(City Council|Councilman|Council Member) Ward ([IVX]+|[1-9]\d?)$/u.exec(local);
		if (match) return { ...base, office: `${match[1]}, Ward ${match[2]}`, district: match[2] };
		match = /^Councilmember Seat ([1-9]\d?)$/u.exec(local);
		if (match) return { ...base, office: `Councilmember, Seat ${match[1]}`, district: match[1] };
		match = /^Municipal Court Judge Department ([1-9]\d?)$/u.exec(local);
		if (match) return { ...base, office: `Municipal Court Judge, Department ${match[1]}` };
	}
	if (claim.section === "TOWNSHIP NONPARTISAN") {
		match = /^Constable ([A-Za-z ]+ Township)$/u.exec(label);
		if (match) return { office: "Constable", scope: "local", jurisdiction: match[1] };
		match = /^Justice of the Peace ([A-Za-z ]+ Township) Department ([1-9]\d?)$/u.exec(label);
		if (match) return { office: `Justice of the Peace, Department ${match[2]}`, scope: "local", jurisdiction: match[1] };
	}
	throw new Error("The Clark County printed office or section requires review.");
}
export function normalizeClarkCandidateClaims(claims: ClarkCandidateClaim[], source: StateBallotSource, factory: (source: StateBallotSource, values: StateCandidateValues) => StateCandidateRecord | null, previous: readonly StateCandidateRecord[] = []) {
	const identityKey = (record: StateCandidateRecord) => JSON.stringify([record.name, record.office, record.party ?? "", record.district, record.scope, record.jurisdiction ?? "", record.ballotDesignation ?? ""].map(value => value.toLowerCase()));
	const prior = new Map(previous.map(record => [identityKey(record), record]));
	const records = claims.map((claim) => {
		const record = factory(source, { ...officeValues(claim), name: claim.name.replace(/[‘’]/gu, "'").replace(/[“”]/gu, "\""), party: parties[claim.partyCode]! });
		if (!record) throw new Error("The Clark County candidate is incomplete.");
		record.ballotDesignation = /Unexpired/u.test(claim.term) ? claim.term.toLowerCase() : `${claim.term}-year term`;
		const identity = [source.id, source.stateCode, source.electionDate, ...[record.name, record.office, record.party ?? "", record.district, record.scope, record.jurisdiction ?? "", record.ballotDesignation].map(value => value.toLocaleLowerCase("en-US"))];
		record.id = createHash("sha256").update(JSON.stringify(identity)).digest("hex").slice(0, 24);
		const accepted = prior.get(identityKey(record));
		if (accepted) record.id = accepted.id;
		if (record.scope === "local") record.sourceAreaLabel = "Clark County";
		const voteLimit = / Vote for not more than (\d{1,2})$/u.exec(claim.officeParts.join(" "))?.[1];
		if (voteLimit) record.voteLimit = Number(voteLimit);
		return record;
	});
	if (new Set(records.map(record => record.id)).size !== records.length) throw new Error("The Clark County table has duplicate candidate identities.");
	return records;
}
type CaptureOptions = Parameters<typeof fetchClarkCycleDiscovery>[0] & { requestDocument?: typeof fetchRemoteSourceDocument; extractor?: (bytes: Buffer) => Promise<StateBallotTablePage[]>; discovery?: string; now?: () => number };
export async function fetchClarkCandidateCapture(source: StateBallotSource, options: CaptureOptions = {}) {
	validateClarkSource(source);
	const configuredText = options.extractor || options.discovery ? undefined : await resolveStateBallotPdfExtractor();
	const configuredSvg = options.extractor || options.discovery ? undefined : await resolveStateBallotPdfSvgExtractor();
	const discovery = options.discovery ?? await fetchClarkCycleDiscovery(options);
	const offered = readClarkDiscovery(discovery);
	if (offered.election.electionDate !== source.electionDate || offered.election.pageUrl !== source.pageUrl) throw new Error("The Clark County source is not offered by its current index.");
	if (offered.documents.length !== 2) return JSON.stringify({ schemaVersion: 1, type: "clark-candidate-capture", discovery, documents: [] });
	const textExecutable = options.extractor ? undefined : configuredText ?? await resolveStateBallotPdfExtractor();
	const svgExecutable = options.extractor ? undefined : configuredSvg ?? await resolveStateBallotPdfSvgExtractor();
	const documents = [];
	for (const document of offered.documents) {
		await (options.wait ?? (delay => new Promise(resolve => setTimeout(resolve, delay))))(11000);
		documents.push(await fetchStateBallotPdfDocument(document.url, { allowedHosts: ["www.clarkcountynv.gov"], request: options.requestDocument, now: options.now, extractor: async bytes => JSON.stringify(await (options.extractor ? options.extractor(bytes) : extractStateBallotPdfTables(bytes, { textExecutable, svgExecutable }))) }));
	}
	return JSON.stringify({ schemaVersion: 1, type: "clark-candidate-capture", discovery, documents });
}
export function parseClarkCandidateCapture(source: StateBallotSource, body: string, factory: (source: StateBallotSource, values: StateCandidateValues) => StateCandidateRecord | null, now = Date.now(), previous: readonly StateCandidateRecord[] = []) {
	validateClarkSource(source);
	if (Buffer.byteLength(body) > 12 * 1024 * 1024) throw new Error("The Clark County candidate capture exceeds its bounds.");
	const value = JSON.parse(body);
	if (!clarkExactKeys(value, ["schemaVersion", "type", "discovery", "documents"]) || value.schemaVersion !== 1 || value.type !== "clark-candidate-capture" || typeof value.discovery !== "string" || !Array.isArray(value.documents) || value.documents.length > 2) throw new Error("The Clark County candidate capture is incomplete.");
	const offered = readClarkDiscovery(value.discovery);
	if (offered.election.electionDate !== source.electionDate || offered.election.pageUrl !== source.pageUrl) throw new Error("The Clark County capture is not bound to its offered election.");
	if (offered.documents.length !== 2 && value.documents.length === 0) throw new StateBallotAwaitingRecordsError(source.id);
	if (offered.documents.length !== 2 || value.documents.length !== 2) throw new Error("The Clark County capture is not bound to its complete offered election.");
	const documents = value.documents.map((document, index) => {
		if (!clarkExactKeys(document, ["url", "sha256", "retrievedAt", "text"]) || document.url !== offered.documents[index]!.url || typeof document.sha256 !== "string" || !/^[a-f\d]{64}$/u.test(document.sha256) || typeof document.retrievedAt !== "string" || !Number.isFinite(Date.parse(document.retrievedAt)) || new Date(document.retrievedAt).toISOString() !== document.retrievedAt || Date.parse(document.retrievedAt) > now || typeof document.text !== "string" || Buffer.byteLength(document.text) > 4 * 1024 * 1024) throw new Error("The Clark County document provenance is invalid.");
		return document as unknown as { url: string; sha256: string; retrievedAt: string; text: string };
	});
	const reconciled = reconcileClarkCandidateTables(JSON.parse(documents[0]!.text), JSON.parse(documents[1]!.text), source.electionDate);
	const records = normalizeClarkCandidateClaims(reconciled.claims, source, factory, previous);
	const provenance = documents.map(({ url, sha256, retrievedAt }, index) => ({ url, sha256, retrievedAt, includedRecordCount: index ? 0 : records.length }));
	return { records, documents: provenance, collectionIndexSha256: clarkIndexDigest(offered.documents), retrievedAt: new Date(Math.min(...documents.map(document => Date.parse(document.retrievedAt)))).toISOString(), sha256: clarkDigest(JSON.stringify(provenance.map(({ url, sha256 }) => ({ url, sha256 })))) };
}
