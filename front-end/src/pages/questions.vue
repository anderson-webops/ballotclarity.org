<script setup lang="ts">
import type { PublicBallotQuestion, StateQuestionsResponse } from "~/types/civic";
import { ballotQuestionHeading } from "~/utils/ballot-question-heading";

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
const groups = computed(() => {
	const grouped = new Map<string, PublicBallotQuestion[]>();
	for (const question of data.value?.questions ?? []) grouped.set(question.audience, [...(grouped.get(question.audience) ?? []), question]);
	return [...grouped].map(([audience, questions]) => ({ audience, label: audience.replace(/^To the Voters of (?:the )?/u, "").replace(/:$/u, ""), questions }));
});
usePageSeo({ title: "Ballot questions", description: "Official question wording and published voter audiences.", path: "/questions", robots: "noindex,follow" });
</script>

<template>
	<section class="app-shell section-gap max-w-4xl space-y-10">
		<header class="space-y-4">
			<h1 class="text-5xl text-app-ink font-serif dark:text-app-text-dark">
				Ballot questions
			</h1>
			<p v-if="data?.source.label" class="text-app-muted dark:text-app-muted-dark">
				{{ data.source.label }}
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
		<div v-else class="space-y-16">
			<section v-for="group in groups" :key="group.audience" class="space-y-5">
				<h2 v-if="groups.length > 1" class="text-2xl text-app-ink font-serif dark:text-app-text-dark">
					{{ group.label }}
				</h2>
				<ul class="border-t border-app-line divide-app-line divide-y dark:border-app-line-dark dark:divide-app-line-dark" aria-label="Ballot questions">
					<li v-for="question in group.questions" :key="question.id">
						<NuxtLink :to="{ path: `/question/${state}/${question.id}`, query: { source } }" class="py-7 rounded-md block focus-ring">
							<component :is="groups.length > 1 ? 'h3' : 'h2'" class="text-xl text-app-ink font-serif dark:text-app-text-dark">
								{{ ballotQuestionHeading(question.title).title }}
							</component>
							<p v-if="ballotQuestionHeading(question.title).reference" class="text-sm text-app-muted mt-3 dark:text-app-muted-dark">
								{{ ballotQuestionHeading(question.title).reference }}
							</p>
						</NuxtLink>
					</li>
				</ul>
			</section>
		</div>
	</section>
</template>
