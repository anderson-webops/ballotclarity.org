<script setup lang="ts">
import type { BallotResponse, ElectionsResponse } from "~/types/civic";
import { contactEmail } from "~/constants";

const api = useApiClient();
const civicStore = useCivicStore();
const siteUrl = useSiteUrl();
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
			election: featuredElection.value?.slug ?? "2026-metro-county-general"
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
		text: "Enter an address or ZIP code to generate a readable ballot guide."
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

const primaryPaths = computed(() => [
	{
		description: "Open the ballot guide organized as a table of contents, then drill into the contests that matter most.",
		label: "See your ballot",
		to: featuredElection.value ? `/ballot/${featuredElection.value.slug}` : "/ballot"
	},
	{
		description: "Review where Ballot Clarity is going live first, what is already production-ready, and what still needs verification.",
		label: "Check live coverage",
		to: "/coverage"
	},
	{
		description: "Check how information is sourced, how freshness is handled, and where official records take precedence.",
		label: "Review sources and methodology",
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
	<div class="pb-10 space-y-16 sm:space-y-20">
		<section class="app-shell">
			<div class="gap-6 grid xl:grid-cols-[minmax(0,1.18fr)_minmax(21rem,0.82fr)] xl:items-start">
				<div class="border border-app-line rounded-[2.2rem] bg-white shadow-[0_36px_84px_-58px_rgba(16,37,62,0.62)] overflow-hidden dark:border-app-line-dark dark:bg-app-panel-dark">
					<div class="px-6 py-8 lg:px-10 sm:px-8 sm:py-10">
						<div class="flex flex-wrap gap-2">
							<TrustBadge label="Nonpartisan" tone="accent" />
							<TrustBadge label="Source-first" />
							<TrustBadge label="Current coverage" tone="warning" />
						</div>
						<p class="text-xs text-app-muted tracking-[0.26em] font-semibold mt-8 uppercase dark:text-app-muted-dark">
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
					<AddressLookupForm :election="featuredElection" />

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
							<NuxtLink to="/plan" class="btn-secondary">
								Open ballot plan
							</NuxtLink>
						</div>
					</div>

					<div class="surface-panel">
						<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
							Why we ask for your address
						</p>
						<p class="text-sm text-app-muted leading-7 mt-4 dark:text-app-muted-dark">
							A full address helps determine districts and ballot style. ZIP-only searches are useful for previewing the guide, but they can miss district-specific contests and should be treated as partial.
						</p>
						<p class="text-sm text-app-muted leading-7 mt-4 dark:text-app-muted-dark">
							Trust signals stay compact on purpose: the home page explains the path, while freshness, evidence drawers, and methodology stay closer to the reading surfaces where they matter.
						</p>
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

		<section class="app-shell">
			<div class="gap-6 grid lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
				<div class="surface-panel">
					<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
						Current ballot preview
					</p>
					<h2 class="text-4xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
						See the ballot guide before you open a detail page.
					</h2>
					<p class="bc-measure text-base text-app-muted leading-8 mt-5 dark:text-app-muted-dark">
						The ballot view works like a contents page for the rest of the product. It groups contests cleanly, keeps official links nearby, and makes saved-plan status visible without forcing the user into a side-by-side comparison too early.
					</p>
					<ul class="mt-6 divide-app-line divide-y dark:divide-app-line-dark">
						<li
							v-for="contest in ballotPreview?.election.contests"
							:key="contest.slug"
							class="py-4 flex gap-4 items-start justify-between"
						>
							<div>
								<p class="text-app-ink font-semibold dark:text-app-text-dark">
									{{ contest.office }}
								</p>
								<p class="text-sm text-app-muted leading-7 mt-1 dark:text-app-muted-dark">
									{{ contest.description }}
								</p>
							</div>
							<span class="text-xs text-app-muted font-semibold px-3 py-1 rounded-full bg-app-bg whitespace-nowrap dark:text-app-muted-dark dark:bg-app-bg-dark/70">
								{{ contest.type === "candidate" ? `${contest.candidates?.length || 0} candidates` : `${contest.measures?.length || 0} measure` }}
							</span>
						</li>
					</ul>
					<div class="mt-8 flex flex-wrap gap-3">
						<NuxtLink
							v-if="featuredElection"
							:to="`/ballot/${featuredElection.slug}`"
							class="btn-primary"
						>
							Explore the ballot guide
						</NuxtLink>
						<NuxtLink to="/compare" class="btn-secondary">
							Open compare
						</NuxtLink>
					</div>
				</div>

				<div class="gap-5 grid">
					<div class="surface-panel">
						<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
							Nonprofit mission
						</p>
						<h2 class="text-3xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
							Public-interest election information should be readable, transparent, and calm.
						</h2>
						<p class="text-sm text-app-muted leading-7 mt-4 dark:text-app-muted-dark">
							Many voters see a mix of campaign messaging, fragmented records, and dense ballot language. Ballot Clarity is meant to slow that down and make the documented record easier to inspect.
						</p>
						<p class="text-sm text-app-muted leading-7 mt-4 dark:text-app-muted-dark">
							The product is informational, not advisory. Every major reading page is built to keep sources, freshness notes, and limits visible.
						</p>
					</div>

					<div class="surface-panel">
						<div class="flex flex-wrap gap-2">
							<TrustBadge label="Launch profile" tone="accent" />
							<TrustBadge label="Official links visible" />
						</div>
						<h2 class="text-3xl text-app-ink font-serif mt-5 dark:text-app-text-dark">
							Start from the coverage profile.
						</h2>
						<p class="text-sm text-app-muted leading-7 mt-4 dark:text-app-muted-dark">
							The coverage page now explains where Ballot Clarity is going live first, what the current public archive still is, and which official Fulton County and Georgia systems will anchor the first production jurisdiction.
						</p>
						<div class="mt-6 flex flex-wrap gap-3">
							<NuxtLink to="/coverage" class="btn-primary">
								Open coverage profile
							</NuxtLink>
							<NuxtLink to="/status" class="btn-secondary">
								Open public status
							</NuxtLink>
							<NuxtLink to="/help" class="btn-secondary">
								Open help hub
							</NuxtLink>
						</div>
					</div>
				</div>
			</div>
		</section>

		<section v-if="roadmapPreview.length" class="app-shell">
			<div class="gap-8 grid lg:grid-cols-[minmax(0,0.58fr)_minmax(0,1fr)]">
				<div>
					<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
						Live data roadmap
					</p>
					<h2 class="text-4xl text-app-ink font-serif mt-3 max-w-xl dark:text-app-text-dark">
						Use official sources where they are authoritative, then normalize the rest.
					</h2>
					<p class="bc-measure text-base text-app-muted leading-8 mt-5 dark:text-app-muted-dark">
						The next major iteration is operational, not decorative: replacing the current archive with a public, auditable data stack that separates official logistics, normalized ballot data, and federal money and influence pipelines.
					</p>
					<div class="mt-6 flex flex-wrap gap-3">
						<NuxtLink to="/data-sources" class="btn-primary">
							Open data sources roadmap
						</NuxtLink>
						<NuxtLink to="/methodology" class="btn-secondary">
							Review methodology
						</NuxtLink>
					</div>
				</div>

				<div class="divide-app-line divide-y dark:divide-app-line-dark">
					<article v-for="item in roadmapPreview" :key="item.slug" class="py-5">
						<div class="flex flex-wrap gap-2 items-center">
							<TrustBadge label="Planned live stack" tone="accent" />
						</div>
						<h3 class="text-2xl text-app-ink font-serif mt-4 dark:text-app-text-dark">
							{{ item.title }}
						</h3>
						<p class="text-sm text-app-muted leading-7 mt-3 dark:text-app-muted-dark">
							{{ item.summary }}
						</p>
						<p class="text-sm text-app-muted leading-7 mt-3 dark:text-app-muted-dark">
							<strong class="text-app-ink dark:text-app-text-dark">Rule:</strong> {{ item.authoritativeRule }}
						</p>
						<p class="text-sm text-app-muted leading-7 mt-3 dark:text-app-muted-dark">
							<strong class="text-app-ink dark:text-app-text-dark">Approach:</strong> {{ item.liveApproach }}
						</p>
					</article>
				</div>
			</div>
		</section>

		<section class="app-shell">
			<div class="gap-8 grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
				<div class="surface-panel">
					<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
						How the current coverage is organized
					</p>
					<ul class="mt-6 space-y-5">
						<li class="flex gap-4">
							<span class="text-sm text-app-ink font-semibold mt-1 rounded-full bg-app-bg inline-flex h-8 w-8 items-center justify-center dark:text-app-text-dark dark:bg-app-bg-dark/70">1</span>
							<div>
								<p class="text-app-ink font-semibold dark:text-app-text-dark">
									One federal, one state, one local race
								</p>
								<p class="text-sm text-app-muted leading-7 mt-2 dark:text-app-muted-dark">
									The ballot guide shows different contest types so the product can be tested against different evidence shapes and ballot layouts.
								</p>
							</div>
						</li>
						<li class="flex gap-4">
							<span class="text-sm text-app-ink font-semibold mt-1 rounded-full bg-app-bg inline-flex h-8 w-8 items-center justify-center dark:text-app-text-dark dark:bg-app-bg-dark/70">2</span>
							<div>
								<p class="text-app-ink font-semibold dark:text-app-text-dark">
									Plain-language ballot measure pages
								</p>
								<p class="text-sm text-app-muted leading-7 mt-2 dark:text-app-muted-dark">
									Measures separate current law, proposed change, YES and NO outcomes, fiscal context, and attributed arguments so the user can scan structure before reading details.
								</p>
							</div>
						</li>
						<li class="flex gap-4">
							<span class="text-sm text-app-ink font-semibold mt-1 rounded-full bg-app-bg inline-flex h-8 w-8 items-center justify-center dark:text-app-text-dark dark:bg-app-bg-dark/70">3</span>
							<div>
								<p class="text-app-ink font-semibold dark:text-app-text-dark">
									Future-ready data architecture
								</p>
								<p class="text-sm text-app-muted leading-7 mt-2 dark:text-app-muted-dark">
									The front end already consumes API-driven data, so real civic sources can replace the current archive later without rewriting the page structure.
								</p>
							</div>
						</li>
					</ul>
				</div>

				<InfoCallout title="Important note" tone="warning">
					This site currently runs on a limited public-record archive while live data integrations are being connected. It is built to be trustworthy about its limits: coverage notes stay prominent, sources stay visible, and every summary reminds users to review original records.
				</InfoCallout>
			</div>
		</section>
	</div>
</template>
