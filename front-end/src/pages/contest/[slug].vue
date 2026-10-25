<script setup lang="ts">
import ComparisonMatrix from "~/components/graphics/ComparisonMatrix.vue";
import { buildContestComparisonMatrix } from "~/utils/graphics-schema";

const { openLayerLink: fallbackOpenLayerLink, overviewLink: fallbackOverviewLink } = useRouteLayerNavigation();
const contestSlug = useRouteStringParam("slug");
const { data, error, pending } = await useContest(contestSlug);
const openLayerLink = computed(() => data.value
	? { label: "Ballot guide", to: `/ballot/${data.value.election.slug}` }
	: fallbackOpenLayerLink.value);
const overviewLink = computed(() => data.value
	? { label: "Election overview", to: `/elections/${data.value.election.slug}` }
	: fallbackOverviewLink.value);
const displayTitle = computed(() => data.value?.contest.type === "measure" ? data.value.contest.title : data.value?.contest.office);
// A side-by-side matrix only helps when there is more than one option to compare.
const contestComparisonMatrix = computed(() => {
	const matrix = data.value ? buildContestComparisonMatrix(data.value.contest) : null;
	return matrix && matrix.columns.length > 1 ? matrix : null;
});

const compareHref = computed(() => {
	if (!data.value || data.value.contest.type !== "candidate")
		return null;

	return {
		path: "/compare",
		query: {
			slugs: (data.value.contest.candidates ?? []).map(candidate => candidate.slug).join(",")
		}
	};
});

const districtHref = computed(() => {
	if (!data.value || data.value.contest.type !== "candidate")
		return null;

	return `/districts/${data.value.contest.slug}`;
});

const breadcrumbs = computed(() => {
	if (!data.value) {
		return [
			{ label: "Home", to: "/" },
			{ label: "Contest" }
		];
	}

	return [
		{ label: "Home", to: "/" },
		overviewLink.value,
		{ label: displayTitle.value ?? "Ballot item" }
	];
});

usePageSeo({
	description: data.value?.contest.description ?? "Canonical contest page with contest context, source-backed records, and links back to the election overview.",
	path: `/contest/${contestSlug.value}`,
	title: displayTitle.value ?? "Ballot item"
});
</script>

<template>
	<section class="app-shell section-gap space-y-8">
		<div v-if="pending" class="space-y-6">
			<div class="rounded-lg bg-app-bg h-72 animate-pulse dark:bg-app-bg-dark" />
			<div class="gap-6 grid xl:grid-cols-2">
				<div v-for="index in 3" :key="index" class="rounded-lg bg-app-bg h-64 animate-pulse dark:bg-app-bg-dark" />
			</div>
		</div>

		<GuideUnavailableState
			v-else-if="error || !data"
			message=""
			:primary-label="openLayerLink.label"
			:primary-to="openLayerLink.to"
			title="Race information unavailable"
		/>

		<div v-else class="space-y-8">
			<AppBreadcrumbs :items="breadcrumbs" />

			<header class="gap-10 grid xl:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.8fr)]">
				<div>
					<p class="text-xs text-app-muted tracking-[0.06em] font-semibold uppercase dark:text-app-muted-dark">
						{{ data.election.name }}
					</p>
					<h1 class="text-5xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
						{{ displayTitle }}
					</h1>
					<p class="text-lg text-app-ink leading-8 mt-4 dark:text-app-text-dark">
						{{ data.contest.description }}
					</p>
					<div class="mt-5 flex flex-wrap gap-x-6 gap-y-3 items-center">
						<NuxtLink v-if="compareHref" :to="compareHref" class="btn-primary">
							Compare candidates
						</NuxtLink>
						<NuxtLink :to="openLayerLink.to" class="btn-secondary">
							{{ openLayerLink.label }}
						</NuxtLink>
						<NuxtLink v-if="districtHref" :to="districtHref" class="btn-secondary">
							District page
						</NuxtLink>
						<UpdatedAt :value="data.updatedAt" />
					</div>
				</div>

				<section>
					<h2 class="text-lg text-app-ink font-semibold dark:text-app-text-dark">
						What this office does
					</h2>
					<div class="mt-2">
						<ContestRoleGuide :contest="data.contest" />
					</div>
				</section>
			</header>

			<section v-if="data.contest.type === 'candidate'" class="gap-6 grid xl:grid-cols-2">
				<CandidateCard
					v-for="candidate in data.contest.candidates"
					:key="candidate.slug"
					:candidate="candidate"
				/>
			</section>

			<section v-else class="gap-6 grid xl:grid-cols-2">
				<MeasureCard
					v-for="measure in data.contest.measures"
					:key="measure.slug"
					:measure="measure"
				/>
			</section>

			<ComparisonMatrix v-if="contestComparisonMatrix" :matrix="contestComparisonMatrix" />

			<section v-if="data.relatedContests.length">
				<h2 class="text-2xl text-app-ink font-serif dark:text-app-text-dark">
					Other contests on this ballot
				</h2>
				<ul class="mt-3">
					<li v-for="contest in data.relatedContests" :key="contest.slug" class="py-3 border-b border-app-line flex flex-wrap gap-x-3 gap-y-1 items-baseline justify-between dark:border-app-line-dark last:border-b-0">
						<NuxtLink :to="contest.href" class="text-base text-app-accent font-semibold underline decoration-app-accent/35 underline-offset-4 hover:decoration-current focus-ring">
							{{ contest.office }}
						</NuxtLink>
						<span class="text-sm text-app-muted dark:text-app-muted-dark">{{ contest.jurisdiction }} · {{ contest.type === "candidate" ? "Candidate race" : "Ballot measure" }}</span>
					</li>
				</ul>
			</section>

			<section class="contest-sources">
				<h2 class="text-base text-app-ink font-semibold dark:text-app-text-dark">
					Sources ({{ data.sources.length }})
				</h2>
				<div class="mt-4">
					<SourceList :sources="data.sources" />
				</div>
			</section>
		</div>
	</section>
</template>
