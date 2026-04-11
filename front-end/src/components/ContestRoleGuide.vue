<script setup lang="ts">
import type { Contest } from "~/types/civic";

defineProps<{
	contest: Contest;
}>();
</script>

<template>
	<section class="px-5 py-5 border border-app-line/80 rounded-3xl bg-app-bg dark:border-app-line-dark dark:bg-app-bg-dark/70">
		<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
			What this contest decides
		</p>
		<h3 class="text-xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
			{{ contest.roleGuide.summary }}
		</h3>
		<p class="text-sm text-app-muted leading-7 mt-4 dark:text-app-muted-dark">
			{{ contest.roleGuide.whyItMatters }}
		</p>
		<ul class="text-sm text-app-muted leading-7 mt-4 space-y-2 dark:text-app-muted-dark">
			<li v-for="area in contest.roleGuide.decisionAreas" :key="area">
				{{ area }}
			</li>
		</ul>
	</section>
</template>
