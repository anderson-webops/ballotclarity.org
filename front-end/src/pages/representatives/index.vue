<script setup lang="ts">
import type { RepresentativesResponse } from "~/types/civic";
import { storeToRefs } from "pinia";

import { buildActiveLookupSummary } from "~/utils/active-lookup";
import { isExternalHref } from "~/utils/link";
import { buildNationwideDirectoryResponses, mergeNationwideDirectoryResponses } from "~/utils/nationwide-directory";
import { buildLookupContextFromNationwideResult, buildNationwideLookupRouteQuery, buildNationwideRouteTarget } from "~/utils/nationwide-route-context";
import { groupRepresentativeSummariesByGovernmentLevel, resolveRepresentativePresentation } from "~/utils/representative-presentation";

const route = useRoute();
const civicStore = useCivicStore();
const { isHydrated, nationwideLookupResult, selectedLocation } = storeToRefs(civicStore);
const { hasGuideShellContext, hasNationwideResultContext } = useGuideEntryGate();
const activeNationwideLookupResult = computed(() => isHydrated.value ? nationwideLookupResult.value : null);
const activeLookupQuery = computed(() => buildNationwideLookupRouteQuery(
	buildLookupContextFromNationwideResult(activeNationwideLookupResult.value),
	route.query
));
const activeGuideAreaQuery = computed(() => isHydrated.value && hasGuideShellContext.value && selectedLocation.value?.slug
	? { area: selectedLocation.value.slug }
	: null
);
const directoryApiQuery = computed(() => activeLookupQuery.value ?? activeGuideAreaQuery.value);
const { data: guideData, error: guideError, pending: guidePending, refresh: refreshGuideData } = await useRepresentatives(directoryApiQuery);

if (import.meta.client) {
	watch(activeLookupQuery, (query, previousQuery) => {
		if (
			!query?.lookup
			|| (
				query.lookup === previousQuery?.lookup
				&& query.selection === previousQuery?.selection
			)
		) {
			return;
		}

		void refreshGuideData();
	}, { immediate: true });

	watch(activeGuideAreaQuery, (query, previousQuery) => {
		if (!query?.area || query.area === previousQuery?.area || activeLookupQuery.value)
			return;

		void refreshGuideData();
	}, { immediate: true });
}
const emptyNationwideRepresentativesResponse: RepresentativesResponse = { districts: [], mode: "nationwide", note: "", representatives: [], updatedAt: "" };
const emptyGuideRepresentativesResponse: RepresentativesResponse = { districts: [], mode: "guide", note: "", representatives: [], updatedAt: "" };
const apiUsesNationwide = computed(() => guideData.value?.mode === "nationwide");
const showGuideDirectory = computed(() => hasGuideShellContext.value);
const storeUsesNationwide = computed(() => {
	if (!activeNationwideLookupResult.value || activeNationwideLookupResult.value.result !== "resolved")
		return false;

	return isHydrated.value
		? hasNationwideResultContext.value && !hasGuideShellContext.value
		: activeNationwideLookupResult.value.guideAvailability !== "published";
});
const directoryUsesNationwide = computed(() => apiUsesNationwide.value || storeUsesNationwide.value);
const directoryBundle = computed(() => {
	if (storeUsesNationwide.value) {
		const storedDirectory = buildNationwideDirectoryResponses(activeNationwideLookupResult.value);

		return apiUsesNationwide.value
			? mergeNationwideDirectoryResponses(storedDirectory, {
				representatives: guideData.value
			}).representatives
			: storedDirectory.representatives;
	}

	if (apiUsesNationwide.value)
		return guideData.value ?? emptyNationwideRepresentativesResponse;

	if (showGuideDirectory.value)
		return guideData.value ?? emptyGuideRepresentativesResponse;

	return emptyNationwideRepresentativesResponse;
});

const directoryPending = computed(() => directoryUsesNationwide.value ? false : showGuideDirectory.value ? guidePending.value : false);
const directoryError = computed(() => showGuideDirectory.value || directoryUsesNationwide.value
	? directoryUsesNationwide.value && directoryBundle.value ? null : guideError.value
	: null);
const directoryData = computed(() => directoryBundle.value);
const groupedRepresentatives = computed(() => groupRepresentativeSummariesByGovernmentLevel(
	directoryData.value.representatives,
	activeNationwideLookupResult.value?.location?.state ?? null
));
const activeLookupSummary = computed(() => buildActiveLookupSummary({
	nationwideLookupResult: activeNationwideLookupResult.value,
	routeLookupQuery: activeLookupQuery.value?.lookup ?? null,
	selectedLocation: isHydrated.value ? selectedLocation.value : null
}));
const representativeLinkIsExternal = (href: string) => isExternalHref(href);
const requiresLookupPrompt = computed(() => !directoryUsesNationwide.value && !showGuideDirectory.value);
const lookupPrompt = computed(() => activeLookupSummary.value.mode === "none"
	? {
			body: "Enter an address or ZIP code to see your current officials.",
			title: "Start with lookup"
		}
	: {
			body: "Look up your address again to load your current officials.",
			title: "Refresh results for this page"
		}
);
const directorySummary = computed(() => `${directoryData.value.representatives.length} current official${directoryData.value.representatives.length === 1 ? "" : "s"} across ${directoryData.value.districts.length} district match${directoryData.value.districts.length === 1 ? "" : "es"}.`);

