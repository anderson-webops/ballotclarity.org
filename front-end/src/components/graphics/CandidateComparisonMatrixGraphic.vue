<script setup lang="ts">
import type { Candidate } from "~/types/civic";

const { candidates } = defineProps<{
	candidates: Candidate[];
}>();

function uniqueSourceCount(candidate: Candidate) {
	return new Set(candidate.sources.map(source => source.id)).size;
}

function answeredQuestions(candidate: Candidate) {
	return candidate.comparison.questionnaireResponses.filter(response => response.responseStatus === "answered").length;
}

function totalQuestions(candidate: Candidate) {
	return candidate.comparison.questionnaireResponses.length;
}

const matrixRows = computed(() => [
	{
		key: "ballot-status",
		label: "On the ballot",
		note: "Verified ballot inclusion and provenance.",
		value: (candidate: Candidate) => candidate.comparison.ballotStatus.label
	},
	{
		key: "incumbency",
		label: "Current office status",
		note: "Whether this person currently holds the office.",
		value: (candidate: Candidate) => candidate.incumbent ? "Incumbent" : "Not incumbent"
	},
	{
		key: "questionnaire",
		label: "Questionnaire coverage",
		note: "Answered prompts in the current archive.",
		value: (candidate: Candidate) => `${answeredQuestions(candidate)}/${totalQuestions(candidate)} answered`
	},
	{
		key: "issues",
		label: "Issue areas named",
		note: "Top issue tags currently attached to the profile.",
		value: (candidate: Candidate) => `${candidate.topIssues.length} issue${candidate.topIssues.length === 1 ? "" : "s"}`
	},
	{
		key: "funding",
		label: "Funding record depth",
		note: "Attached filing sources and named top funders.",
		value: (candidate: Candidate) => `${candidate.funding.sources.length} filing${candidate.funding.sources.length === 1 ? "" : "s"} · ${candidate.funding.topFunders.length} top funder${candidate.funding.topFunders.length === 1 ? "" : "s"}`
	},
	{
		key: "influence",
		label: "Influence context",
		note: "Published influence notes in the current archive.",
		value: (candidate: Candidate) => `${candidate.lobbyingContext.length} note${candidate.lobbyingContext.length === 1 ? "" : "s"}`
	}
]);
</script>

<template>
	<section v-if="candidates.length" class="surface-panel">
		<div class="flex flex-wrap gap-4 items-start justify-between">
			<div class="max-w-4xl">
				<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
					First-pass comparison matrix
				</p>
				<h2 class="text-3xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
					Where these candidates differ before you read every row
				</h2>
				<p class="text-sm text-app-muted leading-7 mt-3 dark:text-app-muted-dark">
					Use this matrix to spot differences in profile depth, ballot status, questionnaire coverage, and public-record context. It is not a scorecard and does not rank candidates.
				</p>
			</div>
			<VerificationBadge label="Source-backed comparison" tone="accent" />
		</div>

		<div class="mt-6 border border-app-line rounded-[1.5rem] hidden overflow-x-auto dark:border-app-line-dark lg:block">
			<div
				class="grid min-w-[56rem]"
				:style="{ gridTemplateColumns: `minmax(14rem, 18rem) repeat(${candidates.length}, minmax(12rem, 1fr))` }"
			>
				<div class="p-4 border-b border-app-line bg-app-bg dark:border-app-line-dark dark:bg-app-bg-dark/80" />
				<div
					v-for="candidate in candidates"
					:key="candidate.slug"
					class="p-4 border-b border-l border-app-line bg-white dark:border-app-line-dark dark:bg-app-panel-dark"
				>
					<div class="flex flex-wrap gap-2 items-center">
						<p class="text-lg text-app-ink font-serif dark:text-app-text-dark">
							{{ candidate.comparison.displayName }}
						</p>
						<IncumbentBadge v-if="candidate.incumbent" />
					</div>
					<p class="text-sm text-app-muted mt-2 dark:text-app-muted-dark">
						{{ candidate.officeSought }}
					</p>
					<div class="mt-3 flex flex-wrap gap-2 items-center">
						<ProvenanceBadge :provenance="candidate.comparison.ballotStatus.provenance" />
						<SourceDrawer :sources="candidate.sources" :title="`${candidate.name} comparison sources`" button-label="Sources" />
					</div>
					<p class="text-xs text-app-muted leading-6 mt-3 dark:text-app-muted-dark">
						{{ uniqueSourceCount(candidate) }} attached source record{{ uniqueSourceCount(candidate) === 1 ? "" : "s" }}
					</p>
				</div>

				<template v-for="row in matrixRows" :key="row.key">
					<div class="p-4 border-b border-app-line bg-app-bg dark:border-app-line-dark dark:bg-app-bg-dark/80">
						<p class="text-sm text-app-ink font-semibold dark:text-app-text-dark">
							{{ row.label }}
						</p>
						<p class="text-xs text-app-muted leading-6 mt-2 dark:text-app-muted-dark">
							{{ row.note }}
						</p>
					</div>
					<div
						v-for="candidate in candidates"
						:key="`${row.key}-${candidate.slug}`"
						class="p-4 border-b border-l border-app-line bg-white dark:border-app-line-dark dark:bg-app-panel-dark"
					>
						<p class="text-sm text-app-ink leading-6 font-semibold dark:text-app-text-dark">
							{{ row.value(candidate) }}
						</p>
					</div>
				</template>
			</div>
		</div>

		<div class="mt-6 space-y-4 lg:hidden">
			<article
				v-for="candidate in candidates"
				:key="candidate.slug"
				class="p-4 border border-app-line/80 rounded-[1.3rem] bg-app-bg dark:border-app-line-dark dark:bg-app-bg-dark/70"
			>
				<div class="flex flex-wrap gap-2 items-center">
					<h3 class="text-xl text-app-ink font-serif dark:text-app-text-dark">
						{{ candidate.comparison.displayName }}
					</h3>
					<IncumbentBadge v-if="candidate.incumbent" />
				</div>
				<div class="mt-3 flex flex-wrap gap-2 items-center">
					<ProvenanceBadge :provenance="candidate.comparison.ballotStatus.provenance" />
					<SourceDrawer :sources="candidate.sources" :title="`${candidate.name} comparison sources`" button-label="Sources" />
				</div>
				<dl class="mt-4 space-y-3">
					<div v-for="row in matrixRows" :key="row.key" class="px-4 py-3 border border-app-line/70 rounded-[1rem] bg-white/85 dark:border-app-line-dark dark:bg-app-panel-dark/80">
						<dt class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
							{{ row.label }}
						</dt>
						<dd class="text-sm text-app-ink font-semibold mt-2 dark:text-app-text-dark">
							{{ row.value(candidate) }}
						</dd>
						<p class="text-xs text-app-muted leading-6 mt-2 dark:text-app-muted-dark">
							{{ row.note }}
						</p>
					</div>
				</dl>
			</article>
		</div>
	</section>
</template>
