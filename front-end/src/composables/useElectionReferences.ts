import type { ElectionReferencesResponse } from "~/types/civic";

export function useElectionReferences(input: MaybeRefOrGetter<{ stateCode: string; search: string; scope: string; offset: number }>) {
	const api = useApiClient();
	const filters = computed(() => toValue(input));
	return useAsyncData<ElectionReferencesResponse | null>(
		() => `election-references:${JSON.stringify(filters.value)}`,
		() => filters.value.stateCode
			? api<ElectionReferencesResponse>(`/election-references/${filters.value.stateCode}`, { query: { q: filters.value.search, scope: filters.value.scope, offset: filters.value.offset, limit: 50 } })
			: Promise.resolve(null),
		{ default: () => null },
	);
}
