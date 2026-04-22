<script setup lang="ts">
import type { BallotResponse, NationwideLookupResultContext } from "~/types/civic";
import { buildHomeNationwideSummaryHref } from "~/utils/home-links";
import { interactiveHomeSummaryCardClass } from "~/utils/home-summary-card";

const props = defineProps<{
	allowGuideEntryPoints?: boolean;
	ballotPreview: BallotResponse | null;
	featuredElectionSlug?: string | null;
	nationwideLookupResult?: NationwideLookupResultContext | null;
	showFeaturedGuidePreview?: boolean;
}>();

const featuredBallotHref = computed(() => props.featuredElectionSlug ? `/ballot/${props.featuredElectionSlug}` : "/ballot");
const showGuideEntryPoints = computed(() => props.allowGuideEntryPoints !== false);
const showFeaturedGuidePreview = computed(() => props.showFeaturedGuidePreview !== false && Boolean(props.ballotPreview));
const showNationwideResults = computed(() => props.showFeaturedGuidePreview === false && Boolean(props.nationwideLookupResult));
const nationwideLocationLabel = computed(() => props.nationwideLookupResult?.location?.displayName ?? props.nationwideLookupResult?.normalizedAddress ?? "Active lookup");
const officialToolCount = computed(() => props.nationwideLookupResult?.actions.filter(action => action.kind === "official-verification").length ?? 0);
const districtMatchesHref = computed(() => buildHomeNationwideSummaryHref("/districts", props.nationwideLookupResult));
const representativesHref = computed(() => buildHomeNationwideSummaryHref("/representatives", props.nationwideLookupResult));
const featuredGuideIsVerified = computed(() => Boolean(props.ballotPreview?.guideContent?.verifiedContestPackage));
const featuredGuideIsShellOnly = computed(() => Boolean(props.ballotPreview?.guideContent?.publishedGuideShell) && !featuredGuideIsVerified.value);
const featuredGuideStatusLabel = computed(() => featuredGuideIsVerified.value
	? "Verified ballot guide"
	: featuredGuideIsShellOnly.value
		? "Election overview"
		: "Guide status");
const featuredGuideStatusNote = computed(() => props.ballotPreview?.guideContent?.summary ?? "");
const featuredPrimaryHref = computed(() => featuredGuideIsVerified.value
	? featuredBallotHref.value
	: featuredGuideIsShellOnly.value
		? props.featuredElectionSlug ? `/elections/${props.featuredElectionSlug}` : "/elections"
		: "/#location-lookup");
const featuredPrimaryLabel = computed(() => featuredGuideIsVerified.value
	? "Explore the ballot guide"
	: featuredGuideIsShellOnly.value
		? "Open election overview"
		: "Open location lookup");
</script>

