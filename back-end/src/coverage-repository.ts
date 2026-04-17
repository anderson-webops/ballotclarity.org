import type {
	Candidate,
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
import { dirname, resolve } from "node:path";
import process from "node:process";
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
	election: Election;
	electionSummaries: ElectionSummary[];
	jurisdiction: Jurisdiction;
	jurisdictionSummaries: JurisdictionSummary[];
	location: LocationSelection;
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
	mode: "seed" | "snapshot";
	snapshotPath: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === "object";
}

function defaultCoverageFilePath() {
	return resolve(dirname(new URL(import.meta.url).pathname), "..", "data", "live-coverage.local.json");
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

export function parseCoverageSnapshot(raw: unknown): CoverageSnapshot {
	if (!isRecord(raw))
		throw new Error("Coverage snapshot must be a JSON object.");

	const snapshot = raw as Partial<CoverageSnapshot>;

	if (!Array.isArray(snapshot.candidates) || !Array.isArray(snapshot.measures) || !Array.isArray(snapshot.sources))
		throw new Error("Coverage snapshot must include candidates, measures, and sources arrays.");

	if (!Array.isArray(snapshot.electionSummaries) || !Array.isArray(snapshot.jurisdictionSummaries))
		throw new Error("Coverage snapshot must include electionSummaries and jurisdictionSummaries arrays.");

	if (!isRecord(snapshot.election) || typeof snapshot.election.slug !== "string")
		throw new Error("Coverage snapshot must include an election object with a slug.");

	if (!isRecord(snapshot.jurisdiction) || typeof snapshot.jurisdiction.slug !== "string")
		throw new Error("Coverage snapshot must include a jurisdiction object with a slug.");

	if (!isRecord(snapshot.location) || typeof snapshot.location.slug !== "string")
		throw new Error("Coverage snapshot must include a location object with a slug.");

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

export function writeCoverageSnapshot(snapshot: CoverageSnapshot, snapshotPath = defaultCoverageFilePath()) {
	mkdirSync(dirname(snapshotPath), { recursive: true });
	writeFileSync(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
	return snapshotPath;
}

export async function createCoverageRepository(): Promise<CoverageRepository> {
	const snapshotPath = process.env.LIVE_COVERAGE_FILE || defaultCoverageFilePath();
	const requireLiveCoverage = process.env.LIVE_COVERAGE_REQUIRED === "true";
	const hasSnapshot = existsSync(snapshotPath);
	const snapshot = hasSnapshot ? readCoverageSnapshot(snapshotPath) : buildSeedCoverageSnapshot();

	if (requireLiveCoverage && !hasSnapshot)
		throw new Error(`LIVE_COVERAGE_REQUIRED is enabled but no coverage snapshot was found at ${snapshotPath}.`);

	return {
		data: snapshot,
		getCandidateBySlug(slug) {
			return snapshot.candidates.find(candidate => candidate.slug === slug) ?? null;
		},
		getCandidatesBySlugs(slugs) {
			const requested = new Set(slugs);
			return snapshot.candidates.filter(candidate => requested.has(candidate.slug));
		},
		getElectionBySlug(slug) {
			return snapshot.election.slug === slug ? snapshot.election : null;
		},
		getJurisdictionBySlug(slug) {
			return snapshot.jurisdiction.slug === slug ? snapshot.jurisdiction : null;
		},
		getMeasureBySlug(slug) {
			return snapshot.measures.find(measure => measure.slug === slug) ?? null;
		},
		getSourceById(id) {
			return snapshot.sources.find(source => source.id === id) ?? null;
		},
		mode: hasSnapshot ? "snapshot" : "seed",
		snapshotPath
	};
}
