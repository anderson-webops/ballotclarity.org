<script setup lang="ts">
import type { BeforeAfterData } from "~/types/civic";

const props = defineProps<{
	data: BeforeAfterData;
}>();
</script>

<template>
	<section class="p-5 border border-app-line/80 rounded-[1.6rem] bg-app-bg dark:border-app-line-dark dark:bg-app-bg-dark/70">
		<div class="flex flex-wrap gap-4 items-start justify-between">
			<div class="max-w-4xl">
				<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
					{{ props.data.eyebrow || "Before / after" }}
				</p>
				<h3 class="text-2xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
					{{ props.data.title }}
				</h3>
			</div>
			<SourceDrawer
				v-if="props.data.sources?.length"
				:sources="props.data.sources"
				:title="props.data.title"
				:button-label="props.data.sourceButtonLabel || 'Sources'"
			/>
		</div>

		<div class="mt-5 gap-4 grid lg:grid-cols-2">
			<article class="px-4 py-4 border border-app-line/70 rounded-[1rem] bg-white/85 dark:border-app-line-dark dark:bg-app-panel-dark/80">
				<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
					{{ props.data.beforeLabel || "Before" }}
				</p>
				<p v-if="props.data.beforeSummary" class="text-sm text-app-muted leading-7 mt-3 dark:text-app-muted-dark">
					{{ props.data.beforeSummary }}
				</p>
				<ul class="mt-4 space-y-3">
					<li
						v-for="item in props.data.beforeItems"
						:key="item.id"
						class="px-3 py-3 rounded-[0.9rem] bg-app-bg dark:bg-app-bg-dark/80"
					>
						<p class="text-sm text-app-muted leading-6 dark:text-app-muted-dark">
							{{ item.text }}
						</p>
						<div v-if="item.sources?.length" class="mt-3">
							<SourceDrawer
								:sources="item.sources"
								:title="item.text"
								button-label="Sources"
							/>
						</div>
					</li>
				</ul>
			</article>

			<article class="px-4 py-4 border border-app-line/70 rounded-[1rem] bg-white/85 dark:border-app-line-dark dark:bg-app-panel-dark/80">
				<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
					{{ props.data.afterLabel || "After" }}
				</p>
				<p v-if="props.data.afterSummary" class="text-sm text-app-muted leading-7 mt-3 dark:text-app-muted-dark">
					{{ props.data.afterSummary }}
				</p>
				<ul class="mt-4 space-y-3">
					<li
						v-for="item in props.data.afterItems"
						:key="item.id"
						class="px-3 py-3 rounded-[0.9rem] bg-app-bg dark:bg-app-bg-dark/80"
					>
						<p class="text-sm text-app-muted leading-6 dark:text-app-muted-dark">
							{{ item.text }}
						</p>
						<div v-if="item.sources?.length" class="mt-3">
							<SourceDrawer
								:sources="item.sources"
								:title="item.text"
								button-label="Sources"
							/>
						</div>
					</li>
				</ul>
			</article>
		</div>

		<p v-if="props.data.uncertainty" class="text-xs text-app-muted leading-6 mt-4 dark:text-app-muted-dark">
			<strong class="text-app-ink dark:text-app-text-dark">Uncertainty:</strong>
			{{ props.data.uncertainty }}
		</p>
	</section>
</template>
