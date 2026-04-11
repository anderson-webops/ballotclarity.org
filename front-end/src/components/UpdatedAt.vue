<script setup lang="ts">
const props = withDefaults(defineProps<{
	label?: string;
	value: string;
}>(), {
	label: "Updated",
});

const { formatDateTime } = useFormatters();
</script>

<template>
	<p class="text-xs text-app-muted inline-flex gap-2 items-center dark:text-app-muted-dark">
		<span class="i-carbon-time" />
		{{ props.label }} {{ formatDateTime(props.value) }}
	</p>
</template>
