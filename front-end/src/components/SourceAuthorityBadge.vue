<script setup lang="ts">
import type { SourceAuthority } from "~/types/civic";

const props = defineProps<{
	authority: SourceAuthority;
}>();

const config = computed(() => {
	switch (props.authority) {
		case "official-government":
			return {
				label: "Official source",
				tone: "accent" as const
			};
		case "candidate-campaign":
			return {
				label: "Candidate-supplied",
				tone: "warning" as const
			};
		case "ballot-clarity-archive":
			return {
				label: "Project archive",
				tone: "warning" as const
			};
		case "commercial-provider":
			return {
				label: "Provider option",
				tone: "neutral" as const
			};
		case "open-data":
			return {
				label: "Open data",
				tone: "neutral" as const
			};
		default:
			return {
				label: "Nonprofit provider",
				tone: "neutral" as const
			};
	}
});
</script>

<template>
	<VerificationBadge :label="config.label" :tone="config.tone" />
</template>
