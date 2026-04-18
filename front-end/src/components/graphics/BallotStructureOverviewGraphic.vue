<script setup lang="ts">
import type { Contest } from "~/types/civic";

const props = defineProps<{
	contests: Contest[];
}>();

const candidateContestCount = computed(() => props.contests.filter(contest => contest.type === "candidate").length);
const measureContestCount = computed(() => props.contests.filter(contest => contest.type === "measure").length);
</script>

<template>
	<section v-if="contests.length" class="p-5 border border-app-line/80 rounded-[1.6rem] bg-app-bg dark:border-app-line-dark dark:bg-app-bg-dark/70">
		<div class="flex flex-wrap gap-4 items-start justify-between">
			<div class="max-w-4xl">
				<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
					Ballot structure overview
				</p>
				<h3 class="text-2xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
					What is on this ballot and where the candidate races end
				</h3>
				<p class="text-sm text-app-muted leading-7 mt-3 dark:text-app-muted-dark">
					This visual uses the published contest inventory in this guide. It helps you see the reading order before you open every race or measure section.
				</p>
			</div>
			<div class="flex flex-wrap gap-2 items-center">
				<VerificationBadge :label="`${candidateContestCount} candidate contest${candidateContestCount === 1 ? '' : 's'}`" tone="accent" />
				<VerificationBadge :label="`${measureContestCount} measure section${measureContestCount === 1 ? '' : 's'}`" />
			</div>
		</div>

		<ol class="mt-5 gap-3 grid">
			<li
				v-for="(contest, index) in contests"
				:key="contest.slug"
				class="px-4 py-4 border border-app-line/70 rounded-[1rem] bg-white/85 flex flex-col gap-3 dark:border-app-line-dark dark:bg-app-panel-dark/80 lg:flex-row lg:items-start lg:justify-between"
			>
				<div class="flex gap-4 items-start">
					<span class="text-sm text-app-ink font-semibold border border-app-line rounded-full bg-app-bg flex shrink-0 h-10 w-10 items-center justify-center dark:text-app-text-dark dark:border-app-line-dark dark:bg-app-bg-dark/80">
						{{ index + 1 }}
					</span>
					<div>
						<div class="flex flex-wrap gap-2 items-center">
							<p class="text-lg text-app-ink font-semibold dark:text-app-text-dark">
								{{ contest.office }}
							</p>
							<VerificationBadge
								:label="contest.type === 'candidate' ? 'Candidate race' : 'Measure section'"
								:tone="contest.type === 'candidate' ? 'accent' : 'neutral'"
							/>
						</div>
						<p class="text-sm text-app-muted mt-2 dark:text-app-muted-dark">
							{{ contest.jurisdiction }} · {{ contest.type === "candidate" ? `${contest.candidates?.length ?? 0} candidate${contest.candidates?.length === 1 ? "" : "s"}` : `${contest.measures?.length ?? 0} measure${contest.measures?.length === 1 ? "" : "s"}` }}
						</p>
						<p class="text-sm text-app-muted leading-6 mt-3 dark:text-app-muted-dark">
							{{ contest.roleGuide.summary }}
						</p>
					</div>
				</div>

				<a
					:href="`#${contest.slug}`"
					class="text-sm text-app-accent rounded-md inline-flex gap-2 items-center hover:text-app-ink focus-ring dark:hover:text-white"
				>
					<span class="i-carbon-arrow-down" />
					<span>Jump to section</span>
				</a>
			</li>
		</ol>
	</section>
</template>
