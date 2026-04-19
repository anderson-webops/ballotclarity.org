<script setup lang="ts">
import type { GraphicsTone, Source } from "~/types/civic";

interface HorizontalBarChartItem {
	id: string;
	label: string;
	value: number;
	valueLabel?: string;
	detail?: string;
	tone?: GraphicsTone;
	sources?: Source[];
	uncertainty?: string;
}

const props = withDefaults(defineProps<{
	items: HorizontalBarChartItem[];
	minWidthPercent?: number;
}>(), {
	minWidthPercent: 10
});

const maxValue = computed(() => {
	if (!props.items.length)
		return 1;

	return Math.max(...props.items.map(item => item.value), 1);
});

function barToneClass(tone: GraphicsTone | undefined) {
	if (tone === "warning")
		return "bg-[#c88920] dark:bg-[#f0bc53]";

	if (tone === "neutral")
		return "bg-slate-500 dark:bg-slate-400";

	return "bg-app-accent";
}

function widthPercent(value: number) {
	const scaled = Math.round((value / maxValue.value) * 100);

	return `${Math.max(props.minWidthPercent, scaled)}%`;
}
</script>

<template>
	<div v-if="props.items.length" class="space-y-4">
		<article
			v-for="item in props.items"
			:key="item.id"
			class="px-4 py-4 border border-app-line/70 rounded-[1rem] bg-white/85 dark:border-app-line-dark dark:bg-app-panel-dark/80"
		>
			<div class="flex flex-wrap gap-3 items-center justify-between">
				<p class="text-sm text-app-ink font-semibold dark:text-app-text-dark">
					{{ item.label }}
				</p>
				<div class="flex flex-wrap gap-2 items-center">
					<p class="text-sm text-app-ink font-semibold dark:text-app-text-dark">
						{{ item.valueLabel ?? item.value }}
					</p>
					<SourceDrawer
						v-if="item.sources?.length"
						:sources="item.sources"
						:title="item.label"
						button-label="Sources"
					/>
				</div>
			</div>
			<div class="mt-3 rounded-full bg-app-line/80 h-3 overflow-hidden dark:bg-app-line-dark">
				<div
					class="rounded-full h-full transition-[width]"
					:class="barToneClass(item.tone)"
					:style="{ width: widthPercent(item.value) }"
				/>
			</div>
			<p v-if="item.detail" class="text-sm text-app-muted leading-6 mt-3 dark:text-app-muted-dark">
				{{ item.detail }}
			</p>
			<p v-if="item.uncertainty" class="text-xs text-app-muted leading-6 mt-2 dark:text-app-muted-dark">
				<strong class="text-app-ink dark:text-app-text-dark">Uncertainty:</strong>
				{{ item.uncertainty }}
			</p>
		</article>
	</div>
</template>
