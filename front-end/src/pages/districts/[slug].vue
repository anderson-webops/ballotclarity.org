<script setup lang="ts">
import { storeToRefs } from "pinia";
import { groupCountyOfficeholders } from "~/utils/county-officeholder-groups";

import { buildDistrictRepresentativeSection, buildDistrictResponsibilitiesHeading } from "~/utils/district-availability";
import { buildGuideDistrictPageRecord, buildNationwideDistrictPageRecord } from "~/utils/district-page";
import { isExternalHref } from "~/utils/link";
import { buildCivicDirectoryApiQuery, buildLookupContextFromNationwideResult, buildNationwideLookupRouteQuery, buildNationwideRouteTarget } from "~/utils/nationwide-route-context";
import { resolveRepresentativeContentSummary, resolveRepresentativePresentation } from "~/utils/representative-presentation";

const route = useRoute();
const civicStore = useCivicStore();
const { isHydrated, nationwideLookupResult } = storeToRefs(civicStore);
const { hasGuideShellContext, hasNationwideResultContext } = useGuideEntryGate();
const districtSlug = useRouteStringParam("slug");
const activeNationwideLookupResult = computed(() => isHydrated.value ? nationwideLookupResult.value : null);
const activeLookupQuery = computed(() => buildNationwideLookupRouteQuery(
	buildLookupContextFromNationwideResult(activeNationwideLookupResult.value),
	route.query
));
const { data: guideData, error: guideError, pending: guidePending } = await useDistrict(districtSlug, activeLookupQuery);
const lookupFallbackData = computed(() => buildNationwideDistrictPageRecord(activeNationwideLookupResult.value, districtSlug.value));

const districtPageData = computed(() => {
	if (!guideData.value)
		return lookupFallbackData.value;

	if (guideData.value.mode === "guide")
		return buildGuideDistrictPageRecord(guideData.value);

	if (guideData.value.districtOriginLabel === "Lookup context required" && lookupFallbackData.value)
		return lookupFallbackData.value;

	return guideData.value;
});
const pagePending = computed(() => guidePending.value || (!guideData.value && !lookupFallbackData.value));
const pageError = computed(() => districtPageData.value ? null : guideError.value);
const responsibilitiesHeading = computed(() => districtPageData.value?.mode === "nationwide"
	? buildDistrictResponsibilitiesHeading(districtPageData.value.district)
	: "Responsibilities");
const representativeGroups = computed(() => groupCountyOfficeholders(districtPageData.value?.representatives ?? [], districtPageData.value?.officeVacancies));
const representativeSection = computed(() => districtPageData.value?.officeVacancies !== undefined
	? { heading: representativeGroups.value.length === 1 && representativeGroups.value[0]?.id === "commission" ? "County commission" : "County officials", emptyNote: "" }
	: districtPageData.value ? buildDistrictRepresentativeSection(districtPageData.value.district, districtPageData.value.mode) : { heading: "District representatives", emptyNote: "" });
const representativeDirectoryTarget = computed(() => ({
	path: "/representatives",
	query: { ...buildCivicDirectoryApiQuery(buildLookupContextFromNationwideResult(activeNationwideLookupResult.value), route.query) }
}));
function buildLookupAwareTarget(path: string) {
	return buildNationwideRouteTarget(path, buildLookupContextFromNationwideResult(activeNationwideLookupResult.value), route.query);
}

function getRepresentativePresentation(representative: NonNullable<typeof districtPageData.value>["representatives"][number]) {
	return resolveRepresentativePresentation(representative, activeNationwideLookupResult.value?.location?.state ?? null);
}

const breadcrumbs = computed(() => [
	{ label: "Home", to: "/" },
	{ label: "Districts", to: "/districts" },
	{ label: districtPageData.value?.district.title ?? "District page" }
]);

const sectionLinks = computed(() => (districtPageData.value
	? [
			{ href: "#overview", label: "Overview", note: "District and office context" },
			{ href: "#representatives", label: representativeSection.value.heading, badge: String(districtPageData.value.representatives.length) },
			...(districtPageData.value.candidates.length
				? [{ href: "#candidates", label: "Candidates", badge: String(districtPageData.value.candidates.length) }]
				: []),
			...(districtPageData.value.officialResources.length
				? [{ href: "#official-tools", label: "Official tools", badge: String(districtPageData.value.officialResources.length) }]
				: []),
			...(districtPageData.value.sources.length
				? [{ href: "#sources", label: "Sources", badge: String(districtPageData.value.sources.length) }]
				: [])
		]
	: []));

const districtContextLink = computed(() => {
	if (districtPageData.value?.mode === "nationwide" || hasNationwideResultContext.value) {
		return {
			label: "Open results",
			to: "/results"
		};
	}

	if (hasGuideShellContext.value && districtPageData.value) {
		return {
			label: "Open current election coverage",
			to: `/elections/${districtPageData.value.election.slug}`
		};
	}

	return {
		label: "Open coverage profile",
		to: "/coverage"
	};
});

