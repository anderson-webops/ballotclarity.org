<script setup lang="ts">
import { storeToRefs } from "pinia";
import { hasLongMeasureOptions, measureBallotOptions, measureContent, measureDecisionEffectLabel, measureGuideLink } from "~/utils/measure-content";

const civicStore = useCivicStore();
const siteUrl = useSiteUrl();
const { backToLayerLink: fallbackBackLink, layerBreadcrumbLink: fallbackBreadcrumbLink, openLayerLink } = useRouteLayerNavigation();
const { ballotPlan, isHydrated } = storeToRefs(civicStore);
const { formatDate } = useFormatters();
const measureSlug = useRouteStringParam("slug");
const route = useRoute();
const electionContext = computed(() => route.query.election === undefined ? undefined : typeof route.query.election === "string" ? route.query.election : "");
const { data: measure, error, pending } = await useMeasure(measureSlug, electionContext);
const parentGuideLink = computed(() => measureGuideLink(measure.value));
const backToLayerLink = computed(() => parentGuideLink.value
	? { label: "Back to ballot", to: parentGuideLink.value.to }
	: fallbackBackLink.value);
const content = computed(() => measureContent(measure.value));
const ballotOptions = computed(() => measureBallotOptions(measure.value));
const effectiveBallotPlan = computed(() => isHydrated.value ? ballotPlan.value : {});
const hasSection = (id: string) => content.value.sections.some(section => section.href === `#${id}`);
const baselineTitle = computed(() => content.value.sections.find(section => section.href === "#baseline")?.label ?? "Current law");
const measureBreadcrumbs = computed(() => [
	{ label: "Home", to: "/" },
	parentGuideLink.value ?? fallbackBreadcrumbLink.value,
	{ label: measure.value?.title ?? "Measure explainer" },
]);
const reportIssueTo = computed(() => ({
	path: "/contact",
	query: { pageUrl: `/measure/${measure.value?.slug ?? measureSlug.value}`, subject: measure.value ? `Ballot Clarity measure review: ${measure.value.title}` : "Ballot Clarity measure review", type: "correction" },
}));
const currentDecision = computed(() => {
	if (!measure.value) return null;
	const selection = effectiveBallotPlan.value[measure.value.contestSlug];
	return selection?.type === "measure" && selection.measureSlug === measure.value.slug ? selection.decision : null;
});

usePageSeo({
	description: measure.value?.summary ?? "Review a ballot measure explanation with sources.",
	jsonLd: measure.value && measure.value.decisionEffect !== "advisory"
		? {
				"@context": "https://schema.org",
				"@type": "Legislation",
				"abstract": measure.value.summary,
				"dateModified": measure.value.updatedAt,
				"legislationIdentifier": measure.value.slug,
				"legislationJurisdiction": { "@type": "AdministrativeArea", "name": measure.value.location },
				"legislationType": "BallotMeasure",
				"name": measure.value.title,
				"url": `${siteUrl}/measure/${measure.value.slug}`,
			}
		: undefined,
	ogType: "article",
	path: `/measure/${measureSlug.value}`,
	title: measure.value?.title ?? "Ballot measure detail",
});

function saveMeasure(decision: "no" | "review" | "yes") {
	if (measure.value) civicStore.selectMeasureForPlan(measure.value.contestSlug, measure.value.slug, decision);
}
</script>

