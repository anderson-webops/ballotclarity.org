import type { ContestRecordResponse } from "~/types/civic";

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
