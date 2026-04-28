<script setup lang="ts">
import type {
	BallotResponse,
	ElectionsResponse,
	LocationLookupAction,
	LocationLookupResponse,
	LocationLookupSelectionOption,
	NationwideLookupResultContext
} from "~/types/civic";
import { defineAsyncComponent } from "vue";
import { contactEmail } from "~/constants";
import { buildLocationGuessUiContent } from "~/utils/location-guess";
import { buildPublishedGuideDestination } from "~/utils/location-lookup";
import { buildHomeExperienceState, normalizeLookupResponseForDisplay, resolveLookupDestination } from "~/utils/nationwide-results";

const api = useApiClient();
const siteUrl = useSiteUrl();
const civicStore = useCivicStore();
const { activeNationwideResult, hasGuideShellContext, hasNationwideResultContext, hasVerifiedGuideContext } = useGuideEntryGate();
const AsyncHomeBallotPreviewSection = defineAsyncComponent(() => import("~/components/home/HomeBallotPreviewSection.vue"));
const AsyncHomeRoadmapSection = defineAsyncComponent(() => import("~/components/home/HomeRoadmapSection.vue"));
const AsyncHomeCoverageOverviewSection = defineAsyncComponent(() => import("~/components/home/HomeCoverageOverviewSection.vue"));
const { data: dataSources } = await useDataSources();
const { data: coverageData } = await useCoverage();
const homeLookupResult = ref<NationwideLookupResultContext | null>(null);
const homeLookupSelectionError = ref("");
const displayedHomeLookupResult = computed(() => homeLookupResult.value);

const { data: electionsData } = await useAsyncData<ElectionsResponse>(
	"home-elections",
	() => api<ElectionsResponse>("/elections")
);
const featuredElection = computed(() => electionsData.value?.elections[0] ?? null);
const hasFeaturedGuide = computed(() => Boolean(featuredElection.value));
const locationGuessUi = computed(() => buildLocationGuessUiContent(coverageData.value?.locationGuess ?? null));
const roadmapPreview = computed(() => dataSources.value?.categories.slice(0, 3) ?? []);
const homeExperience = computed(() => buildHomeExperienceState(
	hasNationwideResultContext.value,
	hasGuideShellContext.value,
	hasVerifiedGuideContext.value
));
const shouldShowFeaturedGuidePreview = computed(() => homeExperience.value.showFeaturedGuidePreview && hasFeaturedGuide.value);

