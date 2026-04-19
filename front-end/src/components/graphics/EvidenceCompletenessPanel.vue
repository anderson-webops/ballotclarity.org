<script setup lang="ts">
import type { EvidenceCompleteness } from "~/types/civic";
import FactStatCard from "~/components/graphics/FactStatCard.vue";

const props = defineProps<{
	evidence: EvidenceCompleteness;
}>();

const totalItems = computed(() => props.evidence.known.length + props.evidence.unknown.length);
const knownShare = computed(() => {
	if (!totalItems.value)
		return 50;

	return Math.round((props.evidence.known.length / totalItems.value) * 100);
});
</script>

<template>
	<section class="p-5 border border-app-line/80 rounded-[1.6rem] bg-app-bg dark:border-app-line-dark dark:bg-app-bg-dark/70">
		<div class="flex flex-wrap gap-4 items-start justify-between">
			<div class="max-w-4xl">
				<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
					Evidence completeness
				</p>
				<h3 class="text-2xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
					{{ props.evidence.title || "How complete is this page?" }}
				</h3>
				<p class="text-sm text-app-muted leading-7 mt-3 dark:text-app-muted-dark">
					{{ props.evidence.note || "This is not a confidence score. It is a reading aid that shows what the current archive documents directly and what still remains open." }}
				</p>
			</div>
			<div class="flex flex-wrap gap-2 items-center">
				<VerificationBadge :label="props.evidence.freshness.statusLabel" :tone="props.evidence.freshness.status === 'up-to-date' ? 'accent' : props.evidence.freshness.status === 'updating' ? 'warning' : 'neutral'" />
				<SourceDrawer v-if="props.evidence.sources?.length" :sources="props.evidence.sources" :title="props.evidence.title || 'Evidence completeness'" button-label="Sources" />
			</div>
		</div>

		<div class="mt-5 gap-4 grid lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
			<div class="px-4 py-4 border border-app-line/70 rounded-[1rem] bg-white/85 dark:border-app-line-dark dark:bg-app-panel-dark/80">
				<div class="flex flex-wrap gap-3 items-end justify-between">
					<FactStatCard label="Documented now" note="Items the current archive documents directly." :value="props.evidence.known.length" />
					<FactStatCard label="Still checking" note="Items that remain open or only partially documented." :value="props.evidence.unknown.length" />
				</div>

				<div class="mt-5">
					<div class="rounded-full bg-app-line/80 h-3 overflow-hidden dark:bg-app-line-dark">
						<div class="rounded-full bg-app-accent h-full" :style="{ width: `${knownShare}%` }" />
					</div>
					<p class="text-xs text-app-muted leading-6 mt-3 dark:text-app-muted-dark">
						{{ knownShare }}% of the explicit completeness bullets on this page are currently in the documented column.
					</p>
				</div>

				<p class="text-xs text-app-muted leading-6 mt-4 dark:text-app-muted-dark">
					<strong class="text-app-ink dark:text-app-text-dark">Freshness note:</strong>
					{{ props.evidence.freshness.statusNote }}
				</p>
				<p v-if="props.evidence.uncertainty" class="text-xs text-app-muted leading-6 mt-3 dark:text-app-muted-dark">
					<strong class="text-app-ink dark:text-app-text-dark">Uncertainty:</strong>
					{{ props.evidence.uncertainty }}
				</p>
			</div>

			<div class="gap-4 grid md:grid-cols-2">
				<div class="px-4 py-4 border border-app-line/70 rounded-[1rem] bg-white/85 dark:border-app-line-dark dark:bg-app-panel-dark/80">
					<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
						What the archive documents
					</p>
					<ul class="mt-4 space-y-3">
						<li
							v-for="item in props.evidence.known"
							:key="item.id"
							class="px-3 py-3 rounded-[0.9rem] bg-app-bg dark:bg-app-bg-dark/80"
						>
							<p class="text-sm text-app-muted leading-6 dark:text-app-muted-dark">
								{{ item.text }}
							</p>
							<div v-if="item.sources.length" class="mt-3">
								<SourceDrawer :sources="item.sources" :title="item.text" button-label="Sources" />
							</div>
						</li>
					</ul>
				</div>

				<div class="px-4 py-4 border border-app-line/70 rounded-[1rem] bg-white/85 dark:border-app-line-dark dark:bg-app-panel-dark/80">
					<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
						What remains open
					</p>
					<ul class="mt-4 space-y-3">
						<li
							v-for="item in props.evidence.unknown"
							:key="item.id"
							class="px-3 py-3 rounded-[0.9rem] bg-app-bg dark:bg-app-bg-dark/80"
						>
							<p class="text-sm text-app-muted leading-6 dark:text-app-muted-dark">
								{{ item.text }}
							</p>
							<div v-if="item.sources.length" class="mt-3">
								<SourceDrawer :sources="item.sources" :title="item.text" button-label="Sources" />
							</div>
						</li>
					</ul>
				</div>
			</div>
		</div>
	</section>
</template>
