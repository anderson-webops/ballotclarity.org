import { storeToRefs } from "pinia";
import {
	lookupAllowsGuideEntryPoints,
	lookupBlocksGuideEntryPoints,
	lookupHasPublishedGuideShell,
	lookupHasVerifiedContestPackage
} from "~/utils/guide-entry";
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
	const hasGuideShellContext = computed(() => Boolean(
		isHydrated.value
		&& lookupHasPublishedGuideShell(lookupContext.value)
		&& selectedElection.value
		&& selectedLocation.value
	));
	const hasVerifiedGuideContext = computed(() => Boolean(
		hasGuideShellContext.value
		&& lookupHasVerifiedContestPackage(lookupContext.value)
	));

	return {
		activeLookupContext,
		activeNationwideResult,
		allowsGuideEntryPoints,
		blocksGuideEntryPoints,
		hasGuideShellContext,
		hasNationwideResultContext,
		hasPublishedGuideContext: hasVerifiedGuideContext,
		hasVerifiedGuideContext
	};
}
