<script setup lang="ts">
import type {
	LocationLookupSelectionOption,
	LookupAvailabilityStatus,
	NationwideLookupResultContext
} from "~/types/civic";
import DistrictLadder from "~/components/graphics/DistrictLadder.vue";
import RepresentativeGrid from "~/components/graphics/RepresentativeGrid.vue";
import { hasBallotInformation } from "~/utils/ballot-notices";
import { buildElectionView, civicLookupNeedsRefresh, electionHasPassed } from "~/utils/ballot-view";
import { buildRepresentativeCards } from "~/utils/graphics-schema";
import { buildLookupActionDestination, buildLookupPresentation, buildPublishedGuideDestination, filterLookupActionsForPresentation } from "~/utils/location-lookup";
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
	selectOption: [option: LocationLookupSelectionOption];
}>();
const { formatDate } = useFormatters();
const electionClock = useElectionClock();
const { data: sourceDirectory } = await useStateRecordStates();
const sourceDates = computed(() => sourceDirectory.value?.states?.find(state => state.stateCode === props.lookup.location?.state || state.stateName === props.lookup.location?.state)?.sources?.map(source => source.electionDate) ?? []);
const electionView = computed(() => buildElectionView(props.lookup, new Date(electionClock.value), sourceDates.value));
const displayedLookup = computed(() => ({ ...props.lookup, ballotContentPreviews: electionView.value.previews, guideContent: electionHasPassed(props.lookup.election?.date, new Date(electionClock.value)) ? null : props.lookup.guideContent }));
const NuxtLinkComponent = resolveComponent("NuxtLink");

