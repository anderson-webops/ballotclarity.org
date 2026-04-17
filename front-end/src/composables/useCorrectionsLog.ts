import type { PublicCorrectionsResponse } from "~/types/civic";

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
