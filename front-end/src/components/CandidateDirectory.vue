<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { navigateTo, useRoute } from "#app";
import { NuxtLink } from "#components";
import ElectionReferences from "~/components/ElectionReferences.vue";
import OfficialSampleBallot from "~/components/OfficialSampleBallot.vue";
import PartyLabel from "~/components/PartyLabel.vue";
import ProfileImageStack from "~/components/ProfileImageStack.vue";
import UpdatedAt from "~/components/UpdatedAt.vue";
import { useElectionReferenceCatalog, useElectionReferences } from "~/composables/useElectionReferences";
import { useFormatters } from "~/composables/useFormatters";
import { useStateRecords, useStateRecordStates } from "~/composables/useStateRecords";
import { useCivicStore } from "~/stores/civic";
import { isSampleBallotDocument, recordPublications, recordSourceNotice } from "~/utils/record-publications";
import { readReferenceElection, referenceElectionControl, referenceElectionQuery } from "~/utils/reference-election";
import { readRecoverableStateRecordQuery, stateRecordSourceMismatch, stateRecordSourceSelectionRequired } from "~/utils/state-record-query";
import { readStateRecordQuery, stateRecordScopes, stateRecordSummaryParts } from "~/utils/state-records";

const route = useRoute();
const civicStore = useCivicStore();
const { formatDate } = useFormatters();
const { data: stateData, error: stateError, refresh: refreshStates } = await useStateRecordStates();
const filters = computed(() => readRecoverableStateRecordQuery(route.query, stateData.value?.states ?? [], civicStore.isHydrated ? civicStore.selectedLocation?.state : undefined));
const referenceElection = computed(() => readReferenceElection(route.query.referenceElection, route.query.source));
const candidateFilters = computed(() => ({
	...filters.value,
	stateCode: referenceElection.value === undefined
		? filters.value.stateCode
		: ""
}));
const { data, error, pending, refresh } = await useStateRecords(candidateFilters);
const sourceMismatch = computed(() => stateRecordSourceMismatch(route.query.source, data.value));
const sampleBallot = computed(() => sourceMismatch.value
	? undefined
	: recordPublications(data.value?.source).find(isSampleBallotDocument));
const notice = computed(() => recordSourceNotice(data.value?.source));
const sourceElection = computed(() => stateData.value?.states.find(state => state.stateCode === filters.value.stateCode)?.sources?.find(source => source.id === filters.value.sourceId)?.electionDate);
const referenceFilters = computed(() => ({
	stateCode: filters.value.stateCode,
	search: filters.value.search,
	scope: filters.value.scope,
	electionDate: referenceElection.value ?? sourceElection.value,
	offset: readStateRecordQuery({ offset: route.query.referenceOffset }, []).offset
}));
const { data: referenceCatalog, error: catalogError, refresh: refreshCatalog } = await useElectionReferenceCatalog(() => filters.value.stateCode);
const { data: referenceData, error: referenceError, pending: referencePending, refresh: refreshReferences } = await useElectionReferences(referenceFilters);
const selectedState = ref(filters.value.stateCode);
const selectedSource = ref(referenceElectionControl(filters.value.sourceId, referenceElection.value));
const selectedStateData = computed(() => stateData.value?.states.find(state => state.stateCode === selectedState.value));
const sourceOptions = computed(() => selectedStateData.value?.sources ?? []);
const referenceDates = computed(() => referenceCatalog.value?.stateCode === selectedState.value
	? referenceCatalog.value.elections
	: []);
const showSourceSelection = computed(() => stateRecordSourceSelectionRequired(selectedStateData.value) || Boolean(referenceDates.value.length));
const unavailableSource = computed(() => Boolean(sourceOptions.value.length && filters.value.sourceId && !sourceOptions.value.some(source => source.id === filters.value.sourceId)));
const searchInput = ref(filters.value.search);
const selectedScope = ref(filters.value.scope);
const includeInactive = ref(filters.value.status === "all");
const invalidState = computed(() => typeof route.query.state === "string" && Boolean(route.query.state) && !filters.value.stateCode);
const recordRange = computed(() => data.value?.matched
	? `${data.value.offset + 1}–${Math.min(data.value.offset + data.value.records.length, data.value.matched)} of ${data.value.matched}`
	: "0 records");

watch([filters, referenceElection], ([value]) => {
	selectedState.value = value.stateCode;
	selectedSource.value = referenceElectionControl(value.sourceId, referenceElection.value);
	searchInput.value = value.search;
	selectedScope.value = value.scope;
	includeInactive.value = value.status === "all";
});

