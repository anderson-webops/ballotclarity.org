<script setup lang="ts">
import { readRecoverableStateRecordQuery, stateRecordSourceMismatch } from "~/utils/state-record-query";

const route = useRoute();
const { formatDate, formatDateTime } = useFormatters();
const { data: stateData } = await useStateRecordStates();
const filters = computed(() => readRecoverableStateRecordQuery(route.query, stateData.value?.states ?? []));
const { data, error, pending } = await useStateRecords(filters);
const sourceMismatch = computed(() => stateRecordSourceMismatch(route.query.source, data.value));
const recordsTarget = computed(() => ({ path: "/records", query: route.query }));
const documentLinks = computed(() => data.value?.source.documentLinks?.map((document, index) => ({ ...document, label: data.value?.source.id === "ga-fulton-2026" ? ["Sample ballot", "District 5 write-ins", "Public Service Commission"][index] ?? document.label : document.label })) ?? []);

usePageSeo({ title: "Record sources", path: "/record-sources", description: "Official publications behind candidate source records.", robots: "noindex,follow" });
</script>

<template>
	<section class="app-shell section-gap max-w-4xl">
		<h1 class="text-4xl text-app-ink font-serif dark:text-app-text-dark">
			Record sources
		</h1>
		<p v-if="pending" role="status" class="text-sm text-app-muted mt-6 dark:text-app-muted-dark">
			Loading sources…
		</p>
		<p v-else-if="error || sourceMismatch || !data" role="status" class="text-sm text-app-muted mt-6 dark:text-app-muted-dark">
			Source documents are unavailable.
		</p>
		<template v-else>
			<p v-if="data.source.label" class="text-base text-app-muted mt-4 dark:text-app-muted-dark">
				{{ data.source.label }}
			</p>
			<dl v-if="data.source.electionDate || data.source.retrievedAt" class="text-sm text-app-muted mt-4 flex flex-wrap gap-x-6 gap-y-2 dark:text-app-muted-dark">
				<div v-if="data.source.electionDate" class="flex gap-2">
					<dt>Election</dt>
					<dd><time :datetime="data.source.electionDate">{{ formatDate(data.source.electionDate) }}</time></dd>
				</div>
				<div v-if="data.source.retrievedAt" class="flex flex-wrap gap-x-2">
					<dt>Retrieved</dt>
					<dd><time :datetime="data.source.retrievedAt">{{ formatDateTime(data.source.retrievedAt) }}</time></dd>
				</div>
			</dl>
			<p v-if="data.source.scopeNotice" class="text-sm text-app-muted leading-6 mt-4 dark:text-app-muted-dark">
				{{ data.source.scopeNotice }}
			</p>
			<ul v-if="documentLinks.length" class="mt-6 divide-app-line divide-y dark:divide-app-line-dark">
				<li v-for="document in documentLinks" :key="document.url">
					<SafeExternalLink :href="document.url" class="text-base text-app-accent font-semibold py-4 rounded-sm underline underline-offset-3 block focus-ring">
						{{ document.label }}
					</SafeExternalLink>
				</li>
			</ul>
			<SafeExternalLink v-else-if="data.source.url" :href="data.source.url" class="text-base text-app-accent font-semibold mt-6 underline underline-offset-3 inline-block focus-ring">
				Official source
			</SafeExternalLink>
			<p v-else class="text-sm text-app-muted mt-6 dark:text-app-muted-dark">
				No source documents are published.
			</p>
		</template>
		<NuxtLink :to="recordsTarget" class="text-sm text-app-accent mt-8 py-2 underline underline-offset-3 inline-block focus-ring">
			Candidate records list
		</NuxtLink>
	</section>
</template>
