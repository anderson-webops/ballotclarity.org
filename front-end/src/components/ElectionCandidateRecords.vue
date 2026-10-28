<script setup lang="ts">
import type { BallotResponse, StateRecordsResponse } from "~/types/civic";
import { ballotRecordStatusLabels } from "~/utils/ballot-view";
import { groupElectionCandidates } from "~/utils/election-candidates";

const props = defineProps<{ source: NonNullable<BallotResponse["candidateRecordSource"]> }>();
const api = useApiClient();
const offset = ref(0);
watch(() => props.source.sourceId, () => {
	offset.value = 0;
});
const { data, error, pending, refresh } = await useAsyncData<StateRecordsResponse | null>(
	() => `election-candidates:${props.source.stateCode}:${props.source.sourceId}:${offset.value}`,
	() => api<StateRecordsResponse>(`/state-records/${props.source.stateCode}`, { query: { source: props.source.sourceId, status: "active", limit: 100, offset: offset.value } }),
	{ default: () => null, lazy: true }
);
const groups = computed(() => groupElectionCandidates(data.value?.records ?? []));
const sourceQuery = computed(() => ({ state: props.source.stateCode, source: props.source.sourceId }));
</script>

<template>
	<section id="candidates" aria-labelledby="candidates-heading" class="min-w-0">
		<h2 id="candidates-heading" class="text-2xl text-app-ink font-serif dark:text-app-text-dark">
			Candidates
		</h2>
		<p class="text-sm text-app-muted mt-2 dark:text-app-muted-dark">Not a personalized ballot.</p>
		<p v-if="error" class="text-sm text-app-muted mt-4 dark:text-app-muted-dark" role="status">
			Candidate records are temporarily unavailable.
			<button type="button" class="text-app-accent underline focus-ring" @click="refresh()">
				Retry
			</button>
		</p>
		<p v-else-if="pending" class="text-sm text-app-muted mt-4 dark:text-app-muted-dark" role="status">
			Loading candidates…
		</p>
		<p v-else-if="!data?.available || !groups.length" class="text-sm text-app-muted mt-4 dark:text-app-muted-dark" role="status">
			No candidate records are available yet.
		</p>
		<template v-else>
			<div class="mt-8 space-y-16">
				<section v-for="level in groups" :key="level.id" :aria-labelledby="`candidate-level-${level.id}`">
					<h3 :id="`candidate-level-${level.id}`" class="text-xl text-app-muted font-serif dark:text-app-muted-dark">
						{{ level.label }}
					</h3>
					<div class="mt-6 space-y-10">
						<section v-for="office in level.offices" :key="office.id">
							<h4 class="text-base text-app-ink font-semibold dark:text-app-text-dark">
								{{ office.title }}
							</h4>
							<ul class="mt-3 border-t border-app-line divide-app-line divide-y dark:border-app-line-dark dark:divide-app-line-dark">
								<li v-for="candidate in office.candidates" :key="candidate.id">
									<NuxtLink :to="{ path: `/record/${source.stateCode}/${candidate.id}`, query: { source: source.sourceId, name: candidate.name } }" prefetch-on="interaction" class="py-4 flex gap-4 items-center justify-between focus-ring">
										<span class="min-w-0">
											<span class="text-base text-app-ink font-semibold block break-words dark:text-app-text-dark">{{ candidate.name }}</span>
											<span v-if="candidate.party || ballotRecordStatusLabels[candidate.status]" class="text-sm text-app-muted mt-1 block dark:text-app-muted-dark"><PartyLabel v-if="candidate.party" :party="candidate.party" />{{ candidate.party && ballotRecordStatusLabels[candidate.status] ? ' · ' : '' }}{{ ballotRecordStatusLabels[candidate.status] }}</span>
										</span>
										<span class="i-carbon-chevron-right text-app-accent shrink-0" aria-hidden="true" />
									</NuxtLink>
								</li>
							</ul>
						</section>
					</div>
				</section>
			</div>
			<nav v-if="data && data.matched > data.limit" aria-label="Candidate pages" class="mt-8 flex gap-6 items-center">
				<button type="button" class="btn-secondary" :disabled="!offset" @click="offset = Math.max(0, offset - data.limit)">
					Previous
				</button>
				<p class="text-sm text-app-muted dark:text-app-muted-dark">
					{{ offset + 1 }}–{{ Math.min(offset + data.records.length, data.matched) }} of {{ data.matched }}
				</p>
				<button type="button" class="btn-secondary" :disabled="offset + data.limit >= data.matched" @click="offset += data.limit">
					Next
				</button>
			</nav>
			<aside aria-label="Candidate record limitations" class="text-sm text-app-muted leading-6 mt-10 space-y-2 dark:text-app-muted-dark">
				<p v-if="data?.source.scopeNotice">
					{{ data.source.scopeNotice }}
				</p>
				<div class="flex flex-wrap gap-5">
					<NuxtLink :to="{ path: '/record-sources', query: sourceQuery }" class="text-app-accent py-2 underline focus-ring">
						Sources
					</NuxtLink>
					<NuxtLink v-if="data?.questionCount" :to="{ path: '/questions', query: sourceQuery }" class="text-app-accent py-2 underline focus-ring">
						Questions ({{ data.questionCount }})
					</NuxtLink>
				</div>
			</aside>
		</template>
	</section>
</template>
