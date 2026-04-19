<script setup lang="ts">
import type { ProvenanceSummary } from "~/types/civic";
import FactStatCard from "~/components/graphics/FactStatCard.vue";
import HorizontalBarChart from "~/components/graphics/HorizontalBarChart.vue";
import StackedMeter from "~/components/graphics/StackedMeter.vue";

const props = defineProps<{
	summary: ProvenanceSummary;
}>();

const numericItems = computed(() => props.summary.items.filter(item => typeof item.value === "number"));
const textItems = computed(() => props.summary.items.filter(item => typeof item.value !== "number"));

const sourceAuthoritySegments = computed(() => {
	const counts = new Map<string, number>();

	for (const source of props.summary.sources)
		counts.set(source.authority, (counts.get(source.authority) ?? 0) + 1);

	return [...counts.entries()].map(([label, value]) => ({
		id: label,
		label: label.replaceAll("-", " "),
		tone: label === "official-government" ? "accent" as const : label === "candidate-campaign" ? "warning" as const : "neutral" as const,
		value
	}));
});

const numericBarItems = computed(() => numericItems.value.map(item => ({
	detail: item.detail,
	id: item.label,
	label: item.label,
	tone: "accent" as const,
	value: Number(item.value),
	valueLabel: String(item.value)
})));
</script>

<template>
	<section class="p-5 border border-app-line/80 rounded-[1.6rem] bg-app-bg dark:border-app-line-dark dark:bg-app-bg-dark/70">
		<div class="flex flex-wrap gap-4 items-start justify-between">
			<div class="max-w-3xl">
				<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
					{{ props.summary.eyebrow || "Source provenance and freshness" }}
				</p>
				<h3 class="text-2xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
					{{ props.summary.title }}
				</h3>
				<p v-if="props.summary.note" class="text-sm text-app-muted leading-7 mt-3 dark:text-app-muted-dark">
					{{ props.summary.note }}
				</p>
			</div>

			<div class="flex flex-wrap gap-2 items-center justify-end">
				<VerificationBadge
					v-for="badge in props.summary.badges ?? []"
					:key="badge.label"
					:label="badge.label"
					:title="badge.title"
					:tone="badge.tone"
				/>
				<SourceDrawer
					v-if="props.summary.sources.length"
					:sources="props.summary.sources"
					:title="props.summary.title"
					button-label="Sources"
				/>
			</div>
		</div>

		<div class="mt-5 gap-4 grid xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
			<div class="space-y-4">
				<div
					v-if="sourceAuthoritySegments.length"
					class="px-4 py-4 border border-app-line/70 rounded-[1rem] bg-white/85 dark:border-app-line-dark dark:bg-app-panel-dark/80"
				>
					<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
						Source mix
					</p>
					<p class="text-sm text-app-muted leading-6 mt-3 dark:text-app-muted-dark">
						This chart shows how the current page’s evidence is distributed across official, campaign, open-data, and archive source families.
					</p>
					<div class="mt-4">
						<StackedMeter :segments="sourceAuthoritySegments" />
					</div>
				</div>

				<div
					v-if="numericBarItems.length"
					class="px-4 py-4 border border-app-line/70 rounded-[1rem] bg-white/85 dark:border-app-line-dark dark:bg-app-panel-dark/80"
				>
					<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
						Counted evidence signals
					</p>
					<div class="mt-4">
						<HorizontalBarChart :items="numericBarItems" />
					</div>
				</div>
			</div>

			<div class="gap-3 grid md:grid-cols-2 xl:grid-cols-1">
				<FactStatCard
					v-for="item in textItems"
					:key="item.label"
					:label="item.label"
					:note="item.detail"
					:value="item.value"
				/>
			</div>
		</div>

		<p v-if="props.summary.uncertainty" class="text-xs text-app-muted leading-6 mt-4 dark:text-app-muted-dark">
			<strong class="text-app-ink dark:text-app-text-dark">Uncertainty:</strong>
			{{ props.summary.uncertainty }}
		</p>
	</section>
</template>
