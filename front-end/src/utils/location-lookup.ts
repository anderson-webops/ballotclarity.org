import type { LocationLookupAction, LocationLookupResponse } from "../types/civic";

type LookupResolution = Pick<LocationLookupResponse, "result" | "guideAvailability" | "guideContent" | "location" | "electionSlug" | "selectionOptions">;

export interface LookupPresentation {
	availabilityBadgeLabel: string;
	canOpenGuide: boolean;
	footerNote: string;
	heading: string;
	supportingNote: string;
}

export function hasPublishedGuideResult(response: Omit<LookupResolution, "result">) {
	return response.guideAvailability === "published"
		&& Boolean(response.location)
		&& Boolean(response.electionSlug);
}

export function filterLookupActionsForPresentation(
	actions: LocationLookupAction[] | undefined,
	response: LookupResolution
) {
	const canOpenGuide = hasPublishedGuideResult(response);

	return (actions ?? []).filter(action => action.kind !== "ballot-guide" || canOpenGuide);
}

export function buildLookupPresentation(response: LookupResolution): LookupPresentation {
	const canOpenGuide = hasPublishedGuideResult(response);
	const requiresSelection = Boolean(response.selectionOptions?.length);

	if (response.result === "unsupported") {
		return {
			availabilityBadgeLabel: "Lookup not resolved",
			canOpenGuide: false,
			footerNote: "Use the official tools above for this location, or replace the ZIP code with a full street address for a more precise lookup.",
			heading: "Location not yet resolved",
			supportingNote: ""
		};
	}

	if (requiresSelection) {
		return {
			availabilityBadgeLabel: "ZIP area selection needed",
			canOpenGuide: false,
			footerNote: "Choose one of the matched ZIP areas here to load the right districts, officials, and official election links.",
			heading: "Choose the matched ZIP area",
			supportingNote: "This ZIP matched more than one civic area. Choose the right area to continue."
		};
	}

	if (canOpenGuide) {
		const hasVerifiedContestPackage = Boolean(response.guideContent?.verifiedContestPackage);

		return {
			availabilityBadgeLabel: hasVerifiedContestPackage ? "Verified local guide" : "Local guide available",
			canOpenGuide: true,
			footerNote: hasVerifiedContestPackage
				? "Review the results here first, then open the local guide for verified contest, candidate, and measure pages."
				: "Review the results here first, then open the local guide for official links and the current local content.",
			heading: hasVerifiedContestPackage ? "Local guide and civic results ready" : "Civic results and local guide ready",
			supportingNote: hasVerifiedContestPackage
				? "A verified local guide is available for this lookup. Official tools remain visible below for final ballot confirmation."
				: response.guideContent?.summary
					?? "Official election links are verified for this area. Contest pages are still under local review."
		};
	}

	return {
		availabilityBadgeLabel: "Nationwide civic results available",
		canOpenGuide: false,
		footerNote: "Use the district, representative, and official election links here even when a local guide is not available yet.",
		heading: "Civic results ready",
		supportingNote: "Official tools stay visible below for ballot confirmation, voter status, and polling-place details."
	};
}
