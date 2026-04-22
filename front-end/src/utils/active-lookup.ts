import type { LocationSelection, NationwideLookupResultContext } from "../types/civic";

export interface ActiveLookupSummary {
	label: string;
	mode: "guide" | "nationwide" | "none";
	note: string;
	resolvedAt: string;
}

interface BuildActiveLookupSummaryInput {
	nationwideLookupResult?: NationwideLookupResultContext | null;
	routeLookupQuery?: string | null;
	selectedLocation?: LocationSelection | null;
}

export function buildActiveLookupSummary({
	nationwideLookupResult,
	routeLookupQuery,
	selectedLocation
}: BuildActiveLookupSummaryInput): ActiveLookupSummary {
	if (nationwideLookupResult?.result === "resolved") {
		return {
			label: nationwideLookupResult.location?.displayName || nationwideLookupResult.normalizedAddress || "Nationwide civic results",
			mode: "nationwide",
			note: nationwideLookupResult.detectedFromIp
				? "Using an approximate saved location. Enter an address or ZIP code if you need a more exact match."
				: "Using your latest saved lookup.",
			resolvedAt: nationwideLookupResult.resolvedAt ?? ""
		};
	}

	if (selectedLocation) {
		return {
			label: selectedLocation.displayName,
			mode: "guide",
			note: "Using the saved guide area in this browser.",
			resolvedAt: ""
		};
	}

	if (routeLookupQuery) {
		return {
			label: routeLookupQuery,
			mode: "nationwide",
			note: "Using the lookup from this page URL.",
			resolvedAt: ""
		};
	}

	return {
		label: "No active lookup",
		mode: "none",
		note: "No saved area is active in this browser right now.",
		resolvedAt: ""
	};
}
