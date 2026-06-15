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

export interface PlaceholderUrlMatch {
	hostname: string;
	path: string;
	url: string;
}

export interface CoverageSnapshotValidationResult {
	ok: boolean;
	errors: string[];
	warnings: string[];
	placeholderUrlMatches: PlaceholderUrlMatch[];
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

function isPrivateIpv4(hostname: string) {
	const parts = hostname.split(".").map(part => Number(part));

	if (parts.length !== 4 || parts.some(part => !Number.isInteger(part) || part < 0 || part > 255))
		return false;

	const [first, second] = parts;

	return first === 10
		|| first === 127
		|| (first === 172 && second >= 16 && second <= 31)
		|| (first === 192 && second === 168)
		|| (first === 169 && second === 254)
		|| (first === 0 && second === 0);
}

function isPlaceholderOrInternalHostname(rawHostname: string) {
	const hostname = rawHostname.toLowerCase().replace(/^\[/u, "").replace(/\]$/u, "");

	if (hostname === "localhost" || hostname === "::1" || isPrivateIpv4(hostname))
		return true;

	if (hostname === "example.com" || hostname === "example.org" || hostname === "example.net")
		return true;

	if (hostname.endsWith(".example.com") || hostname.endsWith(".example.org") || hostname.endsWith(".example.net"))
		return true;

	return [".example", ".test", ".invalid", ".localhost", ".local", ".internal"].some(suffix => hostname.endsWith(suffix));
}

function findPlaceholderUrlMatches(value: unknown, path = "$"): PlaceholderUrlMatch[] {
	if (typeof value === "string") {
		if (!/^https?:\/\//iu.test(value))
			return [];

		try {
			const url = new URL(value);

			return isPlaceholderOrInternalHostname(url.hostname)
				? [{
						hostname: url.hostname,
						path,
						url: value,
					}]
				: [];
		}
		catch {
			return [];
		}
	}

	if (Array.isArray(value))
		return value.flatMap((item, index) => findPlaceholderUrlMatches(item, `${path}[${index}]`));

	if (value && typeof value === "object") {
		return Object.entries(value).flatMap(([key, child]) => {
			return findPlaceholderUrlMatches(child, `${path}.${key}`);
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
	const placeholderUrlMatches = findPlaceholderUrlMatches(snapshot);
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

		if (isReviewedOrApproved || !options.allowStagedReferenceContent)
			errors.push(message);
		else
			warnings.push(message);
	}

	if (placeholderUrlMatches.length) {
		const matchedHosts = Array.from(new Set(placeholderUrlMatches.map(match => match.hostname))).join(", ");
		const message = `Snapshot contains placeholder or internal public URLs: ${matchedHosts}.`;

		if (isReviewedOrApproved || !options.allowStagedReferenceContent)
			errors.push(message);
		else
			warnings.push(message);
	}

	for (const content of guideContent) {
		if (!isReviewedOrApproved)
			continue;

		if (content.mixedContent)
			errors.push(`${metadata.status} snapshots cannot have guideContent.mixedContent=true.`);

		const stagedLayers = layerStatuses(content)
			.filter(layer => layer.hasContent && (layer.status === "seeded_demo" || layer.status === "staged_reference"))
			.map(layer => `${layer.label} (${layer.status})`);

		if (stagedLayers.length)
			errors.push(`${metadata.status} snapshots cannot include seeded_demo or staged_reference guide layers: ${stagedLayers.join(", ")}.`);
	}

	return {
		errors,
		guideContent,
		ok: errors.length === 0,
		placeholderUrlMatches,
		referenceArchiveMatches,
		warnings,
	};
}

export function summarizeCoverageSnapshotValidation(result: CoverageSnapshotValidationResult) {
	const lines = [
		result.ok ? "Validation: pass" : "Validation: fail",
		`Reference archive matches: ${result.referenceArchiveMatches.length}`,
		`Placeholder/internal URL matches: ${result.placeholderUrlMatches.length}`,
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
