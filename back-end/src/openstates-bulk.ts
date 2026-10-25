import type { ElectionReferenceSource } from "./election-reference-sources.js";
import type { ElectionReferenceSnapshot } from "./election-references.js";
import type { StateBallotSnapshot } from "./state-ballot-repository.js";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { parse } from "csv-parse/sync";
import { containsControlCharacters } from "./text-validation.js";

const electionDate = "2026-11-03";
const stateCodes = ["AK", "AL", "AR", "AZ", "CA", "CO", "CT", "DC", "DE", "FL", "GA", "HI", "IA", "ID", "IL", "IN", "KS", "KY", "LA", "MA", "MD", "ME", "MI", "MN", "MO", "MS", "MT", "NC", "ND", "NE", "NH", "NJ", "NM", "NV", "NY", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VA", "VT", "WA", "WI", "WV", "WY"];
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
const normalizeName = (value: string) => value.normalize("NFC").toLocaleUpperCase("en-US").replace(/\./gu, "").replace(/’/gu, "'").replace(/\s+/gu, " ").trim();
const normalizeDistrict = (value: string) => value.normalize("NFC").trim().toLocaleUpperCase("en-US");
const validText = (value: unknown, maximum: number): value is string => typeof value === "string" && value.trim().length > 0 && value.length <= maximum && !containsControlCharacters(value);

export const openStatesBulkPublication = {
	pageUrl: "https://open.pluralpolicy.com/data/legislator-csv/",
	termsUrl: "https://open.pluralpolicy.com/tos/",
	licenseUrl: "https://github.com/openstates/people/blob/main/README.md",
	maximumBytes: 2 * 1024 * 1024,
	minimumRefreshIntervalMs: 24 * 60 * 60 * 1000,
};

export const openStatesBulkSources: readonly ElectionReferenceSource[] = stateCodes.map(stateCode => ({
	id: `openstates-${stateCode.toLowerCase()}-service-${electionDate.slice(0, 4)}`,
	stateCode,
	electionDate,
	optional: true,
	documents: [{
		url: `https://data.openstates.org/people/current/${stateCode.toLowerCase()}.csv`,
		pageUrl: openStatesBulkPublication.pageUrl,
		title: `Open States current legislators (${stateCode})`,
		publisher: "Open States",
		kind: "public-dataset" as const,
	}],
}));

export interface OpenStatesBulkLegislator {
	id: string;
	name: string;
	district: string;
	chamber: "upper" | "lower" | "legislature";
	sourceRow: number;
}

export interface OpenStatesCandidateMatch {
	candidateSourceId: string;
	candidateId: string;
	candidateName: string;
	candidateCapturedAt: string;
	candidateSourceSha256: string;
	personId: string;
	datasetName: string;
	chamber: string;
	district: string;
	sourceRow: number;
	referenceId: string;
}

export function parseOpenStatesBulk(body: string): OpenStatesBulkLegislator[] {
	if (Buffer.byteLength(body) > openStatesBulkPublication.maximumBytes)
		throw new Error("Open States bulk data exceeds its size limit.");
	const rows = parse(body, {
		bom: true,
		skip_empty_lines: true,
		max_record_size: 64 * 1024,
		columns(headers: string[]) {
			if (new Set(headers).size !== headers.length || !["id", "name", "current_chamber", "current_district"].every(header => headers.includes(header)))
				throw new Error("Open States bulk data has invalid or missing columns.");
			return headers;
		},
	}) as Record<string, unknown>[];
	if (!rows.length || rows.length > 1000)
		throw new Error("Open States bulk data has an invalid row count.");
	const legislators = rows.map((row, index) => {
		if (typeof row.id !== "string" || !/^ocd-person\/[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/u.test(row.id) || !validText(row.name, 250) || !validText(row.current_district, 150) || !["upper", "lower", "legislature"].includes(String(row.current_chamber)))
			throw new Error("Open States bulk data contains an invalid legislator identity or role.");
		return { id: row.id, name: row.name.trim(), district: (row.current_district as string).trim(), chamber: row.current_chamber as OpenStatesBulkLegislator["chamber"], sourceRow: index + 2 };
	});
	if (new Set(legislators.map(person => person.id)).size !== legislators.length)
		throw new Error("Open States bulk data contains duplicate person identifiers.");
	return legislators;
}

export function prepareOpenStatesReferences(options: { source: ElectionReferenceSource; body: string; capturedAt: string; sha256: string; candidates: readonly StateBallotSnapshot[]; allowedCandidateSourceIds: readonly string[]; now?: number }) {
	const source = options.source;
	const configured = openStatesBulkSources.find(item => item.id === source.id);
	const now = options.now ?? Date.now();
	const capturedAt = Date.parse(options.capturedAt);
	if (!configured || JSON.stringify(configured) !== JSON.stringify(source) || !Number.isFinite(capturedAt) || capturedAt > now || capturedAt < Date.parse(`${source.electionDate.slice(0, 4)}-01-01T00:00:00Z`) || options.sha256 !== digest(options.body))
		throw new Error("Open States source or capture provenance is invalid.");
	if (!options.allowedCandidateSourceIds.length || new Set(options.allowedCandidateSourceIds).size !== options.allowedCandidateSourceIds.length)
		throw new Error("Reviewed candidate sources must be explicitly selected without duplicates.");
	const people = parseOpenStatesBulk(options.body);
	const matches: OpenStatesCandidateMatch[] = [];
	const holds: { candidateSourceId: string; candidateId: string; reason: "missing-district" | "no-exact-match" | "ambiguous-match" }[] = [];
	const records: ElectionReferenceSnapshot["records"] = [];
	for (const snapshot of options.candidates) {
		if (!options.allowedCandidateSourceIds.includes(snapshot.source.id) || snapshot.source.stateCode !== source.stateCode || snapshot.source.electionDate !== source.electionDate || !Number.isFinite(Date.parse(snapshot.retrievedAt)) || Date.parse(snapshot.retrievedAt) > now || !/^[a-f0-9]{64}$/u.test(snapshot.sha256))
			throw new Error("A candidate snapshot is outside the reviewed state, election or source selection.");
		for (const candidate of snapshot.records) {
			if (!["state-senate", "state-house"].includes(candidate.scope) || !["listed", "filed", "qualified", "write-in", "unopposed"].includes(candidate.status)) continue;
			if (!candidate.district) {
				holds.push({ candidateSourceId: snapshot.source.id, candidateId: candidate.id, reason: "missing-district" });
				continue;
			}
			if (snapshot.records.some(other => other.id !== candidate.id && ["listed", "filed", "qualified", "write-in", "unopposed"].includes(other.status) && other.scope === candidate.scope && normalizeDistrict(other.district) === normalizeDistrict(candidate.district) && normalizeName(other.name) === normalizeName(candidate.name))) {
				holds.push({ candidateSourceId: snapshot.source.id, candidateId: candidate.id, reason: "ambiguous-match" });
				continue;
			}
			const found = people.filter(person => normalizeName(person.name) === normalizeName(candidate.name) && person.chamber === (candidate.scope === "state-senate" ? "upper" : "lower") && normalizeDistrict(person.district) === normalizeDistrict(candidate.district!));
			if (found.length !== 1) {
				holds.push({ candidateSourceId: snapshot.source.id, candidateId: candidate.id, reason: found.length ? "ambiguous-match" : "no-exact-match" });
				continue;
			}
			const person = found[0]!;
			const referenceId = digest(`${source.id}/${person.id}`).slice(0, 24);
			matches.push({ candidateSourceId: snapshot.source.id, candidateId: candidate.id, candidateName: candidate.name, candidateCapturedAt: snapshot.retrievedAt, candidateSourceSha256: snapshot.sha256, personId: person.id, datasetName: person.name, chamber: person.chamber, district: person.district, sourceRow: person.sourceRow, referenceId });
			if (records.some(record => record.id === referenceId)) continue;
			records.push({ id: referenceId, name: candidate.name, office: candidate.office, scope: candidate.scope, jurisdiction: `District ${person.district}`, facts: [`Listed by Open States as a serving state legislator for District ${person.district}.`], sourceDocumentIndex: 0 });
		}
	}
	if (!records.length) return { snapshot: null, matches, holds, datasetRecordCount: people.length };
	const documents = [{ url: source.documents[0]!.url, sha256: options.sha256, capturedAt: new Date(capturedAt).toISOString(), includedRecordCount: records.length }];
	const snapshot: ElectionReferenceSnapshot = { schemaVersion: 1, type: "election-references", stateCode: source.stateCode, sourceId: source.id, electionDate: source.electionDate, retrievedAt: documents[0]!.capturedAt, sourceSha256: digest(JSON.stringify(documents.map(({ url, sha256 }) => ({ url, sha256 })))), recordCount: records.length, documents, records };
	return { snapshot, matches, holds, datasetRecordCount: people.length };
}
