<script setup lang="ts">
import { participationGuides } from "~/data/civic-participation";

usePageSeo({
	description: "Find public meetings, local party roles, government boards, election work, and candidate resources, with Fulton County, Georgia guidance.",
	path: "/get-involved",
	title: "Get involved"
});
</script>

<template>
	<article class="app-shell section-gap">
		<h1 class="text-5xl text-app-ink font-serif dark:text-app-text-dark">
			Get involved
		</h1>
		<div class="mt-12 gap-8 grid md:grid-cols-3">
			<NuxtLink
				v-for="guide in participationGuides"
				:key="guide.slug"
				:to="`/get-involved/${guide.slug}`"
				prefetch-on="interaction"
				class="p-7 border border-app-line rounded-xl block transition dark:border-app-line-dark hover:border-app-accent focus-ring"
			>
				<h2 class="text-3xl text-app-ink font-serif dark:text-app-text-dark">
					{{ guide.title }}
				</h2>
				<p class="text-base text-app-ink leading-7 mt-5 dark:text-app-text-dark">
					{{ guide.summary }}
				</p>
			</NuxtLink>
		</div>
	</article>
</template>
