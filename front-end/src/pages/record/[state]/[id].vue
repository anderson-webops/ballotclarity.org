<script setup lang="ts">
import type { ElectionReferencesResponse, PublicElectionReference, PublicJudicialEvaluation, PublicStateCandidateRecord, StateRecordsResponse } from "~/types/civic";
import { findRecordDetail } from "~/utils/record-detail";
import { referenceJurisdiction } from "~/utils/reference-context";
import { stateRecordArea, stateRecordIncumbency, stateRecordStatusLabels } from "~/utils/state-records";

const route = useRoute();
const api = useApiClient();
const { formatDate, formatDateTime } = useFormatters();
const stateCode = useRouteStringParam("state");
const recordId = useRouteStringParam("id");
const isReference = computed(() => route.query.kind === "reference");
const sourceId = computed(() => typeof route.query.source === "string" ? route.query.source : undefined);
const search = computed(() => typeof route.query.name === "string" ? route.query.name.slice(0, 120) : "");
const sourceLabels = { "candidate-statement": "Candidate-provided", "news-report": "News report", "official-biography": "Official biography", "public-dataset": "Public dataset" };
const { data, error, pending, refresh } = await useAsyncData(
	() => `record-detail:${stateCode.value}:${recordId.value}:${isReference.value}:${sourceId.value}:${search.value}`,
	async () => {
		if (!/^[A-Z]{2}$/u.test(stateCode.value) || !/^[a-z\d-]{1,160}$/u.test(recordId.value) || !search.value.trim())
			return null;
		if (isReference.value) {
			const result = await findRecordDetail<PublicElectionReference, ElectionReferencesResponse>(
				offset => api(`/election-references/${stateCode.value}`, { query: { q: search.value, scope: "all", offset, limit: 100 } }),
				record => record.id === recordId.value && (!sourceId.value || record.source.collectionId === sourceId.value)
			);
			return result ? { reference: result.record, official: null, source: null, electionDate: result.page.electionDate } : null;
		}
		const result = await findRecordDetail<PublicStateCandidateRecord, StateRecordsResponse>(
			offset => api(`/state-records/${stateCode.value}`, { query: { source: sourceId.value, q: search.value, scope: "all", status: "all", offset, limit: 100 } }),
			record => record.id === recordId.value
		);
		return result ? { reference: null, official: result.record, source: result.page.source, electionDate: result.page.source.electionDate } : null;
	},
	{ default: () => null }
);
const name = computed(() => data.value?.reference?.name ?? data.value?.official?.name);
const profileImages = computed(() => data.value?.reference?.profileImages ?? data.value?.official?.profileImages ?? []);
const { data: evaluation, error: evaluationError } = await useAsyncData(
	() => `judicial-evaluation:${stateCode.value}:${data.value?.source?.id}:${data.value?.official?.id}`,
	async () => {
		const record = data.value?.official;
		const source = data.value?.source;
		if (!record || !source?.id || !/Judicial retention/iu.test(record.office)) return null;
		try {
			return await api<PublicJudicialEvaluation>(`/judicial-evaluations/${stateCode.value}/${record.id}`, { query: { source: source.id } });
		}
		catch (error) {
			if (error && typeof error === "object" && "statusCode" in error && error.statusCode === 404) return null;
			throw error;
		}
	},
	{ default: () => null }
);

usePageSeo({ title: name.value ?? "Candidate record", description: "Candidate source record and supporting information.", path: route.path, robots: "noindex,follow" });
const documentLinks = computed(() => {
	const source = data.value?.source;
	return (source?.documentLinks ?? []).filter(document => document.url !== source?.url);
});
</script>

