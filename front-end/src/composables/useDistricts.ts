import type { DistrictRecordResponse, DistrictsResponse } from "~/types/civic";

export function useDistricts() {
	const api = useApiClient();
	const emptyDistrictsResponse: DistrictsResponse = {
		districts: [],
		mode: "guide",
		note: "",
		updatedAt: ""
	};

	return useAsyncData<DistrictsResponse>(
		"districts",
		() => api<DistrictsResponse>("/districts"),
		{
			default: () => emptyDistrictsResponse
		}
	);
}

export function useDistrict(districtSlug: MaybeRefOrGetter<string | undefined>) {
	const api = useApiClient();
	const slug = computed(() => toValue(districtSlug));

	return useAsyncData<DistrictRecordResponse | null>(
		() => `district:${slug.value ?? "unknown"}`,
		async () => {
			if (!slug.value)
				return null;

			return api<DistrictRecordResponse>(`/districts/${slug.value}`);
		},
		{
			default: () => null,
			watch: [slug]
		}
	);
}
