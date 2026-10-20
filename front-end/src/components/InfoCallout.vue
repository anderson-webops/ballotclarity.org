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
		return "border-[#d3b26c] bg-[#fcf4e4] text-[#7b5312] dark:border-[#7b5312] dark:bg-[#2c2110] dark:text-[#f1cd86]";

	return "border-app-accent/20 bg-[#eef5f7] text-app-ink dark:border-app-accent/30 dark:bg-[#102432] dark:text-app-text-dark";
});
</script>

<template>
	<aside class="p-4 border border-l-4 rounded-lg sm:p-5" :class="toneClass">
		<p v-if="title" class="text-sm font-semibold">
			{{ title }}
		</p>
		<div class="text-sm leading-6 mt-2">
			<slot />
		</div>
	</aside>
</template>
