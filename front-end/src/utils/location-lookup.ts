import type { LocationLookupAction, LocationLookupResponse } from "../types/civic";

type LookupResolution = Pick<LocationLookupResponse, "result" | "guideAvailability" | "guideContent" | "location" | "electionSlug" | "selectionOptions">;

export interface LookupPresentation {
	availabilityBadgeLabel: string;
	canOpenGuide: boolean;
	footerNote: string;
	guideActionLabel: string;
	heading: string;
	supportingNote: string;
}

export function hasPublishedGuideResult(response: Omit<LookupResolution, "result">) {
	return response.guideAvailability === "published"
		&& Boolean(response.guideContent?.publishedGuideShell)
		&& Boolean(response.location)
		&& Boolean(response.electionSlug);
}

export function hasVerifiedGuideResult(response: Omit<LookupResolution, "result">) {
	return hasPublishedGuideResult(response)
		&& Boolean(response.guideContent?.verifiedContestPackage);
}

export function buildPublishedGuideDestination(response: Omit<LookupResolution, "result">) {
	if (!hasPublishedGuideResult(response) || !response.electionSlug)
		return null;

	if (hasVerifiedGuideResult(response))
		return response.location ? `/ballot/${response.electionSlug}?location=${response.location.slug}` : `/ballot/${response.electionSlug}`;

	return `/elections/${response.electionSlug}`;
}

export function filterLookupActionsForPresentation(
	actions: LocationLookupAction[] | undefined,
	response: LookupResolution
) {
	const seen = new Set<string>();

	return (actions ?? []).filter((action) => {
		if (action.kind === "ballot-guide" && !buildLookupActionDestination(action, response))
			return false;

		const key = action.kind === "ballot-guide"
			? `${action.kind}:${action.electionSlug}:${action.location?.slug}`
			: `${action.kind}:${action.title.trim().toLowerCase()}`;
		if (seen.has(key))
			return false;
		seen.add(key);
		return true;
	});
}

export function buildLookupActionDestination(action: LocationLookupAction, response: LookupResolution) {
	if (action.kind !== "ballot-guide" || !action.electionSlug || !action.location || response.result !== "resolved" || response.selectionOptions?.length)
		return null;

	const matchesSelectedGuide = action.electionSlug === response.electionSlug && action.location.slug === response.location?.slug;
	const guideContent = action.guideContent !== undefined ? action.guideContent : matchesSelectedGuide ? response.guideContent : null;
	return buildPublishedGuideDestination({
		electionSlug: action.electionSlug,
		guideAvailability: action.guideContent !== undefined ? guideContent?.publishedGuideShell ? "published" : "not-published" : matchesSelectedGuide ? response.guideAvailability : "not-published",
		guideContent,
		location: action.location
	});
}

export function buildLookupPresentation(response: LookupResolution): LookupPresentation {
	const canOpenGuide = hasPublishedGuideResult(response);
	const requiresSelection = Boolean(response.selectionOptions?.length);

	if (response.result === "unsupported") {
		return {
			availabilityBadgeLabel: "Lookup not resolved",
			canOpenGuide: false,
			footerNote: "Use the official tools above for this location, or replace the ZIP code with a full street address for a more precise lookup.",
			guideActionLabel: "Open election overview",
			heading: "Location not yet resolved",
			supportingNote: ""
		};
	}

	if (requiresSelection) {
		return {
			availabilityBadgeLabel: "ZIP area selection needed",
			canOpenGuide: false,
			footerNote: "Choose one of the matched ZIP areas here to load the right districts, officials, and official election links.",
			guideActionLabel: "Choose this area",
			heading: "Choose the matched ZIP area",
			supportingNote: "This ZIP matched more than one civic area. Choose the right area to continue."
		};
	}

	if (canOpenGuide) {
		const hasVerifiedContestPackage = hasVerifiedGuideResult(response);

		return {
			availabilityBadgeLabel: hasVerifiedContestPackage ? "Ballot information available" : "Election information available",
			canOpenGuide: true,
			footerNote: "",
			guideActionLabel: hasVerifiedContestPackage ? "View ballot" : "Election information",
			heading: "Results",
			supportingNote: ""
		};
	}

	return {
		availabilityBadgeLabel: "Civic results available",
		canOpenGuide: false,
		footerNote: "",
		guideActionLabel: "Open results",
		heading: "Civic results ready",
		supportingNote: ""
	};
}
