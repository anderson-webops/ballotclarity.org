import type { StateRecordsResponse, StateRecordStatesResponse } from "~/types/civic";

export function useStateRecordStates() {
	const api = useApiClient();
	return useAsyncData<StateRecordStatesResponse>("state-record-states", () => api<StateRecordStatesResponse>("/state-records"), {
		default: () => ({ states: [] }),
	});
}

export function useStateRecords(input: MaybeRefOrGetter<{ stateCode: string; sourceId?: string; search: string; scope: string; status: string; offset: number }>) {
	const api = useApiClient();
	const filters = computed(() => toValue(input));
	return useAsyncData<StateRecordsResponse | null>(
		() => `state-records:${JSON.stringify(filters.value)}`,
		() => filters.value.stateCode
			? api<StateRecordsResponse>(`/state-records/${filters.value.stateCode}`, {
					query: { source: filters.value.sourceId, q: filters.value.search, scope: filters.value.scope, status: filters.value.status, offset: filters.value.offset, limit: 50 },
				})
			: Promise.resolve(null),
		{ default: () => null },
	);
}
