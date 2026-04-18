import { storeToRefs } from "pinia";
import { buildRouteLayerNavigation } from "~/utils/route-layer-navigation";

export function useRouteLayerNavigation() {
	const civicStore = useCivicStore();
	const { selectedElection, selectedLocation } = storeToRefs(civicStore);
	const { hasNationwideResultContext, hasPublishedGuideContext } = useGuideEntryGate();

	const navigation = computed(() => buildRouteLayerNavigation({
		hasNationwideResultContext: hasNationwideResultContext.value,
		hasPublishedGuideContext: hasPublishedGuideContext.value,
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
