<script setup lang="ts">
import type { ElectionSummary } from "~/types/civic";

defineProps<{ election?: ElectionSummary | null }>();
const route = useRoute();
const isOpen = ref(route.hash === "#change-location");
const panel = ref<HTMLDetailsElement | null>(null);
const lookupForm = ref<{ focusInput: () => void } | null>(null);

async function openFromHash() {
	if (route.hash !== "#change-location")
		return;
	isOpen.value = true;
	await nextTick();
	panel.value?.scrollIntoView({ block: "start" });
	lookupForm.value?.focusInput();
}

watch(() => route.hash, openFromHash);
onMounted(openFromHash);
</script>

<template>
	<details id="change-location" ref="panel" class="location-change-panel surface-row print-hidden" :open="isOpen" @toggle="isOpen = ($event.target as HTMLDetailsElement).open">
		<summary class="text-sm text-app-ink font-semibold cursor-pointer dark:text-app-text-dark focus-ring">
			Change location
		</summary>
		<div class="mt-4 max-w-3xl">
			<AddressLookupForm ref="lookupForm" compact :election="election" :framed="false" />
		</div>
	</details>
</template>
