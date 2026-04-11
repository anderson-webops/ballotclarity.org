<script setup lang="ts">
import type { BallotResponse, ElectionsResponse } from "~/types/civic";
import { contactEmail } from "~/constants";

const api = useApiClient();
const civicStore = useCivicStore();
const { data: jurisdictionsData } = await useJurisdictions();
const { data: dataSources } = await useDataSources();

const { data: electionsData } = await useAsyncData<ElectionsResponse>(
	"home-elections",
	() => api<ElectionsResponse>("/elections")
);
const featuredElection = computed(() => electionsData.value?.elections[0] ?? null);
const featuredJurisdiction = computed(() => jurisdictionsData.value?.jurisdictions[0] ?? null);
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

usePageSeo({
	description: "Understand who is on your ballot, what candidates and measures actually say and do, and where the supporting information comes from.",
	jsonLd: {
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
		"url": "https://ballotclarity.jacobdanderson.net/"
	},
	path: "/",
	title: "Understand Your Ballot"
});

const valueSections = [
	{
		text: "Start with an address or ZIP code and get a readable ballot guide organized by contest.",
		title: "See your ballot"
	},
	{
		text: "Review neutral summaries, public records, funding context, and plain-language measure explanations.",
		title: "Understand candidates and measures"
	},
	{
		text: "Save one choice per contest, print a portable checklist, and bring a clean reference into the booth.",
		title: "Build a booth-ready plan"
	}
];
</script>

