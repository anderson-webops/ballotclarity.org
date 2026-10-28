<script setup lang="ts">
import type { Candidate } from "~/types/civic";

defineProps<{ candidate: Candidate; viewMode?: "deep" | "quick" }>();
</script>

<template>
	<NuxtLink :to="`/candidate/${candidate.slug}`" class="py-3 flex gap-4 min-w-0 items-center focus-ring">
		<ProfileImageStack v-if="candidate.profileImages?.length" :images="candidate.profileImages" :name="candidate.name" size="sm" class="shrink-0" />
		<div class="min-w-0">
			<h3 class="text-[1.45rem] text-app-ink leading-tight font-serif dark:text-app-text-dark">
				{{ candidate.name }}
			</h3>
			<p class="text-sm text-app-muted mt-2 dark:text-app-muted-dark">
				<PartyLabel :party="candidate.party" /><template v-if="candidate.incumbent">
					· Incumbent
				</template>
			</p>
		</div>
	</NuxtLink>
</template>
