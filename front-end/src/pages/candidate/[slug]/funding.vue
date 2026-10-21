<script setup lang="ts">
const { openLayerLink, overviewLink } = useRouteLayerNavigation();
const candidateSlug = useRouteStringParam("slug");
const { formatCurrency, formatPercent } = useFormatters();
const { data: candidate, error, pending } = await useCandidate(candidateSlug);

const breadcrumbs = computed(() => [
	{ label: "Home", to: "/" },
	overviewLink.value,
	{ label: candidate.value?.name ?? "Candidate profile", to: candidate.value ? `/candidate/${candidate.value.slug}` : undefined },
	{ label: "Funding" }
]);

const summaryItems = computed(() => {
	if (!candidate.value)
		return [];

	return [
		{ label: "Total raised", note: "Current filing-window total.", value: formatCurrency(candidate.value.funding.totalRaised) },
		{ label: "Cash on hand", value: formatCurrency(candidate.value.funding.cashOnHand) },
		{ label: "Small-donor share", note: "Share attributed to smaller donors in the current summary.", value: formatPercent(candidate.value.funding.smallDonorShare) }
	];
});

usePageSeo({
	description: candidate.value?.funding.summary ?? "Candidate funding page with campaign-finance summary, top funders, and source links.",
	path: `/candidate/${candidateSlug.value}/funding`,
	title: candidate.value ? `${candidate.value.name} Funding` : "Candidate funding"
});
</script>

<template>
	<section class="app-shell section-gap space-y-8">
		<div v-if="pending" class="space-y-6">
			<div class="rounded-lg bg-app-bg h-80 animate-pulse dark:bg-app-bg-dark" />
			<div class="rounded-lg bg-app-bg h-64 animate-pulse dark:bg-app-bg-dark" />
		</div>

		<GuideUnavailableState
			v-else-if="error || !candidate"
			message="Funding details for this candidate aren't published yet."
			:primary-label="openLayerLink.label"
			:primary-to="openLayerLink.to"
			secondary-label="Coverage"
			secondary-to="/coverage"
			tertiary-label="Report missing information"
			tertiary-to="/contact"
			title="Funding detail not published yet"
		/>

		<div v-else class="space-y-8">
			<header class="surface-panel">
				<AppBreadcrumbs :items="breadcrumbs" />
				<h1 class="text-5xl text-app-ink font-serif mt-5 dark:text-app-text-dark">
					{{ candidate.name }} funding
				</h1>
				<p class="text-base text-app-muted leading-8 mt-5 dark:text-app-muted-dark">
					{{ candidate.funding.summary }}
				</p>
				<div class="mt-6 flex flex-wrap gap-3">
					<NuxtLink :to="`/candidate/${candidate.slug}`" class="btn-secondary">
						Back to profile
					</NuxtLink>
					<NuxtLink :to="`/candidate/${candidate.slug}/influence`" class="btn-secondary">
						Influence
					</NuxtLink>
					<SourceDrawer :sources="candidate.funding.sources" :title="`${candidate.name} funding sources`" button-label="Funding sources" />
				</div>
				<div class="mt-6">
					<PageSummaryStrip :items="summaryItems" />
				</div>
			</header>

			<section class="gap-6 grid xl:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)]">
				<div class="surface-panel">
					<h2 class="text-3xl text-app-ink font-serif dark:text-app-text-dark">
						Top funders
					</h2>
					<ul class="mt-6 space-y-3">
						<li v-for="funder in candidate.funding.topFunders" :key="`${funder.name}-${funder.category}`" class="content-block">
							<div class="flex flex-wrap gap-4 items-center justify-between">
								<div>
									<p class="text-lg text-app-ink font-semibold dark:text-app-text-dark">
										{{ funder.name }}
									</p>
									<p class="text-sm text-app-muted mt-2 dark:text-app-muted-dark">
										{{ funder.category }}
									</p>
								</div>
								<p class="text-lg text-app-ink font-semibold dark:text-app-text-dark">
									{{ formatCurrency(funder.amount) }}
								</p>
							</div>
						</li>
					</ul>
				</div>
			</section>
		</div>
	</section>
</template>
