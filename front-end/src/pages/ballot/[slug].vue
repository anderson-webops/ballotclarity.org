<script setup lang="ts">
import type { Contest } from "~/types/civic";
import { storeToRefs } from "pinia";

const civicStore = useCivicStore();
const route = useRoute();
const { compareList, selectedIssues } = storeToRefs(civicStore);

const ballotSlug = computed(() => String(route.params.slug));
const locationSlug = computed(() => {
	return typeof route.query.location === "string"
		? route.query.location
		: civicStore.selectedLocation?.slug;
});

const { data, error, pending } = await useBallot(ballotSlug, locationSlug);

watchEffect(() => {
	if (data.value) {
		civicStore.setElection({
			date: data.value.election.date,
			locationName: data.value.election.locationName,
			name: data.value.election.name,
			slug: data.value.election.slug,
			updatedAt: data.value.election.updatedAt,
		});
		civicStore.setLocation(data.value.location);
	}
});

usePageSeo({
	description: data.value?.election.description ?? "Review the sample ballot, candidates, measures, and attached sources.",
	path: `/ballot/${ballotSlug.value}`,
	title: data.value?.election.name ?? "Ballot",
});

const searchQuery = ref("");

const issueOptions = computed(() => {
	const options = new Map<string, string>();

	data.value?.election.contests.forEach((contest) => {
		contest.candidates?.forEach((candidate) => {
			candidate.topIssues.forEach((issue) => {
				options.set(issue.slug, issue.label);
			});
		});
	});

	return Array.from(options.entries()).map(([slug, label]) => ({ label, slug }));
});

const filteredContests = computed<Contest[]>(() => {
	if (!data.value)
		return [];

	const query = searchQuery.value.trim().toLowerCase();

	return data.value.election.contests
		.map((contest) => {
			if (contest.type === "candidate") {
				const candidates = contest.candidates?.filter((candidate) => {
					const matchesQuery = !query || [
						candidate.name,
						candidate.officeSought,
						candidate.party,
						candidate.ballotSummary,
						candidate.topIssues.map(issue => issue.label).join(" "),
					].join(" ").toLowerCase().includes(query);

					const matchesIssue = !selectedIssues.value.length
						|| candidate.topIssues.some(issue => selectedIssues.value.includes(issue.slug));

					return matchesQuery && matchesIssue;
				}) ?? [];

				return {
					...contest,
					candidates,
				};
			}

			const measures = contest.measures?.filter((measure) => {
				if (!query)
					return true;

				return [
					measure.title,
					measure.ballotSummary,
					measure.plainLanguageExplanation,
					measure.yesMeaning,
					measure.noMeaning,
				].join(" ").toLowerCase().includes(query);
			}) ?? [];

			return {
				...contest,
				measures,
			};
		})
		.filter(contest => (contest.type === "candidate"
			? Boolean(contest.candidates?.length)
			: Boolean(contest.measures?.length)));
});

const compareHref = computed(() => ({
	path: "/compare",
	query: {
		slugs: compareList.value.join(","),
	},
}));

function clearFilters() {
	searchQuery.value = "";
	civicStore.clearIssues();
}
</script>

