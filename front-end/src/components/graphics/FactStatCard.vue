<script setup lang="ts">
interface FactStatBadge {
	label: string;
	tone?: "accent" | "neutral" | "warning";
}

const props = withDefaults(defineProps<{
	badges?: FactStatBadge[];
	eyebrow?: string;
	label: string;
	note: string;
	value: number | string;
}>(), {
	badges: () => [],
	eyebrow: ""
});
</script>

<template>
	<article class="px-4 py-4 border border-app-line/80 rounded-[1.4rem] bg-white/88 dark:border-app-line-dark dark:bg-app-panel-dark/82">
		<div class="flex flex-wrap gap-2 items-start justify-between">
			<div>
				<p v-if="props.eyebrow" class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
					{{ props.eyebrow }}
				</p>
				<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark" :class="props.eyebrow ? 'mt-2' : ''">
					{{ props.label }}
				</p>
			</div>
			<div v-if="props.badges.length" class="flex flex-wrap gap-2 items-center justify-end">
				<VerificationBadge
					v-for="badge in props.badges"
					:key="badge.label"
					:label="badge.label"
					:tone="badge.tone"
				/>
			</div>
		</div>
		<p class="text-2xl text-app-ink font-serif mt-4 dark:text-app-text-dark">
			{{ props.value }}
		</p>
		<p class="text-sm text-app-muted leading-6 mt-3 dark:text-app-muted-dark">
			{{ props.note }}
		</p>
	</article>
</template>
