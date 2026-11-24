import type { MaybeRefOrGetter } from "vue";
import type { ContestRecordResponse } from "~/types/civic";
import { computed, toValue } from "vue";
import { useAsyncData } from "#app";
import { useApiClient } from "~/composables/useApiClient";

export function useContest(contestSlug: MaybeRefOrGetter<string | undefined>) {
	const api = useApiClient();
	const slug = computed(() => toValue(contestSlug));

	return useAsyncData<ContestRecordResponse | null>(
		() => `contest:${slug.value ?? "unknown"}`,
		async () => {
			if (!slug.value)
				return null;

			return api<ContestRecordResponse>(`/contests/${slug.value}`);
		},
		{
			default: () => null,
			watch: [slug]
		}
	);
}
