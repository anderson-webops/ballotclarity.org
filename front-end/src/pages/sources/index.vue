<script setup lang="ts">
import { publicApiTransparencyItems } from "~/utils/api-transparency";

const searchQuery = ref("");
const { data, pending } = await useSourceDirectory();

const filteredSources = computed(() => {
	const query = searchQuery.value.trim().toLowerCase();

	if (!query)
		return data.value?.sources ?? [];

	return (data.value?.sources ?? []).filter(source => [
		source.title,
		source.publisher,
		source.sourceSystem,
		source.type
	].join(" ").toLowerCase().includes(query));
});

usePageSeo({
	description: "Browse the public source directory behind Ballot Clarity pages, including publishers, dates, citation counts, and linked record files.",
	jsonLd: {
		"@context": "https://schema.org",
		"@type": "CollectionPage",
		"name": "Ballot Clarity source directory"
	},
	path: "/sources",
	title: "Source Directory"
});
</script>

<template>
	<section class="app-shell section-gap space-y-8">
		<header class="max-w-4xl">
			<div class="flex flex-wrap gap-2">
				<TrustBadge label="Source directory" tone="accent" />
				<TrustBadge label="Citation-ready" />
				<TrustBadge label="Open record links" />
			</div>
			<h1 class="text-5xl text-app-ink font-serif mt-5 dark:text-app-text-dark">
				Source directory
			</h1>
			<p class="text-base text-app-muted leading-8 mt-5 dark:text-app-muted-dark">
				Every source record in Ballot Clarity is listed here with authority, publisher, citation count, and the pages where it is used.
			</p>
		</header>

		<div class="surface-panel">
			<label for="source-search" class="text-sm text-app-ink font-semibold dark:text-app-text-dark">
				Search sources
			</label>
			<div class="mt-4 relative">
				<span class="i-carbon-search text-app-muted pointer-events-none left-4 top-1/2 absolute dark:text-app-muted-dark -translate-y-1/2" />
				<input
					id="source-search"
					v-model="searchQuery"
					type="search"
					placeholder="Search by source title, publisher, or system"
					class="text-sm text-app-ink pl-11 pr-4 border border-app-line rounded-full bg-white h-13 w-full shadow-sm dark:text-app-text-dark placeholder:text-app-muted dark:border-app-line-dark dark:bg-app-panel-dark focus-ring dark:placeholder:text-app-muted-dark"
				>
			</div>
		</div>

		<div v-if="pending" class="space-y-6">
			<div v-for="index in 4" :key="index" class="surface-panel bg-white/70 h-40 animate-pulse dark:bg-app-panel-dark/70" />
		</div>

		<div v-else-if="!filteredSources.length" class="surface-panel">
			<h2 class="text-3xl text-app-ink font-serif dark:text-app-text-dark">
				No sources match the current search.
			</h2>
			<p class="text-sm text-app-muted leading-7 mt-4 dark:text-app-muted-dark">
				Try a publisher name, source system, or source title. You can also clear the field to browse the full directory.
			</p>
		</div>

		<div v-else class="space-y-4">
			<NuxtLink
				v-for="source in filteredSources"
				:key="source.id"
				:to="`/sources/${source.id}`"
				class="surface-panel block transition hover:border-app-accent focus-ring"
			>
				<div class="flex flex-wrap gap-3 items-start justify-between">
					<div class="min-w-0">
						<div class="flex flex-wrap gap-2 items-center">
							<SourceAuthorityBadge :authority="source.authority" />
							<span class="text-[11px] text-app-muted tracking-[0.14em] font-semibold px-2.5 py-1 rounded-full bg-app-bg uppercase dark:text-app-muted-dark dark:bg-app-bg-dark/70">
								{{ source.type }}
							</span>
						</div>
						<h2 class="text-2xl text-app-ink font-serif mt-4 dark:text-app-text-dark">
							{{ source.title }}
						</h2>
						<p class="text-sm text-app-muted leading-7 mt-3 dark:text-app-muted-dark">
							{{ source.publisher }} · {{ source.sourceSystem }}
						</p>
					</div>
					<TrustBadge :label="`${source.citationCount} citation${source.citationCount === 1 ? '' : 's'}`" />
				</div>
			</NuxtLink>
		</div>

		<section class="surface-panel">
			<div class="flex flex-wrap gap-2">
				<TrustBadge label="Public API layer" tone="accent" />
				<TrustBadge label="Lookup and enrichment provenance" />
			</div>
			<h2 class="text-3xl text-app-ink font-serif mt-5 dark:text-app-text-dark">
				Public APIs and provider systems used by Ballot Clarity
			</h2>
			<p class="text-sm text-app-muted leading-7 mt-4 dark:text-app-muted-dark">
				Individual pages above still show their own source citations. This section is the broader provider-level transparency layer: the APIs and public systems Ballot Clarity uses for lookup, district matching, representative records, and person-level finance or influence enrichment where available.
			</p>
			<div class="mt-6 gap-4 grid lg:grid-cols-2">
				<article
					v-for="api in publicApiTransparencyItems"
					:key="api.id"
					class="px-5 py-5 border border-app-line/70 rounded-3xl bg-white/80 dark:border-app-line-dark dark:bg-app-panel-dark/70"
				>
					<div class="flex flex-wrap gap-2 items-center">
						<TrustBadge :label="api.category" />
						<span
							v-for="routeFamily in api.routeFamilies"
							:key="`${api.id}-${routeFamily}`"
							class="text-[11px] text-app-muted tracking-[0.14em] font-semibold px-2.5 py-1 rounded-full bg-app-bg uppercase dark:text-app-muted-dark dark:bg-app-bg-dark/70"
						>
							{{ routeFamily }}
						</span>
					</div>
					<h3 class="text-2xl text-app-ink font-serif mt-4 dark:text-app-text-dark">
						{{ api.label }}
					</h3>
					<p class="text-sm text-app-muted leading-7 mt-3 dark:text-app-muted-dark">
						{{ api.usedFor }}
					</p>
					<p class="text-sm text-app-muted leading-7 mt-3 dark:text-app-muted-dark">
						{{ api.note }}
					</p>
					<div class="mt-5 flex flex-wrap gap-3">
						<a
							:href="api.docsUrl"
							target="_blank"
							rel="noreferrer"
							class="btn-secondary inline-flex gap-2 items-center"
						>
							API docs
							<span class="i-carbon-launch" />
						</a>
					</div>
				</article>
			</div>
		</section>
	</section>
</template>
