import type { RepresentativesResponse } from "~/types/civic";

export function useRepresentatives() {
	const api = useApiClient();

	return useAsyncData<RepresentativesResponse>(
		"representatives",
		() => api<RepresentativesResponse>("/representatives"),
		{
			default: () => ({
				districts: [],
				note: "",
				representatives: [],
				updatedAt: ""
			})
		}
	);
}
