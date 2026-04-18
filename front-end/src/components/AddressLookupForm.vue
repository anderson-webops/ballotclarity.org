<script setup lang="ts">
import type {
	ElectionSummary,
	LocationDataAvailabilitySummary,
	LocationDistrictMatch,
	LocationLookupAction,
	LocationLookupResponse,
	LocationRepresentativeMatch
} from "~/types/civic";
import { buildLookupPresentation, filterLookupActionsForPresentation, hasPublishedGuideResult } from "~/utils/location-lookup";

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

const lookupPresentation = computed(() => lookupResult.value
	? buildLookupPresentation({
			electionSlug: resolvedElectionSlug.value || undefined,
			guideAvailability: guideAvailability.value,
			location: resolvedLocation.value ?? undefined,
			result: lookupResult.value
		})
	: null);
const visibleLookupActions = computed(() => lookupResult.value
	? filterLookupActionsForPresentation(lookupActions.value, {
			electionSlug: resolvedElectionSlug.value || undefined,
			guideAvailability: guideAvailability.value,
			location: resolvedLocation.value ?? undefined,
			result: lookupResult.value
		})
	: []);
const inputDescribedBy = computed(() => [descriptionId, usageId, privacyId, visibleLookupActions.value.length ? actionsId : "", errorMessage.value ? errorId : ""].filter(Boolean).join(" "));

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
	if (action.kind !== "ballot-guide" || !lookupPresentation.value?.canOpenGuide || !action.location || !action.electionSlug)
		return;

	civicStore.setLocation(action.location);

	if (props.election)
		civicStore.setElection(props.election);

	await navigateTo(`/ballot/${action.electionSlug}?location=${action.location.slug}`);
}

