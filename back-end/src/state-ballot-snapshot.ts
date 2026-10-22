import type { StateCandidateRecord } from "./state-ballot-records.js";
import type { StateBallotSnapshot } from "./state-ballot-repository.js";
import type { StateBallotSource } from "./state-ballot-sources.js";
import { createHash } from "node:crypto";
import { normalizePublicHref } from "./public-href.js";

const recordFields = new Set(["id", "name", "office", "party", "district", "scope", "status", "sourceStatus", "ballotDesignation", "jurisdiction", "candidateUrl", "sourceCandidateId", "sourceDistrictLabel", "sourceDivision", "sourceAreaLabel"]);
const snapshotFields = new Set(["schemaVersion", "stateCode", "sourceId", "electionDate", "sourceUrl", "retrievalPolicy", "retrievedAt", "sourceSha256", "recordCount", "records", "documents"]);
const documentFields = new Set(["url", "sha256", "retrievedAt", "includedRecordCount"]);
const scopes = ["statewide", "congressional", "state-senate", "state-house", "local"];
const statuses = ["listed", "filed", "qualified", "write-in", "withdrawn", "disqualified", "defeated", "elected", "unopposed", "inactive", "unrecognized"];

export function parseBundledStateSnapshot(source: StateBallotSource, body: string, retrievalPolicy: "manual-snapshot" | "automatic" = "manual-snapshot"): StateBallotSnapshot {
	if (new TextEncoder().encode(body).length > 12 * 1024 * 1024)
		throw new Error("The bundled candidate snapshot exceeds its size limit.");
	const data = JSON.parse(body) as Record<string, unknown>;
	if (!data || data.schemaVersion !== 1 || data.stateCode !== source.stateCode || data.sourceId !== source.id || data.electionDate !== source.electionDate || data.sourceUrl !== source.pageUrl || data.retrievalPolicy !== retrievalPolicy || (retrievalPolicy === "automatic" && source.retrievalPolicy === "manual-snapshot"))
		throw new Error("The bundled candidate snapshot does not match its configured source.");
	if (Object.keys(data).some(key => !snapshotFields.has(key)))
		throw new Error("The bundled candidate snapshot has unexpected fields.");
	if (typeof data.retrievedAt !== "string" || !Number.isFinite(Date.parse(data.retrievedAt)) || typeof data.sourceSha256 !== "string" || !/^[a-f0-9]{64}$/u.test(data.sourceSha256))
		throw new Error("The bundled candidate snapshot has invalid provenance.");
	if (!Array.isArray(data.records) || !data.records.length || data.records.length > 25_000 || data.recordCount !== data.records.length)
		throw new Error("The bundled candidate snapshot has an invalid record count.");
	let documents: StateBallotSnapshot["documents"];
	if (["reviewed-pdf", "reviewed-xlsx", "reviewed-image", "pennsylvania-html", "west-virginia-json", "alaska-html", "connecticut-ballots", "oregon-ballots"].includes(source.format) || (source.format === "arkansas-html" && source.retrievalPolicy === "manual-snapshot")) {
		if (!Array.isArray(data.documents) || data.documents.length !== source.documentUrls?.length || !data.documents.length)
			throw new Error("The bundled candidate snapshot has an invalid document set.");
		documents = data.documents.map((value: unknown, index: number) => {
			if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("The bundled candidate document is invalid.");
			const item = value as Record<string, unknown>;
			if (Object.keys(item).some(key => !documentFields.has(key)) || item.url !== source.documentUrls?.[index] || typeof item.sha256 !== "string" || !/^[a-f0-9]{64}$/u.test(item.sha256) || typeof item.retrievedAt !== "string" || !Number.isFinite(Date.parse(item.retrievedAt)) || typeof item.includedRecordCount !== "number" || !Number.isSafeInteger(item.includedRecordCount) || item.includedRecordCount < 0)
				throw new Error("The bundled candidate document has invalid provenance.");
			return { url: item.url as string, sha256: item.sha256, retrievedAt: item.retrievedAt, includedRecordCount: item.includedRecordCount };
		});
		const digest = createHash("sha256").update(JSON.stringify(documents.map(({ url, sha256 }) => ({ url, sha256 })))).digest("hex");
		if (digest !== data.sourceSha256 || documents.reduce((count, document) => count + document.includedRecordCount, 0) !== data.recordCount || new Date(Math.min(...documents.map(document => Date.parse(document.retrievedAt)))).toISOString() !== data.retrievedAt)
			throw new Error("The bundled candidate document set does not match its captured provenance.");
	}
	else if (data.documents !== undefined) {
		throw new Error("The bundled candidate snapshot has unexpected documents.");
	}
	const records = data.records.map((value: unknown) => {
		if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("The bundled candidate record is invalid.");
		const row = value as Record<string, unknown>;
		if (Object.keys(row).some(key => !recordFields.has(key)) || typeof row.id !== "string" || !/^[a-f0-9]{24}$/u.test(row.id) || typeof row.name !== "string" || !row.name.trim() || row.name.length > 250 || typeof row.office !== "string" || !row.office.trim() || row.office.length > 300 || typeof row.district !== "string" || row.district.length > 40 || !scopes.includes(row.scope as string) || !statuses.includes(row.status as string))
			throw new Error("The bundled candidate record has an invalid layout.");
		for (const key of ["party", "sourceStatus", "ballotDesignation", "jurisdiction", "sourceCandidateId", "sourceDistrictLabel", "sourceDivision", "sourceAreaLabel"]) {
			if (row[key] !== undefined && (typeof row[key] !== "string" || row[key].length > 300))
				throw new Error("The bundled candidate record has an invalid public field.");
		}
		if (row.candidateUrl !== undefined && (typeof row.candidateUrl !== "string" || !/^https?:\/\//u.test(row.candidateUrl) || normalizePublicHref(row.candidateUrl) !== row.candidateUrl))
			throw new Error("The bundled candidate campaign link is unsafe.");
		return row as unknown as StateCandidateRecord;
	});
	if (new Set(records.map(record => record.id)).size !== records.length)
		throw new Error("The bundled candidate snapshot has duplicate identities.");
	return { source, retrievedAt: data.retrievedAt, sha256: data.sourceSha256, records, ...(documents ? { documents } : {}) };
}

export async function loadBundledStateSnapshot(source: StateBallotSource) {
	throw new Error(`No bundled candidate snapshot is configured for ${source.id}; import reviewed external data.`);
}
