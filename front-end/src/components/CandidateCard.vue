<script setup lang="ts">
import type { Candidate } from "~/types/civic";
import { storeToRefs } from "pinia";

const props = defineProps<{
	candidate: Candidate;
	viewMode?: "deep" | "quick";
}>();

const civicStore = useCivicStore();
const { ballotPlan, compareList } = storeToRefs(civicStore);
const { formatCurrency } = useFormatters();

const isCompared = computed(() => compareList.value.includes(props.candidate.slug));
const compareLimitReached = computed(() => compareList.value.length >= 3 && !isCompared.value);
const isPlanned = computed(() => {
	const selection = ballotPlan.value[props.candidate.contestSlug];

	return selection?.type === "candidate" && selection.candidateSlug === props.candidate.slug;
});
const coverageNote = computed(() => {
	if (props.candidate.comparison.questionnaireResponses.some(response => response.responseStatus !== "answered"))
		return "Some direct candidate responses are missing in the current archive. This card falls back to verified ballot status, public records, and published campaign materials.";

	return props.candidate.whatWeDoNotKnow[0]?.text
		?? "This card is based on the current demo archive and may not capture late campaign developments.";
});
const isQuickView = computed(() => (props.viewMode ?? "quick") === "quick");

function toggleCompare() {
	civicStore.toggleCompare(props.candidate.slug);
}

function saveToPlan() {
	civicStore.selectCandidateForPlan(props.candidate.contestSlug, props.candidate.slug);
}
</script>

<template>
	<article class="surface-panel flex flex-col h-full justify-between">
		<div>
			<div class="flex flex-wrap gap-3 items-start justify-between">
				<div>
					<div class="flex flex-wrap gap-2 items-center">
						<h3 class="text-2xl text-app-ink font-serif dark:text-app-text-dark">
							{{ candidate.name }}
						</h3>
						<IncumbentBadge v-if="candidate.incumbent" />
					</div>
					<p class="text-sm text-app-muted mt-2 dark:text-app-muted-dark">
						{{ candidate.party }} · {{ candidate.officeSought }}
					</p>
				</div>
				<SourceDrawer
					:sources="candidate.sources"
					:title="`${candidate.name} sources`"
					:button-label="`${candidate.sources.length} source${candidate.sources.length === 1 ? '' : 's'}`"
				/>
			</div>

			<p class="text-sm text-app-muted leading-7 mt-5 dark:text-app-muted-dark">
				{{ candidate.ballotSummary }}
			</p>

			<div class="mt-5 flex flex-wrap gap-2">
				<IssueChip v-for="issue in candidate.topIssues" :key="issue.slug" :label="issue.label" />
			</div>

			<div class="mt-5 p-4 rounded-2xl bg-app-bg dark:bg-app-bg-dark/70">
				<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
					Coverage note
				</p>
				<p class="text-sm text-app-muted leading-6 mt-2 dark:text-app-muted-dark">
					{{ coverageNote }}
				</p>
			</div>

			<div v-if="!isQuickView" class="mt-6 space-y-4">
				<div>
					<p class="text-xs text-app-muted tracking-[0.22em] font-semibold uppercase dark:text-app-muted-dark">
						Key actions
					</p>
					<ul class="mt-3 space-y-3">
						<li v-for="action in candidate.keyActions.slice(0, 2)" :key="action.id" class="text-sm text-app-muted leading-6 p-4 rounded-2xl bg-app-bg dark:text-app-muted-dark dark:bg-app-bg-dark/70">
							<p class="text-app-ink font-semibold dark:text-app-text-dark">
								{{ action.title }}
							</p>
							<p class="mt-1">
								{{ action.summary }}
							</p>
						</li>
					</ul>
				</div>

				<div>
					<p class="text-xs text-app-muted tracking-[0.22em] font-semibold uppercase dark:text-app-muted-dark">
						Funding summary
					</p>
					<p class="text-sm text-app-muted leading-6 mt-3 dark:text-app-muted-dark">
						{{ candidate.funding.summary }}
					</p>
					<p class="text-sm text-app-ink font-medium mt-2 dark:text-app-text-dark">
						{{ formatCurrency(candidate.funding.totalRaised) }} raised
					</p>
				</div>
			</div>

			<div v-else class="mt-6 p-4 border border-app-line/80 rounded-2xl bg-white/70 dark:border-app-line-dark dark:bg-app-panel-dark/70">
				<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
					Quick view
				</p>
				<p class="text-sm text-app-muted leading-6 mt-2 dark:text-app-muted-dark">
					Start with the summary and issues. Open the detail page when you want the full action history, funding context, or evidence trail.
				</p>
			</div>
		</div>

		<div class="mt-8 flex flex-wrap gap-3">
			<NuxtLink :to="`/candidate/${candidate.slug}`" class="btn-primary">
				View details
			</NuxtLink>
			<button type="button" class="btn-secondary" @click="saveToPlan">
				<span :class="isPlanned ? 'i-carbon-checkmark' : 'i-carbon-notebook'" />
				{{ isPlanned ? 'Saved to plan' : 'Save to my plan' }}
			</button>
			<button type="button" class="btn-secondary" :disabled="compareLimitReached" @click="toggleCompare">
				<span :class="isCompared ? 'i-carbon-checkmark' : 'i-carbon-compare'" />
				{{ isCompared ? 'Added to compare' : 'Compare candidate' }}
			</button>
		</div>
	</article>
</template>
