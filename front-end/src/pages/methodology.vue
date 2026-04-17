<script setup lang="ts">
import { currentCoverageLocationSlug } from "~/constants";

const { data: dataSources } = await useDataSources();

usePageSeo({
	description: "Learn how Ballot Clarity generates summaries, attaches sources, handles uncertainty, and plans future transparency features.",
	path: "/methodology",
	title: "Methodology",
});

const items = [
	{
		body: [
			"The current release uses a structured public-record archive and prewritten plain-language summaries to model how a source-first civic-information product can work. In a live version, summaries would be generated from public records, then reviewed against source citations and editorial rules.",
			"Summaries are designed to describe what is documented, not to predict outcomes or recommend a vote.",
		],
		title: "How summaries are generated",
	},
	{
		body: [
			"Each candidate, measure, and evidence block includes attached source objects. In the current build those sources point to local text files that stand in for public records like filings, hearing notes, and budget documents.",
			"The interface keeps source counts visible and offers drawers or side panels so users can inspect source context without losing their place.",
		],
		title: "How sources are attached",
	},
	{
		body: [
			"Serious allegations, edited quotes, and disputed claims require a narrower drafting posture than routine biography or issue summaries. Ballot Clarity aims to show source posture clearly instead of turning allegations into unexplained house facts.",
			"Quote handling is part of the trust model: transcripts, official records, and candidate-submitted statements should preserve meaning rather than be trimmed into a sharper claim."
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
			"A future alignment module could compare district concerns with public records and stated positions. It would need transparent methodology, clear weighting rules, and strong explanations of uncertainty.",
			"That feature is not live in the current build. It is labeled as experimental wherever it appears so users do not mistake it for a finished recommendation system.",
		],
		title: "Future constituent alignment",
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
			"Election pages should show visible update timestamps, a lightweight change log, and official-source links for deadlines, office contacts, and voting methods.",
			"A live version would declare an update cadence publicly so users can understand when pages are refreshed during election season and when they should verify directly with the election office."
		],
		title: "Editorial governance and update cadence",
	},
	{
		body: [
			"A live version should include a public correction pathway, review timeline, and visible change log entry when page content changes in a material way.",
			"The goal is to make error handling operational rather than leaving trust to a one-time methodology statement."
		],
		title: "Corrections and disputes",
	},
	{
		body: [
			"Address lookup is used to estimate districts and ballot style. ZIP-only lookup can preview the likely coverage area, but it cannot stand in for exact district-level ballot matching.",
			"The current build sends lookup input with a POST request, avoids persisting the raw lookup text in browser storage, and keeps the data-use explanation near the lookup form rather than burying it in legal copy."
		],
		title: "Privacy and personalization",
	},
	{
		body: [
			"Ballot Clarity is being shaped to support a strict nonpartisan voter-education posture. Candidate pages should not function like endorsements, rankings, or scorecards.",
			"Ballot measure pages should keep factual explanation separate from advocacy, and any future paid promotion or election-season sponsorship should receive a separate compliance review before launch."
		],
		title: "Nonpartisan operating posture",
	},
	{
		body: [
			"Public data is incomplete, uneven across race types, and often delayed. Challengers usually have fewer public records than incumbents, and local races can depend heavily on meeting minutes or questionnaires.",
			"This build makes those limits explicit through coverage notes, “What we know” and “What we do not know” sections, and repeated reminders to consult original records.",
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
			"Freshness strips distinguish page review timing, source-data timing, and the next planned review date.",
			"Status labels like Up to date or Incomplete are paired with short explanations so they are not just decorative badges."
		],
		label: "Freshness"
	},
	{
		body: [
			"The product now uses paired What we know and What we're still checking summaries so uncertainty is explicit instead of hidden.",
			"Those sections are informational only and should never be read as endorsements or probability judgments."
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

		<MethodologySummaryCard
			:items="trustInterfaceItems"
			summary="The trust interface is designed to make evidence, freshness, and uncertainty visible at the point where a voter is reading, not buried in a separate documentation wall."
			title="How to read the trust signals"
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
				<TrustBadge label="Source-first labels" tone="accent" />
			</div>
			<div class="mt-6 gap-4 grid md:grid-cols-2 xl:grid-cols-3">
				<article v-for="item in informationTypes" :key="item.label" class="px-5 py-5 rounded-3xl bg-app-bg dark:bg-app-bg-dark/70">
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

		<section v-if="dataSources" class="surface-panel">
			<div class="flex flex-wrap gap-4 items-start justify-between">
				<div>
					<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
						Live data roadmap
					</p>
					<h2 class="text-3xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
						How the current archive is meant to be replaced
					</h2>
				</div>
				<TrustBadge label="Implementation order" tone="accent" />
			</div>
			<p class="text-sm text-app-muted leading-7 mt-4 max-w-3xl dark:text-app-muted-dark">
				The data roadmap separates address and district lookup, ballot packaging, and money or influence records so the final product can scale without pretending there is one perfect civic-data feed.
			</p>
			<div class="mt-6 gap-4 grid md:grid-cols-3">
				<article v-for="milestone in dataSources.roadmap.slice(0, 3)" :key="milestone.id" class="px-5 py-5 rounded-3xl bg-app-bg dark:bg-app-bg-dark/70">
					<p class="text-sm text-app-ink font-semibold dark:text-app-text-dark">
						{{ milestone.title }}
					</p>
					<p class="text-sm text-app-muted leading-7 mt-3 dark:text-app-muted-dark">
						{{ milestone.summary }}
					</p>
				</article>
			</div>
			<div class="mt-6 flex flex-wrap gap-3">
				<NuxtLink to="/data-sources" class="btn-secondary">
					Open data sources roadmap
				</NuxtLink>
				<NuxtLink :to="`/locations/${currentCoverageLocationSlug}`" class="btn-secondary">
					Open location hub
				</NuxtLink>
			</div>
		</section>

		<section class="gap-6 grid lg:grid-cols-2">
			<div class="surface-panel">
				<h2 class="text-3xl text-app-ink font-serif dark:text-app-text-dark">
					Trust section
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
				<InfoCallout title="Current build status" tone="warning">
					This site currently uses a limited archive of public records. The architecture is ready for real civic APIs later, but the current content is intentionally labeled so users can distinguish present coverage from future live integrations.
				</InfoCallout>
				<InfoCallout title="Neutrality policy">
					Ballot Clarity is designed to explain what is documented, not to endorse candidates, oppose parties, or tell users how to vote.
				</InfoCallout>
				<div class="surface-panel">
					<h2 class="text-2xl text-app-ink font-serif dark:text-app-text-dark">
						Operational trust pages
					</h2>
					<p class="text-sm text-app-muted leading-7 mt-4 dark:text-app-muted-dark">
						Read the dedicated neutrality policy for source hierarchy and language rules, or use the contact page to report a correction or dispute.
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
