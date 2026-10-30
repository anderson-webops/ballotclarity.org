<script setup lang="ts">
import type { KeyDateTimelineEntry } from "~/utils/election-timeline";
import { formatCivicDate, formatCivicDateTime } from "~/utils/display-time-zone";

const props = defineProps<{ entries: KeyDateTimelineEntry[]; compact?: boolean; electionDate?: string; timeZone?: string | null }>();
const { displayTimeZone } = useFormatters();
const formatDate = (value: string) => formatCivicDate(value, props.timeZone ?? displayTimeZone.value);
const formatDateTime = (value: string) => formatCivicDateTime(value, props.timeZone ?? displayTimeZone.value);

function compactNote(item: KeyDateTimelineEntry) {
	const note = item.note?.trim() ?? "";
	return /^Fulton County lists [A-Za-z]+ \d{1,2}, \d{4} as the last day of early voting\.$/u.test(note) ? "" : note;
}

function compactDate(item: KeyDateTimelineEntry) {
	return props.electionDate && item.label === "Election Day polls close" ? props.electionDate : item.date;
}
</script>

<template>
	<ol v-if="compact" class="mt-4 divide-app-line divide-y dark:divide-app-line-dark">
		<li v-for="item in entries" :key="`${item.label}:${item.date}`" class="text-sm leading-6 py-3">
			<p class="text-app-ink font-semibold dark:text-app-text-dark">
				{{ item.label }}
			</p>
			<time :datetime="compactDate(item)" class="text-app-muted dark:text-app-muted-dark">{{ formatDate(compactDate(item)) }}</time>
			<p v-if="compactNote(item)" class="text-app-muted mt-1 dark:text-app-muted-dark">
				{{ compactNote(item) }}
			</p>
			<p v-if="item.isNext" class="election-timeline__status" :class="{ 'attention-relative': item.isNext }">
				{{ item.label === 'Election Day polls close' ? 'Next' : `Next · ${item.relativeLabel}` }}
			</p>
		</li>
	</ol>
	<ol v-else class="election-timeline mt-6">
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
