<script setup lang="ts">
import { contactEmail } from "~/constants";

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

		<section class="gap-6 grid lg:grid-cols-2">
			<div class="surface-panel">
				<h2 class="text-3xl text-app-ink font-serif dark:text-app-text-dark">
					Mission
				</h2>
				<p class="text-sm text-app-muted leading-7 mt-5 dark:text-app-muted-dark">
					The mission is to improve voter literacy by turning scattered public records into readable, source-backed guides. The intended user should be able to move from “Who is on my ballot?” to “What is actually documented here?” without reading dozens of disconnected PDFs.
				</p>
			</div>

			<div class="surface-panel">
				<h2 class="text-3xl text-app-ink font-serif dark:text-app-text-dark">
					Why voter literacy matters
				</h2>
				<p class="text-sm text-app-muted leading-7 mt-5 dark:text-app-muted-dark">
					Elections include complex offices, dense measures, and candidates with uneven public records. Many voters want context, but not hype. A clear public-interest interface can reduce confusion without telling people what conclusion to draw.
				</p>
			</div>

			<div class="surface-panel">
				<h2 class="text-3xl text-app-ink font-serif dark:text-app-text-dark">
					Why public data is hard to use today
				</h2>
				<p class="text-sm text-app-muted leading-7 mt-5 dark:text-app-muted-dark">
					Public information is often distributed across filing portals, meeting minutes, clerk notices, ethics forms, and campaign materials. That creates a usability problem long before it becomes an analysis problem.
				</p>
			</div>

			<div class="surface-panel">
				<h2 class="text-3xl text-app-ink font-serif dark:text-app-text-dark">
					How this product helps
				</h2>
				<p class="text-sm text-app-muted leading-7 mt-5 dark:text-app-muted-dark">
					Ballot Clarity organizes contests by office, attaches sources directly to summaries, and surfaces limits and uncertainty in the same place users read the information. The goal is clarity, not persuasion.
				</p>
			</div>
		</section>

		<section class="surface-panel max-w-4xl">
			<h2 class="text-3xl text-app-ink font-serif dark:text-app-text-dark">
				Volunteer or contact
			</h2>
			<p class="text-sm text-app-muted leading-7 mt-5 dark:text-app-muted-dark">
				Ballot Clarity is still an MVP concept. Researchers, civic technologists, designers, and election-information volunteers are welcome to get in touch.
			</p>
			<div class="mt-6 flex flex-wrap gap-3">
				<a :href="`mailto:${contactEmail}`" class="btn-primary">
					Contact the project
				</a>
				<NuxtLink to="/methodology" class="btn-secondary">
					Review methodology
				</NuxtLink>
			</div>
		</section>
	</section>
</template>