<template>
	<section class="app-shell">
		<div class="gap-6 grid lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
			<div class="surface-panel">
				<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
					{{ showNationwideResults ? "Current results" : showFeaturedGuidePreview ? "Ballot preview" : "Start here" }}
				</p>
				<h2 class="text-4xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
					{{ showNationwideResults
						? `Results for ${nationwideLocationLabel}`
						: showFeaturedGuidePreview
							? featuredGuideIsVerified
								? "Preview the ballot guide."
								: "Review the current election overview."
							: "Look up your area to see districts, officials, and official links." }}
				</h2>
				<p class="bc-measure text-base text-app-muted leading-8 mt-5 dark:text-app-muted-dark">
					{{ showNationwideResults
						? "Use this lookup to open district pages, representative pages, and official election tools for this area."
						: showFeaturedGuidePreview
							? featuredGuideIsVerified
								? "Browse contests and official links before you open a detail page."
								: "Official election links are current for this area. Verified contest, candidate, and measure pages are still under local review."
							: "Look up an address or ZIP code to see districts, officials, and official election links." }}
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
							Official election links for this area.
						</p>
					</li>
					<li>
						<NuxtLink
							:to="districtMatchesHref"
							:class="interactiveHomeSummaryCardClass"
						>
							<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
								District matches
							</p>
							<p class="text-3xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
								{{ nationwideLookupResult.districtMatches.length }}
							</p>
							<p class="text-sm text-app-muted leading-7 mt-3 dark:text-app-muted-dark">
								Districts from your latest lookup.
							</p>
						</NuxtLink>
					</li>
					<li>
						<NuxtLink
							:to="representativesHref"
							:class="interactiveHomeSummaryCardClass"
						>
							<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
								Representatives
							</p>
							<p class="text-3xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
								{{ nationwideLookupResult.representativeMatches.length }}
							</p>
							<p class="text-sm text-app-muted leading-7 mt-3 dark:text-app-muted-dark">
								Current officials for this area.
							</p>
						</NuxtLink>
					</li>
					<li class="p-4 rounded-[1.35rem] bg-app-bg/70 dark:bg-app-bg-dark/70">
						<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
							Election coverage
						</p>
						<p class="text-3xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
							{{ nationwideLookupResult.guideContent?.verifiedContestPackage ? "Verified" : nationwideLookupResult.guideAvailability === "published" ? "Overview" : "Not yet" }}
						</p>
						<p class="text-sm text-app-muted leading-7 mt-3 dark:text-app-muted-dark">
							{{ nationwideLookupResult.guideContent?.verifiedContestPackage
								? "Contest and measure pages are locally verified for this area."
								: nationwideLookupResult.guideAvailability === "published"
									? "Official election links are current. Verified contest pages are still under local review."
									: "Election overview pages open when current local coverage is available." }}
						</p>
					</li>
				</ul>
				<template v-else-if="showFeaturedGuidePreview && ballotPreview">
					<div v-if="ballotPreview.guideContent" class="mt-6 p-4 rounded-[1.35rem] bg-app-bg/70 dark:bg-app-bg-dark/70">
						<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
							{{ featuredGuideStatusLabel }}
						</p>
						<p class="text-sm text-app-muted leading-7 mt-3 dark:text-app-muted-dark">
							{{ featuredGuideStatusNote }}
						</p>
					</div>
					<ul v-if="featuredGuideIsVerified && ballotPreview.election.contests.length" class="mt-6 divide-app-line divide-y dark:divide-app-line-dark">
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
						Use the election overview for official links, key dates, and current verification status for this area. Contest, candidate, and measure pages open after the local package is verified.
					</p>
				</template>
				<p v-else class="text-sm text-app-muted leading-7 mt-6 dark:text-app-muted-dark">
					{{ showNationwideResults
						? "Your lookup is loaded. Open the results page for the full district, representative, and official-link view."
						: showFeaturedGuidePreview
							? "The ballot preview is not available in this response yet. Open the ballot guide for the full view."
							: "Use the lookup, district pages, representative pages, coverage, and sources from here." }}
				</p>
				<div class="mt-8 flex flex-wrap gap-3">
					<NuxtLink
						v-if="showNationwideResults"
						to="/results"
						class="btn-primary"
						prefetch-on="interaction"
					>
						Open results
					</NuxtLink>
					<NuxtLink
						v-else-if="showFeaturedGuidePreview"
						:to="featuredPrimaryHref"
						class="btn-primary"
						prefetch-on="interaction"
					>
						{{ featuredPrimaryLabel }}
					</NuxtLink>
					<NuxtLink v-else to="/" class="btn-primary" prefetch-on="interaction">
						Open location lookup
					</NuxtLink>
					<NuxtLink v-if="showFeaturedGuidePreview && showGuideEntryPoints && featuredGuideIsVerified" to="/compare" class="btn-secondary" prefetch-on="interaction">
						Open compare
					</NuxtLink>
					<NuxtLink v-if="!showNationwideResults && !showFeaturedGuidePreview" to="/districts" class="btn-secondary" prefetch-on="interaction">
						Open districts
					</NuxtLink>
					<NuxtLink v-if="showNationwideResults" to="/coverage" class="btn-secondary" prefetch-on="interaction">
						Open coverage profile
					</NuxtLink>
					<NuxtLink v-if="!showGuideEntryPoints || showNationwideResults || !showFeaturedGuidePreview" to="/data-sources" class="btn-secondary" prefetch-on="interaction">
						Open data sources
					</NuxtLink>
				</div>
			</div>

			<div class="gap-5 grid">
				<div class="surface-panel">
					<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
						Nonprofit mission
					</p>
					<h2 class="text-3xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
						Election information should be easy to read and easy to verify.
					</h2>
					<p class="text-sm text-app-muted leading-7 mt-4 dark:text-app-muted-dark">
						Public records are scattered and time-consuming. Ballot Clarity is meant to make them easier to inspect.
					</p>
					<p class="text-sm text-app-muted leading-7 mt-4 dark:text-app-muted-dark">
						The product is informational, not advisory. Key pages keep sources, freshness, and limits visible.
					</p>
				</div>

				<div class="surface-panel">
					<h2 class="text-3xl text-app-ink font-serif dark:text-app-text-dark">
						Check coverage before you dive in.
					</h2>
					<p class="text-sm text-app-muted leading-7 mt-4 dark:text-app-muted-dark">
						Use the coverage page to see whether a local guide is available for this area.
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
