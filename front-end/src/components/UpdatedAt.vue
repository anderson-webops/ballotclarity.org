<script setup lang="ts">
defineOptions({ inheritAttrs: false });
const props = withDefaults(defineProps<{
	footer?: boolean;
	label?: string;
	value: string;
}>(), {
	footer: false,
	label: "Updated",
});

const { formatDateTime } = useFormatters();
const mounted = useMounted();
</script>

<template>
	<Teleport v-if="footer && mounted" to="#page-data-updated">
		<p class="text-xs text-app-muted mt-2 text-right dark:text-app-muted-dark">
			{{ label }} <time :datetime="value">{{ formatDateTime(value) }}</time>
		</p>
	</Teleport>
	<p v-else-if="!footer" v-bind="$attrs" class="text-xs text-app-muted inline-flex gap-2 items-center dark:text-app-muted-dark">
		<span class="i-carbon-time" />
		{{ props.label }} {{ formatDateTime(props.value) }}
	</p>
</template>
