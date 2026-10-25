<script setup lang="ts">
import { groupSourceDirectoryItems } from "~/utils/source-directory";

const searchQuery = ref("");
const { data, error, pending } = await useSourceDirectory();
const filteredSources = computed(() => {
	const query = searchQuery.value.trim().toLowerCase();
	return (data.value?.sources ?? []).filter(source => !query || [
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
	description: "Public source records and data providers used by Ballot Clarity.",
	jsonLd: { "@context": "https://schema.org", "@type": "CollectionPage", "name": "Ballot Clarity sources" },
	path: "/sources",
	title: "Sources"
});
</script>

<template>
	<section class="app-shell section-gap">
		<div class="max-w-4xl space-y-8">
			<header>
				<h1 class="text-5xl text-app-ink font-serif dark:text-app-text-dark">
					Sources
				</h1>
				<nav class="text-sm font-semibold mt-5 flex flex-wrap gap-x-6 gap-y-2" aria-label="Sources">
					<NuxtLink to="/records" class="text-app-accent rounded-sm underline underline-offset-3 focus-ring">
						Candidate records
					</NuxtLink>
					<a href="#directory" class="text-app-accent rounded-sm underline underline-offset-3 focus-ring">Source directory</a>
					<a href="#providers" class="text-app-accent rounded-sm underline underline-offset-3 focus-ring">Data providers</a>
					<NuxtLink to="/about#methodology" class="text-app-accent rounded-sm underline underline-offset-3 focus-ring">
						Editorial standards
					</NuxtLink>
				</nav>
			</header>
			<section id="directory" class="scroll-mt-24" aria-labelledby="directory-heading">
				<h2 id="directory-heading" class="sr-only">
					Source directory
				</h2>
				<label for="source-search" class="text-sm text-app-ink font-semibold dark:text-app-text-dark">Search sources</label>
				<input id="source-search" v-model="searchQuery" type="search" placeholder="Title, publisher, or system" class="text-base text-app-ink mt-2 px-4 border border-app-line rounded-full bg-app-panel h-12 w-full dark:text-app-text-dark dark:border-app-line-dark dark:bg-app-panel-dark focus-ring">
				<p v-if="pending" class="text-sm text-app-muted mt-4 dark:text-app-muted-dark" role="status">
					Loading sources…
				</p>
				<p v-else-if="error" class="text-sm text-app-muted mt-4 dark:text-app-muted-dark" role="status">
					Source directory unavailable.
				</p>
				<p v-else-if="!filteredSources.length" class="text-sm text-app-muted mt-4 dark:text-app-muted-dark" role="status">
					No sources match the current search.
				</p>
				<div v-else class="mt-6 space-y-6">
					<section v-for="section in sections" :key="section.kind">
						<h2 class="text-xl text-app-ink font-serif dark:text-app-text-dark">
							{{ section.heading }}
						</h2>
						<ul class="mt-3 divide-app-line divide-y dark:divide-app-line-dark">
							<li v-for="source in section.items" :key="source.id">
								<NuxtLink :to="`/sources/${source.id}`" class="py-4 rounded-sm block focus-ring">
									<span class="text-base text-app-accent font-semibold">{{ source.title }}</span>
									<span class="text-sm text-app-muted leading-6 mt-1 block dark:text-app-muted-dark">{{ source.publisher }}</span>
								</NuxtLink>
							</li>
						</ul>
					</section>
				</div>
			</section>
			<SourceProviders />
		</div>
	</section>
</template>
