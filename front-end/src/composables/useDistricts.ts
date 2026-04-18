import type { DistrictRecordResponse, DistrictsResponse } from "~/types/civic";

interface NationwideLookupApiQuery {
	lookup: string;
	selection?: string;
}

export function useDistricts(activeLookupQuery?: MaybeRefOrGetter<NationwideLookupApiQuery | null | undefined>) {
	const api = useApiClient();
	const lookupQuery = computed(() => toValue(activeLookupQuery) ?? null);
	const emptyDistrictsResponse: DistrictsResponse = {
		districts: [],
		mode: "guide",
		note: "",
		updatedAt: ""
	};

	return useAsyncData<DistrictsResponse>(
		() => `districts:${lookupQuery.value?.lookup ?? "none"}:${lookupQuery.value?.selection ?? "none"}`,
		() => api<DistrictsResponse>("/districts", {
			query: lookupQuery.value ?? undefined
		}),
		{
			default: () => emptyDistrictsResponse,
			watch: [lookupQuery]
		}
	);
}

export function useDistrict(
	districtSlug: MaybeRefOrGetter<string | undefined>,
	activeLookupQuery?: MaybeRefOrGetter<NationwideLookupApiQuery | null | undefined>
) {
	const api = useApiClient();
	const slug = computed(() => toValue(districtSlug));
	const lookupQuery = computed(() => toValue(activeLookupQuery) ?? null);

	return useAsyncData<DistrictRecordResponse | null>(
		() => `district:${slug.value ?? "unknown"}:${lookupQuery.value?.lookup ?? "none"}:${lookupQuery.value?.selection ?? "none"}`,
		async () => {
			if (!slug.value)
				return null;

			return api<DistrictRecordResponse>(`/districts/${slug.value}`, {
				query: lookupQuery.value ?? undefined
			});
		},
		{
			default: () => null,
			watch: [slug, lookupQuery]
		}
	);
}
