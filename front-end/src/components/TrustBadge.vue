<script setup lang="ts">
import { computed } from "vue";
import VerificationBadge from "~/components/VerificationBadge.vue";

const props = withDefaults(defineProps<{
	label: string;
	tone?: "accent" | "neutral" | "warning";
}>(), {
	tone: "neutral",
});

const toneClass = computed(() => {
	return props.tone;
});
</script>

<template>
	<VerificationBadge :label="label" :tone="toneClass" />
</template>
