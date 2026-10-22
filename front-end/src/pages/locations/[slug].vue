<script setup lang="ts">
const civicStore = useCivicStore();
const siteUrl = useSiteUrl();
const { formatDate } = useFormatters();
const jurisdictionSlug = useRouteStringParam("slug");
const { data: jurisdiction, error, pending } = await useJurisdiction(jurisdictionSlug);
const nextElectionSlug = computed(() => jurisdiction.value?.nextElectionSlug);
const { data: nextElectionData } = await useBallot(nextElectionSlug);

const registrationDeadline = computed(() => nextElectionData.value?.election.keyDates.find(item => item.label === "Registration deadline") ?? null);
const earlyVotingDate = computed(() => nextElectionData.value?.election.keyDates.find(item => item.label === "Early voting opens") ?? null);

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
	description: jurisdiction.value?.description ?? "Jurisdiction hub with official election office links, key dates, and current election pages.",
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
			<div class="rounded-lg bg-app-bg h-72 animate-pulse dark:bg-app-bg-dark" />
			<div class="gap-6 grid lg:grid-cols-3">
				<div v-for="index in 3" :key="index" class="rounded-lg bg-app-bg h-56 animate-pulse dark:bg-app-bg-dark" />
			</div>
		</div>

		<div v-else-if="error || !jurisdiction" class="max-w-3xl">
			<InfoCallout title="Location hub not available" tone="warning">
				Try again later.
			</InfoCallout>
		</div>

		<div v-else class="space-y-8">
			<header>
				<div class="surface-panel">
					<h1 class="text-5xl text-app-ink leading-tight font-serif dark:text-app-text-dark">
						{{ jurisdiction.displayName }}
					</h1>
					<div class="mt-5 flex flex-wrap gap-x-6 gap-y-3 items-center">
						<NuxtLink :to="`/elections/${jurisdiction.nextElectionSlug}`" class="btn-primary">
							Election overview
						</NuxtLink>
						<UpdatedAt :value="jurisdiction.updatedAt" />
					</div>
				</div>
			</header>

			<section class="surface-panel">
				<div class="flex flex-wrap gap-4 items-start justify-between">
					<div>
						<p class="text-xs text-app-muted tracking-[0.06em] font-semibold uppercase dark:text-app-muted-dark">
							Key election dates
						</p>
						<h2 class="text-3xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
							{{ nextElectionData?.election.name || jurisdiction.nextElectionName }}
						</h2>
					</div>
				</div>
				<dl class="mt-6 gap-5 grid md:grid-cols-3">
					<div>
						<dt class="text-xs text-app-muted tracking-[0.06em] font-semibold uppercase dark:text-app-muted-dark">
							Election day
						</dt>
						<dd class="text-xl text-app-ink font-semibold mt-3 dark:text-app-text-dark">
							<span>{{ nextElectionData ? formatDate(nextElectionData.election.date) : "Current published election" }}</span>
						</dd>
					</div>
					<div>
						<dt class="text-xs text-app-muted tracking-[0.06em] font-semibold uppercase dark:text-app-muted-dark">
							Registration deadline
						</dt>
						<dd class="text-xl text-app-ink font-semibold mt-3 dark:text-app-text-dark">
							<span>{{ registrationDeadline ? formatDate(registrationDeadline.date) : "See election calendar" }}</span>
						</dd>
						<dd class="text-sm text-app-muted mt-3 dark:text-app-muted-dark">
							{{ registrationDeadline?.note || "Review the official calendar for late updates." }}
						</dd>
					</div>
					<div>
						<dt class="text-xs text-app-muted tracking-[0.06em] font-semibold uppercase dark:text-app-muted-dark">
							Early voting opens
						</dt>
						<dd class="text-xl text-app-ink font-semibold mt-3 dark:text-app-text-dark">
							<span>{{ earlyVotingDate ? formatDate(earlyVotingDate.date) : "Check office updates" }}</span>
						</dd>
						<dd class="text-sm text-app-muted mt-3 dark:text-app-muted-dark">
							{{ earlyVotingDate?.note || "County schedules may vary by site and day." }}
						</dd>
					</div>
				</dl>
			</section>

			<section class="gap-6 grid xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
				<div class="surface-panel">
					<div class="flex gap-4 items-start justify-between">
						<div>
							<p class="text-xs text-app-muted tracking-[0.06em] font-semibold uppercase dark:text-app-muted-dark">
								Official election office
							</p>
							<h2 class="text-3xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
								{{ jurisdiction.officialOffice.name }}
							</h2>
						</div>
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
					/>
				</div>
			</section>
		</div>
	</section>
</template>
