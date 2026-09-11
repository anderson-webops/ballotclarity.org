<script setup lang="ts">
import type { LocationLookupAction, LocationLookupResponse, LocationLookupSelectionOption } from "~/types/civic";
import { storeToRefs } from "pinia";
import { buildActiveLookupSummary } from "~/utils/active-lookup";
import { buildLocationGuessUiContent } from "~/utils/location-guess";
import { buildPublishedGuideDestination, filterLookupActionsForPresentation } from "~/utils/location-lookup";
import { normalizeLookupResponseForDisplay, resolveLookupDestination } from "~/utils/nationwide-results";
import { buildLookupContextFromNationwideResult, buildNationwideLookupRouteQuery, buildNationwideRouteTarget } from "~/utils/nationwide-route-context";

const api = useApiClient();
const route = useRoute();
const civicStore = useCivicStore();
const { data: coverageData } = useCoverage();
const { isHydrated, nationwideLookupResult } = storeToRefs(civicStore);
const storedNationwideLookupResult = computed(() => isHydrated.value ? nationwideLookupResult.value : null);
const activeLookupQuery = computed(() => buildNationwideLookupRouteQuery(
	buildLookupContextFromNationwideResult(storedNationwideLookupResult.value),
	route.query
));
const { data: savedLookupResult } = await useAsyncData(
	"results:saved-active-lookup",
	async () => {
		if (activeLookupQuery.value?.lookup)
			return null;

		const response = await api<LocationLookupResponse | null>("/location/active");
		return response ? normalizeLookupResponseForDisplay(response, null) : null;
	},
	{
		default: () => null,
		watch: [activeLookupQuery]
	}
);
const { data: routeLookupResult } = await useAsyncData(
	() => `results:lookup:${activeLookupQuery.value?.lookup ?? "none"}:${activeLookupQuery.value?.selection ?? "none"}`,
	async () => {
		if (!activeLookupQuery.value?.lookup || storedNationwideLookupResult.value)
			return null;

		const response = await api<LocationLookupResponse>("/location", {
			body: {
				q: activeLookupQuery.value.lookup,
				...(activeLookupQuery.value.selection ? { selectionId: activeLookupQuery.value.selection } : {})
			},
			method: "POST"
		});

		return normalizeLookupResponseForDisplay(response, null);
	},
	{
		default: () => null,
		watch: [activeLookupQuery, storedNationwideLookupResult]
	}
);
const activeResult = computed(() =>
	storedNationwideLookupResult.value
	?? routeLookupResult.value
	?? savedLookupResult.value
);
const shouldShowResultsSkeleton = computed(() => !activeResult.value && !isHydrated.value && Boolean(activeLookupQuery.value?.lookup));
const activeLookupSummary = computed(() => buildActiveLookupSummary({
	nationwideLookupResult: activeResult.value,
	routeLookupQuery: activeLookupQuery.value?.lookup ?? null,
	selectedLocation: null
}));
const locationGuessUi = computed(() => buildLocationGuessUiContent(coverageData.value?.locationGuess ?? null));
const hasVisibleActions = computed(() => activeResult.value
	? filterLookupActionsForPresentation(activeResult.value.actions, {
		...activeResult.value,
		location: activeResult.value.location ?? undefined,
	}).length > 0
	: false);

async function openResultGuide(action: LocationLookupAction) {
	if (!activeResult.value || !action.electionSlug || !action.location)
		return;
	const destination = buildPublishedGuideDestination({
		...activeResult.value,
		electionSlug: action.electionSlug,
		location: action.location,
	});
	if (destination)
		await navigateTo(destination);
}

async function selectLookupOption(option: LocationLookupSelectionOption) {
	if (!activeResult.value?.lookupQuery)
		return;

	const activeElection = activeResult.value.election ?? null;
	const response = await api<LocationLookupResponse>("/location", {
		body: {
			q: activeResult.value.lookupQuery,
			selectionId: option.id
		},
		method: "POST"
	});

	civicStore.setLookupResponse(response, activeElection);

	const redirectTarget = resolveLookupDestination(response);

	if (redirectTarget) {
		await navigateTo(redirectTarget);
		return;
	}

	if (response.location && response.electionSlug) {
		await navigateTo(buildPublishedGuideDestination(response) ?? `/elections/${response.electionSlug}`);
		return;
	}

	civicStore.setNationwideLookupResult(normalizeLookupResponseForDisplay(response, activeElection));
}

