<script setup lang="ts">
import { formatSourcePublicationKind, formatSourcePublisherType, groupSourceDirectoryItems } from "~/utils/source-directory";

const searchQuery = ref("");
const { data, pending } = await useSourceDirectory();

const filteredSources = computed(() => {
	const query = searchQuery.value.trim().toLowerCase();

	if (!query)
		return data.value?.sources ?? [];

	return (data.value?.sources ?? []).filter(source => [
		source.summary,
		source.title,
		source.publisher,
		source.publisherType,
		source.geographicScope,
		source.sourceSystem,
		source.type,
		source.usedFor,
		source.routeFamilies.join(" "),
		source.limitations.join(" ")
	].join(" ").toLowerCase().includes(query));
});

const sections = computed(() => groupSourceDirectoryItems(filteredSources.value));

usePageSeo({
	description: "Browse Ballot Clarity’s public source directory for official systems, public-interest providers, and published source records used across the site.",
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
				Here are the source systems and published source records Ballot Clarity uses across the site. Use this directory to see what a source is, what it is used for, and where you can inspect it directly.
			</p>
		</header>

		<div class="surface-row">
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

		<div v-else class="space-y-8">
			<section
				v-for="section in sections"
				:key="section.kind"
				class="space-y-4"
			>
				<header class="max-w-4xl">
					<h2 class="text-3xl text-app-ink font-serif dark:text-app-text-dark">
						{{ section.heading }}
					</h2>
					<p class="text-sm text-app-muted leading-7 mt-3 dark:text-app-muted-dark">
						{{ section.description }}
					</p>
				</header>

				<div class="space-y-3">
					<NuxtLink
						v-for="source in section.items"
						:key="source.id"
						:to="`/sources/${source.id}`"
						class="surface-row block transition hover:border-app-accent focus-ring"
					>
						<div class="flex flex-wrap gap-3 items-start justify-between">
							<div class="max-w-4xl min-w-0">
								<div class="flex flex-wrap gap-2 items-center">
									<SourceAuthorityBadge :authority="source.authority" />
									<TrustBadge :label="formatSourcePublisherType(source.publisherType)" />
									<TrustBadge :label="formatSourcePublicationKind(source.publicationKind)" tone="accent" />
								</div>
								<h3 class="text-xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
									{{ source.title }}
								</h3>
								<p class="text-sm text-app-muted leading-6 mt-2 dark:text-app-muted-dark">
									{{ source.summary }}
								</p>
								<p class="text-xs text-app-muted leading-6 mt-2 dark:text-app-muted-dark">
									{{ source.publisher }} · {{ source.sourceSystem }}
								</p>
								<p class="text-sm text-app-muted leading-6 mt-2 dark:text-app-muted-dark">
									{{ source.usedFor }}
								</p>
							</div>
							<div class="flex flex-col gap-3 items-start sm:items-end">
								<TrustBadge :label="`${source.citationCount} citation${source.citationCount === 1 ? '' : 's'}`" />
								<p class="text-xs text-app-muted leading-6 text-left max-w-[14rem] dark:text-app-muted-dark sm:text-right">
									{{ source.geographicScope }}
								</p>
							</div>
						</div>
					</NuxtLink>
				</div>
			</section>
		</div>
	</section>
</template>
