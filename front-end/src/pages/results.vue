<script setup lang="ts">
import type { LocationLookupResponse, LocationLookupSelectionOption } from "~/types/civic";
import { storeToRefs } from "pinia";
import { buildLocationGuessUiContent } from "~/utils/location-guess";
import { normalizeLookupResponseForDisplay, resolveLookupDestination } from "~/utils/nationwide-results";

const api = useApiClient();
const civicStore = useCivicStore();
const { data: coverageData } = useCoverage();
const { isHydrated, nationwideLookupResult } = storeToRefs(civicStore);
const { hasPublishedGuideContext } = useGuideEntryGate();

const activeResult = computed(() => isHydrated.value ? nationwideLookupResult.value : null);
const locationGuessUi = computed(() => buildLocationGuessUiContent(coverageData.value?.locationGuess ?? null));
const activeLocationLabel = computed(() => activeResult.value?.location?.displayName ?? activeResult.value?.normalizedAddress ?? "Nationwide civic results");
const officialToolCount = computed(() => activeResult.value?.actions.filter(action => action.kind === "official-verification").length ?? 0);
const summaryItems = computed(() => ([
	{
		label: "District matches",
		note: "Matched through the current provider-backed lookup.",
		value: activeResult.value?.districtMatches.length ?? 0
	},
	{
		label: "Representatives",
		note: "Current representative records linked below when available.",
		value: activeResult.value?.representativeMatches.length ?? 0
	},
	{
		label: "Official tools",
		note: "State and county election links kept in the active lookup context.",
		value: officialToolCount.value
	},
	{
		label: "Guide status",
		note: "Ballot plan and local guide pages remain guide-only.",
		value: activeResult.value?.guideAvailability === "published" ? "Published" : "Not published"
	}
]));

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
		<div v-if="!isHydrated" class="space-y-6">
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
						<TrustBadge label="Nationwide civic results" tone="accent" />
						<TrustBadge label="Official tools visible" />
						<TrustBadge label="Guide-dependent flows remain guide-only" tone="warning" />
					</div>
					<p class="text-xs text-app-muted tracking-[0.24em] font-semibold mt-6 uppercase dark:text-app-muted-dark">
						Active lookup context
					</p>
					<h1 class="text-5xl text-app-ink leading-tight font-serif mt-3 dark:text-app-text-dark">
						{{ activeLocationLabel }}
					</h1>
					<p class="text-base text-app-muted leading-8 mt-5 max-w-3xl dark:text-app-muted-dark">
						This page is the first-class nationwide civic results view for the latest successful lookup. It carries district matches, representative records, availability status, and official election tools across the app even when Ballot Clarity does not yet have a published local guide for this area.
					</p>
				</div>

				<div class="surface-panel">
					<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
						Current limits
					</p>
					<p class="text-sm text-app-muted leading-7 mt-3 dark:text-app-muted-dark">
						The ballot plan, compare flow, and local ballot-guide pages remain guide-dependent and open only after Ballot Clarity confirms a published local guide for the active lookup. Until then, nationwide civic results and official tools are the main cross-page context.
					</p>
					<div class="mt-5 flex flex-wrap gap-3">
						<NuxtLink v-if="hasPublishedGuideContext" to="/plan" class="btn-secondary">
							Open ballot plan
						</NuxtLink>
						<NuxtLink v-else to="/districts" class="btn-secondary">
							Open districts
						</NuxtLink>
						<NuxtLink v-if="!hasPublishedGuideContext" to="/representatives" class="btn-secondary">
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
					Nationwide results
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
