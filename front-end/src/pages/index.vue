<script setup lang="ts">
import type {
	ElectionsResponse,
	LocationLookupAction,
	LocationLookupResponse,
	LocationLookupSelectionOption,
	NationwideLookupResultContext
} from "~/types/civic";
import { buildPublishedGuideDestination } from "~/utils/location-lookup";
import { normalizeLookupResponseForDisplay, resolveLookupDestination } from "~/utils/nationwide-results";
import { buildNationwideRouteTarget } from "~/utils/nationwide-route-context";

const api = useApiClient();
const siteUrl = useSiteUrl();
const civicStore = useCivicStore();
const { activeNationwideResult, hasGuideShellContext, hasNationwideResultContext, hasVerifiedGuideContext } = useGuideEntryGate();
const homeLookupResult = ref<NationwideLookupResultContext | null>(null);
const homeLookupSelectionError = ref("");
const displayedHomeLookupResult = computed(() => homeLookupResult.value);

const { data: electionsData } = await useAsyncData<ElectionsResponse>(
	"home-elections",
	() => api<ElectionsResponse>("/elections")
);
const featuredElection = computed(() => electionsData.value?.elections[0] ?? null);
const faqEntries = [
	{
		answer: "Start with the location lookup. Ballot Clarity shows districts, representatives, official election links, and a local guide when one is published for your area.",
		question: "How should a voter use Ballot Clarity?"
	},
	{
		answer: "No. Ballot Clarity is designed as a nonpartisan public-interest guide that separates neutral summaries, source links, and methodology from advocacy.",
		question: "Does Ballot Clarity endorse candidates or measures?"
	},
	{
		answer: "Each major page links back to source files, official records, or clearly labeled supporting materials so readers can verify the underlying records directly.",
		question: "Where does the site get its ballot information?"
	}
];

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
		},
		{
			"@context": "https://schema.org",
			"@type": "FAQPage",
			"mainEntity": faqEntries.map(entry => ({
				"@type": "Question",
				"acceptedAnswer": {
					"@type": "Answer",
					"text": entry.answer
				},
				"name": entry.question
			}))
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
	<div class="home-page pb-8 space-y-10 sm:space-y-14">
		<section class="home-section app-shell">
			<div class="home-entry-grid">
				<div class="home-intro">
					<p class="text-xs text-app-muted tracking-[0.2em] font-semibold uppercase dark:text-app-muted-dark">
						Ballot Clarity · Public records, explained
					</p>
					<h1 class="home-title text-app-ink font-serif dark:text-app-text-dark">
						Look up your area.
					</h1>
					<p class="home-description text-app-muted dark:text-app-muted-dark">
						Find your districts, explore representative records, and reach official election resources. Start with a street address or ZIP code.
					</p>
					<div v-if="hasNationwideResultContext || hasGuideShellContext || hasVerifiedGuideContext" class="home-resume">
						<p class="text-sm text-app-muted dark:text-app-muted-dark">
							Your saved area<span v-if="activeNationwideResult?.location">: <strong class="text-app-ink dark:text-app-text-dark">{{ activeNationwideResult.location.displayName }}</strong></span>
						</p>
						<NuxtLink :to="resumeTarget" class="btn-secondary mt-3" prefetch-on="interaction">
							{{ hasVerifiedGuideContext ? 'Continue to your ballot guide' : hasGuideShellContext ? 'Continue to your election overview' : 'Continue to your results' }}
							<span class="i-carbon-arrow-right" aria-hidden="true" />
						</NuxtLink>
					</div>
				</div>
				<div id="location-lookup" class="home-lookup-card surface-primary">
					<AddressLookupForm
						compact
						:election="featuredElection"
						:framed="false"
						:show-inline-results="false"
						@lookup-cleared="clearHomeLookupResult"
						@lookup-resolved="handleHomeLookupResolved"
					/>
				</div>
			</div>
			<div class="home-trust-row text-sm text-app-muted dark:text-app-muted-dark">
				<span class="inline-flex gap-2 items-center"><span class="i-carbon-document" aria-hidden="true" /> Source links on every major reading page</span>
				<span>Nonpartisan public-interest project</span>
				<NuxtLink to="/coverage" class="underline underline-offset-4 focus-ring">
					Check coverage
				</NuxtLink>
			</div>
		</section>

		<section v-if="displayedHomeLookupResult" class="home-section app-shell">
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
		<section class="home-help app-shell" aria-labelledby="home-help-title">
			<div>
				<h2 id="home-help-title" class="text-2xl text-app-ink font-serif dark:text-app-text-dark">
					A little context before you explore
				</h2>
				<p class="text-sm text-app-muted leading-7 mt-3 dark:text-app-muted-dark">
					Local guide coverage varies. You can also explore the public record without entering a location.
				</p>
				<div class="mt-4 flex flex-wrap gap-3">
					<NuxtLink to="/search" class="btn-secondary">
						Search records <span class="i-carbon-search" aria-hidden="true" />
					</NuxtLink>
					<NuxtLink to="/sources" class="btn-secondary">
						Browse sources
					</NuxtLink>
				</div>
			</div>
			<div>
				<details v-for="entry in faqEntries" :key="entry.question" class="home-faq">
					<summary class="text-sm text-app-ink font-semibold dark:text-app-text-dark focus-ring">
						{{ entry.question }}
					</summary>
					<p class="text-sm text-app-muted leading-7 mt-3 dark:text-app-muted-dark">
						{{ entry.answer }}
					</p>
				</details>
			</div>
		</section>
	</div>
</template>
