<script setup lang="ts">
import type { PersonProfileResponse, Source } from "~/types/civic";
import { storeToRefs } from "pinia";

import { buildNationwidePersonProfileResponse } from "~/utils/nationwide-person-profile";
import { buildLookupContextFromNationwideResult, buildNationwideLookupRouteQuery, buildNationwideRouteTarget } from "~/utils/nationwide-route-context";
import { hasPersonFunding, hasPersonInfluence } from "~/utils/person-profile";
import { resolveRepresentativeContentSummary, resolveRepresentativePresentation } from "~/utils/representative-presentation";

const route = useRoute();
const siteUrl = useSiteUrl();
const civicStore = useCivicStore();
const { isHydrated, nationwideLookupResult } = storeToRefs(civicStore);
const representativeSlug = useRouteStringParam("slug");
const { backToLayerLink, layerBreadcrumbLink } = useRouteLayerNavigation();
const { formatCurrency, formatDate, formatDateTime, formatPercent } = useFormatters();
const activeNationwideLookupResult = computed(() => isHydrated.value ? nationwideLookupResult.value : null);
const activeLookupQuery = computed(() => buildNationwideLookupRouteQuery(
	buildLookupContextFromNationwideResult(activeNationwideLookupResult.value),
	route.query
));
const { data, error, pending } = await useRepresentative(representativeSlug, activeLookupQuery);

function mergeSources(primarySources: Source[], fallbackSources: Source[]) {
	const sourceKeys = new Set(primarySources.map(source => source.url || source.id));
	const additionalSources = fallbackSources.filter((source) => {
		const sourceKey = source.url || source.id;

		if (sourceKeys.has(sourceKey))
			return false;

		sourceKeys.add(sourceKey);
		return true;
	});

	return [...primarySources, ...additionalSources];
}

function normalizePersonIdentity(value: string) {
	return value
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
}

function mergeLookupProfileData(primary: PersonProfileResponse, fallback: PersonProfileResponse | null) {
	const sameRepresentative = fallback
		&& (
			primary.person.slug === fallback.person.slug
			|| normalizePersonIdentity(primary.person.name) === normalizePersonIdentity(fallback.person.name)
		);

	if (!fallback || !sameRepresentative)
		return primary;

	const sources = mergeSources(primary.person.sources, fallback.person.sources);

	return {
		...primary,
		person: {
			...primary.person,
			openstatesUrl: primary.person.openstatesUrl || fallback.person.openstatesUrl,
			officialWebsiteUrl: primary.person.officialWebsiteUrl || fallback.person.officialWebsiteUrl,
			profileImages: primary.person.profileImages?.length ? primary.person.profileImages : fallback.person.profileImages,
			sourceCount: sources.length,
			sources
		}
	} satisfies PersonProfileResponse;
}

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

	return mergeLookupProfileData(data.value, fallbackData.value);
});
const person = computed(() => profileData.value?.person ?? null);
const profileSummary = computed(() => resolveRepresentativeContentSummary(person.value?.summary));
const pagePending = computed(() => pending.value || (!data.value && !fallbackData.value));
const representativePresentation = computed(() => person.value
	? resolveRepresentativePresentation(person.value, activeNationwideLookupResult.value?.location?.state ?? null)
	: null);
const dataThroughLabel = computed(() => {
	if (!person.value)
		return "";

	return formatDate(person.value.freshness.dataLastUpdatedAt ?? person.value.updatedAt);
});
function buildLookupAwareTarget(path: string) {
	return buildNationwideRouteTarget(path, buildLookupContextFromNationwideResult(activeNationwideLookupResult.value), route.query);
}
const campaignLink = computed(() => {
	if (!person.value?.comparison)
		return "";

	return person.value.comparison.campaignWebsiteUrl || person.value.comparison.contactChannels[0]?.url || "";
});
const hasFunding = computed(() => person.value ? hasPersonFunding(person.value) : false);
const hasInfluence = computed(() => person.value ? hasPersonInfluence(person.value) : false);
const hasBackground = computed(() => Boolean(person.value && (person.value.biography.length || person.value.topIssues.length || person.value.publicStatements.length)));
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
			...(hasBackground.value ? [{ href: "#biography", label: "Bio" }] : []),
			...(person.value.keyActions.length ? [{ href: "#actions", label: "Actions", badge: String(person.value.keyActions.length) }] : []),
			...(hasFunding.value ? [{ href: "#funding", label: "Funding", badge: "Live" }] : []),
			...(hasInfluence.value ? [{ href: "#influence", label: "Influence", badge: "Live" }] : []),
			...(person.value.sources.length ? [{ href: "#sources", label: "Sources", badge: String(person.value.sources.length) }] : [])
		]
	: []);
