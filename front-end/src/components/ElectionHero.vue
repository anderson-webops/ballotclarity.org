<script setup lang="ts">
import type { Election, GuideContentSummary, LocationSelection } from "~/types/civic";

const props = defineProps<{
	election: Election;
	guideContent?: GuideContentSummary | null;
	location: LocationSelection;
	note: string;
}>();

const { formatDate } = useFormatters();
const contestCount = computed(() => props.election.contests.length);
const measureCount = computed(() => props.election.contests.reduce((count, contest) => count + (contest.measures?.length ?? 0), 0));
const personalizationLabel = computed(() => props.location.lookupInput ?? props.location.displayName);
const guideStatusTitle = computed(() => "Guide status");
const guideStatusNote = computed(() => props.guideContent?.verifiedContestPackage
	? "Contest, candidate, and measure pages are verified for this area."
	: props.guideContent?.publishedGuideShell
		? "Official election links are current. Contest, candidate, and measure pages are still under local review."
		: props.note);
const matchGuidance = computed(() => {
	if (props.location.lookupMode === "zip-preview")
		return "This guide was opened from a ZIP-only preview. ZIPs can span multiple districts, so verify the exact ballot in the official election tools before relying on district-specific contests.";

	if (props.location.lookupMode === "address-verified")
		return "This address was accepted by the voter-information provider. Use official election tools for any late changes or final ballot confirmation.";

	if (props.location.lookupMode === "address-submitted")
		return "A full address is the right input for exact ballot matching. Verify the exact ballot with official election tools when details are time-sensitive.";

	return "Use the official election office links for final district, polling-place, and ballot verification when details are time-sensitive.";
});

function printBallot() {
	if (import.meta.client)
		window.print();
}
</script>

<template>
	<section class="app-shell">
		<div class="pamphlet-surface border border-app-line rounded-[2rem] bg-white shadow-[0_30px_80px_-48px_rgba(16,37,62,0.65)] overflow-hidden dark:border-app-line-dark dark:bg-app-panel-dark">
			<div class="px-6 py-8 gap-8 grid lg:px-10 sm:px-8 xl:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.8fr)]">
				<div>
					<p class="text-xs text-app-muted tracking-[0.24em] font-semibold mt-4 uppercase dark:text-app-muted-dark sm:mt-6">
						{{ props.location.displayName }}
					</p>
					<h1 class="text-4xl text-app-ink leading-tight font-serif mt-3 max-w-4xl sm:text-5xl dark:text-app-text-dark">
						{{ props.election.name }}
					</h1>
					<p class="text-base text-app-muted leading-7 mt-4 max-w-2xl dark:text-app-muted-dark">
						{{ props.election.description }}
					</p>
					<div class="text-sm text-app-muted mt-6 flex flex-wrap gap-4 items-center dark:text-app-muted-dark">
						<span class="inline-flex gap-2 items-center">
							<span class="i-carbon-calendar" />
							Election Day {{ formatDate(props.election.date) }}
						</span>
						<UpdatedAt :value="props.election.updatedAt" />
					</div>
					<div class="mt-6 gap-4 grid sm:grid-cols-2 xl:grid-cols-3">
						<div class="px-5 py-5 rounded-3xl bg-app-bg dark:bg-app-bg-dark/70">
							<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
								Personalized to
							</p>
							<p class="text-sm text-app-ink font-semibold mt-3 dark:text-app-text-dark">
								{{ personalizationLabel }}
							</p>
							<p class="text-xs text-app-muted leading-6 mt-2 dark:text-app-muted-dark">
								Showing contests for your districts in {{ props.location.displayName }}.
							</p>
						</div>
						<div class="px-5 py-5 rounded-3xl bg-app-bg dark:bg-app-bg-dark/70">
							<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
								Contests
							</p>
							<p class="text-3xl text-app-ink font-semibold mt-3 dark:text-app-text-dark">
								{{ contestCount }}
							</p>
							<p class="text-xs text-app-muted leading-6 mt-2 dark:text-app-muted-dark">
								Candidate and measure sections included in this ballot guide.
							</p>
						</div>
						<div class="px-5 py-5 rounded-3xl bg-app-bg dark:bg-app-bg-dark/70">
							<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
								Measures
							</p>
							<p class="text-3xl text-app-ink font-semibold mt-3 dark:text-app-text-dark">
								{{ measureCount }}
							</p>
							<p class="text-xs text-app-muted leading-6 mt-2 dark:text-app-muted-dark">
								Countywide measures with plain-language summaries and sources.
							</p>
						</div>
					</div>
				</div>

				<div class="surface-panel flex flex-col max-w-2xl justify-between relative z-10 xl:max-w-none">
					<div>
						<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
							Read this ballot like a pamphlet
						</p>
						<p class="text-sm text-app-muted leading-7 mt-4 dark:text-app-muted-dark">
							Each contest below includes plainspoken summaries, record highlights, funding context, and direct source lists. Information may still be incomplete, so review original records before voting.
						</p>
						<p class="text-sm text-app-muted leading-7 mt-4 dark:text-app-muted-dark">
							This ballot is personalized to {{ personalizationLabel }}. {{ matchGuidance }}
						</p>
					</div>

					<div class="mt-6 space-y-3">
						<InfoCallout :title="guideStatusTitle" tone="warning">
							{{ guideStatusNote }}
						</InfoCallout>

						<div class="bc-action-cluster">
							<button type="button" class="btn-primary" @click="printBallot">
								<span class="i-carbon-printer" />
								Print this ballot guide
							</button>
							<NuxtLink to="/coverage" class="btn-secondary">
								Check coverage
							</NuxtLink>
						</div>
					</div>
				</div>
			</div>
		</div>
	</section>
</template>
