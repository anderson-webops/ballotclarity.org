<script setup lang="ts">
import type {
	LocationLookupAction,
	LocationLookupSelectionOption,
	LookupAvailabilityStatus,
	NationwideLookupResultContext
} from "~/types/civic";
import DistrictLadder from "~/components/graphics/DistrictLadder.vue";
import RepresentativeGrid from "~/components/graphics/RepresentativeGrid.vue";
import { buildRepresentativeCards } from "~/utils/graphics-schema";
import { buildLookupPresentation, filterLookupActionsForPresentation } from "~/utils/location-lookup";
import { buildNationwideDistrictHref, buildNationwideRepresentativeHref } from "~/utils/lookup-links";
import { buildNationwideRouteTarget } from "~/utils/nationwide-route-context";
import { resolveRepresentativePresentation } from "~/utils/representative-presentation";
import { limitedBallotNotice } from "~/utils/results-summary";

const props = defineProps<{
	compact?: boolean;
	lookup: NationwideLookupResultContext;
	resultsPage?: boolean;
}>();

const emit = defineEmits<{
	openGuide: [action: LocationLookupAction];
	selectOption: [option: LocationLookupSelectionOption];
}>();
const NuxtLinkComponent = resolveComponent("NuxtLink");

const lookupResolution = computed(() => ({
	electionSlug: props.lookup.electionSlug,
	guideContent: props.lookup.guideContent,
	guideAvailability: props.lookup.guideAvailability,
	location: props.lookup.location ?? undefined,
	result: props.lookup.result
}));
const lookupPresentation = computed(() => buildLookupPresentation(lookupResolution.value));
// The same official tool can arrive from more than one source (for example a live portal and its
// mirrored summary); list each named tool once, keeping the first (live) entry.
const visibleLookupActions = computed(() => {
	const seen = new Set<string>();

	return filterLookupActionsForPresentation(props.lookup.actions, lookupResolution.value).filter((action) => {
		const key = `${action.kind}:${action.title.trim().toLowerCase()}`;

		if (seen.has(key))
			return false;

		seen.add(key);
		return true;
	});
});
const representativeCards = computed(() => buildRepresentativeCards(props.lookup.representativeMatches).map((card, index) => {
	const match = props.lookup.representativeMatches[index]!;
	const presentation = getRepresentativePresentation(match);

	return {
		...card,
		href: buildRepresentativeHref(match),
		levelLabel: presentation.levelLabel,
		officeTitle: presentation.officeDisplayLabel
	};
}));
const districtLinks = computed(() => Object.fromEntries(props.lookup.districtMatches.map(match => [match.id, buildDistrictHref(match)])));
const selectionOptions = computed(() => props.lookup.selectionOptions ?? []);
const hasSelectionOptions = computed(() => selectionOptions.value.length > 0);
const electionLogistics = computed(() => props.lookup.electionLogistics);
const ballotContentPreviews = computed(() => props.lookup.ballotContentPreviews ?? []);
const hasBallotContentPreviews = computed(() => ballotContentPreviews.value.length > 0);
const primaryAvailabilityIds = new Set(["official-logistics", "representatives", "local-guide"]);
// One place per kind keeps "Where to vote" glanceable; the official tools below have the full lists.
const votingPlaces = computed(() => {
	const logistics = electionLogistics.value;

	if (!logistics)
		return [];

	return [
		{ label: "Polling place", site: logistics.pollingLocations[0] },
		{ label: "Early voting", site: logistics.earlyVoteSites[0] },
		{ label: "Ballot drop box", site: logistics.dropOffLocations[0] },
	].filter((place): place is { label: string; site: NonNullable<typeof place.site> } => Boolean(place.site));
});
const availabilityItems = computed(() => {
	if (!props.lookup.availability)
		return [];

	return [
		{
			actionLabel: "See your results",
			href: buildLookupAwareTarget("/results"),
			id: "civic-results",
			item: props.lookup.availability.nationwideCivicResults,
			title: "Your area results",
		},
		{
			actionLabel: "See dates and official links",
			href: buildOfficialLogisticsHref(),
			id: "official-logistics",
			item: props.lookup.availability.officialLogistics,
			title: "When and how to vote",
		},
		{
			actionLabel: "See your officials",
			href: props.lookup.representativeMatches.length ? buildLookupAwareTarget("/representatives") : undefined,
			id: "representatives",
			item: props.lookup.availability.representatives,
			title: "Who represents you",
		},
		{
			actionLabel: props.lookup.guideContent?.verifiedContestPackage ? "See candidates" : "Check status",
			href: buildCandidateDataHref(),
			id: "ballot-candidates",
			item: props.lookup.availability.ballotCandidates,
			title: "Candidates on your ballot",
		},
		{
			actionLabel: "See funding records",
			href: props.lookup.representativeMatches.length ? buildLookupAwareTarget("/representatives") : undefined,
			id: "finance-influence",
			item: props.lookup.availability.financeInfluence,
			title: "Money and influence",
		},
		{
			actionLabel: props.lookup.guideContent?.verifiedContestPackage ? "Read your ballot guide" : "Open election overview",
			href: buildLocalGuideHref(),
			id: "local-guide",
			item: props.lookup.availability.fullLocalGuide,
			title: props.lookup.guideContent?.verifiedContestPackage ? "Your ballot guide" : "Your election",
		},
	];
});
const visibleAvailabilityItems = computed(() => availabilityItems.value.filter((card) => {
	if (props.resultsPage && card.id === "civic-results")
		return false;
	if (props.resultsPage && (card.id === "representatives" || card.id === "finance-influence"))
		return false;
	if (card.id === "finance-influence" && availabilityItems.value.some(item => item.id === "representatives" && item.href === card.href && item.item.status !== "unavailable"))
		return false;
	if (!card.href || card.item.status === "unavailable")
		return false;

	if (primaryAvailabilityIds.has(card.id))
		return true;

	return card.item.status === "available";
}));

