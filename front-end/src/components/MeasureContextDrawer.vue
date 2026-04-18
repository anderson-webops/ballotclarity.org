<script setup lang="ts">
import type { Measure, OfficialResource } from "~/types/civic";

const props = defineProps<{
	measure: Measure;
}>();

const isOpen = ref(false);
const headingId = `measure-context-${useId()}`;
const closeButton = ref<HTMLButtonElement | null>(null);
const activeElementBeforeOpen = ref<HTMLElement | null>(null);
const panelRef = ref<HTMLElement | null>(null);

const officialResources = computed<OfficialResource[]>(() => props.measure.sources
	.filter(source => source.authority === "official-government")
	.map(source => ({
		authority: source.authority,
		label: source.title,
		note: source.note,
		sourceLabel: source.publisher,
		sourceSystem: source.sourceSystem,
		url: source.url
	})));

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
		<button type="button" class="btn-secondary text-xs px-4 py-2 focus-ring" @click="isOpen = true">
			<span class="i-carbon-document-view" />
			More context
		</button>

		<Teleport to="body">
			<div v-if="isOpen" class="inset-0 fixed z-70">
				<button type="button" class="bg-app-ink/50 inset-0 absolute backdrop-blur-[2px]" :aria-label="`Close ${measure.title} context panel`" @click="closeDrawer" />
				<aside
					ref="panelRef"
					class="p-5 border-l border-app-line bg-app-bg flex flex-col h-full max-w-xl w-full shadow-2xl right-0 top-0 absolute dark:border-app-line-dark dark:bg-app-bg-dark"
					role="dialog"
					:aria-labelledby="headingId"
					aria-modal="true"
				>
					<div class="flex gap-4 items-start justify-between">
						<div>
							<p class="text-xs text-app-muted tracking-[0.24em] font-semibold uppercase dark:text-app-muted-dark">
								Measure context
							</p>
							<h2 :id="headingId" class="text-2xl text-app-ink font-serif mt-2 dark:text-app-text-dark">
								{{ measure.title }}
							</h2>
							<p class="text-sm text-app-muted leading-7 mt-3 dark:text-app-muted-dark">
								Secondary reading view with the longer summary, decision framing, and attached official materials.
							</p>
						</div>
						<button ref="closeButton" type="button" class="border border-app-line rounded-full bg-white inline-flex h-11 w-11 items-center justify-center dark:border-app-line-dark dark:bg-app-panel-dark focus-ring" aria-label="Close measure context panel" @click="closeDrawer">
							<span class="i-carbon-close text-lg" />
						</button>
					</div>

					<div class="mt-6 pr-1 flex-1 overflow-y-auto space-y-4">
						<section class="surface-panel">
							<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
								Ballot summary
							</p>
							<p class="text-sm text-app-muted leading-7 mt-3 dark:text-app-muted-dark">
								{{ measure.ballotSummary }}
							</p>
						</section>

						<section class="surface-panel">
							<p class="text-xs text-app-muted tracking-[0.18em] font-semibold uppercase dark:text-app-muted-dark">
								Plain-language explanation
							</p>
							<p class="text-sm text-app-muted leading-7 mt-3 dark:text-app-muted-dark">
								{{ measure.plainLanguageExplanation }}
							</p>
							<div class="mt-4 space-y-3">
								<p class="text-sm text-app-muted leading-7 dark:text-app-muted-dark">
									<strong class="text-app-ink dark:text-app-text-dark">YES:</strong> {{ measure.yesMeaning }}
								</p>
								<p class="text-sm text-app-muted leading-7 dark:text-app-muted-dark">
									<strong class="text-app-ink dark:text-app-text-dark">NO:</strong> {{ measure.noMeaning }}
								</p>
							</div>
						</section>

						<section v-if="officialResources.length" class="surface-panel">
							<OfficialResourceList
								:resources="officialResources"
								title="Attached official sources"
								note="These links come from the official-government sources already attached to this measure."
							/>
						</section>

						<section v-else class="surface-panel">
							<SourceList
								:sources="measure.sources"
								compact
								title="Attached sources"
								note="No separate official-resource list is available for this card, so the drawer shows the attached source records directly."
							/>
						</section>
					</div>
				</aside>
			</div>
		</Teleport>
	</div>
</template>
