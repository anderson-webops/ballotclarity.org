<script setup lang="ts">
import type { Source } from "~/types/civic";
import { storeToRefs } from "pinia";

const civicStore = useCivicStore();
const siteUrl = useSiteUrl();
const { backToLayerLink, layerBreadcrumbLink, openLayerLink } = useRouteLayerNavigation();
const { ballotPlan, isHydrated } = storeToRefs(civicStore);
const { formatDateTime } = useFormatters();
const measureSlug = useRouteStringParam("slug");
const { data: measure, error, pending } = await useMeasure(measureSlug);
const effectiveBallotPlan = computed(() => isHydrated.value ? ballotPlan.value : {});
const sectionLinks = [
	{ href: "#at-a-glance", label: "Summary" },
	{ href: "#outcomes", label: "YES / NO" },
	{ href: "#baseline", label: "Current law" },
	{ href: "#implementation", label: "Timeline" },
	{ href: "#fiscal", label: "Fiscal impact" },
	{ href: "#arguments", label: "Arguments" },
	{ href: "#sources", label: "Sources" }
] as const;

function uniqueSources(sources: Source[]) {
	const seen = new Map<string, Source>();

	for (const source of sources)
		seen.set(source.id, source);

	return [...seen.values()];
}

const measureBreadcrumbs = computed(() => [
	{ label: "Home", to: "/" },
	layerBreadcrumbLink.value,
	{ label: measure.value?.title ?? "Measure explainer" }
]);
const officialSources = computed(() => {
	if (!measure.value)
		return [];

	return uniqueSources(measure.value.sources.filter(source => ["official record", "voter guide"].includes(source.type)));
});
const baselineSources = computed(() => {
	if (!measure.value)
		return [];

	return uniqueSources([
		...measure.value.currentPractice.flatMap(item => item.sources),
		...measure.value.proposedChanges.flatMap(item => item.sources),
	]);
});
const fiscalAndTradeoffSources = computed(() => {
	if (!measure.value)
		return [];

	return uniqueSources([
		...measure.value.fiscalSummary.flatMap(item => item.sources),
		...measure.value.potentialImpacts.flatMap(item => item.sources),
		...measure.value.argumentsAndConsiderations.flatMap(item => item.sources)
	]);
});
const implementationSources = computed(() => {
	if (!measure.value)
		return [];

	return uniqueSources(measure.value.implementationTimeline.flatMap(item => item.sources));
});
const argumentSources = computed(() => {
	if (!measure.value)
		return [];

	return uniqueSources([
		...measure.value.supportArguments.flatMap(item => item.sources),
		...measure.value.opposeArguments.flatMap(item => item.sources)
	]);
});

const reportIssueTo = computed(() => ({
	path: "/contact",
	query: {
		pageUrl: `/measure/${measure.value?.slug ?? measureSlug.value}`,
		subject: measure.value
			? `Ballot Clarity measure review: ${measure.value.title}`
			: "Ballot Clarity measure review",
		type: "correction"
	}
}));
const currentDecision = computed(() => {
	if (!measure.value)
		return null;

	const selection = effectiveBallotPlan.value[measure.value.contestSlug];

	return selection?.type === "measure" && selection.measureSlug === measure.value.slug
		? selection.decision
		: null;
});

usePageSeo({
	description: measure.value?.summary ?? "Review a plain-language ballot measure explanation with sources.",
	jsonLd: measure.value
		? {
				"@context": "https://schema.org",
				"@type": "Legislation",
				"abstract": measure.value.summary,
				"dateModified": measure.value.updatedAt,
				"datePublished": measure.value.updatedAt,
				"legislationIdentifier": measure.value.slug,
				"legislationJurisdiction": {
					"@type": "AdministrativeArea",
					"name": measure.value.location
				},
				"legislationType": "BallotMeasure",
				"name": measure.value.title,
				"url": `${siteUrl}/measure/${measure.value.slug}`
			}
		: undefined,
	ogType: "article",
	path: `/measure/${measureSlug.value}`,
	title: measure.value?.title ?? "Ballot measure detail",
});

