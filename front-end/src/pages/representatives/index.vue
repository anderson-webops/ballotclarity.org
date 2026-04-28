<script setup lang="ts">
import type { OfficeContext, RepresentativesResponse } from "~/types/civic";
import { storeToRefs } from "pinia";
import OfficeContextCard from "~/components/graphics/OfficeContextCard.vue";
import SourceProvenanceStrip from "~/components/graphics/SourceProvenanceStrip.vue";
import TimelineList from "~/components/graphics/TimelineList.vue";

import { buildActiveLookupSummary } from "~/utils/active-lookup";
import { activeNationwideLookupCookieName, parseActiveNationwideLookupCookie } from "~/utils/active-nationwide-cookie";
import { buildRepresentativesDirectoryProvenanceSummary, buildRepresentativesDirectoryTimeline } from "~/utils/graphics-schema";
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

const emptyNationwideRepresentativesResponse: RepresentativesResponse = {
	districts: [],
	mode: "nationwide",
	note: "",
	representatives: [],
	updatedAt: ""
};
const emptyGuideRepresentativesResponse: RepresentativesResponse = {
	districts: [],
	mode: "guide",
	note: "",
	representatives: [],
	updatedAt: ""
};

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
const summaryItems = computed(() => {
	if (!directoryData.value)
		return [];

	const isNationwideContext = directoryUsesNationwide.value;

	return [
		{
			label: "Current representatives",
			note: isNationwideContext ? "Current officials from the active nationwide lookup." : "Current officeholders with person pages where Ballot Clarity has source-backed records.",
			value: directoryData.value.representatives.length
		},
		{
			href: "/districts",
			label: "District pages",
			note: isNationwideContext ? "District matches carried forward with this nationwide lookup." : "Office-area hubs with candidate and representative context.",
			value: directoryData.value.districts.length
		},
		{
			label: "Updated",
			note: "Directory freshness.",
			value: formatDateTime(directoryData.value.updatedAt)
		}
	];
});

const representativeStats = computed(() => {
	if (!directoryData.value)
		return [];

	const currentDirectory = directoryData.value;

	return [
		{
			detail: directoryUsesNationwide.value
				? "Current officeholders pulled from the active nationwide lookup context."
				: "Current officeholders tied to the active published ballot surfaces.",
			label: "Representatives",
			value: currentDirectory.representatives.length
		},
		{
			detail: directoryUsesNationwide.value
				? "Matched district hubs carried forward with the active nationwide lookup."
				: "Linked district hubs with office and candidate context.",
			label: "District pages",
			value: currentDirectory.districts.length
		},
		{
			detail: directoryUsesNationwide.value
				? "Average linked record depth across the current nationwide representative matches."
				: "Average linked source count across the current representative directory entries.",
			label: "Average source depth",
			value: currentDirectory.representatives.length
				? Math.round(currentDirectory.representatives.reduce((total, representative) => total + representative.sourceCount, 0) / currentDirectory.representatives.length)
				: 0
		}
	];
});

const representativeOfficeContext = computed<OfficeContext | null>(() => {
	if (!directoryData.value)
		return null;

	const isNationwideContext = directoryUsesNationwide.value;

	return {
		badges: [
			{ label: "Representative directory", tone: "accent" },
			{ label: isNationwideContext ? "Nationwide lookup active" : "Published guide context", tone: "neutral" }
		],
		officeLabel: isNationwideContext
			? "Current officeholders attached to the active nationwide lookup context"
			: "Current officeholders connected to district, funding, and influence surfaces",
		responsibilities: isNationwideContext
			? [
					"Open a district page for each officially matched representative area.",
					"Open the active provider-backed record for each matched official when Ballot Clarity does not have a local person page.",
					"Use district and results pages as the main continuation path when a published local guide is unavailable."
				]
			: [
					"Find the current officeholder tied to a district page.",
					"Open person-level funding context directly when it exists.",
					"Open influence and lobbying context directly without scanning the whole ballot first."
				],
		stats: representativeStats.value,
		summary: isNationwideContext
			? "This page turns the active nationwide lookup into a person-first directory. It emphasizes matched officeholders, district crosswalks, and provider-backed records before Ballot Clarity's deeper local person pages exist."
			: "This page is a person-first directory for the incumbent layer of the current published coverage. It is meant to get a voter from a known officeholder to the right district, funding, or influence surface with minimal scanning.",
		title: "How the representative layer is organized",
		uncertainty: isNationwideContext
			? "This directory reflects the current provider-backed nationwide lookup, not a complete national officeholder inventory or a complete Ballot Clarity person-page set."
			: "This directory is coverage-shaped, not nationwide officeholding inventory. It reflects the current modeled Ballot Clarity surfaces.",
		whyItMatters: isNationwideContext
			? "A voter often starts with a person they already know. This page gives them a direct route from the active lookup to matched officeholders and district context even when a full local guide is not published."
			: "A voter often starts with a person they already know. This page gives them a direct route from that officeholder to the relevant district and profile context."
	};
});

