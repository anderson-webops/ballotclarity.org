<script setup lang="ts">
import type { BallotResponse, StateQuestionsResponse } from "~/types/civic";
import type { ElectionSectionLink } from "~/utils/election-candidates";
import { electionQuestions } from "~/utils/election-questions";

const props = defineProps<{ source: NonNullable<BallotResponse["candidateRecordSource"]>; electionDate: string }>();
const emit = defineEmits<{ sections: [items: ElectionSectionLink[]] }>();
const api = useApiClient();
const { data, error, refresh } = await useAsyncData<StateQuestionsResponse | null>(
	() => `election-questions:${props.source.stateCode}:${props.source.sourceId}:${props.electionDate}`,
	() => api<StateQuestionsResponse>(`/state-records/${props.source.stateCode}/questions`, { query: { source: props.source.sourceId } }),
	{ default: () => null, lazy: true }
);
const questions = computed(() => electionQuestions(data.value, props.source, props.electionDate));
const title = computed(() => data.value?.source.questionKind === "notice" ? "Election notices" : "Ballot questions");
const sections = computed<ElectionSectionLink[]>(() => questions.value.length && !error.value ? [{ href: "#election-questions-heading", label: title.value }] : []);
const mounted = useMounted();
watch([mounted, sections], ([ready, items]) => {
	if (ready) emit("sections", items);
}, { immediate: true });
</script>

<template>
	<section v-if="error || questions.length" aria-labelledby="election-questions-heading" class="min-w-0">
		<h2 id="election-questions-heading" tabindex="-1" class="text-3xl text-app-ink font-serif text-center dark:text-app-text-dark">
			{{ title }}
		</h2>
		<div v-if="error" role="status" class="text-sm text-app-muted mt-5 flex flex-wrap gap-3 items-center dark:text-app-muted-dark">
			<p>Ballot questions are temporarily unavailable.</p>
			<button type="button" class="text-app-accent py-2 underline focus-ring" @click="refresh()">
				Retry
			</button>
		</div>
		<BallotQuestionList v-else :questions="questions" :state="source.stateCode" :source="source.sourceId" :label="title" :heading-level="3" class="mt-8" />
	</section>
</template>
