<script setup lang="ts">
import type { DataSourceCategory } from "~/types/civic";

defineProps<{
	roadmapPreview: DataSourceCategory[];
}>();
</script>

<template>
	<section v-if="roadmapPreview.length" class="app-shell">
		<div class="gap-8 grid lg:grid-cols-[minmax(0,0.58fr)_minmax(0,1fr)]">
			<div>
				<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
					Data sources
				</p>
				<h2 class="text-4xl text-app-ink font-serif mt-3 max-w-xl dark:text-app-text-dark">
					Use official sources where they are authoritative, then explain the rest clearly.
				</h2>
				<p class="bc-measure text-base text-app-muted leading-8 mt-5 dark:text-app-muted-dark">
					Ballot Clarity should show readers which source systems it uses, what each one is for, and where the limits are.
				</p>
				<div class="mt-6 flex flex-wrap gap-3">
					<NuxtLink to="/data-sources" class="btn-primary" prefetch-on="interaction">
						Open data sources
					</NuxtLink>
					<NuxtLink to="/methodology" class="btn-secondary" prefetch-on="interaction">
						Review methodology
					</NuxtLink>
				</div>
			</div>

			<div class="divide-app-line divide-y dark:divide-app-line-dark">
				<article v-for="item in roadmapPreview" :key="item.slug" class="py-5">
					<h3 class="text-2xl text-app-ink font-serif dark:text-app-text-dark">
						{{ item.title }}
					</h3>
					<p class="text-sm text-app-muted leading-7 mt-3 dark:text-app-muted-dark">
						{{ item.summary }}
					</p>
					<p class="text-sm text-app-muted leading-7 mt-3 dark:text-app-muted-dark">
						<strong class="text-app-ink dark:text-app-text-dark">Rule:</strong> {{ item.authoritativeRule }}
					</p>
					<p class="text-sm text-app-muted leading-7 mt-3 dark:text-app-muted-dark">
						<strong class="text-app-ink dark:text-app-text-dark">Approach:</strong> {{ item.liveApproach }}
					</p>
				</article>
			</div>
		</div>
	</section>
</template>
