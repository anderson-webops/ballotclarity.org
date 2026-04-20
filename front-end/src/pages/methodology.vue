<script setup lang="ts">
const { data: dataSources } = await useDataSources();

usePageSeo({
	description: "Learn how Ballot Clarity writes summaries, attaches sources, handles uncertainty, and explains limits.",
	path: "/methodology",
	title: "Methodology",
});

const items = [
	{
		body: [
			"Ballot Clarity is designed so published summaries can be generated from public records, then reviewed against source citations and editorial rules before they appear in a local guide.",
			"Summaries are designed to describe what is documented, not to predict outcomes or recommend a vote.",
		],
		title: "How summaries are generated",
	},
	{
		body: [
			"Each candidate, measure, and evidence block includes attached source objects. When Ballot Clarity publishes local coverage, those sources should point to real public records like filings, hearing notes, and budget documents.",
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
			"Address lookup is used to estimate districts and ballot style. Some hosts may also be configured for a best-effort IP-based location guess, while ZIP-only lookup can preview the likely coverage area without standing in for exact district-level ballot matching.",
			"The current build sends lookup input with a POST request, can use configured deployment geolocation signals for a coarse default guess when that feature is enabled, avoids persisting the raw lookup text in browser storage, and keeps the data-use explanation near the lookup form rather than burying it in legal copy."
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
				<TrustBadge label="Clear labels" tone="accent" />
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

		<section v-if="dataSources && (dataSources.roadmap.length || dataSources.categories.length)" class="surface-panel">
			<div class="flex flex-wrap gap-4 items-start justify-between">
				<div>
					<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
						Coverage model
					</p>
					<h2 class="text-3xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
						How local guides are assembled
					</h2>
				</div>
				<TrustBadge label="Public plan" tone="accent" />
			</div>
			<p class="text-sm text-app-muted leading-7 mt-4 max-w-3xl dark:text-app-muted-dark">
				Ballot Clarity builds local guides in layers: location matching, district context, election records, and supporting public data. This page links to the source model behind that work.
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
					Open data sources
				</NuxtLink>
				<NuxtLink to="/coverage" class="btn-secondary">
					Open coverage profile
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
				<InfoCallout title="Coverage note" tone="warning">
					Coverage varies by area. When a local guide is not published, Ballot Clarity keeps lookup results and official election links available instead.
				</InfoCallout>
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
