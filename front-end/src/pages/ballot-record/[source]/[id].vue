<script setup lang="ts">
import type { LocationLookupResponse } from "~/types/civic";
import { storeToRefs } from "pinia";
import { ballotSourceNotes } from "~/utils/ballot-notices";
import { ballotRecordStatusLabels, findBallotCandidate } from "~/utils/ballot-view";
import { normalizeLookupResponseForDisplay } from "~/utils/nationwide-results";
import { buildNationwideRouteTarget, extractNationwideLookupRouteQuery } from "~/utils/nationwide-route-context";

const route = useRoute();
const api = useApiClient();
const civicStore = useCivicStore();
const { isHydrated, nationwideLookupResult } = storeToRefs(civicStore);
const sourceId = useRouteStringParam("source");
const candidateId = useRouteStringParam("id");
const lookupQuery = computed(() => extractNationwideLookupRouteQuery(route.query));
const storedCandidate = computed(() => isHydrated.value ? findBallotCandidate(nationwideLookupResult.value, sourceId.value, candidateId.value) : null);
const { formatDate } = useFormatters();
const { data, error, pending, refresh } = await useAsyncData(
	() => `ballot-record:${sourceId.value}:${candidateId.value}:${lookupQuery.value?.lookup ?? "active"}:${lookupQuery.value?.selection ?? ""}`,
	async () => {
		if (storedCandidate.value) return storedCandidate.value;
		const response = lookupQuery.value
			? await api<LocationLookupResponse>("/location", { method: "POST", body: { q: lookupQuery.value.lookup, ...(lookupQuery.value.selection ? { selectionId: lookupQuery.value.selection } : {}) } })
			: await api<LocationLookupResponse | null>("/location/active");
		return response ? findBallotCandidate(normalizeLookupResponseForDisplay(response, null), sourceId.value, candidateId.value) : null;
	},
	{ watch: [isHydrated, sourceId, candidateId, lookupQuery] }
);
const record = computed(() => storedCandidate.value ?? data.value);
const sourceNotes = computed(() => record.value ? ballotSourceNotes([record.value.preview]) : []);
const backTarget = computed(() => buildNationwideRouteTarget("/results", nationwideLookupResult.value, route.query));

usePageSeo({ title: record.value?.candidate.name ?? "Candidate record", description: record.value ? `${record.value.candidate.name} · ${record.value.contest.title}` : "Candidate source record.", path: route.path, robots: "noindex,nofollow" });
</script>

<template>
	<article class="app-shell section-gap max-w-3xl space-y-6">
		<NuxtLink :to="backTarget" class="text-sm text-app-accent underline underline-offset-3 focus-ring">
			Area results
		</NuxtLink>
		<p v-if="pending && !record" role="status" class="text-app-muted dark:text-app-muted-dark">
			Loading record…
		</p>
		<div v-else-if="error || !record" class="space-y-4">
			<h1 class="text-3xl font-serif">
				Candidate record unavailable
			</h1>
			<button v-if="error" class="btn-secondary" type="button" @click="refresh()">
				Try again
			</button>
			<NuxtLink v-else to="/#location-lookup" class="text-app-accent underline underline-offset-3 focus-ring">
				Look up your area
			</NuxtLink>
		</div>
		<template v-else>
			<header>
				<h1 class="text-4xl text-app-ink font-serif dark:text-app-text-dark">
					{{ record.candidate.name }}
				</h1>
				<p class="text-lg text-app-muted mt-3 dark:text-app-muted-dark">
					{{ record.contest.title }}<template v-if="record.contest.districtName">
						· {{ record.contest.districtName }}
					</template>
				</p>
				<p v-if="record.preview.electionDate" class="text-sm text-app-muted mt-5 dark:text-app-muted-dark">
					Election: {{ formatDate(record.preview.electionDate) }}
				</p>
			</header>
			<dl class="space-y-4">
				<div v-if="record.candidate.party">
					<dt class="font-semibold">
						Party
					</dt><dd><PartyLabel :party="record.candidate.party" /></dd>
				</div>
				<div v-if="record.candidate.ballotStatus && ballotRecordStatusLabels[record.candidate.ballotStatus]">
					<dt class="font-semibold">
						Status
					</dt><dd>{{ ballotRecordStatusLabels[record.candidate.ballotStatus] }}</dd>
				</div>
				<div v-if="record.candidate.ballotDesignation">
					<dt class="font-semibold">
						Ballot designation
					</dt><dd>{{ record.candidate.ballotDesignation }}</dd>
				</div>
			</dl>
			<SafeExternalLink v-if="record.candidate.candidateUrl" :href="record.candidate.candidateUrl" class="text-app-accent underline underline-offset-3 inline-block focus-ring">
				Candidate website
			</SafeExternalLink>
			<section aria-label="Source" class="text-sm text-app-muted pt-5 border-t border-app-line space-y-3 dark:text-app-muted-dark dark:border-app-line-dark">
				<SafeExternalLink v-if="record.preview.sourceUrl" :href="record.preview.sourceUrl" class="text-app-accent underline underline-offset-3 focus-ring">
					{{ record.preview.providerLabel }}
				</SafeExternalLink>
				<UpdatedAt :value="record.preview.generatedAt" label="Ballot data updated on" footer />
				<p v-for="note in sourceNotes" :key="note">
					{{ note }}
				</p>
			</section>
		</template>
	</article>
</template>
