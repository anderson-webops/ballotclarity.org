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
const hasVerifiedContestPackage = computed(() => Boolean(props.guideContent?.verifiedContestPackage));
const isGuideShellOnly = computed(() => Boolean(props.guideContent?.publishedGuideShell) && !hasVerifiedContestPackage.value);
const guideStatusTitle = computed(() => hasVerifiedContestPackage.value ? "Verified guide" : "Guide status");
const guideStatusTone = computed(() => hasVerifiedContestPackage.value ? "success" as const : "warning" as const);
const guideStatusNote = computed(() => props.guideContent?.verifiedContestPackage
	? "Contest, candidate, and measure pages are verified for this area."
	: props.guideContent?.publishedGuideShell
		? "Official election links are current. Contest, candidate, and measure pages are still under local review."
		: props.note);
const secondaryMetric = computed(() => hasVerifiedContestPackage.value
	? {
			label: "Contests",
			note: "Candidate and measure sections included in this ballot guide.",
			value: String(contestCount.value)
		}
	: {
			label: "Official links",
			note: "Current election-office links attached to this page.",
			value: String(props.election.officialResources.length)
		});
const tertiaryMetric = computed(() => hasVerifiedContestPackage.value
	? {
			label: "Measures",
			note: "Countywide measures with plain-language summaries and sources.",
			value: String(measureCount.value)
		}
	: {
			label: "Key dates",
			note: "Calendar items attached for deadlines and election logistics.",
			value: String(props.election.keyDates.length)
		});
const actionLabel = computed(() => isGuideShellOnly.value ? "Print this election overview" : "Print this ballot guide");
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
		<div class="election-hero">
			<div class="election-hero__grid">
				<div class="min-w-0">
					<p class="election-hero__eyebrow">
						{{ props.location.displayName }}
					</p>
					<h1 class="election-hero__title font-serif">
						{{ props.election.name }}
					</h1>
					<p class="election-hero__lead">
						{{ props.election.description }}
					</p>
					<dl class="election-hero__facts">
						<div class="election-hero__fact election-hero__fact--wide">
							<dt>Election Day</dt>
							<dd>{{ formatDate(props.election.date) }}</dd>
						</div>
						<div class="election-hero__fact">
							<dt>{{ secondaryMetric.label }}</dt>
							<dd>{{ secondaryMetric.value }}</dd>
						</div>
						<div class="election-hero__fact">
							<dt>{{ tertiaryMetric.label }}</dt>
							<dd>{{ tertiaryMetric.value }}</dd>
						</div>
						<div class="election-hero__fact election-hero__fact--wide">
							<dt>Personalized to</dt>
							<dd>{{ personalizationLabel }}</dd>
						</div>
					</dl>
					<div class="election-hero__meta">
						<UpdatedAt :value="props.election.updatedAt" />
					</div>
				</div>

				<div class="election-hero__status">
					<InfoCallout :title="guideStatusTitle" :tone="guideStatusTone">
						{{ guideStatusNote }}
						<span class="election-hero__guidance">{{ matchGuidance }}</span>
					</InfoCallout>

					<div class="bc-action-cluster">
						<button type="button" class="btn-secondary" @click="printBallot">
							<span class="i-carbon-printer" aria-hidden="true" />
							{{ actionLabel }}
						</button>
						<NuxtLink to="/coverage" class="primary-link focus-ring">
							Check coverage
						</NuxtLink>
					</div>
				</div>
			</div>
		</div>
	</section>
</template>
