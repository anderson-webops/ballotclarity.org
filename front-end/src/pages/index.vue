<script setup lang="ts">
import type { BallotResponse, ElectionsResponse } from "~/types/civic";

const api = useApiClient();
const civicStore = useCivicStore();

const { data: electionsData } = await useAsyncData<ElectionsResponse>(
	"home-elections",
	() => api<ElectionsResponse>("/elections")
);
const featuredElection = computed(() => electionsData.value?.elections[0] ?? null);

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
		text: "Inspect source lists, see what is known and unknown, and understand how summaries are put together.",
		title: "Review sources and methodology"
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
