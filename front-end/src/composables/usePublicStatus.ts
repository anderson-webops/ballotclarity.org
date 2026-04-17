import type { PublicStatusResponse } from "~/types/civic";

export function usePublicStatus() {
	const api = useApiClient();

	return useAsyncData<PublicStatusResponse | null>(
		"public-status",
		() => api<PublicStatusResponse>("/status"),
		{
			default: () => null
		}
	);
}
