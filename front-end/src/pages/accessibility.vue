<script setup lang="ts">
import { contactEmail } from "~/constants";

const standards = [
	{
		description: "Public pages target WCAG 2.2 Level AA, with stricter internal rules for focus visibility, readable ballot copy, and print output.",
		label: "Baseline standard",
		value: "WCAG 2.2 AA"
	},
	{
		description: "Interactive controls are designed around a 44 by 44 pixel minimum target for non-inline buttons, toggles, and navigation actions.",
		label: "Control target size",
		value: "44 x 44 px"
	},
	{
		description: "Instructional copy and ballot summaries are written in plain language first, then paired with linked source material and official notices.",
		label: "Reading goal",
		value: "Grade 6 to 8"
	},
];

const designPractices = [
	"Keyboard-first navigation with a skip link, visible focus styles, and focus-managed drawers and overlays.",
	"High-contrast text and control boundaries on the primary reading surfaces, with light mode as the default and dark mode supported.",
	"Plain-language summaries that sit next to official wording instead of replacing it when legal or campaign language is harder to read.",
	"Responsive layouts that stay usable on narrow screens and under browser zoom, including a simplified print surface for ballot reading."
];

const printPractices = [
	"Ballot and plan pages include a browser print view designed to read like a short voters' pamphlet rather than a full web app.",
	"Printed content emphasizes contest names, candidate or measure summaries, and official reminders instead of interactive controls.",
	"Users should still verify polling-place, deadline, and ballot-return details with the official election office before relying on a printed guide."
];

const knownLimits = [
	"This MVP uses clearly labeled demo data, so the current print views are designed to demonstrate structure and readability rather than provide live election logistics.",
	"Ballot Clarity does not yet generate a downloadable tagged PDF. The current accessible print path is the browser print view on supported pages.",
	"We have not implemented multilingual ballot content or alternative reading modes yet, though the design system is being shaped to support them later."
];

usePageSeo({
	description: "Accessibility and print standards for Ballot Clarity, including WCAG targets, readable ballot-guide rules, and current MVP limitations.",
	path: "/accessibility",
	title: "Accessibility and Print Standards"
});
</script>

<template>
	<section class="app-shell section-gap space-y-8">
		<header class="gap-6 grid lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
			<div>
				<div class="flex flex-wrap gap-2">
					<TrustBadge label="WCAG 2.2 AA target" tone="accent" />
					<TrustBadge label="Print-friendly ballot guides" />
					<TrustBadge label="MVP limits published" tone="warning" />
				</div>
				<h1 class="text-5xl text-app-ink font-serif mt-5 dark:text-app-text-dark">
					Accessibility and print standards
				</h1>
				<p class="bc-prose text-app-muted mt-5 dark:text-app-muted-dark">
					Ballot Clarity is designed as a public-interest reading tool, so accessibility is treated as a product requirement rather than a later compliance pass. The public site targets WCAG 2.2 Level AA and uses stricter internal standards for focus visibility, readable ballot copy, and print behavior on key pages.
				</p>
			</div>

			<InfoCallout title="Need help or found a barrier?" tone="warning">
				Use the <NuxtLink to="/contact" class="underline underline-offset-3">
					contact page
				</NuxtLink> or email
				<a :href="`mailto:${contactEmail}`" class="underline underline-offset-3">
					{{ contactEmail }}
				</a>
				with the page URL, device or browser, assistive technology if relevant, and what blocked you.
			</InfoCallout>
		</header>

		<section class="gap-6 grid md:grid-cols-3">
			<article v-for="item in standards" :key="item.label" class="surface-panel">
				<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
					{{ item.label }}
				</p>
				<h2 class="text-3xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
					{{ item.value }}
				</h2>
				<p class="text-sm text-app-muted leading-7 mt-4 dark:text-app-muted-dark">
					{{ item.description }}
				</p>
			</article>
		</section>

		<section class="gap-6 grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
			<div class="surface-panel">
				<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
					How the site is designed to work
				</p>
				<h2 class="text-3xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
					Readable, keyboard-safe, and source-first by default
				</h2>
				<ul class="readable-list text-sm text-app-muted mt-5 pl-5 dark:text-app-muted-dark">
					<li v-for="item in designPractices" :key="item">
						{{ item }}
					</li>
				</ul>
			</div>

			<div class="surface-panel">
				<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
					Print guide standards
				</p>
				<h2 class="text-3xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
					Print views should stay useful when a phone is not
				</h2>
				<ul class="readable-list text-sm text-app-muted mt-5 pl-5 dark:text-app-muted-dark">
					<li v-for="item in printPractices" :key="item">
						{{ item }}
					</li>
				</ul>
				<div class="mt-6 flex flex-wrap gap-3">
					<NuxtLink to="/plan" class="btn-primary">
						Open my ballot plan
					</NuxtLink>
					<NuxtLink to="/ballot/2026-metro-county-general" class="btn-secondary">
						Open demo ballot guide
					</NuxtLink>
				</div>
			</div>
		</section>

		<section class="gap-6 grid lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
			<div class="surface-panel">
				<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
					Known MVP limits
				</p>
				<h2 class="text-3xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
					What is not fully implemented yet
				</h2>
				<ul class="readable-list text-sm text-app-muted mt-5 pl-5 dark:text-app-muted-dark">
					<li v-for="item in knownLimits" :key="item">
						{{ item }}
					</li>
				</ul>
			</div>

			<div class="surface-panel">
				<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
					Reporting process
				</p>
				<h2 class="text-3xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
					What helps us fix an accessibility issue quickly
				</h2>
				<div class="bc-prose text-app-muted mt-5 dark:text-app-muted-dark">
					<p>
						If something is hard to read, navigate, print, or operate, include the exact page, the step that failed, and whether the issue was on mobile, desktop, keyboard-only, screen reader, or zoomed text.
					</p>
					<p>
						If the issue affected a time-sensitive election task, note that clearly so it can be prioritized with the same urgency as a factual correction.
					</p>
				</div>
				<div class="mt-6 flex flex-wrap gap-3">
					<NuxtLink to="/contact" class="btn-secondary">
						Open contact page
					</NuxtLink>
					<NuxtLink to="/methodology" class="btn-secondary">
						Read methodology
					</NuxtLink>
				</div>
			</div>
		</section>
	</section>
</template>
