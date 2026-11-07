<script setup lang="ts">
import { findParticipationGuide, participationReviewedAt } from "~/data/civic-participation";

definePageMeta({
	validate: route => "activity" in route.params && Boolean(findParticipationGuide(route.params.activity))
});

const route = useRoute();
const guide = computed(() => findParticipationGuide(route.params.activity));

usePageSeo(() => ({
	description: guide.value?.summary ?? "Civic participation resources.",
	path: `/get-involved/${guide.value?.slug ?? ""}`,
	title: guide.value?.title ?? "Get involved"
}));
</script>

<template>
	<article v-if="guide" class="app-shell section-gap">
		<header class="max-w-4xl">
			<NuxtLink to="/get-involved" class="text-base text-app-accent rounded-sm underline underline-offset-3 focus-ring">
				Get involved
			</NuxtLink>
			<h1 class="text-5xl text-app-ink font-serif mt-5 dark:text-app-text-dark">
				{{ guide.title }}
			</h1>
		</header>
		<section v-for="group in guide.groups" :key="group.title" class="mt-16 md:mt-24">
			<h2 class="text-3xl text-app-ink font-serif dark:text-app-text-dark">
				{{ group.title }}
			</h2>
			<div class="mt-8 gap-8 grid lg:grid-cols-2">
				<section
					v-for="section in group.sections"
					:id="section.id"
					:key="section.id"
					:aria-labelledby="`${section.id}-heading`"
					class="p-6 border border-app-line rounded-xl min-w-0 scroll-mt-24 md:p-8 dark:border-app-line-dark"
				>
					<h3 :id="`${section.id}-heading`" class="text-2xl text-app-ink font-semibold dark:text-app-text-dark">
						{{ section.title }}
					</h3>
					<p class="text-base text-app-ink leading-7 mt-5 dark:text-app-text-dark">
						{{ section.summary }}
					</p>
					<ol class="text-base text-app-ink leading-7 mt-6 pl-5 list-decimal space-y-4 dark:text-app-text-dark">
						<li v-for="step in section.steps" :key="step">
							{{ step }}
						</li>
					</ol>
					<ul class="text-base mt-7 space-y-3">
						<li v-for="link in section.links" :key="link.href">
							<SafeExternalLink :href="link.href" external-icon class="text-app-accent rounded-sm underline underline-offset-3 inline-flex gap-2 items-center focus-ring">
								{{ link.label }}
							</SafeExternalLink>
						</li>
					</ul>
				</section>
			</div>
		</section>
		<UpdatedAt :value="participationReviewedAt" label="Participation resources reviewed on" footer />
	</article>
</template>