function availabilityTone(status: LookupAvailabilityStatus) {
	return status === "available" ? "accent" : status === "partial" || status === "limited" ? "warning" : "neutral";
}

function openGuideAction(action: LocationLookupAction) {
	if (action.kind !== "ballot-guide")
		return;

	emit("openGuide", action);
}

function selectLookupOption(option: LocationLookupSelectionOption) {
	emit("selectOption", option);
}

function buildLookupAwareTarget(path: string) {
	return buildNationwideRouteTarget(path, props.lookup);
}

function buildElectionOverviewHref() {
	return props.lookup.electionSlug ? `/elections/${props.lookup.electionSlug}` : undefined;
}

function buildOfficialLogisticsHref() {
	if (!props.lookup.electionSlug)
		return undefined;

	return props.lookup.guideContent?.verifiedContestPackage
		? `/ballot/${props.lookup.electionSlug}#guide-logistics`
		: buildElectionOverviewHref();
}

function buildCandidateDataHref() {
	if (!props.lookup.electionSlug || props.lookup.availability?.ballotCandidates.status === "unavailable")
		return undefined;

	return props.lookup.guideContent?.verifiedContestPackage
		? `/ballot/${props.lookup.electionSlug}#candidate-contests-section`
		: buildElectionOverviewHref();
}

