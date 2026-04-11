import type { Measure } from "~/types/civic";

export function useMeasure(measureSlug: MaybeRefOrGetter<string | undefined>) {
	const api = useApiClient();
	const slug = computed(() => toValue(measureSlug));

	return useAsyncData<Measure | null>(
		() => `measure:${slug.value ?? "unknown"}`,
		async () => {
			if (!slug.value)
				return null;

			return api<Measure>(`/measures/${slug.value}`);
		},
		{
			default: () => null,
			watch: [slug]
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
