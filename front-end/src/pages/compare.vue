<script setup lang="ts">
import { storeToRefs } from "pinia";
import { buildCompareRoute, normalizeCompareSlugs, parseCompareQuerySlugs } from "~/stores/civic";

const civicStore = useCivicStore();
const route = useRoute();
const router = useRouter();
const { backToLayerLink, layerBreadcrumbLink, openLayerLink } = useRouteLayerNavigation();
const { compareList, isHydrated } = storeToRefs(civicStore);

const selectedSlugs = computed(() => parseCompareQuerySlugs(route.query.slugs));
const cachedCompareSlugs = computed(() => normalizeCompareSlugs(isHydrated.value ? compareList.value : []));
const hasCanonicalSelection = computed(() => selectedSlugs.value.length > 0);
const hasSavedCompareSelection = computed(() => !hasCanonicalSelection.value && cachedCompareSlugs.value.length >= 2);
const resumeCompareHref = computed(() => buildCompareRoute(cachedCompareSlugs.value));

watch(selectedSlugs, (slugs) => {
	if (slugs.length)
		civicStore.replaceCompare(slugs);
}, { immediate: true });

const { data, pending } = await useCandidates(selectedSlugs);

const selectedCategory = ref<string | null>(null);
const showOnlyDifferences = ref(false);
const showOnlyMutualResponses = ref(false);

const sortedCandidates = computed(() => {
	return [...(data.value?.candidates ?? [])].sort((left, right) => {
		return left.comparison.ballotOrder - right.comparison.ballotOrder
			|| left.comparison.displayName.localeCompare(right.comparison.displayName);
	});
});

const questionCategories = computed(() => {
	return Array.from(new Set(
		sortedCandidates.value.flatMap(candidate => candidate.comparison.questionnaireResponses.map(response => response.category))
	));
});

watchEffect(() => {
	if (selectedCategory.value && !questionCategories.value.includes(selectedCategory.value))
		selectedCategory.value = null;
});

const sameContest = computed(() => Boolean(data.value?.sameContest));
const compareBreadcrumbs = computed(() => [
	{ label: "Home", to: "/" },
	layerBreadcrumbLink.value,
	{ label: "Compare" }
]);
const hasUnavailableSelection = computed(() => {
	return selectedSlugs.value.length >= 2 && (data.value?.candidates.length ?? 0) === 0;
});
const emptyStateTitle = computed(() => {
	if (hasUnavailableSelection.value)
		return "Candidate comparison is not available yet";

	if (selectedSlugs.value.length === 1)
		return "Select one more candidate to compare";

	return "No compare candidates selected";
});
const emptyStateBody = computed(() => {
	if (hasUnavailableSelection.value)
		return "";

	if (selectedSlugs.value.length === 1)
		return "Add at least one more candidate from the same race.";

	return "";
});

async function clearCompareSelection() {
	civicStore.clearCompare();
	await router.push("/compare");
}

usePageSeo({
	description: "Compare candidates with verified ballot facts, candidate-provided statements, and source-backed context without scores, polls, or rankings.",
	path: "/compare",
	title: "Compare Candidates"
});
</script>

