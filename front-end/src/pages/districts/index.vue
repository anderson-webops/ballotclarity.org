<script setup lang="ts">
import type { DistrictsResponse, RepresentativesResponse } from "~/types/civic";
import { storeToRefs } from "pinia";
import { buildActiveLookupSummary } from "~/utils/active-lookup";
import { buildDistrictRepresentativeAvailabilityNote } from "~/utils/district-availability";

import { isExternalHref } from "~/utils/link";
import { buildNationwideDirectoryResponses, mergeNationwideDirectoryResponses } from "~/utils/nationwide-directory";
import { buildLookupContextFromNationwideResult, buildNationwideLookupRouteQuery, buildNationwideRouteTarget } from "~/utils/nationwide-route-context";
import { resolveRepresentativePresentation } from "~/utils/representative-presentation";

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
const { data: guideDistrictData, error: guideDistrictError, pending: guideDistrictPending, refresh: refreshGuideDistrictData } = await useDistricts(directoryApiQuery);
const { data: guideRepresentativesData, refresh: refreshGuideRepresentativesData } = await useRepresentatives(directoryApiQuery);

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

		void refreshGuideDistrictData();
		void refreshGuideRepresentativesData();
	}, { immediate: true });

	watch(activeGuideAreaQuery, (query, previousQuery) => {
		if (!query?.area || query.area === previousQuery?.area || activeLookupQuery.value)
			return;

		void refreshGuideDistrictData();
		void refreshGuideRepresentativesData();
	}, { immediate: true });
}
const emptyNationwideDistrictsResponse: DistrictsResponse = { districts: [], mode: "nationwide", note: "", updatedAt: "" };
const emptyNationwideRepresentativesResponse: RepresentativesResponse = { districts: [], mode: "nationwide", note: "", representatives: [], updatedAt: "" };
const emptyGuideDistrictsResponse: DistrictsResponse = { districts: [], mode: "guide", note: "", updatedAt: "" };
const emptyGuideRepresentativesResponse: RepresentativesResponse = { districts: [], mode: "guide", note: "", representatives: [], updatedAt: "" };
const apiUsesNationwide = computed(() => guideDistrictData.value?.mode === "nationwide" || guideRepresentativesData.value?.mode === "nationwide");
const showGuideDirectory = computed(() => hasGuideShellContext.value);
const storeUsesNationwide = computed(() => {
	if (!activeNationwideLookupResult.value || activeNationwideLookupResult.value.result !== "resolved")
		return false;

	return isHydrated.value
		? hasNationwideResultContext.value && !hasGuideShellContext.value
		: activeNationwideLookupResult.value.guideAvailability !== "published";
});
const directoryUsesNationwide = computed(() => apiUsesNationwide.value || storeUsesNationwide.value);
const nationwideDirectory = computed(() => buildNationwideDirectoryResponses(activeNationwideLookupResult.value));
const directoryData = computed(() => {
	if (storeUsesNationwide.value) {
		return apiUsesNationwide.value
			? mergeNationwideDirectoryResponses(nationwideDirectory.value, {
					districts: guideDistrictData.value,
					representatives: guideRepresentativesData.value
				})
			: nationwideDirectory.value;
	}

	if (apiUsesNationwide.value) {
		return {
			districts: guideDistrictData.value ?? emptyNationwideDistrictsResponse,
			representatives: guideRepresentativesData.value ?? emptyNationwideRepresentativesResponse
		};
	}

	return {
		districts: showGuideDirectory.value ? guideDistrictData.value ?? emptyGuideDistrictsResponse : emptyNationwideDistrictsResponse,
		representatives: showGuideDirectory.value ? guideRepresentativesData.value ?? emptyGuideRepresentativesResponse : emptyNationwideRepresentativesResponse
	};
});
const directoriesPending = computed(() => directoryUsesNationwide.value ? false : showGuideDirectory.value ? guideDistrictPending.value : false);
const directoriesError = computed(() => showGuideDirectory.value || directoryUsesNationwide.value
	? directoryUsesNationwide.value && directoryData.value ? null : guideDistrictError.value
	: null);
const districts = computed(() => directoryData.value?.districts.districts ?? []);
const representatives = computed(() => directoryData.value?.representatives.representatives ?? []);
const activeLookupSummary = computed(() => buildActiveLookupSummary({
	nationwideLookupResult: activeNationwideLookupResult.value,
	routeLookupQuery: activeLookupQuery.value?.lookup ?? null,
	selectedLocation: isHydrated.value ? selectedLocation.value : null
}));

const representativesByDistrict = computed(() => {
	const grouped = new Map<string, typeof representatives.value>();

	for (const representative of representatives.value) {
		const existingRepresentatives = grouped.get(representative.districtSlug) ?? [];
		grouped.set(representative.districtSlug, [...existingRepresentatives, representative]);
	}

	return grouped;
});

function getDistrictRepresentatives(districtSlug: string) {
	return representativesByDistrict.value.get(districtSlug) ?? [];
}

function getDistrictRepresentativeAvailabilityNote(district: typeof districts.value[number]) {
	return buildDistrictRepresentativeAvailabilityNote(district, getDistrictRepresentatives(district.slug).length || district.representativeCount);
}

function getRepresentativePresentation(representative: RepresentativesResponse["representatives"][number]) {
	return resolveRepresentativePresentation(representative, activeNationwideLookupResult.value?.location?.state ?? null);
}

