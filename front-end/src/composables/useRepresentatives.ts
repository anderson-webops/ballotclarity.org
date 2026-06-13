import type { RepresentativesResponse } from "~/types/civic";

interface NationwideLookupApiQuery {
	area?: string;
	lookup?: string;
	selection?: string;
}

export function useRepresentatives(activeLookupQuery?: MaybeRefOrGetter<NationwideLookupApiQuery | null | undefined>) {
	const api = useApiClient();
	const lookupQuery = computed(() => toValue(activeLookupQuery) ?? null);
	const emptyRepresentativesResponse: RepresentativesResponse = {
		districts: [],
		mode: "guide",
		note: "",
		representatives: [],
		updatedAt: ""
	};

	return useAsyncData<RepresentativesResponse>(
		() => `representatives:${lookupQuery.value?.lookup ?? "none"}:${lookupQuery.value?.selection ?? "none"}:${lookupQuery.value?.area ?? "none"}`,
		() => api<RepresentativesResponse>("/representatives", {
			query: lookupQuery.value ?? undefined
		}),
		{
			default: () => emptyRepresentativesResponse,
			watch: [
				() => lookupQuery.value?.area,
				() => lookupQuery.value?.lookup,
				() => lookupQuery.value?.selection
			]
		}
	);
}