<template>
	<section class="app-shell section-gap space-y-8">
		<AppBreadcrumbs :items="compareBreadcrumbs" />

		<header class="max-w-5xl">
			<h1 class="text-5xl text-app-ink font-serif dark:text-app-text-dark">
				Compare candidates
			</h1>
		</header>

		<div v-if="pending" class="rounded-lg bg-app-bg h-96 animate-pulse dark:bg-app-bg-dark" />

		<div v-else-if="(data?.candidates.length ?? 0) < 2" class="max-w-3xl">
			<p class="text-xl text-app-ink font-semibold dark:text-app-text-dark">
				{{ emptyStateTitle }}
			</p>
			<p v-if="emptyStateBody" class="text-base text-app-muted mt-2 dark:text-app-muted-dark">
				{{ emptyStateBody }}
			</p>
			<div class="mt-6 flex flex-wrap gap-x-6 gap-y-3 items-center">
				<NuxtLink :to="openLayerLink.to" class="btn-primary">
					{{ openLayerLink.label }}
				</NuxtLink>
				<NuxtLink v-if="hasSavedCompareSelection" :to="resumeCompareHref" class="btn-secondary">
					Resume saved compare
				</NuxtLink>
				<button
					v-if="cachedCompareSlugs.length"
					type="button"
					class="btn-secondary"
					@click="clearCompareSelection"
				>
					Clear saved compare list
				</button>
			</div>
		</div>

		<template v-else-if="!sameContest">
			<p class="text-base text-app-muted dark:text-app-muted-dark">
				These candidates are in different races, so their answers aren't compared side by side.
			</p>

			<section class="gap-6 grid xl:grid-cols-3">
				<article v-for="candidate in sortedCandidates" :key="candidate.slug" class="content-block">
					<div class="flex flex-wrap gap-3 items-center">
						<h2 class="text-2xl text-app-ink font-serif dark:text-app-text-dark">
							{{ candidate.comparison.displayName }}
						</h2>
						<IncumbentBadge v-if="candidate.incumbent" />
					</div>
					<p class="text-sm text-app-muted mt-2 dark:text-app-muted-dark">
						{{ candidate.officeSought }} · <PartyLabel :party="candidate.comparison.partyOnBallot" />
					</p>
					<p class="text-base text-app-ink leading-7 mt-4 dark:text-app-text-dark">
						{{ candidate.comparison.whyRunning.text }}
					</p>
					<div class="mt-5 flex flex-wrap gap-3">
						<NuxtLink :to="`/candidate/${candidate.slug}`" class="btn-secondary">
							Open profile
						</NuxtLink>
						<SafeExternalLink :href="candidate.comparison.campaignWebsiteUrl" class="btn-secondary">
							Campaign website
						</SafeExternalLink>
					</div>
				</article>
			</section>
		</template>

		<template v-else>
			<section class="surface-panel">
				<div class="flex flex-wrap gap-4 items-center justify-between">
					<div>
						<h2 class="text-3xl text-app-ink font-serif dark:text-app-text-dark">
							{{ data?.office }}
						</h2>
					</div>
					<div class="flex flex-wrap gap-x-6 gap-y-2 items-center">
						<NuxtLink :to="backToLayerLink.to" class="btn-secondary">
							{{ backToLayerLink.label }}
						</NuxtLink>
						<button type="button" class="text-sm text-app-muted font-medium underline decoration-app-line underline-offset-4 min-h-10 dark:text-app-muted-dark hover:text-app-ink focus-ring" @click="clearCompareSelection">
							Clear compare list
						</button>
					</div>
				</div>

				<div class="mt-6 gap-6 grid xl:grid-cols-[minmax(0,1fr)_auto]">
					<div>
						<p class="text-sm text-app-ink font-semibold dark:text-app-text-dark">
							Filter by question category
						</p>
						<div class="mt-3 flex flex-wrap gap-2">
							<button
								type="button"
								class="text-xs font-semibold px-3 py-2 border rounded-full transition focus-ring"
								:class="selectedCategory === null
									? 'border-app-accent bg-app-accent text-app-action-text'
									: 'border-app-line bg-white text-app-muted hover:border-app-accent hover:text-app-accent dark:border-app-line-dark dark:bg-app-panel-dark dark:text-app-muted-dark'"
								@click="selectedCategory = null"
							>
								All questions
							</button>
							<button
								v-for="category in questionCategories"
								:key="category"
								type="button"
								class="text-xs font-semibold px-3 py-2 border rounded-full transition focus-ring"
								:class="selectedCategory === category
									? 'border-app-accent bg-app-accent text-app-action-text'
									: 'border-app-line bg-white text-app-muted hover:border-app-accent hover:text-app-accent dark:border-app-line-dark dark:bg-app-panel-dark dark:text-app-muted-dark'"
								@click="selectedCategory = category"
							>
								{{ category }}
							</button>
						</div>
					</div>

					<div class="flex flex-col gap-3">
						<label class="text-sm text-app-muted px-4 py-3 border border-app-line rounded-2xl bg-white flex gap-3 items-center self-start dark:text-app-muted-dark dark:border-app-line-dark dark:bg-app-panel-dark">
							<input v-model="showOnlyDifferences" type="checkbox" class="accent-app-accent h-4 w-4">
							Show only rows with meaningful differences
						</label>
						<label class="text-sm text-app-muted px-4 py-3 border border-app-line rounded-2xl bg-white flex gap-3 items-center self-start dark:text-app-muted-dark dark:border-app-line-dark dark:bg-app-panel-dark">
							<input v-model="showOnlyMutualResponses" type="checkbox" class="accent-app-accent h-4 w-4">
							Show only questions answered by all selected candidates
						</label>
					</div>
				</div>
			</section>

			<CompareTable
				:candidates="sortedCandidates"
				:question-category="selectedCategory"
				:show-only-differences="showOnlyDifferences"
				:show-only-mutual-responses="showOnlyMutualResponses"
			/>
		</template>
	</section>
</template>
