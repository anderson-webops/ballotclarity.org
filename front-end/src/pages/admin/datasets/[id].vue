<script setup lang="ts">
definePageMeta({ layout: "admin", middleware: "admin" });
const id = useRouteStringParam("id");
const { data, error, pending, refresh } = await useAdminOperations();
const item = computed(() => data.value?.datasets.find(item => item.id === id.value));
usePageSeo({ title: "Dataset", path: "/admin/datasets", robots: "noindex,nofollow" });
</script>

<template>
	<section class="app-shell max-w-4xl space-y-12">
		<header>
			<NuxtLink to="/admin/datasets" class="underline focus-ring">
				Datasets
			</NuxtLink><h1 class="text-4xl font-serif mt-5">
				{{ item?.label || 'Dataset' }}
			</h1>
		</header>
		<AdminLoadState :pending="pending" :error="Boolean(error)" label="dataset status" @retry="refresh()" />
		<template v-if="item && !error && !pending">
			<dl class="space-y-6">
				<div>
					<dt class="font-semibold">
						Source ID
					</dt><dd>{{ item.id }}</dd>
				</div><div>
					<dt class="font-semibold">
						State / election
					</dt><dd>{{ item.stateCode }} · {{ item.electionDate }}</dd>
				</div><div>
					<dt class="font-semibold">
						Import mode
					</dt><dd>{{ item.mode === 'automatic' ? 'Approved automatic collection' : 'Reviewed external import' }}</dd>
				</div><div>
					<dt class="font-semibold">
						Status
					</dt><dd>{{ item.status }} · {{ item.records === null ? 'Not imported' : `${item.records} records` }}</dd>
				</div>
			</dl><p v-if="item.failure" role="alert">
				{{ item.failure }}
			</p><div class="space-y-4">
				<UpdatedAt v-if="item.retrievedAt" :value="item.retrievedAt" label="Source retrieved" /><UpdatedAt v-if="item.lastAttemptAt" :value="item.lastAttemptAt" label="Collection attempted" /><UpdatedAt v-if="item.lastImportAt" :value="item.lastImportAt" label="Imported" />
			</div><NuxtLink :to="{ path: '/records', query: { state: item.stateCode, ...(item.kind === 'candidates' ? { source: item.id } : {}) } }" class="btn-secondary">
				View records
			</NuxtLink>
		</template>
		<p v-else-if="data && !error && !pending">
			Dataset not configured.
		</p>
	</section>
</template>
