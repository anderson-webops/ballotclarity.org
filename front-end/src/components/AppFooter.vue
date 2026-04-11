<script setup lang="ts">
import { contactEmail } from "~/constants";

const year = new Date().getFullYear();

const footerLinks = [
	{ label: "About", to: "/about" },
	{ label: "My ballot plan", to: "/plan" },
	{ label: "Metro County hub", to: "/locations/metro-county-franklin" },
	{ label: "Voting FAQ", to: "/help" },
	{ label: "Methodology", to: "/methodology" },
	{ label: "Data sources", to: "/data-sources" },
	{ label: "Neutrality policy", to: "/neutrality" },
	{ label: "Accessibility", to: "/accessibility" },
	{ label: "Privacy", to: "/privacy" },
	{ label: "Terms", to: "/terms" },
	{ label: "Contact", to: "/contact" },
];
</script>

<template>
	<footer class="py-10 border-t border-app-line/80 bg-white/80 dark:border-app-line-dark dark:bg-app-panel-dark/55">
		<div class="app-shell gap-8 grid lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
			<div class="max-w-2xl">
				<p class="text-2xl text-app-ink font-serif dark:text-app-text-dark">
					Ballot Clarity
				</p>
				<p class="text-sm text-app-muted mt-3 max-w-xl dark:text-app-muted-dark">
					Ballot Clarity is a nonprofit civic-information concept focused on source-first ballot summaries, transparent methodology, and readable public-interest data.
				</p>
				<p class="text-sm text-app-muted mt-4 dark:text-app-muted-dark">
					This MVP uses clearly labeled demo data. Always review the original public record before relying on any election information.
				</p>
				<p class="text-sm text-app-muted mt-4 dark:text-app-muted-dark">
					Not an official election website. Ballot Clarity aims to provide nonpartisan civic information and cite sources where possible. Content can change, so verify critical election details with the official authorities linked throughout the site.
				</p>
			</div>

			<div class="gap-6 grid sm:grid-cols-2">
				<div>
					<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
						Explore
					</p>
					<ul class="text-sm mt-4 space-y-3">
						<li v-for="link in footerLinks" :key="link.to">
							<NuxtLink :to="link.to" class="text-app-ink rounded-md transition dark:text-app-text-dark hover:text-app-accent focus-ring dark:hover:text-white">
								{{ link.label }}
							</NuxtLink>
						</li>
					</ul>
				</div>

				<div>
					<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
						Contact
					</p>
					<ul class="text-sm text-app-muted mt-4 space-y-3 dark:text-app-muted-dark">
						<li>
							<a :href="`mailto:${contactEmail}`" class="text-app-ink rounded-md transition dark:text-app-text-dark hover:text-app-accent focus-ring dark:hover:text-white">
								{{ contactEmail }}
							</a>
						</li>
						<li>Volunteer and research inquiries welcome.</li>
						<li>© {{ year }} Ballot Clarity Demo</li>
					</ul>
				</div>
			</div>
		</div>
	</footer>
</template>
