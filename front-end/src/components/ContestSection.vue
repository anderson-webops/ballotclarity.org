<script setup lang="ts">
import type { Contest } from "~/types/civic";

const props = withDefaults(defineProps<{
	contest: Contest;
	electionSlug?: string;
	viewMode?: "deep" | "quick";
}>(), {
	viewMode: "quick"
});

const itemCountLabel = computed(() => props.contest.type === "candidate"
	? `${props.contest.candidates?.length ?? 0} candidate${props.contest.candidates?.length === 1 ? "" : "s"}`
	: `${props.contest.measures?.length ?? 0} measure${props.contest.measures?.length === 1 ? "" : "s"}`);
// Measure contests share a generic office label ("County Ballot Measure"); the measure title tells them apart.
const displayTitle = computed(() => props.contest.type === "measure" && props.contest.measures?.length === 1
	? props.contest.measures[0]?.title ?? props.contest.office
	: props.contest.office);
</script>

<template>
	<div v-if="contest.type === 'measure'" :id="contest.slug" class="scroll-mt-28">
		<MeasureCard v-for="measure in contest.measures" :key="measure.slug" :election-slug="electionSlug" :measure="measure" :view-mode="viewMode" />
	</div>
	<ExpandableSection
		v-else
		:id="contest.slug"
		:eyebrow="contest.jurisdiction"
		:title="displayTitle"
		:description="contest.description"
		class="pamphlet-surface"
	>
		<template #meta>
			<span class="text-sm text-app-muted whitespace-nowrap dark:text-app-muted-dark">
				{{ itemCountLabel }}
			</span>
		</template>

		<div class="contest-section__body">
			<div class="contest-section__grid">
				<div
					v-if="contest.type === 'candidate'"
					class="contest-section__items"
				>
					<CandidateCard
						v-for="candidate in contest.candidates"
						:key="candidate.slug"
						:candidate="candidate"
						:view-mode="viewMode"
					/>
				</div>

				<div>
					<p class="text-base text-app-ink leading-7 dark:text-app-text-dark">
						{{ contest.roleGuide.summary }}
					</p>
					<NuxtLink :to="`/contest/${contest.slug}`" class="btn-secondary mt-2">
						About this office
					</NuxtLink>
				</div>
			</div>
		</div>
	</ExpandableSection>
</template>
