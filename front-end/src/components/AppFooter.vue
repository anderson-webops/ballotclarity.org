<script setup lang="ts">
import { storeToRefs } from "pinia";
import { buildCompareRoute } from "~/stores/civic";
import { ballotInformationDisclaimer } from "~/utils/ballot-notices";

const year = new Date().getFullYear();
const civicStore = useCivicStore();
const { hasGuideShellContext, hasNationwideResultContext, hasVerifiedGuideContext } = useGuideEntryGate();
const { compareList, isHydrated } = storeToRefs(civicStore);
const effectiveCompareList = computed(() => isHydrated.value ? compareList.value : []);
const selectedElection = computed(() => civicStore.selectedElection);
const electionOverviewPath = computed(() => selectedElection.value?.slug ? `/elections/${selectedElection.value.slug}` : "/coverage");
const primarySectionLabel = computed(() => hasVerifiedGuideContext.value || hasGuideShellContext.value || hasNationwideResultContext.value
	? "Your guide"
	: "Get started");

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

const howItWorksLinks = [
	{ label: "Directory", to: "/search?type=candidate" },
	{ label: "Sources", to: "/sources" },
	{ label: "Coverage", to: "/coverage" },
];

const projectLinks = [
	{ label: "Voting help", to: "/help" },
	{ label: "About", to: "/about" },
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
	<footer class="py-10 border-t border-app-line bg-app-panel dark:border-app-line-dark dark:bg-app-panel-dark">
		<div class="app-shell">
			<div class="gap-x-8 gap-y-8 grid lg:grid-cols-[minmax(0,1.3fr)_repeat(3,minmax(0,1fr))] sm:grid-cols-2">
				<div>
					<p class="text-lg text-app-ink font-serif dark:text-app-text-dark">
						Ballot Clarity
					</p>
					<p class="text-sm mt-3">
						<ProtectedEmailLink
							loading-label="Email link loads in your browser."
							loading-class="text-app-muted dark:text-app-muted-dark"
							link-class="text-app-ink font-semibold rounded-sm transition dark:text-app-text-dark hover:text-app-accent focus-ring"
							subject="Ballot Clarity inquiry"
						/>
					</p>
				</div>

				<nav :aria-label="primarySectionLabel">
					<p class="text-sm text-app-muted font-semibold dark:text-app-muted-dark">
						{{ primarySectionLabel }}
					</p>
					<ul class="text-sm mt-3 space-y-2">
						<li v-for="link in guideLinks" :key="link.to">
							<NuxtLink :to="resolveGuideLinkTo(link.to)" prefetch-on="interaction" class="text-app-ink rounded-sm transition dark:text-app-text-dark hover:text-app-accent focus-ring">
								{{ link.label }}
							</NuxtLink>
						</li>
					</ul>
				</nav>

				<nav aria-label="Sources and coverage">
					<p class="text-sm text-app-muted font-semibold dark:text-app-muted-dark">
						Sources and coverage
					</p>
					<ul class="text-sm mt-3 space-y-2">
						<li v-for="link in howItWorksLinks" :key="link.to">
							<NuxtLink :to="link.to" prefetch-on="interaction" class="text-app-ink rounded-sm transition dark:text-app-text-dark hover:text-app-accent focus-ring">
								{{ link.label }}
							</NuxtLink>
						</li>
					</ul>
				</nav>

				<nav aria-label="Help and project">
					<p class="text-sm text-app-muted font-semibold dark:text-app-muted-dark">
						Help and project
					</p>
					<ul class="text-sm mt-3 space-y-2">
						<li v-for="link in projectLinks" :key="link.to">
							<NuxtLink :to="link.to" prefetch-on="interaction" class="text-app-ink rounded-sm transition dark:text-app-text-dark hover:text-app-accent focus-ring">
								{{ link.label }}
							</NuxtLink>
						</li>
						<li>
							<NuxtLink to="/contact" prefetch-on="interaction" class="text-app-ink rounded-sm transition dark:text-app-text-dark hover:text-app-accent focus-ring">
								Contact
							</NuxtLink>
						</li>
					</ul>
				</nav>
			</div>

			<div class="text-sm text-app-muted mt-10 pt-4 border-t border-app-line flex flex-wrap gap-x-6 gap-y-3 items-center justify-between dark:text-app-muted-dark dark:border-app-line-dark">
				<p class="max-w-3xl">
					{{ ballotInformationDisclaimer }}
				</p>
				<div class="flex flex-wrap gap-x-5 gap-y-2 items-center">
					<DataVerificationLauncher />
					<NuxtLink to="/status" prefetch-on="interaction" class="text-app-ink rounded-sm transition dark:text-app-text-dark hover:text-app-accent focus-ring">
						Status
					</NuxtLink>
					<NuxtLink to="/corrections" prefetch-on="interaction" class="text-app-ink rounded-sm transition dark:text-app-text-dark hover:text-app-accent focus-ring">
						Corrections
					</NuxtLink>
					<ClientOnly>
						<ThemeSchemePicker compact align="end" panel-align="end" />
					</ClientOnly>
					<span>© {{ year }} Ballot Clarity</span>
				</div>
			</div>
			<div id="page-data-updated" class="text-right" />
		</div>
	</footer>
</template>
