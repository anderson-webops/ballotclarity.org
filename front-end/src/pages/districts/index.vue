<script setup lang="ts">
import type { DistrictsResponse, RepresentativesResponse } from "~/types/civic";
import { storeToRefs } from "pinia";
import { buildActiveLookupSummary } from "~/utils/active-lookup";
import { activeNationwideLookupCookieName, parseActiveNationwideLookupCookie } from "~/utils/active-nationwide-cookie";
import { buildDistrictRepresentativeAvailabilityNote, buildDistrictRepresentativeCountLabel } from "~/utils/district-availability";
import {
	buildDistrictRepresentativeBadgeHref,
	buildDistrictRepresentativeBadgeTitle,
	buildDistrictRepresentativePopoverLinks
} from "~/utils/district-directory-links";
import { isExternalHref } from "~/utils/link";
import { buildNationwideDirectoryResponses } from "~/utils/nationwide-directory";
import { buildLookupContextFromNationwideResult, buildNationwideLookupRouteQuery, buildNationwideRouteTarget } from "~/utils/nationwide-route-context";
import { resolveRepresentativePresentation } from "~/utils/representative-presentation";

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
const { data: guideDistrictData, error: guideDistrictError, pending: guideDistrictPending } = await useDistricts(activeLookupQuery);
const { data: guideRepresentativesData } = await useRepresentatives(activeLookupQuery);
const emptyNationwideDistrictsResponse: DistrictsResponse = { districts: [], mode: "nationwide", note: "", updatedAt: "" };
const emptyNationwideRepresentativesResponse: RepresentativesResponse = { districts: [], mode: "nationwide", note: "", representatives: [], updatedAt: "" };
const emptyGuideDistrictsResponse: DistrictsResponse = { districts: [], mode: "guide", note: "", updatedAt: "" };
const emptyGuideRepresentativesResponse: RepresentativesResponse = { districts: [], mode: "guide", note: "", representatives: [], updatedAt: "" };
const apiUsesNationwide = computed(() => guideDistrictData.value?.mode === "nationwide" || guideRepresentativesData.value?.mode === "nationwide");
const showGuideDirectory = computed(() => hasPublishedGuideContext.value);
const storeUsesNationwide = computed(() => {
	if (!activeNationwideLookupResult.value || activeNationwideLookupResult.value.result !== "resolved")
		return false;

	return isHydrated.value
		? hasNationwideResultContext.value && !hasPublishedGuideContext.value
		: activeNationwideLookupResult.value.guideAvailability !== "published";
});
const directoryUsesNationwide = computed(() => apiUsesNationwide.value || storeUsesNationwide.value);
const nationwideDirectory = computed(() => buildNationwideDirectoryResponses(activeNationwideLookupResult.value));
const directoryData = computed(() => {
	if (apiUsesNationwide.value) {
		return {
			districts: guideDistrictData.value ?? emptyNationwideDistrictsResponse,
			representatives: guideRepresentativesData.value ?? emptyNationwideRepresentativesResponse
		};
	}

	if (storeUsesNationwide.value)
		return nationwideDirectory.value;

	return {
		districts: showGuideDirectory.value ? guideDistrictData.value ?? emptyGuideDistrictsResponse : emptyNationwideDistrictsResponse,
		representatives: showGuideDirectory.value ? guideRepresentativesData.value ?? emptyGuideRepresentativesResponse : emptyNationwideRepresentativesResponse
	};
});
const directoriesPending = computed(() => directoryUsesNationwide.value ? false : showGuideDirectory.value ? guideDistrictPending.value : false);
const directoriesError = computed(() => showGuideDirectory.value || directoryUsesNationwide.value
	? directoryUsesNationwide.value && directoryData.value ? null : guideDistrictError.value
	: null);
const districts = computed(() => directoryData.value?.districts.districts ?? []);
const representatives = computed(() => directoryData.value?.representatives.representatives ?? []);
const activeLookupSummary = computed(() => buildActiveLookupSummary({
	nationwideLookupResult: activeNationwideLookupResult.value,
	routeLookupQuery: activeLookupQuery.value?.lookup ?? null,
	selectedLocation: isHydrated.value ? selectedLocation.value : null
}));

const representativesByDistrict = computed(() => {
	const grouped = new Map<string, typeof representatives.value>();

	for (const representative of representatives.value) {
		const existingRepresentatives = grouped.get(representative.districtSlug) ?? [];
		grouped.set(representative.districtSlug, [...existingRepresentatives, representative]);
	}

	return grouped;
});

