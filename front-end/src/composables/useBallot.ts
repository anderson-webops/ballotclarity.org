import type { BallotResponse } from "~/types/civic";

export function useBallot(electionSlug: MaybeRefOrGetter<string | undefined>, locationSlug?: MaybeRefOrGetter<string | undefined>) {
	const api = useApiClient();
	const slug = computed(() => toValue(electionSlug));
	const location = computed(() => toValue(locationSlug));

	return useAsyncData<BallotResponse | null>(
		() => `ballot:${slug.value ?? "default"}:${location.value ?? "default"}`,
		async () => {
			if (!slug.value)
				return null;

			return api<BallotResponse>("/ballot", {
				query: {
					election: slug.value,
					location: location.value
				}
			});
		},
		{
			default: () => null,
			watch: [slug, location]
		}
	);
}
