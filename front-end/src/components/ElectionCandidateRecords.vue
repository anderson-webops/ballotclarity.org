<script setup lang="ts">
import type { BallotResponse, StateRecordsResponse } from "~/types/civic";
import type { ElectionSectionLink } from "~/utils/election-candidates";
import { electionOfficeLabel, groupElectionCandidates } from "~/utils/election-candidates";
import { isSampleBallotDocument, recordPublications } from "~/utils/record-publications";
import { stateRecordStatusBadges } from "~/utils/state-records";

const props = defineProps<{ source: NonNullable<BallotResponse["candidateRecordSource"]> }>();
const emit = defineEmits<{ sections: [items: ElectionSectionLink[]] }>();
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
const sampleBallot = computed(() => recordPublications(data.value?.source).find(isSampleBallotDocument));
const sections = computed(() => data.value?.available && !pending.value && !error.value && groups.value.length
	? [{ href: "#candidates-heading", label: "Candidates" }, ...groups.value.map(group => ({ href: `#candidate-level-${group.id}`, label: group.label, children: group.offices.map(office => ({ href: `#${office.anchorId}`, label: electionOfficeLabel(office.title), title: office.title })) }))]
	: []);
const mounted = useMounted();
watch([mounted, sections], ([ready, items]) => {
	if (ready) emit("sections", items);
}, { immediate: true });
</script>

<template>
	<section v-if="sampleBallot || pending || error || data?.available && groups.length" id="candidates" :aria-labelledby="pending || error || groups.length ? 'candidates-heading' : undefined" class="min-w-0">
		<OfficialSampleBallot v-if="sampleBallot" :href="sampleBallot.url" class="mb-8" />
		<h2 v-if="pending || error || groups.length" id="candidates-heading" tabindex="-1" class="text-3xl text-app-ink font-serif text-center dark:text-app-text-dark">
			Candidates
		</h2>
		<p v-if="error" class="text-sm text-app-muted mt-4 dark:text-app-muted-dark" role="status">
			Candidate records are temporarily unavailable.
			<button type="button" class="text-app-accent underline focus-ring" @click="refresh()">
				Retry
			</button>
		</p>
		<p v-else-if="pending" class="text-sm text-app-muted mt-4 dark:text-app-muted-dark" role="status">
			Loading candidates…
		</p>
		<template v-else-if="data?.available && groups.length">
			<div class="mt-8 space-y-16">
				<section v-for="level in groups" :key="level.id" :aria-labelledby="`candidate-level-${level.id}`" class="pt-6 border-t border-app-line dark:border-app-line-dark">
					<h3 :id="`candidate-level-${level.id}`" tabindex="-1" class="text-2xl text-app-ink font-semibold dark:text-app-text-dark">
						{{ level.label }}
					</h3>
					<div class="mt-6 space-y-10">
						<section v-for="office in level.offices" :key="office.id">
							<h4 :id="office.anchorId" tabindex="-1" class="text-base text-app-ink font-semibold dark:text-app-text-dark">
								{{ office.title }}
							</h4>
							<ul class="mt-3 border-t border-app-line divide-app-line divide-y dark:border-app-line-dark dark:divide-app-line-dark">
								<li v-for="candidate in office.candidates" :key="candidate.id" class="flex gap-4 items-center">
									<ProfileImageStack v-if="candidate.profileImages?.length" :images="candidate.profileImages" :name="candidate.name" size="sm" class="shrink-0" />
									<NuxtLink :to="{ path: `/record/${source.stateCode}/${candidate.id}`, query: { source: source.sourceId, name: candidate.name } }" prefetch-on="interaction" class="py-4 flex flex-1 gap-4 min-w-0 items-center justify-between focus-ring">
										<span class="flex-1 min-w-0">
											<span class="text-base text-app-ink font-semibold block break-words dark:text-app-text-dark">{{ candidate.name }}</span>
											<span v-if="candidate.party || stateRecordStatusBadges(candidate).length" class="text-sm text-app-muted mt-1 block dark:text-app-muted-dark">
												<PartyLabel v-if="candidate.party" :party="candidate.party" /><template v-for="(badge, index) in stateRecordStatusBadges(candidate)" :key="badge">{{ candidate.party || index ? ' · ' : '' }}{{ badge }}</template>
											</span>
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
		<UpdatedAt v-if="data?.source.retrievedAt" :value="data.source.retrievedAt" label="Ballot data updated on" footer />
	</section>
</template>
