<script setup lang="ts">
import type { OfficeContext } from "~/types/civic";
import { storeToRefs } from "pinia";

import { buildRepresentativesDirectoryProvenanceSummary, buildRepresentativesDirectoryTimeline } from "~/utils/graphics-schema";
import { isExternalHref } from "~/utils/link";
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
const representativeLinkIsExternal = (href: string) => isExternalHref(href);

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
			? "This page turns the active nationwide lookup into a person-first directory. It emphasizes matched officeholders, district crosswalks, and provider-backed records before Ballot Clarity’s deeper local person pages exist."
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

			<OfficeContextCard
				v-if="representativeOfficeContext"
				:context="representativeOfficeContext"
			/>
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
							{{ directoryUsesNationwide ? "Open record" : "Profile" }}
						</NuxtLink>
						<a
							v-else
							:href="representative.href"
							target="_blank"
							rel="noreferrer"
							class="btn-secondary inline-flex gap-2 items-center"
						>
							{{ directoryUsesNationwide ? "Open record" : "Profile" }}
							<span class="i-carbon-launch" />
						</a>
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
