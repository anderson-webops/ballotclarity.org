<script setup lang="ts">
import type {
	ElectionSummary,
	LocationDataAvailabilitySummary,
	LocationDistrictMatch,
	LocationLookupAction,
	LocationLookupResponse,
	LocationRepresentativeMatch
} from "~/types/civic";
import { buildLocationAvailabilityItems, buildLookupProvenanceSummary, buildRepresentativeCards } from "~/utils/graphics-schema";

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
const lookupResult = ref<LocationLookupResponse["result"] | "">("");
const lookupInputKind = ref<LocationLookupResponse["inputKind"] | "">("");
const normalizedAddress = ref("");
const districtMatches = ref<LocationDistrictMatch[]>([]);
const representativeMatches = ref<LocationRepresentativeMatch[]>([]);
const fromCache = ref(false);
const resolvedElectionSlug = ref("");
const resolvedLocation = ref<LocationLookupResponse["location"] | null>(null);
const guideAvailability = ref<LocationLookupResponse["guideAvailability"]>();
const availability = ref<LocationDataAvailabilitySummary | null>(null);
const inputId = `address-lookup-${useId()}`;
const descriptionId = `${inputId}-description`;
const usageId = `${inputId}-usage`;
const privacyId = `${inputId}-privacy`;
const errorId = `${inputId}-error`;
const actionsId = `${inputId}-actions`;
const lookupInput = ref<HTMLInputElement | null>(null);

const inputDescribedBy = computed(() => [descriptionId, usageId, privacyId, lookupActions.value.length ? actionsId : "", errorMessage.value ? errorId : ""].filter(Boolean).join(" "));

watch(query, () => {
	if (lookupActions.value.length || lookupResult.value) {
		lookupActions.value = [];
		lookupNote.value = "";
	}

	lookupResult.value = "";
	lookupInputKind.value = "";
	normalizedAddress.value = "";
	districtMatches.value = [];
	representativeMatches.value = [];
	fromCache.value = false;
	guideAvailability.value = undefined;
	availability.value = null;

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
	lookupResult.value = "";
	lookupInputKind.value = "";
	normalizedAddress.value = "";
	districtMatches.value = [];
	representativeMatches.value = [];
	fromCache.value = false;
	resolvedElectionSlug.value = "";
	resolvedLocation.value = null;
	guideAvailability.value = undefined;
	availability.value = null;

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

		lookupResult.value = response.result;
		lookupInputKind.value = response.inputKind;
		lookupNote.value = response.note;
		normalizedAddress.value = response.normalizedAddress ?? "";
		districtMatches.value = response.districtMatches ?? [];
		representativeMatches.value = response.representativeMatches ?? [];
		fromCache.value = Boolean(response.fromCache);
		guideAvailability.value = response.guideAvailability;
		availability.value = response.availability ?? null;
		resolvedElectionSlug.value = response.electionSlug ?? "";
		resolvedLocation.value = response.location ?? null;
		lookupActions.value = response.actions ?? [];
	}
	catch (error) {
		errorMessage.value = error instanceof Error ? error.message : "Unable to load the ballot guide right now.";
	}
	finally {
		isPending.value = false;
	}
}

const availabilityItems = computed(() => buildLocationAvailabilityItems(availability.value));
const representativeCards = computed(() => buildRepresentativeCards(representativeMatches.value));
const lookupProvenanceSummary = computed(() => buildLookupProvenanceSummary({
	districtMatches: districtMatches.value,
	fromCache: fromCache.value,
	guideAvailability: guideAvailability.value,
	hasOfficialTools: lookupActions.value.some(action => action.kind === "official-verification"),
	inputKind: lookupInputKind.value,
	representativeMatches: representativeMatches.value
}));

