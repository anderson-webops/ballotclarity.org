import type { PersonProfileResponse } from "~/types/civic";

export function useRepresentative(representativeSlug: MaybeRefOrGetter<string | undefined>) {
	const api = useApiClient();
	const slug = computed(() => toValue(representativeSlug));

	return useAsyncData<PersonProfileResponse | null>(
		() => `representative:${slug.value ?? "unknown"}`,
		async () => {
			if (!slug.value)
				return null;

			return api<PersonProfileResponse>(`/representatives/${slug.value}`);
		},
		{
			default: () => null,
			watch: [slug]
		}
	);
}
