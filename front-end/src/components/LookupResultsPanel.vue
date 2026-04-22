<script setup lang="ts">
import type {
	LocationLookupAction,
	LocationLookupSelectionOption,
	NationwideLookupResultContext
} from "~/types/civic";
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
const { formatDate } = useFormatters();

const externalHrefPattern = /^https?:\/\//;

function isExternalHref(href: string) {
	return externalHrefPattern.test(href);
}

const lookupResolution = computed(() => ({
	electionSlug: props.lookup.electionSlug,
	guideContent: props.lookup.guideContent,
	guideAvailability: props.lookup.guideAvailability,
	location: props.lookup.location ?? undefined,
	result: props.lookup.result
}));
const lookupPresentation = computed(() => buildLookupPresentation(lookupResolution.value));
const visibleLookupActions = computed(() => filterLookupActionsForPresentation(props.lookup.actions, lookupResolution.value));
const selectionOptions = computed(() => props.lookup.selectionOptions ?? []);
const hasSelectionOptions = computed(() => selectionOptions.value.length > 0);
const electionLogistics = computed(() => props.lookup.electionLogistics);
const hasElectionLogistics = computed(() => Boolean(
	electionLogistics.value
	&& (
		electionLogistics.value.electionName
		|| electionLogistics.value.electionDay
		|| electionLogistics.value.pollingLocations.length
		|| electionLogistics.value.earlyVoteSites.length
		|| electionLogistics.value.dropOffLocations.length
		|| electionLogistics.value.additionalElectionNames.length
		|| electionLogistics.value.mailOnly
	)
));
const availabilityItems = computed(() => {
	if (!props.lookup.availability)
		return [];

	return [
		props.lookup.availability.nationwideCivicResults,
		props.lookup.availability.officialLogistics,
		props.lookup.availability.representatives,
		props.lookup.availability.ballotCandidates,
		props.lookup.availability.financeInfluence,
		props.lookup.availability.fullLocalGuide
	];
});

function availabilityTone(status: "available" | "limited" | "unavailable") {
	return status === "available" ? "accent" : status === "limited" ? "warning" : "neutral";
}

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
						:label="option.guideAvailability === 'published' ? 'Local guide available' : 'Results available'"
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
		<div
			v-if="availabilityItems.length"
			:class="compact ? 'mt-4 grid grid-cols-1 gap-3' : 'mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5'"
		>
			<article
				v-for="item in availabilityItems"
				:key="item.label"
				class="p-4 border border-app-line rounded-2xl bg-white dark:border-app-line-dark dark:bg-app-panel-dark"
			>
				<div class="flex flex-wrap gap-2 items-center">
					<p class="text-sm text-app-ink font-semibold dark:text-app-text-dark">
						{{ item.label }}
					</p>
					<VerificationBadge :label="item.status" :tone="availabilityTone(item.status)" />
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
		<div v-if="hasElectionLogistics && electionLogistics" class="mt-4 gap-4 grid">
			<div class="p-4 border border-app-line rounded-2xl bg-white dark:border-app-line-dark dark:bg-app-panel-dark">
				<div class="flex flex-wrap gap-2 items-center">
					<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
						Official election logistics
					</p>
					<VerificationBadge label="Google Civic" tone="accent" />
				</div>
				<div class="mt-4 flex flex-wrap gap-3 items-center">
					<p v-if="electionLogistics.electionName" class="text-lg text-app-ink font-semibold dark:text-app-text-dark">
						{{ electionLogistics.electionName }}
					</p>
					<p v-if="electionLogistics.electionDay" class="text-sm text-app-muted dark:text-app-muted-dark">
						{{ formatDate(electionLogistics.electionDay) }}
					</p>
					<VerificationBadge v-if="electionLogistics.mailOnly" label="Mail-only precinct" tone="warning" />
				</div>
				<p v-if="electionLogistics.normalizedAddress" class="text-sm text-app-muted leading-6 mt-3 dark:text-app-muted-dark">
					Structured logistics returned for {{ electionLogistics.normalizedAddress }}.
				</p>
				<p class="text-sm text-app-muted leading-6 mt-3 dark:text-app-muted-dark">
					{{ electionLogistics.officialSourceNote }}
				</p>
				<div class="mt-4 gap-4 grid lg:grid-cols-3">
					<article
						v-for="section in [
							{ id: 'polling', items: electionLogistics.pollingLocations, title: 'Polling locations' },
							{ id: 'early', items: electionLogistics.earlyVoteSites, title: 'Early vote sites' },
							{ id: 'dropoff', items: electionLogistics.dropOffLocations, title: 'Ballot drop-off locations' },
						]"
						v-show="section.items.length"
						:key="section.id"
						class="p-4 rounded-2xl bg-app-bg dark:bg-app-bg-dark/70"
					>
						<h3 class="text-sm text-app-ink font-semibold dark:text-app-text-dark">
							{{ section.title }}
						</h3>
						<ul class="mt-3 space-y-3">
							<li v-for="site in section.items.slice(0, 3)" :key="site.id" class="text-sm text-app-muted leading-6 dark:text-app-muted-dark">
								<p class="text-app-ink font-semibold dark:text-app-text-dark">
									{{ site.name }}
								</p>
								<p>{{ site.address }}</p>
								<p v-if="site.note">
									{{ site.note }}
								</p>
							</li>
						</ul>
					</article>
				</div>
				<div v-if="electionLogistics.additionalElectionNames.length" class="mt-4">
					<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
						Additional elections
					</p>
					<ul class="mt-2 space-y-2">
						<li v-for="name in electionLogistics.additionalElectionNames" :key="name" class="text-sm text-app-muted leading-6 dark:text-app-muted-dark">
							{{ name }}
						</li>
					</ul>
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
					description: 'Open the local guide for this lookup.',
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
	</div>
</template>
