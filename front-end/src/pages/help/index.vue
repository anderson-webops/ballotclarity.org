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
</script>

<template>
	<section class="app-shell section-gap space-y-8">
		<header class="gap-6 grid lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
			<div>
				<h1 class="text-5xl text-app-ink font-serif dark:text-app-text-dark">
					Voting help and ballot basics
				</h1>
			</div>
		</header>

		<div class="max-w-3xl divide-app-line divide-y dark:divide-app-line-dark">
			<details v-for="item in faqItems" :key="item.question" class="py-4">
				<summary class="text-base text-app-ink font-semibold rounded-sm cursor-pointer dark:text-app-text-dark focus-ring">
					{{ item.question }}
				</summary>
				<div class="text-sm text-app-muted leading-7 mt-3 space-y-3 dark:text-app-muted-dark">
					<p v-for="paragraph in item.answer" :key="paragraph">
						{{ paragraph }}
					</p>
				</div>
			</details>
		</div>
	</section>
</template>
