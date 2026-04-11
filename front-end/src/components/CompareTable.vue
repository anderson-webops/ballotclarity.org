<script setup lang="ts">
import type { Candidate } from "~/types/civic";

const props = defineProps<{
	candidates: Candidate[];
}>();

const { formatCurrency, formatPercent } = useFormatters();

const rows = computed(() => [
	{
		key: "party",
		label: "Party",
		values: props.candidates.map(candidate => candidate.party),
	},
	{
		key: "status",
		label: "Incumbent status",
		values: props.candidates.map(candidate => candidate.incumbent ? "Incumbent" : "Not incumbent"),
	},
	{
		key: "issues",
		label: "Top issues",
		values: props.candidates.map(candidate => candidate.topIssues.map(issue => issue.label).join(", ")),
	},
	{
		key: "actions",
		label: "Selected key actions",
		values: props.candidates.map(candidate => candidate.keyActions.slice(0, 2).map(action => action.title).join(" • ")),
	},
	{
		key: "funding",
		label: "Funding summary",
		values: props.candidates.map(candidate => `${formatCurrency(candidate.funding.totalRaised)} raised, ${formatPercent(candidate.funding.smallDonorShare)} small donors`),
	},
	{
		key: "notes",
		label: "Source-backed notes",
		values: props.candidates.map(candidate => candidate.publicStatements[0]?.summary ?? candidate.summary),
	},
]);
</script>

<template>
	<div>
		<div class="border border-app-line rounded-[2rem] hidden overflow-hidden dark:border-app-line-dark lg:block">
			<table class="bg-white min-w-full border-collapse dark:bg-app-panel-dark">
				<thead>
					<tr class="border-b border-app-line dark:border-app-line-dark">
						<th class="text-xs text-app-muted tracking-[0.24em] font-semibold px-6 py-5 text-left bg-app-bg w-60 uppercase dark:text-app-muted-dark dark:bg-app-bg-dark/80">
							Category
						</th>
						<th
							v-for="candidate in candidates"
							:key="candidate.slug"
							class="px-6 py-5 text-left align-top border-l border-app-line dark:border-app-line-dark"
						>
							<p class="text-2xl text-app-ink font-serif dark:text-app-text-dark">
								{{ candidate.name }}
							</p>
							<p class="text-sm text-app-muted mt-2 dark:text-app-muted-dark">
								{{ candidate.officeSought }}
							</p>
						</th>
					</tr>
				</thead>
				<tbody>
					<tr
						v-for="row in rows"
						:key="row.key"
						class="align-top border-b border-app-line/70 last:border-b-0 dark:border-app-line-dark"
					>
						<th class="text-sm text-app-ink font-semibold px-6 py-5 text-left bg-app-bg dark:text-app-text-dark dark:bg-app-bg-dark/70">
							{{ row.label }}
						</th>
						<td
							v-for="(value, index) in row.values"
							:key="`${row.key}-${candidates[index]?.slug}`"
							class="text-sm text-app-muted leading-7 px-6 py-5 border-l border-app-line dark:text-app-muted-dark dark:border-app-line-dark"
						>
							{{ value }}
						</td>
					</tr>
				</tbody>
			</table>
		</div>

		<div class="space-y-4 lg:hidden">
			<article v-for="candidate in candidates" :key="candidate.slug" class="surface-panel">
				<div class="flex flex-wrap gap-3 items-center">
					<h3 class="text-2xl text-app-ink font-serif dark:text-app-text-dark">
						{{ candidate.name }}
					</h3>
					<IncumbentBadge v-if="candidate.incumbent" />
				</div>
				<p class="text-sm text-app-muted mt-2 dark:text-app-muted-dark">
					{{ candidate.officeSought }} · {{ candidate.party }}
				</p>
				<dl class="mt-6 space-y-5">
					<div>
						<dt class="text-xs text-app-muted tracking-[0.2em] font-semibold uppercase dark:text-app-muted-dark">
							Top issues
						</dt>
						<dd class="mt-2 flex flex-wrap gap-2">
							<IssueChip v-for="issue in candidate.topIssues" :key="issue.slug" :label="issue.label" />
						</dd>
					</div>
					<div>
						<dt class="text-xs text-app-muted tracking-[0.2em] font-semibold uppercase dark:text-app-muted-dark">
							Funding
						</dt>
						<dd class="text-sm text-app-muted mt-2 dark:text-app-muted-dark">
							{{ formatCurrency(candidate.funding.totalRaised) }} raised, {{ formatPercent(candidate.funding.smallDonorShare) }} small donors
						</dd>
					</div>
					<div>
						<dt class="text-xs text-app-muted tracking-[0.2em] font-semibold uppercase dark:text-app-muted-dark">
							Source-backed note
						</dt>
						<dd class="text-sm text-app-muted mt-2 dark:text-app-muted-dark">
							{{ candidate.publicStatements[0]?.summary ?? candidate.summary }}
						</dd>
					</div>
				</dl>
			</article>
		</div>
	</div>
</template>
