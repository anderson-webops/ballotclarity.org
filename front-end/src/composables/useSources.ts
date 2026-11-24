import type { MaybeRefOrGetter } from "vue";
import type { Source } from "~/types/civic";
import { computed, toValue } from "vue";

export function useSources(sources: MaybeRefOrGetter<Source[] | undefined>) {
	const list = computed(() => toValue(sources) ?? []);

	const sourceCount = computed(() => list.value.length);

	const groupedByType = computed(() => {
		return list.value.reduce<Record<string, Source[]>>((groups, source) => {
			const type = source.type;
			const existing = groups[type] ?? [];
			existing.push(source);
			groups[type] = existing;
			return groups;
		}, {});
	});

	const latestSourceDate = computed(() => {
		return list.value
			.map(source => source.date)
			.sort()
			.at(-1);
	});

	return {
		groupedByType,
		latestSourceDate,
		list,
		sourceCount,
	};
}
