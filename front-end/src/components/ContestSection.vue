<script setup lang="ts">
import type { Contest } from "~/types/civic";

const props = withDefaults(defineProps<{
	contest: Contest;
	open?: boolean;
	viewMode?: "deep" | "quick";
}>(), {
	open: false,
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
	<ExpandableSection
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

				<div
					v-else
					class="contest-section__items"
				>
					<MeasureCard
						v-for="measure in contest.measures"
						:key="measure.slug"
						:measure="measure"
						:view-mode="viewMode"
					/>
				</div>

				<div class="space-y-4">
					<div>
						<p class="text-sm text-app-ink font-semibold dark:text-app-text-dark">
							What this office does
						</p>
						<div class="mt-1">
							<ContestRoleGuide :contest="contest" />
						</div>
					</div>
					<NuxtLink :to="`/contest/${contest.slug}`" class="btn-secondary">
						Full contest page
					</NuxtLink>
				</div>
			</div>
		</div>
	</ExpandableSection>
</template>
