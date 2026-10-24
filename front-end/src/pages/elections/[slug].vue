<script setup lang="ts">
import { useNow } from "@vueuse/core";
import { buildKeyDateTimeline, calendarDaysUntil, describeDaysAway } from "~/utils/election-timeline";
import { limitedBallotNotice } from "~/utils/results-summary";

const civicStore = useCivicStore();
const { displayTimeZone, formatDate } = useFormatters();
const electionSlug = useRouteStringParam("slug");
const { data, error, pending } = await useBallot(electionSlug);
// Only a guide that is still under review needs a status line; a verified guide speaks for itself.
const guideStatusNote = computed(() => !data.value?.guideContent?.verifiedContestPackage && data.value?.guideContent?.publishedGuideShell
	? limitedBallotNotice
	: "");

// Ticks each minute so "Today" and "Next" move on when a deadline passes while the page stays open.
const now = useNow({ interval: 60_000 });
const keyDateTimeline = computed(() => data.value ? buildKeyDateTimeline(data.value.election.keyDates, now.value, displayTimeZone.value) : []);
const upcomingKeyDates = computed(() => keyDateTimeline.value.filter(entry => entry.status !== "passed"));
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

		<div v-else class="space-y-8">
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

			<section id="key-dates" class="surface-panel">
				<div class="flex flex-wrap gap-4 items-start justify-between">
					<div>
						<h2 class="text-2xl text-app-ink font-serif sm:text-3xl dark:text-app-text-dark">
							Key dates and deadlines
						</h2>
					</div>
					<UpdatedAt :value="data.election.updatedAt" label="Updated" />
				</div>
				<ElectionKeyDates v-if="upcomingKeyDates.length" :entries="upcomingKeyDates" />
			</section>

			<section class="surface-panel">
				<h2 class="text-2xl text-app-ink font-serif sm:text-3xl dark:text-app-text-dark">
					Official links and notices
				</h2>
				<div class="mt-6">
					<OfficialResourceList :resources="data.election.officialResources" />
				</div>
			</section>

			<section v-if="data.guideContent?.verifiedContestPackage && data.election.contests.length" class="surface-panel">
				<div class="flex flex-wrap gap-4 items-center justify-between">
					<div>
						<h2 class="text-3xl text-app-ink font-serif dark:text-app-text-dark">
							Contest index
						</h2>
					</div>
					<NuxtLink :to="`/ballot/${data.election.slug}`" class="btn-secondary">
						Read the full ballot guide
					</NuxtLink>
				</div>

				<div class="mt-6 gap-5 grid xl:grid-cols-2">
					<article v-for="contest in data.election.contests" :key="contest.slug" class="content-block">
						<p class="text-xs text-app-muted tracking-[0.06em] font-semibold uppercase dark:text-app-muted-dark">
							{{ contest.jurisdiction }}
						</p>
						<h3 class="text-2xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
							{{ contest.office }}
						</h3>
						<p class="text-sm text-app-muted leading-7 mt-3 dark:text-app-muted-dark">
							{{ contest.description }}
						</p>
						<NuxtLink :to="`/contest/${contest.slug}`" class="text-sm text-app-accent font-semibold mt-4 rounded-lg inline-flex gap-2 items-center focus-ring">
							<span>Contest page</span>
							<span class="i-carbon-arrow-right" />
						</NuxtLink>
						<NuxtLink
							v-if="contest.type === 'candidate'"
							:to="`/districts/${contest.slug}`"
							class="text-sm text-app-accent font-semibold mt-3 rounded-lg inline-flex gap-2 items-center focus-ring"
						>
							<span>District page</span>
							<span class="i-carbon-arrow-right" />
						</NuxtLink>
						<ul class="text-sm text-app-muted leading-7 mt-4 space-y-2 dark:text-app-muted-dark">
							<template v-if="contest.type === 'candidate'">
								<li v-for="candidate in contest.candidates" :key="candidate.slug" class="flex gap-3 items-start">
									<span class="i-carbon-user-avatar text-app-accent mt-1" />
									<NuxtLink :to="`/candidate/${candidate.slug}`" class="rounded-md hover:text-app-accent focus-ring dark:hover:text-white">
										{{ candidate.name }}
									</NuxtLink>
								</li>
							</template>
							<template v-else>
								<li v-for="measure in contest.measures" :key="measure.slug" class="flex gap-3 items-start">
									<span class="i-carbon-document text-app-accent mt-1" />
									<NuxtLink :to="`/measure/${measure.slug}`" class="rounded-md hover:text-app-accent focus-ring dark:hover:text-white">
										{{ measure.title }}
									</NuxtLink>
								</li>
							</template>
						</ul>
					</article>
				</div>
			</section>
		</div>
	</section>
</template>
