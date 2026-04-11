<script setup lang="ts">
import type { Measure } from "~/types/civic";

defineProps<{
	measure: Measure;
}>();
</script>

<template>
	<article class="surface-panel h-full">
		<div class="flex flex-wrap gap-3 items-start justify-between">
			<div>
				<h3 class="text-2xl text-app-ink font-serif dark:text-app-text-dark">
					{{ measure.title }}
				</h3>
				<p class="text-sm text-app-muted mt-2 dark:text-app-muted-dark">
					{{ measure.location }}
				</p>
			</div>
			<SourceDrawer
				:sources="measure.sources"
				:title="`${measure.title} sources`"
				:button-label="`${measure.sources.length} source${measure.sources.length === 1 ? '' : 's'}`"
			/>
		</div>

		<p class="text-sm text-app-muted leading-7 mt-5 dark:text-app-muted-dark">
			{{ measure.ballotSummary }}
		</p>

		<dl class="mt-6 gap-4 grid sm:grid-cols-2">
			<div class="p-4 rounded-2xl bg-app-bg dark:bg-app-bg-dark/70">
				<dt class="text-xs text-app-muted tracking-[0.22em] font-semibold uppercase dark:text-app-muted-dark">
					What YES means
				</dt>
				<dd class="text-sm text-app-muted leading-6 mt-2 dark:text-app-muted-dark">
					{{ measure.yesMeaning }}
				</dd>
			</div>
			<div class="p-4 rounded-2xl bg-app-bg dark:bg-app-bg-dark/70">
				<dt class="text-xs text-app-muted tracking-[0.22em] font-semibold uppercase dark:text-app-muted-dark">
					What NO means
				</dt>
				<dd class="text-sm text-app-muted leading-6 mt-2 dark:text-app-muted-dark">
					{{ measure.noMeaning }}
				</dd>
			</div>
		</dl>

		<p class="text-sm text-app-muted leading-6 mt-5 dark:text-app-muted-dark">
			{{ measure.fiscalContextNote }}
		</p>

		<div class="mt-8">
			<NuxtLink :to="`/measure/${measure.slug}`" class="btn-primary">
				View details
			</NuxtLink>
		</div>
	</article>
</template>
