import type { LocationGuideAvailability, LocationLookupResult } from "../types/civic";

export interface LookupContextState {
	result: LocationLookupResult;
	guideAvailability?: LocationGuideAvailability;
}

export function lookupBlocksGuideEntryPoints(lookupContext: LookupContextState | null | undefined) {
	return Boolean(lookupContext && lookupContext.guideAvailability !== "published");
}

export function lookupAllowsGuideEntryPoints(lookupContext: LookupContextState | null | undefined) {
	return !lookupBlocksGuideEntryPoints(lookupContext);
}
