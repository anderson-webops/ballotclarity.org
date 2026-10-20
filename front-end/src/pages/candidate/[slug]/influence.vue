<script setup lang="ts">
const { openLayerLink, overviewLink } = useRouteLayerNavigation();
const candidateSlug = useRouteStringParam("slug");
const { formatDateTime } = useFormatters();
const { data: candidate, error, pending } = await useCandidate(candidateSlug);

const breadcrumbs = computed(() => [
	{ label: "Home", to: "/" },
	overviewLink.value,
	{ label: candidate.value?.name ?? "Candidate profile", to: candidate.value ? `/candidate/${candidate.value.slug}` : undefined },
	{ label: "Influence" }
]);

const influenceSources = computed(() => candidate.value
	? Array.from(new Map(candidate.value.lobbyingContext.flatMap(item => item.sources).map(source => [source.id, source])).values())
	: []);

const summaryItems = computed(() => {
	if (!candidate.value)
		return [];

	return [
		{ label: "Influence notes", note: "Context blocks on donors, sectors, and public disclosures.", value: candidate.value.lobbyingContext.length },
		{ label: "Public statements", note: "Statements that interact with the influence context.", value: candidate.value.publicStatements.length },
		{ label: "Updated", note: "Profile freshness.", value: formatDateTime(candidate.value.updatedAt) }
	];
});

usePageSeo({
	description: candidate.value?.lobbyingContext[0]?.summary ?? "Candidate influence page with lobbying context, public statements, and source links.",
	path: `/candidate/${candidateSlug.value}/influence`,
	title: candidate.value ? `${candidate.value.name} Influence` : "Candidate influence"
});
</script>

<template>
	<section class="app-shell section-gap space-y-8">
		<div v-if="pending" class="space-y-6">
			<div class="rounded-lg bg-app-bg h-80 animate-pulse dark:bg-app-bg-dark" />
			<div class="rounded-lg bg-app-bg h-64 animate-pulse dark:bg-app-bg-dark" />
		</div>

		<GuideUnavailableState
			v-else-if="error || !candidate"
			message="Influence details for this candidate aren't published yet."
			:primary-label="openLayerLink.label"
			:primary-to="openLayerLink.to"
			secondary-label="Coverage"
			secondary-to="/coverage"
			tertiary-label="Report missing information"
			tertiary-to="/contact"
			title="Influence context not published yet"
		/>

		<div v-else class="space-y-8">
			<header class="surface-panel">
				<AppBreadcrumbs :items="breadcrumbs" />
				<h1 class="text-5xl text-app-ink font-serif mt-5 dark:text-app-text-dark">
					{{ candidate.name }} influence context
				</h1>
				<p class="text-base text-app-muted leading-8 mt-5 dark:text-app-muted-dark">
					Context only. Not proof that any donor or organization influenced a decision.
				</p>
				<div class="mt-6 flex flex-wrap gap-3">
					<NuxtLink :to="`/candidate/${candidate.slug}`" class="btn-secondary">
						Back to profile
					</NuxtLink>
					<NuxtLink :to="`/candidate/${candidate.slug}/funding`" class="btn-secondary">
						Funding
					</NuxtLink>
					<SourceDrawer :sources="influenceSources" :title="`${candidate.name} influence sources`" button-label="Influence sources" />
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
							v-for="item in candidate.lobbyingContext"
							:key="item.id"
							class="content-block"
						>
							<h3 class="text-xl text-app-ink font-semibold dark:text-app-text-dark">
								{{ item.title }}
							</h3>
							<p class="text-base text-app-ink leading-7 mt-3 dark:text-app-text-dark">
								{{ item.summary }}
							</p>
							<div class="mt-4">
								<SourceList :sources="item.sources" />
							</div>
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
								v-for="statement in candidate.publicStatements"
								:key="statement.id"
								class="content-block"
							>
								<h3 class="text-xl text-app-ink font-semibold dark:text-app-text-dark">
									{{ statement.title }}
								</h3>
								<p class="text-base text-app-ink leading-7 mt-3 dark:text-app-text-dark">
									{{ statement.summary }}
								</p>
							</article>
						</div>
					</div>
				</div>
			</section>
		</div>
	</section>
</template>
