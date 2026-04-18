<script setup lang="ts">
import type { SourceDensityEntity } from "~/types/civic";

const props = withDefaults(defineProps<{
	entities: SourceDensityEntity[];
	eyebrow?: string;
	note?: string;
	title: string;
	uncertainty?: string;
}>(), {
	eyebrow: "Source density",
	note: "",
	uncertainty: ""
});

const maxCount = computed(() => {
	if (!props.entities.length)
		return 1;

	return Math.max(...props.entities.map(entity => entity.count), 1);
});
</script>

<template>
	<section v-if="props.entities.length" class="p-5 border border-app-line/80 rounded-[1.6rem] bg-app-bg dark:border-app-line-dark dark:bg-app-bg-dark/70">
		<div class="flex flex-wrap gap-4 items-start justify-between">
			<div class="max-w-4xl">
				<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
					{{ props.eyebrow }}
				</p>
				<h3 class="text-2xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
					{{ props.title }}
				</h3>
				<p v-if="props.note" class="text-sm text-app-muted leading-7 mt-3 dark:text-app-muted-dark">
					{{ props.note }}
				</p>
			</div>
			<VerificationBadge label="Relative source depth" tone="accent" />
		</div>

		<div class="mt-5 space-y-4">
			<article
				v-for="entity in props.entities"
				:key="entity.id"
				class="px-4 py-4 border border-app-line/70 rounded-[1rem] bg-white/85 dark:border-app-line-dark dark:bg-app-panel-dark/80"
			>
				<div class="flex flex-wrap gap-3 items-center justify-between">
					<p class="text-sm text-app-ink font-semibold dark:text-app-text-dark">
						{{ entity.label }}
					</p>
					<div class="flex flex-wrap gap-2 items-center">
						<VerificationBadge :label="`${entity.count} source${entity.count === 1 ? '' : 's'}`" />
						<SourceDrawer
							v-if="entity.sources?.length"
							:sources="entity.sources"
							:title="entity.label"
							button-label="Sources"
						/>
					</div>
				</div>
				<div class="mt-3 rounded-full bg-app-line/80 h-3 overflow-hidden dark:bg-app-line-dark">
					<div class="rounded-full bg-app-accent h-full" :style="{ width: `${Math.max(18, Math.round((entity.count / maxCount) * 100))}%` }" />
				</div>
				<p class="text-sm text-app-muted leading-6 mt-3 dark:text-app-muted-dark">
					{{ entity.detail }}
				</p>
				<p v-if="entity.uncertainty" class="text-xs text-app-muted leading-6 mt-3 dark:text-app-muted-dark">
					<strong class="text-app-ink dark:text-app-text-dark">Uncertainty:</strong>
					{{ entity.uncertainty }}
				</p>
			</article>
		</div>

		<p v-if="props.uncertainty" class="text-xs text-app-muted leading-6 mt-4 dark:text-app-muted-dark">
			<strong class="text-app-ink dark:text-app-text-dark">Uncertainty:</strong>
			{{ props.uncertainty }}
		</p>
	</section>
</template>
