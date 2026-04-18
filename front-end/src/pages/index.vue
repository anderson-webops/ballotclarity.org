<script setup lang="ts">
import type { BallotResponse, ElectionsResponse } from "~/types/civic";
import { defineAsyncComponent } from "vue";
import { contactEmail, currentCoverageElectionSlug } from "~/constants";

const api = useApiClient();
const civicStore = useCivicStore();
const siteUrl = useSiteUrl();
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
const featuredLaunchTarget = computed(() => coverageData.value?.launchTarget ?? null);
const roadmapPreview = computed(() => dataSources.value?.categories.slice(0, 3) ?? []);

const { data: ballotPreview } = await useAsyncData<BallotResponse | null>(
	"home-preview-ballot",
	() => api<BallotResponse>("/ballot", {
		query: {
			election: featuredElection.value?.slug ?? currentCoverageElectionSlug
		}
	}),
	{
		default: () => null,
		watch: [featuredElection]
	}
);

watchEffect(() => {
	if (featuredElection.value)
		civicStore.setElection(featuredElection.value);
});

const faqEntries = [
	{
		answer: "Start with the ballot guide. It keeps contests, summaries, and source links together so voters can move from overview to detail without losing context.",
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

const quickStartSteps = [
	{
		step: "1",
		text: "Enter a full address for the best district match, or use a 5-digit ZIP code to preview the current coverage area."
	},
	{
		step: "2",
		text: "Scan contests first, then open detail pages only when you need more depth."
	},
	{
		step: "3",
		text: "Save a plan and print a clean checklist for the voting booth."
	}
];

interface PrimaryPath {
	description: string;
	label: string;
	prefetchOn?: "interaction";
	to: string;
}

const primaryPaths = computed<PrimaryPath[]>(() => [
	{
		description: "Open the ballot guide organized as a table of contents, then drill into the contests that matter most.",
		label: "See your ballot",
		to: featuredElection.value ? `/ballot/${featuredElection.value.slug}` : "/ballot"
	},
	{
		description: "Review where Ballot Clarity is going live first, what is already production-ready, and what still needs verification.",
		label: "Check live coverage",
		prefetchOn: "interaction",
		to: "/coverage"
	},
	{
		description: "Check how information is sourced, how freshness is handled, and where official records take precedence.",
		label: "Review sources and methodology",
		prefetchOn: "interaction",
		to: "/data-sources"
	}
]);

const trustFacts = computed(() => [
	"Nonpartisan nonprofit product",
	featuredLaunchTarget.value ? `Launch target: ${featuredLaunchTarget.value.displayName}` : "Launch target selected publicly",
	"Sources linked on every major reading page",
	"Print-friendly ballot guides supported"
]);
</script>

<template>
	<div class="pb-10 space-y-12 sm:space-y-16">
		<section class="app-shell">
			<div class="gap-6 grid xl:grid-cols-[minmax(0,1.18fr)_minmax(21rem,0.82fr)] xl:items-start">
				<div class="border border-app-line rounded-[2.2rem] bg-white shadow-[0_36px_84px_-58px_rgba(16,37,62,0.62)] overflow-hidden dark:border-app-line-dark dark:bg-app-panel-dark">
					<div class="px-6 py-8 lg:px-10 sm:px-8 sm:py-10">
						<p class="text-xs text-app-muted tracking-[0.26em] font-semibold uppercase dark:text-app-muted-dark">
							Public-interest ballot guide
						</p>
						<h1 class="text-5xl text-app-ink leading-tight font-serif mt-4 max-w-4xl sm:text-6xl dark:text-app-text-dark">
							Understand your ballot without the overload.
						</h1>
						<p class="bc-measure text-lg text-app-muted leading-8 mt-6 dark:text-app-muted-dark">
							Ballot Clarity is designed like a calm public-service start page: one clear task up front, readable ballot guides, visible sources, and plain-language context that stays separate from advocacy.
						</p>
						<p v-if="featuredLaunchTarget" class="text-sm text-app-muted leading-7 mt-5 dark:text-app-muted-dark">
							<strong class="text-app-ink dark:text-app-text-dark">Current production launch target:</strong> {{ featuredLaunchTarget.displayName }}. The public archive remains available while official county and statewide integrations are being verified.
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
							Not the right location? Select a new district.
						</h2>
						<p class="text-sm text-app-muted leading-7 mt-4 dark:text-app-muted-dark">
							Enter a ZIP code to preview the available coverage area, or use a full street address for the closest district match. Ballot Clarity does not auto-select from your IP address.
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
							<li>Use the lookup to open a personalized ballot guide.</li>
							<li>Start with contest summaries before opening any dossier or full explainer.</li>
							<li>Save choices to your ballot plan only after checking the evidence links.</li>
						</ul>
						<div class="mt-6 flex flex-wrap gap-3">
							<NuxtLink
								v-if="featuredElection"
								:to="`/ballot/${featuredElection.slug}`"
								class="btn-primary"
							>
								Open ballot guide
							</NuxtLink>
							<NuxtLink to="/plan" class="btn-secondary" prefetch-on="interaction">
								Open ballot plan
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
						The interface is meant to feel predictable. Find the ballot first, use the ballot page as the table of contents, then open deeper pages only when you need record-level detail.
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
				:ballot-preview="ballotPreview"
				:featured-election-slug="featuredElection?.slug ?? null"
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
