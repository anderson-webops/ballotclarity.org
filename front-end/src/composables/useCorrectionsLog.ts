import type { PublicCorrectionsResponse } from "~/types/civic";
import { useAsyncData } from "#app";
import { useApiClient } from "~/composables/useApiClient";

export function useCorrectionsLog() {
	const api = useApiClient();

	return useAsyncData<PublicCorrectionsResponse | null>(
		"public-corrections",
		() => api<PublicCorrectionsResponse>("/corrections"),
		{
			default: () => null
		}
	);
}
