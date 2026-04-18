<script setup lang="ts">
import type { MeasureImpact } from "~/types/civic";

const props = defineProps<{
	impact: MeasureImpact;
}>();
</script>

<template>
	<section class="p-5 border border-app-line/80 rounded-[1.6rem] bg-app-bg dark:border-app-line-dark dark:bg-app-bg-dark/70">
		<div class="flex flex-wrap gap-4 items-start justify-between">
			<div class="max-w-4xl">
				<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
					Measure impact diagram
				</p>
				<h3 class="text-2xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
					{{ props.impact.title }}
				</h3>
				<p class="text-sm text-app-muted leading-7 mt-3 dark:text-app-muted-dark">
					{{ props.impact.note }}
				</p>
			</div>
			<VerificationBadge label="Source-backed pathways" tone="accent" />
		</div>

		<div class="mt-5 gap-4 grid xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,1fr)]">
			<article class="px-4 py-4 border border-app-line/70 rounded-[1rem] bg-white/85 dark:border-app-line-dark dark:bg-app-panel-dark/80">
				<div class="flex flex-wrap gap-3 items-center justify-between">
					<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
						{{ props.impact.currentPath.label }}
					</p>
					<SourceDrawer v-if="props.impact.currentPath.sources?.length" :sources="props.impact.currentPath.sources" :title="props.impact.currentPath.title" button-label="Sources" />
				</div>
				<h4 class="text-xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
					{{ props.impact.currentPath.title }}
				</h4>
				<p class="text-sm text-app-muted leading-7 mt-3 dark:text-app-muted-dark">
					{{ props.impact.currentPath.summary }}
				</p>
				<ul class="mt-4 space-y-3">
					<li v-for="item in props.impact.currentPath.items" :key="item.id" class="text-sm text-app-muted leading-6 px-3 py-3 rounded-[0.9rem] bg-app-bg dark:text-app-muted-dark dark:bg-app-bg-dark/80">
						{{ item.text }}
					</li>
				</ul>
			</article>

			<article class="px-4 py-4 border border-app-line/70 rounded-[1rem] bg-white/85 dark:border-app-line-dark dark:bg-app-panel-dark/80">
				<div class="flex flex-wrap gap-3 items-center justify-between">
					<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
						{{ props.impact.yesPath.label }}
					</p>
					<SourceDrawer v-if="props.impact.yesPath.sources?.length" :sources="props.impact.yesPath.sources" :title="props.impact.yesPath.title" button-label="Sources" />
				</div>
				<h4 class="text-xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
					{{ props.impact.yesPath.title }}
				</h4>
				<p class="text-sm text-app-muted leading-7 mt-3 dark:text-app-muted-dark">
					{{ props.impact.yesPath.summary }}
				</p>
				<ul class="mt-4 space-y-3">
					<li v-for="item in props.impact.yesPath.items" :key="item.id" class="text-sm text-app-muted leading-6 px-3 py-3 rounded-[0.9rem] bg-app-bg dark:text-app-muted-dark dark:bg-app-bg-dark/80">
						{{ item.text }}
					</li>
				</ul>
			</article>

			<article class="px-4 py-4 border border-app-line/70 rounded-[1rem] bg-white/85 dark:border-app-line-dark dark:bg-app-panel-dark/80">
				<div class="flex flex-wrap gap-3 items-center justify-between">
					<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
						{{ props.impact.noPath.label }}
					</p>
					<SourceDrawer v-if="props.impact.noPath.sources?.length" :sources="props.impact.noPath.sources" :title="props.impact.noPath.title" button-label="Sources" />
				</div>
				<h4 class="text-xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
					{{ props.impact.noPath.title }}
				</h4>
				<p class="text-sm text-app-muted leading-7 mt-3 dark:text-app-muted-dark">
					{{ props.impact.noPath.summary }}
				</p>
				<ul class="mt-4 space-y-3">
					<li v-for="item in props.impact.noPath.items" :key="item.id" class="text-sm text-app-muted leading-6 px-3 py-3 rounded-[0.9rem] bg-app-bg dark:text-app-muted-dark dark:bg-app-bg-dark/80">
						{{ item.text }}
					</li>
				</ul>
			</article>
		</div>

		<div class="mt-4 gap-4 grid xl:grid-cols-2">
			<article class="px-4 py-4 border border-app-line/70 rounded-[1rem] bg-white/85 dark:border-app-line-dark dark:bg-app-panel-dark/80">
				<div class="flex flex-wrap gap-3 items-center justify-between">
					<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
						Implementation and timing
					</p>
					<SourceDrawer v-if="props.impact.implementationTimeline.flatMap(item => item.sources ?? []).length" :sources="props.impact.implementationTimeline.flatMap(item => item.sources ?? [])" :title="`${props.impact.title} implementation timing`" button-label="Sources" />
				</div>
				<p class="text-sm text-app-muted leading-7 mt-3 dark:text-app-muted-dark">
					{{ props.impact.implementationSummary }}
				</p>
				<ul class="mt-4 space-y-3">
					<li v-for="item in props.impact.implementationTimeline" :key="item.id" class="text-sm text-app-muted leading-6 px-3 py-3 rounded-[0.9rem] bg-app-bg dark:text-app-muted-dark dark:bg-app-bg-dark/80">
						<strong class="text-app-ink dark:text-app-text-dark">{{ item.date }}:</strong>
						{{ item.summary }}
					</li>
				</ul>
			</article>

			<article class="px-4 py-4 border border-app-line/70 rounded-[1rem] bg-white/85 dark:border-app-line-dark dark:bg-app-panel-dark/80">
				<div class="flex flex-wrap gap-3 items-center justify-between">
					<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
						Fiscal and practical effects
					</p>
					<SourceDrawer v-if="props.impact.fiscalItems.flatMap(item => item.sources ?? []).length" :sources="props.impact.fiscalItems.flatMap(item => item.sources ?? [])" :title="`${props.impact.title} fiscal sources`" button-label="Sources" />
				</div>
				<p class="text-sm text-app-muted leading-7 mt-3 dark:text-app-muted-dark">
					{{ props.impact.fiscalSummary }}
				</p>
				<ul class="mt-4 space-y-3">
					<li v-for="item in props.impact.fiscalItems" :key="item.id" class="text-sm text-app-muted leading-6 px-3 py-3 rounded-[0.9rem] bg-app-bg dark:text-app-muted-dark dark:bg-app-bg-dark/80">
						<strong class="text-app-ink dark:text-app-text-dark">{{ item.label }}:</strong>
						{{ item.value }} · {{ item.detail }}
					</li>
				</ul>
			</article>
		</div>

		<p v-if="props.impact.uncertainty" class="text-xs text-app-muted leading-6 mt-4 dark:text-app-muted-dark">
			<strong class="text-app-ink dark:text-app-text-dark">Uncertainty:</strong>
			{{ props.impact.uncertainty }}
		</p>
	</section>
</template>