function getPrimaryDistrictRepresentative(districtSlug: string) {
	return getDistrictRepresentatives(districtSlug)[0] ?? null;
}

function getPrimaryDistrictRepresentativePresentation(districtSlug: string) {
	const representative = getPrimaryDistrictRepresentative(districtSlug);
	return representative ? getRepresentativePresentation(representative) : null;
}

usePageSeo({
	description: "Browse district-by-district Ballot Clarity pages for office context, current representatives, and the upcoming contest field.",
	path: "/districts",
	title: "District hub"
});
const requiresLookupPrompt = computed(() => !directoryUsesNationwide.value && !showGuideDirectory.value);
const lookupPrompt = computed(() => activeLookupSummary.value.mode === "none"
	? {
			body: "Enter an address or ZIP code to see your districts.",
			title: "Start with lookup"
		}
	: {
			body: "Look up your address again to load your districts.",
			title: "Refresh results for this page"
		}
);
const directorySummary = computed(() => `${districts.value.length} district page${districts.value.length === 1 ? "" : "s"} and ${representatives.value.length} linked official${representatives.value.length === 1 ? "" : "s"} are available for this area.`);

function buildLookupAwareTarget(path: string) {
	return buildNationwideRouteTarget(path, buildLookupContextFromNationwideResult(activeNationwideLookupResult.value), route.query);
}
</script>

<template>
	<section class="app-shell section-gap space-y-8">
		<header>
			<h1 class="text-5xl text-app-ink font-serif dark:text-app-text-dark">
				District pages
			</h1>
			<p v-if="activeLookupSummary.mode !== 'none'" class="text-base text-app-ink font-semibold mt-3 dark:text-app-text-dark">
				{{ activeLookupSummary.label }}
			</p>
		</header>

		<div v-if="directoriesPending && !directoryData.districts.districts.length" class="gap-6 grid lg:grid-cols-2 xl:grid-cols-3">
			<div v-for="index in 3" :key="index" class="rounded-lg bg-app-bg h-72 animate-pulse dark:bg-app-bg-dark" />
		</div>

		<div v-else-if="directoriesError || !directoryData" class="max-w-3xl">
			<InfoCallout title="District pages unavailable" tone="warning">
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

			<section class="gap-x-10 grid lg:grid-cols-2 xl:grid-cols-3">
				<article
					v-for="district in districts"
					:key="district.slug"
					class="py-6 border-t border-app-line flex flex-col dark:border-app-line-dark"
				>
					<p class="text-xs text-app-muted tracking-[0.06em] font-semibold uppercase dark:text-app-muted-dark">
						{{ district.jurisdiction }}
					</p>
					<h2 class="text-2xl text-app-ink font-serif mt-1 dark:text-app-text-dark">
						<NuxtLink :to="buildLookupAwareTarget(district.href)" class="hover:text-app-accent focus-ring">
							{{ district.title }}
						</NuxtLink>
					</h2>
					<p class="text-sm text-app-muted leading-6 mt-2 dark:text-app-muted-dark">
						{{ district.summary }}
					</p>
					<div v-if="getDistrictRepresentatives(district.slug).length" class="mt-4">
						<p class="text-xs text-app-muted tracking-[0.06em] font-semibold uppercase dark:text-app-muted-dark">
							{{ getDistrictRepresentatives(district.slug).length === 1 ? 'Current representative' : 'Current representatives' }}
						</p>
						<p class="text-lg text-app-ink font-semibold mt-1 dark:text-app-text-dark">
							<SafeExternalLink
								v-if="isExternalHref(getDistrictRepresentatives(district.slug)[0]?.href ?? '')"
								:href="getDistrictRepresentatives(district.slug)[0]?.href"
								class="hover:text-app-accent focus-ring"
							>
								{{ getPrimaryDistrictRepresentative(district.slug)?.name }}
							</SafeExternalLink>
							<NuxtLink
								v-else
								:to="buildLookupAwareTarget(getDistrictRepresentatives(district.slug)[0]?.href ?? '/representatives')"
								class="hover:text-app-accent focus-ring"
							>
								{{ getPrimaryDistrictRepresentative(district.slug)?.name }}
							</NuxtLink>
						</p>
						<p class="text-sm text-app-muted dark:text-app-muted-dark">
							{{ getPrimaryDistrictRepresentativePresentation(district.slug)?.officeDisplayLabel }}<span v-if="getPrimaryDistrictRepresentative(district.slug)?.party"> · {{ getPrimaryDistrictRepresentative(district.slug)?.party }}</span>
						</p>
						<p v-if="getDistrictRepresentatives(district.slug).length > 1" class="text-sm text-app-muted mt-1 dark:text-app-muted-dark">
							+{{ getDistrictRepresentatives(district.slug).length - 1 }} more
						</p>
					</div>
					<p v-else-if="directoryUsesNationwide" class="text-sm text-app-muted leading-6 mt-4 dark:text-app-muted-dark">
						{{ getDistrictRepresentativeAvailabilityNote(district) }}
					</p>
					<SafeExternalLink
						v-if="getDistrictRepresentatives(district.slug).length && getDistrictRepresentatives(district.slug)[0]?.openstatesUrl"
						:href="getDistrictRepresentatives(district.slug)[0]?.openstatesUrl"
						class="text-sm btn-secondary self-start"
					>
						Provider record
						<span class="i-carbon-launch" aria-hidden="true" />
					</SafeExternalLink>
				</article>
			</section>
		</div>
	</section>
</template>
