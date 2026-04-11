<script setup lang="ts">
usePageSeo({
	description: "Privacy notice for the Ballot Clarity MVP demo.",
	path: "/privacy",
	title: "Privacy",
});

const sections = [
	{
		body: "This demo does not create user accounts or store personal profiles. Address and ZIP lookups are used only to return sample ballot content in the running session.",
		title: "What this MVP collects",
	},
	{
		body: "Operational logs may capture basic request metadata needed to run, secure, and improve the service. This MVP is not designed to build advertising audiences or cross-site behavioral profiles.",
		title: "Analytics and logs",
	},
	{
		body: "Some links in this MVP point to locally hosted demo source files. In a live version, external source links may direct users to public agencies or campaign filing portals with their own privacy policies.",
		title: "Source links",
	},
	{
		body: "If the product later adds saved preferences, newsletters, volunteer sign-ups, or other recurring services, this privacy notice would need a fuller update before those features go live.",
		title: "Future changes",
	},
];
</script>

<template>
	<section class="app-shell section-gap space-y-6">
		<header class="max-w-3xl">
			<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
				Privacy
			</p>
			<h1 class="text-5xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
				Privacy notice for the MVP demo
			</h1>
			<p class="text-sm text-app-muted leading-7 mt-5 dark:text-app-muted-dark">
				This is placeholder legal copy suitable for an MVP. It is designed to be readable and to explain the current scope of the demo without overstating what the site does.
			</p>
		</header>

		<article v-for="section in sections" :key="section.title" class="surface-panel max-w-4xl">
			<h2 class="text-3xl text-app-ink font-serif dark:text-app-text-dark">
				{{ section.title }}
			</h2>
			<p class="text-sm text-app-muted leading-7 mt-4 dark:text-app-muted-dark">
				{{ section.body }}
			</p>
		</article>
	</section>
</template>
