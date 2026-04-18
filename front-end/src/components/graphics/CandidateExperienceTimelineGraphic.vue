<script setup lang="ts">
import type { Candidate, VoteRecordSummary } from "~/types/civic";

const props = defineProps<{
	candidate: Candidate;
}>();

const { formatDate } = useFormatters();

const orderedActions = computed(() => {
	return [...props.candidate.keyActions].sort((left, right) => {
		return new Date(right.date).getTime() - new Date(left.date).getTime();
	});
});

const timelineItems = computed(() => {
	const ballotStatusItem = {
		date: props.candidate.comparison.ballotStatus.asOf,
		id: `${props.candidate.slug}-ballot-status`,
		significance: props.candidate.comparison.ballotStatus.provenance.detail,
		sources: props.candidate.comparison.ballotStatus.sources,
		summary: props.candidate.comparison.ballotStatus.label,
		title: "Ballot status verified"
	};

	return [ballotStatusItem, ...orderedActions.value] satisfies Array<{
		date: string;
		id: string;
		significance: string;
		sources: VoteRecordSummary["sources"];
		summary: string;
		title: string;
	}>;
});
</script>

<template>
	<section v-if="timelineItems.length" class="p-5 border border-app-line/80 rounded-[1.6rem] bg-app-bg dark:border-app-line-dark dark:bg-app-bg-dark/70">
		<div class="flex flex-wrap gap-4 items-start justify-between">
			<div class="max-w-4xl">
				<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
					Candidate experience timeline
				</p>
				<h3 class="text-2xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
					What has this person done in the public record attached here?
				</h3>
				<p class="text-sm text-app-muted leading-7 mt-3 dark:text-app-muted-dark">
					This timeline is source-backed but selective. It helps a voter scan the documented record in the current archive without pretending to be a full career ledger.
				</p>
			</div>
			<VerificationBadge :label="`${orderedActions.length} documented action${orderedActions.length === 1 ? '' : 's'}`" tone="accent" />
		</div>

		<ol class="mt-5 space-y-4">
			<li
				v-for="(item, index) in timelineItems"
				:key="item.id"
				class="pl-14 relative"
			>
				<span class="text-sm text-app-ink font-semibold border border-app-line rounded-full bg-white flex h-9 w-9 items-center left-0 top-1 justify-center absolute dark:text-app-text-dark dark:border-app-line-dark dark:bg-app-panel-dark">
					{{ index + 1 }}
				</span>
				<span
					v-if="index < timelineItems.length - 1"
					class="bg-app-line h-[calc(100%+0.75rem)] w-px left-4 top-10 absolute dark:bg-app-line-dark"
				/>
				<div class="px-4 py-4 border border-app-line/70 rounded-[1rem] bg-white/85 dark:border-app-line-dark dark:bg-app-panel-dark/80">
					<div class="flex flex-wrap gap-3 items-start justify-between">
						<div>
							<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
								{{ formatDate(item.date) }}
							</p>
							<h4 class="text-lg text-app-ink font-semibold mt-2 dark:text-app-text-dark">
								{{ item.title }}
							</h4>
						</div>
						<SourceDrawer :sources="item.sources" :title="item.title" button-label="Sources" />
					</div>
					<p class="text-sm text-app-muted leading-7 mt-3 dark:text-app-muted-dark">
						{{ item.summary }}
					</p>
					<p class="text-sm text-app-ink font-medium mt-3 dark:text-app-text-dark">
						{{ item.significance }}
					</p>
				</div>
			</li>
		</ol>
	</section>
</template>
