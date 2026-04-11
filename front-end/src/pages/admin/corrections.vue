<script setup lang="ts">
definePageMeta({
	layout: "admin",
	middleware: "admin"
});

const { data } = await useAdminCorrections();

usePageSeo({
	description: "Internal Ballot Clarity corrections queue.",
	path: "/admin/corrections",
	robots: "noindex,nofollow",
	title: "Admin corrections queue"
});
</script>

<template>
	<section class="app-shell section-gap space-y-8">
		<header class="max-w-4xl">
			<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
				Corrections queue
			</p>
			<h1 class="text-5xl text-app-ink font-serif mt-4 dark:text-app-text-dark">
				Reported issues and next steps
			</h1>
			<p class="text-base text-app-muted leading-8 mt-5 dark:text-app-muted-dark">
				Reader and internal reports stay visible here from submission through resolution. The goal is traceability, not silent edits.
			</p>
		</header>

		<div class="space-y-5">
			<article v-for="item in data?.corrections ?? []" :key="item.id" class="surface-panel">
				<div class="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
					<div class="min-w-0">
						<div class="flex flex-wrap gap-2">
							<TrustBadge :label="item.entityType" />
							<TrustBadge :label="item.status" :tone="item.status === 'resolved' ? 'accent' : item.status === 'new' ? 'warning' : 'neutral'" />
							<TrustBadge :label="`${item.priority} priority`" :tone="item.priority === 'high' ? 'warning' : 'neutral'" />
						</div>
						<h2 class="text-3xl text-app-ink font-serif mt-4 dark:text-app-text-dark">
							{{ item.subject }}
						</h2>
						<p class="text-sm text-app-muted leading-7 mt-4 dark:text-app-muted-dark">
							{{ item.summary }}
						</p>
						<div class="mt-5 px-4 py-4 border border-app-line/80 rounded-[1.4rem] bg-app-bg dark:border-app-line-dark dark:bg-app-bg-dark/70">
							<p class="text-xs text-app-muted tracking-[0.16em] font-semibold uppercase dark:text-app-muted-dark">
								Next step
							</p>
							<p class="text-sm text-app-ink leading-7 mt-2 dark:text-app-text-dark">
								{{ item.nextStep }}
							</p>
						</div>
					</div>

					<div class="gap-3 grid w-full sm:grid-cols-2 xl:grid-cols-1 xl:max-w-sm">
						<div class="px-4 py-4 border border-app-line/80 rounded-[1.4rem] bg-app-bg dark:border-app-line-dark dark:bg-app-bg-dark/70">
							<p class="text-xs text-app-muted tracking-[0.16em] font-semibold uppercase dark:text-app-muted-dark">
								Entity
							</p>
							<p class="text-sm text-app-ink font-semibold mt-2 dark:text-app-text-dark">
								{{ item.entityLabel }}
							</p>
						</div>
						<div class="px-4 py-4 border border-app-line/80 rounded-[1.4rem] bg-app-bg dark:border-app-line-dark dark:bg-app-bg-dark/70">
							<p class="text-xs text-app-muted tracking-[0.16em] font-semibold uppercase dark:text-app-muted-dark">
								Reported by
							</p>
							<p class="text-sm text-app-ink font-semibold mt-2 break-all dark:text-app-text-dark">
								{{ item.reportedBy }}
							</p>
						</div>
						<div class="px-4 py-4 border border-app-line/80 rounded-[1.4rem] bg-app-bg dark:border-app-line-dark dark:bg-app-bg-dark/70">
							<p class="text-xs text-app-muted tracking-[0.16em] font-semibold uppercase dark:text-app-muted-dark">
								Attached sources
							</p>
							<p class="text-sm text-app-ink font-semibold mt-2 dark:text-app-text-dark">
								{{ item.sourceCount }}
							</p>
						</div>
						<div class="px-4 py-4 border border-app-line/80 rounded-[1.4rem] bg-app-bg dark:border-app-line-dark dark:bg-app-bg-dark/70">
							<UpdatedAt :value="item.submittedAt" label="Submitted" />
						</div>
					</div>
				</div>
			</article>
		</div>
	</section>
</template>
