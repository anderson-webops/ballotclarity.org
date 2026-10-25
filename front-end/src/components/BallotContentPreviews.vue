<script setup lang="ts">
import type { BallotContentPreview, NationwideLookupResultContext } from "~/types/civic";
import { ballotSourceNotes } from "~/utils/ballot-notices";
import { ballotRecordStatusLabels, buildBallotCandidateTarget } from "~/utils/ballot-view";

const props = defineProps<{ previews: BallotContentPreview[]; lookupContext?: Pick<NationwideLookupResultContext, "lookupQuery" | "selectionId"> }>();
const sourceNotes = computed(() => ballotSourceNotes(props.previews));
const { formatDate, formatDateTime } = useFormatters();
const NuxtLinkComponent = resolveComponent("NuxtLink");
</script>

<template>
	<div class="space-y-8">
		<section v-for="preview in previews" :key="preview.id">
			<h2 class="text-2xl text-app-ink font-serif dark:text-app-text-dark">
				{{ preview.providerId.startsWith('official-state-') ? 'State candidate records' : 'Ballot records' }}
			</h2>
			<p v-if="preview.electionDate" class="text-sm text-app-muted mt-2 dark:text-app-muted-dark">
				Election: <span>{{ formatDate(preview.electionDate) }}</span>
			</p>
			<p class="text-sm text-app-muted leading-6 mt-2 dark:text-app-muted-dark">
				{{ preview.providerLabel }} · Retrieved {{ formatDateTime(preview.generatedAt) }}
			</p>
			<div class="mt-3 flex flex-wrap gap-4">
				<SafeExternalLink v-if="preview.sourceUrl" :href="preview.sourceUrl" class="text-app-accent underline underline-offset-3 focus-ring">
					Official source
				</SafeExternalLink>
				<SafeExternalLink v-if="preview.verificationResource && preview.verificationResource.url !== preview.sourceUrl" :href="preview.verificationResource.url" class="text-app-accent underline underline-offset-3 focus-ring">
					{{ preview.verificationResource.label }}
				</SafeExternalLink>
			</div>
			<div class="mt-5 gap-6 grid md:grid-cols-2">
				<article v-for="contest in preview.contests" :key="contest.id" class="border border-app-line border-t-4 rounded-md bg-app-panel break-words dark:border-app-line-dark dark:bg-app-panel-dark">
					<header class="p-4 border-b border-app-line bg-app-bg dark:border-app-line-dark dark:bg-app-bg-dark">
						<h3 class="text-lg text-app-ink font-semibold dark:text-app-text-dark">
							{{ contest.title }}
						</h3>
						<p v-if="contest.districtName" class="text-sm text-app-muted mt-1 dark:text-app-muted-dark">
							{{ contest.districtName }}
						</p>
					</header>
					<ul v-if="contest.candidates.length" class="divide-app-line divide-y dark:divide-app-line-dark">
						<li v-for="candidate in contest.candidates" :key="candidate.id">
							<component
								:is="buildBallotCandidateTarget(preview, candidate, lookupContext) ? NuxtLinkComponent : 'div'"
								v-bind="buildBallotCandidateTarget(preview, candidate, lookupContext) ? { to: buildBallotCandidateTarget(preview, candidate, lookupContext), prefetchOn: 'interaction' } : {}"
								class="group p-4 flex gap-4 min-h-20 items-center justify-between hover:bg-app-bg focus-ring dark:hover:bg-app-bg-dark"
							>
								<div class="min-w-0">
									<p class="text-base text-app-ink font-semibold break-words dark:text-app-text-dark">
										{{ candidate.name }}
									</p>
									<p v-if="candidate.party || (candidate.ballotStatus && ballotRecordStatusLabels[candidate.ballotStatus])" class="text-sm text-app-muted leading-6 mt-1 dark:text-app-muted-dark">
										<PartyLabel v-if="candidate.party" :party="candidate.party" /><template v-if="candidate.ballotStatus && ballotRecordStatusLabels[candidate.ballotStatus]">
											{{ candidate.party ? ' · ' : '' }}{{ ballotRecordStatusLabels[candidate.ballotStatus] }}
										</template>
									</p>
								</div>
								<span v-if="buildBallotCandidateTarget(preview, candidate, lookupContext)" class="i-carbon-chevron-right text-app-accent shrink-0" aria-hidden="true" />
							</component>
						</li>
					</ul>
					<div v-if="contest.referendum" class="text-sm text-app-muted leading-6 p-4 space-y-2 dark:text-app-muted-dark">
						<p v-if="contest.referendum.title && contest.referendum.title !== contest.title" class="text-app-ink font-semibold dark:text-app-text-dark">
							{{ contest.referendum.title }}
						</p>
						<p v-if="contest.referendum.brief">
							{{ contest.referendum.brief }}
						</p>
						<p v-if="contest.referendum.text && contest.referendum.text !== contest.referendum.brief">
							{{ contest.referendum.text }}
						</p>
						<p v-if="contest.referendum.responses.length">
							Choices: {{ contest.referendum.responses.join(', ') }}
						</p>
						<p v-if="contest.referendum.passageThreshold">
							Passage threshold: {{ contest.referendum.passageThreshold }}
						</p>
						<SafeExternalLink v-if="contest.referendum.url" :href="contest.referendum.url" class="text-app-accent underline underline-offset-3 focus-ring">
							Official measure record
						</SafeExternalLink>
					</div>
				</article>
			</div>
		</section>
		<aside v-if="sourceNotes.length" aria-label="Ballot source notes" class="text-sm text-app-muted leading-6 pt-4 border-t border-app-line space-y-2 dark:text-app-muted-dark dark:border-app-line-dark">
			<p v-for="note in sourceNotes" :key="note">
				{{ note }}
			</p>
		</aside>
	</div>
</template>
