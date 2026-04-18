<script setup lang="ts">
import type { BallotResponse, ElectionsResponse } from "~/types/civic";
import { storeToRefs } from "pinia";
import { defineAsyncComponent } from "vue";
import { contactEmail } from "~/constants";
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
	? "Start with the ballot guide as the table of contents, then open deeper pages only when you need more context."
	: hasNationwideResultContext.value
		? "Start from the active nationwide results, then move into district pages, representative pages, and official tools without losing the lookup context."
		: "Start with the lookup, then use nationwide civic results, district pages, representative pages, and source links before treating any local guide as the main frame.");

const faqEntries = [
	{
		answer: "Start with the location lookup. Ballot Clarity carries nationwide civic results across the app first, then opens a deeper ballot guide only where published local coverage exists.",
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
				? "Stay with the nationwide civic results, district matches, representative records, and official tools when Ballot Clarity does not have a published local guide for that area."
				: "Use the lookup first so Ballot Clarity can confirm whether a published local guide exists for your area."
	},
	{
		step: "3",
		text: hasPublishedGuideContext.value
			? "Save a plan and print a clean checklist for the voting booth."
			: "Save a ballot plan only after you open a published local guide. Lookup-only and nationwide-only states should not promote plan-first navigation."
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
				description: "Open the active published local guide organized as a table of contents, then drill into the contests that matter most.",
				label: "See your ballot",
				to: guideBallotPath.value
			}]
		: [{
				description: hasNationwideResultContext.value
					? "Return to the active nationwide civic results for your latest lookup. District matches, representative records, and official tools remain the main next step."
					: "Start with the lookup so Ballot Clarity can load nationwide civic results first and only add a local guide when published coverage exists for your area.",
				label: hasNationwideResultContext.value ? "Open nationwide results" : "Use location lookup",
				to: hasNationwideResultContext.value ? homeExperience.value.primaryLookupPath : "/#location-lookup"
			}]),
	{
		description: hasNationwideResultContext.value
			? "Browse district and representative pages while Ballot Clarity keeps the current nationwide lookup active across the app."
			: "Use district and representative pages as a nationwide-first reading layer before treating a published local guide as the default frame.",
		label: "Browse districts and representatives",
		prefetchOn: "interaction",
		to: "/districts"
	},
	{
		description: "Review where Ballot Clarity is going live first, what is already production-ready, and what still needs verification.",
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
							{{ hasPublishedGuideContext ? "Published local guide active" : hasNationwideResultContext ? "Nationwide civic results active" : "Nationwide civic lookup" }}
						</p>
						<h1 class="text-5xl text-app-ink leading-tight font-serif mt-4 max-w-4xl sm:text-6xl dark:text-app-text-dark">
							Understand your civic results without falling into a stale local guide.
						</h1>
						<p class="bc-measure text-lg text-app-muted leading-8 mt-6 dark:text-app-muted-dark">
							Ballot Clarity now starts nationwide-first: lookup, district matches, representative records, official election tools, and visible sources up front. Published local ballot guides are still available, but they should feel like the deeper layer rather than the default frame for the whole site.
						</p>
						<p v-if="featuredLaunchTarget" class="text-sm text-app-muted leading-7 mt-5 dark:text-app-muted-dark">
							<strong class="text-app-ink dark:text-app-text-dark">Current published local target:</strong> {{ featuredLaunchTarget.displayName }}. That guide depth is available, but the main product path should still begin with lookup and civic results unless a published guide is already active for your current context.
						</p>
						<p v-else class="text-sm text-app-muted leading-7 mt-5 dark:text-app-muted-dark">
							<strong class="text-app-ink dark:text-app-text-dark">Current local coverage:</strong> No published local launch target is active in this environment right now. Use the lookup to see whether nationwide civic results and official election tools are available for your area.
						</p>
						<p v-if="activeNationwideResult?.location" class="text-sm text-app-muted leading-7 mt-4 dark:text-app-muted-dark">
							<strong class="text-app-ink dark:text-app-text-dark">Active nationwide lookup:</strong> {{ activeNationwideResult.location.displayName }}. Ballot Clarity is keeping this civic-results context active across the app even though a published local guide is not available there yet.
						</p>

						<div class="mt-8 gap-4 grid md:grid-cols-2 xl:grid-cols-4">
							<FactStatCard
								v-for="item in heroFactCards"
								:key="item.label"
								:label="item.label"
								:note="item.note"
								:value="item.value"
							/>
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
							Ballot Clarity makes a best-effort location guess from your IP address on load. Enter a ZIP code to replace it with a broader nationwide preview, or use a full street address for the strongest district match.
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
							<li>Use the lookup to open nationwide civic results first, then a personalized ballot guide when local coverage is published.</li>
							<li>Start with contest summaries before opening any dossier or full explainer.</li>
							<li>{{ blocksGuideEntryPoints ? "Open the ballot plan only after Ballot Clarity confirms a published local guide for your current lookup." : "Save choices to your ballot plan only after checking the evidence links." }}</li>
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
