import type { StateCandidateRecord } from "./state-ballot-records.js";
import type { StateBallotSnapshot } from "./state-ballot-repository.js";
import type { StateBallotSource } from "./state-ballot-sources.js";
import { readFile } from "node:fs/promises";
import { normalizePublicHref } from "./public-href.js";

const recordFields = new Set(["id", "name", "office", "party", "district", "scope", "status", "sourceStatus", "jurisdiction", "candidateUrl"]);
const snapshotFields = new Set(["schemaVersion", "stateCode", "sourceId", "electionDate", "sourceUrl", "retrievalPolicy", "retrievedAt", "sourceSha256", "recordCount", "records"]);
const scopes = ["statewide", "congressional", "state-senate", "state-house", "local"];
const statuses = ["listed", "filed", "qualified", "write-in", "withdrawn", "disqualified", "defeated", "elected", "unopposed", "inactive", "unrecognized"];

export function parseBundledStateSnapshot(source: StateBallotSource, body: string): StateBallotSnapshot {
	if (new TextEncoder().encode(body).length > 12 * 1024 * 1024)
		throw new Error("The bundled candidate snapshot exceeds its size limit.");
	const data = JSON.parse(body) as Record<string, unknown>;
	if (!data || data.schemaVersion !== 1 || data.stateCode !== source.stateCode || data.sourceId !== source.id || data.electionDate !== source.electionDate || data.sourceUrl !== source.pageUrl || data.retrievalPolicy !== "manual-snapshot")
		throw new Error("The bundled candidate snapshot does not match its configured source.");
	if (Object.keys(data).some(key => !snapshotFields.has(key)))
		throw new Error("The bundled candidate snapshot has unexpected fields.");
	if (typeof data.retrievedAt !== "string" || !Number.isFinite(Date.parse(data.retrievedAt)) || typeof data.sourceSha256 !== "string" || !/^[a-f0-9]{64}$/u.test(data.sourceSha256))
		throw new Error("The bundled candidate snapshot has invalid provenance.");
	if (!Array.isArray(data.records) || !data.records.length || data.records.length > 25_000 || data.recordCount !== data.records.length)
		throw new Error("The bundled candidate snapshot has an invalid record count.");
	const records = data.records.map((value: unknown) => {
		if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("The bundled candidate record is invalid.");
		const row = value as Record<string, unknown>;
		if (Object.keys(row).some(key => !recordFields.has(key)) || typeof row.id !== "string" || !/^[a-f0-9]{24}$/u.test(row.id) || typeof row.name !== "string" || !row.name.trim() || row.name.length > 250 || typeof row.office !== "string" || !row.office.trim() || row.office.length > 300 || typeof row.district !== "string" || row.district.length > 40 || !scopes.includes(row.scope as string) || !statuses.includes(row.status as string))
			throw new Error("The bundled candidate record has an invalid layout.");
		for (const key of ["party", "sourceStatus", "jurisdiction"]) {
			if (row[key] !== undefined && (typeof row[key] !== "string" || row[key].length > 300))
				throw new Error("The bundled candidate record has an invalid public field.");
		}
		if (row.candidateUrl !== undefined && (typeof row.candidateUrl !== "string" || !/^https?:\/\//u.test(row.candidateUrl) || normalizePublicHref(row.candidateUrl) !== row.candidateUrl))
			throw new Error("The bundled candidate campaign link is unsafe.");
		return row as unknown as StateCandidateRecord;
	});
	if (new Set(records.map(record => record.id)).size !== records.length)
		throw new Error("The bundled candidate snapshot has duplicate identities.");
	return { source, retrievedAt: data.retrievedAt, sha256: data.sourceSha256, records };
}

export async function loadBundledStateSnapshot(source: StateBallotSource) {
	if (source.id !== "il-sbe-2026" || source.retrievalPolicy !== "manual-snapshot")
		throw new Error("No bundled candidate snapshot is configured for this source.");
	const body = await readFile(new URL("./data/state-ballots/illinois-2026.json", import.meta.url), "utf8");
	return parseBundledStateSnapshot(source, body);
}
