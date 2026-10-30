<script setup lang="ts">
import type { PersonProfile } from "~/types/civic";
import { hasPersonFunding, hasPersonInfluence } from "~/utils/person-profile";
import { substantiveBiography } from "~/utils/representative-presentation";

const props = defineProps<{ person: PersonProfile }>();
const biography = computed(() => substantiveBiography(props.person));
const { formatDate } = useFormatters();
</script>

<template>
	<div class="section-stack">
		<section class="pt-8 border-t border-app-line space-y-4 dark:border-app-line-dark">
			<h2 class="text-2xl text-app-ink font-serif dark:text-app-text-dark">
				Current office
			</h2>
			<p>{{ person.officeDisplayLabel || person.officeSought }}</p>
			<SafeExternalLink v-if="person.officialWebsiteUrl" :href="person.officialWebsiteUrl" class="text-app-accent underline focus-ring">
				Office website
			</SafeExternalLink>
		</section>
		<section v-if="biography.length" class="space-y-8">
			<h2 class="text-2xl text-app-ink font-serif dark:text-app-text-dark">
				Background
			</h2>
			<article v-for="block in biography" :key="block.id" class="space-y-3">
				<h3 class="text-lg font-semibold">
					{{ block.title }}
				</h3>
				<p class="leading-7">
					{{ block.summary }}
				</p>
				<SourceDrawer v-if="block.sources.length" :sources="block.sources" :title="block.title" button-label="Citations" />
			</article>
		</section>
		<section v-if="person.keyActions.length" class="space-y-8">
			<h2 class="text-2xl text-app-ink font-serif dark:text-app-text-dark">
				Votes and actions
			</h2>
			<article v-for="action in person.keyActions.slice(0, 3)" :key="action.id" class="space-y-3">
				<h3 class="text-lg font-semibold">
					{{ action.title }}
				</h3>
				<time :datetime="action.date" class="text-sm">{{ formatDate(action.date) }}</time>
				<p class="leading-7">
					{{ action.summary }}
				</p>
				<SourceDrawer v-if="action.sources.length" :sources="action.sources" :title="action.title" button-label="Citations" />
			</article>
		</section>
		<nav aria-label="Person details" class="flex flex-wrap gap-x-6 gap-y-3">
			<NuxtLink :to="`/representatives/${person.slug}`" class="text-app-accent py-2 underline focus-ring">
				Full profile
			</NuxtLink>
			<NuxtLink v-if="hasPersonFunding(person)" :to="`/representatives/${person.slug}/funding`" class="text-app-accent py-2 underline focus-ring">
				Funding
			</NuxtLink>
			<NuxtLink v-if="hasPersonInfluence(person)" :to="`/representatives/${person.slug}/influence`" class="text-app-accent py-2 underline focus-ring">
				Influence
			</NuxtLink>
		</nav>
	</div>
</template>
