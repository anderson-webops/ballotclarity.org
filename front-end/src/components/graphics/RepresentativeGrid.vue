<script setup lang="ts">
import type { RepresentativeCard } from "~/types/civic";

const props = withDefaults(defineProps<{
	cards: RepresentativeCard[];
	note?: string;
	title?: string;
}>(), {
	note: "These are current officeholder matches from the provider-backed lookup layer. Treat them as the person-centered result even when a full local ballot guide is not published yet.",
	title: "Who represents you right now?"
});

const levelOrder = ["Federal", "State", "Local", "Other"] as const;
const federalRepresentativePattern = /u\.s\.|united states|congress|senate|house of representatives/;
const stateRepresentativePattern = /state|general assembly|house district|senate district|legislature/;
const localRepresentativePattern = /county|city|school|commission|board|council|mayor|parish|town/;

function inferLevel(card: RepresentativeCard) {
	const text = `${card.officeTitle} ${card.districtLabel}`.toLowerCase();

	if (federalRepresentativePattern.test(text))
		return "Federal";

	if (stateRepresentativePattern.test(text))
		return "State";

	if (localRepresentativePattern.test(text))
		return "Local";

	return "Other";
}

const groupedCards = computed(() => {
	const groups = new Map<string, RepresentativeCard[]>();

	for (const level of levelOrder)
		groups.set(level, []);

	for (const card of props.cards)
		groups.get(inferLevel(card))?.push(card);

	return levelOrder
		.map(level => ({ items: groups.get(level) ?? [], level }))
		.filter(group => group.items.length);
});
</script>

<template>
	<section v-if="props.cards.length" class="p-5 border border-app-line/80 rounded-[1.6rem] bg-app-bg dark:border-app-line-dark dark:bg-app-bg-dark/70">
		<div class="flex flex-wrap gap-4 items-start justify-between">
			<div class="max-w-3xl">
				<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
					Representative result
				</p>
				<h3 class="text-2xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
					{{ props.title }}
				</h3>
				<p class="text-sm text-app-muted leading-7 mt-3 dark:text-app-muted-dark">
					{{ props.note }}
				</p>
			</div>
			<VerificationBadge :label="`${props.cards.length} officeholder match${props.cards.length === 1 ? '' : 'es'}`" tone="accent" />
		</div>

		<div class="mt-5 gap-4 grid xl:grid-cols-2">
			<section
				v-for="group in groupedCards"
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
						v-for="card in group.items"
						:key="card.id"
						class="px-4 py-4 border border-app-line/70 rounded-[1rem] bg-app-bg dark:border-app-line-dark dark:bg-app-bg-dark/80"
					>
						<div class="flex flex-wrap gap-2 items-center justify-between">
							<p class="text-base text-app-ink font-semibold dark:text-app-text-dark">
								{{ card.name }}
							</p>
							<div class="flex flex-wrap gap-2 items-center">
								<span v-if="card.party" class="text-[11px] text-app-muted tracking-[0.14em] font-semibold uppercase dark:text-app-muted-dark">
									{{ card.party }}
								</span>
								<VerificationBadge
									v-for="badge in card.badges ?? []"
									:key="`${card.id}-${badge.label}`"
									:label="badge.label"
									:tone="badge.tone"
								/>
							</div>
						</div>
						<p class="text-sm text-app-muted mt-2 dark:text-app-muted-dark">
							{{ card.officeTitle }}
						</p>
						<p class="text-sm text-app-muted leading-6 mt-1 dark:text-app-muted-dark">
							{{ card.districtLabel }}
						</p>
						<p v-if="card.summary" class="text-sm text-app-muted leading-6 mt-3 dark:text-app-muted-dark">
							{{ card.summary }}
						</p>
						<div class="mt-3 flex flex-wrap gap-3 items-center">
							<a
								v-if="card.openstatesUrl"
								:href="card.openstatesUrl"
								target="_blank"
								rel="noreferrer"
								class="text-sm text-app-accent rounded-md inline-flex gap-2 items-center hover:text-app-ink focus-ring dark:hover:text-white"
							>
								<span class="i-carbon-launch" />
								<span>Open States profile</span>
							</a>
							<SourceDrawer
								v-if="card.sources?.length"
								:sources="card.sources"
								:title="card.name"
								button-label="Sources"
							/>
						</div>
						<p v-if="card.uncertainty" class="text-xs text-app-muted leading-6 mt-3 dark:text-app-muted-dark">
							<strong class="text-app-ink dark:text-app-text-dark">Uncertainty:</strong>
							{{ card.uncertainty }}
						</p>
					</article>
				</div>
			</section>
		</div>
	</section>
</template>
