<script setup lang="ts">
import type { RepresentativesResponse } from "~/types/civic";
import { storeToRefs } from "pinia";

import { buildActiveLookupSummary } from "~/utils/active-lookup";
import { activeNationwideLookupCookieName, parseActiveNationwideLookupCookie } from "~/utils/active-nationwide-cookie";
import { isExternalHref } from "~/utils/link";
import { buildNationwideDirectoryResponses } from "~/utils/nationwide-directory";
import { buildLookupContextFromNationwideResult, buildNationwideLookupRouteQuery, buildNationwideRouteTarget } from "~/utils/nationwide-route-context";
import { groupRepresentativeSummariesByGovernmentLevel, resolveRepresentativePresentation } from "~/utils/representative-presentation";
import { formatSourceCountLabel } from "~/utils/source-label";

const route = useRoute();
const { formatDateTime } = useFormatters();
const civicStore = useCivicStore();
const { isHydrated, nationwideLookupResult, selectedLocation } = storeToRefs(civicStore);
const { hasNationwideResultContext, hasPublishedGuideContext } = useGuideEntryGate();
const activeNationwideLookupCookie = useCookie<string | null>(activeNationwideLookupCookieName);
const serverNationwideLookupResult = computed(() => parseActiveNationwideLookupCookie(activeNationwideLookupCookie.value));
const activeNationwideLookupResult = computed(() => isHydrated.value ? nationwideLookupResult.value : serverNationwideLookupResult.value);
const activeLookupQuery = computed(() => buildNationwideLookupRouteQuery(
	buildLookupContextFromNationwideResult(activeNationwideLookupResult.value),
	route.query
));
const { data: guideData, error: guideError, pending: guidePending } = await useRepresentatives(activeLookupQuery);
const emptyNationwideRepresentativesResponse: RepresentativesResponse = { districts: [], mode: "nationwide", note: "", representatives: [], updatedAt: "" };
const emptyGuideRepresentativesResponse: RepresentativesResponse = { districts: [], mode: "guide", note: "", representatives: [], updatedAt: "" };
const apiUsesNationwide = computed(() => guideData.value?.mode === "nationwide");
const showGuideDirectory = computed(() => hasPublishedGuideContext.value);
const storeUsesNationwide = computed(() => {
	if (!activeNationwideLookupResult.value || activeNationwideLookupResult.value.result !== "resolved")
		return false;

	return isHydrated.value
		? hasNationwideResultContext.value && !hasPublishedGuideContext.value
		: activeNationwideLookupResult.value.guideAvailability !== "published";
});
const directoryUsesNationwide = computed(() => apiUsesNationwide.value || storeUsesNationwide.value);
const directoryBundle = computed(() => {
	if (apiUsesNationwide.value)
		return guideData.value ?? emptyNationwideRepresentativesResponse;

	if (storeUsesNationwide.value)
		return buildNationwideDirectoryResponses(activeNationwideLookupResult.value).representatives;

	if (showGuideDirectory.value)
		return guideData.value ?? emptyGuideRepresentativesResponse;

	return emptyNationwideRepresentativesResponse;
});

const directoryPending = computed(() => directoryUsesNationwide.value ? false : showGuideDirectory.value ? guidePending.value : false);
const directoryError = computed(() => showGuideDirectory.value || directoryUsesNationwide.value
	? directoryUsesNationwide.value && directoryBundle.value ? null : guideError.value
	: null);
