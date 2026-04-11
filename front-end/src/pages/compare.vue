<script setup lang="ts">
const civicStore = useCivicStore();
const route = useRoute();

const selectedSlugs = computed(() => {
	if (typeof route.query.slugs === "string" && route.query.slugs.length)
		return route.query.slugs.split(",").map(item => item.trim()).filter(Boolean).slice(0, 3);

	return civicStore.compareList;
});

watchEffect(() => {
	civicStore.replaceCompare(selectedSlugs.value);
});

const { data, pending } = await useCandidates(selectedSlugs);

usePageSeo({
	description: "Compare two or three demo candidates side by side using neutral, source-backed information.",
	path: "/compare",
	title: "Compare Candidates",
});
</script>

<template>
	<section class="app-shell section-gap space-y-8">
		<header class="max-w-4xl">
			<div class="flex flex-wrap gap-2">
				<TrustBadge label="Neutral compare view" tone="accent" />
				<TrustBadge label="No scores or rankings" />
			</div>
			<h1 class="text-5xl text-app-ink font-serif mt-5 dark:text-app-text-dark">
				Compare candidates side by side.
			</h1>
			<p class="text-base text-app-muted leading-8 mt-5 max-w-3xl dark:text-app-muted-dark">
				This comparison is informational only. It shows office, party, incumbent status, key actions, funding context, and source-backed notes without ranking candidates like a horse race.
			</p>
		</header>

		<div v-if="pending" class="surface-panel bg-white/70 h-96 animate-pulse dark:bg-app-panel-dark/70" />

		<div v-else-if="(data?.candidates.length ?? 0) < 2" class="max-w-3xl">
			<InfoCallout title="Select at least two candidates to compare" tone="warning">
				Add candidates from the ballot page first, or open this page with a `slugs` query string. The compare table supports up to three candidates at a time.
			</InfoCallout>
			<div class="mt-6 flex flex-wrap gap-3">
				<NuxtLink to="/ballot/2026-metro-county-general" class="btn-primary">
					Open demo ballot
				</NuxtLink>
				<button type="button" class="btn-secondary" @click="civicStore.clearCompare()">
					Clear compare list
				</button>
			</div>
		</div>

		<template v-else>
			<section class="surface-panel">
				<div class="flex flex-wrap gap-4 items-center justify-between">
					<div>
						<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
							Comparison set
						</p>
						<h2 class="text-3xl text-app-ink font-serif mt-2 dark:text-app-text-dark">
							{{ data?.office || 'Mixed offices' }}
						</h2>
						<p class="text-sm text-app-muted leading-7 mt-3 dark:text-app-muted-dark">
							Use this table to compare documented differences in record, funding, and stated priorities. If candidates are from different contests, avoid reading the result as a direct substitute for a same-race comparison.
						</p>
					</div>
					<div class="flex flex-wrap gap-3">
						<NuxtLink to="/ballot/2026-metro-county-general" class="btn-secondary">
							Back to ballot
						</NuxtLink>
						<button type="button" class="btn-primary" @click="civicStore.clearCompare()">
							Clear compare list
						</button>
					</div>
				</div>
			</section>

			<CompareTable :candidates="data?.candidates || []" />

			<section class="gap-6 grid xl:grid-cols-3">
				<article v-for="candidate in data?.candidates" :key="candidate.slug" class="surface-panel">
					<div class="flex flex-wrap gap-2 items-center">
						<h3 class="text-2xl text-app-ink font-serif dark:text-app-text-dark">
							{{ candidate.name }}
						</h3>
						<IncumbentBadge v-if="candidate.incumbent" />
					</div>
					<p class="text-sm text-app-muted mt-2 dark:text-app-muted-dark">
						{{ candidate.officeSought }} · {{ candidate.party }}
					</p>
					<p class="text-sm text-app-muted leading-7 mt-4 dark:text-app-muted-dark">
						{{ candidate.summary }}
					</p>
					<div class="mt-5">
						<SourceDrawer :sources="candidate.sources" :title="`${candidate.name} comparison sources`" />
					</div>
				</article>
			</section>
		</template>
	</section>
</template>
