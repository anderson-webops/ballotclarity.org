<script setup lang="ts">
import type { PublicJudicialEvaluation } from "~/types/civic";

const props = defineProps<{ evaluation: PublicJudicialEvaluation }>();
const { formatDate } = useFormatters();
const finding = computed(() => ({
	"retain": "Recommends retention; reports that the judge met its performance standards.",
	"do-not-retain": "Recommends against retention.",
	"not-made": "No recommendation or institutional performance finding."
})[props.evaluation.recommendation]);
</script>

<template>
	<section class="py-6 border-y border-app-line space-y-3 dark:border-app-line-dark" aria-labelledby="official-evaluation-title">
		<h2 id="official-evaluation-title" class="text-2xl font-serif">
			{{ evaluation.issuer }} evaluation
		</h2>
		<p class="font-semibold">
			{{ finding }}
		</p>
		<p v-if="evaluation.criteriaCited.length">
			Cited criteria: {{ evaluation.criteriaCited.join('; ') }}.
		</p>
		<p class="text-sm text-app-muted dark:text-app-muted-dark">
			<SafeExternalLink :href="evaluation.source.url" class="text-app-accent underline underline-offset-3 focus-ring">
				Council report
			</SafeExternalLink>
			· Published <time :datetime="evaluation.publicationDate">{{ formatDate(evaluation.publicationDate) }}</time>
		</p>
	</section>
</template>
