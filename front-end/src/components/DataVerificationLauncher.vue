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
		class="text-sm text-app-ink rounded-sm transition dark:text-app-text-dark hover:text-app-accent focus-ring"
		@click="openDrawer"
	>
		<span>Data verification</span>
	</button>
</template>
