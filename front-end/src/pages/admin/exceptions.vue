<script setup lang="ts">
definePageMeta({ layout: "admin", middleware: "admin" });
const operations = await useAdminOperations();
const review = await useAdminReview();
const corrections = await useAdminCorrections();
const packages = await useAdminGuidePackages();
const collectionIssues = computed(() => operations.data.value?.datasets.filter(item => item.status === "error" || (item.mode === "automatic" && ["missing", "stale"].includes(item.status))) ?? []);
const readerIssues = computed(() => corrections.data.value?.corrections.filter(item => item.status !== "resolved") ?? []);
const publicationIssues = computed(() => packages.data.value?.packages.filter(item => item.workflow.status !== "published") ?? []);
usePageSeo({ title: "Exceptions", path: "/admin/exceptions", robots: "noindex,nofollow" });
</script>

<template>
	<section class="app-shell max-w-5xl space-y-16">
		<header>
			<h1 class="text-5xl font-serif">
				Exceptions
			</h1>
		</header>
		<section class="space-y-5">
			<h2 class="text-3xl font-serif">
				Collection
			</h2>
			<AdminLoadState :pending="operations.pending.value" :error="Boolean(operations.error.value)" label="collection status" @retry="operations.refresh()" />
			<template v-if="operations.data.value && !operations.error.value && !operations.pending.value">
				<p v-if="['invalid', 'failed', 'overdue'].includes(operations.data.value.automation.status)" role="alert">
					Automation {{ operations.data.value.automation.status }}. <NuxtLink to="/admin" class="underline focus-ring">
						Operations
					</NuxtLink>
				</p>
				<p v-if="!collectionIssues.length && !['invalid', 'failed', 'overdue'].includes(operations.data.value.automation.status)">
					No collection exceptions reported.
				</p>
				<ul class="divide-app-line divide-y dark:divide-app-line-dark">
					<li v-for="item in collectionIssues" :key="item.id">
						<NuxtLink :to="`/admin/datasets/${item.id}`" class="py-5 block focus-ring">
							<h3 class="text-xl font-semibold">
								{{ item.label }}
							</h3><p class="text-app-muted mt-2 dark:text-app-muted-dark">
								{{ item.failure || item.status }} · {{ item.stateCode }}
							</p>
						</NuxtLink>
					</li>
				</ul>
			</template>
		</section>
		<section class="space-y-5">
			<div class="flex gap-4 items-center justify-between">
				<h2 class="text-3xl font-serif">
					Editorial review
				</h2><NuxtLink to="/admin/content" class="underline focus-ring">
					Content archive
				</NuxtLink>
			</div>
			<AdminLoadState :pending="review.pending.value" :error="Boolean(review.error.value)" label="editorial review" @retry="review.refresh()" />
			<p v-if="review.data.value && !review.pending.value && !review.error.value && !review.data.value.items.length">
				No editorial review is queued.
			</p>
			<ul v-if="!review.error.value" class="divide-app-line divide-y dark:divide-app-line-dark">
				<li v-for="item in review.data.value?.items" :key="item.id">
					<NuxtLink :to="`/admin/content/${item.id}`" class="py-5 block focus-ring">
						<h3 class="text-xl font-semibold">
							{{ item.title }}
						</h3><p class="text-app-muted mt-2 dark:text-app-muted-dark">
							{{ item.status }}<template v-if="item.blocker">
								· {{ item.blocker }}
							</template>
						</p>
					</NuxtLink>
				</li>
			</ul>
		</section>
		<section class="space-y-5">
			<div class="flex gap-4 items-center justify-between">
				<h2 class="text-3xl font-serif">
					Publication review
				</h2><NuxtLink to="/admin/packages" class="underline focus-ring">
					All reviews
				</NuxtLink>
			</div>
			<AdminLoadState :pending="packages.pending.value" :error="Boolean(packages.error.value)" label="publication reviews" @retry="packages.refresh()" />
			<p v-if="packages.data.value && !packages.pending.value && !packages.error.value && !publicationIssues.length">
				No publication review is queued.
			</p>
			<ul v-if="!packages.error.value" class="divide-app-line divide-y dark:divide-app-line-dark">
				<li v-for="item in publicationIssues" :key="item.workflow.id">
					<NuxtLink :to="`/admin/packages/${item.workflow.id}`" class="py-5 block focus-ring">
						<h3 class="text-xl font-semibold">
							{{ item.coverageScope.label }}
						</h3><p class="text-app-muted mt-2 dark:text-app-muted-dark">
							{{ item.workflow.status.replaceAll('_', ' ') }} · {{ item.diagnostics.blockingIssueCount }} blockers
						</p>
					</NuxtLink>
				</li>
			</ul>
		</section>
		<section class="space-y-5">
			<div class="flex gap-4 items-center justify-between">
				<h2 class="text-3xl font-serif">
					Reader corrections
				</h2><NuxtLink to="/admin/corrections" class="underline focus-ring">
					History
				</NuxtLink>
			</div>
			<AdminLoadState :pending="corrections.pending.value" :error="Boolean(corrections.error.value)" label="reader corrections" @retry="corrections.refresh()" />
			<p v-if="corrections.data.value && !corrections.pending.value && !corrections.error.value && !readerIssues.length">
				No corrections are awaiting review.
			</p>
			<ul v-if="!corrections.error.value" class="divide-app-line divide-y dark:divide-app-line-dark">
				<li v-for="item in readerIssues" :key="item.id">
					<NuxtLink :to="{ path: '/admin/corrections', query: { id: item.id } }" class="py-5 block focus-ring">
						<h3 class="text-xl font-semibold">
							{{ item.subject }}
						</h3><p class="text-app-muted mt-2 dark:text-app-muted-dark">
							{{ item.status }} · {{ item.entityLabel }}
						</p>
					</NuxtLink>
				</li>
			</ul>
		</section>
	</section>
</template>
