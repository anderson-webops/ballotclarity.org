<script setup lang="ts">
defineProps<{
	items: {
		body: string[];
		label: string;
	}[];
	summary: string;
	title?: string;
}>();
</script>

<template>
	<NuxtLink to="/about#methodology" class="text-sm text-app-accent font-semibold underline underline-offset-3 focus-ring">
		Editorial standards
	</NuxtLink>
</template>
