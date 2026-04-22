import type {
	Candidate,
	CoverageSnapshotSourceType,
	CoverageSnapshotStatus,
	DataSourcesResponse,
	Election,
	ElectionSummary,
	Jurisdiction,
	JurisdictionSummary,
	LocationSelection,
	Measure,
	Source,
} from "./types/civic.js";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import {
	demoCandidates,
	demoDataSources,
	demoElection,
	demoElectionSummaries,
	demoJurisdiction,
	demoJurisdictionSummaries,
	demoLocation,
	demoMeasures,
	demoSources,
} from "./coverage-data.js";

export interface CoverageSnapshot {
	candidates: Candidate[];
	dataSources: DataSourcesResponse;
	election: Election | null;
	electionSummaries: ElectionSummary[];
	jurisdiction: Jurisdiction | null;
	jurisdictionSummaries: JurisdictionSummary[];
	location: LocationSelection | null;
	measures: Measure[];
	sources: Source[];
	updatedAt: string;
}

export interface CoverageRepository {
	data: CoverageSnapshot;
	getCandidateBySlug: (slug: string) => Candidate | null;
	getCandidatesBySlugs: (slugs: string[]) => Candidate[];
	getElectionBySlug: (slug: string) => Election | null;
	getJurisdictionBySlug: (slug: string) => Jurisdiction | null;
	getMeasureBySlug: (slug: string) => Measure | null;
	getSourceById: (id: string) => Source | null;
	configuredSnapshotMissing: boolean;
	configuredSnapshotPath?: string;
	loadedAt: string;
	mode: "empty" | "snapshot";
	snapshotMetadata: CoverageSnapshotMetadata;
	snapshotPath: string;
}

export interface CoverageSnapshotMetadata {
	status: CoverageSnapshotStatus;
	sourceLabel: string;
	sourceType: CoverageSnapshotSourceType;
	sourceOrigin?: string;
	importedAt?: string;
	reviewedAt?: string;
	approvedAt?: string;
	note?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === "object";
}

function defaultCoverageFilePath() {
	return resolve(dirname(new URL(import.meta.url).pathname), "..", "data", "live-coverage.local.json");
}

export function coverageSnapshotMetadataPath(snapshotPath: string) {
	return `${snapshotPath}.meta.json`;
}

function buildEmptySnapshotMetadata(configuredSnapshotPath?: string): CoverageSnapshotMetadata {
	if (configuredSnapshotPath) {
		return {
			note: `Configured coverage snapshot path is missing. Ballot Clarity is running without a published local snapshot until ${basename(configuredSnapshotPath)} is restored or replaced.`,
			sourceLabel: `Missing configured snapshot (${basename(configuredSnapshotPath)})`,
			sourceType: "unknown",
			status: "unknown"
		};
	}

	return {
		note: "No imported live coverage snapshot is active. Ballot Clarity is running without a published local guide package.",
		sourceLabel: "No active live coverage snapshot",
		sourceType: "unknown",
		status: "unknown"
	};
}

export function buildSeedCoverageSnapshotMetadata(importedAt = new Date().toISOString()): CoverageSnapshotMetadata {
	return {
		importedAt,
		note: "Seed coverage snapshot exported for route wiring or local verification. Not production-approved content.",
		sourceLabel: "Built-in seed coverage snapshot export",
		sourceType: "seed",
		status: "seed"
	};
}

function buildEmptyDataSourcesResponse(updatedAt: string): DataSourcesResponse {
	return {
		architectureStages: [],
		categories: [],
		launchTarget: undefined,
		migrationWatch: [],
		principles: [],
		roadmap: [],
		updatedAt
	};
}

export function buildEmptyCoverageSnapshot(updatedAt = new Date().toISOString()): CoverageSnapshot {
	return {
		candidates: [],
		dataSources: buildEmptyDataSourcesResponse(updatedAt),
		election: null,
		electionSummaries: [],
		jurisdiction: null,
		jurisdictionSummaries: [],
		location: null,
		measures: [],
		sources: [],
		updatedAt
	};
}

