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
const coverageNote = computed(() => props.measure.whatWeDoNotKnow[0]?.text
	?? "Implementation details can change after passage because later budgets, legal interpretation, and agency rules still matter.");
const isQuickView = computed(() => (props.viewMode ?? "quick") === "quick");
const officialSourceCount = computed(() => props.measure.sources.filter(source => source.authority === "official-government").length);

function saveMeasure(decision: "no" | "review" | "yes") {
	civicStore.selectMeasureForPlan(props.measure.contestSlug, props.measure.slug, decision);
}
</script>

<template>
	<article class="surface-panel h-full">
		<div class="flex flex-wrap gap-3 items-start justify-between">
			<div class="min-w-0">
				<h3 class="text-[1.45rem] text-app-ink leading-tight font-serif dark:text-app-text-dark">
					{{ measure.title }}
				</h3>
				<p class="text-sm text-app-muted mt-1.5 dark:text-app-muted-dark">
					{{ measure.location }}
				</p>
			</div>
			<VerificationBadge :label="officialSourceCount ? 'Official sources linked' : 'Source set attached'" :tone="officialSourceCount ? 'accent' : 'neutral'" />
		</div>

		<p class="text-sm text-app-muted leading-7 mt-4 line-clamp-2 dark:text-app-muted-dark">
			{{ measure.plainLanguageExplanation }}
		</p>

		<ExpandableSection
			:id="`measure-card-${measure.slug}`"
			compact
			nested
			title="Decision context"
			:description="measure.ballotSummary"
			:open="!isQuickView"
		>
			<div class="space-y-4">
				<dl class="gap-3 grid sm:grid-cols-2">
					<div class="p-3 rounded-2xl bg-white/80 dark:bg-app-panel-dark/70">
						<dt class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
							What YES means
						</dt>
						<dd class="text-sm text-app-muted leading-6 mt-2 dark:text-app-muted-dark">
							{{ measure.yesMeaning }}
						</dd>
					</div>
					<div class="p-3 rounded-2xl bg-white/80 dark:bg-app-panel-dark/70">
						<dt class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
							What NO means
						</dt>
						<dd class="text-sm text-app-muted leading-6 mt-2 dark:text-app-muted-dark">
							{{ measure.noMeaning }}
						</dd>
					</div>
				</dl>

				<p class="text-sm text-app-muted leading-6 dark:text-app-muted-dark">
					{{ isQuickView ? coverageNote : measure.fiscalContextNote }}
				</p>
			</div>
		</ExpandableSection>

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

		<div class="mt-5 flex flex-wrap gap-2">
			<NuxtLink :to="`/measure/${measure.slug}`" class="btn-primary">
				View details
			</NuxtLink>
			<MeasureContextDrawer :measure="measure" />
			<SourceDrawer
				:sources="measure.sources"
				:title="`${measure.title} sources`"
				:button-label="`${measure.sources.length} source${measure.sources.length === 1 ? '' : 's'}`"
			/>
		</div>
	</article>
</template>
