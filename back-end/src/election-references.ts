import type { ElectionReferenceSource } from "./election-reference-sources.js";
import type { PublicElectionReference, StateRecordScope } from "./types/civic.js";
import { Buffer } from "node:buffer";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, open, realpath, rename, unlink } from "node:fs/promises";
import { join } from "node:path";
import process from "node:process";
import { electionReferenceSources } from "./election-reference-sources.js";
import { normalizePublicHref } from "./public-href.js";
import { assertExternalStateDataDirectory, readBoundedStateData } from "./state-ballot-storage.js";
import { containsControlCharacters } from "./text-validation.js";

interface ElectionReferenceRecord {
	id: string;
	name: string;
	office: string;
	scope: StateRecordScope;
	jurisdiction?: string;
	facts: string[];
	sourceDocumentIndex: number;
}

export interface ElectionReferenceSnapshot {
	schemaVersion: 1;
	type: "election-references";
	stateCode: string;
	sourceId: string;
	electionDate: string;
	retrievedAt: string;
	sourceSha256: string;
	recordCount: number;
	documents: { url: string; sha256: string; capturedAt: string; includedRecordCount: number }[];
	records: ElectionReferenceRecord[];
}

export interface ElectionReferenceRepository {
	getSnapshot: (stateCode: string) => Promise<ElectionReferenceSnapshot | null>;
	getSnapshots?: (stateCode: string) => Promise<ElectionReferenceSnapshot[]>;
}

const maximumBytes = 12 * 1024 * 1024;
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
const validHash = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{64}$/u.test(value);
const validText = (value: unknown, maximum: number): value is string => typeof value === "string" && Boolean(value.trim()) && value === value.trim() && value.length <= maximum && !containsControlCharacters(value);
const exactKeys = (value: Record<string, unknown>, allowed: readonly string[]) => Object.keys(value).every(key => allowed.includes(key));

export function parseElectionReferenceSnapshot(source: ElectionReferenceSource, body: string, now = Date.now()): ElectionReferenceSnapshot {
	if (Buffer.byteLength(body) > maximumBytes) throw new Error("Election reference data exceeds its size limit.");
	const data = JSON.parse(body) as ElectionReferenceSnapshot;
	if (!data || Array.isArray(data) || typeof data !== "object" || !exactKeys(data as unknown as Record<string, unknown>, ["schemaVersion", "type", "stateCode", "sourceId", "electionDate", "retrievedAt", "sourceSha256", "recordCount", "documents", "records"]) || data.schemaVersion !== 1 || data.type !== "election-references" || data.stateCode !== source.stateCode || data.sourceId !== source.id || data.electionDate !== source.electionDate)
		throw new Error("Election references do not match their configured collection.");
	if (!Array.isArray(data.documents) || data.documents.length !== source.documents.length || !data.documents.length || !Array.isArray(data.records) || !data.records.length || data.records.length > 25_000 || data.recordCount !== data.records.length)
		throw new Error("Election references have an invalid document set or record count.");
	for (const [index, document] of data.documents.entries()) {
		const configured = source.documents[index]!;
		if (configured.pageUrl !== undefined && (normalizePublicHref(configured.pageUrl) !== configured.pageUrl || !configured.pageUrl.startsWith("https://")))
			throw new Error("Election reference public page links are invalid.");
		if (!document || typeof document !== "object" || Array.isArray(document) || !exactKeys(document, ["url", "sha256", "capturedAt", "includedRecordCount"]) || document.url !== configured.url || normalizePublicHref(document.url) !== document.url || !document.url.startsWith("https://") || !validHash(document.sha256) || typeof document.capturedAt !== "string" || !Number.isFinite(Date.parse(document.capturedAt)) || Date.parse(document.capturedAt) > now || !Number.isSafeInteger(document.includedRecordCount) || document.includedRecordCount < 0 || (configured.publishedDate && Date.parse(document.capturedAt) < Date.parse(configured.publishedDate)))
			throw new Error("Election reference document provenance is invalid.");
	}
	if (!validHash(data.sourceSha256) || digest(JSON.stringify(data.documents.map(({ url, sha256 }) => ({ url, sha256 })))) !== data.sourceSha256 || data.retrievedAt !== new Date(Math.min(...data.documents.map(document => Date.parse(document.capturedAt)))).toISOString())
		throw new Error("Election reference capture provenance does not match its documents.");
	for (const record of data.records) {
		if (!record || typeof record !== "object" || Array.isArray(record) || !exactKeys(record as unknown as Record<string, unknown>, ["id", "name", "office", "scope", "jurisdiction", "facts", "sourceDocumentIndex"]) || typeof record.id !== "string" || !/^[a-f0-9]{24}$/u.test(record.id) || !validText(record.name, 250) || !validText(record.office, 300) || !["statewide", "congressional", "state-senate", "state-house", "local"].includes(record.scope) || (record.jurisdiction !== undefined && !validText(record.jurisdiction, 300)) || !Array.isArray(record.facts) || (!record.facts.length && source.allowIdentityOnly !== true) || record.facts.length > 6 || !record.facts.every(fact => validText(fact, 600)) || !Number.isSafeInteger(record.sourceDocumentIndex) || record.sourceDocumentIndex < 0 || record.sourceDocumentIndex >= data.documents.length)
			throw new Error("Election reference fields are invalid.");
	}
	if (new Set(data.records.map(record => record.id)).size !== data.records.length || data.documents.some((document, index) => document.includedRecordCount !== data.records.filter(record => record.sourceDocumentIndex === index).length))
		throw new Error("Election reference identities or document contributions are inconsistent.");
	return data;
}

