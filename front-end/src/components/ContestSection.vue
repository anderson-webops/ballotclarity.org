<script setup lang="ts">
import type { Contest } from "~/types/civic";

defineProps<{
	contest: Contest;
	viewMode?: "deep" | "quick";
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
				<NuxtLink :to="`/contest/${contest.slug}`" class="text-sm text-app-accent font-semibold mt-4 rounded-lg inline-flex gap-2 items-center focus-ring">
					<span>Open canonical contest page</span>
					<span class="i-carbon-arrow-right" />
				</NuxtLink>
			</div>
			<div class="max-w-md">
				<ContestRoleGuide :contest="contest" />
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
				:view-mode="viewMode"
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
				:view-mode="viewMode"
			/>
		</div>
	</section>
</template>
