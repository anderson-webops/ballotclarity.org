import type { PublicStatusResponse } from "~/types/civic";
import { useAsyncData } from "#app";
import { useApiClient } from "~/composables/useApiClient";

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