async function applyFilters(offset = 0) {
	await navigateTo({
		path: "/search",
		query: {
			type: "candidate",
			state: selectedState.value,
			...referenceElectionQuery(selectedSource.value),
			...(searchInput.value.trim()
				? {
						q: searchInput.value.trim()
					}
				: {}),
			...(selectedScope.value !== "all"
				? { scope: selectedScope.value }
				: {}),
			...(includeInactive.value
				? { status: "all" }
				: {}),
			...(offset
				? {
						offset: String(offset)
					}
				: {}),
		},
	});
}

async function changeState() {
	selectedSource.value = "";
	await applyFilters();
}

async function retryRecords() {
	await refreshStates();
	await refresh();
}

async function retryReferences() {
	await refreshCatalog();
	await refreshReferences();
}
</script>

<template>
	<section class="space-y-8" aria-label="Candidate directory">
		<OfficialSampleBallot v-if="sampleBallot" :href="sampleBallot.url" />
		<form class="gap-4 grid sm:grid-cols-2" aria-label="Filter candidate records" @submit.prevent="applyFilters()">
			<div>
				<label for="record-state" class="text-sm text-app-ink font-semibold dark:text-app-text-dark">State</label>
				<select id="record-state" v-model="selectedState" class="text-base text-app-ink mt-2 px-3 border border-app-line rounded-lg bg-app-panel h-12 w-full dark:text-app-text-dark dark:border-app-line-dark dark:bg-app-panel-dark focus-ring" @change="changeState()">
					<option value="">
						Select a state
					</option>
					<option v-for="state in stateData?.states ?? []" :key="state.stateCode" :value="state.stateCode">
						{{ state.stateName }}
					</option>
				</select>
			</div>
			<div>
				<label for="record-scope" class="text-sm text-app-ink font-semibold dark:text-app-text-dark">Office level</label>
				<select id="record-scope" v-model="selectedScope" class="text-base text-app-ink mt-2 px-3 border border-app-line rounded-lg bg-app-panel h-12 w-full dark:text-app-text-dark dark:border-app-line-dark dark:bg-app-panel-dark focus-ring" @change="applyFilters()">
					<option v-for="scope in stateRecordScopes" :key="scope.value" :value="scope.value">
						{{ scope.label }}
					</option>
				</select>
			</div>
			<div v-if="showSourceSelection || unavailableSource" class="sm:col-span-2">
				<label for="record-source" class="text-sm text-app-ink font-semibold dark:text-app-text-dark">Election</label>
				<select id="record-source" v-model="selectedSource" class="text-base text-app-ink mt-2 px-3 border border-app-line rounded-lg bg-app-panel h-12 w-full dark:text-app-text-dark dark:border-app-line-dark dark:bg-app-panel-dark focus-ring" @change="applyFilters()">
					<option v-if="unavailableSource" :value="filters.sourceId" disabled>
						Unavailable source
					</option>
					<option value="">
						Current election
					</option>
					<option v-for="source in sourceOptions" :key="source.id" :value="source.id">
						{{ formatDate(source.electionDate) }} · {{ source.label }}
					</option>
					<optgroup v-if="referenceDates.length" label="Profiles">
						<option v-for="date in referenceDates" :key="date" :value="referenceElectionControl(undefined, date)">
							{{ formatDate(date) }}
						</option>
					</optgroup>
				</select>
			</div>
			<div class="sm:col-span-2">
				<label for="record-search" class="text-sm text-app-ink font-semibold dark:text-app-text-dark">Name, office or jurisdiction</label>
				<div class="mt-2 flex gap-3">
					<input id="record-search" v-model="searchInput" maxlength="120" type="search" class="text-base text-app-ink px-3 border border-app-line rounded-lg bg-app-panel flex-1 h-12 min-w-0 dark:text-app-text-dark dark:border-app-line-dark dark:bg-app-panel-dark focus-ring">
					<button type="submit" class="btn-primary" :disabled="!selectedState">
						Search
					</button>
				</div>
			</div>
			<label v-if="referenceElection === undefined && (data?.inactive || includeInactive)" class="text-sm text-app-ink flex gap-2 items-center dark:text-app-text-dark sm:col-span-2">
				<input v-model="includeInactive" type="checkbox" class="h-4 w-4 focus-ring" @change="applyFilters()">
				Include inactive records
			</label>
		</form>
		<p v-if="stateError || error || sourceMismatch" class="text-sm text-app-muted dark:text-app-muted-dark" role="status">
			Candidate records are temporarily unavailable.
			<button type="button" class="text-app-accent underline focus-ring" @click="retryRecords()">
				Retry
			</button>
		</p>
		<p v-else-if="invalidState" class="text-sm text-app-muted dark:text-app-muted-dark" role="status">
			State not recognized.
		</p>
		<p v-else-if="pending && filters.stateCode" class="text-sm text-app-muted dark:text-app-muted-dark" role="status">
			Loading records…
		</p>
		<template v-else-if="data">
			<div class="text-sm text-app-muted leading-6 flex flex-wrap gap-x-4 gap-y-1 items-center dark:text-app-muted-dark">
				<p v-if="data.source.electionDate">
					<time :datetime="data.source.electionDate">{{ formatDate(data.source.electionDate) }}</time>
				</p>
				<NuxtLink v-if="data.source.documentLinks?.length || data.source.url" :to="{ path: '/record-sources', query: { ...route.query, state: filters.stateCode, ...(data.source.id ? { source: data.source.id } : {}) } }" class="text-app-accent py-2 rounded-md underline underline-offset-3 min-h-11 inline-block focus-ring">
					Sources
				</NuxtLink>
				<aside v-if="data.available && notice" aria-label="Record limitations" class="basis-full">
					<p>{{ notice }}</p>
				</aside>
				<p v-if="data.source.sourceAsOfDate" class="basis-full">
					As of {{ formatDate(data.source.sourceAsOfDate) }}
				</p>
				<NuxtLink v-if="data.questionCount" :to="{ path: '/questions', query: { state: filters.stateCode, source: data.source.id } }" class="text-app-accent py-2 rounded-md underline underline-offset-3 min-h-11 inline-block focus-ring">
					{{ data.source.questionKind === 'notice' ? 'Election notices' : 'Questions' }} ({{ data.questionCount }})
				</NuxtLink>
			</div>
			<UpdatedAt v-if="data.source.retrievedAt" :value="data.source.retrievedAt" label="Ballot data updated on" footer />
			<p v-if="data.awaitingRecords && !referenceData?.available && !referenceDates.length" class="text-sm text-app-muted dark:text-app-muted-dark" role="status">
				No records yet.
			</p>
			<p v-else-if="!data.available && !referenceData?.available && !referenceDates.length" class="text-sm text-app-muted dark:text-app-muted-dark" role="status">
				Official candidate records are unavailable for this {{ data.source.id ? "source" : "state" }}.
			</p>
			<template v-else-if="data.available">
				<p id="record-count" class="text-sm text-app-muted dark:text-app-muted-dark" role="status">
					{{ recordRange }}
				</p>
				<ul class="border-t border-app-line divide-app-line divide-y dark:border-app-line-dark dark:divide-app-line-dark" aria-label="Candidate records">
					<li v-for="record in data.records" :key="record.id" class="flex gap-4 min-w-0 break-words items-center">
						<ProfileImageStack v-if="record.profileImages?.length" :images="record.profileImages" :name="record.name" size="sm" class="shrink-0" />
						<NuxtLink :to="{ path: `/record/${filters.stateCode}/${record.id}`, query: { name: record.name, source: data.source.id } }" class="py-5 flex flex-1 min-w-0 items-center focus-ring">
							<div class="min-w-0">
								<h2 class="text-xl text-app-ink font-semibold dark:text-app-text-dark">
									{{ record.name }}
								</h2>
								<p class="text-sm text-app-muted leading-6 mt-2 dark:text-app-muted-dark">
									<template v-for="(part, index) in stateRecordSummaryParts(record)" :key="index">
										{{ index ? ' · ' : '' }}<PartyLabel v-if="part.isParty" :party="part.label" /><template v-else>
											{{ part.label }}
										</template>
									</template>
								</p>
							</div>
						</NuxtLink>
					</li>
				</ul>
				<nav v-if="data.matched > data.limit" class="flex flex-wrap gap-4" aria-label="Candidate record pages">
					<button type="button" class="btn-secondary" :disabled="!data.offset" @click="applyFilters(Math.max(0, data.offset - data.limit))">
						Previous
					</button>
					<button type="button" class="btn-secondary" :disabled="data.offset + data.limit >= data.matched" @click="applyFilters(data.offset + data.limit)">
						Next
					</button>
				</nav>
			</template>
		</template>
		<ElectionReferences v-if="filters.stateCode" :state-code="filters.stateCode" :data="referenceData" :error="Boolean(referenceError || catalogError && !referenceData?.available)" :pending="referencePending" @retry="retryReferences()" />
	</section>
</template>
