<script setup lang="ts">
import { storeToRefs } from "pinia";
import { contactEmail } from "~/constants";
import { buildCompareRoute } from "~/stores/civic";

const year = new Date().getFullYear();
const civicStore = useCivicStore();
const { allowsGuideEntryPoints } = useGuideEntryGate();
const { compareList, isHydrated } = storeToRefs(civicStore);
const effectiveCompareList = computed(() => isHydrated.value ? compareList.value : []);

const guideLinks = computed(() => [
	{ label: "My ballot plan", to: "/plan" },
	{ label: "Ballot guide", to: "/ballot" },
	{ label: "Compare candidates", to: "/compare" },
	{ label: "Search", to: "/search" },
].filter(link => allowsGuideEntryPoints.value || !["/plan", "/ballot"].includes(link.to)));

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
						Ballot Clarity is a nonprofit civic-information platform focused on source-first ballot summaries, transparent methodology, and readable public-interest data.
					</p>
					<div class="mt-5 gap-3 grid sm:gap-4 sm:grid-cols-2">
						<div class="p-4 rounded-[1.35rem] bg-app-bg/70 dark:bg-app-bg-dark/70">
							<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
								What this site is for
							</p>
							<p class="text-sm text-app-muted leading-7 mt-3 dark:text-app-muted-dark">
								Readable ballot guides, candidate dossiers, measure explainers, and source access that help voters inspect the public record without overload.
							</p>
						</div>

						<div class="p-4 rounded-[1.35rem] bg-app-bg/70 dark:bg-app-bg-dark/70">
							<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
								How to use it
							</p>
							<p class="text-sm text-app-muted leading-7 mt-3 dark:text-app-muted-dark">
								{{ allowsGuideEntryPoints
									? "Start with the ballot guide, open deeper pages only when needed, and verify time-sensitive logistics with the official authorities linked throughout the site."
									: "Start with the nationwide civic results from the lookup, open deeper local guide pages only where Ballot Clarity has published coverage, and verify time-sensitive logistics with the official authorities linked throughout the site." }}
							</p>
						</div>
					</div>
				</div>

				<div class="gap-6 grid sm:grid-cols-2">
					<div>
						<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
							Use the guide
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

					<div class="p-4 border border-app-line/80 rounded-[1.5rem] bg-app-bg/70 dark:border-app-line-dark dark:bg-app-bg-dark/70 sm:col-span-2">
						<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
							Contact
						</p>
						<div class="text-sm text-app-muted mt-4 space-y-4 dark:text-app-muted-dark">
							<p>
								<a :href="`mailto:${contactEmail}`" class="text-app-ink rounded-md transition dark:text-app-text-dark hover:text-app-accent focus-ring dark:hover:text-white">
									{{ contactEmail }}
								</a>
							</p>
							<p>
								Volunteer and research inquiries welcome.
							</p>
							<NuxtLink to="/contact" prefetch-on="interaction" class="text-app-ink font-semibold rounded-md inline-flex gap-2 transition items-center dark:text-app-text-dark hover:text-app-accent focus-ring dark:hover:text-white">
								<span>Open contact page</span>
								<span class="i-carbon-arrow-right" aria-hidden="true" />
							</NuxtLink>
						</div>
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
				<p class="text-sm text-app-muted whitespace-nowrap dark:text-app-muted-dark">
					© {{ year }} Ballot Clarity
				</p>
			</div>
		</div>
	</footer>
</template>
