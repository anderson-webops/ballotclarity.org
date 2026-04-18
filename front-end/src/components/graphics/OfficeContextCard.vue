<script setup lang="ts">
import type { OfficeContext } from "~/types/civic";

const props = defineProps<{
	context: OfficeContext;
}>();
</script>

<template>
	<section class="p-5 border border-app-line/80 rounded-[1.6rem] bg-app-bg dark:border-app-line-dark dark:bg-app-bg-dark/70">
		<div class="flex flex-wrap gap-4 items-start justify-between">
			<div class="max-w-4xl">
				<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
					{{ props.context.eyebrow || "Office context" }}
				</p>
				<h3 class="text-2xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
					{{ props.context.title }}
				</h3>
				<p v-if="props.context.officeLabel" class="text-sm text-app-muted mt-3 dark:text-app-muted-dark">
					{{ props.context.officeLabel }}
				</p>
				<p class="text-sm text-app-muted leading-7 mt-3 dark:text-app-muted-dark">
					{{ props.context.summary }}
				</p>
			</div>
			<div class="flex flex-wrap gap-2 items-center justify-end">
				<VerificationBadge
					v-for="badge in props.context.badges ?? []"
					:key="badge.label"
					:label="badge.label"
					:tone="badge.tone"
				/>
				<SourceDrawer
					v-if="props.context.sources?.length"
					:sources="props.context.sources"
					:title="props.context.title"
					:button-label="props.context.sourceButtonLabel || 'Sources'"
				/>
			</div>
		</div>

		<div v-if="props.context.stats?.length" class="mt-5 gap-3 grid md:grid-cols-2 xl:grid-cols-4">
			<FactStatCard
				v-for="item in props.context.stats"
				:key="item.label"
				:label="item.label"
				:note="item.detail"
				:value="item.value"
			/>
		</div>

		<div class="mt-5 gap-4 grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
			<div class="px-4 py-4 border border-app-line/70 rounded-[1rem] bg-white/85 dark:border-app-line-dark dark:bg-app-panel-dark/80">
				<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
					Why this office matters
				</p>
				<p class="text-sm text-app-muted leading-7 mt-3 dark:text-app-muted-dark">
					{{ props.context.whyItMatters || props.context.summary }}
				</p>
			</div>
			<div class="px-4 py-4 border border-app-line/70 rounded-[1rem] bg-white/85 dark:border-app-line-dark dark:bg-app-panel-dark/80">
				<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
					What this surface covers
				</p>
				<ul class="mt-3 space-y-3">
					<li
						v-for="item in props.context.responsibilities"
						:key="item"
						class="text-sm text-app-muted leading-6 px-3 py-3 rounded-[0.9rem] bg-app-bg dark:text-app-muted-dark dark:bg-app-bg-dark/80"
					>
						{{ item }}
					</li>
				</ul>
			</div>
		</div>

		<p v-if="props.context.uncertainty" class="text-xs text-app-muted leading-6 mt-4 dark:text-app-muted-dark">
			<strong class="text-app-ink dark:text-app-text-dark">Uncertainty:</strong>
			{{ props.context.uncertainty }}
		</p>
	</section>
</template>
