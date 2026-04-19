<script setup lang="ts">
import { formatSourceCountLabel } from "~/utils/source-label";

const route = useRoute();
const siteUrl = useSiteUrl();
const searchInput = ref(typeof route.query.q === "string" ? route.query.q : "");
const activeQuery = computed(() => typeof route.query.q === "string" ? route.query.q : "");
const { data, pending } = await useSearchResults(activeQuery);

watch(() => route.query.q, (value) => {
	searchInput.value = typeof value === "string" ? value : "";
});

async function submitSearch() {
	const nextQuery = searchInput.value.trim();

	await navigateTo({
		path: "/search",
		query: nextQuery ? { q: nextQuery } : {}
	});
}

usePageSeo({
	description: activeQuery.value
		? `Search Ballot Clarity for ${activeQuery.value}.`
		: "Search Ballot Clarity across districts, contests, elections, candidates, measures, and source records.",
	jsonLd: activeQuery.value
		? {
				"@context": "https://schema.org",
				"@type": "SearchResultsPage",
				"name": `Search results for ${activeQuery.value}`,
				"url": `${siteUrl}/search?q=${encodeURIComponent(activeQuery.value)}`
			}
		: undefined,
	path: "/search",
	title: activeQuery.value ? `Search: ${activeQuery.value}` : "Search"
});
</script>

<template>
	<section class="app-shell section-gap space-y-8">
		<header class="max-w-4xl">
			<div class="flex flex-wrap gap-2">
				<TrustBadge label="Search" tone="accent" />
				<TrustBadge label="Candidates, measures, sources" />
				<TrustBadge label="Public records first" />
			</div>
			<h1 class="text-5xl text-app-ink font-serif mt-5 dark:text-app-text-dark">
				Search the public record in Ballot Clarity
			</h1>
			<p class="text-base text-app-muted leading-8 mt-5 dark:text-app-muted-dark">
				Search across jurisdictions, district pages, election guides, contest pages, candidates, measures, and source records. Use the result type and source count to decide where to open first.
			</p>
		</header>

		<form class="surface-panel" @submit.prevent="submitSearch">
			<label for="site-search" class="text-sm text-app-ink font-semibold dark:text-app-text-dark">
				Search by name, district, office, measure, issue, or source title
			</label>
			<div class="mt-4 flex flex-col gap-3 sm:flex-row">
				<div class="flex-1 relative">
					<span class="i-carbon-search text-app-muted pointer-events-none left-4 top-1/2 absolute dark:text-app-muted-dark -translate-y-1/2" />
					<input
						id="site-search"
						v-model="searchInput"
						type="search"
						placeholder="Example: District 7, Sandra Patel, transit bond, public records"
						class="text-sm text-app-ink pl-11 pr-4 border border-app-line rounded-full bg-white h-13 w-full shadow-sm dark:text-app-text-dark placeholder:text-app-muted dark:border-app-line-dark dark:bg-app-panel-dark focus-ring dark:placeholder:text-app-muted-dark"
					>
				</div>
				<button type="submit" class="btn-primary min-w-40">
					Search
				</button>
			</div>
		</form>

		<div v-if="pending" class="space-y-6">
			<div class="surface-panel bg-white/70 h-56 animate-pulse dark:bg-app-panel-dark/70" />
			<div class="surface-panel bg-white/70 h-56 animate-pulse dark:bg-app-panel-dark/70" />
		</div>

		<div v-else-if="!activeQuery" class="surface-panel">
			<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
				Try one of these
			</p>
			<div class="mt-6 flex flex-wrap gap-3">
				<button
					v-for="suggestion in data?.suggestions ?? []"
					:key="suggestion"
					type="button"
					class="btn-secondary"
					@click="searchInput = suggestion; submitSearch()"
				>
					{{ suggestion }}
				</button>
			</div>
		</div>

		<div v-else-if="!data?.total" class="surface-panel">
			<h2 class="text-3xl text-app-ink font-serif dark:text-app-text-dark">
				No results for “{{ activeQuery }}”
			</h2>
			<p class="text-sm text-app-muted leading-7 mt-4 dark:text-app-muted-dark">
				Try a candidate name, district title, office title, ballot measure term, contest title, or source title. You can also browse the district hub, coverage profile, or source directory directly.
			</p>
			<div class="mt-6 flex flex-wrap gap-3">
				<NuxtLink to="/districts" class="btn-secondary">
					Browse districts
				</NuxtLink>
				<NuxtLink to="/coverage" class="btn-secondary">
					Open coverage profile
				</NuxtLink>
				<NuxtLink to="/sources" class="btn-secondary">
					Browse sources
				</NuxtLink>
				<NuxtLink to="/methodology" class="btn-secondary">
					Read methodology
				</NuxtLink>
			</div>
		</div>

		<div v-else class="space-y-6">
			<section
				v-for="group in data.groups"
				:key="group.type"
				class="surface-panel"
			>
				<div class="flex flex-wrap gap-4 items-center justify-between">
					<div>
						<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
							{{ group.label }}
						</p>
						<h2 class="text-3xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
							{{ group.items.length }} result{{ group.items.length === 1 ? "" : "s" }}
						</h2>
					</div>
					<TrustBadge :label="group.type" tone="accent" />
				</div>
				<div class="mt-6 space-y-4">
					<NuxtLink
						v-for="item in group.items"
						:key="item.id"
						:to="item.href"
						class="px-5 py-5 border border-app-line/80 rounded-3xl bg-white/80 block transition dark:border-app-line-dark hover:border-app-accent dark:bg-app-panel-dark/70 focus-ring"
					>
						<div class="flex flex-wrap gap-3 items-start justify-between">
							<div class="min-w-0">
								<p class="text-xl text-app-ink font-semibold dark:text-app-text-dark">
									{{ item.title }}
								</p>
								<p class="text-sm text-app-muted leading-7 mt-3 dark:text-app-muted-dark">
									{{ item.summary }}
								</p>
								<p class="text-xs text-app-muted mt-3 dark:text-app-muted-dark">
									{{ item.meta }}
								</p>
							</div>
							<div class="flex flex-wrap gap-2 justify-end">
								<TrustBadge v-if="item.authority" :label="item.authority" tone="neutral" />
								<TrustBadge v-if="item.sourceCount" :label="formatSourceCountLabel(item.sourceCount)" />
							</div>
						</div>
					</NuxtLink>
				</div>
			</section>
		</div>
	</section>
</template>
