<script setup lang="ts">
import type { KeyDateTimelineEntry } from "~/utils/election-timeline";

defineProps<{ entries: KeyDateTimelineEntry[] }>();
const { formatDate, formatDateTime } = useFormatters();
</script>

<template>
	<ol class="election-timeline mt-6">
		<li v-for="item in entries" :key="`${item.label}:${item.date}`" class="election-timeline__item" :class="{ 'election-timeline__item--passed': item.status === 'passed', 'election-timeline__item--next': item.isNext }">
			<div class="election-timeline__when">
				<p class="text-base text-app-ink font-semibold dark:text-app-text-dark">
					{{ item.date.includes('T') ? formatDateTime(item.date) : formatDate(item.date) }}
				</p>
				<p class="election-timeline__status" :class="{ 'attention-relative': item.isNext }">
					{{ item.isNext ? `Next · ${item.relativeLabel}` : item.relativeLabel }}
				</p>
			</div>
			<div>
				<h3 class="text-base text-app-ink font-semibold dark:text-app-text-dark">
					{{ item.label }}
				</h3>
				<p v-if="item.note" class="text-sm text-app-muted leading-6 mt-1 dark:text-app-muted-dark">
					{{ item.note }}
				</p>
			</div>
		</li>
	</ol>
</template>
