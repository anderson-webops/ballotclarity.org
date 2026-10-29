<script setup lang="ts">
import { isSampleBallotDocument, recordPublicationGroups, recordPublications, recordSourceNotice, recordSourceTitle } from "~/utils/record-publications";
import { readRecoverableStateRecordQuery, stateRecordSourceMismatch } from "~/utils/state-record-query";

const route = useRoute();
const { formatDate } = useFormatters();
const { data: stateData } = await useStateRecordStates();
const filters = computed(() => readRecoverableStateRecordQuery(route.query, stateData.value?.states ?? []));
const { data, error, pending } = await useStateRecords(filters);
const sourceMismatch = computed(() => stateRecordSourceMismatch(route.query.source, data.value));
const title = computed(() => recordSourceTitle(data.value?.source));
const groups = computed(() => recordPublicationGroups(data.value?.source));
const sampleBallot = computed(() => recordPublications(data.value?.source).find(isSampleBallotDocument));
const notice = computed(() => recordSourceNotice(data.value?.source));

usePageSeo({ title: "Election sources", path: "/record-sources", description: "Official election publications.", robots: "noindex,follow" });
</script>

<template>
	<section class="app-shell section-gap max-w-5xl">
		<header class="flex flex-wrap gap-x-8 gap-y-3 items-baseline justify-between">
			<h1 class="text-4xl text-app-ink font-serif dark:text-app-text-dark">
				{{ title }}
			</h1>
			<time v-if="data?.source.electionDate" :datetime="data.source.electionDate" class="text-base text-app-ink font-semibold dark:text-app-text-dark">
				{{ formatDate(data.source.electionDate) }}
			</time>
		</header>
		<p v-if="pending" role="status" class="text-sm text-app-muted mt-6 dark:text-app-muted-dark">
			Loading sources…
		</p>
		<p v-else-if="error || sourceMismatch || !data" role="status" class="text-sm text-app-muted mt-6 dark:text-app-muted-dark">
			Source documents are unavailable.
		</p>
		<template v-else>
			<OfficialSampleBallot v-if="sampleBallot" :href="sampleBallot.url" class="mt-8" />
			<p v-if="notice" class="text-sm text-app-muted leading-6 mt-6 dark:text-app-muted-dark">
				{{ notice }}
			</p>
			<section v-for="group in groups" :key="group.label" class="mt-10 pt-6 border-t border-app-line dark:border-app-line-dark">
				<h2 class="text-2xl text-app-ink font-semibold dark:text-app-text-dark">
					{{ group.label }}
				</h2>
				<ul class="mt-4 divide-app-line divide-y dark:divide-app-line-dark">
					<li v-for="document in group.documents" :key="document.url">
						<SafeExternalLink :href="document.url" class="text-base text-app-accent font-semibold py-4 rounded-sm underline underline-offset-3 block focus-ring">
							{{ document.label }}
						</SafeExternalLink>
					</li>
				</ul>
			</section>
			<UpdatedAt v-if="data.source.retrievedAt" :value="data.source.retrievedAt" label="Ballot data updated on" footer />
		</template>
	</section>
</template>
