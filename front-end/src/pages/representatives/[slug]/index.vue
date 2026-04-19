<script setup lang="ts">
import { storeToRefs } from "pinia";

import { contactEmail } from "~/constants";
import { buildActiveLookupSummary } from "~/utils/active-lookup";
import { activeNationwideLookupCookieName, parseActiveNationwideLookupCookie } from "~/utils/active-nationwide-cookie";
import { buildNationwidePersonProfileResponse } from "~/utils/nationwide-person-profile";
import { buildLookupContextFromNationwideResult, buildNationwideLookupRouteQuery, buildNationwideRouteTarget } from "~/utils/nationwide-route-context";
import { buildPersonLinkageConfidence, buildPersonSummaryItems, hasPersonFunding, hasPersonInfluence } from "~/utils/person-profile";
import { resolveRepresentativePresentation } from "~/utils/representative-presentation";

const route = useRoute();
const runtimeConfig = useRuntimeConfig();
const siteUrl = useSiteUrl();
const civicStore = useCivicStore();
const { isHydrated, nationwideLookupResult, selectedLocation } = storeToRefs(civicStore);
const representativeSlug = computed(() => String(route.params.slug));
const { backToLayerLink, layerBreadcrumbLink, overviewLink } = useRouteLayerNavigation();
const { formatCurrency, formatDate, formatDateTime, formatPercent } = useFormatters();
const activeNationwideLookupCookie = useCookie<string | null>(activeNationwideLookupCookieName);
const serverNationwideLookupResult = computed(() => parseActiveNationwideLookupCookie(activeNationwideLookupCookie.value));
const activeNationwideLookupResult = computed(() => isHydrated.value ? nationwideLookupResult.value : serverNationwideLookupResult.value);
const activeLookupQuery = computed(() => buildNationwideLookupRouteQuery(
	buildLookupContextFromNationwideResult(activeNationwideLookupResult.value),
	route.query
));
const { data, error, pending } = await useRepresentative(representativeSlug, activeLookupQuery);

const fallbackData = computed(() => buildNationwidePersonProfileResponse(activeNationwideLookupResult.value, representativeSlug.value));
const profileData = computed(() => {
	if (!data.value)
		return fallbackData.value;

	if (
		data.value.person.provenance.source === "nationwide"
		&& data.value.person.provenance.status === "inferred"
		&& fallbackData.value
	) {
		return fallbackData.value;
	}

	return data.value;
});
const person = computed(() => profileData.value?.person ?? null);
const pagePending = computed(() => pending.value || (!data.value && !fallbackData.value));
const isNationwideFallback = computed(() => Boolean(profileData.value) && profileData.value === fallbackData.value);
const activeLookupSummary = computed(() => buildActiveLookupSummary({
	nationwideLookupResult: activeNationwideLookupResult.value,
	routeLookupQuery: activeLookupQuery.value?.lookup ?? null,
	selectedLocation: isHydrated.value ? selectedLocation.value : null
}));
const representativePresentation = computed(() => person.value
	? resolveRepresentativePresentation(person.value, activeNationwideLookupResult.value?.location?.state ?? null)
	: null);
const linkageConfidence = computed(() => person.value ? buildPersonLinkageConfidence(person.value.provenance.status) : null);
const dataThroughLabel = computed(() => {
	if (!person.value)
		return "";

	return formatDate(person.value.freshness.dataLastUpdatedAt ?? person.value.updatedAt);
});
function buildLookupAwareTarget(path: string) {
	return buildNationwideRouteTarget(path, buildLookupContextFromNationwideResult(activeNationwideLookupResult.value), route.query);
}
const representativeJsonHref = computed(() => {
	if (!person.value)
		return "";

	const target = new URL(`${runtimeConfig.public.apiBase}/representatives/${person.value.slug}`);
	const query = activeLookupQuery.value;

	if (query?.lookup)
		target.searchParams.set("lookup", query.lookup);

	if (query?.selection)
		target.searchParams.set("selection", query.selection);

	return target.toString();
});
const campaignLink = computed(() => {
	if (!person.value?.comparison)
		return "";

	return person.value.comparison.campaignWebsiteUrl || person.value.comparison.contactChannels[0]?.url || "";
});
const fundingStatusSummary = computed(() => person.value?.enrichmentStatus?.funding.summary
	|| "No source-backed finance summary is attached to this person record yet.");
const influenceStatusSummary = computed(() => person.value?.enrichmentStatus?.influence.summary
	|| "No lobbying or public-statement context is attached to this person record yet.");
