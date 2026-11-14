<script setup lang="ts">
import { adminDatasetCount, adminDatasetStatus } from "~/utils/admin-dataset";

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
			<p v-if="item.failure" role="alert">
				{{ item.failure }}
			</p>
			<section v-if="item.reviewIssues?.length" class="space-y-6" aria-labelledby="date-review-heading">
				<h2 id="date-review-heading" class="text-3xl font-serif">
					{{ item.kind === 'calendars' ? 'Date review' : 'Review' }}
				</h2>
				<ul class="divide-app-line divide-y dark:divide-app-line-dark">
					<li v-for="issue in item.reviewIssues" :key="issue.id" class="py-6 space-y-3">
						<h3 class="text-xl font-semibold">
							{{ issue.label }}
						</h3>
						<p>
							<template v-if="issue.printedDate">
								{{ issue.printedDate }} ·
							</template>Election {{ issue.electionDate }}
						</p>
						<p>{{ issue.reason }}</p>
					</li>
				</ul>
			</section>
			<a v-if="item.kind === 'calendars' && item.sourceUrl" :href="item.sourceUrl" class="btn-secondary">Official calendar</a>
			<a v-if="item.kind === 'measures' && item.sourceUrl" :href="item.sourceUrl" class="btn-secondary">Official questions</a>
			<dl class="space-y-6">
				<div>
					<dt class="font-semibold">
						Source ID
					</dt><dd>{{ item.id }}</dd>
				</div><div>
					<dt class="font-semibold">
						{{ item.electionDate ? 'State / election' : 'State' }}
					</dt><dd>
						{{ item.stateCode }}<template v-if="item.electionDate">
							· {{ item.electionDate }}
						</template>
					</dd>
				</div><div v-if="item.kind !== 'calendars' && item.kind !== 'measures'">
					<dt class="font-semibold">
						Import mode
					</dt><dd>{{ item.mode === 'automatic' ? 'Approved automatic collection' : 'Reviewed external import' }}</dd>
				</div><div>
					<dt class="font-semibold">
						Status
					</dt><dd>{{ item.status === 'pending' ? adminDatasetStatus(item) : `${adminDatasetStatus(item)} · ${adminDatasetCount(item)}` }}</dd>
				</div><div v-if="item.collectionState">
					<dt class="font-semibold">
						Collection
					</dt><dd class="capitalize">
						{{ item.collectionState }}
					</dd>
				</div><div v-if="item.preparationState">
					<dt class="font-semibold">
						Preparation
					</dt><dd class="capitalize">
						{{ item.preparationState === 'review' ? 'Review required' : item.preparationState === 'unreported' ? 'Not prepared' : item.preparationState }}
					</dd>
				</div>
			</dl><div class="space-y-4">
				<UpdatedAt v-if="item.retrievedAt" :value="item.retrievedAt" label="Source retrieved" /><UpdatedAt v-if="item.lastAttemptAt" :value="item.lastAttemptAt" label="Collection attempted" /><UpdatedAt v-if="item.lastSuccessAt" :value="item.lastSuccessAt" label="Successful collection" /><UpdatedAt v-if="item.lastPreparedAt" :value="item.lastPreparedAt" label="Prepared" /><UpdatedAt v-if="item.lastImportAt" :value="item.lastImportAt" label="Imported" />
			</div>
			<NuxtLink v-if="item.kind !== 'calendars' && item.kind !== 'measures'" :to="item.kind === 'officeholders' ? '/districts/fulton-county' : { path: '/records', query: { state: item.stateCode, ...(item.kind === 'candidates' ? { source: item.id } : {}) } }" class="btn-secondary">
				View records
			</NuxtLink>
		</template>
		<p v-else-if="data && !error && !pending">
			Dataset not configured.
		</p>
	</section>
</template>
