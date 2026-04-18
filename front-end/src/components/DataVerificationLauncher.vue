<script setup lang="ts">
import { defineAsyncComponent } from "vue";

const hasLoadedDrawer = ref(false);
const DeferredDataVerificationDrawer = defineAsyncComponent(() => import("~/components/DataVerificationDrawer.vue"));

function openDrawer() {
	hasLoadedDrawer.value = true;
}
</script>

<template>
	<DeferredDataVerificationDrawer v-if="hasLoadedDrawer" open-on-mount />
	<button
		v-else
		type="button"
		class="text-sm text-app-ink font-semibold rounded-md inline-flex gap-2 transition items-center dark:text-app-text-dark hover:text-app-accent focus-ring dark:hover:text-white"
		@click="openDrawer"
	>
		<span>Data verification</span>
		<span class="i-carbon-arrow-up-right" aria-hidden="true" />
	</button>
</template>
