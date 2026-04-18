<script setup lang="ts">
import type { Candidate, ComparableStatement, EvidenceBlock, QuestionnaireResponse, Source } from "~/types/civic";

const props = defineProps<{
	candidate: Candidate;
}>();

function normalize(value: string) {
	return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function includesIssue(issueLabel: string, value: string | null | undefined) {
	if (!value)
		return false;

	const issue = normalize(issueLabel);
	const text = normalize(value);

	return issue.length > 2 && (text.includes(issue) || issue.includes(text));
}

function uniqueSources(sources: Source[]) {
	return Array.from(new Map(sources.map(source => [source.id, source])).values());
}

const issueRows = computed(() => {
	return props.candidate.topIssues.map((issue) => {
		const priorityMatches = props.candidate.comparison.topPriorities.filter(priority => includesIssue(issue.label, priority.text));
		const questionnaireMatches = props.candidate.comparison.questionnaireResponses.filter((response) => {
			return includesIssue(issue.label, response.category)
				|| includesIssue(issue.label, response.questionPrompt)
				|| includesIssue(issue.label, response.answerText);
		});
		const statementMatches = props.candidate.publicStatements.filter((statement) => {
			return includesIssue(issue.label, statement.title) || includesIssue(issue.label, statement.summary);
		});

		return {
			issue,
			lanes: [
				{
					label: "Priority signal",
					matchCount: priorityMatches.length,
					sources: uniqueSources(priorityMatches.flatMap((priority: ComparableStatement) => priority.sources)),
					status: priorityMatches.length ? "available" : "unavailable"
				},
				{
					label: "Questionnaire material",
					matchCount: questionnaireMatches.length,
					sources: uniqueSources(questionnaireMatches.flatMap((response: QuestionnaireResponse) => response.sources)),
					status: questionnaireMatches.length ? "available" : "unavailable"
				},
				{
					label: "Public statement mention",
					matchCount: statementMatches.length,
					sources: uniqueSources(statementMatches.flatMap((statement: EvidenceBlock) => statement.sources)),
					status: statementMatches.length ? "available" : "unavailable"
				}
			]
		};
	});
});
</script>

<template>
	<section v-if="candidate.topIssues.length" class="p-5 border border-app-line/80 rounded-[1.6rem] bg-app-bg dark:border-app-line-dark dark:bg-app-bg-dark/70">
		<div class="flex flex-wrap gap-4 items-start justify-between">
			<div class="max-w-4xl">
				<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
					Issue-position map
				</p>
				<h3 class="text-2xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
					Where the current archive shows direct issue material
				</h3>
				<p class="text-sm text-app-muted leading-7 mt-3 dark:text-app-muted-dark">
					This map does not infer ideology. It only shows whether the current archive contains source-backed issue material in priority statements, questionnaires, or public statements.
				</p>
			</div>
			<VerificationBadge :label="`${candidate.topIssues.length} issue area${candidate.topIssues.length === 1 ? '' : 's'}`" tone="accent" />
		</div>

		<div class="mt-5 space-y-3">
			<article
				v-for="row in issueRows"
				:key="row.issue.slug"
				class="px-4 py-4 border border-app-line/70 rounded-[1rem] bg-white/85 dark:border-app-line-dark dark:bg-app-panel-dark/80"
			>
				<div class="gap-4 grid lg:grid-cols-[minmax(10rem,0.6fr)_minmax(0,1.4fr)]">
					<div>
						<p class="text-lg text-app-ink font-semibold dark:text-app-text-dark">
							{{ row.issue.label }}
						</p>
						<p class="text-xs text-app-muted leading-6 mt-2 dark:text-app-muted-dark">
							Matches rely on direct label or category overlap in the attached record set.
						</p>
					</div>
					<div class="gap-3 grid md:grid-cols-3">
						<div
							v-for="lane in row.lanes"
							:key="lane.label"
							class="px-3 py-3 rounded-[0.9rem] bg-app-bg dark:bg-app-bg-dark/80"
						>
							<div class="flex flex-wrap gap-2 items-center justify-between">
								<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
									{{ lane.label }}
								</p>
								<VerificationBadge :label="lane.status" :tone="lane.status === 'available' ? 'accent' : 'neutral'" />
							</div>
							<p class="text-sm text-app-ink font-semibold mt-3 dark:text-app-text-dark">
								{{ lane.matchCount ? `${lane.matchCount} match${lane.matchCount === 1 ? '' : 'es'}` : "No direct match in current archive" }}
							</p>
							<div v-if="lane.sources.length" class="mt-3">
								<SourceDrawer :sources="lane.sources" :title="`${candidate.name} · ${row.issue.label} · ${lane.label}`" button-label="Sources" />
							</div>
						</div>
					</div>
				</div>
			</article>
		</div>

		<p class="text-xs text-app-muted leading-6 mt-4 dark:text-app-muted-dark">
			<strong class="text-app-ink dark:text-app-text-dark">Uncertainty:</strong>
			Absence in a lane means Ballot Clarity does not currently have a direct archive match for that issue area. It does not prove the candidate has no position.
		</p>
	</section>
</template>
