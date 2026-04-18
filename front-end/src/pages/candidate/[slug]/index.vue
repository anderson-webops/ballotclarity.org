<script setup lang="ts">
import type { Source } from "~/types/civic";
import { storeToRefs } from "pinia";
import { contactEmail } from "~/constants";
import { buildCompareLaunchSlugs, buildCompareRoute } from "~/stores/civic";

const civicStore = useCivicStore();
const route = useRoute();
const runtimeConfig = useRuntimeConfig();
const siteUrl = useSiteUrl();
const { ballotPlan, compareList, isHydrated, selectedElection, selectedLocation } = storeToRefs(civicStore);
const candidateSlug = computed(() => String(route.params.slug));
const { formatCompactNumber, formatCurrency, formatDate, formatDateTime, formatPercent } = useFormatters();
const { data: candidate, error, pending } = await useCandidate(candidateSlug);
const sectionLinks = [
	{ href: "#at-a-glance", label: "At a glance" },
	{ href: "#biography", label: "Bio" },
	{ href: "#issues", label: "Issues" },
	{ href: "#actions", label: "Votes & actions" },
	{ href: "#funding", label: "Funding" },
	{ href: "#influence", label: "Influence" },
	{ href: "#sources", label: "Sources" }
] as const;
const contextTerms = [
	{
		description: "A candidate currently holding the office they are seeking again.",
		term: "Incumbent"
	},
	{
		description: "The latest date through which this profile says its structured records were reviewed.",
		term: "Data through"
	},
	{
		description: "Campaign money not controlled by the candidate committee but reported in related public filing systems.",
		term: "Outside spending"
	},
	{
		description: "Context about sectors, donors, or public disclosures that may matter for scrutiny, without claiming direct causation.",
		term: "Influence context"
	}
] as const;

function uniqueSources(sources: Source[]) {
	const seen = new Map<string, Source>();

	for (const source of sources)
		seen.set(source.id, source);

	return [...seen.values()];
}

usePageSeo({
	description: candidate.value?.summary ?? "Review a source-backed candidate profile in Ballot Clarity.",
	jsonLd: candidate.value
		? {
				"@context": "https://schema.org",
				"@type": "ProfilePage",
				"dateModified": candidate.value.updatedAt,
				"mainEntity": {
					"@type": "Person",
					"description": candidate.value.summary,
					"homeLocation": {
						"@type": "Place",
						"name": candidate.value.location
					},
					"name": candidate.value.name,
					"url": `${siteUrl}/candidate/${candidate.value.slug}`
				},
				"url": `${siteUrl}/candidate/${candidate.value.slug}`
			}
		: undefined,
	ogType: "profile",
	path: `/candidate/${candidateSlug.value}`,
	title: candidate.value?.name ?? "Candidate detail",
});