const lookupUncertaintyNote = computed(() => {
	if (lookupResult.value === "unsupported")
		return "This input did not resolve cleanly enough to show district or representative results. Try a full street address or use the official tools.";

	if (lookupInputKind.value === "zip")
		return "ZIP-only results are approximate. Use a full street address when district-specific ballot questions matter.";

	return "District and representative matches are provider-backed, but the election office remains the final authority for precinct and ballot-style questions.";
});
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
			Ballot Clarity can already use provider-backed lookup to match many U.S. addresses to districts and representative records. Full published ballot guides are still narrower. A full street address is the only input that can support the best district match, while ZIP-only results should still be treated as approximate.
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

		<div
			v-if="lookupResult"
			:id="actionsId"
			class="mt-5 p-4 border border-app-line rounded-3xl bg-app-bg dark:border-app-line-dark dark:bg-app-bg-dark/60"
		>
			<p class="text-xs text-app-muted tracking-[0.2em] font-semibold uppercase dark:text-app-muted-dark">
				{{ lookupResult === "unsupported"
					? "Location not yet resolved"
					: "Lookup results ready" }}
			</p>
			<p class="text-sm text-app-muted leading-6 mt-3 dark:text-app-muted-dark">
				{{ lookupNote }}
			</p>
			<div v-if="lookupResult === 'resolved'" class="mt-4 flex flex-wrap gap-2">
				<VerificationBadge :label="lookupInputKind === 'address' ? 'Address lookup' : 'ZIP lookup'" :tone="lookupInputKind === 'address' ? 'accent' : 'warning'" />
				<VerificationBadge
					:label="guideAvailability === 'published' ? 'Full local guide available' : 'Nationwide lookup only'"
					:tone="guideAvailability === 'published' ? 'accent' : 'neutral'"
				/>
				<VerificationBadge
					:label="representativeMatches.length ? `${representativeMatches.length} representative match${representativeMatches.length === 1 ? '' : 'es'}` : 'No representative match yet'"
					:tone="representativeMatches.length ? 'accent' : 'neutral'"
				/>
			</div>
			<p
				v-if="resolvedLocation"
				class="text-xs text-app-muted leading-6 mt-3 dark:text-app-muted-dark"
			>
				This lookup can open a deeper Ballot Clarity guide for the current published coverage while still keeping the nationwide civic results below available for review first.
			</p>
			<SourceProvenanceStrip
				v-if="lookupResult === 'resolved'"
				:summary="lookupProvenanceSummary"
				class="mt-4"
			/>
			<DistrictLadder
				v-if="districtMatches.length"
				:lookup-input-kind="lookupInputKind"
				:matches="districtMatches"
				:normalized-address="normalizedAddress"
				class="mt-4"
			/>
			<RepresentativeGrid
				v-if="representativeCards.length"
				:cards="representativeCards"
				class="mt-4"
			/>
			<AvailabilityStatusPanel
				v-if="availabilityItems.length"
				class="mt-4"
				:items="availabilityItems"
				note="These availability labels separate the nationwide lookup layer from deeper Ballot Clarity local guide depth."
				title="What Ballot Clarity can show for this location right now"
				:uncertainty="lookupUncertaintyNote"
			/>
			<div v-if="lookupActions.length" class="mt-4 gap-3 grid">
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
					Open full local guide
				</button>
			</div>
			<p class="text-xs text-app-muted leading-6 mt-4 dark:text-app-muted-dark">
				{{ lookupResult === "unsupported"
					? "Use the official tools above for this location, or replace the ZIP code with a full street address for a more precise lookup."
					: resolvedLocation
						? "This lookup succeeded nationwide. Use the civic results here first, then open the deeper local guide when you want Ballot Clarity's contest, candidate, and measure pages."
						: "This lookup succeeded nationwide. Use the district, representative, provenance, and official-tool layers here even when a full local Ballot Clarity guide is not published yet." }}
			</p>
			<p v-if="lookupResult" class="text-xs text-app-muted leading-6 mt-2 dark:text-app-muted-dark">
				<strong class="text-app-ink dark:text-app-text-dark">Uncertainty:</strong>
				{{ lookupUncertaintyNote }}
			</p>
		</div>
	</form>
</template>
