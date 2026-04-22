<script setup lang="ts">
import type {
	ElectionSummary,
	LocationLookupAction,
	LocationLookupResponse,
	LocationLookupSelectionOption,
	NationwideLookupResultContext
} from "~/types/civic";
import { buildLocationGuessUiContent } from "~/utils/location-guess";
import { buildPublishedGuideDestination } from "~/utils/location-lookup";
import { normalizeLookupResponseForDisplay, resolveLookupDestination } from "~/utils/nationwide-results";

const props = defineProps<{
	compact?: boolean;
	election?: ElectionSummary | null;
	framed?: boolean;
}>();

const api = useApiClient();
const civicStore = useCivicStore();
const { data: coverageData } = useCoverage();

const query = ref("");
const isPending = ref(false);
const errorMessage = ref("");
const lookupResult = ref<NationwideLookupResultContext | null>(null);
const inputId = `address-lookup-${useId()}`;
const descriptionId = `${inputId}-description`;
const usageId = `${inputId}-usage`;
const privacyId = `${inputId}-privacy`;
const errorId = `${inputId}-error`;
const actionsId = `${inputId}-actions`;
const lookupInput = ref<HTMLInputElement | null>(null);
const locationGuessUi = computed(() => buildLocationGuessUiContent(coverageData.value?.locationGuess ?? null));
const inputDescribedBy = computed(() => [descriptionId, usageId, privacyId, lookupResult.value ? actionsId : "", errorMessage.value ? errorId : ""].filter(Boolean).join(" "));

watch(query, () => {
	if (lookupResult.value)
		lookupResult.value = null;
});

async function openLookupAction(action: LocationLookupAction) {
	if (action.kind !== "ballot-guide" || !action.location || !action.electionSlug)
		return;

	const destination = buildPublishedGuideDestination({
		electionSlug: action.electionSlug,
		guideAvailability: lookupResult.value?.guideAvailability,
		guideContent: lookupResult.value?.guideContent,
		location: action.location,
		selectionOptions: []
	});

	if (!destination)
		return;

	await navigateTo(destination);
}

async function applyLookup(queryValue: string, selectionId?: string) {
	errorMessage.value = "";
	lookupResult.value = null;

	if (!queryValue.trim()) {
		errorMessage.value = "Enter an address or ZIP code to load civic results.";
		await nextTick();
		lookupInput.value?.focus();
		return;
	}

	isPending.value = true;

	try {
		const response = await api<LocationLookupResponse>("/location", {
			body: {
				q: queryValue,
				...(selectionId ? { selectionId } : {})
			},
			method: "POST"
		});
		civicStore.setLookupResponse(response, props.election ?? null);
		lookupResult.value = normalizeLookupResponseForDisplay(response, props.election ?? null);

		const redirectTarget = resolveLookupDestination(response);

		if (redirectTarget)
			await navigateTo(redirectTarget);
		else if (selectionId && response.location && response.electionSlug)
			await navigateTo(buildPublishedGuideDestination(response) ?? `/elections/${response.electionSlug}`);
	}
	catch (error) {
		errorMessage.value = error instanceof Error ? error.message : "Unable to load civic results right now.";
	}
	finally {
		isPending.value = false;
	}
}

async function handleSubmit() {
	await applyLookup(query.value);
}

async function selectLookupOption(option: LocationLookupSelectionOption) {
	await applyLookup(lookupResult.value?.lookupQuery || query.value, option.id);
}
</script>

<template>
	<form :class="[props.framed === false ? '' : 'surface-panel', compact ? 'p-5' : 'p-6 sm:p-7']" :aria-busy="isPending" @submit.prevent="handleSubmit">
		<label :for="inputId" class="text-sm text-app-ink font-semibold block dark:text-app-text-dark">
			Choose a location with a full street address or 5-digit ZIP code
		</label>
		<p :id="descriptionId" class="text-sm text-app-muted mt-2 dark:text-app-muted-dark">
			{{ locationGuessUi.lookupForm }}
		</p>
		<p :id="usageId" class="text-sm text-app-muted leading-6 mt-3 dark:text-app-muted-dark">
			Ballot Clarity can match many U.S. addresses and ZIP codes to districts, current officials, and official election links. A full street address is the strongest input. A ZIP code can be broader and may ask you to choose between more than one matched area.
		</p>
		<p :id="privacyId" class="text-sm text-app-muted leading-6 mt-3 dark:text-app-muted-dark">
			Data use: your lookup is sent only to match ballot coverage. The raw lookup is not added to the public content archive or used for advertising, and the app saves only your selected location label and ballot-plan preferences locally in your browser. Read the
			<NuxtLink to="/privacy" class="underline underline-offset-3" prefetch-on="interaction">
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
					placeholder="Example: 5600 Campbellton Fairburn Rd or 30303"
					class="text-sm text-app-ink pl-11 pr-4 border border-app-line rounded-full bg-white h-13 w-full shadow-sm dark:text-app-text-dark placeholder:text-app-muted/80 dark:border-app-line-dark dark:bg-app-panel-dark focus-ring dark:placeholder:text-app-muted-dark"
					:aria-invalid="Boolean(errorMessage)"
					:aria-describedby="inputDescribedBy"
				>
			</div>
			<button type="submit" class="btn-primary min-w-40" :disabled="isPending">
				<span :class="isPending ? 'i-carbon-circle-dash animate-spin' : 'i-carbon-arrow-right'" />
				{{ isPending ? 'Loading results' : 'See civic results' }}
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

		<LookupResultsPanel
			v-if="lookupResult"
			:id="actionsId"
			:compact="compact"
			:lookup="lookupResult"
			@open-guide="openLookupAction"
			@select-option="selectLookupOption"
		/>
	</form>
</template>
