<script setup lang="ts">
import type { Measure } from "~/types/civic";
import { storeToRefs } from "pinia";

const props = defineProps<{
	measure: Measure;
	viewMode?: "deep" | "quick";
}>();

const civicStore = useCivicStore();
const { ballotPlan } = storeToRefs(civicStore);

const currentSelection = computed(() => {
	const selection = ballotPlan.value[props.measure.contestSlug];

	return selection?.type === "measure" && selection.measureSlug === props.measure.slug
		? selection.decision
		: null;
});
const coverageNote = computed(() => props.measure.whatWeDoNotKnow[0]?.text
	?? "Implementation details can change after passage because later budgets, legal interpretation, and agency rules still matter.");
const isQuickView = computed(() => (props.viewMode ?? "quick") === "quick");

function saveMeasure(decision: "no" | "review" | "yes") {
	civicStore.selectMeasureForPlan(props.measure.contestSlug, props.measure.slug, decision);
}
</script>

<template>
	<article class="surface-panel h-full">
		<div class="flex flex-wrap gap-3 items-start justify-between">
			<div>
				<h3 class="text-2xl text-app-ink font-serif dark:text-app-text-dark">
					{{ measure.title }}
				</h3>
				<p class="text-sm text-app-muted mt-2 dark:text-app-muted-dark">
					{{ measure.location }}
				</p>
			</div>
			<SourceDrawer
				:sources="measure.sources"
				:title="`${measure.title} sources`"
				:button-label="`${measure.sources.length} source${measure.sources.length === 1 ? '' : 's'}`"
			/>
		</div>

		<p class="text-sm text-app-muted leading-7 mt-5 dark:text-app-muted-dark">
			{{ measure.ballotSummary }}
		</p>

		<div class="mt-5 p-4 rounded-2xl bg-app-bg dark:bg-app-bg-dark/70">
			<p class="text-xs text-app-muted tracking-[0.22em] font-semibold uppercase dark:text-app-muted-dark">
				Coverage note
			</p>
			<p class="text-sm text-app-muted leading-6 mt-2 dark:text-app-muted-dark">
				{{ coverageNote }}
			</p>
		</div>

		<dl class="mt-6 gap-4 grid sm:grid-cols-2">
			<div class="p-4 rounded-2xl bg-app-bg dark:bg-app-bg-dark/70">
				<dt class="text-xs text-app-muted tracking-[0.22em] font-semibold uppercase dark:text-app-muted-dark">
					What YES means
				</dt>
				<dd class="text-sm text-app-muted leading-6 mt-2 dark:text-app-muted-dark">
					{{ measure.yesMeaning }}
				</dd>
			</div>
			<div class="p-4 rounded-2xl bg-app-bg dark:bg-app-bg-dark/70">
				<dt class="text-xs text-app-muted tracking-[0.22em] font-semibold uppercase dark:text-app-muted-dark">
					What NO means
				</dt>
				<dd class="text-sm text-app-muted leading-6 mt-2 dark:text-app-muted-dark">
					{{ measure.noMeaning }}
				</dd>
			</div>
		</dl>

		<p v-if="!isQuickView" class="text-sm text-app-muted leading-6 mt-5 dark:text-app-muted-dark">
			{{ measure.fiscalContextNote }}
		</p>
		<p v-else class="text-sm text-app-muted leading-6 mt-5 dark:text-app-muted-dark">
			Quick view keeps the decision effect visible first. Open the detail page for fiscal context, sourced arguments, and implementation limits.
		</p>

		<div class="mt-6">
			<p class="text-xs text-app-muted tracking-[0.22em] font-semibold uppercase dark:text-app-muted-dark">
				Save your current decision
			</p>
			<div class="mt-3 flex flex-wrap gap-2">
				<button
					type="button"
					class="text-xs font-semibold px-3 py-2 border rounded-full transition focus-ring"
					:class="currentSelection === 'yes'
						? 'border-app-accent bg-app-accent text-white'
						: 'border-app-line bg-white text-app-muted hover:border-app-accent hover:text-app-accent dark:border-app-line-dark dark:bg-app-panel-dark dark:text-app-muted-dark'"
					@click="saveMeasure('yes')"
				>
					Mark YES
				</button>
				<button
					type="button"
					class="text-xs font-semibold px-3 py-2 border rounded-full transition focus-ring"
					:class="currentSelection === 'review'
						? 'border-app-accent bg-app-accent text-white'
						: 'border-app-line bg-white text-app-muted hover:border-app-accent hover:text-app-accent dark:border-app-line-dark dark:bg-app-panel-dark dark:text-app-muted-dark'"
					@click="saveMeasure('review')"
				>
					Review later
				</button>
				<button
					type="button"
					class="text-xs font-semibold px-3 py-2 border rounded-full transition focus-ring"
					:class="currentSelection === 'no'
						? 'border-app-accent bg-app-accent text-white'
						: 'border-app-line bg-white text-app-muted hover:border-app-accent hover:text-app-accent dark:border-app-line-dark dark:bg-app-panel-dark dark:text-app-muted-dark'"
					@click="saveMeasure('no')"
				>
					Mark NO
				</button>
			</div>
		</div>

		<div class="mt-8">
			<NuxtLink :to="`/measure/${measure.slug}`" class="btn-primary">
				View details
			</NuxtLink>
		</div>
	</article>
</template>
