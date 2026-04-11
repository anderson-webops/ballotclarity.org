<script setup lang="ts">
defineProps<{
	items: Array<{
		label: string;
		to?: string;
	}>;
}>();
</script>

<template>
	<nav aria-label="Breadcrumb" class="mb-6">
		<ol class="text-sm text-app-muted flex flex-wrap gap-x-2 gap-y-1 items-center dark:text-app-muted-dark">
			<li
				v-for="(item, index) in items"
				:key="`${item.label}-${index}`"
				class="flex gap-2 items-center"
			>
				<NuxtLink
					v-if="item.to"
					:to="item.to"
					class="rounded-md transition hover:text-app-ink focus-ring dark:hover:text-app-text-dark"
				>
					{{ item.label }}
				</NuxtLink>
				<span v-else class="text-app-ink font-semibold dark:text-app-text-dark">
					{{ item.label }}
				</span>
				<span v-if="index < items.length - 1" class="text-app-line dark:text-app-line-dark" aria-hidden="true">
					/
				</span>
			</li>
		</ol>
	</nav>
</template>
