<script setup lang="ts">
import { isExternalHref } from "~/utils/link";

const route = useRoute();
const { hasNationwideResultContext, hasPublishedGuideContext } = useGuideEntryGate();
const districtSlug = computed(() => String(route.params.slug));
const { formatDateTime } = useFormatters();
const { data, error, pending } = await useDistrict(districtSlug);

const breadcrumbs = computed(() => [
	{ label: "Home", to: "/" },
	{ label: "Districts", to: "/districts" },
	{ label: data.value?.district.title ?? "District page" }
]);

const sectionLinks = computed(() => (data.value
	? [
			{ href: "#overview", label: "Overview", note: "District and office context" },
			{ href: "#representatives", label: "Current representatives", badge: String(data.value.representatives.length) },
			{ href: "#candidates", label: "Candidate field", badge: String(data.value.candidates.length) },
			{ href: "#sources", label: "Sources", badge: String(data.value.sources.length) }
		]
	: []));

const summaryItems = computed(() => {
	if (!data.value)
		return [];

	return [
		{ label: "Candidates", note: "Profiles in the active field.", value: data.value.candidates.length, href: `/contest/${data.value.district.slug}` },
		{ label: "Current representatives", note: "Currently serving officials on this ballot surface.", value: data.value.representatives.length, href: "/representatives" },
		{ label: "Updated", note: "District page freshness.", value: formatDateTime(data.value.updatedAt) }
	];
});

const districtContextLink = computed(() => {
	if (hasNationwideResultContext.value) {
		return {
			label: "Open nationwide results",
			to: "/results"
		};
	}

	if (hasPublishedGuideContext.value && data.value) {
		return {
			label: "Open current election coverage",
			to: `/elections/${data.value.election.slug}`
		};
	}

	return {
		label: "Open coverage profile",
		to: "/coverage"
	};
});

usePageSeo({
	description: data.value?.district.summary ?? "District page with office context, current representative, candidate field, and source links.",
	path: `/districts/${districtSlug.value}`,
	title: data.value?.district.title ?? "District page"
});
</script>

