<script setup lang="ts">
import { storeToRefs } from "pinia";
import { buildCompareRoute } from "~/stores/civic";

const year = new Date().getFullYear();
const civicStore = useCivicStore();
const { hasGuideShellContext, hasNationwideResultContext, hasVerifiedGuideContext } = useGuideEntryGate();
const { compareList, isHydrated } = storeToRefs(civicStore);
const effectiveCompareList = computed(() => isHydrated.value ? compareList.value : []);
const selectedElection = computed(() => civicStore.selectedElection);
const selectedLocation = computed(() => civicStore.selectedLocation);
const electionOverviewPath = computed(() => selectedElection.value?.slug ? `/elections/${selectedElection.value.slug}` : "/coverage");
const locationHubPath = computed(() => selectedLocation.value?.slug ? `/locations/${selectedLocation.value.slug}` : "/coverage");
const primarySectionLabel = computed(() => hasVerifiedGuideContext.value
	? "Use the guide"
	: hasGuideShellContext.value
		? "Use the election overview"
		: hasNationwideResultContext.value
			? "Explore active results"
			: "Start with lookup");

const guideLinks = computed(() => hasVerifiedGuideContext.value
	? [
			{ label: "My ballot plan", to: "/plan" },
			{ label: "Ballot guide", to: "/ballot" },
			{ label: "Compare candidates", to: "/compare" },
			{ label: "District pages", to: "/districts" },
			{ label: "Representatives", to: "/representatives" },
			{ label: "Search", to: "/search" },
		]
	: hasGuideShellContext.value
		? [
				{ label: "Election overview", to: electionOverviewPath.value },
				{ label: "Location hub", to: locationHubPath.value },
				{ label: "District pages", to: "/districts" },
				{ label: "Representatives", to: "/representatives" },
				{ label: "Search", to: "/search" },
			]
		: [
				...(hasNationwideResultContext.value
					? [{ label: "Results", to: "/results" }]
					: [{ label: "Location lookup", to: "/" }]),
				{ label: "District pages", to: "/districts" },
				{ label: "Representatives", to: "/representatives" },
				{ label: "Search", to: "/search" },
			]);

const discoveryLinks = [
	{ label: "About", to: "/about" },
	{ label: "Coverage profile", to: "/coverage" },
	{ label: "Source directory", to: "/sources" },
	{ label: "Voting FAQ", to: "/help" },
];

const policyLinks = [
	{ label: "Methodology", to: "/methodology" },
	{ label: "Data sources", to: "/data-sources" },
	{ label: "Neutrality policy", to: "/neutrality" },
	{ label: "Accessibility", to: "/accessibility" },
	{ label: "Privacy", to: "/privacy" },
	{ label: "Terms", to: "/terms" },
];

function resolveGuideLinkTo(path: string) {
	return path === "/compare"
		? buildCompareRoute(effectiveCompareList.value)
		: path;
}
</script>