export function buildSeedCoverageSnapshot(): CoverageSnapshot {
	return {
		candidates: demoCandidates,
		dataSources: demoDataSources,
		election: demoElection,
		electionSummaries: demoElectionSummaries,
		jurisdiction: demoJurisdiction,
		jurisdictionSummaries: demoJurisdictionSummaries,
		location: demoLocation,
		measures: demoMeasures,
		sources: demoSources,
		updatedAt: demoElection.updatedAt
	};
}

export function parseCoverageSnapshotMetadata(raw: unknown): CoverageSnapshotMetadata {
	if (!isRecord(raw))
		throw new Error("Coverage snapshot metadata must be a JSON object.");

	const status = raw.status;
	const sourceLabel = raw.sourceLabel;
	const sourceType = raw.sourceType;

	if (status !== "production_approved" && status !== "reviewed" && status !== "seed" && status !== "unknown")
		throw new Error("Coverage snapshot metadata must include a valid status.");

	if (typeof sourceLabel !== "string" || !sourceLabel.trim())
		throw new Error("Coverage snapshot metadata must include sourceLabel.");

	if (sourceType !== "imported" && sourceType !== "seed" && sourceType !== "unknown")
		throw new Error("Coverage snapshot metadata must include a valid sourceType.");

	return {
		approvedAt: typeof raw.approvedAt === "string" ? raw.approvedAt : undefined,
		importedAt: typeof raw.importedAt === "string" ? raw.importedAt : undefined,
		note: typeof raw.note === "string" ? raw.note : undefined,
		reviewedAt: typeof raw.reviewedAt === "string" ? raw.reviewedAt : undefined,
		sourceLabel: sourceLabel.trim(),
		sourceOrigin: typeof raw.sourceOrigin === "string" ? raw.sourceOrigin : undefined,
		sourceType,
		status
	};
}

export function parseCoverageSnapshot(raw: unknown): CoverageSnapshot {
	if (!isRecord(raw))
		throw new Error("Coverage snapshot must be a JSON object.");

	const snapshot = raw as Partial<CoverageSnapshot>;

	if (!Array.isArray(snapshot.candidates) || !Array.isArray(snapshot.measures) || !Array.isArray(snapshot.sources))
		throw new Error("Coverage snapshot must include candidates, measures, and sources arrays.");

	if (!Array.isArray(snapshot.electionSummaries) || !Array.isArray(snapshot.jurisdictionSummaries))
		throw new Error("Coverage snapshot must include electionSummaries and jurisdictionSummaries arrays.");

	if (snapshot.election !== null && snapshot.election !== undefined && (!isRecord(snapshot.election) || typeof snapshot.election.slug !== "string"))
		throw new Error("Coverage snapshot election must be null or an object with a slug.");

	if (snapshot.jurisdiction !== null && snapshot.jurisdiction !== undefined && (!isRecord(snapshot.jurisdiction) || typeof snapshot.jurisdiction.slug !== "string"))
		throw new Error("Coverage snapshot jurisdiction must be null or an object with a slug.");

	if (snapshot.location !== null && snapshot.location !== undefined && (!isRecord(snapshot.location) || typeof snapshot.location.slug !== "string"))
		throw new Error("Coverage snapshot location must be null or an object with a slug.");

	if (!isRecord(snapshot.dataSources) || !Array.isArray(snapshot.dataSources.categories))
		throw new Error("Coverage snapshot must include dataSources.");

	if (typeof snapshot.updatedAt !== "string" || !snapshot.updatedAt)
		throw new Error("Coverage snapshot must include updatedAt.");

	return snapshot as CoverageSnapshot;
}

