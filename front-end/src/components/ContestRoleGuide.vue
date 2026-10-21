<script setup lang="ts">
import type { Contest } from "~/types/civic";

defineProps<{
	contest: Contest;
}>();
</script>

<template>
	<section>
		<p class="text-base text-app-ink leading-7 dark:text-app-text-dark">
			{{ contest.roleGuide.summary }}
		</p>
		<p class="text-sm text-app-muted leading-6 mt-2 dark:text-app-muted-dark">
			{{ contest.roleGuide.whyItMatters }}
		</p>
		<ul v-if="contest.roleGuide.decisionAreas.length" class="text-sm text-app-ink leading-6 mt-2 pl-5 list-disc space-y-1 dark:text-app-text-dark">
			<li v-for="area in contest.roleGuide.decisionAreas" :key="area">
				{{ area }}
			</li>
		</ul>
	</section>
</template>