const officeContextFields = computed(() => {
	if (!person.value)
		return [];

	return [
		{ label: "Office", value: representativePresentation.value?.officeDisplayLabel ?? person.value.officeSought },
		{ label: "District", value: officeContext.value?.districtLabel || person.value.districtLabel },
		{ label: "Jurisdiction", value: officeContext.value?.jurisdictionLabel || person.value.location },
		{ label: "Chamber", value: officeContext.value?.chamberLabel },
		{ label: "Current term", value: officeContext.value?.currentTermLabel },
		{ label: "Term starts", value: officeContext.value?.currentTermStartLabel },
		{ label: "Term ends", value: officeContext.value?.currentTermEndLabel },
		{ label: "Service begins", value: officeContext.value?.serviceStartLabel },
		{ label: "Official phone", value: officeContext.value?.officialPhone },
		{ label: "Official office", value: officeContext.value?.officialOfficeAddress },
		{ label: "Data through", value: dataThroughLabel.value },
	].filter(item => Boolean(item.value));
});
const officeContextReferenceLinks = computed(() => officeContext.value?.referenceLinks ?? []);
const pageNotes = computed(() => {
	if (!person.value)
		return [];

	return [
		...person.value.whatWeKnow.map(item => item.text),
		...person.value.whatWeDoNotKnow.map(item => item.text),
		...person.value.methodologyNotes.slice(0, 1),
	].filter(Boolean);
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
const reportIssueTo = computed(() => ({
	path: "/contact",
	query: {
		pageUrl: `/representatives/${person.value?.slug ?? representativeSlug.value}`,
		subject: person.value
			? `Ballot Clarity representative review: ${person.value.name}`
			: "Ballot Clarity representative review",
		type: "correction"
	}
}));

usePageSeo({
	description: profileSummary.value || "Representative profile with office context, funding, influence, and source-backed civic record details.",
	jsonLd: person.value
		? {
				"@context": "https://schema.org",
				"@type": "ProfilePage",
				"dateModified": person.value.updatedAt,
				"mainEntity": {
					"@type": "Person",
					"description": profileSummary.value || undefined,
					"homeLocation": {
						"@type": "Place",
						"name": person.value.location
					},
					"image": person.value.profileImages?.[0]?.url,
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
		<div v-if="pagePending" class="detail-layout">
			<div class="space-y-6">
				<div class="surface-panel animate-pulse">
					<div class="rounded-full bg-app-line/70 h-6 w-40 dark:bg-app-line-dark" />
					<div class="mt-4 rounded-xl bg-app-line/60 h-14 w-2/3 dark:bg-app-line-dark" />
					<div class="mt-4 rounded-full bg-app-line/60 h-4 w-full dark:bg-app-line-dark" />
				</div>
				<div v-for="index in 4" :key="index" class="rounded-lg bg-app-bg h-48 animate-pulse dark:bg-app-bg-dark" />
			</div>
			<div class="rounded-lg bg-app-bg h-96 animate-pulse dark:bg-app-bg-dark" />
		</div>

		<div v-else-if="(error && !fallbackData) || !person" class="max-w-3xl">
			<InfoCallout title="Representative profile not available" tone="warning">
				Try again later.
			</InfoCallout>
		</div>

		<div
			v-else-if="person.provenance.status === 'inferred' && !person.sources.length && !person.biography.length && !person.keyActions.length && !person.publicStatements.length && !hasFunding && !hasInfluence"
			class="max-w-3xl"
		>
			<GuideUnavailableState
				title="Representative information unavailable"
				message=""
				primary-label="Representative directory"
				:primary-to="buildLookupAwareTarget('/representatives')"
			/>
		</div>
		<div
			v-else
			:key="representativeLayoutKey"
			data-representative-layout="profile"
			class="detail-layout"
		>
			<div class="section-stack print:space-y-6">
				<header data-representative-summary="hero" class="surface-panel">
					<AppBreadcrumbs :items="breadcrumbs" />
					<div class="mt-4 gap-6 grid md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
						<div>
							<p class="text-xs text-app-muted tracking-[0.06em] font-semibold uppercase dark:text-app-muted-dark">
								{{ person.location }}
							</p>
							<div class="mt-3 flex flex-wrap gap-3 items-center">
								<h1 class="text-5xl text-app-ink leading-tight font-serif dark:text-app-text-dark">
									{{ person.name }}
								</h1>
								<IncumbentBadge v-if="person.incumbent" />
							</div>
							<p class="text-lg text-app-muted mt-4 dark:text-app-muted-dark">
								{{ representativePresentation?.officeDisplayLabel ?? person.officeSought }}<span v-if="person.party"> · <PartyLabel :party="person.party" /></span>
							</p>
							<p v-if="profileSummary" class="text-lg text-app-ink leading-8 mt-5 max-w-3xl dark:text-app-text-dark">
								{{ profileSummary }}
							</p>
						</div>
						<ProfileImageStack
							v-if="person.profileImages?.length"
							:images="person.profileImages"
							:name="person.name"
							show-caption
							size="lg"
						/>
					</div>
					<div class="mt-5 flex flex-wrap gap-x-4 gap-y-1 items-center">
						<UpdatedAt :value="person.freshness.dataLastUpdatedAt ?? person.updatedAt" label="Data through" />
						<span class="text-sm text-app-muted dark:text-app-muted-dark">{{ person.ballotStatusLabel }}</span>
						<SourceDrawer v-if="person.sources.length" :sources="person.sources" :title="`${person.name} sources`" button-label="Sources" />
					</div>
					<div class="mt-5 flex flex-wrap gap-x-6 gap-y-2 items-center">
						<RepresentativeWebsite :website-url="person.officialWebsiteUrl" :provider-url="person.openstatesUrl" class="btn-secondary" />
						<SafeExternalLink v-if="campaignLink" :href="campaignLink" external-icon class="btn-secondary">
							Campaign site
						</SafeExternalLink>
						<NuxtLink :to="buildLookupAwareTarget(backToLayerLink.to)" class="btn-secondary">
							{{ backToLayerLink.label }}
						</NuxtLink>
					</div>
				</header>

				<section id="at-a-glance" class="surface-panel scroll-mt-28">
					<div id="office-context" class="scroll-mt-32">
						<div class="flex flex-wrap gap-3 items-center">
							<h2 class="text-2xl text-app-ink font-serif dark:text-app-text-dark">
								Office
							</h2>
						</div>
						<dl class="mt-5 gap-4 grid sm:grid-cols-2">
							<div v-for="item in officeContextFields" :key="item.label">
								<dt class="text-xs text-app-muted tracking-[0.06em] font-semibold uppercase dark:text-app-muted-dark">
									{{ item.label }}
								</dt>
								<dd class="text-sm text-app-ink mt-2 dark:text-app-text-dark">
									{{ item.value }}
								</dd>
							</div>
						</dl>
						<div v-if="officeContextReferenceLinks.length" class="mt-4">
							<div class="flex flex-wrap gap-x-5 gap-y-1">
								<SafeExternalLink
									v-for="link in officeContextReferenceLinks"
									:key="`${link.label}-${link.url}`"
									:href="link.url"
									external-icon
									class="btn-secondary"
								>
									{{ link.label }}
								</SafeExternalLink>
							</div>
						</div>
					</div>
				</section>

				<section v-if="hasBackground" id="biography" class="surface-panel scroll-mt-28">
					<div class="flex flex-wrap gap-4 items-center justify-between">
						<div>
							<h2 class="text-2xl text-app-ink font-serif dark:text-app-text-dark">
								Background and issues
							</h2>
						</div>
					</div>
					<div class="mt-6 gap-x-6 gap-y-12 grid print:gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
						<div class="space-y-8 lg:space-y-12 print:!space-y-4">
							<article v-for="block in person.biography" :key="block.id" class="content-block">
								<div class="flex flex-wrap gap-3 items-start justify-between">
									<h3 class="text-lg text-app-ink font-semibold dark:text-app-text-dark">
										{{ block.title }}
									</h3>
									<SourceDrawer :sources="block.sources" :title="block.title" button-label="Sources" />
								</div>
								<p class="text-base text-app-ink leading-7 mt-3 dark:text-app-text-dark">
									{{ block.summary }}
								</p>
							</article>
						</div>
						<div class="space-y-8 lg:space-y-12 print:!space-y-6">
							<div v-if="person.topIssues.length">
								<h3 class="text-lg text-app-ink font-semibold dark:text-app-text-dark">
									Top issues
								</h3>
								<div class="mt-4 flex flex-wrap gap-2">
									<IssueChip v-for="issue in person.topIssues" :key="issue.slug" :label="issue.label" />
								</div>
							</div>
							<section v-if="person.publicStatements.length">
								<h3 class="text-lg text-app-ink font-semibold dark:text-app-text-dark">
									Public statements
								</h3>
								<div class="mt-4 space-y-8 lg:space-y-12 print:!space-y-3">
									<article v-for="statement in person.publicStatements" :key="statement.id">
										<h4 class="text-base text-app-ink font-semibold dark:text-app-text-dark">
											{{ statement.title }}
										</h4>
										<p class="text-base text-app-ink leading-7 mt-2 dark:text-app-text-dark">
											{{ statement.summary }}
										</p>
									</article>
								</div>
							</section>
						</div>
					</div>
				</section>

				<section v-if="person.keyActions.length" id="actions" class="surface-panel scroll-mt-28">
					<div class="flex flex-wrap gap-4 items-center justify-between">
						<div>
							<h2 class="text-2xl text-app-ink font-serif dark:text-app-text-dark">
								Votes and actions
							</h2>
						</div>
					</div>
					<div v-if="person.keyActions.length" class="mt-6 space-y-4">
						<article v-for="action in person.keyActions" :key="action.id" class="content-block">
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
							<p class="text-base text-app-ink leading-7 mt-3 dark:text-app-text-dark">
								{{ action.summary }}
							</p>
							<p class="text-sm text-app-ink leading-7 mt-3 dark:text-app-text-dark">
								{{ action.significance }}
							</p>
						</article>
					</div>
				</section>

				<section v-if="hasFunding" id="funding" class="surface-panel scroll-mt-28">
					<div class="flex flex-wrap gap-4 items-center justify-between">
						<div>
							<h2 class="text-2xl text-app-ink font-serif dark:text-app-text-dark">
								Funding
							</h2>
						</div>
						<NuxtLink v-if="hasFunding" :to="buildLookupAwareTarget(`/representatives/${person.slug}/funding`)" class="btn-secondary">
							Full funding details
						</NuxtLink>
					</div>
					<div v-if="person.funding" class="mt-6 gap-6 grid xl:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)]">
						<div class="space-y-4">
							<p class="text-base text-app-ink leading-7 dark:text-app-text-dark">
								{{ person.funding.summary }}
							</p>
							<div v-if="fundingHighlights.length" class="gap-3 grid sm:grid-cols-2">
								<div v-for="item in fundingHighlights" :key="item.label" class="content-block">
									<p class="text-xs text-app-muted tracking-[0.06em] font-semibold uppercase dark:text-app-muted-dark">
										{{ item.label }}
									</p>
									<p class="text-base text-app-ink mt-2 dark:text-app-text-dark">
										{{ item.value }}
									</p>
								</div>
							</div>
							<p class="text-xs text-app-muted tracking-[0.06em] font-semibold px-1 pt-2 uppercase dark:text-app-muted-dark">
								{{ fundingLineItemsTitle }}
							</p>
							<ul class="space-y-3">
								<li v-for="funder in fundingLineItems" :key="`${funder.name}-${funder.category}`" class="content-block">
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
					</div>
				</section>

				<section v-if="hasInfluence" id="influence" class="surface-panel scroll-mt-28">
					<div class="flex flex-wrap gap-4 items-center justify-between">
						<div>
							<h2 class="text-2xl text-app-ink font-serif dark:text-app-text-dark">
								Influence
							</h2>
						</div>
						<NuxtLink v-if="hasInfluence" :to="buildLookupAwareTarget(`/representatives/${person.slug}/influence`)" class="btn-secondary">
							Full influence details
						</NuxtLink>
					</div>
					<div class="mt-6 gap-6 grid xl:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)]">
						<div class="space-y-4">
							<div v-if="influenceHighlights.length" class="gap-3 grid sm:grid-cols-2">
								<div v-for="item in influenceHighlights" :key="item.label" class="content-block">
									<p class="text-xs text-app-muted tracking-[0.06em] font-semibold uppercase dark:text-app-muted-dark">
										{{ item.label }}
									</p>
									<p class="text-base text-app-ink mt-2 dark:text-app-text-dark">
										{{ item.value }}
									</p>
								</div>
							</div>
							<article v-for="block in person.lobbyingContext.slice(0, 3)" :key="block.id" class="content-block">
								<div class="flex flex-wrap gap-3 items-start justify-between">
									<h3 class="text-lg text-app-ink font-semibold dark:text-app-text-dark">
										{{ block.title }}
									</h3>
									<SourceDrawer :sources="block.sources" :title="block.title" button-label="Sources" />
								</div>
								<p class="text-base text-app-ink leading-7 mt-3 dark:text-app-text-dark">
									{{ block.summary }}
								</p>
							</article>
							<div v-if="influence?.topRegistrants?.length" class="content-block">
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
					</div>
				</section>

				<section v-if="person.sources.length" id="sources" class="surface-panel scroll-mt-28">
					<h2 class="text-2xl text-app-ink font-serif dark:text-app-text-dark">
						Sources and review status
					</h2>
					<div class="mt-6 gap-6 grid xl:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
						<div>
							<SourceList :sources="person.sources" />
						</div>
						<div>
							<h3 class="text-lg text-app-ink font-semibold dark:text-app-text-dark">
								Review status
							</h3>
							<dl class="text-sm text-app-muted leading-7 mt-4 space-y-2 dark:text-app-muted-dark">
								<div>
									<dt class="text-app-ink font-semibold dark:text-app-text-dark">
										Profile reviewed
									</dt>
									<dd>{{ formatDateTime(person.provenance.asOf) }}</dd>
								</div>
								<div>
									<dt class="text-app-ink font-semibold dark:text-app-text-dark">
										Data through
									</dt>
									<dd>{{ formatDateTime(person.freshness.dataLastUpdatedAt ?? person.updatedAt) }}</dd>
								</div>
								<div v-if="person.freshness.statusNote">
									<dt class="text-app-ink font-semibold dark:text-app-text-dark">
										Coverage
									</dt>
									<dd>{{ person.freshness.statusNote }}</dd>
								</div>
							</dl>
							<ul v-if="pageNotes.length" class="mt-5 space-y-2">
								<li v-for="note in pageNotes" :key="note" class="text-sm text-app-muted leading-6 dark:text-app-muted-dark">
									{{ note }}
								</li>
							</ul>
						</div>
					</div>
				</section>
			</div>

			<div class="detail-layout__aside space-y-6" data-representative-sidebar="record-details">
				<PageSectionNav
					:breadcrumbs="breadcrumbs"
					compact
					:items="sectionLinks"
					:show-breadcrumbs="false"
					title="On this page"
				/>
			</div>
			<div class="col-span-full" data-profile-actions="footer">
				<NuxtLink :to="reportIssueTo" class="text-sm text-app-accent font-semibold underline underline-offset-3 inline-flex min-h-11 items-center focus-ring">
					Report an issue
				</NuxtLink>
			</div>
		</div>
	</section>
</template>
