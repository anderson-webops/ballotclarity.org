<script setup lang="ts">
const route = useRoute();
const { openLayerLink, overviewLink } = useRouteLayerNavigation();
const contestSlug = computed(() => String(route.params.slug));
const { data, error, pending } = await useContest(contestSlug);

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
		{ label: data.value.contest.office }
	];
});

usePageSeo({
	description: data.value?.contest.description ?? "Canonical contest page with contest context, source-backed records, and links back to the election overview.",
	path: `/contest/${contestSlug.value}`,
	title: data.value?.contest.office ?? "Contest"
});
</script>

<template>
	<section class="app-shell section-gap space-y-8">
		<div v-if="pending" class="space-y-6">
			<div class="surface-panel bg-white/70 h-72 animate-pulse dark:bg-app-panel-dark/70" />
			<div class="gap-6 grid xl:grid-cols-2">
				<div v-for="index in 3" :key="index" class="surface-panel bg-white/70 h-64 animate-pulse dark:bg-app-panel-dark/70" />
			</div>
		</div>

		<div v-else-if="error || !data" class="max-w-3xl">
			<InfoCallout title="Contest page unavailable" tone="warning">
				This contest page could not be loaded. Return to the current results context and try again.
			</InfoCallout>
		</div>

		<div v-else class="space-y-8">
			<AppBreadcrumbs :items="breadcrumbs" />

			<header class="gap-6 grid xl:grid-cols-[minmax(0,1.2fr)_minmax(22rem,0.8fr)]">
				<div class="surface-panel">
					<div class="flex flex-wrap gap-2">
						<VerificationBadge label="Canonical contest page" tone="accent" />
						<VerificationBadge :label="`${data.sourceCount} source${data.sourceCount === 1 ? '' : 's'}`" />
					</div>
					<p class="text-xs text-app-muted tracking-[0.24em] font-semibold mt-6 uppercase dark:text-app-muted-dark">
						{{ data.election.name }}
					</p>
					<h1 class="text-5xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
						{{ data.contest.office }}
					</h1>
					<p class="text-base text-app-muted leading-8 mt-5 dark:text-app-muted-dark">
						{{ data.contest.description }}
					</p>
					<div class="mt-6 flex flex-wrap gap-3">
						<UpdatedAt :value="data.updatedAt" />
						<NuxtLink :to="openLayerLink.to" class="btn-secondary">
							{{ openLayerLink.label }}
						</NuxtLink>
						<NuxtLink v-if="districtHref" :to="districtHref" class="btn-secondary">
							Open district page
						</NuxtLink>
						<NuxtLink v-if="districtHref" to="/representatives" class="btn-secondary">
							Representative directory
						</NuxtLink>
						<NuxtLink :to="overviewLink.to" class="btn-secondary">
							{{ overviewLink.label }}
						</NuxtLink>
						<NuxtLink v-if="compareHref" :to="compareHref" class="btn-secondary">
							Compare this race
						</NuxtLink>
					</div>
				</div>

				<div class="space-y-4">
					<InfoCallout title="What this page is for" tone="warning">
						{{ data.note }}
					</InfoCallout>
					<div class="surface-panel">
						<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
							Role guide
						</p>
						<h2 class="text-2xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
							What this office or question controls
						</h2>
						<p class="text-sm text-app-muted leading-7 mt-4 dark:text-app-muted-dark">
							{{ data.contest.roleGuide.summary }}
						</p>
						<p class="text-sm text-app-muted leading-7 mt-4 dark:text-app-muted-dark">
							<strong class="text-app-ink dark:text-app-text-dark">Why it matters:</strong> {{ data.contest.roleGuide.whyItMatters }}
						</p>
						<ul class="readable-list text-sm text-app-muted mt-4 pl-5 dark:text-app-muted-dark">
							<li v-for="item in data.contest.roleGuide.decisionAreas" :key="item">
								{{ item }}
							</li>
						</ul>
					</div>
				</div>
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

			<section class="gap-6 grid xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
				<div class="surface-panel">
					<h2 class="text-3xl text-app-ink font-serif dark:text-app-text-dark">
						Contest sources
					</h2>
					<p class="text-sm text-app-muted leading-7 mt-4 dark:text-app-muted-dark">
						This list aggregates the public records used across the entire contest surface, not just one candidate or one measure card.
					</p>
					<div class="mt-6">
						<SourceList :sources="data.sources" />
					</div>
				</div>

				<div class="surface-panel">
					<h2 class="text-3xl text-app-ink font-serif dark:text-app-text-dark">
						Related contests
					</h2>
					<div class="mt-6 space-y-4">
						<NuxtLink
							v-for="contest in data.relatedContests"
							:key="contest.slug"
							:to="contest.href"
							class="px-5 py-5 border border-app-line/70 rounded-3xl bg-white/80 block transition dark:border-app-line-dark hover:border-app-accent dark:bg-app-panel-dark/70 focus-ring"
						>
							<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
								{{ contest.jurisdiction }}
							</p>
							<p class="text-xl text-app-ink font-semibold mt-3 dark:text-app-text-dark">
								{{ contest.office }}
							</p>
							<p class="text-sm text-app-muted mt-2 dark:text-app-muted-dark">
								{{ contest.type === "candidate" ? "Candidate contest" : "Ballot measure" }}
							</p>
						</NuxtLink>
					</div>
				</div>
			</section>
		</div>
	</section>
</template>
