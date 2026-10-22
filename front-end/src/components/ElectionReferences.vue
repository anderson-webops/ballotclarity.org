<script setup lang="ts">
import type { ElectionReferencesResponse } from "~/types/civic";

const props = defineProps<{ stateCode: string; data: ElectionReferencesResponse | null; error: boolean; pending: boolean }>();
const emit = defineEmits<{ retry: [] }>();
const route = useRoute();
const { formatDate, formatDateTime } = useFormatters();
const range = computed(() => props.data?.matched ? `${props.data.offset + 1}–${Math.min(props.data.offset + props.data.records.length, props.data.matched)} of ${props.data.matched}` : "0 references");
const hasReporting = computed(() => props.data?.records.some(record => record.source.kind === "news-report"));
const sourceLabels = { "candidate-statement": "Candidate-provided", "news-report": "News report", "official-biography": "Official biography" };
const retryRequested = ref(false);
let retryControl: EventTarget | null = null;

function retry(event: MouseEvent) {
	retryControl = event.currentTarget;
	retryRequested.value = true;
	emit("retry");
}

watch(() => [props.pending, props.data, props.error], async () => {
	if (!retryRequested.value || props.pending) return;
	retryRequested.value = false;
	await nextTick();
	if (document.activeElement === document.body || document.activeElement === retryControl)
		(document.getElementById("candidate-information-heading") ?? document.getElementById("record-search"))?.focus();
	retryControl = null;
});

async function changePage(offset: number) {
	await navigateTo({ path: "/records", query: { ...route.query, referenceOffset: offset ? String(offset) : undefined } });
}
</script>

<template>
	<section v-if="error || pending && stateCode || data?.available" class="space-y-5" aria-labelledby="candidate-information-heading">
		<h2 id="candidate-information-heading" tabindex="-1" class="text-3xl text-app-ink font-serif dark:text-app-text-dark focus-ring">
			Candidate information
		</h2>
		<p v-if="error" class="text-sm text-app-muted dark:text-app-muted-dark" role="status">
			Candidate information is temporarily unavailable.
			<button type="button" class="text-app-accent underline focus-ring" @click="retry">
				Retry
			</button>
		</p>
		<p v-else-if="pending" class="text-sm text-app-muted dark:text-app-muted-dark" role="status">
			Loading information…
		</p>
		<template v-else-if="data?.available">
			<p v-if="data.incomplete" class="text-sm text-app-muted dark:text-app-muted-dark" role="status">
				Some candidate information is unavailable.
				<button type="button" class="text-app-accent underline focus-ring" @click="retry">
					Retry
				</button>
			</p>
			<p v-if="data.electionDate" class="text-sm text-app-muted dark:text-app-muted-dark">
				Election: <time :datetime="data.electionDate" class="attention-date">{{ formatDate(data.electionDate) }}</time>
			</p>
			<p v-if="hasReporting" class="text-sm text-app-muted dark:text-app-muted-dark">
				Reporting does not establish ballot qualification.
			</p>
			<p class="text-sm text-app-muted dark:text-app-muted-dark" role="status">
				{{ range }}
			</p>
			<ul class="border-t border-app-line divide-app-line divide-y dark:border-app-line-dark dark:divide-app-line-dark" aria-label="Candidate information">
				<li v-for="record in data.records" :key="`${record.source.collectionId ?? record.source.url}:${record.id}`" class="py-5 min-w-0 break-words space-y-3">
					<h3 class="text-xl text-app-ink font-semibold dark:text-app-text-dark">
						{{ record.name }}
					</h3>
					<p class="text-sm text-app-ink dark:text-app-text-dark">
						{{ record.office }}<template v-if="record.jurisdiction">
							· {{ record.jurisdiction }}
						</template>
					</p>
					<p class="text-sm text-app-muted dark:text-app-muted-dark">
						{{ sourceLabels[record.source.kind] }} · {{ record.source.publisher }}<template v-if="record.source.publishedDate">
							· <time :datetime="record.source.publishedDate">{{ formatDate(record.source.publishedDate) }}</time>
						</template>
					</p>
					<ul class="text-sm text-app-ink pl-5 list-disc space-y-2 dark:text-app-text-dark">
						<li v-for="fact in record.facts" :key="fact">
							{{ fact }}
						</li>
					</ul>
					<SafeExternalLink :href="record.source.pageUrl ?? record.source.url" class="text-sm text-app-accent underline underline-offset-3 inline-block focus-ring">
						{{ record.source.title }}
					</SafeExternalLink>
					<p class="text-xs text-app-muted dark:text-app-muted-dark">
						Retrieved <time :datetime="record.source.capturedAt">{{ formatDateTime(record.source.capturedAt) }}</time>
					</p>
				</li>
			</ul>
			<nav v-if="data.matched > data.limit" class="flex flex-wrap gap-4" aria-label="Candidate information pages">
				<button type="button" class="btn-secondary" :disabled="!data.offset" @click="changePage(Math.max(0, data.offset - data.limit))">
					Previous
				</button>
				<button type="button" class="btn-secondary" :disabled="data.offset + data.limit >= data.matched" @click="changePage(data.offset + data.limit)">
					Next
				</button>
			</nav>
		</template>
	</section>
</template>
