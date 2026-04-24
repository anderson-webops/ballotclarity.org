<script setup lang="ts">
const props = defineProps<{
	eyebrow: string;
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
	<section class="surface-panel max-w-5xl">
		<div class="gap-6 grid lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.48fr)] lg:items-start">
			<div>
				<div class="flex flex-wrap gap-2">
					<TrustBadge label="Not a verified guide page" tone="warning" />
					<TrustBadge label="Use official links" />
				</div>
				<p class="text-xs text-app-muted tracking-[0.24em] font-semibold mt-6 uppercase dark:text-app-muted-dark">
					{{ eyebrow }}
				</p>
				<h1 class="text-4xl text-app-ink leading-tight font-serif mt-3 sm:text-5xl dark:text-app-text-dark">
					{{ title }}
				</h1>
				<p class="text-base text-app-muted leading-8 mt-5 dark:text-app-muted-dark">
					{{ message }}
				</p>
				<div class="mt-6 flex flex-wrap gap-3">
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
			</div>

			<div class="px-4 py-4 border border-[#E7B9AA] rounded-[1.4rem] bg-[#FBEEE8] dark:border-[#6D433C] dark:bg-[#3A2421]">
				<p class="text-xs text-[#8B3A2E] tracking-[0.18em] font-semibold uppercase dark:text-[#FFD4CB]">
					What this means
				</p>
				<p class="text-sm text-[#8B3A2E] leading-7 mt-3 dark:text-[#FFD4CB]">
					Ballot Clarity may still have lookup results, representatives, official tools, or an election overview for this area. This detail page stays closed until the underlying contest, candidate, or measure record is reviewed for publication.
				</p>
			</div>
		</div>
	</section>
</template>
