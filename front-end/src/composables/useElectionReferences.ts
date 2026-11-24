import type { MaybeRefOrGetter } from "vue";
import type { ElectionReferencesResponse } from "~/types/civic";
import { computed, toValue } from "vue";
import { useAsyncData } from "#app";
import { useApiClient } from "~/composables/useApiClient";

export function useElectionReferences(input: MaybeRefOrGetter<{ stateCode: string; electionDate?: string; search: string; scope: string; offset: number }>) {
	const api = useApiClient();
	const filters = computed(() => toValue(input));
	return useAsyncData<ElectionReferencesResponse | null>(
		() => `election-references:${JSON.stringify(filters.value)}`,
		() => filters.value.stateCode
			? api<ElectionReferencesResponse>(`/election-references/${filters.value.stateCode}`, {
					query: {
						electionDate: filters.value.electionDate,
						q: filters.value.search,
						scope: filters.value.scope,
						offset: filters.value.offset,
						limit: 50
					}
				})
			: Promise.resolve(null),
		{
			default: () => null
		},
	);
}

export function useElectionReferenceCatalog(input: MaybeRefOrGetter<string>) {
	const api = useApiClient();
	const stateCode = computed(() => toValue(input));
	return useAsyncData<{ stateCode: string; elections: string[] } | null>(
		() => `reference-catalog:${stateCode.value}`,
		() => stateCode.value
			? api(`/election-references/${stateCode.value}/catalog`)
			: Promise.resolve(null),
		{
			default: () => null
		},
	);
}
