<script setup lang="ts">
import type { Source } from "~/types/civic";

withDefaults(defineProps<{
	buttonLabel?: string;
	note?: string;
	sources: Source[];
	title: string;
}>(), {
	buttonLabel: "View sources",
});

const isOpen = ref(false);
const headingId = `source-drawer-${useId()}`;

watch(isOpen, (value) => {
	if (import.meta.client)
		document.documentElement.style.overflow = value ? "hidden" : "";
});

onBeforeUnmount(() => {
	if (import.meta.client)
		document.documentElement.style.overflow = "";
});
</script>

<template>
	<div class="inline-flex">
		<button type="button" class="btn-secondary text-xs px-4 py-2 focus-ring" @click="isOpen = true">
			<span class="i-carbon-document-multiple-01 text-sm" />
			{{ buttonLabel }}
		</button>

		<Teleport to="body">
			<div v-if="isOpen" class="inset-0 fixed z-70">
				<button type="button" class="bg-app-ink/50 inset-0 absolute backdrop-blur-[2px]" aria-label="Close source panel" @click="isOpen = false" />
				<aside
					class="p-5 border-l border-app-line bg-app-bg flex flex-col h-full max-w-xl w-full shadow-2xl right-0 top-0 absolute dark:border-app-line-dark dark:bg-app-bg-dark"
					role="dialog"
					:aria-labelledby="headingId"
					aria-modal="true"
				>
					<div class="flex gap-4 items-start justify-between">
						<div>
							<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
								Sources
							</p>
							<h2 :id="headingId" class="text-2xl text-app-ink font-serif mt-2 dark:text-app-text-dark">
								{{ title }}
							</h2>
							<p v-if="note" class="text-sm text-app-muted mt-2 dark:text-app-muted-dark">
								{{ note }}
							</p>
						</div>
						<button type="button" class="border border-app-line rounded-full bg-white inline-flex h-11 w-11 items-center justify-center dark:border-app-line-dark dark:bg-app-panel-dark focus-ring" aria-label="Close source panel" @click="isOpen = false">
							<span class="i-carbon-close text-lg" />
						</button>
					</div>

					<div class="mt-6 pr-1 flex-1 overflow-y-auto">
						<SourceList :sources="sources" />
					</div>
				</aside>
			</div>
		</Teleport>
	</div>
</template>
