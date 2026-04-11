<script setup lang="ts">
import { contactEmail } from "~/constants";

const year = new Date().getFullYear();

const guideLinks = [
	{ label: "My ballot plan", to: "/plan" },
	{ label: "Ballot guide", to: "/ballot" },
	{ label: "Compare candidates", to: "/compare" },
	{ label: "Search", to: "/search" },
];

const discoveryLinks = [
	{ label: "About", to: "/about" },
	{ label: "Metro County hub", to: "/locations/metro-county-franklin" },
	{ label: "Election overview", to: "/elections/2026-metro-county-general" },
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
</script>

<template>
	<footer class="py-10 border-t border-app-line/80 bg-white/80 dark:border-app-line-dark dark:bg-app-panel-dark/55">
		<div class="app-shell">
			<div class="gap-10 grid xl:grid-cols-[minmax(0,1.18fr)_minmax(0,0.82fr)] xl:items-start">
				<div class="max-w-3xl">
					<div class="flex flex-wrap gap-2">
						<TrustBadge label="Nonpartisan" tone="accent" />
						<TrustBadge label="Source-first" />
						<TrustBadge label="Current coverage" tone="warning" />
					</div>
					<p class="text-2xl text-app-ink font-serif mt-4 dark:text-app-text-dark">
						Ballot Clarity
					</p>
					<p class="bc-measure text-base text-app-muted mt-4 dark:text-app-muted-dark">
						Ballot Clarity is a nonprofit civic-information platform focused on source-first ballot summaries, transparent methodology, and readable public-interest data.
					</p>
					<div class="mt-6 gap-4 grid sm:grid-cols-2">
						<div class="p-5 rounded-[1.5rem] bg-app-bg/70 dark:bg-app-bg-dark/70">
							<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
								What this site is for
							</p>
							<p class="text-sm text-app-muted leading-7 mt-3 dark:text-app-muted-dark">
								Readable ballot guides, candidate dossiers, measure explainers, and source access that help voters inspect the public record without overload.
							</p>
						</div>

						<div class="p-5 rounded-[1.5rem] bg-app-bg/70 dark:bg-app-bg-dark/70">
							<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
								How to use it
							</p>
							<p class="text-sm text-app-muted leading-7 mt-3 dark:text-app-muted-dark">
								Start with the ballot guide, open deeper pages only when needed, and verify time-sensitive logistics with the official authorities linked throughout the site.
							</p>
						</div>
					</div>
				</div>

				<div class="gap-6 grid md:grid-cols-2">
					<div>
						<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
							Use the guide
						</p>
						<ul class="text-sm mt-4 space-y-3">
							<li v-for="link in guideLinks" :key="link.to">
								<NuxtLink :to="link.to" class="text-app-ink rounded-md transition dark:text-app-text-dark hover:text-app-accent focus-ring dark:hover:text-white">
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
								<NuxtLink :to="link.to" class="text-app-ink rounded-md transition dark:text-app-text-dark hover:text-app-accent focus-ring dark:hover:text-white">
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
								<NuxtLink :to="link.to" class="text-app-ink rounded-md transition dark:text-app-text-dark hover:text-app-accent focus-ring dark:hover:text-white">
									{{ link.label }}
								</NuxtLink>
							</li>
						</ul>
					</div>

					<div class="p-5 border border-app-line/80 rounded-[1.7rem] bg-app-bg/70 dark:border-app-line-dark dark:bg-app-bg-dark/70 md:col-span-2">
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
							<NuxtLink to="/contact" class="text-app-ink font-semibold rounded-md inline-flex gap-2 transition items-center dark:text-app-text-dark hover:text-app-accent focus-ring dark:hover:text-white">
								<span>Open contact page</span>
								<span class="i-carbon-arrow-right" aria-hidden="true" />
							</NuxtLink>
						</div>
					</div>
				</div>
			</div>

			<div class="mt-10 pt-6 border-t border-app-line/80 flex flex-col gap-3 dark:border-app-line-dark lg:flex-row lg:items-center lg:justify-between">
				<p class="text-sm text-app-muted max-w-4xl dark:text-app-muted-dark">
					Not an official election website. Ballot Clarity aims to provide nonpartisan civic information and cite sources where possible. Content can change, so verify critical election details with the official authorities linked throughout the site.
				</p>
				<p class="text-sm text-app-muted whitespace-nowrap dark:text-app-muted-dark">
					© {{ year }} Ballot Clarity
				</p>
			</div>
		</div>
	</footer>
</template>