const { data: ballotPreview } = await useAsyncData<BallotResponse | null>(
	"home-preview-ballot",
	() => shouldShowFeaturedGuidePreview.value && featuredElection.value
		? api<BallotResponse>("/ballot", {
				query: {
					election: featuredElection.value.slug
				}
			})
		: Promise.resolve(null),
	{
		default: () => null,
		watch: [featuredElection, shouldShowFeaturedGuidePreview]
	}
);
const faqEntries = [
	{
		answer: "Start with the location lookup. Ballot Clarity shows districts, representatives, official election links, and a local guide when one is published for your area.",
		question: "How should a voter use Ballot Clarity?"
	},
	{
		answer: "No. Ballot Clarity is designed as a nonpartisan public-interest guide that separates neutral summaries, evidence links, and methodology from advocacy.",
		question: "Does Ballot Clarity endorse candidates or measures?"
	},
	{
		answer: "Each major page links back to source files, official records, or clearly labeled archive materials so readers can verify the underlying evidence directly.",
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
					"email": `mailto:${contactEmail}`
				}
			],
			"description": "A nonprofit, nonpartisan website providing source-cited ballot and voting information for local elections.",
			"name": "Ballot Clarity",
			"url": `${siteUrl}/`
		},
		{
			"@context": "https://schema.org",
			"@type": "WebSite",
			"description": "A nonprofit, nonpartisan website providing source-cited ballot and voting information for local elections.",
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

const trustFacts = computed(() => [
	"Nonpartisan nonprofit",
	activeNationwideResult.value?.location
		? `Current area: ${activeNationwideResult.value.location.displayName}`
		: "Districts and officials vary by area",
	"Sources linked on every major reading page",
	hasVerifiedGuideContext.value
		? "Ballot plan available"
		: hasGuideShellContext.value
			? "Election overview available"
			: "Official election links included where available"
]);

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
	<div class="home-page pb-10 space-y-12 sm:space-y-16">
		<section class="home-section app-shell">
			<div class="home-hero-grid gap-6 grid xl:grid-cols-[minmax(0,1.18fr)_minmax(21rem,0.82fr)] xl:items-start">
				<div class="home-card surface-primary overflow-hidden">
					<div class="px-6 py-8 lg:px-10 sm:px-8 sm:py-10">
						<p class="text-xs text-app-muted tracking-[0.26em] font-semibold uppercase dark:text-app-muted-dark">
							{{ hasVerifiedGuideContext ? "Ballot guide" : hasGuideShellContext ? "Election overview" : hasNationwideResultContext ? "Civic results" : "Location lookup" }}
						</p>
						<h1 class="text-5xl text-app-ink leading-tight font-serif mt-4 max-w-4xl sm:text-6xl dark:text-app-text-dark">
							{{ hasVerifiedGuideContext
								? "Your ballot guide is ready."
								: hasGuideShellContext
									? "Your election overview is ready."
									: hasNationwideResultContext
										? "Your civic results are ready."
										: "Look up your area." }}
						</h1>
						<p class="bc-measure text-lg text-app-muted leading-8 mt-6 dark:text-app-muted-dark">
							{{ hasVerifiedGuideContext
								? "Open your ballot, districts, representatives, and official election links from one place."
								: hasGuideShellContext
									? "Open the election overview, districts, representatives, and official election links for this area."
									: hasNationwideResultContext
										? "Review districts, current officials, official election links, and any available local guide for this area."
										: "Enter a street address or ZIP code to see districts, current officials, and official election links for your area." }}
						</p>
						<div class="mt-8 flex flex-wrap gap-2">
							<span
								v-for="fact in trustFacts"
								:key="fact"
								class="text-xs text-app-muted tracking-[0.08em] font-semibold px-3 py-2 border border-app-line/75 rounded-full bg-app-bg/72 uppercase dark:text-app-muted-dark dark:border-app-line-dark dark:bg-app-bg-dark/70"
							>
								{{ fact }}
							</span>
						</div>
					</div>
				</div>

				<div class="home-panel-stack space-y-5">
					<div id="location-lookup" class="home-card surface-primary">
						<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
							Choose your area
						</p>
						<h2 class="text-2xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
							Start from your location.
						</h2>
						<p class="text-sm text-app-muted leading-7 mt-4 dark:text-app-muted-dark">
							{{ locationGuessUi.home }}
						</p>
						<div class="mt-5">
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

		<DeferredSection placeholder-class="min-h-[10rem] sm:min-h-[14rem]">
			<AsyncHomeBallotPreviewSection
				:allow-guide-entry-points="hasVerifiedGuideContext"
				:ballot-preview="shouldShowFeaturedGuidePreview ? ballotPreview : null"
				:featured-election-slug="featuredElection?.slug ?? null"
				:nationwide-lookup-result="displayedHomeLookupResult ? null : activeNationwideResult"
				:show-featured-guide-preview="shouldShowFeaturedGuidePreview"
			/>
		</DeferredSection>

		<DeferredSection placeholder-class="min-h-[8rem] sm:min-h-[10rem]">
			<AsyncHomeRoadmapSection :roadmap-preview="roadmapPreview" />
		</DeferredSection>

		<DeferredSection placeholder-class="min-h-[8rem] sm:min-h-[10rem]">
			<AsyncHomeCoverageOverviewSection />
		</DeferredSection>
	</div>
</template>
