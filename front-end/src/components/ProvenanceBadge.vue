<script setup lang="ts">
import type { ComparisonProvenance } from "~/types/civic";

const props = defineProps<{
	provenance: ComparisonProvenance;
}>();

const toneClass = computed(() => {
	if (props.provenance.status === "verified-official")
		return "border-app-accent/25 bg-app-accent/10 text-app-accent dark:border-app-accent/35 dark:bg-app-accent/15 dark:text-[#9ed4e3]";

	if (props.provenance.status === "candidate-submitted")
		return "border-[#7f9077]/25 bg-[#eef4ea] text-[#42503c] dark:border-[#7f9077]/35 dark:bg-[#1c2619] dark:text-[#c9d5c4]";

	if (props.provenance.status === "candidate-quoted")
		return "border-[#9b7f5f]/25 bg-[#f7efe6] text-[#6f573d] dark:border-[#9b7f5f]/35 dark:bg-[#2c2116] dark:text-[#e7cfb4]";

	return "border-[#caa56f]/25 bg-[#fbf3e2] text-[#7d5819] dark:border-[#caa56f]/35 dark:bg-[#302412] dark:text-[#efcf96]";
});
</script>

<template>
	<span class="text-[11px] font-semibold px-2.5 py-1 border rounded-full inline-flex items-center" :class="toneClass" :title="provenance.detail">
		{{ provenance.label }}
	</span>
</template>