<template>
	<div class="pb-16 space-y-8">
		<ElectionHero
			v-if="data"
			:election="data.election"
			:location="data.location"
			:note="data.note"
		/>

		<section class="app-shell print-hidden">
			<div class="surface-panel">
				<div class="gap-6 grid xl:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
					<div>
						<label for="ballot-search" class="text-sm text-app-ink font-semibold dark:text-app-text-dark">
							Search this ballot
						</label>
						<div class="mt-3 relative">
							<span class="i-carbon-search text-app-muted pointer-events-none left-4 top-1/2 absolute dark:text-app-muted-dark -translate-y-1/2" />
							<input
								id="ballot-search"
								v-model="searchQuery"
								type="search"
								placeholder="Search candidates, measures, or issues"
								class="text-sm text-app-ink pl-11 pr-4 border border-app-line rounded-full bg-white h-[3.25rem] w-full dark:text-app-text-dark placeholder:text-app-muted dark:border-app-line-dark dark:bg-app-panel-dark focus-ring dark:placeholder:text-app-muted-dark"
							>
						</div>
					</div>

					<div>
						<div class="flex gap-4 items-center justify-between">
							<p class="text-sm text-app-ink font-semibold dark:text-app-text-dark">
								Filter by issue
							</p>
							<button type="button" class="text-xs text-app-accent font-semibold rounded-full focus-ring" @click="clearFilters">
								Clear filters
							</button>
						</div>
						<div class="mt-3 flex flex-wrap gap-2">
							<button
								v-for="issue in issueOptions"
								:key="issue.slug"
								type="button"
								class="text-xs font-semibold px-3 py-2 border rounded-full transition focus-ring"
								:class="selectedIssues.includes(issue.slug)
									? 'border-app-accent bg-app-accent text-white'
									: 'border-app-line bg-white text-app-muted hover:border-app-accent hover:text-app-accent dark:border-app-line-dark dark:bg-app-panel-dark dark:text-app-muted-dark'"
								@click="civicStore.toggleIssue(issue.slug)"
							>
								{{ issue.label }}
							</button>
						</div>
					</div>
				</div>
			</div>
		</section>

		<section class="app-shell print-hidden">
			<InfoCallout title="Questions to ask before you vote">
				<ul class="space-y-2">
					<li>What is directly documented here, and what still requires checking an original record?</li>
					<li>Which issues matter most in this contest, and what evidence is attached to each summary?</li>
					<li>What might change if the measure passes or fails, and who would carry the cost or benefit?</li>
				</ul>
			</InfoCallout>
		</section>

		<section v-if="pending" class="app-shell space-y-6">
			<div v-for="index in 3" :key="index" class="surface-panel animate-pulse">
				<div class="rounded-full bg-app-line/70 h-6 w-48 dark:bg-app-line-dark" />
				<div class="mt-4 rounded-full bg-app-line/60 h-4 w-full dark:bg-app-line-dark" />
				<div class="mt-2 rounded-full bg-app-line/60 h-4 w-3/4 dark:bg-app-line-dark" />
				<div class="mt-8 gap-4 grid lg:grid-cols-2">
					<div class="rounded-3xl bg-app-line/50 h-56 dark:bg-app-line-dark" />
					<div class="rounded-3xl bg-app-line/50 h-56 dark:bg-app-line-dark" />
				</div>
			</div>
		</section>

		<section v-else-if="error" class="app-shell">
			<InfoCallout title="Unable to load ballot" tone="warning">
				The demo ballot could not be loaded. Refresh the page or return to the home page and try again.
			</InfoCallout>
		</section>

		<section v-else-if="filteredContests.length" class="app-shell space-y-6">
			<ContestSection
				v-for="contest in filteredContests"
				:key="contest.slug"
				:contest="contest"
			/>
		</section>

		<section v-else class="app-shell">
			<div class="surface-panel text-center">
				<h2 class="text-3xl text-app-ink font-serif dark:text-app-text-dark">
					No ballot items match the current filters.
				</h2>
				<p class="text-sm text-app-muted leading-7 mx-auto mt-4 max-w-2xl dark:text-app-muted-dark">
					Try clearing the search field or removing selected issues to restore the full sample ballot.
				</p>
				<button type="button" class="btn-primary mt-6" @click="clearFilters">
					Clear filters
				</button>
			</div>
		</section>

		<section
			v-if="compareList.length"
			class="px-4 bottom-4 left-0 right-0 fixed z-30 print-hidden"
		>
			<div class="mx-auto px-5 py-4 border border-app-line rounded-[1.75rem] bg-white flex flex-col gap-3 max-w-4xl w-full shadow-[0_24px_50px_-36px_rgba(16,37,62,0.7)] dark:border-app-line-dark dark:bg-app-panel-dark sm:flex-row sm:items-center sm:justify-between">
				<div>
					<p class="text-sm text-app-ink font-semibold dark:text-app-text-dark">
						Compare list: {{ compareList.length }} selected
					</p>
					<p class="text-xs text-app-muted mt-1 dark:text-app-muted-dark">
						Choose 2 or 3 candidates to open a side-by-side comparison.
					</p>
				</div>
				<div class="flex flex-wrap gap-3">
					<NuxtLink :to="compareHref" class="btn-primary" :class="{ 'opacity-60 pointer-events-none': compareList.length < 2 }">
						Compare selected candidates
					</NuxtLink>
					<button type="button" class="btn-secondary" @click="civicStore.clearCompare()">
						Clear compare list
					</button>
				</div>
			</div>
		</section>
	</div>
</template>
