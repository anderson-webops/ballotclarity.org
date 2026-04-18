<script setup lang="ts">
import type { Measure } from "~/types/civic";

const props = defineProps<{
	measure: Measure;
}>();

function uniqueSources(items: Array<{ sources: Measure["sources"] }>) {
	return Array.from(new Map(items.flatMap(item => item.sources).map(source => [source.id, source])).values());
}

const currentSources = computed(() => uniqueSources(props.measure.currentPractice));
const changeSources = computed(() => uniqueSources(props.measure.proposedChanges));
const impactSources = computed(() => uniqueSources([
	...props.measure.potentialImpacts,
	...props.measure.argumentsAndConsiderations
]));
const fiscalSources = computed(() => uniqueSources(props.measure.fiscalSummary));
</script>

<template>
	<section class="p-5 border border-app-line/80 rounded-[1.6rem] bg-app-bg dark:border-app-line-dark dark:bg-app-bg-dark/70">
		<div class="flex flex-wrap gap-4 items-start justify-between">
			<div class="max-w-4xl">
				<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
					Measure impact diagram
				</p>
				<h3 class="text-2xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
					What changes if this passes, and what stays if it fails?
				</h3>
				<p class="text-sm text-app-muted leading-7 mt-3 dark:text-app-muted-dark">
					This diagram separates current rules from the YES and NO paths so you can compare practical effects without reading advocacy copy.
				</p>
			</div>
			<VerificationBadge label="Source-backed pathways" tone="accent" />
		</div>

		<div class="mt-5 gap-4 grid xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,1fr)]">
			<article class="px-4 py-4 border border-app-line/70 rounded-[1rem] bg-white/85 dark:border-app-line-dark dark:bg-app-panel-dark/80">
				<div class="flex flex-wrap gap-3 items-center justify-between">
					<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
						Today
					</p>
					<SourceDrawer :sources="currentSources" :title="`${measure.title} current practice`" button-label="Sources" />
				</div>
				<h4 class="text-xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
					Current practice
				</h4>
				<ul class="mt-4 space-y-3">
					<li v-for="item in measure.currentPractice.slice(0, 3)" :key="item.id" class="text-sm text-app-muted leading-6 px-3 py-3 rounded-[0.9rem] bg-app-bg dark:text-app-muted-dark dark:bg-app-bg-dark/80">
						{{ item.text }}
					</li>
				</ul>
			</article>

			<article class="px-4 py-4 border border-app-line/70 rounded-[1rem] bg-white/85 dark:border-app-line-dark dark:bg-app-panel-dark/80">
				<div class="flex flex-wrap gap-3 items-center justify-between">
					<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
						If YES
					</p>
					<SourceDrawer :sources="changeSources" :title="`${measure.title} YES pathway`" button-label="Sources" />
				</div>
				<h4 class="text-xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
					Change takes effect
				</h4>
				<p class="text-sm text-app-muted leading-7 mt-3 dark:text-app-muted-dark">
					{{ measure.yesMeaning }}
				</p>
				<ul class="mt-4 space-y-3">
					<li v-for="item in measure.yesHighlights" :key="item" class="text-sm text-app-muted leading-6 px-3 py-3 rounded-[0.9rem] bg-app-bg dark:text-app-muted-dark dark:bg-app-bg-dark/80">
						{{ item }}
					</li>
				</ul>
			</article>

			<article class="px-4 py-4 border border-app-line/70 rounded-[1rem] bg-white/85 dark:border-app-line-dark dark:bg-app-panel-dark/80">
				<div class="flex flex-wrap gap-3 items-center justify-between">
					<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
						If NO
					</p>
					<SourceDrawer :sources="currentSources" :title="`${measure.title} NO pathway`" button-label="Sources" />
				</div>
				<h4 class="text-xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
					Status quo remains
				</h4>
				<p class="text-sm text-app-muted leading-7 mt-3 dark:text-app-muted-dark">
					{{ measure.noMeaning }}
				</p>
				<ul class="mt-4 space-y-3">
					<li v-for="item in measure.noHighlights" :key="item" class="text-sm text-app-muted leading-6 px-3 py-3 rounded-[0.9rem] bg-app-bg dark:text-app-muted-dark dark:bg-app-bg-dark/80">
						{{ item }}
					</li>
				</ul>
			</article>
		</div>

		<div class="mt-4 gap-4 grid xl:grid-cols-2">
			<article class="px-4 py-4 border border-app-line/70 rounded-[1rem] bg-white/85 dark:border-app-line-dark dark:bg-app-panel-dark/80">
				<div class="flex flex-wrap gap-3 items-center justify-between">
					<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
						Implementation and timing
					</p>
					<SourceDrawer :sources="measure.implementationTimeline.flatMap(item => item.sources)" :title="`${measure.title} implementation timing`" button-label="Sources" />
				</div>
				<p class="text-sm text-app-muted leading-7 mt-3 dark:text-app-muted-dark">
					{{ measure.implementationOverview }}
				</p>
				<ul class="mt-4 space-y-3">
					<li v-for="item in measure.implementationTimeline.slice(0, 3)" :key="item.id" class="text-sm text-app-muted leading-6 px-3 py-3 rounded-[0.9rem] bg-app-bg dark:text-app-muted-dark dark:bg-app-bg-dark/80">
						<strong class="text-app-ink dark:text-app-text-dark">{{ item.timing }}:</strong>
						{{ item.summary }}
					</li>
				</ul>
			</article>

			<article class="px-4 py-4 border border-app-line/70 rounded-[1rem] bg-white/85 dark:border-app-line-dark dark:bg-app-panel-dark/80">
				<div class="flex flex-wrap gap-3 items-center justify-between">
					<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
						Fiscal and practical effects
					</p>
					<div class="flex flex-wrap gap-2 items-center">
						<SourceDrawer :sources="fiscalSources" :title="`${measure.title} fiscal sources`" button-label="Fiscal sources" />
						<SourceDrawer :sources="impactSources" :title="`${measure.title} impact sources`" button-label="Impact sources" />
					</div>
				</div>
				<p class="text-sm text-app-muted leading-7 mt-3 dark:text-app-muted-dark">
					{{ measure.fiscalContextNote }}
				</p>
				<ul class="mt-4 space-y-3">
					<li v-for="item in measure.fiscalSummary.slice(0, 3)" :key="item.id" class="text-sm text-app-muted leading-6 px-3 py-3 rounded-[0.9rem] bg-app-bg dark:text-app-muted-dark dark:bg-app-bg-dark/80">
						<strong class="text-app-ink dark:text-app-text-dark">{{ item.label }}:</strong>
						{{ item.value }} · {{ item.scope }}
					</li>
				</ul>
			</article>
		</div>

		<p class="text-xs text-app-muted leading-6 mt-4 dark:text-app-muted-dark">
			<strong class="text-app-ink dark:text-app-text-dark">Uncertainty:</strong>
			{{ measure.whatWeDoNotKnow[0]?.text ?? "Later budgets, legal interpretation, or agency rulemaking can still change the real-world effect after passage." }}
		</p>
	</section>
</template>
