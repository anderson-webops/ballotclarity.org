<script setup lang="ts">
import type { BallotPlanSelection, Contest, PlannedMeasureDecision } from "~/types/civic";
import { storeToRefs } from "pinia";

const civicStore = useCivicStore();
const { ballotPlan, ballotPlanCount, compareCount, selectedElection, selectedLocation } = storeToRefs(civicStore);
const { formatDate, formatDateTime } = useFormatters();

const electionSlug = computed(() => selectedElection.value?.slug ?? "2026-metro-county-general");
const locationSlug = computed(() => selectedLocation.value?.slug);
const { data, error, pending } = await useBallot(electionSlug, locationSlug);

usePageSeo({
	description: "Build a booth-ready ballot plan with saved selections, official links, and a print-friendly summary.",
	path: "/plan",
	title: "My Ballot Plan"
});

const completionStats = computed(() => {
	const contestCount = data.value?.election.contests.length ?? 0;
	const savedCount = ballotPlanCount.value;

	return {
		contestCount,
		pendingCount: Math.max(contestCount - savedCount, 0),
		progressLabel: contestCount ? `${savedCount} of ${contestCount} contests saved` : "No ballot loaded yet",
		progressPercent: contestCount ? Math.round((savedCount / contestCount) * 100) : 0,
		savedCount
	};
});

const decisionLabels: Record<PlannedMeasureDecision, string> = {
	no: "Marked NO",
	review: "Marked for review",
	yes: "Marked YES"
};

