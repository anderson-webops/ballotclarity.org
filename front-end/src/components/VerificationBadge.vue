<script setup lang="ts">
const props = withDefaults(defineProps<{
	label: string;
	title?: string;
	tone?: "accent" | "neutral" | "warning";
}>(), {
	title: undefined,
	tone: "neutral",
});

const toneClass = computed(() => {
	switch (props.tone) {
		case "accent":
			return "border-app-accent/22 bg-app-accent/8 text-app-accent dark:border-app-accent/28 dark:bg-app-accent/12 dark:text-[#9ed4e3]";
		case "warning":
			return "border-[#b7791f]/18 bg-[#f8edd8]/85 text-[#8a5b0a] dark:border-[#b7791f]/24 dark:bg-[#3b2a0f]/88 dark:text-[#efc77b]";
		default:
			return "border-app-line bg-app-panel text-app-muted dark:border-app-line-dark dark:bg-app-panel-dark dark:text-app-muted-dark";
	}
});
</script>

<template>
	<span class="text-xs leading-5 font-semibold px-2 py-0.5 border rounded-md inline-flex gap-1.5 items-center" :class="toneClass" :title="props.title">
		<span v-if="props.tone === 'warning'" class="i-carbon-warning-alt text-[0.85em]" aria-hidden="true" />
		{{ props.label }}
	</span>
</template>
