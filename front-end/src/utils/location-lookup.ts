import type { LocationLookupAction, LocationLookupResponse } from "../types/civic";

type LookupResolution = Pick<LocationLookupResponse, "result" | "guideAvailability" | "location" | "electionSlug">;

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

	if (response.result === "unsupported") {
		return {
			availabilityBadgeLabel: "Lookup not resolved",
			canOpenGuide: false,
			footerNote: "Use the official tools above for this location, or replace the ZIP code with a full street address for a more precise lookup.",
			heading: "Location not yet resolved",
			supportingNote: ""
		};
	}

	if (canOpenGuide) {
		return {
			availabilityBadgeLabel: "Full local guide available",
			canOpenGuide: true,
			footerNote: "This lookup succeeded. Review the nationwide civic results here first, then open the local guide when you want Ballot Clarity's contest, candidate, and measure pages.",
			heading: "Local guide and civic results ready",
			supportingNote: "A published local guide is available for this lookup. Nationwide civic results and official tools remain visible below first."
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
