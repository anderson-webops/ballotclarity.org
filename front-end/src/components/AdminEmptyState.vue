<script setup lang="ts">
defineProps<{
	actionLabel?: string;
	actionTo?: string;
	eyebrow: string;
	message: string;
	secondaryLabel?: string;
	secondaryTo?: string;
	title: string;
}>();
</script>

<template>
	<section class="surface-panel max-w-4xl">
		<div class="gap-5 grid sm:grid-cols-[auto_minmax(0,1fr)] sm:items-start">
			<div class="text-app-accent border border-app-line rounded-[1.3rem] bg-app-bg flex h-12 w-12 items-center justify-center dark:border-app-line-dark dark:bg-app-bg-dark/70">
				<span class="i-carbon-inbox text-2xl" aria-hidden="true" />
			</div>

			<div class="min-w-0">
				<p class="text-xs text-app-muted tracking-[0.22em] font-semibold uppercase dark:text-app-muted-dark">
					{{ eyebrow }}
				</p>
				<h2 class="text-3xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
					{{ title }}
				</h2>
				<p class="text-sm text-app-muted leading-7 mt-4 dark:text-app-muted-dark">
					{{ message }}
				</p>
				<div v-if="actionTo || secondaryTo" class="mt-5 flex flex-wrap gap-3">
					<NuxtLink v-if="actionTo && actionLabel" :to="actionTo" class="btn-primary">
						{{ actionLabel }}
					</NuxtLink>
					<NuxtLink v-if="secondaryTo && secondaryLabel" :to="secondaryTo" class="btn-secondary">
						{{ secondaryLabel }}
					</NuxtLink>
				</div>
			</div>
		</div>
	</section>
</template>
