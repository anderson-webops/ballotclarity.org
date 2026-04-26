import { storeToRefs } from "pinia";
import { buildRouteLayerNavigation } from "~/utils/route-layer-navigation";

export function useRouteLayerNavigation() {
	const civicStore = useCivicStore();
	const { selectedElection, selectedLocation } = storeToRefs(civicStore);
	const { hasGuideShellContext, hasNationwideResultContext, hasVerifiedGuideContext } = useGuideEntryGate();

	const navigation = computed(() => buildRouteLayerNavigation({
		hasGuideShellContext: hasGuideShellContext.value,
		hasNationwideResultContext: hasNationwideResultContext.value,
		hasVerifiedGuideContext: hasVerifiedGuideContext.value,
		selectedElectionSlug: selectedElection.value?.slug ?? null,
		selectedLocationSlug: selectedLocation.value?.slug ?? null
	}));

	return {
		backToLayerLink: computed(() => navigation.value.backToLayer),
		layerBreadcrumbLink: computed(() => navigation.value.layerBreadcrumb),
		locationHubLink: computed(() => navigation.value.locationHub),
		openLayerLink: computed(() => navigation.value.openLayer),
		overviewLink: computed(() => navigation.value.overview)
	};
}
