<script setup lang="ts">
import type { LocationLookupAction, LocationLookupResponse, LocationLookupSelectionOption } from "~/types/civic";
import { storeToRefs } from "pinia";
import { buildActiveLookupSummary } from "~/utils/active-lookup";
import { needsBallotPreviewRefresh, restoreMatchingBallotPreviews } from "~/utils/ballot-preview-refresh";
import { buildLocationGuessUiContent } from "~/utils/location-guess";
import { buildPublishedGuideDestination } from "~/utils/location-lookup";
import { normalizeLookupResponseForDisplay, resolveLookupDestination } from "~/utils/nationwide-results";
import { buildLookupContextFromNationwideResult, buildNationwideLookupRouteQuery } from "~/utils/nationwide-route-context";

const api = useApiClient();
const route = useRoute();
definePageMeta({ middleware: to => to.hash === "#change-location" ? navigateTo("/#location-lookup", { replace: true }) : undefined });
const civicStore = useCivicStore();
const { data: coverageData } = useCoverage();
const { isHydrated, nationwideLookupResult } = storeToRefs(civicStore);
const storedNationwideLookupResult = computed(() => isHydrated.value ? nationwideLookupResult.value : null);
const shouldRefreshBallotPreviews = computed(() => needsBallotPreviewRefresh(storedNationwideLookupResult.value));
const activeLookupQuery = computed(() => buildNationwideLookupRouteQuery(
	buildLookupContextFromNationwideResult(storedNationwideLookupResult.value),
	route.query
));
const { data: savedLookupResult } = await useAsyncData(
	"results:saved-active-lookup",
	async () => {
		if (activeLookupQuery.value?.lookup && !shouldRefreshBallotPreviews.value)
			return null;

		const response = await api<LocationLookupResponse | null>("/location/active");
		return response ? normalizeLookupResponseForDisplay(response, null) : null;
	},
	{
		default: () => null,
		getCachedData: (key, nuxtApp, context) => context.cause === "initial" ? nuxtApp.payload.data[key] : undefined,
		watch: [activeLookupQuery, shouldRefreshBallotPreviews]
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
const activeResult = computed(() => restoreMatchingBallotPreviews(
	storedNationwideLookupResult.value ?? routeLookupResult.value ?? savedLookupResult.value,
	savedLookupResult.value,
));
const shouldShowResultsSkeleton = computed(() => !activeResult.value && !isHydrated.value && Boolean(activeLookupQuery.value?.lookup));
const activeLookupSummary = computed(() => buildActiveLookupSummary({
	nationwideLookupResult: activeResult.value,
	routeLookupQuery: activeLookupQuery.value?.lookup ?? null,
	selectedLocation: null
}));
const locationGuessUi = computed(() => buildLocationGuessUiContent(coverageData.value?.locationGuess ?? null));
const resultsStatusItems = computed(() => {
	const result = activeResult.value;

	if (!result)
		return [];

	return [
		result.detectedFromIp
			? "Approximate location"
			: result.inputKind === "address" ? "Matched by street address" : "Matched by ZIP code",
		...(result.guideContent?.verifiedContestPackage ? ["Verified ballot guide"] : [])
	];
});

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
	<section class="app-shell section-gap space-y-6">
		<div v-if="shouldShowResultsSkeleton" class="space-y-6">
			<div class="rounded-lg bg-app-bg h-56 animate-pulse dark:bg-app-bg-dark" />
			<div class="rounded-lg bg-app-bg h-[34rem] animate-pulse dark:bg-app-bg-dark" />
		</div>

		<div v-else-if="!activeResult" class="max-w-4xl surface-panel">
			<p class="eyebrow">
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
					Enter your address
				</NuxtLink>
			</div>
		</div>

		<template v-else>
			<section class="results-overview">
				<h1 class="text-4xl text-app-ink leading-tight font-serif mt-2 sm:text-5xl dark:text-app-text-dark">
					{{ activeLookupSummary.label }}
				</h1>
				<p class="results-status-line text-sm text-app-muted mt-4 dark:text-app-muted-dark">
					<span v-for="item in resultsStatusItems" :key="item">{{ item }}</span>
				</p>
				<p v-if="activeResult.detectedFromIp" class="text-sm text-app-muted leading-6 mt-3 max-w-3xl dark:text-app-muted-dark">
					{{ activeLookupSummary.note }}
				</p>
			</section>
			<LookupResultsPanel :lookup="activeResult" results-page @open-guide="openResultGuide" @select-option="selectLookupOption" />
		</template>
	</section>
</template>
