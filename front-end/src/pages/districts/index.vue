<script setup lang="ts">
const { formatDateTime } = useFormatters();
const { data, error, pending } = await useDistricts();
const { data: representativesData } = await useRepresentatives();

const representativeByDistrict = computed(() => {
	return new Map((representativesData.value?.representatives ?? []).map(item => [item.districtSlug, item]));
});

usePageSeo({
	description: "Browse district-by-district Ballot Clarity pages for office context, current representatives, and the upcoming contest field.",
	path: "/districts",
	title: "District hub"
});
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
					Use district pages when you want the office area, the current representative, and the current candidate field in one place without leaving the current results layer.
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

		<div v-if="pending" class="gap-6 grid lg:grid-cols-2 xl:grid-cols-3">
			<div v-for="index in 3" :key="index" class="surface-panel bg-white/70 h-72 animate-pulse dark:bg-app-panel-dark/70" />
		</div>

		<div v-else-if="error || !data" class="max-w-3xl">
			<InfoCallout title="District pages unavailable" tone="warning">
				The district hub could not be loaded. Open nationwide results or the coverage profile and try again.
			</InfoCallout>
		</div>

		<div v-else class="space-y-6">
			<PageSummaryStrip
				:items="[
					{ label: 'District pages', note: 'Candidate-contest areas in the active election.', value: data.districts.length },
					{ label: 'Representative directory', note: 'Currently serving officials on the active ballot.', value: representativesData?.representatives.length ?? 0, href: '/representatives' },
					{ label: 'Updated', note: 'Latest district data refresh.', value: formatDateTime(data.updatedAt) },
				]"
			/>

			<section class="gap-6 grid lg:grid-cols-2 xl:grid-cols-3">
				<article
					v-for="district in data.districts"
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
