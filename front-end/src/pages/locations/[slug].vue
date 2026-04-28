<script setup lang="ts">
const civicStore = useCivicStore();
const route = useRoute();
const siteUrl = useSiteUrl();
const { formatDate } = useFormatters();
const jurisdictionSlug = computed(() => String(route.params.slug));
const { data: jurisdiction, error, pending } = await useJurisdiction(jurisdictionSlug);
const nextElectionSlug = computed(() => jurisdiction.value?.nextElectionSlug);
const { data: nextElectionData } = await useBallot(nextElectionSlug);

const registrationDeadline = computed(() => nextElectionData.value?.election.keyDates.find(item => item.label === "Registration deadline") ?? null);
const earlyVotingDate = computed(() => nextElectionData.value?.election.keyDates.find(item => item.label === "Early voting opens") ?? null);
const hasVerifiedContestPackage = computed(() => Boolean(nextElectionData.value?.guideContent?.verifiedContestPackage));
const hasPublishedGuideShell = computed(() => Boolean(nextElectionData.value?.guideContent?.publishedGuideShell));
const guideStatusNote = computed(() => nextElectionData.value?.guideContent?.verifiedContestPackage
	? "Contest, candidate, and measure pages are verified for this area."
	: nextElectionData.value?.guideContent?.publishedGuideShell
		? "Official election links are current. Contest, candidate, and measure pages are still under local review."
		: "Use this page to orient yourself, then verify deadlines, polling logistics, and late changes with the linked official election office and voter tools.");

watchEffect(() => {
	if (jurisdiction.value) {
		civicStore.setLocation({
			coverageLabel: `Current area: ${jurisdiction.value.displayName}`,
			displayName: jurisdiction.value.displayName,
			slug: jurisdiction.value.slug,
			state: jurisdiction.value.state
		});
	}

	if (nextElectionData.value) {
		civicStore.setGuideSurfaceContext({
			date: nextElectionData.value.election.date,
			jurisdictionSlug: nextElectionData.value.election.jurisdictionSlug,
			locationName: nextElectionData.value.election.locationName,
			name: nextElectionData.value.election.name,
			slug: nextElectionData.value.election.slug,
			updatedAt: nextElectionData.value.election.updatedAt
		}, {
			coverageLabel: `Current area: ${jurisdiction.value?.displayName ?? nextElectionData.value.location.displayName}`,
			displayName: nextElectionData.value.location.displayName,
			lookupMode: nextElectionData.value.location.lookupMode,
			requiresOfficialConfirmation: nextElectionData.value.location.requiresOfficialConfirmation,
			slug: nextElectionData.value.location.slug,
			state: nextElectionData.value.location.state
		}, nextElectionData.value.guideContent);
	}
});

usePageSeo({
	description: jurisdiction.value?.description ?? "Jurisdiction hub with official election office links, key dates, and current election routes.",
	jsonLd: jurisdiction.value
		? {
				"@context": "https://schema.org",
				"@type": "GovernmentOffice",
				"address": {
					"@type": "PostalAddress",
					"addressCountry": "US",
					"addressLocality": "Union City",
					"addressRegion": jurisdiction.value.state,
					"streetAddress": jurisdiction.value.officialOffice.address
				},
				"email": jurisdiction.value.officialOffice.email,
				"name": jurisdiction.value.officialOffice.name,
				"telephone": jurisdiction.value.officialOffice.phone,
				"url": `${siteUrl}/locations/${jurisdiction.value.slug}`
			}
		: undefined,
	path: `/locations/${jurisdictionSlug.value}`,
	title: jurisdiction.value ? `${jurisdiction.value.displayName} Elections and Ballot Info` : "Location guide"
});
</script>