const effectiveBallotPlan = computed(() => isHydrated.value ? ballotPlan.value : {});
const effectiveCompareList = computed(() => isHydrated.value ? compareList.value : []);
const showPersistedCandidateState = computed(() => isHydrated.value);
const guideHref = computed(() => showPersistedCandidateState.value && selectedElection.value ? `/ballot/${selectedElection.value.slug}` : "/ballot");
const electionOverviewHref = computed(() => showPersistedCandidateState.value && selectedElection.value ? `/elections/${selectedElection.value.slug}` : "/coverage");
const locationHubHref = computed(() => showPersistedCandidateState.value && selectedLocation.value ? `/locations/${selectedLocation.value.slug}` : "/coverage");
const isCompared = computed(() => candidate.value ? effectiveCompareList.value.includes(candidate.value.slug) : false);
const compareLimitReached = computed(() => effectiveCompareList.value.length >= 3 && !isCompared.value);
const compareLaunchSlugs = computed(() => {
	if (!candidate.value || compareLimitReached.value)
		return [];

	return buildCompareLaunchSlugs(effectiveCompareList.value, candidate.value.slug);
});
const compareHref = computed(() => buildCompareRoute(compareLaunchSlugs.value));
const canOpenCompare = computed(() => compareLaunchSlugs.value.length >= 2);
const canOpenHydratedCompare = computed(() => showPersistedCandidateState.value && canOpenCompare.value);
const isPlanned = computed(() => {
	if (!candidate.value)
		return false;

	const selection = effectiveBallotPlan.value[candidate.value.contestSlug];

	return selection?.type === "candidate" && selection.candidateSlug === candidate.value.slug;
});
const compareButtonIcon = computed(() => showPersistedCandidateState.value && isCompared.value ? "i-carbon-checkmark" : "i-carbon-compare");
const compareButtonLabel = computed(() => {
	if (!showPersistedCandidateState.value)
		return "Compare candidate";

	return isCompared.value ? "Remove from compare" : "Add to compare";
});
const planButtonIcon = computed(() => showPersistedCandidateState.value && isPlanned.value ? "i-carbon-checkmark" : "i-carbon-notebook");
const planButtonLabel = computed(() => showPersistedCandidateState.value && isPlanned.value ? "Saved to plan" : "Save to my plan");
const dataThroughLabel = computed(() => {
	if (!candidate.value)
		return "";

	return formatDate(candidate.value.freshness.dataLastUpdatedAt ?? candidate.value.updatedAt);
});
const candidateJsonHref = computed(() => candidate.value ? `${runtimeConfig.public.apiBase}/candidates/${candidate.value.slug}` : "");
const candidateBreadcrumbs = computed(() => [
	{ label: "Home", to: "/" },
	{ label: "Ballot guide", to: guideHref.value },
	{ label: candidate.value?.name ?? "Candidate profile" }
]);
const issuePositionSources = computed(() => {
	if (!candidate.value)
		return [];

	return uniqueSources([
		...candidate.value.comparison.whyRunning.sources,
		...candidate.value.comparison.topPriorities.flatMap(priority => priority.sources),
		...candidate.value.comparison.questionnaireResponses.flatMap(response => response.sources),
		...candidate.value.publicStatements.flatMap(statement => statement.sources)
	]);
});
const atGlanceStats = computed(() => {
	if (!candidate.value)
		return [];

	const activityLabel = candidate.value.incumbent ? "Documented votes and actions" : "Documented campaign actions";
	const activityNote = candidate.value.incumbent
		? "Selected official actions in the current project archive. This page is not a full legislative ledger."
		: "Published policy releases, local-government actions, and other source-backed items included in the current project archive.";
	const influenceSectors = [...new Set(candidate.value.funding.topFunders.map(funder => funder.category))].slice(0, 2);
	const influenceNote = influenceSectors.length
		? `Context draws on ${influenceSectors.join(" and ")}. This is context only, not proof of influence.`
		: "Influence notes are shown as context only, not proof of influence.";

	return [
		{
			label: activityLabel,
			note: activityNote,
			value: formatCompactNumber(candidate.value.keyActions.length)
		},
		{
			label: "Money in",
			note: `Reported fundraising in the current filing window. Data through ${dataThroughLabel.value}.`,
			value: formatCurrency(candidate.value.funding.totalRaised)
		},
		{
			label: "Influence context",
			note: influenceNote,
			value: `${candidate.value.lobbyingContext.length} note${candidate.value.lobbyingContext.length === 1 ? "" : "s"}`
		}
	];
});
const actionCoverageNote = computed(() => {
	if (!candidate.value)
		return "";

	return candidate.value.incumbent
		? "This section highlights selected official actions tied to the current project archive. Use the evidence drawer and source rail to inspect the attached records and page limits."
		: "This section highlights source-backed campaign, policy, or local-government actions available in the current project archive. It does not stand in for a full voting ledger.";
});
const reportIssueHref = computed(() => candidate.value
	? `mailto:${contactEmail}?subject=${encodeURIComponent(`Ballot Clarity candidate review: ${candidate.value.name}`)}`
	: `mailto:${contactEmail}?subject=${encodeURIComponent("Ballot Clarity candidate review")}`);
const coverageItems = computed(() => {
	if (!candidate.value)
		return [];

	return [
		"Published campaign materials and questionnaires included in the project archive.",
		"Source-backed actions selected for relevance to this office and district context.",
		"Funding summaries tied to the attached campaign-finance records.",
		"Method notes explaining what is included, what is missing, and when the page was last reviewed."
	];
});

function toggleCompare() {
	if (candidate.value)
		civicStore.toggleCompare(candidate.value.slug);
}

function saveToPlan() {
	if (candidate.value)
		civicStore.selectCandidateForPlan(candidate.value.contestSlug, candidate.value.slug);
}
</script>

