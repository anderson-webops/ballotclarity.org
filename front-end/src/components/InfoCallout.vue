<script setup lang="ts">
const props = withDefaults(defineProps<{
	title?: string;
	tone?: "info" | "success" | "warning";
}>(), {
	tone: "info",
});

const toneClass = computed(() => {
	if (props.tone === "success")
		return "callout--success";

	if (props.tone === "warning")
		return "border-[#d3b26c] text-[#6b4710] dark:border-[#7b5312] dark:text-[#f1cd86]";

	return "border-app-accent/40 text-app-ink dark:text-app-text-dark";
});
</script>

<template>
	<aside class="py-1 pl-4 border-l-3" :class="toneClass">
		<p v-if="title" class="text-sm font-semibold">
			{{ title }}
		</p>
		<div class="text-sm leading-6" :class="title ? 'mt-1' : ''">
			<slot />
		</div>
	</aside>
</template>
