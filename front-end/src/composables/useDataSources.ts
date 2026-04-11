import type { DataSourcesResponse } from "~/types/civic";

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