<template>
	<section class="app-shell section-gap">
		<div v-if="pending" class="gap-8 grid 2xl:grid-cols-[minmax(0,1.4fr)_minmax(22rem,0.8fr)]">
			<div class="space-y-6">
				<div class="surface-panel animate-pulse">
					<div class="rounded-full bg-app-line/70 h-6 w-32 dark:bg-app-line-dark" />
					<div class="mt-4 rounded-[1rem] bg-app-line/60 h-14 w-3/4 dark:bg-app-line-dark" />
					<div class="mt-4 rounded-full bg-app-line/60 h-4 w-full dark:bg-app-line-dark" />
					<div class="mt-2 rounded-full bg-app-line/60 h-4 w-2/3 dark:bg-app-line-dark" />
				</div>
				<div v-for="index in 4" :key="index" class="surface-panel bg-white/70 h-48 animate-pulse dark:bg-app-panel-dark/70" />
			</div>
			<div class="surface-panel bg-white/70 h-96 animate-pulse dark:bg-app-panel-dark/70" />
		</div>

		<div v-else-if="error || !candidate" class="max-w-3xl">
			<InfoCallout title="Candidate profile not available" tone="warning">
				This candidate page could not be loaded. Return to the ballot overview to choose another profile.
			</InfoCallout>
		</div>

		<div v-else class="gap-8 grid 2xl:grid-cols-[minmax(0,1.45fr)_minmax(21rem,0.85fr)]">
			<div class="space-y-6">
				<header class="surface-panel">
					<div class="flex flex-wrap gap-2 items-center">
						<VerificationBadge label="Candidate profile" tone="accent" />
						<ProvenanceBadge :provenance="candidate.comparison.ballotStatus.provenance" />
					</div>
					<p class="text-xs text-app-muted tracking-[0.24em] font-semibold mt-5 uppercase dark:text-app-muted-dark">
						{{ candidate.location }}
					</p>
					<div class="mt-3 flex flex-wrap gap-3 items-center">
						<h1 class="text-5xl text-app-ink leading-tight font-serif dark:text-app-text-dark">
							{{ candidate.name }}
						</h1>
						<IncumbentBadge v-if="candidate.incumbent" />
					</div>
					<p class="text-lg text-app-muted mt-4 dark:text-app-muted-dark">
						{{ candidate.officeSought }} · {{ candidate.party }}
					</p>
					<p class="text-base text-app-muted leading-8 mt-6 max-w-3xl dark:text-app-muted-dark">
						{{ candidate.summary }}
					</p>
					<div class="mt-6 flex flex-wrap gap-3 items-center">
						<UpdatedAt :value="candidate.freshness.dataLastUpdatedAt ?? candidate.updatedAt" label="Data through" />
						<span class="text-app-line dark:text-app-line-dark">•</span>
						<p class="text-sm text-app-muted dark:text-app-muted-dark">
							{{ candidate.comparison.ballotStatus.label }}
						</p>
					</div>
					<div class="bc-action-cluster mt-6">
						<SourceDrawer :sources="candidate.sources" :title="`${candidate.name} evidence and sources`" button-label="Evidence & sources" />
						<NuxtLink v-if="canOpenHydratedCompare" :to="compareHref" class="btn-secondary">
							Open compare
						</NuxtLink>
						<NuxtLink :to="`/candidate/${candidate.slug}/funding`" class="btn-secondary">
							Funding page
						</NuxtLink>
						<NuxtLink :to="`/candidate/${candidate.slug}/influence`" class="btn-secondary">
							Influence page
						</NuxtLink>
						<button type="button" class="btn-secondary" :disabled="showPersistedCandidateState ? compareLimitReached : false" @click="toggleCompare">
							<span :class="compareButtonIcon" />
							{{ compareButtonLabel }}
						</button>
						<button type="button" class="btn-secondary" @click="saveToPlan">
							<span :class="planButtonIcon" />
							{{ planButtonLabel }}
						</button>
						<NuxtLink :to="electionOverviewHref" class="btn-secondary">
							Election overview
						</NuxtLink>
						<a v-if="candidateJsonHref" :href="candidateJsonHref" class="btn-secondary" rel="noreferrer" target="_blank">
							<span class="i-carbon-download" />
							Download JSON
						</a>
						<NuxtLink :to="guideHref" class="btn-primary">
							Back to ballot
						</NuxtLink>
					</div>
				</header>

				<section id="at-a-glance" class="surface-panel scroll-mt-28">
					<div class="flex flex-wrap gap-4 items-start justify-between">
						<div>
							<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
								At a glance
							</p>
							<h2 class="text-3xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
								Ballot context and page coverage
							</h2>
						</div>
						<SourceDrawer :sources="candidate.sources" :title="`${candidate.name} ballot context and coverage`" button-label="See page sources" />
					</div>
					<div class="mt-6">
						<PageSummaryStrip :items="atGlanceStats" />
					</div>
					<div class="mt-6 gap-4 grid lg:grid-cols-[minmax(0,1.3fr)_minmax(18rem,0.9fr)]">
						<div class="px-5 py-5 border border-app-line/80 rounded-3xl bg-white/80 dark:border-app-line-dark dark:bg-app-panel-dark/70">
							<div class="flex flex-wrap gap-3 items-center justify-between">
								<h3 class="text-xl text-app-ink font-serif dark:text-app-text-dark">
									Identity and ballot context
								</h3>
								<ProvenanceBadge :provenance="candidate.comparison.ballotStatus.provenance" />
							</div>
							<dl class="mt-5 gap-4 grid sm:grid-cols-2">
								<div>
									<dt class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
										Office
									</dt>
									<dd class="text-sm text-app-ink mt-2 dark:text-app-text-dark">
										{{ candidate.officeSought }}
									</dd>
								</div>
								<div>
									<dt class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
										Status
									</dt>
									<dd class="text-sm text-app-ink mt-2 dark:text-app-text-dark">
										{{ candidate.incumbent ? "Incumbent" : "Challenger or open-seat candidate" }}
									</dd>
								</div>
								<div>
									<dt class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
										Ballot status
									</dt>
									<dd class="mt-2 flex flex-wrap gap-3 items-center">
										<span class="text-sm text-app-ink dark:text-app-text-dark">{{ candidate.comparison.ballotStatus.label }}</span>
										<SourceDrawer :sources="candidate.comparison.ballotStatus.sources" :title="`${candidate.name} ballot status`" button-label="Sources" />
									</dd>
								</div>
								<div>
									<dt class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
										Data through
									</dt>
									<dd class="text-sm text-app-ink mt-2 dark:text-app-text-dark">
										{{ dataThroughLabel }}
									</dd>
								</div>
								<div>
									<dt class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
										Sources attached
									</dt>
									<dd class="text-sm text-app-ink mt-2 dark:text-app-text-dark">
										{{ candidate.sources.length }} source records in this profile
									</dd>
								</div>
								<div>
									<dt class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
										Location
									</dt>
									<dd class="text-sm text-app-ink mt-2 dark:text-app-text-dark">
										{{ candidate.location }}
									</dd>
								</div>
							</dl>
						</div>
						<div class="px-5 py-5 border border-app-line/80 rounded-3xl bg-app-bg dark:border-app-line-dark dark:bg-app-bg-dark/70">
							<h3 class="text-xl text-app-ink font-serif dark:text-app-text-dark">
								What this page includes
							</h3>
							<ul class="text-sm text-app-muted leading-7 mt-4 space-y-2 dark:text-app-muted-dark">
								<li v-for="item in coverageItems" :key="item">
									{{ item }}
								</li>
							</ul>
							<details class="mt-5 px-4 py-3 border border-app-line/80 rounded-2xl dark:border-app-line-dark">
								<summary class="text-sm text-app-ink font-semibold cursor-pointer dark:text-app-text-dark">
									Context and terms
								</summary>
								<ul class="text-sm text-app-muted leading-7 mt-4 space-y-3 dark:text-app-muted-dark">
									<li v-for="item in contextTerms" :key="item.term">
										<span class="text-app-ink font-semibold dark:text-app-text-dark">{{ item.term }}:</span>
										{{ item.description }}
									</li>
								</ul>
							</details>
						</div>
					</div>
				</section>

				<ExpandableSection
					id="biography"
					eyebrow="Biography"
					title="Background and public resume"
					description="This section combines verified public background details with self-described campaign biography so users can see where identity, work history, and public narrative come from."
					open
				>
					<template #meta>
						<SourceDrawer :sources="candidate.biography.flatMap(block => block.sources)" :title="`${candidate.name} background sources`" />
					</template>
					<div class="mt-6 space-y-4">
						<article v-for="block in candidate.biography" :key="block.id" class="p-5 rounded-3xl bg-app-bg dark:bg-app-bg-dark/70">
							<div class="flex flex-wrap gap-3 items-start justify-between">
								<h3 class="text-lg text-app-ink font-semibold dark:text-app-text-dark">
									{{ block.title }}
								</h3>
								<SourceDrawer :sources="block.sources" :title="block.title" button-label="Sources" />
							</div>
							<p class="text-sm text-app-muted leading-7 mt-3 dark:text-app-muted-dark">
								{{ block.summary }}
							</p>
						</article>
					</div>
				</ExpandableSection>

				<ExpandableSection
					id="issues"
					eyebrow="Issue positions"
					title="What this candidate says and emphasizes"
					description="This section separates candidate-submitted responses, public issue statements, and the source documents attached to them so users can inspect both the claim and its provenance."
					open
				>
					<template #meta>
						<SourceDrawer :sources="issuePositionSources" :title="`${candidate.name} issue position sources`" />
					</template>
					<div class="mt-5 flex flex-wrap gap-2">
						<IssueChip v-for="issue in candidate.topIssues" :key="issue.slug" :label="issue.label" />
					</div>
					<div class="mt-6 gap-4 grid">
						<article class="px-5 py-5 rounded-3xl bg-app-bg dark:bg-app-bg-dark/70">
							<div class="flex flex-wrap gap-3 items-start justify-between">
								<div>
									<h3 class="text-lg text-app-ink font-semibold dark:text-app-text-dark">
										Why the candidate says they are running
									</h3>
									<UpdatedAt
										v-if="candidate.comparison.whyRunning.provenance.capturedAt"
										:value="candidate.comparison.whyRunning.provenance.capturedAt"
										label="Captured"
									/>
								</div>
								<div class="flex flex-wrap gap-3 items-center">
									<ProvenanceBadge :provenance="candidate.comparison.whyRunning.provenance" />
									<SourceDrawer :sources="candidate.comparison.whyRunning.sources" title="Why the candidate says they are running" button-label="Sources" />
								</div>
							</div>
							<p class="text-sm text-app-muted leading-7 mt-4 dark:text-app-muted-dark">
								{{ candidate.comparison.whyRunning.text }}
							</p>
						</article>
						<article class="px-5 py-5 rounded-3xl bg-app-bg dark:bg-app-bg-dark/70">
							<div class="flex flex-wrap gap-3 items-start justify-between">
								<h3 class="text-lg text-app-ink font-semibold dark:text-app-text-dark">
									Top stated priorities
								</h3>
								<SourceDrawer :sources="candidate.comparison.topPriorities.flatMap(priority => priority.sources)" :title="`${candidate.name} stated priorities`" button-label="Sources" />
							</div>
							<ul class="mt-4 space-y-3">
								<li v-for="priority in candidate.comparison.topPriorities" :key="priority.id" class="px-4 py-4 border border-app-line/80 rounded-2xl bg-white/80 dark:border-app-line-dark dark:bg-app-panel-dark/70">
									<div class="flex flex-wrap gap-3 items-start justify-between">
										<p class="text-sm text-app-ink font-medium max-w-2xl dark:text-app-text-dark">
											{{ priority.text }}
										</p>
										<ProvenanceBadge :provenance="priority.provenance" />
									</div>
								</li>
							</ul>
						</article>
						<article class="px-5 py-5 rounded-3xl bg-app-bg dark:bg-app-bg-dark/70">
							<div class="flex flex-wrap gap-3 items-start justify-between">
								<div>
									<h3 class="text-lg text-app-ink font-semibold dark:text-app-text-dark">
										Questionnaire responses in the project archive
									</h3>
									<p class="text-sm text-app-muted mt-2 dark:text-app-muted-dark">
										Responses are shown as submitted, with provenance labels and attached evidence.
									</p>
								</div>
								<SourceDrawer :sources="candidate.comparison.questionnaireResponses.flatMap(response => response.sources)" :title="`${candidate.name} questionnaire responses`" button-label="Sources" />
							</div>
							<div class="mt-4 space-y-4">
								<article v-for="response in candidate.comparison.questionnaireResponses" :key="response.questionId" class="px-4 py-4 border border-app-line/80 rounded-2xl bg-white/80 dark:border-app-line-dark dark:bg-app-panel-dark/70">
									<div class="flex flex-wrap gap-3 items-start justify-between">
										<div>
											<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
												{{ response.category }}
											</p>
											<h4 class="text-base text-app-ink font-semibold mt-2 dark:text-app-text-dark">
												{{ response.questionPrompt }}
											</h4>
										</div>
										<ProvenanceBadge :provenance="response.provenance" />
									</div>
									<p class="text-sm text-app-muted leading-7 mt-4 dark:text-app-muted-dark">
										{{ response.answerText ?? "No response submitted in the current project archive." }}
									</p>
									<div class="mt-4 flex flex-wrap gap-3 items-center justify-between">
										<UpdatedAt v-if="response.answerReceivedAt" :value="response.answerReceivedAt" label="Received" />
										<SourceDrawer :sources="response.sources" :title="response.questionPrompt" button-label="Sources" />
									</div>
								</article>
							</div>
						</article>
						<article v-for="statement in candidate.publicStatements" :key="statement.id" class="px-5 py-5 rounded-3xl bg-app-bg dark:bg-app-bg-dark/70">
							<div class="flex flex-wrap gap-3 items-start justify-between">
								<div>
									<h3 class="text-lg text-app-ink font-semibold dark:text-app-text-dark">
										{{ statement.title }}
									</h3>
								</div>
								<SourceDrawer :sources="statement.sources" :title="statement.title" button-label="Sources" />
							</div>
							<p class="text-sm text-app-muted leading-7 mt-3 dark:text-app-muted-dark">
								{{ statement.summary }}
							</p>
						</article>
					</div>
				</ExpandableSection>

				<ExpandableSection
					id="actions"
					eyebrow="Votes & actions"
					title="Selected documented actions"
					open
				>
					<template #meta>
						<SourceDrawer :sources="candidate.keyActions.flatMap(action => action.sources)" :title="`${candidate.name} key actions`" />
					</template>
					<InfoCallout class="mt-5" title="How selected actions work">
						{{ actionCoverageNote }}
					</InfoCallout>
					<div class="mt-6 space-y-4">
						<article v-for="action in candidate.keyActions" :key="action.id" class="p-5 rounded-3xl bg-app-bg dark:bg-app-bg-dark/70">
							<div class="flex flex-wrap gap-3 items-start justify-between">
								<div>
									<h3 class="text-lg text-app-ink font-semibold dark:text-app-text-dark">
										{{ action.title }}
									</h3>
									<UpdatedAt :value="action.date" label="Documented" />
								</div>
								<SourceDrawer :sources="action.sources" :title="action.title" button-label="Sources" />
							</div>
							<p class="text-sm text-app-muted leading-7 mt-3 dark:text-app-muted-dark">
								{{ action.summary }}
							</p>
							<p class="text-sm text-app-ink font-medium mt-3 dark:text-app-text-dark">
								{{ action.significance }}
							</p>
						</article>
					</div>
				</ExpandableSection>

				<ExpandableSection
					id="funding"
					eyebrow="Funding"
					title="Campaign funding overview"
					description="Reported fundraising in this profile is shown with the current filing window and attached source documents. Review original filings for late amendments or newly reported independent spending."
				>
					<template #meta>
						<div class="flex flex-wrap gap-3 items-center">
							<SourceDrawer :sources="candidate.funding.sources" title="Campaign funding sources" />
							<NuxtLink :to="`/candidate/${candidate.slug}/funding`" class="btn-secondary">
								Open dedicated funding page
							</NuxtLink>
						</div>
					</template>
					<div class="mt-6 gap-4 grid md:grid-cols-3">
						<div class="p-5 rounded-3xl bg-app-bg dark:bg-app-bg-dark/70">
							<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
								Raised
							</p>
							<p class="text-2xl text-app-ink font-semibold mt-2 dark:text-app-text-dark">
								{{ formatCurrency(candidate.funding.totalRaised) }}
							</p>
						</div>
						<div class="p-5 rounded-3xl bg-app-bg dark:bg-app-bg-dark/70">
							<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
								Cash on hand
							</p>
							<p class="text-2xl text-app-ink font-semibold mt-2 dark:text-app-text-dark">
								{{ formatCurrency(candidate.funding.cashOnHand) }}
							</p>
						</div>
						<div class="p-5 rounded-3xl bg-app-bg dark:bg-app-bg-dark/70">
							<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
								Small donors
							</p>
							<p class="text-2xl text-app-ink font-semibold mt-2 dark:text-app-text-dark">
								{{ formatPercent(candidate.funding.smallDonorShare) }}
							</p>
						</div>
					</div>
					<p class="text-sm text-app-muted leading-7 mt-6 dark:text-app-muted-dark">
						{{ candidate.funding.summary }}
					</p>
					<ul class="mt-5 space-y-3">
						<li v-for="funder in candidate.funding.topFunders" :key="funder.name" class="text-sm px-4 py-3 border border-app-line/80 rounded-2xl bg-white/70 flex gap-4 items-start justify-between dark:border-app-line-dark dark:bg-app-panel-dark/70">
							<div>
								<p class="text-app-ink font-semibold dark:text-app-text-dark">
									{{ funder.name }}
								</p>
								<p class="text-app-muted mt-1 dark:text-app-muted-dark">
									{{ funder.category }}
								</p>
							</div>
							<span class="text-app-ink font-semibold dark:text-app-text-dark">
								{{ formatCurrency(funder.amount) }}
							</span>
						</li>
					</ul>
				</ExpandableSection>

				<ExpandableSection
					id="influence"
					eyebrow="Lobbying & influence context"
					title="Public context around funding and policy exposure"
				>
					<template #meta>
						<div class="flex flex-wrap gap-3 items-center">
							<SourceDrawer :sources="candidate.lobbyingContext.flatMap(block => block.sources)" :title="`${candidate.name} influence context`" />
							<NuxtLink :to="`/candidate/${candidate.slug}/influence`" class="btn-secondary">
								Open dedicated influence page
							</NuxtLink>
						</div>
					</template>
					<InfoCallout class="mt-5" title="Read this section carefully">
						Influence context is presented to help users inspect relevant sectors, donors, and public disclosures. It should not be read as proof that any donor or organization controlled a candidate action.
					</InfoCallout>
					<div class="mt-6 space-y-4">
						<article v-for="block in candidate.lobbyingContext" :key="block.id" class="p-5 rounded-3xl bg-app-bg dark:bg-app-bg-dark/70">
							<div class="flex flex-wrap gap-3 items-start justify-between">
								<h3 class="text-lg text-app-ink font-semibold dark:text-app-text-dark">
									{{ block.title }}
								</h3>
								<SourceDrawer :sources="block.sources" :title="block.title" button-label="Sources" />
							</div>
							<p class="text-sm text-app-muted leading-7 mt-3 dark:text-app-muted-dark">
								{{ block.summary }}
							</p>
						</article>
					</div>
				</ExpandableSection>

				<ExpandableSection
					eyebrow="Future analysis"
					title="Constituent context and future analysis"
				>
					<InfoCallout class="mt-5" title="Planned analysis area" tone="warning">
						{{ candidate.alignmentModule.summary }}
					</InfoCallout>
					<ul class="text-sm text-app-muted leading-7 mt-5 space-y-3 dark:text-app-muted-dark">
						<li v-for="consideration in candidate.alignmentModule.considerations" :key="consideration" class="px-4 py-3 rounded-2xl bg-app-bg dark:bg-app-bg-dark/70">
							{{ consideration }}
						</li>
					</ul>
				</ExpandableSection>

				<ExpandableSection
					id="sources"
					eyebrow="Sources & methods"
					title="Sources and methodology notes"
					description="Use this section to inspect how the profile was assembled, where the attached evidence came from, and what records remain outside the current published source set."
				>
					<template #meta>
						<SourceDrawer :sources="candidate.sources" :title="`${candidate.name} full source list`" />
					</template>
					<div class="mt-6 gap-4 grid lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
						<div class="p-4 rounded-[1.35rem] bg-app-bg dark:bg-app-bg-dark/70">
							<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
								Review timing
							</p>
							<div class="mt-3 space-y-3">
								<p class="text-sm text-app-muted leading-6 dark:text-app-muted-dark">
									<strong class="text-app-ink dark:text-app-text-dark">Status:</strong> {{ candidate.freshness.statusLabel }}
								</p>
								<p class="text-sm text-app-muted leading-6 dark:text-app-muted-dark">
									<strong class="text-app-ink dark:text-app-text-dark">Last verified:</strong> {{ formatDateTime(candidate.freshness.contentLastVerifiedAt) }}
								</p>
								<p class="text-sm text-app-muted leading-6 dark:text-app-muted-dark">
									<strong class="text-app-ink dark:text-app-text-dark">Next review:</strong> {{ formatDateTime(candidate.freshness.nextReviewAt) }}
								</p>
								<p class="text-sm text-app-muted leading-6 dark:text-app-muted-dark">
									{{ candidate.freshness.statusNote }}
								</p>
							</div>
						</div>
						<div class="p-4 rounded-[1.35rem] bg-app-bg dark:bg-app-bg-dark/70">
							<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
								Verification scope
							</p>
							<div class="mt-3 gap-3 grid md:grid-cols-2">
								<div>
									<p class="text-sm text-app-ink font-semibold dark:text-app-text-dark">
										What we know
									</p>
									<ul class="mt-2 space-y-2">
										<li v-for="item in candidate.whatWeKnow" :key="item.id" class="text-sm text-app-muted leading-6 dark:text-app-muted-dark">
											{{ item.text }}
										</li>
									</ul>
								</div>
								<div>
									<p class="text-sm text-app-ink font-semibold dark:text-app-text-dark">
										Still checking
									</p>
									<ul class="mt-2 space-y-2">
										<li v-for="item in candidate.whatWeDoNotKnow" :key="item.id" class="text-sm text-app-muted leading-6 dark:text-app-muted-dark">
											{{ item.text }}
										</li>
									</ul>
								</div>
							</div>
						</div>
					</div>
					<ul class="text-sm text-app-muted leading-7 mt-6 space-y-3 dark:text-app-muted-dark">
						<li v-for="note in candidate.methodologyNotes" :key="note" class="px-4 py-3 rounded-2xl bg-app-bg dark:bg-app-bg-dark/70">
							{{ note }}
						</li>
					</ul>
				</ExpandableSection>
			</div>

			<aside class="xl:self-start xl:top-28 xl:sticky">
				<PageSectionNav
					title="Jump to section"
					description="Use the summary first, then open only the sections you need."
					:breadcrumbs="candidateBreadcrumbs"
					:items="sectionLinks.map(section => ({ href: section.href, label: section.label }))"
				/>

				<div class="mt-4 surface-panel">
					<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
						Evidence rail
					</p>
					<p class="text-sm text-app-muted leading-7 mt-3 dark:text-app-muted-dark">
						Every summary on this page is tied to the source set below. Use the evidence drawer for section-level claims, and use this rail for the full archive and page method notes.
					</p>
					<div class="mt-5 space-y-3">
						<UpdatedAt :value="candidate.freshness.dataLastUpdatedAt ?? candidate.updatedAt" label="Data through" />
						<div class="flex flex-wrap gap-3 items-center">
							<span class="text-sm text-app-ink dark:text-app-text-dark">{{ candidate.comparison.ballotStatus.label }}</span>
							<ProvenanceBadge :provenance="candidate.comparison.ballotStatus.provenance" />
						</div>
					</div>
					<div class="mt-4 flex flex-wrap gap-3">
						<SourceDrawer :sources="candidate.sources" :title="`${candidate.name} full evidence panel`" button-label="Open evidence panel" />
						<a v-if="candidateJsonHref" :href="candidateJsonHref" class="btn-secondary text-xs px-4 py-2" rel="noreferrer" target="_blank">
							Download JSON
						</a>
						<a :href="reportIssueHref" class="btn-secondary text-xs px-4 py-2">
							Report an issue
						</a>
						<NuxtLink :to="locationHubHref" class="btn-secondary text-xs px-4 py-2">
							Location hub
						</NuxtLink>
						<NuxtLink :to="electionOverviewHref" class="btn-secondary text-xs px-4 py-2">
							Election overview
						</NuxtLink>
					</div>
					<InfoCallout class="mt-5" title="Neutrality note">
						This profile is informational only. It does not rank candidates, predict outcomes, or replace official filings and election-office records.
					</InfoCallout>
					<InfoCallout class="mt-6" title="How verification is handled">
						Use the source drawer for record-level evidence, the source list below for the full archive, and the footer’s data-verification panel for the site-wide explanation of badges, freshness, and review rules.
					</InfoCallout>
					<div class="mt-6">
						<SourceList :sources="candidate.sources" compact title="Attached sources" />
					</div>
				</div>
			</aside>
		</div>
	</section>
</template>
