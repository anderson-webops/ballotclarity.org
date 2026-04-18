<script setup lang="ts">
import { storeToRefs } from "pinia";

import { buildNationwidePersonProfileResponse } from "~/utils/nationwide-person-profile";
import { buildPersonLinkageConfidence, hasPersonFunding } from "~/utils/person-profile";

const route = useRoute();
const civicStore = useCivicStore();
const { isHydrated, nationwideLookupResult } = storeToRefs(civicStore);
const { layerBreadcrumbLink } = useRouteLayerNavigation();
const representativeSlug = computed(() => String(route.params.slug));
const { formatCompactNumber, formatCurrency, formatDate, formatPercent } = useFormatters();
const { data, error, pending } = await useRepresentative(representativeSlug);

const fallbackData = computed(() => isHydrated.value
	? buildNationwidePersonProfileResponse(nationwideLookupResult.value, representativeSlug.value)
	: null);
const profileData = computed(() => data.value ?? fallbackData.value);
const person = computed(() => profileData.value?.person ?? null);
const pagePending = computed(() => pending.value || (!data.value && !isHydrated.value));
const linkageConfidence = computed(() => person.value ? buildPersonLinkageConfidence(person.value.provenance.status) : null);
const funding = computed(() => person.value?.funding ?? null);
const fundingAvailable = computed(() => person.value ? hasPersonFunding(person.value) : false);
const breadcrumbs = computed(() => [
	{ label: "Home", to: "/" },
	layerBreadcrumbLink.value,
	{ label: person.value?.name ?? "Representative profile", to: person.value ? `/representatives/${person.value.slug}` : undefined },
	{ label: "Funding" }
]);

const summaryItems = computed(() => {
	if (!funding.value)
		return [];

	return [
		{ label: "Total raised", note: "Current filing-window total.", value: formatCurrency(funding.value.totalRaised) },
		{ label: "Cash on hand", note: "Reported funds still available.", value: formatCurrency(funding.value.cashOnHand) },
		{ label: "Small-donor share", note: "Share attributed to smaller donors in the current summary.", value: formatPercent(funding.value.smallDonorShare) }
	];
});

usePageSeo({
	description: funding.value?.summary ?? "Representative funding page with campaign-finance summary, top funders, and source links.",
	path: `/representatives/${representativeSlug.value}/funding`,
	title: person.value ? `${person.value.name} Funding` : "Representative funding"
});
</script>

<template>
	<section class="app-shell section-gap space-y-8">
		<div v-if="pagePending" class="space-y-6">
			<div class="surface-panel bg-white/70 h-80 animate-pulse dark:bg-app-panel-dark/70" />
			<div class="surface-panel bg-white/70 h-64 animate-pulse dark:bg-app-panel-dark/70" />
		</div>

		<div v-else-if="(error && !fallbackData) || !person" class="max-w-3xl">
			<InfoCallout title="Funding page unavailable" tone="warning">
				This representative funding page could not be loaded. Return to the representative profile and try again.
			</InfoCallout>
		</div>

		<div v-else-if="!fundingAvailable || !funding" class="max-w-3xl">
			<InfoCallout title="No funding data attached" tone="warning">
				Ballot Clarity does not currently have a source-backed finance summary attached to this representative record.
			</InfoCallout>
		</div>

		<div v-else class="space-y-8">
			<header class="surface-panel">
				<AppBreadcrumbs :items="breadcrumbs" />
				<div class="flex flex-wrap gap-2">
					<VerificationBadge label="Funding page" tone="accent" />
					<VerificationBadge :label="person.officeholderLabel" />
					<VerificationBadge :label="linkageConfidence?.label ?? 'Linkage review'" />
				</div>
				<h1 class="text-5xl text-app-ink font-serif mt-5 dark:text-app-text-dark">
					{{ person.name }} funding
				</h1>
				<p class="text-base text-app-muted leading-8 mt-5 dark:text-app-muted-dark">
					{{ funding.summary }}
				</p>
				<div class="mt-6 flex flex-wrap gap-3">
					<NuxtLink :to="`/representatives/${person.slug}`" class="btn-secondary">
						Back to profile
					</NuxtLink>
					<NuxtLink v-if="person.lobbyingContext.length || person.publicStatements.length" :to="`/representatives/${person.slug}/influence`" class="btn-secondary">
						Open influence page
					</NuxtLink>
					<SourceDrawer :sources="funding.sources" :title="`${person.name} funding sources`" button-label="Funding sources" />
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
					<p class="text-sm text-app-muted leading-7 mt-4 dark:text-app-muted-dark">
						This section surfaces the largest named or categorized funders in the current finance summary. Open the source drawer for the underlying filings.
					</p>
					<ul class="mt-6 space-y-3">
						<li v-for="funder in funding.topFunders" :key="`${funder.name}-${funder.category}`" class="p-4 rounded-3xl bg-app-bg dark:bg-app-bg-dark/70">
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

				<div class="space-y-6">
					<div class="surface-panel">
						<h2 class="text-3xl text-app-ink font-serif dark:text-app-text-dark">
							Finance disclaimer
						</h2>
						<ul class="readable-list text-sm text-app-muted mt-5 pl-5 dark:text-app-muted-dark">
							<li><strong class="text-app-ink dark:text-app-text-dark">Linkage:</strong> {{ person.provenance.status }}</li>
							<li><strong class="text-app-ink dark:text-app-text-dark">Confidence:</strong> {{ linkageConfidence?.label }}</li>
							<li><strong class="text-app-ink dark:text-app-text-dark">Coverage:</strong> {{ funding.provenanceLabel ?? "Source-backed finance summary" }}</li>
							<li><strong class="text-app-ink dark:text-app-text-dark">Data through:</strong> {{ formatDate(person.freshness.dataLastUpdatedAt ?? person.updatedAt) }}</li>
							<li><strong class="text-app-ink dark:text-app-text-dark">Warning:</strong> {{ person.freshness.statusNote }}</li>
						</ul>
					</div>

					<div class="surface-panel">
						<h2 class="text-3xl text-app-ink font-serif dark:text-app-text-dark">
							What to look for
						</h2>
						<ul class="readable-list text-sm text-app-muted mt-5 pl-5 dark:text-app-muted-dark">
							<li>Whether fundraising scale is materially different across the field</li>
							<li>Which sectors or donor categories appear repeatedly</li>
							<li>How much runway the officeholder still has in cash on hand</li>
							<li>Whether the source filings cover the same reporting window for all linked records</li>
						</ul>
						<div class="mt-6 pt-6 border-t border-app-line/80 dark:border-app-line-dark">
							<p class="text-sm text-app-muted leading-7 dark:text-app-muted-dark">
								<strong class="text-app-ink dark:text-app-text-dark">Reference count:</strong> {{ formatCompactNumber(funding.sources.length) }} filing and methodology source{{ funding.sources.length === 1 ? "" : "s" }} are attached to this funding page.
							</p>
						</div>
					</div>
				</div>
			</section>
		</div>
	</section>
</template>
