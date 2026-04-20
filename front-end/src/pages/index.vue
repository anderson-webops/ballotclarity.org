<script setup lang="ts">
import type { BallotResponse, ElectionsResponse } from "~/types/civic";
import { storeToRefs } from "pinia";
import { defineAsyncComponent } from "vue";
import AvailabilityStatusPanel from "~/components/graphics/AvailabilityStatusPanel.vue";
import FactStatCard from "~/components/graphics/FactStatCard.vue";
import HorizontalBarChart from "~/components/graphics/HorizontalBarChart.vue";
import SourceProvenanceStrip from "~/components/graphics/SourceProvenanceStrip.vue";
import { contactEmail } from "~/constants";
import { buildLocationGuessUiContent } from "~/utils/location-guess";
import { buildHomeExperienceState } from "~/utils/nationwide-results";

const api = useApiClient();
const siteUrl = useSiteUrl();
const civicStore = useCivicStore();
const { formatDate } = useFormatters();
const { selectedElection } = storeToRefs(civicStore);
const { activeNationwideResult, blocksGuideEntryPoints, hasNationwideResultContext, hasPublishedGuideContext } = useGuideEntryGate();
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
		? "Check live coverage"
		: "Review sources");
const pathwayIntro = computed(() => hasPublishedGuideContext.value
	? "Start with the ballot guide, then open deeper pages only when you need more detail."
	: hasNationwideResultContext.value
		? "Start from your saved results, then move into district pages, representative pages, and official links."
		: "Enter a location to see districts, current officials, official links, and any published local guide for your area.");

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

const quickStartSteps = computed(() => [
	{
		step: "1",
		text: "Enter a full address for the best district match, or use a 5-digit ZIP code when you need a broader nationwide civic lookup."
	},
	{
		step: "2",
		text: hasPublishedGuideContext.value
			? "Scan contests first, then open detail pages only when you need more depth."
			: hasNationwideResultContext.value
				? "Use the results page to move into districts, representatives, and official election links for your area."
				: "Use the lookup first to see what coverage is available for your area."
	},
	{
		step: "3",
		text: hasPublishedGuideContext.value
			? "Save a plan and print a clean checklist for the voting booth."
			: "Use the official links and public records first. Ballot plan opens when a local guide is published."
	}
]);

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
		description: "See what is published, what remains lookup-only, and which sources are live.",
		label: hasNationwideResultContext.value ? "Check live coverage" : "Check coverage and sources",
		prefetchOn: "interaction",
		to: hasNationwideResultContext.value ? "/coverage" : "/data-sources"
	}
]);

