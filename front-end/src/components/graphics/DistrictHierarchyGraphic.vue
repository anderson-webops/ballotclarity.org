<script setup lang="ts">
import type { LocationDistrictMatch } from "~/types/civic";

const props = withDefaults(defineProps<{
	lookupInputKind?: "address" | "zip" | "";
	matches: LocationDistrictMatch[];
	normalizedAddress?: string;
	title?: string;
}>(), {
	lookupInputKind: "",
	normalizedAddress: "",
	title: "Which districts stack on top of this address?"
});
const federalDistrictPattern = /congress|u\.s\.|federal|senate/i;
const stateDistrictPattern = /state|legislature|assembly|house/i;
const countyDistrictPattern = /county|parish|regional/i;
const localDistrictPattern = /city|town|school|municipal|board|council|ward|precinct/i;

function classifyDistrict(match: LocationDistrictMatch) {
	const text = `${match.districtType} ${match.label}`.toLowerCase();

	if (federalDistrictPattern.test(text))
		return { group: "Federal", order: 1 };

	if (stateDistrictPattern.test(text))
		return { group: "State", order: 2 };

	if (countyDistrictPattern.test(text))
		return { group: "County or regional", order: 3 };

	if (localDistrictPattern.test(text))
		return { group: "Local", order: 4 };

	return { group: "Other", order: 5 };
}

const orderedMatches = computed(() => {
	return [...props.matches].sort((left, right) => {
		const leftMeta = classifyDistrict(left);
		const rightMeta = classifyDistrict(right);

		return leftMeta.order - rightMeta.order || left.label.localeCompare(right.label);
	});
});

const uncertaintyNote = computed(() => {
	if (props.lookupInputKind === "zip")
		return "ZIP-only results are approximate. Street-level districts can still change inside the same ZIP code.";

	return "District stacking is provider-backed, but election offices remain the final authority for ballot style and precinct boundaries.";
});
</script>

<template>
	<section v-if="matches.length" class="p-5 border border-app-line/80 rounded-[1.6rem] bg-app-bg dark:border-app-line-dark dark:bg-app-bg-dark/70">
		<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
			District ladder
		</p>
		<h3 class="text-2xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
			{{ title }}
		</h3>
		<p v-if="normalizedAddress" class="text-sm text-app-muted leading-7 mt-3 dark:text-app-muted-dark">
			{{ normalizedAddress }}
		</p>

		<ol class="mt-5 space-y-3">
			<li
				v-for="(match, index) in orderedMatches"
				:key="match.id"
				class="pl-14 relative"
			>
				<span class="text-sm text-app-ink font-semibold border border-app-line rounded-full bg-white flex h-9 w-9 items-center left-0 top-0 justify-center absolute dark:text-app-text-dark dark:border-app-line-dark dark:bg-app-panel-dark">
					{{ index + 1 }}
				</span>
				<span
					v-if="index < orderedMatches.length - 1"
					class="bg-app-line h-[calc(100%+0.75rem)] w-px left-4 top-9 absolute dark:bg-app-line-dark"
				/>
				<div class="px-4 py-4 border border-app-line/70 rounded-[1rem] bg-white/85 dark:border-app-line-dark dark:bg-app-panel-dark/80">
					<div class="flex flex-wrap gap-2 items-center justify-between">
						<p class="text-sm text-app-ink font-semibold dark:text-app-text-dark">
							{{ match.label }}
						</p>
						<div class="flex flex-wrap gap-2 items-center">
							<VerificationBadge :label="classifyDistrict(match).group" :tone="classifyDistrict(match).group === 'Federal' ? 'accent' : 'neutral'" />
							<VerificationBadge :label="match.sourceSystem" />
						</div>
					</div>
					<p class="text-xs text-app-muted tracking-[0.16em] font-semibold mt-2 uppercase dark:text-app-muted-dark">
						{{ match.districtType }} · {{ match.districtCode }}
					</p>
				</div>
			</li>
		</ol>

		<p class="text-xs text-app-muted leading-6 mt-4 dark:text-app-muted-dark">
			<strong class="text-app-ink dark:text-app-text-dark">Uncertainty:</strong>
			{{ uncertaintyNote }}
		</p>
	</section>
</template>
