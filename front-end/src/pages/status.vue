<script setup lang="ts">
const { formatDateTime } = useFormatters();
const { data, error, pending } = await usePublicStatus();

usePageSeo({
	description: "Public status page for Ballot Clarity showing source health, coverage, and current review notices.",
	path: "/status",
	title: "Public Status"
});

const statusTone = computed(() => {
	switch (data.value?.overallStatus) {
		case "healthy":
			return "accent" as const;
		case "degraded":
			return "warning" as const;
		default:
			return "neutral" as const;
	}
});

const statusLabel = computed(() => {
	switch (data.value?.overallStatus) {
		case "healthy":
			return "Healthy";
		case "degraded":
			return "Degraded";
		default:
			return "Reviewing";
	}
});

const snapshotLabel = computed(() => {
	if (data.value?.coverageMode !== "snapshot")
		return data.value?.snapshotProvenance?.configuredSnapshotMissing ? "Snapshot missing" : "No local snapshot";

	switch (data.value?.snapshotProvenance?.status) {
		case "production_approved":
			return "Production-approved snapshot";
		case "reviewed":
			return "Reviewed snapshot";
		case "seed":
			return "Seed snapshot";
		default:
			return "Unclassified snapshot";
	}
});
const hasSourceMetrics = computed(() => data.value ? Object.values(data.value.sourceSummary).some(value => value > 0) : false);
const hasPublishedMonitors = computed(() => Boolean(data.value?.sources.length));
const hasPublicIncidents = computed(() => Boolean(data.value?.incidents.length));
</script>

