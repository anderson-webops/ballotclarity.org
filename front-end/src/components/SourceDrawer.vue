<script setup lang="ts">
import type { Source } from "~/types/civic";

const props = withDefaults(defineProps<{
	buttonLabel?: string;
	note?: string;
	sources: Source[];
	title: string;
	tone?: "accent" | "neutral" | "warning";
	variant?: "badge" | "button";
}>(), {
	buttonLabel: "View sources",
	tone: "neutral",
	variant: "button",
});

const isOpen = ref(false);
const headingId = `source-drawer-${useId()}`;
const noteId = `${headingId}-note`;
const closeButton = ref<HTMLButtonElement | null>(null);
const activeElementBeforeOpen = ref<HTMLElement | null>(null);
const panelRef = ref<HTMLElement | null>(null);

const triggerClass = computed(() => {
	if (props.variant === "badge") {
		const toneClass = props.tone === "accent"
			? "border-app-accent/22 bg-app-accent/8 text-app-accent dark:border-app-accent/28 dark:bg-app-accent/12 dark:text-[#9ed4e3]"
			: props.tone === "warning"
				? "border-[#b7791f]/18 bg-[#f8edd8]/85 text-[#8a5b0a] dark:border-[#b7791f]/24 dark:bg-[#3b2a0f]/88 dark:text-[#efc77b]"
				: "border-app-line/90 bg-white/85 text-app-muted dark:border-app-line-dark dark:bg-app-panel-dark/85 dark:text-app-muted-dark";

		return `text-[11px] font-semibold px-2.5 py-1 border rounded-full inline-flex gap-1.5 items-center cursor-pointer ${toneClass} focus-ring`;
	}

	return "btn-secondary text-xs px-4 py-2 focus-ring";
});

function getFocusableElements() {
	if (!panelRef.value)
		return [];

	return Array.from(panelRef.value.querySelectorAll<HTMLElement>("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])"))
		.filter(element => !element.hasAttribute("disabled") && element.getAttribute("aria-hidden") !== "true");
}

function closeDrawer() {
	isOpen.value = false;
}

function handleKeydown(event: KeyboardEvent) {
	if (event.key === "Escape") {
		closeDrawer();
		return;
	}

	if (event.key !== "Tab")
		return;

	const focusableElements = getFocusableElements();

	if (!focusableElements.length)
		return;

	const firstElement = focusableElements[0]!;
	const lastElement = focusableElements.at(-1)!;
	const activeElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;

	if (!activeElement || !panelRef.value?.contains(activeElement)) {
		event.preventDefault();
		firstElement.focus();
		return;
	}

	if (event.shiftKey && activeElement === firstElement) {
		event.preventDefault();
		lastElement.focus();
		return;
	}

	if (!event.shiftKey && activeElement === lastElement) {
		event.preventDefault();
		firstElement.focus();
	}
}

watch(isOpen, (value) => {
	if (import.meta.client) {
		document.documentElement.style.overflow = value ? "hidden" : "";

		if (value) {
			activeElementBeforeOpen.value = document.activeElement instanceof HTMLElement ? document.activeElement : null;
			document.addEventListener("keydown", handleKeydown);
			nextTick(() => closeButton.value?.focus());
			return;
		}

		document.removeEventListener("keydown", handleKeydown);
		nextTick(() => activeElementBeforeOpen.value?.focus());
	}
});

onBeforeUnmount(() => {
	if (import.meta.client) {
		document.documentElement.style.overflow = "";
		document.removeEventListener("keydown", handleKeydown);
	}
});
</script>

<template>
	<div class="inline-flex">
		<button type="button" :class="triggerClass" @click="isOpen = true">
			<span v-if="props.variant === 'badge'" class="rounded-full bg-current h-1.5 w-1.5" />
			<span v-else class="i-carbon-document-multiple-01 text-sm" />
			{{ buttonLabel }}
		</button>

		<Teleport to="body">
			<div v-if="isOpen" class="inset-0 fixed z-70">
				<button type="button" class="bg-app-ink/50 inset-0 absolute backdrop-blur-[2px]" aria-label="Close source panel" @click="closeDrawer" />
				<aside
					ref="panelRef"
					class="p-5 border-l border-app-line bg-app-bg flex flex-col h-full max-w-xl w-full shadow-2xl right-0 top-0 absolute dark:border-app-line-dark dark:bg-app-bg-dark"
					role="dialog"
					:aria-labelledby="headingId"
					:aria-describedby="note ? noteId : undefined"
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
							<p v-if="note" :id="noteId" class="text-sm text-app-muted mt-2 dark:text-app-muted-dark">
								{{ note }}
							</p>
						</div>
						<button ref="closeButton" type="button" class="border border-app-line rounded-full bg-white inline-flex h-11 w-11 items-center justify-center dark:border-app-line-dark dark:bg-app-panel-dark focus-ring" aria-label="Close source panel" @click="closeDrawer">
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
