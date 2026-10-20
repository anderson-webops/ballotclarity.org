<script setup lang="ts">
import type { FinanceCategoryBreakdown } from "~/types/civic";
import HorizontalBarChart from "~/components/graphics/HorizontalBarChart.vue";

const props = defineProps<{
	breakdown: FinanceCategoryBreakdown;
}>();

const { formatCurrency } = useFormatters();

const unitemizedLabel = "Not itemized among top funders";
const barItems = computed(() => props.breakdown.categories.map(category => ({
	detail: category.note,
	id: category.label,
	label: category.label,
	tone: category.label === unitemizedLabel ? "neutral" as const : "accent" as const,
	value: category.amount,
	valueLabel: formatCurrency(category.amount)
})));
</script>

<template>
	<section>
		<div class="flex flex-wrap gap-3 items-baseline justify-between">
			<h3 class="text-lg text-app-ink font-semibold dark:text-app-text-dark">
				Top funders by category
			</h3>
			<SourceDrawer
				v-if="props.breakdown.sources?.length"
				:sources="props.breakdown.sources"
				title="Top funders by category"
				button-label="Sources"
			/>
		</div>
		<p class="text-sm text-app-muted mt-1 dark:text-app-muted-dark">
			{{ props.breakdown.coverageNote }}
		</p>
		<div class="mt-4">
			<HorizontalBarChart :items="barItems" />
		</div>
	</section>
</template>
