<script setup lang="ts">
import type { Election } from "~/types/civic";

const props = defineProps<{
	election: Election;
	hasContestContent: boolean;
}>();

const { formatDate, formatDateTime } = useFormatters();
</script>

<template>
	<section id="guide-logistics" class="surface-panel scroll-mt-28">
		<h2 class="ballot-logistics__summary">
			Key dates and official links
		</h2>

		<ol class="ballot-logistics__dates">
			<li v-for="item in props.election.keyDates" :key="item.label" class="ballot-logistics__date">
				<p class="ballot-logistics__date-label">
					{{ item.label }}
				</p>
				<p class="ballot-logistics__date-value">
					<span>{{ item.date.includes("T") ? formatDateTime(item.date) : formatDate(item.date) }}</span>
				</p>
				<p v-if="item.note" class="ballot-logistics__date-note">
					{{ item.note }}
				</p>
			</li>
		</ol>

		<div class="mt-6 space-y-5">
			<OfficialResourceList
				:resources="props.election.officialResources"
				title="Official links"
			/>
			<div v-if="props.hasContestContent && props.election.changeLog.length">
				<p class="text-sm text-app-ink font-semibold dark:text-app-text-dark">
					Recent updates
				</p>
				<ul class="mt-3 space-y-3">
					<li v-for="entry in props.election.changeLog" :key="entry.id" class="text-sm text-app-muted leading-7 dark:text-app-muted-dark">
						<span class="text-app-ink font-semibold dark:text-app-text-dark">{{ formatDateTime(entry.date) }}</span>
						<span class="text-app-line mx-2 dark:text-app-line-dark">·</span>
						{{ entry.summary }}
					</li>
				</ul>
			</div>
		</div>
	</section>
</template>
