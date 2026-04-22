<script setup lang="ts">
import type { BallotResponse, ElectionsResponse } from "~/types/civic";
import { storeToRefs } from "pinia";
import { defineAsyncComponent } from "vue";
import { contactEmail } from "~/constants";
import { buildLocationGuessUiContent } from "~/utils/location-guess";
import { buildHomeExperienceState } from "~/utils/nationwide-results";

const api = useApiClient();
const siteUrl = useSiteUrl();
const civicStore = useCivicStore();
const { selectedElection } = storeToRefs(civicStore);
const { activeNationwideResult, hasNationwideResultContext, hasPublishedGuideContext } = useGuideEntryGate();
const AsyncHomeBallotPreviewSection = defineAsyncComponent(() => import("~/components/home/HomeBallotPreviewSection.vue"));
const AsyncHomeRoadmapSection = defineAsyncComponent(() => import("~/components/home/HomeRoadmapSection.vue"));
const AsyncHomeCoverageOverviewSection = defineAsyncComponent(() => import("~/components/home/HomeCoverageOverviewSection.vue"));
const { data: dataSources } = await useDataSources();
const { data: coverageData } = await useCoverage();

const { data: electionsData } = await useAsyncData<ElectionsResponse>(
	"home-elections",
	() => api<ElectionsResponse>("/elections")
);
const featuredElection = computed(() => electionsData.value?.elections[0] ?? null);
const hasFeaturedGuide = computed(() => Boolean(featuredElection.value));
const featuredLaunchTarget = computed(() => coverageData.value?.launchTarget ?? null);
const locationGuessUi = computed(() => buildLocationGuessUiContent(coverageData.value?.locationGuess ?? null));
const roadmapPreview = computed(() => dataSources.value?.categories.slice(0, 3) ?? []);
const guideBallotPath = computed(() => {
	const activeGuideElection = selectedElection.value ?? featuredElection.value;

	return activeGuideElection ? `/ballot/${activeGuideElection.slug}` : "/ballot";
});
const homeExperience = computed(() => buildHomeExperienceState(
	hasNationwideResultContext.value,
	hasPublishedGuideContext.value
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
const startHerePrimaryPath = computed(() => hasPublishedGuideContext.value
	? guideBallotPath.value
	: homeExperience.value.startHerePrimaryPath);
const startHerePrimaryLabel = computed(() => homeExperience.value.startHerePrimaryLabel);
const startHereSecondaryPath = computed(() => hasPublishedGuideContext.value
	? "/plan"
	: hasNationwideResultContext.value
		? "/coverage"
		: "/data-sources");
const startHereSecondaryLabel = computed(() => hasPublishedGuideContext.value
	? "Open ballot plan"
	: hasNationwideResultContext.value
		? "Check coverage"
		: "Read sources");
const pathwayIntro = computed(() => hasPublishedGuideContext.value
	? "Start with the ballot guide, then open other pages only when you need more detail."
	: hasNationwideResultContext.value
		? "Open your results, then move into district pages, representative pages, and official election links."
		: "Enter a location to see districts, current officials, official election links, and whether a guide is available for your area.");

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

interface PrimaryPath {
	description: string;
	label: string;
	prefetchOn?: "interaction";
	to: string;
}

const primaryPaths = computed<PrimaryPath[]>(() => [
	...(hasPublishedGuideContext.value
		? [{
				description: "Open the local guide for your current election.",
				label: "See your ballot",
				to: guideBallotPath.value
			}]
		: [{
				description: hasNationwideResultContext.value
					? "Return to the results for your latest lookup."
					: "Enter a location to load results for your area.",
				label: hasNationwideResultContext.value ? "Open nationwide results" : "Use location lookup",
				to: hasNationwideResultContext.value ? homeExperience.value.primaryLookupPath : "/#location-lookup"
			}]),
	{
		description: hasNationwideResultContext.value
			? "Browse district and representative pages for your area."
			: "Browse district and representative pages.",
		label: "Browse districts and representatives",
		prefetchOn: "interaction",
		to: "/districts"
	},
	{
		description: hasNationwideResultContext.value
			? "See whether a local guide is available for this area."
			: "See which public pages and sources are available.",
		label: hasNationwideResultContext.value ? "Check coverage" : "Check coverage and sources",
		prefetchOn: "interaction",
		to: hasNationwideResultContext.value ? "/coverage" : "/data-sources"
	}
]);

const trustFacts = computed(() => [
	"Nonpartisan nonprofit",
	featuredLaunchTarget.value ? `Guide available for ${featuredLaunchTarget.value.displayName}` : "Guide availability varies by area",
	"Sources linked on every major reading page",
	hasPublishedGuideContext.value ? "Ballot plan available" : "Official election links included where available"
]);
</script>

<template>
	<div class="pb-10 space-y-12 sm:space-y-16">
		<section class="app-shell">
			<div class="gap-6 grid xl:grid-cols-[minmax(0,1.18fr)_minmax(21rem,0.82fr)] xl:items-start">
				<div class="border border-app-line rounded-[2.2rem] bg-white shadow-[0_36px_84px_-58px_rgba(16,37,62,0.62)] overflow-hidden dark:border-app-line-dark dark:bg-app-panel-dark">
					<div class="px-6 py-8 lg:px-10 sm:px-8 sm:py-10">
						<p class="text-xs text-app-muted tracking-[0.26em] font-semibold uppercase dark:text-app-muted-dark">
							{{ hasPublishedGuideContext ? "Ballot guide" : hasNationwideResultContext ? "Civic results" : "Location lookup" }}
						</p>
						<h1 class="text-5xl text-app-ink leading-tight font-serif mt-4 max-w-4xl sm:text-6xl dark:text-app-text-dark">
							{{ hasPublishedGuideContext ? "Your ballot guide is ready." : hasNationwideResultContext ? "Your civic results are ready." : "Look up your area." }}
						</h1>
						<p class="bc-measure text-lg text-app-muted leading-8 mt-6 dark:text-app-muted-dark">
							{{ hasPublishedGuideContext
								? "Open your ballot, districts, representatives, and official election links from one place."
								: hasNationwideResultContext
									? "Review districts, current officials, official election links, and any available local guide for this area."
									: "Enter a street address or ZIP code to see districts, current officials, and official election links for your area." }}
						</p>
						<p v-if="featuredLaunchTarget" class="text-sm text-app-muted leading-7 mt-5 dark:text-app-muted-dark">
							<strong class="text-app-ink dark:text-app-text-dark">Guide available:</strong> {{ featuredLaunchTarget.displayName }}.
						</p>
						<p v-else class="text-sm text-app-muted leading-7 mt-5 dark:text-app-muted-dark">
							<strong class="text-app-ink dark:text-app-text-dark">Guide status:</strong> No local guide is published in this environment right now.
						</p>
						<p v-if="activeNationwideResult?.location" class="text-sm text-app-muted leading-7 mt-4 dark:text-app-muted-dark">
							<strong class="text-app-ink dark:text-app-text-dark">Current area:</strong> {{ activeNationwideResult.location.displayName }}.
						</p>

						<div class="mt-8 gap-4 grid md:grid-cols-2 xl:grid-cols-4">
							<div
								v-for="fact in trustFacts"
								:key="fact"
								class="px-4 py-4 border border-app-line/80 rounded-[1.5rem] bg-app-bg/70 dark:border-app-line-dark dark:bg-app-bg-dark/70"
							>
								<p class="text-sm text-app-ink leading-6 font-medium dark:text-app-text-dark">
									{{ fact }}
								</p>
							</div>
						</div>
					</div>
				</div>

				<div class="space-y-5">
					<div id="location-lookup" class="surface-panel">
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
							<AddressLookupForm compact :election="featuredElection" :framed="false" />
						</div>
					</div>

					<div class="surface-panel">
						<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
							Next steps
						</p>
						<h2 class="text-2xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
							Open the page you need.
						</h2>
						<p class="text-sm text-app-muted leading-7 mt-4 dark:text-app-muted-dark">
							{{ hasPublishedGuideContext
								? "Start with the ballot guide, then open other pages only when you need more detail."
								: hasNationwideResultContext
									? "Start with your results, then open districts, representatives, or sources."
									: "Start with lookup, then open results, districts, representatives, or sources." }}
						</p>
						<div class="mt-6 flex flex-wrap gap-3">
							<NuxtLink :to="startHerePrimaryPath" class="btn-primary" prefetch-on="interaction">
								{{ startHerePrimaryLabel }}
							</NuxtLink>
							<NuxtLink :to="startHereSecondaryPath" class="btn-secondary" prefetch-on="interaction">
								{{ startHereSecondaryLabel }}
							</NuxtLink>
						</div>
					</div>
				</div>
			</div>
		</section>

		<section class="app-shell">
			<div class="gap-6 grid lg:grid-cols-[minmax(0,0.52fr)_minmax(0,1fr)] lg:items-start">
				<div>
					<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
						Primary pathways
					</p>
					<h2 class="text-4xl text-app-ink font-serif mt-3 max-w-xl dark:text-app-text-dark">
						Start with the task you are trying to complete.
					</h2>
					<p class="bc-measure text-base text-app-muted leading-8 mt-5 dark:text-app-muted-dark">
						{{ pathwayIntro }}
					</p>
				</div>

				<div class="divide-app-line divide-y dark:divide-app-line-dark">
					<NuxtLink
						v-for="path in primaryPaths"
						:key="path.label"
						:to="path.to"
						:prefetch-on="path.prefetchOn"
						class="py-5 flex flex-col gap-3 transition hover:text-app-accent focus-ring"
					>
						<div class="flex gap-4 items-center justify-between">
							<h3 class="text-2xl text-app-ink font-serif dark:text-app-text-dark">
								{{ path.label }}
							</h3>
							<span class="i-carbon-arrow-right text-lg text-app-accent" aria-hidden="true" />
						</div>
						<p class="text-sm text-app-muted leading-7 max-w-3xl dark:text-app-muted-dark">
							{{ path.description }}
						</p>
					</NuxtLink>
				</div>
			</div>
		</section>

		<DeferredSection placeholder-class="min-h-[38rem]">
			<AsyncHomeBallotPreviewSection
				:allow-guide-entry-points="hasPublishedGuideContext"
				:ballot-preview="shouldShowFeaturedGuidePreview ? ballotPreview : null"
				:featured-election-slug="featuredElection?.slug ?? null"
				:nationwide-lookup-result="activeNationwideResult"
				:show-featured-guide-preview="shouldShowFeaturedGuidePreview"
			/>
		</DeferredSection>

		<DeferredSection placeholder-class="min-h-[26rem]">
			<AsyncHomeRoadmapSection :roadmap-preview="roadmapPreview" />
		</DeferredSection>

		<DeferredSection placeholder-class="min-h-[24rem]">
			<AsyncHomeCoverageOverviewSection />
		</DeferredSection>
	</div>
</template>
