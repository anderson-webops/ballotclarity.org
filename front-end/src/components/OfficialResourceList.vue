<script setup lang="ts">
import type { OfficialResource } from "~/types/civic";

withDefaults(defineProps<{
	compact?: boolean;
	note?: string;
	resources: OfficialResource[];
	title?: string;
}>(), {
	compact: false
});
</script>

<template>
	<div>
		<div v-if="title || note" class="mb-2">
			<h3 v-if="title" class="text-base text-app-ink font-semibold dark:text-app-text-dark">
				{{ title }}
			</h3>
			<p v-if="note" class="text-sm text-app-muted mt-1 dark:text-app-muted-dark">
				{{ note }}
			</p>
		</div>

		<ul>
			<li
				v-for="resource in resources"
				:key="resource.label"
				class="border-b border-app-line dark:border-app-line-dark last:border-b-0"
				:class="compact ? 'py-2' : 'py-3'"
			>
				<SafeExternalLink v-if="resource.url" :href="resource.url" class="text-base text-app-accent font-semibold underline decoration-app-accent/35 underline-offset-4 inline-flex gap-1.5 items-baseline hover:decoration-current focus-ring">
					{{ resource.label }}
					<span class="i-carbon-launch text-sm" aria-hidden="true" />
				</SafeExternalLink>
				<p v-else class="text-base text-app-ink font-semibold dark:text-app-text-dark">
					{{ resource.label }}
				</p>
				<p class="text-sm text-app-muted mt-0.5 dark:text-app-muted-dark">
					{{ resource.sourceLabel }}<span v-if="resource.note"> · {{ resource.note }}</span>
				</p>
			</li>
		</ul>
	</div>
</template>
