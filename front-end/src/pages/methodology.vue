<script setup lang="ts">
usePageSeo({
	description: "Learn how Ballot Clarity generates summaries, attaches sources, handles uncertainty, and plans future transparency features.",
	path: "/methodology",
	title: "Methodology",
});

const items = [
	{
		body: [
			"This MVP uses structured demo data and prewritten plain-language summaries to model how a source-first civic-information product could work. In a live version, summaries would be generated from public records, then reviewed against source citations and editorial rules.",
			"Summaries are designed to describe what is documented, not to predict outcomes or recommend a vote.",
		],
		title: "How summaries are generated",
	},
	{
		body: [
			"Each candidate, measure, and evidence block includes attached source objects. In this demo those sources point to local text files that stand in for public records like filings, hearing notes, and budget documents.",
			"The interface keeps source counts visible and offers drawers or side panels so users can inspect source context without losing their place.",
		],
		title: "How sources are attached",
	},
	{
		body: [
			"Ballot Clarity is informational, not advisory. The product should not tell users who to support, rank candidates, or hide tradeoffs behind a single score.",
			"The compare page is intentionally tabular and neutral. It shows differences in record and funding without turning elections into a leaderboard.",
		],
		title: "Information only, not advice",
	},
	{
		body: [
			"A future alignment module could compare district concerns with public records and stated positions. It would need transparent methodology, clear weighting rules, and strong explanations of uncertainty.",
			"That feature is not live in this MVP. It is labeled as experimental wherever it appears so users do not mistake it for a finished recommendation system.",
		],
		title: "Future constituent alignment",
	},
	{
		body: [
			"Public data is incomplete, uneven across race types, and often delayed. Challengers usually have fewer public records than incumbents, and local races can depend heavily on meeting minutes or questionnaires.",
			"This MVP makes those limits explicit through demo labels, “What we know” and “What we do not know” sections, and repeated reminders to consult original records.",
		],
		title: "Limitations and uncertainty",
	},
];
</script>

<template>
	<section class="app-shell section-gap space-y-8">
		<header class="max-w-4xl">
			<div class="flex flex-wrap gap-2">
				<TrustBadge label="Neutrality" tone="accent" />
				<TrustBadge label="Sourcing" />
				<TrustBadge label="Limits disclosed" tone="warning" />
			</div>
			<h1 class="text-5xl text-app-ink font-serif mt-5 dark:text-app-text-dark">
				Methodology and trust notes
			</h1>
			<p class="text-base text-app-muted leading-8 mt-5 max-w-3xl dark:text-app-muted-dark">
				Ballot Clarity is built around a simple trust model: show the source trail, explain what is known and unknown, and keep the product informational rather than advisory.
			</p>
		</header>

		<MethodologyAccordion :items="items" />

		<section class="gap-6 grid lg:grid-cols-2">
			<div class="surface-panel">
				<h2 class="text-3xl text-app-ink font-serif dark:text-app-text-dark">
					Trust section
				</h2>
				<ul class="text-sm text-app-muted leading-7 mt-6 space-y-4 dark:text-app-muted-dark">
					<li><strong class="text-app-ink dark:text-app-text-dark">Neutrality:</strong> No rankings, recommendations, or partisan cues.</li>
					<li><strong class="text-app-ink dark:text-app-text-dark">Sourcing:</strong> Summaries are paired with attached source files and visible counts.</li>
					<li><strong class="text-app-ink dark:text-app-text-dark">Data freshness:</strong> Updated timestamps are shown where the data model supports them.</li>
					<li><strong class="text-app-ink dark:text-app-text-dark">Limitations:</strong> Incomplete records and uncertainty are surfaced directly instead of hidden behind a polished interface.</li>
				</ul>
			</div>

			<InfoCallout title="Current MVP status" tone="warning">
				This site is a demo environment. The architecture is ready for real civic APIs later, but the current content is simulated and intentionally labeled as such throughout the product.
			</InfoCallout>
		</section>
	</section>
</template>
