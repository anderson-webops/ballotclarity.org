<script setup lang="ts">
import type {
	BallotResponse,
	ElectionsResponse,
	LocationLookupAction,
	LocationLookupResponse,
	LocationLookupSelectionOption,
	NationwideLookupResultContext
} from "~/types/civic";
import { storeToRefs } from "pinia";
import { defineAsyncComponent } from "vue";
import FactStatCard from "~/components/graphics/FactStatCard.vue";
import { contactEmail } from "~/constants";
import { buildLocationGuessUiContent } from "~/utils/location-guess";
import { buildPublishedGuideDestination } from "~/utils/location-lookup";
import { buildHomeExperienceState, normalizeLookupResponseForDisplay, resolveLookupDestination } from "~/utils/nationwide-results";

const api = useApiClient();
const siteUrl = useSiteUrl();
const civicStore = useCivicStore();
const { selectedElection, selectedLocation } = storeToRefs(civicStore);
const { activeNationwideResult, hasGuideShellContext, hasNationwideResultContext, hasVerifiedGuideContext } = useGuideEntryGate();
const AsyncHomeBallotPreviewSection = defineAsyncComponent(() => import("~/components/home/HomeBallotPreviewSection.vue"));
const AsyncHomeRoadmapSection = defineAsyncComponent(() => import("~/components/home/HomeRoadmapSection.vue"));
const AsyncHomeCoverageOverviewSection = defineAsyncComponent(() => import("~/components/home/HomeCoverageOverviewSection.vue"));
const { data: dataSources } = await useDataSources();
const { data: coverageData } = await useCoverage();
const featuredLaunchTarget = computed(() => coverageData.value?.launchTarget ?? dataSources.value?.launchTarget ?? null);
const homeLookupResult = ref<NationwideLookupResultContext | null>(null);
const homeLookupSelectionError = ref("");
const displayedHomeLookupResult = computed(() => homeLookupResult.value);

const { data: electionsData } = await useAsyncData<ElectionsResponse>(
	"home-elections",
	() => api<ElectionsResponse>("/elections")
);
const featuredElection = computed(() => electionsData.value?.elections[0] ?? null);
const hasFeaturedGuide = computed(() => Boolean(featuredElection.value));
const locationGuessUi = computed(() => buildLocationGuessUiContent(coverageData.value?.locationGuess ?? null));
const roadmapPreview = computed(() => dataSources.value?.categories.slice(0, 3) ?? []);
const guideBallotPath = computed(() => {
	const activeGuideElection = selectedElection.value ?? featuredElection.value;

	return activeGuideElection ? `/ballot/${activeGuideElection.slug}` : "/ballot";
});
const guideOverviewPath = computed(() => {
	const activeGuideElection = selectedElection.value ?? featuredElection.value;

	return activeGuideElection ? `/elections/${activeGuideElection.slug}` : "/coverage";
});
const guideLocationPath = computed(() => selectedLocation.value?.slug ? `/locations/${selectedLocation.value.slug}` : "/coverage");
const homeExperience = computed(() => buildHomeExperienceState(
	hasNationwideResultContext.value,
	hasGuideShellContext.value,
	hasVerifiedGuideContext.value
));
const shouldShowFeaturedGuidePreview = computed(() => homeExperience.value.showFeaturedGuidePreview && hasFeaturedGuide.value);

const { data: ballotPreview } = await useAsyncData<BallotResponse | null>(
	"home-preview-ballot",
	() => shouldShowFeaturedGuidePreview.value && featuredElection.value
		? api<BallotResponse>("/ballot", {
				query: {
					election: featuredElection.value.slug
				}
			})
		: Promise.resolve(null),
	{
		default: () => null,
		watch: [featuredElection, shouldShowFeaturedGuidePreview]
	}
);
const startHerePrimaryPath = computed(() => hasVerifiedGuideContext.value
	? guideBallotPath.value
	: hasGuideShellContext.value
		? guideOverviewPath.value
		: homeExperience.value.startHerePrimaryPath);
const startHerePrimaryLabel = computed(() => homeExperience.value.startHerePrimaryLabel);
const startHereSecondaryPath = computed(() => hasVerifiedGuideContext.value
	? "/plan"
	: hasGuideShellContext.value
		? guideLocationPath.value
		: hasNationwideResultContext.value
			? "/coverage"
			: "/coverage");
