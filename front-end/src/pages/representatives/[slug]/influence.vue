<script setup lang="ts">
import type { Source } from "~/types/civic";
import { storeToRefs } from "pinia";

import { activeNationwideLookupCookieName, parseActiveNationwideLookupCookie } from "~/utils/active-nationwide-cookie";
import { buildNationwidePersonProfileResponse } from "~/utils/nationwide-person-profile";
import { buildLookupContextFromNationwideResult, buildNationwideLookupRouteQuery, buildNationwideRouteTarget } from "~/utils/nationwide-route-context";
import { buildPersonLinkageConfidence, hasPersonInfluence } from "~/utils/person-profile";

const route = useRoute();
const civicStore = useCivicStore();
const { isHydrated, nationwideLookupResult } = storeToRefs(civicStore);
const { layerBreadcrumbLink } = useRouteLayerNavigation();
const representativeSlug = computed(() => String(route.params.slug));
const { formatDate, formatDateTime } = useFormatters();
const activeNationwideLookupCookie = useCookie<string | null>(activeNationwideLookupCookieName);
const serverNationwideLookupResult = computed(() => parseActiveNationwideLookupCookie(activeNationwideLookupCookie.value));
const activeNationwideLookupResult = computed(() => isHydrated.value ? nationwideLookupResult.value : serverNationwideLookupResult.value);
const activeLookupQuery = computed(() => buildNationwideLookupRouteQuery(
	buildLookupContextFromNationwideResult(activeNationwideLookupResult.value),
	route.query
));
const { data, error, pending } = await useRepresentative(representativeSlug, activeLookupQuery);

function uniqueSources(sources: Source[]) {
	return Array.from(new Map(sources.map(source => [source.id, source])).values());
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

	return data.value;
});
const person = computed(() => profileData.value?.person ?? null);
const pagePending = computed(() => pending.value || (!data.value && !fallbackData.value));
const linkageConfidence = computed(() => person.value ? buildPersonLinkageConfidence(person.value.provenance.status) : null);
const influenceAvailable = computed(() => person.value ? hasPersonInfluence(person.value) : false);
const influenceUnavailableSummary = computed(() => person.value
	? person.value.enrichmentStatus?.influence.summary || `${person.value.name} resolves as a stable public officeholder record, but Ballot Clarity does not currently have a publishable lobbying or influence context block attached to this person.`
	: "");
const influenceSources = computed(() => person.value
	? uniqueSources([
			...person.value.lobbyingContext.flatMap(item => item.sources),
			...person.value.publicStatements.flatMap(item => item.sources)
		])
	: []);
function buildLookupAwareTarget(path: string) {
	return buildNationwideRouteTarget(path, buildLookupContextFromNationwideResult(activeNationwideLookupResult.value), route.query);
}
const breadcrumbs = computed(() => [
	{ label: "Home", to: "/" },
	{ label: layerBreadcrumbLink.value.label, to: buildLookupAwareTarget(layerBreadcrumbLink.value.to) },
	{ label: person.value?.name ?? "Representative profile", to: person.value ? buildLookupAwareTarget(`/representatives/${person.value.slug}`) : undefined },
	{ label: "Influence" }
]);

const summaryItems = computed(() => {
	if (!person.value)
		return [];

	if (!influenceAvailable.value) {
		return [
			{ label: "Current office", note: "Office context attached to this representative record.", value: person.value.officeSought },
			{ label: "Influence status", note: "Lobbying or disclosure attachment for this route.", value: "Unavailable" },
			{ label: "Updated", note: "Profile freshness.", value: formatDateTime(person.value.updatedAt) }
		];
	}

	return [
		{ label: "Current office", note: "Office context attached to this representative record.", value: person.value.officeSought },
		{ label: "Influence notes", note: "Context blocks on donors, sectors, and public disclosures.", value: person.value.lobbyingContext.length },
		{ label: "Public statements", note: "Statements that interact with the influence context.", value: person.value.publicStatements.length },
		{ label: "Updated", note: "Profile freshness.", value: formatDateTime(person.value.updatedAt) }
	];
});

usePageSeo({
	description: person.value?.lobbyingContext[0]?.summary ?? "Representative influence page with lobbying context, public statements, and source links.",
	path: `/representatives/${representativeSlug.value}/influence`,
	title: person.value ? `${person.value.name} Influence` : "Representative influence"
});
</script>

