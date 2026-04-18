<script setup lang="ts">
const { formatDateTime } = useFormatters();
const { data, error, pending } = await useRepresentatives();

const summaryItems = computed(() => {
	if (!data.value)
		return [];

	return [
		{ label: "Current representatives", note: "Incumbents on the active ballot surfaces.", value: data.value.representatives.length },
		{ label: "District pages", note: "Office-area hubs with candidate fields.", value: data.value.districts.length, href: "/districts" },
		{ label: "Updated", note: "Directory freshness.", value: formatDateTime(data.value.updatedAt) }
	];
});
const representativeStats = computed(() => {
	if (!data.value)
		return [];

	return [
		{
			label: "Representatives",
			note: "Current officeholders tied to the active published ballot surfaces.",
			value: data.value.representatives.length
		},
		{
			label: "District pages",
			note: "Linked district hubs with office and candidate context.",
			value: data.value.districts.length
		},
		{
			label: "Average source depth",
			note: "Average linked source count across the current representative directory entries.",
			value: data.value.representatives.length
				? Math.round(data.value.representatives.reduce((total, representative) => total + representative.sourceCount, 0) / data.value.representatives.length)
				: 0
		}
	];
});
const representativeProvenanceItems = computed(() => {
	if (!data.value)
		return [];

	const totalSources = data.value.representatives.reduce((total, representative) => total + representative.sourceCount, 0);

	return [
		{
			detail: "Current directory rows tied to the active district and candidate surfaces.",
			label: "Directory entries",
			value: data.value.representatives.length
		},
		{
			detail: "Aggregate source counts attached to the linked representative profiles.",
			label: "Linked sources",
			value: totalSources
		},
		{
			detail: "District hubs available from this directory.",
			label: "District hubs",
			value: data.value.districts.length
		},
		{
			detail: "Last representative-directory refresh in the current build.",
			label: "Updated",
			value: formatDateTime(data.value.updatedAt)
		}
	];
});
const representativeTimelineItems = computed(() => {
	if (!data.value)
		return [];

	return [
		{
			date: data.value.updatedAt,
			id: "directory-refresh",
			summary: "The current representative directory was refreshed for the active coverage build.",
			title: "Representative directory refreshed"
		},
		{
			date: data.value.updatedAt,
			id: "district-links",
			summary: `${data.value.districts.length} district hubs are linked from the directory for office context and contest depth.`,
			title: "District crosswalk attached"
		},
		{
			date: data.value.updatedAt,
			id: "profile-links",
			summary: "Each current representative row points to funding and influence follow-on surfaces when those pages exist.",
			title: "Profile follow-ons published"
		}
	];
});

usePageSeo({
	description: "Directory of current representatives on the active Ballot Clarity ballot coverage, with links to district, funding, and influence pages.",
	path: "/representatives",
	title: "Representatives"
});
</script>

<template>
	<section class="app-shell section-gap space-y-8">
		<header class="gap-6 grid xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
			<div class="surface-panel">
				<div class="flex flex-wrap gap-2">
					<VerificationBadge label="Representative directory" tone="accent" />
					<VerificationBadge label="Incumbents only" />
				</div>
				<h1 class="text-5xl text-app-ink font-serif mt-5 dark:text-app-text-dark">
					Representatives
				</h1>
				<p class="text-base text-app-muted leading-8 mt-5 dark:text-app-muted-dark">
					This directory pulls out the currently serving officials who also appear on the active ballot coverage, so you can jump straight into their district, funding, and influence pages.
				</p>
			</div>

			<OfficeContextCard
				title="How the representative layer is organized"
				office-label="Current officeholders connected to district, funding, and influence surfaces"
				summary="This page is a person-first directory for the incumbent layer of the current published coverage. It is meant to get a voter from a known officeholder to the right district, funding, or influence surface with minimal scanning."
				:stats="representativeStats"
				:responsibilities="[
					'Find the current officeholder tied to a district page.',
					'Open campaign-finance context directly when it exists.',
					'Open influence context directly without scanning the whole ballot first.',
				]"
				uncertainty="This directory is coverage-shaped, not nationwide officeholding inventory. It reflects the current modeled Ballot Clarity surfaces."
				why-it-matters="A voter often starts with a person they already know. This page gives them a direct route from that officeholder to the relevant district and profile context."
				:badges="[
					{ label: 'Representative directory', tone: 'accent' },
					{ label: 'Incumbents only', tone: 'neutral' },
				]"
			/>
		</header>

		<div v-if="pending" class="gap-6 grid lg:grid-cols-2">
			<div v-for="index in 3" :key="index" class="surface-panel bg-white/70 h-72 animate-pulse dark:bg-app-panel-dark/70" />
		</div>

		<div v-else-if="error || !data" class="max-w-3xl">
			<InfoCallout title="Representative directory unavailable" tone="warning">
				The representative directory could not be loaded. Open a district or contest page and try again.
			</InfoCallout>
		</div>

		<div v-else class="space-y-6">
			<PageSummaryStrip :items="summaryItems" />
			<SourceProvenanceStrip
				:badges="[
					{ label: 'Linked profile sources', tone: 'accent' },
					{ label: 'Directory refresh visible', tone: 'neutral' },
				]"
				:items="representativeProvenanceItems"
				note="The representative directory is a crosswalk surface. Record-level source detail lives on the linked candidate, district, funding, and influence pages."
				title="How the representative directory is grounded"
				uncertainty="This page summarizes linked source depth rather than repeating every profile source inline. Open the profile or district page when you need the full evidence trail."
			/>
			<TimelineList
				:items="representativeTimelineItems"
				badge-label="Directory lifecycle"
				note="This timeline explains what this surface represents operationally. It is a directory lifecycle, not a full personal career timeline for each officeholder."
				title="How the representative layer is kept current"
				uncertainty="Detailed action timelines remain on the linked candidate or representative profile surfaces, not in this directory overview."
			/>

			<section class="gap-6 grid lg:grid-cols-2">
				<article
					v-for="representative in data.representatives"
					:key="representative.slug"
					class="surface-panel"
				>
					<div class="flex flex-wrap gap-3 items-center">
						<h2 class="text-3xl text-app-ink font-serif dark:text-app-text-dark">
							{{ representative.name }}
						</h2>
						<IncumbentBadge />
					</div>
					<p class="text-sm text-app-muted mt-4 dark:text-app-muted-dark">
						{{ representative.party }} · {{ representative.officeSought }}
					</p>
					<p class="text-sm text-app-muted leading-7 mt-4 dark:text-app-muted-dark">
						{{ representative.summary }}
					</p>
					<div class="mt-5 flex flex-wrap gap-2">
						<VerificationBadge :label="representative.districtLabel" />
						<VerificationBadge :label="`${representative.sourceCount} sources`" tone="accent" />
					</div>
					<div class="mt-6 flex flex-wrap gap-3">
						<NuxtLink :to="`/districts/${representative.districtSlug}`" class="btn-secondary">
							District page
						</NuxtLink>
						<NuxtLink :to="representative.href" class="btn-secondary">
							Profile
						</NuxtLink>
						<NuxtLink :to="`${representative.href}/funding`" class="btn-primary">
							Funding
						</NuxtLink>
						<NuxtLink :to="`${representative.href}/influence`" class="btn-secondary">
							Influence
						</NuxtLink>
					</div>
				</article>
			</section>
		</div>
	</section>
</template>