const representativeProvenanceSummary = computed(() => directoryData.value ? buildRepresentativesDirectoryProvenanceSummary(directoryData.value, formatDateTime) : null);
const representativeTimelineItems = computed(() => directoryData.value ? buildRepresentativesDirectoryTimeline(directoryData.value) : []);

const introCopy = computed(() => directoryUsesNationwide.value
	? "Current officials for your saved area."
	: "This directory lists current officeholders and links to their district, profile, funding, and influence pages where available."
);
const requiresLookupPrompt = computed(() => !directoryUsesNationwide.value && !showGuideDirectory.value);

function buildLookupAwareTarget(path: string) {
	return buildNationwideRouteTarget(path, buildLookupContextFromNationwideResult(activeNationwideLookupResult.value), route.query);
}

function getRepresentativePresentation(representative: RepresentativesResponse["representatives"][number]) {
	return resolveRepresentativePresentation(representative, activeNationwideLookupResult.value?.location?.state ?? null);
}
usePageSeo({
	description: "Directory of current representatives with district links, person pages, and attached public-record context.",
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
					Current area
				</p>
				<h2 class="text-3xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
					{{ activeLookupSummary.label }}
				</h2>
				<p class="text-sm text-app-muted leading-7 mt-4 dark:text-app-muted-dark">
					{{ activeLookupSummary.note }}
				</p>
				<div class="mt-5 flex flex-wrap gap-3 items-center">
					<TrustBadge
						:label="activeLookupSummary.mode === 'nationwide' ? 'Lookup results' : activeLookupSummary.mode === 'guide' ? 'Local guide' : 'No saved location'"
						:tone="activeLookupSummary.mode === 'nationwide' ? 'accent' : activeLookupSummary.mode === 'guide' ? undefined : 'warning'"
					/>
					<UpdatedAt v-if="activeLookupSummary.resolvedAt" :value="activeLookupSummary.resolvedAt" label="Lookup updated" />
				</div>
				<div class="mt-6">
					<NuxtLink :to="buildLookupAwareTarget('/districts')" class="btn-secondary">
						Open district hub
					</NuxtLink>
				</div>

				<OfficeContextCard
					v-if="representativeOfficeContext"
					:context="representativeOfficeContext"
				/>
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
			<InfoCallout title="Current location required" tone="warning">
				Open results first so this directory can show the current officials for your area.
			</InfoCallout>
			<div class="mt-6 flex flex-wrap gap-3">
				<NuxtLink to="/" class="btn-primary">
					Open lookup
				</NuxtLink>
				<NuxtLink to="/results" class="btn-secondary">
					Results for your area
				</NuxtLink>
			</div>
		</div>

		<div v-else class="space-y-6">
			<PageSummaryStrip :items="summaryItems" />
			<SourceProvenanceStrip
				v-if="representativeProvenanceSummary"
				:summary="representativeProvenanceSummary"
			/>
			<TimelineList
				:items="representativeTimelineItems"
				badge-label="Directory lifecycle"
				note="This timeline explains what this surface represents operationally. It is a directory lifecycle, not a full personal career timeline for each officeholder."
				title="How the representative layer is kept current"
				uncertainty="Detailed action timelines remain on the linked candidate or representative profile surfaces, not in this directory overview."
			/>

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
							<div class="mt-4 flex gap-4 items-start">
								<ProfileImageStack
									v-if="representative.profileImages?.length"
									:images="representative.profileImages"
									:name="representative.name"
									size="md"
								/>
								<div class="min-w-0">
									<h3 class="text-3xl text-app-ink font-serif dark:text-app-text-dark">
										{{ representative.name }}
									</h3>
									<p class="text-sm text-app-muted mt-3 dark:text-app-muted-dark">
										{{ representative.party }} · {{ getRepresentativePresentation(representative).officeDisplayLabel }}
									</p>
								</div>
							</div>
							<p class="text-sm text-app-muted leading-7 mt-4 dark:text-app-muted-dark">
								{{ representative.summary }}
							</p>
							<div class="mt-5 flex flex-wrap gap-2">
								<VerificationBadge :label="representative.districtLabel" />
								<SourceDrawer
									v-if="representative.sourceCount > 0 && representative.sources.length"
									:button-label="formatSourceCountLabel(representative.sourceCount)"
									note="Sources attached to this card."
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
