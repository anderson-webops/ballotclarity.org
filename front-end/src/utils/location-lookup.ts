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
			footerNote: "Choose one of the matched ZIP areas here to load the right district, representative, and official-tool layers before moving deeper into the app.",
			heading: "Choose the matched ZIP area",
			supportingNote: "This ZIP resolved to multiple civic areas in the current provider data. Ballot Clarity needs one more selection before it can open a single area cleanly."
		};
	}

	if (canOpenGuide) {
		const hasVerifiedContestPackage = Boolean(response.guideContent?.verifiedContestPackage);

		return {
			availabilityBadgeLabel: hasVerifiedContestPackage ? "Verified local guide" : "Local guide shell live",
			canOpenGuide: true,
			footerNote: hasVerifiedContestPackage
				? "This lookup succeeded. Review the civic results here first, then open the local guide for verified contest, candidate, and measure pages."
				: "This lookup succeeded. Review the civic results here first, then open the live guide shell when you want Ballot Clarity's current local package and official logistics.",
			heading: hasVerifiedContestPackage ? "Local guide and civic results ready" : "Local guide shell and civic results ready",
			supportingNote: hasVerifiedContestPackage
				? "A verified local guide is available for this lookup. Official tools remain visible below for final ballot confirmation."
				: response.guideContent?.summary
					?? "A live local guide shell is available for this lookup. Official logistics are verified here while contest pages are still being finalized for this jurisdiction."
		};
	}

	return {
		availabilityBadgeLabel: "Nationwide civic results available",
		canOpenGuide: false,
		footerNote: "This lookup succeeded nationwide. Use the district, representative, provenance, and official-tool layers here even when a full local guide is not published yet.",
		heading: "Nationwide civic results ready",
		supportingNote: "Ballot Clarity matched this lookup to nationwide civic coverage. Official tools stay visible below for ballot confirmation, voter status, and polling-place details."
	};
}
