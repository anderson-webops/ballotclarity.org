<script setup lang="ts">
import type {
	LocationLookupAction,
	LocationLookupSelectionOption,
	NationwideLookupResultContext
} from "~/types/civic";
import {
	buildLocationAvailabilityItems,
	buildLookupProvenanceSummary,
	buildRepresentativeCards
} from "~/utils/graphics-schema";
import { isExternalHref } from "~/utils/link";
import { buildLookupPresentation, filterLookupActionsForPresentation } from "~/utils/location-lookup";
import { buildNationwideDistrictHref, buildNationwideRepresentativeHref } from "~/utils/lookup-links";
import { resolveRepresentativePresentation } from "~/utils/representative-presentation";

const props = defineProps<{
	compact?: boolean;
	lookup: NationwideLookupResultContext;
}>();

const emit = defineEmits<{
	openGuide: [action: LocationLookupAction];
	selectOption: [option: LocationLookupSelectionOption];
}>();

const lookupResolution = computed(() => ({
	electionSlug: props.lookup.electionSlug,
	guideAvailability: props.lookup.guideAvailability,
	location: props.lookup.location ?? undefined,
	result: props.lookup.result
}));
const lookupPresentation = computed(() => buildLookupPresentation(lookupResolution.value));
const visibleLookupActions = computed(() => filterLookupActionsForPresentation(props.lookup.actions, lookupResolution.value));
const availabilityItems = computed(() => buildLocationAvailabilityItems(props.lookup.availability));
const representativeCards = computed(() => buildRepresentativeCards(props.lookup.representativeMatches));
const lookupProvenanceSummary = computed(() => buildLookupProvenanceSummary({
	districtMatches: props.lookup.districtMatches,
	fromCache: props.lookup.fromCache,
	guideAvailability: props.lookup.guideAvailability,
	hasOfficialTools: props.lookup.actions.some(action => action.kind === "official-verification"),
	inputKind: props.lookup.inputKind,
	representativeMatches: props.lookup.representativeMatches
}));
const selectionOptions = computed(() => props.lookup.selectionOptions ?? []);
const hasSelectionOptions = computed(() => selectionOptions.value.length > 0);

const lookupUncertaintyNote = computed(() => {
	if (props.lookup.result === "unsupported")
		return "This input did not resolve cleanly enough to show district or representative results. Try a full street address or use the official tools.";

	if (props.lookup.inputKind === "zip")
		return "ZIP-only results are approximate. Use a full street address when district-specific ballot questions matter.";

	return "District and representative matches are provider-backed, but the election office remains the final authority for precinct and ballot-style questions.";
});

function openGuideAction(action: LocationLookupAction) {
	if (action.kind !== "ballot-guide")
		return;

	emit("openGuide", action);
}

function selectLookupOption(option: LocationLookupSelectionOption) {
	emit("selectOption", option);
}

function buildDistrictHref(match: NationwideLookupResultContext["districtMatches"][number]) {
	return buildNationwideDistrictHref(match, props.lookup);
}

function buildRepresentativeHref(match: NationwideLookupResultContext["representativeMatches"][number]) {
	return buildNationwideRepresentativeHref(match, props.lookup);
}

function getRepresentativePresentation(match: NationwideLookupResultContext["representativeMatches"][number]) {
	return resolveRepresentativePresentation(match, props.lookup.location?.state);
}
</script>

