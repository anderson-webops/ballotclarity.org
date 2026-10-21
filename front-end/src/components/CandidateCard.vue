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
const compareButtonLabel = computed(() => {
	if (!showPersistedCandidateState.value)
		return "Compare";

	return isCompared.value ? "Remove from compare" : "Compare";
});
const planButtonLabel = computed(() => showPersistedCandidateState.value && isPlanned.value ? "Saved to plan" : "Save to plan");

function toggleCompare() {
	civicStore.toggleCompare(props.candidate.slug);
}

function saveToPlan() {
	civicStore.selectCandidateForPlan(props.candidate.contestSlug, props.candidate.slug);
}
</script>

<template>
	<article class="flex flex-col min-w-0">
		<div class="flex gap-3 items-start">
			<ProfileImageStack
				v-if="candidate.profileImages?.length"
				:images="candidate.profileImages"
				:name="candidate.name"
				size="sm"
			/>
			<div class="min-w-0">
				<div class="flex flex-wrap gap-x-3 gap-y-1 items-baseline">
					<h3 class="text-[1.45rem] text-app-ink leading-tight font-serif dark:text-app-text-dark">
						<NuxtLink :to="`/candidate/${candidate.slug}`" class="hover:text-app-accent focus-ring">
							{{ candidate.name }}
						</NuxtLink>
					</h3>
					<IncumbentBadge v-if="candidate.incumbent" />
				</div>
				<p class="text-sm text-app-muted mt-1 dark:text-app-muted-dark">
					{{ candidate.party }}
				</p>
			</div>
		</div>

		<p class="text-base text-app-ink leading-7 mt-3 dark:text-app-text-dark">
			{{ candidate.ballotSummary }}
		</p>

		<p v-if="candidate.topIssues.length" class="text-sm text-app-muted mt-2 dark:text-app-muted-dark">
			{{ candidate.topIssues.map(issue => issue.label).join(" · ") }}
		</p>

		<div class="mt-4 flex flex-wrap gap-x-5 gap-y-2 items-center">
			<button type="button" class="btn-secondary" :aria-pressed="showPersistedCandidateState ? isPlanned : undefined" @click="saveToPlan">
				{{ planButtonLabel }}
			</button>
			<button type="button" class="btn-secondary" :disabled="showPersistedCandidateState ? compareLimitReached : false" @click="toggleCompare">
				{{ compareButtonLabel }}
			</button>
			<NuxtLink v-if="canOpenHydratedCompare" :to="compareHref" class="btn-secondary">
				Open compare
			</NuxtLink>
			<SourceDrawer :sources="candidate.sources" :title="`${candidate.name} sources`" button-label="Sources" />
		</div>
	</article>
</template>
