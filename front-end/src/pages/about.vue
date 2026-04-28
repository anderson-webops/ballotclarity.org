<script setup lang="ts">
usePageSeo({
	description: "Learn about the nonprofit mission behind Ballot Clarity and why voter literacy matters.",
	path: "/about",
	title: "About",
});
</script>

<template>
	<section class="app-shell section-gap space-y-8">
		<header class="max-w-4xl">
			<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
				About the project
			</p>
			<h1 class="text-5xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
				A nonprofit civic-information platform for voter literacy.
			</h1>
			<p class="text-base text-app-muted leading-8 mt-5 max-w-3xl dark:text-app-muted-dark">
				Ballot Clarity is designed to make public election information easier to inspect without making the interface feel like a campaign, a news feed, or a partisan advocacy product.
			</p>
		</header>

		<section class="surface-panel max-w-5xl">
			<h2 class="text-3xl text-app-ink font-serif dark:text-app-text-dark">
				What Ballot Clarity is for
			</h2>
			<div class="bc-prose text-app-muted mt-5 dark:text-app-muted-dark">
				<p>
					Ballot Clarity turns scattered public records into readable, source-backed election information. A voter should be able to move from “Who represents me?” or “What is on my ballot?” to the supporting records without digging through disconnected PDFs and portals.
				</p>
				<p>
					The site organizes contests by office, attaches sources directly to summaries, and states limits and uncertainty where users read the information. The goal is clarity, not persuasion.
				</p>
			</div>
			<details class="mt-6 surface-row">
				<summary class="text-sm text-app-ink font-semibold cursor-pointer dark:text-app-text-dark focus-ring">
					Why public election data is hard to use
				</summary>
				<p class="text-sm text-app-muted leading-7 mt-4 dark:text-app-muted-dark">
					Public information is often distributed across filing portals, meeting minutes, clerk notices, ethics forms, and campaign materials. Elections also include complex offices, dense measures, and uneven candidate records, so the usability problem starts before any analysis begins.
				</p>
			</details>
		</section>

		<section class="surface-panel max-w-4xl">
			<h2 class="text-3xl text-app-ink font-serif dark:text-app-text-dark">
				Volunteer or contact
			</h2>
			<p class="text-sm text-app-muted leading-7 mt-5 dark:text-app-muted-dark">
				Ballot Clarity is in an early public release with limited geographic coverage. People who want to volunteer, collaborate, or ask questions are welcome to get in touch.
			</p>
			<div class="mt-6 flex flex-wrap gap-3">
				<NuxtLink to="/contact" class="btn-primary">
					Contact the project
				</NuxtLink>
				<NuxtLink to="/neutrality" class="btn-secondary">
					Read neutrality policy
				</NuxtLink>
				<NuxtLink to="/methodology" class="btn-secondary">
					Review methodology
				</NuxtLink>
			</div>
		</section>
	</section>
</template>
