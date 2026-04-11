<script setup lang="ts">
usePageSeo({
	description: "The page you requested could not be found in the Ballot Clarity demo.",
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
				This page is not part of the demo ballot guide.
			</h1>
			<p class="text-base text-app-muted leading-7 mt-4 max-w-2xl dark:text-app-muted-dark">
				The page may have moved, or the link may be incomplete. Return to the home page to start a ballot lookup or browse the methodology and demo ballot.
			</p>
			<div class="mt-8 flex flex-wrap gap-3">
				<NuxtLink to="/" class="btn-primary">
					Back to home
				</NuxtLink>
				<NuxtLink to="/ballot" class="btn-secondary">
					Open demo ballot
				</NuxtLink>
			</div>
		</div>
	</section>
</template>
