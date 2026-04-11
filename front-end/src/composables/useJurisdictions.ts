import type { Jurisdiction, JurisdictionsResponse } from "~/types/civic";

export function useJurisdictions() {
	const api = useApiClient();

	return useAsyncData<JurisdictionsResponse>(
		"jurisdictions",
		() => api<JurisdictionsResponse>("/jurisdictions"),
		{
			default: () => ({
				jurisdictions: []
			})
		}
	);
}

export function useJurisdiction(jurisdictionSlug: MaybeRefOrGetter<string | undefined>) {
	const api = useApiClient();
	const slug = computed(() => toValue(jurisdictionSlug));

	return useAsyncData<Jurisdiction | null>(
		() => `jurisdiction:${slug.value ?? "unknown"}`,
		async () => {
			if (!slug.value)
				return null;

			return api<Jurisdiction>(`/jurisdictions/${slug.value}`);
		},
		{
			default: () => null,
			watch: [slug]
		}
	);
}
