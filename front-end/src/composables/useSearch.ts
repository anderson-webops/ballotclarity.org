import type { SearchResponse } from "~/types/civic";

export function useSearchResults(queryInput: MaybeRefOrGetter<string | undefined>) {
	const api = useApiClient();
	const query = computed(() => toValue(queryInput)?.trim() ?? "");

	return useAsyncData<SearchResponse>(
		() => `search:${query.value || "empty"}`,
		async () => {
			return await api<SearchResponse>("/search", {
				query: {
					q: query.value
				}
			});
		},
		{
			default: () => ({
				groups: [],
				query: "",
				suggestions: [],
				total: 0
			}),
			watch: [query]
		}
	);
}
