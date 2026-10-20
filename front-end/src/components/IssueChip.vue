<script setup lang="ts">
defineProps<{
	label: string;
}>();
</script>

<template>
	<span class="text-sm text-app-muted font-medium inline-flex items-center dark:text-app-muted-dark">
		{{ label }}
	</span>
</template>
