<script setup lang="ts">
const props = withDefaults(defineProps<{
	variant?: "icon" | "text";
}>(), {
	variant: "icon"
});

const colorMode = useColorMode();
const isDark = computed(() => colorMode.value === "dark");
const themeToggleAriaLabel = computed(() => isDark.value ? "Switch to light mode" : "Switch to dark mode");
const themeToggleIcon = computed(() => isDark.value ? "i-carbon-sun" : "i-carbon-moon");
const themeToggleText = computed(() => isDark.value ? "Light mode" : "Dark mode");

function toggleColorMode() {
	colorMode.preference = isDark.value ? "light" : "dark";
}
</script>

<template>
	<button
		type="button"
		:class="props.variant === 'icon'
			? 'text-app-ink border border-app-line rounded-full bg-white inline-flex h-10 w-10 shadow-sm transition items-center justify-center dark:text-app-text-dark hover:text-app-accent dark:border-app-line-dark hover:border-app-accent dark:bg-app-panel-dark focus-ring'
			: 'text-xs font-semibold px-3 py-2 border border-app-line rounded-full shrink-0 dark:border-app-line-dark focus-ring'"
		:aria-label="themeToggleAriaLabel"
		@click="toggleColorMode"
	>
		<span v-if="props.variant === 'icon'" :class="themeToggleIcon" class="text-lg" />
		<span v-else>{{ themeToggleText }}</span>
	</button>
</template>
