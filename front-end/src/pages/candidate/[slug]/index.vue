<script setup lang="ts">
import type { Source } from "~/types/civic";
import { storeToRefs } from "pinia";
import TimelineList from "~/components/graphics/TimelineList.vue";
import { buildCompareLaunchSlugs, buildCompareRoute } from "~/stores/civic";
import {
	buildCandidateTimeline
} from "~/utils/graphics-schema";

const civicStore = useCivicStore();
const siteUrl = useSiteUrl();
const { backToLayerLink, layerBreadcrumbLink, openLayerLink } = useRouteLayerNavigation();
const { ballotPlan, compareList, isHydrated } = storeToRefs(civicStore);
const candidateSlug = useRouteStringParam("slug");
const { formatCompactNumber, formatCurrency, formatDate, formatPercent } = useFormatters();
const { data: candidate, error, pending } = await useCandidate(candidateSlug);
const candidateTimeline = computed(() => candidate.value ? buildCandidateTimeline(candidate.value) : []);
const sectionLinks = [
	{ href: "#biography", label: "Bio" },
	{ href: "#issues", label: "Issues" },
	{ href: "#actions", label: "Votes & actions" },
	{ href: "#funding", label: "Funding" },
	{ href: "#influence", label: "Influence" },
	{ href: "#sources", label: "Sources" }
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
					"image": candidate.value.profileImages?.[0]?.url,
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
const candidateBreadcrumbs = computed(() => [
	{ label: "Home", to: "/" },
	layerBreadcrumbLink.value,
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
		? "Selected official actions. Not a full voting record."
		: "Selected campaign, policy, or public-office actions. Not a full record.";
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
		? "Selected official actions. Not a full voting record."
		: "Selected campaign, policy, or public-office actions. Not a full record.";
});
const reportIssueTo = computed(() => ({
	path: "/contact",
	query: {
		pageUrl: `/candidate/${candidate.value?.slug ?? candidateSlug.value}`,
		subject: candidate.value
			? `Ballot Clarity candidate review: ${candidate.value.name}`
			: "Ballot Clarity candidate review",
		type: "correction"
	}
}));

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
		<div v-if="pending" class="detail-layout">
			<div class="space-y-6">
				<div class="surface-panel animate-pulse">
					<div class="rounded-full bg-app-line/70 h-6 w-32 dark:bg-app-line-dark" />
					<div class="mt-4 rounded-xl bg-app-line/60 h-14 w-3/4 dark:bg-app-line-dark" />
					<div class="mt-4 rounded-full bg-app-line/60 h-4 w-full dark:bg-app-line-dark" />
					<div class="mt-2 rounded-full bg-app-line/60 h-4 w-2/3 dark:bg-app-line-dark" />
				</div>
				<div v-for="index in 4" :key="index" class="rounded-lg bg-app-bg h-48 animate-pulse dark:bg-app-bg-dark" />
			</div>
			<div class="rounded-lg bg-app-bg h-96 animate-pulse dark:bg-app-bg-dark" />
		</div>

		<GuideUnavailableState
			v-else-if="error || !candidate"
			message=""
			:primary-label="openLayerLink.label"
			:primary-to="openLayerLink.to"
			title="Candidate information unavailable"
		/>

		<div v-else class="detail-layout">
			<div class="section-stack print:space-y-6">
				<header class="surface-panel">
					<div class="gap-6 grid md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
						<div>
							<p class="text-xs text-app-muted tracking-[0.06em] font-semibold uppercase dark:text-app-muted-dark">
								{{ candidate.location }}
							</p>
							<div class="mt-3 flex flex-wrap gap-3 items-center">
								<h1 class="text-5xl text-app-ink leading-tight font-serif dark:text-app-text-dark">
									{{ candidate.name }}
								</h1>
								<IncumbentBadge v-if="candidate.incumbent" />
							</div>
							<p class="text-lg text-app-muted mt-4 dark:text-app-muted-dark">
								{{ candidate.officeSought }} · <PartyLabel :party="candidate.party" />
							</p>
							<p class="text-lg text-app-ink leading-8 mt-5 max-w-3xl dark:text-app-text-dark">
								{{ candidate.summary }}
							</p>
						</div>
						<ProfileImageStack
							v-if="candidate.profileImages?.length"
							:images="candidate.profileImages"
							:name="candidate.name"
							show-caption
							size="lg"
						/>
					</div>
					<div class="mt-6 flex flex-wrap gap-3 items-center">
						<UpdatedAt :value="candidate.freshness.dataLastUpdatedAt ?? candidate.updatedAt" label="Data through" />
						<span class="text-app-line dark:text-app-line-dark">•</span>
						<p class="text-sm text-app-muted dark:text-app-muted-dark">
							{{ candidate.comparison.ballotStatus.label }}
						</p>
						<SourceDrawer :sources="candidate.comparison.ballotStatus.sources" :title="`${candidate.name} ballot status`" button-label="Sources" />
					</div>
					<div class="mt-6 flex flex-wrap gap-x-6 gap-y-3 items-center">
						<button type="button" class="btn-primary" @click="saveToPlan">
							<span :class="planButtonIcon" aria-hidden="true" />
							{{ planButtonLabel }}
						</button>
						<button type="button" class="btn-secondary" :disabled="showPersistedCandidateState ? compareLimitReached : false" @click="toggleCompare">
							{{ compareButtonLabel }}
						</button>
						<NuxtLink v-if="canOpenHydratedCompare" :to="compareHref" class="btn-secondary">
							Open compare
						</NuxtLink>
						<NuxtLink :to="backToLayerLink.to" class="btn-secondary">
							{{ backToLayerLink.label }}
						</NuxtLink>
					</div>
				</header>

				<section id="at-a-glance" class="scroll-mt-28" aria-label="At a glance">
					<PageSummaryStrip :items="atGlanceStats" />
				</section>

				<ExpandableSection
					id="biography"
					eyebrow="Biography"
					title="Background"
				>
					<template #meta>
						<SourceDrawer :sources="candidate.biography.flatMap(block => block.sources)" :title="`${candidate.name} background sources`" />
					</template>
					<div class="mt-6 space-y-4">
						<article v-for="block in candidate.biography" :key="block.id" class="content-block">
							<div class="flex flex-wrap gap-3 items-start justify-between">
								<h3 class="text-lg text-app-ink font-semibold dark:text-app-text-dark">
									{{ block.title }}
								</h3>
								<SourceDrawer :sources="block.sources" :title="block.title" button-label="Sources" />
							</div>
							<p class="text-base text-app-ink leading-7 mt-2 dark:text-app-text-dark">
								{{ block.summary }}
							</p>
						</article>
					</div>
				</ExpandableSection>

				<ExpandableSection
					id="issues"
					eyebrow="Issue positions"
					title="Positions"
				>
					<template #meta>
						<SourceDrawer :sources="issuePositionSources" :title="`${candidate.name} issue position sources`" />
					</template>
					<div class="mt-5 flex flex-wrap gap-2">
						<IssueChip v-for="issue in candidate.topIssues" :key="issue.slug" :label="issue.label" />
					</div>
					<div class="mt-6 gap-8 grid">
						<article>
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
							<p class="text-base text-app-ink leading-7 mt-3 dark:text-app-text-dark">
								{{ candidate.comparison.whyRunning.text }}
							</p>
						</article>
						<article>
							<div class="flex flex-wrap gap-3 items-start justify-between">
								<h3 class="text-lg text-app-ink font-semibold dark:text-app-text-dark">
									Priorities
								</h3>
								<SourceDrawer :sources="candidate.comparison.topPriorities.flatMap(priority => priority.sources)" :title="`${candidate.name} stated priorities`" button-label="Sources" />
							</div>
							<ul class="mt-4 space-y-3">
								<li v-for="priority in candidate.comparison.topPriorities" :key="priority.id">
									<div class="flex flex-wrap gap-3 items-start justify-between">
										<p class="text-sm text-app-ink font-medium max-w-2xl dark:text-app-text-dark">
											{{ priority.text }}
										</p>
										<ProvenanceBadge :provenance="priority.provenance" />
									</div>
								</li>
							</ul>
						</article>
						<article>
							<div class="flex flex-wrap gap-3 items-start justify-between">
								<div>
									<h3 class="text-lg text-app-ink font-semibold dark:text-app-text-dark">
										Questionnaire
									</h3>
								</div>
								<SourceDrawer :sources="candidate.comparison.questionnaireResponses.flatMap(response => response.sources)" :title="`${candidate.name} questionnaire responses`" button-label="Sources" />
							</div>
							<div class="mt-4 space-y-4">
								<article v-for="response in candidate.comparison.questionnaireResponses" :key="response.questionId" class="content-block">
									<div class="flex flex-wrap gap-3 items-start justify-between">
										<div>
											<p class="text-xs text-app-muted tracking-[0.06em] font-semibold uppercase dark:text-app-muted-dark">
												{{ response.category }}
											</p>
											<h4 class="text-base text-app-ink font-semibold mt-2 dark:text-app-text-dark">
												{{ response.questionPrompt }}
											</h4>
										</div>
										<ProvenanceBadge :provenance="response.provenance" />
									</div>
									<p class="text-base text-app-ink leading-7 mt-3 dark:text-app-text-dark">
										{{ response.answerText ?? "No response submitted." }}
									</p>
									<div class="mt-4 flex flex-wrap gap-3 items-center justify-between">
										<UpdatedAt v-if="response.answerReceivedAt" :value="response.answerReceivedAt" label="Received" />
										<SourceDrawer :sources="response.sources" :title="response.questionPrompt" button-label="Sources" />
									</div>
								</article>
							</div>
						</article>
						<article v-for="statement in candidate.publicStatements" :key="statement.id" class="content-block">
							<div class="flex flex-wrap gap-3 items-start justify-between">
								<div>
									<h3 class="text-lg text-app-ink font-semibold dark:text-app-text-dark">
										{{ statement.title }}
									</h3>
								</div>
								<SourceDrawer :sources="statement.sources" :title="statement.title" button-label="Sources" />
							</div>
							<p class="text-base text-app-ink leading-7 mt-3 dark:text-app-text-dark">
								{{ statement.summary }}
							</p>
						</article>
					</div>
				</ExpandableSection>

				<ExpandableSection
					id="actions"
					eyebrow="Votes & actions"
					title="Votes and actions"
				>
					<template #meta>
						<SourceDrawer :sources="candidate.keyActions.flatMap(action => action.sources)" :title="`${candidate.name} key actions`" />
					</template>
					<p class="text-sm text-app-muted mt-3 dark:text-app-muted-dark">
						{{ actionCoverageNote }}
					</p>
					<div class="mt-6">
						<TimelineList :items="candidateTimeline" eyebrow="Newest first" />
					</div>
				</ExpandableSection>

				<ExpandableSection
					id="funding"
					eyebrow="Funding"
					title="Funding"
				>
					<template #meta>
						<div class="flex flex-wrap gap-3 items-center">
							<SourceDrawer :sources="candidate.funding.sources" title="Campaign funding sources" />
							<NuxtLink :to="`/candidate/${candidate.slug}/funding`" class="btn-secondary">
								Full funding details
							</NuxtLink>
						</div>
					</template>
					<div class="mt-6 gap-4 grid md:grid-cols-3">
						<div class="content-block">
							<p class="text-xs text-app-muted tracking-[0.06em] font-semibold uppercase dark:text-app-muted-dark">
								Raised
							</p>
							<p class="text-2xl text-app-ink font-semibold mt-2 dark:text-app-text-dark">
								{{ formatCurrency(candidate.funding.totalRaised) }}
							</p>
						</div>
						<div class="content-block">
							<p class="text-xs text-app-muted tracking-[0.06em] font-semibold uppercase dark:text-app-muted-dark">
								Cash on hand
							</p>
							<p class="text-2xl text-app-ink font-semibold mt-2 dark:text-app-text-dark">
								{{ formatCurrency(candidate.funding.cashOnHand) }}
							</p>
						</div>
						<div class="content-block">
							<p class="text-xs text-app-muted tracking-[0.06em] font-semibold uppercase dark:text-app-muted-dark">
								Small donors
							</p>
							<p class="text-2xl text-app-ink font-semibold mt-2 dark:text-app-text-dark">
								{{ formatPercent(candidate.funding.smallDonorShare) }}
							</p>
						</div>
					</div>
					<p class="text-base text-app-ink leading-7 mt-6 dark:text-app-text-dark">
						{{ candidate.funding.summary }}
					</p>
				</ExpandableSection>

				<ExpandableSection
					id="influence"
					eyebrow="Lobbying & influence context"
					title="Influence"
				>
					<template #meta>
						<div class="flex flex-wrap gap-3 items-center">
							<SourceDrawer :sources="candidate.lobbyingContext.flatMap(block => block.sources)" :title="`${candidate.name} influence context`" />
							<NuxtLink :to="`/candidate/${candidate.slug}/influence`" class="btn-secondary">
								Full influence details
							</NuxtLink>
						</div>
					</template>
					<p class="text-sm text-app-muted mt-3 dark:text-app-muted-dark">
						Context only. Not proof that any donor or organization influenced a decision.
					</p>
				</ExpandableSection>

				<ExpandableSection
					id="sources"
					title="Sources"
				>
					<NuxtLink :to="reportIssueTo" class="text-sm btn-secondary mt-4 xl:hidden">
						Report an issue
					</NuxtLink>
					<div class="mt-6">
						<SourceList :sources="candidate.sources" />
					</div>
				</ExpandableSection>
			</div>

			<aside class="detail-layout__aside">
				<PageSectionNav
					title="On this page"
					:breadcrumbs="candidateBreadcrumbs"
					:items="sectionLinks.map(section => ({ href: section.href, label: section.label }))"
				>
					<template #actions>
						<NuxtLink :to="reportIssueTo" class="text-sm btn-secondary">
							Report an issue
						</NuxtLink>
					</template>
				</PageSectionNav>
			</aside>
		</div>
	</section>
</template>
