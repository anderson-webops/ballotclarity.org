<script setup lang="ts">
definePageMeta({
	layout: "admin",
	middleware: "admin"
});

const { data } = await useAdminSourceMonitor();

usePageSeo({
	description: "Internal Ballot Clarity source-health monitor.",
	path: "/admin/sources",
	robots: "noindex,nofollow",
	title: "Admin source health"
});
</script>

<template>
	<section class="app-shell section-gap space-y-8">
		<header class="max-w-4xl">
			<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
				Source health
			</p>
			<h1 class="text-5xl text-app-ink font-serif mt-4 dark:text-app-text-dark">
				Upstream monitoring and refresh readiness
			</h1>
			<p class="text-base text-app-muted leading-8 mt-5 dark:text-app-muted-dark">
				These checks are the operational layer behind freshness badges and methodology notes. If a source drifts, the public site should surface caution instead of pretending nothing changed.
			</p>
		</header>

		<div class="space-y-5">
			<article v-for="item in data?.sources ?? []" :key="item.id" class="surface-panel">
				<div class="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
					<div class="min-w-0">
						<div class="flex flex-wrap gap-2">
							<TrustBadge :label="item.authority" />
							<TrustBadge :label="item.health" :tone="item.health === 'healthy' ? 'accent' : item.health === 'incident' ? 'warning' : 'neutral'" />
						</div>
						<h2 class="text-3xl text-app-ink font-serif mt-4 dark:text-app-text-dark">
							{{ item.label }}
						</h2>
						<p class="text-sm text-app-muted leading-7 mt-4 dark:text-app-muted-dark">
							{{ item.note }}
						</p>
					</div>

					<div class="gap-3 grid w-full sm:grid-cols-2 xl:grid-cols-1 xl:max-w-sm">
						<div class="px-4 py-4 border border-app-line/80 rounded-[1.4rem] bg-app-bg dark:border-app-line-dark dark:bg-app-bg-dark/70">
							<p class="text-xs text-app-muted tracking-[0.16em] font-semibold uppercase dark:text-app-muted-dark">
								Owner
							</p>
							<p class="text-sm text-app-ink font-semibold mt-2 dark:text-app-text-dark">
								{{ item.owner }}
							</p>
						</div>
						<div class="px-4 py-4 border border-app-line/80 rounded-[1.4rem] bg-app-bg dark:border-app-line-dark dark:bg-app-bg-dark/70">
							<UpdatedAt :value="item.lastCheckedAt" label="Last checked" />
						</div>
						<div class="px-4 py-4 border border-app-line/80 rounded-[1.4rem] bg-app-bg dark:border-app-line-dark dark:bg-app-bg-dark/70">
							<UpdatedAt :value="item.nextCheckAt" label="Next check" />
						</div>
					</div>
				</div>
			</article>
		</div>
	</section>
</template>
