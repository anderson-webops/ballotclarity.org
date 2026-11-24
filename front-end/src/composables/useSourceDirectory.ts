import type { MaybeRefOrGetter } from "vue";
import type { SourceRecordResponse, SourcesDirectoryResponse } from "~/types/civic";
import { computed, toValue } from "vue";
import { useAsyncData } from "#app";
import { useApiClient } from "~/composables/useApiClient";

export function useSourceDirectory() {
	const api = useApiClient();

	return useAsyncData<SourcesDirectoryResponse>(
		"sources-directory",
		() => api<SourcesDirectoryResponse>("/sources"),
		{
			default: () => ({
				sources: [],
				updatedAt: ""
			})
		}
	);
}

export function useSourceRecord(sourceId: MaybeRefOrGetter<string | undefined>) {
	const api = useApiClient();
	const id = computed(() => toValue(sourceId));

	return useAsyncData<SourceRecordResponse | null>(
		() => `source-record:${id.value ?? "unknown"}`,
		async () => {
			if (!id.value)
				return null;

			return api<SourceRecordResponse>(`/sources/${id.value}`);
		},
		{
			default: () => null,
			watch: [id]
		}
	);
}