function buildLookupAwareTarget(path: string) {
	return buildNationwideRouteTarget(path, buildLookupContextFromNationwideResult(activeNationwideLookupResult.value), route.query);
}

function getRepresentativePresentation(representative: RepresentativesResponse["representatives"][number]) {
	return resolveRepresentativePresentation(representative, activeNationwideLookupResult.value?.location?.state ?? null);
}
usePageSeo({
	description: "Directory of current representatives with district links, person pages, and attached public-record context.",
	path: "/representatives",
	title: "Representatives"
});
</script>

<template>
	<section class="app-shell section-gap space-y-8">
		<header>
			<h1 class="text-5xl text-app-ink font-serif dark:text-app-text-dark">
				Representatives
			</h1>
			<p v-if="activeLookupSummary.mode !== 'none'" class="text-base text-app-muted mt-3 flex flex-wrap gap-x-4 gap-y-1 items-baseline dark:text-app-muted-dark">
				<span class="text-app-ink font-semibold dark:text-app-text-dark">{{ activeLookupSummary.label }}</span>
				<NuxtLink :to="buildLookupAwareTarget('/districts')" class="btn-secondary">
					Districts
				</NuxtLink>
			</p>
		</header>

		<div v-if="directoryPending && !directoryData.representatives.length" class="gap-6 grid lg:grid-cols-2">
			<div class="rounded-lg bg-app-bg h-56 animate-pulse dark:bg-app-bg-dark" />
			<div class="rounded-lg bg-app-bg h-56 animate-pulse dark:bg-app-bg-dark" />
		</div>

		<div v-else-if="directoryError || !directoryData" class="max-w-3xl">
			<InfoCallout title="Representative directory unavailable" tone="warning">
				Try again later.
			</InfoCallout>
		</div>

		<div v-else-if="requiresLookupPrompt" class="max-w-3xl">
			<p class="text-xl text-app-ink font-semibold dark:text-app-text-dark">
				{{ lookupPrompt.title }}
			</p>
			<p class="text-base text-app-muted mt-2 dark:text-app-muted-dark">
				{{ lookupPrompt.body }}
			</p>
			<NuxtLink to="/" class="btn-primary mt-5">
				Enter your address
			</NuxtLink>
		</div>

		<div v-else class="space-y-6">
			<p class="text-sm text-app-muted leading-7 dark:text-app-muted-dark">
				{{ directorySummary }}
			</p>

			<div class="space-y-8">
				<section
					v-for="group in groupedRepresentatives"
					:key="group.label"
					class="space-y-5"
				>
					<div class="flex flex-wrap gap-3 items-center justify-between">
						<h2 class="text-2xl text-app-ink font-serif dark:text-app-text-dark">
							{{ group.label }}
						</h2>
					</div>
					<div class="gap-x-10 grid lg:grid-cols-2">
						<article
							v-for="representative in group.representatives"
							:key="representative.slug"
							class="py-5 border-t border-app-line dark:border-app-line-dark"
						>
							<div class="flex gap-4 items-start">
								<ProfileImageStack
									v-if="representative.profileImages?.length"
									:images="representative.profileImages"
									:name="representative.name"
									size="md"
								/>
								<div class="min-w-0">
									<h3 class="text-xl text-app-ink font-serif dark:text-app-text-dark">
										<NuxtLink v-if="!representativeLinkIsExternal(representative.href)" :to="buildLookupAwareTarget(representative.href)" class="hover:text-app-accent focus-ring">
											{{ representative.name }}
										</NuxtLink>
										<template v-else>
											{{ representative.name }}
										</template>
									</h3>
									<p class="text-sm text-app-muted mt-1 dark:text-app-muted-dark">
										{{ getRepresentativePresentation(representative).officeDisplayLabel }}<span v-if="representative.party"> · {{ representative.party }}</span>
									</p>
									<p v-if="representative.districtLabel !== getRepresentativePresentation(representative).officeDisplayLabel" class="text-sm text-app-muted dark:text-app-muted-dark">
										{{ representative.districtLabel }}
									</p>
								</div>
							</div>
							<p v-if="representative.summary" class="text-sm text-app-ink leading-6 mt-3 dark:text-app-text-dark">
								{{ representative.summary }}
							</p>
							<div class="mt-3 flex flex-wrap gap-x-5 gap-y-1">
								<SafeExternalLink
									v-if="representativeLinkIsExternal(representative.href)"
									:href="representative.href"
									class="btn-secondary inline-flex gap-2 items-center"
								>
									Open record
									<span class="i-carbon-launch" />
								</SafeExternalLink>
								<NuxtLink :to="buildLookupAwareTarget(`/districts/${representative.districtSlug}`)" class="btn-secondary">
									District page
								</NuxtLink>
								<NuxtLink
									v-if="!representativeLinkIsExternal(representative.href) && representative.fundingAvailable"
									:to="buildLookupAwareTarget(`${representative.href}/funding`)"
									class="btn-secondary"
								>
									Funding
								</NuxtLink>
								<NuxtLink
									v-if="!representativeLinkIsExternal(representative.href) && representative.influenceAvailable"
									:to="buildLookupAwareTarget(`${representative.href}/influence`)"
									class="btn-secondary"
								>
									Influence
								</NuxtLink>
							</div>
						</article>
					</div>
				</section>
			</div>
		</div>
	</section>
</template>
