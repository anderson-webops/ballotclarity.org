<script setup lang="ts">
const { formatDate } = useFormatters();
const { data, error, pending } = await useCoverage();

usePageSeo({
	description: "Election information and source records.",
	path: "/coverage",
	title: "Coverage"
});
</script>

<template>
	<section class="app-shell section-gap">
		<div v-if="pending" class="rounded-lg bg-app-bg h-56 animate-pulse dark:bg-app-bg-dark" />
		<InfoCallout v-else-if="error || !data" title="Coverage information unavailable" tone="warning">
			Try again later.
		</InfoCallout>
		<div v-else class="max-w-3xl">
			<h1 class="text-5xl text-app-ink font-serif dark:text-app-text-dark">
				Coverage
			</h1>
			<section v-if="data.launchTarget && data.guideContent?.verifiedContestPackage" class="mt-6">
				<h2 class="text-2xl text-app-ink font-serif dark:text-app-text-dark">
					{{ data.launchTarget.displayName }}
				</h2>
				<p class="text-base text-app-ink mt-3 dark:text-app-text-dark">
					{{ data.launchTarget.currentElectionName }} · {{ formatDate(data.launchTarget.currentElectionDate) }}
				</p>
				<p v-if="data.launchTarget.nextElectionDate" class="text-sm text-app-muted mt-2 dark:text-app-muted-dark">
					{{ data.launchTarget.nextElectionName }} · {{ formatDate(data.launchTarget.nextElectionDate) }}
				</p>
				<NuxtLink :to="`/locations/${data.launchTarget.slug}`" class="btn-secondary mt-4">
					Election information
				</NuxtLink>
			</section>
			<nav aria-label="Coverage" class="mt-8 flex flex-wrap gap-5">
				<NuxtLink to="/#location-lookup" class="btn-primary">
					Look up an address or ZIP
				</NuxtLink>
				<NuxtLink to="/records" class="btn-secondary">
					Candidate records
				</NuxtLink>
				<NuxtLink to="/sources" class="btn-secondary">
					Sources
				</NuxtLink>
			</nav>
		</div>
	</section>
</template>
