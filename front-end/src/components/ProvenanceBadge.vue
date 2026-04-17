<script setup lang="ts">
import type { ComparisonProvenance } from "~/types/civic";

const props = defineProps<{
	provenance: ComparisonProvenance;
}>();

const toneClass = computed(() => {
	if (props.provenance.status === "verified-official")
		return "accent" as const;

	if (props.provenance.status === "candidate-submitted" || props.provenance.status === "candidate-quoted")
		return "neutral" as const;

	return "warning" as const;
});
</script>

<template>
	<VerificationBadge :label="provenance.label" :title="provenance.detail" :tone="toneClass" />
</template>
