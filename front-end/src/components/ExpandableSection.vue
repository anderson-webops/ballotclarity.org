<script setup lang="ts">
withDefaults(defineProps<{
	compact?: boolean;
	description?: string;
	eyebrow?: string;
	id?: string;
	nested?: boolean;
	open?: boolean;
	title: string;
}>(), {
	compact: false,
	description: "",
	eyebrow: "",
	id: undefined,
	nested: false,
	open: false
});
</script>

<template>
	<details
		:id="id"
		class="expandable-section scroll-mt-28"
		:class="nested
			? 'rounded-[1.2rem] border border-app-line/80 bg-app-bg/45 p-4 dark:border-app-line-dark dark:bg-app-bg-dark/45'
			: 'surface-panel'"
		:open="open"
	>
		<summary class="expandable-section__summary focus-ring">
			<div class="min-w-0">
				<p v-if="eyebrow" class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
					{{ eyebrow }}
				</p>
				<h2 class="text-app-ink font-serif dark:text-app-text-dark" :class="compact ? 'text-xl mt-2' : 'text-3xl mt-3'">
					{{ title }}
				</h2>
				<p v-if="description" class="text-sm text-app-muted leading-7 max-w-3xl dark:text-app-muted-dark" :class="compact ? 'mt-3' : 'mt-4'">
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