<template>
	<section class="app-shell section-gap">
		<div v-if="pending" class="gap-6 grid xl:grid-cols-[minmax(0,1.1fr)_minmax(18rem,0.9fr)]">
			<div class="space-y-6">
				<div class="surface-panel bg-white/70 h-80 animate-pulse dark:bg-app-panel-dark/70" />
				<div class="surface-panel bg-white/70 h-72 animate-pulse dark:bg-app-panel-dark/70" />
			</div>
			<div class="surface-panel bg-white/70 h-72 animate-pulse dark:bg-app-panel-dark/70" />
		</div>

		<div v-else-if="error || !data" class="max-w-3xl">
			<InfoCallout title="District page unavailable" tone="warning">
				This district page could not be loaded. Return to the district hub or the broader results layer and try again.
			</InfoCallout>
		</div>

		<div v-else class="gap-8 grid xl:grid-cols-[minmax(0,1.1fr)_minmax(18rem,0.9fr)]">
			<div class="space-y-8">
				<header id="overview" class="surface-panel">
					<AppBreadcrumbs :items="breadcrumbs" />
					<div class="flex flex-wrap gap-2">
						<VerificationBadge label="District page" tone="accent" />
						<VerificationBadge :label="data.district.jurisdiction" />
					</div>
					<h1 class="text-5xl text-app-ink font-serif mt-5 dark:text-app-text-dark">
						{{ data.district.title }}
					</h1>
					<p class="text-base text-app-muted leading-8 mt-5 dark:text-app-muted-dark">
						{{ data.district.description }}
					</p>
					<div class="mt-6 flex flex-wrap gap-3">
						<NuxtLink :to="`/contest/${data.district.slug}`" class="btn-primary">
							Open contest page
						</NuxtLink>
						<NuxtLink :to="districtContextLink.to" class="btn-secondary">
							{{ districtContextLink.label }}
						</NuxtLink>
						<NuxtLink to="/representatives" class="btn-secondary">
							Representative directory
						</NuxtLink>
					</div>
					<div class="mt-6">
						<PageSummaryStrip :items="summaryItems" />
					</div>
				</header>

				<section id="representatives" class="surface-panel">
					<div class="flex flex-wrap gap-4 items-center justify-between">
						<div>
							<h2 class="text-3xl text-app-ink font-serif dark:text-app-text-dark">
								Current representatives
							</h2>
							<p class="text-sm text-app-muted leading-7 mt-3 dark:text-app-muted-dark">
								These are the currently serving officials on this district page when the current ballot field includes an incumbent.
							</p>
						</div>
						<NuxtLink to="/representatives" class="btn-secondary">
							All representatives
						</NuxtLink>
					</div>
					<div v-if="data.representatives.length" class="mt-6 gap-5 grid lg:grid-cols-2">
						<article v-for="representative in data.representatives" :key="representative.slug" class="p-5 border border-app-line/70 rounded-3xl bg-white/80 dark:border-app-line-dark dark:bg-app-panel-dark/70">
							<div class="flex flex-wrap gap-3 items-center">
								<p class="text-2xl text-app-ink font-serif dark:text-app-text-dark">
									{{ representative.name }}
								</p>
								<IncumbentBadge />
							</div>
							<p class="text-sm text-app-muted mt-3 dark:text-app-muted-dark">
								{{ representative.party }} · {{ representative.officeSought }}
							</p>
							<p class="text-sm text-app-muted leading-7 mt-4 dark:text-app-muted-dark">
								{{ representative.summary }}
							</p>
							<div class="mt-5 flex flex-wrap gap-3">
								<a
									v-if="isExternalHref(representative.href)"
									:href="representative.href"
									target="_blank"
									rel="noreferrer"
									class="btn-secondary inline-flex gap-2 items-center"
								>
									Open record
									<span class="i-carbon-launch" />
								</a>
								<NuxtLink v-else :to="representative.href" class="btn-secondary">
									Profile
								</NuxtLink>
								<NuxtLink v-if="!isExternalHref(representative.href)" :to="`${representative.href}/funding`" class="btn-secondary">
									Funding
								</NuxtLink>
								<NuxtLink v-if="!isExternalHref(representative.href)" :to="`${representative.href}/influence`" class="btn-secondary">
									Influence
								</NuxtLink>
							</div>
						</article>
					</div>
					<InfoCallout v-else title="No current representative in this field" tone="warning" class="mt-6">
						This district page does not have an incumbent candidate in the current field, so there is no current-representative card to show here yet.
					</InfoCallout>
				</section>

				<section id="candidates" class="surface-panel">
					<div class="flex flex-wrap gap-4 items-center justify-between">
						<div>
							<h2 class="text-3xl text-app-ink font-serif dark:text-app-text-dark">
								Candidate field
							</h2>
							<p class="text-sm text-app-muted leading-7 mt-3 dark:text-app-muted-dark">
								Open the candidate profile for the broader record, then use the dedicated funding and influence pages when you want those topics without the rest of the profile.
							</p>
						</div>
						<NuxtLink :to="`/contest/${data.district.slug}`" class="btn-secondary">
							Open contest page
						</NuxtLink>
					</div>
					<div class="mt-6 gap-6 grid xl:grid-cols-2">
						<CandidateCard
							v-for="candidate in data.candidates"
							:key="candidate.slug"
							:candidate="candidate"
						/>
					</div>
				</section>

				<section id="sources" class="surface-panel">
					<h2 class="text-3xl text-app-ink font-serif dark:text-app-text-dark">
						District sources
					</h2>
					<p class="text-sm text-app-muted leading-7 mt-4 dark:text-app-muted-dark">
						These sources aggregate the current representative and candidate field on this district page. For narrower evidence review, use each candidate profile and its source drawer.
					</p>
					<div class="mt-6">
						<SourceList :sources="data.sources" />
					</div>
				</section>
			</div>

			<div class="space-y-6 xl:pt-[4.5rem]">
				<PageSectionNav
					:breadcrumbs="breadcrumbs"
					description="Use this page when you want one office area at a time instead of the full ballot stack."
					:items="sectionLinks"
					title="District page"
				>
					<template #actions>
						<div class="flex flex-wrap gap-3">
							<NuxtLink :to="districtContextLink.to" class="btn-secondary">
								{{ districtContextLink.label }}
							</NuxtLink>
							<NuxtLink to="/districts" class="btn-secondary">
								All districts
							</NuxtLink>
						</div>
					</template>
				</PageSectionNav>

				<div class="surface-panel">
					<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
						Role guide
					</p>
					<h2 class="text-2xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
						What this office controls
					</h2>
					<p class="text-sm text-app-muted leading-7 mt-4 dark:text-app-muted-dark">
						{{ data.district.roleGuide.summary }}
					</p>
					<p class="text-sm text-app-muted leading-7 mt-4 dark:text-app-muted-dark">
						<strong class="text-app-ink dark:text-app-text-dark">Why it matters:</strong> {{ data.district.roleGuide.whyItMatters }}
					</p>
					<ul class="readable-list text-sm text-app-muted mt-4 pl-5 dark:text-app-muted-dark">
						<li v-for="area in data.district.roleGuide.decisionAreas" :key="area">
							{{ area }}
						</li>
					</ul>
				</div>

				<div class="surface-panel">
					<h2 class="text-2xl text-app-ink font-serif dark:text-app-text-dark">
						Related ballot surfaces
					</h2>
					<div class="mt-5 space-y-4">
						<NuxtLink
							v-for="contest in data.relatedContests"
							:key="contest.slug"
							:to="contest.href"
							class="px-5 py-4 border border-app-line/70 rounded-3xl bg-white/80 block transition dark:border-app-line-dark hover:border-app-accent dark:bg-app-panel-dark/70 focus-ring"
						>
							<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
								{{ contest.jurisdiction }}
							</p>
							<p class="text-lg text-app-ink font-semibold mt-3 dark:text-app-text-dark">
								{{ contest.office }}
							</p>
						</NuxtLink>
					</div>
				</div>
			</div>
		</div>
	</section>
</template>
