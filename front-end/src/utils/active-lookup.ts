import type { LocationSelection, NationwideLookupResultContext } from "../types/civic";

export interface ActiveLookupSummary {
	label: string;
	mode: "guide" | "nationwide" | "none";
	note: string;
	resolvedAt: string;
}

interface BuildActiveLookupSummaryInput {
	nationwideLookupResult?: NationwideLookupResultContext | null;
	selectedLocation?: LocationSelection | null;
}

export function buildActiveLookupSummary({
	nationwideLookupResult,
	selectedLocation
}: BuildActiveLookupSummaryInput): ActiveLookupSummary {
	if (nationwideLookupResult?.result === "resolved") {
		return {
			label: nationwideLookupResult.location?.displayName || nationwideLookupResult.normalizedAddress || "Nationwide civic results",
			mode: "nationwide",
			note: nationwideLookupResult.detectedFromIp
				? "Using the current approximate nationwide lookup guess carried in this browser. Confirm with a manual address or ZIP when precision matters."
				: "Using the latest successful nationwide lookup saved in this browser so district, representative, and results pages stay on the same active context.",
			resolvedAt: nationwideLookupResult.resolvedAt ?? ""
		};
	}

	if (selectedLocation) {
		return {
			label: selectedLocation.displayName,
			mode: "guide",
			note: "Using the current published-guide location carried in this browser session.",
			resolvedAt: ""
		};
	}

	return {
		label: "No active lookup",
		mode: "none",
		note: "No lookup-specific context is active in this browser right now, so this page falls back to the published district layer where available.",
		resolvedAt: ""
	};
}
