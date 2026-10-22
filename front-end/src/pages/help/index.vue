<script setup lang="ts">
const faqItems = [
	{
		answer: [
			"An official ballot lists the contests and measures for a specific election and location. A voter guide provides background and supporting sources."
		],
		question: "What is the difference between an official ballot listing and a voter guide?"
	},
	{
		answer: [
			"Rules vary by jurisdiction. Check your election office’s guidance before bringing notes or a printed guide."
		],
		question: "Can I bring notes or a printed guide with me when I vote?"
	},
	{
		answer: [
			"Confirm time-sensitive deadlines and polling locations with your election office."
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
			<section v-for="item in faqItems" :key="item.question" class="py-4">
				<h2 class="text-base text-app-ink font-semibold dark:text-app-text-dark">
					{{ item.question }}
				</h2>
				<div class="text-sm text-app-muted leading-7 mt-3 space-y-3 dark:text-app-muted-dark">
					<p v-for="paragraph in item.answer" :key="paragraph">
						{{ paragraph }}
					</p>
				</div>
			</section>
		</div>
	</section>
</template>
