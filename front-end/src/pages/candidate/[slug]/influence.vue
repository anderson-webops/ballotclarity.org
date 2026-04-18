<script setup lang="ts">
const route = useRoute();
const candidateSlug = computed(() => String(route.params.slug));
const { formatDateTime } = useFormatters();
const { data: candidate, error, pending } = await useCandidate(candidateSlug);

const breadcrumbs = computed(() => [
	{ label: "Home", to: "/" },
	{ label: "Ballot guide", to: "/ballot" },
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
			<div class="surface-panel bg-white/70 h-80 animate-pulse dark:bg-app-panel-dark/70" />
			<div class="surface-panel bg-white/70 h-64 animate-pulse dark:bg-app-panel-dark/70" />
		</div>

		<div v-else-if="error || !candidate" class="max-w-3xl">
			<InfoCallout title="Influence page unavailable" tone="warning">
				This candidate influence page could not be loaded. Return to the candidate profile and try again.
			</InfoCallout>
		</div>

		<div v-else class="space-y-8">
			<header class="surface-panel">
				<AppBreadcrumbs :items="breadcrumbs" />
				<div class="flex flex-wrap gap-2">
					<VerificationBadge label="Influence page" tone="accent" />
					<VerificationBadge label="Context, not causation" />
				</div>
				<h1 class="text-5xl text-app-ink font-serif mt-5 dark:text-app-text-dark">
					{{ candidate.name }} influence context
				</h1>
				<p class="text-base text-app-muted leading-8 mt-5 dark:text-app-muted-dark">
					This page isolates the donor, sector, lobbying, and disclosure context attached to the candidate profile. It is meant to help scrutiny, not to imply automatic motive or proof of influence.
				</p>
				<div class="mt-6 flex flex-wrap gap-3">
					<NuxtLink :to="`/candidate/${candidate.slug}`" class="btn-secondary">
						Back to profile
					</NuxtLink>
					<NuxtLink :to="`/candidate/${candidate.slug}/funding`" class="btn-secondary">
						Open funding page
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
							class="p-5 rounded-3xl bg-app-bg dark:bg-app-bg-dark/70"
						>
							<h3 class="text-xl text-app-ink font-semibold dark:text-app-text-dark">
								{{ item.title }}
							</h3>
							<p class="text-sm text-app-muted leading-7 mt-3 dark:text-app-muted-dark">
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
							<li>Treat sector and donor overlap as context, not proof</li>
							<li>Compare the influence notes with the funding page and direct filings</li>
							<li>Check whether the statements and the disclosures cover the same time window</li>
							<li>Use the candidate profile for the broader record before drawing conclusions</li>
						</ul>
					</div>
				</div>
			</section>
		</div>
	</section>
</template>
