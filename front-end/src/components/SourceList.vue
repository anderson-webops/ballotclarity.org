<script setup lang="ts">
import type { Source } from "~/types/civic";
import { buildSourceRecordHref } from "~/utils/source-record-links";

withDefaults(defineProps<{
	compact?: boolean;
	note?: string;
	sources: Source[];
	title?: string;
}>(), {
	compact: false,
});

const { formatDate } = useFormatters();
const { data: sourceDirectory } = await useSourceDirectory();
const publishedSourceIds = computed(() => new Set((sourceDirectory.value?.sources ?? []).map(source => source.id)));

function getSourceRecordHref(source: Source) {
	return buildSourceRecordHref(source.id, publishedSourceIds.value);
}
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
				v-for="source in sources"
				:key="source.id"
				class="border-b border-app-line dark:border-app-line-dark last:border-b-0"
				:class="compact ? 'py-2' : 'py-3'"
			>
				<NuxtLink
					v-if="getSourceRecordHref(source)"
					:to="getSourceRecordHref(source)!"
					class="text-base text-app-ink font-semibold underline decoration-app-line underline-offset-4 transition dark:text-app-text-dark hover:text-app-accent hover:decoration-current focus-ring"
				>
					{{ source.title }}
				</NuxtLink>
				<p v-else class="text-base text-app-ink font-semibold dark:text-app-text-dark">
					{{ source.title }}
				</p>
				<p class="text-sm text-app-muted mt-0.5 dark:text-app-muted-dark">
					{{ source.publisher }} · <SourceAuthorityBadge :authority="source.authority" /> · {{ formatDate(source.date) }}
				</p>
				<p v-if="source.note && !compact" class="text-sm text-app-muted mt-1 dark:text-app-muted-dark">
					{{ source.note }}
				</p>
				<SafeExternalLink v-if="source.url" :href="source.url" class="text-sm btn-secondary min-h-8">
					Open source
					<span class="i-carbon-launch" aria-hidden="true" />
				</SafeExternalLink>
			</li>
		</ul>
	</div>
</template>
