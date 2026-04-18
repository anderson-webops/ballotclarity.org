<script setup lang="ts">
import type { TimelineEvent } from "~/types/civic";

const props = withDefaults(defineProps<{
	badgeLabel?: string;
	eyebrow?: string;
	items: TimelineEvent[];
	note?: string;
	title: string;
	uncertainty?: string;
}>(), {
	badgeLabel: "",
	eyebrow: "Timeline",
	note: "",
	uncertainty: ""
});

const { formatDate } = useFormatters();
</script>

<template>
	<section v-if="props.items.length" class="p-5 border border-app-line/80 rounded-[1.6rem] bg-app-bg dark:border-app-line-dark dark:bg-app-bg-dark/70">
		<div class="flex flex-wrap gap-4 items-start justify-between">
			<div class="max-w-4xl">
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
			<VerificationBadge
				v-if="props.badgeLabel"
				:label="props.badgeLabel"
				tone="accent"
			/>
		</div>

		<ol class="mt-5 space-y-4">
			<li
				v-for="(item, index) in props.items"
				:key="item.id"
				class="pl-14 relative"
			>
				<span class="text-sm text-app-ink font-semibold border border-app-line rounded-full bg-white flex h-9 w-9 items-center left-0 top-1 justify-center absolute dark:text-app-text-dark dark:border-app-line-dark dark:bg-app-panel-dark">
					{{ index + 1 }}
				</span>
				<span
					v-if="index < props.items.length - 1"
					class="bg-app-line h-[calc(100%+0.75rem)] w-px left-4 top-10 absolute dark:bg-app-line-dark"
				/>
				<div class="px-4 py-4 border border-app-line/70 rounded-[1rem] bg-white/85 dark:border-app-line-dark dark:bg-app-panel-dark/80">
					<div class="flex flex-wrap gap-3 items-start justify-between">
						<div>
							<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
								{{ formatDate(item.date) }}
							</p>
							<h4 class="text-lg text-app-ink font-semibold mt-2 dark:text-app-text-dark">
								{{ item.title }}
							</h4>
						</div>
						<SourceDrawer
							v-if="item.sources?.length"
							:sources="item.sources"
							:title="item.title"
							button-label="Sources"
						/>
					</div>
					<p class="text-sm text-app-muted leading-7 mt-3 dark:text-app-muted-dark">
						{{ item.summary }}
					</p>
					<p v-if="item.detail" class="text-sm text-app-ink font-medium mt-3 dark:text-app-text-dark">
						{{ item.detail }}
					</p>
					<p v-if="item.uncertainty" class="text-xs text-app-muted leading-6 mt-3 dark:text-app-muted-dark">
						<strong class="text-app-ink dark:text-app-text-dark">Uncertainty:</strong>
						{{ item.uncertainty }}
					</p>
				</div>
			</li>
		</ol>

		<p v-if="props.uncertainty" class="text-xs text-app-muted leading-6 mt-4 dark:text-app-muted-dark">
			<strong class="text-app-ink dark:text-app-text-dark">Uncertainty:</strong>
			{{ props.uncertainty }}
		</p>
	</section>
</template>
