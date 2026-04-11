<script setup lang="ts">
usePageSeo({
	description: "The page you requested could not be found on Ballot Clarity.",
	path: "/404",
	title: "Page Not Found",
});
</script>

<template>
	<section class="app-shell section-gap">
		<div class="surface-panel max-w-3xl">
			<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
				404
			</p>
			<h1 class="text-4xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
				This page could not be found.
			</h1>
			<p class="text-base text-app-muted leading-7 mt-4 max-w-2xl dark:text-app-muted-dark">
				The page may have moved, the link may be incomplete, or the record may not be available in the current coverage area. Return to the home page, search the site, or open the source directory.
			</p>
			<div class="mt-8 flex flex-wrap gap-3">
				<NuxtLink to="/" class="btn-primary">
					Back to home
				</NuxtLink>
				<NuxtLink to="/search" class="btn-secondary">
					Search the site
				</NuxtLink>
				<NuxtLink to="/sources" class="btn-secondary">
					Open source directory
				</NuxtLink>
			</div>
		</div>
	</section>
</template>