<template>
	<div class="pb-10 space-y-16 sm:space-y-20">
		<section class="app-shell">
			<div class="border border-app-line rounded-[2rem] bg-white shadow-[0_36px_80px_-54px_rgba(16,37,62,0.68)] overflow-hidden dark:border-app-line-dark dark:bg-app-panel-dark">
				<div class="px-6 py-8 gap-10 grid lg:px-10 sm:px-8 sm:py-10 lg:grid-cols-[minmax(0,1.25fr)_minmax(22rem,0.9fr)]">
					<div class="flex flex-col justify-between">
						<div>
							<div class="flex flex-wrap gap-2">
								<TrustBadge label="Nonpartisan" tone="accent" />
								<TrustBadge label="Source-first" />
								<TrustBadge label="Demo data" tone="warning" />
							</div>
							<p class="text-xs text-app-muted tracking-[0.26em] font-semibold mt-8 uppercase dark:text-app-muted-dark">
								Trustworthy civic information
							</p>
							<h1 class="text-5xl text-app-ink leading-tight font-serif mt-4 max-w-3xl sm:text-6xl dark:text-app-text-dark">
								Understand your ballot without the overload.
							</h1>
							<p class="text-lg text-app-muted leading-8 mt-6 max-w-2xl dark:text-app-muted-dark">
								Ballot Clarity is a nonprofit civic-information concept built to help voters see who is on the ballot, what those candidates and measures actually do, and where the information came from.
							</p>
						</div>

						<div class="mt-10">
							<AddressLookupForm :election="featuredElection" />
						</div>
					</div>

					<div class="pamphlet-surface surface-panel relative">
						<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
							Demo ballot preview
						</p>
						<h2 class="text-3xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
							{{ featuredElection?.name || 'Metro County sample ballot' }}
						</h2>
						<p class="text-sm text-app-muted leading-7 mt-4 dark:text-app-muted-dark">
							Designed to feel like a digital voters’ pamphlet: clean sections, clear headings, and source access visible wherever claims are summarized.
						</p>

						<ul class="mt-6 space-y-4">
							<li
								v-for="contest in ballotPreview?.election.contests"
								:key="contest.slug"
								class="text-sm pb-4 border-b border-app-line/80 flex gap-4 items-start justify-between dark:border-app-line-dark"
							>
								<div>
									<p class="text-app-ink font-semibold dark:text-app-text-dark">
										{{ contest.office }}
									</p>
									<p class="text-app-muted mt-1 dark:text-app-muted-dark">
										{{ contest.description }}
									</p>
								</div>
								<span class="text-xs text-app-muted font-semibold px-3 py-1 rounded-full bg-app-bg dark:text-app-muted-dark dark:bg-app-bg-dark/70">
									{{ contest.type === 'candidate' ? `${contest.candidates?.length || 0} candidates` : `${contest.measures?.length || 0} measure` }}
								</span>
							</li>
						</ul>

						<div class="mt-8 flex flex-wrap gap-3">
							<NuxtLink
								v-if="featuredElection"
								:to="`/ballot/${featuredElection.slug}`"
								class="btn-primary"
							>
								Explore the sample ballot
							</NuxtLink>
							<NuxtLink to="/plan" class="btn-secondary">
								Open ballot plan
							</NuxtLink>
							<NuxtLink to="/methodology" class="btn-secondary">
								See methodology
							</NuxtLink>
						</div>
					</div>
				</div>
			</div>
		</section>

		<section class="app-shell">
			<div class="gap-6 grid lg:grid-cols-3">
				<div
					v-for="section in valueSections"
					:key="section.title"
					class="px-1 pt-6 border-t border-app-line dark:border-app-line-dark"
				>
					<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
						Value
					</p>
					<h2 class="text-3xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
						{{ section.title }}
					</h2>
					<p class="text-sm text-app-muted leading-7 mt-4 dark:text-app-muted-dark">
						{{ section.text }}
					</p>
				</div>
			</div>
		</section>

		<section class="app-shell">
			<div class="gap-8 grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-start">
				<div>
					<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
						Nonprofit mission
					</p>
					<h2 class="text-4xl text-app-ink font-serif mt-3 max-w-2xl dark:text-app-text-dark">
						Public-interest election information should be readable, transparent, and calm.
					</h2>
				</div>
				<div class="text-base text-app-muted leading-8 space-y-4 dark:text-app-muted-dark">
					<p>
						Many voters encounter a mix of campaign ads, dense legal text, and fragmented public records. Ballot Clarity is designed to slow that down. The goal is not to tell people what to think. The goal is to make it easier to inspect what is actually documented.
					</p>
					<p>
						This MVP emphasizes source-backed summaries, plain-language measure explanations, and clear limits on what is known. It is informational, not advisory.
					</p>
				</div>
			</div>
		</section>

		<section class="app-shell">
			<div class="gap-6 grid lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
				<div class="surface-panel">
					<div class="flex flex-wrap gap-2">
						<TrustBadge label="Jurisdiction-first navigation" tone="accent" />
						<TrustBadge label="Official links visible" />
					</div>
					<h2 class="text-4xl text-app-ink font-serif mt-5 dark:text-app-text-dark">
						Start from a location hub, not just a search box.
					</h2>
					<p class="text-base text-app-muted leading-8 mt-5 dark:text-app-muted-dark">
						The research direction for this site is clear: voters need stable place-based entry pages with election-office contacts, current election links, archive guides, and voting-method basics. The Metro County hub models that pattern.
					</p>
					<div v-if="featuredJurisdiction" class="mt-6 p-5 rounded-3xl bg-app-bg dark:bg-app-bg-dark/70">
						<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
							Featured jurisdiction
						</p>
						<h3 class="text-2xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
							{{ featuredJurisdiction.displayName }}
						</h3>
						<p class="text-sm text-app-muted leading-7 mt-3 dark:text-app-muted-dark">
							{{ featuredJurisdiction.description }}
						</p>
						<div class="mt-5 flex flex-wrap gap-3">
							<NuxtLink :to="`/locations/${featuredJurisdiction.slug}`" class="btn-primary">
								Open location hub
							</NuxtLink>
							<NuxtLink :to="`/elections/${featuredJurisdiction.nextElectionSlug}`" class="btn-secondary">
								Open election overview
							</NuxtLink>
						</div>
					</div>
				</div>

				<div class="surface-panel">
					<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
						New trust-first entry points
					</p>
					<ul class="mt-6 space-y-4">
						<li class="p-4 rounded-2xl bg-app-bg dark:bg-app-bg-dark/70">
							<p class="text-app-ink font-semibold dark:text-app-text-dark">
								Election overview pages
							</p>
							<p class="text-sm text-app-muted leading-7 mt-2 dark:text-app-muted-dark">
								Stable, indexable pages for key dates, official links, and change logs before the user opens the longer ballot guide.
							</p>
						</li>
						<li class="p-4 rounded-2xl bg-app-bg dark:bg-app-bg-dark/70">
							<p class="text-app-ink font-semibold dark:text-app-text-dark">
								Help and FAQ hub
							</p>
							<p class="text-sm text-app-muted leading-7 mt-2 dark:text-app-muted-dark">
								Answers common voter questions in plain language and keeps routing back to official authorities clear.
							</p>
						</li>
						<li class="p-4 rounded-2xl bg-app-bg dark:bg-app-bg-dark/70">
							<p class="text-app-ink font-semibold dark:text-app-text-dark">
								Canonical trust metadata
							</p>
							<p class="text-sm text-app-muted leading-7 mt-2 dark:text-app-muted-dark">
								Major pages now expose canonical links and structured data to support clearer search interpretation.
							</p>
						</li>
					</ul>
					<div class="mt-6 flex flex-wrap gap-3">
						<NuxtLink to="/help" class="btn-secondary">
							Open help hub
						</NuxtLink>
						<NuxtLink to="/methodology" class="btn-secondary">
							Review methodology
						</NuxtLink>
						<NuxtLink to="/data-sources" class="btn-secondary">
							Review data roadmap
						</NuxtLink>
					</div>
				</div>
			</div>
		</section>

		<section v-if="roadmapPreview.length" class="app-shell">
			<div class="gap-8 grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
				<div>
					<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
						Live data roadmap
					</p>
					<h2 class="text-4xl text-app-ink font-serif mt-3 max-w-2xl dark:text-app-text-dark">
						Use official sources where they are authoritative, then normalize the rest.
					</h2>
					<p class="text-base text-app-muted leading-8 mt-5 max-w-3xl dark:text-app-muted-dark">
						The next major product step is not another UI flourish. It is replacing the demo layer with a public, auditable data stack: official election-office notices for logistics, normalized ballot providers for scale, and separate federal pipelines for money and influence.
					</p>
					<div class="mt-6 flex flex-wrap gap-3">
						<NuxtLink to="/data-sources" class="btn-primary">
							Open data sources roadmap
						</NuxtLink>
						<NuxtLink to="/methodology" class="btn-secondary">
							See methodology
						</NuxtLink>
					</div>
				</div>

				<div class="gap-4 grid">
					<article v-for="item in roadmapPreview" :key="item.slug" class="surface-panel">
						<div class="flex flex-wrap gap-2 items-center">
							<TrustBadge label="Planned live stack" tone="accent" />
						</div>
						<h3 class="text-2xl text-app-ink font-serif mt-4 dark:text-app-text-dark">
							{{ item.title }}
						</h3>
						<p class="text-sm text-app-muted leading-7 mt-3 dark:text-app-muted-dark">
							{{ item.summary }}
						</p>
						<p class="text-sm text-app-muted leading-7 mt-4 dark:text-app-muted-dark">
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
			<div class="gap-8 grid lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.9fr)]">
				<div class="surface-panel">
					<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
						How the demo is organized
					</p>
					<ul class="mt-6 space-y-5">
						<li class="flex gap-4">
							<span class="text-sm text-app-ink font-semibold mt-1 rounded-full bg-app-bg inline-flex h-8 w-8 items-center justify-center dark:text-app-text-dark dark:bg-app-bg-dark/70">1</span>
							<div>
								<p class="text-app-ink font-semibold dark:text-app-text-dark">
									One federal, one state, one local race
								</p>
								<p class="text-sm text-app-muted leading-7 mt-2 dark:text-app-muted-dark">
									The sample ballot shows a range of race types so the design can support different record shapes and source patterns.
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
									Measures are framed around what YES and NO do, potential impacts, and source-backed considerations without using advocacy language.
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
									The front end consumes mock API routes, so real civic data sources can replace the demo layer later without rewriting every page.
								</p>
							</div>
						</li>
					</ul>
				</div>

				<InfoCallout title="Important note" tone="warning">
					This site currently runs on realistic mock data for design and product validation. It is built to be trustworthy about its limits: demo labels are prominent, sources are visible, and every summary reminds users to review original records.
				</InfoCallout>
			</div>
		</section>
	</div>
</template>
