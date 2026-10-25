import type { Measure } from "~/types/civic";

export function useMeasure(measureSlug: MaybeRefOrGetter<string | undefined>, electionSlug?: MaybeRefOrGetter<string | undefined>) {
	const api = useApiClient();
	const slug = computed(() => toValue(measureSlug));
	const election = computed(() => toValue(electionSlug));

	return useAsyncData<Measure | null>(
		() => `measure:${slug.value ?? "unknown"}:${election.value ?? "default"}`,
		async () => {
			if (!slug.value)
				return null;

			return api<Measure>(`/measures/${slug.value}`, { query: { election: election.value } });
		},
		{
			default: () => null,
			watch: [slug, election]
		}
	);
}

export function useMeasures(measureSlugs: MaybeRefOrGetter<string[] | undefined>) {
	const api = useApiClient();
	const slugs = computed(() => (toValue(measureSlugs) ?? []).filter(Boolean));

	return useAsyncData(
		() => `measures:${slugs.value.join(",") || "empty"}`,
		async () => {
			if (!slugs.value.length)
				return [] as Measure[];

			return Promise.all(slugs.value.map(slug => api<Measure>(`/measures/${slug}`)));
		},
		{
			default: () => [],
			watch: [slugs]
		}
	);
}
