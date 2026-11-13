<script setup lang="ts">
import { adminDatasetCount, adminDatasetStatus } from "~/utils/admin-dataset";

definePageMeta({ layout: "admin", middleware: "admin" });
const { data, error, pending, refresh } = await useAdminOperations();
const search = ref("");
const groups = computed(() => ["officeholders", "candidates", "references", "calendars"].map(kind => ({ kind, items: (data.value?.datasets ?? []).filter(item => item.kind === kind && [item.label, item.stateCode, item.id].join(" ").toLowerCase().includes(search.value.trim().toLowerCase())) })).filter(group => group.kind !== "calendars" || group.items.length));
usePageSeo({ title: "Datasets", path: "/admin/datasets", robots: "noindex,nofollow" });
</script>

<template>
	<section class="app-shell max-w-5xl space-y-12">
		<header>
			<NuxtLink to="/admin" class="underline focus-ring">
				Operations
			</NuxtLink><h1 class="text-5xl font-serif mt-5">
				Datasets
			</h1>
		</header>
		<label class="block"><span class="font-semibold">State or source</span><input v-model="search" type="search" class="text-app-ink mt-2 px-4 py-3 border border-app-line rounded-lg bg-white w-full block dark:text-app-text-dark dark:border-app-line-dark dark:bg-app-panel-dark focus-ring"></label>
		<AdminLoadState :pending="pending" :error="Boolean(error)" label="datasets" @retry="refresh()" />
		<template v-if="data && !error && !pending">
			<section v-for="group in groups" :key="group.kind" class="space-y-6">
				<h2 class="text-3xl font-serif">
					{{ group.kind === 'officeholders' ? 'Current officeholders' : group.kind === 'candidates' ? 'Candidate data' : group.kind === 'calendars' ? 'Calendars' : 'Reference collections' }}
				</h2><p v-if="!group.items.length">
					No matching datasets.
				</p><ul class="divide-app-line divide-y dark:divide-app-line-dark">
					<li v-for="item in group.items" :key="item.id">
						<NuxtLink :to="`/admin/datasets/${item.id}`" class="py-5 block focus-ring">
							<h3 class="text-xl font-semibold">
								{{ item.label }}
							</h3><p class="text-app-muted mt-2 dark:text-app-muted-dark">
								{{ item.stateCode }} · {{ item.status === 'pending' ? adminDatasetStatus(item) : `${adminDatasetCount(item)} · ${adminDatasetStatus(item)}` }}
							</p>
						</NuxtLink>
					</li>
				</ul>
			</section>
		</template>
	</section>
</template>
