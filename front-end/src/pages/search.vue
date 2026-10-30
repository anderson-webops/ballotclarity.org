<script setup lang="ts">
const route = useRoute();
const directory = computed(() => route.query.type === "candidate");
const searchInput = ref(typeof route.query.q === "string" ? route.query.q : "");
const activeQuery = computed(() => directory.value ? "" : typeof route.query.q === "string" ? route.query.q : "");
const { data, error, pending, refresh } = await useSearchResults(activeQuery);

watch(() => route.query.q, value => searchInput.value = typeof value === "string" ? value : "");

async function submitSearch() {
	const query = searchInput.value.trim();
	if (query === activeQuery.value) return refresh();
	await navigateTo({ path: "/search", query: query ? { q: query } : {} });
}

usePageSeo(() => ({ description: "Search candidates, representatives, districts and election information.", path: "/search", title: directory.value ? "Directory" : activeQuery.value ? `Search: ${activeQuery.value}` : "Search" }));
</script>

<template>
	<section class="app-shell section-gap max-w-5xl space-y-8">
		<header class="flex flex-wrap gap-6 items-end justify-between">
			<h1 class="text-5xl text-app-ink font-serif dark:text-app-text-dark">
				{{ directory ? 'Directory' : 'Search' }}
			</h1>
			<nav aria-label="Search category" class="flex gap-5">
				<NuxtLink :to="{ path: '/search', query: route.query.q ? { q: route.query.q } : {} }" :aria-current="!directory ? 'page' : undefined" class="text-app-accent py-2 underline underline-offset-4 focus-ring">
					All
				</NuxtLink>
				<NuxtLink :to="{ path: '/search', query: { ...route.query, type: 'candidate' } }" :aria-current="directory ? 'page' : undefined" class="text-app-accent py-2 underline underline-offset-4 focus-ring">
					Candidates
				</NuxtLink>
			</nav>
		</header>
		<CandidateDirectory v-if="directory" />
		<template v-else>
			<form @submit.prevent="submitSearch">
				<label for="site-search" class="text-sm text-app-ink font-semibold dark:text-app-text-dark">Name, office, district or measure</label>
				<div class="mt-3 flex gap-3">
					<input id="site-search" v-model="searchInput" type="search" maxlength="200" class="text-base text-app-ink px-4 border border-app-line rounded-lg bg-app-panel flex-1 h-13 min-w-0 dark:text-app-text-dark dark:border-app-line-dark dark:bg-app-panel-dark focus-ring">
					<button type="submit" class="btn-primary">
						Search
					</button>
				</div>
			</form>
			<p v-if="pending" role="status">
				Searching…
			</p>
			<div v-else-if="error" class="space-y-4" role="alert">
				<h2 class="text-2xl font-serif">
					Search is temporarily unavailable
				</h2>
				<button type="button" class="btn-secondary" @click="refresh()">
					Try again
				</button>
			</div>
			<template v-else-if="activeQuery">
				<p v-if="data?.incomplete" role="status">
					Some records could not be searched.
					<button type="button" class="text-app-accent underline focus-ring" @click="refresh()">
						Retry
					</button>
				</p>
				<p v-if="!data?.total" role="status">
					No results for “{{ activeQuery }}”
				</p>
				<section v-for="group in data?.groups ?? []" :key="group.type" class="space-y-5">
					<h2 class="text-3xl text-app-ink font-serif dark:text-app-text-dark">
						{{ group.label }}
					</h2>
					<ul class="border-t border-app-line divide-app-line divide-y dark:border-app-line-dark dark:divide-app-line-dark">
						<li v-for="item in group.items" :key="item.id" class="flex gap-4 items-center">
							<ProfileImageStack v-if="item.profileImages?.length" :images="item.profileImages" :name="item.title" size="sm" class="shrink-0" />
							<NuxtLink :to="item.href" class="py-5 flex-1 min-w-0 block focus-ring">
								<h3 class="text-xl text-app-ink font-semibold dark:text-app-text-dark">
									{{ item.title }}
								</h3>
								<p v-if="item.meta" class="text-sm text-app-muted mt-2 dark:text-app-muted-dark">
									{{ item.meta }}
									<template v-if="item.party"> · <PartyLabel :party="item.party" /></template>
								</p>
								<p v-if="item.summary" class="text-sm leading-7 mt-3">
									{{ item.summary }}
								</p>
							</NuxtLink>
						</li>
					</ul>
				</section>
			</template>
		</template>
	</section>
</template>
