<script setup lang="ts">
import type { Source, SourceType } from "~/types/civic";
import { storeToRefs } from "pinia";
import { contactEmail, currentCoverageElectionSlug, currentCoverageLocationSlug } from "~/constants";

const civicStore = useCivicStore();
const route = useRoute();
const runtimeConfig = useRuntimeConfig();
const siteUrl = useSiteUrl();
const { ballotPlan, isHydrated } = storeToRefs(civicStore);
const measureSlug = computed(() => String(route.params.slug));
const { data: measure, error, pending } = await useMeasure(measureSlug);
const effectiveBallotPlan = computed(() => isHydrated.value ? ballotPlan.value : {});
const electionOverviewHref = `/elections/${currentCoverageElectionSlug}`;
const locationHubHref = `/locations/${currentCoverageLocationSlug}`;
const sectionLinks = [
	{ href: "#at-a-glance", label: "At a glance" },
	{ href: "#baseline", label: "Current law" },
	{ href: "#outcomes", label: "YES / NO" },
	{ href: "#implementation", label: "Timeline" },
	{ href: "#fiscal", label: "Fiscal impact" },
	{ href: "#arguments", label: "Arguments" },
	{ href: "#sources", label: "Sources" }
] as const;

const sourceTypeLabels: Record<SourceType, string> = {
	"campaign filing": "Campaign filing",
	"ethics filing": "Ethics filing",
	"hearing transcript": "Hearing transcript",
	"official record": "Official record",
	"policy memo": "Policy memo",
	"questionnaire": "Questionnaire",
	"research brief": "Research brief",
	"voter guide": "Official voter guide"
};

function uniqueSources(sources: Source[]) {
	const seen = new Map<string, Source>();

	for (const source of sources)
		seen.set(source.id, source);

	return [...seen.values()];
}

