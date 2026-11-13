<script setup lang="ts">
import type { PublicBallotQuestion } from "~/types/civic";
import { groupBallotQuestions } from "~/utils/ballot-question-groups";
import { ballotQuestionHeading } from "~/utils/ballot-question-heading";

const props = withDefaults(defineProps<{ questions: PublicBallotQuestion[]; state: string; source: string; label: string; headingLevel?: 2 | 3 }>(), { headingLevel: 2 });
const groups = computed(() => groupBallotQuestions(props.questions));
</script>

<template>
	<div class="space-y-16">
		<section v-for="group in groups" :key="group.audience" class="space-y-5">
			<component :is="`h${headingLevel}`" v-if="groups.length > 1" class="text-2xl text-app-ink font-serif dark:text-app-text-dark">
				{{ group.label }}
			</component>
			<ul class="border-t border-app-line divide-app-line divide-y dark:border-app-line-dark dark:divide-app-line-dark" :aria-label="groups.length > 1 ? group.label : label">
				<li v-for="question in group.questions" :key="question.id">
					<NuxtLink :to="{ path: `/question/${state}/${question.id}`, query: { source } }" prefetch-on="interaction" class="py-7 rounded-md block focus-ring">
						<component :is="`h${headingLevel + (groups.length > 1 ? 1 : 0)}`" class="text-xl text-app-ink font-serif dark:text-app-text-dark">
							{{ ballotQuestionHeading(question.title, question.audience).title }}
						</component>
						<p v-if="ballotQuestionHeading(question.title, question.audience).reference" class="text-sm text-app-muted mt-3 dark:text-app-muted-dark">
							{{ ballotQuestionHeading(question.title, question.audience).reference }}
						</p>
					</NuxtLink>
				</li>
			</ul>
		</section>
	</div>
</template>
