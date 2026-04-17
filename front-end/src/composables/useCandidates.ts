import type { Candidate, CompareResponse } from "~/types/civic";

export function useCandidate(candidateSlug: MaybeRefOrGetter<string | undefined>) {
	const api = useApiClient();
	const slug = computed(() => toValue(candidateSlug));

	return useAsyncData<Candidate | null>(
		() => `candidate:${slug.value ?? "unknown"}`,
		async () => {
			if (!slug.value)
				return null;

			return api<Candidate>(`/candidates/${slug.value}`);
		},
		{
			default: () => null,
			watch: [slug]
		}
	);
}

export function useCandidates(candidateSlugs: MaybeRefOrGetter<string[] | undefined>) {
	const api = useApiClient();
	const slugs = computed(() => (toValue(candidateSlugs) ?? []).filter(Boolean).slice(0, 3));
	const emptyCompareResponse = {
		candidates: [],
		contestSlug: null,
		note: "No compare candidates were selected in this URL yet. Choose two or three candidates, then reopen compare.",
		office: null,
		sameContest: false,
		requestedSlugs: []
	} satisfies CompareResponse;

	return useAsyncData<CompareResponse>(
		() => `compare:${slugs.value.join(",") || "empty"}`,
		async () => {
			if (!slugs.value.length)
				return emptyCompareResponse;

			return api<CompareResponse>("/compare", {
				query: {
					slugs: slugs.value.join(",")
				}
			});
		},
		{
			default: () => emptyCompareResponse,
			watch: [slugs]
		}
	);
}
