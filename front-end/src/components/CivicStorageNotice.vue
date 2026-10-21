<script setup lang="ts">
const civicStore = useCivicStore();
</script>

<template>
	<div v-if="civicStore.storageUnavailable" class="app-shell mb-6 print-hidden" role="status">
		<InfoCallout title="Changes will last only while this page is open" tone="info">
			Your browser can’t save your location or ballot plan, so changes are lost when you reload.
		</InfoCallout>
	</div>
</template>
