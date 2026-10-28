<script setup lang="ts">
import type { CourtDirectoryResponse } from "~/types/civic";

const slug = useRouteStringParam("slug");
const api = useApiClient();
const { data, error, pending } = await useAsyncData<CourtDirectoryResponse>(
	() => `court-directory:${slug.value}`,
	() => api<CourtDirectoryResponse>(`/courts/${encodeURIComponent(slug.value)}`)
);
const groups = computed(() => {
	const judges = [...(data.value?.judges ?? [])].sort((first, second) => first.division.localeCompare(second.division));
	return Array.from({ length: Math.ceil(judges.length / 6) }, (_, index) => judges.slice(index * 6, (index + 1) * 6));
});

usePageSeo({
	title: data.value?.title ?? "Court records",
	description: "Judges and official court profiles.",
	path: `/courts/${slug.value}`
});
</script>

<template>
	<section class="app-shell section-gap">
		<p v-if="pending" role="status">
			Loading court records…
		</p>
		<InfoCallout v-else-if="error || !data" title="Court records are unavailable" tone="info">
			Try again later.
		</InfoCallout>
		<div v-else class="max-w-5xl section-stack">
			<header>
				<NuxtLink to="/districts/fulton-county" class="text-app-accent underline focus-ring">
					Fulton County
				</NuxtLink>
				<h1 class="text-4xl text-app-ink font-serif mt-6 sm:text-5xl dark:text-app-text-dark">
					State Court judges
				</h1>
				<UpdatedAt :value="data.retrievedAt" label="Checked" class="mt-5" />
			</header>
			<section v-for="(group, index) in groups" :key="index" :aria-labelledby="`divisions-${index}`">
				<h2 :id="`divisions-${index}`" class="text-lg text-app-ink font-semibold mb-6 dark:text-app-text-dark">
					Divisions {{ group[0]?.division }} to {{ group.at(-1)?.division }}
				</h2>
				<ul class="gap-x-12 gap-y-6 grid sm:grid-cols-2">
					<li v-for="judge in group" :key="judge.profileUrl" class="pt-5 border-t border-app-line dark:border-app-line-dark">
						<SafeExternalLink :href="judge.profileUrl" :new-tab="false" external-icon class="py-2 flex gap-2 items-baseline focus-ring">
							<span class="flex-1 min-w-0">
								<span class="text-xl text-app-accent font-serif">{{ judge.name }}</span>
								<span class="text-sm text-app-muted mt-2 block dark:text-app-muted-dark">{{ judge.role }} · Division {{ judge.division }}</span>
							</span>
						</SafeExternalLink>
					</li>
				</ul>
			</section>
			<SafeExternalLink :href="data.url" :new-tab="false" external-icon class="text-app-accent underline inline-flex gap-2 items-center focus-ring">
				Official court roster
			</SafeExternalLink>
		</div>
	</section>
</template>
