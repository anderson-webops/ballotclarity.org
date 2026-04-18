<script setup lang="ts">
import type { BallotResponse } from "~/types/civic";

const props = defineProps<{
	ballotPreview: BallotResponse | null;
	featuredElectionSlug?: string | null;
}>();

const featuredBallotHref = computed(() => props.featuredElectionSlug ? `/ballot/${props.featuredElectionSlug}` : "/ballot");
</script>

<template>
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
				<ul v-if="ballotPreview" class="mt-6 divide-app-line divide-y dark:divide-app-line-dark">
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
					The current ballot preview is not available in this response yet, but the ballot guide remains the main entry point once a location is selected.
				</p>
				<div class="mt-8 flex flex-wrap gap-3">
					<NuxtLink
						:to="featuredBallotHref"
						class="btn-primary"
						prefetch-on="interaction"
					>
						Explore the ballot guide
					</NuxtLink>
					<NuxtLink to="/compare" class="btn-secondary" prefetch-on="interaction">
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
					<h2 class="text-3xl text-app-ink font-serif dark:text-app-text-dark">
						Start from the coverage profile.
					</h2>
					<p class="text-sm text-app-muted leading-7 mt-4 dark:text-app-muted-dark">
						The coverage page now explains where Ballot Clarity is going live first, what the current public archive still is, and which official Fulton County and Georgia systems will anchor the first production jurisdiction.
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
