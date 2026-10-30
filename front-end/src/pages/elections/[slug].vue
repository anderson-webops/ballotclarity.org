<script setup lang="ts">
import type { ElectionSectionLink } from "~/utils/election-candidates";
import { electionTimeZone } from "~/utils/election-time-zone";
import { buildKeyDateTimeline, calendarDaysUntil, describeDaysAway } from "~/utils/election-timeline";
import { fullAreaGuideLabels } from "~/utils/guide-scope";
import { limitedBallotNotice } from "~/utils/results-summary";

const civicStore = useCivicStore();
const { displayTimeZone, formatDate } = useFormatters();
const electionSlug = useRouteStringParam("slug");
const { data, error, pending } = await useBallot(electionSlug);
const jurisdictionSlug = computed(() => data.value?.election.jurisdictionSlug);
const { data: jurisdiction } = await useJurisdiction(jurisdictionSlug);
const officialResources = computed(() => [...new Map([...(data.value?.election.officialResources ?? []), ...(jurisdiction.value?.officialResources ?? [])].map(resource => [resource.url || resource.label, resource])).values()]);
const candidateSections = ref<ElectionSectionLink[]>([]);
const sectionLinks = computed<ElectionSectionLink[]>(() => [
	...(data.value?.candidateRecordSource ? candidateSections.value : []),
	...(data.value?.guideContent?.verifiedContestPackage && data.value.election.contests.length ? [{ href: "#ballot-items", label: "Ballot items" }] : []),
	...(officialResources.value.length || jurisdiction.value?.officialOffice.phone ? [{ href: "#voting-info", label: "Voting info" }] : [])
]);
watch(() => data.value?.candidateRecordSource?.sourceId, () => {
	candidateSections.value = [];
});
const guideStatusNote = computed(() => data.value?.candidateRecordSource
	? ""
	: data.value?.scope === "statewide"
		? fullAreaGuideLabels(data.value?.location.state).limitation
		: !data.value?.guideContent?.verifiedContestPackage && data.value?.guideContent?.publishedGuideShell
				? limitedBallotNotice
				: data.value?.coverageLimits?.[0] ?? "");