<template>
	<article class="app-shell section-gap max-w-3xl space-y-7">
		<p v-if="pending" role="status">
			Loading record…
		</p>
		<div v-else-if="error || !data" class="space-y-4">
			<h1 class="text-3xl font-serif">
				Candidate record unavailable
			</h1>
			<button v-if="error" type="button" class="btn-secondary" @click="refresh()">
				Retry
			</button>
		</div>
		<template v-else>
			<header class="flex gap-5 items-start">
				<ProfileImageStack v-if="profileImages.length && name" :images="profileImages" :name="name" size="md" class="shrink-0" />
				<div class="min-w-0">
					<h1 class="text-4xl text-app-ink font-serif dark:text-app-text-dark">
						{{ name }}
					</h1>
					<p class="text-lg text-app-muted mt-3 dark:text-app-muted-dark">
						{{ data.reference?.office ?? data.official?.office }}<template v-if="data.reference ? referenceJurisdiction(data.reference) : data.official && stateRecordArea(data.official)">
							· {{ data.reference ? referenceJurisdiction(data.reference) : data.official ? stateRecordArea(data.official) : '' }}
						</template>
						<template v-if="data.official && stateRecordIncumbency(data.official)">
							· {{ stateRecordIncumbency(data.official) }}
						</template>
					</p>
				</div>
			</header>
			<p v-if="data.electionDate" class="text-sm text-app-muted dark:text-app-muted-dark">
				Election: {{ formatDate(data.electionDate) }}
			</p>
			<OfficialJudicialEvaluation v-if="evaluation" :evaluation="evaluation" />
			<p v-else-if="evaluationError" role="status">
				Official evaluations are temporarily unavailable.
			</p>
			<template v-if="data.reference">
				<p class="text-sm text-app-muted dark:text-app-muted-dark">
					{{ sourceLabels[data.reference.source.kind] }} · {{ data.reference.source.publisher }}
				</p>
				<p v-if="data.reference.source.kind === 'news-report'" class="text-sm text-app-muted dark:text-app-muted-dark">
					Reporting does not establish ballot qualification.
				</p>
				<ul v-if="data.reference.facts.length" class="readable-list pl-5 space-y-4">
					<li v-for="fact in data.reference.facts" :key="fact">
						{{ fact }}
					</li>
				</ul>
				<section class="pt-5 border-t border-app-line space-y-3 dark:border-app-line-dark" aria-label="Source">
					<SafeExternalLink v-for="image in profileImages" :key="image.url" :href="image.sourceUrl ?? image.url" class="text-app-accent underline block focus-ring">
						{{ image.sourceLabel }}<template v-if="image.attribution">
							· {{ image.attribution }}
						</template>
					</SafeExternalLink>
					<SafeExternalLink :href="data.reference.source.pageUrl ?? data.reference.source.url" class="text-app-accent underline underline-offset-3 focus-ring">
						{{ data.reference.source.title }}
					</SafeExternalLink>
					<p v-if="data.reference.source.publishedDate" class="text-sm text-app-muted dark:text-app-muted-dark">
						Published {{ formatDate(data.reference.source.publishedDate) }}
					</p>
					<p class="text-sm text-app-muted dark:text-app-muted-dark">
						Retrieved {{ formatDateTime(data.reference.source.capturedAt) }}
					</p>
				</section>
			</template>
			<template v-else-if="data.official && data.source">
				<dl class="space-y-4">
					<div v-if="data.official.status !== 'listed'">
						<dt class="font-semibold">
							Status
						</dt><dd>{{ stateRecordStatusLabels[data.official.status] }}</dd>
					</div>
					<div v-if="data.official.party">
						<dt class="font-semibold">
							Party
						</dt><dd><PartyLabel :party="data.official.party" /></dd>
					</div>
					<div v-if="data.official.sourceStatus && data.official.sourceStatus.toLowerCase() !== data.official.status">
						<dt class="font-semibold">
							Source status
						</dt><dd>{{ data.official.sourceStatus }}</dd>
					</div>
					<div v-if="data.official.ballotDesignation">
						<dt class="font-semibold">
							Ballot designation
						</dt><dd>{{ data.official.ballotDesignation }}</dd>
					</div>
					<div v-if="data.official.termYears">
						<dt class="font-semibold">
							Term
						</dt><dd>{{ data.official.termYears }} years</dd>
					</div>
					<div v-if="data.official.termEnd">
						<dt class="font-semibold">
							Term ends
						</dt><dd>{{ formatDate(data.official.termEnd) }}</dd>
					</div>
					<div v-if="data.official.seats">
						<dt class="font-semibold">
							Reported seats
						</dt><dd>{{ data.official.seats }}</dd>
					</div>
					<div v-if="data.official.voteLimit">
						<dt class="font-semibold">
							Vote limit
						</dt><dd>{{ data.official.voteLimit }}</dd>
					</div>
				</dl>
				<SafeExternalLink v-if="data.official.candidateUrl" :href="data.official.candidateUrl" class="text-app-accent underline underline-offset-3 focus-ring">
					Candidate website
				</SafeExternalLink>
				<section class="pt-5 border-t border-app-line space-y-3 dark:border-app-line-dark" aria-label="Source">
					<SafeExternalLink v-for="image in profileImages" :key="image.url" :href="image.sourceUrl ?? image.url" class="text-app-accent underline block focus-ring">
						{{ image.sourceLabel }}<template v-if="image.attribution">
							· {{ image.attribution }}
						</template>
					</SafeExternalLink>
					<SafeExternalLink v-if="data.source.url" :href="data.source.url" class="text-app-accent underline underline-offset-3 focus-ring">
						{{ data.source.label ?? 'Official source' }}
					</SafeExternalLink>
					<SafeExternalLink v-for="document in documentLinks" :key="document.url" :href="document.url" class="text-app-accent underline underline-offset-3 block focus-ring">
						{{ document.label }}
					</SafeExternalLink>
					<p v-if="data.source.sourceAsOfDate" class="text-sm text-app-muted dark:text-app-muted-dark">
						As of {{ formatDate(data.source.sourceAsOfDate) }}
					</p>
					<p v-if="data.source.retrievedAt" class="text-sm text-app-muted dark:text-app-muted-dark">
						Retrieved {{ formatDateTime(data.source.retrievedAt) }}
					</p>
					<p v-if="data.source.scopeNotice" class="text-sm text-app-muted dark:text-app-muted-dark">
						{{ data.source.scopeNotice }}
					</p>
					<p v-if="!data.source.scopeNotice" class="text-sm text-app-muted dark:text-app-muted-dark">
						These records are not a personalized ballot.
					</p>
				</section>
			</template>
		</template>
	</article>
</template>