export function readCoverageSnapshot(snapshotPath = defaultCoverageFilePath()) {
	const raw = readFileSync(snapshotPath, "utf8");
	return parseCoverageSnapshot(JSON.parse(raw));
}

export function readCoverageSnapshotMetadata(snapshotPath = defaultCoverageFilePath()) {
	const raw = readFileSync(coverageSnapshotMetadataPath(snapshotPath), "utf8");
	return parseCoverageSnapshotMetadata(JSON.parse(raw));
}

export function writeCoverageSnapshot(snapshot: CoverageSnapshot, snapshotPath = defaultCoverageFilePath()) {
	mkdirSync(dirname(snapshotPath), { recursive: true });
	writeFileSync(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
	return snapshotPath;
}

export function writeCoverageSnapshotMetadata(
	metadata: CoverageSnapshotMetadata,
	snapshotPath = defaultCoverageFilePath()
) {
	const metadataPath = coverageSnapshotMetadataPath(snapshotPath);
	mkdirSync(dirname(metadataPath), { recursive: true });
	writeFileSync(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`, "utf8");
	return metadataPath;
}

export async function createCoverageRepository(): Promise<CoverageRepository> {
	const environment = (Reflect.get(globalThis, "process") as NodeJS.Process | undefined)?.env;
	const configuredSnapshotPath = environment?.LIVE_COVERAGE_FILE?.trim() || undefined;
	const snapshotPath = configuredSnapshotPath || defaultCoverageFilePath();
	const requireLiveCoverage = environment?.LIVE_COVERAGE_REQUIRED === "true";
	const hasSnapshot = Boolean(configuredSnapshotPath) && existsSync(snapshotPath);
	const configuredSnapshotMissing = Boolean(configuredSnapshotPath) && !hasSnapshot;
	const loadedAt = new Date().toISOString();
	const snapshot = hasSnapshot ? readCoverageSnapshot(snapshotPath) : buildEmptyCoverageSnapshot();
	let snapshotMetadata: CoverageSnapshotMetadata;

	if (requireLiveCoverage && !hasSnapshot)
		throw new Error(`LIVE_COVERAGE_REQUIRED is enabled but no coverage snapshot was found at ${snapshotPath}. Set LIVE_COVERAGE_FILE to an imported snapshot path.`);

	if (hasSnapshot) {
		if (existsSync(coverageSnapshotMetadataPath(snapshotPath))) {
			snapshotMetadata = readCoverageSnapshotMetadata(snapshotPath);
		}
		else {
			snapshotMetadata = {
				note: "Active snapshot file has no provenance metadata sidecar. Treat this runtime as unclassified until the snapshot is re-imported or promoted with metadata.",
				sourceLabel: `Unclassified snapshot (${basename(snapshotPath)})`,
				sourceType: "unknown",
				status: "unknown"
			};
		}
	}
	else {
		snapshotMetadata = buildEmptySnapshotMetadata(configuredSnapshotPath);
	}

	return {
		configuredSnapshotMissing,
		configuredSnapshotPath,
		data: snapshot,
		getCandidateBySlug(slug) {
			return snapshot.candidates.find(candidate => candidate.slug === slug) ?? null;
		},
		getCandidatesBySlugs(slugs) {
			const requested = new Set(slugs);
			return snapshot.candidates.filter(candidate => requested.has(candidate.slug));
		},
		getElectionBySlug(slug) {
			return snapshot.election?.slug === slug ? snapshot.election : null;
		},
		getJurisdictionBySlug(slug) {
			return snapshot.jurisdiction?.slug === slug ? snapshot.jurisdiction : null;
		},
		getMeasureBySlug(slug) {
			return snapshot.measures.find(measure => measure.slug === slug) ?? null;
		},
		getSourceById(id) {
			return snapshot.sources.find(source => source.id === id) ?? null;
		},
		loadedAt,
		mode: hasSnapshot ? "snapshot" : "empty",
		snapshotMetadata,
		snapshotPath
	};
}