const heroFactCards = computed(() => [
	{
		label: "Current guide area",
		note: featuredLaunchTarget.value
			? `The deepest published guide depth is currently centered on ${featuredLaunchTarget.value.displayName}.`
			: "A public launch target is selected and documented for the current build.",
		value: featuredLaunchTarget.value?.displayName ?? "Public launch target"
	},
	{
		label: "Contest sections",
		note: "Published contest sections in the current flagship guide.",
		value: ballotPreview.value?.election.contests.length ?? 0
	},
	{
		label: "Source families",
		note: "Structured source categories documented in the public data roadmap.",
		value: dataSources.value?.categories.length ?? 0
	},
	{
		label: "Lookup mode",
		note: "Nationwide district and representative lookup is already part of the product.",
		value: "Nationwide"
	}
]);
const heroChartItems = computed(() => [
	{
		detail: "Published contest sections currently surfaced in the flagship public guide layer.",
		id: "contest-sections",
		label: "Contest sections",
		tone: "accent" as const,
		value: ballotPreview.value?.election.contests.length ?? 0,
		valueLabel: String(ballotPreview.value?.election.contests.length ?? 0)
	},
	{
		detail: "Source families documented in the current public roadmap and data-source inventory.",
		id: "source-families",
		label: "Source families",
		tone: "neutral" as const,
		value: dataSources.value?.categories.length ?? 0,
		valueLabel: String(dataSources.value?.categories.length ?? 0)
	},
	{
		detail: "Capabilities marked live-now in the public coverage profile.",
		id: "live-capabilities",
		label: "Live capabilities",
		tone: "accent" as const,
		value: coverageData.value?.supportedContentTypes.filter(item => item.status === "live-now").length ?? 0,
		valueLabel: String(coverageData.value?.supportedContentTypes.filter(item => item.status === "live-now").length ?? 0)
	},
	{
		detail: "Official election-office links attached to the active public coverage profile.",
		id: "official-links",
		label: "Official links",
		tone: "warning" as const,
		value: featuredLaunchTarget.value?.officialResources.length ?? 0,
		valueLabel: String(featuredLaunchTarget.value?.officialResources.length ?? 0)
	}
]);
const homepageProvenanceSummary = computed(() => ({
	badges: [
		{ label: "Nonpartisan nonprofit", tone: "accent" as const },
		{ label: "Sources linked visibly", tone: "accent" as const }
	],
	items: [
		{
			detail: "The number of public source categories documented in the roadmap and data architecture pages.",
			label: "Source categories",
			value: dataSources.value?.categories.length ?? 0
		},
		{
			detail: "Official election-office or statewide links attached to the current launch profile.",
			label: "Official links",
			value: featuredLaunchTarget.value?.officialResources.length ?? 0
		},
		{
			detail: "Capabilities currently marked live in the public coverage profile.",
			label: "Live capabilities",
			value: coverageData.value?.supportedContentTypes.filter(item => item.status === "live-now").length ?? 0
		},
		{
			detail: "Date of the current published election target.",
			label: "Current election",
			value: featuredLaunchTarget.value ? formatDate(featuredLaunchTarget.value.currentElectionDate) : "Selected publicly"
		}
	],
	note: "The homepage should answer what the product can do and why a voter should trust the reading path before opening any deeper page.",
	sources: [],
	title: "How the public product is verified at a glance",
	uncertainty: "The nationwide lookup layer is broader than the deepest published guide layer. Ballot Clarity shows those layers separately instead of pretending every ZIP has the same local depth."
}));
const homepageAvailabilityItems = computed(() => [
	{
		detail: "ZIP and address lookup can already return district matches, representative matches, and official election tools.",
		label: "Nationwide lookup",
		status: "available" as const
	},
	{
		detail: featuredLaunchTarget.value
			? `The deepest current local guide remains ${featuredLaunchTarget.value.displayName}.`
			: "A published local guide area is selected publicly for the current release.",
		label: "Full local guides",
		status: "available" as const
	},
	{
		detail: "Candidate, district, contest, representative, and measure surfaces are published where Ballot Clarity has modeled them.",
		label: "Profile surfaces",
		status: "available" as const
	},
	{
		detail: "Finance and influence context exists where the record is modeled, but it is still uneven across jurisdictions.",
		label: "Finance / influence",
		status: "partial" as const
	}
]);
</script>