const hasFunding = computed(() => person.value ? hasPersonFunding(person.value) : false);
const hasInfluence = computed(() => person.value ? hasPersonInfluence(person.value) : false);
const officeContext = computed(() => person.value?.officeContext ?? null);
const influence = computed(() => person.value?.influence ?? null);
const representativeLayoutKey = computed(() => person.value
	? `${person.value.slug}:${person.value.updatedAt}:${person.value.provenance.asOf}:${hasFunding.value ? "funding" : "no-funding"}:${hasInfluence.value ? "influence" : "no-influence"}`
	: "representative-profile-empty");
const breadcrumbs = computed(() => [
	{ label: "Home", to: "/" },
	{ label: layerBreadcrumbLink.value.label, to: buildLookupAwareTarget(layerBreadcrumbLink.value.to) },
	{ label: person.value?.name ?? "Representative profile" }
]);
const sectionLinks = computed(() => person.value
	? [
			{ href: "#at-a-glance", label: "At a glance" },
			{ href: "#biography", label: "Bio" },
			{ href: "#actions", label: "Actions", badge: String(person.value.keyActions.length) },
			{ href: "#funding", label: "Funding", badge: hasFunding.value ? "Live" : "None" },
			{ href: "#influence", label: "Influence", badge: hasInfluence.value ? "Live" : "None" },
			{ href: "#sources", label: "Sources", badge: String(person.value.sources.length) }
		]
	: []);
const summaryItems = computed(() => {
	if (!person.value)
		return [];

	return buildPersonSummaryItems({
		dataThroughLabel: dataThroughLabel.value,
		formatCurrency,
		fundingHref: "#funding",
		fundingStatusSummary: fundingStatusSummary.value,
		fundingTotalRaised: person.value.funding?.totalRaised ?? null,
		hasFunding: hasFunding.value,
		hasInfluence: hasInfluence.value,
		influenceHref: "#influence",
		influenceNoteCount: person.value.lobbyingContext.length + person.value.publicStatements.length,
		influenceStatusSummary: influenceStatusSummary.value,
		officeDisplayLabel: representativePresentation.value?.officeDisplayLabel ?? person.value.officeSought,
		officeHref: "#office-context"
	});
});
const officeContextFields = computed(() => {
	if (!person.value)
		return [];

	return [
		{ label: "Office", value: representativePresentation.value?.officeDisplayLabel ?? person.value.officeSought },
		{ label: "District", value: officeContext.value?.districtLabel || person.value.districtLabel },
		{ label: "Jurisdiction", value: officeContext.value?.jurisdictionLabel || person.value.location },
		{ label: "Chamber", value: officeContext.value?.chamberLabel },
		{ label: "Current term", value: officeContext.value?.currentTermLabel },
		{ label: "Official phone", value: officeContext.value?.officialPhone },
		{ label: "Official office", value: officeContext.value?.officialOfficeAddress },
		{ label: "Linkage note", value: person.value.provenance.note },
		{ label: "Data through", value: dataThroughLabel.value },
	].filter(item => Boolean(item.value));
});
const officeContextReferenceLinks = computed(() => officeContext.value?.referenceLinks ?? []);
const moduleStatusItems = computed(() => {
	if (!person.value?.enrichmentStatus)
		return [];

	return [
		{
			...person.value.enrichmentStatus.officeContext,
			label: "Office context",
		},
		{
			...person.value.enrichmentStatus.legislativeContext,
			label: "Legislative and action context",
		},
		{
			...person.value.enrichmentStatus.funding,
			label: "Funding module",
		},
		{
			...person.value.enrichmentStatus.influence,
			label: "Influence module",
		},
	];
});
const fundingHighlights = computed(() => {
	if (!person.value?.funding)
		return [];

	return [
		person.value.funding.committeeName ? { label: "Committee", value: person.value.funding.committeeName } : null,
		person.value.funding.coverageLabel ? { label: "Coverage", value: person.value.funding.coverageLabel } : null,
		typeof person.value.funding.totalSpent === "number" ? { label: "Disbursements", value: formatCurrency(person.value.funding.totalSpent) } : null,
		typeof person.value.funding.smallDonorShare === "number" && Number.isFinite(person.value.funding.smallDonorShare) && person.value.funding.smallDonorShare > 0
			? { label: "Small-donor share", value: formatPercent(person.value.funding.smallDonorShare) }
			: null,
	].filter((item): item is { label: string; value: string } => Boolean(item));
});
const fundingLineItems = computed(() => {
	if (!person.value?.funding)
		return [];

	if (person.value.funding.receiptBreakdown?.length)
		return person.value.funding.receiptBreakdown.slice(0, 4);

	return person.value.funding.topFunders.slice(0, 4);
});
const fundingLineItemsTitle = computed(() => person.value?.funding?.receiptBreakdown?.length ? "Receipt breakdown" : "Top funders");
function formatInfluenceMatchMode(matchMode: "committee" | "honoree" | undefined) {
	if (matchMode === "committee")
		return "Committee crosswalk";

	if (matchMode === "honoree")
		return "Direct officeholder-name match";

	return "";
}
const influenceHighlights = computed(() => {
	if (!influence.value)
		return [];

	return [
		influence.value.coverageLabel ? { label: "Coverage", value: influence.value.coverageLabel } : null,
		influence.value.matchMode ? { label: "Match mode", value: formatInfluenceMatchMode(influence.value.matchMode) } : null,
		typeof influence.value.reportCount === "number" ? { label: "Reports", value: String(influence.value.reportCount) } : null,
		typeof influence.value.contributionCount === "number" ? { label: "Contribution items", value: String(influence.value.contributionCount) } : null,
		typeof influence.value.totalMatched === "number" ? { label: "Total matched", value: formatCurrency(influence.value.totalMatched) } : null,
	].filter((item): item is { label: string; value: string } => Boolean(item));
});
const reportIssueHref = computed(() => person.value
	? `mailto:${contactEmail}?subject=${encodeURIComponent(`Ballot Clarity representative review: ${person.value.name}`)}`
	: `mailto:${contactEmail}?subject=${encodeURIComponent("Ballot Clarity representative review")}`);

