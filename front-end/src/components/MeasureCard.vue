<script setup lang="ts">
import type { Measure } from "~/types/civic";
import { measureCardSummary, measureDecisionEffectLabel, measureDetailPath } from "~/utils/measure-content";

defineProps<{ electionSlug?: string; measure: Measure; viewMode?: "deep" | "quick" }>();
</script>

<template>
	<NuxtLink :to="measureDetailPath(measure, electionSlug)" class="py-3 min-w-0 block focus-ring">
		<h3 class="text-[1.45rem] text-app-ink leading-tight font-serif dark:text-app-text-dark">
			{{ measure.title }}
		</h3>
		<p v-if="measure.decisionEffect === 'advisory'" class="text-sm text-app-muted mt-2 dark:text-app-muted-dark">
			{{ measureDecisionEffectLabel(measure) }}
		</p>
		<p v-if="measureCardSummary(measure)" class="text-base text-app-muted leading-7 mt-2 dark:text-app-muted-dark">
			{{ measureCardSummary(measure) }}
		</p>
	</NuxtLink>
</template>
