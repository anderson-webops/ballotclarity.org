<script setup lang="ts">
import { readStateRecordQuery, stateRecordArea, stateRecordScopes, stateRecordStatusLabels } from "~/utils/state-records";

const route = useRoute();
const { formatDate, formatDateTime } = useFormatters();
const { data: stateData, error: stateError, refresh: refreshStates } = await useStateRecordStates();
const filters = computed(() => readStateRecordQuery(route.query, stateData.value?.states ?? []));
const { data, error, pending, refresh } = await useStateRecords(filters);
const referenceFilters = computed(() => ({ stateCode: filters.value.stateCode, search: filters.value.search, scope: filters.value.scope, offset: readStateRecordQuery({ offset: route.query.referenceOffset }, []).offset }));
const { data: referenceData, error: referenceError, pending: referencePending, refresh: refreshReferences } = await useElectionReferences(referenceFilters);
const { data: measureData } = await useMeasureReferences(() => filters.value.stateCode);
const selectedState = ref(filters.value.stateCode);
const selectedSource = ref(filters.value.sourceId ?? "");
const sourceOptions = computed(() => stateData.value?.states.find(state => state.stateCode === selectedState.value)?.sources ?? []);
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
			...(selectedState.value ? { state: selectedState.value } : {}),
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
	if (stateError.value) await refreshStates();
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
			<div v-if="sourceOptions.length > 1" class="sm:col-span-2">
				<label for="record-source" class="text-sm text-app-ink font-semibold dark:text-app-text-dark">Source</label>
				<select id="record-source" v-model="selectedSource" class="text-base text-app-ink mt-2 px-3 border border-app-line rounded-lg bg-app-panel h-12 w-full dark:text-app-text-dark dark:border-app-line-dark dark:bg-app-panel-dark focus-ring" @change="applyFilters()">
					<option value="">
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
		<a v-if="data?.available && referenceData?.available && referenceData.matched" href="#candidate-information-heading" class="text-sm text-app-accent underline underline-offset-3 inline-block focus-ring">
			Candidate information ({{ referenceData.matched }})
		</a>
		<StateMeasureReferences v-if="filters.stateCode" :data="measureData" />
		<p v-if="stateError || error" class="text-sm text-app-muted dark:text-app-muted-dark" role="status">
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
			<div class="text-sm text-app-muted leading-6 space-y-2 dark:text-app-muted-dark">
				<p v-if="data.source.electionDate">
					Election: <time :datetime="data.source.electionDate">{{ formatDate(data.source.electionDate) }}</time>
				</p>
				<p v-if="data.source.label">
					{{ data.source.label }}<template v-if="data.source.retrievedAt">
						· Retrieved {{ formatDateTime(data.source.retrievedAt) }}
					</template>
				</p>
				<p v-if="data.source.scopeNotice">
					{{ data.source.scopeNotice }}
				</p>
				<p v-if="data.available">
					These records are not a personalized ballot. Later changes may be missing.
				</p>
				<details v-if="data.source.documentLinks && data.source.documentLinks.length > 1" class="source-documents">
					<summary class="text-app-accent py-2 rounded-md underline underline-offset-3 min-h-11 cursor-pointer focus-ring">
						Sources ({{ data.source.documentLinks.length }})
					</summary>
					<div class="flex flex-wrap gap-x-5 gap-y-2">
						<SafeExternalLink v-for="document in data.source.documentLinks" :key="document.url" :href="document.url" class="text-app-accent underline underline-offset-3 focus-ring">
							{{ document.label }}
						</SafeExternalLink>
					</div>
				</details>
				<SafeExternalLink v-else-if="data.source.documentLinks?.length" :href="data.source.documentLinks[0]?.url" class="text-app-accent underline underline-offset-3 inline-block focus-ring">
					{{ data.source.documentLinks[0]?.label }}
				</SafeExternalLink>
				<SafeExternalLink v-else-if="data.source.url" :href="data.source.url" class="text-app-accent underline underline-offset-3 inline-block focus-ring">
					Official source
				</SafeExternalLink>
			</div>
			<p v-if="!data.available" class="text-sm text-app-muted dark:text-app-muted-dark" role="status">
				Official candidate records are unavailable for this {{ data.source.id ? "source" : "state" }}.
			</p>
			<template v-else>
				<p id="record-count" class="text-sm text-app-muted dark:text-app-muted-dark" role="status">
					{{ recordRange }}
				</p>
				<ul class="border-t border-app-line divide-app-line divide-y dark:border-app-line-dark dark:divide-app-line-dark" aria-label="Candidate records">
					<li v-for="record in data.records" :key="record.id" class="min-w-0 break-words">
						<NuxtLink :to="{ path: `/record/${filters.stateCode}/${record.id}`, query: { name: record.name, source: data.source.id } }" class="py-5 block focus-ring">
							<h2 class="text-xl text-app-ink font-semibold dark:text-app-text-dark">
								{{ record.name }}
							</h2>
							<p class="text-sm text-app-muted leading-6 mt-2 dark:text-app-muted-dark">
								{{ record.office }}<template v-if="stateRecordArea(record)">
									· {{ stateRecordArea(record) }}
								</template> · {{ stateRecordStatusLabels[record.status] }}
							</p>
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
