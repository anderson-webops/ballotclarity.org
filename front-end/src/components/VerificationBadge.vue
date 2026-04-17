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
			return "border-app-line/90 bg-white/85 text-app-muted dark:border-app-line-dark dark:bg-app-panel-dark/85 dark:text-app-muted-dark";
	}
});
</script>

<template>
	<span class="text-[11px] font-semibold px-2.5 py-1 border rounded-full inline-flex gap-1.5 items-center" :class="toneClass" :title="props.title">
		<span class="rounded-full bg-current h-1.5 w-1.5" />
		{{ props.label }}
	</span>
</template>
