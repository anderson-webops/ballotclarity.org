<script setup lang="ts">
import type { BallotPlanSelection, Contest, PlannedMeasureDecision } from "~/types/civic";
import { storeToRefs } from "pinia";
import { buildCompareRoute } from "~/stores/civic";
import { buildPlanUnavailableMessaging } from "~/utils/plan-messaging";

const civicStore = useCivicStore();
const route = useRoute();
const { ballotPlan, ballotPlanCount, compareCount, compareList, isHydrated, selectedElection, selectedLocation } = storeToRefs(civicStore);
const { formatDate, formatDateTime } = useFormatters();
const { activeLookupContext, activeNationwideResult, allowsGuideEntryPoints } = useGuideEntryGate();

const effectiveBallotPlan = computed(() => isHydrated.value ? ballotPlan.value : {});
const effectiveBallotPlanCount = computed(() => isHydrated.value ? ballotPlanCount.value : 0);
const effectiveCompareCount = computed(() => isHydrated.value ? compareCount.value : 0);
const effectiveCompareList = computed(() => isHydrated.value ? compareList.value : []);
const showPersistedPlanState = computed(() => isHydrated.value);
const requestedElectionSlug = computed(() => typeof route.query.election === "string" ? route.query.election : undefined);
const electionSlug = computed(() => {
	if (showPersistedPlanState.value && !allowsGuideEntryPoints.value)
		return undefined;

	return selectedElection.value?.slug ?? requestedElectionSlug.value;
});
const locationSlug = computed(() => isHydrated.value && allowsGuideEntryPoints.value ? selectedLocation.value?.slug : undefined);
const { data, error, pending } = await useBallot(electionSlug, locationSlug);
const lookupElection = computed(() => showPersistedPlanState.value
	? (selectedElection.value ?? activeNationwideResult.value?.election ?? data.value?.election ?? null)
	: (data.value?.election ?? null));
const planUnavailableMessaging = computed(() => buildPlanUnavailableMessaging(activeLookupContext.value));

usePageSeo({
	description: "Build a booth-ready ballot plan with saved selections, official links, and a print-friendly summary.",
	path: "/plan",
	title: "My Ballot Plan"
});

const completionStats = computed(() => {
	const contestCount = data.value?.election.contests.length ?? 0;
	const savedCount = effectiveBallotPlanCount.value;

	return {
		contestCount,
		pendingCount: Math.max(contestCount - savedCount, 0),
		progressLabel: contestCount ? `${savedCount} of ${contestCount} contests saved` : "No ballot loaded yet",
		progressPercent: contestCount ? Math.round((savedCount / contestCount) * 100) : 0,
		savedCount
	};
});
const planSummaryItems = computed(() => ([
	{
		label: "Saved",
		value: completionStats.value.savedCount
	},
	{
		label: "Still reviewing",
		value: completionStats.value.pendingCount
	},
	{
		label: "Election day",
		value: data.value ? formatDate(data.value.election.date) : "Not loaded"
	},
	{
		label: "Last guide update",
		value: data.value ? formatDateTime(data.value.updatedAt) : "Not loaded"
	}
]));

const decisionLabels: Record<PlannedMeasureDecision, string> = {
	no: "Marked NO",
	review: "Marked for review",
	yes: "Marked YES"
};

const plannedEntries = computed(() => {
	if (!data.value)
		return [];

	const contestsBySlug = new Map(data.value.election.contests.map(contest => [contest.slug, contest]));

	return Object.values(effectiveBallotPlan.value)
		.map((selection) => {
			const contest = contestsBySlug.get(selection.contestSlug);

			if (!contest)
				return null;

			return buildPlannedEntry(contest, selection);
		})
		.filter((entry): entry is NonNullable<typeof entry> => Boolean(entry))
		.sort((left, right) => left.index - right.index);
});

const unplannedContests = computed(() => {
	if (!data.value)
		return [];

	return data.value.election.contests.filter(contest => !effectiveBallotPlan.value[contest.slug]);
});
const mostRecentSavedAt = computed(() => plannedEntries.value.at(-1)?.savedAt ?? data.value?.updatedAt ?? "");
const compareHref = computed(() => buildCompareRoute(effectiveCompareList.value));