const measureJsonHref = computed(() => measure.value ? `${runtimeConfig.public.apiBase}/measures/${measure.value.slug}` : "");
const measureBreadcrumbs = computed(() => [
	{ label: "Home", to: "/" },
	{ label: "Ballot guide", to: `/ballot/${currentCoverageElectionSlug}` },
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
const presentSourceTypes = computed(() => {
	if (!measure.value)
		return [];

	return [...new Set(measure.value.sources.map(source => source.type))].map(type => sourceTypeLabels[type]);
});
const authorshipNotes = computed(() => {
	if (!measure.value)
		return [];

	return [
		"Official ballot summary: comes from the attached official record and voter-guide style sources in the project archive.",
		"Ballot Clarity summary: rewrites the source material into plain language without recommending a vote.",
		"Arguments and tradeoffs: presented as attributed positions or documented considerations, not as endorsements."
	];
});
const readabilityNotes = [
	"YES and NO meanings use mirrored wording so the legal change and status quo can be compared side by side.",
	"Current law, proposed changes, implementation timing, and fiscal notes are separated into different blocks instead of one blended summary.",
	"Argument sections stay clearly attributed so Ballot Clarity does not speak in an advocacy voice."
];
const reportIssueHref = computed(() => measure.value
	? `mailto:${contactEmail}?subject=${encodeURIComponent(`Ballot Clarity measure review: ${measure.value.title}`)}`
	: `mailto:${contactEmail}?subject=${encodeURIComponent("Ballot Clarity measure review")}`);
const currentDecision = computed(() => {
	if (!measure.value)
		return null;

	const selection = effectiveBallotPlan.value[measure.value.contestSlug];

	return selection?.type === "measure" && selection.measureSlug === measure.value.slug
		? selection.decision
		: null;
});

const measureMethodItems = computed(() => {
	if (!measure.value)
		return [];

	return [
		{
			body: [
				"This page uses the attached ballot-language summary, fiscal note, and supporting public-record documents listed in the evidence panel.",
				`The current measure page links ${measure.value.sources.length} source records for inspection.`,
			],
			label: "Sources"
		},
		{
			body: [
				"Ballot Clarity rewrites ballot language into plain language while keeping the original source set visible and easy to inspect.",
				"The goal is to explain the documented tradeoffs without telling the user how to vote.",
			],
			label: "Processing"
		},
		{
			body: [
				"Measures can change meaning depending on later implementation rules, legal interpretation, and budget decisions after passage.",
				"This page cannot replace the official ballot language, fiscal note, or election-office notices."
			],
			label: "Limits"
		},
	];
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
		<div v-if="pending" class="gap-8 grid xl:grid-cols-[minmax(0,1.35fr)_minmax(22rem,0.85fr)]">
			<div class="space-y-6">
				<div class="surface-panel bg-white/70 h-72 animate-pulse dark:bg-app-panel-dark/70" />
				<div v-for="index in 4" :key="index" class="surface-panel bg-white/70 h-52 animate-pulse dark:bg-app-panel-dark/70" />
			</div>
			<div class="surface-panel bg-white/70 h-96 animate-pulse dark:bg-app-panel-dark/70" />
		</div>

		<div v-else-if="error || !measure" class="max-w-3xl">
			<InfoCallout title="Measure page not available" tone="warning">
				The ballot measure detail page could not be loaded. Return to the ballot overview to choose another item.
			</InfoCallout>
		</div>

		<div v-else class="gap-8 grid xl:grid-cols-[minmax(0,1.35fr)_minmax(22rem,0.85fr)]">
			<div class="space-y-6">
				<AppBreadcrumbs :items="measureBreadcrumbs" />

				<header class="surface-panel">
					<div class="flex flex-wrap gap-2">
						<TrustBadge label="Current measure detail" tone="warning" />
						<TrustBadge label="Official text linked" tone="accent" />
						<TrustBadge label="Plain-language summary" />
					</div>
					<p class="text-xs text-app-muted tracking-[0.24em] font-semibold mt-5 uppercase dark:text-app-muted-dark">
						{{ measure.location }}
					</p>
					<h1 class="text-5xl text-app-ink leading-tight font-serif mt-3 dark:text-app-text-dark">
						{{ measure.title }}
					</h1>
					<p class="bc-measure text-base text-app-muted leading-8 mt-6 dark:text-app-muted-dark">
						{{ measure.summary }}
					</p>
					<div class="mt-6 flex flex-wrap gap-3 items-center">
						<UpdatedAt :value="measure.freshness.dataLastUpdatedAt ?? measure.updatedAt" label="Data through" />
						<span class="text-app-line dark:text-app-line-dark">•</span>
						<p class="text-sm text-app-muted dark:text-app-muted-dark">
							{{ measure.sources.length }} source records attached
						</p>
					</div>
					<div class="mt-6 flex flex-wrap gap-4">
						<SourceDrawer :sources="measure.sources" :title="`${measure.title} evidence and sources`" button-label="Evidence & sources" />
						<div class="flex flex-wrap gap-2">
							<button
								type="button"
								class="text-xs font-semibold px-3 py-2 border rounded-full transition focus-ring"
								:class="currentDecision === 'yes'
									? 'border-app-accent bg-app-accent text-white'
									: 'border-app-line bg-white text-app-muted hover:border-app-accent hover:text-app-accent dark:border-app-line-dark dark:bg-app-panel-dark dark:text-app-muted-dark'"
								@click="saveMeasure('yes')"
							>
								Mark YES
							</button>
							<button
								type="button"
								class="text-xs font-semibold px-3 py-2 border rounded-full transition focus-ring"
								:class="currentDecision === 'review'
									? 'border-app-accent bg-app-accent text-white'
									: 'border-app-line bg-white text-app-muted hover:border-app-accent hover:text-app-accent dark:border-app-line-dark dark:bg-app-panel-dark dark:text-app-muted-dark'"
								@click="saveMeasure('review')"
							>
								Review later
							</button>
							<button
								type="button"
								class="text-xs font-semibold px-3 py-2 border rounded-full transition focus-ring"
								:class="currentDecision === 'no'
									? 'border-app-accent bg-app-accent text-white'
									: 'border-app-line bg-white text-app-muted hover:border-app-accent hover:text-app-accent dark:border-app-line-dark dark:bg-app-panel-dark dark:text-app-muted-dark'"
								@click="saveMeasure('no')"
							>
								Mark NO
							</button>
						</div>
						<a v-if="measureJsonHref" :href="measureJsonHref" class="btn-secondary" rel="noreferrer" target="_blank">
							<span class="i-carbon-download" />
							Download JSON
						</a>
						<NuxtLink :to="electionOverviewHref" class="btn-secondary">
							Election overview
						</NuxtLink>
						<NuxtLink :to="`/ballot/${currentCoverageElectionSlug}`" class="btn-primary">
							Back to ballot
						</NuxtLink>
					</div>
				</header>

				<FreshnessStrip :freshness="measure.freshness" />

				<section id="at-a-glance" class="surface-panel scroll-mt-28">
					<div class="flex flex-wrap gap-4 items-start justify-between">
						<div>
							<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
								At a glance
							</p>
							<h2 class="text-3xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
								Official text and plain-language summary
							</h2>
						</div>
						<SourceDrawer :sources="officialSources.length ? officialSources : measure.sources" :title="`${measure.title} official measure sources`" button-label="Official sources" />
					</div>
					<div class="mt-6 gap-4 grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1.1fr)]">
						<article class="px-5 py-5 border border-app-line/80 rounded-3xl bg-app-bg dark:border-app-line-dark dark:bg-app-bg-dark/70">
							<div class="flex flex-wrap gap-3 items-start justify-between">
								<div>
									<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
										Official ballot summary
									</p>
									<h3 class="text-xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
										What appears in the attached official material
									</h3>
								</div>
								<TrustBadge label="Official text" tone="accent" />
							</div>
							<p class="text-sm text-app-muted leading-7 mt-4 dark:text-app-muted-dark">
								{{ measure.ballotSummary }}
							</p>
						</article>
						<article class="px-5 py-5 border border-app-line/80 rounded-3xl bg-app-bg dark:border-app-line-dark dark:bg-app-bg-dark/70">
							<div class="flex flex-wrap gap-3 items-start justify-between">
								<div>
									<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
										Ballot Clarity summary
									</p>
									<h3 class="text-xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
										Plain-language explanation
									</h3>
								</div>
								<TrustBadge label="Plain-language rewrite" />
							</div>
							<p class="text-sm text-app-muted leading-7 mt-4 dark:text-app-muted-dark">
								{{ measure.plainLanguageExplanation }}
							</p>
						</article>
					</div>
					<div class="mt-6 gap-4 grid lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
						<InfoCallout title="Who wrote what on this page">
							<ul class="space-y-2">
								<li v-for="item in authorshipNotes" :key="item">
									{{ item }}
								</li>
							</ul>
						</InfoCallout>
						<div class="px-5 py-5 border border-app-line/80 rounded-3xl bg-white/80 dark:border-app-line-dark dark:bg-app-panel-dark/70">
							<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
								Source types in this page
							</p>
							<div class="mt-4 flex flex-wrap gap-2">
								<TrustBadge
									v-for="label in presentSourceTypes"
									:key="label"
									:label="label"
								/>
							</div>
							<p class="text-sm text-app-muted leading-7 mt-4 dark:text-app-muted-dark">
								These labels help separate official text from Ballot Clarity interpretation and other supporting records in the project archive.
							</p>
						</div>
					</div>
					<div class="mt-6">
						<InfoCallout title="How this explainer stays readable">
							<ul class="space-y-2">
								<li v-for="item in readabilityNotes" :key="item">
									{{ item }}
								</li>
							</ul>
						</InfoCallout>
					</div>
				</section>

				<EpistemicSummary :known-items="measure.whatWeKnow" :unknown-items="measure.whatWeDoNotKnow" />

				<ExpandableSection
					id="baseline"
					eyebrow="Current law and proposed change"
					title="What exists now, and what this measure would change"
					:description="measure.currentLawOverview"
					open
				>
					<template #meta>
						<SourceDrawer :sources="baselineSources.length ? baselineSources : measure.sources" :title="`${measure.title} current-law and proposal sources`" button-label="Baseline sources" />
					</template>
					<div class="mt-6 gap-6 grid lg:grid-cols-2">
						<article class="px-5 py-5 border border-app-line/80 rounded-3xl bg-app-bg dark:border-app-line-dark dark:bg-app-bg-dark/70">
							<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
								Current practice
							</p>
							<ul class="mt-4 space-y-3">
								<li v-for="item in measure.currentPractice" :key="item.id" class="px-4 py-4 rounded-2xl bg-white/80 dark:bg-app-panel-dark/70">
									<div class="flex flex-wrap gap-3 items-start justify-between">
										<p class="text-sm text-app-muted leading-7 max-w-2xl dark:text-app-muted-dark">
											{{ item.text }}
										</p>
										<SourceDrawer :sources="item.sources" :title="item.text" button-label="Sources" />
									</div>
								</li>
							</ul>
						</article>
						<article class="px-5 py-5 border border-app-line/80 rounded-3xl bg-app-bg dark:border-app-line-dark dark:bg-app-bg-dark/70">
							<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
								Proposed changes
							</p>
							<ul class="mt-4 space-y-3">
								<li v-for="item in measure.proposedChanges" :key="item.id" class="px-4 py-4 rounded-2xl bg-white/80 dark:bg-app-panel-dark/70">
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
					id="outcomes"
					eyebrow="YES / NO outcomes"
					title="If you vote YES or NO"
					description="The two cards below use mirrored structure so the change from a YES vote and the status quo after a NO vote can be read side by side without scoring either option."
					open
				>
					<template #meta>
						<SourceDrawer :sources="officialSources.length ? officialSources : measure.sources" :title="`${measure.title} yes and no meanings`" button-label="Outcome sources" />
					</template>
					<div class="mt-6 gap-6 grid md:grid-cols-2">
						<article class="px-5 py-5 border border-app-line/80 rounded-3xl bg-app-bg dark:border-app-line-dark dark:bg-app-bg-dark/70">
							<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
								If you vote YES
							</p>
							<h3 class="text-2xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
								Proposed change would take effect
							</h3>
							<p class="text-sm text-app-muted leading-7 mt-4 dark:text-app-muted-dark">
								{{ measure.yesMeaning }}
							</p>
							<ul class="text-sm text-app-muted leading-7 mt-4 space-y-3 dark:text-app-muted-dark">
								<li v-for="item in measure.yesHighlights" :key="item" class="px-4 py-3 rounded-2xl bg-white/80 dark:bg-app-panel-dark/70">
									{{ item }}
								</li>
							</ul>
						</article>
						<article class="px-5 py-5 border border-app-line/80 rounded-3xl bg-app-bg dark:border-app-line-dark dark:bg-app-bg-dark/70">
							<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
								If you vote NO
							</p>
							<h3 class="text-2xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
								Current rules stay in place
							</h3>
							<p class="text-sm text-app-muted leading-7 mt-4 dark:text-app-muted-dark">
								{{ measure.noMeaning }}
							</p>
							<ul class="text-sm text-app-muted leading-7 mt-4 space-y-3 dark:text-app-muted-dark">
								<li v-for="item in measure.noHighlights" :key="item" class="px-4 py-3 rounded-2xl bg-white/80 dark:bg-app-panel-dark/70">
									{{ item }}
								</li>
							</ul>
						</article>
					</div>
				</ExpandableSection>

				<ExpandableSection
					id="implementation"
					eyebrow="Implementation timeline"
					title="When the legal change starts and what still depends on later decisions"
					:description="measure.implementationOverview"
				>
					<template #meta>
						<SourceDrawer :sources="implementationSources.length ? implementationSources : measure.sources" :title="`${measure.title} implementation timeline sources`" button-label="Timeline sources" />
					</template>
					<div class="mt-6 space-y-4">
						<article v-for="item in measure.implementationTimeline" :key="item.id" class="px-5 py-5 rounded-3xl bg-app-bg dark:bg-app-bg-dark/70">
							<div class="flex flex-wrap gap-3 items-start justify-between">
								<div>
									<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
										{{ item.label }}
									</p>
									<h3 class="text-xl text-app-ink font-serif mt-2 dark:text-app-text-dark">
										{{ item.timing }}
									</h3>
								</div>
								<SourceDrawer :sources="item.sources" :title="item.label" button-label="Sources" />
							</div>
							<p class="text-sm text-app-muted leading-7 mt-4 dark:text-app-muted-dark">
								{{ item.summary }}
							</p>
						</article>
					</div>
				</ExpandableSection>

				<ExpandableSection
					id="fiscal"
					eyebrow="Fiscal impact and tradeoffs"
					title="Costs, timing, and practical effects"
				>
					<template #meta>
						<SourceDrawer :sources="fiscalAndTradeoffSources" :title="`${measure.title} fiscal and tradeoff sources`" />
					</template>
					<InfoCallout class="mt-5" title="Fiscal and context note">
						{{ measure.fiscalContextNote }}
					</InfoCallout>
					<div class="mt-6 gap-4 grid lg:grid-cols-3">
						<article v-for="item in measure.fiscalSummary" :key="item.id" class="px-5 py-5 border border-app-line/80 rounded-3xl bg-app-bg dark:border-app-line-dark dark:bg-app-bg-dark/70">
							<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
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
						<article v-for="impact in measure.potentialImpacts" :key="impact.id" class="px-5 py-5 rounded-3xl bg-app-bg dark:bg-app-bg-dark/70">
							<div class="flex flex-wrap gap-3 items-start justify-between">
								<h3 class="text-lg text-app-ink font-semibold dark:text-app-text-dark">
									{{ impact.title }}
								</h3>
								<SourceDrawer :sources="impact.sources" :title="impact.title" button-label="Sources" />
							</div>
							<p class="text-sm text-app-muted leading-7 mt-3 dark:text-app-muted-dark">
								{{ impact.summary }}
							</p>
						</article>
					</div>
					<div class="mt-6 space-y-4">
						<article v-for="item in measure.argumentsAndConsiderations" :key="item.id" class="px-5 py-5 rounded-3xl bg-white/80 dark:bg-app-panel-dark/70">
							<div class="flex flex-wrap gap-3 items-start justify-between">
								<h3 class="text-lg text-app-ink font-semibold dark:text-app-text-dark">
									{{ item.title }}
								</h3>
								<SourceDrawer :sources="item.sources" :title="item.title" button-label="Sources" />
							</div>
							<p class="text-sm text-app-muted leading-7 mt-3 dark:text-app-muted-dark">
								{{ item.summary }}
							</p>
						</article>
					</div>
				</ExpandableSection>

				<ExpandableSection
					id="arguments"
					eyebrow="Arguments in the attached record"
					title="Attributed arguments for and against"
					description="These are parallel argument summaries drawn from the attached record set. They are framed neutrally so the user can compare the reasoning without the page taking a side."
				>
					<template #meta>
						<SourceDrawer :sources="argumentSources" :title="`${measure.title} support and oppose arguments`" />
					</template>
					<InfoCallout class="mt-5" title="Arguments are attributed, not adopted">
						{{ measure.argumentsDisclaimer }}
					</InfoCallout>
					<div class="mt-6 gap-6 grid lg:grid-cols-2">
						<div class="space-y-4">
							<div class="flex flex-wrap gap-2 items-center">
								<TrustBadge label="Arguments emphasizing approval" tone="accent" />
							</div>
							<article v-for="item in measure.supportArguments" :key="item.id" class="px-5 py-5 rounded-3xl bg-app-bg dark:bg-app-bg-dark/70">
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
								<p class="text-sm text-app-muted leading-7 mt-3 dark:text-app-muted-dark">
									{{ item.summary }}
								</p>
							</article>
						</div>
						<div class="space-y-4">
							<div class="flex flex-wrap gap-2 items-center">
								<TrustBadge label="Arguments emphasizing rejection" />
							</div>
							<article v-for="item in measure.opposeArguments" :key="item.id" class="px-5 py-5 rounded-3xl bg-app-bg dark:bg-app-bg-dark/70">
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
								<p class="text-sm text-app-muted leading-7 mt-3 dark:text-app-muted-dark">
									{{ item.summary }}
								</p>
							</article>
						</div>
					</div>
				</ExpandableSection>

				<ExpandableSection
					id="sources"
					eyebrow="Full text and official sources"
					title="Inspect the original records"
					description="Official ballot language, fiscal notes, and county guide records remain the primary sources. Ballot Clarity adds a reading aid on top of those materials; it does not replace them."
				>
					<template #meta>
						<SourceDrawer :sources="measure.sources" :title="`${measure.title} full source list`" />
					</template>
					<div class="mt-6">
						<SourceList :sources="officialSources.length ? officialSources : measure.sources" title="Official source trail in this guide" />
					</div>
				</ExpandableSection>
			</div>

			<aside class="xl:self-start xl:top-28 xl:sticky">
				<PageSectionNav
					title="Jump to section"
					description="Read the overview first, then open only the parts of the measure you need."
					:items="sectionLinks.map(section => ({ href: section.href, label: section.label }))"
				/>

				<div class="mt-4 surface-panel">
					<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
						Evidence rail
					</p>
					<p class="text-sm text-app-muted leading-7 mt-3 dark:text-app-muted-dark">
						Use this rail for the full source archive, method notes, and official links while you read the measure explanation.
					</p>
					<div class="mt-5 space-y-3">
						<UpdatedAt :value="measure.freshness.dataLastUpdatedAt ?? measure.updatedAt" label="Data through" />
						<p class="text-sm text-app-muted leading-7 dark:text-app-muted-dark">
							{{ measure.freshness.statusNote }}
						</p>
					</div>
					<div class="mt-4 flex flex-wrap gap-3">
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
					<InfoCallout class="mt-5" title="Source-first reminder">
						This explainer is a neutral reading aid. Official ballot language, fiscal notes, and election-office notices remain the primary sources.
					</InfoCallout>
					<div class="mt-6">
						<MethodologySummaryCard
							:items="measureMethodItems"
							summary="This page keeps the official measure text visible, separates Ballot Clarity interpretation from source material, and states what remains uncertain."
						/>
					</div>
					<div class="mt-6">
						<SourceList :sources="measure.sources" compact title="Attached sources" />
					</div>
				</div>
			</aside>
		</div>
	</section>
</template>
