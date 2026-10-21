<script setup lang="ts">
usePageSeo({
	description: "Learn about Ballot Clarity's nonpartisan civic-information mission and why voter literacy matters.",
	path: "/about",
	title: "About",
});
</script>

<template>
	<section class="app-shell section-gap">
		<div class="max-w-3xl">
			<h1 class="text-5xl text-app-ink font-serif dark:text-app-text-dark">
				About Ballot Clarity
			</h1>
			<div class="bc-prose text-app-ink mt-6 dark:text-app-text-dark">
				<p>
					Ballot Clarity is a nonpartisan, public-interest civic-information site. It turns scattered public records — filings, notices, ballot text, and campaign materials — into readable, source-cited election information.
				</p>
				<p>
					Contests are organized by office, sources are attached to the summaries they support, and limits are stated where you read them. The goal is clarity, not persuasion.
				</p>
			</div>

			<h2 class="text-2xl text-app-ink font-serif mt-10 dark:text-app-text-dark">
				Contact
			</h2>
			<p class="text-base text-app-ink mt-2 dark:text-app-text-dark">
				Report a correction, ask a question, or volunteer.
			</p>
			<NuxtLink to="/contact" class="btn-primary mt-4">
				Contact the project
			</NuxtLink>
		</div>
	</section>
</template>