<template>
	<section class="app-shell section-gap space-y-8">
		<div v-if="pending" class="space-y-6">
			<div class="surface-panel bg-white/70 h-64 animate-pulse dark:bg-app-panel-dark/70" />
			<div class="gap-6 grid xl:grid-cols-2">
				<div v-for="index in 4" :key="index" class="surface-panel bg-white/70 h-48 animate-pulse dark:bg-app-panel-dark/70" />
			</div>
		</div>

		<div v-else-if="error || !data" class="max-w-3xl">
			<InfoCallout title="Public status unavailable" tone="warning">
				The status page could not be loaded. Refresh the page or return to the coverage page and try again.
			</InfoCallout>
		</div>

		<div v-else class="space-y-8">
			<header class="surface-panel max-w-5xl">
				<div class="flex flex-wrap gap-2">
					<TrustBadge :label="statusLabel" :tone="statusTone" />
					<TrustBadge :label="snapshotLabel" />
					<TrustBadge label="Public source health" tone="warning" />
				</div>
				<h1 class="text-5xl text-app-ink font-serif mt-5 dark:text-app-text-dark">
					Public status
				</h1>
				<p class="text-base text-app-muted leading-8 mt-5 dark:text-app-muted-dark">
					This page shows whether Ballot Clarity's public data and guide coverage are ready to rely on.
				</p>
				<div class="mt-6 flex flex-wrap gap-4 items-center">
					<UpdatedAt :value="data.updatedAt" label="Status updated" />
					<p class="text-sm text-app-muted dark:text-app-muted-dark">
						Coverage data updated {{ formatDateTime(data.coverageUpdatedAt) }}
					</p>
				</div>
			</header>

			<section v-if="hasSourceMetrics" class="gap-4 grid md:grid-cols-2 xl:grid-cols-4">
				<div class="surface-row">
					<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
						Healthy sources
					</p>
					<p class="text-3xl text-app-ink font-semibold mt-3 dark:text-app-text-dark">
						{{ data.sourceSummary.healthy }}
					</p>
				</div>
				<div class="surface-row">
					<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
						Review soon
					</p>
					<p class="text-3xl text-app-ink font-semibold mt-3 dark:text-app-text-dark">
						{{ data.sourceSummary["review-soon"] }}
					</p>
				</div>
				<div class="surface-row">
					<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
						Incidents
					</p>
					<p class="text-3xl text-app-ink font-semibold mt-3 dark:text-app-text-dark">
						{{ data.sourceSummary.incident }}
					</p>
				</div>
				<div class="surface-row">
					<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
						Stale
					</p>
					<p class="text-3xl text-app-ink font-semibold mt-3 dark:text-app-text-dark">
						{{ data.sourceSummary.stale }}
					</p>
				</div>
			</section>

			<section v-else class="surface-panel">
				<div class="flex flex-wrap gap-2">
					<TrustBadge :label="hasPublicIncidents ? 'Active notices published' : 'No open public incidents'" :tone="hasPublicIncidents ? 'warning' : 'accent'" />
					<TrustBadge :label="snapshotLabel" />
				</div>
				<h2 class="text-3xl text-app-ink font-serif mt-4 dark:text-app-text-dark">
					No source-monitor metrics are published right now
				</h2>
				<p class="text-sm text-app-muted leading-7 mt-4 dark:text-app-muted-dark">
					The public status page is still showing coverage state and snapshot provenance. Detailed source-monitor counts appear here only when public monitors are active.
				</p>
			</section>

			<section v-if="hasPublicIncidents || hasPublishedMonitors" class="gap-6 grid xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
				<div v-if="hasPublicIncidents" class="surface-panel">
					<h2 class="text-3xl text-app-ink font-serif dark:text-app-text-dark">
						Active notices
					</h2>
					<ul class="mt-5 space-y-3">
						<li v-for="notice in data.incidents" :key="notice.id" class="surface-row">
							<p class="text-lg text-app-ink font-semibold dark:text-app-text-dark">
								{{ notice.title }}
							</p>
							<p class="text-sm text-app-muted leading-7 mt-3 dark:text-app-muted-dark">
								{{ notice.summary }}
							</p>
						</li>
					</ul>
				</div>

				<div v-if="hasPublishedMonitors" class="surface-panel">
					<h2 class="text-3xl text-app-ink font-serif dark:text-app-text-dark">
						Tracked public sources
					</h2>
					<div class="mt-5 space-y-3">
						<article v-for="source in data.sources" :key="source.id" class="surface-row">
							<div class="flex flex-wrap gap-2 items-center">
								<SourceAuthorityBadge :authority="source.authority" />
								<TrustBadge :label="source.health" :tone="source.health === 'healthy' ? 'accent' : source.health === 'incident' ? 'warning' : 'neutral'" />
							</div>
							<h3 class="text-xl text-app-ink font-semibold mt-4 dark:text-app-text-dark">
								{{ source.label }}
							</h3>
							<p class="text-sm text-app-muted leading-7 mt-3 dark:text-app-muted-dark">
								{{ source.note }}
							</p>
							<p class="text-xs text-app-muted mt-4 dark:text-app-muted-dark">
								Last checked {{ formatDateTime(source.lastCheckedAt) }} · Next check {{ formatDateTime(source.nextCheckAt) }}
							</p>
						</article>
					</div>
				</div>
			</section>

			<section class="surface-panel">
				<h2 class="text-3xl text-app-ink font-serif dark:text-app-text-dark">
					Public notes
				</h2>
				<ul class="readable-list text-sm text-app-muted mt-6 pl-5 dark:text-app-muted-dark">
					<li v-for="note in data.notes" :key="note">
						{{ note }}
					</li>
				</ul>
				<details class="mt-6 surface-row">
					<summary class="text-sm text-app-ink font-semibold cursor-pointer dark:text-app-text-dark focus-ring">
						Review and publish timing
					</summary>
					<div class="mt-4 space-y-3">
						<p class="text-sm text-app-muted dark:text-app-muted-dark">
							<strong class="text-app-ink dark:text-app-text-dark">Next source review:</strong> {{ data.nextReviewAt ? formatDateTime(data.nextReviewAt) : "Not scheduled" }}
						</p>
						<p class="text-sm text-app-muted dark:text-app-muted-dark">
							<strong class="text-app-ink dark:text-app-text-dark">Next publish window:</strong> {{ data.nextPublishWindow || "Not scheduled" }}
						</p>
					</div>
				</details>
			</section>
		</div>
	</section>
</template>
