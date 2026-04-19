<script setup lang="ts">
import type { ProvenanceSummary } from "~/types/civic";
import FactStatCard from "~/components/graphics/FactStatCard.vue";

const props = defineProps<{
	summary: ProvenanceSummary;
}>();
</script>

<template>
	<section class="p-5 border border-app-line/80 rounded-[1.6rem] bg-app-bg dark:border-app-line-dark dark:bg-app-bg-dark/70">
		<div class="flex flex-wrap gap-4 items-start justify-between">
			<div class="max-w-3xl">
				<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
					{{ props.summary.eyebrow || "Source provenance and freshness" }}
				</p>
				<h3 class="text-2xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
					{{ props.summary.title }}
				</h3>
				<p v-if="props.summary.note" class="text-sm text-app-muted leading-7 mt-3 dark:text-app-muted-dark">
					{{ props.summary.note }}
				</p>
			</div>

			<div class="flex flex-wrap gap-2 items-center justify-end">
				<VerificationBadge
					v-for="badge in props.summary.badges ?? []"
					:key="badge.label"
					:label="badge.label"
					:title="badge.title"
					:tone="badge.tone"
				/>
				<SourceDrawer
					v-if="props.summary.sources.length"
					:sources="props.summary.sources"
					:title="props.summary.title"
					button-label="Sources"
				/>
			</div>
		</div>

		<div class="mt-5 gap-3 grid md:grid-cols-2 xl:grid-cols-4">
			<FactStatCard
				v-for="item in props.summary.items"
				:key="item.label"
				:label="item.label"
				:note="item.detail"
				:value="item.value"
			/>
		</div>

		<p v-if="props.summary.uncertainty" class="text-xs text-app-muted leading-6 mt-4 dark:text-app-muted-dark">
			<strong class="text-app-ink dark:text-app-text-dark">Uncertainty:</strong>
			{{ props.summary.uncertainty }}
		</p>
	</section>
</template>
