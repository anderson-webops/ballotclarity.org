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

const informationTypes = [
	{
		label: "Official text",
		summary: "Ballot language, official voter guides, calendars, and election-office notices."
	},
	{
		label: "Official record data",
		summary: "Filings, vote records, budget notes, and other public records tied to government or regulated reporting."
	},
	{
		label: "Candidate-supplied",
		summary: "Questionnaire responses, campaign websites, or other statements attributed directly to a candidate."
	},
	{
		label: "Ballot Clarity summary",
		summary: "Plain-language explanation written from the attached records and labeled as interpretation rather than official wording."
	},
	{
		label: "Nonpartisan supporting records",
		summary: "Research briefs or civic compilations used to add context when official material alone is not enough."
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

		<section class="surface-panel">
			<div class="flex flex-wrap gap-4 items-start justify-between">
				<div>
					<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
						Content taxonomy
					</p>
					<h2 class="text-3xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
						Information types we publish
					</h2>
				</div>
				<TrustBadge label="Clear labels" tone="accent" />
			</div>
			<div class="mt-6 gap-4 grid md:grid-cols-2 xl:grid-cols-3">
				<article v-for="item in informationTypes" :key="item.label" class="surface-row">
					<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
						{{ item.label }}
					</p>
					<p class="text-sm text-app-muted leading-7 mt-4 dark:text-app-muted-dark">
						{{ item.summary }}
					</p>
				</article>
			</div>
		</section>

		<MethodologyAccordion :items="items" />

		<section class="gap-6 grid lg:grid-cols-2">
			<div class="surface-panel">
				<h2 class="text-3xl text-app-ink font-serif dark:text-app-text-dark">
					Editorial rules
				</h2>
				<ul class="text-sm text-app-muted leading-7 mt-6 space-y-4 dark:text-app-muted-dark">
					<li><strong class="text-app-ink dark:text-app-text-dark">Neutrality:</strong> No rankings, recommendations, or partisan cues.</li>
					<li><strong class="text-app-ink dark:text-app-text-dark">Sourcing:</strong> Summaries are paired with attached source files and visible counts.</li>
					<li><strong class="text-app-ink dark:text-app-text-dark">Official-source priority:</strong> Election logistics should point back to official offices and calendars whenever possible.</li>
					<li><strong class="text-app-ink dark:text-app-text-dark">Data freshness:</strong> Updated timestamps are shown where the data model supports them.</li>
					<li><strong class="text-app-ink dark:text-app-text-dark">Limitations:</strong> Incomplete records and uncertainty are surfaced directly instead of hidden behind a polished interface.</li>
				</ul>
			</div>

			<div class="space-y-4">
				<InfoCallout title="Neutrality policy">
					Ballot Clarity is designed to explain what is documented, not to endorse candidates, oppose parties, or tell users how to vote.
				</InfoCallout>
				<div class="surface-panel">
					<h2 class="text-2xl text-app-ink font-serif dark:text-app-text-dark">
						Related trust pages
					</h2>
					<p class="text-sm text-app-muted leading-7 mt-4 dark:text-app-muted-dark">
						Read the neutrality policy for sourcing and language rules, or use the contact page to report a correction or dispute.
					</p>
					<div class="mt-6 flex flex-wrap gap-3">
						<NuxtLink to="/neutrality" class="btn-secondary">
							Read neutrality policy
						</NuxtLink>
						<NuxtLink to="/contact" class="btn-secondary">
							Open contact page
						</NuxtLink>
					</div>
				</div>
			</div>
		</section>
	</section>
</template>
