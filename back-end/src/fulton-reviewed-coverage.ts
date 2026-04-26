import type { CoverageSnapshot, CoverageSnapshotMetadata } from "./coverage-repository.js";
import type { DataSourcesResponse, Election, Jurisdiction } from "./types/civic.js";
import {
	demoDataSources,
	demoElection,
	demoJurisdiction,
	demoLocation,
} from "./coverage-data.js";

export const fultonOfficialLogisticsSnapshotDefaultTimestamp = "2026-04-24T12:00:00.000Z";
const stagedChangeLogPattern = /placeholder|staged|reference/i;

function clone<T>(value: T): T {
	return JSON.parse(JSON.stringify(value)) as T;
}

function buildOfficialLogisticsElection(updatedAt: string): Election {
	const election = clone(demoElection);

	return {
		...election,
		changeLog: [
			{
				date: updatedAt,
				id: "reviewed-official-logistics-only",
				summary: "Published a reviewed official-logistics-only Fulton guide shell and removed staged reference contest, candidate, and measure content."
			},
			...election.changeLog.filter(entry => !stagedChangeLogPattern.test(entry.summary)),
		],
		contests: [],
		description: "Reviewed Fulton County election overview with official county and statewide election links. Verified contest, candidate, and measure records are not published in this package.",
		freshness: {
			...election.freshness,
			contentLastVerifiedAt: updatedAt,
			dataLastUpdatedAt: updatedAt,
			nextReviewAt: "2026-05-08T12:00:00.000Z",
			status: "up-to-date",
			statusLabel: "Reviewed official logistics",
			statusNote: "Official election resources and guide-shell metadata were reviewed. Verified Fulton-specific contest, candidate, and measure records remain unpublished."
		},
		updatedAt
	};
}

function buildOfficialLogisticsJurisdiction(election: Election, updatedAt: string): Jurisdiction {
	const jurisdiction = clone(demoJurisdiction);

	return {
		...jurisdiction,
		coverageNotes: [
			"This is not an official government site. Verify deadlines, polling locations, and absentee rules with Fulton County Registration and Elections and Georgia My Voter Page.",
			"Official election links and logistics are current for this area.",
			"Verified Fulton-specific contest, candidate, and measure records are not published in this package."
		],
		description: "Fulton County, Georgia election hub with reviewed official county and statewide election links. Verified contest, candidate, and measure records are not published in this package.",
		nextElectionName: election.name,
		nextElectionSlug: election.slug,
		upcomingElections: [
			{
				date: election.date,
				jurisdictionSlug: election.jurisdictionSlug,
				locationName: election.locationName,
				name: election.name,
				slug: election.slug,
				updatedAt: election.updatedAt,
			}
		],
		updatedAt
	};
}

function buildOfficialLogisticsDataSources(updatedAt: string): DataSourcesResponse {
	const dataSources = clone(demoDataSources);

	return {
		...dataSources,
		principles: [
			"Publish official election logistics when official county and statewide resources are reviewed.",
			"Do not publish contest, candidate, or measure dossiers until Fulton-specific source records are verified.",
			"Keep route availability separate from verified local contest-package availability."
		],
		updatedAt
	};
}

export function buildFultonOfficialLogisticsOnlySnapshot(
	updatedAt = fultonOfficialLogisticsSnapshotDefaultTimestamp
): CoverageSnapshot {
	const election = buildOfficialLogisticsElection(updatedAt);
	const jurisdiction = buildOfficialLogisticsJurisdiction(election, updatedAt);

	return {
		candidates: [],
		dataSources: buildOfficialLogisticsDataSources(updatedAt),
		election,
		electionSummaries: [
			{
				date: election.date,
				jurisdictionSlug: election.jurisdictionSlug,
				locationName: election.locationName,
				name: election.name,
				slug: election.slug,
				updatedAt: election.updatedAt,
			}
		],
		jurisdiction,
		jurisdictionSummaries: [
			{
				description: jurisdiction.description,
				displayName: jurisdiction.displayName,
				jurisdictionType: jurisdiction.jurisdictionType,
				name: jurisdiction.name,
				nextElectionName: jurisdiction.nextElectionName,
				nextElectionSlug: jurisdiction.nextElectionSlug,
				slug: jurisdiction.slug,
				state: jurisdiction.state,
				updatedAt: jurisdiction.updatedAt,
			}
		],
		location: clone(demoLocation),
		measures: [],
		sources: [],
		updatedAt,
	};
}

export function buildFultonReviewedCoverageSnapshotMetadata({
	approvedAt,
	importedAt,
	note,
	reviewedAt,
	sourceLabel,
	sourceOrigin,
	status,
}: {
	approvedAt?: string;
	importedAt: string;
	note?: string;
	reviewedAt?: string;
	sourceLabel?: string;
	sourceOrigin?: string;
	status: CoverageSnapshotMetadata["status"];
}): CoverageSnapshotMetadata {
	return {
		approvedAt,
		importedAt,
		note: note ?? "Reviewed Fulton County coverage package published as official-logistics-only. Verified contest, candidate, and measure records are not included.",
		reviewedAt,
		sourceLabel: sourceLabel ?? "Reviewed Fulton County official-logistics-only coverage snapshot",
		sourceOrigin: sourceOrigin ?? "Ballot Clarity reviewed coverage export",
		sourceType: "imported",
		status
	};
}
