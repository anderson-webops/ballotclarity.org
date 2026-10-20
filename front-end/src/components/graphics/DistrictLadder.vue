<script setup lang="ts">
import type { LocationDistrictMatch } from "~/types/civic";
import { classifyDistrictLevel } from "~/utils/district-level";

const props = withDefaults(defineProps<{
	links?: Record<string, string>;
	lookupInputKind?: "address" | "zip" | "";
	matches: LocationDistrictMatch[];
	normalizedAddress?: string;
	title?: string;
}>(), {
	links: () => ({}),
	lookupInputKind: "",
	normalizedAddress: "",
	title: "Your districts"
});

const orderedMatches = computed(() => {
	return [...props.matches]
		.map(match => ({ level: classifyDistrictLevel(match), match }))
		.sort((left, right) => left.level.order - right.level.order || left.match.label.localeCompare(right.match.label));
});

const sourceSystems = computed(() => [...new Set(props.matches.map(match => match.sourceSystem).filter(Boolean))]);

const uncertaintyNote = computed(() => {
	if (props.lookupInputKind === "zip")
		return "ZIP-only results are approximate. Street-level districts can still change inside the same ZIP code.";

	return "Your election office is the final authority on which districts and ballot style apply to your address.";
});
</script>

<template>
	<section v-if="props.matches.length" class="surface-panel">
		<h2 class="text-2xl text-app-ink font-serif dark:text-app-text-dark">
			{{ props.title }}
		</h2>
		<p class="text-sm text-app-muted leading-6 mt-2 dark:text-app-muted-dark">
			From the largest area to the most local<span v-if="props.normalizedAddress"> for {{ props.normalizedAddress }}</span>.
		</p>

		<ol class="mt-4 divide-app-line divide-y dark:divide-app-line-dark">
			<li
				v-for="{ level, match } in orderedMatches"
				:key="match.id"
				class="py-3 flex gap-3 items-baseline justify-between"
			>
				<div class="min-w-0">
					<NuxtLink
						v-if="props.links[match.id]"
						:to="props.links[match.id]"
						class="text-[0.95rem] text-app-ink font-semibold underline decoration-app-line underline-offset-3 transition dark:text-app-text-dark hover:text-app-accent hover:decoration-current focus-ring"
					>
						{{ match.label }}
					</NuxtLink>
					<p v-else class="text-[0.95rem] text-app-ink font-semibold dark:text-app-text-dark">
						{{ match.label }}
					</p>
				</div>
				<span class="text-xs text-app-muted font-semibold shrink-0 dark:text-app-muted-dark">{{ level.label }}</span>
			</li>
		</ol>

		<p class="text-xs text-app-muted leading-6 mt-3 dark:text-app-muted-dark">
			{{ uncertaintyNote }}<span v-if="sourceSystems.length"> Matched with {{ sourceSystems.join(", ") }}.</span>
		</p>
	</section>
</template>
