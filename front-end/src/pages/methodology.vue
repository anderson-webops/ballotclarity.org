<script setup lang="ts">
usePageSeo({
	description: "Learn how Ballot Clarity writes summaries, attaches sources, handles uncertainty, and explains limits.",
	path: "/methodology",
	title: "Methodology",
});

const items = [
	{
		body: [
			"Published summaries are written from public records and reviewed before they appear in a guide.",
			"Summaries are meant to describe what is documented, not tell people how to vote.",
		],
		title: "How summaries are generated",
	},
	{
		body: [
			"Major summaries and evidence blocks link back to source records.",
			"Source counts and drawers are meant to help readers verify a page without losing their place.",
		],
		title: "How sources are attached",
	},
	{
		body: [
			"Serious allegations, edited quotes, and disputed claims require a narrower drafting posture than routine biography or issue summaries.",
			"Transcripts, official records, and candidate-submitted statements should preserve meaning rather than be trimmed into a sharper claim."
		],
		title: "High-risk claims and quote handling",
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
			"Ballot Clarity separates information into distinct source channels: official text, official record data, candidate-supplied material, Ballot Clarity plain-language summaries, and other nonpartisan supporting records.",
			"Those labels are meant to help users understand which parts of a page are official wording, which parts are direct submissions, and which parts are explanatory context."
		],
		title: "Information types we publish",
	},
	{
		body: [
			"Ballot measure pages separate current law or current practice from the proposed change, then show mirrored YES and NO outcomes so the legal effect and status quo can be compared cleanly.",
			"Implementation timing, fiscal notes, and attributed support or opposition arguments are split into separate sections so explanatory text does not blend into advocacy voice."
		],
		title: "How ballot measures are explained",
	},
	{
		body: [
			"Pages should show update timestamps and official election links where the data model supports them.",
			"Readers should verify time-sensitive deadlines, locations, and rules with the election office."
		],
		title: "Editorial governance and update cadence",
	},
	{
		body: [
			"Ballot Clarity has a public correction path.",
			"Material changes should be logged visibly rather than rewritten without notice."
		],
		title: "Corrections and disputes",
	},
	{
		body: [
			"Address lookup helps match districts and ballot coverage. ZIP codes and IP-based guesses are approximate; a full street address is the strongest input for exact matching.",
			"Ballot Clarity keeps the data-use explanation near the lookup form and explains storage details in the privacy notice."
		],
		title: "Privacy and personalization",
	},
	{
		body: [
			"Ballot Clarity does not rank, endorse, or score candidates or measures.",
			"Explanatory text is kept separate from advocacy."
		],
		title: "Nonpartisan operating posture",
	},
	{
		body: [
			"Public data is incomplete, uneven across race types, and often delayed. Challengers usually have fewer public records than incumbents, and local races can depend heavily on meeting minutes or questionnaires.",
			"Coverage notes and uncertainty labels are meant to show those limits plainly.",
		],
		title: "Limitations and uncertainty",
	},
];

const trustInterfaceItems = [
	{
		body: [
			"The evidence drawer keeps full source lists one click away from the page header and major claim blocks.",
			"Claim-level summaries use evidence buttons so a user can inspect supporting records without losing context."
		],
		label: "Evidence access"
	},
	{
		body: [
			"Freshness labels show when a page or source was last updated.",
			"Status labels like Up to date or Incomplete are paired with short explanations."
		],
		label: "Freshness"
	},
	{
		body: [
			"Uncertainty notes explain what is known and what still needs checking.",
			"They are informational only and should not be read as endorsements or probability judgments."
		],
		label: "Uncertainty"
	}
];
</script>

<template>
	<section class="reading-page app-shell section-gap space-y-8">
		<header class="max-w-4xl">
			<div class="flex flex-wrap gap-2">
				<TrustBadge label="Neutrality" tone="accent" />
				<TrustBadge label="Sourcing" />
				<TrustBadge label="Limits disclosed" tone="warning" />
			</div>
			<h1 class="text-5xl text-app-ink font-serif mt-5 dark:text-app-text-dark">
				Methodology
			</h1>
			<p class="text-base text-app-muted leading-8 mt-5 max-w-3xl dark:text-app-muted-dark">
				This page explains how Ballot Clarity writes summaries, shows sources, marks uncertainty, and handles corrections.
			</p>
		</header>

		<MethodologySummaryCard
			:items="trustInterfaceItems"
			summary="Page signals are meant to keep evidence, freshness, and uncertainty visible where a voter is already reading."
			title="How to read page signals"
		/>

		<MethodologyAccordion :items="items" />
	</section>
</template>
