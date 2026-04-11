<script setup lang="ts">
import type { Contest } from "~/types/civic";

defineProps<{
	contest: Contest;
}>();
</script>

<template>
	<section :id="contest.slug" class="pamphlet-surface surface-panel scroll-mt-28">
		<div class="mb-8 pb-6 border-b border-app-line flex flex-col gap-4 dark:border-app-line-dark lg:flex-row lg:items-end lg:justify-between">
			<div>
				<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
					{{ contest.jurisdiction }}
				</p>
				<h2 class="text-3xl text-app-ink font-serif mt-2 dark:text-app-text-dark">
					{{ contest.office }}
				</h2>
				<p class="text-sm text-app-muted leading-7 mt-3 max-w-3xl dark:text-app-muted-dark">
					{{ contest.description }}
				</p>
			</div>
		</div>

		<div
			v-if="contest.type === 'candidate'"
			class="gap-6 grid xl:grid-cols-2"
		>
			<CandidateCard
				v-for="candidate in contest.candidates"
				:key="candidate.slug"
				:candidate="candidate"
			/>
		</div>

		<div
			v-else
			class="gap-6 grid xl:grid-cols-2"
		>
			<MeasureCard
				v-for="measure in contest.measures"
				:key="measure.slug"
				:measure="measure"
			/>
		</div>
	</section>
</template>