<template>
	<section class="app-shell section-gap">
		<div v-if="pending" class="detail-layout">
			<div class="space-y-6">
				<div class="rounded-lg bg-app-bg h-72 animate-pulse dark:bg-app-bg-dark" />
				<div v-for="index in 4" :key="index" class="rounded-lg bg-app-bg h-52 animate-pulse dark:bg-app-bg-dark" />
			</div>
		</div>
		<GuideUnavailableState
			v-else-if="error || !measure"
			message=""
			:primary-label="openLayerLink.label"
			:primary-to="openLayerLink.to"
			secondary-label="Coverage"
			secondary-to="/coverage"
			title="Measure unavailable"
		/>
		<div v-else class="detail-layout">
			<div class="space-y-8">
				<header>
					<NuxtLink :to="backToLayerLink.to" class="text-sm text-app-accent underline focus-ring">
						{{ backToLayerLink.label }}
					</NuxtLink>
					<h1 class="text-4xl text-app-ink leading-tight font-serif mt-4 sm:text-5xl dark:text-app-text-dark">
						{{ measure.title }}
					</h1>
					<p class="text-base text-app-muted mt-3 dark:text-app-muted-dark">
						{{ measure.location }}<template v-if="measure.electionDate">
							· {{ formatDate(measure.electionDate) }}
						</template>
						<template v-if="measure.decisionEffect === 'advisory'">
							· {{ measureDecisionEffectLabel(measure) }}
						</template>
					</p>
					<p v-if="measure.summary" class="bc-measure text-lg text-app-ink leading-8 mt-5 dark:text-app-text-dark">
						{{ measure.summary }}
					</p>
				</header>

				<ExpandableSection v-if="hasSection('fiscal')" id="fiscal" title="Fiscal impact">
					<p v-if="measure.fiscalContextNote" class="text-base leading-7 mt-3">
						{{ measure.fiscalContextNote }}
					</p>
					<dl v-if="measure.fiscalSummary.length" class="mt-4 space-y-5">
						<div v-for="item in measure.fiscalSummary" :key="item.id">
							<dt class="text-lg font-semibold">
								{{ item.label }}
							</dt>
							<dd class="mt-2">
								<p class="text-2xl font-serif">
									{{ item.value }}
								</p>
								<p v-if="item.scope || item.horizon" class="text-sm text-app-muted mt-2 dark:text-app-muted-dark">
									{{ [item.scope, item.horizon].filter(Boolean).join(' · ') }}
								</p>
								<p v-if="item.note" class="text-sm leading-7 mt-2">
									{{ item.note }}
								</p>
							</dd>
						</div>
					</dl>
					<article v-for="item in [...measure.potentialImpacts, ...measure.argumentsAndConsiderations]" :key="item.id" class="mt-5">
						<h3 class="text-lg font-semibold">
							{{ item.title }}
						</h3>
						<p class="text-base leading-7 mt-2">
							{{ item.summary }}
						</p>
					</article>
				</ExpandableSection>

				<section v-if="hasSection('limitations')" id="limitations" class="pl-4 border-app-line border-l-2 scroll-mt-28 dark:border-app-line-dark" aria-labelledby="measure-limitations-title">
					<h2 id="measure-limitations-title" class="text-base font-semibold">
						Limitations
					</h2>
					<ul class="text-sm leading-7 mt-2 space-y-2">
						<li v-for="item in measure.whatWeDoNotKnow" :key="item.id">
							{{ item.text }}
						</li>
					</ul>
				</section>

				<section v-if="hasSection('outcomes')" id="outcomes" class="scroll-mt-28" aria-labelledby="measure-outcomes-title">
					<div class="flex flex-wrap gap-4 items-center justify-between">
						<h2 id="measure-outcomes-title" class="text-2xl font-serif">
							{{ hasLongMeasureOptions(measure) ? 'Vote options' : `${ballotOptions.yes} / ${ballotOptions.no}` }}
						</h2>
						<div class="measure-decision" :class="{ 'measure-decision--long': hasLongMeasureOptions(measure) }" role="group" aria-label="Save your choice to your ballot plan">
							<button type="button" class="measure-decision__option focus-ring" :aria-pressed="currentDecision === 'yes'" @click="saveMeasure('yes')">
								{{ ballotOptions.yes }}
							</button>
							<button type="button" class="measure-decision__option focus-ring" :aria-pressed="currentDecision === 'review'" @click="saveMeasure('review')">
								Undecided
							</button>
							<button type="button" class="measure-decision__option focus-ring" :aria-pressed="currentDecision === 'no'" @click="saveMeasure('no')">
								{{ ballotOptions.no }}
							</button>
						</div>
					</div>
					<div class="mt-5 gap-6 grid md:grid-cols-2">
						<article v-for="outcome in [{ label: ballotOptions.yes, meaning: measure.yesMeaning, highlights: measure.yesHighlights }, { label: ballotOptions.no, meaning: measure.noMeaning, highlights: measure.noHighlights }]" :key="outcome.label" class="content-block">
							<h3 class="text-lg font-semibold">
								{{ outcome.label }}
							</h3>
							<p v-if="outcome.meaning" class="text-base leading-7 mt-2">
								{{ outcome.meaning }}
							</p>
							<p v-else-if="!outcome.highlights.length" class="text-sm text-app-muted mt-2 dark:text-app-muted-dark">
								No sourced explanation.
							</p>
							<ul v-if="outcome.highlights.length" class="text-sm leading-7 mt-3 space-y-2">
								<li v-for="item in outcome.highlights" :key="item">
									{{ item }}
								</li>
							</ul>
						</article>
					</div>
				</section>

				<section v-if="hasSection('at-a-glance')" id="at-a-glance" class="scroll-mt-28 space-y-5" aria-label="Summary">
					<article v-for="summary in content.summaries" :key="summary.title">
						<h2 class="text-2xl font-serif">
							{{ summary.title }}
						</h2>
						<p class="text-base leading-7 mt-3">
							{{ summary.text }}
						</p>
					</article>
				</section>

				<ExpandableSection v-if="hasSection('baseline')" id="baseline" :title="baselineTitle">
					<p v-if="measure.currentLawOverview" class="text-base leading-7 mt-3">
						{{ measure.currentLawOverview }}
					</p>
					<div class="mt-4 space-y-5">
						<article v-for="group in [{ title: 'Current practice', items: measure.currentPractice }, { title: 'Proposed changes', items: measure.proposedChanges }].filter(group => group.items.length)" :key="group.title">
							<h3 v-if="measure.currentPractice.length && measure.proposedChanges.length" class="text-lg font-semibold">
								{{ group.title }}
							</h3>
							<ul class="text-base leading-7 space-y-3">
								<li v-for="item in group.items" :key="item.id">
									{{ item.text }}
								</li>
							</ul>
						</article>
					</div>
				</ExpandableSection>

				<ExpandableSection v-if="hasSection('implementation')" id="implementation" title="Timeline">
					<p v-if="measure.implementationOverview" class="text-base leading-7 mt-3">
						{{ measure.implementationOverview }}
					</p>
					<div class="mt-4 space-y-5">
						<article v-for="item in measure.implementationTimeline" :key="item.id">
							<h3 class="text-lg font-semibold">
								{{ item.label }}
							</h3>
							<p class="text-base leading-7 mt-2">
								{{ item.timing }}
							</p>
							<p v-if="item.summary" class="text-sm leading-7 mt-2">
								{{ item.summary }}
							</p>
						</article>
					</div>
				</ExpandableSection>

				<ExpandableSection v-if="hasSection('arguments')" id="arguments" title="Arguments">
					<p v-if="measure.argumentsDisclaimer" class="text-sm leading-7 mt-3">
						{{ measure.argumentsDisclaimer }}
					</p>
					<div class="mt-4 gap-6 grid md:grid-cols-2">
						<article v-for="side in [{ title: 'For', items: measure.supportArguments }, { title: 'Against', items: measure.opposeArguments }]" :key="side.title">
							<h3 class="text-xl font-serif">
								{{ side.title }}
							</h3>
							<p v-if="!side.items.length" class="text-sm text-app-muted mt-3 dark:text-app-muted-dark">
								No sourced argument included.
							</p>
							<div v-for="item in side.items" :key="item.id" class="mt-4">
								<h4 class="text-base font-semibold">
									{{ item.title }}
								</h4>
								<p class="text-sm text-app-muted mt-1 dark:text-app-muted-dark">
									{{ item.attribution }}
								</p>
								<p class="text-base leading-7 mt-2">
									{{ item.summary }}
								</p>
							</div>
						</article>
					</div>
				</ExpandableSection>

				<ExpandableSection v-if="hasSection('sources')" id="sources" title="Sources">
					<div v-if="measure.freshness.contentLastVerifiedAt" class="mt-3">
						<UpdatedAt :value="measure.freshness.contentLastVerifiedAt" label="Reviewed" />
					</div>
					<p v-if="measure.freshness.statusNote" class="text-sm leading-7 mt-2">
						{{ measure.freshness.statusNote }}
					</p>
					<ul v-if="measure.whatWeKnow.length" class="text-sm leading-7 mt-4 space-y-2">
						<li v-for="item in measure.whatWeKnow" :key="item.id">
							{{ item.text }}
						</li>
					</ul>
					<SourceList v-if="content.sources.length" :sources="content.sources" direct class="mt-4" />
					<NuxtLink :to="reportIssueTo" class="text-sm text-app-accent mt-5 underline inline-block focus-ring">
						Report an issue
					</NuxtLink>
				</ExpandableSection>
			</div>
			<aside class="detail-layout__aside">
				<PageSectionNav title="On this page" :breadcrumbs="measureBreadcrumbs" :items="content.sections" />
			</aside>
		</div>
	</section>
</template>
