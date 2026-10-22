<script setup lang="ts">
import type { Measure } from "~/types/civic";

defineProps<{ measure: Measure; viewMode?: "deep" | "quick" }>();
</script>

<template>
	<NuxtLink :to="`/measure/${measure.slug}`" class="py-3 min-w-0 block focus-ring">
		<h3 class="text-[1.45rem] text-app-ink leading-tight font-serif dark:text-app-text-dark">
			{{ measure.title }}
		</h3>
		<p class="text-base text-app-muted leading-7 mt-2 dark:text-app-muted-dark">
			{{ measure.plainLanguageExplanation }}
		</p>
	</NuxtLink>
</template>
