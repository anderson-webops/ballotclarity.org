<script setup lang="ts">
import type { StateQuestionsResponse } from "~/types/civic";
import { groupBallotQuestions } from "~/utils/ballot-question-groups";

const route = useRoute();
const api = useApiClient();
const { formatDate } = useFormatters();
const state = computed(() => typeof route.query.state === "string" && /^[A-Z]{2}$/u.test(route.query.state) ? route.query.state : "");
const source = computed(() => typeof route.query.source === "string" ? route.query.source : "");
const { data, error, pending, refresh } = await useAsyncData(
	() => `ballot-questions:${state.value}:${source.value}`,
	() => state.value && source.value ? api<StateQuestionsResponse>(`/state-records/${state.value}/questions`, { query: { source: source.value } }) : Promise.resolve(null),
	{ default: () => null }
);
const groups = computed(() => groupBallotQuestions(data.value?.questions ?? []));
const title = computed(() => data.value?.source.questionKind === "notice" ? "Election notices" : "Ballot questions");
usePageSeo(() => ({ title: title.value, description: "Official election publications and their stated jurisdictions.", path: "/questions", robots: "noindex,follow" }));
</script>

<template>
	<section class="app-shell section-gap max-w-4xl space-y-10">
		<header class="space-y-4">
			<h1 class="text-5xl text-app-ink font-serif dark:text-app-text-dark">
				{{ title }}
			</h1>
			<p v-if="groups.length === 1" class="text-app-muted dark:text-app-muted-dark">
				{{ groups[0]?.label }}
			</p>
			<p v-if="data?.source.sourceAsOfDate" class="text-sm text-app-muted dark:text-app-muted-dark">
				Source as of {{ formatDate(data.source.sourceAsOfDate) }}
			</p>
			<time v-if="data?.source.electionDate" :datetime="data.source.electionDate" class="text-sm text-app-muted dark:text-app-muted-dark">
				{{ formatDate(data.source.electionDate) }}
			</time>
		</header>
		<p v-if="pending" role="status">
			Loading questions…
		</p>
		<div v-else-if="error" class="space-y-4" role="status">
			<p>Ballot questions are temporarily unavailable.</p>
			<button type="button" class="btn-secondary" @click="refresh()">
				Retry
			</button>
		</div>
		<p v-else-if="!data?.available || !data.questions.length" role="status">
			No questions are available for this source.
		</p>
		<BallotQuestionList v-else :questions="data.questions" :state="state" :source="source" :label="title" />
	</section>
</template>