const directoryData = computed(() => directoryBundle.value);
const groupedRepresentatives = computed(() => groupRepresentativeSummariesByGovernmentLevel(
	directoryData.value.representatives,
	activeNationwideLookupResult.value?.location?.state ?? null
));
const activeLookupSummary = computed(() => buildActiveLookupSummary({
	nationwideLookupResult: activeNationwideLookupResult.value,
	routeLookupQuery: activeLookupQuery.value?.lookup ?? null,
	selectedLocation: isHydrated.value ? selectedLocation.value : null
}));
const representativeLinkIsExternal = (href: string) => isExternalHref(href);
const representativeUseCases = computed(() => directoryUsesNationwide.value
	? [
			"Open a Ballot Clarity person page for each matched official",
			"Open funding and influence pages where a reliable person-level crosswalk is attached",
			"Open the provider-backed record for direct verification"
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
	? "This directory pulls out the current officials linked to the active nationwide lookup and points to district-level pages, provider-backed records, and person-level funding or influence pages where Ballot Clarity has a reliable crosswalk."
	: "This directory pulls out the current officeholders Ballot Clarity can tie to published person records, so you can jump straight into their district, funding, and influence pages."
);
const noActionCopy = computed(() => directoryUsesNationwide.value
	? "Open the district layer, provider-backed record, or any live person-level modules for this official."
	: "Open the person profile, funding page, or influence page for this official."
);
const requiresLookupPrompt = computed(() => !directoryUsesNationwide.value && !showGuideDirectory.value);

function buildLookupAwareTarget(path: string) {
	return buildNationwideRouteTarget(path, buildLookupContextFromNationwideResult(activeNationwideLookupResult.value), route.query);
}

function getRepresentativePresentation(representative: RepresentativesResponse["representatives"][number]) {
	return resolveRepresentativePresentation(representative, activeNationwideLookupResult.value?.location?.state ?? null);
}
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
					<NuxtLink :to="buildLookupAwareTarget('/districts')" class="btn-secondary">
						Open district hub
					</NuxtLink>
				</div>
			</div>
		</header>

		<div v-if="directoryPending && !directoryData.representatives.length" class="gap-6 grid lg:grid-cols-2">
			<div class="surface-panel bg-white/70 h-56 animate-pulse dark:bg-app-panel-dark/70" />
			<div class="surface-panel bg-white/70 h-56 animate-pulse dark:bg-app-panel-dark/70" />
		</div>

		<div v-else-if="directoryError || !directoryData" class="max-w-3xl">
			<InfoCallout title="Representative directory unavailable" tone="warning">
				The representative directory could not be loaded. Open a district or contest page and try again.
			</InfoCallout>
		</div>

		<div v-else-if="requiresLookupPrompt" class="max-w-3xl">
			<InfoCallout title="Active nationwide lookup required" tone="warning">
				This directory stays nationwide-first. Start from the lookup or open saved nationwide results so Ballot Clarity can attach the current representative matches to this page instead of falling back to unrelated guide data.
			</InfoCallout>
			<div class="mt-6 flex flex-wrap gap-3">
				<NuxtLink to="/" class="btn-primary">
					Open lookup
				</NuxtLink>
				<NuxtLink to="/results" class="btn-secondary">
					Nationwide results
				</NuxtLink>
			</div>
		</div>

		<div v-else class="space-y-6">
			<PageSummaryStrip :items="summaryItems" />

			<div class="space-y-8">
				<section
					v-for="group in groupedRepresentatives"
					:key="group.label"
					class="space-y-5"
				>
					<div class="flex flex-wrap gap-3 items-center justify-between">
						<div>
							<h2 class="text-3xl text-app-ink font-serif dark:text-app-text-dark">
								{{ group.label }}
							</h2>
							<p class="text-sm text-app-muted mt-3 dark:text-app-muted-dark">
								{{ group.representatives.length }} current official{{ group.representatives.length === 1 ? "" : "s" }} in this section.
							</p>
						</div>
						<VerificationBadge :label="`${group.representatives.length} official${group.representatives.length === 1 ? '' : 's'}`" tone="accent" />
					</div>
					<div class="gap-6 grid lg:grid-cols-2">
						<article
							v-for="representative in group.representatives"
							:key="representative.slug"
							class="surface-panel"
						>
							<div class="flex flex-wrap gap-2 items-center">
								<VerificationBadge :label="getRepresentativePresentation(representative).levelLabel" tone="accent" />
								<IncumbentBadge />
							</div>
							<div class="mt-4 flex flex-wrap gap-3 items-center">
								<h3 class="text-3xl text-app-ink font-serif dark:text-app-text-dark">
									{{ representative.name }}
								</h3>
							</div>
							<p class="text-sm text-app-muted mt-4 dark:text-app-muted-dark">
								{{ representative.party }} · {{ getRepresentativePresentation(representative).officeDisplayLabel }}
							</p>
							<p class="text-sm text-app-muted leading-7 mt-4 dark:text-app-muted-dark">
								{{ representative.summary }} {{ noActionCopy }}
							</p>
							<div class="mt-5 flex flex-wrap gap-2">
								<VerificationBadge :label="representative.districtLabel" />
								<SourceDrawer
									v-if="representative.sourceCount > 0 && representative.sources.length"
									:button-label="formatSourceCountLabel(representative.sourceCount)"
									:note="directoryUsesNationwide
										? 'These are the provider-backed and Ballot Clarity-attached records currently visible in this representative directory card.'
										: 'These are the source-backed records currently visible in this representative directory card.'"
									:sources="representative.sources"
									:title="`${representative.name} directory sources`"
									tone="accent"
									variant="badge"
								/>
								<VerificationBadge v-else :label="formatSourceCountLabel(representative.sourceCount)" tone="accent" />
							</div>
							<div class="mt-6 flex flex-wrap gap-3">
								<NuxtLink :to="buildLookupAwareTarget(`/districts/${representative.districtSlug}`)" class="btn-secondary">
									District page
								</NuxtLink>
								<NuxtLink v-if="!representativeLinkIsExternal(representative.href)" :to="buildLookupAwareTarget(representative.href)" class="btn-secondary">
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
								<NuxtLink
									v-if="!representativeLinkIsExternal(representative.href) && representative.fundingAvailable"
									:to="buildLookupAwareTarget(`${representative.href}/funding`)"
									class="btn-primary"
								>
									Funding
								</NuxtLink>
								<NuxtLink
									v-if="!representativeLinkIsExternal(representative.href) && representative.influenceAvailable"
									:to="buildLookupAwareTarget(`${representative.href}/influence`)"
									class="btn-secondary"
								>
									Influence
								</NuxtLink>
								<VerificationBadge v-if="!representative.fundingAvailable" label="Funding not yet available" tone="warning" />
								<VerificationBadge v-if="!representative.influenceAvailable" label="Influence not yet available" tone="warning" />
							</div>
							<div class="mt-4 space-y-2">
								<p class="text-sm text-app-muted leading-6 dark:text-app-muted-dark">
									<strong class="text-app-ink dark:text-app-text-dark">Funding:</strong> {{ representative.fundingSummary }}
								</p>
								<p class="text-sm text-app-muted leading-6 dark:text-app-muted-dark">
									<strong class="text-app-ink dark:text-app-text-dark">Influence:</strong> {{ representative.influenceSummary }}
								</p>
							</div>
						</article>
					</div>
				</section>
			</div>
		</div>
	</section>
</template>