usePageSeo({
	description: person.value?.summary ?? "Representative profile with office context, funding, influence, and source-backed civic record details.",
	jsonLd: person.value
		? {
				"@context": "https://schema.org",
				"@type": "ProfilePage",
				"dateModified": person.value.updatedAt,
				"mainEntity": {
					"@type": "Person",
					"description": person.value.summary,
					"homeLocation": {
						"@type": "Place",
						"name": person.value.location
					},
					"name": person.value.name,
					"url": `${siteUrl}/representatives/${person.value.slug}`
				},
				"url": `${siteUrl}/representatives/${person.value.slug}`
			}
		: undefined,
	ogType: "profile",
	path: `/representatives/${representativeSlug.value}`,
	title: person.value?.name ?? "Representative profile"
});
</script>

<template>
	<section class="app-shell section-gap">
		<div v-if="pagePending" class="gap-8 grid 2xl:grid-cols-[minmax(0,1.45fr)_minmax(21rem,0.85fr)]">
			<div class="space-y-6">
				<div class="surface-panel animate-pulse">
					<div class="rounded-full bg-app-line/70 h-6 w-40 dark:bg-app-line-dark" />
					<div class="mt-4 rounded-[1rem] bg-app-line/60 h-14 w-2/3 dark:bg-app-line-dark" />
					<div class="mt-4 rounded-full bg-app-line/60 h-4 w-full dark:bg-app-line-dark" />
				</div>
				<div v-for="index in 4" :key="index" class="surface-panel bg-white/70 h-48 animate-pulse dark:bg-app-panel-dark/70" />
			</div>
			<div class="surface-panel bg-white/70 h-96 animate-pulse dark:bg-app-panel-dark/70" />
		</div>

		<div v-else-if="(error && !fallbackData) || !person" class="max-w-3xl">
			<InfoCallout title="Representative profile not available" tone="warning">
				This representative page could not be loaded. Return to the representative directory or the broader results layer and try again.
			</InfoCallout>
		</div>

		<div
			v-else
			:key="representativeLayoutKey"
			data-representative-layout="profile"
			class="gap-8 grid 2xl:grid-cols-[minmax(0,1.45fr)_minmax(21rem,0.85fr)]"
		>
			<div class="space-y-6">
				<header data-representative-summary="hero" class="surface-panel">
					<AppBreadcrumbs :items="breadcrumbs" />
					<div class="flex flex-wrap gap-2 items-center">
						<VerificationBadge label="Representative profile" tone="accent" />
						<VerificationBadge v-if="representativePresentation" :label="representativePresentation.levelLabel" />
						<VerificationBadge :label="person.officeholderLabel" />
						<VerificationBadge :label="person.onCurrentBallot ? person.ballotStatusLabel : 'Not on current ballot'" />
						<VerificationBadge v-if="isNationwideFallback" label="Nationwide lookup fallback" tone="warning" />
						<VerificationBadge
							v-if="linkageConfidence"
							:label="linkageConfidence.label"
							:title="linkageConfidence.note"
						/>
					</div>
					<p class="text-xs text-app-muted tracking-[0.24em] font-semibold mt-5 uppercase dark:text-app-muted-dark">
						{{ person.location }}
					</p>
					<div class="mt-3 flex flex-wrap gap-3 items-center">
						<h1 class="text-5xl text-app-ink leading-tight font-serif dark:text-app-text-dark">
							{{ person.name }}
						</h1>
						<IncumbentBadge v-if="person.incumbent" />
					</div>
					<p class="text-lg text-app-muted mt-4 dark:text-app-muted-dark">
						{{ representativePresentation?.officeDisplayLabel ?? person.officeSought }} · {{ person.party }}
					</p>
					<p class="text-base text-app-muted leading-8 mt-6 max-w-3xl dark:text-app-muted-dark">
						{{ person.summary }}
					</p>
					<div class="mt-6 flex flex-wrap gap-3 items-center">
						<UpdatedAt :value="person.freshness.dataLastUpdatedAt ?? person.updatedAt" label="Data through" />
						<span class="text-app-line dark:text-app-line-dark">•</span>
						<p class="text-sm text-app-muted dark:text-app-muted-dark">
							{{ person.provenance.label }}
						</p>
					</div>
					<div class="bc-action-cluster mt-6">
						<SourceDrawer :sources="person.sources" :title="`${person.name} evidence and sources`" button-label="Evidence & sources" />
						<a v-if="campaignLink" :href="campaignLink" target="_blank" rel="noreferrer" class="btn-secondary">
							<span class="i-carbon-launch" />
							Open campaign site
						</a>
						<a v-if="person.officialWebsiteUrl" :href="person.officialWebsiteUrl" target="_blank" rel="noreferrer" class="btn-secondary inline-flex gap-2 items-center">
							Official office site
							<span class="i-carbon-launch" />
						</a>
						<a v-if="person.openstatesUrl" :href="person.openstatesUrl" target="_blank" rel="noreferrer" class="btn-secondary inline-flex gap-2 items-center">
							Provider record
							<span class="i-carbon-launch" />
						</a>
						<NuxtLink v-if="hasFunding" :to="buildLookupAwareTarget(`/representatives/${person.slug}/funding`)" class="btn-secondary">
							Funding page
						</NuxtLink>
						<NuxtLink v-if="hasInfluence" :to="buildLookupAwareTarget(`/representatives/${person.slug}/influence`)" class="btn-secondary">
							Influence page
						</NuxtLink>
						<NuxtLink :to="buildLookupAwareTarget(overviewLink.to)" class="btn-secondary">
							{{ overviewLink.label }}
						</NuxtLink>
						<a v-if="representativeJsonHref" :href="representativeJsonHref" class="btn-secondary" rel="noreferrer" target="_blank">
							<span class="i-carbon-download" />
							Download JSON
						</a>
						<NuxtLink :to="buildLookupAwareTarget(backToLayerLink.to)" class="btn-primary">
							{{ backToLayerLink.label }}
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
								Person-level civic context
							</h2>
						</div>
						<SourceDrawer :sources="person.sources" :title="`${person.name} profile scope`" button-label="See page sources" />
					</div>
					<div class="mt-6">
						<PageSummaryStrip :items="summaryItems" />
					</div>
					<div class="mt-6 gap-4 grid lg:grid-cols-[minmax(0,1.3fr)_minmax(18rem,0.9fr)]">
						<div id="office-context" class="px-5 py-5 border border-app-line/80 rounded-3xl bg-white/80 scroll-mt-32 dark:border-app-line-dark dark:bg-app-panel-dark/70">
							<div class="flex flex-wrap gap-3 items-center justify-between">
								<h3 class="text-xl text-app-ink font-serif dark:text-app-text-dark">
									Office and jurisdiction context
								</h3>
								<VerificationBadge :label="person.provenance.status" />
							</div>
							<dl class="mt-5 gap-4 grid sm:grid-cols-2">
								<div v-for="item in officeContextFields" :key="item.label">
									<dt class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
										{{ item.label }}
									</dt>
									<dd class="text-sm text-app-ink mt-2 dark:text-app-text-dark">
										{{ item.value }}
									</dd>
								</div>
							</dl>
							<div v-if="officeContextReferenceLinks.length" class="mt-6 pt-6 border-t border-app-line/80 dark:border-app-line-dark">
								<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
									Reference links
								</p>
								<div class="mt-4 flex flex-wrap gap-3">
									<a
										v-for="link in officeContextReferenceLinks"
										:key="`${link.label}-${link.url}`"
										:href="link.url"
										target="_blank"
										rel="noreferrer"
										class="btn-secondary"
									>
										{{ link.label }}
										<span class="i-carbon-launch" />
									</a>
								</div>
							</div>
						</div>
						<div class="px-5 py-5 border border-app-line/80 rounded-3xl bg-app-bg dark:border-app-line-dark dark:bg-app-bg-dark/70">
							<h3 class="text-xl text-app-ink font-serif dark:text-app-text-dark">
								Module status
							</h3>
							<ul class="mt-4 space-y-4">
								<li v-for="item in moduleStatusItems" :key="item.label" class="pb-4 border-b border-app-line/80 last:pb-0 last:border-b-0 dark:border-app-line-dark">
									<div class="flex flex-wrap gap-3 items-center justify-between">
										<p class="text-sm text-app-ink font-semibold dark:text-app-text-dark">
											{{ item.label }}
										</p>
										<VerificationBadge :label="item.status" :tone="item.status === 'available' ? 'accent' : 'warning'" />
									</div>
									<p class="text-sm text-app-muted leading-7 mt-2 dark:text-app-muted-dark">
										{{ item.summary }}
									</p>
									<p v-if="item.sourceSystem || item.reasonCode" class="text-xs text-app-muted tracking-[0.12em] font-semibold mt-2 uppercase dark:text-app-muted-dark">
										{{ [item.sourceSystem, item.reasonCode].filter(Boolean).join(" · ") }}
									</p>
								</li>
							</ul>
							<div class="mt-6 pt-6 border-t border-app-line/80 dark:border-app-line-dark">
								<h4 class="text-lg text-app-ink font-serif dark:text-app-text-dark">
									Read this safely
								</h4>
								<ul class="text-sm text-app-muted leading-7 mt-4 space-y-2 dark:text-app-muted-dark">
									<li>Direct, crosswalked, and inferred linkage should not be treated as the same confidence level.</li>
									<li>Finance and influence sections only appear when the underlying person record has publishable data.</li>
									<li>{{ person.freshness.statusNote }}</li>
									<li>Use the attached records and official sources before treating this page as complete.</li>
								</ul>
							</div>
						</div>
					</div>
				</section>

				<section id="biography" class="surface-panel scroll-mt-28">
					<div class="flex flex-wrap gap-4 items-center justify-between">
						<div>
							<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
								Bio and issues
							</p>
							<h2 class="text-3xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
								Public record and issue context
							</h2>
						</div>
					</div>
					<div class="mt-6 gap-6 grid xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
						<div class="space-y-4">
							<article v-for="block in person.biography" :key="block.id" class="p-5 rounded-3xl bg-app-bg dark:bg-app-bg-dark/70">
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
						<div class="space-y-6">
							<div class="p-5 rounded-3xl bg-app-bg dark:bg-app-bg-dark/70">
								<h3 class="text-xl text-app-ink font-serif dark:text-app-text-dark">
									Top issues
								</h3>
								<div class="mt-4 flex flex-wrap gap-2">
									<IssueChip v-for="issue in person.topIssues" :key="issue.slug" :label="issue.label" />
								</div>
							</div>
							<div class="p-5 rounded-3xl bg-app-bg dark:bg-app-bg-dark/70">
								<h3 class="text-xl text-app-ink font-serif dark:text-app-text-dark">
									Public statements
								</h3>
								<div class="mt-4 space-y-3">
									<article v-for="statement in person.publicStatements" :key="statement.id" class="p-4 rounded-2xl bg-white/80 dark:bg-app-panel-dark/70">
										<h4 class="text-base text-app-ink font-semibold dark:text-app-text-dark">
											{{ statement.title }}
										</h4>
										<p class="text-sm text-app-muted leading-6 mt-2 dark:text-app-muted-dark">
											{{ statement.summary }}
										</p>
									</article>
									<p v-if="!person.publicStatements.length" class="text-sm text-app-muted leading-7 dark:text-app-muted-dark">
										No source-backed public statements are attached to this person record yet.
									</p>
								</div>
							</div>
						</div>
					</div>
				</section>

				<section id="actions" class="surface-panel scroll-mt-28">
					<div class="flex flex-wrap gap-4 items-center justify-between">
						<div>
							<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
								Actions
							</p>
							<h2 class="text-3xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
								Documented votes and actions
							</h2>
						</div>
					</div>
					<div v-if="person.keyActions.length" class="mt-6 space-y-4">
						<article v-for="action in person.keyActions" :key="action.id" class="p-5 rounded-3xl bg-app-bg dark:bg-app-bg-dark/70">
							<div class="flex flex-wrap gap-3 items-start justify-between">
								<div>
									<h3 class="text-lg text-app-ink font-semibold dark:text-app-text-dark">
										{{ action.title }}
									</h3>
									<p class="text-sm text-app-muted mt-2 dark:text-app-muted-dark">
										{{ formatDate(action.date) }}
									</p>
								</div>
								<SourceDrawer :sources="action.sources" :title="action.title" button-label="Sources" />
							</div>
							<p class="text-sm text-app-muted leading-7 mt-3 dark:text-app-muted-dark">
								{{ action.summary }}
							</p>
							<p class="text-sm text-app-ink leading-7 mt-3 dark:text-app-text-dark">
								{{ action.significance }}
							</p>
						</article>
					</div>
					<div v-else class="mt-6 p-5 rounded-3xl bg-app-bg dark:bg-app-bg-dark/70">
						<h3 class="text-lg text-app-ink font-semibold dark:text-app-text-dark">
							No attached action record yet
						</h3>
						<p class="text-sm text-app-muted leading-7 mt-3 dark:text-app-muted-dark">
							{{ person.enrichmentStatus?.legislativeContext.summary || "Ballot Clarity does not currently have a source-backed legislative or action feed attached to this person record." }}
						</p>
						<p class="text-sm text-app-muted leading-7 mt-3 dark:text-app-muted-dark">
							The page still carries office context, district context, provenance, and official-source links for this officeholder.
						</p>
					</div>
				</section>

				<section id="funding" class="surface-panel scroll-mt-28">
					<div class="flex flex-wrap gap-4 items-center justify-between">
						<div>
							<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
								Funding
							</p>
							<h2 class="text-3xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
								Finance summary
							</h2>
						</div>
						<NuxtLink v-if="hasFunding" :to="buildLookupAwareTarget(`/representatives/${person.slug}/funding`)" class="btn-secondary">
							Open full funding page
						</NuxtLink>
					</div>
					<div v-if="hasFunding && person.funding" class="mt-6 gap-6 grid xl:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)]">
						<div class="space-y-4">
							<p class="text-sm text-app-muted leading-7 dark:text-app-muted-dark">
								{{ person.funding.summary }}
							</p>
							<div v-if="fundingHighlights.length" class="gap-3 grid sm:grid-cols-2">
								<div v-for="item in fundingHighlights" :key="item.label" class="p-4 rounded-3xl bg-app-bg dark:bg-app-bg-dark/70">
									<p class="text-xs text-app-muted tracking-[0.14em] font-semibold uppercase dark:text-app-muted-dark">
										{{ item.label }}
									</p>
									<p class="text-base text-app-ink mt-2 dark:text-app-text-dark">
										{{ item.value }}
									</p>
								</div>
							</div>
							<p class="text-xs text-app-muted tracking-[0.18em] font-semibold px-1 pt-2 uppercase dark:text-app-muted-dark">
								{{ fundingLineItemsTitle }}
							</p>
							<ul class="space-y-3">
								<li v-for="funder in fundingLineItems" :key="`${funder.name}-${funder.category}`" class="p-4 rounded-3xl bg-app-bg dark:bg-app-bg-dark/70">
									<div class="flex flex-wrap gap-4 items-center justify-between">
										<div>
											<p class="text-lg text-app-ink font-semibold dark:text-app-text-dark">
												{{ funder.name }}
											</p>
											<p class="text-sm text-app-muted mt-2 dark:text-app-muted-dark">
												{{ funder.category }}
											</p>
										</div>
										<p class="text-lg text-app-ink font-semibold dark:text-app-text-dark">
											{{ formatCurrency(funder.amount) }}
										</p>
									</div>
								</li>
							</ul>
						</div>
						<div class="p-5 rounded-3xl bg-app-bg dark:bg-app-bg-dark/70">
							<h3 class="text-xl text-app-ink font-serif dark:text-app-text-dark">
								Finance disclaimer
							</h3>
							<ul class="text-sm text-app-muted leading-7 mt-4 space-y-2 dark:text-app-muted-dark">
								<li><strong class="text-app-ink dark:text-app-text-dark">Linkage:</strong> {{ person.provenance.status }}</li>
								<li><strong class="text-app-ink dark:text-app-text-dark">Confidence:</strong> {{ linkageConfidence?.label }}</li>
								<li><strong class="text-app-ink dark:text-app-text-dark">Committee:</strong> {{ person.funding.committeeName || "Current matched committee not published in this summary." }}</li>
								<li><strong class="text-app-ink dark:text-app-text-dark">Coverage:</strong> {{ person.funding.coverageLabel || person.funding.provenanceLabel || "Source-backed finance summary" }}</li>
								<li><strong class="text-app-ink dark:text-app-text-dark">Data through:</strong> {{ dataThroughLabel }}</li>
								<li><strong class="text-app-ink dark:text-app-text-dark">Warning:</strong> {{ person.freshness.statusNote }}</li>
							</ul>
						</div>
					</div>
					<InfoCallout v-else title="No funding data attached" tone="warning" class="mt-6">
						{{ fundingStatusSummary }}
					</InfoCallout>
				</section>

				<section id="influence" class="surface-panel scroll-mt-28">
					<div class="flex flex-wrap gap-4 items-center justify-between">
						<div>
							<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
								Influence
							</p>
							<h2 class="text-3xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
								Lobbying and public influence context
							</h2>
						</div>
						<NuxtLink v-if="hasInfluence" :to="buildLookupAwareTarget(`/representatives/${person.slug}/influence`)" class="btn-secondary">
							Open full influence page
						</NuxtLink>
					</div>
					<div v-if="hasInfluence" class="mt-6 gap-6 grid xl:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)]">
						<div class="space-y-4">
							<div v-if="influenceHighlights.length" class="gap-3 grid sm:grid-cols-2">
								<div v-for="item in influenceHighlights" :key="item.label" class="p-4 rounded-3xl bg-app-bg dark:bg-app-bg-dark/70">
									<p class="text-xs text-app-muted tracking-[0.14em] font-semibold uppercase dark:text-app-muted-dark">
										{{ item.label }}
									</p>
									<p class="text-base text-app-ink mt-2 dark:text-app-text-dark">
										{{ item.value }}
									</p>
								</div>
							</div>
							<article v-for="block in person.lobbyingContext.slice(0, 3)" :key="block.id" class="p-5 rounded-3xl bg-app-bg dark:bg-app-bg-dark/70">
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
							<div v-if="influence?.topRegistrants?.length" class="p-5 rounded-3xl bg-app-bg dark:bg-app-bg-dark/70">
								<h3 class="text-lg text-app-ink font-semibold dark:text-app-text-dark">
									Top reporting registrants
								</h3>
								<ul class="mt-4 space-y-3">
									<li v-for="registrant in influence.topRegistrants" :key="registrant.name" class="text-sm text-app-muted flex flex-wrap gap-3 items-center justify-between dark:text-app-muted-dark">
										<span class="text-app-ink font-semibold dark:text-app-text-dark">{{ registrant.name }}</span>
										<span>{{ formatCurrency(registrant.amount) }}</span>
									</li>
								</ul>
							</div>
						</div>
						<div class="p-5 rounded-3xl bg-app-bg dark:bg-app-bg-dark/70">
							<h3 class="text-xl text-app-ink font-serif dark:text-app-text-dark">
								Influence disclaimer
							</h3>
							<ul class="text-sm text-app-muted leading-7 mt-4 space-y-2 dark:text-app-muted-dark">
								<li><strong class="text-app-ink dark:text-app-text-dark">Linkage:</strong> {{ person.provenance.status }}</li>
								<li><strong class="text-app-ink dark:text-app-text-dark">Confidence:</strong> {{ linkageConfidence?.label }}</li>
								<li><strong class="text-app-ink dark:text-app-text-dark">Coverage:</strong> {{ influence?.coverageLabel || "Public disclosures, donor context, and source-backed statements where available." }}</li>
								<li><strong class="text-app-ink dark:text-app-text-dark">Match mode:</strong> {{ influence?.matchMode ? formatInfluenceMatchMode(influence.matchMode) : "Not published" }}</li>
								<li><strong class="text-app-ink dark:text-app-text-dark">Data through:</strong> {{ dataThroughLabel }}</li>
								<li><strong class="text-app-ink dark:text-app-text-dark">Warning:</strong> Context is not proof of causation. {{ person.freshness.statusNote }}</li>
							</ul>
						</div>
					</div>
					<InfoCallout v-else title="No influence context attached" tone="warning" class="mt-6">
						{{ influenceStatusSummary }}
					</InfoCallout>
				</section>

				<section id="sources" class="scroll-mt-28 space-y-6">
					<FreshnessStrip :freshness="person.freshness" title="Freshness and coverage status" />
					<div class="surface-panel">
						<div class="flex flex-wrap gap-4 items-center justify-between">
							<div>
								<h2 class="text-3xl text-app-ink font-serif dark:text-app-text-dark">
									Sources and methodology notes
								</h2>
								<p class="text-sm text-app-muted leading-7 mt-4 dark:text-app-muted-dark">
									This person page aggregates the source-backed record available for this officeholder without requiring the ballot guide to be the active app layer.
								</p>
							</div>
							<a :href="reportIssueHref" class="btn-secondary">
								Report an issue
							</a>
						</div>
						<div class="mt-6 gap-6 grid xl:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
							<div>
								<SourceList :sources="person.sources" />
							</div>
							<div class="space-y-4">
								<div class="p-5 rounded-3xl bg-app-bg dark:bg-app-bg-dark/70">
									<h3 class="text-xl text-app-ink font-serif dark:text-app-text-dark">
										What we know
									</h3>
									<ul class="mt-4 space-y-2">
										<li v-for="item in person.whatWeKnow" :key="item.id" class="text-sm text-app-muted leading-6 dark:text-app-muted-dark">
											{{ item.text }}
										</li>
									</ul>
								</div>
								<div class="p-5 rounded-3xl bg-app-bg dark:bg-app-bg-dark/70">
									<h3 class="text-xl text-app-ink font-serif dark:text-app-text-dark">
										What we do not know
									</h3>
									<ul class="mt-4 space-y-2">
										<li v-for="item in person.whatWeDoNotKnow" :key="item.id" class="text-sm text-app-muted leading-6 dark:text-app-muted-dark">
											{{ item.text }}
										</li>
									</ul>
								</div>
								<div class="p-5 rounded-3xl bg-app-bg dark:bg-app-bg-dark/70">
									<h3 class="text-xl text-app-ink font-serif dark:text-app-text-dark">
										Methodology notes
									</h3>
									<ul class="mt-4 space-y-2">
										<li v-for="note in person.methodologyNotes" :key="note" class="text-sm text-app-muted leading-6 dark:text-app-muted-dark">
											{{ note }}
										</li>
									</ul>
								</div>
							</div>
						</div>
					</div>
				</section>
			</div>

			<div class="space-y-6 xl:pt-[4.5rem]">
				<div class="surface-panel">
					<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
						Active lookup context
					</p>
					<h2 class="text-2xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
						{{ activeLookupSummary.label }}
					</h2>
					<p class="text-sm text-app-muted leading-7 mt-4 dark:text-app-muted-dark">
						{{ activeLookupSummary.note }}
					</p>
					<div class="mt-5 flex flex-wrap gap-3 items-center">
						<TrustBadge
							:label="activeLookupSummary.mode === 'nationwide' ? 'Nationwide lookup context' : activeLookupSummary.mode === 'guide' ? 'Published guide context' : 'No saved lookup context'"
							:tone="activeLookupSummary.mode === 'nationwide' ? 'accent' : activeLookupSummary.mode === 'guide' ? undefined : 'warning'"
						/>
						<UpdatedAt v-if="activeLookupSummary.resolvedAt" :value="activeLookupSummary.resolvedAt" label="Lookup updated" />
					</div>
				</div>

				<PageSectionNav
					:breadcrumbs="breadcrumbs"
					:description="isNationwideFallback
						? 'Use this page for the active nationwide person record when Ballot Clarity does not yet have a published local person profile for the official.'
						: 'Use this page for the person-level civic record tied to a current officeholder when Ballot Clarity has publishable local data.'"
					:items="sectionLinks"
					title="Representative profile"
				>
					<template #actions>
						<div class="flex flex-wrap gap-3">
							<NuxtLink :to="buildLookupAwareTarget(backToLayerLink.to)" class="btn-secondary">
								{{ backToLayerLink.label }}
							</NuxtLink>
							<NuxtLink :to="buildLookupAwareTarget('/representatives')" class="btn-secondary">
								Representative directory
							</NuxtLink>
						</div>
					</template>
				</PageSectionNav>

				<div class="surface-panel" data-representative-sidebar="record-details">
					<h2 class="text-2xl text-app-ink font-serif dark:text-app-text-dark">
						Record details
					</h2>
					<p class="text-sm text-app-muted leading-7 mt-4 dark:text-app-muted-dark">
						<strong class="text-app-ink dark:text-app-text-dark">Provenance:</strong> {{ person.provenance.label }}
					</p>
					<p class="text-sm text-app-muted leading-7 mt-3 dark:text-app-muted-dark">
						<strong class="text-app-ink dark:text-app-text-dark">Confidence:</strong> {{ linkageConfidence?.label }}. {{ linkageConfidence?.note }}
					</p>
					<p class="text-sm text-app-muted leading-7 mt-3 dark:text-app-muted-dark">
						<strong class="text-app-ink dark:text-app-text-dark">As of:</strong> {{ formatDateTime(person.provenance.asOf) }}
					</p>
					<ul class="readable-list text-sm text-app-muted mt-5 pl-5 dark:text-app-muted-dark">
						<li>{{ hasFunding ? "Funding summary and dedicated funding page are live for this person record." : "Funding module is not attached to this person record yet." }}</li>
						<li>{{ hasInfluence ? "Influence and public-disclosure context are live for this person record." : "Influence module is not attached to this person record yet." }}</li>
						<li>{{ person.onCurrentBallot ? "Ballot status is attached because this officeholder is also on the current ballot." : "Ballot status is not attached because this person is not on the current ballot in the current source set." }}</li>
					</ul>
				</div>
			</div>
		</div>
	</section>
</template>