<template>
	<footer class="py-10 border-t border-app-line/80 bg-white/80 dark:border-app-line-dark dark:bg-app-panel-dark/55">
		<div class="app-shell">
			<div class="gap-6 grid lg:gap-8 xl:grid-cols-[minmax(0,1.12fr)_minmax(0,0.88fr)] xl:items-start">
				<div class="max-w-3xl">
					<p class="text-2xl text-app-ink font-serif mt-1 dark:text-app-text-dark">
						Ballot Clarity
					</p>
					<p class="bc-measure text-base text-app-muted mt-4 dark:text-app-muted-dark">
						Ballot Clarity is a nonprofit civic-information site built to help people look up their area, review the public record, and verify details with official sources.
					</p>

					<div class="mt-7 p-4 border border-app-line/80 rounded-[1.5rem] bg-app-bg/70 max-w-2xl dark:border-app-line-dark dark:bg-app-bg-dark/70">
						<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
							Contact
						</p>
						<div class="text-sm text-app-muted mt-4 space-y-4 dark:text-app-muted-dark">
							<p>
								Questions, corrections, and volunteer help welcome.
							</p>
							<p>
								<ProtectedEmailLink
									loading-label="Email link loads in your browser."
									loading-class="text-app-muted dark:text-app-muted-dark"
									link-class="text-app-ink font-semibold rounded-md transition dark:text-app-text-dark hover:text-app-accent focus-ring dark:hover:text-white"
									subject="Ballot Clarity inquiry"
								/>
							</p>
							<NuxtLink to="/contact" prefetch-on="interaction" class="text-app-ink font-semibold rounded-md inline-flex gap-2 transition items-center dark:text-app-text-dark hover:text-app-accent focus-ring dark:hover:text-white">
								<span>Open contact page</span>
								<span class="i-carbon-arrow-right" aria-hidden="true" />
							</NuxtLink>
						</div>
					</div>
				</div>

				<div class="gap-x-8 gap-y-7 grid sm:grid-cols-2 xl:grid-cols-3">
					<div>
						<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
							{{ primarySectionLabel }}
						</p>
						<ul class="text-sm mt-4 space-y-3">
							<li v-for="link in guideLinks" :key="link.to">
								<NuxtLink :to="resolveGuideLinkTo(link.to)" prefetch-on="interaction" class="text-app-ink rounded-md transition dark:text-app-text-dark hover:text-app-accent focus-ring dark:hover:text-white">
									{{ link.label }}
								</NuxtLink>
							</li>
						</ul>
					</div>

					<div>
						<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
							Learn and verify
						</p>
						<ul class="text-sm mt-4 space-y-3">
							<li v-for="link in discoveryLinks" :key="link.to">
								<NuxtLink :to="link.to" prefetch-on="interaction" class="text-app-ink rounded-md transition dark:text-app-text-dark hover:text-app-accent focus-ring dark:hover:text-white">
									{{ link.label }}
								</NuxtLink>
							</li>
						</ul>
					</div>

					<div>
						<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
							Standards
						</p>
						<ul class="text-sm mt-4 space-y-3">
							<li v-for="link in policyLinks" :key="link.to">
								<NuxtLink :to="link.to" prefetch-on="interaction" class="text-app-ink rounded-md transition dark:text-app-text-dark hover:text-app-accent focus-ring dark:hover:text-white">
									{{ link.label }}
								</NuxtLink>
							</li>
						</ul>
					</div>
				</div>
			</div>

			<div class="mt-7 pt-4 border-t border-app-line/80 flex flex-col gap-3 dark:border-app-line-dark lg:flex-row lg:items-center lg:justify-between">
				<div class="flex flex-col gap-3">
					<p class="text-sm text-app-muted max-w-4xl dark:text-app-muted-dark">
						Not an official election website. Ballot Clarity aims to provide nonpartisan civic information and cite sources where possible. Content can change, so verify critical election details with the official authorities linked throughout the site.
					</p>
					<div class="flex flex-wrap gap-x-5 gap-y-2 items-center">
						<DataVerificationLauncher />
						<NuxtLink to="/status" prefetch-on="interaction" class="text-sm text-app-ink font-semibold rounded-md inline-flex gap-2 transition items-center dark:text-app-text-dark hover:text-app-accent focus-ring dark:hover:text-white">
							Public status
						</NuxtLink>
						<NuxtLink to="/corrections" prefetch-on="interaction" class="text-sm text-app-ink font-semibold rounded-md inline-flex gap-2 transition items-center dark:text-app-text-dark hover:text-app-accent focus-ring dark:hover:text-white">
							Corrections log
						</NuxtLink>
					</div>
				</div>
				<div class="flex flex-col gap-3 items-start lg:items-end">
					<div class="max-w-[28rem] w-full lg:w-[13rem]">
						<ClientOnly>
							<ThemeSchemePicker compact align="end" panel-align="end" />
							<template #fallback>
								<div class="px-4 py-3 border border-app-line rounded-full bg-app-panel h-12 w-full dark:border-app-line-dark dark:bg-app-panel-dark" />
							</template>
						</ClientOnly>
					</div>
					<p class="text-sm text-app-muted whitespace-nowrap dark:text-app-muted-dark">
						© {{ year }} Ballot Clarity
					</p>
				</div>
			</div>
		</div>
	</footer>
</template>