<template>
	<div class="pb-10 space-y-12 sm:space-y-16">
		<section class="app-shell">
			<div class="gap-6 grid xl:grid-cols-[minmax(0,1.18fr)_minmax(21rem,0.82fr)] xl:items-start">
				<div class="border border-app-line rounded-[2.2rem] bg-white shadow-[0_36px_84px_-58px_rgba(16,37,62,0.62)] overflow-hidden dark:border-app-line-dark dark:bg-app-panel-dark">
					<div class="px-6 py-8 lg:px-10 sm:px-8 sm:py-10">
						<p class="text-xs text-app-muted tracking-[0.26em] font-semibold uppercase dark:text-app-muted-dark">
							{{ hasPublishedGuideContext ? "Local guide active" : hasNationwideResultContext ? "Results for your area" : "Location lookup" }}
						</p>
						<h1 class="text-5xl text-app-ink leading-tight font-serif mt-4 max-w-4xl sm:text-6xl dark:text-app-text-dark">
							{{ hasPublishedGuideContext ? "See your ballot with sources and official links nearby." : hasNationwideResultContext ? "Start with your area, then follow the public record." : "Look up your area and see what is available." }}
						</h1>
						<p class="bc-measure text-lg text-app-muted leading-8 mt-6 dark:text-app-muted-dark">
							{{ hasPublishedGuideContext
								? "Ballot Clarity keeps contests, districts, representatives, official election links, and sources together so you can move through the ballot without losing context."
								: hasNationwideResultContext
									? "Your current lookup already includes districts, representatives, official election links, and source-backed context where available."
									: "Start with a street address or ZIP code to see districts, current officials, official election links, and whether a local guide is published for your area." }}
						</p>
						<p v-if="featuredLaunchTarget" class="text-sm text-app-muted leading-7 mt-5 dark:text-app-muted-dark">
							<strong class="text-app-ink dark:text-app-text-dark">Published local guide:</strong> {{ featuredLaunchTarget.displayName }}.
						</p>
						<p v-else class="text-sm text-app-muted leading-7 mt-5 dark:text-app-muted-dark">
							<strong class="text-app-ink dark:text-app-text-dark">Local guide status:</strong> No local guide is published in this environment right now.
						</p>
						<p v-if="activeNationwideResult?.location" class="text-sm text-app-muted leading-7 mt-4 dark:text-app-muted-dark">
							<strong class="text-app-ink dark:text-app-text-dark">Current lookup:</strong> {{ activeNationwideResult.location.displayName }}. These results stay available across the site until you change location.
						</p>

						<div class="mt-8 gap-4 grid xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
							<div class="gap-4 grid md:grid-cols-2">
								<FactStatCard
									v-for="item in heroFactCards"
									:key="item.label"
									:label="item.label"
									:note="item.note"
									:value="item.value"
								/>
							</div>
							<div class="px-4 py-4 border border-app-line/80 rounded-[1.4rem] bg-app-bg/75 dark:border-app-line-dark dark:bg-app-bg-dark/60">
								<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
									Current product shape
								</p>
								<p class="text-sm text-app-muted leading-6 mt-3 dark:text-app-muted-dark">
									These bars make the current nationwide-first product state visible in the first viewport instead of pushing all of the data graphics further down the page.
								</p>
								<div class="mt-4">
									<HorizontalBarChart :items="heroChartItems" />
								</div>
							</div>
						</div>

						<div class="mt-8 pt-8 border-t border-app-line/80 gap-5 grid dark:border-app-line-dark md:grid-cols-3">
							<div v-for="item in quickStartSteps" :key="item.step">
								<p class="text-sm text-app-accent font-semibold">
									Step {{ item.step }}
								</p>
								<p class="text-sm text-app-muted leading-7 mt-3 dark:text-app-muted-dark">
									{{ item.text }}
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
							Start from a real location, not a default guide.
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
							Start here
						</p>
						<h2 class="text-2xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
							One task, then a clear reading path
						</h2>
						<ul class="readable-list text-sm text-app-muted mt-4 dark:text-app-muted-dark">
							<li>Use the lookup to open results for your area, then a local guide if one is published.</li>
							<li>Start with contest summaries before opening any dossier or full explainer.</li>
							<li>{{ blocksGuideEntryPoints ? "Open ballot plan only when a local guide is available for your area." : "Save choices to your ballot plan only after checking the evidence links." }}</li>
						</ul>
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

		<section class="app-shell section-gap">
			<div class="gap-6 grid xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
				<SourceProvenanceStrip
					:summary="homepageProvenanceSummary"
				/>
				<AvailabilityStatusPanel
					:items="homepageAvailabilityItems"
					note="Ballot Clarity now behaves as a nationwide civic lookup product first, then adds richer local guide depth where it has been published."
					title="What is available in the product right now"
					uncertainty="Availability differs by data type. A nationwide lookup success does not automatically mean a full local contest guide exists for that location yet."
				/>
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
