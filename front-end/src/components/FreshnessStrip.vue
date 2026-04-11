<script setup lang="ts">
import type { ChangeLogEntry, FreshnessMeta } from "~/types/civic";

const props = defineProps<{
	changeLog?: ChangeLogEntry[];
	freshness: FreshnessMeta;
	title?: string;
}>();

const { formatDateTime } = useFormatters();

const statusToneClass = computed(() => {
	if (props.freshness.status === "up-to-date")
		return "border-app-accent/20 bg-app-accent/10 text-app-accent dark:border-app-accent/30 dark:bg-app-accent/15 dark:text-[#9ed4e3]";

	if (props.freshness.status === "updating")
		return "border-[#7f9077]/25 bg-[#eef4ea] text-[#42503c] dark:border-[#7f9077]/35 dark:bg-[#1c2619] dark:text-[#c9d5c4]";

	if (props.freshness.status === "incomplete")
		return "border-[#caa56f]/25 bg-[#fbf3e2] text-[#7d5819] dark:border-[#caa56f]/35 dark:bg-[#302412] dark:text-[#efcf96]";

	return "border-[#b56576]/25 bg-[#f9eaed] text-[#84384a] dark:border-[#b56576]/35 dark:bg-[#2f161e] dark:text-[#efb8c1]";
});
</script>

<template>
	<section class="surface-panel">
		<div class="flex flex-wrap gap-4 items-start justify-between">
			<div>
				<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
					{{ title ?? "Freshness and review status" }}
				</p>
				<p class="text-sm text-app-muted leading-7 mt-3 max-w-3xl dark:text-app-muted-dark">
					{{ freshness.statusNote }}
				</p>
			</div>
			<span class="text-xs font-semibold px-3 py-1.5 border rounded-full inline-flex items-center" :class="statusToneClass">
				{{ freshness.statusLabel }}
			</span>
		</div>

		<div class="mt-6 gap-4 grid md:grid-cols-3">
			<div class="p-4 rounded-3xl bg-app-bg dark:bg-app-bg-dark/70">
				<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
					As of
				</p>
				<p class="text-sm text-app-ink font-semibold mt-3 dark:text-app-text-dark">
					{{ formatDateTime(freshness.contentLastVerifiedAt) }}
				</p>
			</div>
			<div class="p-4 rounded-3xl bg-app-bg dark:bg-app-bg-dark/70">
				<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
					Data updated
				</p>
				<p class="text-sm text-app-ink font-semibold mt-3 dark:text-app-text-dark">
					{{ freshness.dataLastUpdatedAt ? formatDateTime(freshness.dataLastUpdatedAt) : "Same as page review" }}
				</p>
			</div>
			<div class="p-4 rounded-3xl bg-app-bg dark:bg-app-bg-dark/70">
				<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
					Next review
				</p>
				<p class="text-sm text-app-ink font-semibold mt-3 dark:text-app-text-dark">
					{{ formatDateTime(freshness.nextReviewAt) }}
				</p>
			</div>
		</div>

		<details v-if="changeLog?.length" class="group mt-6 px-5 py-4 border border-app-line rounded-3xl bg-white/70 dark:border-app-line-dark dark:bg-app-panel-dark/70">
			<summary class="text-sm text-app-ink font-semibold list-none flex gap-4 cursor-pointer items-center justify-between dark:text-app-text-dark focus-ring">
				<span>Show change log</span>
				<span class="i-carbon-add group-open:i-carbon-subtract text-base text-app-muted dark:text-app-muted-dark" />
			</summary>
			<ul class="mt-4 space-y-3">
				<li v-for="entry in changeLog" :key="entry.id" class="px-4 py-4 rounded-2xl bg-app-bg dark:bg-app-bg-dark/70">
					<p class="text-sm text-app-ink font-semibold dark:text-app-text-dark">
						{{ formatDateTime(entry.date) }}
					</p>
					<p class="text-sm text-app-muted leading-7 mt-2 dark:text-app-muted-dark">
						{{ entry.summary }}
					</p>
				</li>
			</ul>
		</details>
	</section>
</template>
