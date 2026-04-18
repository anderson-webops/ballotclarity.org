import type {
	ElectionSummary,
	LocationLookupResponse,
	LocationSelection,
	NationwideLookupResultContext
} from "../types/civic";
import type { LookupContextState } from "./guide-entry";
import { hasPublishedGuideResult } from "./location-lookup";

export const nationwideResultsPath = "/results";

export interface CivicLookupStateUpdate {
	lookupContext: LookupContextState;
	nationwideLookupResult: NationwideLookupResultContext | null;
	selectedLocation: LocationSelection | null;
}

export interface HomeExperienceState {
	primaryLookupPath: string;
	showFeaturedGuidePreview: boolean;
	showNationwideResults: boolean;
	startHerePrimaryPath: string;
	startHerePrimaryLabel: string;
}

export function buildLookupContextState(
	response: Pick<LocationLookupResponse, "guideAvailability" | "result">
): LookupContextState {
	return {
		guideAvailability: response.guideAvailability,
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
		detectedFromIp: Boolean(response.detectedFromIp),
		districtMatches: response.districtMatches ?? [],
		election: election ?? null,
		electionSlug: response.electionSlug,
		fromCache: Boolean(response.fromCache),
		guideAvailability: response.guideAvailability,
		inputKind: response.inputKind,
		lookupQuery: response.lookupQuery,
		location: response.location ?? null,
		normalizedAddress: response.normalizedAddress ?? "",
		note: response.note,
		representativeMatches: response.representativeMatches ?? [],
		selectionOptions: response.selectionOptions ?? [],
		result: response.result
	};
}

export function buildNationwideLookupResultContext(
	response: LocationLookupResponse,
	election?: ElectionSummary | null
) {
	if (response.result !== "resolved" || (hasPublishedGuideResult(response) && !response.detectedFromIp))
		return null;

	return normalizeLookupResponseForDisplay(response, election);
}

export function deriveCivicLookupStateUpdate(
	response: LocationLookupResponse,
	election?: ElectionSummary | null
): CivicLookupStateUpdate {
	const canOpenGuide = hasPublishedGuideResult(response) && !response.detectedFromIp;

	return {
		lookupContext: buildLookupContextState(response),
		nationwideLookupResult: canOpenGuide ? null : buildNationwideLookupResultContext(response, election),
		selectedLocation: canOpenGuide ? response.location ?? null : null
	};
}

export function hasActiveNationwideLookupResult(
	context: NationwideLookupResultContext | null | undefined
) {
	return Boolean(
		context
		&& context.result === "resolved"
		&& (context.detectedFromIp || context.guideAvailability !== "published")
	);
}

export function resolveLookupDestination(response: LocationLookupResponse) {
	return hasActiveNationwideLookupResult(buildNationwideLookupResultContext(response))
		? nationwideResultsPath
		: null;
}

export function buildHomeExperienceState(
	hasNationwideLookupResult: boolean,
	hasPublishedGuideContext: boolean
): HomeExperienceState {
	if (hasNationwideLookupResult) {
		return {
			primaryLookupPath: nationwideResultsPath,
			showFeaturedGuidePreview: false,
			showNationwideResults: true,
			startHerePrimaryLabel: "Open nationwide results",
			startHerePrimaryPath: nationwideResultsPath
		};
	}

	if (hasPublishedGuideContext) {
		return {
			primaryLookupPath: "/ballot",
			showFeaturedGuidePreview: true,
			showNationwideResults: false,
			startHerePrimaryLabel: "Open ballot guide",
			startHerePrimaryPath: "/ballot"
		};
	}

	return {
		primaryLookupPath: "/#location-lookup",
		showFeaturedGuidePreview: false,
		showNationwideResults: false,
		startHerePrimaryLabel: "Open location lookup",
		startHerePrimaryPath: "/#location-lookup"
	};
}
