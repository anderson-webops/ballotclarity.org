<script setup lang="ts">
import type { FinanceCategoryBreakdown } from "~/types/civic";
import HorizontalBarChart from "~/components/graphics/HorizontalBarChart.vue";

const props = defineProps<{
	breakdown: FinanceCategoryBreakdown;
}>();

const { formatCurrency } = useFormatters();

const barItems = computed(() => props.breakdown.categories.map(category => ({
	detail: category.note ?? `Share of ${props.breakdown.cycleLabel.toLowerCase()} fundraising reflected in the current linked filings.`,
	id: category.label,
	label: category.label,
	tone: props.breakdown.confidence === "low" ? "warning" as const : "accent" as const,
	value: category.amount,
	valueLabel: formatCurrency(category.amount)
})));
</script>

<template>
	<section class="p-5 border border-app-line/80 rounded-[1.6rem] bg-app-bg dark:border-app-line-dark dark:bg-app-bg-dark/70">
		<div class="flex flex-wrap gap-4 items-start justify-between">
			<div class="max-w-4xl">
				<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
					Finance breakdown
				</p>
				<h3 class="text-2xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
					Where the current filing window’s money is concentrated
				</h3>
				<p class="text-sm text-app-muted leading-7 mt-3 dark:text-app-muted-dark">
					{{ props.breakdown.disclaimer }}
				</p>
			</div>
			<div class="flex flex-wrap gap-2 items-center">
				<VerificationBadge :label="`${props.breakdown.confidence} confidence`" :tone="props.breakdown.confidence === 'low' ? 'warning' : props.breakdown.confidence === 'medium' ? 'neutral' : 'accent'" />
				<VerificationBadge :label="props.breakdown.linkageType" :tone="props.breakdown.linkageType === 'direct' ? 'accent' : props.breakdown.linkageType === 'crosswalked' ? 'neutral' : 'warning'" />
				<SourceDrawer
					v-if="props.breakdown.sources?.length"
					:sources="props.breakdown.sources"
					title="Finance breakdown"
					button-label="Sources"
				/>
			</div>
		</div>

		<div class="mt-5 gap-4 grid lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
			<div class="px-4 py-4 border border-app-line/70 rounded-[1rem] bg-white/85 dark:border-app-line-dark dark:bg-app-panel-dark/80">
				<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
					Cycle and source context
				</p>
				<p class="text-3xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
					{{ formatCurrency(props.breakdown.totalAmount) }}
				</p>
				<p class="text-sm text-app-muted leading-7 mt-3 dark:text-app-muted-dark">
					{{ props.breakdown.cycleLabel }} · {{ props.breakdown.sourceLabel }}
				</p>
				<p class="text-xs text-app-muted leading-6 mt-3 dark:text-app-muted-dark">
					<strong class="text-app-ink dark:text-app-text-dark">Coverage:</strong>
					{{ props.breakdown.coverageNote }}
				</p>
			</div>

			<HorizontalBarChart :items="barItems" />
		</div>
	</section>
</template>
