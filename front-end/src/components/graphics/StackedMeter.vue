<script setup lang="ts">
import type { GraphicsTone } from "~/types/civic";

interface StackedMeterSegment {
	id: string;
	label: string;
	value: number;
	tone?: GraphicsTone;
}

const props = defineProps<{
	segments: StackedMeterSegment[];
}>();

const total = computed(() => props.segments.reduce((sum, segment) => sum + segment.value, 0));

function segmentToneClass(tone: GraphicsTone | undefined) {
	if (tone === "warning")
		return "bg-[#c88920] dark:bg-[#f0bc53]";

	if (tone === "neutral")
		return "bg-slate-500 dark:bg-slate-400";

	return "bg-app-accent";
}

function widthPercent(value: number) {
	if (!total.value)
		return "0%";

	return `${(value / total.value) * 100}%`;
}
</script>

<template>
	<div v-if="props.segments.length" class="space-y-3">
		<div class="rounded-full bg-app-line/80 flex h-3 overflow-hidden dark:bg-app-line-dark">
			<div
				v-for="segment in props.segments"
				:key="segment.id"
				class="h-full min-w-[0.9rem]"
				:class="segmentToneClass(segment.tone)"
				:style="{ width: widthPercent(segment.value) }"
			/>
		</div>
		<div class="flex flex-wrap gap-x-4 gap-y-2">
			<div
				v-for="segment in props.segments"
				:key="`${segment.id}-legend`"
				class="flex gap-2 items-center"
			>
				<span class="rounded-full shrink-0 h-2.5 w-2.5" :class="segmentToneClass(segment.tone)" />
				<span class="text-xs text-app-muted tracking-[0.08em] font-semibold uppercase dark:text-app-muted-dark">
					{{ segment.label }} · {{ segment.value }}
				</span>
			</div>
		</div>
	</div>
</template>
