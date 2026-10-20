<script setup lang="ts">
import type { RepresentativeCard } from "~/types/civic";
import StackedMeter from "~/components/graphics/StackedMeter.vue";
import { isExternalHref } from "~/utils/link";

const props = withDefaults(defineProps<{
	cards: RepresentativeCard[];
	note?: string;
	title?: string;
}>(), {
	note: "Current officeholders matched to this location, grouped from federal to local.",
	title: "Your current officials"
});

const levelOrder = ["Federal", "State", "County", "City", "Local", "Other"] as const;
const federalRepresentativePattern = /u\.s\.|united states|congress|senate|house of representatives/;
const stateRepresentativePattern = /state|general assembly|house district|senate district|legislature/;
const localRepresentativePattern = /county|city|school|commission|board|council|mayor|parish|town/;

// Prefer the shared classification label; fall back to text matching for cards built without one.
function resolveLevel(card: RepresentativeCard) {
	if (card.levelLabel && card.levelLabel !== "Unclassified")
		return card.levelLabel;

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

	for (const card of props.cards) {
		const level = resolveLevel(card);
		groups.set(level, [...(groups.get(level) ?? []), card]);
	}

	return [...groups.entries()]
		.sort(([left], [right]) => levelIndex(left) - levelIndex(right))
		.map(([level, items]) => ({ items, level }));
});

function levelIndex(level: string) {
	const index = levelOrder.indexOf(level as typeof levelOrder[number]);
	return index === -1 ? levelOrder.length : index;
}

const levelSegments = computed(() => groupedCards.value.map(group => ({
	id: group.level,
	label: group.level,
	tone: group.level === "Federal" ? "accent" as const : group.level === "State" ? "warning" as const : "neutral" as const,
	value: group.items.length
})));
</script>

<template>
	<section v-if="props.cards.length" class="surface-panel">
		<div class="flex flex-wrap gap-3 items-start justify-between">
			<div class="max-w-3xl">
				<h2 class="text-2xl text-app-ink font-serif dark:text-app-text-dark">
					{{ props.title }}
				</h2>
				<p class="text-sm text-app-muted leading-6 mt-2 dark:text-app-muted-dark">
					{{ props.note }}
				</p>
			</div>
			<VerificationBadge :label="`${props.cards.length} official${props.cards.length === 1 ? '' : 's'}`" tone="accent" />
		</div>

		<div v-if="levelSegments.length > 1" class="mt-4">
			<StackedMeter :segments="levelSegments" />
		</div>

		<div class="mt-5 space-y-5">
			<section v-for="group in groupedCards" :key="group.level">
				<h3 class="eyebrow">
					{{ group.level }}
				</h3>
				<ul class="mt-2 divide-app-line divide-y dark:divide-app-line-dark">
					<li v-for="card in group.items" :key="card.id" class="py-3">
						<div class="flex flex-wrap gap-x-3 gap-y-1 items-baseline">
							<NuxtLink
								v-if="card.href && !isExternalHref(card.href)"
								:to="card.href"
								class="text-base text-app-ink font-semibold underline decoration-app-line underline-offset-3 transition dark:text-app-text-dark hover:text-app-accent hover:decoration-current focus-ring"
							>
								{{ card.name }}
							</NuxtLink>
							<p v-else class="text-base text-app-ink font-semibold dark:text-app-text-dark">
								{{ card.name }}
							</p>
							<span v-if="card.party" class="text-sm text-app-muted dark:text-app-muted-dark">{{ card.party }}</span>
						</div>
						<p class="text-sm text-app-muted leading-6 mt-0.5 dark:text-app-muted-dark">
							{{ card.officeTitle }}<span v-if="card.districtLabel && card.districtLabel !== card.officeTitle"> · {{ card.districtLabel }}</span>
						</p>
						<div v-if="card.openstatesUrl || card.sources?.length" class="mt-1.5 flex flex-wrap gap-3 items-center">
							<SafeExternalLink
								v-if="card.openstatesUrl"
								:href="card.openstatesUrl"
								class="text-sm text-app-accent inline-flex gap-1.5 items-center hover:underline"
							>
								Provider record
								<span class="i-carbon-launch" aria-hidden="true" />
							</SafeExternalLink>
							<SourceDrawer
								v-if="card.sources?.length"
								:sources="card.sources"
								:title="card.name"
								button-label="Sources"
							/>
						</div>
					</li>
				</ul>
			</section>
		</div>
	</section>
</template>