usePageSeo({
	description: districtPageData.value?.district.summary ?? "District page with office context, current representative, candidate field, and source links.",
	path: `/districts/${districtSlug.value}`,
	title: districtPageData.value?.district.title ?? "District page"
});
</script>

<template>
	<section class="app-shell section-gap">
		<div v-if="pagePending" class="gap-6 grid xl:grid-cols-[minmax(0,1.1fr)_minmax(18rem,0.9fr)]">
			<div class="space-y-6">
				<div class="rounded-lg bg-app-bg h-80 animate-pulse dark:bg-app-bg-dark" />
				<div class="rounded-lg bg-app-bg h-72 animate-pulse dark:bg-app-bg-dark" />
			</div>
			<div class="rounded-lg bg-app-bg h-72 animate-pulse dark:bg-app-bg-dark" />
		</div>

		<div v-else-if="pageError || !districtPageData" class="max-w-3xl">
			<InfoCallout title="District detail not available yet" tone="warning">
				Try again later.
			</InfoCallout>
		</div>

		<div v-else class="gap-8 grid xl:grid-cols-[minmax(0,1.1fr)_minmax(18rem,0.9fr)]">
			<div class="section-stack print:space-y-8">
				<header id="overview" class="surface-panel">
					<AppBreadcrumbs :items="breadcrumbs" />
					<p class="text-xs text-app-muted tracking-[0.06em] font-semibold uppercase dark:text-app-muted-dark">
						{{ districtPageData.district.jurisdiction }}
					</p>
					<h1 class="text-5xl text-app-ink font-serif mt-2 dark:text-app-text-dark">
						{{ districtPageData.district.title }}
					</h1>
					<p v-if="districtPageData.mode === 'guide' && districtPageData.district.description" class="text-lg text-app-ink leading-8 mt-4 dark:text-app-text-dark">
						{{ districtPageData.district.description }}
					</p>
					<div class="mt-5 flex flex-wrap gap-x-6 gap-y-3 items-center">
						<NuxtLink v-if="districtPageData.mode === 'guide'" :to="`/contest/${districtPageData.district.slug}`" class="btn-primary">
							Open contest page
						</NuxtLink>
						<NuxtLink :to="buildLookupAwareTarget(districtContextLink.to)" class="btn-secondary">
							{{ districtContextLink.label }}
						</NuxtLink>
						<UpdatedAt v-if="districtPageData.representatives.length || districtPageData.candidates.length || districtPageData.relatedContests.length" :value="districtPageData.updatedAt" label="Updated" />
					</div>
					<NuxtLink v-if="districtPageData.courtDirectory" :to="`/courts/${districtPageData.courtDirectory.slug}`" class="text-app-accent mt-6 underline inline-block focus-ring">
						State Court judges ({{ districtPageData.courtDirectory.count }})
					</NuxtLink>
				</header>

				<section id="representatives" class="surface-panel">
					<div class="flex flex-wrap gap-4 items-center justify-between">
						<div>
							<h2 class="text-2xl text-app-ink font-serif dark:text-app-text-dark">
								{{ representativeSection.heading }}
							</h2>
						</div>
						<NuxtLink :to="representativeDirectoryTarget" class="btn-secondary">
							Representative directory
						</NuxtLink>
					</div>
					<div v-if="districtPageData.representatives.length || districtPageData.officeVacancies?.length" class="mt-8 space-y-16">
						<section v-for="group in representativeGroups" :key="group.id">
							<h3 v-if="group.label" class="text-xl text-app-muted font-serif dark:text-app-muted-dark">
								{{ group.label }}
							</h3>
							<div class="mt-6 gap-8 grid lg:grid-cols-2">
								<article v-for="representative in group.people" :key="representative.slug">
									<div class="flex gap-4 items-start">
										<ProfileImageStack
											v-if="representative.profileImages?.length"
											:images="representative.profileImages"
											:name="representative.name"
											size="md"
										/>
										<div class="min-w-0">
											<p class="text-xl text-app-ink font-serif dark:text-app-text-dark">
												{{ representative.name }}
											</p>
											<p class="text-sm text-app-muted mt-1 dark:text-app-muted-dark">
												{{ getRepresentativePresentation(representative).officeDisplayLabel }}<span v-if="representative.party"> · <PartyLabel :party="representative.party" /></span>
											</p>
										</div>
									</div>
									<p v-if="resolveRepresentativeContentSummary(representative.summary)" class="text-sm text-app-ink leading-6 mt-3 dark:text-app-text-dark">
										{{ resolveRepresentativeContentSummary(representative.summary) }}
									</p>
									<div class="mt-3 flex flex-wrap gap-x-5 gap-y-1">
										<SafeExternalLink
											v-if="isExternalHref(representative.href)"
											:href="representative.href"
											external-icon
											class="btn-secondary inline-flex gap-2 items-center"
										>
											Open record
										</SafeExternalLink>
										<NuxtLink v-else :to="buildLookupAwareTarget(representative.href)" class="btn-secondary">
											Profile
										</NuxtLink>
										<RepresentativeWebsite :website-url="representative.officialWebsiteUrl" :provider-url="representative.openstatesUrl" class="btn-secondary" />
										<NuxtLink
											v-if="!isExternalHref(representative.href) && representative.fundingAvailable"
											:to="buildLookupAwareTarget(`${representative.href}/funding`)"
											class="btn-secondary"
										>
											Funding
										</NuxtLink>
										<NuxtLink
											v-if="!isExternalHref(representative.href) && representative.influenceAvailable"
											:to="buildLookupAwareTarget(`${representative.href}/influence`)"
											class="btn-secondary"
										>
											Influence
										</NuxtLink>
									</div>
									<div v-if="representative.fundingAvailable || representative.influenceAvailable" class="mt-4 space-y-2">
										<p v-if="representative.fundingAvailable" class="text-sm text-app-muted leading-6 dark:text-app-muted-dark">
											<strong class="text-app-ink dark:text-app-text-dark">Funding:</strong> {{ representative.fundingSummary }}
										</p>
										<p v-if="representative.influenceAvailable" class="text-sm text-app-muted leading-6 dark:text-app-muted-dark">
											<strong class="text-app-ink dark:text-app-text-dark">Influence:</strong> {{ representative.influenceSummary }}
										</p>
									</div>
								</article>
								<article v-for="office in group.vacancies" :key="office" class="py-4">
									<p class="text-xl text-app-ink font-serif dark:text-app-text-dark">
										{{ office }}
									</p>
									<p class="text-sm text-app-muted mt-1 dark:text-app-muted-dark">
										Vacant
									</p>
								</article>
							</div>
						</section>
					</div>
					<p v-else class="text-sm text-app-muted leading-6 mt-4 dark:text-app-muted-dark">
						{{ representativeSection.emptyNote }}
					</p>
				</section>

				<section v-if="districtPageData.candidates.length" id="candidates" class="surface-panel">
					<div class="flex flex-wrap gap-4 items-center justify-between">
						<div>
							<h2 class="text-3xl text-app-ink font-serif dark:text-app-text-dark">
								Candidates
							</h2>
						</div>
						<NuxtLink v-if="districtPageData.mode === 'guide'" :to="`/contest/${districtPageData.district.slug}`" class="btn-secondary">
							Open contest page
						</NuxtLink>
					</div>
					<div v-if="districtPageData.candidates.length" class="mt-6 gap-6 grid xl:grid-cols-2">
						<CandidateCard
							v-for="candidate in districtPageData.candidates"
							:key="candidate.slug"
							:candidate="candidate"
						/>
					</div>
				</section>

				<section v-if="districtPageData.officialResources.length" id="official-tools" class="surface-panel">
					<h2 class="text-2xl text-app-ink font-serif dark:text-app-text-dark">
						Official links
					</h2>
					<div class="mt-3">
						<OfficialResourceList :resources="districtPageData.officialResources" />
					</div>
				</section>

				<section v-if="districtPageData.sources.length" id="sources" class="surface-panel scroll-mt-28">
					<h2 class="text-2xl text-app-ink font-serif dark:text-app-text-dark">
						District sources
					</h2>
					<div class="mt-6">
						<SourceList :sources="districtPageData.sources" />
					</div>
				</section>
			</div>

			<div class="space-y-6 xl:pt-[4.5rem]">
				<PageSectionNav
					:breadcrumbs="breadcrumbs"
					compact
					:items="sectionLinks"
					:show-breadcrumbs="false"
					title="On this page"
				>
					<template #actions>
						<NuxtLink to="/districts" class="text-sm btn-secondary">
							All districts
						</NuxtLink>
					</template>
				</PageSectionNav>

				<section
					v-if="districtPageData.district.roleGuide.decisionAreas.length || (districtPageData.mode === 'guide' && districtPageData.district.roleGuide.summary)"
					aria-labelledby="district-responsibilities"
					class="text-base text-app-ink leading-7 dark:text-app-text-dark"
				>
					<h2 id="district-responsibilities" class="text-lg font-semibold">
						{{ responsibilitiesHeading }}
					</h2>
					<p v-if="districtPageData.mode === 'guide' && districtPageData.district.roleGuide.summary" class="mt-2">
						{{ districtPageData.district.roleGuide.summary }}
					</p>
					<ul v-if="districtPageData.district.roleGuide.decisionAreas.length" class="mt-2 pl-5 list-disc space-y-1">
						<li v-for="area in districtPageData.district.roleGuide.decisionAreas" :key="area">
							{{ area }}
						</li>
					</ul>
				</section>

				<section v-if="districtPageData.relatedContests.length">
					<h2 class="text-lg text-app-ink font-semibold dark:text-app-text-dark">
						Related ballot pages
					</h2>
					<ul class="mt-2">
						<li v-for="contest in districtPageData.relatedContests" :key="contest.slug" class="py-2">
							<NuxtLink :to="contest.href" class="btn-secondary">
								{{ contest.office }}
							</NuxtLink>
							<span class="text-sm text-app-muted ml-2 dark:text-app-muted-dark">{{ contest.jurisdiction }}</span>
						</li>
					</ul>
				</section>
			</div>
		</div>
	</section>
</template>
