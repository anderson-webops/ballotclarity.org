<script setup lang="ts">
import type {
	ElectionsResponse,
	LocationLookupAction,
	LocationLookupResponse,
	LocationLookupSelectionOption,
	NationwideLookupResultContext
} from "~/types/civic";
import { useNow } from "@vueuse/core";
import { calendarDaysUntil, describeDaysAway } from "~/utils/election-timeline";
import { buildPublishedGuideDestination } from "~/utils/location-lookup";
import { normalizeLookupResponseForDisplay, resolveLookupDestination } from "~/utils/nationwide-results";
import { buildNationwideRouteTarget } from "~/utils/nationwide-route-context";

const api = useApiClient();
const siteUrl = useSiteUrl();
const civicStore = useCivicStore();
const route = useRoute();
const homeLookupForm = ref<{ focusInput: () => void } | null>(null);

async function focusLocationLookup() {
	if (route.hash !== "#location-lookup")
		return;
	await nextTick();
	homeLookupForm.value?.focusInput();
}

watch(() => route.hash, focusLocationLookup);
onMounted(focusLocationLookup);
const { activeNationwideResult, hasGuideShellContext, hasNationwideResultContext, hasVerifiedGuideContext } = useGuideEntryGate();
const homeLookupResult = ref<NationwideLookupResultContext | null>(null);
const homeLookupSelectionError = ref("");
const displayedHomeLookupResult = computed(() => homeLookupResult.value);

const { data: electionsData } = await useAsyncData<ElectionsResponse>(
	"home-elections",
	() => api<ElectionsResponse>("/elections")
);
const featuredElection = computed(() => electionsData.value?.elections[0] ?? null);
const { displayTimeZone, formatDate } = useFormatters();
// The API keeps snapshot order, so pick the soonest election that has not passed yet.
// Ticks each minute so the banner drops a passed election without a reload.
const now = useNow({ interval: 60_000 });
const upcomingElection = computed(() => {
	const upcoming = (electionsData.value?.elections ?? [])
		.filter(election => election.date)
		.map(election => ({ ...election, daysAway: calendarDaysUntil(election.date, now.value, displayTimeZone.value) }))
		.filter(election => election.daysAway >= 0)
		.sort((left, right) => left.daysAway - right.daysAway)[0];

	return upcoming ? { ...upcoming, relativeLabel: describeDaysAway(upcoming.daysAway) } : null;
});

usePageSeo({
	description: "Understand who is on your ballot, what candidates and measures actually say and do, and where the supporting information comes from.",
	jsonLd: [
		{
			"@context": "https://schema.org",
			"@type": "Organization",
			"contactPoint": [
				{
					"@type": "ContactPoint",
					"contactType": "editorial",
					"url": `${siteUrl}/contact`
				}
			],
			"description": "A public-interest, nonpartisan website providing source-cited ballot and voting information for local elections.",
			"name": "Ballot Clarity",
			"url": `${siteUrl}/`
		},
		{
			"@context": "https://schema.org",
			"@type": "WebSite",
			"description": "A public-interest, nonpartisan website providing source-cited ballot and voting information for local elections.",
			"name": "Ballot Clarity",
			"url": `${siteUrl}/`
		}
	],
	path: "/",
	title: "Understand Your Ballot"
});

const resumeTarget = computed(() => hasVerifiedGuideContext.value
	? "/ballot"
	: hasGuideShellContext.value && civicStore.selectedElection?.slug
		? `/elections/${civicStore.selectedElection.slug}`
		: buildNationwideRouteTarget("/results", activeNationwideResult.value));

function clearHomeLookupResult() {
	homeLookupSelectionError.value = "";
	homeLookupResult.value = null;
}

function handleHomeLookupResolved(lookup: NationwideLookupResultContext) {
	homeLookupSelectionError.value = "";
	homeLookupResult.value = lookup;
}

