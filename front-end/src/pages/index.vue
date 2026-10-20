<script setup lang="ts">
import type {
	ElectionsResponse,
	LocationLookupAction,
	LocationLookupResponse,
	LocationLookupSelectionOption,
	NationwideLookupResultContext
} from "~/types/civic";
import { calendarDaysUntil, describeDaysAway } from "~/utils/election-timeline";
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
const { displayTimeZone, formatDate } = useFormatters();
const upcomingElection = computed(() => {
	const election = featuredElection.value;

	if (!election?.date)
		return null;

	const daysAway = calendarDaysUntil(election.date, new Date(), displayTimeZone.value);

	return daysAway < 0
		? null
		: { ...election, daysAway, relativeLabel: describeDaysAway(daysAway) };
});
const howItWorksSteps = [
	{
		description: "A full street address gives the most precise match. A ZIP code works too.",
		icon: "i-carbon-location",
		title: "Enter your address"
	},
	{
		description: "See the districts you live in and the officials who represent you now.",
		icon: "i-carbon-map",
		title: "See who represents you"
	},
	{
		description: "Get key dates and links to official tools for registration, polling places, and sample ballots.",
		icon: "i-carbon-checkmark-outline",
		title: "Check official voting details"
	}
];
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
	<div class="home-page pb-8 space-y-12 sm:space-y-16">
		<section v-if="upcomingElection" class="home-section app-shell" aria-label="Upcoming election">
			<NuxtLink :to="`/elections/${upcomingElection.slug}`" class="home-election-banner group focus-ring" prefetch-on="interaction">
				<span class="home-election-banner__icon" aria-hidden="true">
					<span class="i-carbon-calendar-heat-map" />
				</span>
				<span class="min-w-0">
					<span class="text-sm text-app-muted block dark:text-app-muted-dark">{{ upcomingElection.locationName }}</span>
					<span class="text-base text-app-ink font-semibold block sm:text-lg dark:text-app-text-dark">
						Election Day is {{ formatDate(upcomingElection.date) }}
						<span class="home-election-banner__count">{{ upcomingElection.relativeLabel }}</span>
					</span>
				</span>
				<span class="text-app-accent font-semibold ml-auto shrink-0 gap-1.5 hidden items-center sm:inline-flex">
					Key dates and deadlines
					<span class="i-carbon-arrow-right transition group-hover:translate-x-0.5" aria-hidden="true" />
				</span>
			</NuxtLink>
		</section>

		<section class="home-section app-shell">
			<div class="home-entry-grid">
				<div class="home-intro">
					<p class="eyebrow">
						Nonpartisan public-interest project
					</p>
					<h1 class="home-title text-app-ink font-serif dark:text-app-text-dark">
						Find your ballot, districts, and officials.
					</h1>
					<p class="home-description text-app-ink-soft dark:text-app-muted-dark">
						Enter your address to see who represents you, what is on your ballot where we have a published guide, and where to confirm every detail with official election offices.
					</p>
					<div v-if="hasNationwideResultContext || hasGuideShellContext || hasVerifiedGuideContext" class="home-resume">
						<p class="text-sm text-app-muted dark:text-app-muted-dark">
							Your saved area<span v-if="activeNationwideResult?.location">: <strong class="text-app-ink dark:text-app-text-dark">{{ activeNationwideResult.location.displayName }}</strong></span>
						</p>
						<NuxtLink :to="resumeTarget" class="btn-primary mt-3" prefetch-on="interaction">
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

		<section class="home-section app-shell" aria-labelledby="home-steps-title">
			<h2 id="home-steps-title" class="text-2xl text-app-ink font-serif sm:text-3xl dark:text-app-text-dark">
				How it works
			</h2>
			<ol class="home-steps mt-6">
				<li v-for="(step, index) in howItWorksSteps" :key="step.title" class="home-step">
					<span class="home-step__number" aria-hidden="true">{{ index + 1 }}</span>
					<div>
						<h3 class="text-lg text-app-ink font-semibold dark:text-app-text-dark">
							{{ step.title }}
						</h3>
						<p class="text-[0.95rem] text-app-muted leading-relaxed mt-1.5 dark:text-app-muted-dark">
							{{ step.description }}
						</p>
					</div>
				</li>
			</ol>
			<p class="text-sm text-app-muted mt-6 dark:text-app-muted-dark">
				Ballot Clarity is not an official election website. Guide coverage varies by area —
				<NuxtLink to="/coverage" class="primary-link">
					see what is covered
				</NuxtLink>.
			</p>
		</section>

		<section class="home-help app-shell" aria-labelledby="home-help-title">
			<div>
				<h2 id="home-help-title" class="text-2xl text-app-ink font-serif sm:text-3xl dark:text-app-text-dark">
					Not ready to enter an address?
				</h2>
				<p class="text-[0.95rem] text-app-muted leading-relaxed mt-3 dark:text-app-muted-dark">
					You can search public records or browse every source the site cites without sharing a location.
				</p>
				<div class="mt-5 flex flex-wrap gap-3">
					<NuxtLink to="/search" class="btn-secondary">
						<span class="i-carbon-search" aria-hidden="true" /> Search records
					</NuxtLink>
					<NuxtLink to="/sources" class="btn-secondary">
						Browse sources
					</NuxtLink>
				</div>
			</div>
			<div>
				<h2 class="sr-only">
					Common questions
				</h2>
				<details v-for="entry in faqEntries" :key="entry.question" class="home-faq">
					<summary class="text-base text-app-ink font-semibold dark:text-app-text-dark focus-ring">
						{{ entry.question }}
						<span class="home-faq__chevron i-carbon-chevron-down" aria-hidden="true" />
					</summary>
					<p class="text-[0.95rem] text-app-muted leading-relaxed mt-1 pb-2 dark:text-app-muted-dark">
						{{ entry.answer }}
					</p>
				</details>
			</div>
		</section>
	</div>
</template>
