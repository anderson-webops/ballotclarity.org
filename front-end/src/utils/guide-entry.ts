import type { LocationGuideAvailability, LocationLookupResult } from "../types/civic";

export interface LookupContextState {
	result: LocationLookupResult;
	guideAvailability?: LocationGuideAvailability;
	hasPublishedGuideShell?: boolean;
	hasVerifiedContestPackage?: boolean;
}

export function lookupHasPublishedGuideShell(lookupContext: LookupContextState | null | undefined) {
	return Boolean(
		lookupContext
		&& lookupContext.guideAvailability === "published"
		&& lookupContext.hasPublishedGuideShell
	);
}

export function lookupHasVerifiedContestPackage(lookupContext: LookupContextState | null | undefined) {
	return Boolean(
		lookupContext
		&& lookupContext.guideAvailability === "published"
		&& lookupContext.hasVerifiedContestPackage
	);
}

export function lookupBlocksGuideEntryPoints(lookupContext: LookupContextState | null | undefined) {
	return Boolean(lookupContext && !lookupHasVerifiedContestPackage(lookupContext));
}

export function lookupAllowsGuideEntryPoints(lookupContext: LookupContextState | null | undefined) {
	return !lookupBlocksGuideEntryPoints(lookupContext);
}