const clock = useElectionClock();
const now = computed(() => new Date(clock.value));
const timeZone = computed(() => electionTimeZone(data.value?.election, displayTimeZone.value));
const keyDateTimeline = computed(() => data.value ? buildKeyDateTimeline(data.value.election.keyDates, now.value, timeZone.value) : []);
const upcomingKeyDates = computed(() => keyDateTimeline.value.filter(entry => entry.status !== "passed").slice(0, 3));
const electionDayLabel = computed(() => {
	if (!data.value?.election.date) return "";
	const daysAway = calendarDaysUntil(data.value.election.date, now.value, timeZone.value);
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
					<div v-if="upcomingKeyDates.length" class="mt-5 lg:hidden">
						<ElectionKeyDates :entries="upcomingKeyDates.slice(0, 1)" :election-date="data.election.date" :time-zone="timeZone" compact />
						<NuxtLink :to="`/election-dates/${data.election.slug}`" class="text-sm text-app-accent py-2 underline inline-block focus-ring">
							All dates
						</NuxtLink>
					</div>
					<nav v-if="sectionLinks.length" aria-label="Election sections" class="mt-5 flex flex-wrap gap-x-5 gap-y-2 lg:hidden">
						<a v-for="section in sectionLinks" :key="section.href" :href="section.href" class="text-sm text-app-accent py-2 underline focus-ring">{{ section.label }}</a>
					</nav>
				</header>
				<aside v-if="data.election.keyDates.length || sectionLinks.length" aria-label="Election navigation" class="min-w-0 hidden lg:row-span-2 lg:col-start-2 lg:row-start-1 lg:block">
					<section v-if="data.election.keyDates.length" id="key-dates" aria-labelledby="key-dates-heading">
						<h2 id="key-dates-heading" class="text-lg text-app-ink font-semibold dark:text-app-text-dark">
							Dates and deadlines
						</h2>
						<ElectionKeyDates v-if="upcomingKeyDates.length" :entries="upcomingKeyDates" :election-date="data.election.date" :time-zone="timeZone" compact />
						<NuxtLink :to="`/election-dates/${data.election.slug}`" class="text-sm text-app-accent mt-3 py-2 underline inline-block focus-ring">
							All dates
						</NuxtLink>
					</section>
					<nav v-if="sectionLinks.length" aria-labelledby="election-sections-heading" class="mt-8 pt-6 border-t border-app-line dark:border-app-line-dark">
						<h2 id="election-sections-heading" class="text-lg text-app-ink font-semibold dark:text-app-text-dark">
							On this page
						</h2>
						<ul class="mt-3 space-y-5">
							<li v-for="section in sectionLinks" :key="section.href">
								<a :href="section.href" class="text-app-ink font-semibold px-3 py-2 border-app-line border-l-2 flex min-h-11 transition-colors duration-150 items-center dark:text-app-text-dark focus-visible:text-app-accent hover:text-app-accent dark:border-app-line-dark hover:border-app-accent focus-ring dark:focus-visible:text-white dark:hover:text-white">
									{{ section.label }}
								</a>
								<ul v-if="section.children?.length" class="ml-3 hidden lg:grid">
									<li v-for="office in section.children" :key="office.href">
										<a :href="office.href" :title="office.title" class="text-sm text-app-muted px-3 py-2 border-app-line border-l-2 flex min-h-11 transition-colors duration-150 items-center dark:text-app-muted-dark focus-visible:text-app-ink hover:text-app-ink dark:border-app-line-dark hover:border-app-accent focus-ring dark:focus-visible:text-white dark:hover:text-white">
											{{ office.label }}
										</a>
									</li>
								</ul>
							</li>
						</ul>
					</nav>
				</aside>
				<div v-if="data.candidateRecordSource" class="election-overview-candidates min-w-0">
					<ElectionCandidateRecords :source="data.candidateRecordSource" @sections="candidateSections = $event" />
				</div>
			</div>
			<section v-if="data.guideContent?.verifiedContestPackage && data.election.contests.length" aria-labelledby="ballot-items" class="surface-panel">
				<h2 id="ballot-items" tabindex="-1" class="text-2xl text-app-ink font-serif dark:text-app-text-dark">
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
			<section v-if="officialResources.length || jurisdiction?.officialOffice.phone" aria-labelledby="voting-info" class="surface-panel">
				<h2 id="voting-info" tabindex="-1" class="text-2xl text-app-ink font-serif dark:text-app-text-dark">
					Voting information
				</h2>
				<ul class="mt-5 space-y-3">
					<li v-for="resource in officialResources" :key="resource.label">
						<SafeExternalLink v-if="resource.url" :href="resource.url" external-icon class="text-app-accent py-2 underline inline-flex gap-2 items-center focus-ring">
							{{ resource.label }}
						</SafeExternalLink>
						<p v-else class="text-app-ink dark:text-app-text-dark">
							{{ resource.label }}
						</p>
					</li>
				</ul>
				<address v-if="jurisdiction?.officialOffice.phone || jurisdiction?.officialOffice.address" class="text-sm leading-7 mt-8 not-italic space-y-2">
					<p class="font-semibold">
						{{ jurisdiction?.officialOffice.name }}
					</p>
					<p v-if="jurisdiction?.officialOffice.address">
						{{ jurisdiction.officialOffice.address }}
					</p>
					<a v-if="jurisdiction?.officialOffice.phone" :href="`tel:${jurisdiction.officialOffice.phone.replace(/[^+\d]/g, '')}`" class="text-app-accent underline focus-ring">{{ jurisdiction.officialOffice.phone }}</a>
					<a v-if="jurisdiction?.officialOffice.email" :href="`mailto:${jurisdiction.officialOffice.email}`" class="text-app-accent underline block break-all focus-ring">{{ jurisdiction.officialOffice.email }}</a>
					<p v-if="jurisdiction?.officialOffice.hours">
						{{ jurisdiction.officialOffice.hours }}
					</p>
				</address>
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
