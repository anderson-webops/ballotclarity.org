<script setup lang="ts">
import { currentCoverageElectionSlug } from "~/constants";
import { buildCandidateFinanceCategoryBreakdown } from "~/utils/graphics-schema";

const route = useRoute();
const candidateSlug = computed(() => String(route.params.slug));
const { formatCompactNumber, formatCurrency, formatDateTime, formatPercent } = useFormatters();
const { data: candidate, error, pending } = await useCandidate(candidateSlug);

const breadcrumbs = computed(() => [
	{ label: "Home", to: "/" },
	{ label: "Ballot guide", to: `/ballot/${currentCoverageElectionSlug}` },
	{ label: candidate.value?.name ?? "Candidate profile", to: candidate.value ? `/candidate/${candidate.value.slug}` : undefined },
	{ label: "Funding" }
]);

const summaryItems = computed(() => {
	if (!candidate.value)
		return [];

	return [
		{ label: "Total raised", note: "Current filing-window total.", value: formatCurrency(candidate.value.funding.totalRaised) },
		{ label: "Cash on hand", note: "Reported funds still available.", value: formatCurrency(candidate.value.funding.cashOnHand) },
		{ label: "Small-donor share", note: "Share attributed to smaller donors in the current summary.", value: formatPercent(candidate.value.funding.smallDonorShare) }
	];
});
const financeBreakdown = computed(() => candidate.value ? buildCandidateFinanceCategoryBreakdown(candidate.value, formatDateTime) : null);

usePageSeo({
	description: candidate.value?.funding.summary ?? "Candidate funding page with campaign-finance summary, top funders, and source links.",
	path: `/candidate/${candidateSlug.value}/funding`,
	title: candidate.value ? `${candidate.value.name} Funding` : "Candidate funding"
});
</script>

<template>
	<section class="app-shell section-gap space-y-8">
		<div v-if="pending" class="space-y-6">
			<div class="surface-panel bg-white/70 h-80 animate-pulse dark:bg-app-panel-dark/70" />
			<div class="surface-panel bg-white/70 h-64 animate-pulse dark:bg-app-panel-dark/70" />
		</div>

		<div v-else-if="error || !candidate" class="max-w-3xl">
			<InfoCallout title="Funding page unavailable" tone="warning">
				This candidate funding page could not be loaded. Return to the candidate profile and try again.
			</InfoCallout>
		</div>

		<div v-else class="space-y-8">
			<header class="surface-panel">
				<AppBreadcrumbs :items="breadcrumbs" />
				<div class="flex flex-wrap gap-2">
					<VerificationBadge label="Funding page" tone="accent" />
					<VerificationBadge :label="candidate.party" />
				</div>
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
						Open influence page
					</NuxtLink>
					<SourceDrawer :sources="candidate.funding.sources" :title="`${candidate.name} funding sources`" button-label="Funding sources" />
				</div>
				<div class="mt-6">
					<PageSummaryStrip :items="summaryItems" />
				</div>
				<InfoCallout v-if="financeBreakdown" class="mt-6" title="Finance coverage and confidence">
					{{ financeBreakdown.disclaimer }} Coverage: {{ financeBreakdown.coverageNote }} Linkage: {{ financeBreakdown.linkageType }}. Confidence: {{ financeBreakdown.confidence }}.
				</InfoCallout>
			</header>

			<section class="gap-6 grid xl:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)]">
				<div class="surface-panel">
					<h2 class="text-3xl text-app-ink font-serif dark:text-app-text-dark">
						Top funders
					</h2>
					<p class="text-sm text-app-muted leading-7 mt-4 dark:text-app-muted-dark">
						This section surfaces the largest named or categorized funders in the current finance summary. Open the source drawer for the underlying filings.
					</p>
					<ul class="mt-6 space-y-3">
						<li v-for="funder in candidate.funding.topFunders" :key="`${funder.name}-${funder.category}`" class="p-4 rounded-3xl bg-app-bg dark:bg-app-bg-dark/70">
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

				<div class="surface-panel">
					<h2 class="text-3xl text-app-ink font-serif dark:text-app-text-dark">
						What to look for
					</h2>
					<ul class="readable-list text-sm text-app-muted mt-5 pl-5 dark:text-app-muted-dark">
						<li>Whether fundraising scale is materially different across the field</li>
						<li>Which sectors or donor categories appear repeatedly</li>
						<li>How much runway the campaign still has in cash on hand</li>
						<li>Whether the source filings cover the same reporting window for all candidates</li>
					</ul>
					<div class="mt-6 pt-6 border-t border-app-line/80 dark:border-app-line-dark">
						<p class="text-sm text-app-muted leading-7 dark:text-app-muted-dark">
							<strong class="text-app-ink dark:text-app-text-dark">Reference count:</strong> {{ formatCompactNumber(candidate.funding.sources.length) }} filing and methodology source{{ candidate.funding.sources.length === 1 ? "" : "s" }} are attached to this funding page.
						</p>
					</div>
				</div>
			</section>
		</div>
	</section>
</template>
