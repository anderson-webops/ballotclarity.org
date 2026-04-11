<script setup lang="ts">
const route = useRoute();
const siteUrl = useSiteUrl();
const sourceId = computed(() => String(route.params.id));
const { formatDate } = useFormatters();
const { data, pending, error } = await useSourceRecord(sourceId);

usePageSeo({
	description: data.value?.source.note || "Ballot Clarity source record with citations and linked public file.",
	jsonLd: data.value
		? {
				"@context": "https://schema.org",
				"@type": "CreativeWork",
				"name": data.value.source.title,
				"publisher": data.value.source.publisher,
				"url": `${siteUrl}/sources/${data.value.source.id}`
			}
		: undefined,
	path: `/sources/${sourceId.value}`,
	title: data.value?.source.title || "Source record"
});
</script>

<template>
	<section class="app-shell section-gap space-y-8">
		<div v-if="pending" class="surface-panel bg-white/70 h-96 animate-pulse dark:bg-app-panel-dark/70" />

		<div v-else-if="error || !data" class="max-w-3xl">
			<InfoCallout title="Source record unavailable" tone="warning">
				This source record could not be loaded. Return to the source directory and try another record.
			</InfoCallout>
		</div>

		<div v-else class="space-y-8">
			<header class="surface-panel">
				<div class="flex flex-wrap gap-2">
					<SourceAuthorityBadge :authority="data.source.authority" />
					<TrustBadge :label="data.source.type" />
					<TrustBadge :label="`${data.source.citationCount} citation${data.source.citationCount === 1 ? '' : 's'}`" tone="accent" />
				</div>
				<h1 class="text-5xl text-app-ink font-serif mt-5 dark:text-app-text-dark">
					{{ data.source.title }}
				</h1>
				<p class="text-base text-app-muted leading-8 mt-5 dark:text-app-muted-dark">
					{{ data.source.publisher }} · {{ data.source.sourceSystem }}
				</p>
				<div class="mt-6 flex flex-wrap gap-3">
					<a :href="data.source.url" target="_blank" rel="noreferrer" class="btn-primary">
						Open source file
					</a>
					<NuxtLink to="/sources" class="btn-secondary">
						Back to directory
					</NuxtLink>
				</div>
			</header>

			<section class="gap-6 grid lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
				<div class="surface-panel">
					<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
						Source metadata
					</p>
					<div class="mt-6 space-y-4">
						<div class="px-5 py-5 rounded-3xl bg-app-bg dark:bg-app-bg-dark/70">
							<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
								Publisher
							</p>
							<p class="text-sm text-app-ink font-semibold mt-3 dark:text-app-text-dark">
								{{ data.source.publisher }}
							</p>
						</div>
						<div class="px-5 py-5 rounded-3xl bg-app-bg dark:bg-app-bg-dark/70">
							<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
								Date
							</p>
							<p class="text-sm text-app-ink font-semibold mt-3 dark:text-app-text-dark">
								{{ formatDate(data.source.date) }}
							</p>
						</div>
						<div class="px-5 py-5 rounded-3xl bg-app-bg dark:bg-app-bg-dark/70">
							<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
								Note
							</p>
							<p class="text-sm text-app-muted leading-7 mt-3 dark:text-app-muted-dark">
								{{ data.source.note || "No additional note is attached to this source record." }}
							</p>
						</div>
					</div>
				</div>

				<div class="surface-panel">
					<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
						Cited by
					</p>
					<h2 class="text-3xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
						Pages that use this record
					</h2>
					<div class="mt-6 space-y-4">
						<NuxtLink
							v-for="citation in data.source.citedBy"
							:key="citation.id"
							:to="citation.href"
							class="px-5 py-5 border border-app-line/80 rounded-3xl bg-white/80 block transition dark:border-app-line-dark hover:border-app-accent dark:bg-app-panel-dark/70 focus-ring"
						>
							<div class="flex flex-wrap gap-3 items-center justify-between">
								<div>
									<p class="text-lg text-app-ink font-semibold dark:text-app-text-dark">
										{{ citation.label }}
									</p>
									<p class="text-sm text-app-muted mt-2 dark:text-app-muted-dark">
										{{ citation.type }}
									</p>
								</div>
								<span class="i-carbon-arrow-right text-lg text-app-accent" />
							</div>
						</NuxtLink>
					</div>
				</div>
			</section>
		</div>
	</section>
</template>
