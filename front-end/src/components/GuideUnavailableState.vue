<script setup lang="ts">
const props = defineProps<{
	message: string;
	primaryLabel?: string;
	primaryTo?: string;
	secondaryLabel?: string;
	secondaryTo?: string;
	tertiaryLabel?: string;
	tertiaryTo?: string;
	title: string;
}>();

const showSecondaryAction = computed(() => Boolean(
	props.secondaryTo
	&& props.secondaryLabel
	&& props.secondaryTo !== props.primaryTo
));
const showTertiaryAction = computed(() => Boolean(
	props.tertiaryTo
	&& props.tertiaryLabel
	&& props.tertiaryTo !== props.primaryTo
	&& props.tertiaryTo !== props.secondaryTo
));
</script>

<template>
	<section class="max-w-3xl">
		<h1 class="text-4xl text-app-ink leading-tight font-serif sm:text-5xl dark:text-app-text-dark">
			{{ title }}
		</h1>
		<p class="text-lg text-app-ink leading-8 mt-4 dark:text-app-text-dark">
			{{ message }}
		</p>
		<div class="mt-6 flex flex-wrap gap-x-6 gap-y-3 items-center">
			<NuxtLink v-if="primaryTo && primaryLabel" :to="primaryTo" class="btn-primary">
				{{ primaryLabel }}
			</NuxtLink>
			<NuxtLink v-if="showSecondaryAction" :to="secondaryTo ?? '/'" class="btn-secondary">
				{{ secondaryLabel }}
			</NuxtLink>
			<NuxtLink v-if="showTertiaryAction" :to="tertiaryTo ?? '/'" class="btn-secondary">
				{{ tertiaryLabel }}
			</NuxtLink>
		</div>
	</section>
</template>
