<script setup lang="ts">
withDefaults(defineProps<{
	description?: string;
	eyebrow?: string;
	id?: string;
	open?: boolean;
	title: string;
}>(), {
	description: "",
	eyebrow: "",
	id: undefined,
	open: false
});
</script>

<template>
	<details :id="id" class="expandable-section surface-panel scroll-mt-28" :open="open">
		<summary class="expandable-section__summary focus-ring">
			<div class="min-w-0">
				<p v-if="eyebrow" class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
					{{ eyebrow }}
				</p>
				<h2 class="text-3xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
					{{ title }}
				</h2>
				<p v-if="description" class="text-sm text-app-muted leading-7 mt-4 max-w-3xl dark:text-app-muted-dark">
					{{ description }}
				</p>
			</div>
			<div class="expandable-section__meta">
				<slot name="meta" />
				<span class="expandable-section__chevron i-carbon-chevron-down" aria-hidden="true" />
			</div>
		</summary>
		<div class="expandable-section__body">
			<slot />
		</div>
	</details>
</template>
