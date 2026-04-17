<script setup lang="ts">
import type { Contest } from "~/types/civic";
import { storeToRefs } from "pinia";
import { buildCompareRoute } from "~/stores/civic";

const civicStore = useCivicStore();
const route = useRoute();
const { formatDate, formatDateTime } = useFormatters();
const { ballotPlan, ballotPlanCount, ballotViewMode, compareList, isHydrated, selectedIssues } = storeToRefs(civicStore);

const ballotSlug = computed(() => String(route.params.slug));
const locationSlug = computed(() => typeof route.query.location === "string" ? route.query.location : undefined);

const { data, error, pending } = await useBallot(ballotSlug, locationSlug);
const effectiveBallotPlan = computed(() => isHydrated.value ? ballotPlan.value : {});
const effectiveBallotPlanCount = computed(() => isHydrated.value ? ballotPlanCount.value : 0);
const effectiveBallotViewMode = computed(() => isHydrated.value ? ballotViewMode.value : "quick");
const effectiveCompareList = computed(() => isHydrated.value ? compareList.value : []);
const effectiveSelectedIssues = computed(() => isHydrated.value ? selectedIssues.value : []);

watchEffect(() => {
	if (data.value) {
		civicStore.setElection({
			date: data.value.election.date,
			jurisdictionSlug: data.value.election.jurisdictionSlug,
			locationName: data.value.election.locationName,
			name: data.value.election.name,
			slug: data.value.election.slug,
			updatedAt: data.value.election.updatedAt,
		});
		civicStore.setLocation(data.value.location);
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

const electionOverviewHref = computed(() => data.value ? `/elections/${data.value.election.slug}` : "/ballot");
const jurisdictionHref = computed(() => data.value ? `/locations/${data.value.election.jurisdictionSlug}` : "/");
const ballotBreadcrumbs = computed(() => {
	if (!data.value) {
		return [
			{ label: "Home", to: "/" },
			{ label: "Ballot guide" }
		];
	}

	return [
		{ label: "Home", to: "/" },
		{ label: "Election overview", to: electionOverviewHref.value },
		{ label: "Ballot guide" }
	];
});
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
const guideSummaryItems = computed(() => ([
	{
		label: "Personalized to",
		note: "Full address gives the most specific district match.",
		value: personalizationLabel.value
	},
	{
		label: "Contests",
		note: "Total sections in this ballot guide.",
		value: ballotCounts.value.contestCount
	},
	{
		label: "Candidates",
		note: "Candidate profiles linked from this ballot.",
		value: ballotCounts.value.candidateCount
	},
	{
		label: "Measures",
		note: "Measure explainers with yes / no summaries.",
		value: ballotCounts.value.measureCount
	},
	{
		label: "Saved to plan",
		note: "Contests currently saved in your checklist.",
		value: effectiveBallotPlanCount.value
	}
]));
const coverageNotes = computed(() => {
	if (!data.value)
		return [];

	return [
		`This ballot is personalized to ${personalizationLabel.value}. Use a full street address for the most specific district match.`,
		`${data.value.election.officialResources.length} official links are attached for election logistics, notices, and office contact details.`,
		`${ballotCounts.value.sourceLinkedItems} contest items in this guide link to source drawers or evidence panels in the project archive.`,
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
		label: contest.office,
		meta: contest.jurisdiction,
		saved: Boolean(effectiveBallotPlan.value[contest.slug]),
		slug: contest.slug,
		type: contest.type
	}));

	return [
		{
			items: contests.filter(contest => contest.type === "candidate"),
			label: "Offices and races"
		},
		{
			items: contests.filter(contest => contest.type === "measure"),
			label: "Ballot measures"
		}
	].filter(group => group.items.length);
});
const guideSectionItems = computed(() => ([
	{
		href: "#guide-overview",
		label: "Ballot at a glance",
		note: "Coverage notes and top-level counts."
	},
	{
		href: "#guide-logistics",
		label: "Key dates and official links",
		note: "Official notices, deadlines, and recent updates."
	},
	{
		href: "#guide-controls",
		label: "Reading mode and filters",
		note: "Search, issue filters, and quick vs deep view."
	},
	...(filteredCandidateContests.value.length
		? [{
				badge: String(filteredCandidateContests.value.length),
				href: "#candidate-contests-section",
				label: "Candidate contests",
				note: "Races with candidate profiles."
			}]
		: []),
	...(filteredMeasureContests.value.length
		? [{
				badge: String(filteredMeasureContests.value.length),
				href: "#measure-contests-section",
				label: "Ballot measures",
				note: "Questions and measures on this ballot."
			}]
		: [])
]));

const ballotMethodItems = [
	{
		body: [
			"This ballot guide uses the current election object, attached official-resource files, and contest-level source records linked from each candidate and measure card.",
			"Official logistics should still be verified in the election overview and jurisdiction pages."
		],
		label: "Sources"
	},
	{
		body: [
			"This page is designed as a reading surface for contests, not as the primary search landing page.",
			"Candidate and measure summaries keep source drawers visible so users can inspect the records behind each explanation."
		],
		label: "Processing"
	},
	{
		body: [
			"Election logistics can change close to Election Day, so time-sensitive details should be checked against official county notices.",
			"Late campaign activity and post-publication changes may not yet appear in the ballot guide view."
		],
		label: "Limits"
	}
];

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

		<section v-if="data" class="app-shell print-hidden">
			<FreshnessStrip :change-log="data.election.changeLog" :freshness="data.election.freshness" title="Guide freshness and review status" />
		</section>

		<section v-if="data" class="app-shell print-hidden">
			<AppBreadcrumbs :items="ballotBreadcrumbs" />
		</section>

		<section v-if="data" class="print-only app-shell">
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
					Current coverage uses a limited public-record archive. Review original records and official notices before relying on any election information.
				</p>
			</div>
		</section>

		<section v-if="data" class="app-shell print-hidden">
			<div class="gap-6 grid xl:grid-cols-[minmax(17rem,0.62fr)_minmax(0,1.38fr)]">
				<div class="self-start space-y-4 xl:top-24 xl:sticky">
					<PageSectionNav
						title="Guide map"
						description="Start with the overview, then use filters and contest sections only where you need more detail."
						:items="guideSectionItems"
					>
						<template #actions>
							<div class="flex flex-wrap gap-2">
								<NuxtLink :to="planHref" class="btn-primary">
									Open my ballot plan
								</NuxtLink>
								<NuxtLink :to="electionOverviewHref" class="btn-secondary">
									Election overview
								</NuxtLink>
								<NuxtLink :to="jurisdictionHref" class="btn-secondary">
									Location hub
								</NuxtLink>
							</div>
						</template>
					</PageSectionNav>

					<nav
						v-if="ballotContentsGroups.length"
						aria-label="Ballot contents"
						class="surface-panel"
					>
						<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
							Ballot contents
						</p>
						<p class="text-sm text-app-muted leading-7 mt-3 dark:text-app-muted-dark">
							Use this page like a table of contents. Saved contests stay marked so you can see what still needs attention.
						</p>

						<div v-for="group in ballotContentsGroups" :key="group.label" class="mt-5">
							<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
								{{ group.label }}
							</p>
							<ol class="mt-3 space-y-2">
								<li v-for="item in group.items" :key="item.slug">
									<a
										:href="item.href"
										class="p-3 border border-app-line/80 rounded-[1.15rem] bg-app-bg/55 flex gap-3 transition items-start justify-between dark:border-app-line-dark hover:border-app-accent/60 dark:bg-app-bg-dark/70 focus-ring"
									>
										<div class="min-w-0">
											<p class="text-sm text-app-ink font-semibold dark:text-app-text-dark">
												{{ item.label }}
											</p>
											<p class="text-xs text-app-muted leading-6 mt-1 dark:text-app-muted-dark">
												{{ item.meta }}
											</p>
										</div>
										<div class="text-right flex flex-col gap-2 items-end">
											<span class="text-[11px] text-app-muted font-semibold px-2.5 py-1 rounded-full bg-white whitespace-nowrap dark:text-app-muted-dark dark:bg-app-panel-dark">
												{{ item.countLabel }}
											</span>
											<span
												class="text-[11px] font-semibold px-2.5 py-1 rounded-full inline-flex gap-1 whitespace-nowrap items-center"
												:class="item.saved
													? 'bg-app-accent text-white'
													: 'bg-app-warm/75 text-app-ink dark:bg-app-bg-dark dark:text-app-text-dark'"
											>
												<span :class="item.saved ? 'i-carbon-checkmark' : 'i-carbon-time'" aria-hidden="true" />
												{{ item.saved ? "Saved" : "Open" }}
											</span>
										</div>
									</a>
								</li>
							</ol>
						</div>
					</nav>
				</div>

				<div class="space-y-6">
					<section id="guide-overview" class="surface-panel scroll-mt-28">
						<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
							Ballot at a glance
						</p>
						<h2 class="text-3xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
							Showing contests for your districts
						</h2>
						<p class="text-sm text-app-muted leading-7 mt-4 max-w-3xl dark:text-app-muted-dark">
							This guide is personalized to {{ personalizationLabel }}. It is designed to reduce overload, but district matching and time-sensitive logistics should still be checked against the official election overview.
						</p>

						<div class="mt-6">
							<PageSummaryStrip :items="guideSummaryItems" />
						</div>

						<div class="mt-6 gap-5 grid lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
							<div class="p-5 rounded-[1.5rem] bg-app-bg dark:bg-app-bg-dark/70">
								<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
									Coverage and certainty
								</p>
								<ul class="text-sm text-app-muted leading-7 mt-4 space-y-2 dark:text-app-muted-dark">
									<li v-for="item in coverageNotes" :key="item">
										{{ item }}
									</li>
								</ul>
							</div>
							<div class="space-y-4">
								<InfoCallout title="Why we ask for your address">
									A full address helps determine districts and ballot style. ZIP-only lookups can be useful for a quick preview, but they may not reflect every district-specific contest.
								</InfoCallout>
								<InfoCallout title="Build a booth-ready plan">
									Save one choice per contest as you read. The
									<NuxtLink :to="planHref" class="underline underline-offset-3">
										ballot plan page
									</NuxtLink>
									keeps your current picks in a print-friendly checklist.
								</InfoCallout>
								<InfoCallout title="Need a page reviewed?">
									Use the <NuxtLink to="/contact" class="underline underline-offset-3">
										contact page
									</NuxtLink> if a ballot item looks incomplete, inaccurate, or unevenly framed.
								</InfoCallout>
							</div>
						</div>
					</section>

					<section id="guide-logistics" class="surface-panel scroll-mt-28">
						<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
							Key dates and official links
						</p>
						<h2 class="text-3xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
							Use the ballot guide with the election overview
						</h2>
						<div class="mt-6 gap-4 grid md:grid-cols-2 xl:grid-cols-4">
							<div v-for="item in data.election.keyDates" :key="item.label" class="p-4 rounded-2xl bg-app-bg dark:bg-app-bg-dark/70">
								<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
									{{ item.label }}
								</p>
								<p class="text-sm text-app-ink font-semibold mt-3 dark:text-app-text-dark">
									{{ item.date.includes("T") ? formatDateTime(item.date) : formatDate(item.date) }}
								</p>
								<p class="text-xs text-app-muted leading-6 mt-2 dark:text-app-muted-dark">
									{{ item.note || "Review the official notice for details." }}
								</p>
							</div>
						</div>
						<div class="mt-6 gap-5 grid lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
							<OfficialResourceList
								:resources="data.election.officialResources"
								title="Official notices linked in this guide"
								note="The printable ballot guide is useful for reading contests. Use the official notices for time-sensitive logistics."
							/>
							<div class="space-y-4">
								<div class="p-5 rounded-[1.5rem] bg-app-bg dark:bg-app-bg-dark/70">
									<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
										Recent updates
									</p>
									<ul class="mt-4 space-y-3">
										<li v-for="entry in data.election.changeLog" :key="entry.id" class="text-sm text-app-muted leading-7 dark:text-app-muted-dark">
											<span class="text-app-ink font-semibold dark:text-app-text-dark">{{ formatDateTime(entry.date) }}</span>
											<span class="text-app-line mx-2 dark:text-app-line-dark">·</span>
											{{ entry.summary }}
										</li>
									</ul>
								</div>
								<MethodologySummaryCard
									:items="ballotMethodItems"
									summary="This ballot page foregrounds freshness, official links, and contest-level evidence so the voter can verify details without leaving the guide."
									title="How this ballot guide is built"
								/>
							</div>
						</div>
					</section>

					<section id="guide-controls" class="surface-panel scroll-mt-28">
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
										:class="effectiveSelectedIssues.includes(issue.slug)
											? 'border-app-accent bg-app-accent text-white'
											: 'border-app-line bg-white text-app-muted hover:border-app-accent hover:text-app-accent dark:border-app-line-dark dark:bg-app-panel-dark dark:text-app-muted-dark'"
										:aria-pressed="effectiveSelectedIssues.includes(issue.slug)"
										@click="civicStore.toggleIssue(issue.slug)"
									>
										<span v-if="effectiveSelectedIssues.includes(issue.slug)" class="i-carbon-checkmark mr-1" aria-hidden="true" />
										{{ issue.label }}
									</button>
								</div>
							</div>
						</div>

						<div class="mt-6 gap-5 grid lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
							<div>
								<p class="text-sm text-app-ink font-semibold dark:text-app-text-dark">
									Reading mode
								</p>
								<p class="text-sm text-app-muted leading-7 mt-2 dark:text-app-muted-dark">
									Quick view reduces overload for first-pass reading. Deep view keeps funding, action highlights, and longer context visible on each card.
								</p>
								<div class="mt-4 flex flex-wrap gap-2">
									<button
										type="button"
										class="text-xs font-semibold px-3 py-2 border rounded-full transition focus-ring"
										:class="effectiveBallotViewMode === 'quick'
											? 'border-app-accent bg-app-accent text-white'
											: 'border-app-line bg-white text-app-muted hover:border-app-accent hover:text-app-accent dark:border-app-line-dark dark:bg-app-panel-dark dark:text-app-muted-dark'"
										:aria-pressed="effectiveBallotViewMode === 'quick'"
										@click="civicStore.setBallotViewMode('quick')"
									>
										<span v-if="effectiveBallotViewMode === 'quick'" class="i-carbon-checkmark mr-1" aria-hidden="true" />
										Quick view
									</button>
									<button
										type="button"
										class="text-xs font-semibold px-3 py-2 border rounded-full transition focus-ring"
										:class="effectiveBallotViewMode === 'deep'
											? 'border-app-accent bg-app-accent text-white'
											: 'border-app-line bg-white text-app-muted hover:border-app-accent hover:text-app-accent dark:border-app-line-dark dark:bg-app-panel-dark dark:text-app-muted-dark'"
										:aria-pressed="effectiveBallotViewMode === 'deep'"
										@click="civicStore.setBallotViewMode('deep')"
									>
										<span v-if="effectiveBallotViewMode === 'deep'" class="i-carbon-checkmark mr-1" aria-hidden="true" />
										Deep view
									</button>
									<NuxtLink to="/accessibility" class="btn-secondary">
										Accessibility and print standards
									</NuxtLink>
									<NuxtLink :to="planHref" class="btn-secondary">
										{{ effectiveBallotPlanCount ? `Open plan (${effectiveBallotPlanCount})` : "Open plan" }}
									</NuxtLink>
								</div>
							</div>

							<InfoCallout title="Questions to ask before you vote">
								<ul class="space-y-2">
									<li>What is directly documented here, and what still requires checking an original record?</li>
									<li>Which issues matter most in this contest, and what evidence is attached to each summary?</li>
									<li>What might change if the measure passes or fails, and who would carry the cost or benefit?</li>
								</ul>
							</InfoCallout>
						</div>
					</section>
				</div>
			</div>
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
				The ballot guide could not be loaded. Refresh the page or return to the home page and try again.
			</InfoCallout>
		</section>

		<section v-else-if="filteredContests.length" id="contests-section" class="app-shell space-y-10">
			<div v-if="filteredCandidateContests.length" id="candidate-contests-section" class="scroll-mt-28 space-y-6">
				<div class="surface-panel">
					<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
						Candidate contests
					</p>
					<h2 class="text-3xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
						Races with candidate profiles
					</h2>
					<p class="text-sm text-app-muted leading-7 mt-4 dark:text-app-muted-dark">
						These sections group the offices on your ballot where voters are choosing between candidates. Each card links out to deeper profiles when available.
					</p>
				</div>
				<ContestSection
					v-for="(contest, index) in filteredCandidateContests"
					:key="contest.slug"
					:contest="contest"
					:open="index === 0"
					:view-mode="effectiveBallotViewMode"
				/>
			</div>

			<div v-if="filteredMeasureContests.length" id="measure-contests-section" class="scroll-mt-28 space-y-6">
				<div class="surface-panel">
					<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
						Ballot measures
					</p>
					<h2 class="text-3xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
						Questions and measures on this ballot
					</h2>
					<p class="text-sm text-app-muted leading-7 mt-4 dark:text-app-muted-dark">
						These sections explain what each measure would do, what a yes or no vote means, and which source records are attached to the summary.
					</p>
				</div>
				<ContestSection
					v-for="(contest, index) in filteredMeasureContests"
					:key="contest.slug"
					:contest="contest"
					:open="index === 0 && !filteredCandidateContests.length"
					:view-mode="effectiveBallotViewMode"
				/>
			</div>
		</section>

		<section v-else class="app-shell">
			<div class="surface-panel text-center">
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
