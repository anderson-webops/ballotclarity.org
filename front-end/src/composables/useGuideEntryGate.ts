import { storeToRefs } from "pinia";
import { lookupAllowsGuideEntryPoints, lookupBlocksGuideEntryPoints } from "~/utils/guide-entry";

export function useGuideEntryGate() {
	const civicStore = useCivicStore();
	const { isHydrated, lookupContext } = storeToRefs(civicStore);

	const activeLookupContext = computed(() => isHydrated.value ? lookupContext.value : null);
	const allowsGuideEntryPoints = computed(() => !isHydrated.value || lookupAllowsGuideEntryPoints(lookupContext.value));
	const blocksGuideEntryPoints = computed(() => isHydrated.value && lookupBlocksGuideEntryPoints(lookupContext.value));

	return {
		activeLookupContext,
		allowsGuideEntryPoints,
		blocksGuideEntryPoints
	};
}