function getDistrictRepresentatives(districtSlug: string) {
	return representativesByDistrict.value.get(districtSlug) ?? [];
}

function getDistrictRepresentativeCountLabel(district: typeof districts.value[number]) {
	return buildDistrictRepresentativeCountLabel(district, getDistrictRepresentatives(district.slug).length || district.representativeCount);
}

function getDistrictRepresentativeAvailabilityNote(district: typeof districts.value[number]) {
	return buildDistrictRepresentativeAvailabilityNote(district, getDistrictRepresentatives(district.slug).length || district.representativeCount);
}

function getRepresentativePresentation(representative: RepresentativesResponse["representatives"][number]) {
	return resolveRepresentativePresentation(representative, activeNationwideLookupResult.value?.location?.state ?? null);
}

function getPrimaryDistrictRepresentative(districtSlug: string) {
	return getDistrictRepresentatives(districtSlug)[0] ?? null;
}

function getPrimaryDistrictRepresentativePresentation(districtSlug: string) {
	const representative = getPrimaryDistrictRepresentative(districtSlug);
	return representative ? getRepresentativePresentation(representative) : null;
}

function getDistrictRepresentativeBadgeHref(district: typeof districts.value[number]) {
	return buildDistrictRepresentativeBadgeHref(getDistrictRepresentatives(district.slug), district.href);
}

function getDistrictRepresentativeBadgeTitle(district: typeof districts.value[number]) {
	return buildDistrictRepresentativeBadgeTitle(district, getDistrictRepresentatives(district.slug));
}

function getDistrictRepresentativePopoverLinks(districtSlug: string) {
	return buildDistrictRepresentativePopoverLinks(getDistrictRepresentatives(districtSlug));
}

const summaryItems = computed(() => {
	const isNationwideMode = directoryUsesNationwide.value;
	const updatedAt = directoryData.value?.districts.updatedAt ?? "";

	return [
		{ label: "District pages", note: isNationwideMode ? "District matches from the active nationwide lookup." : "Candidate-contest areas in the active election.", value: districts.value.length },
		{ label: "Representative directory", note: isNationwideMode ? "Officials linked to the active nationwide lookup." : "Currently serving officials on the active ballot.", value: representatives.value.length, href: "/representatives" },
		{ label: "Updated", note: "Latest district data refresh.", value: formatDateTime(updatedAt) }
	];
});

usePageSeo({
	description: "Browse district-by-district Ballot Clarity pages for office context, current representatives, and the upcoming contest field.",
	path: "/districts",
	title: "District hub"
});
const districtIntroCopy = computed(() => directoryUsesNationwide.value
	? "Use district pages to inspect nationwide lookup matches, including linked officials where active lookup provides those links. Candidate fields are shown when local guide coverage exists."
	: "Use district pages when you want the office area, the current representative, and the current candidate field in one place without leaving the current results layer."
);
const requiresLookupPrompt = computed(() => !directoryUsesNationwide.value && !showGuideDirectory.value);

function buildLookupAwareTarget(path: string) {
	return buildNationwideRouteTarget(path, buildLookupContextFromNationwideResult(activeNationwideLookupResult.value), route.query);
}
</script>