usePageSeo({
	description: "Results for your area, including district matches, representative records, and official election tools.",
	path: "/results",
	robots: "noindex,nofollow",
	title: "Results for Your Area"
});
</script>

<template>
	<section class="app-shell section-gap space-y-8">
		<div v-if="shouldShowResultsSkeleton" class="space-y-6">
			<div class="surface-panel bg-white/70 h-56 animate-pulse dark:bg-app-panel-dark/70" />
			<div class="surface-panel bg-white/70 h-[34rem] animate-pulse dark:bg-app-panel-dark/70" />
		</div>

		<div v-else-if="!activeResult" class="surface-panel max-w-4xl">
			<div class="flex flex-wrap gap-2">
				<TrustBadge label="No saved location" tone="warning" />
				<TrustBadge label="Start with an address or ZIP" />
			</div>
			<p class="text-xs text-app-muted tracking-[0.24em] font-semibold mt-6 uppercase dark:text-app-muted-dark">
				Results
			</p>
			<h1 class="text-4xl text-app-ink leading-tight font-serif mt-3 sm:text-5xl dark:text-app-text-dark">
				Results for your area are not loaded
			</h1>
			<p class="text-base text-app-muted leading-8 mt-5 dark:text-app-muted-dark">
				{{ locationGuessUi.resultsEmpty }}
			</p>
			<div class="mt-6 flex flex-wrap gap-3">
				<NuxtLink to="/" class="btn-primary">
					Open lookup
				</NuxtLink>
				<NuxtLink to="/coverage" class="btn-secondary">
					Open coverage profile
				</NuxtLink>
			</div>
		</div>

		<template v-else>
			<section class="results-overview">
				<div class="flex flex-wrap gap-2">
					<TrustBadge label="Current results" tone="accent" />
					<TrustBadge v-if="hasVisibleActions" label="Official tools visible" />
					<TrustBadge
						:label="activeResult.guideContent?.verifiedContestPackage
							? 'Verified ballot guide'
							: activeResult.guideAvailability === 'published'
								? 'Election overview available'
								: 'Local guide not published'"
						:tone="activeResult.guideAvailability === 'published' ? 'accent' : 'warning'"
					/>
				</div>
				<div class="mt-6 flex flex-wrap gap-6 items-end justify-between">
					<div>
						<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
							Results for
						</p>
						<h1 class="text-4xl text-app-ink leading-tight font-serif mt-3 sm:text-5xl dark:text-app-text-dark">
							{{ activeLookupSummary.label }}
						</h1>
					</div>
					<UpdatedAt v-if="activeLookupSummary.resolvedAt" :value="activeLookupSummary.resolvedAt" label="Lookup updated" />
				</div>
				<p class="text-sm text-app-muted leading-7 mt-5 max-w-3xl dark:text-app-muted-dark">
					{{ activeLookupSummary.note }}
				</p>
				<nav class="results-shortcuts mt-5" aria-label="Explore results">
					<NuxtLink v-if="activeResult.districtMatches.length" :to="buildNationwideRouteTarget('/districts', activeResult)" class="btn-secondary">
						Districts <span class="text-xs">{{ activeResult.districtMatches.length }}</span>
					</NuxtLink>
					<NuxtLink v-if="activeResult.representativeMatches.length" :to="buildNationwideRouteTarget('/representatives', activeResult)" class="btn-secondary">
						Representatives <span class="text-xs">{{ activeResult.representativeMatches.length }}</span>
					</NuxtLink>
					<a v-if="hasVisibleActions" href="#official-tools" class="btn-secondary">Official tools <span class="i-carbon-arrow-down" aria-hidden="true" /></a>
				</nav>
			</section>
			<LocationChangePanel :election="activeResult.election" />
			<LookupResultsPanel :lookup="activeResult" results-page @open-guide="openResultGuide" @select-option="selectLookupOption" />
		</template>
	</section>
</template>
