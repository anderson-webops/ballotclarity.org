<script setup lang="ts">
import type {
	ElectionsResponse,
	LocationLookupAction,
	LocationLookupResponse,
	LocationLookupSelectionOption,
	NationwideLookupResultContext
} from "~/types/civic";
import FactStatCard from "~/components/graphics/FactStatCard.vue";
import { buildLocationGuessUiContent } from "~/utils/location-guess";
import { buildPublishedGuideDestination } from "~/utils/location-lookup";
import { normalizeLookupResponseForDisplay, resolveLookupDestination } from "~/utils/nationwide-results";

const api = useApiClient();
const siteUrl = useSiteUrl();
const civicStore = useCivicStore();
const { activeNationwideResult, hasGuideShellContext, hasNationwideResultContext, hasVerifiedGuideContext } = useGuideEntryGate();
const { data: coverageData } = await useCoverage();
const homeLookupResult = ref<NationwideLookupResultContext | null>(null);
const homeLookupSelectionError = ref("");
const displayedHomeLookupResult = computed(() => homeLookupResult.value);

const { data: electionsData } = await useAsyncData<ElectionsResponse>(
	"home-elections",
	() => api<ElectionsResponse>("/elections")
);
const featuredElection = computed(() => electionsData.value?.elections[0] ?? null);
const locationGuessUi = computed(() => buildLocationGuessUiContent(coverageData.value?.locationGuess ?? null));
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
					"url": `${siteUrl}/contact`
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
				<div class="home-card surface-primary overflow-hidden">
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
					<div id="location-lookup" class="home-card surface-primary">
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
	</div>
</template>
