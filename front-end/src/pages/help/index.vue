<script setup lang="ts">
const faqItems = [
	{
		answer: [
			"An official ballot listing is the set of contests and measures expected to appear on a voter's ballot for a specific election and location.",
			"A voter guide adds explanation around those items. Ballot Clarity is designed as a voter guide that points back to source material and official records."
		],
		question: "What is the difference between an official ballot listing and a voter guide?"
	},
	{
		answer: [
			"Yes. Many jurisdictions allow voters to bring notes or a printed ballot guide, but users should still review their local election office guidance before Election Day.",
			"This help hub is informational only and is not a substitute for official rules issued by the election office."
		],
		question: "Can I bring notes or a printed guide with me when I vote?"
	},
	{
		answer: [
			"Check the updated timestamp, review the linked sources, and verify the latest information with the official election office when a deadline or location is time-sensitive.",
			"Ballot Clarity is designed to show what changed and when, but official election offices remain the final authority."
		],
		question: "What should I do if election information changes close to voting?"
	},
	{
		answer: [
			"No. Ballot Clarity is a nonprofit civic-information concept and not an official government website.",
			"The site is designed to help voters inspect information more clearly, but official election offices should be used to confirm final deadlines, locations, and ballot rules."
		],
		question: "Is Ballot Clarity an official government site?"
	},
	{
		answer: [
			"On hosts where Ballot Clarity is configured for a best-effort IP-based location guess, that opening guess is still only approximate. A full street address remains the correct input for exact district and ballot matching, and a 5-digit ZIP code should be treated as approximate until the official voter tools confirm the final ballot.",
			"The lookup is used only to match ballot coverage. The current release does not create user accounts or advertising profiles from that lookup.",
			"The app does save your selected location label, compare list, and ballot-plan choices in your browser so the guide stays usable across refreshes. The privacy page explains that boundary in more detail."
		],
		question: "What happens to the address or ZIP code I enter?"
	},
	{
		answer: [
			"Because Ballot Clarity does not publish the same level of local coverage in every environment or for every location.",
			"Coverage notes remain visible so users can understand when the product has a published local guide, when only nationwide civic results are available, and when no local coverage is published yet."
		],
		question: "Why are some pages labeled as current coverage?"
	},
	{
		answer: [
			"The product is designed to show factual summaries, source links, and uncertainty notes without ranking or recommending candidates or measures.",
			"Methodology, neutrality, and sourcing notes are published so users can inspect how information is gathered and displayed."
		],
		question: "How does Ballot Clarity try to stay neutral?"
	}
];

usePageSeo({
	description: "Voting help, ballot basics, and trust notes for Ballot Clarity. Clear answers with source-first guidance and links back to official election offices.",
	jsonLd: {
		"@context": "https://schema.org",
		"@type": "FAQPage",
		"mainEntity": faqItems.map(item => ({
			"@type": "Question",
			"acceptedAnswer": {
				"@type": "Answer",
				"text": item.answer.join(" ")
			},
			"name": item.question
		}))
	},
	path: "/help",
	title: "Voting Help and FAQ"
});

const accordionItems = faqItems.map(item => ({
	body: item.answer,
	title: item.question
}));
</script>

<template>
	<section class="app-shell section-gap space-y-8">
		<header class="gap-6 grid lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
			<div>
				<div class="flex flex-wrap gap-2">
					<TrustBadge label="Help hub" tone="accent" />
					<TrustBadge label="Plain language" />
					<TrustBadge label="Official verification encouraged" tone="warning" />
				</div>
				<h1 class="text-5xl text-app-ink font-serif mt-5 dark:text-app-text-dark">
					Voting help and ballot basics
				</h1>
				<p class="text-base text-app-muted leading-8 mt-5 max-w-3xl dark:text-app-muted-dark">
					This page answers common questions about ballot listings, voter guides, timing, and how to verify election information without turning the site into advice or advocacy.
				</p>
			</div>

			<InfoCallout title="Important reminder" tone="warning">
				Ballot Clarity is not an official government website. Use this site to understand the landscape, then confirm time-sensitive details with the election office for your jurisdiction.
			</InfoCallout>
		</header>

		<MethodologyAccordion :items="accordionItems" />

		<section class="gap-6 grid lg:grid-cols-3">
			<div class="surface-panel">
				<h2 class="text-2xl text-app-ink font-serif dark:text-app-text-dark">
					Start with the coverage profile
				</h2>
				<p class="text-sm text-app-muted leading-7 mt-4 dark:text-app-muted-dark">
					The coverage profile is the best starting point when you need to know whether Ballot Clarity has any published local coverage loaded, what is still unavailable, and when the app is correctly keeping official election tools and lookup-first civic results in front.
				</p>
				<NuxtLink to="/coverage" class="btn-primary mt-6">
					Open the coverage profile
				</NuxtLink>
			</div>

			<div class="surface-panel">
				<h2 class="text-2xl text-app-ink font-serif dark:text-app-text-dark">
					Review trust, privacy, and accessibility standards
				</h2>
				<p class="text-sm text-app-muted leading-7 mt-4 dark:text-app-muted-dark">
					Methodology, neutrality, privacy, and accessibility notes explain how sources are attached, how summaries are constrained, how lookups are handled, and how the ballot guide is designed for keyboard, print, and plain-language use.
				</p>
				<div class="mt-6 flex flex-wrap gap-3">
					<NuxtLink to="/methodology" class="btn-secondary">
						Read methodology
					</NuxtLink>
					<NuxtLink to="/neutrality" class="btn-secondary">
						Read neutrality policy
					</NuxtLink>
					<NuxtLink to="/privacy" class="btn-secondary">
						Read privacy notice
					</NuxtLink>
					<NuxtLink to="/accessibility" class="btn-secondary">
						Read accessibility standards
					</NuxtLink>
				</div>
			</div>

			<div class="surface-panel">
				<h2 class="text-2xl text-app-ink font-serif dark:text-app-text-dark">
					Report an issue
				</h2>
				<p class="text-sm text-app-muted leading-7 mt-4 dark:text-app-muted-dark">
					If a ballot, candidate, or measure page looks incomplete or inaccurate, use the public correction path instead of assuming the summary is final.
				</p>
				<NuxtLink to="/contact" class="btn-secondary mt-6">
					Open contact page
				</NuxtLink>
			</div>
		</section>
	</section>
</template>
