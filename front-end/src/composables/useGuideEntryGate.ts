import { storeToRefs } from "pinia";
import { lookupAllowsGuideEntryPoints, lookupBlocksGuideEntryPoints } from "~/utils/guide-entry";
import { hasActiveNationwideLookupResult } from "~/utils/nationwide-results";

export function useGuideEntryGate() {
	const civicStore = useCivicStore();
	const { isHydrated, lookupContext, nationwideLookupResult, selectedElection, selectedLocation } = storeToRefs(civicStore);

	const activeLookupContext = computed(() => isHydrated.value ? lookupContext.value : null);
	const activeNationwideResult = computed(() => isHydrated.value ? nationwideLookupResult.value : null);
	const allowsGuideEntryPoints = computed(() => !isHydrated.value || lookupAllowsGuideEntryPoints(lookupContext.value));
	const blocksGuideEntryPoints = computed(() => isHydrated.value && lookupBlocksGuideEntryPoints(lookupContext.value));
	const hasNationwideResultContext = computed(() => hasActiveNationwideLookupResult(activeNationwideResult.value));
	const hasPublishedGuideContext = computed(() => Boolean(
		isHydrated.value
		&& lookupContext.value?.guideAvailability === "published"
		&& selectedElection.value
		&& selectedLocation.value
	));

	return {
		activeLookupContext,
		activeNationwideResult,
		allowsGuideEntryPoints,
		blocksGuideEntryPoints,
		hasPublishedGuideContext,
		hasNationwideResultContext
	};
}
