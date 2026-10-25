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
import { isDeepStrictEqual } from "node:util";
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
import {
	bindCoverageSnapshotMetadata,
	coverageSnapshotMetadataPath,
	recoverPendingCoveragePromotion,
	verifyCoverageSnapshotMetadataDigest,
} from "./coverage-snapshot-integrity.js";

export interface AdditionalCoverageGuide {
	coverageLimits?: string[];
	election: Election;
	jurisdiction: Jurisdiction;
	location: LocationSelection;
}

export interface CoverageSnapshot {
	additionalGuides?: AdditionalCoverageGuide[];
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
	contentSha256?: string;
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

export function isSupportedMeasureBallotOptions(value: unknown): value is Measure["ballotOptions"] {
	if (value === undefined) return true;
	if (!isRecord(value) || Object.keys(value).sort().join(",") !== "no,yes"
		|| typeof value.yes !== "string" || typeof value.no !== "string"
		|| value.yes !== value.yes.trim() || value.no !== value.no.trim()) {
		return false;
	}
	return ["YES:NO", "YES, TO APPROVE:NO, TO REJECT", "FOR:AGAINST", "APPROVE:REJECT", "YES/FOR:NO/AGAINST", "FOR THE MEASURE:AGAINST THE MEASURE", "FOR GENERAL OBLIGATION BONDS:AGAINST GENERAL OBLIGATION BONDS", "FOR THE CONSTITUTIONAL AMENDMENT:AGAINST THE CONSTITUTIONAL AMENDMENT", "FOR CHARTER AMENDMENT:AGAINST CHARTER AMENDMENT", "FOR THE CHARTER AMENDMENT:AGAINST THE CHARTER AMENDMENT", "FOR BOND ISSUE:AGAINST BOND ISSUE", "FOR THE REFERRED LAW:AGAINST THE REFERRED LAW", "FOR THE PROPOSAL - YES:AGAINST THE PROPOSAL - NO", "FOR THE PROPOSITION - YES:AGAINST THE PROPOSITION - NO", "YES/SÍ:NO/NO", "YES/SÍ:NO", "YES - SI:NO - NO", "YES - FOR THE ½ CENT SALES TAX:NO - AGAINST THE ½ CENT SALES TAX", "YES - FOR RENEWAL OF MILLAGE:NO - AGAINST RENEWAL OF MILLAGE", "YES - FOR THE RENEWAL OF THE HALF-CENT SALES TAX:NO - AGAINST THE RENEWAL OF THE HALF-CENT SALES TAX", "YES - IN FAVOR:NO - OPPOSED", "YES - FOR APPROVAL:NO - FOR REJECTION", "YES - FOR BONDS:NO - AGAINST BONDS"].includes(`${value.yes.toUpperCase()}:${value.no.toUpperCase()}`);
}

export function isSupportedMeasureDecisionEffect(value: unknown, ballotOptions: unknown) {
	return value === undefined || (value === "advisory" && ballotOptions !== undefined && isSupportedMeasureBallotOptions(ballotOptions));
}

export function coverageElections(snapshot: CoverageSnapshot): Election[] {
	return [...(snapshot.election ? [snapshot.election] : []), ...(snapshot.additionalGuides ?? []).map(guide => guide.election)];
}

export function coverageJurisdictions(snapshot: CoverageSnapshot): Jurisdiction[] {
	return Array.from(new Map([
		...(snapshot.jurisdiction ? [snapshot.jurisdiction] : []),
		...(snapshot.additionalGuides ?? []).map(guide => guide.jurisdiction),
	].map(jurisdiction => [jurisdiction.slug, jurisdiction])).values());
}

export function coverageGuideLocation(snapshot: CoverageSnapshot, electionSlug: string): LocationSelection | null {
	return snapshot.election?.slug === electionSlug
		? snapshot.location
		: snapshot.additionalGuides?.find(guide => guide.election.slug === electionSlug)?.location ?? null;
}

export function coverageElectionSummaries(snapshot: CoverageSnapshot): ElectionSummary[] {
	return Array.from(new Map([
		...snapshot.electionSummaries,
		...(snapshot.additionalGuides ?? []).map(({ election }) => ({
			slug: election.slug,
			name: election.name,
			date: election.date,
			jurisdictionSlug: election.jurisdictionSlug,
			locationName: election.locationName,
			updatedAt: election.updatedAt,
		})),
	].map(summary => [summary.slug, summary])).values());
}

export function coverageJurisdictionSummaries(snapshot: CoverageSnapshot): JurisdictionSummary[] {
	return Array.from(new Map([
		...snapshot.jurisdictionSummaries,
		...(snapshot.additionalGuides ?? []).map(({ jurisdiction }) => ({
			slug: jurisdiction.slug,
			name: jurisdiction.name,
			displayName: jurisdiction.displayName,
			state: jurisdiction.state,
			jurisdictionType: jurisdiction.jurisdictionType,
			description: jurisdiction.description,
			nextElectionName: jurisdiction.nextElectionName,
			nextElectionSlug: jurisdiction.nextElectionSlug,
			updatedAt: jurisdiction.updatedAt,
		})),
	].map(summary => [summary.slug, summary])).values());
}

function validateAdditionalGuides(snapshot: CoverageSnapshot) {
	if (snapshot.additionalGuides === undefined)
		return;

	if (!Array.isArray(snapshot.additionalGuides))
		throw new Error("Coverage snapshot additionalGuides must be an array.");

	const electionSlugs = new Set(snapshot.election ? [snapshot.election.slug] : []);
	const jurisdictionRecords = new Map(snapshot.jurisdiction ? [[snapshot.jurisdiction.slug, snapshot.jurisdiction]] : []);
	const contestSlugs = new Set(snapshot.election?.contests.map(contest => contest.slug) ?? []);
	const candidateSlugs = new Set(snapshot.candidates.map(candidate => candidate.slug));
	const measureSlugs = new Set(snapshot.measures.map(measure => measure.slug));
	for (const contest of snapshot.election?.contests ?? []) {
		for (const candidate of contest.candidates ?? []) candidateSlugs.add(candidate.slug);
		for (const measure of contest.measures ?? []) measureSlugs.add(measure.slug);
	}

	for (const guide of snapshot.additionalGuides) {
		if (!isRecord(guide) || !isRecord(guide.election) || !isRecord(guide.jurisdiction) || !isRecord(guide.location))
			throw new Error("Each additional guide must bind an election, jurisdiction, and location.");

		const { election, jurisdiction, location } = guide;
		if (guide.coverageLimits !== undefined && (!Array.isArray(guide.coverageLimits) || !guide.coverageLimits.every(value => typeof value === "string" && value.trim())))
			throw new Error("Additional guide coverage limits must be nonempty strings.");
		for (const [label, value] of Object.entries({ electionSlug: election.slug, electionDate: election.date, jurisdictionSlug: jurisdiction.slug, state: jurisdiction.state, locationSlug: location.slug })) {
			if (typeof value !== "string" || !value.trim())
				throw new Error(`Additional guide must include ${label}.`);
		}
		if (election.jurisdictionSlug !== jurisdiction.slug || location.state !== jurisdiction.state)
			throw new Error("Additional guide election, jurisdiction, and location identities must agree.");
		if (location.lookupMode !== "coverage-selection" || location.requiresOfficialConfirmation !== true || location.lookupInput)
			throw new Error("Additional guide location must be a coverage selection requiring official confirmation, not a personal address match.");
		if (electionSlugs.has(election.slug))
			throw new Error(`Duplicate guide election slug: ${election.slug}.`);
		electionSlugs.add(election.slug);
		const existingJurisdiction = jurisdictionRecords.get(jurisdiction.slug);
		if (existingJurisdiction && !isDeepStrictEqual(existingJurisdiction, jurisdiction))
			throw new Error(`Conflicting guide jurisdiction: ${jurisdiction.slug}.`);
		jurisdictionRecords.set(jurisdiction.slug, jurisdiction);
		if (!/^\d{4}-\d{2}-\d{2}$/.test(election.date) || !Number.isFinite(Date.parse(`${election.date}T00:00:00Z`))
			|| new Date(`${election.date}T00:00:00Z`).toISOString().slice(0, 10) !== election.date) {
			throw new Error("Additional guide election date must be a valid calendar date.");
		}
		if (!Array.isArray(election.contests) || !Array.isArray(election.officialResources) || !Array.isArray(election.keyDates) || !Array.isArray(election.changeLog)
			|| !Array.isArray(jurisdiction.officialResources) || !Array.isArray(jurisdiction.upcomingElections)
			|| !Array.isArray(jurisdiction.votingMethods) || !Array.isArray(jurisdiction.archivedGuides) || !Array.isArray(jurisdiction.coverageNotes)) {
			throw new TypeError("Additional guide election and jurisdiction content arrays are required.");
		}
		for (const contest of election.contests) {
			if (!isRecord(contest) || typeof contest.slug !== "string" || !contest.slug.trim() || contestSlugs.has(contest.slug))
				throw new Error("Additional guide contest slugs must be present and unique across guides.");
			contestSlugs.add(contest.slug);
			if ((contest.type !== "candidate" && contest.type !== "measure")
				|| !Array.isArray(contest.type === "candidate" ? contest.candidates : contest.measures)
				|| (contest.type === "candidate" ? contest.measures?.length : contest.candidates?.length)) {
				throw new Error("Additional guide contests must contain records of their declared type.");
			}
			for (const [records, slugs] of [[contest.candidates ?? [], candidateSlugs], [contest.measures ?? [], measureSlugs]] as const) {
				for (const record of records) {
					if (!isRecord(record) || typeof record.slug !== "string" || !record.slug.trim() || slugs.has(record.slug) || record.contestSlug !== contest.slug)
						throw new Error("Additional guide records must have unique slugs and match their parent contest.");
					slugs.add(record.slug);
				}
			}
		}
	}
}

function defaultCoverageFilePath() {
	return resolve(dirname(new URL(import.meta.url).pathname), "..", "data", "live-coverage.local.json");
}

export { coverageSnapshotMetadataPath } from "./coverage-snapshot-integrity.js";

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

