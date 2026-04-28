<script setup lang="ts">
import type { LookupAvailability, LookupAvailabilityStatus } from "~/types/civic";

const props = withDefaults(defineProps<{
	eyebrow?: string;
	items: LookupAvailability[];
	note?: string;
	title: string;
	uncertainty?: string;
}>(), {
	eyebrow: "Data availability",
	note: "",
	uncertainty: ""
});

const statusSummary = computed(() => {
	const counts = {
		available: props.items.filter(item => item.status === "available").length,
		limited: props.items.filter(item => item.status === "partial" || item.status === "limited").length,
		unavailable: props.items.filter(item => item.status === "unavailable").length
	};

	return [
		{ detail: "Can be shown from the current lookup or guide data.", id: "available", label: "Available", tone: "accent" as const, value: counts.available },
		{ detail: "Exists only in a partial, preview, or limited form.", id: "limited", label: "Limited or partial", tone: "warning" as const, value: counts.limited },
		{ detail: "Not available from the current source set.", id: "unavailable", label: "Unavailable", tone: "neutral" as const, value: counts.unavailable }
	];
});

function availabilityTone(status: LookupAvailabilityStatus) {
	return status === "available" ? "accent" : status === "partial" || status === "limited" ? "warning" : "neutral";
}

function statusLabel(status: LookupAvailabilityStatus) {
	if (status === "partial")
		return "Partial";

	if (status === "limited")
		return "Limited";

	if (status === "available")
		return "Available";

	return "Unavailable";
}
</script>

<template>
	<section v-if="props.items.length" class="p-5 border border-app-line/80 rounded-[1.6rem] bg-app-bg dark:border-app-line-dark dark:bg-app-bg-dark/70">
		<div class="flex flex-wrap gap-4 items-start justify-between">
			<div class="max-w-3xl">
				<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
					{{ props.eyebrow }}
				</p>
				<h3 class="text-2xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
					{{ props.title }}
				</h3>
				<p v-if="props.note" class="text-sm text-app-muted leading-7 mt-3 dark:text-app-muted-dark">
					{{ props.note }}
				</p>
			</div>
		</div>

		<div class="mt-5 gap-3 grid md:grid-cols-3">
			<article
				v-for="summary in statusSummary"
				:key="summary.id"
				class="px-4 py-4 border border-app-line/70 rounded-[1rem] bg-white/85 dark:border-app-line-dark dark:bg-app-panel-dark/80"
			>
				<div class="flex flex-wrap gap-2 items-start justify-between">
					<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
						{{ summary.label }}
					</p>
					<VerificationBadge :label="String(summary.value)" :tone="summary.tone" />
				</div>
				<p class="text-sm text-app-muted leading-6 mt-3 dark:text-app-muted-dark">
					{{ summary.detail }}
				</p>
			</article>
		</div>

		<div class="mt-5 gap-3 grid md:grid-cols-2 xl:grid-cols-3">
			<article
				v-for="item in props.items"
				:key="item.label"
				class="px-4 py-4 border border-app-line/70 rounded-[1rem] bg-white/85 dark:border-app-line-dark dark:bg-app-panel-dark/80"
			>
				<div class="flex flex-wrap gap-2 items-start justify-between">
					<p class="text-sm text-app-ink font-semibold dark:text-app-text-dark">
						{{ item.label }}
					</p>
					<VerificationBadge :label="statusLabel(item.status)" :tone="availabilityTone(item.status)" />
				</div>
				<p class="text-sm text-app-muted leading-6 mt-3 dark:text-app-muted-dark">
					{{ item.detail }}
				</p>
				<p v-if="item.note" class="text-xs text-app-muted leading-6 mt-3 dark:text-app-muted-dark">
					<strong class="text-app-ink dark:text-app-text-dark">Caution:</strong>
					{{ item.note }}
				</p>
				<div v-if="item.sources?.length" class="mt-3">
					<SourceDrawer :sources="item.sources" :title="item.label" button-label="Sources" />
				</div>
			</article>
		</div>

		<p v-if="props.uncertainty" class="text-xs text-app-muted leading-6 mt-4 dark:text-app-muted-dark">
			<strong class="text-app-ink dark:text-app-text-dark">Uncertainty:</strong>
			{{ props.uncertainty }}
		</p>
	</section>
</template>
