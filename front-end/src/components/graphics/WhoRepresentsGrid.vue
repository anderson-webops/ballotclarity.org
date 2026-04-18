<script setup lang="ts">
import type { LocationRepresentativeMatch } from "~/types/civic";

const props = withDefaults(defineProps<{
	matches: LocationRepresentativeMatch[];
	note?: string;
	title?: string;
}>(), {
	note: "These are current officeholder matches from the provider-backed lookup layer. Treat them as the person-centered result even when a full local ballot guide is not published yet.",
	title: "Who represents you right now?"
});
const federalRepresentativePattern = /u\.s\.|united states|congress|senate|house of representatives/i;
const stateRepresentativePattern = /state|general assembly|house district|senate district|legislature/i;
const localRepresentativePattern = /county|city|school|commission|board|council|mayor|parish|town/i;

const levelOrder = ["Federal", "State", "Local", "Other"] as const;

function inferLevel(match: LocationRepresentativeMatch) {
	const text = `${match.officeTitle} ${match.districtLabel}`.toLowerCase();

	if (federalRepresentativePattern.test(text))
		return "Federal";

	if (stateRepresentativePattern.test(text))
		return "State";

	if (localRepresentativePattern.test(text))
		return "Local";

	return "Other";
}

const groupedMatches = computed(() => {
	const groups = new Map<string, LocationRepresentativeMatch[]>();

	for (const level of levelOrder)
		groups.set(level, []);

	for (const match of props.matches)
		groups.get(inferLevel(match))?.push(match);

	return levelOrder
		.map(level => ({ items: groups.get(level) ?? [], level }))
		.filter(group => group.items.length);
});
</script>

<template>
	<section v-if="matches.length" class="p-5 border border-app-line/80 rounded-[1.6rem] bg-app-bg dark:border-app-line-dark dark:bg-app-bg-dark/70">
		<div class="flex flex-wrap gap-4 items-start justify-between">
			<div class="max-w-3xl">
				<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
					Representative result
				</p>
				<h3 class="text-2xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
					{{ title }}
				</h3>
				<p class="text-sm text-app-muted leading-7 mt-3 dark:text-app-muted-dark">
					{{ note }}
				</p>
			</div>
			<VerificationBadge :label="`${matches.length} officeholder match${matches.length === 1 ? '' : 'es'}`" tone="accent" />
		</div>

		<div class="mt-5 gap-4 grid xl:grid-cols-2">
			<section
				v-for="group in groupedMatches"
				:key="group.level"
				class="p-4 border border-app-line/80 rounded-[1.2rem] bg-white/85 dark:border-app-line-dark dark:bg-app-panel-dark/80"
			>
				<div class="flex flex-wrap gap-2 items-center justify-between">
					<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
						{{ group.level }} offices
					</p>
					<VerificationBadge :label="`${group.items.length} match${group.items.length === 1 ? '' : 'es'}`" />
				</div>

				<div class="mt-4 space-y-3">
					<article
						v-for="match in group.items"
						:key="match.id"
						class="px-4 py-4 border border-app-line/70 rounded-[1rem] bg-app-bg dark:border-app-line-dark dark:bg-app-bg-dark/80"
					>
						<div class="flex flex-wrap gap-2 items-center justify-between">
							<p class="text-base text-app-ink font-semibold dark:text-app-text-dark">
								{{ match.name }}
							</p>
							<div class="flex flex-wrap gap-2 items-center">
								<span v-if="match.party" class="text-[11px] text-app-muted tracking-[0.14em] font-semibold uppercase dark:text-app-muted-dark">
									{{ match.party }}
								</span>
								<VerificationBadge :label="match.sourceSystem" />
							</div>
						</div>
						<p class="text-sm text-app-muted mt-2 dark:text-app-muted-dark">
							{{ match.officeTitle }}
						</p>
						<p class="text-sm text-app-muted leading-6 mt-1 dark:text-app-muted-dark">
							{{ match.districtLabel }}
						</p>
						<div v-if="match.openstatesUrl" class="mt-3">
							<a
								:href="match.openstatesUrl"
								target="_blank"
								rel="noreferrer"
								class="text-sm text-app-accent rounded-md inline-flex gap-2 items-center hover:text-app-ink focus-ring dark:hover:text-white"
							>
								<span class="i-carbon-launch" />
								<span>Open States profile</span>
							</a>
						</div>
					</article>
				</div>
			</section>
		</div>
	</section>
</template>
