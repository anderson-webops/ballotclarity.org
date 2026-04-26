<script setup lang="ts">
definePageMeta({
	layout: "admin",
	middleware: "admin"
});

const { data } = await useAdminReview();

usePageSeo({
	description: "Internal Ballot Clarity review queue.",
	path: "/admin/review",
	robots: "noindex,nofollow",
	title: "Admin review queue"
});
</script>

<template>
	<section class="app-shell section-gap space-y-8">
		<header class="max-w-4xl">
			<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
				Review queue
			</p>
			<h1 class="text-5xl text-app-ink font-serif mt-4 dark:text-app-text-dark">
				Editorial review and publish readiness
			</h1>
			<p class="text-base text-app-muted leading-8 mt-5 dark:text-app-muted-dark">
				These are the records currently moving through draft, verification, or publish readiness. Anything blocked here should have an explicit source or process reason attached.
			</p>
		</header>

		<AdminEmptyState
			v-if="!(data?.items?.length ?? 0)"
			action-label="Open guide packages"
			action-to="/admin/packages"
			eyebrow="Review queue clear"
			message="There are no editorial records waiting for review. New candidate, measure, contest, or source-backed updates will appear here when they need a reviewer decision."
			secondary-label="Open corrections"
			secondary-to="/admin/corrections"
			title="No review work is queued"
		/>

		<div v-else class="space-y-5">
			<article v-for="item in data?.items ?? []" :key="item.id" class="surface-panel">
				<div class="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
					<div class="min-w-0">
						<div class="flex flex-wrap gap-2">
							<TrustBadge :label="item.entityType" />
							<TrustBadge :label="item.status" :tone="item.status === 'ready-to-publish' ? 'accent' : item.status === 'needs-sources' ? 'warning' : 'neutral'" />
							<TrustBadge :label="`${item.priority} priority`" :tone="item.priority === 'high' ? 'warning' : 'neutral'" />
						</div>
						<h2 class="text-3xl text-app-ink font-serif mt-4 dark:text-app-text-dark">
							{{ item.title }}
						</h2>
						<p class="text-sm text-app-muted leading-7 mt-4 dark:text-app-muted-dark">
							{{ item.summary }}
						</p>
					</div>

					<div class="w-full space-y-3 xl:max-w-sm">
						<div class="px-4 py-4 border border-app-line/80 rounded-[1.4rem] bg-app-bg dark:border-app-line-dark dark:bg-app-bg-dark/70">
							<p class="text-xs text-app-muted tracking-[0.16em] font-semibold uppercase dark:text-app-muted-dark">
								Assigned to
							</p>
							<p class="text-sm text-app-ink font-semibold mt-2 dark:text-app-text-dark">
								{{ item.assignedTo }}
							</p>
						</div>
						<div class="px-4 py-4 border border-app-line/80 rounded-[1.4rem] bg-app-bg dark:border-app-line-dark dark:bg-app-bg-dark/70">
							<p class="text-xs text-app-muted tracking-[0.16em] font-semibold uppercase dark:text-app-muted-dark">
								Source coverage
							</p>
							<p class="text-sm text-app-muted leading-7 mt-2 dark:text-app-muted-dark">
								{{ item.sourceCoverage }}
							</p>
						</div>
						<div v-if="item.blocker" class="px-4 py-4 border border-[#E7B9AA] rounded-[1.4rem] bg-[#FBEEE8] dark:border-[#6D433C] dark:bg-[#3A2421]">
							<p class="text-xs text-[#8B3A2E] tracking-[0.16em] font-semibold uppercase dark:text-[#FFD4CB]">
								Blocker
							</p>
							<p class="text-sm text-[#8B3A2E] leading-7 mt-2 dark:text-[#FFD4CB]">
								{{ item.blocker }}
							</p>
						</div>
						<UpdatedAt :value="item.updatedAt" label="Last changed" />
					</div>
				</div>
			</article>
		</div>
	</section>
</template>
