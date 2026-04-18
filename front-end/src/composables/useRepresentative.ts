import type { PersonProfileResponse } from "~/types/civic";

interface NationwideLookupApiQuery {
	lookup: string;
	selection?: string;
}

export function useRepresentative(
	representativeSlug: MaybeRefOrGetter<string | undefined>,
	activeLookupQuery?: MaybeRefOrGetter<NationwideLookupApiQuery | null | undefined>
) {
	const api = useApiClient();
	const slug = computed(() => toValue(representativeSlug));
	const lookupQuery = computed(() => toValue(activeLookupQuery) ?? null);

	return useAsyncData<PersonProfileResponse | null>(
		() => `representative:${slug.value ?? "unknown"}:${lookupQuery.value?.lookup ?? "none"}:${lookupQuery.value?.selection ?? "none"}`,
		async () => {
			if (!slug.value)
				return null;

			return api<PersonProfileResponse>(`/representatives/${slug.value}`, {
				query: lookupQuery.value ?? undefined
			});
		},
		{
			default: () => null,
			watch: [slug, lookupQuery]
		}
	);
}
