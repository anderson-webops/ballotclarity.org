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
		:open="open"
		:eyebrow="contest.jurisdiction"
		:title="displayTitle"
		:description="contest.description"
		class="pamphlet-surface"
	>
		<template #meta>
			<span class="text-[11px] text-app-muted font-semibold px-2.5 py-1 rounded-full bg-white whitespace-nowrap dark:text-app-muted-dark dark:bg-app-panel-dark">
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
					<div class="p-4 rounded-xl bg-app-bg dark:bg-app-bg-dark/70">
						<p class="text-xs text-app-muted tracking-[0.06em] font-semibold uppercase dark:text-app-muted-dark">
							Why this contest matters
						</p>
						<div class="mt-3">
							<ContestRoleGuide :contest="contest" />
						</div>
					</div>
					<NuxtLink :to="`/contest/${contest.slug}`" class="text-sm text-app-accent font-semibold rounded-xl inline-flex gap-2 items-center focus-ring">
						<span>Open full contest page</span>
						<span class="i-carbon-arrow-right" />
					</NuxtLink>
				</div>
			</div>
		</div>
	</ExpandableSection>
</template>
