<script setup lang="ts">
import type { Contest } from "~/types/civic";
import { storeToRefs } from "pinia";

const civicStore = useCivicStore();
const route = useRoute();
const { formatDate, formatDateTime } = useFormatters();
const { ballotPlan, ballotPlanCount, ballotViewMode, compareList, selectedIssues } = storeToRefs(civicStore);

const ballotSlug = computed(() => String(route.params.slug));
const locationSlug = computed(() => typeof route.query.location === "string" ? route.query.location : undefined);

const { data, error, pending } = await useBallot(ballotSlug, locationSlug);

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
	description: data.value?.election.description ?? "Review the sample ballot, candidates, measures, and attached sources.",
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
const coverageNotes = computed(() => {
	if (!data.value)
		return [];

	return [
		`This ballot is personalized to ${personalizationLabel.value}. Use a full street address for the most specific district match.`,
		`${data.value.election.officialResources.length} official links are attached for election logistics, notices, and office contact details.`,
		`${ballotCounts.value.sourceLinkedItems} contest items in this guide link to source drawers or evidence panels in the demo archive.`,
		`${ballotPlanCount.value} contest${ballotPlanCount.value === 1 ? "" : "s"} saved to your ballot plan so far.`,
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
		saved: Boolean(ballotPlan.value[contest.slug]),
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

const ballotMethodItems = [
	{
		body: [
			"This ballot guide uses the demo election object, attached official-resource files, and contest-level source records linked from each candidate and measure card.",
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
						Ballot Clarity demo print guide
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
					Demo data. Review original records and official notices before relying on any election information.
				</p>
			</div>
		</section>

		<section v-if="data" class="app-shell print-hidden">
			<div class="surface-panel">
				<div class="flex flex-wrap gap-4 items-start justify-between">
					<div>
						<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
							Ballot at a glance
						</p>
						<h2 class="text-3xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
							Showing contests for your districts
						</h2>
						<p class="text-sm text-app-muted leading-7 mt-4 max-w-3xl dark:text-app-muted-dark">
							This guide is personalized to {{ personalizationLabel }}. It is designed to reduce overload, but district matching and time-sensitive logistics should still be checked against the official election overview.
						</p>
					</div>
					<div class="flex flex-wrap gap-3">
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
				</div>
				<div class="mt-6 gap-4 grid md:grid-cols-3 xl:grid-cols-4">
					<div class="px-5 py-5 rounded-3xl bg-app-bg dark:bg-app-bg-dark/70">
						<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
							Personalized to
						</p>
						<p class="text-sm text-app-ink font-semibold mt-3 dark:text-app-text-dark">
							{{ personalizationLabel }}
						</p>
						<p class="text-xs text-app-muted leading-6 mt-2 dark:text-app-muted-dark">
							Use a full address for the most specific result.
						</p>
					</div>
					<div class="px-5 py-5 rounded-3xl bg-app-bg dark:bg-app-bg-dark/70">
						<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
							Contests
						</p>
						<p class="text-3xl text-app-ink font-semibold mt-3 dark:text-app-text-dark">
							{{ ballotCounts.contestCount }}
						</p>
						<p class="text-xs text-app-muted leading-6 mt-2 dark:text-app-muted-dark">
							Total contest sections in this ballot guide.
						</p>
					</div>
					<div class="px-5 py-5 rounded-3xl bg-app-bg dark:bg-app-bg-dark/70">
						<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
							Candidates
						</p>
						<p class="text-3xl text-app-ink font-semibold mt-3 dark:text-app-text-dark">
							{{ ballotCounts.candidateCount }}
						</p>
						<p class="text-xs text-app-muted leading-6 mt-2 dark:text-app-muted-dark">
							Candidate profiles linked from this ballot.
						</p>
					</div>
					<div class="px-5 py-5 rounded-3xl bg-app-bg dark:bg-app-bg-dark/70">
						<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
							Measures
						</p>
						<p class="text-3xl text-app-ink font-semibold mt-3 dark:text-app-text-dark">
							{{ ballotCounts.measureCount }}
						</p>
						<p class="text-xs text-app-muted leading-6 mt-2 dark:text-app-muted-dark">
							Measure explainers with yes/no summaries and sources.
						</p>
					</div>
				</div>
				<div class="mt-6 gap-4 grid lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
					<InfoCallout title="Coverage and certainty">
						<ul class="space-y-2">
							<li v-for="item in coverageNotes" :key="item">
								{{ item }}
							</li>
						</ul>
					</InfoCallout>
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
			</div>
		</section>

		<section class="app-shell print-hidden">
			<div v-if="data" class="gap-6 grid xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
				<div class="surface-panel">
					<div class="flex flex-wrap gap-4 items-center justify-between">
						<div>
							<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
								Key dates and official links
							</p>
							<h2 class="text-3xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
								Use the ballot guide with the election overview
							</h2>
						</div>
						<div class="flex flex-wrap gap-3">
							<NuxtLink :to="electionOverviewHref" class="btn-secondary">
								Election overview
							</NuxtLink>
							<NuxtLink :to="jurisdictionHref" class="btn-secondary">
								Location hub
							</NuxtLink>
						</div>
					</div>
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
					<div class="mt-6">
						<OfficialResourceList
							:resources="data.election.officialResources"
							title="Official notices linked in this demo"
							note="The printable ballot guide is useful for reading contests. Use the official notices for time-sensitive logistics."
						/>
					</div>
				</div>

				<div class="surface-panel">
					<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
						Recent updates
					</p>
					<p class="text-sm text-app-muted leading-7 mt-3 dark:text-app-muted-dark">
						This guide is intentionally marked as a follow-on reading surface. Search-facing election discovery should start on the overview page, while this view stays focused on contest reading and printing.
					</p>
					<ul class="mt-6 space-y-3">
						<li v-for="entry in data.election.changeLog" :key="entry.id" class="px-4 py-4 rounded-2xl bg-app-bg dark:bg-app-bg-dark/70">
							<p class="text-sm text-app-ink font-semibold dark:text-app-text-dark">
								{{ formatDateTime(entry.date) }}
							</p>
							<p class="text-sm text-app-muted leading-7 mt-2 dark:text-app-muted-dark">
								{{ entry.summary }}
							</p>
						</li>
					</ul>
					<div class="mt-6">
						<MethodologySummaryCard
							:items="ballotMethodItems"
							summary="This ballot page foregrounds freshness, official links, and contest-level evidence so the voter can verify details without leaving the guide."
							title="How this ballot guide is built"
						/>
					</div>
				</div>
			</div>
		</section>

		<section class="app-shell print-hidden">
			<div class="gap-6 grid xl:grid-cols-[minmax(18rem,0.72fr)_minmax(0,1.28fr)]">
				<nav
					v-if="ballotContentsGroups.length"
					aria-label="Ballot contents"
					class="surface-panel self-start xl:top-24 xl:sticky"
				>
					<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
						Ballot contents
					</p>
					<h2 class="text-3xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
						Use this page like a table of contents.
					</h2>
					<p class="text-sm text-app-muted leading-7 mt-4 dark:text-app-muted-dark">
						Start with the contest list, then open detail pages only when you need the full dossier or measure explainer. Saved items stay labeled so you can see what still needs attention.
					</p>

					<div v-for="group in ballotContentsGroups" :key="group.label" class="mt-6">
						<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
							{{ group.label }}
						</p>
						<ol class="mt-3 space-y-2">
							<li v-for="item in group.items" :key="item.slug">
								<a
									:href="item.href"
									class="p-3 border border-app-line/80 rounded-[1.4rem] bg-app-bg/55 flex gap-3 transition items-start justify-between dark:border-app-line-dark hover:border-app-accent/60 dark:bg-app-bg-dark/70 focus-ring"
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

				<div class="space-y-6">
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
										:aria-pressed="selectedIssues.includes(issue.slug)"
										@click="civicStore.toggleIssue(issue.slug)"
									>
										<span v-if="selectedIssues.includes(issue.slug)" class="i-carbon-checkmark mr-1" aria-hidden="true" />
										{{ issue.label }}
									</button>
								</div>
							</div>
						</div>

						<div class="mt-6 gap-4 grid lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
							<div>
								<p class="text-sm text-app-ink font-semibold dark:text-app-text-dark">
									Reading mode
								</p>
								<p class="text-sm text-app-muted leading-7 mt-2 dark:text-app-muted-dark">
									Quick view reduces overload for first-pass reading. Deep view keeps funding, action highlights, and longer context visible on each card.
								</p>
							</div>
							<div class="flex flex-wrap gap-2">
								<button
									type="button"
									class="text-xs font-semibold px-3 py-2 border rounded-full transition focus-ring"
									:class="ballotViewMode === 'quick'
										? 'border-app-accent bg-app-accent text-white'
										: 'border-app-line bg-white text-app-muted hover:border-app-accent hover:text-app-accent dark:border-app-line-dark dark:bg-app-panel-dark dark:text-app-muted-dark'"
									:aria-pressed="ballotViewMode === 'quick'"
									@click="civicStore.setBallotViewMode('quick')"
								>
									<span v-if="ballotViewMode === 'quick'" class="i-carbon-checkmark mr-1" aria-hidden="true" />
									Quick view
								</button>
								<button
									type="button"
									class="text-xs font-semibold px-3 py-2 border rounded-full transition focus-ring"
									:class="ballotViewMode === 'deep'
										? 'border-app-accent bg-app-accent text-white'
										: 'border-app-line bg-white text-app-muted hover:border-app-accent hover:text-app-accent dark:border-app-line-dark dark:bg-app-panel-dark dark:text-app-muted-dark'"
									:aria-pressed="ballotViewMode === 'deep'"
									@click="civicStore.setBallotViewMode('deep')"
								>
									<span v-if="ballotViewMode === 'deep'" class="i-carbon-checkmark mr-1" aria-hidden="true" />
									Deep view
								</button>
								<NuxtLink to="/accessibility" class="btn-secondary">
									Accessibility and print standards
								</NuxtLink>
								<NuxtLink :to="planHref" class="btn-secondary">
									{{ ballotPlanCount ? `Open plan (${ballotPlanCount})` : "Open plan" }}
								</NuxtLink>
							</div>
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
				The demo ballot could not be loaded. Refresh the page or return to the home page and try again.
			</InfoCallout>
		</section>

		<section v-else-if="filteredContests.length" class="app-shell space-y-6">
			<ContestSection
				v-for="contest in filteredContests"
				:key="contest.slug"
				:contest="contest"
				:view-mode="ballotViewMode"
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
			v-if="compareList.length || ballotPlanCount"
			class="px-4 bottom-4 left-0 right-0 fixed z-30 print-hidden"
		>
			<div class="mx-auto px-5 py-4 border border-app-line rounded-[1.75rem] bg-white flex flex-col gap-3 max-w-4xl w-full shadow-[0_24px_50px_-36px_rgba(16,37,62,0.7)] dark:border-app-line-dark dark:bg-app-panel-dark sm:flex-row sm:items-center sm:justify-between">
				<div>
					<p class="text-sm text-app-ink font-semibold dark:text-app-text-dark">
						{{ ballotPlanCount }} contest{{ ballotPlanCount === 1 ? "" : "s" }} saved · {{ compareList.length }} candidate{{ compareList.length === 1 ? "" : "s" }} in compare
					</p>
					<p class="text-xs text-app-muted mt-1 dark:text-app-muted-dark">
						Save a choice to your plan as you go, or compare 2 to 3 candidates from the same contest before deciding.
					</p>
				</div>
				<div class="flex flex-wrap gap-3">
					<NuxtLink :to="planHref" class="btn-secondary">
						Open ballot plan
					</NuxtLink>
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
