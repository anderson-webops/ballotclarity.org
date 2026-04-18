<script setup lang="ts">
import type { Source } from "~/types/civic";
import { buildPersonLinkageConfidence, hasPersonInfluence } from "~/utils/person-profile";

const route = useRoute();
const { layerBreadcrumbLink } = useRouteLayerNavigation();
const representativeSlug = computed(() => String(route.params.slug));
const { formatDate, formatDateTime } = useFormatters();
const { data, error, pending } = await useRepresentative(representativeSlug);

function uniqueSources(sources: Source[]) {
	return Array.from(new Map(sources.map(source => [source.id, source])).values());
}

const person = computed(() => data.value?.person ?? null);
const linkageConfidence = computed(() => person.value ? buildPersonLinkageConfidence(person.value.provenance.status) : null);
const influenceAvailable = computed(() => person.value ? hasPersonInfluence(person.value) : false);
const influenceSources = computed(() => person.value
	? uniqueSources([
			...person.value.lobbyingContext.flatMap(item => item.sources),
			...person.value.publicStatements.flatMap(item => item.sources)
		])
	: []);
const breadcrumbs = computed(() => [
	{ label: "Home", to: "/" },
	layerBreadcrumbLink.value,
	{ label: person.value?.name ?? "Representative profile", to: person.value ? `/representatives/${person.value.slug}` : undefined },
	{ label: "Influence" }
]);

const summaryItems = computed(() => {
	if (!person.value)
		return [];

	return [
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
		<div v-if="pending" class="space-y-6">
			<div class="surface-panel bg-white/70 h-80 animate-pulse dark:bg-app-panel-dark/70" />
			<div class="surface-panel bg-white/70 h-64 animate-pulse dark:bg-app-panel-dark/70" />
		</div>

		<div v-else-if="error || !person" class="max-w-3xl">
			<InfoCallout title="Influence page unavailable" tone="warning">
				This representative influence page could not be loaded. Return to the representative profile and try again.
			</InfoCallout>
		</div>

		<div v-else-if="!influenceAvailable" class="max-w-3xl">
			<InfoCallout title="No influence context attached" tone="warning">
				Ballot Clarity does not currently have a publishable lobbying or influence context block attached to this representative record.
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
					This page isolates the donor, sector, lobbying, and disclosure context attached to the representative profile. It is meant to help scrutiny, not to imply automatic motive or proof of influence.
				</p>
				<div class="mt-6 flex flex-wrap gap-3">
					<NuxtLink :to="`/representatives/${person.slug}`" class="btn-secondary">
						Back to profile
					</NuxtLink>
					<NuxtLink v-if="person.funding" :to="`/representatives/${person.slug}/funding`" class="btn-secondary">
						Open funding page
					</NuxtLink>
					<SourceDrawer :sources="influenceSources" :title="`${person.name} influence sources`" button-label="Influence sources" />
				</div>
				<div class="mt-6">
					<PageSummaryStrip :items="summaryItems" />
				</div>
			</header>

			<section class="gap-6 grid xl:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)]">
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
		</div>
	</section>
</template>
