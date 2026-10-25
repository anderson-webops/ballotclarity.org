<script setup lang="ts">
import { useNow } from "@vueuse/core";
import { buildKeyDateTimeline, calendarDaysUntil, describeDaysAway } from "~/utils/election-timeline";
import { fullAreaGuideLabels } from "~/utils/guide-scope";
import { limitedBallotNotice } from "~/utils/results-summary";

const civicStore = useCivicStore();
const { displayTimeZone, formatDate, formatDateTime } = useFormatters();
const electionSlug = useRouteStringParam("slug");
const { data, error, pending } = await useBallot(electionSlug);
const guideStatusNote = computed(() => data.value?.scope === "statewide"
	? fullAreaGuideLabels(data.value?.location.state).limitation
	: !data.value?.guideContent?.verifiedContestPackage && data.value?.guideContent?.publishedGuideShell
			? limitedBallotNotice
			: data.value?.coverageLimits?.[0] ?? "");

// Ticks each minute so "Today" and "Next" move on when a deadline passes while the page stays open.
const now = useNow({ interval: 60_000 });
const keyDateTimeline = computed(() => data.value ? buildKeyDateTimeline(data.value.election.keyDates, now.value, displayTimeZone.value) : []);
const upcomingKeyDates = computed(() => keyDateTimeline.value.filter(entry => entry.status !== "passed"));
const pastKeyDates = computed(() => keyDateTimeline.value.filter(entry => entry.status === "passed"));
const electionDayLabel = computed(() => {
	if (!data.value?.election.date)
		return "";

	const daysAway = calendarDaysUntil(data.value.election.date, now.value, displayTimeZone.value);
	return daysAway < 0 ? "" : describeDaysAway(daysAway);
});

watchEffect(() => {
	if (data.value) {
		civicStore.setGuideSurfaceContext({
			date: data.value.election.date,
			jurisdictionSlug: data.value.election.jurisdictionSlug,
			locationName: data.value.election.locationName,
			name: data.value.election.name,
			slug: data.value.election.slug,
			updatedAt: data.value.election.updatedAt
		}, data.value.location, data.value.guideContent);
	}
});

usePageSeo({
	description: data.value?.election.description ?? "Election overview with key dates, official links, and change log.",
	jsonLd: data.value
		? {
				"@context": "https://schema.org",
				"@type": "Event",
				"eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
				"eventStatus": "https://schema.org/EventScheduled",
				"isAccessibleForFree": true,
				"location": {
					"@type": "AdministrativeArea",
					"name": data.value.election.locationName
				},
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
			<div class="gap-6 grid lg:grid-cols-3">
				<div v-for="index in 3" :key="index" class="rounded-lg bg-app-bg h-48 animate-pulse dark:bg-app-bg-dark" />
			</div>
		</div>

		<div v-else-if="error || !data" class="max-w-3xl">
			<InfoCallout title="Election overview not available" tone="warning">
				Try again later.
			</InfoCallout>
		</div>

		<div v-else class="section-stack print:space-y-8">
			<header class="max-w-4xl">
				<div>
					<p class="eyebrow">
						{{ data.location.displayName }}
					</p>
					<h1 class="text-4xl text-app-ink leading-tight font-serif mt-2 sm:text-5xl dark:text-app-text-dark">
						{{ data.election.name }}
					</h1>
					<p class="text-lg text-app-ink font-semibold mt-5 flex flex-wrap gap-x-3 gap-y-1 items-center dark:text-app-text-dark">
						<span class="i-carbon-calendar text-app-accent" aria-hidden="true" />
						Election Day <span>{{ formatDate(data.election.date) }}</span>
						<span v-if="electionDayLabel" class="text-sm text-app-accent font-semibold px-2 py-0.5 rounded-md bg-app-accent/10">{{ electionDayLabel }}</span>
					</p>
					<p v-if="guideStatusNote" class="text-sm text-[#8a5b0a] font-semibold mt-3 inline-flex gap-1.5 items-center dark:text-[#efc77b]">
						<span class="i-carbon-warning-alt" aria-hidden="true" />
						{{ guideStatusNote }}
					</p>
					<div class="mt-5 flex flex-wrap gap-x-6 gap-y-3 items-center">
						<NuxtLink
							v-if="data.guideContent?.verifiedContestPackage"
							:to="`/ballot/${data.election.slug}`"
							class="btn-primary"
						>
							Read the ballot guide
						</NuxtLink>
						<NuxtLink v-else :to="`/locations/${data.election.jurisdictionSlug}`" class="btn-primary">
							Open location hub
						</NuxtLink>
					</div>
				</div>
			</header>

			<section v-if="data.election.keyDates.length" id="key-dates" class="surface-panel">
				<div class="flex flex-wrap gap-4 items-start justify-between">
					<div>
						<h2 class="text-2xl text-app-ink font-serif sm:text-3xl dark:text-app-text-dark">
							Key dates and deadlines
						</h2>
					</div>
					<UpdatedAt :value="data.election.updatedAt" label="Updated" />
				</div>
				<ElectionKeyDates v-if="upcomingKeyDates.length" :entries="upcomingKeyDates" />
				<section v-if="pastKeyDates.length" class="mt-6">
					<h3 class="text-sm text-app-muted font-semibold dark:text-app-muted-dark">
						Past dates ({{ pastKeyDates.length }})
					</h3>
					<ElectionKeyDates :entries="pastKeyDates" />
				</section>
			</section>

			<section class="surface-panel">
				<h2 class="text-2xl text-app-ink font-serif sm:text-3xl dark:text-app-text-dark">
					Official links and notices
				</h2>
				<div class="mt-6">
					<OfficialResourceList :resources="data.election.officialResources" />
				</div>
				<section v-if="data.election.changeLog.length" class="mt-6">
					<h3 class="text-sm text-app-ink font-semibold dark:text-app-text-dark">
						Updates
					</h3>
					<ul class="mt-4 space-y-3">
						<li v-for="entry in data.election.changeLog" :key="entry.id" class="content-block">
							<p class="text-sm text-app-ink font-semibold dark:text-app-text-dark">
								{{ formatDateTime(entry.date) }}
							</p>
							<p class="text-sm text-app-muted leading-7 mt-2 dark:text-app-muted-dark">
								{{ entry.summary }}
							</p>
						</li>
					</ul>
				</section>
			</section>

			<section v-if="data.guideContent?.verifiedContestPackage && data.election.contests.length" class="surface-panel">
				<div class="flex flex-wrap gap-4 items-center justify-between">
					<div>
						<h2 class="text-3xl text-app-ink font-serif dark:text-app-text-dark">
							Ballot items
						</h2>
					</div>
				</div>

				<div class="mt-6 gap-5 grid xl:grid-cols-2">
					<NuxtLink v-for="contest in data.election.contests" :key="contest.slug" :to="`/contest/${contest.slug}`" class="content-block block focus-ring">
						<h3 class="text-2xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
							{{ contest.type === 'measure' ? contest.title : contest.office }}
						</h3>
						<p v-if="contest.description || contest.measures?.[0]?.summary" class="text-sm text-app-muted leading-7 mt-3 dark:text-app-muted-dark">
							{{ contest.description || contest.measures?.[0]?.summary }}
						</p>
					</NuxtLink>
				</div>
			</section>
		</div>
	</section>
</template>
