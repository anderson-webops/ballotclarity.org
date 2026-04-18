<script setup lang="ts">
import { storeToRefs } from "pinia";

import { buildNationwideDirectoryResponses } from "~/utils/nationwide-directory";

const { formatDateTime } = useFormatters();
const civicStore = useCivicStore();
const { data: guideData, error: guideError, pending: guidePending } = await useRepresentatives();
const { isHydrated, nationwideLookupResult } = storeToRefs(civicStore);
const { hasNationwideResultContext, hasPublishedGuideContext } = useGuideEntryGate();
const directoryUsesNationwide = computed(() => isHydrated.value && hasNationwideResultContext.value && !hasPublishedGuideContext.value);
const directoryBundle = computed(() => directoryUsesNationwide.value
	? buildNationwideDirectoryResponses(nationwideLookupResult.value).representatives
	: guideData.value ?? { districts: [], note: "", representatives: [], updatedAt: "" });

const directoryPending = computed(() => directoryUsesNationwide.value ? false : guidePending.value);
const directoryError = computed(() => directoryUsesNationwide.value ? null : guideError.value);
const directoryData = computed(() => isHydrated.value ? directoryBundle.value : null);

const summaryItems = computed(() => {
	if (!directoryData.value)
		return [];

	const isNationwideContext = directoryUsesNationwide.value;
	return [
		{ label: "Current representatives", note: isNationwideContext ? "Current officials from the active nationwide lookup." : "Incumbents on the active ballot surfaces.", value: directoryData.value.representatives.length },
		{ label: "District pages", note: isNationwideContext ? "District matches carried forward with this lookup." : "Office-area hubs with candidate fields.", value: directoryData.value.districts.length, href: "/districts" },
		{ label: "Updated", note: "Directory freshness.", value: formatDateTime(directoryData.value.updatedAt) }
	];
});

const introCopy = computed(() => directoryUsesNationwide.value
	? "This directory pulls out the current officials linked to the active nationwide lookup. Use these entries to jump to district, funding, and influence pages when local coverage exists for that area."
	: "This directory pulls out the currently serving officials who also appear on the active ballot coverage, so you can jump straight into their district, funding, and influence pages."
);
const noActionCopy = computed(() => directoryUsesNationwide.value
	? "Open the district layer for this official’s related pages where available. Funding and influence pages are guide-dependent."
	: "Open the official profile, funding, or influence page for this official."
);
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
					{{ introCopy }}
				</p>
			</div>

			<div class="surface-panel">
				<h2 class="text-3xl text-app-ink font-serif dark:text-app-text-dark">
					Use this page for
				</h2>
				<ul class="readable-list text-sm text-app-muted mt-5 pl-5 dark:text-app-muted-dark">
					<li>Finding the incumbent tied to a district page</li>
					<li>Opening campaign-finance context directly</li>
					<li>Opening influence and lobbying context directly</li>
				</ul>
				<div class="mt-6">
					<NuxtLink to="/districts" class="btn-secondary">
						Open district hub
					</NuxtLink>
				</div>
			</div>
		</header>

		<div v-if="!isHydrated || directoryPending" class="gap-6 grid lg:grid-cols-2">
			<div class="surface-panel bg-white/70 h-56 animate-pulse dark:bg-app-panel-dark/70" />
			<div class="surface-panel bg-white/70 h-56 animate-pulse dark:bg-app-panel-dark/70" />
		</div>

		<div v-else-if="directoryError || !directoryData" class="max-w-3xl">
			<InfoCallout title="Representative directory unavailable" tone="warning">
				The representative directory could not be loaded. Open a district or contest page and try again.
			</InfoCallout>
		</div>

		<div v-else class="space-y-6">
			<PageSummaryStrip :items="summaryItems" />

			<section class="gap-6 grid lg:grid-cols-2">
				<article
					v-for="representative in directoryData.representatives"
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
						{{ representative.summary }} {{ noActionCopy }}
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
							{{ directoryUsesNationwide ? "Open record" : "Profile" }}
						</NuxtLink>
						<NuxtLink v-if="!directoryUsesNationwide" :to="`${representative.href}/funding`" class="btn-primary">
							Funding
						</NuxtLink>
						<NuxtLink v-if="!directoryUsesNationwide" :to="`${representative.href}/influence`" class="btn-secondary">
							Influence
						</NuxtLink>
					</div>
				</article>
			</section>
		</div>
	</section>
</template>
