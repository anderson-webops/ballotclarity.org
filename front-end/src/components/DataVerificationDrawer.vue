<script setup lang="ts">
const props = withDefaults(defineProps<{
	openOnMount?: boolean;
}>(), {
	openOnMount: false
});
const isOpen = ref(false);
const headingId = `data-verification-${useId()}`;
const closeButton = ref<HTMLButtonElement | null>(null);
const activeElementBeforeOpen = ref<HTMLElement | null>(null);
const panelRef = ref<HTMLElement | null>(null);

const verificationSections = [
	{
		body: [
			"Verification badges summarize whether a statement comes from official election material, attached public records, or clearly labeled campaign or archive material.",
			"Badges are meant to reduce page clutter, not replace evidence. The source drawer and source directory remain available when you want the record itself."
		],
		title: "How badges work"
	},
	{
		body: [
			"Freshness is tracked separately from readability. A page can be clearly written and still need another review pass before voting-day reliance.",
			"Current review windows, source health, and coverage limits are published on the public status, coverage, and methodology pages."
		],
		title: "How review timing works"
	},
	{
		body: [
			"Ballot Clarity is informational and nonpartisan. It does not score candidates, endorse outcomes, or replace official election office records.",
			"Use the official links shown on election, ballot, and location pages for deadlines, polling logistics, and final ballot verification."
		],
		title: "What to trust first"
	}
];

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

onMounted(() => {
	if (props.openOnMount)
		isOpen.value = true;
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
		<button type="button" class="text-sm text-app-ink font-semibold rounded-md inline-flex gap-2 transition items-center dark:text-app-text-dark hover:text-app-accent focus-ring dark:hover:text-white" @click="isOpen = true">
			<span>Data verification</span>
			<span class="i-carbon-arrow-up-right" aria-hidden="true" />
		</button>

		<Teleport to="body">
			<div v-if="isOpen" class="inset-0 fixed z-70">
				<button type="button" class="bg-app-ink/50 inset-0 absolute backdrop-blur-[2px]" aria-label="Close data verification panel" @click="closeDrawer" />
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
								Data verification
							</p>
							<h2 :id="headingId" class="text-2xl text-app-ink font-serif mt-2 dark:text-app-text-dark">
								How Ballot Clarity handles verification, freshness, and source hierarchy
							</h2>
							<p class="text-sm text-app-muted leading-7 mt-3 dark:text-app-muted-dark">
								This panel keeps the meta-explanation in one place so ballot and contest reading surfaces can stay focused on the content itself.
							</p>
						</div>
						<button ref="closeButton" type="button" class="border border-app-line rounded-full bg-white inline-flex h-11 w-11 items-center justify-center dark:border-app-line-dark dark:bg-app-panel-dark focus-ring" aria-label="Close data verification panel" @click="closeDrawer">
							<span class="i-carbon-close text-lg" />
						</button>
					</div>

					<div class="mt-6 pr-1 flex-1 overflow-y-auto space-y-4">
						<section v-for="section in verificationSections" :key="section.title" class="surface-panel">
							<h3 class="text-xl text-app-ink font-serif dark:text-app-text-dark">
								{{ section.title }}
							</h3>
							<div class="mt-4 space-y-3">
								<p v-for="paragraph in section.body" :key="paragraph" class="text-sm text-app-muted leading-7 dark:text-app-muted-dark">
									{{ paragraph }}
								</p>
							</div>
						</section>

						<section class="surface-panel">
							<h3 class="text-xl text-app-ink font-serif dark:text-app-text-dark">
								Read the full public standards
							</h3>
							<div class="mt-4 flex flex-wrap gap-3">
								<NuxtLink to="/sources" class="btn-secondary text-xs px-4 py-2" @click="closeDrawer">
									Source directory
								</NuxtLink>
								<NuxtLink to="/status" class="btn-secondary text-xs px-4 py-2" @click="closeDrawer">
									Public status
								</NuxtLink>
								<NuxtLink to="/methodology" class="btn-secondary text-xs px-4 py-2" @click="closeDrawer">
									Methodology
								</NuxtLink>
								<NuxtLink to="/coverage" class="btn-secondary text-xs px-4 py-2" @click="closeDrawer">
									Coverage
								</NuxtLink>
							</div>
						</section>
					</div>
				</aside>
			</div>
		</Teleport>
	</div>
</template>