async function continueToResolvedGuide() {
	if (!lookupPresentation.value?.canOpenGuide || !resolvedLocation.value || !resolvedElectionSlug.value)
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
		errorMessage.value = "Enter an address or ZIP code to load civic results.";
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
		const canOpenGuide = hasPublishedGuideResult({
			electionSlug: response.electionSlug,
			guideAvailability: response.guideAvailability,
			location: response.location
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
		resolvedElectionSlug.value = canOpenGuide ? response.electionSlug ?? "" : "";
		resolvedLocation.value = canOpenGuide ? response.location ?? null : null;
		lookupActions.value = filterLookupActionsForPresentation(response.actions, {
			electionSlug: canOpenGuide ? response.electionSlug : undefined,
			guideAvailability: response.guideAvailability,
			location: canOpenGuide ? response.location : undefined,
			result: response.result
		});
	}
	catch (error) {
		errorMessage.value = error instanceof Error ? error.message : "Unable to load civic results right now.";
	}
	finally {
		isPending.value = false;
	}
}

const availabilityItems = computed(() => {
	if (!availability.value)
		return [];

	return [
		availability.value.nationwideCivicResults,
		availability.value.representatives,
		availability.value.ballotCandidates,
		availability.value.financeInfluence,
		availability.value.fullLocalGuide
	];
});
</script>

<template>
	<form :class="[props.framed === false ? '' : 'surface-panel', compact ? 'p-5' : 'p-6 sm:p-7']" :aria-busy="isPending" @submit.prevent="handleSubmit">
		<label :for="inputId" class="text-sm text-app-ink font-semibold block dark:text-app-text-dark">
			Choose a location with a full street address or 5-digit ZIP code
		</label>
		<p :id="descriptionId" class="text-sm text-app-muted mt-2 dark:text-app-muted-dark">
			Ballot Clarity does not auto-detect your district from IP. Civic results change only when you choose a location here.
		</p>
		<p :id="usageId" class="text-sm text-app-muted leading-6 mt-3 dark:text-app-muted-dark">
			Ballot Clarity can already use provider-backed lookup to match many U.S. addresses to nationwide civic results, districts, and representative records. Full published ballot guides are still narrower. A full street address is the only input that can support the best district match, while ZIP-only results should still be treated as approximate.
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
				{{ lookupPresentation?.heading ?? "Lookup results ready" }}
			</p>
			<p class="text-sm text-app-muted leading-6 mt-3 dark:text-app-muted-dark">
				{{ lookupNote }}
			</p>
			<div v-if="lookupResult === 'resolved'" class="mt-4 flex flex-wrap gap-2">
				<VerificationBadge :label="lookupInputKind === 'address' ? 'Address lookup' : 'ZIP lookup'" :tone="lookupInputKind === 'address' ? 'accent' : 'warning'" />
				<VerificationBadge
					:label="lookupPresentation?.availabilityBadgeLabel ?? 'Nationwide civic results available'"
					tone="accent"
				/>
				<VerificationBadge
					:label="representativeMatches.length ? `${representativeMatches.length} representative match${representativeMatches.length === 1 ? '' : 'es'}` : 'No representative match yet'"
					:tone="representativeMatches.length ? 'accent' : 'neutral'"
				/>
			</div>
			<p
				v-if="lookupPresentation?.supportingNote"
				class="text-xs text-app-muted leading-6 mt-3 dark:text-app-muted-dark"
			>
				{{ lookupPresentation.supportingNote }}
			</p>
			<div v-if="availabilityItems.length" class="mt-4 gap-3 grid md:grid-cols-2 xl:grid-cols-5">
				<article
					v-for="item in availabilityItems"
					:key="item.label"
					class="p-4 border border-app-line rounded-2xl bg-white dark:border-app-line-dark dark:bg-app-panel-dark"
				>
					<div class="flex flex-wrap gap-2 items-center">
						<p class="text-sm text-app-ink font-semibold dark:text-app-text-dark">
							{{ item.label }}
						</p>
						<VerificationBadge :label="item.status" :tone="item.status === 'available' ? 'accent' : 'neutral'" />
					</div>
					<p class="text-sm text-app-muted leading-6 mt-3 dark:text-app-muted-dark">
						{{ item.detail }}
					</p>
				</article>
			</div>
			<div v-if="visibleLookupActions.length" class="mt-4 gap-3 grid">
				<div
					v-for="action in visibleLookupActions"
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
							Open local guide
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
			<div v-if="normalizedAddress || districtMatches.length || representativeMatches.length" class="mt-4 gap-4 grid lg:grid-cols-2">
				<div v-if="districtMatches.length" class="p-4 border border-app-line rounded-2xl bg-white dark:border-app-line-dark dark:bg-app-panel-dark">
					<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
						Matched districts
					</p>
					<p v-if="normalizedAddress" class="text-sm text-app-muted leading-6 mt-2 dark:text-app-muted-dark">
						{{ normalizedAddress }}
					</p>
					<ul class="mt-3 space-y-2">
						<li v-for="match in districtMatches" :key="match.id" class="text-sm text-app-muted leading-6 dark:text-app-muted-dark">
							<span class="text-app-ink font-semibold dark:text-app-text-dark">{{ match.label }}</span>
							<span class="text-xs tracking-[0.12em] ml-2 uppercase">{{ match.sourceSystem }}</span>
						</li>
					</ul>
					<p v-if="fromCache" class="text-xs text-app-muted leading-6 mt-3 dark:text-app-muted-dark">
						Loaded from the local lookup cache.
					</p>
				</div>
				<div v-if="representativeMatches.length" class="p-4 border border-app-line rounded-2xl bg-white dark:border-app-line-dark dark:bg-app-panel-dark">
					<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
						Current representatives
					</p>
					<ul class="mt-3 space-y-3">
						<li v-for="match in representativeMatches" :key="match.id" class="text-sm text-app-muted leading-6 dark:text-app-muted-dark">
							<div class="flex flex-wrap gap-2 items-center">
								<span class="text-app-ink font-semibold dark:text-app-text-dark">{{ match.name }}</span>
								<span v-if="match.party" class="text-xs tracking-[0.12em] uppercase">{{ match.party }}</span>
								<VerificationBadge :label="match.sourceSystem" />
							</div>
							<p>{{ match.officeTitle }} · {{ match.districtLabel }}</p>
							<a
								v-if="match.openstatesUrl"
								:href="match.openstatesUrl"
								target="_blank"
								rel="noreferrer"
								class="underline underline-offset-3"
							>
								Open States profile
							</a>
						</li>
					</ul>
				</div>
			</div>
			<div v-if="lookupPresentation?.canOpenGuide && resolvedLocation" class="mt-4 flex flex-wrap gap-3">
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
				{{ lookupPresentation?.footerNote ?? "Use the official tools above for this location, or replace the ZIP code with a full street address for a more precise lookup." }}
			</p>
		</div>
	</form>
</template>