function saveMeasure(decision: "no" | "review" | "yes") {
	if (measure.value)
		civicStore.selectMeasureForPlan(measure.value.contestSlug, measure.value.slug, decision);
}
</script>

<template>
	<section class="app-shell section-gap">
		<div v-if="pending" class="detail-layout">
			<div class="space-y-6">
				<div class="rounded-lg bg-app-bg h-72 animate-pulse dark:bg-app-bg-dark" />
				<div v-for="index in 4" :key="index" class="rounded-lg bg-app-bg h-52 animate-pulse dark:bg-app-bg-dark" />
			</div>
			<div class="rounded-lg bg-app-bg h-96 animate-pulse dark:bg-app-bg-dark" />
		</div>

		<GuideUnavailableState
			v-else-if="error || !measure"
			message="This measure isn't published yet."
			:primary-label="openLayerLink.label"
			:primary-to="openLayerLink.to"
			secondary-label="Coverage"
			secondary-to="/coverage"
			tertiary-label="Report missing information"
			tertiary-to="/contact"
			title="Measure page not published yet"
		/>

		<div v-else class="detail-layout">
			<div class="space-y-6">
				<header class="surface-panel">
					<p class="text-xs text-app-muted tracking-[0.06em] font-semibold uppercase dark:text-app-muted-dark">
						{{ measure.location }}
					</p>
					<h1 class="text-5xl text-app-ink leading-tight font-serif mt-3 dark:text-app-text-dark">
						{{ measure.title }}
					</h1>
					<p class="bc-measure text-lg text-app-ink leading-8 mt-5 dark:text-app-text-dark">
						{{ measure.summary }}
					</p>
					<div class="mt-6 flex flex-wrap gap-3 items-center">
						<UpdatedAt :value="measure.freshness.dataLastUpdatedAt ?? measure.updatedAt" label="Data through" />
						<SourceDrawer :sources="measure.sources" :title="`${measure.title} sources`" button-label="Sources" />
					</div>
					<div class="mt-6 flex flex-wrap gap-x-6 gap-y-3 items-center">
						<div class="measure-decision" role="group" aria-label="Save your choice to your ballot plan">
							<button
								type="button"
								class="measure-decision__option focus-ring"
								:aria-pressed="currentDecision === 'yes'"
								@click="saveMeasure('yes')"
							>
								Yes
							</button>
							<button
								type="button"
								class="measure-decision__option focus-ring"
								:aria-pressed="currentDecision === 'review'"
								@click="saveMeasure('review')"
							>
								Undecided
							</button>
							<button
								type="button"
								class="measure-decision__option focus-ring"
								:aria-pressed="currentDecision === 'no'"
								@click="saveMeasure('no')"
							>
								No
							</button>
						</div>
						<NuxtLink :to="backToLayerLink.to" class="btn-secondary">
							{{ backToLayerLink.label }}
						</NuxtLink>
					</div>
				</header>

				<section id="at-a-glance" class="gap-8 grid scroll-mt-28 lg:grid-cols-2" aria-label="Summary">
					<article>
						<div class="flex flex-wrap gap-3 items-baseline justify-between">
							<h2 class="text-lg text-app-ink font-semibold dark:text-app-text-dark">
								Official ballot summary
							</h2>
							<SourceDrawer :sources="officialSources.length ? officialSources : measure.sources" :title="`${measure.title} official sources`" button-label="Sources" />
						</div>
						<p class="text-base text-app-ink leading-7 mt-2 dark:text-app-text-dark">
							{{ measure.ballotSummary }}
						</p>
					</article>
					<article>
						<h2 class="text-lg text-app-ink font-semibold dark:text-app-text-dark">
							In plain language
						</h2>
						<p class="text-base text-app-ink leading-7 mt-2 dark:text-app-text-dark">
							{{ measure.plainLanguageExplanation }}
						</p>
					</article>
				</section>

				<ExpandableSection
					id="outcomes"
					eyebrow="YES / NO outcomes"
					title="If you vote YES or NO"
					open
				>
					<template #meta>
						<SourceDrawer :sources="officialSources.length ? officialSources : measure.sources" :title="`${measure.title} yes and no meanings`" button-label="Outcome sources" />
					</template>
					<div class="mt-6 gap-6 grid md:grid-cols-2">
						<article class="content-block">
							<p class="text-xs text-app-muted tracking-[0.06em] font-semibold uppercase dark:text-app-muted-dark">
								If you vote YES
							</p>
							<h3 class="text-2xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
								Proposed change would take effect
							</h3>
							<p class="text-base text-app-ink leading-7 mt-4 dark:text-app-text-dark">
								{{ measure.yesMeaning }}
							</p>
							<ul class="text-sm text-app-muted leading-7 mt-4 space-y-3 dark:text-app-muted-dark">
								<li v-for="item in measure.yesHighlights" :key="item" class="content-block">
									{{ item }}
								</li>
							</ul>
						</article>
						<article class="content-block">
							<p class="text-xs text-app-muted tracking-[0.06em] font-semibold uppercase dark:text-app-muted-dark">
								If you vote NO
							</p>
							<h3 class="text-2xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
								Current rules stay in place
							</h3>
							<p class="text-base text-app-ink leading-7 mt-4 dark:text-app-text-dark">
								{{ measure.noMeaning }}
							</p>
							<ul class="text-sm text-app-muted leading-7 mt-4 space-y-3 dark:text-app-muted-dark">
								<li v-for="item in measure.noHighlights" :key="item" class="content-block">
									{{ item }}
								</li>
							</ul>
						</article>
					</div>
				</ExpandableSection>

				<ExpandableSection
					id="baseline"
					eyebrow="Current law and proposed change"
					title="Current law and proposed change"
					:description="measure.currentLawOverview"
					open
				>
					<template #meta>
						<SourceDrawer :sources="baselineSources.length ? baselineSources : measure.sources" :title="`${measure.title} current-law and proposal sources`" button-label="Baseline sources" />
					</template>
					<div class="mt-6 gap-6 grid lg:grid-cols-2">
						<article class="content-block">
							<p class="text-xs text-app-muted tracking-[0.06em] font-semibold uppercase dark:text-app-muted-dark">
								Current practice
							</p>
							<ul class="mt-4 space-y-3">
								<li v-for="item in measure.currentPractice" :key="item.id" class="content-block">
									<div class="flex flex-wrap gap-3 items-start justify-between">
										<p class="text-sm text-app-muted leading-7 max-w-2xl dark:text-app-muted-dark">
											{{ item.text }}
										</p>
										<SourceDrawer :sources="item.sources" :title="item.text" button-label="Sources" />
									</div>
								</li>
							</ul>
						</article>
						<article class="content-block">
							<p class="text-xs text-app-muted tracking-[0.06em] font-semibold uppercase dark:text-app-muted-dark">
								Proposed changes
							</p>
							<ul class="mt-4 space-y-3">
								<li v-for="item in measure.proposedChanges" :key="item.id" class="content-block">
									<div class="flex flex-wrap gap-3 items-start justify-between">
										<p class="text-sm text-app-muted leading-7 max-w-2xl dark:text-app-muted-dark">
											{{ item.text }}
										</p>
										<SourceDrawer :sources="item.sources" :title="item.text" button-label="Sources" />
									</div>
								</li>
							</ul>
						</article>
					</div>
				</ExpandableSection>

				<ExpandableSection
					id="implementation"
					eyebrow="Implementation timeline"
					title="Implementation"
					:description="measure.implementationOverview"
				>
					<template #meta>
						<SourceDrawer :sources="implementationSources.length ? implementationSources : measure.sources" :title="`${measure.title} implementation timeline sources`" button-label="Timeline sources" />
					</template>
					<div class="mt-6 space-y-4">
						<article v-for="item in measure.implementationTimeline" :key="item.id" class="content-block">
							<div class="flex flex-wrap gap-3 items-start justify-between">
								<div>
									<p class="text-xs text-app-muted tracking-[0.06em] font-semibold uppercase dark:text-app-muted-dark">
										{{ item.label }}
									</p>
									<h3 class="text-xl text-app-ink font-serif mt-2 dark:text-app-text-dark">
										{{ item.timing }}
									</h3>
								</div>
								<SourceDrawer :sources="item.sources" :title="item.label" button-label="Sources" />
							</div>
							<p class="text-base text-app-ink leading-7 mt-4 dark:text-app-text-dark">
								{{ item.summary }}
							</p>
						</article>
					</div>
				</ExpandableSection>

				<ExpandableSection
					id="fiscal"
					eyebrow="Fiscal impact and tradeoffs"
					title="Fiscal impact"
				>
					<template #meta>
						<SourceDrawer :sources="fiscalAndTradeoffSources" :title="`${measure.title} fiscal and tradeoff sources`" />
					</template>
					<p class="text-base text-app-ink leading-7 mt-3 dark:text-app-text-dark">
						{{ measure.fiscalContextNote }}
					</p>
					<div class="mt-6 gap-4 grid lg:grid-cols-3">
						<article v-for="item in measure.fiscalSummary" :key="item.id" class="content-block">
							<p class="text-xs text-app-muted tracking-[0.06em] font-semibold uppercase dark:text-app-muted-dark">
								{{ item.label }}
							</p>
							<p class="text-2xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
								{{ item.value }}
							</p>
							<p class="text-xs text-app-muted mt-3 dark:text-app-muted-dark">
								{{ item.scope }} · {{ item.horizon }}
							</p>
							<p class="text-sm text-app-muted leading-7 mt-4 dark:text-app-muted-dark">
								{{ item.note }}
							</p>
							<div class="mt-4">
								<SourceDrawer :sources="item.sources" :title="item.label" button-label="Sources" />
							</div>
						</article>
					</div>
					<div class="mt-6 space-y-4">
						<article v-for="impact in measure.potentialImpacts" :key="impact.id" class="content-block">
							<div class="flex flex-wrap gap-3 items-start justify-between">
								<h3 class="text-lg text-app-ink font-semibold dark:text-app-text-dark">
									{{ impact.title }}
								</h3>
								<SourceDrawer :sources="impact.sources" :title="impact.title" button-label="Sources" />
							</div>
							<p class="text-base text-app-ink leading-7 mt-3 dark:text-app-text-dark">
								{{ impact.summary }}
							</p>
						</article>
					</div>
					<div class="mt-6 space-y-4">
						<article v-for="item in measure.argumentsAndConsiderations" :key="item.id" class="content-block">
							<div class="flex flex-wrap gap-3 items-start justify-between">
								<h3 class="text-lg text-app-ink font-semibold dark:text-app-text-dark">
									{{ item.title }}
								</h3>
								<SourceDrawer :sources="item.sources" :title="item.title" button-label="Sources" />
							</div>
							<p class="text-base text-app-ink leading-7 mt-3 dark:text-app-text-dark">
								{{ item.summary }}
							</p>
						</article>
					</div>
				</ExpandableSection>

				<ExpandableSection
					id="arguments"
					eyebrow="Arguments in the attached record"
					title="Arguments for and against"
				>
					<template #meta>
						<SourceDrawer :sources="argumentSources" :title="`${measure.title} support and oppose arguments`" />
					</template>
					<p class="text-sm text-app-muted mt-3 dark:text-app-muted-dark">
						{{ measure.argumentsDisclaimer }}
					</p>
					<div class="mt-6 gap-6 grid lg:grid-cols-2">
						<div class="space-y-4">
							<h3 class="text-lg text-app-ink font-semibold dark:text-app-text-dark">
								For
							</h3>
							<article v-for="item in measure.supportArguments" :key="item.id" class="content-block">
								<div class="flex flex-wrap gap-3 items-start justify-between">
									<div>
										<h3 class="text-lg text-app-ink font-semibold dark:text-app-text-dark">
											{{ item.title }}
										</h3>
										<p class="text-xs text-app-muted mt-2 dark:text-app-muted-dark">
											{{ item.attribution }}
										</p>
									</div>
									<SourceDrawer :sources="item.sources" :title="item.title" button-label="Sources" />
								</div>
								<p class="text-base text-app-ink leading-7 mt-3 dark:text-app-text-dark">
									{{ item.summary }}
								</p>
							</article>
						</div>
						<div class="space-y-4">
							<h3 class="text-lg text-app-ink font-semibold dark:text-app-text-dark">
								Against
							</h3>
							<article v-for="item in measure.opposeArguments" :key="item.id" class="content-block">
								<div class="flex flex-wrap gap-3 items-start justify-between">
									<div>
										<h3 class="text-lg text-app-ink font-semibold dark:text-app-text-dark">
											{{ item.title }}
										</h3>
										<p class="text-xs text-app-muted mt-2 dark:text-app-muted-dark">
											{{ item.attribution }}
										</p>
									</div>
									<SourceDrawer :sources="item.sources" :title="item.title" button-label="Sources" />
								</div>
								<p class="text-base text-app-ink leading-7 mt-3 dark:text-app-text-dark">
									{{ item.summary }}
								</p>
							</article>
						</div>
					</div>
				</ExpandableSection>

				<ExpandableSection
					id="sources"
					eyebrow="Full text and official sources"
					title="Sources and review status"
				>
					<template #meta>
						<SourceDrawer :sources="measure.sources" :title="`${measure.title} full source list`" />
					</template>
					<NuxtLink :to="reportIssueTo" class="text-sm btn-secondary mt-4 xl:hidden">
						Report an issue
					</NuxtLink>
					<div class="mt-6 gap-4 grid lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
						<div class="content-block">
							<p class="text-xs text-app-muted tracking-[0.06em] font-semibold uppercase dark:text-app-muted-dark">
								Review timing
							</p>
							<div class="mt-3 space-y-3">
								<p class="text-sm text-app-muted leading-6 dark:text-app-muted-dark">
									<strong class="text-app-ink dark:text-app-text-dark">Status:</strong> {{ measure.freshness.statusLabel }}
								</p>
								<p class="text-sm text-app-muted leading-6 dark:text-app-muted-dark">
									<strong class="text-app-ink dark:text-app-text-dark">Last verified:</strong> {{ formatDateTime(measure.freshness.contentLastVerifiedAt) }}
								</p>
								<p class="text-sm text-app-muted leading-6 dark:text-app-muted-dark">
									<strong class="text-app-ink dark:text-app-text-dark">Next review:</strong> {{ formatDateTime(measure.freshness.nextReviewAt) }}
								</p>
								<p class="text-sm text-app-muted leading-6 dark:text-app-muted-dark">
									{{ measure.freshness.statusNote }}
								</p>
							</div>
						</div>
						<div class="content-block">
							<p class="text-xs text-app-muted tracking-[0.06em] font-semibold uppercase dark:text-app-muted-dark">
								Verification scope
							</p>
							<div class="mt-3 gap-3 grid md:grid-cols-2">
								<div>
									<p class="text-sm text-app-ink font-semibold dark:text-app-text-dark">
										What we know
									</p>
									<ul class="mt-2 space-y-2">
										<li v-for="item in measure.whatWeKnow" :key="item.id" class="text-sm text-app-muted leading-6 dark:text-app-muted-dark">
											{{ item.text }}
										</li>
									</ul>
								</div>
								<div>
									<p class="text-sm text-app-ink font-semibold dark:text-app-text-dark">
										Still checking
									</p>
									<ul class="mt-2 space-y-2">
										<li v-for="item in measure.whatWeDoNotKnow" :key="item.id" class="text-sm text-app-muted leading-6 dark:text-app-muted-dark">
											{{ item.text }}
										</li>
									</ul>
								</div>
							</div>
						</div>
					</div>
					<div class="mt-6">
						<SourceList :sources="officialSources.length ? officialSources : measure.sources" title="Official source trail in this guide" />
					</div>
				</ExpandableSection>
			</div>

			<aside class="detail-layout__aside">
				<PageSectionNav
					title="On this page"
					:breadcrumbs="measureBreadcrumbs"
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
