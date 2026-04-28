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
			"No. Ballot Clarity is not an official government website.",
			"Use it to understand the landscape, then confirm final deadlines, locations, and ballot rules with the election office."
		],
		question: "Is Ballot Clarity an official government site?"
	},
	{
		answer: [
			"A location guess or ZIP code can help you get started, but it is still approximate. A full street address is the right input for exact district and ballot matching.",
			"The lookup is used only to match ballot coverage. The current release does not create user accounts or advertising profiles from that lookup.",
			"The app does save your selected location label, compare list, and ballot-plan choices in your browser so the guide stays usable across refreshes. The privacy page explains that boundary in more detail."
		],
		question: "What happens to the address or ZIP code I enter?"
	},
	{
		answer: [
			"Coverage varies by place.",
			"Some areas have a fuller local guide, and others currently have lookup results, district pages, representative pages, and official links only."
		],
		question: "Why is one area more complete than another?"
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
	description: "Voting help, ballot basics, and trust notes for Ballot Clarity. Clear answers with links back to official election offices.",
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
					This page answers common questions about ballot listings, voter guides, timing, and how to verify election information.
				</p>
			</div>

			<InfoCallout title="Important reminder" tone="warning">
				Ballot Clarity is not an official government website. Use this site to understand the landscape, then confirm time-sensitive details with the election office for your jurisdiction.
			</InfoCallout>
		</header>

		<MethodologyAccordion :items="accordionItems" />

		<nav class="flex flex-wrap gap-3" aria-label="Related help links">
			<NuxtLink to="/coverage" class="btn-primary">
				Check coverage
			</NuxtLink>
			<NuxtLink to="/methodology" class="btn-secondary">
				Methodology
			</NuxtLink>
			<NuxtLink to="/neutrality" class="btn-secondary">
				Neutrality policy
			</NuxtLink>
			<NuxtLink to="/privacy" class="btn-secondary">
				Privacy
			</NuxtLink>
			<NuxtLink to="/accessibility" class="btn-secondary">
				Accessibility
			</NuxtLink>
			<NuxtLink to="/contact" class="btn-secondary">
				Report an issue
			</NuxtLink>
		</nav>
	</section>
</template>
