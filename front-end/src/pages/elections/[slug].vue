<script setup lang="ts">
import { buildKeyDateTimeline, calendarDaysUntil, describeDaysAway } from "~/utils/election-timeline";
import { fullAreaGuideLabels } from "~/utils/guide-scope";
import { limitedBallotNotice } from "~/utils/results-summary";

const civicStore = useCivicStore();
const { displayTimeZone, formatDate } = useFormatters();
const electionSlug = useRouteStringParam("slug");
const { data, error, pending } = await useBallot(electionSlug);
const guideStatusNote = computed(() => data.value?.candidateRecordSource
	? ""
	: data.value?.scope === "statewide"
		? fullAreaGuideLabels(data.value?.location.state).limitation
		: !data.value?.guideContent?.verifiedContestPackage && data.value?.guideContent?.publishedGuideShell
				? limitedBallotNotice
				: data.value?.coverageLimits?.[0] ?? "");
const clock = useElectionClock();
const now = computed(() => new Date(clock.value));
const keyDateTimeline = computed(() => data.value ? buildKeyDateTimeline(data.value.election.keyDates, now.value, displayTimeZone.value) : []);
const upcomingKeyDates = computed(() => keyDateTimeline.value.filter(entry => entry.status !== "passed").slice(0, 3));
const electionDayLabel = computed(() => {
	if (!data.value?.election.date) return "";
	const daysAway = calendarDaysUntil(data.value.election.date, now.value, displayTimeZone.value);
	return daysAway < 0 ? "" : describeDaysAway(daysAway);
});

watch(data, (value) => {
	if (!value) return;
	civicStore.setGuideSurfaceContext({
		date: value.election.date,
		jurisdictionSlug: value.election.jurisdictionSlug,
		locationName: value.election.locationName,
		name: value.election.name,
		slug: value.election.slug,
		updatedAt: value.election.updatedAt
	}, value.location, value.guideContent);
}, { immediate: true });

usePageSeo({
	description: "Election candidates, dates and official voting information.",
	jsonLd: data.value
		? {
				"@context": "https://schema.org",
				"@type": "Event",
				"eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
				"eventStatus": "https://schema.org/EventScheduled",
				"isAccessibleForFree": true,
				"location": { "@type": "AdministrativeArea", "name": data.value.election.locationName },
				"name": data.value.election.name,
				"startDate": data.value.election.date
			}
		: undefined,
	path: `/elections/${electionSlug.value}`,
	title: data.value?.election.name ?? "Election overview"
});
</script>

<template>
	<section class="app-shell section-gap">
		<div v-if="pending" class="space-y-6">
			<div class="rounded-lg bg-app-bg h-72 animate-pulse dark:bg-app-bg-dark" />
		</div>
		<div v-else-if="error || !data" class="max-w-3xl">
			<InfoCallout title="Election overview not available" tone="warning">
				Try again later.
			</InfoCallout>
		</div>
		<div v-else class="section-stack print:space-y-8">
			<div class="election-overview-layout gap-x-14 gap-y-10 grid items-start">
				<header class="min-w-0">
					<p class="eyebrow">
						{{ data.location.displayName }}
					</p>
					<h1 class="text-4xl text-app-ink leading-tight font-serif mt-2 sm:text-5xl dark:text-app-text-dark">
						{{ data.election.name }}
					</h1>
					<p class="text-base text-app-ink font-semibold mt-5 flex flex-wrap gap-x-3 gap-y-1 items-center dark:text-app-text-dark">
						<time :datetime="data.election.date">{{ formatDate(data.election.date) }}</time>
						<span v-if="electionDayLabel" class="text-sm text-app-muted dark:text-app-muted-dark">{{ electionDayLabel }}</span>
					</p>
					<p v-if="guideStatusNote" class="text-sm text-app-muted leading-6 mt-4 dark:text-app-muted-dark">
						{{ guideStatusNote }}
					</p>
					<NuxtLink v-if="data.guideContent?.verifiedContestPackage" :to="`/ballot/${data.election.slug}`" class="btn-secondary mt-5 inline-block">
						Ballot guide
					</NuxtLink>
				</header>
				<aside v-if="data.election.keyDates.length" id="key-dates" aria-labelledby="key-dates-heading" class="min-w-0 lg:row-span-2 lg:col-start-2 lg:row-start-1">
					<h2 id="key-dates-heading" class="text-lg text-app-ink font-semibold dark:text-app-text-dark">
						Dates and deadlines
					</h2>
					<ElectionKeyDates v-if="upcomingKeyDates.length" :entries="upcomingKeyDates" :election-date="data.election.date" compact />
					<p v-else class="text-sm text-app-muted mt-3 dark:text-app-muted-dark">
						No upcoming dates.
					</p>
					<NuxtLink :to="`/election-dates/${data.election.slug}`" class="text-sm text-app-accent mt-3 py-2 underline inline-block focus-ring">
						All dates
					</NuxtLink>
				</aside>
				<div v-if="data.candidateRecordSource" class="election-overview-candidates min-w-0">
					<ElectionCandidateRecords :source="data.candidateRecordSource" />
				</div>
			</div>
			<section v-if="data.guideContent?.verifiedContestPackage && data.election.contests.length" class="surface-panel">
				<h2 class="text-2xl text-app-ink font-serif dark:text-app-text-dark">
					Ballot items
				</h2>
				<div class="mt-6 gap-8 grid xl:grid-cols-2">
					<NuxtLink v-for="contest in data.election.contests" :key="contest.slug" :to="`/contest/${contest.slug}`" class="content-block block focus-ring">
						<h3 class="text-xl text-app-ink font-semibold dark:text-app-text-dark">
							{{ contest.type === 'measure' ? contest.title : contest.office }}
						</h3>
					</NuxtLink>
				</div>
			</section>
			<section v-if="data.election.officialResources.length" class="surface-panel">
				<h2 class="text-2xl text-app-ink font-serif dark:text-app-text-dark">
					Voting information
				</h2>
				<ul class="mt-5 space-y-3">
					<li v-for="resource in data.election.officialResources" :key="resource.label">
						<SafeExternalLink v-if="resource.url" :href="resource.url" external-icon class="text-app-accent py-2 underline inline-flex gap-2 items-center focus-ring">
							{{ resource.label }}
						</SafeExternalLink>
						<p v-else class="text-app-ink dark:text-app-text-dark">
							{{ resource.label }}
						</p>
					</li>
				</ul>
			</section>
		</div>
	</section>
</template>

<style scoped>
@media (min-width: 1024px) {
	.election-overview-layout {
		grid-template-columns: minmax(0, 1fr) 19rem;
	}
	.election-overview-candidates {
		grid-column: 1;
	}
}
</style>