const startHereSecondaryLabel = computed(() => hasVerifiedGuideContext.value
	? "Open ballot plan"
	: hasGuideShellContext.value
		? "Open location hub"
		: hasNationwideResultContext.value
			? "Check coverage"
			: "Check coverage");
const faqEntries = [
	{
		answer: "Start with the location lookup. Ballot Clarity shows districts, representatives, official election links, and a local guide when one is published for your area.",
		question: "How should a voter use Ballot Clarity?"
	},
	{
		answer: "No. Ballot Clarity is designed as a nonpartisan public-interest guide that separates neutral summaries, evidence links, and methodology from advocacy.",
		question: "Does Ballot Clarity endorse candidates or measures?"
	},
	{
		answer: "Each major page links back to source files, official records, or clearly labeled archive materials so readers can verify the underlying evidence directly.",
		question: "Where does the site get its ballot information?"
	}
];

usePageSeo({
	description: "Understand who is on your ballot, what candidates and measures actually say and do, and where the supporting information comes from.",
	jsonLd: [
		{
			"@context": "https://schema.org",
			"@type": "Organization",
			"contactPoint": [
				{
					"@type": "ContactPoint",
					"contactType": "editorial",
					"email": `mailto:${contactEmail}`
				}
			],
			"description": "A nonprofit, nonpartisan website providing source-cited ballot and voting information for local elections.",
			"name": "Ballot Clarity",
			"url": `${siteUrl}/`
		},
		{
			"@context": "https://schema.org",
			"@type": "WebSite",
			"description": "A nonprofit, nonpartisan website providing source-cited ballot and voting information for local elections.",
			"name": "Ballot Clarity",
			"url": `${siteUrl}/`
		},
		{
			"@context": "https://schema.org",
			"@type": "FAQPage",
			"mainEntity": faqEntries.map(entry => ({
				"@type": "Question",
				"acceptedAnswer": {
					"@type": "Answer",
					"text": entry.answer
				},
				"name": entry.question
			}))
		}
	],
	path: "/",
	title: "Understand Your Ballot"
});

interface PrimaryPath {
	description: string;
	label: string;
	prefetchOn?: "interaction";
	to: string;
}

const primaryPaths = computed<PrimaryPath[]>(() => [
	...(hasVerifiedGuideContext.value
		? [{
				description: "Open the local guide for your current election.",
				label: "See your ballot",
				to: guideBallotPath.value
			}]
		: hasGuideShellContext.value
			? [{
					description: "Open the election overview for official links and current guide status.",
					label: "Open election overview",
					to: guideOverviewPath.value
				}]
			: [{
					description: hasNationwideResultContext.value
						? "Return to the results for your latest lookup."
						: "Enter a location to load results for your area.",
					label: hasNationwideResultContext.value ? "Open results" : "Use location lookup",
					to: hasNationwideResultContext.value ? homeExperience.value.primaryLookupPath : "/#location-lookup"
				}]),
	{
		description: hasNationwideResultContext.value
			? "Browse district and representative pages for your area."
			: "Browse district and representative pages.",
		label: "Browse districts and representatives",
		prefetchOn: "interaction",
		to: "/districts"
	},
	{
		description: hasNationwideResultContext.value
			? "See whether a local guide is available for this area."
			: "See which public pages are available.",
		label: "Check coverage",
		prefetchOn: "interaction",
		to: "/coverage"
	}
]);

