<script setup lang="ts">
import type { Candidate } from "~/types/civic";
import { storeToRefs } from "pinia";
import { buildCompareLaunchSlugs, buildCompareRoute } from "~/stores/civic";

const props = defineProps<{
	candidate: Candidate;
	viewMode?: "deep" | "quick";
}>();

const civicStore = useCivicStore();
const { ballotPlan, compareList, isHydrated } = storeToRefs(civicStore);
const { formatCurrency } = useFormatters();

const effectiveBallotPlan = computed(() => isHydrated.value ? ballotPlan.value : {});
const effectiveCompareList = computed(() => isHydrated.value ? compareList.value : []);
const showPersistedCandidateState = computed(() => isHydrated.value);
const isCompared = computed(() => effectiveCompareList.value.includes(props.candidate.slug));
const compareLimitReached = computed(() => effectiveCompareList.value.length >= 3 && !isCompared.value);
const compareLaunchSlugs = computed(() => {
	if (compareLimitReached.value)
		return [];

	return buildCompareLaunchSlugs(effectiveCompareList.value, props.candidate.slug);
});
const compareHref = computed(() => buildCompareRoute(compareLaunchSlugs.value));
const canOpenCompare = computed(() => compareLaunchSlugs.value.length >= 2);
const canOpenHydratedCompare = computed(() => showPersistedCandidateState.value && canOpenCompare.value);
const isPlanned = computed(() => {
	const selection = effectiveBallotPlan.value[props.candidate.contestSlug];

	return selection?.type === "candidate" && selection.candidateSlug === props.candidate.slug;
});
const compareButtonIcon = computed(() => showPersistedCandidateState.value && isCompared.value ? "i-carbon-checkmark" : "i-carbon-compare");
const compareButtonLabel = computed(() => {
	if (!showPersistedCandidateState.value)
		return "Compare candidate";

	return isCompared.value ? "Remove from compare" : "Add to compare";
});
const planButtonIcon = computed(() => showPersistedCandidateState.value && isPlanned.value ? "i-carbon-checkmark" : "i-carbon-notebook");
const planButtonLabel = computed(() => showPersistedCandidateState.value && isPlanned.value ? "Saved to plan" : "Save to plan");
const coverageNote = computed(() => {
	if (props.candidate.comparison.questionnaireResponses.some(response => response.responseStatus !== "answered"))
		return "Some direct candidate responses are missing from the current published source set. This card falls back to verified ballot status, public records, and published campaign materials.";

	return props.candidate.whatWeDoNotKnow[0]?.text
		?? "This card is based on the current published source set and may not capture late campaign developments.";
});
const isQuickView = computed(() => (props.viewMode ?? "quick") === "quick");
const biographySummary = computed(() => props.candidate.biography[0]?.summary ?? props.candidate.summary);

function toggleCompare() {
	civicStore.toggleCompare(props.candidate.slug);
}

function saveToPlan() {
	civicStore.selectCandidateForPlan(props.candidate.contestSlug, props.candidate.slug);
}
</script>

<template>
	<article class="surface-panel flex flex-col h-full justify-between">
		<div class="space-y-4">
			<div class="flex flex-wrap gap-3 items-start justify-between">
				<div class="flex gap-3 min-w-0 items-start">
					<ProfileImageStack
						v-if="candidate.profileImages?.length"
						:images="candidate.profileImages"
						:name="candidate.name"
						size="sm"
					/>
					<div class="min-w-0">
						<div class="flex flex-wrap gap-2 items-center">
							<h3 class="text-[1.45rem] text-app-ink leading-tight font-serif dark:text-app-text-dark">
								{{ candidate.name }}
							</h3>
							<IncumbentBadge v-if="candidate.incumbent" />
						</div>
						<p class="text-sm text-app-muted mt-1.5 dark:text-app-muted-dark">
							{{ candidate.party }} · {{ candidate.officeSought }}
						</p>
					</div>
				</div>
				<VerificationBadge :label="candidate.comparison.ballotStatus.provenance.label" :title="candidate.comparison.ballotStatus.provenance.detail" :tone="candidate.comparison.ballotStatus.provenance.status === 'verified-official' ? 'accent' : candidate.comparison.ballotStatus.provenance.status === 'unclear' ? 'warning' : 'neutral'" />
			</div>

			<ExpandableSection
				:id="`candidate-card-${candidate.slug}`"
				compact
				nested
				title="More context"
				:description="candidate.ballotSummary"
				:open="!isQuickView"
			>
				<div class="space-y-4">
					<div>
						<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
							Candidate bio
						</p>
						<p class="text-sm text-app-muted leading-7 mt-2 dark:text-app-muted-dark">
							{{ biographySummary }}
						</p>
					</div>

					<div v-if="candidate.topIssues.length">
						<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
							Top issues
						</p>
						<div class="mt-3 flex flex-wrap gap-2">
							<IssueChip v-for="issue in candidate.topIssues" :key="issue.slug" :label="issue.label" />
						</div>
					</div>

					<div v-if="!isQuickView" class="space-y-4">
						<div v-if="candidate.keyActions.length">
							<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
								Selected actions
							</p>
							<ul class="mt-3 space-y-2">
								<li v-for="action in candidate.keyActions.slice(0, 2)" :key="action.id" class="text-sm text-app-muted leading-6 p-3 rounded-2xl bg-white/80 dark:text-app-muted-dark dark:bg-app-panel-dark/70">
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
							<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
								Funding snapshot
							</p>
							<p class="text-sm text-app-muted leading-6 mt-2 dark:text-app-muted-dark">
								{{ candidate.funding.summary }}
							</p>
							<p class="text-sm text-app-ink font-medium mt-2 dark:text-app-text-dark">
								{{ formatCurrency(candidate.funding.totalRaised) }} raised
							</p>
						</div>
					</div>

					<div class="p-3 rounded-2xl bg-white/80 dark:bg-app-panel-dark/70">
						<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
							Coverage note
						</p>
						<p class="text-sm text-app-muted leading-6 mt-2 dark:text-app-muted-dark">
							{{ coverageNote }}
						</p>
					</div>

					<SourceList :sources="candidate.sources" compact title="Attached sources" />
				</div>
			</ExpandableSection>
		</div>

		<div class="mt-5 flex flex-wrap gap-2">
			<NuxtLink :to="`/candidate/${candidate.slug}`" class="btn-primary">
				View details
			</NuxtLink>
			<SourceDrawer
				:sources="candidate.sources"
				:title="`${candidate.name} sources`"
				:button-label="`${candidate.sources.length} source${candidate.sources.length === 1 ? '' : 's'}`"
			/>
			<NuxtLink v-if="canOpenHydratedCompare" :to="compareHref" class="btn-secondary">
				Open compare
			</NuxtLink>
			<button type="button" class="btn-secondary" @click="saveToPlan">
				<span :class="planButtonIcon" />
				{{ planButtonLabel }}
			</button>
			<button type="button" class="btn-secondary" :disabled="showPersistedCandidateState ? compareLimitReached : false" @click="toggleCompare">
				<span :class="compareButtonIcon" />
				{{ compareButtonLabel }}
			</button>
		</div>
	</article>
</template>
