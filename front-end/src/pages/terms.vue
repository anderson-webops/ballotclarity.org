<script setup lang="ts">
usePageSeo({
	description: "Terms of use for the Ballot Clarity MVP demo.",
	path: "/terms",
	title: "Terms",
});

const sections = [
	{
		body: "Ballot Clarity is an informational product. It does not provide legal advice, election administration advice, or voting recommendations. Users remain responsible for verifying official election details with the relevant public authority.",
		title: "Informational use only",
	},
	{
		body: "This MVP includes realistic mock data and locally hosted demo source files. It should not be treated as an official election guide or a substitute for original public records.",
		title: "Demo status",
	},
	{
		body: "The service may change, pause, or be removed at any time while the project is in MVP form. Features, routes, and sample records may be revised without notice.",
		title: "Availability",
	},
	{
		body: "Users may review, test, and evaluate the site for lawful purposes. Automated or abusive traffic that interferes with the product, its hosting, or its data sources is not permitted.",
		title: "Acceptable use",
	},
];
</script>

<template>
	<section class="app-shell section-gap space-y-6">
		<header class="max-w-3xl">
			<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
				Terms
			</p>
			<h1 class="text-5xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
				Terms of use for the MVP demo
			</h1>
			<p class="text-sm text-app-muted leading-7 mt-5 dark:text-app-muted-dark">
				This is concise placeholder legal copy for a product test environment. It sets expectations about informational use, demo data, and service availability.
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
