<script setup lang="ts">
withDefaults(defineProps<{
	collapsible?: boolean;
	compact?: boolean;
	description?: string;
	eyebrow?: string;
	id?: string;
	nested?: boolean;
	open?: boolean;
	title: string;
}>(), {
	collapsible: true,
	compact: false,
	description: "",
	eyebrow: "",
	id: undefined,
	nested: false,
	open: false
});
</script>

<template>
	<component
		:is="collapsible ? 'details' : 'section'"
		:id="id"
		class="expandable-section scroll-mt-28"
		:class="nested
			? 'expandable-section--nested'
			: ''"
		:open="collapsible ? open : undefined"
	>
		<component :is="collapsible ? 'summary' : 'header'" class="expandable-section__summary" :class="{ 'focus-ring': collapsible }">
			<div class="min-w-0">
				<h2 class="text-app-ink font-serif dark:text-app-text-dark" :class="compact ? 'text-xl' : 'text-2xl sm:text-[1.7rem]'">
					{{ title }}
				</h2>
				<p v-if="description" class="text-sm text-app-muted leading-7 max-w-3xl dark:text-app-muted-dark" :class="compact ? 'mt-3' : 'mt-4'">
					{{ description }}
				</p>
			</div>
			<div class="expandable-section__meta">
				<slot name="meta" />
				<span v-if="collapsible" class="expandable-section__chevron i-carbon-chevron-down" aria-hidden="true" />
			</div>
		</component>
		<div class="expandable-section__body">
			<slot />
		</div>
	</component>
</template>
