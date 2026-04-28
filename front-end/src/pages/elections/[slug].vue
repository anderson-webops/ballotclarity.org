<script setup lang="ts">
const civicStore = useCivicStore();
const route = useRoute();
const { formatDate, formatDateTime } = useFormatters();
const electionSlug = computed(() => String(route.params.slug));
const { data, error, pending } = await useBallot(electionSlug);
const guideStatusTitle = computed(() => "Guide status");
const guideStatusNote = computed(() => data.value?.guideContent?.verifiedContestPackage
	? "Contest, candidate, and measure pages are verified for this area."
	: data.value?.guideContent?.publishedGuideShell
		? "Official election links are current. Contest, candidate, and measure pages are still under local review."
		: "Use this page for key dates and official links, then open the ballot guide for contest-by-contest reading.");

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
	description: data.value?.election.description ?? "Election overview with key dates, official links, contest index, and change log.",
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
			<div class="surface-panel bg-white/70 h-72 animate-pulse dark:bg-app-panel-dark/70" />
			<div class="gap-6 grid lg:grid-cols-3">
				<div v-for="index in 3" :key="index" class="surface-panel bg-white/70 h-48 animate-pulse dark:bg-app-panel-dark/70" />
			</div>
		</div>

		<div v-else-if="error || !data" class="max-w-3xl">
			<InfoCallout title="Election overview not available" tone="warning">
				This election overview could not be loaded. Return to the location hub or the home page and try again.
			</InfoCallout>
		</div>

		<div v-else class="space-y-8">
			<header class="gap-8 grid xl:grid-cols-[minmax(0,1.2fr)_minmax(22rem,0.85fr)]">
				<div class="surface-panel">
					<div class="flex flex-wrap gap-2">
						<TrustBadge label="Election overview" tone="accent" />
						<TrustBadge label="Official links attached" />
					</div>
					<p class="text-xs text-app-muted tracking-[0.24em] font-semibold mt-6 uppercase dark:text-app-muted-dark">
						{{ data.location.displayName }}
					</p>
					<h1 class="text-5xl text-app-ink leading-tight font-serif mt-3 dark:text-app-text-dark">
						{{ data.election.name }}
					</h1>
					<p class="text-base text-app-muted leading-8 mt-5 max-w-3xl dark:text-app-muted-dark">
						{{ data.election.description }}
					</p>
					<div class="mt-6 flex flex-wrap gap-4 items-center">
						<p class="text-sm text-app-muted inline-flex gap-2 items-center dark:text-app-muted-dark">
							<span class="i-carbon-calendar" />
							Election Day {{ formatDate(data.election.date) }}
						</p>
					</div>
				</div>

				<div class="space-y-4">
					<InfoCallout :title="guideStatusTitle" tone="warning">
						{{ guideStatusNote }}
					</InfoCallout>
					<div class="flex flex-wrap gap-3">
						<NuxtLink
							v-if="data.guideContent?.verifiedContestPackage"
							:to="`/ballot/${data.election.slug}`"
							class="btn-primary"
						>
							Open ballot guide
						</NuxtLink>
						<NuxtLink v-else :to="`/locations/${data.election.jurisdictionSlug}`" class="btn-primary">
							Open location hub
						</NuxtLink>
						<NuxtLink to="/districts" class="btn-secondary">
							District pages
						</NuxtLink>
						<NuxtLink to="/representatives" class="btn-secondary">
							Representatives
						</NuxtLink>
					</div>
				</div>
			</header>

			<section class="surface-panel">
				<div class="flex flex-wrap gap-4 items-start justify-between">
					<div>
						<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
							Key dates
						</p>
						<h2 class="text-3xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
							Deadlines and election windows
						</h2>
					</div>
					<UpdatedAt :value="data.election.updatedAt" label="Updated" />
				</div>
				<ol class="mt-6 divide-app-line divide-y dark:divide-app-line-dark">
					<li v-for="item in data.election.keyDates" :key="item.label" class="py-4 gap-3 grid first:pt-0 last:pb-0 md:grid-cols-[minmax(11rem,0.38fr)_minmax(0,1fr)]">
						<div>
							<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
								{{ item.label }}
							</p>
							<p class="text-base text-app-ink font-semibold mt-2 dark:text-app-text-dark">
								{{ item.date.includes("T") ? formatDateTime(item.date) : formatDate(item.date) }}
							</p>
						</div>
						<p class="text-sm text-app-muted leading-7 dark:text-app-muted-dark">
							{{ item.note || "Review the official county calendar for source context." }}
						</p>
					</li>
				</ol>
			</section>

			<section class="surface-panel">
				<h2 class="text-3xl text-app-ink font-serif dark:text-app-text-dark">
					Official links and notices
				</h2>
				<p class="text-sm text-app-muted leading-7 mt-4 dark:text-app-muted-dark">
					These links point to the official election notices, calendars, and logistics attached to this page.
				</p>
				<div class="mt-6">
					<OfficialResourceList :resources="data.election.officialResources" />
				</div>
				<details v-if="data.election.changeLog.length" class="mt-6 surface-row">
					<summary class="text-sm text-app-ink font-semibold cursor-pointer dark:text-app-text-dark focus-ring">
						Change log
					</summary>
					<ul class="mt-4 space-y-3">
						<li v-for="entry in data.election.changeLog" :key="entry.id" class="px-4 py-4 rounded-2xl bg-app-bg dark:bg-app-bg-dark/70">
							<p class="text-sm text-app-ink font-semibold dark:text-app-text-dark">
								{{ formatDateTime(entry.date) }}
							</p>
							<p class="text-sm text-app-muted leading-7 mt-2 dark:text-app-muted-dark">
								{{ entry.summary }}
							</p>
						</li>
					</ul>
				</details>
			</section>

			<section v-if="data.election.contests.length" class="surface-panel">
				<div class="flex flex-wrap gap-4 items-center justify-between">
					<div>
						<h2 class="text-3xl text-app-ink font-serif dark:text-app-text-dark">
							Contest index
						</h2>
						<p class="text-sm text-app-muted leading-7 mt-3 dark:text-app-muted-dark">
							See the contests on the ballot before opening the full guide.
						</p>
					</div>
					<NuxtLink :to="`/ballot/${data.election.slug}`" class="btn-secondary">
						Read the full ballot guide
					</NuxtLink>
				</div>

				<div class="mt-6 gap-5 grid xl:grid-cols-2">
					<article v-for="contest in data.election.contests" :key="contest.slug" class="p-5 border border-app-line/70 rounded-3xl bg-white/80 dark:border-app-line-dark dark:bg-app-panel-dark/70">
						<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
							{{ contest.jurisdiction }}
						</p>
						<h3 class="text-2xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
							{{ contest.office }}
						</h3>
						<p class="text-sm text-app-muted leading-7 mt-3 dark:text-app-muted-dark">
							{{ contest.description }}
						</p>
						<NuxtLink :to="`/contest/${contest.slug}`" class="text-sm text-app-accent font-semibold mt-4 rounded-lg inline-flex gap-2 items-center focus-ring">
							<span>Open canonical contest page</span>
							<span class="i-carbon-arrow-right" />
						</NuxtLink>
						<NuxtLink
							v-if="contest.type === 'candidate'"
							:to="`/districts/${contest.slug}`"
							class="text-sm text-app-accent font-semibold mt-3 rounded-lg inline-flex gap-2 items-center focus-ring"
						>
							<span>Open district page</span>
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
