<script setup lang="ts">
import type { AdminSourceHealth, PublicStatusResponse } from "~/types/civic";

const props = defineProps<{
	status: PublicStatusResponse;
}>();

const { formatDateTime } = useFormatters();

const totalSources = computed(() => Object.values(props.status.sourceSummary).reduce((sum, count) => sum + count, 0));
const segments: Array<{ health: AdminSourceHealth; label: string; tone: "accent" | "neutral" | "warning" }> = [
	{ health: "healthy", label: "Healthy", tone: "accent" },
	{ health: "review-soon", label: "Review soon", tone: "neutral" },
	{ health: "stale", label: "Stale", tone: "warning" },
	{ health: "incident", label: "Incident", tone: "warning" }
];

function segmentWidth(health: AdminSourceHealth) {
	if (!totalSources.value)
		return 0;

	if (!props.status.sourceSummary[health])
		return 0;

	return Math.round((props.status.sourceSummary[health] / totalSources.value) * 100);
}

const upcomingChecks = computed(() => {
	return [...props.status.sources]
		.sort((left, right) => new Date(left.nextCheckAt).getTime() - new Date(right.nextCheckAt).getTime())
		.slice(0, 4);
});
</script>

<template>
	<section class="surface-panel">
		<div class="flex flex-wrap gap-4 items-start justify-between">
			<div class="max-w-4xl">
				<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
					Data freshness dashboard
				</p>
				<h2 class="text-3xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
					How current is the public source layer?
				</h2>
				<p class="text-sm text-app-muted leading-7 mt-3 dark:text-app-muted-dark">
					This dashboard answers whether the public source layer is current enough to trust for reading today. It is about source monitoring, not hidden admin internals.
				</p>
			</div>
			<VerificationBadge :label="`${totalSources} tracked source${totalSources === 1 ? '' : 's'}`" tone="accent" />
		</div>

		<div class="mt-6 px-4 py-4 border border-app-line/70 rounded-[1rem] bg-app-bg dark:border-app-line-dark dark:bg-app-bg-dark/70">
			<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
				Health split
			</p>
			<div class="mt-4 rounded-full bg-app-line/70 flex h-4 overflow-hidden dark:bg-app-line-dark">
				<div
					v-for="segment in segments"
					:key="segment.health"
					class="h-full"
					:class="segment.health === 'healthy'
						? 'bg-app-accent'
						: segment.health === 'review-soon'
							? 'bg-app-warm'
							: segment.health === 'stale'
								? 'bg-[#d08a3a]'
								: 'bg-[#b55246]'"
					:style="{ width: `${segmentWidth(segment.health)}%` }"
				/>
			</div>
			<div class="mt-4 flex flex-wrap gap-2">
				<VerificationBadge
					v-for="segment in segments"
					:key="segment.health"
					:label="`${segment.label}: ${status.sourceSummary[segment.health]}`"
					:tone="segment.tone"
				/>
			</div>
		</div>

		<div class="mt-6 gap-4 grid xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]">
			<div class="px-4 py-4 border border-app-line/70 rounded-[1rem] bg-app-bg dark:border-app-line-dark dark:bg-app-bg-dark/70">
				<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
					Upcoming checks
				</p>
				<ul class="mt-4 space-y-3">
					<li
						v-for="item in upcomingChecks"
						:key="item.id"
						class="px-3 py-3 rounded-[0.9rem] bg-white/85 dark:bg-app-panel-dark/80"
					>
						<div class="flex flex-wrap gap-2 items-center justify-between">
							<p class="text-sm text-app-ink font-semibold dark:text-app-text-dark">
								{{ item.label }}
							</p>
							<VerificationBadge :label="item.health" :tone="item.health === 'healthy' ? 'accent' : item.health === 'incident' ? 'warning' : 'neutral'" />
						</div>
						<p class="text-xs text-app-muted leading-6 mt-2 dark:text-app-muted-dark">
							Next check {{ formatDateTime(item.nextCheckAt) }}
						</p>
					</li>
				</ul>
			</div>

			<div class="px-4 py-4 border border-app-line/70 rounded-[1rem] bg-app-bg dark:border-app-line-dark dark:bg-app-bg-dark/70">
				<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
					Current reading condition
				</p>
				<div class="mt-4 gap-3 grid md:grid-cols-3">
					<div class="px-3 py-3 rounded-[0.9rem] bg-white/85 dark:bg-app-panel-dark/80">
						<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
							Overall
						</p>
						<p class="text-xl text-app-ink font-semibold mt-3 dark:text-app-text-dark">
							{{ status.overallStatus }}
						</p>
					</div>
					<div class="px-3 py-3 rounded-[0.9rem] bg-white/85 dark:bg-app-panel-dark/80">
						<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
							Next review
						</p>
						<p class="text-sm text-app-ink font-semibold mt-3 dark:text-app-text-dark">
							{{ status.nextReviewAt ? formatDateTime(status.nextReviewAt) : "Not scheduled" }}
						</p>
					</div>
					<div class="px-3 py-3 rounded-[0.9rem] bg-white/85 dark:bg-app-panel-dark/80">
						<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
							Next publish window
						</p>
						<p class="text-sm text-app-ink font-semibold mt-3 dark:text-app-text-dark">
							{{ status.nextPublishWindow || "Not scheduled" }}
						</p>
					</div>
				</div>
				<p class="text-xs text-app-muted leading-6 mt-4 dark:text-app-muted-dark">
					<strong class="text-app-ink dark:text-app-text-dark">Uncertainty:</strong>
					A healthy source layer means the tracked public records are current enough for reading. It does not mean every jurisdiction or every candidate page has the same editorial depth.
				</p>
			</div>
		</div>
	</section>
</template>
