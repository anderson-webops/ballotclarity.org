<script setup lang="ts">
import type { Contest } from "~/types/civic";
import { storeToRefs } from "pinia";
import { buildCompareRoute } from "~/stores/civic";

const civicStore = useCivicStore();
const route = useRoute();
const { formatDate } = useFormatters();
const { ballotPlan, ballotPlanCount, ballotViewMode, compareList, isHydrated, selectedIssues } = storeToRefs(civicStore);

const ballotSlug = useRouteStringParam("slug");
const locationSlug = computed(() => typeof route.query.location === "string" ? route.query.location : undefined);

const { data, error, pending } = await useBallot(ballotSlug, locationSlug);
const effectiveBallotPlan = computed(() => isHydrated.value ? ballotPlan.value : {});
const effectiveBallotPlanCount = computed(() => isHydrated.value ? ballotPlanCount.value : 0);
const effectiveBallotViewMode = computed(() => isHydrated.value ? ballotViewMode.value : "quick");
const effectiveCompareList = computed(() => isHydrated.value ? compareList.value : []);
const effectiveSelectedIssues = computed(() => isHydrated.value ? selectedIssues.value : []);
const hasContestContent = computed(() => Boolean(data.value?.election.contests.length));
const shellOnlyGuideNote = computed(() => data.value?.guideContent?.summary
	?? "Official election links are current for this area. Verified contest, candidate, and measure pages are still under local review.");

watchEffect(() => {
	if (data.value) {
		civicStore.setGuideSurfaceContext({
			date: data.value.election.date,
			jurisdictionSlug: data.value.election.jurisdictionSlug,
			locationName: data.value.election.locationName,
			name: data.value.election.name,
			slug: data.value.election.slug,
			updatedAt: data.value.election.updatedAt,
		}, data.value.location, data.value.guideContent);
	}
});