export function createElectionReferenceStorage(directory: string) {
	assertExternalStateDataDirectory(directory);
	async function location(source: ElectionReferenceSource, create: boolean) {
		if (!/^[a-z0-9][a-z0-9-]{0,100}$/u.test(source.id)) throw new Error("Invalid election reference storage identifier.");
		if (create) await mkdir(directory, { recursive: true });
		const canonical = await realpath(directory);
		assertExternalStateDataDirectory(canonical);
		return join(canonical, `references-${source.id}.json`);
	}
	return {
		async read(source: ElectionReferenceSource, now = Date.now()) {
			try {
				const envelope = JSON.parse(await readBoundedStateData(await location(source, false)));
				if (!envelope || Array.isArray(envelope) || typeof envelope !== "object" || Object.keys(envelope).sort().join(",") !== "snapshot,sourceConfigurationSha256" || envelope.sourceConfigurationSha256 !== digest(JSON.stringify(source)) || typeof envelope.snapshot !== "string") throw new Error("Stored election references do not match their configured collection.");
				return parseElectionReferenceSnapshot(source, envelope.snapshot, now);
			}
			catch (error) {
				if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
				throw error;
			}
		},
		async write(source: ElectionReferenceSource, snapshot: ElectionReferenceSnapshot) {
			const snapshotBody = JSON.stringify(snapshot);
			parseElectionReferenceSnapshot(source, snapshotBody);
			const body = JSON.stringify({ sourceConfigurationSha256: digest(JSON.stringify(source)), snapshot: snapshotBody });
			if (Buffer.byteLength(body) > maximumBytes) throw new Error("Stored election references exceed their size limit.");
			const target = await location(source, true);
			const temporary = `${target}.${randomUUID()}.tmp`;
			try {
				const handle = await open(temporary, "wx");
				try {
					await handle.writeFile(body);
					await handle.sync();
				}
				finally {
					await handle.close();
				}
				await rename(temporary, target);
			}
			finally {
				await unlink(temporary).catch((error: NodeJS.ErrnoException) => {
					if (error.code !== "ENOENT") throw error;
				});
			}
		},
	};
}

export function selectElectionReferenceSources(sources: readonly ElectionReferenceSource[], stateCode: string, now = Date.now()) {
	const active = sources.filter(source => source.stateCode === stateCode.toUpperCase() && now < Date.parse(`${source.electionDate}T00:00:00Z`) + 2 * 24 * 60 * 60 * 1000);
	const electionDate = active.map(source => source.electionDate).sort()[0];
	return active.filter(source => source.electionDate === electionDate);
}

export function createElectionReferenceRepository(options: { dataDirectory?: string | null; now?: () => number; sources?: readonly ElectionReferenceSource[] } = {}): ElectionReferenceRepository {
	const directory = options.dataDirectory === undefined ? process.env.STATE_BALLOT_DATA_DIR || null : options.dataDirectory;
	const storage = directory ? createElectionReferenceStorage(directory) : null;
	const now = options.now ?? Date.now;
	const sources = options.sources ?? electionReferenceSources;
	async function getSnapshots(stateCode: string) {
		if (!storage) return [];
		const captureTime = now();
		const active = selectElectionReferenceSources(sources, stateCode, captureTime);
		const snapshots: ElectionReferenceSnapshot[] = [];
		let failed = false;
		for (const source of active) {
			try {
				const snapshot = await storage.read(source, captureTime);
				if (snapshot) snapshots.push(snapshot);
			}
			catch {
				failed = true;
			}
		}
		if (failed && !snapshots.length) throw new Error("Election reference collections are unavailable.");
		return snapshots;
	}
	return {
		getSnapshots,
		async getSnapshot(stateCode) {
			return (await getSnapshots(stateCode))[0] ?? null;
		},
	};
}

export function buildElectionReferencePage(source: ElectionReferenceSource, snapshot: ElectionReferenceSnapshot, filters: { search: string; scope: string; offset: number; limit: number }) {
	return buildElectionReferencePages([{ source, snapshot }], filters);
}

export function buildElectionReferencePages(collections: readonly { source: ElectionReferenceSource; snapshot: ElectionReferenceSnapshot }[], filters: { search: string; scope: string; offset: number; limit: number }) {
	if (new Set(collections.map(({ source }) => source.stateCode)).size > 1 || new Set(collections.map(({ source }) => source.electionDate)).size > 1 || new Set(collections.map(({ source }) => source.id)).size !== collections.length)
		throw new Error("Reference collections must belong to the same state and election without duplicate collections.");
	const entries = collections.flatMap(({ source, snapshot }) => {
		parseElectionReferenceSnapshot(source, JSON.stringify(snapshot));
		return snapshot.records.map(record => ({ source, snapshot, record }));
	});
	const matching = entries.filter(({ record }) => (filters.scope === "all" || record.scope === filters.scope) && (!filters.search || [record.name, record.office, record.jurisdiction, ...record.facts].join(" ").toLowerCase().includes(filters.search)));
	const offset = filters.offset >= matching.length ? Math.max(0, Math.floor((matching.length - 1) / filters.limit) * filters.limit) : filters.offset;
	const records: PublicElectionReference[] = matching.slice(offset, offset + filters.limit).map(({ source, snapshot, record }) => {
		const document = source.documents[record.sourceDocumentIndex]!;
		return { id: record.id, name: record.name, office: record.office, scope: record.scope, ...(record.jurisdiction ? { jurisdiction: record.jurisdiction } : {}), facts: record.facts, source: { ...document, collectionId: source.id, capturedAt: snapshot.documents[record.sourceDocumentIndex]!.capturedAt } };
	});
	return { total: entries.length, matched: matching.length, offset, limit: filters.limit, records };
}