function buildPlannedEntry(contest: Contest, selection: BallotPlanSelection) {
	const index = data.value?.election.contests.findIndex(item => item.slug === contest.slug) ?? -1;

	if (selection.type === "candidate") {
		const candidate = contest.candidates?.find(item => item.slug === selection.candidateSlug);

		if (!candidate)
			return null;

		return {
			contest,
			href: `/candidate/${candidate.slug}`,
			index,
			label: candidate.name,
			note: `${candidate.party} · ${candidate.officeSought}`,
			savedAt: selection.savedAt,
			selectionLabel: "Saved candidate choice",
			sourceCount: candidate.sources.length,
			summary: candidate.ballotSummary,
			type: "candidate" as const
		};
	}

	const measure = contest.measures?.find(item => item.slug === selection.measureSlug);

	if (!measure)
		return null;

	return {
		contest,
		href: `/measure/${measure.slug}`,
		index,
		label: measure.title,
		note: measure.location,
		savedAt: selection.savedAt,
		selectionLabel: decisionLabels[selection.decision],
		sourceCount: measure.sources.length,
		summary: measure.plainLanguageExplanation,
		type: "measure" as const
	};
}

function printPlan() {
	if (import.meta.client)
		window.print();
}
</script>

<template>
	<section class="app-shell section-gap space-y-6 lg:space-y-10 sm:space-y-8">
		<header>
			<h1 class="text-5xl text-app-ink leading-tight font-serif dark:text-app-text-dark">
				My ballot plan
			</h1>
			<p v-if="data" class="text-base text-app-muted mt-3 dark:text-app-muted-dark">
				{{ data.election.name }} · {{ data.location.displayName }} · {{ formatDate(data.election.date) }}
			</p>
			<p v-else class="text-base text-app-muted mt-3 dark:text-app-muted-dark">
				The ballot plan opens after Ballot Clarity publishes a local guide for this area.
			</p>
			<div class="mt-5 flex flex-wrap gap-x-6 gap-y-3 items-center print-hidden">
				<button v-if="data" type="button" class="btn-primary" @click="printPlan">
					<span class="i-carbon-printer" aria-hidden="true" />
					Print
				</button>
				<NuxtLink v-if="data" :to="`/ballot/${electionSlug}`" class="btn-secondary">
					Back to ballot
				</NuxtLink>
				<NuxtLink v-else to="/#location-lookup" class="btn-primary">
					Enter your address
				</NuxtLink>
				<NuxtLink v-if="data && showPersistedPlanState && effectiveCompareCount >= 2" :to="compareHref" class="btn-secondary">
					Open compare
				</NuxtLink>
				<button v-if="data" type="button" class="text-sm text-app-muted font-medium underline decoration-app-line underline-offset-4 min-h-10 dark:text-app-muted-dark hover:text-app-ink focus-ring" @click="civicStore.clearBallotPlan()">
					Clear saved choices
				</button>
			</div>
		</header>

		<LocationChangePanel :election="lookupElection" />

		<div v-if="pending" class="space-y-6">
			<div class="rounded-lg bg-app-bg h-48 animate-pulse dark:bg-app-bg-dark" />
			<div class="rounded-lg bg-app-bg h-80 animate-pulse dark:bg-app-bg-dark" />
		</div>

		<div v-else-if="error || !data" class="max-w-3xl">
			<InfoCallout :title="planUnavailableMessaging.title" :tone="planUnavailableMessaging.tone">
				{{ planUnavailableMessaging.body }}
			</InfoCallout>
		</div>

		<div v-else class="space-y-8 lg:space-y-10">
			<section class="gap-8 grid lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] print-hidden">
				<div class="surface-panel">
					<h2 class="text-2xl text-app-ink font-serif dark:text-app-text-dark">
						{{ completionStats.progressLabel }}
					</h2>
					<div class="mt-4 rounded-full bg-app-line/60 h-3 dark:bg-app-line-dark">
						<div
							class="rounded-full bg-app-accent h-3 transition-[width]"
							:style="{ width: `${completionStats.progressPercent}%` }"
						/>
					</div>
					<div class="mt-6">
						<PageSummaryStrip :items="planSummaryItems" />
					</div>
				</div>

				<div class="surface-panel">
					<OfficialResourceList
						:resources="data.election.officialResources"
						title="Official links"
					/>
				</div>
			</section>

			<section class="print-only surface-panel">
				<p class="text-xs tracking-[0.06em] font-semibold uppercase">
					Ballot Clarity printout
				</p>
				<h2 class="text-3xl font-serif mt-3">
					{{ data.election.name }}
				</h2>
				<p class="text-sm mt-4">
					{{ data.location.displayName }} · {{ formatDate(data.election.date) }}
				</p>
			</section>

			<section v-if="!showPersistedPlanState" class="surface-panel print-hidden">
				<p class="text-base text-app-muted dark:text-app-muted-dark">
					Loading saved choices…
				</p>
			</section>

			<section v-else-if="plannedEntries.length" class="print-plan-list surface-panel">
				<div class="flex flex-wrap gap-4 items-start justify-between">
					<div>
						<h2 class="text-2xl text-app-ink font-serif dark:text-app-text-dark">
							Saved choices
						</h2>
					</div>
					<UpdatedAt :value="mostRecentSavedAt" label="Most recent save" />
				</div>
				<div class="print-plan-grid mt-6 space-y-4">
					<article v-for="entry in plannedEntries" :key="entry.contest.slug" class="print-plan-entry py-5 border-b border-app-line dark:border-app-line-dark last:border-b-0">
						<div class="flex flex-wrap gap-4 items-start justify-between">
							<div class="min-w-0">
								<p class="text-xs text-app-muted tracking-[0.06em] font-semibold uppercase dark:text-app-muted-dark">
									{{ entry.contest.office }}
								</p>
								<h3 class="text-2xl text-app-ink font-serif mt-2 dark:text-app-text-dark">
									{{ entry.label }}
								</h3>
								<p class="text-sm text-app-muted mt-2 dark:text-app-muted-dark">
									{{ entry.note }}
								</p>
							</div>
							<div class="flex flex-wrap gap-3 items-center">
								<TrustBadge :label="entry.selectionLabel" tone="accent" />
								<UpdatedAt :value="entry.savedAt" label="Saved" />
							</div>
						</div>
						<p class="text-base text-app-ink leading-7 mt-4 dark:text-app-text-dark">
							{{ entry.summary }}
						</p>
						<div class="mt-4 flex flex-wrap gap-3 items-center justify-between">
							<div class="flex flex-wrap gap-x-6 gap-y-2 print-hidden">
								<NuxtLink :to="entry.href" class="btn-secondary">
									Details
								</NuxtLink>
								<button type="button" class="btn-secondary" @click="civicStore.clearPlannedContest(entry.contest.slug)">
									Remove from plan
								</button>
							</div>
						</div>
					</article>
				</div>
			</section>

			<section v-else class="surface-panel">
				<h2 class="text-3xl text-app-ink font-serif dark:text-app-text-dark">
					No choices saved yet.
				</h2>
				<NuxtLink :to="`/ballot/${electionSlug}`" class="btn-primary mt-6">
					Go to the ballot
				</NuxtLink>
			</section>

			<ExpandableSection
				v-if="unplannedContests.length"
				eyebrow="Still open"
				title="Not decided yet"
				class="print-hidden"
			>
				<div class="mt-6 gap-4 grid md:grid-cols-2">
					<article v-for="contest in unplannedContests" :key="contest.slug" class="content-block">
						<p class="text-xs text-app-muted tracking-[0.06em] font-semibold uppercase dark:text-app-muted-dark">
							{{ contest.jurisdiction }}
						</p>
						<h3 class="text-xl text-app-ink font-serif mt-2 dark:text-app-text-dark">
							{{ contest.office }}
						</h3>
						<p class="text-sm text-app-muted leading-7 mt-3 dark:text-app-muted-dark">
							{{ contest.roleGuide.whyItMatters }}
						</p>
					</article>
				</div>
			</ExpandableSection>
		</div>
	</section>
</template>