usePageSeo({
	description: data.value?.election.description ?? "Review the ballot, candidates, measures, and attached sources.",
	canonicalPath: `/elections/${ballotSlug.value}`,
	path: `/ballot/${ballotSlug.value}`,
	robots: "noindex,follow",
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

					const matchesIssue = !effectiveSelectedIssues.value.length
						|| candidate.topIssues.some(issue => effectiveSelectedIssues.value.includes(issue.slug));

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

const filteredCandidateContests = computed(() => filteredContests.value.filter(contest => contest.type === "candidate"));
const filteredMeasureContests = computed(() => filteredContests.value.filter(contest => contest.type === "measure"));

const compareHref = computed(() => buildCompareRoute(effectiveCompareList.value));
const planHref = computed(() => ({
	path: "/plan",
	query: {
		election: ballotSlug.value
	}
}));

const ballotCounts = computed(() => {
	if (!data.value) {
		return {
			candidateCount: 0,
			contestCount: 0,
			measureCount: 0,
			sourceLinkedItems: 0
		};
	}

	return data.value.election.contests.reduce((counts, contest) => ({
		candidateCount: counts.candidateCount + (contest.candidates?.length ?? 0),
		contestCount: counts.contestCount + 1,
		measureCount: counts.measureCount + (contest.measures?.length ?? 0),
		sourceLinkedItems: counts.sourceLinkedItems
			+ (contest.candidates?.length ?? 0)
			+ (contest.measures?.length ?? 0)
	}), {
		candidateCount: 0,
		contestCount: 0,
		measureCount: 0,
		sourceLinkedItems: 0
	});
});
const personalizationLabel = computed(() => data.value?.location.lookupInput ?? data.value?.location.displayName ?? "");
const personalizationNote = computed(() => {
	if (!data.value)
		return "Use a full address for the most specific district match.";

	if (data.value.location.lookupMode === "zip-preview")
		return "ZIP-only preview. Confirm district-specific contests in the official election tools.";

	if (data.value.location.lookupMode === "address-verified")
		return "Official provider accepted this address. Ballot Clarity still opens the current guide surface until exact contest packaging is live.";

	if (data.value.location.lookupMode === "address-submitted")
		return "Full address submitted. Official verification is still recommended until exact ballot matching is live.";

	return "Use a full address for the most specific district match.";
});
const coverageNotes = computed(() => {
	if (!data.value)
		return [];

	if (!hasContestContent.value) {
		return [
			`This overview is personalized to ${personalizationLabel.value}. ${personalizationNote.value}`,
			shellOnlyGuideNote.value,
			`${data.value.election.officialResources.length} official link${data.value.election.officialResources.length === 1 ? "" : "s"} are attached for election logistics, notices, and office contact details.`,
			`${data.value.election.keyDates.length} key date${data.value.election.keyDates.length === 1 ? "" : "s"} are attached for deadlines and election logistics.`,
			"Verified contest, candidate, and measure pages will appear here after the local review clears."
		];
	}

	return [
		`This ballot is personalized to ${personalizationLabel.value}. ${personalizationNote.value}`,
		...(data.value.guideContent ? [data.value.guideContent.summary] : []),
		`${data.value.election.officialResources.length} official links are attached for election logistics, notices, and office contact details.`,
		`${ballotCounts.value.sourceLinkedItems} contest items in this guide link to attached source records or supporting notes.`,
		`${effectiveBallotPlanCount.value} contest${effectiveBallotPlanCount.value === 1 ? "" : "s"} saved to your ballot plan so far.`,
		"Time-sensitive deadlines, polling logistics, and late campaign activity should still be verified in official election-office notices."
	];
});
const ballotContentsGroups = computed(() => {
	const contests = filteredContests.value.map(contest => ({
		countLabel: contest.type === "candidate"
			? `${contest.candidates?.length ?? 0} candidate${contest.candidates?.length === 1 ? "" : "s"}`
			: `${contest.measures?.length ?? 0} measure${contest.measures?.length === 1 ? "" : "s"}`,
		href: `#${contest.slug}`,
		// Measure contests share a generic office label ("County Ballot Measure"); the measure title tells them apart.
		label: contest.type === "measure" && contest.measures?.length === 1
			? contest.measures?.[0]?.title ?? contest.office
			: contest.office,
		meta: contest.jurisdiction,
		saved: Boolean(effectiveBallotPlan.value[contest.slug]),
		slug: contest.slug,
		type: contest.type
	}));

	return [
		{
			items: contests.filter(contest => contest.type === "candidate"),
			label: "Races"
		},
		{
			items: contests.filter(contest => contest.type === "measure"),
			label: "Ballot measures"
		}
	].filter(group => group.items.length);
});

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
			:guide-content="data.guideContent"
			:location="data.location"
			:note="data.note"
		/>

		<section v-if="data && hasContestContent" class="print-only app-shell">
			<div class="print-guide">
				<header class="print-guide-header">
					<p class="print-guide-kicker">
						Ballot Clarity print guide
					</p>
					<h1 class="text-4xl font-serif mt-3">
						{{ data.election.name }}
					</h1>
					<p class="text-sm mt-3">
						{{ data.location.displayName }} · {{ formatDate(data.election.date) }}
					</p>
					<p class="text-sm mt-4">
						What appears on this ballot? This print view keeps each contest in a short, source-aware guide. Use official election office notices for final deadlines, locations, and ballot-return rules.
					</p>
				</header>

				<div class="print-guide-grid mt-6">
					<article v-for="contest in filteredContests" :key="contest.slug" class="print-guide-card">
						<p class="text-xs tracking-[0.2em] font-semibold uppercase">
							{{ contest.office }}
						</p>
						<p class="text-sm mt-2">
							{{ contest.jurisdiction }}
						</p>
						<p class="text-sm mt-3">
							{{ contest.roleGuide.whyItMatters }}
						</p>

						<ul v-if="contest.type === 'candidate'" class="print-guide-list">
							<li v-for="candidate in contest.candidates" :key="candidate.slug">
								<strong>{{ candidate.name }}</strong>
								<span>{{ candidate.party }}<span v-if="candidate.incumbent"> · Incumbent</span></span>
								<span>{{ candidate.ballotSummary }}</span>
							</li>
						</ul>

						<div v-else class="print-guide-list">
							<div v-for="measure in contest.measures" :key="measure.slug">
								<strong>{{ measure.title }}</strong>
								<p class="mt-2">
									{{ measure.plainLanguageExplanation }}
								</p>
								<p class="mt-2">
									<strong>YES:</strong> {{ measure.yesMeaning }}
								</p>
								<p class="mt-1">
									<strong>NO:</strong> {{ measure.noMeaning }}
								</p>
							</div>
						</div>
					</article>
				</div>

				<p class="print-guide-footnote">
					Review original records and official notices before relying on any election information.
				</p>
			</div>
		</section>

		<section v-if="data && !hasContestContent" class="app-shell print-hidden">
			<div class="mx-auto max-w-5xl space-y-6">
				<section id="guide-overview" class="surface-panel scroll-mt-28">
					<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
						Election overview
					</p>
					<h2 class="text-3xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
						Official links are live for this area
					</h2>
					<p class="text-sm text-app-muted leading-7 mt-4 max-w-3xl dark:text-app-muted-dark">
						This page is personalized to {{ personalizationLabel }}. Official links and key dates are current here, while verified contest, candidate, and measure pages are still under local review.
					</p>
					<InfoCallout title="Verified contest pages pending" tone="warning" class="mt-6">
						Use the official links and key dates below for logistics and deadline checks. Contest, candidate, and measure pages open after the local package is verified.
					</InfoCallout>
				</section>

				<BallotLogisticsPanel
					:election="data.election"
					:has-contest-content="false"
				/>
			</div>
		</section>

		<section v-if="data && hasContestContent" class="app-shell print-hidden">
			<div class="ballot-layout">
				<aside v-if="ballotContentsGroups.length" class="ballot-layout__toc">
					<nav aria-label="On this ballot" class="ballot-toc">
						<p class="ballot-toc__title">
							On this ballot
						</p>
						<div v-for="group in ballotContentsGroups" :key="group.label" class="ballot-toc__group">
							<p class="ballot-toc__group-label">
								{{ group.label }}
							</p>
							<ol class="ballot-toc__list">
								<li v-for="item in group.items" :key="item.slug">
									<SafeExternalLink
										:href="item.href"
										:new-tab="false"
										class="ballot-toc__link focus-ring"
									>
										<span class="ballot-toc__label">{{ item.label }}</span>
										<span class="ballot-toc__meta">
											{{ item.countLabel }}
											<span v-if="item.saved" class="ballot-toc__saved">
												<span class="i-carbon-checkmark" aria-hidden="true" />
												Saved
											</span>
										</span>
									</SafeExternalLink>
								</li>
							</ol>
						</div>
						<div class="ballot-toc__footer">
							<NuxtLink :to="planHref" class="btn-primary">
								Open my ballot plan
							</NuxtLink>
							<a href="#guide-logistics" class="primary-link focus-ring">Key dates and official links</a>
						</div>
					</nav>
				</aside>

				<div class="ballot-layout__main">
					<section id="guide-controls" class="ballot-controls scroll-mt-28">
						<label for="ballot-search" class="text-sm text-app-ink font-semibold dark:text-app-text-dark">
							Search this ballot
						</label>
						<div class="mt-2 relative">
							<span class="i-carbon-search text-app-muted pointer-events-none left-4 top-1/2 absolute dark:text-app-muted-dark -translate-y-1/2" />
							<input
								id="ballot-search"
								v-model="searchQuery"
								type="search"
								placeholder="Search candidates, measures, or issues"
								class="text-sm text-app-ink pl-11 pr-4 border border-app-line rounded-full bg-white h-[3.25rem] w-full dark:text-app-text-dark placeholder:text-app-muted dark:border-app-line-dark dark:bg-app-panel-dark focus-ring dark:placeholder:text-app-muted-dark"
							>
						</div>

						<details v-if="issueOptions.length" class="ballot-controls__filters" :open="effectiveSelectedIssues.length > 0">
							<summary class="ballot-controls__filters-summary focus-ring">
								Filter by issue
								<span v-if="effectiveSelectedIssues.length" class="ballot-controls__count">{{ effectiveSelectedIssues.length }} selected</span>
							</summary>
							<div class="mt-3 flex flex-wrap gap-2">
								<button
									v-for="issue in issueOptions"
									:key="issue.slug"
									type="button"
									class="text-xs font-semibold px-3 py-2 border rounded-full transition focus-ring"
									:class="effectiveSelectedIssues.includes(issue.slug)
										? 'border-app-accent bg-app-accent text-app-action-text'
										: 'border-app-line bg-white text-app-muted hover:border-app-accent hover:text-app-accent dark:border-app-line-dark dark:bg-app-panel-dark dark:text-app-muted-dark'"
									:aria-pressed="effectiveSelectedIssues.includes(issue.slug)"
									@click="civicStore.toggleIssue(issue.slug)"
								>
									<span v-if="effectiveSelectedIssues.includes(issue.slug)" class="i-carbon-checkmark mr-1" aria-hidden="true" />
									{{ issue.label }}
								</button>
							</div>
							<button
								v-if="effectiveSelectedIssues.length || searchQuery"
								type="button"
								class="text-sm text-app-accent font-semibold mt-3 rounded-full focus-ring"
								@click="clearFilters"
							>
								Clear filters
							</button>
						</details>
					</section>

					<div v-if="pending" class="space-y-6">
						<div v-for="index in 3" :key="index" class="surface-panel animate-pulse">
							<div class="rounded-full bg-app-line/70 h-6 w-48 dark:bg-app-line-dark" />
							<div class="mt-4 rounded-full bg-app-line/60 h-4 w-full dark:bg-app-line-dark" />
							<div class="mt-2 rounded-full bg-app-line/60 h-4 w-3/4 dark:bg-app-line-dark" />
						</div>
					</div>

					<InfoCallout v-else-if="error" title="Unable to load ballot" tone="warning">
						The ballot guide could not be loaded. Refresh the page or return to the home page and try again.
					</InfoCallout>

					<div v-else-if="filteredContests.length" id="contests-section" class="space-y-10">
						<div v-if="filteredCandidateContests.length" id="candidate-contests-section" class="scroll-mt-28 space-y-5">
							<h2 class="ballot-group-heading font-serif">
								Races
								<span class="ballot-group-heading__count">{{ filteredCandidateContests.length }}</span>
							</h2>
							<ContestSection
								v-for="(contest, index) in filteredCandidateContests"
								:key="contest.slug"
								:contest="contest"
								:open="index === 0"
								:view-mode="effectiveBallotViewMode"
							/>
						</div>

						<div v-if="filteredMeasureContests.length" id="measure-contests-section" class="scroll-mt-28 space-y-5">
							<h2 class="ballot-group-heading font-serif">
								Ballot measures
								<span class="ballot-group-heading__count">{{ filteredMeasureContests.length }}</span>
							</h2>
							<ContestSection
								v-for="(contest, index) in filteredMeasureContests"
								:key="contest.slug"
								:contest="contest"
								:open="index === 0 && !filteredCandidateContests.length"
								:view-mode="effectiveBallotViewMode"
							/>
						</div>
					</div>

					<div v-else class="surface-panel text-center">
						<h2 class="text-3xl text-app-ink font-serif dark:text-app-text-dark">
							No ballot items match the current filters.
						</h2>
						<p class="text-sm text-app-muted leading-7 mx-auto mt-4 max-w-2xl dark:text-app-muted-dark">
							Try clearing the search field or removing selected issues to restore the full ballot guide.
						</p>
						<button type="button" class="btn-primary mt-6" @click="clearFilters">
							Clear filters
						</button>
					</div>

					<BallotLogisticsPanel
						:election="data.election"
						:has-contest-content="true"
					/>

					<details class="surface-row">
						<summary class="text-sm text-app-ink font-semibold cursor-pointer dark:text-app-text-dark focus-ring">
							Coverage notes and limits
						</summary>
						<ul class="text-sm text-app-muted leading-7 mt-4 space-y-2 dark:text-app-muted-dark">
							<li v-for="item in coverageNotes" :key="item">
								{{ item }}
							</li>
						</ul>
					</details>
				</div>
			</div>
		</section>

		<section v-if="!data && pending" class="app-shell space-y-6">
			<div v-for="index in 3" :key="index" class="surface-panel animate-pulse">
				<div class="rounded-full bg-app-line/70 h-6 w-48 dark:bg-app-line-dark" />
				<div class="mt-4 rounded-full bg-app-line/60 h-4 w-full dark:bg-app-line-dark" />
				<div class="mt-2 rounded-full bg-app-line/60 h-4 w-3/4 dark:bg-app-line-dark" />
			</div>
		</section>

		<section v-else-if="!data && error" class="app-shell">
			<InfoCallout title="Unable to load ballot" tone="warning">
				The ballot guide could not be loaded. Refresh the page or return to the home page and try again.
			</InfoCallout>
		</section>

		<section
			v-if="effectiveCompareList.length || effectiveBallotPlanCount"
			class="px-4 bottom-4 left-0 right-0 fixed z-30 print-hidden"
		>
			<div class="mx-auto px-5 py-4 border border-app-line rounded-[1.75rem] bg-white flex flex-col gap-3 max-w-4xl w-full shadow-[0_24px_50px_-36px_rgba(16,37,62,0.7)] dark:border-app-line-dark dark:bg-app-panel-dark sm:flex-row sm:items-center sm:justify-between">
				<div>
					<p class="text-sm text-app-ink font-semibold dark:text-app-text-dark">
						{{ effectiveBallotPlanCount }} contest{{ effectiveBallotPlanCount === 1 ? "" : "s" }} saved · {{ effectiveCompareList.length }} candidate{{ effectiveCompareList.length === 1 ? "" : "s" }} in compare
					</p>
					<p class="text-xs text-app-muted mt-1 dark:text-app-muted-dark">
						Save a choice to your plan as you go, or compare 2 to 3 candidates from the same contest before deciding.
					</p>
				</div>
				<div class="flex flex-wrap gap-3">
					<NuxtLink :to="planHref" class="btn-secondary">
						Open ballot plan
					</NuxtLink>
					<NuxtLink :to="compareHref" class="btn-primary" :class="{ 'opacity-60 pointer-events-none': effectiveCompareList.length < 2 }">
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
