<script setup lang="ts">
import type { ElectionSummary, LocationLookupResponse } from "~/types/civic";

const props = defineProps<{
	compact?: boolean;
	election?: ElectionSummary | null;
}>();

const api = useApiClient();
const civicStore = useCivicStore();

const query = ref("");
const isPending = ref(false);
const errorMessage = ref("");

async function handleSubmit() {
	errorMessage.value = "";

	if (!query.value.trim()) {
		errorMessage.value = "Enter an address or ZIP code to load the demo ballot.";
		return;
	}

	isPending.value = true;

	try {
		const response = await api<LocationLookupResponse>("/location", {
			query: { q: query.value }
		});

		civicStore.setLocation(response.location);

		if (props.election)
			civicStore.setElection(props.election);

		await navigateTo(`/ballot/${props.election?.slug ?? response.electionSlug}?location=${response.location.slug}`);
	}
	catch (error) {
		errorMessage.value = error instanceof Error ? error.message : "Unable to load the demo ballot right now.";
	}
	finally {
		isPending.value = false;
	}
}
</script>

<template>
	<form class="surface-panel" :class="compact ? 'p-5' : 'p-6 sm:p-7'" @submit.prevent="handleSubmit">
		<label for="address-lookup" class="text-sm text-app-ink font-semibold block dark:text-app-text-dark">
			Enter a street address or ZIP code
		</label>
		<p class="text-sm text-app-muted mt-2 dark:text-app-muted-dark">
			Demo mode accepts any U.S. address or ZIP and returns a sample Metro County ballot.
		</p>

		<div class="mt-5 flex flex-col gap-3 sm:flex-row">
			<div class="flex-1 relative">
				<span class="i-carbon-search text-app-muted pointer-events-none left-4 top-1/2 absolute dark:text-app-muted-dark -translate-y-1/2" />
				<input
					id="address-lookup"
					v-model="query"
					type="text"
					autocomplete="street-address"
					placeholder="Example: 100 Main Street or 10001"
					class="text-sm text-app-ink pl-11 pr-4 border border-app-line rounded-full bg-white h-13 w-full shadow-sm dark:text-app-text-dark placeholder:text-app-muted/80 dark:border-app-line-dark dark:bg-app-panel-dark focus-ring dark:placeholder:text-app-muted-dark"
					:aria-invalid="Boolean(errorMessage)"
				>
			</div>
			<button type="submit" class="btn-primary min-w-40" :disabled="isPending">
				<span :class="isPending ? 'i-carbon-circle-dash animate-spin' : 'i-carbon-arrow-right'" />
				{{ isPending ? 'Loading ballot' : 'See demo ballot' }}
			</button>
		</div>

		<p v-if="errorMessage" class="text-sm text-[#8f341f] mt-3 dark:text-[#f2a493]">
			{{ errorMessage }}
		</p>
	</form>
</template>
