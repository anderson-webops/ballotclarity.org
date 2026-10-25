<script setup lang="ts">
definePageMeta({ layout: "admin", middleware: "admin" });
const { data, error, pending, refresh } = await useAdminOperations();
const available = computed(() => data.value?.datasets.filter(item => item.records !== null && item.status !== "archived") ?? []);
const candidateCount = computed(() => available.value.filter(item => item.kind === "candidates").reduce((count, item) => count + (item.records ?? 0), 0));
const referenceCount = computed(() => available.value.filter(item => item.kind === "references").reduce((count, item) => count + (item.records ?? 0), 0));
const recent = computed(() => [...available.value].sort((first, second) => (second.retrievedAt ?? "").localeCompare(first.retrievedAt ?? "")).slice(0, 6));
usePageSeo({ title: "Operations", path: "/admin", robots: "noindex,nofollow" });
</script>

<template>
	<section class="app-shell max-w-5xl space-y-16">
		<header>
			<h1 class="text-5xl font-serif">
				Operations
			</h1>
		</header>
		<AdminLoadState :pending="pending" :error="Boolean(error)" label="operations" @retry="refresh()" />
		<template v-if="data && !error && !pending">
			<dl class="gap-8 grid sm:grid-cols-3">
				<div>
					<dt class="text-app-muted dark:text-app-muted-dark">
						Candidate records
					</dt><dd class="text-4xl font-serif mt-3">
						{{ candidateCount.toLocaleString() }}
					</dd>
				</div>
				<div>
					<dt class="text-app-muted dark:text-app-muted-dark">
						Reference profiles
					</dt><dd class="text-4xl font-serif mt-3">
						{{ referenceCount.toLocaleString() }}
					</dd>
				</div>
				<div>
					<dt class="text-app-muted dark:text-app-muted-dark">
						Available datasets
					</dt><dd class="text-4xl font-serif mt-3">
						{{ available.length }}
					</dd>
				</div>
			</dl>
			<section class="space-y-6">
				<div class="flex gap-4 items-center justify-between">
					<h2 class="text-3xl font-serif">
						Automation
					</h2><NuxtLink to="/admin/exceptions" class="underline focus-ring">
						Exceptions
					</NuxtLink>
				</div>
				<p v-if="data.automation.status === 'unreported'">
					No automation run has been reported.
				</p>
				<p v-else-if="data.automation.status === 'invalid'" role="alert">
					Automation evidence could not be validated.
				</p>
				<p v-else class="capitalize" :role="['failed', 'overdue'].includes(data.automation.status) ? 'alert' : undefined">
					{{ data.automation.status }}
				</p>
				<div class="space-y-4">
					<UpdatedAt v-if="data.automation.lastAttemptAt" :value="data.automation.lastAttemptAt" label="Last run" /><UpdatedAt v-if="data.automation.lastSuccessAt" :value="data.automation.lastSuccessAt" label="Successful collection" /><UpdatedAt v-if="data.automation.lastImportAt" :value="data.automation.lastImportAt" label="Last import" /><UpdatedAt v-if="data.automation.nextRunAt" :value="data.automation.nextRunAt" label="Next run" />
				</div>
			</section>
			<section class="space-y-6">
				<div class="flex gap-4 items-center justify-between">
					<h2 class="text-3xl font-serif">
						Latest data
					</h2><NuxtLink to="/admin/datasets" class="underline focus-ring">
						All datasets
					</NuxtLink>
				</div>
				<p v-if="!recent.length">
					No persisted datasets are available.
				</p>
				<ul class="divide-app-line divide-y dark:divide-app-line-dark">
					<li v-for="item in recent" :key="item.id">
						<NuxtLink :to="`/admin/datasets/${item.id}`" class="py-5 block focus-ring">
							<h3 class="text-xl font-semibold">
								{{ item.label }}
							</h3><p class="text-app-muted mt-2 dark:text-app-muted-dark">
								{{ item.stateCode }} · {{ item.records }} records · {{ item.status === 'current' ? 'Available' : item.status }}
							</p>
						</NuxtLink>
					</li>
				</ul>
			</section>
		</template>
	</section>
</template>