const plannedEntries = computed(() => {
	if (!data.value)
		return [];

	const contestsBySlug = new Map(data.value.election.contests.map(contest => [contest.slug, contest]));

	return Object.values(ballotPlan.value)
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

	return data.value.election.contests.filter(contest => !ballotPlan.value[contest.slug]);
});
const mostRecentSavedAt = computed(() => plannedEntries.value.at(-1)?.savedAt ?? data.value?.updatedAt ?? "");

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
	<section class="app-shell section-gap">
		<header class="surface-panel">
			<div class="flex flex-wrap gap-2">
				<TrustBadge label="Booth-ready workflow" tone="accent" />
				<TrustBadge label="Print-friendly" />
				<TrustBadge label="Demo ballot plan" tone="warning" />
			</div>
			<p class="text-xs text-app-muted tracking-[0.24em] font-semibold mt-5 uppercase dark:text-app-muted-dark">
				My ballot plan
			</p>
			<h1 class="text-5xl text-app-ink leading-tight font-serif mt-3 dark:text-app-text-dark">
				Save choices, review gaps, and bring a clean plan with you.
			</h1>
			<p class="text-base text-app-muted leading-8 mt-6 max-w-3xl dark:text-app-muted-dark">
				This page turns the ballot guide into a portable reference. Save one choice per contest, mark measures for review, and print the result if you do not want to rely on a phone at the polling place.
			</p>
			<div class="mt-6 flex flex-wrap gap-4 items-center">
				<button type="button" class="btn-primary" @click="printPlan">
					<span class="i-carbon-printer" />
					Print this plan
				</button>
				<NuxtLink to="/accessibility" class="btn-secondary print-hidden">
					Accessibility and print standards
				</NuxtLink>
				<NuxtLink :to="`/ballot/${electionSlug}`" class="btn-secondary">
					Return to ballot
				</NuxtLink>
				<button type="button" class="btn-secondary" @click="civicStore.clearBallotPlan()">
					Clear saved choices
				</button>
				<NuxtLink v-if="compareCount >= 2" to="/compare" class="btn-secondary">
					Open compare
				</NuxtLink>
			</div>
		</header>

		<div v-if="pending" class="space-y-6">
			<div class="surface-panel bg-white/70 h-48 animate-pulse dark:bg-app-panel-dark/70" />
			<div class="surface-panel bg-white/70 h-80 animate-pulse dark:bg-app-panel-dark/70" />
		</div>

		<div v-else-if="error || !data" class="max-w-3xl">
			<InfoCallout title="Ballot plan unavailable" tone="warning">
				The plan page needs a ballot context. Start from the ballot guide first so Ballot Clarity can load the demo election and location.
			</InfoCallout>
		</div>

		<div v-else class="space-y-6">
			<section class="gap-6 grid lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] print-hidden">
				<div class="surface-panel">
					<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
						Plan progress
					</p>
					<h2 class="text-3xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
						{{ completionStats.progressLabel }}
					</h2>
					<p class="text-sm text-app-muted leading-7 mt-4 dark:text-app-muted-dark">
						Location: {{ data.location.displayName }}. Election: {{ data.election.name }} on {{ formatDate(data.election.date) }}.
					</p>
					<div class="mt-6 rounded-full bg-app-line/60 h-3 dark:bg-app-line-dark">
						<div
							class="rounded-full bg-app-accent h-3 transition-[width]"
							:style="{ width: `${completionStats.progressPercent}%` }"
						/>
					</div>
					<div class="mt-6 gap-4 grid sm:grid-cols-3">
						<div class="p-4 rounded-2xl bg-app-bg dark:bg-app-bg-dark/70">
							<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
								Saved
							</p>
							<p class="text-3xl text-app-ink font-semibold mt-3 dark:text-app-text-dark">
								{{ completionStats.savedCount }}
							</p>
						</div>
						<div class="p-4 rounded-2xl bg-app-bg dark:bg-app-bg-dark/70">
							<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
								Still reviewing
							</p>
							<p class="text-3xl text-app-ink font-semibold mt-3 dark:text-app-text-dark">
								{{ completionStats.pendingCount }}
							</p>
						</div>
						<div class="p-4 rounded-2xl bg-app-bg dark:bg-app-bg-dark/70">
							<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
								Last guide update
							</p>
							<p class="text-sm text-app-ink font-semibold mt-3 dark:text-app-text-dark">
								{{ formatDateTime(data.updatedAt) }}
							</p>
						</div>
					</div>
				</div>

				<div class="surface-panel">
					<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
						Before you head out
					</p>
					<ul class="text-sm text-app-muted leading-7 mt-5 space-y-3 dark:text-app-muted-dark">
						<li>Verify polling-place, early-voting, or ballot-return logistics in the official links before leaving.</li>
						<li>Print this page or copy the key choices if phone use may be restricted where you vote.</li>
						<li>Keep undecided contests visible here instead of rushing through them in the booth.</li>
					</ul>
					<div class="mt-6">
						<OfficialResourceList
							:resources="data.election.officialResources"
							title="Official logistics links"
							note="Use these links for final voting instructions and deadline verification."
						/>
					</div>
				</div>
			</section>

			<section class="print-only surface-panel">
				<p class="text-xs tracking-[0.24em] font-semibold uppercase">
					Ballot Clarity demo printout
				</p>
				<h2 class="text-3xl font-serif mt-3">
					{{ data.election.name }}
				</h2>
				<p class="text-sm mt-4">
					{{ data.location.displayName }} · {{ formatDate(data.election.date) }}
				</p>
				<p class="text-sm mt-4">
					This print view keeps saved choices and source reminders in a simple, high-contrast format you can bring as a personal reference.
				</p>
			</section>

			<section v-if="plannedEntries.length" class="print-plan-list surface-panel">
				<div class="flex flex-wrap gap-4 items-start justify-between">
					<div>
						<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
							Saved choices
						</p>
						<h2 class="text-3xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
							Your current ballot plan
						</h2>
					</div>
					<UpdatedAt :value="mostRecentSavedAt" label="Most recent save" />
				</div>
				<div class="print-plan-grid mt-6 space-y-4">
					<article v-for="entry in plannedEntries" :key="entry.contest.slug" class="print-plan-entry px-5 py-5 border border-app-line/80 rounded-3xl bg-app-bg dark:border-app-line-dark dark:bg-app-bg-dark/70">
						<div class="flex flex-wrap gap-4 items-start justify-between">
							<div>
								<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
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
						<p class="text-sm text-app-muted leading-7 mt-4 dark:text-app-muted-dark">
							{{ entry.summary }}
						</p>
						<div class="mt-5 gap-4 grid lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
							<ContestRoleGuide :contest="entry.contest" />
							<div class="px-5 py-5 border border-app-line/80 rounded-3xl bg-white/80 dark:border-app-line-dark dark:bg-app-panel-dark/70">
								<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
									Next action
								</p>
								<p class="text-sm text-app-muted leading-7 mt-4 dark:text-app-muted-dark">
									Use the linked detail page if you want to check sources again, compare another option, or change this saved choice.
								</p>
								<p class="text-sm text-app-ink font-semibold mt-4 dark:text-app-text-dark">
									{{ entry.sourceCount }} sources linked in the detail page
								</p>
								<div class="mt-5 flex flex-wrap gap-3">
									<NuxtLink :to="entry.href" class="btn-secondary">
										Open detail page
									</NuxtLink>
									<button type="button" class="btn-secondary" @click="civicStore.clearPlannedContest(entry.contest.slug)">
										Remove from plan
									</button>
								</div>
							</div>
						</div>
					</article>
				</div>
			</section>

			<section v-else class="surface-panel">
				<h2 class="text-3xl text-app-ink font-serif dark:text-app-text-dark">
					No contests saved yet.
				</h2>
				<p class="text-sm text-app-muted leading-7 mt-4 max-w-3xl dark:text-app-muted-dark">
					Save one candidate or measure choice from the ballot guide to build a printable reference. Ballot Clarity keeps the plan neutral: it records your current choice and sends you back to source-backed pages when you want to review it.
				</p>
				<NuxtLink :to="`/ballot/${electionSlug}`" class="btn-primary mt-6">
					Start saving choices
				</NuxtLink>
			</section>

			<section v-if="unplannedContests.length" class="surface-panel print-hidden">
				<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
					Still open
				</p>
				<h2 class="text-3xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
					Contests still marked for review
				</h2>
				<div class="mt-6 gap-4 grid md:grid-cols-2">
					<article v-for="contest in unplannedContests" :key="contest.slug" class="p-4 rounded-2xl bg-app-bg dark:bg-app-bg-dark/70">
						<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
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
			</section>
		</div>
	</section>
</template>
