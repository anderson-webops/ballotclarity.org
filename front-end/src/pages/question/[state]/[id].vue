<script setup lang="ts">
import type { StateQuestionsResponse } from "~/types/civic";
import { ballotQuestionHeading } from "~/utils/ballot-question-heading";

const route = useRoute();
const api = useApiClient();
const { formatDate } = useFormatters();
const state = useRouteStringParam("state");
const id = useRouteStringParam("id");
const source = computed(() => typeof route.query.source === "string" ? route.query.source : "");
const { data, error, pending, refresh } = await useAsyncData(
	() => `ballot-question:${state.value}:${source.value}:${id.value}`,
	() => /^[A-Z]{2}$/u.test(state.value) && /^[a-f0-9]{24}$/u.test(id.value) && source.value ? api<StateQuestionsResponse>(`/state-records/${state.value}/questions`, { query: { source: source.value, id: id.value } }) : Promise.resolve(null),
	{ default: () => null }
);
const question = computed(() => data.value?.questions.find(item => item.id === id.value));
const heading = computed(() => ballotQuestionHeading(question.value?.title ?? "Ballot question"));
const paragraphs = computed(() => question.value?.officialText.split(/\n\s*\n/u).filter(Boolean) ?? []);
const backTo = computed(() => ({ path: "/questions", query: { state: state.value, source: source.value } }));
const documentUrl = computed(() => {
	const link = data.value?.source.documentLinks?.[0];
	const url = link?.url;
	return url && question.value ? `${url}#${link?.pageAnchor === "page-" ? "page-" : "page="}${question.value.pages[0]}` : data.value?.source.url;
});
usePageSeo({ title: heading.value.title, description: "Official ballot question wording and source.", path: route.path, robots: "noindex,follow" });
</script>

<template>
	<article class="app-shell section-gap max-w-3xl space-y-12">
		<NuxtLink :to="backTo" class="text-app-accent underline underline-offset-3 focus-ring">
			Ballot questions
		</NuxtLink>
		<p v-if="pending" role="status">
			Loading question…
		</p>
		<div v-else-if="error || !question" class="space-y-4">
			<h1 class="text-3xl font-serif">
				Ballot question unavailable
			</h1>
			<button v-if="error" type="button" class="btn-secondary" @click="refresh()">
				Retry
			</button>
		</div>
		<template v-else>
			<header class="space-y-5">
				<h1 class="text-3xl text-app-ink font-serif dark:text-app-text-dark">
					{{ heading.title }}
				</h1>
				<p v-if="heading.reference" class="text-sm text-app-muted dark:text-app-muted-dark">
					{{ heading.reference }}
				</p>
				<p class="text-app-muted dark:text-app-muted-dark">
					{{ question.audience }}
				</p>
				<p v-if="data?.source.electionDate" class="text-sm text-app-muted dark:text-app-muted-dark">
					Election: {{ formatDate(data.source.electionDate) }}
				</p>
			</header>
			<section class="space-y-6" aria-label="Official question">
				<div class="text-lg leading-8 space-y-6">
					<p v-for="(paragraph, index) in paragraphs" :key="index">
						{{ paragraph }}
					</p>
				</div>
				<ul class="pl-5 list-disc space-y-2" aria-label="Ballot choices">
					<li v-for="choice in question.choices" :key="choice">
						{{ choice }}
					</li>
				</ul>
			</section>
			<section class="pt-8 border-t border-app-line space-y-4 dark:border-app-line-dark" aria-label="Source">
				<SafeExternalLink v-if="documentUrl" :href="documentUrl" class="text-app-accent underline underline-offset-3 focus-ring">
					Official question · {{ question.pages.length > 1 ? 'Pages' : 'Page' }} {{ question.pages.join(', ') }}
				</SafeExternalLink>
				<p v-if="data?.source.sourceAsOfDate" class="text-sm text-app-muted dark:text-app-muted-dark">
					Source as of {{ formatDate(data.source.sourceAsOfDate) }}
				</p>
			</section>
		</template>
	</article>
</template>