function buildLocalGuideHref() {
	if (!props.lookup.electionSlug)
		return undefined;

	return props.lookup.guideContent?.verifiedContestPackage
		? `/ballot/${props.lookup.electionSlug}`
		: buildElectionOverviewHref();
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
	<div :class="resultsPage ? 'lookup-results-page' : 'mt-5 p-4 border border-app-line rounded-xl bg-app-bg dark:border-app-line-dark dark:bg-app-bg-dark/60'">
		<p v-if="lookup.result === 'resolved' && !lookup.guideContent?.verifiedContestPackage" class="text-sm text-app-ink leading-6 mb-4 pl-3 border-app-line border-l-2 dark:text-app-text-dark dark:border-app-line-dark">
			{{ limitedBallotNotice }}
		</p>
		<p v-if="!resultsPage" class="text-xs text-app-muted tracking-[0.2em] font-semibold uppercase dark:text-app-muted-dark">
			{{ lookupPresentation.heading }}
		</p>
		<p v-if="lookup.result !== 'resolved'" class="text-sm text-app-muted leading-6 mt-3 dark:text-app-muted-dark">
			{{ lookup.note }}
		</p>
		<div v-if="lookup.result === 'resolved' && !resultsPage" class="mt-4 flex flex-wrap gap-2">
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
		<p v-if="lookupPresentation.supportingNote && !resultsPage" class="text-xs text-app-muted leading-6 mt-3 dark:text-app-muted-dark">
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
						:label="option.guideAvailability === 'published' ? 'Election overview available' : 'Results available'"
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
						<span class="text-xs tracking-[0.06em] ml-2 uppercase">{{ match.sourceSystem }}</span>
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
		<ol
			v-if="visibleAvailabilityItems.length"
			class="lookup-steps"
			:class="compact ? 'mt-4 grid grid-cols-1 gap-3' : 'mt-4 grid gap-x-8 gap-y-4 md:grid-cols-2 xl:grid-cols-3 items-stretch md:auto-rows-fr'"
		>
			<li v-for="card in visibleAvailabilityItems" :key="card.id" class="lookup-step flex">
				<component
					:is="card.href ? NuxtLinkComponent : 'article'"
					v-bind="card.href ? { to: card.href } : {}"
					class="lookup-step-card group content-block-link flex flex-col h-full w-full"
					:class="card.href ? 'focus-ring hover:border-app-accent dark:hover:border-app-accent' : ''"
				>
					<div class="flex gap-3 items-start">
						<span class="lookup-step-card__number" aria-hidden="true" />
						<div class="min-w-0">
							<h3 class="text-base font-semibold inline-flex gap-1.5 items-center" :class="card.href ? 'text-app-accent' : 'text-app-ink dark:text-app-text-dark'">
								{{ card.title || card.item.label }}
								<span v-if="card.href" class="i-carbon-arrow-right transition group-hover:translate-x-0.5" aria-hidden="true" />
							</h3>
							<VerificationBadge
								v-if="card.item.status !== 'available'"
								class="mt-1.5"
								:label="card.item.status === 'limited' || card.item.status === 'partial' ? 'Partly available' : 'Not available yet'"
								:tone="availabilityTone(card.item.status)"
							/>
						</div>
					</div>
				</component>
			</li>
		</ol>
		<BallotContentPreviews v-if="hasBallotContentPreviews" :previews="ballotContentPreviews" class="mt-8" />
		<nav v-if="lookup.result === 'resolved'" aria-label="Area records" class="text-base mt-5 flex flex-wrap gap-x-8 gap-y-3">
			<NuxtLink :to="lookup.location?.state ? { path: '/records', query: { state: lookup.location.state } } : '/records'" class="text-app-accent font-semibold underline underline-offset-3 focus-ring">
				Candidate records
			</NuxtLink>
			<NuxtLink v-if="resultsPage && lookup.representativeMatches.length" :to="buildLookupAwareTarget('/representatives')" class="text-app-accent font-semibold underline underline-offset-3 focus-ring">
				{{ lookup.representativeMatches.length }} representatives
			</NuxtLink>
			<NuxtLink v-if="resultsPage && lookup.districtMatches.length" :to="buildLookupAwareTarget('/districts')" class="text-app-accent font-semibold underline underline-offset-3 focus-ring">
				{{ lookup.districtMatches.length }} districts
			</NuxtLink>
		</nav>
		<section v-if="votingPlaces.length || electionLogistics?.mailOnly" class="mt-6" aria-labelledby="where-to-vote-heading">
			<component :is="resultsPage ? 'h2' : 'h3'" id="where-to-vote-heading" class="text-app-ink font-serif dark:text-app-text-dark" :class="resultsPage ? 'text-2xl' : 'text-lg'">
				Where to vote
			</component>
			<p v-if="electionLogistics?.mailOnly" class="text-base text-app-ink mt-2 dark:text-app-text-dark">
				This precinct votes by mail.
			</p>
			<ul class="mt-2">
				<li v-for="place in votingPlaces" :key="place.label" class="surface-row">
					<p class="text-sm text-app-muted dark:text-app-muted-dark">
						{{ place.label }}
					</p>
					<p class="text-base text-app-ink font-semibold mt-1 dark:text-app-text-dark">
						{{ place.site.name }}
					</p>
					<p class="text-sm text-app-muted dark:text-app-muted-dark">
						{{ place.site.address }}
					</p>
				</li>
			</ul>
		</section>
		<div v-if="visibleLookupActions.length" :id="resultsPage ? 'official-tools' : undefined" class="mt-6 gap-3 grid">
			<div v-if="resultsPage">
				<h2 class="text-2xl text-app-ink font-serif dark:text-app-text-dark">
					Official election tools
				</h2>
			</div>
			<div
				v-for="action in visibleLookupActions"
				:key="action.id"
				class="surface-row"
			>
				<div class="flex flex-wrap gap-2 items-center">
					<SafeExternalLink v-if="action.kind !== 'ballot-guide' && action.url" :href="action.url" class="text-sm text-app-accent font-semibold underline underline-offset-3 inline-flex gap-2 items-center focus-ring">
						{{ action.title }}
						<span class="i-carbon-launch" aria-hidden="true" />
					</SafeExternalLink>
					<p v-else class="text-sm text-app-ink font-semibold dark:text-app-text-dark">
						{{ action.title }}
					</p>
					<span
						v-if="action.badge"
						class="text-xs text-app-muted font-semibold dark:text-app-muted-dark"
					>
						{{ action.badge }}
					</span>
				</div>
				<p v-if="action.description" class="text-sm text-app-muted leading-6 mt-2 dark:text-app-muted-dark">
					{{ action.description }}
				</p>
				<div v-if="action.kind === 'ballot-guide'" class="mt-4 flex flex-wrap gap-3">
					<button
						v-if="action.kind === 'ballot-guide'"
						type="button"
						class="btn-primary"
						@click="openGuideAction(action)"
					>
						<span class="i-carbon-arrow-right" />
						{{ lookupPresentation.guideActionLabel }}
					</button>
				</div>
			</div>
		</div>
		<section
			v-if="!resultsPage && lookup.result === 'resolved' && (representativeCards.length || lookup.districtMatches.length)"
			class="mt-8 gap-4 grid items-start xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]"
			aria-label="Your officials and districts"
		>
			<RepresentativeGrid v-if="representativeCards.length" :cards="representativeCards" />
			<DistrictLadder
				v-if="lookup.districtMatches.length"
				:links="districtLinks"
				:lookup-input-kind="lookup.inputKind"
				:matches="lookup.districtMatches"
				:normalized-address="lookup.normalizedAddress"
			/>
		</section>
		<div v-if="lookupPresentation.canOpenGuide && lookup.location && lookup.electionSlug && !availabilityItems.length" class="mt-4 flex flex-wrap gap-3">
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
	</div>
</template>