<template>
	<section class="app-shell section-gap space-y-8">
		<div v-if="pagePending" class="space-y-6">
			<div class="surface-panel bg-white/70 h-80 animate-pulse dark:bg-app-panel-dark/70" />
			<div class="surface-panel bg-white/70 h-64 animate-pulse dark:bg-app-panel-dark/70" />
		</div>

		<div v-else-if="(error && !fallbackData) || !person" class="max-w-3xl">
			<InfoCallout title="Influence page unavailable" tone="warning">
				This representative influence page could not be loaded. Return to the representative profile and try again.
			</InfoCallout>
		</div>

		<div v-else class="space-y-8">
			<header class="surface-panel">
				<AppBreadcrumbs :items="breadcrumbs" />
				<div class="flex flex-wrap gap-2">
					<VerificationBadge label="Influence page" tone="accent" />
					<VerificationBadge label="Context, not causation" />
					<VerificationBadge :label="linkageConfidence?.label ?? 'Linkage review'" />
				</div>
				<h1 class="text-5xl text-app-ink font-serif mt-5 dark:text-app-text-dark">
					{{ person.name }} influence context
				</h1>
				<p class="text-base text-app-muted leading-8 mt-5 dark:text-app-muted-dark">
					{{
						influenceAvailable
							? "This page isolates the donor, sector, lobbying, and disclosure context attached to the representative profile. It is meant to help scrutiny, not to imply automatic motive or proof of influence."
							: influenceUnavailableSummary
					}}
				</p>
				<div class="mt-6 flex flex-wrap gap-3">
					<NuxtLink :to="buildLookupAwareTarget(`/representatives/${person.slug}`)" class="btn-secondary">
						Back to profile
					</NuxtLink>
					<NuxtLink :to="buildLookupAwareTarget(`/representatives/${person.slug}/funding`)" class="btn-secondary">
						Open funding page
					</NuxtLink>
					<SourceDrawer :sources="influenceSources.length ? influenceSources : person.sources" :title="`${person.name} influence sources`" button-label="Influence sources" />
				</div>
				<div class="mt-6">
					<PageSummaryStrip :items="summaryItems" />
				</div>
			</header>

			<section v-if="influenceAvailable" class="gap-6 grid xl:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)]">
				<div class="surface-panel">
					<h2 class="text-3xl text-app-ink font-serif dark:text-app-text-dark">
						Influence notes
					</h2>
					<div class="mt-6 space-y-4">
						<article
							v-for="item in person.lobbyingContext"
							:key="item.id"
							class="p-5 rounded-3xl bg-app-bg dark:bg-app-bg-dark/70"
						>
							<div class="flex flex-wrap gap-3 items-start justify-between">
								<div>
									<h3 class="text-xl text-app-ink font-semibold dark:text-app-text-dark">
										{{ item.title }}
									</h3>
									<p class="text-sm text-app-muted mt-2 dark:text-app-muted-dark">
										{{ formatDate(person.freshness.dataLastUpdatedAt ?? person.updatedAt) }}
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

				<div class="space-y-6">
					<div class="surface-panel">
						<h2 class="text-3xl text-app-ink font-serif dark:text-app-text-dark">
							Related public statements
						</h2>
						<div class="mt-6 space-y-4">
							<article
								v-for="statement in person.publicStatements"
								:key="statement.id"
								class="p-5 rounded-3xl bg-app-bg dark:bg-app-bg-dark/70"
							>
								<h3 class="text-xl text-app-ink font-semibold dark:text-app-text-dark">
									{{ statement.title }}
								</h3>
								<p class="text-sm text-app-muted leading-7 mt-3 dark:text-app-muted-dark">
									{{ statement.summary }}
								</p>
							</article>
						</div>
					</div>

					<div class="surface-panel">
						<h2 class="text-3xl text-app-ink font-serif dark:text-app-text-dark">
							How to read this safely
						</h2>
						<ul class="readable-list text-sm text-app-muted mt-5 pl-5 dark:text-app-muted-dark">
							<li><strong class="text-app-ink dark:text-app-text-dark">Linkage:</strong> {{ person.provenance.status }}</li>
							<li><strong class="text-app-ink dark:text-app-text-dark">Confidence:</strong> {{ linkageConfidence?.label }}</li>
							<li><strong class="text-app-ink dark:text-app-text-dark">Coverage:</strong> Public disclosures and source-backed statements where available.</li>
							<li><strong class="text-app-ink dark:text-app-text-dark">Data through:</strong> {{ formatDate(person.freshness.dataLastUpdatedAt ?? person.updatedAt) }}</li>
							<li>Treat sector and donor overlap as context, not proof.</li>
							<li>Compare the influence notes with the funding page and direct filings.</li>
							<li>{{ person.freshness.statusNote }}</li>
						</ul>
					</div>
				</div>
			</section>

			<section v-else class="surface-panel max-w-4xl">
				<h2 class="text-3xl text-app-ink font-serif dark:text-app-text-dark">
					No influence context attached yet
				</h2>
				<p class="text-sm text-app-muted leading-7 mt-4 dark:text-app-muted-dark">
					Ballot Clarity resolved the person identity and office context for this route, but it does not currently have a publishable lobbying or disclosure context block attached to this representative record.
				</p>
				<ul class="readable-list text-sm text-app-muted mt-6 pl-5 dark:text-app-muted-dark">
					<li><strong class="text-app-ink dark:text-app-text-dark">Office:</strong> {{ person.officeSought }}</li>
					<li><strong class="text-app-ink dark:text-app-text-dark">District:</strong> {{ person.districtLabel }}</li>
					<li><strong class="text-app-ink dark:text-app-text-dark">Linkage:</strong> {{ linkageConfidence?.label }}</li>
					<li><strong class="text-app-ink dark:text-app-text-dark">Status:</strong> {{ person.enrichmentStatus?.influence.summary || influenceUnavailableSummary }}</li>
					<li><strong class="text-app-ink dark:text-app-text-dark">Provenance:</strong> {{ person.provenance.label }}</li>
					<li><strong class="text-app-ink dark:text-app-text-dark">Updated:</strong> {{ formatDate(person.freshness.dataLastUpdatedAt ?? person.updatedAt) }}</li>
					<li>{{ person.freshness.statusNote }}</li>
				</ul>
			</section>
		</div>
	</section>
</template>