const lookupResolution = computed(() => ({
	electionSlug: props.lookup.electionSlug,
	guideContent: props.lookup.guideContent,
	guideAvailability: props.lookup.guideAvailability,
	location: props.lookup.location ?? undefined,
	result: props.lookup.result,
	selectionOptions: props.lookup.selectionOptions
}));
const lookupPresentation = computed(() => buildLookupPresentation(lookupResolution.value));
const visibleLookupActions = computed(() => filterLookupActionsForPresentation(props.lookup.actions, lookupResolution.value));
const guideLinks = computed(() => visibleLookupActions.value.flatMap((action) => {
	const href = buildLookupActionDestination(action, lookupResolution.value);
	return href ? [{ action, href }] : [];
}));
const officialLookupActions = computed(() => visibleLookupActions.value.filter(action => action.kind === "official-verification"));
const selectedGuideHref = computed(() => props.lookup.result === "resolved" && !props.lookup.selectionOptions.length ? buildPublishedGuideDestination(lookupResolution.value) : null);
const representativeCards = computed(() => electionView.value.betweenElections && civicLookupNeedsRefresh(props.lookup, new Date(electionClock.value))
	? []
	: buildRepresentativeCards(props.lookup.representativeMatches).map((card, index) => {
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
const electionLogistics = computed(() => electionHasPassed(props.lookup.electionLogistics?.electionDay, new Date(electionClock.value)) ? null : props.lookup.electionLogistics);
const ballotContentPreviews = computed(() => electionView.value.previews);
const hasBallotContentPreviews = computed(() => ballotContentPreviews.value.length > 0);
const primaryAvailabilityIds = new Set(["official-logistics", "representatives", "local-guide"]);
const hasElectionLogistics = computed(() => Boolean(
	electionLogistics.value
	&& (
		electionLogistics.value.electionName
		|| electionLogistics.value.electionDay
		|| electionLogistics.value.pollingLocations.length
		|| electionLogistics.value.earlyVoteSites.length
		|| electionLogistics.value.dropOffLocations.length
		|| electionLogistics.value.candidatePreviews?.length
		|| electionLogistics.value.additionalElectionNames.length
		|| electionLogistics.value.mailOnly
	)
));
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
			actionLabel: props.lookup.guideContent?.verifiedContestPackage ? "View ballot" : "Election information",
			href: buildLocalGuideHref(),
			id: "local-guide",
			item: props.lookup.availability.fullLocalGuide,
			title: props.lookup.guideContent?.verifiedContestPackage ? "Ballot" : "Your election",
		},
	];
});
const visibleAvailabilityItems = computed(() => availabilityItems.value.filter((card) => {
	if (electionView.value.betweenElections && ["local-guide", "ballot-candidates", "civic-results"].includes(card.id)) return false;
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
		<section v-if="electionView.betweenElections && lookup.result === 'resolved'" aria-label="Representatives" class="mb-8">
			<RepresentativeGrid v-if="representativeCards.length" :cards="representativeCards" title="Representatives" note="" />
			<NuxtLink v-else :to="buildLookupAwareTarget('/representatives')" class="text-lg text-app-accent font-semibold underline underline-offset-3 focus-ring">
				Representatives
			</NuxtLink>
		</section>
		<p v-if="lookup.result === 'resolved' && !electionView.betweenElections && !hasBallotInformation(displayedLookup)" class="text-sm text-app-ink leading-6 mb-4 pl-3 border-app-line border-l-2 dark:text-app-text-dark dark:border-app-line-dark">
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
		<nav v-if="guideLinks.length" aria-label="Election guides" class="mt-6 gap-3 grid">
			<NuxtLink v-for="{ action, href } in guideLinks" :key="action.id" :to="href" class="group surface-row block focus-ring">
				<span class="text-lg text-app-accent font-semibold inline-flex gap-2 items-center">
					{{ action.title }}
					<span class="i-carbon-arrow-right transition group-hover:translate-x-0.5" aria-hidden="true" />
				</span>
				<span v-if="action.description || action.electionDate" class="text-sm text-app-muted mt-1 block dark:text-app-muted-dark">
					{{ action.description }}<template v-if="action.description && action.electionDate"> · </template><time v-if="action.electionDate" :datetime="action.electionDate">{{ formatDate(action.electionDate) }}</time>
				</span>
			</NuxtLink>
		</nav>
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
		<BallotContentPreviews v-if="hasBallotContentPreviews" :previews="ballotContentPreviews" :lookup-context="lookup" class="mt-8" />
		<nav v-if="lookup.result === 'resolved'" aria-label="Area records" class="text-base mt-5 flex flex-wrap gap-x-8 gap-y-3">
			<template v-for="preview in electionView.pastPreviews" :key="preview.id">
				<SafeExternalLink v-if="preview.sourceUrl" :href="preview.sourceUrl" class="text-app-accent font-semibold underline underline-offset-3 focus-ring">
					{{ preview.providerLabel }} · {{ preview.electionDate ? formatDate(preview.electionDate) : 'Past election' }}
				</SafeExternalLink>
			</template>
			<NuxtLink v-if="resultsPage && !electionView.betweenElections && lookup.representativeMatches.length" :to="buildLookupAwareTarget('/representatives')" class="text-app-accent font-semibold underline underline-offset-3 focus-ring">
				{{ lookup.representativeMatches.length }} representatives
			</NuxtLink>
			<NuxtLink v-if="resultsPage && lookup.districtMatches.length" :to="buildLookupAwareTarget('/districts')" class="text-app-accent font-semibold underline underline-offset-3 focus-ring">
				{{ lookup.districtMatches.length }} districts
			</NuxtLink>
		</nav>
		<div v-if="officialLookupActions.length" :id="resultsPage ? 'official-tools' : undefined" class="mt-6 gap-3 grid">
			<div v-if="resultsPage">
				<h2 class="text-2xl text-app-ink font-serif dark:text-app-text-dark">
					Official election tools
				</h2>
			</div>
			<div
				v-for="action in officialLookupActions"
				:key="action.id"
				class="surface-row"
			>
				<div class="flex flex-wrap gap-2 items-center">
					<SafeExternalLink v-if="action.url" :href="action.url" external-icon class="text-sm text-app-accent font-semibold underline underline-offset-3 inline-flex gap-2 items-center focus-ring">
						{{ action.title }}
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
			</div>
		</div>
		<section
			v-if="!resultsPage && !electionView.betweenElections && lookup.result === 'resolved' && (representativeCards.length || lookup.districtMatches.length)"
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
		<section v-if="hasElectionLogistics && electionLogistics" aria-label="Voting information" class="mt-8">
			<div v-if="hasElectionLogistics && electionLogistics" class="mt-4 gap-4 grid">
				<div class="surface-inset">
					<div class="flex flex-wrap gap-2 items-center">
						<p class="text-xs text-app-muted tracking-[0.06em] font-semibold uppercase dark:text-app-muted-dark">
							Official election logistics
						</p>
						<VerificationBadge label="Google Civic" tone="accent" />
					</div>
					<div class="mt-4 flex flex-wrap gap-3 items-center">
						<p v-if="electionLogistics.electionName" class="text-lg text-app-ink font-semibold dark:text-app-text-dark">
							{{ electionLogistics.electionName }}
						</p>
						<p v-if="electionLogistics.electionDay" class="text-sm text-app-muted dark:text-app-muted-dark">
							<span>{{ formatDate(electionLogistics.electionDay) }}</span>
						</p>
						<VerificationBadge v-if="electionLogistics.mailOnly" label="Mail-only precinct" tone="warning" />
					</div>
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
							class="content-block"
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
						<p class="text-xs text-app-muted tracking-[0.06em] font-semibold uppercase dark:text-app-muted-dark">
							Additional elections
						</p>
						<ul class="mt-2 space-y-2">
							<li v-for="name in electionLogistics.additionalElectionNames" :key="name" class="text-sm text-app-muted leading-6 dark:text-app-muted-dark">
								{{ name }}
							</li>
						</ul>
					</div>
					<div v-if="electionLogistics.candidatePreviews?.length && !hasBallotContentPreviews" class="mt-4">
						<p class="text-xs text-app-muted tracking-[0.06em] font-semibold uppercase dark:text-app-muted-dark">
							Candidate previews from Google Civic
						</p>
						<ul class="mt-3 gap-3 grid sm:grid-cols-2">
							<li
								v-for="candidate in electionLogistics.candidatePreviews.slice(0, 4)"
								:key="candidate.id"
								class="p-3 rounded-2xl bg-app-bg flex gap-3 items-start dark:bg-app-bg-dark/70"
							>
								<ProfileImageStack
									v-if="candidate.profileImages?.length"
									:images="candidate.profileImages"
									:name="candidate.name"
									size="sm"
								/>
								<div class="min-w-0">
									<p class="text-sm text-app-ink font-semibold dark:text-app-text-dark">
										{{ candidate.name }}
									</p>
									<p class="text-sm text-app-muted leading-6 dark:text-app-muted-dark">
										<PartyLabel v-if="candidate.party" :party="candidate.party" />{{ candidate.party && candidate.office ? ' · ' : '' }}{{ candidate.office }}
									</p>
									<SafeExternalLink
										v-if="candidate.candidateUrl"
										:href="candidate.candidateUrl"
										external-icon
										class="text-app-accent underline underline-offset-3 inline-flex gap-2 items-center"
									>
										Candidate link
									</SafeExternalLink>
								</div>
							</li>
						</ul>
					</div>
				</div>
			</div>
		</section>
		<div v-if="selectedGuideHref && !availabilityItems.length" class="mt-4 flex flex-wrap gap-3">
			<NuxtLink :to="selectedGuideHref" class="btn-primary">
				<span class="i-carbon-arrow-right" />
				{{ lookupPresentation.guideActionLabel }}
			</NuxtLink>
		</div>
	</div>
</template>
