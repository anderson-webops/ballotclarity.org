import type { RepresentativesResponse } from "~/types/civic";

export function useRepresentatives() {
	const api = useApiClient();
	const emptyRepresentativesResponse: RepresentativesResponse = {
		districts: [],
		mode: "guide",
		note: "",
		representatives: [],
		updatedAt: ""
	};

	return useAsyncData<RepresentativesResponse>(
		"representatives",
		() => api<RepresentativesResponse>("/representatives"),
		{
			default: () => emptyRepresentativesResponse
		}
	);
}
