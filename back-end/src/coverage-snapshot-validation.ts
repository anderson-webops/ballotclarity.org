import type {
	CoverageRepository,
	CoverageSnapshot,
	CoverageSnapshotMetadata,
} from "./coverage-repository.js";
import type { AdminContentItem, GuideContentSummary } from "./types/civic.js";
import { buildDefaultGuidePackageSeed, buildGuidePackageRecord } from "./guide-packages.js";

export const referenceArchiveCandidateNames = [
	"Elena Torres",
	"Daniel Brooks",
	"Naomi Park",
	"Thomas Bell",
	"Alicia Greene",
	"Marcus Hill",
	"Sandra Patel",
];

export interface ReferenceArchiveMatch {
	name: string;
	path: string;
}

export interface CoverageSnapshotValidationResult {
	ok: boolean;
	errors: string[];
	warnings: string[];
	referenceArchiveMatches: ReferenceArchiveMatch[];
	guideContent: GuideContentSummary[];
}

export interface CoverageSnapshotValidationOptions {
	allowStagedReferenceContent?: boolean;
	contentItems?: AdminContentItem[];
}

function buildValidationRepository(
	snapshot: CoverageSnapshot,
	metadata: CoverageSnapshotMetadata,
): CoverageRepository {
	return {
		configuredSnapshotMissing: false,
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
		loadedAt: metadata.importedAt ?? new Date().toISOString(),
		mode: "snapshot",
		snapshotMetadata: metadata,
		snapshotPath: ":validation:",
	};
}

function findReferenceArchiveMatches(value: unknown, path = "$"): ReferenceArchiveMatch[] {
	if (typeof value === "string") {
		return referenceArchiveCandidateNames
			.filter(name => value.includes(name))
			.map(name => ({
				name,
				path,
			}));
	}

	if (Array.isArray(value))
		return value.flatMap((item, index) => findReferenceArchiveMatches(item, `${path}[${index}]`));

	if (value && typeof value === "object") {
		return Object.entries(value).flatMap(([key, child]) => {
			return findReferenceArchiveMatches(child, `${path}.${key}`);
		});
	}

	return [];
}

function buildGuideContentSummaries(
	snapshot: CoverageSnapshot,
	metadata: CoverageSnapshotMetadata,
	contentItems: AdminContentItem[],
) {
	const coverageRepository = buildValidationRepository(snapshot, metadata);
	return buildDefaultGuidePackageSeed(coverageRepository)
		.map(workflow => buildGuidePackageRecord(workflow, coverageRepository, contentItems).contentStatus);
}

function layerStatuses(guideContent: GuideContentSummary) {
	return [
		guideContent.guideShell,
		guideContent.officialLogistics,
		guideContent.contests,
		guideContent.candidates,
		guideContent.measures,
	];
}

export function validateCoverageSnapshotForPublication(
	snapshot: CoverageSnapshot,
	metadata: CoverageSnapshotMetadata,
	options: CoverageSnapshotValidationOptions = {},
): CoverageSnapshotValidationResult {
	const errors: string[] = [];
	const warnings: string[] = [];
	const referenceArchiveMatches = findReferenceArchiveMatches(snapshot);
	const guideContent = buildGuideContentSummaries(snapshot, metadata, options.contentItems ?? []);
	const isReviewedOrApproved = metadata.status === "reviewed" || metadata.status === "production_approved";

	if (isReviewedOrApproved && metadata.sourceType !== "imported")
		errors.push(`${metadata.status} snapshots must use sourceType "imported".`);

	if (isReviewedOrApproved && !metadata.reviewedAt)
		errors.push(`${metadata.status} snapshots must include reviewedAt.`);

	if (metadata.status === "production_approved" && !metadata.approvedAt)
		errors.push("production_approved snapshots must include approvedAt.");

	if (referenceArchiveMatches.length) {
		const matchedNames = Array.from(new Set(referenceArchiveMatches.map(match => match.name))).join(", ");
		const message = `Snapshot contains staged/reference candidate names: ${matchedNames}.`;

		if (metadata.status === "production_approved" || !options.allowStagedReferenceContent)
			errors.push(message);
		else
			warnings.push(message);
	}

	for (const content of guideContent) {
		if (metadata.status !== "production_approved")
			continue;

		if (content.mixedContent)
			errors.push("production_approved snapshots cannot have guideContent.mixedContent=true.");

		const stagedLayers = layerStatuses(content)
			.filter(layer => layer.hasContent && layer.status === "staged_reference")
			.map(layer => layer.label);

		if (stagedLayers.length)
			errors.push(`production_approved snapshots cannot include staged_reference guide layers: ${stagedLayers.join(", ")}.`);
	}

	return {
		errors,
		guideContent,
		ok: errors.length === 0,
		referenceArchiveMatches,
		warnings,
	};
}

export function summarizeCoverageSnapshotValidation(result: CoverageSnapshotValidationResult) {
	const lines = [
		result.ok ? "Validation: pass" : "Validation: fail",
		`Reference archive matches: ${result.referenceArchiveMatches.length}`,
		`Guide content packages checked: ${result.guideContent.length}`,
		`Warnings: ${result.warnings.length}`,
		`Errors: ${result.errors.length}`,
	];

	for (const warning of result.warnings)
		lines.push(`Warning: ${warning}`);

	for (const error of result.errors)
		lines.push(`Error: ${error}`);

	return lines;
}
