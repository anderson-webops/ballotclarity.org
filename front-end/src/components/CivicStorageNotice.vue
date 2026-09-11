<script setup lang="ts">
const civicStore = useCivicStore();
</script>

<template>
	<div v-if="civicStore.storageUnavailable" class="app-shell mb-6 print-hidden" role="status">
		<InfoCallout title="Changes will last only while this page is open" tone="info">
			Your browser could not save your location or ballot-plan preferences. You can keep using the site, but changes may be lost when you reload or close this page. Print your ballot plan if you need to keep a copy.
		</InfoCallout>
	</div>
</template>
