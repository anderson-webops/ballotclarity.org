<script setup lang="ts">
import type { LocationLookupResponse, LocationLookupSelectionOption } from "~/types/civic";
import { storeToRefs } from "pinia";
import { buildActiveLookupSummary } from "~/utils/active-lookup";
import { activeNationwideLookupCookieName, parseActiveNationwideLookupCookie } from "~/utils/active-nationwide-cookie";
import { buildLocationGuessUiContent } from "~/utils/location-guess";
import { normalizeLookupResponseForDisplay, resolveLookupDestination } from "~/utils/nationwide-results";
import { buildLookupContextFromNationwideResult, buildNationwideLookupRouteQuery, buildNationwideRouteTarget } from "~/utils/nationwide-route-context";
import { buildResultsSummaryItems } from "~/utils/results-summary";

const api = useApiClient();
const route = useRoute();
const civicStore = useCivicStore();
const { data: coverageData } = useCoverage();
const { isHydrated, nationwideLookupResult } = storeToRefs(civicStore);
const { hasPublishedGuideContext } = useGuideEntryGate();
const activeNationwideLookupCookie = useCookie<string | null>(activeNationwideLookupCookieName);
const serverNationwideLookupResult = computed(() => parseActiveNationwideLookupCookie(activeNationwideLookupCookie.value));
const storedNationwideLookupResult = computed(() => isHydrated.value ? nationwideLookupResult.value : serverNationwideLookupResult.value);
const activeLookupQuery = computed(() => buildNationwideLookupRouteQuery(
	buildLookupContextFromNationwideResult(storedNationwideLookupResult.value),
	route.query
));
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
const activeResult = computed(() => storedNationwideLookupResult.value ?? routeLookupResult.value);
const activeLookupSummary = computed(() => buildActiveLookupSummary({
	nationwideLookupResult: activeResult.value,
	routeLookupQuery: activeLookupQuery.value?.lookup ?? null,
	selectedLocation: null
}));
const locationGuessUi = computed(() => buildLocationGuessUiContent(coverageData.value?.locationGuess ?? null));
const officialToolCount = computed(() => activeResult.value?.actions.filter(action => action.kind === "official-verification").length ?? 0);
const summaryItems = computed(() => buildResultsSummaryItems(
	activeResult.value,
	officialToolCount.value,
	route.query
));
function buildLookupAwareTarget(path: string) {
	return buildNationwideRouteTarget(path, buildLookupContextFromNationwideResult(activeResult.value), route.query);
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
		await navigateTo(`/ballot/${response.electionSlug}?location=${response.location.slug}`);
		return;
	}

	civicStore.setNationwideLookupResult(normalizeLookupResponseForDisplay(response, activeElection));
}

usePageSeo({
	description: "Nationwide civic results from the active lookup, including district matches, representative records, and official election tools.",
	path: "/results",
	title: "Nationwide Civic Results"
});
</script>

<template>
	<section class="app-shell section-gap space-y-8">
		<div v-if="!activeResult && !isHydrated" class="space-y-6">
			<div class="surface-panel bg-white/70 h-56 animate-pulse dark:bg-app-panel-dark/70" />
			<div class="surface-panel bg-white/70 h-[34rem] animate-pulse dark:bg-app-panel-dark/70" />
		</div>

		<div v-else-if="!activeResult" class="max-w-3xl">
			<InfoCallout title="Nationwide civic results not loaded" tone="warning">
				{{ locationGuessUi.resultsEmpty }}
			</InfoCallout>
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
			<header class="gap-6 grid xl:grid-cols-[minmax(0,1.1fr)_minmax(22rem,0.9fr)] xl:items-end">
				<div class="surface-panel">
					<div class="flex flex-wrap gap-2">
						<TrustBadge label="Current results" tone="accent" />
						<TrustBadge label="Official tools visible" />
						<TrustBadge
							:label="activeResult.guideContent?.verifiedContestPackage
								? 'Verified local guide'
								: activeResult.guideAvailability === 'published'
									? 'Local guide available'
									: 'Local guide not published'"
							:tone="activeResult.guideAvailability === 'published' ? 'accent' : 'warning'"
						/>
					</div>
					<p class="text-xs text-app-muted tracking-[0.24em] font-semibold mt-6 uppercase dark:text-app-muted-dark">
						Current area
					</p>
					<h1 class="text-5xl text-app-ink leading-tight font-serif mt-3 dark:text-app-text-dark">
						{{ activeLookupSummary.label }}
					</h1>
					<p class="text-base text-app-muted leading-8 mt-5 max-w-3xl dark:text-app-muted-dark">
						Review districts, current officials, official election links, and any available local guide for this area.
					</p>
					<p class="text-sm text-app-muted leading-7 mt-4 max-w-3xl dark:text-app-muted-dark">
						{{ activeLookupSummary.note }}
					</p>
					<div v-if="activeLookupSummary.resolvedAt" class="mt-5">
						<UpdatedAt :value="activeLookupSummary.resolvedAt" label="Lookup updated" />
					</div>
				</div>

				<div class="surface-panel">
					<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
						Browse
					</p>
					<p class="text-sm text-app-muted leading-7 mt-3 dark:text-app-muted-dark">
						{{
							hasPublishedGuideContext
								? "Open the local guide, ballot plan, districts, or representatives for this area."
								: "Open districts, representatives, or coverage for this area."
						}}
					</p>
					<div class="mt-5 flex flex-wrap gap-3">
						<NuxtLink v-if="hasPublishedGuideContext" to="/plan" class="btn-secondary">
							Open ballot plan
						</NuxtLink>
						<NuxtLink v-else :to="buildLookupAwareTarget('/districts')" class="btn-secondary">
							Open districts
						</NuxtLink>
						<NuxtLink v-if="!hasPublishedGuideContext" :to="buildLookupAwareTarget('/representatives')" class="btn-secondary">
							Open representatives
						</NuxtLink>
						<NuxtLink to="/coverage" class="btn-secondary">
							Open coverage profile
						</NuxtLink>
					</div>
				</div>
			</header>

			<section class="surface-panel">
				<PageSummaryStrip :items="summaryItems" />
			</section>

			<section class="surface-panel">
				<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
					Results
				</p>
				<LookupResultsPanel :lookup="activeResult" @select-option="selectLookupOption" />
			</section>

			<section id="change-location" class="surface-panel">
				<div class="gap-6 grid lg:grid-cols-[minmax(0,0.78fr)_minmax(0,1.22fr)] lg:items-start">
					<div>
						<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
							Change location
						</p>
						<h2 class="text-3xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
							Try another address or ZIP code.
						</h2>
						<p class="text-sm text-app-muted leading-7 mt-4 dark:text-app-muted-dark">
							Enter a full street address for the strongest district match, or use a ZIP code when you only need the broader nationwide civic results and official election tools for that area.
						</p>
					</div>
					<AddressLookupForm compact :election="activeResult.election" :framed="false" />
				</div>
			</section>
		</template>
	</section>
</template>
