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
const inputId = `address-lookup-${useId()}`;
const descriptionId = `${inputId}-description`;
const usageId = `${inputId}-usage`;
const privacyId = `${inputId}-privacy`;
const errorId = `${inputId}-error`;
const lookupInput = ref<HTMLInputElement | null>(null);

const inputDescribedBy = computed(() => [descriptionId, usageId, privacyId, errorMessage.value ? errorId : ""].filter(Boolean).join(" "));

async function handleSubmit() {
	errorMessage.value = "";

	if (!query.value.trim()) {
		errorMessage.value = "Enter an address or ZIP code to load the ballot guide.";
		await nextTick();
		lookupInput.value?.focus();
		return;
	}

	isPending.value = true;

	try {
		const response = await api<LocationLookupResponse>("/location", {
			body: { q: query.value },
			method: "POST"
		});

		civicStore.setLocation(response.location);

		if (props.election)
			civicStore.setElection(props.election);

		await navigateTo(`/ballot/${props.election?.slug ?? response.electionSlug}?location=${response.location.slug}`);
	}
	catch (error) {
		errorMessage.value = error instanceof Error ? error.message : "Unable to load the ballot guide right now.";
	}
	finally {
		isPending.value = false;
	}
}
</script>

<template>
	<form class="surface-panel" :class="compact ? 'p-5' : 'p-6 sm:p-7'" :aria-busy="isPending" @submit.prevent="handleSubmit">
		<label :for="inputId" class="text-sm text-app-ink font-semibold block dark:text-app-text-dark">
			Enter a street address or ZIP code
		</label>
		<p :id="descriptionId" class="text-sm text-app-muted mt-2 dark:text-app-muted-dark">
			Current public coverage accepts any U.S. address or ZIP and returns staged Metro County ballot coverage while live district integrations are being connected.
		</p>
		<p :id="usageId" class="text-sm text-app-muted leading-6 mt-3 dark:text-app-muted-dark">
			Why we ask for your address: it helps determine districts and ballot style. A ZIP code can return partial results with less specific contest matching.
		</p>
		<p :id="privacyId" class="text-sm text-app-muted leading-6 mt-3 dark:text-app-muted-dark">
			Data use: your lookup is sent only to match ballot coverage. The raw lookup is not added to the public content archive or used for advertising, and the app saves only your selected location label and ballot-plan preferences locally in your browser. Read the
			<NuxtLink to="/privacy" class="underline underline-offset-3">
				privacy notice
			</NuxtLink>.
		</p>

		<div class="mt-5 flex flex-col gap-3 sm:flex-row">
			<div class="flex-1 relative">
				<span class="i-carbon-search text-app-muted pointer-events-none left-4 top-1/2 absolute dark:text-app-muted-dark -translate-y-1/2" />
				<input
					:id="inputId"
					ref="lookupInput"
					v-model="query"
					type="text"
					autocomplete="street-address"
					placeholder="Example: 100 Main Street or 10001"
					class="text-sm text-app-ink pl-11 pr-4 border border-app-line rounded-full bg-white h-13 w-full shadow-sm dark:text-app-text-dark placeholder:text-app-muted/80 dark:border-app-line-dark dark:bg-app-panel-dark focus-ring dark:placeholder:text-app-muted-dark"
					:aria-invalid="Boolean(errorMessage)"
					:aria-describedby="inputDescribedBy"
				>
			</div>
			<button type="submit" class="btn-primary min-w-40" :disabled="isPending">
				<span :class="isPending ? 'i-carbon-circle-dash animate-spin' : 'i-carbon-arrow-right'" />
				{{ isPending ? 'Loading ballot' : 'Open ballot guide' }}
			</button>
		</div>

		<p
			v-if="errorMessage"
			:id="errorId"
			role="alert"
			class="text-sm text-[#8f341f] mt-3 dark:text-[#f2a493]"
		>
			{{ errorMessage }}
		</p>
	</form>
</template>
