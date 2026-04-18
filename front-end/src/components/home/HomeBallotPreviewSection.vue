<script setup lang="ts">
import type { BallotResponse, NationwideLookupResultContext } from "~/types/civic";

const props = defineProps<{
	allowGuideEntryPoints?: boolean;
	ballotPreview: BallotResponse | null;
	featuredElectionSlug?: string | null;
	nationwideLookupResult?: NationwideLookupResultContext | null;
	showFeaturedGuidePreview?: boolean;
}>();

const featuredBallotHref = computed(() => props.featuredElectionSlug ? `/ballot/${props.featuredElectionSlug}` : "/ballot");
const showGuideEntryPoints = computed(() => props.allowGuideEntryPoints !== false);
const showNationwideResults = computed(() => props.showFeaturedGuidePreview === false && Boolean(props.nationwideLookupResult));
const nationwideLocationLabel = computed(() => props.nationwideLookupResult?.location?.displayName ?? props.nationwideLookupResult?.normalizedAddress ?? "Active lookup");
const officialToolCount = computed(() => props.nationwideLookupResult?.actions.filter(action => action.kind === "official-verification").length ?? 0);
</script>

<template>
	<section class="app-shell">
		<div class="gap-6 grid lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
			<div class="surface-panel">
				<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
					{{ showNationwideResults ? "Active nationwide civic context" : "Current ballot preview" }}
				</p>
				<h2 class="text-4xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
					{{ showNationwideResults
						? `${nationwideLocationLabel} is currently using nationwide civic results.`
						: showGuideEntryPoints
							? "See the ballot guide before you open a detail page."
							: "Published local guides open only in covered areas." }}
				</h2>
				<p class="bc-measure text-base text-app-muted leading-8 mt-5 dark:text-app-muted-dark">
					{{ showNationwideResults
						? "The homepage is now carrying the active nationwide lookup instead of a seeded local guide preview. Use this context for district matches, representative records, and official election tools until Ballot Clarity publishes a local guide for this area."
						: showGuideEntryPoints
							? "The ballot view works like a contents page for the rest of the product. It groups contests cleanly, keeps official links nearby, and makes saved-plan status visible without forcing the user into a side-by-side comparison too early."
							: "This preview shows the structure of Ballot Clarity's published local guides. When a lookup resolves nationwide-only coverage, keep the civic-results and official-tool flow first until local guide coverage exists for that area." }}
				</p>
				<ul v-if="showNationwideResults && nationwideLookupResult" class="mt-6 gap-4 grid md:grid-cols-2">
					<li class="p-4 rounded-[1.35rem] bg-app-bg/70 dark:bg-app-bg-dark/70">
						<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
							Official tools
						</p>
						<p class="text-3xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
							{{ officialToolCount }}
						</p>
						<p class="text-sm text-app-muted leading-7 mt-3 dark:text-app-muted-dark">
							Official state and county election links carried into the active lookup context.
						</p>
					</li>
					<li class="p-4 rounded-[1.35rem] bg-app-bg/70 dark:bg-app-bg-dark/70">
						<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
							District matches
						</p>
						<p class="text-3xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
							{{ nationwideLookupResult.districtMatches.length }}
						</p>
						<p class="text-sm text-app-muted leading-7 mt-3 dark:text-app-muted-dark">
							Provider-backed district records attached to the latest address or ZIP lookup.
						</p>
					</li>
					<li class="p-4 rounded-[1.35rem] bg-app-bg/70 dark:bg-app-bg-dark/70">
						<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
							Representatives
						</p>
						<p class="text-3xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
							{{ nationwideLookupResult.representativeMatches.length }}
						</p>
						<p class="text-sm text-app-muted leading-7 mt-3 dark:text-app-muted-dark">
							Current representative records included when the lookup can match them confidently.
						</p>
					</li>
					<li class="p-4 rounded-[1.35rem] bg-app-bg/70 dark:bg-app-bg-dark/70">
						<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
							Local guide
						</p>
						<p class="text-3xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
							{{ nationwideLookupResult.guideAvailability === "published" ? "Published" : "Not yet" }}
						</p>
						<p class="text-sm text-app-muted leading-7 mt-3 dark:text-app-muted-dark">
							Published contest, candidate, and measure pages open only after Ballot Clarity confirms local guide coverage.
						</p>
					</li>
				</ul>
				<ul v-else-if="ballotPreview" class="mt-6 divide-app-line divide-y dark:divide-app-line-dark">
					<li
						v-for="contest in ballotPreview.election.contests"
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
				<p v-else class="text-sm text-app-muted leading-7 mt-6 dark:text-app-muted-dark">
					{{ showNationwideResults
						? "The active nationwide lookup is loaded, but the richer summary cards are not available in this render yet. Open the nationwide results page for the full district, representative, and official-tool view."
						: showGuideEntryPoints
							? "The current ballot preview is not available in this response yet, but the ballot guide remains the main entry point once a location is selected."
							: "The current published guide preview is not available in this response yet. Use the lookup results and coverage profile instead of a local-guide flow when the current area only has nationwide civic coverage." }}
				</p>
				<div class="mt-8 flex flex-wrap gap-3">
					<NuxtLink
						v-if="showNationwideResults"
						to="/results"
						class="btn-primary"
						prefetch-on="interaction"
					>
						Open nationwide results
					</NuxtLink>
					<NuxtLink
						v-else-if="showGuideEntryPoints"
						:to="featuredBallotHref"
						class="btn-primary"
						prefetch-on="interaction"
					>
						Explore the ballot guide
					</NuxtLink>
					<NuxtLink v-else to="/coverage" class="btn-primary" prefetch-on="interaction">
						Open coverage profile
					</NuxtLink>
					<NuxtLink v-if="!showNationwideResults" to="/compare" class="btn-secondary" prefetch-on="interaction">
						Open compare
					</NuxtLink>
					<NuxtLink v-if="showNationwideResults" to="/coverage" class="btn-secondary" prefetch-on="interaction">
						Open coverage profile
					</NuxtLink>
					<NuxtLink v-if="!showGuideEntryPoints || showNationwideResults" to="/help" class="btn-secondary" prefetch-on="interaction">
						Open help hub
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
					<h2 class="text-3xl text-app-ink font-serif dark:text-app-text-dark">
						Start from the coverage profile.
					</h2>
					<p class="text-sm text-app-muted leading-7 mt-4 dark:text-app-muted-dark">
						The coverage page now explains whether Ballot Clarity has a published local coverage target, what is currently available in this environment, and when the app is correctly falling back to lookup-first nationwide civic results instead of old seeded guide content.
					</p>
					<div class="mt-6 flex flex-wrap gap-3">
						<NuxtLink to="/coverage" class="btn-primary" prefetch-on="interaction">
							Open coverage profile
						</NuxtLink>
						<NuxtLink to="/status" class="btn-secondary" prefetch-on="interaction">
							Open public status
						</NuxtLink>
						<NuxtLink to="/help" class="btn-secondary" prefetch-on="interaction">
							Open help hub
						</NuxtLink>
					</div>
				</div>
			</div>
		</div>
	</section>
</template>