<template>
	<section class="app-shell section-gap">
		<div v-if="pending" class="space-y-6">
			<div class="surface-panel bg-white/70 h-72 animate-pulse dark:bg-app-panel-dark/70" />
			<div class="gap-6 grid lg:grid-cols-3">
				<div v-for="index in 3" :key="index" class="surface-panel bg-white/70 h-56 animate-pulse dark:bg-app-panel-dark/70" />
			</div>
		</div>

		<div v-else-if="error || !jurisdiction" class="max-w-3xl">
			<InfoCallout title="Location hub not available" tone="warning">
				This location hub could not be loaded. Return to the home page or coverage profile and try again.
			</InfoCallout>
		</div>

		<div v-else class="space-y-8">
			<header class="gap-8 grid xl:grid-cols-[minmax(0,1.2fr)_minmax(22rem,0.85fr)]">
				<div class="surface-panel">
					<div class="flex flex-wrap gap-2">
						<TrustBadge label="Jurisdiction hub" tone="accent" />
						<TrustBadge label="Official office links" />
						<TrustBadge
							v-if="hasPublishedGuideShell"
							:label="hasVerifiedContestPackage ? 'Verified ballot guide' : 'Election overview available'"
						/>
					</div>
					<p class="text-xs text-app-muted tracking-[0.24em] font-semibold mt-6 uppercase dark:text-app-muted-dark">
						{{ jurisdiction.jurisdictionType }} guide
					</p>
					<h1 class="text-5xl text-app-ink leading-tight font-serif mt-3 dark:text-app-text-dark">
						{{ jurisdiction.displayName }}
					</h1>
					<p class="text-base text-app-muted leading-8 mt-5 max-w-3xl dark:text-app-muted-dark">
						{{ jurisdiction.description }}
					</p>
					<div class="mt-6 flex flex-wrap gap-4 items-center">
						<UpdatedAt :value="jurisdiction.updatedAt" />
						<NuxtLink :to="`/elections/${jurisdiction.nextElectionSlug}`" class="btn-primary">
							Open current election overview
						</NuxtLink>
						<NuxtLink to="/districts" class="btn-secondary">
							District pages
						</NuxtLink>
						<NuxtLink to="/representatives" class="btn-secondary">
							Representatives
						</NuxtLink>
					</div>
				</div>

				<div class="space-y-4">
					<InfoCallout title="Verify with the election office" tone="warning">
						{{ guideStatusNote }} Use {{ jurisdiction.officialOffice.name }} and the linked official voter tools for deadlines, polling logistics, and late changes.
					</InfoCallout>
				</div>
			</header>

			<section class="gap-5 grid md:grid-cols-3">
				<div class="surface-panel">
					<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
						Next election
					</p>
					<p class="text-xl text-app-ink font-semibold mt-3 dark:text-app-text-dark">
						{{ nextElectionData?.election.name || jurisdiction.nextElectionName }}
					</p>
					<p class="text-sm text-app-muted mt-3 dark:text-app-muted-dark">
						{{ nextElectionData ? formatDate(nextElectionData.election.date) : "Current published election" }}
					</p>
				</div>
				<div class="surface-panel">
					<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
						Registration deadline
					</p>
					<p class="text-xl text-app-ink font-semibold mt-3 dark:text-app-text-dark">
						{{ registrationDeadline ? formatDate(registrationDeadline.date) : "See election calendar" }}
					</p>
					<p class="text-sm text-app-muted mt-3 dark:text-app-muted-dark">
						{{ registrationDeadline?.note || "Review the official calendar for late updates." }}
					</p>
				</div>
				<div class="surface-panel">
					<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
						Early voting opens
					</p>
					<p class="text-xl text-app-ink font-semibold mt-3 dark:text-app-text-dark">
						{{ earlyVotingDate ? formatDate(earlyVotingDate.date) : "Check office updates" }}
					</p>
					<p class="text-sm text-app-muted mt-3 dark:text-app-muted-dark">
						{{ earlyVotingDate?.note || "County schedules may vary by site and day." }}
					</p>
				</div>
			</section>

			<section class="gap-6 grid xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
				<div class="surface-panel">
					<div class="flex gap-4 items-start justify-between">
						<div>
							<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
								Official election office
							</p>
							<h2 class="text-3xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
								{{ jurisdiction.officialOffice.name }}
							</h2>
						</div>
						<TrustBadge label="Primary authority" tone="accent" />
					</div>
					<dl class="text-sm text-app-muted leading-7 mt-6 space-y-3 dark:text-app-muted-dark">
						<div>
							<dt class="text-app-ink font-semibold dark:text-app-text-dark">
								Address
							</dt>
							<dd>{{ jurisdiction.officialOffice.address }}</dd>
						</div>
						<div>
							<dt class="text-app-ink font-semibold dark:text-app-text-dark">
								Phone
							</dt>
							<dd>{{ jurisdiction.officialOffice.phone }}</dd>
						</div>
						<div>
							<dt class="text-app-ink font-semibold dark:text-app-text-dark">
								Email
							</dt>
							<dd>
								<a :href="`mailto:${jurisdiction.officialOffice.email}`" class="rounded-md hover:text-app-accent focus-ring dark:hover:text-white">
									{{ jurisdiction.officialOffice.email }}
								</a>
							</dd>
						</div>
						<div>
							<dt class="text-app-ink font-semibold dark:text-app-text-dark">
								Hours
							</dt>
							<dd>{{ jurisdiction.officialOffice.hours }}</dd>
						</div>
					</dl>
				</div>

				<div class="surface-panel">
					<OfficialResourceList
						:resources="jurisdiction.officialResources"
						title="Official links and notices"
						note="These links collect the election-office calendars, contact details, and voting instructions attached to this page."
					/>
				</div>
			</section>
		</div>
	</section>
</template>
