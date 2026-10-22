<script setup lang="ts">
import type { MeasureReferencesResponse } from "~/types/civic";

defineProps<{ data: MeasureReferencesResponse | null }>();
const { formatDate } = useFormatters();
const passageLabels = { "55-percent": "Passes with 55 percent of the vote", "majority": "Passes with a majority vote" };
</script>

<template>
	<section v-if="data?.available && data.measures.length" class="space-y-4" aria-labelledby="state-measures-heading">
		<h2 id="state-measures-heading" class="text-3xl text-app-ink font-serif dark:text-app-text-dark">
			Statewide ballot measures
		</h2>
		<p v-if="data.source" class="text-sm text-app-muted dark:text-app-muted-dark">
			<SafeExternalLink :href="data.source.url" class="text-app-accent underline underline-offset-3 focus-ring">
				{{ data.source.title }}
			</SafeExternalLink>
			· {{ data.source.publisher }} · <time :datetime="data.source.publishedDate">{{ formatDate(data.source.publishedDate) }}</time>
		</p>
		<ul class="divide-app-line divide-y dark:divide-app-line-dark">
			<li v-for="measure in data.measures" :key="measure.slug" class="py-4">
				<NuxtLink :to="`/measure/${measure.slug}`" class="text-lg text-app-accent font-semibold underline-offset-3 hover:underline focus-ring">
					{{ measure.designation }}: {{ measure.title }}
				</NuxtLink>
				<p class="text-base text-app-ink leading-7 mt-1 dark:text-app-text-dark">
					{{ measure.summary }}
				</p>
				<p class="text-sm text-app-muted mt-1 dark:text-app-muted-dark">
					{{ passageLabels[measure.passage] }}
				</p>
			</li>
		</ul>
	</section>
</template>
