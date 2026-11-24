import type { CoverageResponse } from "~/types/civic";
import { useAsyncData } from "#app";
import { useApiClient } from "~/composables/useApiClient";

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