async function openHomeLookupAction(action: LocationLookupAction) {
	if (action.kind !== "ballot-guide" || !action.location || !action.electionSlug)
		return;

	const destination = buildPublishedGuideDestination({
		electionSlug: action.electionSlug,
		guideAvailability: displayedHomeLookupResult.value?.guideAvailability,
		guideContent: displayedHomeLookupResult.value?.guideContent,
		location: action.location,
		selectionOptions: []
	});

	if (destination)
		await navigateTo(destination);
}

async function selectHomeLookupOption(option: LocationLookupSelectionOption) {
	const currentLookup = displayedHomeLookupResult.value;
	const queryValue = currentLookup?.lookupQuery || currentLookup?.normalizedAddress || "";

	if (!queryValue.trim()) {
		homeLookupSelectionError.value = "Enter the location again to load this matched area.";
		return;
	}

	homeLookupSelectionError.value = "";

	try {
		const response = await api<LocationLookupResponse>("/location", {
			body: {
				q: queryValue,
				selectionId: option.id
			},
			method: "POST"
		});
		const normalizedResult = normalizeLookupResponseForDisplay(response, featuredElection.value ?? null);
		civicStore.setLookupResponse(response, featuredElection.value ?? null);
		homeLookupResult.value = normalizedResult;

		const redirectTarget = resolveLookupDestination(response);

		if (redirectTarget)
			await navigateTo(redirectTarget);
		else if (response.location && response.electionSlug)
			await navigateTo(buildPublishedGuideDestination(response) ?? `/elections/${response.electionSlug}`);
	}
	catch (error) {
		homeLookupSelectionError.value = error instanceof Error ? error.message : "Unable to load that matched area right now.";
	}
}
</script>

<template>
	<div class="home-page pb-8">
		<section class="home-section app-shell">
			<div class="home-entry">
				<NuxtLink v-if="upcomingElection" :to="`/elections/${upcomingElection.slug}`" class="home-election-banner group focus-ring" prefetch-on="interaction">
					<span class="text-sm text-app-muted dark:text-app-muted-dark">{{ upcomingElection.locationName }}</span>
					<span class="text-base text-app-ink font-semibold dark:text-app-text-dark">
						Election Day <span>{{ formatDate(upcomingElection.date) }}</span>
						<span class="home-election-banner__count attention-relative">{{ upcomingElection.relativeLabel }}</span>
					</span>
				</NuxtLink>
				<h1 class="home-title text-app-ink font-serif dark:text-app-text-dark">
					Find your ballot, districts, and officials.
				</h1>
				<div id="location-lookup" class="home-lookup-card">
					<AddressLookupForm
						ref="homeLookupForm"
						compact
						:election="featuredElection"
						:framed="false"
						:show-inline-results="false"
						@lookup-cleared="clearHomeLookupResult"
						@lookup-resolved="handleHomeLookupResolved"
					/>
				</div>
				<p v-if="hasNationwideResultContext || hasGuideShellContext || hasVerifiedGuideContext" class="text-base text-app-muted mt-6 dark:text-app-muted-dark">
					<span v-if="activeNationwideResult?.location">{{ activeNationwideResult.location.displayName }} · </span>
					<NuxtLink :to="resumeTarget" class="btn-secondary" prefetch-on="interaction">
						{{ hasVerifiedGuideContext ? 'Your ballot guide' : hasGuideShellContext ? 'Your election overview' : 'Your results' }}
					</NuxtLink>
				</p>
			</div>
		</section>

		<section v-if="displayedHomeLookupResult" class="home-section app-shell mt-12">
			<div class="home-lookup-results-shell surface-panel">
				<LookupResultsPanel
					class="home-lookup-results-panel"
					:compact="false"
					:lookup="displayedHomeLookupResult"
					@open-guide="openHomeLookupAction"
					@select-option="selectHomeLookupOption"
				/>
				<p
					v-if="homeLookupSelectionError"
					role="alert"
					class="text-sm text-[#8f341f] mt-4 dark:text-[#f2a493]"
				>
					{{ homeLookupSelectionError }}
				</p>
			</div>
		</section>
	</div>
</template>
