<script setup lang="ts">
import type { Source } from "~/types/civic";

interface OfficeContextBadge {
	label: string;
	tone?: "accent" | "neutral" | "warning";
}

interface OfficeContextStat {
	label: string;
	note: string;
	value: number | string;
}

const props = withDefaults(defineProps<{
	badges?: OfficeContextBadge[];
	eyebrow?: string;
	officeLabel?: string;
	responsibilities?: string[];
	sourceButtonLabel?: string;
	sources?: Source[];
	stats?: OfficeContextStat[];
	summary: string;
	title: string;
	uncertainty?: string;
	whyItMatters?: string;
}>(), {
	badges: () => [],
	eyebrow: "Office context",
	officeLabel: "",
	responsibilities: () => [],
	sourceButtonLabel: "Sources",
	sources: () => [],
	stats: () => [],
	uncertainty: "",
	whyItMatters: ""
});
</script>

<template>
	<section class="p-5 border border-app-line/80 rounded-[1.6rem] bg-app-bg dark:border-app-line-dark dark:bg-app-bg-dark/70">
		<div class="flex flex-wrap gap-4 items-start justify-between">
			<div class="max-w-4xl">
				<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
					{{ props.eyebrow }}
				</p>
				<h3 class="text-2xl text-app-ink font-serif mt-3 dark:text-app-text-dark">
					{{ props.title }}
				</h3>
				<p v-if="props.officeLabel" class="text-sm text-app-muted mt-3 dark:text-app-muted-dark">
					{{ props.officeLabel }}
				</p>
				<p class="text-sm text-app-muted leading-7 mt-3 dark:text-app-muted-dark">
					{{ props.summary }}
				</p>
			</div>
			<div class="flex flex-wrap gap-2 items-center justify-end">
				<VerificationBadge
					v-for="badge in props.badges"
					:key="badge.label"
					:label="badge.label"
					:tone="badge.tone"
				/>
				<SourceDrawer
					v-if="props.sources.length"
					:sources="props.sources"
					:title="props.title"
					:button-label="props.sourceButtonLabel"
				/>
			</div>
		</div>

		<div v-if="props.stats.length" class="mt-5 gap-3 grid md:grid-cols-2 xl:grid-cols-4">
			<FactStatCard
				v-for="item in props.stats"
				:key="item.label"
				:label="item.label"
				:note="item.note"
				:value="item.value"
			/>
		</div>

		<div class="mt-5 gap-4 grid lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
			<div class="px-4 py-4 border border-app-line/70 rounded-[1rem] bg-white/85 dark:border-app-line-dark dark:bg-app-panel-dark/80">
				<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
					Why this office matters
				</p>
				<p class="text-sm text-app-muted leading-7 mt-3 dark:text-app-muted-dark">
					{{ props.whyItMatters || props.summary }}
				</p>
			</div>
			<div class="px-4 py-4 border border-app-line/70 rounded-[1rem] bg-white/85 dark:border-app-line-dark dark:bg-app-panel-dark/80">
				<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
					What this surface covers
				</p>
				<ul class="mt-3 space-y-3">
					<li
						v-for="item in props.responsibilities"
						:key="item"
						class="text-sm text-app-muted leading-6 px-3 py-3 rounded-[0.9rem] bg-app-bg dark:text-app-muted-dark dark:bg-app-bg-dark/80"
					>
						{{ item }}
					</li>
				</ul>
			</div>
		</div>

		<p v-if="props.uncertainty" class="text-xs text-app-muted leading-6 mt-4 dark:text-app-muted-dark">
			<strong class="text-app-ink dark:text-app-text-dark">Uncertainty:</strong>
			{{ props.uncertainty }}
		</p>
	</section>
</template>
