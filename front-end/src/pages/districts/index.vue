<script setup lang="ts">
import { storeToRefs } from "pinia";
import { buildNationwideDirectoryResponses } from "~/utils/nationwide-directory";

const { formatDateTime } = useFormatters();
const civicStore = useCivicStore();
const { isHydrated, nationwideLookupResult } = storeToRefs(civicStore);
const { data: guideDistrictData, error: guideDistrictError, pending: guideDistrictPending } = await useDistricts();
const { data: guideRepresentativesData } = await useRepresentatives();
const { hasNationwideResultContext, hasPublishedGuideContext } = useGuideEntryGate();

const directoryUsesNationwide = computed(() => isHydrated.value && hasNationwideResultContext.value && !hasPublishedGuideContext.value);
const nationwideDirectory = computed(() => buildNationwideDirectoryResponses(nationwideLookupResult.value));
const directoryData = computed(() =>
	isHydrated.value
		? directoryUsesNationwide.value
			? nationwideDirectory.value
			: {
					districts: guideDistrictData.value ?? { districts: [], note: "", updatedAt: "" },
					representatives: guideRepresentativesData.value ?? { districts: [], note: "", representatives: [], updatedAt: "" }
				}
		: null
);
const directoriesPending = computed(() => directoryUsesNationwide.value ? false : guideDistrictPending.value);
const directoriesError = computed(() => directoryUsesNationwide.value ? null : guideDistrictError.value);
const districts = computed(() => directoryData.value?.districts.districts ?? []);
const representatives = computed(() => directoryData.value?.representatives.representatives ?? []);

const representativeByDistrict = computed(() => new Map(representatives.value.map(item => [item.districtSlug, item])));

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
				<h2 class="text-3xl text-app-ink font-serif dark:text-app-text-dark">
					What lives here
				</h2>
				<ul class="readable-list text-sm text-app-muted mt-5 pl-5 dark:text-app-muted-dark">
					<li>District and office context</li>
					<li>Current incumbent or currently serving official, when one is on the ballot</li>
					<li>Candidate field for the active election</li>
					<li>Links to dedicated funding and influence pages</li>
				</ul>
			</div>
		</header>

		<div v-if="!isHydrated || directoriesPending" class="gap-6 grid lg:grid-cols-2 xl:grid-cols-3">
			<div v-for="index in 3" :key="index" class="surface-panel bg-white/70 h-72 animate-pulse dark:bg-app-panel-dark/70" />
		</div>

		<div v-else-if="directoriesError || !directoryData" class="max-w-3xl">
			<InfoCallout title="District pages unavailable" tone="warning">
				The district hub could not be loaded. Open nationwide results or the coverage profile and try again.
			</InfoCallout>
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
						<VerificationBadge :label="`${district.representativeCount} current representative${district.representativeCount === 1 ? '' : 's'}`" tone="accent" />
					</div>
					<div v-if="representativeByDistrict.get(district.slug)" class="mt-5 pt-5 border-t border-app-line/80 dark:border-app-line-dark">
						<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
							Current representative
						</p>
						<p class="text-lg text-app-ink font-semibold mt-3 dark:text-app-text-dark">
							{{ representativeByDistrict.get(district.slug)?.name }}
						</p>
						<p class="text-sm text-app-muted mt-2 dark:text-app-muted-dark">
							{{ representativeByDistrict.get(district.slug)?.party }} · {{ representativeByDistrict.get(district.slug)?.officeSought }}
						</p>
					</div>
					<div class="mt-6 flex flex-wrap gap-3">
						<NuxtLink :to="district.href" class="btn-primary">
							Open district page
						</NuxtLink>
						<NuxtLink v-if="representativeByDistrict.get(district.slug)" :to="representativeByDistrict.get(district.slug)?.href ?? '/representatives'" class="btn-secondary">
							Open representative
						</NuxtLink>
					</div>
				</article>
			</section>
		</div>
	</section>
</template>
