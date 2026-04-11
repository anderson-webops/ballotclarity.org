<script setup lang="ts">
defineProps<{
	label: string;
}>();
</script>

<template>
	<span class="text-xs text-app-muted font-medium px-3 py-1 border border-app-line/80 rounded-full bg-app-bg inline-flex items-center dark:text-app-muted-dark dark:border-app-line-dark dark:bg-app-bg-dark/60">
		{{ label }}
	</span>
</template>
