import type { DataSourcesResponse } from "~/types/civic";
import { useAsyncData } from "#app";
import { useApiClient } from "~/composables/useApiClient";

export function useDataSources() {
	const api = useApiClient();

	return useAsyncData<DataSourcesResponse | null>(
		"data-sources",
		() => api<DataSourcesResponse>("/data-sources"),
		{
			default: () => null
		}
	);
}