<template>
	<div class="mt-5 p-4 border border-app-line rounded-3xl bg-app-bg dark:border-app-line-dark dark:bg-app-bg-dark/60">
		<p class="text-xs text-app-muted tracking-[0.2em] font-semibold uppercase dark:text-app-muted-dark">
			{{ lookupPresentation.heading }}
		</p>
		<p class="text-sm text-app-muted leading-6 mt-3 dark:text-app-muted-dark">
			{{ lookup.note }}
		</p>
		<div v-if="lookup.result === 'resolved'" class="mt-4 flex flex-wrap gap-2">
			<VerificationBadge
				:label="lookup.detectedFromIp ? 'IP-based location guess' : lookup.inputKind === 'address' ? 'Address lookup' : 'ZIP lookup'"
				:tone="lookup.detectedFromIp || lookup.inputKind === 'zip' ? 'warning' : 'accent'"
			/>
			<VerificationBadge :label="lookupPresentation.availabilityBadgeLabel" tone="accent" />
			<VerificationBadge
				:label="hasSelectionOptions ? 'Selection required' : lookup.representativeMatches.length ? `${lookup.representativeMatches.length} representative match${lookup.representativeMatches.length === 1 ? '' : 'es'}` : 'No representative match yet'"
				:tone="hasSelectionOptions ? 'warning' : lookup.representativeMatches.length ? 'accent' : 'neutral'"
			/>
		</div>
		<p v-if="lookupPresentation.supportingNote" class="text-xs text-app-muted leading-6 mt-3 dark:text-app-muted-dark">
			{{ lookupPresentation.supportingNote }}
		</p>
		<SourceProvenanceStrip
			v-if="lookup.result === 'resolved'"
			:summary="lookupProvenanceSummary"
			class="mt-4"
		/>
		<DistrictLadder
			v-if="lookup.districtMatches.length"
			:lookup-input-kind="lookup.inputKind"
			:matches="lookup.districtMatches"
			:normalized-address="lookup.normalizedAddress"
			class="mt-4"
		/>
		<RepresentativeGrid
			v-if="representativeCards.length"
			:cards="representativeCards"
			class="mt-4"
		/>
		<div v-if="hasSelectionOptions" class="mt-4 gap-3 grid md:grid-cols-2">
			<article
				v-for="option in selectionOptions"
				:key="option.id"
				class="p-4 border border-app-line rounded-2xl bg-white dark:border-app-line-dark dark:bg-app-panel-dark"
			>
				<div class="flex flex-wrap gap-2 items-center">
					<p class="text-sm text-app-ink font-semibold dark:text-app-text-dark">
						{{ option.label }}
					</p>
					<VerificationBadge
						:label="option.guideAvailability === 'published' ? 'Local guide available' : 'Nationwide results'"
						:tone="option.guideAvailability === 'published' ? 'accent' : 'neutral'"
					/>
					<VerificationBadge
						:label="option.representativeMatches?.length ? `${option.representativeMatches.length} representative match${option.representativeMatches.length === 1 ? '' : 'es'}` : 'Representative data pending'"
						:tone="option.representativeMatches?.length ? 'accent' : 'neutral'"
					/>
				</div>
				<p class="text-sm text-app-muted leading-6 mt-3 dark:text-app-muted-dark">
					{{ option.description }}
				</p>
				<ul v-if="option.districtMatches?.length" class="mt-3 space-y-2">
					<li
						v-for="match in option.districtMatches"
						:key="`${option.id}-${match.id}`"
						class="text-sm text-app-muted leading-6 dark:text-app-muted-dark"
					>
						<span class="text-app-ink font-semibold dark:text-app-text-dark">{{ match.label }}</span>
						<span class="text-xs tracking-[0.12em] ml-2 uppercase">{{ match.sourceSystem }}</span>
					</li>
				</ul>
				<div class="mt-4 flex flex-wrap gap-3">
					<button
						type="button"
						class="btn-primary"
						@click="selectLookupOption(option)"
					>
						<span class="i-carbon-arrow-right" />
						Use this area
					</button>
				</div>
			</article>
		</div>
		<AvailabilityStatusPanel
			v-if="availabilityItems.length"
			class="mt-4"
			:items="availabilityItems"
			note="These availability labels separate the nationwide lookup layer from deeper Ballot Clarity local guide depth."
			title="What Ballot Clarity can show for this location right now"
			:uncertainty="lookupUncertaintyNote"
		/>
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
						@click="openGuideAction(action)"
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
		<div v-if="lookup.normalizedAddress || lookup.districtMatches.length || lookup.representativeMatches.length" class="mt-4 gap-4 grid lg:grid-cols-2">
			<div v-if="lookup.districtMatches.length" class="p-4 border border-app-line rounded-2xl bg-white dark:border-app-line-dark dark:bg-app-panel-dark">
				<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
					Matched districts
				</p>
				<p v-if="lookup.normalizedAddress" class="text-sm text-app-muted leading-6 mt-2 dark:text-app-muted-dark">
					{{ lookup.normalizedAddress }}
				</p>
				<ul class="mt-3 space-y-2">
					<li v-for="match in lookup.districtMatches" :key="match.id" class="text-sm text-app-muted leading-6 dark:text-app-muted-dark">
						<NuxtLink
							:to="buildDistrictHref(match)"
							class="text-app-ink font-semibold underline decoration-transparent underline-offset-3 transition dark:text-app-text-dark focus-visible:text-app-accent hover:text-app-accent focus-visible:decoration-current hover:decoration-current"
						>
							{{ match.label }}
						</NuxtLink>
						<span class="text-xs tracking-[0.12em] ml-2 uppercase">{{ match.sourceSystem }}</span>
					</li>
				</ul>
				<p v-if="lookup.fromCache" class="text-xs text-app-muted leading-6 mt-3 dark:text-app-muted-dark">
					Loaded from the local lookup cache.
				</p>
			</div>
			<div v-if="lookup.representativeMatches.length" class="p-4 border border-app-line rounded-2xl bg-white dark:border-app-line-dark dark:bg-app-panel-dark">
				<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
					Current representatives
				</p>
				<ul class="mt-3 space-y-3">
					<li v-for="match in lookup.representativeMatches" :key="match.id" class="text-sm text-app-muted leading-6 dark:text-app-muted-dark">
						<div class="flex flex-wrap gap-2 items-center">
							<NuxtLink
								:to="buildRepresentativeHref(match)"
								class="text-app-ink font-semibold underline decoration-transparent underline-offset-3 transition dark:text-app-text-dark focus-visible:text-app-accent hover:text-app-accent focus-visible:decoration-current hover:decoration-current"
							>
								{{ match.name }}
							</NuxtLink>
							<VerificationBadge :label="getRepresentativePresentation(match).levelLabel" tone="accent" />
							<span v-if="match.party" class="text-xs tracking-[0.12em] uppercase">{{ match.party }}</span>
							<VerificationBadge :label="match.sourceSystem" />
						</div>
						<p>{{ getRepresentativePresentation(match).officeDisplayLabel }}</p>
						<a
							v-if="match.openstatesUrl"
							:href="match.openstatesUrl"
							target="_blank"
							rel="noreferrer"
							class="text-app-accent underline underline-offset-3 inline-flex gap-2 items-center"
						>
							Open record
							<span v-if="isExternalHref(match.openstatesUrl)" class="i-carbon-launch" />
						</a>
					</li>
				</ul>
			</div>
		</div>
		<div v-if="lookupPresentation.canOpenGuide && lookup.location && lookup.electionSlug" class="mt-4 flex flex-wrap gap-3">
			<button
				type="button"
				class="btn-primary"
				@click="openGuideAction({
					description: 'Open the published local guide for this lookup.',
					electionSlug: lookup.electionSlug,
					id: `lookup-guide-${lookup.location.slug}`,
					kind: 'ballot-guide',
					location: lookup.location,
					title: lookup.location.displayName,
				})"
			>
				<span class="i-carbon-arrow-right" />
				Open full local guide
			</button>
		</div>
		<p class="text-xs text-app-muted leading-6 mt-4 dark:text-app-muted-dark">
			{{ lookupPresentation.footerNote }}
		</p>
		<p class="text-xs text-app-muted leading-6 mt-2 dark:text-app-muted-dark">
			<strong class="text-app-ink dark:text-app-text-dark">Uncertainty:</strong>
			{{ lookupUncertaintyNote }}
		</p>
	</div>
</template>