<template>
	<section class="app-shell section-gap space-y-8">
		<header class="gap-6 grid xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
			<div class="surface-panel">
				<div class="flex flex-wrap gap-2">
					<VerificationBadge label="District hub" tone="accent" />
					<VerificationBadge label="Contest-by-contest" />
				</div>
				<h1 class="text-5xl text-app-ink font-serif mt-5 dark:text-app-text-dark">
					District pages
				</h1>
				<p class="text-base text-app-muted leading-8 mt-5 dark:text-app-muted-dark">
					{{ districtIntroCopy }}
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
				<div class="mt-6 pt-6 border-t border-app-line/80 dark:border-app-line-dark">
					<h3 class="text-2xl text-app-ink font-serif dark:text-app-text-dark">
						What lives here
					</h3>
					<ul class="readable-list text-sm text-app-muted mt-5 pl-5 dark:text-app-muted-dark">
						<li>District and office context</li>
						<li>Current incumbent or currently serving official, when one is on the ballot</li>
						<li>Candidate field for the active election</li>
						<li>Representative person pages and dedicated funding or influence pages where Ballot Clarity has person-level data</li>
					</ul>
				</div>
			</div>
		</header>

		<div v-if="directoriesPending && !directoryData.districts.districts.length" class="gap-6 grid lg:grid-cols-2 xl:grid-cols-3">
			<div v-for="index in 3" :key="index" class="surface-panel bg-white/70 h-72 animate-pulse dark:bg-app-panel-dark/70" />
		</div>

		<div v-else-if="directoriesError || !directoryData" class="max-w-3xl">
			<InfoCallout title="District pages unavailable" tone="warning">
				The district hub could not be loaded. Open nationwide results or the coverage profile and try again.
			</InfoCallout>
		</div>

		<div v-else-if="requiresLookupPrompt" class="max-w-3xl">
			<InfoCallout title="Active nationwide lookup required" tone="warning">
				This district hub stays nationwide-first. Start from the lookup or open saved nationwide results so Ballot Clarity can attach the current district matches and linked representatives instead of falling back to unrelated guide data.
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

			<section class="gap-6 grid lg:grid-cols-2 xl:grid-cols-3">
				<article
					v-for="district in districts"
					:key="district.slug"
					class="surface-panel flex flex-col"
				>
					<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
						{{ district.jurisdiction }}
					</p>
					<h2 class="text-3xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
						{{ district.title }}
					</h2>
					<p class="text-sm text-app-muted leading-7 mt-4 dark:text-app-muted-dark">
						{{ district.summary }}
					</p>
					<div class="mt-5 flex flex-wrap gap-2">
						<VerificationBadge :label="`${district.candidateCount} candidate${district.candidateCount === 1 ? '' : 's'}`" />
						<div
							v-if="getDistrictRepresentatives(district.slug).length"
							class="group relative"
						>
							<a
								v-if="getDistrictRepresentativeBadgeHref(district) && isExternalHref(getDistrictRepresentativeBadgeHref(district) ?? '')"
								:href="getDistrictRepresentativeBadgeHref(district)"
								:title="getDistrictRepresentativeBadgeTitle(district)"
								target="_blank"
								rel="noreferrer"
								class="text-[11px] text-app-accent font-semibold px-2.5 py-1 border border-app-accent/22 rounded-full bg-app-accent/8 inline-flex gap-1.5 transition items-center dark:text-[#9ed4e3] dark:border-app-accent/28 hover:border-app-accent/38 dark:bg-app-accent/12 hover:bg-app-accent/12 focus-ring"
							>
								<span class="rounded-full bg-current h-1.5 w-1.5" />
								{{ getDistrictRepresentativeCountLabel(district) }}
							</a>
							<NuxtLink
								v-else-if="getDistrictRepresentativeBadgeHref(district)"
								:to="buildLookupAwareTarget(getDistrictRepresentativeBadgeHref(district) ?? district.href)"
								:title="getDistrictRepresentativeBadgeTitle(district)"
								class="text-[11px] text-app-accent font-semibold px-2.5 py-1 border border-app-accent/22 rounded-full bg-app-accent/8 inline-flex gap-1.5 transition items-center dark:text-[#9ed4e3] dark:border-app-accent/28 hover:border-app-accent/38 dark:bg-app-accent/12 hover:bg-app-accent/12 focus-ring"
							>
								<span class="rounded-full bg-current h-1.5 w-1.5" />
								{{ getDistrictRepresentativeCountLabel(district) }}
							</NuxtLink>
							<div
								class="mt-2 p-3 border border-app-line/85 rounded-2xl bg-white/96 opacity-0 max-w-80 min-w-64 invisible pointer-events-none shadow-[0_18px_38px_-24px_rgba(16,37,62,0.58)] transition duration-150 left-0 top-full absolute z-20 dark:border-app-line-dark dark:bg-app-panel-dark/96 group-focus-within:opacity-100 group-hover:opacity-100 group-focus-within:visible group-hover:visible"
							>
								<p class="text-[11px] text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
									{{ getDistrictRepresentatives(district.slug).length === 1 ? "Linked representative" : "Linked representatives" }}
								</p>
								<ul class="mt-2 space-y-2">
									<li
										v-for="representative in getDistrictRepresentativePopoverLinks(district.slug)"
										:key="representative.href"
									>
										<a
											v-if="representative.external"
											:href="representative.href"
											target="_blank"
											rel="noreferrer"
											class="px-3 py-2 rounded-xl bg-app-bg/70 block pointer-events-auto transition dark:bg-app-bg-dark/70 hover:bg-app-bg focus-ring dark:hover:bg-app-bg-dark"
										>
											<p class="text-sm text-app-ink font-semibold dark:text-app-text-dark">
												{{ representative.name }}
											</p>
											<p class="text-xs text-app-muted mt-1 dark:text-app-muted-dark">
												{{ representative.party }} · {{ representative.officeDisplayLabel }}
											</p>
										</a>
										<NuxtLink
											v-else
											:to="buildLookupAwareTarget(representative.href)"
											class="px-3 py-2 rounded-xl bg-app-bg/70 block pointer-events-auto transition dark:bg-app-bg-dark/70 hover:bg-app-bg focus-ring dark:hover:bg-app-bg-dark"
										>
											<p class="text-sm text-app-ink font-semibold dark:text-app-text-dark">
												{{ representative.name }}
											</p>
											<p class="text-xs text-app-muted mt-1 dark:text-app-muted-dark">
												{{ representative.party }} · {{ representative.officeDisplayLabel }}
											</p>
										</NuxtLink>
									</li>
								</ul>
							</div>
						</div>
						<VerificationBadge v-else :label="getDistrictRepresentativeCountLabel(district)" tone="accent" />
					</div>
					<div v-if="getDistrictRepresentatives(district.slug).length" class="mt-5 pt-5 border-t border-app-line/80 dark:border-app-line-dark">
						<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
							{{ getDistrictRepresentatives(district.slug).length === 1 ? 'Current representative' : 'Current representatives' }}
						</p>
						<p class="text-lg text-app-ink font-semibold mt-3 dark:text-app-text-dark">
							{{ getPrimaryDistrictRepresentative(district.slug)?.name }}
						</p>
						<div class="mt-2 flex flex-wrap gap-2 items-center">
							<VerificationBadge :label="getPrimaryDistrictRepresentativePresentation(district.slug)?.levelLabel ?? 'Unclassified'" tone="accent" />
							<p class="text-sm text-app-muted dark:text-app-muted-dark">
								{{ getPrimaryDistrictRepresentative(district.slug)?.party }} · {{ getPrimaryDistrictRepresentativePresentation(district.slug)?.officeDisplayLabel }}
							</p>
						</div>
						<p v-if="getDistrictRepresentatives(district.slug).length > 1" class="text-sm text-app-muted mt-2 dark:text-app-muted-dark">
							{{ getDistrictRepresentatives(district.slug).length - 1 }} more linked official{{ getDistrictRepresentatives(district.slug).length - 1 === 1 ? '' : 's' }} are attached to this district match.
						</p>
					</div>
					<p v-else-if="directoryUsesNationwide" class="text-sm text-app-muted leading-7 mt-5 pt-5 border-t border-app-line/80 dark:text-app-muted-dark dark:border-app-line-dark">
						{{ getDistrictRepresentativeAvailabilityNote(district) }}
					</p>
					<div class="mt-6 flex flex-wrap gap-3">
						<NuxtLink :to="buildLookupAwareTarget(district.href)" class="btn-primary">
							Open district page
						</NuxtLink>
						<a
							v-if="getDistrictRepresentatives(district.slug).length && isExternalHref(getDistrictRepresentatives(district.slug)[0]?.href ?? '')"
							:href="getDistrictRepresentatives(district.slug)[0]?.href"
							target="_blank"
							rel="noreferrer"
							class="btn-secondary inline-flex gap-2 items-center"
						>
							Open record
							<span class="i-carbon-launch" />
						</a>
						<NuxtLink
							v-else-if="getDistrictRepresentatives(district.slug).length"
							:to="buildLookupAwareTarget(getDistrictRepresentatives(district.slug)[0]?.href ?? '/representatives')"
							class="btn-secondary"
						>
							Open representative
						</NuxtLink>
						<a
							v-if="getDistrictRepresentatives(district.slug).length && getDistrictRepresentatives(district.slug)[0]?.openstatesUrl"
							:href="getDistrictRepresentatives(district.slug)[0]?.openstatesUrl"
							target="_blank"
							rel="noreferrer"
							class="btn-secondary inline-flex gap-2 items-center"
						>
							Provider record
							<span class="i-carbon-launch" />
						</a>
					</div>
				</article>
			</section>
		</div>
	</section>
</template>
