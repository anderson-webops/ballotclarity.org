<script setup lang="ts">
import type { Measure } from "~/types/civic";
import { storeToRefs } from "pinia";

const props = defineProps<{
	measure: Measure;
	viewMode?: "deep" | "quick";
}>();

const civicStore = useCivicStore();
const { ballotPlan, isHydrated } = storeToRefs(civicStore);
const effectiveBallotPlan = computed(() => isHydrated.value ? ballotPlan.value : {});

const currentSelection = computed(() => {
	const selection = effectiveBallotPlan.value[props.measure.contestSlug];

	return selection?.type === "measure" && selection.measureSlug === props.measure.slug
		? selection.decision
		: null;
});
const decisionOptions = [
	{ label: "Yes", value: "yes" },
	{ label: "Undecided", value: "review" },
	{ label: "No", value: "no" }
] as const;

function saveMeasure(decision: "no" | "review" | "yes") {
	civicStore.selectMeasureForPlan(props.measure.contestSlug, props.measure.slug, decision);
}
</script>

<template>
	<article class="min-w-0">
		<h3 class="text-[1.45rem] text-app-ink leading-tight font-serif dark:text-app-text-dark">
			<NuxtLink :to="`/measure/${measure.slug}`" class="hover:text-app-accent focus-ring">
				{{ measure.title }}
			</NuxtLink>
		</h3>

		<p class="text-base text-app-ink leading-7 mt-2 dark:text-app-text-dark">
			{{ measure.plainLanguageExplanation }}
		</p>

		<dl class="mt-4 gap-x-6 gap-y-3 grid sm:grid-cols-2">
			<div class="content-block">
				<dt class="text-sm text-app-ink font-semibold dark:text-app-text-dark">
					A YES vote means
				</dt>
				<dd class="text-sm text-app-ink leading-6 mt-1 dark:text-app-text-dark">
					{{ measure.yesMeaning }}
				</dd>
			</div>
			<div class="content-block">
				<dt class="text-sm text-app-ink font-semibold dark:text-app-text-dark">
					A NO vote means
				</dt>
				<dd class="text-sm text-app-ink leading-6 mt-1 dark:text-app-text-dark">
					{{ measure.noMeaning }}
				</dd>
			</div>
		</dl>

		<div class="mt-5 flex flex-wrap gap-x-6 gap-y-3 items-center">
			<div class="measure-decision" role="group" :aria-label="`Save your choice on ${measure.title} to your ballot plan`">
				<button
					v-for="option in decisionOptions"
					:key="option.value"
					type="button"
					class="measure-decision__option focus-ring"
					:aria-pressed="currentSelection === option.value"
					@click="saveMeasure(option.value)"
				>
					{{ option.label }}
				</button>
			</div>
			<NuxtLink :to="`/measure/${measure.slug}`" class="btn-secondary">
				Full details
			</NuxtLink>
			<SourceDrawer :sources="measure.sources" :title="`${measure.title} sources`" button-label="Sources" />
		</div>
	</article>
</template>
