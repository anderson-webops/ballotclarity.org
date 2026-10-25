<script setup lang="ts">
import type { Election, GuideContentSummary, LocationSelection } from "~/types/civic";
import { fullAreaGuideLabels } from "~/utils/guide-scope";
import { limitedBallotNotice } from "~/utils/results-summary";

const props = defineProps<{
	election: Election;
	coverageLimits?: string[];
	guideContent?: GuideContentSummary | null;
	location: LocationSelection;
	note: string;
	scope?: "statewide" | "local";
}>();

const { formatDate } = useFormatters();
const contestCount = computed(() => props.election.contests.length);
const measureCount = computed(() => props.election.contests.reduce((count, contest) => count + (contest.measures?.length ?? 0), 0));
const hasVerifiedContestPackage = computed(() => Boolean(props.guideContent?.verifiedContestPackage));
const isGuideShellOnly = computed(() => Boolean(props.guideContent?.publishedGuideShell) && !hasVerifiedContestPackage.value);
const areaGuideLabels = computed(() => fullAreaGuideLabels(props.location.state));
const guideStatus = computed(() => hasVerifiedContestPackage.value
	? props.scope === "statewide"
		? { label: areaGuideLabels.value.status, tone: "warning" as const }
		: props.coverageLimits?.length
			? { label: "Partial ballot information", tone: "warning" as const }
			: { label: "Verified guide", tone: "success" as const }
	: isGuideShellOnly.value
		? { label: limitedBallotNotice, tone: "warning" as const }
		: { label: props.note, tone: "warning" as const });
const facts = computed(() => hasVerifiedContestPackage.value
	? props.election.contests.every(contest => contest.type === "measure")
		? [{ label: "Measures", value: String(measureCount.value) }]
		: [
				{ label: "Contests", value: String(contestCount.value) },
				{ label: "Measures", value: String(measureCount.value) }
			]
	: [
			{ label: "Official links", value: String(props.election.officialResources.length) },
			{ label: "Key dates", value: String(props.election.keyDates.length) }
		]);
// A guide not matched to a verified address needs one local caveat; ZIP codes get the more specific reason.
const confirmationCaveat = computed(() => {
	if (props.scope === "statewide")
		return `${areaGuideLabels.value.limitation} Confirm your ballot with your election office.`;
	if (hasVerifiedContestPackage.value && props.coverageLimits?.length)
		return `${props.coverageLimits[0]} Confirm your ballot with your election office.`;

	if (props.location.lookupMode === "zip-preview")
		return "ZIP codes can span districts. Confirm your exact ballot with the official election tools.";

	return props.location.requiresOfficialConfirmation
		? "Not matched to a verified address. Confirm your exact ballot with the official election tools."
		: "";
});

function printBallot() {
	if (import.meta.client)
		window.print();
}
</script>

<template>
	<section class="app-shell">
		<div class="election-hero">
			<p class="election-hero__eyebrow">
				{{ props.location.displayName }}
			</p>
			<h1 class="election-hero__title font-serif">
				{{ props.election.name }}
			</h1>
			<dl class="election-hero__facts">
				<div class="election-hero__fact election-hero__fact--wide">
					<dt>Election Day</dt>
					<dd><span>{{ formatDate(props.election.date) }}</span></dd>
				</div>
				<div v-for="fact in facts" :key="fact.label" class="election-hero__fact">
					<dt>{{ fact.label }}</dt>
					<dd>{{ fact.value }}</dd>
				</div>
			</dl>
			<div class="election-hero__meta">
				<p class="election-hero__status" :class="`election-hero__status--${guideStatus.tone}`">
					<span :class="guideStatus.tone === 'success' ? 'i-carbon-checkmark-filled' : 'i-carbon-warning-alt'" aria-hidden="true" />
					{{ guideStatus.label }}
				</p>
				<UpdatedAt :value="props.election.updatedAt" />
				<button type="button" class="text-sm btn-secondary print-hidden" @click="printBallot">
					Print
				</button>
			</div>
			<p v-if="confirmationCaveat" class="text-sm text-app-muted mt-3 dark:text-app-muted-dark">
				{{ confirmationCaveat }}
			</p>
		</div>
	</section>
</template>
