<script setup lang="ts">
const props = withDefaults(defineProps<{
	label: string;
	tone?: "accent" | "neutral" | "warning";
}>(), {
	tone: "neutral",
});

const toneClass = computed(() => {
	if (props.tone === "accent")
		return "border-app-accent/25 bg-app-accent/10 text-app-accent dark:border-app-accent/30 dark:bg-app-accent/15 dark:text-[#9ed4e3]";

	if (props.tone === "warning")
		return "border-[#b7791f]/20 bg-[#f8edd8] text-[#8a5b0a] dark:border-[#b7791f]/25 dark:bg-[#3b2a0f] dark:text-[#efc77b]";

	return "border-app-line bg-white text-app-muted dark:border-app-line-dark dark:bg-app-panel-dark dark:text-app-muted-dark";
});
</script>

<template>
	<span class="text-xs font-semibold px-3 py-1.5 border rounded-full inline-flex gap-2 items-center" :class="toneClass">
		<span class="rounded-full bg-current h-1.5 w-1.5" />
		{{ label }}
	</span>
</template>
