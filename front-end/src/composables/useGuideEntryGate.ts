import { storeToRefs } from "pinia";
import { lookupAllowsGuideEntryPoints, lookupBlocksGuideEntryPoints } from "~/utils/guide-entry";
import { hasActiveNationwideLookupResult } from "~/utils/nationwide-results";
import { extractNationwideLookupRouteQuery } from "~/utils/nationwide-route-context";

export function useGuideEntryGate() {
	const civicStore = useCivicStore();
	const route = useRoute();
	const { isHydrated, lookupContext, nationwideLookupResult, selectedElection, selectedLocation } = storeToRefs(civicStore);

	const activeLookupContext = computed(() => isHydrated.value ? lookupContext.value : null);
	const activeNationwideResult = computed(() => isHydrated.value ? nationwideLookupResult.value : null);
	const routeBackedNationwideLookup = computed(() => extractNationwideLookupRouteQuery(route.query));
	const allowsGuideEntryPoints = computed(() => routeBackedNationwideLookup.value
		? false
		: !isHydrated.value || lookupAllowsGuideEntryPoints(lookupContext.value));
	const blocksGuideEntryPoints = computed(() => routeBackedNationwideLookup.value
		? true
		: isHydrated.value && lookupBlocksGuideEntryPoints(lookupContext.value));
	const hasNationwideResultContext = computed(() => hasActiveNationwideLookupResult(activeNationwideResult.value) || Boolean(routeBackedNationwideLookup.value));
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