const activeDistrictCount = computed(() => activeNationwideResult.value?.districtMatches.length ?? 0);
const activeRepresentativeCount = computed(() => activeNationwideResult.value?.representativeMatches.length ?? 0);
const activeOfficialToolCount = computed(() => activeNationwideResult.value?.actions.filter(action => action.kind === "official-verification").length ?? 0);
const heroFactCards = computed(() => [
	{
		label: "Area",
		note: activeNationwideResult.value?.location
			? "The current lookup carries through district, representative, and official-tool pages."
			: "Enter a street address or ZIP code to load area-specific civic results.",
		value: activeNationwideResult.value?.location?.displayName ?? "Location lookup"
	},
	{
		label: "Districts",
		note: activeNationwideResult.value
			? "Matched districts determine which offices and ballot questions may apply."
			: "District matches appear after a lookup.",
		value: activeNationwideResult.value ? activeDistrictCount.value : "After lookup"
	},
	{
		label: "Representatives",
		note: activeNationwideResult.value
			? "Current officials are shown when provider-backed representative data is available."
			: "Current officials appear when the lookup can attach representative data.",
		value: activeNationwideResult.value ? activeRepresentativeCount.value : "After lookup"
	},
	{
		label: "Official tools",
		note: activeNationwideResult.value
			? "Official election links stay visible so voters can verify logistics with the final authority."
			: "Official election links are included where provider data returns them.",
		value: activeNationwideResult.value ? activeOfficialToolCount.value : "Included"
	}
]);
const lookupFlowSteps = computed(() => [
	{
		detail: activeNationwideResult.value?.normalizedAddress
			? activeNationwideResult.value.normalizedAddress
			: "Start with a ZIP or full street address.",
		label: "1. Confirm area",
		value: activeNationwideResult.value?.location?.state ?? "Lookup"
	},
	{
		detail: activeNationwideResult.value
			? "District matches determine which offices and ballot pages are relevant."
			: "District results appear after the area resolves.",
		label: "2. Match districts",
		value: activeNationwideResult.value ? activeDistrictCount.value : "Pending"
	},
	{
		detail: activeNationwideResult.value
			? "Representative records are linked to profile pages where available."
			: "Current officials appear when provider-backed data is available.",
		label: "3. Show people",
		value: activeNationwideResult.value ? activeRepresentativeCount.value : "Pending"
	},
	{
		detail: hasVerifiedGuideContext.value
			? "A verified local ballot guide is available for this context."
			: hasGuideShellContext.value
				? "An election overview is available even while contest pages remain under review."
				: "Official tools stay visible even where a full local guide is not published.",
		label: "4. Verify next steps",
		value: hasVerifiedGuideContext.value ? "Guide" : hasGuideShellContext.value ? "Overview" : activeOfficialToolCount.value || "Tools"
	}
]);

function clearHomeLookupResult() {
	homeLookupSelectionError.value = "";
	homeLookupResult.value = null;
}

function handleHomeLookupResolved(lookup: NationwideLookupResultContext) {
	homeLookupSelectionError.value = "";
	homeLookupResult.value = lookup;
}

async function openHomeLookupAction(action: LocationLookupAction) {
	if (action.kind !== "ballot-guide" || !action.location || !action.electionSlug)
		return;

	const destination = buildPublishedGuideDestination({
		electionSlug: action.electionSlug,
		guideAvailability: displayedHomeLookupResult.value?.guideAvailability,
		guideContent: displayedHomeLookupResult.value?.guideContent,
		location: action.location,
		selectionOptions: []
	});

	if (destination)
		await navigateTo(destination);
}

async function selectHomeLookupOption(option: LocationLookupSelectionOption) {
	const currentLookup = displayedHomeLookupResult.value;
	const queryValue = currentLookup?.lookupQuery || currentLookup?.normalizedAddress || "";

	if (!queryValue.trim()) {
		homeLookupSelectionError.value = "Enter the location again to load this matched area.";
		return;
	}

	homeLookupSelectionError.value = "";

	try {
		const response = await api<LocationLookupResponse>("/location", {
			body: {
				q: queryValue,
				selectionId: option.id
			},
			method: "POST"
		});
		const normalizedResult = normalizeLookupResponseForDisplay(response, featuredElection.value ?? null);
		civicStore.setLookupResponse(response, featuredElection.value ?? null);
		homeLookupResult.value = normalizedResult;

		const redirectTarget = resolveLookupDestination(response);

		if (redirectTarget)
			await navigateTo(redirectTarget);
		else if (response.location && response.electionSlug)
			await navigateTo(buildPublishedGuideDestination(response) ?? `/elections/${response.electionSlug}`);
	}
	catch (error) {
		homeLookupSelectionError.value = error instanceof Error ? error.message : "Unable to load that matched area right now.";
	}
}
</script>

