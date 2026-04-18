<script setup lang="ts">
import type { LookupAvailability } from "~/types/civic";

const props = withDefaults(defineProps<{
	eyebrow?: string;
	items: LookupAvailability[];
	note?: string;
	title: string;
	uncertainty?: string;
}>(), {
	eyebrow: "Data availability",
	note: "",
	uncertainty: ""
});
</script>

<template>
	<section v-if="props.items.length" class="p-5 border border-app-line/80 rounded-[1.6rem] bg-app-bg dark:border-app-line-dark dark:bg-app-bg-dark/70">
		<div class="flex flex-wrap gap-4 items-start justify-between">
			<div class="max-w-3xl">
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
		</div>

		<div class="mt-5 gap-3 grid md:grid-cols-2 xl:grid-cols-4">
			<article
				v-for="item in props.items"
				:key="item.label"
				class="px-4 py-4 border border-app-line/80 rounded-[1.2rem] bg-white/85 dark:border-app-line-dark dark:bg-app-panel-dark/80"
			>
				<div class="flex flex-wrap gap-2 items-center justify-between">
					<p class="text-sm text-app-ink font-semibold dark:text-app-text-dark">
						{{ item.label }}
					</p>
					<div class="flex flex-wrap gap-2 items-center">
						<VerificationBadge :label="item.status" :tone="item.status === 'available' ? 'accent' : item.status === 'partial' ? 'warning' : 'neutral'" />
						<SourceDrawer
							v-if="item.sources?.length"
							:sources="item.sources"
							:title="item.label"
							button-label="Sources"
						/>
					</div>
				</div>
				<p class="text-sm text-app-muted leading-6 mt-3 dark:text-app-muted-dark">
					{{ item.detail }}
				</p>
				<p v-if="item.confidence || item.note" class="text-xs text-app-muted leading-6 mt-2 dark:text-app-muted-dark">
					<span v-if="item.confidence">
						<strong class="text-app-ink dark:text-app-text-dark">Confidence:</strong>
						{{ item.confidence }}
					</span>
					<span v-if="item.confidence && item.note"> · </span>
					<span v-if="item.note">{{ item.note }}</span>
				</p>
			</article>
		</div>

		<p v-if="props.uncertainty" class="text-xs text-app-muted leading-6 mt-4 dark:text-app-muted-dark">
			<strong class="text-app-ink dark:text-app-text-dark">Uncertainty:</strong>
			{{ props.uncertainty }}
		</p>
	</section>
</template>
