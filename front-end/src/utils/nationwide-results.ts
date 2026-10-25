import type {
	ElectionSummary,
	LocationLookupResponse,
	LocationSelection,
	NationwideLookupResultContext
} from "../types/civic";
import type { LookupContextState } from "./guide-entry";
import { buildPublishedGuideDestination, hasPublishedGuideResult, hasVerifiedGuideResult } from "./location-lookup";
import { buildLookupDestinationFromResponse } from "./nationwide-route-context";

export const nationwideResultsPath = "/results";

export interface CivicLookupStateUpdate {
	lookupContext: LookupContextState;
	nationwideLookupResult: NationwideLookupResultContext | null;
	selectedLocation: LocationSelection | null;
}

export interface HomeExperienceState {
	primaryLookupPath: string;
	showFeaturedGuidePreview: boolean;
	showPublishedElectionOverview: boolean;
	showNationwideResults: boolean;
	startHerePrimaryPath: string;
	startHerePrimaryLabel: string;
}

export function buildLookupContextState(
	response: Pick<LocationLookupResponse, "guideAvailability" | "guideContent" | "result">
): LookupContextState {
	return {
		guideAvailability: response.guideAvailability,
		hasPublishedGuideShell: Boolean(response.guideContent?.publishedGuideShell),
		hasVerifiedContestPackage: Boolean(response.guideContent?.verifiedContestPackage),
		result: response.result
	};
}

export function normalizeLookupResponseForDisplay(
	response: LocationLookupResponse,
	election?: ElectionSummary | null
): NationwideLookupResultContext {
	return {
		actions: response.actions ?? [],
		availability: response.availability ?? null,
		ballotContentPreviews: response.ballotContentPreviews ?? [],
		detectedFromIp: Boolean(response.detectedFromIp),
		districtMatches: response.districtMatches ?? [],
		election: election && election.slug === response.electionSlug ? election : null,
		electionLogistics: response.electionLogistics ?? null,
		guideContent: response.guideContent ?? null,
		electionSlug: response.electionSlug,
		fromCache: Boolean(response.fromCache),
		guideAvailability: response.guideAvailability,
		inputKind: response.inputKind,
		lookupQuery: response.lookupQuery,
		selectionId: response.selectionId,
		location: response.location ?? null,
		normalizedAddress: response.normalizedAddress ?? "",
		note: response.note,
		representativeMatches: response.representativeMatches ?? [],
		resolvedAt: new Date().toISOString(),
		selectionOptions: response.selectionOptions ?? [],
		result: response.result
	};
}

export function buildNationwideLookupResultContext(
	response: LocationLookupResponse,
	election?: ElectionSummary | null
) {
	if (response.result !== "resolved" || (hasVerifiedGuideResult(response) && !response.detectedFromIp))
		return null;

	return normalizeLookupResponseForDisplay(response, election);
}

export function deriveCivicLookupStateUpdate(
	response: LocationLookupResponse,
	election?: ElectionSummary | null
): CivicLookupStateUpdate {
	const canOpenPublishedGuideSurface = hasPublishedGuideResult(response) && !response.detectedFromIp;

	return {
		lookupContext: buildLookupContextState(response),
		nationwideLookupResult: response.result === "resolved" ? normalizeLookupResponseForDisplay(response, election) : null,
		selectedLocation: canOpenPublishedGuideSurface ? response.location ?? null : null
	};
}

export function shouldRetainLookupForGuide(
	result: NationwideLookupResultContext | null | undefined,
	election: ElectionSummary | null,
	location: LocationSelection | null,
	guideContent: LocationLookupResponse["guideContent"] | null | undefined
) {
	if (!location || result?.result !== "resolved" || !guideContent?.publishedGuideShell)
		return false;

	if (guideContent.verifiedContestPackage) {
		return Boolean(election?.slug && result.electionSlug === election.slug
			&& typeof result.location?.state === "string" && typeof location.state === "string"
			&& location.state.trim() && result.location.state.trim().toLowerCase() === location.state.trim().toLowerCase()
			&& result.guideAvailability === "published" && result.guideContent?.verifiedContestPackage);
	}

	return result.location?.slug === location.slug || Boolean(election?.slug && result.electionSlug === election.slug);
}

export function hasActiveNationwideLookupResult(
	context: NationwideLookupResultContext | null | undefined
) {
	return Boolean(
		context
		&& context.result === "resolved"
		&& (context.detectedFromIp || context.guideAvailability !== "published" || !context.guideContent?.verifiedContestPackage)
	);
}

export function resolveLookupDestination(response: LocationLookupResponse) {
	if (response.result === "resolved" && !response.detectedFromIp && !response.selectionOptions?.length && hasVerifiedGuideResult(response))
		return buildPublishedGuideDestination(response);

	if (response.result === "resolved" && response.selectionOptions?.length)
		return buildLookupDestinationFromResponse(response);

	return hasActiveNationwideLookupResult(buildNationwideLookupResultContext(response))
		? buildLookupDestinationFromResponse(response)
		: null;
}

export function buildHomeExperienceState(
	hasNationwideLookupResult: boolean,
	hasGuideShellContext: boolean,
	hasVerifiedGuideContext: boolean
): HomeExperienceState {
	if (hasNationwideLookupResult) {
		return {
			primaryLookupPath: nationwideResultsPath,
			showFeaturedGuidePreview: false,
			showPublishedElectionOverview: false,
			showNationwideResults: true,
			startHerePrimaryLabel: "Open results",
			startHerePrimaryPath: nationwideResultsPath
		};
	}

	if (hasVerifiedGuideContext) {
		return {
			primaryLookupPath: "/ballot",
			showFeaturedGuidePreview: true,
			showPublishedElectionOverview: false,
			showNationwideResults: false,
			startHerePrimaryLabel: "Open ballot guide",
			startHerePrimaryPath: "/ballot"
		};
	}

	if (hasGuideShellContext) {
		return {
			primaryLookupPath: "/elections",
			showFeaturedGuidePreview: false,
			showPublishedElectionOverview: true,
			showNationwideResults: false,
			startHerePrimaryLabel: "Open election overview",
			startHerePrimaryPath: "/elections"
		};
	}

	return {
		primaryLookupPath: "/#location-lookup",
		showFeaturedGuidePreview: false,
		showPublishedElectionOverview: false,
		showNationwideResults: false,
		startHerePrimaryLabel: "Open location lookup",
		startHerePrimaryPath: "/#location-lookup"
	};
}
