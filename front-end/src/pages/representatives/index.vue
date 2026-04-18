<script setup lang="ts">
import { storeToRefs } from "pinia";

import { buildActiveLookupSummary } from "~/utils/active-lookup";
import { isExternalHref } from "~/utils/link";
import { buildNationwideDirectoryResponses } from "~/utils/nationwide-directory";

const { formatDateTime } = useFormatters();
const civicStore = useCivicStore();
const { data: guideData, error: guideError, pending: guidePending } = await useRepresentatives();
const { isHydrated, nationwideLookupResult, selectedLocation } = storeToRefs(civicStore);
const { hasNationwideResultContext, hasPublishedGuideContext } = useGuideEntryGate();
const directoryUsesNationwide = computed(() => isHydrated.value && hasNationwideResultContext.value && !hasPublishedGuideContext.value);
const directoryBundle = computed(() => directoryUsesNationwide.value
	? buildNationwideDirectoryResponses(nationwideLookupResult.value).representatives
	: guideData.value ?? { districts: [], note: "", representatives: [], updatedAt: "" });

const directoryPending = computed(() => directoryUsesNationwide.value ? false : guidePending.value);
const directoryError = computed(() => directoryUsesNationwide.value ? null : guideError.value);
const directoryData = computed(() => isHydrated.value ? directoryBundle.value : null);
const activeLookupSummary = computed(() => buildActiveLookupSummary({
	nationwideLookupResult: isHydrated.value ? nationwideLookupResult.value : null,
	selectedLocation: isHydrated.value ? selectedLocation.value : null
}));
const representativeLinkIsExternal = (href: string) => isExternalHref(href);
const representativeUseCases = computed(() => directoryUsesNationwide.value
	? [
			"Open a Ballot Clarity person page for each matched official",
			"Open the provider-backed record for direct verification",
			"Move to /districts or /results for broader lookup context"
		]
	: [
			"Finding the current officeholder tied to a district page",
			"Opening person-level funding context directly",
			"Opening influence and lobbying context directly"
		]);

const summaryItems = computed(() => {
	if (!directoryData.value)
		return [];

	const isNationwideContext = directoryUsesNationwide.value;
	return [
		{ label: "Current representatives", note: isNationwideContext ? "Current officials from the active nationwide lookup." : "Current officeholders with person pages where Ballot Clarity has source-backed records.", value: directoryData.value.representatives.length },
		{ label: "District pages", note: isNationwideContext ? "District matches carried forward with this nationwide lookup." : "Office-area hubs with candidate and representative context.", value: directoryData.value.districts.length, href: "/districts" },
		{ label: "Updated", note: "Directory freshness.", value: formatDateTime(directoryData.value.updatedAt) }
	];
});

const introCopy = computed(() => directoryUsesNationwide.value
	? "This directory pulls out the current officials linked to the active nationwide lookup and points to district-level pages or provider-backed records. Ballot Clarity person pages, funding pages, and influence pages appear only where the underlying local person record exists."
	: "This directory pulls out the current officeholders Ballot Clarity can tie to published person records, so you can jump straight into their district, funding, and influence pages."
);
const noActionCopy = computed(() => directoryUsesNationwide.value
	? "Open the district layer or provider-backed record for this official. Ballot Clarity funding and influence pages appear only when a source-backed person record exists."
	: "Open the person profile, funding page, or influence page for this official."
);
usePageSeo({
	description: "Directory of current representatives in your active Ballot Clarity context, with guide-dependent links made clear when no local guide is available.",
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
				<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
					Active lookup context
				</p>
				<h2 class="text-3xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
					{{ activeLookupSummary.label }}
				</h2>
				<p class="text-sm text-app-muted leading-7 mt-4 dark:text-app-muted-dark">
					{{ activeLookupSummary.note }}
				</p>
				<div class="mt-5 flex flex-wrap gap-3 items-center">
					<TrustBadge
						:label="activeLookupSummary.mode === 'nationwide' ? 'Nationwide lookup context' : activeLookupSummary.mode === 'guide' ? 'Published guide context' : 'No saved lookup context'"
						:tone="activeLookupSummary.mode === 'nationwide' ? 'accent' : activeLookupSummary.mode === 'guide' ? undefined : 'warning'"
					/>
					<UpdatedAt v-if="activeLookupSummary.resolvedAt" :value="activeLookupSummary.resolvedAt" label="Lookup updated" />
				</div>
				<h3 class="text-2xl text-app-ink font-serif mt-6 dark:text-app-text-dark">
					Use this page for
				</h3>
				<ul class="readable-list text-sm text-app-muted mt-5 pl-5 dark:text-app-muted-dark">
					<li v-for="useCase in representativeUseCases" :key="useCase">
						{{ useCase }}
					</li>
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
						<NuxtLink v-if="!representativeLinkIsExternal(representative.href)" :to="representative.href" class="btn-secondary">
							Profile
						</NuxtLink>
						<a
							v-else
							:href="representative.href"
							target="_blank"
							rel="noreferrer"
							class="btn-secondary inline-flex gap-2 items-center"
						>
							Open record
							<span class="i-carbon-launch" />
						</a>
						<a
							v-if="directoryUsesNationwide && representative.openstatesUrl"
							:href="representative.openstatesUrl"
							target="_blank"
							rel="noreferrer"
							class="btn-secondary inline-flex gap-2 items-center"
						>
							Provider record
							<span class="i-carbon-launch" />
						</a>
						<NuxtLink v-if="!directoryUsesNationwide" :to="`${representative.href}/funding`" class="btn-primary">
							Funding
						</NuxtLink>
						<NuxtLink v-if="!directoryUsesNationwide" :to="`${representative.href}/influence`" class="btn-secondary">
							Influence
						</NuxtLink>
						<VerificationBadge v-if="directoryUsesNationwide" label="Funding not yet available" tone="warning" />
						<VerificationBadge v-if="directoryUsesNationwide" label="Influence not yet available" tone="warning" />
					</div>
				</article>
			</section>
		</div>
	</section>
</template>
