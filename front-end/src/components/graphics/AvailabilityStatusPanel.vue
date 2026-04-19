<script setup lang="ts">
import type { LookupAvailability } from "~/types/civic";
import HorizontalBarChart from "~/components/graphics/HorizontalBarChart.vue";
import StackedMeter from "~/components/graphics/StackedMeter.vue";

const props = withDefaults(defineProps<{
	eyebrow?: string;
	items: LookupAvailability[];
	note?: string;
	title: string;
	uncertainty?: string;
}>(), {
	eyebrow: "Data availability",
	note: "",
	uncertainty: ""
});

const availabilitySegments = computed(() => {
	const counts = {
		available: props.items.filter(item => item.status === "available").length,
		partial: props.items.filter(item => item.status === "partial").length,
		unavailable: props.items.filter(item => item.status === "unavailable").length
	};

	return [
		{ id: "available", label: "Available", tone: "accent" as const, value: counts.available },
		{ id: "partial", label: "Partial", tone: "warning" as const, value: counts.partial },
		{ id: "unavailable", label: "Unavailable", tone: "neutral" as const, value: counts.unavailable }
	].filter(segment => segment.value > 0);
});

const readinessBars = computed(() => props.items.map(item => ({
	detail: item.detail,
	id: item.label,
	label: item.label,
	sources: item.sources,
	tone: item.status === "available" ? "accent" as const : item.status === "partial" ? "warning" as const : "neutral" as const,
	uncertainty: item.note ?? undefined,
	value: item.status === "available" ? 100 : item.status === "partial" ? 60 : 24,
	valueLabel: item.status
})));
</script>

<template>
	<section v-if="props.items.length" class="p-5 border border-app-line/80 rounded-[1.6rem] bg-app-bg dark:border-app-line-dark dark:bg-app-bg-dark/70">
		<div class="flex flex-wrap gap-4 items-start justify-between">
			<div class="max-w-3xl">
				<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
					{{ props.eyebrow }}
				</p>
				<h3 class="text-2xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
					{{ props.title }}
				</h3>
				<p v-if="props.note" class="text-sm text-app-muted leading-7 mt-3 dark:text-app-muted-dark">
					{{ props.note }}
				</p>
			</div>
		</div>

		<div class="mt-5 gap-4 grid xl:grid-cols-[minmax(0,0.72fr)_minmax(0,1.28fr)]">
			<div class="px-4 py-4 border border-app-line/70 rounded-[1rem] bg-white/85 dark:border-app-line-dark dark:bg-app-panel-dark/80">
				<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
					Coverage split
				</p>
				<p class="text-sm text-app-muted leading-6 mt-3 dark:text-app-muted-dark">
					This stacked bar shows how many of the major product layers for this page are available now, partial, or still unavailable.
				</p>
				<div class="mt-4">
					<StackedMeter :segments="availabilitySegments" />
				</div>
			</div>

			<HorizontalBarChart :items="readinessBars" />
		</div>

		<p v-if="props.uncertainty" class="text-xs text-app-muted leading-6 mt-4 dark:text-app-muted-dark">
			<strong class="text-app-ink dark:text-app-text-dark">Uncertainty:</strong>
			{{ props.uncertainty }}
		</p>
	</section>
</template>
