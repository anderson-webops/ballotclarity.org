import type { CoverageResponse } from "~/types/civic";

export function useCoverage() {
	const api = useApiClient();

	return useAsyncData<CoverageResponse | null>(
		"coverage-profile",
		() => api<CoverageResponse>("/coverage"),
		{
			default: () => null
		}
	);
}