	if (raw.contentSha256 !== undefined && (typeof raw.contentSha256 !== "string" || !/^[a-f0-9]{64}$/.test(raw.contentSha256)))
		throw new Error("Coverage snapshot metadata contentSha256 must be a lowercase SHA-256 digest.");

	return {
		approvedAt: typeof raw.approvedAt === "string" ? raw.approvedAt : undefined,
		contentSha256: typeof raw.contentSha256 === "string" ? raw.contentSha256 : undefined,
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

	validateAdditionalGuides(snapshot as CoverageSnapshot);
	const measures = [...snapshot.measures, ...coverageElections(snapshot as CoverageSnapshot).flatMap(election => (election.contests ?? []).flatMap(contest => contest.measures ?? []))];
	if (measures.some(measure => isRecord(measure) && !isSupportedMeasureBallotOptions(measure.ballotOptions)))
		throw new Error("Measures must retain a supported binary ballot-option pair; non-binary choices require a separate contract.");
	if (measures.some(measure => isRecord(measure) && !isSupportedMeasureDecisionEffect(measure.decisionEffect, measure.ballotOptions)))
		throw new Error("Advisory decisions require explicit supported binary choices; other decision effects are not inferred.");

	return snapshot as CoverageSnapshot;
}

export function readCoverageSnapshot(snapshotPath = defaultCoverageFilePath()) {
	recoverPendingCoveragePromotion(snapshotPath);
	const raw = readFileSync(snapshotPath, "utf8");
	return parseCoverageSnapshot(JSON.parse(raw));
}

export function readCoverageSnapshotMetadata(snapshotPath = defaultCoverageFilePath()) {
	recoverPendingCoveragePromotion(snapshotPath);
	const raw = readFileSync(coverageSnapshotMetadataPath(snapshotPath), "utf8");
	const metadata = parseCoverageSnapshotMetadata(JSON.parse(raw));
	verifyCoverageSnapshotMetadataDigest(metadata as unknown as Record<string, unknown>, snapshotPath);
	return metadata;
}

export function writeCoverageSnapshot(snapshot: CoverageSnapshot, snapshotPath = defaultCoverageFilePath()) {
	recoverPendingCoveragePromotion(snapshotPath);
	mkdirSync(dirname(snapshotPath), { recursive: true });
	writeFileSync(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
	return snapshotPath;
}

export function writeCoverageSnapshotMetadata(
	metadata: CoverageSnapshotMetadata,
	snapshotPath = defaultCoverageFilePath()
) {
	recoverPendingCoveragePromotion(snapshotPath);
	const metadataPath = coverageSnapshotMetadataPath(snapshotPath);
	mkdirSync(dirname(metadataPath), { recursive: true });
	const boundMetadata = bindCoverageSnapshotMetadata(metadata as unknown as Record<string, unknown>, snapshotPath);
	writeFileSync(metadataPath, `${JSON.stringify(boundMetadata, null, 2)}\n`, "utf8");
	return metadataPath;
}

export async function createCoverageRepository(): Promise<CoverageRepository> {
	const environment = (Reflect.get(globalThis, "process") as NodeJS.Process | undefined)?.env;
	const configuredSnapshotPath = environment?.LIVE_COVERAGE_FILE?.trim() || undefined;
	const snapshotPath = configuredSnapshotPath || defaultCoverageFilePath();
	const requireLiveCoverage = environment?.LIVE_COVERAGE_REQUIRED === "true";
	recoverPendingCoveragePromotion(snapshotPath);
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
			return snapshot.candidates.find(candidate => candidate.slug === slug)
				?? coverageElections(snapshot).flatMap(election => election.contests.flatMap(contest => contest.candidates ?? [])).find(candidate => candidate.slug === slug) ?? null;
		},
		getCandidatesBySlugs(slugs) {
			const requested = new Set(slugs);
			return Array.from(new Map([
				...snapshot.candidates,
				...coverageElections(snapshot).flatMap(election => election.contests.flatMap(contest => contest.candidates ?? [])),
			].filter(candidate => requested.has(candidate.slug)).map(candidate => [candidate.slug, candidate])).values());
		},
		getElectionBySlug(slug) {
			return coverageElections(snapshot).find(election => election.slug === slug) ?? null;
		},
		getJurisdictionBySlug(slug) {
			return coverageJurisdictions(snapshot).find(jurisdiction => jurisdiction.slug === slug) ?? null;
		},
		getMeasureBySlug(slug) {
			return snapshot.measures.find(measure => measure.slug === slug)
				?? coverageElections(snapshot).flatMap(election => election.contests.flatMap(contest => contest.measures ?? [])).find(measure => measure.slug === slug) ?? null;
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
