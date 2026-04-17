<script setup lang="ts">
import type { ElectionSummary, LocationLookupAction, LocationLookupResponse } from "~/types/civic";

const props = defineProps<{
	compact?: boolean;
	election?: ElectionSummary | null;
	framed?: boolean;
}>();

const api = useApiClient();
const civicStore = useCivicStore();

const query = ref("");
const isPending = ref(false);
const errorMessage = ref("");
const lookupActions = ref<LocationLookupAction[]>([]);
const lookupNote = ref("");
const resolvedElectionSlug = ref("");
const resolvedLocation = ref<LocationLookupResponse["location"] | null>(null);
const inputId = `address-lookup-${useId()}`;
const descriptionId = `${inputId}-description`;
const usageId = `${inputId}-usage`;
const privacyId = `${inputId}-privacy`;
const errorId = `${inputId}-error`;
const actionsId = `${inputId}-actions`;
const lookupInput = ref<HTMLInputElement | null>(null);

const inputDescribedBy = computed(() => [descriptionId, usageId, privacyId, lookupActions.value.length ? actionsId : "", errorMessage.value ? errorId : ""].filter(Boolean).join(" "));

watch(query, () => {
	if (lookupActions.value.length) {
		lookupActions.value = [];
		lookupNote.value = "";
	}

	if (resolvedLocation.value) {
		resolvedLocation.value = null;
		resolvedElectionSlug.value = "";
	}
});

async function openLookupAction(action: LocationLookupAction) {
	if (action.kind !== "ballot-guide" || !action.location || !action.electionSlug)
		return;

	civicStore.setLocation(action.location);

	if (props.election)
		civicStore.setElection(props.election);

	await navigateTo(`/ballot/${action.electionSlug}?location=${action.location.slug}`);
}

async function continueToResolvedGuide() {
	if (!resolvedLocation.value || !resolvedElectionSlug.value)
		return;

	civicStore.setLocation(resolvedLocation.value);

	if (props.election)
		civicStore.setElection(props.election);

	await navigateTo(`/ballot/${props.election?.slug ?? resolvedElectionSlug.value}?location=${resolvedLocation.value.slug}`);
}

async function handleSubmit() {
	errorMessage.value = "";
	lookupActions.value = [];
	lookupNote.value = "";
	resolvedElectionSlug.value = "";
	resolvedLocation.value = null;

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

		lookupNote.value = response.note;

		if (response.result === "selection-required") {
			lookupActions.value = response.actions ?? [];
			return;
		}

		if (!response.location || !response.electionSlug) {
			errorMessage.value = "Unable to load the ballot guide right now.";
			return;
		}

		if (response.actions?.length) {
			lookupActions.value = response.actions;
			resolvedElectionSlug.value = response.electionSlug;
			resolvedLocation.value = response.location;
			return;
		}

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
	<form :class="[props.framed === false ? '' : 'surface-panel', compact ? 'p-5' : 'p-6 sm:p-7']" :aria-busy="isPending" @submit.prevent="handleSubmit">
		<label :for="inputId" class="text-sm text-app-ink font-semibold block dark:text-app-text-dark">
			Choose a location with a full street address or 5-digit ZIP code
		</label>
		<p :id="descriptionId" class="text-sm text-app-muted mt-2 dark:text-app-muted-dark">
			Ballot Clarity does not auto-detect your district from IP. The guide changes only when you choose a location here.
		</p>
		<p :id="usageId" class="text-sm text-app-muted leading-6 mt-3 dark:text-app-muted-dark">
			Current public coverage still returns the reference ballot guide while live Fulton County, Georgia district and ballot integrations are being connected. Why we ask for your address: a full address is the only input that can support exact district and ballot matching. A ZIP code is useful for previewing the right coverage area, but ZIP-only results should be treated as approximate.
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
					placeholder="Example: 5600 Campbellton Fairburn Rd or 30303"
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

		<div
			v-if="lookupActions.length"
			:id="actionsId"
			class="mt-5 p-4 border border-app-line rounded-3xl bg-app-bg dark:border-app-line-dark dark:bg-app-bg-dark/60"
		>
			<p class="text-xs text-app-muted tracking-[0.2em] font-semibold uppercase dark:text-app-muted-dark">
				Choose how to continue
			</p>
			<p class="text-sm text-app-muted leading-6 mt-3 dark:text-app-muted-dark">
				{{ lookupNote }}
			</p>
			<p
				v-if="resolvedLocation"
				class="text-xs text-app-muted leading-6 mt-3 dark:text-app-muted-dark"
			>
				The configured official provider returned these links for your address. Review them, then continue into the guide.
			</p>
			<div class="mt-4 gap-3 grid">
				<div
					v-for="action in lookupActions"
					:key="action.id"
					class="p-4 border border-app-line rounded-2xl bg-white dark:border-app-line-dark dark:bg-app-panel-dark"
				>
					<div class="flex flex-wrap gap-2 items-center">
						<p class="text-sm text-app-ink font-semibold dark:text-app-text-dark">
							{{ action.title }}
						</p>
						<span
							v-if="action.badge"
							class="text-[11px] text-app-muted tracking-[0.16em] font-semibold px-2 py-1 border border-app-line rounded-full uppercase dark:text-app-muted-dark dark:border-app-line-dark"
						>
							{{ action.badge }}
						</span>
					</div>
					<p class="text-sm text-app-muted leading-6 mt-2 dark:text-app-muted-dark">
						{{ action.description }}
					</p>
					<div class="mt-4 flex flex-wrap gap-3">
						<button
							v-if="action.kind === 'ballot-guide'"
							type="button"
							class="btn-primary"
							@click="openLookupAction(action)"
						>
							<span class="i-carbon-arrow-right" />
							Open guide
						</button>
						<a
							v-else-if="action.url"
							:href="action.url"
							target="_blank"
							rel="noreferrer"
							class="btn-secondary"
						>
							<span class="i-carbon-launch" />
							Open official tool
						</a>
					</div>
				</div>
			</div>
			<div v-if="resolvedLocation" class="mt-4 flex flex-wrap gap-3">
				<button
					type="button"
					class="btn-primary"
					@click="continueToResolvedGuide"
				>
					<span class="i-carbon-arrow-right" />
					Continue to ballot guide
				</button>
			</div>
			<p class="text-xs text-app-muted leading-6 mt-4 dark:text-app-muted-dark">
				{{ resolvedLocation ? "Ballot Clarity still opens the current guide surface after official verification because exact contest packaging is still being connected." : "If you want the most specific district match, replace the ZIP code with a full street address before continuing." }}
			</p>
		</div>
	</form>
</template>
