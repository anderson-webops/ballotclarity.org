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
			return "text-app-accent";
		case "warning":
			return "text-[#8a5b0a] dark:text-[#efc77b]";
		default:
			return "text-app-muted dark:text-app-muted-dark";
	}
});
</script>

<template>
	<span class="text-[0.8rem] leading-5 font-semibold inline-flex gap-1 items-center" :class="toneClass" :title="props.title">
		<span v-if="props.tone === 'warning'" class="i-carbon-warning-alt text-[0.85em]" aria-hidden="true" />
		{{ props.label }}
	</span>
</template>
