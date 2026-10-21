<script setup lang="ts">
import type { BallotContentPreview } from "~/types/civic";

defineProps<{ previews: BallotContentPreview[] }>();
const { formatDate, formatDateTime } = useFormatters();
const statusLabels: Record<string, string> = { "filed": "Filed", "qualified": "Qualified", "write-in": "Write-in" };
</script>

<template>
	<div class="space-y-8">
		<section v-for="preview in previews" :key="preview.id">
			<h2 class="text-2xl text-app-ink font-serif dark:text-app-text-dark">
				{{ preview.providerId.startsWith('official-state-') ? 'State candidate records' : 'Ballot records' }}
			</h2>
			<p v-if="preview.electionDate" class="text-sm text-app-muted mt-2 dark:text-app-muted-dark">
				Election: {{ formatDate(preview.electionDate) }}
			</p>
			<p class="text-sm text-app-muted leading-6 mt-2 dark:text-app-muted-dark">
				{{ preview.providerLabel }} · Retrieved {{ formatDateTime(preview.generatedAt) }}
			</p>
			<p class="text-sm text-app-muted leading-6 mt-2 dark:text-app-muted-dark">
				{{ preview.disclaimer }}
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
				<article v-for="contest in preview.contests" :key="contest.id" class="content-block">
					<h3 class="text-lg text-app-ink font-semibold dark:text-app-text-dark">
						{{ contest.title }}
					</h3>
					<p v-if="contest.districtName" class="text-sm text-app-muted mt-1 dark:text-app-muted-dark">
						{{ contest.districtName }}
					</p>
					<ul v-if="contest.candidates.length" class="mt-3 space-y-2">
						<li v-for="candidate in contest.candidates" :key="candidate.id" class="text-sm text-app-muted leading-6 dark:text-app-muted-dark">
							<span class="text-app-ink font-semibold dark:text-app-text-dark">{{ candidate.name }}</span>
							<span v-if="candidate.party"> · {{ candidate.party }}</span>
							<span v-if="candidate.ballotStatus && statusLabels[candidate.ballotStatus]"> · {{ statusLabels[candidate.ballotStatus] }}</span>
						</li>
					</ul>
					<div v-if="contest.referendum" class="text-sm text-app-muted leading-6 mt-3 space-y-2 dark:text-app-muted-dark">
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
	</div>
</template>
