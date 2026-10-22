import type { MeasureReferencesResponse } from "~/types/civic";

export function useMeasureReferences(stateCode: MaybeRefOrGetter<string>) {
	const api = useApiClient();
	const code = computed(() => toValue(stateCode));
	return useAsyncData<MeasureReferencesResponse | null>(
		() => `measure-references:${code.value}`,
		() => code.value
			? api<MeasureReferencesResponse>(`/measure-references/${code.value}`).catch(() => null)
			: Promise.resolve(null),
		{ default: () => null },
	);
}