<template>
	<div class="home-page pb-10 space-y-12 sm:space-y-16">
		<section class="home-section app-shell">
			<div class="home-hero-grid gap-6 grid xl:grid-cols-[minmax(0,1.18fr)_minmax(21rem,0.82fr)] xl:items-start">
				<div class="home-card border border-app-line rounded-[2.2rem] bg-white shadow-[0_36px_84px_-58px_rgba(16,37,62,0.62)] overflow-hidden dark:border-app-line-dark dark:bg-app-panel-dark">
					<div class="px-6 py-8 lg:px-10 sm:px-8 sm:py-10">
						<p class="text-xs text-app-muted tracking-[0.26em] font-semibold uppercase dark:text-app-muted-dark">
							{{ hasVerifiedGuideContext ? "Ballot guide" : hasGuideShellContext ? "Election overview" : hasNationwideResultContext ? "Civic results" : "Location lookup" }}
						</p>
						<h1 class="text-5xl text-app-ink leading-tight font-serif mt-4 max-w-4xl sm:text-6xl dark:text-app-text-dark">
							{{ hasVerifiedGuideContext
								? "Your ballot guide is ready."
								: hasGuideShellContext
									? "Your election overview is ready."
									: hasNationwideResultContext
										? "Your civic results are ready."
										: "Look up your area." }}
						</h1>
						<p class="bc-measure text-lg text-app-muted leading-8 mt-6 dark:text-app-muted-dark">
							{{ hasVerifiedGuideContext
								? "Open your ballot, districts, representatives, and official election links from one place."
								: hasGuideShellContext
									? "Open the election overview, districts, representatives, and official election links for this area."
									: hasNationwideResultContext
										? "Review districts, current officials, official election links, and any available local guide for this area."
										: "Enter a street address or ZIP code to see districts, current officials, and official election links for your area." }}
						</p>
						<p v-if="featuredLaunchTarget" class="text-sm text-app-muted leading-7 mt-5 dark:text-app-muted-dark">
							<strong class="text-app-ink dark:text-app-text-dark">Published local guide:</strong> {{ featuredLaunchTarget.displayName }}.
						</p>
						<p v-else class="text-sm text-app-muted leading-7 mt-5 dark:text-app-muted-dark">
							<strong class="text-app-ink dark:text-app-text-dark">Local guide status:</strong> Nationwide lookup is available; deeper local guide depth appears where published.
						</p>
						<p v-if="activeNationwideResult?.location" class="text-sm text-app-muted leading-7 mt-4 dark:text-app-muted-dark">
							<strong class="text-app-ink dark:text-app-text-dark">Current lookup:</strong> {{ activeNationwideResult.location.displayName }}. These results stay available across the site until you change location.
						</p>

						<div class="mt-8 gap-4 grid xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
							<div class="gap-4 grid md:grid-cols-2">
								<FactStatCard
									v-for="item in heroFactCards"
									:key="item.label"
									:label="item.label"
									:note="item.note"
									:value="item.value"
								/>
							</div>
							<div class="px-4 py-4 border border-app-line/80 rounded-[1.4rem] bg-app-bg/75 dark:border-app-line-dark dark:bg-app-bg-dark/60">
								<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
									What the lookup answers
								</p>
								<p class="text-sm text-app-muted leading-6 mt-3 dark:text-app-muted-dark">
									This path shows the civic questions Ballot Clarity answers from a location before any product-status or methodology pages.
								</p>
								<div class="mt-4 gap-3 grid">
									<article
										v-for="step in lookupFlowSteps"
										:key="step.label"
										class="px-3 py-3 border border-app-line/70 rounded-[1rem] bg-white/85 dark:border-app-line-dark dark:bg-app-panel-dark/80"
									>
										<div class="flex flex-wrap gap-3 items-start justify-between">
											<p class="text-sm text-app-ink font-semibold dark:text-app-text-dark">
												{{ step.label }}
											</p>
											<span class="text-[11px] text-app-muted tracking-[0.14em] font-semibold px-2.5 py-1 rounded-full bg-app-bg uppercase dark:text-app-muted-dark dark:bg-app-bg-dark/70">
												{{ step.value }}
											</span>
										</div>
										<p class="text-sm text-app-muted leading-6 mt-2 dark:text-app-muted-dark">
											{{ step.detail }}
										</p>
									</article>
								</div>
							</div>
						</div>
					</div>
				</div>

				<div class="home-panel-stack space-y-5">
					<div id="location-lookup" class="home-card surface-panel">
						<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
							Choose your area
						</p>
						<h2 class="text-2xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
							Start from your location.
						</h2>
						<p class="text-sm text-app-muted leading-7 mt-4 dark:text-app-muted-dark">
							{{ locationGuessUi.home }}
						</p>
						<div class="mt-5">
							<AddressLookupForm
								compact
								:election="featuredElection"
								:framed="false"
								:show-inline-results="false"
								@lookup-cleared="clearHomeLookupResult"
								@lookup-resolved="handleHomeLookupResolved"
							/>
						</div>
					</div>

					<div class="home-card surface-panel">
						<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
							Popular pages
						</p>
						<h2 class="text-2xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
							Open the page you need.
						</h2>
						<div class="mt-6 flex flex-wrap gap-3">
							<NuxtLink :to="startHerePrimaryPath" class="btn-primary" prefetch-on="interaction">
								{{ startHerePrimaryLabel }}
							</NuxtLink>
							<NuxtLink :to="startHereSecondaryPath" class="btn-secondary" prefetch-on="interaction">
								{{ startHereSecondaryLabel }}
							</NuxtLink>
						</div>
					</div>
				</div>
			</div>
		</section>

		<section v-if="displayedHomeLookupResult" class="home-section app-shell">
			<div class="home-lookup-results-shell surface-panel">
				<LookupResultsPanel
					class="home-lookup-results-panel"
					:compact="false"
					:lookup="displayedHomeLookupResult"
					@open-guide="openHomeLookupAction"
					@select-option="selectHomeLookupOption"
				/>
				<p
					v-if="homeLookupSelectionError"
					role="alert"
					class="text-sm text-[#8f341f] mt-4 dark:text-[#f2a493]"
				>
					{{ homeLookupSelectionError }}
				</p>
			</div>
		</section>

		<section class="home-section app-shell">
			<div class="home-split-grid gap-6 grid lg:grid-cols-[minmax(0,0.52fr)_minmax(0,1fr)] lg:items-start">
				<div>
					<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
						Start here
					</p>
					<h2 class="text-4xl text-app-ink font-serif mt-3 max-w-xl dark:text-app-text-dark">
						Choose the page you need.
					</h2>
				</div>

				<div class="home-path-list divide-app-line divide-y dark:divide-app-line-dark">
					<NuxtLink
						v-for="path in primaryPaths"
						:key="path.label"
						:to="path.to"
						:prefetch-on="path.prefetchOn"
						class="py-5 flex flex-col gap-3 transition hover:text-app-accent focus-ring"
					>
						<div class="flex gap-4 items-center justify-between">
							<h3 class="text-2xl text-app-ink font-serif dark:text-app-text-dark">
								{{ path.label }}
							</h3>
							<span class="i-carbon-arrow-right text-lg text-app-accent" aria-hidden="true" />
						</div>
						<p class="text-sm text-app-muted leading-7 max-w-3xl dark:text-app-muted-dark">
							{{ path.description }}
						</p>
					</NuxtLink>
				</div>
			</div>
		</section>

		<section class="app-shell section-gap">
			<div class="surface-panel flex flex-col gap-5 justify-between lg:flex-row lg:items-center">
				<div class="max-w-3xl">
					<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
						Verify the path
					</p>
					<h2 class="text-3xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
						Sources and product coverage live off the main reading path.
					</h2>
					<p class="text-sm text-app-muted leading-7 mt-4 dark:text-app-muted-dark">
						The homepage now keeps voter-facing lookup answers first. Open the source directory or coverage profile when you want the full provenance and availability record.
					</p>
				</div>
				<div class="flex flex-wrap gap-3">
					<NuxtLink to="/sources" class="btn-primary" prefetch-on="interaction">
						Open sources
					</NuxtLink>
					<NuxtLink to="/coverage" class="btn-secondary" prefetch-on="interaction">
						Open coverage
					</NuxtLink>
				</div>
			</div>
		</section>

		<DeferredSection placeholder-class="min-h-[10rem] sm:min-h-[14rem]">
			<AsyncHomeBallotPreviewSection
				:allow-guide-entry-points="hasVerifiedGuideContext"
				:ballot-preview="shouldShowFeaturedGuidePreview ? ballotPreview : null"
				:featured-election-slug="featuredElection?.slug ?? null"
				:nationwide-lookup-result="displayedHomeLookupResult ? null : activeNationwideResult"
				:show-featured-guide-preview="shouldShowFeaturedGuidePreview"
			/>
		</DeferredSection>

		<DeferredSection placeholder-class="min-h-[8rem] sm:min-h-[10rem]">
			<AsyncHomeRoadmapSection :roadmap-preview="roadmapPreview" />
		</DeferredSection>

		<DeferredSection placeholder-class="min-h-[8rem] sm:min-h-[10rem]">
			<AsyncHomeCoverageOverviewSection />
		</DeferredSection>
	</div>
</template>
