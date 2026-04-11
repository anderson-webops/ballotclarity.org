<script setup lang="ts">
const route = useRoute();
const measureSlug = computed(() => String(route.params.slug));
const { data: measure, error, pending } = await useMeasure(measureSlug);

usePageSeo({
	description: measure.value?.summary ?? "Review a plain-language ballot measure explanation with sources.",
	path: `/measure/${measureSlug.value}`,
	title: measure.value?.title ?? "Ballot measure detail",
});
</script>

<template>
	<section class="app-shell section-gap">
		<div v-if="pending" class="gap-8 grid xl:grid-cols-[minmax(0,1.35fr)_minmax(22rem,0.85fr)]">
			<div class="space-y-6">
				<div class="surface-panel bg-white/70 h-72 animate-pulse dark:bg-app-panel-dark/70" />
				<div v-for="index in 3" :key="index" class="surface-panel bg-white/70 h-52 animate-pulse dark:bg-app-panel-dark/70" />
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
				<header class="surface-panel">
					<div class="flex flex-wrap gap-2">
						<TrustBadge label="Demo measure detail" tone="warning" />
						<TrustBadge label="Plain-language summary" tone="accent" />
					</div>
					<p class="text-xs text-app-muted tracking-[0.24em] font-semibold mt-5 uppercase dark:text-app-muted-dark">
						{{ measure.location }}
					</p>
					<h1 class="text-5xl text-app-ink leading-tight font-serif mt-3 dark:text-app-text-dark">
						{{ measure.title }}
					</h1>
					<p class="text-base text-app-muted leading-8 mt-6 dark:text-app-muted-dark">
						{{ measure.summary }}
					</p>
					<div class="mt-6 flex flex-wrap gap-4">
						<UpdatedAt :value="measure.updatedAt" />
						<NuxtLink to="/ballot/2026-metro-county-general" class="btn-secondary">
							Back to ballot
						</NuxtLink>
					</div>
				</header>

				<section class="surface-panel">
					<div class="flex gap-4 items-center justify-between">
						<h2 class="text-3xl text-app-ink font-serif dark:text-app-text-dark">
							Plain-language explanation
						</h2>
						<SourceDrawer :sources="measure.sources" :title="`${measure.title} sources`" />
					</div>
					<p class="text-base text-app-muted leading-8 mt-6 dark:text-app-muted-dark">
						{{ measure.plainLanguageExplanation }}
					</p>
				</section>

				<section class="gap-6 grid md:grid-cols-2">
					<div class="surface-panel">
						<h2 class="text-3xl text-app-ink font-serif dark:text-app-text-dark">
							What a YES vote means
						</h2>
						<p class="text-sm text-app-muted leading-7 mt-5 dark:text-app-muted-dark">
							{{ measure.yesMeaning }}
						</p>
					</div>
					<div class="surface-panel">
						<h2 class="text-3xl text-app-ink font-serif dark:text-app-text-dark">
							What a NO vote means
						</h2>
						<p class="text-sm text-app-muted leading-7 mt-5 dark:text-app-muted-dark">
							{{ measure.noMeaning }}
						</p>
					</div>
				</section>

				<section class="surface-panel">
					<h2 class="text-3xl text-app-ink font-serif dark:text-app-text-dark">
						Potential impacts
					</h2>
					<div class="mt-6 space-y-4">
						<article v-for="impact in measure.potentialImpacts" :key="impact.id" class="p-5 rounded-3xl bg-app-bg dark:bg-app-bg-dark/70">
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
				</section>

				<section class="surface-panel">
					<h2 class="text-3xl text-app-ink font-serif dark:text-app-text-dark">
						Arguments and considerations
					</h2>
					<p class="text-sm text-app-muted leading-7 mt-4 dark:text-app-muted-dark">
						These notes are framed to show the main tradeoffs described in the attached records. They are not endorsements.
					</p>
					<div class="mt-6 space-y-4">
						<article v-for="item in measure.argumentsAndConsiderations" :key="item.id" class="p-5 rounded-3xl bg-app-bg dark:bg-app-bg-dark/70">
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
				</section>

				<InfoCallout title="Fiscal and context note">
					{{ measure.fiscalContextNote }}
				</InfoCallout>
			</div>

			<aside class="xl:self-start xl:top-28 xl:sticky">
				<div class="surface-panel">
					<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
						Source list
					</p>
					<p class="text-sm text-app-muted leading-7 mt-3 dark:text-app-muted-dark">
						Information may still be incomplete or subject to later election-office updates. Review original records before relying on this page for a real ballot.
					</p>
					<div class="mt-6">
						<SourceList :sources="measure.sources" compact title="Attached sources" />
					</div>
				</div>
			</aside>
		</div>
	</section>
</template>
