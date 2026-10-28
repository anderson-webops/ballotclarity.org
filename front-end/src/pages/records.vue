<script setup lang="ts">
import { readRecoverableStateRecordQuery, stateRecordSourceMismatch } from "~/utils/state-record-query";
import { readStateRecordQuery, stateRecordScopes, stateRecordSummaryParts } from "~/utils/state-records";

const route = useRoute();
const civicStore = useCivicStore();
const { formatDate } = useFormatters();
const { data: stateData, error: stateError, refresh: refreshStates } = await useStateRecordStates();
const filters = computed(() => readRecoverableStateRecordQuery(route.query, stateData.value?.states ?? [], civicStore.isHydrated ? civicStore.selectedLocation?.state : undefined));
const { data, error, pending, refresh } = await useStateRecords(filters);
const sourceMismatch = computed(() => stateRecordSourceMismatch(route.query.source, data.value));
const referenceFilters = computed(() => ({ stateCode: filters.value.stateCode, search: filters.value.search, scope: filters.value.scope, offset: readStateRecordQuery({ offset: route.query.referenceOffset }, []).offset }));
const { data: referenceData, error: referenceError, pending: referencePending, refresh: refreshReferences } = await useElectionReferences(referenceFilters);
const selectedState = ref(filters.value.stateCode);
const selectedSource = ref(filters.value.sourceId ?? "");
const sourceOptions = computed(() => stateData.value?.states.find(state => state.stateCode === selectedState.value)?.sources ?? []);
const unavailableSource = computed(() => Boolean(sourceOptions.value.length && filters.value.sourceId && !sourceOptions.value.some(source => source.id === filters.value.sourceId)));
const searchInput = ref(filters.value.search);
const selectedScope = ref(filters.value.scope);
const includeInactive = ref(filters.value.status === "all");
const invalidState = computed(() => typeof route.query.state === "string" && Boolean(route.query.state) && !filters.value.stateCode);
const recordRange = computed(() => data.value?.matched ? `${data.value.offset + 1}–${Math.min(data.value.offset + data.value.records.length, data.value.matched)} of ${data.value.matched}` : "0 records");

watch(filters, (value) => {
	selectedState.value = value.stateCode;
	selectedSource.value = value.sourceId ?? "";
	searchInput.value = value.search;
	selectedScope.value = value.scope;
	includeInactive.value = value.status === "all";
});

async function applyFilters(offset = 0) {
	await navigateTo({
		path: "/records",
		query: {
			state: selectedState.value,
			...(selectedSource.value ? { source: selectedSource.value } : {}),
			...(searchInput.value.trim() ? { q: searchInput.value.trim() } : {}),
			...(selectedScope.value !== "all" ? { scope: selectedScope.value } : {}),
			...(includeInactive.value ? { status: "all" } : {}),
			...(offset ? { offset: String(offset) } : {}),
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

usePageSeo({
	description: "Candidate source records, statements and reporting by state, office and jurisdiction.",
	path: "/records",
	title: "Candidate records",
});
</script>

<template>
	<section class="app-shell section-gap max-w-5xl space-y-8">
		<h1 class="text-5xl text-app-ink font-serif dark:text-app-text-dark">
			Candidate records
		</h1>
		<form class="gap-4 grid sm:grid-cols-2" aria-label="Filter candidate records" @submit.prevent="applyFilters()">
			<div>
				<label for="record-state" class="text-sm text-app-ink font-semibold dark:text-app-text-dark">State</label>
				<select id="record-state" v-model="selectedState" class="text-base text-app-ink mt-2 px-3 border border-app-line rounded-lg bg-app-panel h-12 w-full dark:text-app-text-dark dark:border-app-line-dark dark:bg-app-panel-dark focus-ring" @change="changeState()">
					<option value="">
						Select a state
					</option>
					<option v-for="state in stateData.states" :key="state.stateCode" :value="state.stateCode">
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
			<div v-if="sourceOptions.length > 1 || unavailableSource" class="sm:col-span-2">
				<label for="record-source" class="text-sm text-app-ink font-semibold dark:text-app-text-dark">Source</label>
				<select id="record-source" v-model="selectedSource" class="text-base text-app-ink mt-2 px-3 border border-app-line rounded-lg bg-app-panel h-12 w-full dark:text-app-text-dark dark:border-app-line-dark dark:bg-app-panel-dark focus-ring" @change="applyFilters()">
					<option v-if="unavailableSource" :value="filters.sourceId" disabled>
						Unavailable source
					</option>
					<option v-if="sourceOptions.length > 1" value="">
						Automatic
					</option>
					<option v-for="source in sourceOptions" :key="source.id" :value="source.id">
						{{ source.label }}
					</option>
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
			<label v-if="data?.inactive || includeInactive" class="text-sm text-app-ink flex gap-2 items-center dark:text-app-text-dark sm:col-span-2">
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
				<aside v-if="data.available && data.source.scopeNotice" aria-label="Record limitations" class="basis-full">
					<p>{{ data.source.scopeNotice }}</p>
				</aside>
				<p v-if="data.source.sourceAsOfDate" class="basis-full">
					As of {{ formatDate(data.source.sourceAsOfDate) }}
				</p>
				<NuxtLink v-if="data.questionCount" :to="{ path: '/questions', query: { state: filters.stateCode, source: data.source.id } }" class="text-app-accent py-2 rounded-md underline underline-offset-3 min-h-11 inline-block focus-ring">
					Questions ({{ data.questionCount }})
				</NuxtLink>
			</div>
			<p v-if="data.awaitingRecords" class="text-sm text-app-muted dark:text-app-muted-dark" role="status">
				No records yet.
			</p>
			<p v-else-if="!data.available" class="text-sm text-app-muted dark:text-app-muted-dark" role="status">
				Official candidate records are unavailable for this {{ data.source.id ? "source" : "state" }}.
			</p>
			<template v-else>
				<p id="record-count" class="text-sm text-app-muted dark:text-app-muted-dark" role="status">
					{{ recordRange }}
				</p>
				<ul class="border-t border-app-line divide-app-line divide-y dark:border-app-line-dark dark:divide-app-line-dark" aria-label="Candidate records">
					<li v-for="record in data.records" :key="record.id" class="min-w-0 break-words">
						<NuxtLink :to="{ path: `/record/${filters.stateCode}/${record.id}`, query: { name: record.name, source: data.source.id } }" class="py-5 flex gap-4 items-center focus-ring">
							<ProfileImageStack v-if="record.profileImages?.length" :images="record.profileImages" :name="record.name" size="sm" class="shrink-0" />
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
		<ElectionReferences v-if="filters.stateCode" :state-code="filters.stateCode" :data="referenceData" :error="Boolean(referenceError)" :pending="referencePending" @retry="refreshReferences()" />
	</section>
</template>
