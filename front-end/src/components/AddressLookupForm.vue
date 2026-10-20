<script setup lang="ts">
import type {
	ElectionSummary,
	LocationLookupAction,
	LocationLookupResponse,
	LocationLookupSelectionOption,
	NationwideLookupResultContext
} from "~/types/civic";
import { buildPublishedGuideDestination } from "~/utils/location-lookup";
import { normalizeLookupResponseForDisplay, resolveLookupDestination } from "~/utils/nationwide-results";

const props = defineProps<{
	compact?: boolean;
	election?: ElectionSummary | null;
	framed?: boolean;
	showInlineResults?: boolean;
}>();

const emit = defineEmits<{
	lookupCleared: [];
	lookupResolved: [lookup: NationwideLookupResultContext];
}>();

const api = useApiClient();
const civicStore = useCivicStore();

const query = ref("");
const isPending = ref(false);
const errorMessage = ref("");
const lookupResult = ref<NationwideLookupResultContext | null>(null);
const inputId = `address-lookup-${useId()}`;
const privacyId = `${inputId}-privacy`;
const errorId = `${inputId}-error`;
const actionsId = `${inputId}-actions`;
const lookupInput = ref<HTMLInputElement | null>(null);
let activeRequest: AbortController | null = null;
const shouldShowInlineResults = computed(() => props.showInlineResults !== false);
const inputDescribedBy = computed(() => [
	privacyId,
	lookupResult.value && shouldShowInlineResults.value ? actionsId : "",
	errorMessage.value ? errorId : ""
].filter(Boolean).join(" "));

watch(query, () => {
	cancelLookup();
	errorMessage.value = "";
	if (lookupResult.value) {
		lookupResult.value = null;
		emit("lookupCleared");
	}
}, { flush: "sync" });

function cancelLookup() {
	activeRequest?.abort();
	activeRequest = null;
	isPending.value = false;
}

onBeforeUnmount(cancelLookup);

defineExpose({ focusInput: () => lookupInput.value?.focus({ preventScroll: true }) });

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
	cancelLookup();
	errorMessage.value = "";
	lookupResult.value = null;

	if (!queryValue.trim()) {
		errorMessage.value = "Enter an address or ZIP code to load civic results.";
		await nextTick();
		lookupInput.value?.focus();
		return;
	}

	isPending.value = true;
	civicStore.beginManualLookup();
	const request = new AbortController();
	activeRequest = request;

	try {
		const response = await api<LocationLookupResponse>("/location", {
			body: {
				q: queryValue,
				...(selectionId ? { selectionId } : {})
			},
			method: "POST",
			signal: request.signal
		});
		if (activeRequest !== request || request.signal.aborted)
			return;
		civicStore.setLookupResponse(response, props.election ?? null);
		const normalizedResult = normalizeLookupResponseForDisplay(response, props.election ?? null);
		lookupResult.value = normalizedResult;
		emit("lookupResolved", normalizedResult);

		const redirectTarget = resolveLookupDestination(response);

		if (redirectTarget)
			await navigateTo(redirectTarget);
		else if (selectionId && response.location && response.electionSlug)
			await navigateTo(buildPublishedGuideDestination(response) ?? `/elections/${response.electionSlug}`);
	}
	catch {
		if (activeRequest === request && !request.signal.aborted)
			errorMessage.value = "We could not load civic results. Check your connection and try again in a moment.";
	}
	finally {
		if (activeRequest === request) {
			activeRequest = null;
			isPending.value = false;
		}
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
	<form class="lookup-form" :class="props.framed === false ? '' : 'surface-panel'" :aria-busy="isPending" @submit.prevent="handleSubmit">
		<label :for="inputId" class="text-sm text-app-ink font-semibold block dark:text-app-text-dark">
			Street address or ZIP code
		</label>

		<div class="lookup-form__fields mt-2">
			<div class="min-w-0 relative">
				<span class="i-carbon-search text-app-muted pointer-events-none left-4 top-1/2 absolute dark:text-app-muted-dark -translate-y-1/2" />
				<input
					:id="inputId"
					ref="lookupInput"
					v-model="query"
					type="text"
					autocomplete="street-address"
					placeholder="Street, city, state, ZIP"
					enterkeyhint="search"
					:spellcheck="false"
					class="text-base text-app-ink pl-11 pr-4 border border-app-line rounded-full bg-white h-13 w-full shadow-sm dark:text-app-text-dark placeholder:text-app-muted/80 dark:border-app-line-dark dark:bg-app-panel-dark focus-ring dark:placeholder:text-app-muted-dark"
					:aria-invalid="Boolean(errorMessage)"
					:aria-describedby="inputDescribedBy"
				>
			</div>
			<button type="submit" class="lookup-submit-button btn-primary" :disabled="isPending">
				<span class="lookup-submit-button__icon" aria-hidden="true">
					<span :class="isPending ? 'i-carbon-circle-dash animate-spin' : 'i-carbon-arrow-right'" />
				</span>
				<span class="lookup-submit-button__label">
					{{ isPending ? 'Looking up…' : 'Look up' }}
				</span>
			</button>
		</div>
		<p v-if="compact" :id="privacyId" class="text-xs text-app-muted leading-6 mt-3 dark:text-app-muted-dark">
			Lookup data is used only to load civic results. If you enter only a 5-digit ZIP code, that ZIP may be counted in a ZIP-only operations log; street addresses and ZIP+4 entries are not added to that log.
			<NuxtLink to="/privacy" class="underline underline-offset-3" prefetch-on="interaction">
				Privacy notice
			</NuxtLink>.
		</p>
		<p v-else :id="privacyId" class="text-sm text-app-muted leading-6 mt-3 dark:text-app-muted-dark">
			Data use: your lookup is sent only to match ballot coverage. If you enter only a 5-digit ZIP code, that ZIP may be counted in a ZIP-only operations log, but raw lookup text, full street addresses, ZIP+4 entries, IP address, and user agent are not added to that log. The raw lookup is not added to public content records or used for advertising, and the app saves only your selected location label and ballot-plan preferences locally in your browser. Read the
			<NuxtLink to="/privacy" class="underline underline-offset-3" prefetch-on="interaction">
				privacy notice
			</NuxtLink>.
		</p>

		<p
			v-if="errorMessage"
			:id="errorId"
			role="alert"
			class="text-sm text-[#8f341f] mt-3 dark:text-[#f2a493]"
		>
			{{ errorMessage }}
		</p>

		<LookupResultsPanel
			v-if="lookupResult && shouldShowInlineResults"
			:id="actionsId"
			:compact="compact"
			:lookup="lookupResult"
			@open-guide="openLookupAction"
			@select-option="selectLookupOption"
		/>
	</form>
</template>
